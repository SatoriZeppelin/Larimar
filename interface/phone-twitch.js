/**
 * Twitch · 手机端关注页 / 直播播放器 / 聊天
 * 对外：window.天青_phone_twitch
 */
(function () {
  var NICK_LS = 'tq_live_nick';
  var UI_OFF_LS = 'tq_plus_twitch_ui_off';
  var CHAT_OFF_LS = 'tq_plus_twitch_chat_off';
  var LIVE_STORE = 'tq_plus_live_session';
  var LIVE_STORE_VER = 2;

  var STAGE_BAND = {
    地下偶像期: { v: [30, 80], peak: 150, heat: [500, 2000] },
    正式出道期: { v: [150, 400], peak: 800, heat: [5000, 15000] },
    MV突破期: { v: [500, 1500], peak: 3500, heat: [20000, 60000] },
    专辑稳定期: { v: [1500, 4000], peak: 8000, heat: [50000, 150000] },
  };

  var TWITCH_NAME_COLORS = [
    '#ff0000',
    '#0000ff',
    '#00ad03',
    '#b22222',
    '#ff7f50',
    '#9acd32',
    '#ff4500',
    '#2e8b57',
    '#daa520',
    '#d2691e',
    '#5f9ea0',
    '#1e90ff',
    '#ff69b4',
    '#8a2be2',
    '#00ff7f',
  ];

  var FORM_CAT = {
    杂谈: 'Just Chatting',
    唱歌: 'Music',
    歌回: 'Music',
    游戏: 'Games',
  };

  var DEMO_SESSION = {
    form: '杂谈',
    bg: '宿舍',
    title: '深夜小电台',
    stage: '地下偶像期',
    band: '白日',
    expr: '微笑',
    modules: [
      { type: 'dm', who: '柠檬汽水不加冰', text: 'p桑浓度预警' },
      { type: 'dm', who: '第一排的位置是我的', text: '她每次提到制作人表情都不一样' },
      { type: 'line', who: '天青', expr: '微笑', text: '「他真的很厉害的。」', dialogue: true },
      { type: 'dm', who: '困困困', text: '稍微' },
      { type: 'dm', who: '深夜不睡觉星人', text: '我不信' },
      { type: 'dm', who: '柠檬汽水不加冰', text: '以天青的性格，稍微=吹了半小时' },
      { type: 'dm', who: '音乐系学长', text: '笑死' },
      { type: 'dm', who: '第一排的位置是我的', text: '果然' },
      { type: 'line', who: '天青', expr: '得意', text: '「你们不要笑啦，我说真的！」', dialogue: true },
      { type: 'dm', who: '路过的制作人粉', text: '天青你又在营业了' },
      { type: 'sc', who: '海纹石收藏家', yen: 100, text: '加油 Larimar！' },
      { type: 'line', who: '旁白', expr: '-', text: '她对着镜头比了个心，耳尖却悄悄红了。', dialogue: false },
    ],
  };

  var session = null;
  var li = 0;
  var chaining = false;
  var subTyping = false;
  var subTimer = null;
  var nDone = 0;
  var nTotal = 1;
  var bound = false;
  var unread = false;
  var viewMode = 'idle'; /* idle | live | replay */
  var fullscreen = false;

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
      return;
    }
    console.info('[Twitch]', msg);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function categoryOf(form) {
    var f = String(form || '').trim();
    return FORM_CAT[f] || f || 'Just Chatting';
  }

  function streamTitle(data) {
    if (!data) return 'Live';
    return String(data.title || '').trim() || categoryOf(data.form) + ' · Larimar';
  }

  function listLiveEntries() {
    var maxIdx = getCurrentMainAsstIndex();
    return (loadLiveStore().entries || [])
      .filter(function (entry) {
        return liveEntryBelongs(entry, maxIdx);
      })
      .sort(function (a, b) {
        return (b.mainMsgIndex || 0) - (a.mainMsgIndex || 0);
      });
  }

  function findLiveEntry(mainMsgIndex) {
    var found = null;
    listLiveEntries().forEach(function (entry) {
      if (entry && entry.mainMsgIndex === mainMsgIndex) found = entry;
    });
    return found;
  }

  function cheerTier(y) {
    y = +y || 0;
    if (y >= 1000) return 4;
    if (y >= 500) return 3;
    if (y >= 100) return 2;
    return 1;
  }

  function hash(s, n) {
    var x = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(x) % Math.max(1, n);
  }

  function nameColor(who) {
    return TWITCH_NAME_COLORS[hash(who, TWITCH_NAME_COLORS.length)];
  }

  function fmt(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    if (n >= 1000) return Number(n).toLocaleString('en-US');
    return String(n);
  }

  function viewersOf(data, progress) {
    var st = STAGE_BAND[readFameStage(data)] || STAGE_BAND['地下偶像期'];
    var s = String((data && data.form) || '') + String((data && data.bg) || '') + String((data && data.title) || '');
    var lo = st.v[0] + (hash(s + 'v', Math.max(1, (st.v[1] - st.v[0]) >> 1)) || 0);
    var p = typeof progress === 'number' ? progress : 0.55;
    return Math.round(lo + (st.peak - lo) * 0.55 * p);
  }

  function readFameStage(data) {
    var api = window.天青_stat_data;
    if (api && api.getByPath) {
      var s = api.getByPath('名气.阶段');
      if (s) return String(s);
    }
    return (data && data.stage) || (session && session.stage) || '地下偶像期';
  }

  function resolveBgUrl(place, band) {
    var map = window.天青_backgrounds || {};
    var bands = [band || '白日', '夜晚', '黄昏', '白日'];
    for (var i = 0; i < bands.length; i++) {
      var u = map[place + '·' + bands[i]];
      if (u) return u;
    }
    return map['宿舍·白日'] || map['宿舍·夜晚'] || '';
  }

  function resolveSprite(expr) {
    var map = window.天青_expressions || {};
    if (expr && map[expr]) return map[expr];
    return map['微笑'] || map['得意'] || '';
  }

  function channelAvatar() {
    var map = window.天青_avatars;
    if (map && map['微笑']) return map['微笑'];
    if (map && map['高兴']) return map['高兴'];
    return resolveSprite('微笑');
  }

  function getCurrentMainAsstIndex() {
    if (window.天青_phone && typeof window.天青_phone.getCurrentMainAsstIndex === 'function') {
      return window.天青_phone.getCurrentMainAsstIndex();
    }
    try {
      if (!window.天青_save || !window.天青_save.load) return -1;
      var msgs = window.天青_save.load().messages || [];
      for (var i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i] && msgs[i].role === 'assistant') return i;
      }
    } catch (e) {}
    return -1;
  }

  function liveEntryBelongs(entry, maxIdx) {
    if (!entry) return false;
    var idx = typeof entry.mainMsgIndex === 'number' ? entry.mainMsgIndex : 0;
    return idx <= maxIdx;
  }

  function loadLiveStore() {
    try {
      var raw = localStorage.getItem(LIVE_STORE);
      if (!raw) return { v: LIVE_STORE_VER, entries: [] };
      var o = JSON.parse(raw);
      if (o && o.v === LIVE_STORE_VER && Array.isArray(o.entries)) return o;
      if (o && o.form) {
        return {
          v: LIVE_STORE_VER,
          entries: [
            {
              mainMsgIndex: typeof o.mainMsgIndex === 'number' ? o.mainMsgIndex : -1,
              data: o,
            },
          ],
        };
      }
      return { v: LIVE_STORE_VER, entries: [] };
    } catch (e) {
      return { v: LIVE_STORE_VER, entries: [] };
    }
  }

  function saveLiveStore(store) {
    try {
      localStorage.setItem(LIVE_STORE, JSON.stringify(store || { v: LIVE_STORE_VER, entries: [] }));
    } catch (e) {}
  }

  function pickActiveLiveSession(entries, maxIdx) {
    maxIdx = typeof maxIdx === 'number' ? maxIdx : getCurrentMainAsstIndex();
    var best = null;
    var bestIdx = -Infinity;
    (entries || []).forEach(function (entry) {
      if (!entry || !entry.data || !liveEntryBelongs(entry, maxIdx)) return;
      var mi = typeof entry.mainMsgIndex === 'number' ? entry.mainMsgIndex : 0;
      if (mi >= bestIdx) {
        bestIdx = mi;
        best = entry.data;
      }
    });
    return best;
  }

  function upsertLiveEntry(bindIndex, data) {
    var store = loadLiveStore();
    store.entries = (store.entries || []).filter(function (entry) {
      return entry.mainMsgIndex !== bindIndex;
    });
    store.entries.push({ mainMsgIndex: bindIndex, data: data });
    saveLiveStore(store);
  }

  function persistSession(data) {
    if (!data) {
      saveLiveStore({ v: LIVE_STORE_VER, entries: [] });
      return;
    }
    var bind = typeof data.mainMsgIndex === 'number' ? data.mainMsgIndex : getCurrentMainAsstIndex();
    data.mainMsgIndex = bind;
    upsertLiveEntry(bind, data);
  }

  function loadStoredSession() {
    var store = loadLiveStore();
    return pickActiveLiveSession(store.entries, getCurrentMainAsstIndex());
  }

  function trimToMainMsgIndex(maxIdx) {
    maxIdx = typeof maxIdx === 'number' ? maxIdx : -1;
    var store = loadLiveStore();
    var before = (store.entries || []).length;
    store.entries = (store.entries || []).filter(function (entry) {
      return liveEntryBelongs(entry, maxIdx);
    });
    saveLiveStore(store);
    var active = pickActiveLiveSession(store.entries, maxIdx);
    if (active) {
      startSession(active, { skipPersist: true, replay: active.status === 'ended' });
    } else {
      showIdleHome();
      markUnread(false);
      if (window.天青_phone && typeof window.天青_phone.refreshTwitchBadge === 'function') {
        window.天青_phone.refreshTwitchBadge(0);
      }
    }
    return (store.entries || []).length !== before;
  }

  function resetToInitial() {
    saveLiveStore({ v: LIVE_STORE_VER, entries: [] });
    session = null;
    unread = false;
    showIdleHome();
    if (window.天青_phone && typeof window.天青_phone.refreshTwitchBadge === 'function') {
      window.天青_phone.refreshTwitchBadge(0);
    }
  }

  function nickInitial(name) {
    var s = String(name || '匿名').trim();
    return s ? s.charAt(0) : '?';
  }

  function sheetHtml() {
    return (
      '<div class="tq-phone__layer tq-phone__sheet tq-twitch-sheet" data-app-sheet="twitch" aria-hidden="true">' +
      '<div class="tq-twitch is-idle" id="tq-twitch">' +
      '<header class="tq-twitch__top">' +
      '<button type="button" class="tq-twitch__back" id="tq-twitch-back" aria-label="返回">‹</button>' +
      '<div class="tq-twitch__brand">' +
      '<svg class="tq-twitch__glitch" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M4.3 2 2 6.2v13.4h6.1V24l4.1-4.4h5.3L22 13.6V2H4.3zm15.1 11.2-3.8 4H12.7l-4.1 4.3v-4.3H5.3V3.7h14.1v9.5z"/>' +
      '<path fill="currentColor" d="M16.1 7.2h2.4v7.3h-2.4zm-6.6 0h2.4v7.3H9.5z"/>' +
      '</svg>Twitch</div>' +
      '<button type="button" class="tq-twitch__fs" id="tq-twitch-fs" title="全屏直播" aria-label="全屏直播">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>' +
      '</button></header>' +
      '<div class="tq-twitch__home" id="tq-twitch-home"></div>' +
      '<div class="tq-twitch__watch" id="tq-twitch-watch">' +
      '<div class="tq-twitch__player" id="tq-twitch-stage">' +
      '<img class="tq-twitch__sprite" id="tq-twitch-sprite" alt="" draggable="false" />' +
      '<div class="tq-twitch__player-hud" aria-hidden="true">' +
      '<span class="tq-twitch__live" id="tq-twitch-live">LIVE</span>' +
      '<span class="tq-twitch__viewers" id="tq-twitch-viewers">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 10a3.2 3.2 0 100-6.4A3.2 3.2 0 0010 10zm0 1.6c-3.2 0-7.2 1.6-7.2 3.6V17h14.4v-1.8c0-2-4-3.6-7.2-3.6z"/></svg>' +
      '<span id="tq-twitch-viewers-n">—</span></span></div>' +
      '<div class="tq-twitch__fs-bar" id="tq-twitch-fs-bar">' +
      '<button type="button" class="tq-twitch__fs-ico" id="tq-twitch-hide-ui" title="关闭 UI" aria-label="关闭 UI">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>' +
      '</button>' +
      '<button type="button" class="tq-twitch__fs-ico" id="tq-twitch-hide-chat" title="关闭 CHAT" aria-label="关闭 CHAT">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>' +
      '</button>' +
      '<button type="button" class="tq-twitch__fs-ico" id="tq-twitch-fs-exit" title="退出全屏" aria-label="退出全屏">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>' +
      '</button></div>' +
      '<div class="tq-twitch__cc" id="tq-twitch-sub"></div></div>' +
      '<div class="tq-twitch__meta">' +
      '<img class="tq-twitch__meta-av" id="tq-twitch-meta-av" alt="" />' +
      '<div class="tq-twitch__meta-body">' +
      '<div class="tq-twitch__meta-title" id="tq-twitch-title"></div>' +
      '<div class="tq-twitch__meta-channel">Larimar</div>' +
      '<div class="tq-twitch__meta-game" id="tq-twitch-game"></div></div>' +
      '<button type="button" class="tq-twitch__follow is-on" id="tq-twitch-follow">已订阅</button></div>' +
      '<div class="tq-twitch__chat-head"><span>聊天</span></div>' +
      '<div class="tq-twitch__chat" id="tq-twitch-dm"></div>' +
      '<div class="tq-twitch__composer" id="tq-twitch-input">' +
      '<button type="button" class="tq-twitch__nick" id="tq-twitch-nick" title="更改用户名">匿</button>' +
      '<input class="tq-twitch__text" id="tq-twitch-text" type="text" maxlength="140" placeholder="发送消息" autocomplete="off" />' +
      '<select class="tq-twitch__cheer-sel" id="tq-twitch-sc" title="金额">' +
      '<option value="0">匿名</option>' +
      '<option value="30">¥30</option><option value="50">¥50</option>' +
      '<option value="100">¥100</option><option value="500">¥500</option>' +
      '<option value="1000">¥1000</option><option value="2000">¥2000</option>' +
      '</select>' +
      '<button type="button" class="tq-twitch__send" id="tq-twitch-send" aria-label="发送">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.6 21 12 3.4 3.4 3 10.1 15 12 3 13.9z"/></svg>' +
      '</button></div>' +
      '<div class="tq-twitch__vod-bar" id="tq-twitch-replay">' +
      '<span>视频点播</span><b id="tq-twitch-replay-t"></b>' +
      '<button type="button" class="tq-twitch__replay-back" id="tq-twitch-replay-back">返回</button>' +
      '</div>' +
      '<div class="tq-twitch__alert" id="tq-twitch-alert" hidden>' +
      '<div class="tq-twitch__alert-card" role="dialog" aria-modal="true" aria-labelledby="tq-twitch-alert-msg">' +
      '<p id="tq-twitch-alert-msg">你不能取订你P的偶像</p>' +
      '<button type="button" class="tq-twitch__alert-ok" id="tq-twitch-alert-ok">好的</button>' +
      '</div></div></div></div></div>'
    );
  }

  function rootEl() {
    return document.getElementById('tq-twitch');
  }

  function stageEl() {
    return document.getElementById('tq-twitch-stage');
  }

  function paintFollow() {
    var btn = document.getElementById('tq-twitch-follow');
    if (!btn) return;
    btn.classList.add('is-on');
    btn.textContent = '已订阅';
  }

  function showSubAlert() {
    var el = document.getElementById('tq-twitch-alert');
    if (!el) return;
    el.hidden = false;
  }

  function hideSubAlert() {
    var el = document.getElementById('tq-twitch-alert');
    if (!el) return;
    el.hidden = true;
  }

  function paintBar() {
    var live = document.getElementById('tq-twitch-live');
    var viewersN = document.getElementById('tq-twitch-viewers-n');
    var n = viewersOf(session, nDone / Math.max(1, nTotal));
    if (viewersN) viewersN.textContent = fmt(n);
    if (live) {
      var vod = !!(session && (session.replayMode || session.status === 'ended' || viewMode === 'replay'));
      live.textContent = vod ? 'VOD' : 'LIVE';
      live.classList.toggle('is-vod', vod);
    }
  }

  function paintMeta() {
    var title = document.getElementById('tq-twitch-title');
    var game = document.getElementById('tq-twitch-game');
    var av = document.getElementById('tq-twitch-meta-av');
    if (title) title.textContent = streamTitle(session);
    if (game) game.textContent = categoryOf(session && session.form);
    if (av) {
      var url = channelAvatar();
      if (url) av.src = url;
    }
    paintFollow();
  }

  function pushDm(m) {
    var box = document.getElementById('tq-twitch-dm');
    if (!box || !m) return;
    var el;
    if (m.type === 'sc') {
      el = document.createElement('div');
      el.className = 'tq-twitch__cheer is-t' + cheerTier(m.yen);
      var top = document.createElement('div');
      top.className = 'top';
      var n = document.createElement('span');
      n.className = 'n';
      n.style.color = nameColor(m.who);
      n.textContent = m.who || '';
      var y = document.createElement('span');
      y.className = 'y';
      y.textContent = '¥' + (m.yen || 0);
      top.appendChild(n);
      top.appendChild(y);
      var bd = document.createElement('div');
      bd.className = 'bd';
      bd.textContent = m.text || '';
      el.appendChild(top);
      el.appendChild(bd);
    } else {
      el = document.createElement('div');
      el.className =
        'tq-twitch__msg' +
        (m.me ? ' is-me' : '') +
        (m.type === 'sys' ? ' is-sys' : '') +
        (m.streamer ? ' is-streamer' : '');
      if (m.type === 'sys') {
        el.textContent = m.text || '';
      } else {
        if (m.streamer) {
          var bc = document.createElement('span');
          bc.className = 'tq-twitch__badge-bc';
          bc.textContent = 'LIVE';
          el.appendChild(bc);
        }
        var n2 = document.createElement('span');
        n2.className = 'n';
        n2.style.color = m.streamer ? '#bf94ff' : nameColor(m.who);
        n2.textContent = m.who || '';
        var t2 = document.createElement('span');
        t2.textContent = m.text || '';
        el.appendChild(n2);
        el.appendChild(t2);
      }
    }
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 80) box.removeChild(box.firstChild);
  }

  function sysDm(t) {
    pushDm({ type: 'sys', text: t });
  }

  function setSprite(expr) {
    var img = document.getElementById('tq-twitch-sprite');
    if (!img) return;
    var url = resolveSprite(expr || (session && session.expr) || '微笑');
    if (url) {
      img.src = url;
      img.style.display = '';
    }
  }

  function paintSub(mod) {
    var sub = document.getElementById('tq-twitch-sub');
    if (!sub || !mod) return;
    clearInterval(subTimer);
    subTyping = true;
    sub.className = 'tq-twitch__cc' + (mod.dialogue ? '' : ' is-narr');
    var full = String(mod.text || '');
    var i = 0;
    sub.textContent = '';
    subTimer = setInterval(function () {
      i += 1;
      sub.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(subTimer);
        subTyping = false;
      }
    }, 26);
  }

  function chatTextFromLine(mod) {
    var t = String((mod && mod.text) || '').trim();
    if (/^「[\s\S]*」$/.test(t)) return t.slice(1, -1);
    return t;
  }

  function step() {
    if (!session) return;
    var mods = session.modules || [];
    if (li >= mods.length) {
      chaining = false;
      nDone = nTotal;
      paintBar();
      if (session.replayMode || session.status === 'ended') {
        enterReplayMode();
        return;
      }
      session.status = 'ended';
      if (!session.replayMode) {
        try {
          persistSession(session);
        } catch (e) {}
      }
      enterReplayMode();
      return;
    }
    var mod = mods[li];
    nDone = li;
    paintBar();
    if (mod.type === 'dm' || mod.type === 'sc') {
      pushDm(mod);
      li += 1;
      chaining = true;
      setTimeout(step, mod.type === 'sc' ? 620 : 380);
      return;
    }
    if (mod.type === 'line') {
      chaining = false;
      if (mod.who === '天青' && mod.expr && mod.expr !== '-') setSprite(mod.expr);
      paintSub(mod);
      if (mod.who === '天青' && mod.dialogue) {
        pushDm({ type: 'dm', who: 'Larimar', text: chatTextFromLine(mod), streamer: true });
      }
      li += 1;
      return;
    }
    li += 1;
    step();
  }

  function advance() {
    if (!session || chaining) return;
    if (subTyping) {
      clearInterval(subTimer);
      subTyping = false;
      var prev = session.modules[li - 1];
      var sub = document.getElementById('tq-twitch-sub');
      if (sub && prev && prev.type === 'line') sub.textContent = prev.text;
      return;
    }
    step();
  }

  function toTavern(t) {
    try {
      var doc = window.top.document;
      var ta =
        doc.querySelector('#send_textarea') ||
        doc.querySelector('textarea#send_textarea') ||
        doc.querySelector('.mes_text_input');
      if (ta) {
        ta.value = t;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        return '填进输入框了，回车发送';
      }
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t);
        return '已复制，粘到输入框发送';
      }
    } catch (e2) {}
    return '请手动发送：' + t;
  }

  function sendDanmaku() {
    var inp = document.getElementById('tq-twitch-text');
    var sel = document.getElementById('tq-twitch-sc');
    var nick = document.getElementById('tq-twitch-nick');
    var btn = document.getElementById('tq-twitch-send');
    if (!inp || !session || session.replayMode) return;
    var t = String(inp.value || '').trim();
    if (!t) return;
    var yen = +(sel && sel.value) || 0;
    var id = '';
    try {
      id = localStorage.getItem(NICK_LS) || '';
    } catch (e) {}
    if (!id) id = (nick && nick.title) || '匿名的听众';
    if (id === '更改用户名') id = '匿名的听众';
    pushDm(yen ? { type: 'sc', who: id, yen: yen, text: t, me: 1 } : { type: 'dm', who: id, text: t, me: 1 });
    var payload = yen ? '[SC|' + id + '|' + yen + '|' + t + ']' : '[弹幕|' + id + '|' + t + ']';
    toast(toTavern(payload));
    inp.value = '';
    if (sel) sel.value = '0';
    if (btn) {
      btn.classList.add('is-ok');
      setTimeout(function () {
        btn.classList.remove('is-ok');
      }, 900);
    }
  }

  function lsFlag(key) {
    try {
      return localStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  function setLsFlag(key, on) {
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch (e) {}
  }

  function applyFsChrome() {
    var root = rootEl();
    if (!root) return;
    var uiOff = lsFlag(UI_OFF_LS);
    var chatOff = lsFlag(CHAT_OFF_LS);
    root.classList.toggle('is-fs', !!fullscreen);
    root.classList.toggle('is-ui-off', !!uiOff);
    root.classList.toggle('is-chat-off', !!chatOff);
    var uiBtn = document.getElementById('tq-twitch-hide-ui');
    var chatBtn = document.getElementById('tq-twitch-hide-chat');
    if (uiBtn) {
      uiBtn.classList.toggle('is-on', uiOff);
      uiBtn.title = uiOff ? '显示 UI' : '关闭 UI';
      uiBtn.setAttribute('aria-label', uiBtn.title);
    }
    if (chatBtn) {
      chatBtn.classList.toggle('is-on', chatOff);
      chatBtn.title = chatOff ? '显示 CHAT' : '关闭 CHAT';
      chatBtn.setAttribute('aria-label', chatBtn.title);
    }
  }

  function setFullscreen(on) {
    if (on && viewMode === 'idle') {
      toast('请先进入直播');
      return;
    }
    fullscreen = !!on;
    applyFsChrome();
  }

  function setIdle(on) {
    var root = rootEl();
    if (!root) return;
    root.classList.toggle('is-idle', !!on);
    root.classList.toggle('is-replay', !on && viewMode === 'replay');
    if (on) {
      viewMode = 'idle';
      fullscreen = false;
      applyFsChrome();
    }
  }

  function renderHome() {
    var home = document.getElementById('tq-twitch-home');
    if (!home) return;
    var appsApi = window.天青_phone_apps;
    var icon = appsApi && appsApi.iconHtml ? appsApi.iconHtml('twitch', 'empty-twitch') : '';
    var av = channelAvatar();
    var entries = listLiveEntries();
    var liveEntries = [];
    var vodEntries = [];
    entries.forEach(function (entry) {
      if (entry && entry.data && entry.data.status !== 'ended') liveEntries.push(entry);
      else vodEntries.push(entry);
    });

    function cardHtml(entry) {
      var d = entry.data || {};
      var ended = d.status === 'ended';
      var bg = resolveBgUrl(d.bg || '宿舍', d.band || '白日');
      var n = viewersOf(d, ended ? 1 : 0.4);
      return (
        '<button type="button" class="tq-twitch__card" data-live-idx="' +
        entry.mainMsgIndex +
        '">' +
        '<div class="tq-twitch__thumb"' +
        (bg ? ' style="background-image:url(\'' + esc(bg) + '\')"' : '') +
        '>' +
        '<span class="tq-twitch__badge' +
        (ended ? ' is-vod' : '') +
        '">' +
        (ended ? 'VOD' : 'LIVE') +
        '</span>' +
        '<span class="tq-twitch__thumb-viewers">' +
        fmt(n) +
        ' 观众</span></div>' +
        '<div class="tq-twitch__card-row">' +
        '<img class="tq-twitch__card-av" alt="" src="' +
        esc(av) +
        '" />' +
        '<div class="tq-twitch__card-body">' +
        '<div class="tq-twitch__card-title">' +
        esc(streamTitle(d)) +
        '</div>' +
        '<div class="tq-twitch__card-user">Larimar</div>' +
        '<div class="tq-twitch__card-cat">' +
        esc(categoryOf(d.form)) +
        '</div></div></div></button>'
      );
    }

    var html = '<div class="tq-twitch__home-label">关注</div>';
    if (liveEntries.length) {
      html += '<div class="tq-twitch__sec">正在直播</div>';
      liveEntries.forEach(function (entry) {
        html += cardHtml(entry);
      });
    }
    if (vodEntries.length) {
      html += '<div class="tq-twitch__sec">最近直播 <span class="tq-twitch__sec-sub">视频点播</span></div>';
      vodEntries.forEach(function (entry) {
        html += cardHtml(entry);
      });
    }
    if (!entries.length) {
      html +=
        '<div class="tq-twitch__empty">' +
        '<div class="tq-twitch__empty-icon">' +
        icon +
        '</div>' +
        '<h4>Larimar 现在不在直播</h4>' +
        '<p>主线推进或点刷新，会生成一场新的直播切片。</p>' +
        '<div class="tq-twitch__empty-actions">' +
        '<button type="button" class="tq-twitch__btn tq-twitch__btn--primary" id="tq-twitch-refresh-idle">刷新直播</button>' +
        '<button type="button" class="tq-twitch__btn" id="tq-twitch-demo">预览演示直播</button>' +
        '</div></div>';
    } else {
      html +=
        '<div class="tq-twitch__empty-actions tq-twitch__empty-actions--inline">' +
        '<button type="button" class="tq-twitch__btn tq-twitch__btn--primary" id="tq-twitch-refresh-idle">刷新直播</button>' +
        '</div>';
    }
    home.innerHTML = html;
  }

  function showIdleHome() {
    session = null;
    fullscreen = false;
    hideSubAlert();
    var root = rootEl();
    if (root) root.classList.remove('is-replay');
    setIdle(true);
    renderHome();
    viewMode = 'idle';
  }

  function enterReplayMode() {
    viewMode = 'replay';
    var root = rootEl();
    if (root) root.classList.add('is-replay');
    var rt = document.getElementById('tq-twitch-replay-t');
    if (rt) rt.textContent = streamTitle(session);
    chaining = false;
    paintBar();
    sysDm('直播已结束');
  }

  function setRefreshBusy(on) {
    var btn = document.getElementById('tq-twitch-refresh-idle');
    if (!btn) return;
    btn.classList.toggle('is-busy', !!on);
    btn.disabled = !!on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  async function refreshLive() {
    var gen = window.天青_phone_twitch_generate;
    if (!gen || typeof gen.generateManualRefresh !== 'function') {
      toast('直播生成模块未就绪');
      return;
    }
    if (typeof gen.isGenerating === 'function' && gen.isGenerating()) {
      toast('正在生成直播…');
      return;
    }
    setRefreshBusy(true);
    try {
      var result = await gen.generateManualRefresh();
      if (result && result.session) {
        startSession(result.session, { skipPersist: true });
      }
    } catch (err) {
      console.error('[Twitch] 手动刷新失败', err);
      toast('直播刷新失败');
    } finally {
      setRefreshBusy(false);
    }
  }

  function openLiveEntry(mainMsgIndex, asReplay) {
    var entry = findLiveEntry(mainMsgIndex);
    if (!entry || !entry.data) return;
    if (asReplay || entry.data.status === 'ended') {
      startSession(entry.data, { skipPersist: true, replay: true });
    } else {
      startSession(entry.data, { skipPersist: true });
    }
  }

  function startSession(data, opts) {
    opts = opts || {};
    session = data ? JSON.parse(JSON.stringify(data)) : null;
    if (!session) {
      showIdleHome();
      return;
    }
    session.replayMode = !!opts.replay;
    if (opts.replay) session.status = 'ended';
    else if (!session.status) session.status = 'live';

    if (!opts.ephemeral && !opts.skipPersist && session.status === 'live') {
      persistSession(session);
    }

    viewMode = session.replayMode ? 'replay' : 'live';
    setIdle(false);
    var root = rootEl();
    if (root) root.classList.toggle('is-replay', !!session.replayMode);

    li = 0;
    chaining = false;
    subTyping = false;
    clearInterval(subTimer);
    nDone = 0;
    nTotal = (session.modules && session.modules.length) || 1;

    var st = stageEl();
    var bg = resolveBgUrl(session.bg || '宿舍', session.band || '白日');
    if (st) {
      st.style.backgroundImage = bg ? 'url("' + bg + '")' : '';
    }

    var box = document.getElementById('tq-twitch-dm');
    if (box) box.innerHTML = '';
    var sub = document.getElementById('tq-twitch-sub');
    if (sub) sub.textContent = '';

    var rt = document.getElementById('tq-twitch-replay-t');
    if (rt) rt.textContent = streamTitle(session);

    paintMeta();
    setSprite(session.expr || '微笑');
    paintBar();
    sysDm(session.replayMode ? '欢迎来到视频点播聊天室' : '欢迎来到聊天室');
    step();
  }

  function bindOnce() {
    var root = rootEl();
    if (!root) return;
    if (bound && root.dataset.twitchBound) return;
    bound = true;
    root.dataset.twitchBound = '1';

    var nick = document.getElementById('tq-twitch-nick');
    var savedNick = '匿名的听众';
    try {
      savedNick = localStorage.getItem(NICK_LS) || '匿名的听众';
    } catch (e) {}
    if (nick) {
      nick.textContent = nickInitial(savedNick);
      nick.title = savedNick;
    }

    var st = stageEl();
    if (st) {
      st.addEventListener('click', function (e) {
        e.stopPropagation();
        advance();
      });
    }

    if (nick) {
      nick.addEventListener('click', function (e) {
        e.stopPropagation();
        var n = prompt('聊天显示名称：', nick.title || savedNick);
        if (n && n.trim()) {
          var name = n.trim().slice(0, 16);
          nick.textContent = nickInitial(name);
          nick.title = name;
          try {
            localStorage.setItem(NICK_LS, name);
          } catch (err) {}
        }
      });
    }

    var follow = document.getElementById('tq-twitch-follow');
    if (follow) {
      follow.addEventListener('click', function (e) {
        e.stopPropagation();
        showSubAlert();
      });
    }

    var alertEl = document.getElementById('tq-twitch-alert');
    if (alertEl) {
      alertEl.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target === alertEl || e.target.closest('#tq-twitch-alert-ok')) hideSubAlert();
      });
    }

    var inp = document.getElementById('tq-twitch-text');
    var sel = document.getElementById('tq-twitch-sc');
    [inp, sel].forEach(function (el) {
      if (!el) return;
      el.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') sendDanmaku();
      });
    }

    var btn = document.getElementById('tq-twitch-send');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        sendDanmaku();
      });
    }

    var back = document.getElementById('tq-twitch-back');
    if (back) {
      back.addEventListener('click', function (e) {
        e.stopPropagation();
        if (onBack()) return;
        if (window.天青_phone && window.天青_phone.goHome) window.天青_phone.goHome();
      });
    }

    var fsBtn = document.getElementById('tq-twitch-fs');
    if (fsBtn) {
      fsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setFullscreen(true);
      });
    }

    var fsExit = document.getElementById('tq-twitch-fs-exit');
    if (fsExit) {
      fsExit.addEventListener('click', function (e) {
        e.stopPropagation();
        setFullscreen(false);
      });
    }

    var hideUi = document.getElementById('tq-twitch-hide-ui');
    if (hideUi) {
      hideUi.addEventListener('click', function (e) {
        e.stopPropagation();
        setLsFlag(UI_OFF_LS, !lsFlag(UI_OFF_LS));
        applyFsChrome();
      });
    }

    var hideChat = document.getElementById('tq-twitch-hide-chat');
    if (hideChat) {
      hideChat.addEventListener('click', function (e) {
        e.stopPropagation();
        setLsFlag(CHAT_OFF_LS, !lsFlag(CHAT_OFF_LS));
        applyFsChrome();
      });
    }

    applyFsChrome();

    var home = document.getElementById('tq-twitch-home');
    if (home) {
      home.addEventListener('click', function (e) {
        var hist = e.target.closest('[data-live-idx]');
        if (hist) {
          e.stopPropagation();
          var mi = parseInt(hist.getAttribute('data-live-idx') || '', 10);
          if (!isNaN(mi)) openLiveEntry(mi);
          return;
        }
        if (e.target.closest('#tq-twitch-refresh-idle')) {
          e.stopPropagation();
          refreshLive();
          return;
        }
        if (e.target.closest('#tq-twitch-demo')) {
          e.stopPropagation();
          startSession(DEMO_SESSION, { ephemeral: true });
        }
      });
    }

    var replayBack = document.getElementById('tq-twitch-replay-back');
    if (replayBack) {
      replayBack.addEventListener('click', function (e) {
        e.stopPropagation();
        showIdleHome();
      });
    }
  }

  function onOpen() {
    bindOnce();
    unread = false;
    if (window.天青_phone && typeof window.天青_phone.refreshTwitchBadge === 'function') {
      window.天青_phone.refreshTwitchBadge(0);
    } else if (window.天青_phone && typeof window.天青_phone.refreshAllUnreadBadges === 'function') {
      window.天青_phone.refreshAllUnreadBadges();
    }
    var stored = loadStoredSession();
    if (stored && stored.status !== 'ended') {
      startSession(stored, { skipPersist: true });
      return;
    }
    showIdleHome();
  }

  function onBack() {
    if (fullscreen) {
      setFullscreen(false);
      return true;
    }
    if (viewMode === 'live' || viewMode === 'replay') {
      showIdleHome();
      return true;
    }
    return false;
  }

  function setLiveSession(data, opts) {
    opts = opts || {};
    if (!data) {
      showIdleHome();
      return;
    }
    var bind = typeof opts.bindIndex === 'number' ? opts.bindIndex : getCurrentMainAsstIndex();
    var copy = JSON.parse(JSON.stringify(data));
    copy.mainMsgIndex = bind;
    copy.status = 'live';
    delete copy.replayMode;
    upsertLiveEntry(bind, copy);
    startSession(copy, { skipPersist: true });
  }

  function getLiveSession() {
    return session ? JSON.parse(JSON.stringify(session)) : loadStoredSession();
  }

  function markUnread(on) {
    unread = !!on;
  }

  function getUnreadCount() {
    return unread ? 1 : 0;
  }

  window.天青_phone_twitch = {
    sheetHtml: sheetHtml,
    onOpen: onOpen,
    onBack: onBack,
    setLiveSession: setLiveSession,
    getLiveSession: getLiveSession,
    markUnread: markUnread,
    getUnreadCount: getUnreadCount,
    trimToMainMsgIndex: trimToMainMsgIndex,
    resetToInitial: resetToInitial,
    getCurrentMainAsstIndex: getCurrentMainAsstIndex,
    refreshLive: refreshLive,
    showIdleHome: showIdleHome,
    bind: bindOnce,
    startDemo: function () {
      startSession(DEMO_SESSION, { ephemeral: true });
    },
    DEMO_SESSION: DEMO_SESSION,
  };
})();
