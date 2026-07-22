/**
 * 系统设置 · API 页
 * 连接模式固定为自动判断（界面不展示）
 * 对外：window.天青_settings_api
 */
(function () {
  var keyTimer = null;
  var busy = false;
  var modelIds = [];

  function $(id) {
    return document.getElementById(id);
  }

  function api() {
    return window.天青_api;
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function modeLabel(m) {
    return { auto: '自动', direct: '直连', reverse: '反向代理' }[m] || m;
  }

  function normalizeCmp(u) {
    return String(u || '')
      .trim()
      .replace(/\/+$/, '');
  }

  function clampNum(n, min, max, fallback) {
    n = Number(n);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function fmt2(n) {
    return clampNum(n, -Infinity, Infinity, 0).toFixed(2);
  }

  function setRangePct(rangeEl) {
    if (!rangeEl) return;
    var min = parseFloat(rangeEl.min) || 0;
    var max = parseFloat(rangeEl.max) || 100;
    var val = parseFloat(rangeEl.value);
    if (!isFinite(val)) val = min;
    var pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    rangeEl.style.setProperty('--tq-pct', pct + '%');
  }

  function bindIntSlider(rangeId, numId, onChange) {
    var range = $(rangeId);
    var num = $(numId);
    if (!range || !num) return;
    function fromRange() {
      num.value = String(Math.round(Number(range.value) || 0));
      setRangePct(range);
      if (onChange) onChange();
    }
    function fromNum() {
      var v = Math.round(clampNum(num.value, range.min, range.max, Number(range.min) || 0));
      num.value = String(v);
      range.value = String(v);
      setRangePct(range);
      if (onChange) onChange();
    }
    range.addEventListener('input', fromRange);
    num.addEventListener('change', fromNum);
    num.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        fromNum();
        num.blur();
      }
    });
  }

  function bindFloatSlider(rangeId, numId, onChange) {
    var range = $(rangeId);
    var num = $(numId);
    if (!range || !num) return;
    function fromRange() {
      num.value = fmt2(range.value);
      setRangePct(range);
      if (onChange) onChange();
    }
    function fromNum() {
      var v = clampNum(num.value, range.min, range.max, Number(range.value) || 0);
      v = Math.round(v * 100) / 100;
      num.value = fmt2(v);
      range.value = String(v);
      setRangePct(range);
      if (onChange) onChange();
    }
    range.addEventListener('input', fromRange);
    num.addEventListener('change', fromNum);
    num.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        fromNum();
        num.blur();
      }
    });
  }

  function readDomConfig() {
    var cur = (api() && api().loadConfig()) || {};
    var baseUrl = (($('cfg-api-base') || {}).value || '').trim();
    var autoEl = $('cfg-api-auto-connect');
    var streamEl = $('cfg-api-stream');
    var streamDisplayEl = $('cfg-api-stream-display');
    var reasoning = $('cfg-api-reasoning');
    var cfg = Object.assign({}, cur, {
      mode: 'auto',
      baseUrl: baseUrl,
      apiKey: (($('cfg-api-key') || {}).value || '').trim(),
      model: (($('cfg-api-model') || {}).value || '').trim() || cur.model,
      autoConnect: !!(autoEl && autoEl.checked),
      stream: !!(streamEl && streamEl.checked),
      streamDisplay: !!(streamDisplayEl && streamDisplayEl.checked),
      contextLength: clampNum(($('cfg-api-context') || {}).value, 1024, 2000000, cur.contextLength || 200000),
      maxTokens: clampNum(($('cfg-api-max-tokens') || {}).value, 1, 2000000, cur.maxTokens || 4096),
      temperature: clampNum(($('cfg-api-temp') || {}).value, 0, 2, cur.temperature != null ? cur.temperature : 0.9),
      frequencyPenalty: clampNum(($('cfg-api-freq') || {}).value, -2, 2, cur.frequencyPenalty || 0),
      presencePenalty: clampNum(($('cfg-api-pres') || {}).value, -2, 2, cur.presencePenalty || 0),
      topP: clampNum(($('cfg-api-top-p') || {}).value, 0, 1, cur.topP != null ? cur.topP : 1),
      reasoningEffort: (reasoning && reasoning.value) || cur.reasoningEffort || 'xhigh',
    });
    if (normalizeCmp(cur.baseUrl) !== normalizeCmp(baseUrl)) {
      cfg.chatPath = '';
      cfg.modelsPath = '';
      cfg.resolvedMode = '';
    }
    if (api() && api().normalizeConfig) cfg = api().normalizeConfig(cfg);
    cfg.mode = 'auto';
    return cfg;
  }

  function saveFromDom() {
    if (!api()) return null;
    var cfg = readDomConfig();
    api().saveConfig(cfg);
    return cfg;
  }

  function fillDom() {
    if (!api()) return;
    var cfg = api().normalizeConfig ? api().normalizeConfig(api().loadConfig()) : api().loadConfig();
    var base = $('cfg-api-base');
    var key = $('cfg-api-key');
    var model = $('cfg-api-model');
    var auto = $('cfg-api-auto-connect');
    var stream = $('cfg-api-stream');
    var streamDisplay = $('cfg-api-stream-display');
    var maxTok = $('cfg-api-max-tokens');
    var reasoning = $('cfg-api-reasoning');
    if (base) base.value = cfg.baseUrl || '';
    if (key) key.value = cfg.apiKey || '';
    if (model) model.value = cfg.model || '';
    if (auto) auto.checked = !!cfg.autoConnect;
    if (stream) stream.checked = !!cfg.stream;
    if (streamDisplay) streamDisplay.checked = cfg.streamDisplay !== false;
    if (maxTok) maxTok.value = String(cfg.maxTokens != null ? cfg.maxTokens : 4096);
    if (reasoning) reasoning.value = cfg.reasoningEffort || 'xhigh';

    var pairs = [
      ['cfg-api-context', 'cfg-api-context-num', cfg.contextLength, false],
      ['cfg-api-temp', 'cfg-api-temp-num', cfg.temperature, true],
      ['cfg-api-freq', 'cfg-api-freq-num', cfg.frequencyPenalty, true],
      ['cfg-api-pres', 'cfg-api-pres-num', cfg.presencePenalty, true],
      ['cfg-api-top-p', 'cfg-api-top-p-num', cfg.topP, true],
    ];
    pairs.forEach(function (row) {
      var r = $(row[0]);
      var n = $(row[1]);
      var v = row[2];
      if (r) {
        r.value = String(v);
        setRangePct(r);
      }
      if (n) n.value = row[3] ? fmt2(v) : String(Math.round(Number(v) || 0));
    });

    if (cfg.model) ensureModelOption(cfg.model);
    renderModelMenu({ showAll: true });
  }

  function ensureModelOption(id) {
    if (!id) return;
    if (modelIds.indexOf(id) < 0) modelIds.push(id);
  }

  function matchedModels(query, showAll) {
    var q = String(query || '')
      .trim()
      .toLowerCase();
    if (showAll || !q) return modelIds.slice();
    return modelIds.filter(function (id) {
      return String(id).toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderModelMenu(opts) {
    var menu = $('cfg-api-model-menu');
    var input = $('cfg-api-model');
    if (!menu) return;
    opts = opts || {};
    var current = (input && input.value) || '';
    var list = matchedModels(opts.query != null ? opts.query : current, !!opts.showAll);
    menu.innerHTML = '';
    if (!modelIds.length) {
      var empty = document.createElement('li');
      empty.className = 'tq-model-empty';
      empty.textContent = '请先连接以加载模型';
      menu.appendChild(empty);
      return;
    }
    if (!list.length) {
      var none = document.createElement('li');
      none.className = 'tq-model-empty';
      none.textContent = '无匹配模型';
      menu.appendChild(none);
      return;
    }
    list.forEach(function (id) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.value = id;
      li.textContent = id;
      if (id === current) li.classList.add('is-active');
      menu.appendChild(li);
    });
  }

  function fillModels(ids, preferred) {
    var input = $('cfg-api-model');
    var keep = preferred || (input && input.value) || (api() && api().loadConfig().model) || '';
    modelIds = (ids || []).slice();
    if (keep && modelIds.indexOf(keep) < 0) modelIds.unshift(keep);
    if (input) {
      if (keep) input.value = keep;
      else if (modelIds[0]) input.value = modelIds[0];
    }
    renderModelMenu({ showAll: true });
    saveFromDom();
  }

  function closeModelMenu() {
    var wrap = $('cfg-api-model-wrap');
    var menu = $('cfg-api-model-menu');
    var btn = $('btn-api-model-menu');
    if (wrap) wrap.classList.remove('is-open');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openModelMenu(opts) {
    var wrap = $('cfg-api-model-wrap');
    var menu = $('cfg-api-model-menu');
    var btn = $('btn-api-model-menu');
    renderModelMenu(opts);
    if (wrap) wrap.classList.add('is-open');
    if (menu) menu.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function toggleModelMenu() {
    var menu = $('cfg-api-model-menu');
    if (menu && !menu.hidden) closeModelMenu();
    else openModelMenu({ showAll: true });
  }

  function suggestModelsFromInput() {
    if (!modelIds.length) {
      openModelMenu({ showAll: true });
      return;
    }
    openModelMenu({ showAll: false });
  }

  function selectModel(id) {
    var input = $('cfg-api-model');
    if (!input || !id) return;
    input.value = id;
    ensureModelOption(id);
    saveFromDom();
    closeModelMenu();
    renderModelMenu({ showAll: true });
  }

  function setStatus(ok, text) {
    var wrap = $('api-status');
    var icon = $('api-status-icon');
    var label = $('api-status-text');
    var svg = window.天青_svg;
    if (wrap) wrap.setAttribute('data-state', ok === true ? 'ok' : ok === false ? 'fail' : 'idle');
    if (label) label.textContent = text || (ok === true ? '连接成功' : ok === false ? '连接失败' : '未连接');
    if (icon && svg) {
      if (ok === true) svg.mount(icon, svg.check);
      else if (ok === false) svg.mount(icon, svg.cross);
      else icon.innerHTML = '';
    }
  }

  async function connect() {
    if (!api() || busy) return;
    busy = true;
    setStatus(null, '连接中…');
    try {
      saveFromDom();
      var ids = await api().listModels();
      fillModels(ids);
      setStatus(true, '连接成功');
      var resolved = api().loadConfig().resolvedMode;
      toast(
        resolved
          ? '已连接（' + modeLabel(resolved) + '），模型 ' + ids.length + ' 个'
          : '已加载 ' + ids.length + ' 个模型',
      );
    } catch (e) {
      console.warn('[天青 API] listModels', e);
      try {
        if (window.天青_api && typeof window.天青_api.isDefinitiveUpstreamError === 'function') {
          if (window.天青_api.isDefinitiveUpstreamError(e)) throw e;
        } else {
          var em = String((e && e.message) || e || '');
          if (/HTTP\s*40[123]\b|HTTP\s*429\b|No Keys|Proxy error|Too Many Requests/i.test(em)) throw e;
        }
        saveFromDom();
        var cfg = api().loadConfig();
        if (!cfg.model) throw e;
        await api().testMessage();
        setStatus(true, '连接成功');
        toast('未提供模型列表，已用测试消息确认连通');
      } catch (e2) {
        console.warn('[天青 API]', e2);
        setStatus(false, '连接失败');
        var failMsg = String((e2 && e2.message) || e2 || e || '连接失败');
        if (failMsg.indexOf('连接失败') !== 0) failMsg = '连接失败：' + failMsg;
        toast(failMsg.slice(0, 180));
      }
    } finally {
      busy = false;
    }
  }

  async function sendTest() {
    if (!api() || busy) return;
    busy = true;
    setStatus(null, '测试中…');
    try {
      saveFromDom();
      var reply = await api().testMessage();
      setStatus(true, '连接成功');
      toast('测试成功：' + String(reply || '').slice(0, 40));
    } catch (e) {
      console.warn('[天青 API]', e);
      setStatus(false, '连接失败');
      var msg = String((e && e.message) || e || '连接失败');
      if (msg.indexOf('连接失败') !== 0) msg = '连接失败：' + msg;
      toast(msg.slice(0, 120));
    } finally {
      busy = false;
    }
  }

  function scheduleKeyCheck() {
    clearTimeout(keyTimer);
    keyTimer = setTimeout(function () {
      var cfg = readDomConfig();
      saveFromDom();
      if (!cfg.baseUrl) {
        setStatus(null, '未连接');
        return;
      }
      connect();
    }, 650);
  }

  function syncKeyVisibility() {
    var btn = $('btn-api-key-vis');
    var key = $('cfg-api-key');
    var svg = window.天青_svg;
    if (!btn || !key || !svg) return;
    var visible = btn.getAttribute('data-visible') === '1';
    key.type = visible ? 'text' : 'password';
    svg.mount(btn, visible ? svg.eye : svg.eyeOff);
    btn.setAttribute('aria-label', visible ? '隐藏密钥' : '显示密钥');
    btn.title = visible ? '隐藏密钥' : '显示密钥';
  }

  function toggleKeyVisibility() {
    var btn = $('btn-api-key-vis');
    if (!btn) return;
    var next = btn.getAttribute('data-visible') === '1' ? '0' : '1';
    btn.setAttribute('data-visible', next);
    syncKeyVisibility();
  }

  function maybeTryAutoConnect() {
    var cfg = (api() && api().loadConfig()) || {};
    if (!cfg.autoConnect) return;
    if (!String(cfg.baseUrl || '').trim()) return;
    connect();
  }

  function bind() {
    fillDom();
    syncKeyVisibility();

    var svg = window.天青_svg;
    var base = $('cfg-api-base');
    var key = $('cfg-api-key');
    var model = $('cfg-api-model');
    var vis = $('btn-api-key-vis');
    var caret = $('btn-api-model-menu');
    var menu = $('cfg-api-model-menu');
    var auto = $('cfg-api-auto-connect');

    if (svg && caret) svg.mount(caret, svg.caret);

    if (base) {
      base.addEventListener('change', function () {
        saveFromDom();
      });
    }
    if (auto) {
      auto.addEventListener('change', function () {
        saveFromDom();
      });
    }
    var stream = $('cfg-api-stream');
    if (stream) {
      stream.addEventListener('change', function () {
        saveFromDom();
      });
    }
    var streamDisplay = $('cfg-api-stream-display');
    if (streamDisplay) {
      streamDisplay.addEventListener('change', function () {
        saveFromDom();
      });
    }
    var maxTok = $('cfg-api-max-tokens');
    if (maxTok) {
      maxTok.addEventListener('change', function () {
        var v = Math.round(clampNum(maxTok.value, 1, 2000000, 4096));
        maxTok.value = String(v);
        saveFromDom();
      });
    }
    var reasoning = $('cfg-api-reasoning');
    if (reasoning) {
      reasoning.addEventListener('change', function () {
        saveFromDom();
      });
    }
    bindIntSlider('cfg-api-context', 'cfg-api-context-num', saveFromDom);
    bindFloatSlider('cfg-api-temp', 'cfg-api-temp-num', saveFromDom);
    bindFloatSlider('cfg-api-freq', 'cfg-api-freq-num', saveFromDom);
    bindFloatSlider('cfg-api-pres', 'cfg-api-pres-num', saveFromDom);
    bindFloatSlider('cfg-api-top-p', 'cfg-api-top-p-num', saveFromDom);
    if (vis) {
      vis.addEventListener('click', toggleKeyVisibility);
    }
    if (key) {
      key.addEventListener('input', function () {
        saveFromDom();
        scheduleKeyCheck();
      });
      key.addEventListener('change', function () {
        saveFromDom();
        scheduleKeyCheck();
      });
    }
    if (model) {
      model.addEventListener('change', function () {
        saveFromDom();
      });
      model.addEventListener('input', function () {
        saveFromDom();
        suggestModelsFromInput();
      });
      model.addEventListener('focus', function () {
        if (modelIds.length) suggestModelsFromInput();
      });
      model.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModelMenu();
      });
    }
    if (caret) {
      caret.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleModelMenu();
      });
    }
    if (menu) {
      menu.addEventListener('click', function (e) {
        var li = e.target && e.target.closest ? e.target.closest('li[data-value]') : null;
        if (!li) return;
        e.preventDefault();
        selectModel(li.dataset.value);
      });
    }

    document.addEventListener('click', function (e) {
      var wrap = $('cfg-api-model-wrap');
      if (!wrap || !wrap.classList.contains('is-open')) return;
      if (wrap.contains(e.target)) return;
      closeModelMenu();
    });

    var btnConnect = $('btn-api-connect');
    var btnTest = $('btn-api-test');
    if (btnConnect) btnConnect.addEventListener('click', connect);
    if (btnTest) btnTest.addEventListener('click', sendTest);

    maybeTryAutoConnect();
  }

  window.天青_settings_api = {
    bind: bind,
    fillDom: fillDom,
    connect: connect,
    setStatus: setStatus,
  };
})();
