/**
 * LINE 私聊 · 顶栏工具（查找 / 通话 / 日历 / 资料）
 * 对外：window.天青_phone_line_tools
 */
(function () {
  var ctx = null;
  var openOverlay = '';

  var DEFAULT_PROFILE = {
    gender: '女',
    signature: 'ただ君に晴れ',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function activeChat() {
    if (!ctx || !ctx.getActiveChatId) return null;
    var id = ctx.getActiveChatId();
    if (!id) return null;
    var store = ctx.loadStore();
    return store && store.chats ? store.chats[id] : null;
  }

  function profileOf(chat) {
    var p = (chat && chat.profile) || {};
    return {
      name: (chat && chat.name) || '天青',
      avatar: (chat && chat.avatar) || ctx.tqAvatar(),
      gender: p.gender || DEFAULT_PROFILE.gender,
      signature: p.signature || DEFAULT_PROFILE.signature,
    };
  }

  function msgText(m) {
    if (!m) return '';
    if (m.type === 'sticker') return '[表情] ' + (m.sticker || '');
    return m.text || '';
  }

  function closeOverlay() {
    openOverlay = '';
    document.querySelectorAll('.tq-line__overlay').forEach(function (el) {
      el.hidden = true;
    });
  }

  function showOverlay(name) {
    if (name === 'profile') {
      var chat = activeChat();
      if (chat && chat.type === 'group') return;
    }
    closeOverlay();
    openOverlay = name;
    var el = $('tq-line-overlay-' + name);
    if (el) el.hidden = false;
    if (name === 'search') {
      var input = $('tq-line-search-input');
      var results = $('tq-line-search-results');
      var chat = activeChat();
      if (input) {
        input.value = '';
        setTimeout(function () {
          input.focus({ preventScroll: true });
        }, 30);
      }
      if (results) {
        results.innerHTML =
          '<p class="tq-line__tool-hint">输入关键字查找与 ' +
          ctx.esc((chat && chat.name) || '对方') +
          ' 的聊天</p>';
      }
    }
    if (name === 'calendar') renderCalendar();
    if (name === 'profile') renderProfile();
    if (name === 'call') renderCall();
  }

  function scrollToMsg(index) {
    var msgs = $('tq-line-msgs');
    if (!msgs) return;
    var node = msgs.querySelector('[data-msg-i="' + index + '"]');
    if (!node) return;
    node.classList.add('is-highlight');
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(function () {
      node.classList.remove('is-highlight');
    }, 1600);
  }

  function firstMsgIndexOnDay(chat, day) {
    var list = (chat && chat.messages) || [];
    for (var i = 0; i < list.length; i++) {
      if (String(ctx.msgStamp(list[i]).day) === String(day)) return i;
    }
    return -1;
  }

  function daysWithMessages(chat) {
    var map = {};
    (chat && chat.messages ? chat.messages : []).forEach(function (m) {
      map[String(ctx.msgStamp(m).day)] = true;
    });
    return Object.keys(map)
      .map(function (d) {
        return parseInt(d, 10);
      })
      .filter(function (d) {
        return !isNaN(d);
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  function runSearch(keyword) {
    var box = $('tq-line-search-results');
    if (!box) return;
    var chat = activeChat();
    if (!chat) {
      box.innerHTML = '<p class="tq-line__tool-empty">暂无聊天记录</p>';
      return;
    }
    var q = String(keyword || '').trim().toLowerCase();
    if (!q) {
      box.innerHTML = '<p class="tq-line__tool-hint">输入关键字查找与 ' + ctx.esc(chat.name) + ' 的聊天</p>';
      return;
    }
    var hits = [];
    (chat.messages || []).forEach(function (m, i) {
      var text = msgText(m).toLowerCase();
      if (text.indexOf(q) >= 0) {
        hits.push({ i: i, m: m, preview: msgText(m) });
      }
    });
    if (!hits.length) {
      box.innerHTML = '<p class="tq-line__tool-empty">没有找到相关消息</p>';
      return;
    }
    box.innerHTML = hits
      .map(function (hit) {
        var stamp = ctx.msgStamp(hit.m);
        var who = hit.m.me ? '你' : hit.m.name || chat.name;
        return (
          '<button type="button" class="tq-line__search-hit" data-line-search-hit="' +
          hit.i +
          '">' +
          '<span class="tq-line__search-hit-meta">' +
          ctx.esc(who) +
          ' · 第' +
          stamp.day +
          '天 ' +
          ctx.esc(ctx.formatClock(hit.m)) +
          '</span>' +
          '<span class="tq-line__search-hit-text">' +
          ctx.esc(hit.preview) +
          '</span></button>'
        );
      })
      .join('');
  }

  function renderCalendar() {
    var grid = $('tq-line-calendar-grid');
    var title = $('tq-line-calendar-title');
    if (!grid) return;
    var chat = activeChat();
    var game = ctx.readGameParts();
    var days = daysWithMessages(chat);
    var maxDay = game.day;
    days.forEach(function (d) {
      if (d > maxDay) maxDay = d;
    });
    if (maxDay < 1) maxDay = 1;
    if (title) title.textContent = '日历';
    var has = {};
    days.forEach(function (d) {
      has[d] = true;
    });
    var html = '';
    for (var d = 1; d <= maxDay; d++) {
      var on = has[d];
      var cur = d === game.day;
      html +=
        '<button type="button" class="tq-line__cal-day' +
        (on ? ' has-msg' : '') +
        (cur ? ' is-today' : '') +
        '" data-line-cal-day="' +
        d +
        '"' +
        (on ? '' : ' disabled') +
        '>' +
        '<span class="tq-line__cal-day-num">' +
        d +
        '</span>' +
        '<span class="tq-line__cal-day-label">天</span></button>';
    }
    grid.innerHTML = html;
  }

  function renderProfile() {
    var chat = activeChat();
    if (!chat) return;
    var p = profileOf(chat);
    var av = $('tq-line-profile-avatar');
    var name = $('tq-line-profile-name');
    var gender = $('tq-line-profile-gender');
    var sign = $('tq-line-profile-sign');
    if (av) av.src = p.avatar;
    if (name) name.textContent = p.name;
    if (gender) {
      gender.textContent = p.gender === '男' ? '♂' : p.gender === '女' ? '♀' : '·';
      gender.classList.toggle('is-male', p.gender === '男');
      gender.classList.toggle('is-female', p.gender === '女');
    }
    if (sign) sign.textContent = p.signature;
  }

  function renderCall() {
    var chat = activeChat();
    if (!chat) return;
    var p = profileOf(chat);
    var av = $('tq-line-call-avatar');
    var name = $('tq-line-call-name');
    if (av) av.src = p.avatar;
    if (name) name.textContent = p.name;
  }

  function onConnectCall() {
    if (ctx && ctx.onCallConnect) ctx.onCallConnect(activeChat());
    else console.info('[LINE] 通话连接钩子待实现');
    closeOverlay();
  }

  function overlaysHtml() {
    return (
      '<div class="tq-line__overlay" id="tq-line-overlay-search" hidden>' +
      '<div class="tq-line__overlay-head">' +
      '<button type="button" class="tq-line__overlay-close" data-line-overlay-close aria-label="关闭">×</button>' +
      '<span class="tq-line__overlay-title">查找聊天</span></div>' +
      '<div class="tq-line__overlay-body tq-line__overlay-body--search">' +
      '<input type="search" class="tq-line__search-input" id="tq-line-search-input" placeholder="搜索关键字…" autocomplete="off" />' +
      '<div class="tq-line__search-results" id="tq-line-search-results">' +
      '<p class="tq-line__tool-hint">输入关键字查找聊天记录</p></div></div></div>' +
      '<div class="tq-line__overlay tq-line__overlay--call" id="tq-line-overlay-call" hidden>' +
      '<div class="tq-line__call-main">' +
      '<img class="tq-line__call-avatar" id="tq-line-call-avatar" alt="" />' +
      '<div class="tq-line__call-name" id="tq-line-call-name">天青</div>' +
      '<div class="tq-line__call-status">正在呼叫…</div></div>' +
      '<div class="tq-line__call-actions">' +
      '<button type="button" class="tq-line__call-btn tq-line__call-btn--hangup" data-line-call-hangup aria-label="挂断">' +
      '<svg class="tq-line__call-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.57c-2.83-1.44-5.15-3.75-6.59-6.59l1.57-1.57a.977.977 0 00.24-1.01A11.36 11.36 0 008.62 4.1a.977.977 0 00-1-.74V2.01C7.62 1.45 7.17 1 6.61 1 3.56 1 1.1 3.56 1.1 6.61c0 10.04 8.15 18.19 18.19 18.19 3.05 0 5.61-2.46 5.61-5.51v-1.36a.977.977 0 00-.9-1.01z"/></svg></button>' +
      '<button type="button" class="tq-line__call-btn tq-line__call-btn--connect" data-line-call-connect aria-label="连接">' +
      '<svg class="tq-line__call-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.57c-2.83-1.44-5.15-3.75-6.59-6.59l1.57-1.57a.977.977 0 00.24-1.01A11.36 11.36 0 008.62 4.1a.977.977 0 00-1-.74V2.01C7.62 1.45 7.17 1 6.61 1 3.56 1 1.1 3.56 1.1 6.61c0 10.04 8.15 18.19 18.19 18.19 3.05 0 5.61-2.46 5.61-5.51v-1.36a.977.977 0 00-.9-1.01z"/></svg></button></div></div>' +
      '<div class="tq-line__overlay" id="tq-line-overlay-calendar" hidden>' +
      '<div class="tq-line__overlay-head">' +
      '<button type="button" class="tq-line__overlay-close" data-line-overlay-close aria-label="关闭">×</button>' +
      '<span class="tq-line__overlay-title" id="tq-line-calendar-title">日历</span></div>' +
      '<div class="tq-line__overlay-body">' +
      '<div class="tq-line__calendar-grid" id="tq-line-calendar-grid"></div></div></div>' +
      '<div class="tq-line__overlay tq-line__overlay--profile" id="tq-line-overlay-profile" hidden>' +
      '<div class="tq-line__overlay-head">' +
      '<button type="button" class="tq-line__overlay-close" data-line-overlay-close aria-label="关闭">×</button>' +
      '<span class="tq-line__overlay-title">详细资料</span></div>' +
      '<div class="tq-line__overlay-body tq-line__overlay-body--profile">' +
      '<div class="tq-line__profile-head">' +
      '<img class="tq-line__profile-avatar" id="tq-line-profile-avatar" alt="" />' +
      '<div class="tq-line__profile-id">' +
      '<span class="tq-line__profile-name" id="tq-line-profile-name">天青</span>' +
      '<span class="tq-line__profile-gender is-female" id="tq-line-profile-gender">♀</span></div></div>' +
      '<div class="tq-line__profile-row">' +
      '<span class="tq-line__profile-label">签名</span>' +
      '<span class="tq-line__profile-value" id="tq-line-profile-sign"></span></div></div></div>'
    );
  }

  function bind(api) {
    ctx = api;
    var root = document.querySelector('.tq-line[data-app-sheet="line"]');
    if (!root || root.dataset.lineToolsBound) return;
    root.dataset.lineToolsBound = '1';

    root.addEventListener('click', function (e) {
      var tool = e.target.closest('[data-line-tool]');
      if (tool) {
        e.preventDefault();
        e.stopPropagation();
        showOverlay(tool.getAttribute('data-line-tool') || '');
        return;
      }
      if (e.target.closest('[data-line-overlay-close]')) {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
        return;
      }
      if (e.target.closest('[data-line-call-hangup]')) {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
        return;
      }
      if (e.target.closest('[data-line-call-connect]')) {
        e.preventDefault();
        e.stopPropagation();
        onConnectCall();
        return;
      }
      var hit = e.target.closest('[data-line-search-hit]');
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        scrollToMsg(parseInt(hit.getAttribute('data-line-search-hit') || '-1', 10));
        closeOverlay();
        return;
      }
      var dayBtn = e.target.closest('[data-line-cal-day]');
      if (dayBtn && !dayBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        var day = dayBtn.getAttribute('data-line-cal-day');
        var chat = activeChat();
        var idx = firstMsgIndexOnDay(chat, day);
        if (idx >= 0) {
          scrollToMsg(idx);
          closeOverlay();
        }
      }
    });

    var searchInput = $('tq-line-search-input');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = '1';
      searchInput.addEventListener('input', function () {
        runSearch(searchInput.value);
      });
    }
  }

  window.天青_phone_line_tools = {
    overlaysHtml: overlaysHtml,
    bind: bind,
    closeOverlay: closeOverlay,
    isOpen: function () {
      return !!openOverlay;
    },
  };
})();
