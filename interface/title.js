/**
 * 开始界面 / 全屏存档 DATA
 * 左上固定自动存档；点「+」在其右侧新建手动存档栏；「+」始终在最右
 * 对外：window.天青_title
 */
(function () {
  /** @type {'auto'|'manual'|''} */
  var selectedKind = 'auto';
  var selectedManualIndex = -1;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function confirmAsk(message, onYes) {
    if (window.天青_settings && window.天青_settings.confirm) {
      window.天青_settings.confirm(message, onYes);
      return;
    }
    if (window.confirm(message)) onYes();
  }

  function isOpen() {
    var el = $('title-screen');
    return !!(el && el.classList.contains('open'));
  }

  function refreshContinueBtn() {
    var btn = $('btn-title-continue');
    if (!btn) return;
    var ok = window.天青_save && window.天青_save.hasProgress && window.天青_save.hasProgress();
    btn.disabled = !ok;
    btn.title = ok ? '读取最近进度' : '暂无进度可继续';
  }

  var TITLE_HIDE_MS = 320;

  function pulseStageEnter() {
    var stage = $('stage');
    if (!stage) return;
    stage.classList.add('is-enter-fade');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        stage.classList.remove('is-enter-fade');
      });
    });
  }

  function show() {
    var el = $('title-screen');
    if (!el) return;
    el.classList.add('open');
    el.removeAttribute('inert');
    el.setAttribute('aria-hidden', 'false');
    refreshContinueBtn();
    if (window.天青_system && window.天青_system.applyTitleVideo) {
      window.天青_system.applyTitleVideo();
    }
  }

  function hide(done) {
    var el = $('title-screen');
    if (!el) return;
    var ae = document.activeElement;
    if (ae && el.contains(ae) && typeof ae.blur === 'function') {
      ae.blur();
    }
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('inert', '');
    if (typeof done === 'function') {
      setTimeout(done, TITLE_HIDE_MS);
    }
  }

  function formatTime(ts) {
    if (!ts) return '—';
    try {
      var d = new Date(ts);
      var p = function (n) {
        return (n < 10 ? '0' : '') + n;
      };
      return (
        d.getFullYear() +
        '/' +
        p(d.getMonth() + 1) +
        '/' +
        p(d.getDate()) +
        ' ' +
        p(d.getHours()) +
        ':' +
        p(d.getMinutes())
      );
    } catch (e) {
      return '—';
    }
  }

  function resolveBgUrl(bgId) {
    if (!bgId) return '';
    var map = window.天青_backgrounds || {};
    var band =
      window.天青_state && window.天青_state.getTimeBand
        ? window.天青_state.getTimeBand()
        : '白日';
    var bands = [band, '白日', '黄昏', '夜晚'];
    for (var i = 0; i < bands.length; i++) {
      var u = map[bgId + '·' + bands[i]];
      if (u) return u;
    }
    return '';
  }

  /** 从存档 lastRaw + galIdx 还原当时场景（背景/立绘或 CG/台词） */
  function resolveSceneFromSave(data) {
    if (!data || !String(data.lastRaw || '').trim() || !window.天青_parse) return null;
    var gal;
    try {
      gal = window.天青_parse.parseGal(data.lastRaw);
    } catch (e) {
      return null;
    }
    var mods = (gal && gal.modules) || [];
    if (!mods.length) return null;

    var i = typeof data.galIdx === 'number' ? data.galIdx : 0;
    if (i < 0) i = 0;
    if (i >= mods.length) i = mods.length - 1;

    var bgId = null;
    var line = null;
    var cgName = null;
    for (var j = 0; j <= i; j++) {
      var m = mods[j];
      if (!m) continue;
      if (m.bgId) bgId = m.bgId;
      if (m.type === 'line') {
        line = m;
        if (m.cg) cgName = String(m.cg).trim() || cgName;
        else cgName = null;
      } else if (m.type === 'cg') {
        cgName = String(m.name || '').trim() || cgName;
      }
    }

    var at = mods[i];
    if (at && at.type === 'line') {
      line = at;
      if (at.cg) cgName = String(at.cg).trim() || null;
      else cgName = null;
    } else if (at && at.type === 'cg') {
      cgName = String(at.name || '').trim() || cgName;
    }

    var expr = (line && line.expr) || '-';
    var exprMap = window.天青_expressions || {};
    var spriteUrl = expr && expr !== '-' && exprMap[expr] ? exprMap[expr] : '';
    var cgMap = window.天青_cg || {};
    var cgUrl = cgName && cgMap[cgName] ? cgMap[cgName] : '';

    return {
      who: line ? line.who || '' : '',
      text: line ? line.text || '' : '',
      dialogue: !!(line && line.dialogue),
      bgUrl: resolveBgUrl(bgId),
      spriteUrl: spriteUrl,
      cgUrl: cgUrl,
      isCg: !!cgUrl,
    };
  }

  function fillSceneThumb(el, data, emptyLabel) {
    if (!el) return;
    el.innerHTML = '';
    el.classList.remove('has-scene');
    var scene = resolveSceneFromSave(data);
    if (!scene) {
      el.textContent = emptyLabel || 'NO IMAGE';
      return;
    }

    el.classList.add('has-scene');
    var root = document.createElement('div');
    root.className = 'saves-scene' + (scene.isCg ? ' is-cg' : '');

    if (scene.isCg) {
      var cg = document.createElement('div');
      cg.className = 'saves-scene-cg';
      cg.style.backgroundImage = 'url("' + scene.cgUrl + '")';
      root.appendChild(cg);
    } else {
      var bg = document.createElement('div');
      bg.className = 'saves-scene-bg';
      if (scene.bgUrl) bg.style.backgroundImage = 'url("' + scene.bgUrl + '")';
      root.appendChild(bg);
      if (scene.spriteUrl) {
        var sp = document.createElement('div');
        sp.className = 'saves-scene-sprite';
        var img = document.createElement('img');
        img.src = scene.spriteUrl;
        img.alt = '';
        img.draggable = false;
        sp.appendChild(img);
        root.appendChild(sp);
      }
    }

    el.appendChild(root);
  }

  function previewText(data) {
    if (!data) return '尚无内容';
    var scene = resolveSceneFromSave(data);
    if (scene && (scene.text || scene.who)) {
      var line = scene.text || '';
      if (scene.who && scene.dialogue) line = scene.who + '：' + line;
      else if (scene.who && !scene.text) line = scene.who;
      line = String(line).replace(/\s+/g, ' ').trim();
      if (line.length > 64) line = line.slice(0, 64) + '…';
      if (line) return line;
    }
    var raw = String(data.lastRaw || '');
    if (raw) {
      var t = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.length > 64) t = t.slice(0, 64) + '…';
      if (t) return t;
    }
    var n = (data.messages && data.messages.length) || 0;
    return n ? '对话 ' + n + ' 条' : '（无预览文本）';
  }

  function flushLiveProgress() {
    /* 主菜单打开时不把舞台空进度写回自动存档 */
    if (isOpen()) return;
    if (!window.天青_stage || !window.天青_save) return;
    if (!window.天青_save.hasProgress || !window.天青_save.hasProgress()) return;
    if (typeof window.天青_stage.getIndex === 'function' && window.天青_save.setGalIdx) {
      window.天青_save.setGalIdx(window.天青_stage.getIndex());
    }
    if (window.天青_save.autoSave) window.天青_save.autoSave();
  }

  function getAutoData() {
    if (!window.天青_save || !window.天青_save.autoLoad) return null;
    return window.天青_save.autoLoad();
  }

  function getSelectedData() {
    if (selectedKind === 'auto') return getAutoData();
    if (selectedKind === 'manual' && selectedManualIndex >= 0 && window.天青_save) {
      var slot = window.天青_save.readSlot(selectedManualIndex);
      return slot && !slot.empty ? slot.data : null;
    }
    return null;
  }

  function refreshActionButtons() {
    var loadBtn = $('btn-saves-load');
    var delBtn = $('btn-saves-delete');
    var has = !!getSelectedData();
    if (loadBtn) {
      loadBtn.disabled = !has;
      loadBtn.textContent = selectedKind === 'manual' ? '读取选中存档' : '读取自动存档';
    }
    if (delBtn) {
      delBtn.disabled = !has;
      delBtn.textContent = selectedKind === 'manual' ? '删除选中存档' : '清除自动存档';
    }
  }

  function updatePreview() {
    var data = getSelectedData();
    var dateEl = $('saves-preview-date');
    var slotEl = $('saves-preview-slot');
    var commentEl = $('saves-preview-comment');
    var thumbEl = $('saves-preview-thumb');
    if (dateEl) dateEl.textContent = data ? formatTime(data.updatedAt) : '—';
    if (slotEl) {
      if (selectedKind === 'manual' && selectedManualIndex >= 0) {
        var slot = window.天青_save && window.天青_save.readSlot(selectedManualIndex);
        slotEl.textContent = (slot && slot.label) || '手动存档';
      } else {
        slotEl.textContent = '自动保存';
      }
    }
    if (commentEl) commentEl.textContent = data ? previewText(data) : '请选择存档，或点 + 新建';
    fillSceneThumb(thumbEl, data, 'NO IMAGE');
    refreshActionButtons();
  }

  function manualsList() {
    return (window.天青_save && window.天青_save.listManualSaves
      ? window.天青_save.listManualSaves()
      : []) || [];
  }

  /** 主菜单打开时只读：不允许新建手动存档 */
  function canCreateSave() {
    return !isOpen();
  }

  function roundOf(data) {
    if (!data || !Array.isArray(data.messages)) return 0;
    var n = 0;
    for (var i = 0; i < data.messages.length; i++) {
      if (data.messages[i] && data.messages[i].role === 'assistant') n++;
    }
    return n;
  }

  function appendSlotFoot(foot, data, emptyComment) {
    var comment = document.createElement('div');
    comment.className = 'saves-slot-comment';
    comment.textContent = data ? previewText(data) : emptyComment || '—';

    var meta = document.createElement('div');
    meta.className = 'saves-slot-meta';

    var time = document.createElement('div');
    time.className = 'saves-slot-time';
    time.textContent = data ? formatTime(data.updatedAt) : '—';

    var round = document.createElement('div');
    round.className = 'saves-slot-round';
    var n = roundOf(data);
    round.textContent = n > 0 ? String(n) : '';
    round.title = n > 0 ? '第 ' + n + ' 轮对话' : '';
    round.setAttribute('aria-label', n > 0 ? '对话轮次 ' + n : '');

    meta.appendChild(time);
    meta.appendChild(round);
    foot.appendChild(comment);
    foot.appendChild(meta);
  }

  function makeManualCard(slot, order) {
    var card = document.createElement('article');
    card.className =
      'saves-slot saves-slot--manual' +
      (selectedKind === 'manual' && selectedManualIndex === slot.index ? ' is-selected' : '');
    card.dataset.act = 'manual';
    card.dataset.index = String(slot.index);
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;
    card.title = '点击读取此存档';

    var head = document.createElement('div');
    head.className = 'saves-slot-head';
    head.textContent = slot.label || '存档 ' + order;

    var thumb = document.createElement('div');
    thumb.className = 'saves-slot-thumb';
    fillSceneThumb(thumb, slot.data, 'SAVE');

    var foot = document.createElement('div');
    foot.className = 'saves-slot-foot';
    appendSlotFoot(foot, slot.data);

    card.appendChild(head);
    card.appendChild(thumb);
    card.appendChild(foot);
    return card;
  }

  function renderSavesGrid() {
    var grid = $('saves-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var data = getAutoData();
    var auto = document.createElement('article');
    auto.className =
      'saves-slot saves-slot--auto' +
      (data ? '' : ' is-empty') +
      (selectedKind === 'auto' ? ' is-selected' : '');
    auto.dataset.act = 'auto';
    auto.setAttribute('role', 'listitem');
    auto.tabIndex = 0;
    auto.title = data ? '点击选择 / 读取自动存档' : '尚无自动存档';

    var head = document.createElement('div');
    head.className = 'saves-slot-head';
    head.textContent = '自动保存';

    var thumb = document.createElement('div');
    thumb.className = 'saves-slot-thumb';
    fillSceneThumb(thumb, data, data ? 'AUTO' : 'EMPTY');

    var foot = document.createElement('div');
    foot.className = 'saves-slot-foot';
    appendSlotFoot(foot, data, '生成对话后会自动更新');

    auto.appendChild(head);
    auto.appendChild(thumb);
    auto.appendChild(foot);
    grid.appendChild(auto);

    var manuals = manualsList();
    manuals.forEach(function (slot, i) {
      grid.appendChild(makeManualCard(slot, i + 1));
    });

    if (canCreateSave()) {
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'saves-slot saves-slot--plus';
      plus.dataset.act = 'plus';
      plus.setAttribute('role', 'listitem');
      plus.title = '新建存档（保存当前对话）';
      plus.setAttribute('aria-label', '新建存档');
      plus.innerHTML = '<span class="saves-plus-mark" aria-hidden="true">+</span>';
      grid.appendChild(plus);
    }

    updatePreview();
  }

  function openSaves() {
    var panel = $('saves-panel');
    if (!panel) return;
    flushLiveProgress();
    selectedKind = 'auto';
    selectedManualIndex = -1;
    renderSavesGrid();
    panel.classList.add('open');
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeSaves() {
    var panel = $('saves-panel');
    if (!panel) return;
    var ae = document.activeElement;
    if (ae && panel.contains(ae) && typeof ae.blur === 'function') {
      ae.blur();
    }
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
  }

  function enterGameFromCurrent() {
    closeSaves();
    if (window.天青_settings && window.天青_settings.close) {
      window.天青_settings.close();
    }
    hide(function () {
      pulseStageEnter();
      if (window.天青_app && window.天青_app.enterFromSave) {
        window.天青_app.enterFromSave();
      }
    });
  }

  function startNewGame() {
    var openPicker = function () {
      closeSaves();
      if (window.天青_settings && window.天青_settings.close) {
        window.天青_settings.close();
      }
      if (window.天青_opening_select && window.天青_opening_select.open) {
        window.天青_opening_select.open();
        return;
      }
      beginNewGameWithOpening();
    };
    openPicker();
  }

  function beginNewGameWithOpening(openingId) {
    var run = function () {
      if (window.天青_opening_select && window.天青_opening_select.close) {
        window.天青_opening_select.close();
      }
      closeSaves();
      if (window.天青_settings && window.天青_settings.close) {
        window.天青_settings.close();
      }
      hide(function () {
        pulseStageEnter();
        if (window.天青_app && window.天青_app.startNewGame) {
          window.天青_app.startNewGame(openingId);
        }
      });
    };
    if (window.天青_save && window.天青_save.hasProgress && window.天青_save.hasProgress()) {
      confirmAsk('开始新游戏将清空当前进度，是否继续？', run);
    } else {
      run();
    }
  }

  function continueGame() {
    if (!window.天青_save || !window.天青_save.hasProgress()) {
      toast('暂无进度可继续');
      return;
    }
    enterGameFromCurrent();
  }

  function createManualSave() {
    if (!canCreateSave()) {
      toast('请先进入游戏后再新建存档');
      return;
    }
    if (!window.天青_save || !window.天青_save.appendManualSave) {
      toast('存档模块未就绪');
      return;
    }
    if (!window.天青_save.hasProgress()) {
      toast('当前没有可保存的对话');
      return;
    }
    flushLiveProgress();
    var slot = window.天青_save.appendManualSave();
    selectedKind = 'manual';
    selectedManualIndex = slot.index;
    toast('已新建存档');
    renderSavesGrid();
    refreshContinueBtn();
  }

  function loadSelected() {
    if (selectedKind === 'auto') {
      if (!window.天青_save || !window.天青_save.applyAutoToCurrent) return;
      var data = window.天青_save.applyAutoToCurrent();
      if (!data) {
        toast('尚无自动存档');
        return;
      }
      toast('已读取自动存档');
      enterGameFromCurrent();
      return;
    }
    if (selectedKind === 'manual' && selectedManualIndex >= 0) {
      var d = window.天青_save.applySlotToCurrent(selectedManualIndex);
      if (!d) {
        toast('存档为空');
        return;
      }
      toast('已读取存档');
      enterGameFromCurrent();
    }
  }

  function deleteSelected() {
    if (selectedKind === 'auto') {
      if (!window.天青_save || !window.天青_save.hasAutoSave || !window.天青_save.hasAutoSave()) {
        toast('尚无自动存档');
        return;
      }
      confirmAsk('确定清除自动存档？', function () {
        window.天青_save.clearAutoSave();
        toast('已清除');
        renderSavesGrid();
      });
      return;
    }
    if (selectedKind === 'manual' && selectedManualIndex >= 0) {
      var idx = selectedManualIndex;
      confirmAsk('确定删除此存档？', function () {
        window.天青_save.clearSlot(idx);
        selectedKind = 'auto';
        selectedManualIndex = -1;
        toast('已删除');
        renderSavesGrid();
      });
    }
  }

  function onGridClick(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'plus') {
      createManualSave();
      return;
    }
    if (act === 'auto') {
      selectedKind = 'auto';
      selectedManualIndex = -1;
      renderSavesGrid();
      return;
    }
    if (act === 'manual') {
      selectedKind = 'manual';
      selectedManualIndex = Number(el.dataset.index);
      renderSavesGrid();
    }
  }

  function onGridDblClick(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'plus') return;
    if (act === 'auto') {
      selectedKind = 'auto';
      selectedManualIndex = -1;
      if (getAutoData()) loadSelected();
      else toast('尚无自动存档');
      return;
    }
    if (act === 'manual') {
      selectedKind = 'manual';
      selectedManualIndex = Number(el.dataset.index);
      loadSelected();
    }
  }

  function bind() {
    var screen = $('title-screen');
    if (screen) {
      screen.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-title-act]') : null;
        if (!btn || btn.disabled) return;
        var act = btn.getAttribute('data-title-act');
        if (act === 'new') startNewGame();
        else if (act === 'continue') continueGame();
        else if (act === 'saves') openSaves();
        else if (act === 'settings') {
          if (window.天青_settings && window.天青_settings.open) window.天青_settings.open();
        }
      });
    }

    var grid = $('saves-grid');
    if (grid) {
      grid.addEventListener('click', onGridClick);
      grid.addEventListener('dblclick', onGridDblClick);
    }

    var closeBtn = $('btn-saves-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSaves);

    var loadBtn = $('btn-saves-load');
    var delBtn = $('btn-saves-delete');
    if (loadBtn) loadBtn.addEventListener('click', loadSelected);
    if (delBtn) delBtn.addEventListener('click', deleteSelected);

    window.__tq_onOpeningPicked = function (openingId) {
      beginNewGameWithOpening(openingId);
    };
    if (window.天青_opening_select && window.天青_opening_select.bind) {
      window.天青_opening_select.bind();
    }

    refreshContinueBtn();
  }

  window.天青_title = {
    bind: bind,
    show: show,
    hide: hide,
    isOpen: isOpen,
    openSaves: openSaves,
    closeSaves: closeSaves,
    refreshContinueBtn: refreshContinueBtn,
    refreshSaves: renderSavesGrid,
  };
})();
