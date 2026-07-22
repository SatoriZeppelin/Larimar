/**
 * 本地 token 计数（gpt-tokenizer）
 * 对外：window.天青_tokens
 */
(function () {
  var ENCODING_FILES = {
    cl100k_base: 'vendor/gpt-tokenizer-cl100k_base.js',
    o200k_base: 'vendor/gpt-tokenizer-o200k_base.js',
  };

  var loadPromises = Object.create(null);
  var defaultEncoding = 'cl100k_base';

  function getModelName() {
    try {
      if (window.天青_api && window.天青_api.loadConfig) {
        return String(window.天青_api.loadConfig().model || '').trim();
      }
    } catch (e) {}
    return '';
  }

  /** 按模型名选择 BPE 编码 */
  function resolveEncoding(model) {
    var m = String(model == null ? getModelName() : model)
      .trim()
      .toLowerCase();
    if (!m) return defaultEncoding;
    if (/gpt-4o|gpt-5|gpt-4\.1|chatgpt-4o|^o[1-4][-\w]*/.test(m)) return 'o200k_base';
    if (/\bo1\b|\bo3\b|\bo4\b/.test(m)) return 'o200k_base';
    return defaultEncoding;
  }

  function globalName(encoding) {
    return 'GPTTokenizer_' + encoding;
  }

  function getTokenizer(encoding) {
    encoding = encoding || defaultEncoding;
    var g = window[globalName(encoding)];
    if (g && typeof g.encode === 'function') return g;
    return null;
  }

  function fallbackCount(text) {
    return Math.ceil(String(text == null ? '' : text).length / 2);
  }

  function loadEncoding(encoding) {
    encoding = encoding || defaultEncoding;
    var tok = getTokenizer(encoding);
    if (tok) return Promise.resolve(tok);

    if (loadPromises[encoding]) return loadPromises[encoding];

    var src = ENCODING_FILES[encoding];
    if (!src) return Promise.reject(new Error('未知编码: ' + encoding));

    loadPromises[encoding] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () {
        var loaded = getTokenizer(encoding);
        if (loaded) resolve(loaded);
        else reject(new Error('tokenizer 脚本已加载但未找到 ' + globalName(encoding)));
      };
      s.onerror = function () {
        delete loadPromises[encoding];
        reject(new Error('无法加载 tokenizer: ' + src));
      };
      document.head.appendChild(s);
    });

    return loadPromises[encoding];
  }

  function ensureReady(model) {
    return loadEncoding(resolveEncoding(model));
  }

  function countText(text, model) {
    var encoding = resolveEncoding(model);
    var tok = getTokenizer(encoding);
    if (!tok) return fallbackCount(text);
    try {
      return tok.encode(String(text == null ? '' : text)).length;
    } catch (e) {
      console.warn('[SummerNight Plus] token 计数失败，回退粗估', e);
      return fallbackCount(text);
    }
  }

  function countMessage(msg, model) {
    if (!msg) return 0;
    return 4 + countText(msg.content, model);
  }

  function countMessages(msgs, model) {
    var n = 0;
    (msgs || []).forEach(function (m) {
      n += countMessage(m, model);
    });
    return n;
  }

  window.天青_tokens = {
    resolveEncoding: resolveEncoding,
    loadEncoding: loadEncoding,
    ensureReady: ensureReady,
    countText: countText,
    countMessage: countMessage,
    countMessages: countMessages,
    fallbackCount: fallbackCount,
  };
})();
