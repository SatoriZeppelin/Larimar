/**
 * Chat API 客户端（OpenAI / Claude / Gemini）
 *
 * 仅支持浏览器直连 API（需填写密钥）。
 * protocol：
 * - openai：Chat Completions（…/chat/completions）
 * - claude：Anthropic Messages（…/v1/messages）
 * - gemini：Google generateContent（…/models/{id}:generateContent）
 * OpenAI 根地址探测：有 /v1 则只拼子路径；无 /v1 则依次试 /v1/… 与裸路径。
 *
 * 对外：window.天青_api
 */
(function () {
  var KEY = 'tq_plus_api';
  var ROUTE_KEYS = ['main', 'line', 'twitter', 'twitch'];
  /* 与 resource/seed.json 的 api 对齐（不含密钥/模型） */
  var DEFAULTS = {
    mode: 'direct',
    /** openai | claude | gemini */
    protocol: 'openai',
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 1,
    maxTokens: 4096,
    contextLength: 1999872,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topP: 0.99,
    /** auto | minimal | low | medium | high | xhigh */
    reasoningEffort: 'xhigh',
    chatPath: '',
    modelsPath: '',
    resolvedMode: 'direct',
    stream: false,
    /** 流式收包时是否边收边演（完整句上台） */
    streamDisplay: false,
    /** 启动时自动连接上次保存的 URL */
    autoConnect: true,
  };

  function newId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function emptyRoutes() {
    return { main: '', line: '', twitter: '', twitch: '' };
  }

  function createProfile(partial) {
    var p = Object.assign({}, DEFAULTS, partial || {});
    if (!p.id) p.id = newId();
    p.name = String(p.name != null ? p.name : '新接口').trim() || '新接口';
    p.enabled = p.enabled !== false;
    return p;
  }

  function isLegacyFlatConfig(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    if (Array.isArray(parsed.profiles)) return false;
    return parsed.baseUrl != null || parsed.apiKey != null || parsed.model != null || parsed.protocol != null;
  }

  function findProfileIndex(store, id) {
    id = String(id || '');
    if (!id || !store || !store.profiles) return -1;
    for (var i = 0; i < store.profiles.length; i++) {
      if (store.profiles[i] && store.profiles[i].id === id) return i;
    }
    return -1;
  }

  function findProfile(store, id) {
    var i = findProfileIndex(store, id);
    return i >= 0 ? store.profiles[i] : null;
  }

  function normalizeRoutes(routes) {
    var out = emptyRoutes();
    var src = routes && typeof routes === 'object' ? routes : {};
    ROUTE_KEYS.forEach(function (k) {
      out[k] = String(src[k] || '').trim();
    });
    return out;
  }

  function normalizeStore(raw) {
    var store = raw && typeof raw === 'object' ? raw : {};
    var profiles = [];
    if (Array.isArray(store.profiles) && store.profiles.length) {
      store.profiles.forEach(function (p) {
        profiles.push(normalizeConfig(createProfile(p)));
      });
    } else {
      profiles.push(normalizeConfig(createProfile({ name: '默认' })));
    }
    var activeProfileId = String(store.activeProfileId || '').trim();
    var defaultProfileId = String(store.defaultProfileId || '').trim();
    if (!findProfile({ profiles: profiles }, activeProfileId)) {
      activeProfileId = profiles[0].id;
    }
    if (!findProfile({ profiles: profiles }, defaultProfileId)) {
      defaultProfileId = profiles[0].id;
    }
    var routes = normalizeRoutes(store.routes);
    ROUTE_KEYS.forEach(function (k) {
      if (routes[k] && !findProfile({ profiles: profiles }, routes[k])) routes[k] = '';
    });
    return {
      profiles: profiles,
      activeProfileId: activeProfileId,
      defaultProfileId: defaultProfileId,
      routes: routes,
    };
  }

  function migrateToStore(parsed) {
    if (isLegacyFlatConfig(parsed)) {
      var legacy = Object.assign({}, DEFAULTS, parsed);
      delete legacy.profiles;
      delete legacy.activeProfileId;
      delete legacy.defaultProfileId;
      delete legacy.routes;
      var profile = normalizeConfig(createProfile(Object.assign({}, legacy, { name: '默认', enabled: true })));
      return {
        profiles: [profile],
        activeProfileId: profile.id,
        defaultProfileId: profile.id,
        routes: emptyRoutes(),
      };
    }
    return normalizeStore(parsed);
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return normalizeStore(null);
      var parsed = JSON.parse(raw);
      var store = migrateToStore(parsed);
      /* 一次性写回新结构 */
      if (isLegacyFlatConfig(parsed)) {
        try {
          localStorage.setItem(KEY, JSON.stringify(store));
        } catch (e) {}
      }
      return store;
    } catch (e) {
      return normalizeStore(null);
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(normalizeStore(store)));
    } catch (e) {}
  }

  /** 兼容：读写当前 active profile 的字段 */
  function loadConfig() {
    var store = loadStore();
    var p = findProfile(store, store.activeProfileId) || store.profiles[0];
    return normalizeConfig(p || createProfile({ name: '默认' }));
  }

  function saveConfig(cfg) {
    var store = loadStore();
    var id = (cfg && cfg.id) || store.activeProfileId;
    var idx = findProfileIndex(store, id);
    if (idx < 0) idx = 0;
    var prev = store.profiles[idx] || createProfile({ name: '默认' });
    var next = normalizeConfig(
      Object.assign({}, prev, cfg || {}, {
        id: prev.id,
        name: cfg && cfg.name != null ? cfg.name : prev.name,
        enabled: cfg && cfg.enabled != null ? cfg.enabled !== false : prev.enabled !== false,
      }),
    );
    store.profiles[idx] = next;
    store.activeProfileId = next.id;
    saveStore(store);
  }

  function listProfiles() {
    return loadStore().profiles.slice();
  }

  function setActiveProfile(id) {
    var store = loadStore();
    if (findProfile(store, id)) {
      store.activeProfileId = id;
      saveStore(store);
    }
    return loadConfig();
  }

  function setDefaultProfile(id) {
    var store = loadStore();
    if (findProfile(store, id)) {
      store.defaultProfileId = id;
      saveStore(store);
    }
    return loadStore();
  }

  function setRoute(route, profileId) {
    var store = loadStore();
    if (ROUTE_KEYS.indexOf(route) < 0) return store;
    var pid = String(profileId || '').trim();
    if (pid && !findProfile(store, pid)) pid = '';
    store.routes[route] = pid;
    saveStore(store);
    return loadStore();
  }

  function addProfile(partial) {
    var store = loadStore();
    var p = normalizeConfig(createProfile(partial || { name: '新接口' }));
    store.profiles.push(p);
    store.activeProfileId = p.id;
    saveStore(store);
    return p;
  }

  function duplicateProfile(id) {
    var store = loadStore();
    var src = findProfile(store, id);
    if (!src) return null;
    var copy = normalizeConfig(
      createProfile(
        Object.assign({}, src, {
          id: newId(),
          name: String(src.name || '接口') + ' 副本',
        }),
      ),
    );
    var idx = findProfileIndex(store, id);
    store.profiles.splice(idx + 1, 0, copy);
    store.activeProfileId = copy.id;
    saveStore(store);
    return copy;
  }

  function removeProfile(id) {
    var store = loadStore();
    if (store.profiles.length <= 1) return store;
    var idx = findProfileIndex(store, id);
    if (idx < 0) return store;
    store.profiles.splice(idx, 1);
    if (store.activeProfileId === id) store.activeProfileId = store.profiles[0].id;
    if (store.defaultProfileId === id) store.defaultProfileId = store.profiles[0].id;
    ROUTE_KEYS.forEach(function (k) {
      if (store.routes[k] === id) store.routes[k] = '';
    });
    saveStore(store);
    return loadStore();
  }

  function moveProfile(id, delta) {
    var store = loadStore();
    var idx = findProfileIndex(store, id);
    if (idx < 0) return store;
    var j = idx + (delta > 0 ? 1 : -1);
    if (j < 0 || j >= store.profiles.length) return store;
    var tmp = store.profiles[idx];
    store.profiles[idx] = store.profiles[j];
    store.profiles[j] = tmp;
    saveStore(store);
    return loadStore();
  }

  /**
   * 按路由或 profileId 解析实际使用的配置
   * @param {string} [route]
   * @param {string} [profileId]
   */
  function resolveConfig(route, profileId) {
    var store = loadStore();
    function usable(p) {
      return p && p.enabled !== false;
    }
    if (profileId) {
      var byId = findProfile(store, profileId);
      if (byId) return normalizeConfig(byId);
    }
    var r = String(route || '').trim();
    if (r && store.routes && store.routes[r]) {
      var bound = findProfile(store, store.routes[r]);
      if (usable(bound)) return normalizeConfig(bound);
    }
    var def = findProfile(store, store.defaultProfileId);
    if (usable(def)) return normalizeConfig(def);
    for (var i = 0; i < store.profiles.length; i++) {
      if (usable(store.profiles[i])) return normalizeConfig(store.profiles[i]);
    }
    return normalizeConfig(store.profiles[0] || createProfile({ name: '默认' }));
  }

  function normalizeBase(url) {
    return String(url || '')
      .trim()
      .replace(/\/+$/, '');
  }

  /** 去掉末尾重复的 /v1（…/v1/v1 → …/v1） */
  function collapseTrailingV1(url) {
    return normalizeBase(url).replace(/(\/v1)+$/i, '/v1');
  }

  /** 去掉 chat/models/messages/generateContent 后缀，并折叠末尾 /v1 */
  function stripApiEndpoint(url) {
    return normalizeBase(url)
      .replace(/\?.*$/, '')
      .replace(/(\/v1)+\/chat\/completions$/i, '')
      .replace(/\/chat\/completions$/i, '')
      .replace(/(\/v1)+\/messages$/i, '')
      .replace(/\/messages$/i, '')
      .replace(/\/v1beta\/models\/[^/:]+(?::[\w]+)?$/i, '')
      .replace(/\/models\/[^/:]+(?::(?:generateContent|streamGenerateContent))$/i, '')
      .replace(/(\/v1beta)+\/models$/i, '')
      .replace(/(\/v1)+\/models$/i, '')
      .replace(/\/models$/i, '')
      .replace(/(\/v1beta)+$/i, '')
      .replace(/(\/v1)+$/i, '');
  }

  /** 修正已保存的错误路径 …/v1/v1/chat/completions */
  function sanitizeEndpointUrl(url) {
    var u = normalizeBase(url);
    if (!u) return '';
    var q = '';
    var qi = u.indexOf('?');
    if (qi >= 0) {
      q = u.slice(qi);
      u = u.slice(0, qi);
    }
    u = u.replace(/(\/v1)+(\/chat\/completions)$/i, '/v1$2');
    u = u.replace(/(\/v1)+(\/messages)$/i, '/v1$2');
    u = u.replace(/(\/v1)+(\/models)$/i, '/v1$2');
    u = collapseTrailingV1(u);
    return u + q;
  }

  function pushUnique(arr, item) {
    item = normalizeBase(item);
    if (item && arr.indexOf(item) < 0) arr.push(item);
  }

  /**
   * 解析用户填写的 API 根（去掉完整 endpoint 后缀，保留 /v1 若原本就有）：
   * - …/v1/chat/completions → …/v1
   * - …/chat/completions → …（代理根，如 …/proxy/openai）
   * - …/v1 → …/v1
   */
  function resolveApiRoot(input) {
    var b = sanitizeEndpointUrl(input);
    if (!b) return '';
    b = b.replace(/\?.*$/, '');
    if (/\/v1\/chat\/completions$/i.test(b)) return b.replace(/\/chat\/completions$/i, '');
    if (/\/chat\/completions$/i.test(b)) return b.replace(/\/chat\/completions$/i, '');
    if (/\/v1\/messages$/i.test(b)) return b.replace(/\/messages$/i, '');
    if (/\/messages$/i.test(b)) return b.replace(/\/messages$/i, '');
    if (/\/v1beta\/models\/[^/:]+(?::[\w]+)?$/i.test(b)) {
      return b.replace(/\/v1beta\/models\/[^/:]+(?::[\w]+)?$/i, '');
    }
    if (/\/models\/[^/:]+(?::(?:generateContent|streamGenerateContent))$/i.test(b)) {
      return b.replace(/\/models\/[^/:]+(?::(?:generateContent|streamGenerateContent))$/i, '');
    }
    if (/\/v1beta\/models$/i.test(b)) return b.replace(/\/v1beta\/models$/i, '');
    if (/\/v1\/models$/i.test(b)) return b.replace(/\/models$/i, '');
    if (/\/models$/i.test(b)) return b.replace(/\/models$/i, '');
    if (/\/v1beta$/i.test(b)) return b;
    if (/\/v1$/i.test(b)) return b;
    return b;
  }

  /** 根是否已是 OpenAI 风格的 …/v1 */
  function rootEndsWithV1(root) {
    return /\/v1$/i.test(root || '');
  }

  function normalizeProtocol(p) {
    p = String(p || '')
      .trim()
      .toLowerCase();
    if (p === 'claude' || p === 'anthropic') return 'claude';
    if (p === 'gemini' || p === 'google') return 'gemini';
    return 'openai';
  }

  function getProtocol(cfg) {
    return normalizeProtocol(cfg && cfg.protocol);
  }

  /** Gemini 模型 id：去掉 models/ 前缀 */
  function geminiModelId(model) {
    return String(model || '')
      .trim()
      .replace(/^models\//i, '');
  }

  /**
   * models 候选（按协议）
   */
  function modelsUrlCandidates(cfg) {
    var urls = [];
    var protocol = getProtocol(cfg);
    if (cfg.modelsPath) {
      pushUnique(urls, sanitizeEndpointUrl(cfg.modelsPath));
    }
    var root = resolveApiRoot(cfg.baseUrl);
    if (!root) return urls;

    if (protocol === 'claude') {
      if (/\/models$/i.test(root)) {
        pushUnique(urls, root);
        return urls;
      }
      if (rootEndsWithV1(root)) {
        pushUnique(urls, root + '/models');
        return urls;
      }
      pushUnique(urls, root + '/v1/models');
      pushUnique(urls, root + '/models');
      return urls;
    }

    if (protocol === 'gemini') {
      if (/\/models$/i.test(root)) {
        pushUnique(urls, root);
        return urls;
      }
      pushUnique(urls, root + '/v1beta/models');
      pushUnique(urls, root + '/models');
      return urls;
    }

    if (/\/models$/i.test(root)) {
      pushUnique(urls, root);
      return urls;
    }
    if (rootEndsWithV1(root)) {
      pushUnique(urls, root + '/models');
      return urls;
    }
    pushUnique(urls, root + '/v1/models');
    pushUnique(urls, root + '/models');
    return urls;
  }

  /**
   * chat 候选（按协议）
   */
  function chatUrlCandidates(cfg) {
    var urls = [];
    var protocol = getProtocol(cfg);
    var root = resolveApiRoot(cfg.baseUrl);
    var model = String((cfg && cfg.model) || '').trim();

    if (protocol === 'gemini') {
      var mid = geminiModelId(model) || 'gemini-2.0-flash';
      var enc = encodeURIComponent(mid);
      if (cfg.chatPath && String(cfg.chatPath).indexOf(mid) >= 0) {
        var isStreamPath = /streamGenerateContent/i.test(cfg.chatPath);
        if (!!cfg.stream === isStreamPath) {
          pushUnique(urls, sanitizeEndpointUrl(cfg.chatPath));
        }
      }
      if (!root) return urls;
      if (cfg.stream) {
        pushUnique(urls, root + '/v1beta/models/' + enc + ':streamGenerateContent?alt=sse');
        pushUnique(urls, root + '/models/' + enc + ':streamGenerateContent?alt=sse');
      } else {
        pushUnique(urls, root + '/v1beta/models/' + enc + ':generateContent');
        pushUnique(urls, root + '/models/' + enc + ':generateContent');
      }
      return urls;
    }

    if (protocol === 'claude') {
      if (cfg.chatPath && /\/messages$/i.test(cfg.chatPath)) {
        pushUnique(urls, sanitizeEndpointUrl(cfg.chatPath));
      }
      if (!root) return urls;
      if (/\/messages$/i.test(root)) {
        pushUnique(urls, root);
        return urls;
      }
      if (rootEndsWithV1(root)) {
        pushUnique(urls, root + '/messages');
        return urls;
      }
      pushUnique(urls, root + '/v1/messages');
      pushUnique(urls, root + '/messages');
      return urls;
    }

    if (cfg.chatPath) {
      pushUnique(urls, sanitizeEndpointUrl(cfg.chatPath));
    }
    if (!root) return urls;
    if (/\/chat\/completions$/i.test(root)) {
      pushUnique(urls, root);
      return urls;
    }
    if (rootEndsWithV1(root)) {
      pushUnique(urls, root + '/chat/completions');
      return urls;
    }
    pushUnique(urls, root + '/v1/chat/completions');
    pushUnique(urls, root + '/chat/completions');
    return urls;
  }

  function inferBaseFromModelsUrl(url) {
    var u = sanitizeEndpointUrl(url).replace(/\?.*$/, '');
    if (/\/v1beta\/models$/i.test(u)) return u.replace(/\/v1beta\/models$/i, '');
    if (/\/v1\/models$/i.test(u)) return u.replace(/\/models$/i, '');
    if (/\/models$/i.test(u)) return u.replace(/\/models$/i, '');
    return rootEndsWithV1(u) ? u : normalizeBase(u);
  }

  function inferBaseFromChatUrl(url) {
    var u = sanitizeEndpointUrl(url).replace(/\?.*$/, '');
    if (/\/v1\/chat\/completions$/i.test(u)) return u.replace(/\/chat\/completions$/i, '');
    if (/\/chat\/completions$/i.test(u)) return u.replace(/\/chat\/completions$/i, '');
    if (/\/v1\/messages$/i.test(u)) return u.replace(/\/messages$/i, '');
    if (/\/messages$/i.test(u)) return u.replace(/\/messages$/i, '');
    if (/\/v1beta\/models\/[^/:]+(?::[\w]+)?$/i.test(u)) {
      return u.replace(/\/v1beta\/models\/[^/:]+(?::[\w]+)?$/i, '');
    }
    if (/\/models\/[^/:]+(?::(?:generateContent|streamGenerateContent))$/i.test(u)) {
      return u.replace(/\/models\/[^/:]+(?::(?:generateContent|streamGenerateContent))$/i, '');
    }
    return rootEndsWithV1(u) ? u : normalizeBase(u);
  }

  function clampNum(n, min, max, fallback) {
    n = Number(n);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function openaiReasoningEffort(ui) {
    var v = String(ui || '')
      .trim()
      .toLowerCase();
    if (!v || v === 'auto') return '';
    if (v === 'minimal' || v === 'low' || v === '极低' || v === '低') return 'low';
    if (v === 'medium' || v === '中') return 'medium';
    if (v === 'high' || v === 'xhigh' || v === '高' || v === '极高') return 'high';
    return '';
  }

  /** 部分新模型（o1/o3/gpt-5 等）仅允许默认 temperature=1，自定义采样会 400 */
  function modelSkipsSamplingParams(model) {
    var m = String(model || '').toLowerCase();
    if (!m) return false;
    if (/^o[1-9]/.test(m)) return true;
    if (m.indexOf('o1') === 0 || m.indexOf('o3') === 0 || m.indexOf('o4') === 0) return true;
    if (m.indexOf('gpt-5') === 0) return true;
    if (/\b(reasoning|think)\b/.test(m)) return true;
    return false;
  }

  function applySamplingParams(body, trial) {
    body.temperature = trial.temperature;
    body.frequency_penalty = trial.frequencyPenalty;
    body.presence_penalty = trial.presencePenalty;
    body.top_p = trial.topP;
  }

  function stripSamplingParams(body) {
    delete body.temperature;
    delete body.frequency_penalty;
    delete body.presence_penalty;
    delete body.top_p;
  }

  function isSamplingRejectedError(status, text) {
    if (status !== 400) return false;
    var s = String(text || '').toLowerCase();
    return (
      s.indexOf('temperature') >= 0 ||
      s.indexOf('top_p') >= 0 ||
      s.indexOf('frequency_penalty') >= 0 ||
      s.indexOf('presence_penalty') >= 0 ||
      s.indexOf('unsupported_value') >= 0 ||
      s.indexOf('does not support') >= 0
    );
  }

  function makeApiError(status, bodyText, statusText) {
    var full = String(bodyText || statusText || '').trim();
    var pretty = full;
    var shortMsg = '';
    try {
      var parsed = JSON.parse(full);
      if (parsed && parsed.error) {
        var eobj = parsed.error;
        shortMsg = (typeof eobj === 'string' ? eobj : eobj.message || eobj.code || '') || '';
        if (eobj && eobj.code && shortMsg && String(shortMsg).indexOf(eobj.code) < 0) {
          shortMsg = String(eobj.code) + '：' + shortMsg;
        }
      } else if (parsed && parsed.message) {
        shortMsg = String(parsed.message);
      }
      pretty = JSON.stringify(parsed, null, 2);
    } catch (e) {
      /* 保持原文 */
    }
    var display = String(shortMsg || pretty || statusText || 'API 请求失败')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    var err = new Error(display);
    err.name = 'ApiError';
    err.status = status || 0;
    err.body = pretty || full;
    err.codeLabel = status ? 'HTTP ' + status : '请求错误';
    return err;
  }

  /**
   * 返回体缺少约定标签 / 无法解析时使用；弹窗正文展示 API 原文。
   * @param {string} scope 如「主线」「LINE」
   * @param {string} expected 如 '<summernight>…</summernight>'
   * @param {string} raw API 原文
   */
  function makeFormatError(scope, expected, raw) {
    var body = String(raw == null ? '' : raw);
    var tag = String(expected || '约定标签');
    var err = new Error(
      String(scope || 'API') + '：未返回可解析的 ' + tag,
    );
    err.name = 'FormatError';
    err.status = 0;
    err.codeLabel = '格式错误';
    err.expected = tag;
    err.body = body.trim() ? body : '（API 返回为空）';
    return err;
  }

  /** 是否同时包含开闭标签（忽略属性） */
  function hasXmlPair(raw, tagName) {
    var name = String(tagName || '').trim();
    if (!name) return false;
    var text = String(raw == null ? '' : raw);
    var open = new RegExp('<' + name + '\\b[^>]*>', 'i');
    var close = new RegExp('<\\/' + name + '\\s*>', 'i');
    return open.test(text) && close.test(text);
  }

  /**
   * 弹出格式错误框；返回 Error 对象便于调用方 throw / return。
   */
  function reportFormatError(scope, expected, raw) {
    var err = makeFormatError(scope, expected, raw);
    if (window.天青_settings && typeof window.天青_settings.showError === 'function') {
      window.天青_settings.showError(err);
    }
    return err;
  }

  /**
   * 部分反向代理在 HTTP 200 下把错误写成「助手正文」
   * （如 ### Proxy error (HTTP 402 No Keys Available)）
   */
  function looksLikeUpstreamErrorContent(text) {
    var s = String(text || '').trim();
    if (!s) return false;
    var head = s.slice(0, 400);
    var low = head.toLowerCase();
    if (/proxy\s*error/.test(low)) return true;
    if (/no\s+keys?\s+avai/.test(low)) return true;
    if (/http\s*40[123]/.test(low) && /(key|quota|credit|balance|billing|unauthorized|payment)/.test(low)) {
      return true;
    }
    if (/insufficient\s+(quota|credits|balance)/.test(low)) return true;
    if (/invalid\s+api\s*key|authentication\s*(failed|error)/.test(low)) return true;
    if (/^#{1,6}\s*\*{0,2}\s*proxy\s*error/i.test(s)) return true;
    return false;
  }

  function extractHttpStatusFromText(text) {
    var m = String(text || '').match(/HTTP\s*(\d{3})/i);
    if (!m) return 0;
    return parseInt(m[1], 10) || 0;
  }

  function rejectIfUpstreamErrorContent(content, httpStatus) {
    if (!looksLikeUpstreamErrorContent(content)) return;
    var status = httpStatus || extractHttpStatusFromText(content) || 0;
    var err = makeApiError(status, content, '上游返回错误内容');
    err.message =
      '连接失败：' +
      String(content || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
    throw err;
  }

  function normalizeConfig(cfg) {
    var src = cfg || {};
    var c = Object.assign({}, DEFAULTS, src);
    /* 仅保留直连；旧版 reverse / cors / auto / proxyUrl 一律丢弃 */
    c.mode = 'direct';
    c.resolvedMode = 'direct';
    c.protocol = normalizeProtocol(c.protocol);
    c.baseUrl = sanitizeEndpointUrl(c.baseUrl);
    c.apiKey = String(c.apiKey || '').trim();
    c.chatPath = sanitizeEndpointUrl(c.chatPath || '');
    c.modelsPath = sanitizeEndpointUrl(c.modelsPath || '');
    c.autoConnect = !!c.autoConnect;
    c.stream = !!c.stream;
    c.streamDisplay = c.streamDisplay !== false;
    c.temperature = round2(clampNum(c.temperature, 0, 2, DEFAULTS.temperature));
    c.frequencyPenalty = round2(clampNum(c.frequencyPenalty, -2, 2, DEFAULTS.frequencyPenalty));
    c.presencePenalty = round2(clampNum(c.presencePenalty, -2, 2, DEFAULTS.presencePenalty));
    c.topP = round2(clampNum(c.topP, 0, 1, DEFAULTS.topP));
    c.maxTokens = Math.round(clampNum(c.maxTokens, 1, 2000000, DEFAULTS.maxTokens));
    c.contextLength = Math.round(clampNum(c.contextLength, 1024, 2000000, DEFAULTS.contextLength));
    var effort = String(c.reasoningEffort || DEFAULTS.reasoningEffort)
      .trim()
      .toLowerCase();
    var allowed = { auto: 1, minimal: 1, low: 1, medium: 1, high: 1, xhigh: 1 };
    c.reasoningEffort = allowed[effort] ? effort : DEFAULTS.reasoningEffort;
    c.id = String(src.id || c.id || '').trim() || newId();
    c.name = String(src.name != null ? src.name : c.name != null ? c.name : '新接口').trim() || '新接口';
    c.enabled = src.enabled !== false && c.enabled !== false;
    delete c.proxyUrl;
    delete c.preferCorsProxy;
    delete c.profiles;
    delete c.activeProfileId;
    delete c.defaultProfileId;
    delete c.routes;
    return c;
  }

  /** OpenAI messages → Claude（system 顶层；仅 user/assistant） */
  function toClaudeMessages(messages) {
    var systemParts = [];
    var out = [];
    (messages || []).forEach(function (m) {
      if (!m) return;
      var role = String(m.role || '');
      var content = m.content == null ? '' : String(m.content);
      if (role === 'system') {
        if (content) systemParts.push(content);
        return;
      }
      if (role !== 'user' && role !== 'assistant') return;
      if (out.length && out[out.length - 1].role === role) {
        out[out.length - 1].content += '\n\n' + content;
      } else {
        out.push({ role: role, content: content });
      }
    });
    if (!out.length) out.push({ role: 'user', content: '(empty)' });
    if (out[0].role !== 'user') out.unshift({ role: 'user', content: '(continue)' });
    return {
      system: systemParts.length ? systemParts.join('\n\n') : '',
      messages: out,
    };
  }

  /** OpenAI messages → Gemini contents + systemInstruction */
  function toGeminiContents(messages) {
    var systemParts = [];
    var contents = [];
    (messages || []).forEach(function (m) {
      if (!m) return;
      var role = String(m.role || '');
      var content = m.content == null ? '' : String(m.content);
      if (role === 'system') {
        if (content) systemParts.push(content);
        return;
      }
      var gRole = role === 'assistant' ? 'model' : 'user';
      if (contents.length && contents[contents.length - 1].role === gRole) {
        contents[contents.length - 1].parts[0].text += '\n\n' + content;
      } else {
        contents.push({ role: gRole, parts: [{ text: content }] });
      }
    });
    if (!contents.length) contents.push({ role: 'user', parts: [{ text: '(empty)' }] });
    if (contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: '(continue)' }] });
    }
    return {
      systemInstruction: systemParts.length
        ? { parts: [{ text: systemParts.join('\n\n') }] }
        : null,
      contents: contents,
    };
  }

  function buildChatBody(trial, opts) {
    opts = opts || {};
    var protocol = getProtocol(trial);
    var messages = opts.messages || [];
    var stream = !!trial.stream;

    if (protocol === 'claude') {
      var cl = toClaudeMessages(messages);
      var bodyC = {
        model: trial.model,
        max_tokens: trial.maxTokens,
        messages: cl.messages,
      };
      if (cl.system) bodyC.system = cl.system;
      if (stream) bodyC.stream = true;
      if (!modelSkipsSamplingParams(trial.model)) {
        bodyC.temperature = trial.temperature;
        bodyC.top_p = trial.topP;
      }
      return bodyC;
    }

    if (protocol === 'gemini') {
      var ge = toGeminiContents(messages);
      var bodyG = {
        contents: ge.contents,
        generationConfig: {
          maxOutputTokens: trial.maxTokens,
        },
      };
      if (!modelSkipsSamplingParams(trial.model)) {
        bodyG.generationConfig.temperature = trial.temperature;
        bodyG.generationConfig.topP = trial.topP;
      }
      if (ge.systemInstruction) bodyG.systemInstruction = ge.systemInstruction;
      return bodyG;
    }

    var body = {
      model: trial.model,
      messages: messages,
      max_tokens: trial.maxTokens,
      stream: stream,
    };
    if (!modelSkipsSamplingParams(trial.model)) {
      applySamplingParams(body, trial);
    }
    var effort = openaiReasoningEffort(trial.reasoningEffort);
    if (effort) body.reasoning_effort = effort;
    return body;
  }

  function authHeaders(cfg, opts) {
    var headers = {};
    if (!opts || opts.json !== false) {
      headers['Content-Type'] = 'application/json';
    }
    var key = String((cfg && cfg.apiKey) || '').trim();
    if (!key) return headers;
    var protocol = getProtocol(cfg);
    if (protocol === 'claude') {
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (protocol === 'gemini') {
      headers['x-goog-api-key'] = key;
    } else {
      headers.Authorization = 'Bearer ' + key;
    }
    return headers;
  }

  function withGeminiKeyQuery(url, cfg) {
    if (getProtocol(cfg) !== 'gemini') return url;
    var key = String((cfg && cfg.apiKey) || '').trim();
    if (!key) return url;
    if (/[?&]key=/i.test(url)) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(key);
  }

  /** 从各协议 JSON 响应取出文本 */
  function extractAssistantText(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.choices && data.choices[0]) {
      var ch = data.choices[0];
      if (ch.message && ch.message.content != null) return String(ch.message.content);
      if (ch.text != null) return String(ch.text);
      if (ch.delta && ch.delta.content != null) return String(ch.delta.content);
    }
    if (Array.isArray(data.content)) {
      return data.content
        .map(function (block) {
          if (!block) return '';
          if (typeof block === 'string') return block;
          if (block.type === 'text' && block.text != null) return String(block.text);
          if (block.text != null) return String(block.text);
          return '';
        })
        .join('');
    }
    if (data.candidates && data.candidates[0]) {
      var parts = (((data.candidates[0] || {}).content || {}).parts) || [];
      return parts
        .map(function (p) {
          return p && p.text != null ? String(p.text) : '';
        })
        .join('');
    }
    return '';
  }

  /** 流式 SSE data JSON → 增量文本 */
  function extractStreamDelta(data, protocol) {
    if (!data || typeof data !== 'object') return '';
    if (protocol === 'claude') {
      if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
        return String(data.delta.text);
      }
      if (data.type === 'content_block_start' && data.content_block && data.content_block.text) {
        return String(data.content_block.text);
      }
      return '';
    }
    if (protocol === 'gemini') {
      return extractAssistantText(data);
    }
    var delta = data.choices && data.choices[0] && data.choices[0].delta;
    if (delta && delta.content != null) return String(delta.content);
    if (data.choices && data.choices[0] && data.choices[0].text) {
      return String(data.choices[0].text);
    }
    return '';
  }

  /** 仅直连 */
  function modeProbeOrder() {
    return ['direct'];
  }

  /** 上游明确拒绝时不要继续换 URL / 模式狂打 */
  function isDefinitiveUpstreamError(err) {
    var status = err && err.status;
    if (status === 401 || status === 402 || status === 403 || status === 429) return true;
    var msg = String((err && err.message) || err || '');
    if (/HTTP\s*40[123]\b/i.test(msg)) return true;
    if (/HTTP\s*429\b|Too Many Requests/i.test(msg)) return true;
    if (/No Keys Available|Proxy error/i.test(msg)) return true;
    if (/upstream_server_error|上游服务未能完成请求/i.test(msg)) return true;
    return false;
  }

  function assertConfig(cfg) {
    cfg = normalizeConfig(cfg);
    if (!cfg.baseUrl) {
      throw new Error('请先填写 URL');
    }
    if (!cfg.apiKey) {
      throw new Error('请填写密钥');
    }
    return cfg;
  }

  function parseModelIds(data) {
    var list = [];
    if (data && Array.isArray(data.models)) list = data.models;
    else if (data && Array.isArray(data.data)) list = data.data;
    else if (Array.isArray(data)) list = data;
    var ids = list
      .map(function (m) {
        var id = (m && (m.id || m.name || m.model)) || '';
        return String(id).replace(/^models\//i, '');
      })
      .filter(Boolean);
    ids.sort(function (a, b) {
      return String(a).localeCompare(String(b));
    });
    return ids;
  }

  async function fetchText(url, init) {
    var res = await fetch(url, init);
    var text = await res.text().catch(function () {
      return '';
    });
    return { res: res, text: text };
  }

  async function tryUrls(urls, runOne) {
    var errors = [];
    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];
      try {
        var out = await runOne(url);
        if (out) return out;
      } catch (e) {
        errors.push(url.replace(/^https?:\/\//, '') + ' → ' + String((e && e.message) || e).slice(0, 120));
        if (isDefinitiveUpstreamError(e)) break;
      }
    }
    throw new Error(errors.slice(0, 5).join('\n') || '所有候选地址均失败');
  }

  function buildTrialConfig(cfg, mode) {
    return normalizeConfig(
      Object.assign({}, cfg, {
        mode: mode,
        resolvedMode: mode,
        chatPath: mode === cfg.resolvedMode ? cfg.chatPath : '',
        modelsPath: mode === cfg.resolvedMode ? cfg.modelsPath : '',
      }),
    );
  }

  async function listModelsOnce(trial, signal) {
    var urls = modelsUrlCandidates(trial);
    return tryUrls(urls, async function (url) {
      var headers = authHeaders(Object.assign({}, trial, { mode: trial.mode, resolvedMode: trial.mode }), {
        json: false,
      });
      var got = await fetchText(withGeminiKeyQuery(url, trial), {
        method: 'GET',
        headers: headers,
        signal: signal,
      });
      if (!got.res.ok) {
        throw makeApiError(got.res.status, got.text, got.res.statusText);
      }
      var data;
      try {
        data = JSON.parse(got.text || '{}');
      } catch (e) {
        throw new Error('返回非 JSON');
      }
      var ids = parseModelIds(data);
      if (!ids.length) throw new Error('模型列表为空');
      return { url: url, ids: ids, trial: trial };
    });
  }

  async function chatOnce(trial, opts) {
    opts = opts || {};
    var protocol = getProtocol(trial);
    var body = buildChatBody(trial, opts);
    var urls = chatUrlCandidates(trial);
    return tryUrls(urls, async function (url) {
      var headers = authHeaders(Object.assign({}, trial, { mode: trial.mode, resolvedMode: trial.mode }));
      var postUrl = withGeminiKeyQuery(url, trial);

      async function postBody(payload) {
        var res = await fetch(postUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          signal: opts.signal,
        });
        if (!res.ok) {
          var errText = await res.text().catch(function () {
            return '';
          });
          var apiErr = makeApiError(res.status, errText, res.statusText);
          if (
            isSamplingRejectedError(res.status, errText) &&
            (payload.temperature != null ||
              payload.top_p != null ||
              payload.frequency_penalty != null ||
              payload.presence_penalty != null ||
              (payload.generationConfig &&
                (payload.generationConfig.temperature != null || payload.generationConfig.topP != null)))
          ) {
            console.warn('[SummerNight Plus] 采样参数被拒，省略后重试');
            var retryBody = Object.assign({}, payload);
            stripSamplingParams(retryBody);
            if (retryBody.generationConfig) {
              delete retryBody.generationConfig.temperature;
              delete retryBody.generationConfig.topP;
            }
            return postBody(retryBody);
          }
          throw apiErr;
        }

        if (trial.stream && res.body && typeof res.body.getReader === 'function') {
          var content = await readChatStream(res, opts.onDelta, protocol);
          if (!content) throw makeApiError(res.status, '', 'API 返回空内容');
          rejectIfUpstreamErrorContent(content, res.status);
          return { url: url, content: content, trial: trial };
        }

        var text = await res.text().catch(function () {
          return '';
        });
        var data;
        try {
          data = JSON.parse(text || '{}');
        } catch (e) {
          throw makeApiError(res.status, text, '返回非 JSON');
        }
        if (data && data.error) {
          var errMsg =
            (typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error)) || text;
          throw makeApiError(res.status, errMsg, 'API error');
        }
        var full = extractAssistantText(data);
        if (!full) throw makeApiError(res.status, text, 'API 返回空内容');
        rejectIfUpstreamErrorContent(full, res.status);
        if (opts.onDelta) opts.onDelta(full);
        return { url: url, content: full, trial: trial };
      }

      return postBody(body);
    });
  }

  async function readChatStream(res, onDelta, protocol) {
    protocol = normalizeProtocol(protocol);
    var reader = res.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var buf = '';
    var content = '';
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var parts = buf.split('\n');
      buf = parts.pop() || '';
      for (var i = 0; i < parts.length; i++) {
        var line = parts[i].replace(/\r$/, '');
        if (!line) continue;
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          var json = JSON.parse(payload);
          var delta = extractStreamDelta(json, protocol);
          if (delta) {
            content += delta;
            if (onDelta) onDelta(content, delta);
          }
        } catch (e) {
          /* 忽略残缺 SSE 行 */
        }
      }
    }
    return content;
  }

  function persistSuccess(cfg, trial, patch) {
    var store = loadStore();
    var id = (cfg && cfg.id) || store.activeProfileId;
    var idx = findProfileIndex(store, id);
    if (idx < 0) idx = findProfileIndex(store, store.activeProfileId);
    if (idx < 0) idx = 0;
    var prev = store.profiles[idx] || createProfile({ name: '默认' });
    var next = normalizeConfig(
      Object.assign({}, prev, trial || {}, patch || {}, {
        id: prev.id,
        name: prev.name,
        enabled: prev.enabled !== false,
        mode: 'direct',
        resolvedMode: 'direct',
      }),
    );
    store.profiles[idx] = next;
    saveStore(store);
    return next;
  }

  function logChatCompletionRequest(opts, extra) {
    var messages = (opts && opts.messages) || [];
    var payload = Object.assign(
      {
        messages: messages.map(function (m) {
          return {
            role: m && m.role,
            content: m && m.content,
          };
        }),
      },
      extra || {},
    );
    try {
      console.groupCollapsed('Chat Completion request: ' + messages.length + ' messages');
      console.log(payload);
      console.groupEnd();
    } catch (e) {
      console.log('Chat Completion request:', payload);
    }
  }

  /**
   * @param {{messages: Array<{role:string,content:string}>, signal?: AbortSignal, onDelta?: function, route?: string, profileId?: string}} opts
   */
  async function chat(opts) {
    opts = opts || {};
    var cfg = assertConfig(resolveConfig(opts.route, opts.profileId));

    logChatCompletionRequest(opts, {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      top_p: cfg.topP,
      stream: !!cfg.stream,
      route: opts.route || '',
      profileId: cfg.id,
      profileName: cfg.name,
    });

    var trial = buildTrialConfig(cfg, 'direct');
    try {
      var hit = await chatOnce(trial, opts);
      persistSuccess(cfg, trial, {
        chatPath: hit.url,
        baseUrl: inferBaseFromChatUrl(hit.url) || cfg.baseUrl,
      });
      return hit.content;
    } catch (e) {
      throw e;
    }
  }

  async function listModels(a, b) {
    var signal;
    var profileId;
    if (
      a &&
      typeof a === 'object' &&
      !(typeof AbortSignal !== 'undefined' && a instanceof AbortSignal) &&
      ('profileId' in a || 'signal' in a)
    ) {
      signal = a.signal;
      profileId = a.profileId;
    } else {
      signal = a;
      profileId = b;
    }
    var cfg = assertConfig(profileId ? resolveConfig(null, profileId) : loadConfig());
    var trial = buildTrialConfig(cfg, 'direct');
    var protocol = getProtocol(trial);
    try {
      var hit = await listModelsOnce(trial, signal);
      var root = inferBaseFromModelsUrl(hit.url) || cfg.baseUrl;
      var chatPath = '';
      if (root) {
        var modelsUrl = sanitizeEndpointUrl(hit.url).replace(/\?.*$/, '');
        if (protocol === 'claude') {
          if (rootEndsWithV1(root)) chatPath = root + '/messages';
          else if (/\/v1\//i.test(modelsUrl)) chatPath = root + '/v1/messages';
          else chatPath = root + '/messages';
        } else if (protocol === 'gemini') {
          chatPath = '';
        } else if (rootEndsWithV1(root)) {
          chatPath = root + '/chat/completions';
        } else if (/\/v1\//i.test(modelsUrl)) {
          chatPath = root + '/v1/chat/completions';
        } else {
          chatPath = root + '/chat/completions';
        }
      }
      persistSuccess(cfg, trial, {
        modelsPath: hit.url,
        chatPath: chatPath,
        baseUrl: root,
      });
      return hit.ids;
    } catch (e) {
      throw e;
    }
  }

  async function testMessage(a) {
    var signal;
    var profileId = '';
    if (
      a &&
      typeof a === 'object' &&
      !(typeof AbortSignal !== 'undefined' && a instanceof AbortSignal) &&
      ('profileId' in a || 'signal' in a)
    ) {
      signal = a.signal;
      profileId = a.profileId || '';
    } else {
      signal = a;
    }
    return chat({
      messages: [{ role: 'user', content: 'ping' }],
      signal: signal,
      profileId: profileId,
    });
  }

  window.天青_api = {
    DEFAULTS: DEFAULTS,
    ROUTE_KEYS: ROUTE_KEYS,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    loadStore: loadStore,
    saveStore: saveStore,
    normalizeConfig: normalizeConfig,
    normalizeStore: normalizeStore,
    listProfiles: listProfiles,
    resolveConfig: resolveConfig,
    setActiveProfile: setActiveProfile,
    setDefaultProfile: setDefaultProfile,
    setRoute: setRoute,
    addProfile: addProfile,
    duplicateProfile: duplicateProfile,
    removeProfile: removeProfile,
    moveProfile: moveProfile,
    chat: chat,
    listModels: listModels,
    testMessage: testMessage,
    modeProbeOrder: modeProbeOrder,
    isDefinitiveUpstreamError: isDefinitiveUpstreamError,
    makeApiError: makeApiError,
    makeFormatError: makeFormatError,
    hasXmlPair: hasXmlPair,
    reportFormatError: reportFormatError,
  };
})();
