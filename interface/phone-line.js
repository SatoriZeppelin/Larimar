/**
 * LINE App · 聊天列表 + 对话界面
 * 对外：window.天青_phone_line
 */
(function () {
  var STORE_KEY = 'tq_plus_line';
  var view = 'list'; /* list | room */
  var activeChatId = '';
  var bound = false;
  var stickerPanelOpen = false;
  var stickerTab = 'recent';

  var USER_AVATAR =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<rect width="100" height="100" rx="22" fill="#c8cdd3"/>' +
        '<circle cx="50" cy="38" r="18" fill="#8b96a5"/>' +
        '<path d="M18 90 Q18 58 50 58 Q82 58 82 90 Z" fill="#8b96a5"/>' +
        '</svg>',
    );

  function tqAvatar() {
    var map = window.天青_avatars;
    if (map && map['微笑']) return map['微笑'];
    if (map && map['高兴']) return map['高兴'];
    return 'https://files.catbox.moe/08zgoe.jpg';
  }

  function defaultStore() {
    return {
      chats: {
        tianqing: {
          id: 'tianqing',
          type: 'dm',
          name: '天青',
          avatar: tqAvatar(),
          profile: {
            gender: '女',
            signature: 'ただ君に晴れ',
          },
          messages: [
            { me: false, text: '制作人～今天也辛苦啦！', day: 1, h: 7, m: 55 },
            { me: false, text: '晚上有空的话，要不要听我练歌？🎤', day: 1, h: 7, m: 57 },
          ],
        },
        group: {
          id: 'group',
          type: 'group',
          name: '群组',
          members: ['天青', '制作人', '小夏', '阿哲'],
          messages: [],
        },
      },
      lastReadIndex: {
        tianqing: -1,
        group: -1,
      },
    };
  }

  function isDefaultGroupSeed(msgs) {
    if (!msgs || msgs.length !== 3) return false;
    return (
      msgs[0] &&
      msgs[0].name === '小夏' &&
      msgs[0].text === '周末直播排练定几点？' &&
      msgs[1] &&
      msgs[1].name === '天青' &&
      msgs[1].text === '下午两点可以吗～' &&
      msgs[2] &&
      msgs[2].name === '阿哲' &&
      msgs[2].text === '我没问题'
    );
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultStore();
      var data = JSON.parse(raw);
      if (!data || !data.chats) return defaultStore();
      if (data.chats.tianqing && !data.chats.tianqing.avatar) {
        data.chats.tianqing.avatar = tqAvatar();
      }
      if (data.chats.tianqing && !data.chats.tianqing.profile) {
        data.chats.tianqing.profile = {
          gender: '女',
          signature: 'ただ君に晴れ',
        };
      } else if (
        data.chats.tianqing &&
        data.chats.tianqing.profile &&
        data.chats.tianqing.profile.signature === '今天也要把歌写好～'
      ) {
        data.chats.tianqing.profile.signature = 'ただ君に晴れ';
      }
      if (data.chats.group && data.chats.group.name === '多人群组') {
        data.chats.group.name = '群组';
      }
      if (data.chats.group && isDefaultGroupSeed(data.chats.group.messages)) {
        data.chats.group.messages = [];
      }
      ensureReadMeta(data);
      return data;
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  var CHAT_IDS = ['tianqing', 'group'];

  function ensureReadMeta(data) {
    if (!data) return;
    if (!data.lastReadIndex || typeof data.lastReadIndex !== 'object') {
      data.lastReadIndex = {};
    }
    CHAT_IDS.forEach(function (id) {
      if (typeof data.lastReadIndex[id] === 'number') return;
      var chat = data.chats && data.chats[id];
      var len = chat && chat.messages ? chat.messages.length : 0;
      data.lastReadIndex[id] = len > 0 ? len - 1 : -1;
    });
  }

  function formatBadgeCount(n) {
    n = parseInt(n, 10) || 0;
    if (n < 1) return '';
    return n > 99 ? '99+' : String(n);
  }

  function countChatUnread(chatId, store) {
    store = store || loadStore();
    ensureReadMeta(store);
    var chat = store.chats && store.chats[chatId];
    if (!chat || !chat.messages || !chat.messages.length) return 0;
    var lastRead = store.lastReadIndex[chatId];
    if (typeof lastRead !== 'number') lastRead = -1;
    var count = 0;
    for (var i = lastRead + 1; i < chat.messages.length; i++) {
      if (chat.messages[i] && !chat.messages[i].me) count++;
    }
    return count;
  }

  function getTotalUnread(store) {
    store = store || loadStore();
    var total = 0;
    CHAT_IDS.forEach(function (id) {
      total += countChatUnread(id, store);
    });
    return total;
  }

  function isViewingChat(chatId) {
    return view === 'room' && activeChatId === chatId;
  }

  function setBadgeEl(el, count) {
    if (!el) return;
    var text = formatBadgeCount(count);
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.removeAttribute('aria-label');
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.setAttribute('aria-label', '未读 ' + text);
  }

  function refreshBadges() {
    var store = loadStore();
    var total = getTotalUnread(store);
    setBadgeEl(document.getElementById('tq-line-header-badge'), total);
    if (window.天青_phone && window.天青_phone.refreshLineBadge) {
      window.天青_phone.refreshLineBadge(total);
    }
    if (window.天青_phone_fab && window.天青_phone_fab.refreshUnreadBadge) {
      window.天青_phone_fab.refreshUnreadBadge(total);
    }
  }

  function markChatRead(chatId) {
    var store = loadStore();
    ensureReadMeta(store);
    var chat = store.chats && store.chats[chatId];
    if (!chat) return;
    var len = (chat.messages || []).length;
    store.lastReadIndex[chatId] = len > 0 ? len - 1 : -1;
    saveStore(store);
    refreshBadges();
  }

  function onInboundMessage(chatId) {
    if (isViewingChat(chatId)) markChatRead(chatId);
    else refreshBadges();
  }

  function pushInboundMessage(chatId, msg) {
    var store = loadStore();
    var chat = store.chats && store.chats[chatId];
    if (!chat || chat.type === 'group') return;
    chat.messages = chat.messages || [];
    chat.messages.push(msg);
    saveStore(store);
    onInboundMessage(chatId);
    renderRoomIfActive(chatId);
    renderList();
  }

  function appendInboundMessages(chatId, items) {
    if (!items || !items.length) return;
    items.forEach(function (msg, i) {
      setTimeout(function (m) {
        return function () {
          pushInboundMessage(chatId, m);
        };
      }(msg), i * 420);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    return n < 10 ? '0' + n : String(n);
  }

  function readGameParts() {
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
        h = parseInt(t[0], 10);
        m = parseInt(t[1], 10);
        if (isNaN(h)) h = 16;
        if (isNaN(m)) m = 0;
        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));
      }
      if (d != null && d !== '') day = d;
      weekday = String(w == null ? '' : w).trim();
      if (weekday && weekday.indexOf('星期') !== 0) weekday = '星期' + weekday;
    }
    return { h: h, m: m, day: day, weekday: weekday };
  }

  function msgStamp(m) {
    if (m && typeof m.h === 'number') {
      return {
        day: m.day != null && m.day !== '' ? m.day : 1,
        h: m.h,
        m: typeof m.m === 'number' ? m.m : 0,
      };
    }
    if (m && m.at) {
      var d = new Date(m.at);
      return { day: 1, h: d.getHours(), m: d.getMinutes() };
    }
    return readGameParts();
  }

  function formatTime(m) {
    if (!m) return '';
    var s = msgStamp(m);
    return pad2(s.h) + ':' + pad2(s.m);
  }

  function lastMsg(chat) {
    var list = (chat && chat.messages) || [];
    if (!list.length) return { text: '尚无讯息', day: 1, h: 0, m: 0 };
    return list[list.length - 1];
  }

  /** 私聊 · {{line_recent_message}} 默认条数（天青与制作人都算） */
  var LINE_RECENT_LIMIT = 20;

  function resolveDmChat(chatOrId) {
    if (!chatOrId) return null;
    if (typeof chatOrId === 'object') return chatOrId;
    var store = loadStore();
    return store && store.chats ? store.chats[chatOrId] : null;
  }

  /** 单条私聊消息 → <角色|内容|HH:MM>（与提示词格式对齐） */
  function formatDmRecentLine(m, chat) {
    if (!m) return '';
    var stamp = msgStamp(m);
    var time = pad2(stamp.h) + ':' + pad2(stamp.m);
    var who = m.me ? '制作人' : m.name || (chat && chat.name) || '天青';
    var body = '';
    if (m.type === 'sticker') body = String(m.sticker || '').trim();
    else body = String(m.text || '').replace(/\s+/g, ' ').trim();
    if (!body) body = '（空）';
    return '<' + who + '|' + body + '|' + time + '>';
  }

  /**
   * 私聊专用：拼装 {{line_recent_message}}
   * - 仅 type === 'dm'；群聊返回空字符串
   * - 最近 limit 条（默认 20），制作人与对方都算
   * @param {string|object} chatOrId
   * @param {{limit?: number}} [opts]
   * @returns {string}
   */
  function buildLineRecentMessage(chatOrId, opts) {
    opts = opts || {};
    var chat = resolveDmChat(chatOrId);
    if (!chat) {
      console.warn('[LINE] buildLineRecentMessage：找不到会话');
      return '';
    }
    if (chat.type === 'group') {
      console.warn('[LINE] buildLineRecentMessage：仅支持私聊，已忽略群组');
      return '';
    }
    var limit = opts.limit != null ? parseInt(opts.limit, 10) : LINE_RECENT_LIMIT;
    if (isNaN(limit) || limit < 1) limit = LINE_RECENT_LIMIT;
    var list = Array.isArray(chat.messages) ? chat.messages : [];
    if (!list.length) return '（暂无对话）';
    var slice = list.slice(Math.max(0, list.length - limit));
    return slice
      .map(function (m) {
        return formatDmRecentLine(m, chat);
      })
      .filter(Boolean)
      .join('\n');
  }

  function formatClock(m) {
    return formatTime(m);
  }

  function stickerApi() {
    return window.天青_sticker_groups || null;
  }

  function stickerMap() {
    return window.天青_stickers && typeof window.天青_stickers === 'object' ? window.天青_stickers : {};
  }

  function stickerUrl(name) {
    var api = stickerApi();
    if (api && api.getStickerUrl) return api.getStickerUrl(name);
    return stickerMap()[name] || '';
  }

  function recentTabSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 8v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>' +
      '</svg>'
    );
  }

  function stickersForTab(tab) {
    var api = stickerApi();
    if (!api) return Object.keys(stickerMap());
    if (tab === 'recent') return api.loadRecent ? api.loadRecent() : [];
    var group = api.getGroupById ? api.getGroupById(tab) : null;
    return group ? group.stickers : [];
  }

  function renderStickerTabs() {
    var tabs = document.getElementById('tq-line-sticker-tabs');
    if (!tabs) return;
    var api = stickerApi();
    var groups = api && api.getGroups ? api.getGroups() : [];
    var html =
      '<button type="button" class="tq-line__sticker-tab' +
      (stickerTab === 'recent' ? ' is-on' : '') +
      '" data-line-sticker-tab="recent" aria-label="最近使用" title="最近使用">' +
      recentTabSvg() +
      '</button>';
    groups.forEach(function (g) {
      html +=
        '<button type="button" class="tq-line__sticker-tab' +
        (stickerTab === g.id ? ' is-on' : '') +
        '" data-line-sticker-tab="' +
        esc(g.id) +
        '" aria-label="' +
        esc(g.name) +
        '" title="' +
        esc(g.name) +
        '">';
      if (g.cover) {
        html += '<img src="' + esc(g.cover) + '" alt="" />';
      } else {
        html += '<span class="tq-line__sticker-tab-fallback">' + esc(g.name.charAt(0)) + '</span>';
      }
      html += '</button>';
    });
    tabs.innerHTML = html;
  }

  function renderStickerGrid() {
    var grid = document.getElementById('tq-line-sticker-grid');
    if (!grid) return;
    var keys = stickersForTab(stickerTab);
    if (!keys.length) {
      grid.innerHTML =
        '<p class="tq-line__sticker-empty">' +
        (stickerTab === 'recent' ? '还没有最近使用的表情' : '这个表情包组是空的') +
        '</p>';
      return;
    }
    var map = stickerMap();
    grid.innerHTML = keys
      .map(function (name) {
        return (
          '<button type="button" class="tq-line__sticker" data-line-sticker="' +
          esc(name) +
          '" title="' +
          esc(name) +
          '"><img src="' +
          esc(map[name] || stickerUrl(name)) +
          '" alt="' +
          esc(name) +
          '" loading="lazy" /></button>'
        );
      })
      .join('');
  }

  function renderStickerPanel() {
    renderStickerTabs();
    renderStickerGrid();
  }

  function setStickerTab(tab) {
    stickerTab = tab || 'recent';
    renderStickerPanel();
  }

  function msgPreview(m) {
    if (m && m.type === 'sticker') return '[表情]';
    return m && m.text ? m.text : '';
  }

  function setStickerPanelOpen(open) {
    stickerPanelOpen = !!open;
    var panel = document.getElementById('tq-line-sticker-panel');
    var btn = document.getElementById('tq-line-emoji');
    if (panel) panel.hidden = !stickerPanelOpen;
    if (btn) btn.classList.toggle('is-on', stickerPanelOpen);
    if (stickerPanelOpen) {
      var recent = stickerApi() && stickerApi().loadRecent ? stickerApi().loadRecent() : [];
      stickerTab = recent.length ? 'recent' : 'tianqing';
      renderStickerPanel();
    }
  }

  function toggleStickerPanel() {
    setStickerPanelOpen(!stickerPanelOpen);
  }

  function formatDayLabel(stamp) {
    var day = stamp && stamp.day != null ? stamp.day : 1;
    var g = readGameParts();
    var wd = g.weekday || '';
    return '第' + day + '天' + (wd ? ' ' + wd : '');
  }

  function bubbleHtml(m) {
    if (m.type === 'sticker') {
      var url = stickerUrl(m.sticker);
      if (!url) return '<div class="tq-line__bubble tq-line__bubble--missing">[表情]</div>';
      return (
        '<div class="tq-line__bubble tq-line__bubble--sticker">' +
        '<img src="' +
        esc(url) +
        '" alt="' +
        esc(m.sticker || '') +
        '" /></div>'
      );
    }
    return '<div class="tq-line__bubble">' + esc(m.text) + '</div>';
  }

  function outboundLeadHtml(m) {
    if (!m.me) return '';
    var sending = m.sendStatus === 'sending';
    var html = '<span class="tq-line__send-lead">';
    if (sending) {
      html +=
        '<span class="tq-line__send-status is-sending" aria-label="发送中">' +
        '<span class="tq-line__send-spinner"></span></span>';
    } else {
      html +=
        '<span class="tq-line__send-status is-sent" aria-label="已发送">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M6.5 12.5l3.2 3.2L17.5 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg></span>' +
        '<span class="tq-line__msg-time tq-line__msg-time--outbound">' +
        esc(formatClock(m)) +
        '</span>';
    }
    html += '</span>';
    return html;
  }

  function msgMetaHtml(m) {
    if (m.me) return '';
    return (
      '<span class="tq-line__msg-meta">' +
      '<span class="tq-line__msg-time">' +
      esc(formatClock(m)) +
      '</span></span>'
    );
  }

  function msgRowHtml(m) {
    var bubble = bubbleHtml(m);
    if (m.me) return outboundLeadHtml(m) + bubble;
    return bubble + msgMetaHtml(m);
  }

  function finalizeOutboundSend(chatId, msgIndex, verify) {
    var delay = Math.round(Math.random() * 1000);
    setTimeout(function () {
      var nextStore = loadStore();
      var nextChat = nextStore.chats[chatId];
      if (!nextChat || !nextChat.messages[msgIndex]) return;
      var target = nextChat.messages[msgIndex];
      if (target.sendStatus !== 'sending') return;
      if (verify && !verify(target)) return;
      var sentAt = readGameParts();
      target.sendStatus = 'sent';
      target.day = sentAt.day;
      target.h = sentAt.h;
      target.m = sentAt.m;
      saveStore(nextStore);
      if (activeChatId === chatId && view === 'room') renderRoom();
      renderList();
    }, delay);
  }

  function commitOutboundMessage(msg, verify) {
    if (!activeChatId) return null;
    var chatId = activeChatId;
    var store = loadStore();
    var chat = store.chats[chatId];
    if (!chat) return null;
    chat.messages = chat.messages || [];
    var g = readGameParts();
    msg.me = true;
    msg.sendStatus = 'sending';
    msg.day = g.day;
    chat.messages.push(msg);
    var msgIndex = chat.messages.length - 1;
    saveStore(store);
    renderRoom();
    renderList();
    finalizeOutboundSend(chatId, msgIndex, verify);
    return msgIndex;
  }

  function updateRoomTools(chat) {
    var tools = document.querySelector('.tq-line__room-tools');
    if (!tools) return;
    var isGroup = !!(chat && chat.type === 'group');
    tools.classList.toggle('tq-line__room-tools--group', isGroup);
    var profileBtn = tools.querySelector('[data-line-tool="profile"]');
    if (profileBtn) {
      profileBtn.hidden = isGroup;
      profileBtn.disabled = isGroup;
    }
  }

  function roomToolIcons() {
    return (
      '<span class="tq-line__room-tools">' +
      '<button type="button" class="tq-line__head-tool" data-line-tool="search" aria-label="查找">' +
      '<svg class="tq-line__tool" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-3.2-3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
      '<button type="button" class="tq-line__head-tool" data-line-tool="call" aria-label="通话">' +
      '<svg class="tq-line__tool" viewBox="0 0 24 24" fill="none"><path d="M6.5 4.8c.4-.9 1.4-1.3 2.3-.9l1.6.7c.7.3 1.1 1.1.9 1.8l-.5 1.7c-.1.5 0 1 .4 1.3l2.4 2.4c.3.3.8.5 1.3.4l1.7-.5c.8-.2 1.5.2 1.8.9l.7 1.6c.4.9 0 1.9-.9 2.3l-1.4.6c-2.3 1-5.1.2-7.7-2.4S4.6 9.8 5.6 7.5l.9-2.7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="tq-line__head-tool" data-line-tool="calendar" aria-label="按日期查找">' +
      '<svg class="tq-line__tool" viewBox="0 0 24 24" fill="none"><rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 3.5v4M16 3.5v4M4 10h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>' +
      '<button type="button" class="tq-line__head-tool" data-line-tool="profile" aria-label="详细资料">' +
      '<svg class="tq-line__tool" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
      '</span>'
    );
  }

  function roomOverlaysHtml() {
    if (window.天青_phone_line_tools && window.天青_phone_line_tools.overlaysHtml) {
      return window.天青_phone_line_tools.overlaysHtml();
    }
    return '';
  }

  function sheetHtml() {
    return (
      '<div class="tq-phone__layer tq-phone__sheet tq-line" data-app-sheet="line" aria-hidden="true">' +
      '<div class="tq-line__view tq-line__list is-active" data-line-view="list">' +
      '<div class="tq-line__top">' +
      '<button type="button" class="tq-line__nav-back" data-phone-back aria-label="返回主屏幕">‹</button>' +
      '<span class="tq-line__top-title">聊天</span>' +
      '<span class="tq-line__top-actions">' +
      '<span class="tq-line__unread-badge" id="tq-line-header-badge" hidden aria-hidden="true"></span>' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</span></div>' +
      '<div class="tq-line__chats" id="tq-line-chats"></div></div>' +
      '<div class="tq-line__view tq-line__room" data-line-view="room" hidden>' +
      '<div class="tq-line__room-head">' +
      '<button type="button" class="tq-line__nav-back tq-line__nav-back--room" data-line-room-back aria-label="返回聊天列表">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<div class="tq-line__room-title" id="tq-line-room-title">聊天</div>' +
      roomToolIcons() +
      '</div>' +
      '<div class="tq-line__msgs" id="tq-line-msgs"></div>' +
      '<div class="tq-line__footer">' +
      '<div class="tq-line__sticker-panel" id="tq-line-sticker-panel" hidden>' +
      '<div class="tq-line__sticker-grid" id="tq-line-sticker-grid"></div>' +
      '<div class="tq-line__sticker-tabs" id="tq-line-sticker-tabs"></div></div>' +
      '<div class="tq-line__composer">' +
      '<button type="button" class="tq-line__tool-btn" id="tq-line-emoji" aria-label="表情包" title="表情包">' +
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10.5" r="1.1" fill="currentColor"/><circle cx="15" cy="10.5" r="1.1" fill="currentColor"/><path d="M8.5 14.5c1.2 1.4 2.7 2 3.5 2s2.3-.6 3.5-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
      '<div class="tq-line__input-wrap">' +
      '<input type="text" class="tq-line__input" id="tq-line-input" placeholder="Aa" autocomplete="off" />' +
      '<button type="button" class="tq-line__send-btn" id="tq-line-send" aria-label="发送" title="发送">' +
      '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h12M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</div></div></div>' +
      roomOverlaysHtml() +
      '</div></div>'
    );
  }

  function groupAvatarHtml() {
    return (
      '<span class="tq-line__avatar tq-line__avatar--flower" aria-hidden="true">' +
      '<svg viewBox="0 0 48 48" fill="none">' +
      '<circle cx="24" cy="24" r="5.5" fill="#f4a261"/>' +
      '<circle cx="24" cy="13" r="7" fill="#ff8fab"/>' +
      '<circle cx="33.5" cy="18" r="7" fill="#ff8fab"/>' +
      '<circle cx="33.5" cy="30" r="7" fill="#ff8fab"/>' +
      '<circle cx="24" cy="35" r="7" fill="#ff8fab"/>' +
      '<circle cx="14.5" cy="30" r="7" fill="#ff8fab"/>' +
      '<circle cx="14.5" cy="18" r="7" fill="#ff8fab"/>' +
      '</svg></span>'
    );
  }

  function avatarHtml(chat) {
    if (chat.type === 'group') return groupAvatarHtml();
    return (
      '<span class="tq-line__avatar"><img src="' +
      esc(chat.avatar || tqAvatar()) +
      '" alt="" /></span>'
    );
  }

  function renderList() {
    var el = document.getElementById('tq-line-chats');
    if (!el) return;
    var store = loadStore();
    var order = ['tianqing', 'group'];
    el.innerHTML = order
      .map(function (id) {
        var chat = store.chats[id];
        if (!chat) return '';
        var last = lastMsg(chat);
        var preview = msgPreview(last);
        var unread = countChatUnread(id, store);
        var unreadHtml = unread
          ? '<span class="tq-line__chat-unread" aria-label="未读 ' + esc(formatBadgeCount(unread)) + '">' + esc(formatBadgeCount(unread)) + '</span>'
          : '';
        if (chat.type === 'group' && last.name && !last.me) {
          preview = last.name + '：' + preview;
        } else if (last.me) {
          preview = '你：' + preview;
        }
        return (
          '<button type="button" class="tq-line__chat" data-line-chat="' +
          esc(chat.id) +
          '">' +
          avatarHtml(chat) +
          '<span class="tq-line__chat-body">' +
          '<span class="tq-line__chat-row">' +
          '<span class="tq-line__chat-name">' +
          esc(chat.name) +
          '</span>' +
          '<span class="tq-line__chat-meta">' +
          '<span class="tq-line__chat-time">' +
          esc(formatTime(last)) +
          '</span>' +
          unreadHtml +
          '</span></span>' +
          '<span class="tq-line__chat-preview">' +
          esc(preview) +
          '</span></span></button>'
        );
      })
      .join('');
  }

  function memberAvatar(name) {
    if (name === '天青') return tqAvatar();
    if (name === '制作人' || name === '你') return USER_AVATAR;
    var colors = {
      小夏: '#f7a8b8',
      阿哲: '#7eb8da',
    };
    var c = colors[name] || '#9aa5b1';
    var initial = (name || '?').charAt(0);
    return (
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect width="64" height="64" rx="14" fill="' +
          c +
          '"/>' +
          '<text x="32" y="40" text-anchor="middle" fill="#fff" font-size="26" font-family="sans-serif" font-weight="700">' +
          initial +
          '</text></svg>',
      )
    );
  }

  function renderRoom() {
    var store = loadStore();
    var chat = store.chats[activeChatId];
    if (!chat) return;
    var title = document.getElementById('tq-line-room-title');
    var msgs = document.getElementById('tq-line-msgs');
    if (title) title.textContent = chat.name;
    updateRoomTools(chat);
    if (!msgs) return;

    var html = '';
    var lastDay = '';
    (chat.messages || []).forEach(function (m, msgIndex) {
      var stamp = msgStamp(m);
      var dayKey = String(stamp.day);
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        html += '<div class="tq-line__date">' + esc(formatDayLabel(stamp)) + '</div>';
      }
      var who = m.me ? '制作人' : m.name || chat.name;
      var av = m.me ? USER_AVATAR : memberAvatar(who);
      var nameHtml =
        chat.type === 'group' && !m.me
          ? '<span class="tq-line__bubble-name">' + esc(who) + '</span>'
          : '';
      html +=
        '<div class="tq-line__msg' +
        (m.me ? ' is-me' : '') +
        (m.type === 'sticker' ? ' is-sticker' : '') +
        (m.me && m.sendStatus === 'sending' ? ' is-sending' : '') +
        '" data-msg-i="' +
        msgIndex +
        '">' +
        (m.me
          ? ''
          : '<span class="tq-line__avatar tq-line__avatar--round"><img src="' +
            esc(av) +
            '" alt="" /></span>') +
        '<div class="tq-line__bubble-col">' +
        nameHtml +
        '<div class="tq-line__bubble-row">' +
        msgRowHtml(m) +
        '</div></div></div>';
    });
    msgs.innerHTML = html;
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showView(name) {
    view = name;
    var list = document.querySelector('.tq-line__view[data-line-view="list"]');
    var room = document.querySelector('.tq-line__view[data-line-view="room"]');
    if (list) {
      list.classList.toggle('is-active', name === 'list');
      list.hidden = name !== 'list';
    }
    if (room) {
      room.classList.toggle('is-active', name === 'room');
      room.hidden = name !== 'room';
    }
  }

  function openChat(id) {
    activeChatId = id;
    setStickerPanelOpen(false);
    closeRoomTools();
    showView('room');
    renderRoom();
    markChatRead(id);
    var input = document.getElementById('tq-line-input');
    if (input) {
      input.value = '';
      setTimeout(function () {
        input.focus({ preventScroll: true });
      }, 50);
    }
  }

  var REPLY_IDLE_MS = 10000;
  var replyTimer = null;
  var pendingReplyChatId = '';

  function clearReplyTimer() {
    if (replyTimer) {
      clearTimeout(replyTimer);
      replyTimer = null;
    }
  }

  function cancelPendingReply() {
    clearReplyTimer();
    pendingReplyChatId = '';
  }

  function isInputIdle() {
    var input = document.getElementById('tq-line-input');
    if (!input) return true;
    return !String(input.value || '').trim();
  }

  /** 发送后等待空闲再请求天青回复；输入/再发送会重置计时 */
  function scheduleDmReply(chatId) {
    if (!chatId || !isActiveDm(chatId)) return;
    pendingReplyChatId = chatId;
    clearReplyTimer();
    replyTimer = setTimeout(function () {
      replyTimer = null;
      var id = pendingReplyChatId;
      if (!id) return;
      if (!isInputIdle()) {
        console.info('[LINE] 输入框仍有内容，继续等待空闲');
        scheduleDmReply(id);
        return;
      }
      pendingReplyChatId = '';
      console.info('[LINE] 空闲 ' + REPLY_IDLE_MS / 1000 + 's，请求回复');
      requestDmReply(id);
    }, REPLY_IDLE_MS);
  }

  function bumpReplyTimerOnInput() {
    if (!pendingReplyChatId) return;
    scheduleDmReply(pendingReplyChatId);
  }

  function sendMessage() {
    var input = document.getElementById('tq-line-input');
    if (!input || !activeChatId) return;
    var text = String(input.value || '').trim();
    if (!text) return;
    var chatId = activeChatId;
    commitOutboundMessage({ text: text }, function (target) {
      return target.text === text;
    });
    input.value = '';
    scheduleDmReply(chatId);
  }

  function sendSticker(name) {
    if (!name || !activeChatId || !stickerUrl(name)) return;
    var api = stickerApi();
    if (api && api.pushRecent) api.pushRecent(name);
    var chatId = activeChatId;
    commitOutboundMessage({ type: 'sticker', sticker: name }, function (target) {
      return target.type === 'sticker' && target.sticker === name;
    });
    setStickerPanelOpen(false);
    scheduleDmReply(chatId);
  }

  function isActiveDm(chatId) {
    var store = loadStore();
    var chat = store.chats && store.chats[chatId || activeChatId];
    return !!(chat && chat.type !== 'group');
  }

  function requestDmReply(chatId) {
    if (!isActiveDm(chatId)) return;
    var gen = window.天青_phone_line_generate;
    if (!gen || typeof gen.generateDmReply !== 'function') {
      console.warn('[LINE] 生成模块未加载');
      return;
    }
    gen.generateDmReply(chatId);
  }

  function renderRoomIfActive(chatId) {
    if (view === 'room' && activeChatId === chatId) renderRoom();
  }

  function closeRoomTools() {
    if (window.天青_phone_line_tools && window.天青_phone_line_tools.closeOverlay) {
      window.天青_phone_line_tools.closeOverlay();
    }
  }

  function bindRoomTools() {
    if (!window.天青_phone_line_tools || !window.天青_phone_line_tools.bind) return;
    window.天青_phone_line_tools.bind({
      getActiveChatId: function () {
        return activeChatId;
      },
      loadStore: loadStore,
      esc: esc,
      msgStamp: msgStamp,
      formatClock: formatClock,
      readGameParts: readGameParts,
      tqAvatar: tqAvatar,
      onCallConnect: function (chat) {
        console.info('[LINE] 通话连接钩子待实现', chat && chat.name);
      },
    });
  }

  /** 重置为开局默认聊天（列表 + 天青两条默认消息） */
  function resetToInitial() {
    cancelPendingReply();
    saveStore(JSON.parse(JSON.stringify(defaultStore())));
    activeChatId = '';
    setStickerPanelOpen(false);
    closeRoomTools();
    showView('list');
    if (document.querySelector('.tq-line[data-app-sheet="line"]')) {
      renderList();
    }
    refreshBadges();
  }

  function onOpen() {
    view = 'list';
    activeChatId = '';
    showView('list');
    renderList();
    refreshBadges();
    bindOnce();
    bindRoomTools();
  }

  /** @returns {boolean} true = 已处理（留在 LINE 内） */
  function onBack() {
    if (window.天青_phone_line_tools && window.天青_phone_line_tools.isOpen && window.天青_phone_line_tools.isOpen()) {
      closeRoomTools();
      return true;
    }
    if (view === 'room') {
      setStickerPanelOpen(false);
      closeRoomTools();
      showView('list');
      activeChatId = '';
      renderList();
      return true;
    }
    return false;
  }

  function bindOnce() {
    var root = document.querySelector('.tq-line[data-app-sheet="line"]');
    if (!root || root.dataset.lineBound) return;
    root.dataset.lineBound = '1';
    root.addEventListener('click', function (e) {
      var chatBtn = e.target.closest('[data-line-chat]');
      if (chatBtn) {
        e.preventDefault();
        e.stopPropagation();
        openChat(chatBtn.getAttribute('data-line-chat') || '');
        return;
      }
      if (e.target.closest('[data-line-room-back]')) {
        e.preventDefault();
        e.stopPropagation();
        onBack();
        return;
      }
      var stickerBtn = e.target.closest('[data-line-sticker]');
      if (stickerBtn) {
        e.preventDefault();
        e.stopPropagation();
        sendSticker(stickerBtn.getAttribute('data-line-sticker') || '');
        return;
      }
      var tabBtn = e.target.closest('[data-line-sticker-tab]');
      if (tabBtn) {
        e.preventDefault();
        e.stopPropagation();
        setStickerTab(tabBtn.getAttribute('data-line-sticker-tab') || 'recent');
        return;
      }
      if (e.target.closest('#tq-line-emoji')) {
        e.preventDefault();
        e.stopPropagation();
        toggleStickerPanel();
        return;
      }
      if (e.target.closest('#tq-line-send')) {
        e.preventDefault();
        e.stopPropagation();
        sendMessage();
        return;
      }
      if (stickerPanelOpen && !e.target.closest('.tq-line__sticker-panel') && !e.target.closest('#tq-line-emoji')) {
        setStickerPanelOpen(false);
      }
    });
    var input = document.getElementById('tq-line-input');
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage();
          return;
        }
        bumpReplyTimerOnInput();
      });
      input.addEventListener('input', bumpReplyTimerOnInput);
      input.addEventListener('compositionend', bumpReplyTimerOnInput);
    }
  }

  function isInRoom() {
    return view === 'room';
  }

  window.天青_phone_line = {
    sheetHtml: sheetHtml,
    onOpen: onOpen,
    onBack: onBack,
    resetToInitial: resetToInitial,
    isInRoom: isInRoom,
    getTotalUnread: getTotalUnread,
    refreshBadges: refreshBadges,
    appendInboundMessages: appendInboundMessages,
    /** 私聊 · 填充 {{line_recent_message}}（最近 20 条，双方） */
    buildLineRecentMessage: buildLineRecentMessage,
    LINE_RECENT_LIMIT: LINE_RECENT_LIMIT,
    loadStore: loadStore,
    saveStore: saveStore,
    renderList: renderList,
    renderRoomIfActive: renderRoomIfActive,
    readGameParts: readGameParts,
    requestDmReply: requestDmReply,
  };

  setTimeout(refreshBadges, 0);
})();
