/**
 * Gal 舞台渲染（从旧版核心逻辑精简移植）
 * 对外：window.天青_stage
 */
(function () {
  var data = { modules: [], choices: [], live: null };
  var idx = 0;
  var typing = false;
  var typer = null;
  var lastExpr = null;
  var front = null;
  var back = null;
  var bgFront = null;
  var bgBack = null;
  var lastBgUrl = '';
  var spriteToken = 0;
  var dlgToken = 0;
  var choicesHideTimer = null;
  var DLG_FADE_MS = 200;
  var CHOICES_FADE_MS = 280;
  var onChoice = null;
  var cgActive = false;
  /** 用户手动切入的 CG 视图（仅当前句有 cg 时可开） */
  var cgViewMode = false;
  var cgHadTag = false;
  var cgUiToken = 0;
  var cgUiSnap = '';
  var CG_TEXT_FADE_MS = 320;
  var autoPlay = false;
  var autoTimer = null;
  var AUTO_DELAY_MS = 900;
  /** 流式本轮：已开始收流、尚未终局校正 */
  var streaming = false;
  /** 已播完当前已有句、在等后续句（idx 指向下一句，尚未 render） */
  var streamAwaiting = false;

  function $(id) {
    return document.getElementById(id);
  }

  function expressionMap() {
    return window.天青_expressions || {};
  }
  function backgrounds() {
    return window.天青_backgrounds || {};
  }
  function cgLibrary() {
    return window.天青_cg || {};
  }
  function timeBand() {
    return window.天青_TIME_BAND || {};
  }

  function textClassForWho(who) {
    var name = String(who || '').trim();
    if (!name) return '';
    if (name === '天青') return 'tianqing';
    var keys = window.天青_keys;
    if (keys) {
      if (keys.isProducerAlias && keys.isProducerAlias(name)) return 'producer';
      var producerVal = keys.get('producer') || keys.get('user');
      var producerMacro = keys.macro('producer');
      var userMacro = keys.macro('user');
      if (
        name === producerMacro ||
        name === userMacro ||
        name === 'producer' ||
        name === 'user'
      ) {
        return 'producer';
      }
      if (producerVal && name === producerVal) return 'producer';
    }
    return '';
  }

  function paintBG(opts) {
    var instant = !!(opts && opts.instant);
    var st = (window.天青_state && window.天青_state.get()) || {};
    var band = timeBand()[st.时段] || '白日';
    var loc = st.地点 || '校园';
    var key = loc + '·' + band;
    var map = backgrounds();
    var url = map[key] || map[loc + '·白日'] || map[loc + '·黄昏'] || map[loc + '·夜晚'];
    if (!url || !bgFront || !bgBack) return;
    if (url === lastBgUrl) return;
    if (!lastBgUrl || instant) {
      bgFront.style.backgroundImage = 'url("' + url + '")';
      bgFront.classList.add('show');
      bgBack.classList.remove('show');
      bgBack.style.backgroundImage = '';
      lastBgUrl = url;
      return;
    }
    bgBack.style.backgroundImage = 'url("' + url + '")';
    bgBack.classList.add('show');
    bgFront.classList.remove('show');
    var t = bgFront;
    bgFront = bgBack;
    bgBack = t;
    lastBgUrl = url;
  }

  function setSprite(expr) {
    if (cgActive) {
      $('sprites').style.display = 'none';
      return;
    }
    $('sprites').style.display = 'block';
    var map = expressionMap();
    if (!expr || expr === '-' || !map[expr]) return;
    if (expr === lastExpr) return;
    lastExpr = expr;
    var url = map[expr];
    var img = back.querySelector('img');
    var token = ++spriteToken;

    function reveal() {
      if (token !== spriteToken) return;
      back.className = 'layer show';
      front.className = 'layer';
      var t = front;
      front = back;
      back = t;
    }

    if (img.getAttribute('src') === url && img.complete) {
      reveal();
      return;
    }

    img.onload = function () {
      img.onload = null;
      img.onerror = null;
      reveal();
    };
    img.onerror = function () {
      img.onload = null;
      img.onerror = null;
      reveal();
    };
    img.src = url;
    if (img.complete) {
      img.onload = null;
      img.onerror = null;
      reveal();
    }
  }

  /** 预加载本轮用到的表情，避免台词打完网络图才到 */
  function preloadExprs(modules) {
    var map = expressionMap();
    var seen = {};
    (modules || []).forEach(function (m) {
      if (!m || m.type !== 'line') return;
      var e = m.expr;
      if (!e || e === '-' || !map[e] || seen[e]) return;
      seen[e] = true;
      var img = new Image();
      img.decoding = 'async';
      img.src = map[e];
    });
  }

  function clearAutoTimer() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function scheduleAuto() {
    clearAutoTimer();
    if (!autoPlay) return;
    if (idx >= data.modules.length) {
      stopAuto();
      return;
    }
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (!autoPlay) return;
      advance();
      if (autoPlay && !typing) scheduleAuto();
    }, AUTO_DELAY_MS);
  }

  function onTypeDone() {
    typing = false;
    if (autoPlay) scheduleAuto();
  }

  function typeOut(el, str) {
    clearInterval(typer);
    clearAutoTimer();
    typing = true;
    el.textContent = '';
    var i = 0;
    typer = setInterval(function () {
      el.textContent = str.slice(0, ++i);
      if (i >= str.length) {
        clearInterval(typer);
        onTypeDone();
      }
    }, 22);
  }

  function moduleCgName(mod) {
    if (!mod) return null;
    if (mod.type === 'cg') return String(mod.name || '').trim() || null;
    if (mod.type === 'line' && mod.cg) return String(mod.cg || '').trim() || null;
    return null;
  }

  /** 当前句所在的连续 CG 区块（同名 cg） */
  function getCgBlock(atIdx) {
    var i = atIdx == null ? idx : atIdx;
    var mods = data.modules || [];
    if (i < 0 || i >= mods.length) return null;
    var name = moduleCgName(mods[i]);
    if (!name) return null;
    var start = i;
    while (start > 0 && moduleCgName(mods[start - 1]) === name) start--;
    var end = i;
    while (end < mods.length - 1 && moduleCgName(mods[end + 1]) === name) end++;
    var indices = [];
    for (var k = start; k <= end; k++) {
      if (mods[k] && (mods[k].type === 'line' || mods[k].type === 'cg')) {
        indices.push(k);
      }
    }
    if (!indices.length) return null;
    return { name: name, start: start, end: end, indices: indices };
  }

  function currentCgName() {
    var mods = data.modules || [];
    if (idx >= 0 && idx < mods.length) return moduleCgName(mods[idx]);
    /* 选项阶段：沿用本轮最后一张 CG，便于在 CG 界面出选项 */
    if (cgViewMode) return lastCgNameInRound();
    return null;
  }

  function lastCgNameInRound() {
    var mods = data.modules || [];
    for (var i = mods.length - 1; i >= 0; i--) {
      var n = moduleCgName(mods[i]);
      if (n) return n;
    }
    return null;
  }

  function paintCgImage(name) {
    var url = name ? cgLibrary()[name] : '';
    $('cgbg').style.backgroundImage = url ? 'url("' + url + '")' : '';
    $('cgmain').style.backgroundImage = url ? 'url("' + url + '")' : '';
  }

  function fillCgCopy(mod) {
    var nameEl = $('cg-name');
    var textEl = $('cg-text');
    var who = String((mod && mod.who) || '').trim();
    var isNarr = !who || who === '旁白' || who === '旁白。' || !(mod && mod.dialogue);
    var whoClass = textClassForWho(who);
    if (nameEl) {
      if (isNarr) {
        nameEl.textContent = '';
        nameEl.hidden = true;
        nameEl.className = '';
      } else {
        nameEl.textContent = who || '？';
        nameEl.hidden = false;
        nameEl.className = whoClass || '';
      }
    }
    if (textEl) {
      textEl.textContent = (mod && mod.text) || '';
      textEl.className = whoClass || '';
    }
  }

  function clearCgCopy() {
    var nameEl = $('cg-name');
    var textEl = $('cg-text');
    var copy = $('cg-copy');
    if (nameEl) {
      nameEl.textContent = '';
      nameEl.hidden = true;
      nameEl.className = '';
    }
    if (textEl) {
      textEl.textContent = '';
      textEl.className = '';
    }
    if (copy) copy.classList.remove('is-fading');
    cgUiSnap = '';
  }

  function updateCgUi(opts) {
    var instant = !!(opts && opts.instant);
    var block = getCgBlock();
    var copy = $('cg-copy');
    if (!block) {
      cgUiToken++;
      clearCgCopy();
      return;
    }
    var pos = block.indices.indexOf(idx);
    if (pos < 0) {
      idx = block.indices[0];
      pos = 0;
    }
    var mod = data.modules[idx];
    var snap =
      idx +
      '\0' +
      String((mod && mod.who) || '') +
      '\0' +
      String((mod && mod.text) || '');
    if (snap === cgUiSnap && !instant) return;

    if (instant || !copy || !cgUiSnap) {
      cgUiToken++;
      fillCgCopy(mod);
      if (copy) copy.classList.remove('is-fading');
      cgUiSnap = snap;
      return;
    }

    var token = ++cgUiToken;
    copy.classList.add('is-fading');
    setTimeout(function () {
      if (token !== cgUiToken) return;
      fillCgCopy(mod);
      cgUiSnap = snap;
      void copy.offsetWidth;
      copy.classList.remove('is-fading');
    }, CG_TEXT_FADE_MS);
  }

  function showCG(name, opts) {
    var fade = !opts || opts.fade !== false;
    var wasActive = cgActive;
    paintCgImage(name);
    var el = $('cg');
    var stageEl = $('stage');
    cgActive = true;
    $('sprites').style.display = 'none';
    if (stageEl) stageEl.classList.add('is-cg-view');
    if (el) {
      el.setAttribute('aria-hidden', 'false');
      if (fade && !wasActive) {
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
      } else {
        el.classList.add('show');
      }
    }
    updateCgUi({ instant: !wasActive });
  }

  function restoreAfterCg() {
    $('sprites').style.display = 'block';
    var stageEl = $('stage');
    if (stageEl) stageEl.classList.remove('is-cg-view');
  }

  function hideCG(opts) {
    var waitFade = opts && opts.waitFade;
    var wasActive = cgActive;
    cgActive = false;
    cgUiToken++;
    var el = $('cg');
    if (el) {
      el.classList.remove('show');
      el.setAttribute('aria-hidden', 'true');
    }
    clearCgCopy();
    if (waitFade && wasActive && el) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        el.removeEventListener('transitionend', onEnd);
        restoreAfterCg();
      };
      var onEnd = function (ev) {
        if (ev.propertyName === 'opacity') finish();
      };
      el.addEventListener('transitionend', onEnd);
      setTimeout(finish, 650);
    } else {
      restoreAfterCg();
    }
  }

  function isAutoEnterCg() {
    if (window.天青_settings && typeof window.天青_settings.isAutoEnterCg === 'function') {
      return !!window.天青_settings.isAutoEnterCg();
    }
    return true;
  }

  function applyAutoCgTransition() {
    var has = !!currentCgName();
    if (isAutoEnterCg()) {
      if (has && !cgHadTag) {
        /* 刚进入 CG 文段 → 自动切入 */
        cgViewMode = true;
      } else if (!has && cgHadTag) {
        /* 离开 CG 文段 → 自动回到舞台 */
        cgViewMode = false;
      }
    }
    cgHadTag = has;
  }

  function syncCgToggleBtn() {
    var name = currentCgName();
    var can = !!name;
    var btn = $('btn-cg-swap');
    if (!can) cgViewMode = false;
    if (btn) {
      btn.hidden = !can;
      btn.disabled = !can;
      btn.classList.toggle('is-on', !!(can && cgViewMode));
      btn.setAttribute('aria-pressed', can && cgViewMode ? 'true' : 'false');
      btn.title = cgViewMode ? '切回普通舞台' : '切换到 CG';
    }
    return { name: name, can: can };
  }

  function syncCgToggle() {
    applyAutoCgTransition();
    var st = syncCgToggleBtn();
    if (st.can && cgViewMode) {
      showCG(st.name, { fade: !cgActive });
    } else if (cgActive) {
      hideCG();
    }
  }

  function onAutoCgSettingChange() {
    /* 勾选开启且当前在 CG 句：立刻进入；关闭则不强制退出（仍可手动） */
    if (isAutoEnterCg() && currentCgName() && !cgViewMode) {
      cgHadTag = false;
      syncCgToggle();
      if (cgViewMode) {
        /* 切入 CG 后不再走普通台词淡变 */
        return;
      }
    }
    syncCgToggleBtn();
  }

  function toggleCgView() {
    if (!currentCgName()) return false;
    if (!cgViewMode) {
      stopAuto();
      if (typing) {
        clearInterval(typer);
        typing = false;
      }
      cgViewMode = true;
      cgHadTag = true;
      syncCgToggleBtn();
      showCG(currentCgName(), { fade: true });
    } else {
      cgViewMode = false;
      cgHadTag = true;
      syncCgToggleBtn();
      lastExpr = null;
      renderStageLine(true);
      hideCG({ waitFade: true });
    }
    return cgViewMode;
  }

  /** 仅刷新普通舞台台词（不关 CG 状态外逻辑） */
  function applySpeaker(mod) {
    if (mod.dialogue) {
      $('speaker').textContent = mod.who || '？';
      $('speaker').className = '';
      $('text').className = textClassForWho(mod.who);
    } else {
      $('speaker').textContent = mod.who || '旁白';
      $('speaker').className = 'narrator';
      $('text').className = textClassForWho(mod.who) || '';
    }
  }

  function applyLineBg(mod) {
    if (!mod || !mod.bgId) return;
    if (window.天青_state && window.天青_state.set) {
      window.天青_state.set({ 地点: mod.bgId });
    }
    paintBG();
  }

  function presentLine(mod, instant) {
    applyLineBg(mod);
    setSprite(mod.expr);
    var body = $('dlg-body');
    var textEl = $('text');

    function startContent() {
      applySpeaker(mod);
      if (instant) {
        clearInterval(typer);
        typing = false;
        textEl.textContent = mod.text || '';
        if (body) body.classList.remove('is-fading');
      } else {
        if (body) body.classList.remove('is-fading');
        typeOut(textEl, mod.text);
      }
    }

    if (instant || !body) {
      dlgToken++;
      if (body) body.classList.remove('is-fading');
      startContent();
      return;
    }

    var token = ++dlgToken;
    clearInterval(typer);
    typing = true;
    body.classList.add('is-fading');
    setTimeout(function () {
      if (token !== dlgToken) return;
      startContent();
    }, DLG_FADE_MS);
  }

  function renderStageLine(instant) {
    if (idx >= data.modules.length) {
      showChoices();
      refreshNav();
      return;
    }
    setPlayHint();
    var mod = data.modules[idx];
    if (mod.type === 'cg') {
      dlgToken++;
      var body = $('dlg-body');
      if (body) body.classList.remove('is-fading');
      $('speaker').textContent = '';
      $('speaker').className = 'narrator';
      $('text').textContent = '';
      refreshNav();
      return;
    }
    if (mod.type === 'line') {
      presentLine(mod, !!instant);
    }
    refreshNav();
  }

  function cgStep(delta) {
    var block = getCgBlock();
    if (!block) return false;
    var pos = block.indices.indexOf(idx);
    if (pos < 0) pos = 0;
    var nextPos = pos + delta;
    if (nextPos < 0 || nextPos >= block.indices.length) return false;
    idx = block.indices[nextPos];
    lastExpr = null;
    updateCgUi();
    refreshNav();
    return true;
  }

  function render() {
    if (idx >= data.modules.length) {
      if (streaming) {
        streamAwaiting = true;
        hideChoices(false);
        setPlayHint();
        syncCgToggle();
        refreshNav();
        return;
      }
      streamAwaiting = false;
      /* CG / GAL 均可出选项：不再强制退出 CG */
      if (idx > data.modules.length) idx = data.modules.length;
      showChoices();
      syncCgToggle();
      refreshNav();
      if (autoPlay) stopAuto();
      return;
    }

    if (cgViewMode && !currentCgName()) {
      cgViewMode = false;
      hideCG();
    }

    syncCgToggle();
    setPlayHint();

    if (cgViewMode) {
      updateCgUi();
      refreshNav();
      return;
    }

    hideChoices(true);
    var mod = data.modules[idx];
    if (mod.type === 'cg') {
      dlgToken++;
      var body = $('dlg-body');
      if (body) body.classList.remove('is-fading');
      $('speaker').textContent = '';
      $('speaker').className = 'narrator';
      $('text').textContent = '';
      refreshNav();
      if (autoPlay) scheduleAuto();
      return;
    }
    if (mod.type === 'line') {
      presentLine(mod, false);
    } else if (autoPlay) {
      scheduleAuto();
    }
    refreshNav();
  }

  function advance() {
    if (cgViewMode) {
      if (idx >= data.modules.length) return;
      if (cgStep(1)) return;
      /* CG 区块末尾：若后面还有非本段内容则退回 GAL，否则进入选项 */
      var block = getCgBlock();
      var nextIdx = (block ? block.end : idx) + 1;
      if (nextIdx < data.modules.length) {
        var nextName = moduleCgName(data.modules[nextIdx]);
        if (nextName) {
          idx = nextIdx;
          var nextBlock = getCgBlock(nextIdx);
          if (nextBlock && nextBlock.indices.length) idx = nextBlock.indices[0];
          lastExpr = null;
          updateCgUi();
          syncCgToggle();
          refreshNav();
          return;
        }
        cgViewMode = false;
        hideCG({ waitFade: true });
        idx = nextIdx;
        lastExpr = null;
        render();
        return;
      }
      idx = data.modules.length;
      render();
      return;
    }
    if (typing) {
      /* 淡变未结束：立刻露出本句 */
      dlgToken++;
      var body = $('dlg-body');
      if (body) body.classList.remove('is-fading');
      clearInterval(typer);
      typing = false;
      if (data.modules[idx] && data.modules[idx].type === 'line') {
        applySpeaker(data.modules[idx]);
        $('text').textContent = data.modules[idx].text;
      }
      if (autoPlay) scheduleAuto();
      return;
    }
    /* 流式排队：idx 已对准下一句，点一下才露出 */
    if (streamAwaiting && idx < data.modules.length) {
      streamAwaiting = false;
      render();
      return;
    }
    /* 已在选项（或流式等待新句）：禁止继续前进叠 idx */
    if (idx >= data.modules.length) return;
    idx++;
    render();
  }

  function prev() {
    stopAuto();
    if (cgViewMode) {
      if (typing) {
        clearInterval(typer);
        typing = false;
      }
      if (idx >= data.modules.length) {
        hideChoices(true);
        var mods = data.modules || [];
        idx = Math.max(0, mods.length - 1);
        for (var i = mods.length - 1; i >= 0; i--) {
          if (moduleCgName(mods[i])) {
            idx = i;
            break;
          }
        }
        lastExpr = null;
        updateCgUi({ instant: true });
        syncCgToggle();
        setPlayHint();
        refreshNav();
        return;
      }
      if (!cgStep(-1)) updateCgUi();
      return;
    }
    if (typing) {
      dlgToken++;
      var body = $('dlg-body');
      if (body) body.classList.remove('is-fading');
      clearInterval(typer);
      typing = false;
    }
    /* 从选项一次回到最后一句，避免曾叠加的 idx 要连退多次 */
    if (idx >= data.modules.length) {
      hideChoices(true);
      idx = Math.max(0, data.modules.length - 1);
      lastExpr = null;
      render();
      return;
    }
    if (idx <= 0) {
      render();
      return;
    }
    idx--;
    lastExpr = null;
    hideChoices(true);
    render();
  }

  /** 快退到本轮对话开头 */
  function rewind() {
    stopAuto();
    dlgToken++;
    if (typing) {
      clearInterval(typer);
      typing = false;
    }
    idx = 0;
    lastExpr = null;
    hideChoices(true);
    render();
  }

  /** 快进到本轮选项 */
  function skipToChoices() {
    stopAuto();
    dlgToken++;
    if (typing) {
      clearInterval(typer);
      typing = false;
    }
    idx = (data.modules || []).length;
    lastExpr = null;
    render();
  }

  function jumpTo(i) {
    stopAuto();
    dlgToken++;
    if (typing) {
      clearInterval(typer);
      typing = false;
    }
    var max = data.modules.length;
    idx = Math.max(0, Math.min(max, Number(i) || 0));
    lastExpr = null;
    hideChoices(true);
    render();
  }

  function isOnChoicesScreen() {
    return idx >= (data.modules || []).length && !!(data.choices && data.choices.length);
  }

  function setPlayHint() {
    var el = $('hint');
    if (!el) return;
    if (streaming && idx >= (data.modules || []).length) {
      el.textContent = '…生成中';
      return;
    }
    if (isOnChoicesScreen()) {
      el.textContent = '▼ 选择一项继续';
      return;
    }
    el.textContent = '▼ 点击继续';
  }

  function isBlockingOverlayOpen() {
    var title = $('title-screen');
    if (title && title.classList.contains('open')) return true;
    var settings = $('settings-panel');
    if (settings && settings.classList.contains('open')) return true;
    var saves = $('saves-panel');
    if (saves && saves.classList.contains('open')) return true;
    return false;
  }

  /** 点到工具栏 / 按钮等控件时不触发前进后退 */
  function isTapChrome(target) {
    if (!target || !target.closest) return true;
    return !!(
      target.closest('#btn-gear') ||
      target.closest('#btn-cg-swap') ||
      target.closest('#gal-toolbar-dock') ||
      target.closest('#gal-log-panel') ||
      target.closest('.nav') ||
      target.closest('#choices button') ||
      target.closest('#toast') ||
      target.closest('#tq-confirm') ||
      target.closest('#tq-api-error')
    );
  }

  /**
   * GAL / CG：画面左侧 1/3 后退，右侧 2/3 前进
   */
  function handleTapNav(e) {
    if (isBlockingOverlayOpen()) return;
    if (isTapChrome(e.target)) return;
    var stage = $('stage');
    if (!stage) return;
    var rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;
    var ratio = (e.clientX - rect.left) / rect.width;
    if (autoPlay) stopAuto();
    if (ratio < 1 / 3) prev();
    else advance();
  }

  function hideChoices(animated) {
    var box = $('choices');
    if (!box) return;
    if (choicesHideTimer) {
      clearTimeout(choicesHideTimer);
      choicesHideTimer = null;
    }
    if (!animated || box.style.display === 'none' || !box.classList.contains('show')) {
      box.classList.remove('show');
      box.style.display = 'none';
      return;
    }
    box.classList.remove('show');
    choicesHideTimer = setTimeout(function () {
      box.style.display = 'none';
      choicesHideTimer = null;
    }, CHOICES_FADE_MS);
  }

  function showChoices() {
    var box = $('choices');
    if (!box) return;
    if (choicesHideTimer) {
      clearTimeout(choicesHideTimer);
      choicesHideTimer = null;
    }
    if (!data.choices.length) {
      $('hint').textContent = '— 本轮结束 · 点「继续生成」—';
      hideChoices(false);
      return;
    }
    if (cgViewMode) clearCgCopy();
    box.innerHTML = '';
    var q = document.createElement('div');
    q.className = 'q';
    q.textContent = '该怎么回应天青？';
    box.appendChild(q);
    data.choices.forEach(function (c) {
      var b = document.createElement('button');
      b.textContent = c;
      b.onclick = function (e) {
        e.stopPropagation();
        hideChoices(true);
        if (typeof onChoice === 'function') onChoice(c);
      };
      box.appendChild(b);
    });
    box.style.display = 'flex';
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    setPlayHint();
  }

  function refreshNav() {
    var L = $('navL');
    var R = $('navR');
    if (!L || !R) return;
    if (cgViewMode) {
      if (idx >= data.modules.length) {
        L.classList.toggle('off', !(data.modules && data.modules.length));
        R.classList.toggle('off', true);
        return;
      }
      var block = getCgBlock();
      var pos = block ? block.indices.indexOf(idx) : -1;
      L.classList.toggle('off', !block || pos <= 0);
      R.classList.toggle('off', !block || pos >= block.indices.length - 1);
      return;
    }
    L.classList.toggle('off', idx <= 0);
    R.classList.toggle('off', idx >= data.modules.length);
  }

  function getLogEntries() {
    var list = [];
    (data.modules || []).forEach(function (m, i) {
      if (!m) return;
      if (m.type === 'line') {
        list.push({
          index: i,
          type: 'line',
          who: m.who || (m.dialogue ? '？' : '旁白'),
          expr: m.expr || '',
          text: m.text || '',
          current: i === idx,
        });
      } else if (m.type === 'cg') {
        list.push({
          index: i,
          type: 'cg',
          who: 'CG',
          text: m.name || '',
          current: i === idx,
        });
      }
    });
    return list;
  }

  function stopAuto() {
    autoPlay = false;
    clearAutoTimer();
    var btn = $('btn-gal-toolbar-auto');
    if (btn) {
      btn.classList.remove('is-on');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function startAuto() {
    autoPlay = true;
    var btn = $('btn-gal-toolbar-auto');
    if (btn) {
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
    }
    if (typing) return;
    if (idx >= data.modules.length) {
      stopAuto();
      return;
    }
    scheduleAuto();
  }

  function toggleAuto() {
    if (autoPlay) stopAuto();
    else startAuto();
    return autoPlay;
  }

  function loadGal(galData, opts) {
    stopAuto();
    streaming = false;
    streamAwaiting = false;
    data = galData || { modules: [], choices: [] };
    idx = 0;
    lastExpr = null;
    typing = false;
    clearInterval(typer);
    dlgToken++;
    spriteToken++;
    cgViewMode = false;
    cgHadTag = false;
    cgActive = false;
    hideCG();
    hideChoices(false);
    $('hint').textContent = '▼ 点击继续';
    onChoice = (opts && opts.onChoice) || null;
    paintBG({ instant: !!(opts && opts.instantBg) });
    preloadExprs(data.modules);
    render();
  }

  /** 开始流式本轮：队列清空，但保留上一句画面直到本轮首句闭合 */
  function beginStreamRound(opts) {
    stopAuto();
    streaming = true;
    streamAwaiting = false;
    data = { modules: [], choices: [], live: null };
    idx = 0;
    typing = false;
    clearInterval(typer);
    dlgToken++;
    /* 不重置立绘/对白：继续显示上一段最后一句 */
    cgViewMode = false;
    cgHadTag = false;
    cgActive = false;
    hideCG();
    hideChoices(false);
    onChoice = (opts && opts.onChoice) || null;
    paintBG({ instant: !!(opts && opts.instantBg) });
    $('hint').textContent = '…生成中';
    syncCgToggle();
    refreshNav();
  }

  /**
   * 追加已闭合的句子；首批立刻演出第一句，之后只入队等点击。
   */
  function appendStreamModules(modules) {
    if (!streaming) return;
    var list = Array.isArray(modules) ? modules : [];
    if (!list.length) return;
    var wasEmpty = !(data.modules && data.modules.length);
    var oldLen = data.modules.length;
    data.modules = data.modules.concat(list);
    preloadExprs(list);

    if (wasEmpty) {
      streamAwaiting = false;
      idx = 0;
      render();
      return;
    }

    /* 已播完此前句子、在等更多：对齐到新句索引，但不自动播 */
    if (streamAwaiting && idx >= oldLen) {
      idx = oldLen;
      $('hint').textContent = '▼ 点击继续';
      refreshNav();
    }
  }

  /**
   * 终局校正：用完整 parseGal 结果替换本轮；保留播放进度。
   * 若流式中从未拿到句子（如旧 Gal），则整轮 loadGal。
   */
  function finalizeStreamRound(galData, opts) {
    var hadStream = streaming && (data.modules || []).length > 0;
    var keepIdx = idx;
    var wasAwaiting = streamAwaiting;
    streaming = false;
    streamAwaiting = false;

    if (!hadStream) {
      loadGal(galData, opts);
      return;
    }

    if (opts && opts.onChoice) onChoice = opts.onChoice;
    data = galData || { modules: [], choices: [] };
    preloadExprs(data.modules);
    var len = (data.modules || []).length;

    if (keepIdx < len) {
      idx = keepIdx;
      if (wasAwaiting) {
        /* 还有排队未读句：等点击再露，不要直接跳到选项 */
        streamAwaiting = true;
        hideChoices(false);
        $('hint').textContent = '▼ 点击继续';
        refreshNav();
        syncCgToggle();
        return;
      }
      refreshNav();
      syncCgToggle();
      return;
    }

    idx = len;
    render();
  }

  function abortStreamRound() {
    streaming = false;
    streamAwaiting = false;
  }

  function init() {
    front = $('layA');
    back = $('layB');
    bgFront = $('bgA');
    bgBack = $('bgB');
    var svg = window.天青_svg;
    if (svg && svg.swap) svg.mount($('btn-cg-swap'), svg.swap);
    var swapBtn = $('btn-cg-swap');
    if (swapBtn) {
      swapBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (swapBtn.disabled) return;
        toggleCgView();
      });
    }
    var stageEl = $('stage');
    if (stageEl) {
      stageEl.addEventListener('click', handleTapNav);
    }
    document.addEventListener('keydown', function (e) {
      if (isBlockingOverlayOpen()) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
        return;
      }
      /* GAL / CG 共用方向键 */
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (isOnChoicesScreen() && e.key === ' ') return;
        advance();
      }
    });
    var gear = $('btn-gear');
    if (gear) {
      gear.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
    $('navL').onclick = function (e) {
      e.stopPropagation();
      prev();
    };
    $('navR').onclick = function (e) {
      e.stopPropagation();
      if (autoPlay) stopAuto();
      if (isOnChoicesScreen()) return;
      advance();
    };
    paintBG({ instant: true });
    syncCgToggle();
  }

  window.天青_stage = {
    init: init,
    loadGal: loadGal,
    beginStreamRound: beginStreamRound,
    appendStreamModules: appendStreamModules,
    finalizeStreamRound: finalizeStreamRound,
    abortStreamRound: abortStreamRound,
    paintBG: paintBG,
    advance: advance,
    prev: prev,
    rewind: rewind,
    skipToChoices: skipToChoices,
    jumpTo: jumpTo,
    getLogEntries: getLogEntries,
    getIndex: function () {
      return idx;
    },
    isStreaming: function () {
      return streaming;
    },
    toggleAuto: toggleAuto,
    stopAuto: stopAuto,
    isAuto: function () {
      return autoPlay;
    },
    toggleCgView: toggleCgView,
    onAutoCgSettingChange: onAutoCgSettingChange,
    isCgView: function () {
      return cgViewMode;
    },
    currentCgName: currentCgName,
  };
})();
