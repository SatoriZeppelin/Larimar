/**
 * 启动资源预加载：Cache API 检查完整性 → 补齐下载（不做立绘预热）
 * 对外：window.天青_asset_preload
 */
(function () {
  var CACHE_NAME = 'tq-plus-assets-v2';
  var MANIFEST_KEY = 'tq_plus_asset_manifest_v2';
  var CONCURRENCY = 5;

  function uniqueUrls(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (u) {
      u = String(u || '').trim();
      if (!u || seen[u]) return;
      seen[u] = true;
      out.push(u);
    });
    return out;
  }

  function urlsFromMap(map) {
    if (!map || typeof map !== 'object') return [];
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .filter(function (u) {
        return typeof u === 'string' && /^https?:\/\//i.test(u);
      });
  }

  /** 启动必载：立绘 + 背景 + 主菜单图（解决切换延迟） */
  function collectAssetUrls() {
    var urls = [];
    urls = urls.concat(urlsFromMap(window.天青_expressions));
    urls = urls.concat(urlsFromMap(window.天青_backgrounds));
    if (window.天青_system && window.天青_system.titleBackground) {
      urls.push(window.天青_system.titleBackground);
    }
    if (window.天青_system && window.天青_system.icon) {
      urls.push(window.天青_system.icon);
    }
    return uniqueUrls(urls);
  }

  function formatMb(bytes) {
    var n = Number(bytes) || 0;
    return (n / (1024 * 1024)).toFixed(1);
  }

  function supportsCache() {
    return typeof caches !== 'undefined' && !!caches.open;
  }

  function readManifest() {
    try {
      return JSON.parse(localStorage.getItem(MANIFEST_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function writeManifest(urls) {
    try {
      localStorage.setItem(
        MANIFEST_KEY,
        JSON.stringify({
          cache: CACHE_NAME,
          count: urls.length,
          urls: urls.slice(),
          updatedAt: Date.now(),
        }),
      );
    } catch (e) {}
  }

  async function openCache() {
    if (!supportsCache()) return null;
    try {
      return await caches.open(CACHE_NAME);
    } catch (e) {
      return null;
    }
  }

  async function cachedUrlSet(cache, urls) {
    var have = {};
    if (!cache) return have;
    await Promise.all(
      urls.map(async function (url) {
        try {
          var hit = await cache.match(url, { ignoreSearch: false });
          if (hit) have[url] = true;
        } catch (e) {}
      }),
    );
    return have;
  }

  function decodeImage(url) {
    return new Promise(function (resolve) {
      var settled = false;
      var img = new Image();
      var timer = setTimeout(function () {
        finish();
      }, 8000);

      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve();
      }

      img.decoding = 'async';
      img.onload = function () {
        if (img.decode) {
          img.decode().then(finish).catch(finish);
        } else finish();
      };
      img.onerror = finish;
      img.src = url;
      /* 缓存命中时往往同步 complete，不会再触发 onload → 会永远卡在「预热立绘」 */
      if (img.complete) finish();
    });
  }

  async function fetchIntoCache(cache, url) {
    var res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'default',
    });
    if (!res || !res.ok) {
      /* 部分图床无 CORS：退回 Image，仅写入浏览器 HTTP 缓存 */
      await decodeImage(url);
      return { ok: false, bytes: 0 };
    }
    var clone = res.clone();
    var len = parseInt(res.headers.get('content-length') || '0', 10) || 0;
    if (!len) {
      try {
        var buf = await res.arrayBuffer();
        len = buf.byteLength || 0;
        if (cache) {
          await cache.put(url, new Response(buf, { status: 200, headers: clone.headers }));
        }
        return { ok: true, bytes: len };
      } catch (e) {
        await decodeImage(url);
        return { ok: false, bytes: 0 };
      }
    }
    if (cache) {
      try {
        await cache.put(url, clone);
      } catch (e) {}
    }
    return { ok: true, bytes: len };
  }

  function mapPool(items, limit, worker) {
    var i = 0;
    var results = new Array(items.length);
    var n = Math.min(limit, items.length) || 1;
    return Promise.all(
      Array.from({ length: n }, function () {
        return (async function run() {
          while (i < items.length) {
            var idx = i++;
            results[idx] = await worker(items[idx], idx);
          }
        })();
      }),
    ).then(function () {
      return results;
    });
  }

  /**
   * @param {{ onProgress?: function }} opts
   * onProgress({ pct, loadedBytes, totalBytes, done, total, phase, label })
   */
  async function ensureAssets(opts) {
    opts = opts || {};
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
    var urls = collectAssetUrls();
    var total = urls.length;

    function emit(partial) {
      onProgress(
        Object.assign(
          {
            pct: 0,
            loadedBytes: 0,
            totalBytes: 0,
            done: 0,
            total: total,
            phase: 'check',
            label: '检查本地资源…',
          },
          partial,
        ),
      );
    }

    if (!total) {
      emit({ pct: 100, done: 0, total: 0, phase: 'done', label: '无需下载' });
      return { total: 0, missing: 0, cached: 0 };
    }

    emit({ pct: 0, phase: 'check', label: '检查本地资源…' });

    var cache = await openCache();
    var have = await cachedUrlSet(cache, urls);
    var missing = urls.filter(function (u) {
      return !have[u];
    });
    var cachedCount = total - missing.length;
    var manifest = readManifest();
    var manifestOk =
      manifest &&
      manifest.cache === CACHE_NAME &&
      Array.isArray(manifest.urls) &&
      manifest.count === total &&
      manifest.urls.length === total;

    /* 本地已齐：直接完成，不再预热立绘 */
    if (!missing.length && manifestOk) {
      emit({
        pct: 100,
        done: total,
        total: total,
        loadedBytes: total,
        totalBytes: total,
        phase: 'done',
        label: '加载完成',
      });
      return { total: total, missing: 0, cached: cachedCount };
    }

    var done = cachedCount;
    var loadedBytes = 0;
    var knownTotalBytes = 0;
    /* 文案用的体积估算（百分比本身按「已完成条目数 / 总条目数」） */
    var AVG_BYTES = 450 * 1024;

    function reportDownload() {
      var estTotal = total * AVG_BYTES;
      var estLoaded = done * AVG_BYTES;
      if (knownTotalBytes > 0) {
        estTotal = Math.max(knownTotalBytes, done * AVG_BYTES);
        estLoaded = loadedBytes + cachedCount * AVG_BYTES;
        if (estLoaded > estTotal) estLoaded = estTotal;
      }
      /* 百分比 = 已就绪条目 / 全部条目（含启动时已在缓存里的） */
      var pct = total ? Math.round((done / total) * 100) : 100;
      if (pct > 100) pct = 100;
      if (done < total && pct > 99) pct = 99;
      emit({
        pct: pct,
        done: done,
        total: total,
        loadedBytes: estLoaded,
        totalBytes: estTotal,
        phase: 'download',
        label: '资源下载中',
      });
    }

    reportDownload();

    await mapPool(missing, CONCURRENCY, async function (url) {
      try {
        var r = await fetchIntoCache(cache, url);
        if (r.bytes > 0) {
          loadedBytes += r.bytes;
          knownTotalBytes += r.bytes;
        }
      } catch (e) {
        try {
          await decodeImage(url);
        } catch (e2) {}
      }
      done += 1;
      reportDownload();
    });

    writeManifest(urls);
    emit({
      pct: 100,
      done: total,
      total: total,
      loadedBytes: loadedBytes || total * AVG_BYTES,
      totalBytes: knownTotalBytes || total * AVG_BYTES,
      phase: 'done',
      label: '加载完成',
    });
    return { total: total, missing: missing.length, cached: cachedCount };
  }

  function bindLoaderUi() {
    var root = document.getElementById('boot-loader');
    if (!root) return null;
    var pctEl = root.querySelector('.boot-loader-pct');
    var barEl = root.querySelector('.boot-loader-bar-fill');
    var statusEl = root.querySelector('.boot-loader-status');
    return {
      root: root,
      update: function (p) {
        var pct = Math.max(0, Math.min(100, Math.round(p.pct || 0)));
        if (pctEl) pctEl.textContent = pct + '%';
        if (barEl) barEl.style.width = pct + '%';
        if (statusEl) {
          if (p.phase === 'download' && (p.totalBytes || p.loadedBytes)) {
            statusEl.textContent =
              (p.label || '资源下载中') +
              ' ' +
              formatMb(p.loadedBytes) +
              '/' +
              formatMb(p.totalBytes) +
              ' MB';
          } else if (p.phase === 'download') {
            statusEl.textContent = (p.label || '资源下载中') + ' ' + (p.done || 0) + '/' + (p.total || 0);
          } else {
            statusEl.textContent = p.label || '';
          }
        }
      },
      hide: function () {
        root.classList.add('is-done');
        root.setAttribute('aria-hidden', 'true');
        root.setAttribute('inert', '');
        setTimeout(function () {
          root.setAttribute('hidden', '');
        }, 420);
      },
      show: function () {
        root.removeAttribute('hidden');
        root.removeAttribute('inert');
        root.setAttribute('aria-hidden', 'false');
        root.classList.remove('is-done');
      },
    };
  }

  async function runBootPreload() {
    var ui = bindLoaderUi();
    if (ui) ui.show();
    try {
      var result = await ensureAssets({
        onProgress: function (p) {
          if (ui) ui.update(p);
        },
      });
      console.info(
        '[SummerNight Plus] 资源预加载完成',
        'total=' + result.total,
        'missing=' + result.missing,
        'cached=' + result.cached,
      );
      return result;
    } catch (e) {
      console.warn('[SummerNight Plus] 资源预加载失败，继续进入', e);
      if (ui) {
        ui.update({ pct: 100, phase: 'done', label: '加载完成（部分资源稍后补齐）' });
      }
      return null;
    } finally {
      if (ui) ui.hide();
    }
  }

  window.天青_asset_preload = {
    collectAssetUrls: collectAssetUrls,
    ensureAssets: ensureAssets,
    runBootPreload: runBootPreload,
  };
})();
