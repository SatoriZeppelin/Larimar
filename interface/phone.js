/**
 * SummerNight Plus · iPhone 风格手机界面
 * 对外：window.天青_phone
 */
(function () {
  var WALLPAPER = 'https://files.catbox.moe/sbg8r1.jpg';
  var clockTimer = null;
  var eventsBound = false;
  var openAppId = '';

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function clampInt(n, min, max) {
    n = parseInt(n, 10);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function getPhoneLayout() {
    if (window.天青_settings && window.天青_settings.getPhoneLayout) {
      return window.天青_settings.getPhoneLayout();
    }
    return 'center';
  }

  function applyLayout() {
    var home = $('tq-phone-home');
    if (!home) return;
    var layout = getPhoneLayout();
    home.classList.remove(
      'tq-phone__home--layout-center',
      'tq-phone__home--layout-topleft-stacked',
      'tq-phone__home--layout-topleft-compact',
    );
    if (layout === 'topleft-stacked') {
      home.classList.add('tq-phone__home--layout-topleft-stacked');
    } else if (layout === 'topleft-compact') {
      home.classList.add('tq-phone__home--layout-topleft-compact');
    } else {
      home.classList.add('tq-phone__home--layout-center');
    }
  }

  function formatWeekdayToken(w) {
    var s = String(w == null ? '' : w).trim();
    if (!s) return '';
    if (s.indexOf('星期') === 0) return s;
    return '星期' + s;
  }

  function readSystemClock() {
    var h = 16;
    var m = 0;
    var day = 1;
    var weekday = '';
    var api = window.天青_stat_data;
    if (api && api.getByPath) {
      var t = api.getByPath('时间.具体时间');
      var d = api.getByPath('时间.天数');
      var w = api.getByPath('时间.星期');
      if (Array.isArray(t) && t.length >= 2) {
        h = clampInt(t[0], 0, 23);
        m = clampInt(t[1], 0, 59);
      }
      if (d != null && d !== '') day = d;
      weekday = formatWeekdayToken(w);
    }
    return {
      time: pad2(h) + ':' + pad2(m),
      date: '第' + day + '天' + (weekday ? ' ' + weekday : ''),
    };
  }

  function updateClock() {
    var pack = readSystemClock();
    var status = $('tq-phone-status-time');
    var clock = $('tq-phone-clock-time');
    var date = $('tq-phone-clock-date');
    var hour = $('tq-phone-clock-hour');
    var minute = $('tq-phone-clock-minute');
    var parts = String(pack.time || '').split(':');
    if (status) status.textContent = pack.time;
    if (clock) clock.textContent = pack.time;
    if (date) date.textContent = pack.date;
    if (hour) hour.textContent = parts[0] || '--';
    if (minute) minute.textContent = parts[1] || '--';
  }

  function statusIconsHtml() {
    return (
      '<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">' +
      '<rect x="0" y="8" width="3" height="4" rx="0.8" fill="currentColor"/>' +
      '<rect x="5" y="5.5" width="3" height="6.5" rx="0.8" fill="currentColor"/>' +
      '<rect x="10" y="3" width="3" height="9" rx="0.8" fill="currentColor"/>' +
      '<rect x="15" y="0" width="3" height="12" rx="0.8" fill="currentColor" opacity=".35"/>' +
      '</svg>' +
      '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">' +
      '<path d="M8 2.2c2.1 0 4 .8 5.4 2.1l1.2-1.2C12.8 1.4 10.5.5 8 .5S3.2 1.4 1.4 3.1l1.2 1.2C4 3 5.9 2.2 8 2.2zm0 3.5c1.3 0 2.4.5 3.3 1.3l1.2-1.2C11.1 4.7 9.6 4 8 4s-3.1.7-4.5 1.8l1.2 1.2c.9-.8 2-1.3 3.3-1.3zM8 10.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" fill="currentColor"/>' +
      '</svg>' +
      '<svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true">' +
      '<rect x="0.5" y="0.5" width="22" height="12" rx="3.2" stroke="currentColor" fill="none" opacity=".45"/>' +
      '<rect x="2.2" y="2.2" width="16.8" height="8.6" rx="2" fill="currentColor"/>' +
      '<path d="M24.5 4.6v3.8c1-.6 1.6-1.6 1.6-1.9s-.6-1.3-1.6-1.9z" fill="currentColor" opacity=".45"/>' +
      '</svg>'
    );
  }

  function appGridHtml() {
    var appsApi = window.天青_phone_apps;
    if (!appsApi) return '';
    var list = appsApi.resolveList ? appsApi.resolveList() : appsApi.list || [];
    return list
      .map(function (app) {
        var icon = appsApi.iconHtml(app.id, 'dock-' + app.id);
        var badgeHtml =
          app.id === 'line'
            ? '<span class="tq-phone-app-badge" data-line-app-badge hidden aria-hidden="true"></span>'
            : '';
        return (
          '<button type="button" class="tq-phone-app" data-app="' +
          app.id +
          '">' +
          '<span class="tq-phone-app-icon-wrap">' +
          '<span class="tq-phone-app-icon tq-phone-app-icon--' +
          app.id +
          '">' +
          icon +
          '</span>' +
          badgeHtml +
          '</span>' +
          '<span class="tq-phone-app-label">' +
          app.label +
          '</span></button>'
        );
      })
      .join('');
  }

  function appSheetsHtml() {
    var appsApi = window.天青_phone_apps;
    if (!appsApi) return '';
    var list = appsApi.resolveList ? appsApi.resolveList() : appsApi.list || [];
    return list
      .map(function (app) {
        if (app.id === 'line' && window.天青_phone_line && window.天青_phone_line.sheetHtml) {
          return window.天青_phone_line.sheetHtml();
        }
        var icon = appsApi.iconHtml(app.id, 'sheet-' + app.id);
        return (
          '<div class="tq-phone__layer tq-phone__sheet" data-app-sheet="' +
          app.id +
          '" aria-hidden="true">' +
          '<div class="tq-phone__sheet-head">' +
          '<button type="button" class="tq-phone__sheet-back" data-phone-back aria-label="返回主屏幕">‹</button>' +
          '<span class="tq-phone__sheet-title">' +
          app.title +
          '</span></div>' +
          '<div class="tq-phone__sheet-body">' +
          '<div class="tq-phone__placeholder">' +
          '<div class="tq-phone__placeholder-icon tq-phone-app-icon tq-phone-app-icon--' +
          app.id +
          '">' +
          icon +
          '</div>' +
          '<h4>' +
          app.title +
          '</h4>' +
          '<p>' +
          app.desc +
          '<br>完整功能即将接入。</p></div></div></div>'
        );
      })
      .join('');
  }

  function buildDom() {
    var existing = $('tq-phone');
    if (existing) existing.remove();

    var root = document.createElement('div');
    root.id = 'tq-phone';
    root.className = 'tq-phone';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
    root.innerHTML =
      '<div class="tq-phone__backdrop" data-phone-close aria-hidden="true"></div>' +
      '<div class="tq-phone__frame" role="dialog" aria-modal="true" aria-label="手机">' +
      '<div class="tq-phone__rim">' +
      '<div class="tq-phone__device">' +
      '<div class="tq-phone__screen" style="--phone-wallpaper:url(\'' +
      WALLPAPER +
      '\')">' +
      '<div class="tq-phone__island" aria-hidden="true"></div>' +
      '<div class="tq-phone__status">' +
      '<span class="tq-phone__status-time" id="tq-phone-status-time">--:--</span>' +
      '<span class="tq-phone__status-icons">' +
      statusIconsHtml() +
      '</span></div>' +
      '<div class="tq-phone__layer tq-phone__home tq-phone__home--layout-center" id="tq-phone-home">' +
      '<div class="tq-phone__clock">' +
      '<div class="tq-phone__clock-date" id="tq-phone-clock-date"></div>' +
      '<div class="tq-phone__clock-time" id="tq-phone-clock-time">--:--</div>' +
      '<div class="tq-phone__clock-stack" id="tq-phone-clock-stack" aria-hidden="true">' +
      '<span class="tq-phone__clock-hour" id="tq-phone-clock-hour">--</span>' +
      '<span class="tq-phone__clock-minute" id="tq-phone-clock-minute">--</span></div></div>' +
      '<div class="tq-phone__dock">' +
      appGridHtml() +
      '</div></div>' +
      appSheetsHtml() +
      '<button type="button" class="tq-phone__home-bar" id="tq-phone-home-bar" aria-label="主屏幕"></button>' +
      '</div></div></div></div>';
    document.body.appendChild(root);
    applyLayout();
  }

  function setStatusDark(on) {
    var screen = document.querySelector('#tq-phone .tq-phone__screen');
    if (!screen) return;
    screen.classList.toggle('is-status-dark', !!on);
  }

  function goHome() {
    openAppId = '';
    var home = $('tq-phone-home');
    if (home) home.classList.remove('is-hidden');
    document.querySelectorAll('.tq-phone__sheet').forEach(function (sheet) {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
    });
    setStatusDark(false);
    var bar = $('tq-phone-home-bar');
    if (bar) bar.setAttribute('aria-label', '关闭手机');
  }

  function handleAppBack() {
    if (openAppId === 'line' && window.天青_phone_line && window.天青_phone_line.onBack) {
      if (window.天青_phone_line.onBack()) return true;
    }
    return false;
  }

  function openApp(appId) {
    var appsApi = window.天青_phone_apps;
    if (!appsApi || !appsApi.get(appId)) return;
    openAppId = appId;
    var home = $('tq-phone-home');
    var sheet = document.querySelector('.tq-phone__sheet[data-app-sheet="' + appId + '"]');
    if (home) home.classList.add('is-hidden');
    document.querySelectorAll('.tq-phone__sheet').forEach(function (el) {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    });
    if (sheet) {
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
    }
    setStatusDark(true);
    if (appId === 'line' && window.天青_phone_line && window.天青_phone_line.onOpen) {
      window.天青_phone_line.onOpen();
    }
    var bar = $('tq-phone-home-bar');
    if (bar) bar.setAttribute('aria-label', '返回主屏幕');
  }

  function startClock() {
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 15000);
  }

  function stopClock() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function isOpen() {
    var root = $('tq-phone');
    return !!(root && root.classList.contains('is-open'));
  }

  function refreshLineBadge(count) {
    if (count == null && window.天青_phone_line && window.天青_phone_line.getTotalUnread) {
      count = window.天青_phone_line.getTotalUnread();
    }
    count = parseInt(count, 10) || 0;
    var badge = document.querySelector('.tq-phone-app[data-app="line"] .tq-phone-app-badge');
    if (!badge) return;
    if (count < 1) {
      badge.hidden = true;
      badge.textContent = '';
      badge.removeAttribute('aria-label');
      return;
    }
    badge.hidden = false;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.setAttribute('aria-label', 'LINE 未读 ' + badge.textContent);
  }

  function open() {
    buildDom();
    bind();
    refreshLineBadge();
    var root = $('tq-phone');
    if (!root || isOpen()) return;
    root.classList.add('is-open');
    root.removeAttribute('inert');
    root.setAttribute('aria-hidden', 'false');
    goHome();
    startClock();
    var bar = $('tq-phone-home-bar');
    if (bar) bar.focus({ preventScroll: true });
  }

  function close() {
    var root = $('tq-phone');
    if (!root || !isOpen()) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
    goHome();
    stopClock();
    var fab = $('gal-phone-fab');
    if (fab) fab.focus({ preventScroll: true });
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  function bind() {
    var root = $('tq-phone');
    if (!root) return;

    if (!root.dataset.bound) {
      root.dataset.bound = '1';
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-phone-close]')) {
          e.preventDefault();
          close();
          return;
        }
        if (e.target.closest('[data-phone-back]')) {
          e.preventDefault();
          if (handleAppBack()) return;
          goHome();
          return;
        }
        var appBtn = e.target.closest('.tq-phone-app[data-app]');
        if (appBtn) {
          e.preventDefault();
          openApp(appBtn.getAttribute('data-app') || '');
        }
      });

      var homeBar = $('tq-phone-home-bar');
      if (homeBar) {
        homeBar.addEventListener('click', function (e) {
          e.preventDefault();
          if (openAppId) {
            if (handleAppBack()) return;
            goHome();
          } else close();
        });
      }
    }

    if (!eventsBound) {
      eventsBound = true;
      document.addEventListener('keydown', function (e) {
        if (!isOpen()) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          if (openAppId) {
            if (handleAppBack()) return;
            goHome();
          } else close();
        }
      });
    }
  }

  window.天青_phone = {
    bind: function () {
      buildDom();
      bind();
      refreshLineBadge();
    },
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    goHome: goHome,
    openApp: openApp,
    refreshClock: updateClock,
    applyLayout: applyLayout,
    refreshLineBadge: refreshLineBadge,
  };
})();
