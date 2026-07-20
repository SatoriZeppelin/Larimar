/**
 * Gal 舞台 · 手机悬浮钮（可拖动，CG 时由 CSS 隐藏）
 * 对外：window.天青_phone_fab
 */
(function () {
  var POS_KEY = 'tq_plus_phone_fab_pos';
  var MOVE_THRESHOLD = 5;
  var EDGE_INSET = 12;
  var DLG_GAP = 8;
  var SNAP_MS = 360;

  var snapTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function stageEl() {
    return $('stage');
  }

  function fabEl() {
    return $('gal-phone-fab');
  }

  function getPositionMode() {
    if (window.天青_settings && window.天青_settings.getPhoneFabPositionMode) {
      return window.天青_settings.getPhoneFabPositionMode();
    }
    return 'free';
  }

  function stageRect() {
    var st = stageEl();
    if (!st) {
      return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }
    return st.getBoundingClientRect();
  }

  function getFabSize(fab) {
    if (!fab) return 50;
    var n = fab.offsetWidth;
    if (n > 0) return n;
    var cs = window.getComputedStyle(fab);
    var v = parseFloat(cs.getPropertyValue('--fab-size') || cs.width);
    return v > 0 ? v : 50;
  }

  function clampLeftTop(left, top, size) {
    var sr = stageRect();
    var sz = size || 50;
    return {
      left: Math.max(EDGE_INSET, Math.min(left, sr.width - sz - EDGE_INSET)),
      top: Math.max(EDGE_INSET, Math.min(top, sr.height - sz - EDGE_INSET)),
    };
  }

  function mountIcon() {
    var icon = $('gal-phone-fab-icon');
    var svg = window.天青_svg;
    if (icon && svg && svg.phone) svg.mount(icon, svg.phone);
  }

  function clearSnapClasses(fab) {
    fab.classList.remove(
      'is-snapped-left',
      'is-snapped-right',
      'is-snapped-top',
      'is-snapped-bottom',
      'is-snapped-dlg-above',
      'is-snapped-dlg-below',
    );
  }

  function cancelSnapAnimation(fab) {
    if (snapTimer) {
      clearTimeout(snapTimer);
      snapTimer = null;
    }
    if (!fab) return;
    fab.classList.remove('is-snapping');
  }

  function setDefaultAnchor(fab) {
    fab.style.left = '';
    fab.style.top = '';
    fab.style.right = EDGE_INSET + 'px';
    fab.style.bottom = '';
    fab.style.transform = '';
    fab.classList.remove('is-free');
    clearSnapClasses(fab);
    delete fab.dataset.snapEdge;
  }

  function setFreePosition(fab, left, top) {
    cancelSnapAnimation(fab);
    var sz = getFabSize(fab);
    var pos = clampLeftTop(left, top, sz);
    fab.style.left = pos.left + 'px';
    fab.style.top = pos.top + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    fab.style.transform = 'none';
    fab.classList.add('is-free');
    clearSnapClasses(fab);
    delete fab.dataset.snapEdge;
  }

  function applySnapRect(fab, left, top, edge) {
    cancelSnapAnimation(fab);
    var sz = getFabSize(fab);
    var pos = clampLeftTop(left, top, sz);
    fab.style.left = pos.left + 'px';
    fab.style.top = pos.top + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    fab.style.transform = 'none';
    fab.classList.add('is-free');
    clearSnapClasses(fab);
    if (edge) {
      fab.dataset.snapEdge = edge;
      fab.classList.add('is-snapped-' + edge);
    } else {
      delete fab.dataset.snapEdge;
    }
    return { left: pos.left, top: pos.top, edge: edge || null };
  }

  function readCurrentPos(fab) {
    var sr = stageRect();
    var r = fab.getBoundingClientRect();
    return {
      x: Math.round(r.left - sr.left),
      y: Math.round(r.top - sr.top),
      edge: fab.dataset.snapEdge || null,
    };
  }

  function readSavedPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (!raw) raw = localStorage.getItem('tq_plus_phone_ball_pos');
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) {}
    return null;
  }

  function savePos(x, y, edge) {
    try {
      var payload = { x: Math.round(x), y: Math.round(y) };
      if (edge) payload.edge = edge;
      localStorage.setItem(POS_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function getDialogueTop() {
    var dlg = $('dialogue');
    var st = stageEl();
    if (!dlg || !st) return null;
    if (st.classList.contains('is-cg-view')) return null;
    var cs = window.getComputedStyle(dlg);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    var opacity = parseFloat(cs.opacity);
    if (!isNaN(opacity) && opacity <= 0.01) return null;
    var sr = stageRect();
    var dr = dlg.getBoundingClientRect();
    if (dr.height <= 0) return null;
    return dr.top - sr.top;
  }

  function computeSnapTarget(fab) {
    var sr = stageRect();
    var sz = getFabSize(fab);
    var r = fab.getBoundingClientRect();
    var curLeft = r.left - sr.left;
    var curTop = r.top - sr.top;
    var cx = curLeft + sz / 2;
    var cy = curTop + sz / 2;

    function clampX(x) {
      return Math.max(EDGE_INSET, Math.min(x, sr.width - sz - EDGE_INSET));
    }
    function clampY(y) {
      return Math.max(EDGE_INSET, Math.min(y, sr.height - sz - EDGE_INSET));
    }

    var candidates = [
      { edge: 'left', left: EDGE_INSET, top: clampY(curTop) },
      { edge: 'right', left: sr.width - sz - EDGE_INSET, top: clampY(curTop) },
      { edge: 'top', left: clampX(curLeft), top: EDGE_INSET },
      { edge: 'bottom', left: clampX(curLeft), top: sr.height - sz - EDGE_INSET },
    ];

    var dlgTop = getDialogueTop();
    if (dlgTop != null) {
      candidates.push({
        edge: 'dlg-above',
        left: clampX(curLeft),
        top: clampY(dlgTop - sz - DLG_GAP),
      });
      candidates.push({
        edge: 'dlg-below',
        left: clampX(curLeft),
        top: clampY(dlgTop + DLG_GAP),
      });
    }

    var best = candidates[0];
    var bestDist = Infinity;
    candidates.forEach(function (c) {
      var dx = cx - (c.left + sz / 2);
      var dy = cy - (c.top + sz / 2);
      var d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    });
    return best;
  }

  function animateSnapTo(fab, target, onDone) {
    cancelSnapAnimation(fab);
    fab.classList.remove('is-dragging');
    void fab.offsetWidth;
    fab.classList.add('is-snapping');
    applySnapRect(fab, target.left, target.top, target.edge);

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      cancelSnapAnimation(fab);
      savePos(target.left, target.top, target.edge);
      if (onDone) onDone();
    }

    function onTransitionEnd(e) {
      if (e.target !== fab) return;
      if (e.propertyName !== 'left' && e.propertyName !== 'top') return;
      fab.removeEventListener('transitionend', onTransitionEnd);
      if (snapTimer) {
        clearTimeout(snapTimer);
        snapTimer = null;
      }
      finish();
    }

    fab.addEventListener('transitionend', onTransitionEnd);
    snapTimer = setTimeout(function () {
      fab.removeEventListener('transitionend', onTransitionEnd);
      finish();
    }, SNAP_MS + 40);
  }

  function setPositionFromSaved(fab, p) {
    if (!p) {
      setDefaultAnchor(fab);
      return;
    }
    if (p.edge) applySnapRect(fab, p.x, p.y, p.edge);
    else setFreePosition(fab, p.x, p.y);
  }

  function snapToEdge(fab, animate) {
    var target = computeSnapTarget(fab);
    if (!target) return;
    if (animate) animateSnapTo(fab, target);
    else {
      var applied = applySnapRect(fab, target.left, target.top, target.edge);
      savePos(applied.left, applied.top, applied.edge);
    }
  }

  function lockCurrentPosition(fab) {
    var pos = readCurrentPos(fab);
    setFreePosition(fab, pos.x, pos.y);
    savePos(pos.x, pos.y, null);
  }

  function applyPositionMode(lockNow) {
    var fab = fabEl();
    if (!fab) return;
    var mode = getPositionMode();
    fab.classList.toggle('is-fixed', mode === 'fixed');

    if (mode === 'fixed') {
      if (lockNow) lockCurrentPosition(fab);
      else {
        var savedFixed = readSavedPos();
        if (savedFixed && !savedFixed.edge) setFreePosition(fab, savedFixed.x, savedFixed.y);
        else if (savedFixed) setPositionFromSaved(fab, savedFixed);
        else lockCurrentPosition(fab);
      }
      return;
    }

    var saved = readSavedPos();
    if (mode === 'snap') {
      if (saved && saved.edge) setPositionFromSaved(fab, saved);
      else snapToEdge(fab, false);
      return;
    }

    if (saved) setPositionFromSaved(fab, saved);
    else setDefaultAnchor(fab);
  }

  function bind() {
    var fab = fabEl();
    if (!fab || fab.dataset.bound === '1') return;
    fab.dataset.bound = '1';

    mountIcon();
    applyPositionMode();

    var dragging = false;
    var moved = false;
    var suppressClick = false;
    var sx = 0;
    var sy = 0;
    var ox = 0;
    var oy = 0;

    function armClickSuppress() {
      suppressClick = true;
      var onSuppressClick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cleanup();
      };
      var cleanup = function () {
        suppressClick = false;
        document.removeEventListener('click', onSuppressClick, true);
      };
      setTimeout(function () {
        if (!suppressClick) return;
        document.addEventListener('click', onSuppressClick, true);
        setTimeout(cleanup, 400);
      }, 0);
    }

    function pointerDown(e) {
      var st = stageEl();
      if (st && st.classList.contains('is-cg-view')) {
        var hideFab =
          !window.天青_settings || !window.天青_settings.isCgHideFab || window.天青_settings.isCgHideFab();
        if (hideFab) return;
      }
      e.stopPropagation();
      cancelSnapAnimation(fab);
      fab.classList.add('is-pressed');
      if (getPositionMode() === 'fixed') return;
      dragging = true;
      moved = false;
      fab.classList.add('is-dragging');
      var t = e.touches ? e.touches[0] : e;
      sx = t.clientX;
      sy = t.clientY;
      var r = fab.getBoundingClientRect();
      var sr = stageRect();
      ox = r.left - sr.left;
      oy = r.top - sr.top;
    }

    function pointerMove(e) {
      if (!dragging) return;
      var t = e.touches ? e.touches[0] : e;
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      if (!moved && Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) return;
      moved = true;
      if (e.cancelable) e.preventDefault();
      var pos = clampLeftTop(ox + dx, oy + dy, getFabSize(fab));
      setFreePosition(fab, pos.left, pos.top);
    }

    function pointerUp(e) {
      if (!dragging) {
        fab.classList.remove('is-pressed');
        return;
      }
      dragging = false;
      fab.classList.remove('is-pressed');
      fab.classList.remove('is-dragging');
      if (!moved) return;
      if (e && e.stopPropagation) e.stopPropagation();
      var mode = getPositionMode();
      if (mode === 'snap') {
        snapToEdge(fab, true);
      } else {
        var sr = stageRect();
        var r = fab.getBoundingClientRect();
        savePos(r.left - sr.left, r.top - sr.top, null);
      }
      armClickSuppress();
    }

    fab.addEventListener('mousedown', pointerDown);
    document.addEventListener('mousemove', pointerMove);
    document.addEventListener('mouseup', pointerUp);
    fab.addEventListener('touchstart', pointerDown, { passive: false });
    document.addEventListener('touchmove', pointerMove, { passive: false });
    document.addEventListener('touchend', pointerUp);

    fab.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (moved || suppressClick) {
        moved = false;
        return;
      }
      if (window.天青_phone && window.天青_phone.open) window.天青_phone.open();
    });

    fab.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      fab.click();
    });
  }

  window.天青_phone_fab = {
    bind: bind,
    applyPositionMode: applyPositionMode,
    resetPosition: function () {
      var fab = fabEl();
      if (!fab) return;
      try {
        localStorage.removeItem(POS_KEY);
      } catch (e) {}
      cancelSnapAnimation(fab);
      setDefaultAnchor(fab);
      applyPositionMode();
    },
  };
})();
