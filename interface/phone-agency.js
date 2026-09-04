/**
 * 事务所 App · 名气数据仪表盘（读 stat_data，不调用 LLM）
 * 对外：window.天青_phone_agency
 */
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readPath(path) {
    var api = window.天青_stat_data;
    if (api && typeof api.getByPath === 'function') return api.getByPath(path);
    return undefined;
  }

  function fmtNum(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return '—';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return Number(n).toLocaleString('en-US');
  }

  function snsLabel() {
    var apps = window.天青_phone_apps;
    if (apps && typeof apps.getSeniority === 'function' && apps.getSeniority() === 'young') {
      return 'X 粉丝';
    }
    return 'Twitter 粉丝';
  }

  /** 旧 [场数, 人数] 或 [[地点, 人数], …] */
  function normalizeLiveList(raw) {
    if (!Array.isArray(raw)) {
      if (typeof raw === 'number' && !isNaN(raw) && raw > 0) return [['', 0]];
      return [];
    }
    if (
      raw.length === 2 &&
      !Array.isArray(raw[0]) &&
      typeof raw[0] === 'number' &&
      typeof raw[1] === 'number'
    ) {
      var audience = parseInt(raw[1], 10) || 0;
      return audience > 0 ? [['', audience]] : [];
    }
    var out = [];
    raw.forEach(function (item) {
      if (!Array.isArray(item) || item.length < 2) return;
      var place = String(item[0] == null ? '' : item[0]).trim();
      var count = parseInt(item[1], 10) || 0;
      if (!place && !count) return;
      out.push([place || '—', count]);
    });
    return out;
  }

  /** 旧 ["AOI", …] 或 [[名称, 销量], …] */
  function normalizeAlbumList(raw) {
    if (!Array.isArray(raw)) return [];
    if (raw.length && !Array.isArray(raw[0])) {
      return raw
        .map(function (name) {
          var n = String(name == null ? '' : name).trim();
          return n ? [n, 0] : null;
        })
        .filter(Boolean);
    }
    var out = [];
    raw.forEach(function (item) {
      if (!Array.isArray(item) || item.length < 2) return;
      var name = String(item[0] == null ? '' : item[0]).trim();
      var sales = parseInt(item[1], 10) || 0;
      if (!name) return;
      out.push([name, sales]);
    });
    return out;
  }

  function readAlbums() {
    return normalizeAlbumList(readPath('名气.专辑'));
  }

  function readLiveShows() {
    return normalizeLiveList(readPath('名气.Live'));
  }

  function heroCgUrl() {
    var map = window.天青_cg;
    if (map && map['朝user伸手']) return map['朝user伸手'];
    return '';
  }

  function renderHero() {
    var url = heroCgUrl();
    if (!url) {
      return (
        '<div class="tq-agency__hero tq-agency__hero--fallback">' +
        '<div class="tq-agency__hero-title">Larimar</div></div>'
      );
    }
    return (
      '<div class="tq-agency__hero">' +
      '<img class="tq-agency__hero-img" src="' +
      esc(url) +
      '" alt="天青" loading="lazy" decoding="async" />' +
      '<div class="tq-agency__hero-title">Larimar</div></div>'
    );
  }
  function sheetHtml() {
    return (
      '<div class="tq-phone__layer tq-phone__sheet tq-agency-sheet" data-app-sheet="agency" aria-hidden="true">' +
      '<div class="tq-agency" id="tq-agency">' +
      '<div class="tq-phone__sheet-head">' +
      '<button type="button" class="tq-phone__sheet-back" data-phone-back aria-label="返回主屏幕">‹</button>' +
      '<span class="tq-phone__sheet-title">HOOK</span></div>' +
      '<div class="tq-agency__body" id="tq-agency-body"></div></div></div>'
    );
  }

  function renderRecordList(items, kind) {
    var list = '<div class="tq-agency__records">';
    items.forEach(function (row, i) {
      var main = kind === 'album' ? '《' + esc(row[0]) + '》' : esc(row[0]);
      var sub = kind === 'album' ? esc(fmtNum(row[1])) : esc(fmtNum(row[1]));
      list +=
        '<div class="tq-agency__record">' +
        '<span class="tq-agency__record-idx">' +
        (i + 1) +
        '</span>' +
        '<div class="tq-agency__record-main">' +
        main +
        '</div>' +
        '<div class="tq-agency__record-sub">' +
        sub +
        '</div></div>';
    });
    list += '</div>';
    return list;
  }

  function renderAlbumsCard(albums) {
    if (!albums.length) return '';
    var head =
      '<div class="tq-agency__card-head">' +
      '<span class="tq-agency__label">作品</span>' +
      '<span class="tq-agency__badge">' +
      esc(albums.length + ' 张') +
      '</span></div>';
    return '<div class="tq-agency__card">' + head + renderRecordList(albums, 'album') + '</div>';
  }

  function renderLiveCard(shows) {
    if (!shows.length) return '';
    var head =
      '<div class="tq-agency__card-head">' +
      '<span class="tq-agency__label">Live</span>' +
      '<span class="tq-agency__badge">' +
      esc(shows.length + ' 场') +
      '</span></div>';
    return (
      '<div class="tq-agency__card tq-agency__card--live">' +
      head +
      renderRecordList(shows, 'live') +
      '</div>'
    );
  }

  function render() {
    var wrap = document.getElementById('tq-agency-body');
    if (!wrap) return;

    var twitter = readPath('名气.twitter');
    var tongjie = readPath('名气.同接');
    var albums = readAlbums();
    var shows = readLiveShows();

    wrap.innerHTML =
      renderHero() +
      '<div class="tq-agency__stats">' +
      '<div class="tq-agency__stat">' +
      '<div class="tq-agency__stat-k">' +
      esc(snsLabel()) +
      '</div>' +
      '<div class="tq-agency__stat-v">' +
      esc(fmtNum(twitter)) +
      '</div></div>' +
      '<div class="tq-agency__stat">' +
      '<div class="tq-agency__stat-k">直播同接</div>' +
      '<div class="tq-agency__stat-v">' +
      esc(fmtNum(tongjie)) +
      '</div></div></div>' +
      renderAlbumsCard(albums) +
      renderLiveCard(shows);
  }

  function onOpen() {
    render();
  }

  function onBack() {
    return false;
  }

  window.天青_phone_agency = {
    sheetHtml: sheetHtml,
    onOpen: onOpen,
    onBack: onBack,
    render: render,
    normalizeAlbumList: normalizeAlbumList,
    normalizeLiveList: normalizeLiveList,
  };
})();
