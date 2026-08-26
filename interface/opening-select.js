/**
 * 开局选择：环状轮播
 * - 中间为当前选中（默认开局1）
 * - 左右各显示 2 张，越靠外越透明、越小、间距越短
 * - 左滑 = 顺序（index+1），右滑 = 逆序（index-1）
 * 对外：window.天青_opening_select
 */
(function () {
  /** 左右各额外显示几张 */
  var SIDE = 2;
  var selectedIndex = 0;
  /** 拖拽中的小数偏移（单位：张），左滑为正方向（顺） */
  var dragOffset = 0;
  var drag = null;
  var layoutRaf = 0;
  /** 拖拽松手后短暂忽略卡片 click，避免打断切换动画 */
  var suppressClickUntil = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function list() {
    if (window.天青_opening_api && window.天青_opening_api.list) {
      return window.天青_opening_api.list();
    }
    if (window.天青_opening) {
      return [{ id: 'default', title: '默认开局', subtitle: '', raw: window.天青_opening }];
    }
    return [];
  }

  function isOpen() {
    var el = $('opening-panel');
    return !!(el && el.classList.contains('open'));
  }

  function coverUrl(op) {
    if (window.天青_opening_api && window.天青_opening_api.coverUrl) {
      return window.天青_opening_api.coverUrl(op);
    }
    return '';
  }

  function spriteUrl(op) {
    if (window.天青_opening_api && window.天青_opening_api.spriteUrl) {
      return window.天青_opening_api.spriteUrl(op);
    }
    return '';
  }

  function mod(i, n) {
    if (n <= 0) return 0;
    return ((i % n) + n) % n;
  }

  function stepPx() {
    var panel = $('opening-panel');
    var track = $('opening-track');
    var gap = 28;
    if (panel) {
      gap = parseFloat(window.getComputedStyle(panel).getPropertyValue('--opening-gap')) || gap;
    }
    var first = track && track.querySelector('.opening-card-wrap');
    var w = first && first.offsetWidth ? first.offsetWidth : 0;
    if (!w) w = 300;
    return w + gap;
  }

  function toRoman(n) {
    var v = Math.max(1, Math.floor(Number(n) || 1));
    var table = [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];
    var out = '';
    for (var i = 0; i < table.length; i++) {
      while (v >= table[i][0]) {
        out += table[i][1];
        v -= table[i][0];
      }
    }
    return out || 'I';
  }

  function updateChrome() {
    var items = list();
    var idx = drag ? nearestIndex() : selectedIndex;
    var op = items[idx];
    var caption = $('opening-caption');
    if (caption) {
      if (!op) caption.textContent = '暂无可用开局';
      else caption.textContent = op.subtitle || '';
    }

    var dots = $('opening-dots');
    if (dots) {
      var existing = dots.querySelectorAll('.opening-dot');
      if (existing.length !== items.length) {
        dots.innerHTML = '';
        items.forEach(function (_, i) {
          var d = document.createElement('button');
          d.type = 'button';
          d.className = 'opening-dot' + (i === idx ? ' is-on' : '');
          d.setAttribute('aria-label', '开局 ' + (i + 1));
          d.dataset.index = String(i);
          dots.appendChild(d);
        });
      } else {
        existing.forEach(function (d, i) {
          d.classList.toggle('is-on', i === idx);
        });
      }
    }

    var prev = $('btn-opening-prev');
    var next = $('btn-opening-next');
    var multi = items.length > 1;
    if (prev) {
      prev.disabled = !multi;
      prev.hidden = !multi;
    }
    if (next) {
      next.disabled = !multi;
      next.hidden = !multi;
    }

    var confirm = $('btn-opening-confirm');
    if (confirm) {
      var locked = !!(op && op.placeholder);
      confirm.textContent = locked ? '敬请期待' : '开始开局';
      confirm.classList.toggle('is-placeholder', locked);
    }
  }

  /** 环上从浮点中心 center 到整数索引 i 的有符号距离 */
  function floatDelta(i, center, n) {
    if (n <= 0) return 0;
    var c = ((center % n) + n) % n;
    var d = i - c;
    while (d > n / 2) d -= n;
    while (d < -n / 2) d += n;
    return d;
  }

  /** 越靠外间距越短：第 1 槽满 step，之后每槽再乘 GAP_DECAY */
  var GAP_DECAY = 0.62;

  function compressedX(d, step) {
    var sign = d < 0 ? -1 : d > 0 ? 1 : 0;
    if (!sign) return 0;
    var ad = Math.abs(d);
    var x = 0;
    var slot = 0;
    while (slot + 1 <= ad) {
      slot++;
      x += step * Math.pow(GAP_DECAY, slot - 1);
    }
    var rem = ad - slot;
    if (rem > 0) x += step * Math.pow(GAP_DECAY, slot) * rem;
    return sign * x;
  }

  function cardScale(ad) {
    if (ad < 0.12) return 1;
    /* 中心 1 → ±1 ≈0.78 → ±2 ≈0.56 */
    return Math.max(0.52, 1 - ad * 0.22);
  }

  function visualCenter() {
    return selectedIndex + dragOffset;
  }

  function nearestIndex() {
    var n = list().length;
    return mod(Math.round(visualCenter()), n);
  }

  function layoutRing(animate) {
    var track = $('opening-track');
    if (!track) return;
    var items = list();
    var n = items.length;
    var step = stepPx();
    var center = visualCenter();
    var wraps = track.querySelectorAll('.opening-card-wrap');
    var dragging = !!drag;

    wraps.forEach(function (wrap) {
      var i = Number(wrap.dataset.index);
      var card = wrap.querySelector('.opening-card');
      var d = floatDelta(i, center, n);
      var ad = Math.abs(d);
      var visible = ad <= SIDE + 0.55;
      var x = compressedX(d, step);
      var scale = cardScale(ad);

      if (!animate || dragging) wrap.style.transition = 'none';
      else wrap.style.transition = '';

      if (!visible) {
        wrap.style.opacity = '0';
        wrap.style.pointerEvents = 'none';
        wrap.style.transform =
          'translate(-50%, -50%) translateX(' + x + 'px) scale(' + scale + ')';
        wrap.style.zIndex = '0';
        if (card) {
          card.classList.remove('is-selected');
          card.setAttribute('aria-selected', 'false');
        }
        return;
      }

      var opacity = Math.max(0.16, 1 - ad * 0.36);

      wrap.style.opacity = String(opacity);
      wrap.style.pointerEvents = ad < 0.55 ? 'auto' : 'none';
      wrap.style.transform =
        'translate(-50%, -50%) translateX(' + x + 'px) scale(' + scale + ')';
      wrap.style.zIndex = String(Math.round(20 - ad * 4));

      if (card) {
        var selected = Math.abs(d) < 0.35;
        card.classList.toggle('is-selected', selected);
        card.setAttribute('aria-selected', selected ? 'true' : 'false');
      }
    });
  }

  function scheduleLayout(animate) {
    if (layoutRaf) cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(function () {
      layoutRaf = 0;
      layoutRing(animate !== false);
    });
  }

  function selectIndex(i, opts) {
    var n = list().length;
    selectedIndex = mod(i, n);
    dragOffset = 0;
    updateChrome();
    layoutRing(!(opts && opts.instant));
  }

  /** 松手后吸附：保留当前画面，再过渡到整数位（与左右按钮同款动画） */
  function settleTo(target) {
    var n = list().length;
    var center = visualCenter();
    target = mod(target, n);
    selectedIndex = target;
    dragOffset = center - target;
    layoutRing(false);
    updateChrome();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dragOffset = 0;
        layoutRing(true);
      });
    });
  }

  function stepBy(dir) {
    /* dir>0：顺序（左滑方向）；dir<0：逆序 */
    selectIndex(selectedIndex + dir);
  }

  function buildCards() {
    var track = $('opening-track');
    if (!track) return;
    track.innerHTML = '';
    var items = list();
    items.forEach(function (op, i) {
      var wrap = document.createElement('div');
      wrap.className = 'opening-card-wrap';
      wrap.dataset.index = String(i);
      wrap.setAttribute('role', 'option');

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'opening-card' + (op.placeholder ? ' is-placeholder' : '');
      card.dataset.index = String(i);
      card.setAttribute('aria-label', (op.title || '开局') + (op.subtitle ? '，' + op.subtitle : ''));

      var frame = document.createElement('div');
      frame.className = 'opening-card-frame';
      frame.setAttribute('aria-hidden', 'true');

      var roman = document.createElement('div');
      roman.className = 'opening-card-roman';
      roman.textContent = toRoman(i + 1);

      var windowEl = document.createElement('div');
      windowEl.className = 'opening-card-window';

      var face = document.createElement('div');
      face.className = 'opening-card-face';
      var bg = coverUrl(op);
      if (bg) face.style.backgroundImage = 'url("' + bg + '")';

      var sp = spriteUrl(op);
      if (sp) {
        var img = document.createElement('img');
        img.className = 'opening-card-sprite';
        img.src = sp;
        img.alt = '';
        img.draggable = false;
        face.appendChild(img);
      }

      var label = document.createElement('div');
      label.className = 'opening-card-label';
      label.textContent = op.title || '开局 ' + (i + 1);

      windowEl.appendChild(face);
      windowEl.appendChild(label);
      frame.appendChild(roman);
      frame.appendChild(windowEl);
      card.appendChild(frame);
      wrap.appendChild(card);
      track.appendChild(wrap);
    });
    updateChrome();
    layoutRing(false);
  }

  function open() {
    var panel = $('opening-panel');
    if (!panel) return;
    selectedIndex = 0;
    dragOffset = 0;
    panel.classList.remove('open');
    buildCards();
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () {
      layoutRing(false);
      panel.classList.add('open');
    });
  }

  function close() {
    var panel = $('opening-panel');
    if (!panel) return;
    var ae = document.activeElement;
    if (ae && panel.contains(ae) && typeof ae.blur === 'function') ae.blur();
    drag = null;
    dragOffset = 0;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
  }

  function confirmSelected() {
    var items = list();
    var op = items[selectedIndex];
    if (!op) return;
    if (op.placeholder) {
      if (window.天青_settings && window.天青_settings.toast) {
        window.天青_settings.toast('开局占位中，敬请期待');
      }
      return;
    }
    close();
    if (typeof window.__tq_onOpeningPicked === 'function') {
      window.__tq_onOpeningPicked(op.id);
    }
  }

  function bind() {
    var prev = $('btn-opening-prev');
    var next = $('btn-opening-next');
    var confirm = $('btn-opening-confirm');
    var closeBtn = $('btn-opening-close');
    var track = $('opening-track');
    var viewport = $('opening-viewport');
    var dots = $('opening-dots');

    /* ‹ 逆序；› 顺序 */
    if (prev) {
      prev.addEventListener('click', function () {
        stepBy(-1);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        stepBy(1);
      });
    }
    if (confirm) confirm.addEventListener('click', confirmSelected);
    if (closeBtn) closeBtn.addEventListener('click', close);

    if (track) {
      track.addEventListener('click', function (e) {
        if (Date.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (drag && drag.moved) return;
        var card = e.target && e.target.closest ? e.target.closest('.opening-card') : null;
        if (!card) return;
        selectIndex(Number(card.dataset.index));
      });
    }

    if (dots) {
      dots.addEventListener('click', function (e) {
        var d = e.target && e.target.closest ? e.target.closest('.opening-dot') : null;
        if (!d) return;
        selectIndex(Number(d.dataset.index));
      });
    }

    if (viewport) {
      viewport.addEventListener(
        'pointerdown',
        function (e) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if (e.target && e.target.closest) {
            if (e.target.closest('.opening-nav, .opening-confirm, .opening-dot, .opening-close')) {
              return;
            }
          }
          if (layoutRaf) {
            cancelAnimationFrame(layoutRaf);
            layoutRaf = 0;
          }
          drag = {
            id: e.pointerId,
            x: e.clientX,
            startIndex: selectedIndex,
            moved: false,
            lastX: e.clientX,
            lastT: performance.now(),
            vx: 0,
            lastNearest: selectedIndex,
          };
          dragOffset = 0;
          layoutRing(false);
          try {
            viewport.setPointerCapture(e.pointerId);
          } catch (err) {}
        },
        { passive: true },
      );

      viewport.addEventListener(
        'pointermove',
        function (e) {
          if (!drag || drag.id !== e.pointerId) return;
          var now = performance.now();
          var dt = Math.max(1, now - drag.lastT);
          var dxFrame = e.clientX - drag.lastX;
          drag.vx = dxFrame / dt;
          drag.lastX = e.clientX;
          drag.lastT = now;

          var dx = e.clientX - drag.x;
          if (Math.abs(dx) > 6) drag.moved = true;
          /* 左滑 dx<0 → 顺序为正偏移；支持一次拖过多张 */
          dragOffset = -dx / stepPx();
          var near = nearestIndex();
          if (near !== drag.lastNearest) {
            drag.lastNearest = near;
            updateChrome();
          }
          scheduleLayout(false);
        },
        { passive: true },
      );

      function endDrag(e) {
        if (!drag || (e && drag.id !== e.pointerId)) return;
        var moved = drag.moved;
        var startIndex = drag.startIndex;
        var vx = drag.vx || 0;
        var center = visualCenter();
        var target = nearestIndex();

        /* 轻扫：未过半也按惯性切一张，效果对齐左右按钮 */
        if (moved && target === startIndex) {
          if (dragOffset > 0.18 || -vx > 0.45) target = startIndex + 1;
          else if (dragOffset < -0.18 || vx > 0.45) target = startIndex - 1;
        }

        drag = null;
        if (!moved) {
          dragOffset = 0;
          updateChrome();
          layoutRing(true);
          return;
        }

        suppressClickUntil = Date.now() + 450;
        settleTo(target);
      }

      viewport.addEventListener('pointerup', endDrag);
      viewport.addEventListener('pointercancel', endDrag);

      window.addEventListener('resize', function () {
        if (isOpen()) layoutRing(false);
      });
    }
  }

  window.天青_opening_select = {
    open: open,
    close: close,
    isOpen: isOpen,
    bind: bind,
  };
})();
