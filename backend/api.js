/**
 * OpenAI 兼容 Chat Completions 客户端
 *
 * 界面只填一个 URL（API / 反向代理）。自动依次尝试：
 * - reverse  按 URL 当反向代理（密钥可空）
 * - direct   直连 URL（需密钥）
 * - cors     经本机默认代理 http://127.0.0.1:8787，上游仍为该 URL
 *
 * 连接时还会自动尝试补全 /v1、/models、/chat/completions 等路径。
 *
 * 对外：window.天青_api
 */
(function () {
  var KEY = 'tq_plus_api';
  var LOCAL_PROXY = 'http://127.0.0.1:8787';
  var DEFAULTS = {
    mode: 'auto',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.9,
    maxTokens: 4096,
    contextLength: 200000,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topP: 1,
    /** auto | minimal | low | medium | high | xhigh */
    reasoningEffort: 'xhigh',
    chatPath: '',
    modelsPath: '',
    /** 自动探测成功后锁定的实际模式 */
    resolvedMode: '',
    stream: false,
    /** 流式收包时是否边收边演（完整句上台） */
    streamDisplay: true,
    /** 启动时自动连接上次保存的 URL */
    autoConnect: false,
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

  function rootCandidates(input) {
    var b = sanitizeEndpointUrl(input);
    var stripped = stripApiEndpoint(b);
    var roots = [];
    /* 先试无 /v1 根，再试带 /v1；绝不在已有 /v1 上再 +/v1 */
    pushUnique(roots, stripped);
    pushUnique(roots, stripped + '/v1');
    if (b && b !== stripped && b !== stripped + '/v1') {
      pushUnique(roots, collapseTrailingV1(b));
    }
    return roots;
  }

  function modelsUrlCandidates(cfg) {
    if (useLocalProxy(cfg)) {
      return [LOCAL_PROXY + '/v1/models'];
    }
    var urls = [];
    if (cfg.modelsPath) pushUnique(urls, sanitizeEndpointUrl(cfg.modelsPath));
    rootCandidates(cfg.baseUrl).forEach(function (root) {
      if (/\/v1$/i.test(root)) {
        pushUnique(urls, root + '/models');
      } else {
        pushUnique(urls, root + '/v1/models');
        pushUnique(urls, root + '/models');
      }
      if (/\/models$/i.test(root)) pushUnique(urls, root);
    });
    return urls;
  }

  function chatUrlCandidates(cfg) {
    if (useLocalProxy(cfg)) {
      return [LOCAL_PROXY + '/v1/chat/completions'];
    }
    var urls = [];
    if (cfg.chatPath) pushUnique(urls, sanitizeEndpointUrl(cfg.chatPath));
    rootCandidates(cfg.baseUrl).forEach(function (root) {
      if (/\/v1$/i.test(root)) {
        pushUnique(urls, root + '/chat/completions');
      } else {
        pushUnique(urls, root + '/v1/chat/completions');
        pushUnique(urls, root + '/chat/completions');
      }
      if (/\/chat\/completions$/i.test(root)) pushUnique(urls, root);
    });
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
    try {
      pretty = JSON.stringify(JSON.parse(full), null, 2);
    } catch (e) {
      /* 保持原文 */
    }
    var err = new Error(pretty || 'API 请求失败');
    err.name = 'ApiError';
    err.status = status || 0;
    err.body = pretty || full;
    err.codeLabel = status ? 'HTTP ' + status : '请求错误';
    return err;
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

  function useLocalProxy(cfg) {
    var m = cfg.mode === 'auto' ? cfg.resolvedMode || cfg.mode : cfg.mode;
    return m === 'cors';
  }

  function effectiveMode(cfg) {
    if (cfg.mode === 'auto') return cfg.resolvedMode || 'reverse';
    return cfg.mode;
  }

  function authHeaders(cfg, opts) {
    var headers = {};
    if (!opts || opts.json !== false) {
      headers['Content-Type'] = 'application/json';
    }
    var trial = Object.assign({}, cfg, { mode: effectiveMode(cfg) });
    if (useLocalProxy(trial)) {
      headers['X-TQ-Upstream'] = cfg.baseUrl;
      if (cfg.apiKey) headers['X-TQ-Api-Key'] = cfg.apiKey;
    } else if (cfg.apiKey) {
      headers.Authorization = 'Bearer ' + cfg.apiKey;
    }
    return headers;
  }

  /** 自动模式下依次尝试的模式顺序 */
  function modeProbeOrder(cfg) {
    if (cfg.mode && cfg.mode !== 'auto') return [cfg.mode];
    var order = [];
    /* 有密钥时也先试反向代理（部分网关不校验/另有鉴权） */
    order.push('reverse');
    if (cfg.apiKey) order.push('direct');
    order.push('cors');
    return order;
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
        throw new Error('API ' + got.res.status + ': ' + (got.text || got.res.statusText).slice(0, 160));
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
        var full =
          (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        if (!full) throw makeApiError(res.status, text, 'API 返回空内容');
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
          chatPath: useLocalProxy(trial) ? '' : hit.url,
          baseUrl: useLocalProxy(trial) ? cfg.baseUrl : inferBaseFromChatUrl(hit.url) || cfg.baseUrl,
        });
        return hit.content;
      } catch (e) {
        if (e && e.name === 'ApiError') lastApiError = e;
        errors.push('[' + mode + '] ' + String((e && e.message) || e).slice(0, 400));
      }
    }
    if (lastApiError) throw lastApiError;
    throw new Error(errors.join('\n') || '连接失败');
  }

  async function listModels(signal) {
    var cfg = assertConfig(loadConfig());
    var modes = modeProbeOrder(cfg);
    var errors = [];

    for (var i = 0; i < modes.length; i++) {
      var mode = modes[i];
      if (mode === 'direct' && !cfg.apiKey) continue;
      var trial = buildTrialConfig(cfg, mode);
      try {
        var hit = await listModelsOnce(trial, signal);
        var root = useLocalProxy(trial) ? cfg.baseUrl : inferBaseFromModelsUrl(hit.url) || cfg.baseUrl;
        var chatPath = '';
        if (!useLocalProxy(trial) && root) {
          chatPath = /\/v1$/i.test(root) ? root + '/chat/completions' : root + '/v1/chat/completions';
        }
        persistSuccess(cfg, trial, {
          modelsPath: useLocalProxy(trial) ? '' : hit.url,
          chatPath: chatPath,
          baseUrl: root,
        });
        return hit.ids;
      } catch (e) {
        errors.push('[' + mode + '] ' + String((e && e.message) || e).slice(0, 180));
      }
    }
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
  };
})();
