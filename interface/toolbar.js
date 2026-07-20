/**
 * Gal 舞台右下角工具栏
 * 对外：window.天青_toolbar
 * 每次页面加载默认锁定常显；解锁仅作用于当前会话。
 */
(function () {
  var locked = true;
  var hideTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
      return;
    }
    console.info('[toolbar]', msg);
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function mountIcon(id, key) {
    var btn = $(id);
    var svg = window.天青_svg;
    if (btn && svg && svg[key]) svg.mount(btn, svg[key]);
  }

  function mountAllIcons() {
    mountIcon('btn-gal-toolbar-settings', 'gear');
    mountIcon('btn-gal-toolbar-prevround', 'tripleBack');
    mountIcon('btn-gal-toolbar-rewind', 'rewind');
    mountIcon('btn-gal-toolbar-back', 'stepBack');
    mountIcon('btn-gal-toolbar-log', 'scriptPage');
    mountIcon('btn-gal-toolbar-fwd', 'stepFwd');
    mountIcon('btn-gal-toolbar-fastfwd', 'fastFwd');
    mountIcon('btn-gal-toolbar-auto', 'autoFwd');
  }

  function refreshLockUi() {
    var dock = $('gal-toolbar-dock');
    var btn = $('btn-gal-toolbar-lock');
    var svg = window.天青_svg;
    if (!dock || !btn) return;

    dock.hidden = false;
    dock.style.display = 'flex';
    clearHideTimer();
    dock.classList.remove('is-pinned-hover');
    mountAllIcons();

    if (locked) {
      dock.classList.add('is-locked');
      dock.classList.remove('is-auto-hide');
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
      btn.title = '锁定工具栏（点击解锁，离开后自动隐藏）';
      btn.setAttribute('aria-label', '锁定工具栏');
      if (svg && svg.lock) svg.mount(btn, svg.lock);
    } else {
      dock.classList.remove('is-locked');
      dock.classList.add('is-auto-hide');
      btn.classList.remove('is-on');
      btn.setAttribute('aria-pressed', 'false');
      btn.title = '解锁工具栏（点击锁定，保持常显）';
      btn.setAttribute('aria-label', '解锁工具栏');
      if (svg && svg.unlock) svg.mount(btn, svg.unlock);
    }

    var autoBtn = $('btn-gal-toolbar-auto');
    if (autoBtn && window.天青_stage) {
      autoBtn.classList.toggle('is-on', !!window.天青_stage.isAuto && window.天青_stage.isAuto());
      autoBtn.setAttribute(
        'aria-pressed',
        window.天青_stage.isAuto && window.天青_stage.isAuto() ? 'true' : 'false',
      );
    }
  }

  function setLocked(v) {
    locked = !!v;
    refreshLockUi();
  }

  function toggleLock() {
    setLocked(!locked);
  }

  function openSavePanel() {
    if (window.天青_title && window.天青_title.openSaves) {
      window.天青_title.openSaves();
      return;
    }
    toast('存档界面未就绪');
  }

  function doQuickSave() {
    if (!window.天青_save || !window.天青_save.quickSave) {
      toast('存档模块未就绪');
      return;
    }
    if (!window.天青_save.hasProgress || !window.天青_save.hasProgress()) {
      toast('当前没有可保存的进度');
      return;
    }
    window.天青_save.quickSave();
    toast('已保存到自动存档');
    if (window.天青_title && window.天青_title.refreshSaves) {
      window.天青_title.refreshSaves();
    }
  }

  function openSettings() {
    if (window.天青_settings && window.天青_settings.open) {
      window.天青_settings.open();
      return;
    }
    toast('设置界面未就绪');
  }

  function avatarUrlFor(who, expr) {
    if (String(who || '').trim() !== '天青') return '';
    var map = window.天青_avatars || {};
    if (expr && expr !== '-' && map[expr]) return map[expr];
    return map['微笑'] || '';
  }

  function openLog() {
    var panel = $('gal-log-panel');
    var list = $('gal-log-list');
    if (!panel || !list || !window.天青_stage || !window.天青_stage.getLogEntries) {
      toast('back log 不可用');
      return;
    }
    if (window.天青_stage.stopAuto) window.天青_stage.stopAuto();
    var titleEl = $('gal-log-title');
    if (titleEl) titleEl.textContent = 'back log';
    var entries = window.天青_stage.getLogEntries();
    list.innerHTML = '';
    if (!entries.length) {
      var empty = document.createElement('p');
      empty.className = 'gal-log-empty';
      empty.textContent = '本轮暂无对话';
      list.appendChild(empty);
    } else {
      entries.forEach(function (en) {
        var row = document.createElement('div');
        row.className = 'gal-log-row' + (en.current ? ' is-current' : '');
        row.dataset.index = String(en.index);

        var avatarSrc = avatarUrlFor(en.who, en.expr);

        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'gal-log-item';
        item.dataset.index = String(en.index);
        var who = document.createElement('span');
        who.className = 'gal-log-who';
        who.textContent = en.who;
        var text = document.createElement('span');
        text.className = 'gal-log-text';
        text.textContent = en.text;
        item.appendChild(who);
        item.appendChild(text);
        row.appendChild(item);

        if (avatarSrc) {
          var av = document.createElement('div');
          av.className = 'gal-log-avatar';
          av.setAttribute('aria-hidden', 'true');
          var sq = document.createElement('span');
          sq.className = 'gal-log-avatar-sq';
          var img = document.createElement('img');
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.src = avatarSrc;
          sq.appendChild(img);
          av.appendChild(sq);
          row.appendChild(av);
        }

        list.appendChild(row);
      });
    }
    panel.classList.add('open');
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeLog() {
    var panel = $('gal-log-panel');
    if (!panel) return;
    var ae = document.activeElement;
    if (ae && panel.contains(ae) && typeof ae.blur === 'function') ae.blur();
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
  }

  function onToolbarClick(e) {
    e.stopPropagation();
    var btn = e.target && e.target.closest ? e.target.closest('[data-gal-tb]') : null;
    if (!btn || btn.disabled) return;
    var act = btn.getAttribute('data-gal-tb');
    var stage = window.天青_stage;
    if (act === 'lock') toggleLock();
    else if (act === 'save') openSavePanel();
    else if (act === 'qsave') doQuickSave();
    else if (act === 'settings') openSettings();
    else if (act === 'prevround') {
      if (window.天青_app && window.天青_app.rewindPrevRound) {
        window.天青_app.rewindPrevRound();
      } else {
        toast('上一轮功能未就绪');
      }
    } else if (act === 'rewind') {
      if (stage && stage.rewind) stage.rewind();
    } else if (act === 'back') {
      if (stage && stage.prev) stage.prev();
    } else if (act === 'log') openLog();
    else if (act === 'fwd') {
      if (stage && stage.stopAuto) stage.stopAuto();
      if (stage && stage.advance) stage.advance();
      refreshLockUi();
    } else if (act === 'fastfwd') {
      if (stage && stage.skipToChoices) stage.skipToChoices();
      else toast('快进不可用');
      refreshLockUi();
    } else if (act === 'auto') {
      if (stage && stage.toggleAuto) stage.toggleAuto();
      refreshLockUi();
    }
  }

  function bind() {
    locked = true;
    refreshLockUi();

    var dock = $('gal-toolbar-dock');
    var bar = $('gal-toolbar');
    if (dock) {
      dock.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      dock.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
      dock.addEventListener('pointerenter', function () {
        if (locked) return;
        clearHideTimer();
        dock.classList.add('is-pinned-hover');
      });
      dock.addEventListener('pointerleave', function () {
        if (locked) return;
        clearHideTimer();
        hideTimer = setTimeout(function () {
          dock.classList.remove('is-pinned-hover');
          hideTimer = null;
        }, 280);
      });
    }
    if (bar) {
      bar.addEventListener('click', onToolbarClick);
    }

    var closeLogBtn = $('btn-gal-log-close');
    if (closeLogBtn) closeLogBtn.addEventListener('click', closeLog);

    var logPanel = $('gal-log-panel');
    if (logPanel) {
      logPanel.addEventListener('click', function (e) {
        if (e.target === logPanel) closeLog();
        var hit =
          e.target && e.target.closest
            ? e.target.closest('.gal-log-item, .gal-log-row, .gal-log-avatar')
            : null;
        if (!hit) return;
        var row = hit.closest ? hit.closest('.gal-log-row') : null;
        var el = row || hit;
        var i = Number(el.dataset.index);
        if (isNaN(i)) return;
        if (window.天青_stage && window.天青_stage.jumpTo) {
          window.天青_stage.jumpTo(i);
          closeLog();
        }
      });
    }
  }

  window.天青_toolbar = {
    bind: bind,
    setLocked: setLocked,
    isLocked: function () {
      return locked;
    },
    refresh: refreshLockUi,
    openLog: openLog,
    closeLog: closeLog,
  };
})();
