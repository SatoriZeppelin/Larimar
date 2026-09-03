/**
 * Twitter / X App · 推文时间线 + 趋势
 * 对外：window.天青_phone_twitter
 */
(function () {
  var STORE_KEY = 'tq_plus_twitter';
  var STORE_VER = 2;
  var TREND_MAX = 8;
  var TREND_DECAY_MAIN = 0.8;
  var TREND_DECAY_TWITTER = 0.9;
  var view = 'tweets'; /* tweets | trends */
  var activeTweetId = '';
  var detailOpen = false;
  var store = null;
  var applyEpoch = 0;
  var busyTrendId = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isYoung() {
    var apps = window.天青_phone_apps;
    if (apps && apps.getSeniority) return apps.getSeniority() === 'young';
    return false;
  }

  function brandName() {
    return isYoung() ? 'X' : 'Twitter';
  }

  function producerName() {
    try {
      if (window.天青_persona && window.天青_persona.load) {
        var d = window.天青_persona.load();
        if (d && String(d.name || '').trim()) return String(d.name).trim();
      }
    } catch (e) {}
    return '制作人';
  }

  function tqAvatar() {
    var map = window.天青_avatars;
    if (map && map['微笑']) return map['微笑'];
    if (map && map['高兴']) return map['高兴'];
    return 'https://files.catbox.moe/08zgoe.jpg';
  }

  function avatarSvg(name, color) {
    var initial = String(name || '?').charAt(0);
    var c = color || '#1d9bf0';
    return (
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect width="64" height="64" rx="32" fill="' +
          c +
          '"/>' +
          '<text x="32" y="40" text-anchor="middle" fill="#fff" font-size="26" font-family="sans-serif" font-weight="700">' +
          initial +
          '</text></svg>',
      )
    );
  }

  function defaultTweets() {
    return [];
  }

  function defaultTrends() {
    return [
      { id: 'tr1', category: '音乐 · 趋势', topic: 'Larimar', countWan: 0.1842, count: '1,842 帖子' },
      { id: 'tr2', category: '地下偶像 · 趋势', topic: '#今晚livehouse', countWan: 0.0612, count: '612 帖子' },
      { id: 'tr3', category: '娱乐 · 趋势', topic: '某顶流偶像 毕业公演', countWan: 9.6, count: '9.6万 帖子' },
      { id: 'tr4', category: '地区 · 日本', topic: '都内 深夜地铁增发', countWan: 4.2, count: '4.2万 帖子' },
      { id: 'tr5', category: '偶像行业 · 趋势', topic: '大型事务所 新人海选', countWan: 2.8, count: '2.8万 帖子' },
      { id: 'tr6', category: '社会 · 趋势', topic: 'livehouse 补助金 政策', countWan: 1.1, count: '1.1万 帖子' },
      { id: 'tr7', category: '仅你可见的趋势', topic: '透明感声线', countWan: 0, count: '正在讨论' },
    ];
  }

  function formatWanCount(wan) {
    wan = Number(wan);
    if (!isFinite(wan) || wan < 0) wan = 0;
    if (wan <= 0) return '正在讨论';
    if (wan < 1) {
      var posts = Math.round(wan * 10000);
      return posts.toLocaleString('en-US') + ' 帖子';
    }
    var s = Math.round(wan * 10) / 10;
    if (Math.abs(s - Math.round(s)) < 0.05) s = Math.round(s);
    var label = String(s);
    if (label.indexOf('.') >= 0) label = label.replace(/\.0$/, '');
    return label + '万 帖子';
  }

  function normalizeTrendTopic(topic) {
    return String(topic || '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function ensureTrendFields(tr) {
    if (!tr || typeof tr !== 'object') return tr;
    if (typeof tr.countWan !== 'number' || isNaN(tr.countWan)) {
      var raw = String(tr.count || '').replace(/,/g, '');
      var mWan = raw.match(/([\d.]+)\s*万/);
      var mNum = raw.match(/([\d.]+)/);
      if (mWan) tr.countWan = parseFloat(mWan[1]) || 0;
      else if (mNum) tr.countWan = (parseFloat(mNum[1]) || 0) / 10000;
      else tr.countWan = 0;
    }
    tr.count = formatWanCount(tr.countWan);
    if (!tr.category) tr.category = '热搜 · 趋势';
    return tr;
  }

  /** 按帖文量（万）降序；同热度按话题名稳定排序；最多保留 TREND_MAX 条 */
  function finalizeTrendList(list) {
    return (list || [])
      .map(ensureTrendFields)
      .sort(function (a, b) {
        var aw = Number(a.countWan) || 0;
        var bw = Number(b.countWan) || 0;
        if (bw !== aw) return bw - aw;
        return String(a.topic || '').localeCompare(String(b.topic || ''), 'zh-CN');
      })
      .slice(0, TREND_MAX);
  }

  function trendBelongsToMain(tr, maxIdx) {
    if (!tr) return false;
    var idx = typeof tr.mainMsgIndex === 'number' ? tr.mainMsgIndex : 0;
    return idx <= maxIdx;
  }

  function decayEventBelongs(ev, maxIdx) {
    if (!ev) return false;
    var idx = typeof ev.atMainMsgIndex === 'number' ? ev.atMainMsgIndex : 0;
    return idx <= maxIdx;
  }

  /** 汇总趋势增量，再按挂靠回合内的衰减事件重算展示热度（回退时剔除后续衰减） */
  function rebuildTrendsFromDeltas(deltas, maxIdx, decayEvents) {
    maxIdx = typeof maxIdx === 'number' ? maxIdx : getCurrentMainAsstIndex();
    var byKey = Object.create(null);
    var order = [];
    (deltas || []).forEach(function (d) {
      if (!d || !d.topic || !trendBelongsToMain(d, maxIdx)) return;
      var key = normalizeTrendTopic(d.topic);
      if (!byKey[key]) {
        byKey[key] = {
          id: 'tr_' + key.replace(/\s+/g, '_'),
          topic: String(d.topic).trim(),
          category: d.category || '热搜 · 趋势',
          countWan: 0,
        };
        order.push(key);
      }
      byKey[key].countWan = (Number(byKey[key].countWan) || 0) + (Number(d.countWan) || 0);
      byKey[key].count = formatWanCount(byKey[key].countWan);
      if (d.category) byKey[key].category = d.category;
      byKey[key].topic = String(d.topic).trim();
    });
    var events = (decayEvents || [])
      .filter(function (ev) {
        return decayEventBelongs(ev, maxIdx);
      })
      .sort(function (a, b) {
        var ai = typeof a.atMainMsgIndex === 'number' ? a.atMainMsgIndex : 0;
        var bi = typeof b.atMainMsgIndex === 'number' ? b.atMainMsgIndex : 0;
        if (ai !== bi) return ai - bi;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    events.forEach(function (ev) {
      var f = Number(ev.factor);
      if (!isFinite(f) || f <= 0 || f > 1) return;
      order.forEach(function (k) {
        var row = byKey[k];
        if (!row || (Number(row.countWan) || 0) <= 0) return;
        row.countWan = row.countWan * f;
        row.count = formatWanCount(row.countWan);
      });
    });
    return finalizeTrendList(
      order.map(function (k) {
        return byKey[k];
      }),
    );
  }

  function ensureTrendDeltas(o) {
    if (!o || typeof o !== 'object') return;
    if (!Array.isArray(o.trendDeltas) || !o.trendDeltas.length) {
      o.trendDeltas = (Array.isArray(o.trends) && o.trends.length ? o.trends : defaultTrends()).map(function (tr, i) {
        return ensureTrendFields(
          Object.assign({}, tr, {
            id: tr.id || 'tr_seed_' + i,
            mainMsgIndex: typeof tr.mainMsgIndex === 'number' ? tr.mainMsgIndex : -1,
          }),
        );
      });
    } else {
      o.trendDeltas = o.trendDeltas.map(function (d) {
        if (typeof d.mainMsgIndex !== 'number') d.mainMsgIndex = 0;
        return ensureTrendFields(d);
      });
    }
    if (!Array.isArray(o.trendDecayEvents)) o.trendDecayEvents = [];
    o.trends = rebuildTrendsFromDeltas(o.trendDeltas, getCurrentMainAsstIndex(), o.trendDecayEvents);
  }

  /**
   * 记录衰减事件（不改写原始增量）；展示时按 atMainMsgIndex 重算，回退可撤销后续衰减
   * @param {number} factor 如主线 0.8、Twitter 刷新 0.9
   * @param {'main'|'twitter'} kind
   */
  function decayTrends(factor, kind) {
    factor = Number(factor);
    if (!isFinite(factor) || factor <= 0 || factor > 1) return false;
    store = loadStore();
    ensureTrendDeltas(store);
    if (!Array.isArray(store.trendDecayEvents)) store.trendDecayEvents = [];
    var at = getCurrentMainAsstIndex();
    store.trendDecayEvents.push({
      id: 'decay_' + Date.now() + '_' + store.trendDecayEvents.length,
      atMainMsgIndex: at,
      factor: factor,
      kind: kind === 'twitter' ? 'twitter' : 'main',
    });
    store.trends = rebuildTrendsFromDeltas(store.trendDeltas, at, store.trendDecayEvents);
    store.v = STORE_VER;
    saveStore(store);
    if (document.querySelector('.tq-tw-sheet .tq-tw')) {
      renderTrends();
    }
    return true;
  }

  function decayTrendsForMainLine() {
    return decayTrends(TREND_DECAY_MAIN, 'main');
  }

  function decayTrendsForTwitterRefresh() {
    return decayTrends(TREND_DECAY_TWITTER, 'twitter');
  }

  function defaultStore() {
    var seeds = defaultTrends().map(function (tr, i) {
      return ensureTrendFields(Object.assign({}, tr, { id: tr.id || 'tr_seed_' + i, mainMsgIndex: -1 }));
    });
    return {
      v: STORE_VER,
      tweets: defaultTweets(),
      trendDeltas: seeds,
      trendDecayEvents: [],
      trends: rebuildTrendsFromDeltas(seeds, getCurrentMainAsstIndex(), []),
      activeTab: 'tweets',
      readIds: {},
    };
  }

  function ensureReadMeta(o) {
    if (!o.readIds || typeof o.readIds !== 'object' || Array.isArray(o.readIds)) {
      o.readIds = {};
      /* 已有推文视为已读，避免升级后突然全亮红点 */
      (o.tweets || []).forEach(function (t) {
        if (t && t.id) o.readIds[t.id] = true;
      });
    }
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultStore();
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return defaultStore();
      /* v2：清空旧版示例推文 */
      if (Number(o.v) !== STORE_VER) {
        o.v = STORE_VER;
        o.tweets = [];
      }
      if (!Array.isArray(o.tweets)) o.tweets = [];
      o.tweets = o.tweets.map(function (t) {
        if (!t) return t;
        if (!Array.isArray(t.comments)) t.comments = [];
        if (!t.timeFull) t.timeFull = t.time || '';
        return t;
      });
      if (!Array.isArray(o.trends) || !o.trends.length) o.trends = defaultTrends();
      ensureTrendDeltas(o);
      if (o.activeTab !== 'trends') o.activeTab = 'tweets';
      ensureReadMeta(o);
      return o;
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  store = defaultStore();

  function getUnreadCount(s) {
    s = s || loadStore();
    ensureReadMeta(s);
    var n = 0;
    (s.tweets || []).forEach(function (t) {
      if (t && t.id && !s.readIds[t.id]) n++;
    });
    return n;
  }

  function refreshBadges() {
    var count = getUnreadCount();
    if (window.天青_phone && window.天青_phone.refreshTwitterBadge) {
      window.天青_phone.refreshTwitterBadge(count);
    } else if (window.天青_phone_fab && window.天青_phone_fab.refreshUnreadBadge) {
      var fabTotal = count;
      if (window.天青_phone_line && window.天青_phone_line.getTotalUnread) {
        fabTotal += parseInt(window.天青_phone_line.getTotalUnread(), 10) || 0;
      }
      window.天青_phone_fab.refreshUnreadBadge(fabTotal);
    }
  }

  function markAllTweetsRead() {
    store = loadStore();
    ensureReadMeta(store);
    var changed = false;
    (store.tweets || []).forEach(function (t) {
      if (t && t.id && !store.readIds[t.id]) {
        store.readIds[t.id] = true;
        changed = true;
      }
    });
    if (changed) saveStore(store);
    refreshBadges();
    return changed;
  }

  function isTwitterFeedVisible() {
    var sheet = document.querySelector('.tq-tw-sheet.is-open');
    if (!sheet) return false;
    var root = sheet.querySelector('.tq-tw');
    if (!root || root.classList.contains('is-detail')) return false;
    return view === 'tweets';
  }

  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '千';
    return String(n);
  }

  function iconReply() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 4.49-3.64 8.13-8.13 8.13h-.81l-4.043 3.24c-.53.42-1.302.05-1.302-.59V17.2c-3.237-.9-5.215-3.95-5.215-7.2zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 2.59 1.72 4.89 4.215 5.65v2.34l2.93-2.35h2.18c3.317 0 6.005-2.69 6.005-6s-2.688-6-6.005-6H9.756z"/></svg>'
    );
  }

  function iconRepost() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>'
    );
  }

  function iconLike() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.435 2.78.65 4.34 1.826 2.62 5.63 5.44 6.54 6.09.14.1.33.1.47 0 .91-.65 4.71-3.47 6.54-6.09 1.085-1.56 1.202-3.22.65-4.34-.561-1.13-1.667-1.84-2.91-1.91zm-.825 11.68c-1.12.79-2.61 1.92-3.872 2.93-1.262-1.01-2.752-2.14-3.872-2.93C5.04 14.86 2.5 12.1 2.5 9.06c0-2.48 1.51-4.56 4.25-4.71 1.4-.07 2.88.58 4.01 2.01L12 8.12l1.24-1.76c1.13-1.43 2.61-2.08 4.01-2.01 2.74.15 4.25 2.23 4.25 4.71 0 3.04-2.54 5.8-5.628 8.12z"/></svg>'
    );
  }

  function iconViews() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>'
    );
  }

  function iconShare() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/></svg>'
    );
  }

  function verifiedBadge() {
    return (
      '<span class="tq-tw__verified" title="已认证" aria-label="已认证">' +
      '<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M20.396 11c-.018-.446-.074-.884-.21-1.304l2.038-1.59a.5.5 0 0 0 .13-.64l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 15 1H9a.5.5 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.59.22L1.63 7.24a.5.5 0 0 0 .13.64l2.038 1.59c-.136.42-.192.858-.21 1.304s.074.884.21 1.304l-2.038 1.59a.5.5 0 0 0-.13.64l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.24.41.48.41h6c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.22.09.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.13-.64l-2.038-1.59c.136-.42.192-.858.21-1.304zM9.57 15.5L6.05 12l1.41-1.41 2.11 2.11 5.66-5.66L16.7 8.45l-7.13 7.05z" fill="currentColor"/></svg>' +
      '</span>'
    );
  }

  function findTweet(id) {
    for (var i = 0; i < (store.tweets || []).length; i++) {
      if (store.tweets[i] && store.tweets[i].id === id) return store.tweets[i];
    }
    return null;
  }

  function findTrend(id) {
    var list = store && store.trends ? store.trends : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function commentHtml(c) {
    return (
      '<article class="tq-tw__comment">' +
      '<div class="tq-tw__avatar tq-tw__avatar--sm"><img src="' +
      esc(c.avatar) +
      '" alt="" /></div>' +
      '<div class="tq-tw__tweet-main">' +
      '<div class="tq-tw__tweet-head">' +
      '<span class="tq-tw__name">' +
      esc(c.name) +
      (c.verified ? verifiedBadge() : '') +
      '</span>' +
      '<span class="tq-tw__handle">@' +
      esc(c.handle) +
      '</span>' +
      '<span class="tq-tw__dot">·</span>' +
      '<span class="tq-tw__time">' +
      esc(c.time) +
      '</span></div>' +
      '<p class="tq-tw__text">' +
      esc(c.text) +
      '</p>' +
      '<div class="tq-tw__actions tq-tw__actions--compact">' +
      '<button type="button" class="tq-tw__act" data-act="c-reply" title="回复">' +
      iconReply() +
      '</button>' +
      '<button type="button" class="tq-tw__act is-like" data-act="c-like" title="喜欢">' +
      iconLike() +
      '<span>' +
      formatCount(c.likes) +
      '</span></button></div></div></article>'
    );
  }

  function tweetHtml(t) {
    return (
      '<article class="tq-tw__tweet" data-tweet-id="' +
      esc(t.id) +
      '" role="button" tabindex="0">' +
      '<div class="tq-tw__avatar"><img src="' +
      esc(t.avatar) +
      '" alt="" /></div>' +
      '<div class="tq-tw__tweet-main">' +
      '<div class="tq-tw__tweet-head">' +
      '<span class="tq-tw__name">' +
      esc(t.name) +
      (t.verified ? verifiedBadge() : '') +
      '</span>' +
      '<span class="tq-tw__handle">@' +
      esc(t.handle) +
      '</span>' +
      '<span class="tq-tw__dot">·</span>' +
      '<span class="tq-tw__time">' +
      esc(t.time) +
      '</span></div>' +
      '<p class="tq-tw__text">' +
      esc(t.text) +
      '</p>' +
      '<div class="tq-tw__actions" aria-label="互动">' +
      '<button type="button" class="tq-tw__act" data-act="reply" title="回复">' +
      iconReply() +
      '<span>' +
      formatCount(t.replies) +
      '</span></button>' +
      '<button type="button" class="tq-tw__act is-repost" data-act="repost" title="转推">' +
      iconRepost() +
      '<span>' +
      formatCount(t.reposts) +
      '</span></button>' +
      '<button type="button" class="tq-tw__act is-like" data-act="like" title="喜欢">' +
      iconLike() +
      '<span>' +
      formatCount(t.likes) +
      '</span></button>' +
      '<button type="button" class="tq-tw__act" data-act="views" title="查看">' +
      iconViews() +
      '<span>' +
      esc(t.views || formatCount(t.likes * 8)) +
      '</span></button>' +
      '<button type="button" class="tq-tw__act" data-act="share" title="分享">' +
      iconShare() +
      '</button></div></div></article>'
    );
  }

  function trendHtml(tr, index) {
    var busy = busyTrendId && tr.id === busyTrendId;
    return (
      '<button type="button" class="tq-tw__trend' +
      (busy ? ' is-busy' : '') +
      '" data-trend-id="' +
      esc(tr.id) +
      '"' +
      (busyTrendId ? ' disabled' : '') +
      '>' +
      '<div class="tq-tw__trend-meta">' +
      '<span class="tq-tw__trend-cat">' +
      esc(index + 1) +
      ' · ' +
      esc(tr.category) +
      '</span></div>' +
      '<div class="tq-tw__trend-topic">' +
      esc(tr.topic) +
      '</div>' +
      '<div class="tq-tw__trend-count">' +
      esc(tr.count) +
      '</div></button>'
    );
  }

  function renderTweets() {
    var list = document.getElementById('tq-tw-tweet-list');
    if (!list) return;
    var tweets = store.tweets || [];
    var loading = busyTrendId
      ? '<p class="tq-tw__loading">正在加载相关推文</p>'
      : '';
    if (!tweets.length) {
      list.innerHTML = loading || '<p class="tq-tw__empty">还没有推文。</p>';
      return;
    }
    list.innerHTML = loading + tweets.map(tweetHtml).join('');
  }

  function renderTrends() {
    var list = document.getElementById('tq-tw-trend-list');
    if (!list) return;
    ensureTrendDeltas(store);
    store.trends = rebuildTrendsFromDeltas(
      store.trendDeltas,
      getCurrentMainAsstIndex(),
      store.trendDecayEvents,
    );
    saveStore(store);
    var trends = store.trends;
    if (!trends.length) {
      list.innerHTML = '<p class="tq-tw__empty">暂无趋势。</p>';
      return;
    }
    list.innerHTML =
      '<div class="tq-tw__trends-banner">' +
      '<div class="tq-tw__trends-title">你的趋势</div>' +
      '<div class="tq-tw__trends-sub">根据你的位置与关注生成</div></div>' +
      trends.map(trendHtml).join('');
    if (busyTrendId) list.classList.add('is-busy');
    else list.classList.remove('is-busy');
  }

  function setTab(tab) {
    view = tab === 'trends' ? 'trends' : 'tweets';
    store.activeTab = view;
    saveStore(store);
    var sheet = document.querySelector('.tq-tw-sheet[data-app-sheet="twitter"]');
    var root = sheet ? sheet.querySelector('.tq-tw') : document.querySelector('.tq-tw');
    if (root) {
      root.classList.toggle('is-tab-tweets', view === 'tweets');
      root.classList.toggle('is-tab-trends', view === 'trends');
      root.classList.toggle('is-brand-x', isYoung());
    }
    var scope = sheet || document;
    scope.querySelectorAll('.tq-tw__tab').forEach(function (btn) {
      var on = btn.getAttribute('data-tw-tab') === view;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    scope.querySelectorAll('.tq-tw__pane').forEach(function (pane) {
      var on = pane.getAttribute('data-tw-pane') === view;
      pane.classList.toggle('is-on', on);
      if (on) pane.removeAttribute('hidden');
      else pane.setAttribute('hidden', '');
    });
    if (view === 'trends') renderTrends();
    else {
      renderTweets();
      var sheetOpen = document.querySelector('.tq-tw-sheet.is-open');
      if (sheetOpen) markAllTweetsRead();
    }
  }

  function syncTitle() {
    var title = document.getElementById('tq-tw-title');
    if (title) title.textContent = brandName();
    var root = document.querySelector('.tq-tw');
    if (root) root.classList.toggle('is-brand-x', isYoung());
  }

  function sheetHtml() {
    return (
      '<div class="tq-phone__layer tq-phone__sheet tq-tw-sheet" data-app-sheet="twitter" aria-hidden="true">' +
      '<div class="tq-tw' +
      (isYoung() ? ' is-brand-x' : '') +
      ' is-tab-tweets">' +
      '<div class="tq-tw__main">' +
      '<div class="tq-tw__top">' +
      '<div class="tq-tw__nav">' +
      '<button type="button" class="tq-tw__back" data-phone-back aria-label="返回主屏幕">‹</button>' +
      '<span class="tq-tw__brand" id="tq-tw-title">' +
      esc(brandName()) +
      '</span>' +
      '<button type="button" class="tq-tw__refresh" id="tq-tw-refresh" title="刷新推文" aria-label="刷新推文">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>' +
      '</button></div>' +
      '<div class="tq-tw__tabs" role="tablist" aria-label="Twitter 子页面">' +
      '<button type="button" class="tq-tw__tab is-on" role="tab" data-tw-tab="tweets" aria-selected="true">推文</button>' +
      '<button type="button" class="tq-tw__tab" role="tab" data-tw-tab="trends" aria-selected="false">趋势</button></div></div>' +
      '<div class="tq-tw__body">' +
      '<div class="tq-tw__pane is-on" data-tw-pane="tweets" role="tabpanel">' +
      '<div class="tq-tw__compose-hint">首页 · For you</div>' +
      '<div class="tq-tw__tweet-list" id="tq-tw-tweet-list"></div></div>' +
      '<div class="tq-tw__pane" data-tw-pane="trends" role="tabpanel" hidden>' +
      '<div class="tq-tw__trend-list" id="tq-tw-trend-list"></div></div></div></div>' +
      '<div class="tq-tw__detail" id="tq-tw-detail" hidden>' +
      '<div class="tq-tw__detail-top">' +
      '<button type="button" class="tq-tw__back" data-tw-detail-back aria-label="返回">‹</button>' +
      '<span class="tq-tw__detail-title">帖子</span>' +
      '<span class="tq-tw__detail-spacer"></span></div>' +
      '<div class="tq-tw__detail-scroll" id="tq-tw-detail-scroll"></div>' +
      '<div class="tq-tw__composer">' +
      '<div class="tq-tw__avatar tq-tw__avatar--sm"><img id="tq-tw-composer-av" src="' +
      esc(avatarSvg('制', '#1d9bf0')) +
      '" alt="" /></div>' +
      '<input type="text" class="tq-tw__composer-input" id="tq-tw-composer-input" maxlength="280" placeholder="发布你的回复" autocomplete="off" />' +
      '<button type="button" class="tq-tw__composer-send" id="tq-tw-composer-send">回复</button></div></div></div></div>'
    );
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
      return;
    }
    console.info('[Twitter]', msg);
  }

  function setDetailOpen(on) {
    detailOpen = !!on;
    var root = document.querySelector('.tq-tw-sheet .tq-tw');
    var detail = document.getElementById('tq-tw-detail');
    if (root) root.classList.toggle('is-detail', detailOpen);
    if (detail) {
      if (detailOpen) detail.removeAttribute('hidden');
      else detail.setAttribute('hidden', '');
    }
  }

  function renderDetail() {
    var scroll = document.getElementById('tq-tw-detail-scroll');
    if (!scroll) return;
    var t = findTweet(activeTweetId);
    if (!t) {
      scroll.innerHTML = '<p class="tq-tw__empty">帖子不存在</p>';
      return;
    }
    var comments = Array.isArray(t.comments) ? t.comments : [];
    scroll.innerHTML =
      '<article class="tq-tw__tweet tq-tw__tweet--detail" data-tweet-id="' +
      esc(t.id) +
      '">' +
      '<div class="tq-tw__tweet-head tq-tw__tweet-head--detail">' +
      '<div class="tq-tw__avatar"><img src="' +
      esc(t.avatar) +
      '" alt="" /></div>' +
      '<div class="tq-tw__detail-who">' +
      '<span class="tq-tw__name">' +
      esc(t.name) +
      (t.verified ? verifiedBadge() : '') +
      '</span>' +
      '<span class="tq-tw__handle">@' +
      esc(t.handle) +
      '</span></div></div>' +
      '<p class="tq-tw__text tq-tw__text--lg">' +
      esc(t.text) +
      '</p>' +
      '<div class="tq-tw__detail-time">' +
      esc(t.timeFull || t.time) +
      ' · <strong>' +
      esc(t.views || formatCount(t.likes * 8)) +
      '</strong> 次查看</div>' +
      '<div class="tq-tw__detail-stats">' +
      '<span><strong>' +
      formatCount(t.reposts) +
      '</strong> 转推</span>' +
      '<span><strong>' +
      formatCount(t.likes) +
      '</strong> 喜欢</span>' +
      '<span><strong>' +
      formatCount(t.replies) +
      '</strong> 回复</span></div>' +
      '<div class="tq-tw__actions tq-tw__actions--detail" aria-label="互动">' +
      '<button type="button" class="tq-tw__act" data-act="reply" title="回复">' +
      iconReply() +
      '</button>' +
      '<button type="button" class="tq-tw__act is-repost" data-act="repost" title="转推">' +
      iconRepost() +
      '</button>' +
      '<button type="button" class="tq-tw__act is-like" data-act="like" title="喜欢">' +
      iconLike() +
      '</button>' +
      '<button type="button" class="tq-tw__act" data-act="share" title="分享">' +
      iconShare() +
      '</button></div></article>' +
      '<div class="tq-tw__comments-label">回复</div>' +
      (comments.length
        ? comments.map(commentHtml).join('')
        : '<p class="tq-tw__empty tq-tw__empty--sm">还没有回复，来抢沙发吧。</p>');
  }

  function openTweet(id, focusComposer) {
    if (!id || !findTweet(id)) return;
    activeTweetId = id;
    setDetailOpen(true);
    renderDetail();
    var input = document.getElementById('tq-tw-composer-input');
    var av = document.getElementById('tq-tw-composer-av');
    if (av) av.src = avatarSvg(producerName().charAt(0) || '制', '#1d9bf0');
    if (input) {
      input.value = '';
      input.placeholder = '回复 @' + (findTweet(id).handle || '');
      if (focusComposer) {
        setTimeout(function () {
          input.focus({ preventScroll: true });
        }, 50);
      }
    }
    var scroll = document.getElementById('tq-tw-detail-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function closeTweet() {
    activeTweetId = '';
    setDetailOpen(false);
    renderTweets();
  }

  function sendComment() {
    var t = findTweet(activeTweetId);
    var input = document.getElementById('tq-tw-composer-input');
    if (!t || !input) return;
    var text = String(input.value || '').trim();
    if (!text) return;
    if (!Array.isArray(t.comments)) t.comments = [];
    t.comments.push({
      id: 'c_' + Date.now(),
      name: producerName(),
      handle: 'producer',
      avatar: avatarSvg(producerName().charAt(0) || '制', '#1d9bf0'),
      text: text,
      time: '刚刚',
      likes: 0,
    });
    t.replies = (Number(t.replies) || 0) + 1;
    saveStore(store);
    input.value = '';
    renderDetail();
    var scroll = document.getElementById('tq-tw-detail-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  function bumpEngage(btn, field) {
    var card = btn.closest('[data-tweet-id]');
    if (!card) return;
    var id = card.getAttribute('data-tweet-id');
    var t = findTweet(id);
    if (!t) return;
    if (btn.classList.contains('is-on')) {
      btn.classList.remove('is-on');
      t[field] = Math.max(0, (Number(t[field]) || 0) - 1);
    } else {
      btn.classList.add('is-on');
      t[field] = (Number(t[field]) || 0) + 1;
    }
    saveStore(store);
    var span = btn.querySelector('span');
    if (span) span.textContent = formatCount(t[field]);
    if (detailOpen && id === activeTweetId) renderDetail();
  }

  function setRefreshBusy(on) {
    var btn = document.getElementById('tq-tw-refresh');
    if (!btn) return;
    btn.classList.toggle('is-busy', !!on);
    btn.disabled = !!on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function setTrendBusy(on, trendId) {
    busyTrendId = on ? String(trendId || '') : '';
    setRefreshBusy(on);
    var list = document.getElementById('tq-tw-trend-list');
    if (list) {
      list.classList.toggle('is-busy', !!on);
      list.querySelectorAll('.tq-tw__trend').forEach(function (btn) {
        var match = busyTrendId && btn.getAttribute('data-trend-id') === busyTrendId;
        btn.classList.toggle('is-busy', !!match);
        btn.disabled = !!on;
      });
    }
  }

  /** 点击趋势：生成相关推文，不更新热搜 */
  async function openTrend(id) {
    if (!id || busyTrendId) return;
    store = loadStore();
    ensureTrendDeltas(store);
    store.trends = rebuildTrendsFromDeltas(
      store.trendDeltas,
      getCurrentMainAsstIndex(),
      store.trendDecayEvents,
    );
    var tr = findTrend(id);
    if (!tr || !tr.topic) return;
    var gen = window.天青_phone_twitter_generate;
    if (!gen || typeof gen.generateFromTrend !== 'function') {
      toast('Twitter 更新模块未就绪');
      return;
    }
    if (typeof gen.isGenerating === 'function' && gen.isGenerating()) {
      toast('Twitter 正在更新中…');
      return;
    }
    setTrendBusy(true, id);
    setTab('tweets');
    try {
      var result = await gen.generateFromTrend(tr);
      store = loadStore();
      renderTweets();
      renderTrends();
      if (result && result.tweets && result.tweets.length) setTab('tweets');
    } catch (err) {
      console.error('[Twitter] 趋势贴文生成失败', err);
      toast('Twitter 生成失败');
    } finally {
      setTrendBusy(false);
    }
  }

  /** 右上角刷新：调用 LLM 生成新推文 / 热搜 */
  async function refreshFeed() {
    if (detailOpen) closeTweet();
    var gen = window.天青_phone_twitter_generate;
    if (!gen || typeof gen.generateManualRefresh !== 'function') {
      toast('Twitter 更新模块未就绪');
      return;
    }
    if (typeof gen.isGenerating === 'function' && gen.isGenerating()) {
      toast('Twitter 正在更新中…');
      return;
    }
    setRefreshBusy(true);
    try {
      if (typeof decayTrendsForTwitterRefresh === 'function') {
        decayTrendsForTwitterRefresh();
      }
      await gen.generateManualRefresh();
      store = loadStore();
      renderTweets();
      renderTrends();
    } catch (err) {
      console.error('[Twitter] 手动刷新失败', err);
      toast('Twitter 刷新失败');
    } finally {
      setRefreshBusy(false);
    }
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

  function trimToMainMsgIndex(maxIdx) {
    applyEpoch += 1;
    maxIdx = typeof maxIdx === 'number' ? maxIdx : -1;
    store = loadStore();
    ensureReadMeta(store);
    ensureTrendDeltas(store);
    var tweetsBefore = (store.tweets || []).length;
    var deltasBefore = (store.trendDeltas || []).length;
    var decaysBefore = (store.trendDecayEvents || []).length;
    store.tweets = (store.tweets || []).filter(function (t) {
      var idx = t && typeof t.mainMsgIndex === 'number' ? t.mainMsgIndex : 0;
      return idx <= maxIdx;
    });
    store.trendDeltas = (store.trendDeltas || []).filter(function (d) {
      return trendBelongsToMain(d, maxIdx);
    });
    store.trendDecayEvents = (store.trendDecayEvents || []).filter(function (ev) {
      return decayEventBelongs(ev, maxIdx);
    });
    store.trends = rebuildTrendsFromDeltas(store.trendDeltas, maxIdx, store.trendDecayEvents);
    var keep = {};
    (store.tweets || []).forEach(function (t) {
      if (t && t.id && store.readIds[t.id]) keep[t.id] = true;
    });
    store.readIds = keep;
    if (activeTweetId && !(store.tweets || []).some(function (t) { return t && t.id === activeTweetId; })) {
      closeTweet();
    }
    var changed =
      store.tweets.length !== tweetsBefore ||
      store.trendDeltas.length !== deltasBefore ||
      (store.trendDecayEvents || []).length !== decaysBefore;
    if (changed) {
      saveStore(store);
      if (document.querySelector('.tq-tw-sheet .tq-tw')) {
        renderTweets();
        renderTrends();
        if (detailOpen && activeTweetId) renderDetail();
      }
      refreshBadges();
      return true;
    }
    refreshBadges();
    return false;
  }

  function prependTweets(tweets, bindIndex) {
    if (!tweets || !tweets.length) return;
    var bind = typeof bindIndex === 'number' ? bindIndex : getCurrentMainAsstIndex();
    store = loadStore();
    ensureReadMeta(store);
    var stamped = tweets.map(function (t) {
      var copy = Object.assign({}, t);
      if (typeof copy.mainMsgIndex !== 'number') copy.mainMsgIndex = bind;
      return copy;
    });
    store.tweets = stamped.concat(store.tweets || []);
    store.v = STORE_VER;
    /* 正在看推文时间线时直接标已读，否则计入未读 */
    if (isTwitterFeedVisible()) {
      stamped.forEach(function (t) {
        if (t && t.id) store.readIds[t.id] = true;
      });
    }
    saveStore(store);
    if (document.querySelector('.tq-tw-sheet .tq-tw')) {
      renderTweets();
      if (detailOpen && activeTweetId) renderDetail();
    }
    refreshBadges();
  }

  /**
   * 合并钩子 / 手动刷新的趋势增量（挂靠 mainMsgIndex，回退时可裁剪）
   */
  function mergeTrends(incoming, bindIndex) {
    if (!incoming || !incoming.length) return;
    store = loadStore();
    ensureTrendDeltas(store);
    var bind = typeof bindIndex === 'number' ? bindIndex : getCurrentMainAsstIndex();
    if (!Array.isArray(store.trendDeltas)) store.trendDeltas = [];
    incoming.forEach(function (item) {
      if (!item || !item.topic) return;
      store.trendDeltas.push(
        ensureTrendFields(
          Object.assign({}, item, {
            id: item.id || 'tr_delta_' + Date.now() + '_' + store.trendDeltas.length,
            topic: String(item.topic).trim(),
            category: item.category || '热搜 · 趋势',
            countWan: Number(item.countWan) || 0,
            mainMsgIndex: bind,
          }),
        ),
      );
    });
    store.trends = rebuildTrendsFromDeltas(
      store.trendDeltas,
      getCurrentMainAsstIndex(),
      store.trendDecayEvents,
    );
    store.v = STORE_VER;
    saveStore(store);
    if (document.querySelector('.tq-tw-sheet .tq-tw')) {
      renderTrends();
    }
  }

  function onOpen() {
    bind();
    store = loadStore();
    syncTitle();
    closeTweet();
    setTab(store.activeTab || 'tweets');
    renderTweets();
    renderTrends();
    if (view === 'tweets') markAllTweetsRead();
    else refreshBadges();
  }

  function onBack() {
    if (detailOpen) {
      closeTweet();
      return true;
    }
    return false;
  }

  function bind() {
    var root = document.getElementById('tq-phone');
    if (!root) return;
    if (root.dataset.twBound === '1') return;
    root.dataset.twBound = '1';
    root.addEventListener('click', function (e) {
      var detailBack = e.target.closest('[data-tw-detail-back]');
      if (detailBack && root.contains(detailBack)) {
        e.preventDefault();
        e.stopPropagation();
        closeTweet();
        return;
      }
      var tab = e.target.closest('[data-tw-tab]');
      if (tab && root.contains(tab)) {
        e.preventDefault();
        e.stopPropagation();
        if (detailOpen) closeTweet();
        setTab(tab.getAttribute('data-tw-tab') || 'tweets');
        return;
      }
      var refresh = e.target.closest('#tq-tw-refresh');
      if (refresh && root.contains(refresh)) {
        e.preventDefault();
        e.stopPropagation();
        if (refresh.disabled || refresh.classList.contains('is-busy')) return;
        refreshFeed();
        return;
      }
      var trendBtn = e.target.closest('.tq-tw__trend[data-trend-id]');
      if (trendBtn && root.contains(trendBtn)) {
        e.preventDefault();
        e.stopPropagation();
        if (trendBtn.disabled || busyTrendId) return;
        openTrend(trendBtn.getAttribute('data-trend-id') || '');
        return;
      }
      var sendBtn = e.target.closest('#tq-tw-composer-send');
      if (sendBtn && root.contains(sendBtn)) {
        e.preventDefault();
        e.stopPropagation();
        sendComment();
        return;
      }
      var act = e.target.closest('.tq-tw__act[data-act]');
      if (act && root.contains(act)) {
        e.preventDefault();
        e.stopPropagation();
        var kind = act.getAttribute('data-act');
        var tweetCard = act.closest('[data-tweet-id]');
        var tid = tweetCard ? tweetCard.getAttribute('data-tweet-id') : '';
        if (kind === 'like') bumpEngage(act, 'likes');
        else if (kind === 'repost') bumpEngage(act, 'reposts');
        else if (kind === 'reply' || kind === 'views') {
          if (tid) openTweet(tid, kind === 'reply');
        } else if (kind === 'c-like') {
          act.classList.toggle('is-on');
        } else if (kind === 'c-reply') {
          var ci = document.getElementById('tq-tw-composer-input');
          if (ci) ci.focus({ preventScroll: true });
        }
        return;
      }
      var tweet = e.target.closest('.tq-tw__tweet[data-tweet-id]');
      if (tweet && root.contains(tweet) && !tweet.classList.contains('tq-tw__tweet--detail')) {
        e.preventDefault();
        e.stopPropagation();
        openTweet(tweet.getAttribute('data-tweet-id') || '', false);
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target && e.target.id === 'tq-tw-composer-input') {
        e.preventDefault();
        sendComment();
        return;
      }
      var tweet = e.target.closest && e.target.closest('.tq-tw__tweet[data-tweet-id]');
      if (tweet && !tweet.classList.contains('tq-tw__tweet--detail')) {
        e.preventDefault();
        openTweet(tweet.getAttribute('data-tweet-id') || '', false);
      }
    });
  }

  function resetToInitial() {
    store = defaultStore();
    saveStore(store);
    activeTweetId = '';
    detailOpen = false;
    if (document.querySelector('.tq-tw')) {
      syncTitle();
      setDetailOpen(false);
      setTab('tweets');
      renderTweets();
      renderTrends();
    }
    refreshBadges();
  }

  /** 给 LINE / 钩子用：前 8 热搜 + 最近 10 条推文 */
  function formatContextForPrompt() {
    store = loadStore();
    ensureTrendDeltas(store);
    store.trends = rebuildTrendsFromDeltas(
      store.trendDeltas,
      getCurrentMainAsstIndex(),
      store.trendDecayEvents,
    );
    var lines = [];
    var trends = (store.trends || []).slice(0, TREND_MAX);
    if (trends.length) {
      lines.push('热搜：');
      trends.forEach(function (tr, i) {
        if (!tr) return;
        lines.push(
          i + 1 + '. ' + String(tr.topic || '') + (tr.count ? '（' + tr.count + '）' : ''),
        );
      });
    }
    var tweets = (store.tweets || []).slice(0, 10);
    if (tweets.length) {
      if (lines.length) lines.push('');
      lines.push('最近推文：');
      tweets.forEach(function (t, i) {
        if (!t) return;
        var who = (t.name || '') + (t.handle ? ' @' + t.handle : '');
        var body = String(t.text || '').replace(/\s+/g, ' ').trim();
        lines.push(i + 1 + '. ' + who + '：' + body);
      });
    }
    return lines.join('\n');
  }

  window.天青_phone_twitter = {
    sheetHtml: sheetHtml,
    onOpen: onOpen,
    onBack: onBack,
    bind: bind,
    resetToInitial: resetToInitial,
    loadStore: loadStore,
    saveStore: saveStore,
    prependTweets: prependTweets,
    mergeTrends: mergeTrends,
    decayTrends: decayTrends,
    decayTrendsForMainLine: decayTrendsForMainLine,
    decayTrendsForTwitterRefresh: decayTrendsForTwitterRefresh,
    trimToMainMsgIndex: trimToMainMsgIndex,
    getCurrentMainAsstIndex: getCurrentMainAsstIndex,
    getUnreadCount: getUnreadCount,
    refreshBadges: refreshBadges,
    markAllTweetsRead: markAllTweetsRead,
    formatContextForPrompt: formatContextForPrompt,
  };
})();
