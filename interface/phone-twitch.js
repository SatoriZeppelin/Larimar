/**
 * Twitch 直播间 · 手机壳内全屏，交互对齐旧版 Gal 直播模式
 * 对外：window.天青_phone_twitch
 */
(function () {
  var NICK_LS = 'tq_live_nick';
  var BARMIN_LS = 'tq_gal_barmin';
  var DMOFF_LS = 'tq_gal_dmoff';
  var LIVE_STORE = 'tq_plus_live_session';
  var LIVE_STORE_VER = 2;

  var STAGE_BAND = {
    地下偶像期: { v: [30, 80], peak: 150, heat: [500, 2000] },
    正式出道期: { v: [150, 400], peak: 800, heat: [5000, 15000] },
    MV突破期: { v: [500, 1500], peak: 3500, heat: [20000, 60000] },
    专辑稳定期: { v: [1500, 4000], peak: 8000, heat: [50000, 150000] },
  };

  var SC_TIERS = [
    [2000, '#ab1a32'],
    [1000, '#e54d60'],
    [500, '#e09443'],
    [100, '#e2b52b'],
    [50, '#427d9e'],
    [0, '#2a60b2'],
  ];

  var CLOCK = {
    清晨: [6, 8],
    上午: [9, 11],
    午后: [13, 17],
    傍晚: [18, 19],
    夜晚: [20, 22],
    深夜: [23, 25],
  };

  /** 演示场（对齐截图样式，无真实直播时也能预览 UI） */
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
  var seed = '';
  var bound = false;
  var useDemoFallback = false;
  var unread = false;
  var viewMode = 'idle'; /* idle | live | replay */

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

  function sessionTitle(data) {
    if (!data) return '直播';
    return (
      (data.form || '杂谈') +
      ' · ' +
      (data.bg || '宿舍') +
      (data.title ? ' · ' + data.title : '')
    );
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

  function scColor(y) {
    for (var i = 0; i < SC_TIERS.length; i++) {
      if (y >= SC_TIERS[i][0]) return SC_TIERS[i][1];
    }
    return SC_TIERS[SC_TIERS.length - 1][1];
  }

  function hash(s, n) {
    var x = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(x) % Math.max(1, n);
  }

  function fmt(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    if (n >= 1000) return Number(n).toLocaleString('en-US');
    return String(n);
  }

  function readFameStage() {
    var api = window.天青_stat_data;
    if (api && api.getByPath) {
      var s = api.getByPath('名气.阶段');
      if (s) return String(s);
    }
    return (session && session.stage) || '地下偶像期';
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

  function getCurrentMainAsstIndex() {
    if (window.天青_phone && typeof window.天青_phone.getCurrentMainAsstIndex === 'function') {
      return window.天青_phone.getCurrentMainAsstIndex();
    }
    try {
      if (!window.天青_save || !window.天青_save.load) return -1;
      var msgs = (window.天青_save.load().messages || []);
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
    var bind =
      typeof data.mainMsgIndex === 'number' ? data.mainMsgIndex : getCurrentMainAsstIndex();
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

  function sheetHtml() {
    return (
      '<div class="tq-phone__layer tq-phone__sheet tq-twitch-sheet" data-app-sheet="twitch" aria-hidden="true">' +
      '<div class="tq-twitch is-idle" id="tq-twitch">' +
      '<div class="tq-twitch__stage" id="tq-twitch-stage">' +
      '<button type="button" class="tq-twitch__refresh" id="tq-twitch-refresh" title="刷新直播" aria-label="刷新直播">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>' +
      '</button>' +
      '<button type="button" class="tq-twitch__back" id="tq-twitch-back" aria-label="返回主屏幕">‹</button>' +
      '<img class="tq-twitch__sprite" id="tq-twitch-sprite" alt="" draggable="false" />' +
      '<div class="tq-twitch__bar" id="tq-twitch-bar" title="点一下收起">' +
      '<span class="tq-twitch__dot" aria-hidden="true"></span><b>LIVE</b>' +
      '<span class="tq-twitch__bar-sep"></span><span class="tq-twitch__clock" id="tq-twitch-clock">--:--</span>' +
      '<span class="tq-twitch__bar-sep"></span><span class="tq-twitch__viewers" id="tq-twitch-viewers">👤 —</span>' +
      '<span class="tq-twitch__bar-sep"></span><span class="tq-twitch__heat" id="tq-twitch-heat">🔥 —</span>' +
      '</div>' +
      '<div class="tq-twitch__title" id="tq-twitch-title"></div>' +
      '<div class="tq-twitch__sub" id="tq-twitch-sub"></div>' +
      '<div class="tq-twitch__dm" id="tq-twitch-dm"></div>' +
      '<button type="button" class="tq-twitch__dm-tog" id="tq-twitch-dm-tog" title="收起弹幕">💬</button>' +
      '<div class="tq-twitch__input" id="tq-twitch-input">' +
      '<span class="tq-twitch__nick" id="tq-twitch-nick" title="点击改马甲 ID">匿名的听众</span>' +
      '<input class="tq-twitch__text" id="tq-twitch-text" type="text" maxlength="40" placeholder="发条弹幕…" autocomplete="off" />' +
      '<select class="tq-twitch__sc-sel" id="tq-twitch-sc" title="醒目留言 SC">' +
      '<option value="0">弹幕</option>' +
      '<option value="30">¥30</option><option value="50">¥50</option><option value="100">¥100</option>' +
      '<option value="500">¥500</option><option value="1000">¥1000</option><option value="2000">¥2000</option>' +
      '</select>' +
      '<button type="button" class="tq-twitch__send" id="tq-twitch-send">发送</button>' +
      '</div>' +
      '<div class="tq-twitch__replay" id="tq-twitch-replay">' +
      '<span>📼 直播回放</span><b id="tq-twitch-replay-t"></b>' +
      '<button type="button" class="tq-twitch__replay-back" id="tq-twitch-replay-back">返回</button>' +
      '</div>' +
      '<div class="tq-twitch__empty" id="tq-twitch-empty"></div>' +
      '</div></div></div>'
    );
  }

  function rootEl() {
    return document.getElementById('tq-twitch');
  }

  function stageEl() {
    return document.getElementById('tq-twitch-stage');
  }

  function paintBar() {
    var st = STAGE_BAND[readFameStage()] || STAGE_BAND['地下偶像期'];
    var bandKey = (session && session.band) || '夜晚';
    var cr = CLOCK[bandKey] || CLOCK['夜晚'] || [20, 22];
    var span = Math.max(1, cr[1] - cr[0]);
    var hh = (cr[0] + hash(seed, span)) % 24;
    var mm = hash(seed + 'm', 60);
    var clock = document.getElementById('tq-twitch-clock');
    var viewers = document.getElementById('tq-twitch-viewers');
    var heat = document.getElementById('tq-twitch-heat');
    if (clock) clock.textContent = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
    var lo = st.v[0] + (hash(seed + 'v', Math.max(1, (st.v[1] - st.v[0]) >> 1)) || 0);
    var grow = (st.peak - lo) * 0.55 * (nDone / Math.max(1, nTotal));
    if (viewers) viewers.textContent = '👤 ' + fmt(Math.round(lo + grow));
    var hb = st.heat[0] + hash(seed + 'h', Math.max(1, st.heat[1] - st.heat[0]));
    if (heat) heat.textContent = '🔥 ' + fmt(Math.round(hb * (0.7 + 0.5 * (nDone / Math.max(1, nTotal)))));
  }

  function pushDm(m) {
    var box = document.getElementById('tq-twitch-dm');
    if (!box || !m) return;
    var el;
    if (m.type === 'sc') {
      el = document.createElement('div');
      el.className = 'tq-twitch__sc';
      el.style.background = scColor(m.yen || 0);
      var top = document.createElement('div');
      top.className = 'top';
      var y = document.createElement('span');
      y.className = 'y';
      y.textContent = '¥' + (m.yen || 0);
      var n = document.createElement('span');
      n.textContent = m.who || '';
      top.appendChild(y);
      top.appendChild(n);
      var bd = document.createElement('div');
      bd.className = 'bd';
      bd.textContent = m.text || '';
      el.appendChild(top);
      el.appendChild(bd);
    } else {
      el = document.createElement('div');
      el.className = 'tq-twitch__dm-item' + (m.me ? ' is-me' : '') + (m.type === 'sys' ? ' is-sys' : '');
      if (m.type === 'sys') {
        el.textContent = m.text || '';
      } else {
        var n2 = document.createElement('span');
        n2.className = 'n';
        n2.textContent = m.who || '';
        var t2 = document.createElement('span');
        t2.textContent = m.text || '';
        el.appendChild(n2);
        el.appendChild(t2);
      }
    }
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 60) box.removeChild(box.firstChild);
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
    sub.className = 'tq-twitch__sub' + (mod.dialogue ? '' : ' is-narr');
    sub.style.animation = 'none';
    void sub.offsetWidth;
    sub.style.animation = '';
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
    var id = (nick && nick.textContent) || '匿名的听众';
    pushDm(yen ? { type: 'sc', who: id, yen: yen, text: t, me: 1 } : { type: 'dm', who: id, text: t, me: 1 });
    var payload = yen ? '[SC|' + id + '|' + yen + '|' + t + ']' : '[弹幕|' + id + '|' + t + ']';
    var msg = toTavern(payload);
    inp.value = '';
    if (sel) sel.value = '0';
    if (btn) {
      var old = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('is-ok');
      setTimeout(function () {
        btn.textContent = old;
        btn.classList.remove('is-ok');
      }, 1400);
    }
    sysDm(msg);
  }

  function applyChromeState() {
    var st = stageEl();
    if (!st) return;
    var barmin = false;
    var dmoff = false;
    try {
      barmin = localStorage.getItem(BARMIN_LS) === '1';
      dmoff = localStorage.getItem(DMOFF_LS) === '1';
    } catch (e) {}
    st.classList.toggle('is-barmin', barmin);
    st.classList.toggle('is-dmoff', dmoff);
    var tog = document.getElementById('tq-twitch-dm-tog');
    if (tog) {
      tog.textContent = dmoff ? '💬' : '✕';
      tog.title = dmoff ? '展开弹幕' : '收起弹幕';
    }
    var bar = document.getElementById('tq-twitch-bar');
    if (bar) bar.title = barmin ? '点一下展开' : '点一下收起';
  }

  function setIdle(on) {
    var root = rootEl();
    if (!root) return;
    root.classList.toggle('is-idle', !!on);
    if (on) viewMode = 'idle';
  }

  function renderIdlePanel() {
    var empty = document.getElementById('tq-twitch-empty');
    if (!empty) return;
    var appsApi = window.天青_phone_apps;
    var icon = appsApi && appsApi.iconHtml ? appsApi.iconHtml('twitch', 'empty-twitch') : '';
    var entries = listLiveEntries();
    var html =
      '<div class="tq-twitch__empty-icon">' +
      icon +
      '</div>' +
      '<h4>Twitch 直播</h4>' +
      '<p>主线钩子或点「刷新」可生成天青直播切片。<br>已保存的场次可在下方回放。</p>' +
      '<div class="tq-twitch__empty-actions">' +
      '<button type="button" class="tq-twitch__btn tq-twitch__btn--primary" id="tq-twitch-refresh-idle">刷新 / 生成直播</button>' +
      '<button type="button" class="tq-twitch__btn" id="tq-twitch-demo">预览演示场</button>' +
      '</div>';
    if (entries.length) {
      html += '<div class="tq-twitch__history"><div class="tq-twitch__history-label">最近场次</div>';
      entries.forEach(function (entry) {
        var d = entry.data || {};
        var ended = d.status === 'ended';
        html +=
          '<button type="button" class="tq-twitch__history-item" data-live-idx="' +
          entry.mainMsgIndex +
          '">' +
          '<span class="tq-twitch__history-title">' +
          esc(sessionTitle(d)) +
          '</span>' +
          '<span class="tq-twitch__history-meta">' +
          (ended ? '回放' : '进行中') +
          ' · 回合 #' +
          (entry.mainMsgIndex + 1) +
          '</span></button>';
      });
      html += '</div>';
    }
    empty.innerHTML = html;
  }

  function showIdleHome() {
    session = null;
    var st = stageEl();
    if (st) st.classList.remove('is-replay');
    setIdle(true);
    renderIdlePanel();
    viewMode = 'idle';
  }

  function enterReplayMode() {
    viewMode = 'replay';
    var st = stageEl();
    if (st) st.classList.add('is-replay');
    var rt = document.getElementById('tq-twitch-replay-t');
    if (rt) rt.textContent = sessionTitle(session);
    chaining = false;
    sysDm('—— 直播已结束 · 回放模式 ——');
  }

  function setRefreshBusy(on) {
    var btn = document.getElementById('tq-twitch-refresh');
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

    var st = stageEl();
    if (st) st.classList.toggle('is-replay', !!session.replayMode);

    li = 0;
    chaining = false;
    subTyping = false;
    clearInterval(subTimer);
    nDone = 0;
    nTotal = (session.modules && session.modules.length) || 1;
    seed = String(session.form || '') + String(session.bg || '') + String((session.modules[0] && session.modules[0].text) || '');

    var title = document.getElementById('tq-twitch-title');
    if (title) title.textContent = sessionTitle(session);

    var bg = resolveBgUrl(session.bg || '宿舍', session.band || '白日');
    if (st && bg) st.style.backgroundImage = 'url("' + bg + '")';

    var box = document.getElementById('tq-twitch-dm');
    if (box) box.innerHTML = '';
    var sub = document.getElementById('tq-twitch-sub');
    if (sub) sub.textContent = '';

    var rt = document.getElementById('tq-twitch-replay-t');
    if (rt) rt.textContent = sessionTitle(session);

    setSprite(session.expr || '微笑');
    applyChromeState();
    paintBar();
    sysDm(session.replayMode ? '—— 回放开始 ——' : '—— 直播开始 ——');
    step();
  }

  function bindOnce() {
    if (bound) return;
    var st = stageEl();
    if (!st) return;
    bound = true;

    var nick = document.getElementById('tq-twitch-nick');
    try {
      if (nick) nick.textContent = localStorage.getItem(NICK_LS) || '匿名的听众';
    } catch (e) {}

    st.addEventListener('click', function (e) {
      if (
        e.target.closest(
          '.tq-twitch__input, .tq-twitch__dm, .tq-twitch__dm-tog, .tq-twitch__bar, .tq-twitch__back, .tq-twitch__refresh, .tq-twitch__replay, .tq-twitch__empty',
        )
      ) {
        return;
      }
      advance();
    });

    var bar = document.getElementById('tq-twitch-bar');
    if (bar) {
      bar.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = !st.classList.contains('is-barmin');
        st.classList.toggle('is-barmin', on);
        try {
          localStorage.setItem(BARMIN_LS, on ? '1' : '0');
        } catch (err) {}
        applyChromeState();
      });
    }

    var tog = document.getElementById('tq-twitch-dm-tog');
    if (tog) {
      tog.addEventListener('click', function (e) {
        e.stopPropagation();
        var off = !st.classList.contains('is-dmoff');
        st.classList.toggle('is-dmoff', off);
        try {
          localStorage.setItem(DMOFF_LS, off ? '1' : '0');
        } catch (err) {}
        applyChromeState();
      });
    }

    if (nick) {
      nick.addEventListener('click', function (e) {
        e.stopPropagation();
        var n = prompt('你在直播间用的马甲 ID：', nick.textContent);
        if (n && n.trim()) {
          nick.textContent = n.trim().slice(0, 12);
          try {
            localStorage.setItem(NICK_LS, nick.textContent);
          } catch (err) {}
        }
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

    var refresh = document.getElementById('tq-twitch-refresh');
    if (refresh) {
      refresh.addEventListener('click', function (e) {
        e.stopPropagation();
        if (refresh.disabled || refresh.classList.contains('is-busy')) return;
        refreshLive();
      });
    }

    var empty = document.getElementById('tq-twitch-empty');
    if (empty) {
      empty.addEventListener('click', function (e) {
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
    if (viewMode === 'live' || viewMode === 'replay') {
      showIdleHome();
      return true;
    }
    return false;
  }

  /** 供舞台 / 解析层 / 钩子写入当前直播场（挂靠 mainMsgIndex） */
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
