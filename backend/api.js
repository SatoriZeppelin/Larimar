/**
 * OpenAI 兼容 Chat Completions 客户端
 *
 * 界面只填一个 URL（API / 反向代理）。自动依次尝试：
 * - reverse  按 URL 当反向代理（密钥可空）
 * - direct   直连 URL（需密钥）
 *
 * 连接时还会自动尝试补全 /v1、/models、/chat/completions 等路径。
 *
 * 对外：window.天青_api
 */
(function () {
  var KEY = 'tq_plus_api';
  /* 与 resource/seed.json 的 api 对齐（不含密钥/模型） */
  var DEFAULTS = {
    mode: 'auto',
    baseUrl: 'https://api.tokenfactory.nebius.com/v1',
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
    /** 自动探测成功后锁定的实际模式 */
    resolvedMode: '',
    stream: false,
    /** 流式收包时是否边收边演（完整句上台） */
    streamDisplay: false,
    /** 启动时自动连接上次保存的 URL */
    autoConnect: true,
  };

  function loadConfig() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var parsed = JSON.parse(raw);
      var cfg = Object.assign({}, DEFAULTS, parsed);
      /* 旧版曾单独存 proxyUrl，现已并入单一 URL，忽略之 */
      delete cfg.proxyUrl;
      if (!cfg.mode) cfg.mode = 'auto';
      return cfg;
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch (e) {}
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

  /** 去掉 chat/models 后缀，并折叠末尾 /v1 */
  function stripApiEndpoint(url) {
    return normalizeBase(url)
      .replace(/(\/v1)+\/chat\/completions$/i, '')
      .replace(/\/chat\/completions$/i, '')
      .replace(/(\/v1)+\/models$/i, '')
      .replace(/\/models$/i, '')
      .replace(/(\/v1)+$/i, '');
  }

  /** 修正已保存的错误路径 …/v1/v1/chat/completions */
  function sanitizeEndpointUrl(url) {
    var u = normalizeBase(url);
    if (!u) return '';
    u = u.replace(/(\/v1)+(\/chat\/completions)$/i, '/v1$2');
    u = u.replace(/(\/v1)+(\/models)$/i, '/v1$2');
    u = collapseTrailingV1(u);
    return u;
  }

  function pushUnique(arr, item) {
    item = normalizeBase(item);
    if (item && arr.indexOf(item) < 0) arr.push(item);
  }

  /**
   * 解析用户填写的 API 根：
   * - 已含 /v1 → 原样保留，后面只拼 /models、/chat/completions
   * - 已是完整 endpoint → 还原到 …/v1
   * - 无 /v1 → 保留根路径（拼 endpoint 时再加 /v1/…）
   */
  function resolveApiRoot(input) {
    var b = sanitizeEndpointUrl(input);
    if (!b) return '';
    if (/\/v1\/chat\/completions$/i.test(b)) return b.replace(/\/chat\/completions$/i, '');
    if (/\/chat\/completions$/i.test(b)) {
      var noChat = b.replace(/\/chat\/completions$/i, '');
      return /\/v1$/i.test(noChat) ? noChat : noChat;
    }
    if (/\/v1\/models$/i.test(b)) return b.replace(/\/models$/i, '');
    if (/\/models$/i.test(b)) {
      var noModels = b.replace(/\/models$/i, '');
      return noModels;
    }
    if (/\/v1$/i.test(b)) return b;
    return b;
  }

  function modelsUrlCandidates(cfg) {
    var urls = [];
    if (cfg.modelsPath) {
      pushUnique(urls, sanitizeEndpointUrl(cfg.modelsPath));
      return urls;
    }
    var root = resolveApiRoot(cfg.baseUrl);
    if (!root) return urls;
    if (/\/models$/i.test(root)) {
      pushUnique(urls, root);
      return urls;
    }
    if (/\/v1$/i.test(root)) {
      pushUnique(urls, root + '/models');
      return urls;
    }
    pushUnique(urls, root + '/v1/models');
    return urls;
  }

  function chatUrlCandidates(cfg) {
    var urls = [];
    if (cfg.chatPath) {
      pushUnique(urls, sanitizeEndpointUrl(cfg.chatPath));
      return urls;
    }
    var root = resolveApiRoot(cfg.baseUrl);
    if (!root) return urls;
    if (/\/chat\/completions$/i.test(root)) {
      pushUnique(urls, root);
      return urls;
    }
    if (/\/v1$/i.test(root)) {
      pushUnique(urls, root + '/chat/completions');
      return urls;
    }
    pushUnique(urls, root + '/v1/chat/completions');
    return urls;
  }

  function inferBaseFromModelsUrl(url) {
    var u = sanitizeEndpointUrl(url);
    if (/\/v1\/models$/i.test(u)) return u.replace(/\/models$/i, '');
    if (/\/models$/i.test(u)) return u.replace(/\/models$/i, '');
    return collapseTrailingV1(u);
  }

  function inferBaseFromChatUrl(url) {
    var u = sanitizeEndpointUrl(url);
    if (/\/v1\/chat\/completions$/i.test(u)) return u.replace(/\/chat\/completions$/i, '');
    if (/\/chat\/completions$/i.test(u)) return u.replace(/\/chat\/completions$/i, '');
    return collapseTrailingV1(u);
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
        shortMsg =
          (typeof eobj === 'string' ? eobj : eobj.message || eobj.code || '') || '';
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
    err.message = '连接失败：' + String(content || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw err;
  }

  function normalizeConfig(cfg) {
    var c = Object.assign({}, DEFAULTS, cfg || {});
    c.mode = c.mode || 'auto';
    c.baseUrl = sanitizeEndpointUrl(c.baseUrl);
    c.apiKey = String(c.apiKey || '').trim();
    c.chatPath = sanitizeEndpointUrl(c.chatPath || '');
    c.modelsPath = sanitizeEndpointUrl(c.modelsPath || '');
    c.resolvedMode = c.resolvedMode || '';
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
    delete c.proxyUrl;
    delete c.preferCorsProxy;
    if (c.resolvedMode === 'cors' || c.mode === 'cors') {
      c.resolvedMode = c.resolvedMode === 'cors' ? '' : c.resolvedMode;
      if (c.mode === 'cors') c.mode = 'auto';
    }
    return c;
  }

  function buildChatBody(trial, opts) {
    var body = {
      model: trial.model,
      messages: opts.messages || [],
      max_tokens: trial.maxTokens,
      stream: !!trial.stream,
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
    if (cfg.apiKey) {
      headers.Authorization = 'Bearer ' + cfg.apiKey;
    }
    return headers;
  }

  /** 自动模式：reverse →（有密钥时）direct；不再走本机代理 */
  function modeProbeOrder(cfg) {
    if (cfg.mode && cfg.mode !== 'auto') {
      if (cfg.mode === 'cors') return ['reverse'];
      return [cfg.mode];
    }
    if (cfg.resolvedMode === 'direct') return ['direct'];
    if (cfg.resolvedMode === 'reverse') return ['reverse'];
    return ['reverse', 'direct'];
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
    if (cfg.mode === 'direct' && !cfg.apiKey) {
      throw new Error('直连模式请填写密钥');
    }
    return cfg;
  }

  function parseModelIds(data) {
    var list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    var ids = list
      .map(function (m) {
        return (m && (m.id || m.name || m.model)) || '';
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
      var got = await fetchText(url, {
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
    var body = buildChatBody(trial, opts);
    var urls = chatUrlCandidates(trial);
    return tryUrls(urls, async function (url) {
      var headers = authHeaders(Object.assign({}, trial, { mode: trial.mode, resolvedMode: trial.mode }));

      async function postBody(payload) {
        var res = await fetch(url, {
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
              payload.presence_penalty != null)
          ) {
            console.warn('[SummerNight Plus] 采样参数被拒，省略后重试');
            var retryBody = Object.assign({}, payload);
            stripSamplingParams(retryBody);
            return postBody(retryBody);
          }
          throw apiErr;
        }

        if (trial.stream && res.body && typeof res.body.getReader === 'function') {
          var content = await readChatStream(res, opts.onDelta);
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
            (typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error)) ||
            text;
          throw makeApiError(res.status, errMsg, 'API error');
        }
        var full =
          (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        if (!full) throw makeApiError(res.status, text, 'API 返回空内容');
        rejectIfUpstreamErrorContent(full, res.status);
        if (opts.onDelta) opts.onDelta(full);
        return { url: url, content: full, trial: trial };
      }

      return postBody(body);
    });
  }

  async function readChatStream(res, onDelta) {
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
        if (!line || line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          var json = JSON.parse(payload);
          var delta = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || '';
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
    var next = Object.assign({}, cfg, trial, patch || {});
    next.mode = cfg.mode === 'auto' ? 'auto' : trial.mode;
    next.resolvedMode = trial.mode;
    saveConfig(normalizeConfig(next));
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
   * @param {{messages: Array<{role:string,content:string}>, signal?: AbortSignal, onDelta?: function}} opts
   */
  async function chat(opts) {
    var cfg = assertConfig(loadConfig());
    var modes = modeProbeOrder(cfg);
    var errors = [];
    var lastApiError = null;

    logChatCompletionRequest(opts, {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      top_p: cfg.topP,
      stream: !!cfg.stream,
    });

    for (var i = 0; i < modes.length; i++) {
      var mode = modes[i];
      if (mode === 'direct' && !cfg.apiKey) continue;
      var trial = buildTrialConfig(cfg, mode);
      try {
        var hit = await chatOnce(trial, opts);
        persistSuccess(cfg, trial, {
          chatPath: hit.url,
          baseUrl: inferBaseFromChatUrl(hit.url) || cfg.baseUrl,
        });
        return hit.content;
      } catch (e) {
        if (e && e.name === 'ApiError') lastApiError = e;
        errors.push('[' + mode + '] ' + String((e && e.message) || e).slice(0, 400));
        if (isDefinitiveUpstreamError(e)) break;
      }
    }
    if (lastApiError && isDefinitiveUpstreamError(lastApiError)) throw lastApiError;
    throw new Error(errors.join('\n') || '连接失败');
  }

  async function listModels(signal) {
    var cfg = assertConfig(loadConfig());
    var modes = modeProbeOrder(cfg);
    var errors = [];
    var lastApiError = null;

    for (var i = 0; i < modes.length; i++) {
      var mode = modes[i];
      if (mode === 'direct' && !cfg.apiKey) continue;
      var trial = buildTrialConfig(cfg, mode);
      try {
        var hit = await listModelsOnce(trial, signal);
        var root = inferBaseFromModelsUrl(hit.url) || cfg.baseUrl;
        var chatPath = '';
        if (root) {
          chatPath = /\/v1$/i.test(root) ? root + '/chat/completions' : root + '/v1/chat/completions';
        }
        persistSuccess(cfg, trial, {
          modelsPath: hit.url,
          chatPath: chatPath,
          baseUrl: root,
        });
        return hit.ids;
      } catch (e) {
        if (e && e.name === 'ApiError') lastApiError = e;
        errors.push('[' + mode + '] ' + String((e && e.message) || e).slice(0, 180));
        if (isDefinitiveUpstreamError(e)) break;
      }
    }
    if (lastApiError && isDefinitiveUpstreamError(lastApiError)) throw lastApiError;
    throw new Error(errors.join('\n') || '连接失败');
  }

  async function testMessage(signal) {
    return chat({
      messages: [{ role: 'user', content: 'ping' }],
      signal: signal,
    });
  }

  window.天青_api = {
    DEFAULTS: DEFAULTS,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    normalizeConfig: normalizeConfig,
    chat: chat,
    listModels: listModels,
    testMessage: testMessage,
    modeProbeOrder: modeProbeOrder,
    isDefinitiveUpstreamError: isDefinitiveUpstreamError,
  };
})();