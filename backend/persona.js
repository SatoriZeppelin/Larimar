/**
 * 用户设定（Persona）：名称 / 描述 / 插入位置
 * {{user}} 与 {{producer}} 共用名称
 * 对外：window.天青_persona
 */
(function () {
  var KEY = 'tq_plus_persona';

  var POSITIONS = {
    none: 'none',
    prompt: 'prompt',
    an_top: 'an_top',
    an_bottom: 'an_bottom',
    depth: 'depth',
  };

  var DEFAULTS = {
    name: '',
    description: '',
    position: POSITIONS.prompt,
    depth: 4,
  };

  function clampDepth(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(999, n);
  }

  function normalize(raw) {
    var o = raw && typeof raw === 'object' ? raw : {};
    var pos = String(o.position || DEFAULTS.position);
    if (!POSITIONS[pos] && pos !== 'none' && pos !== 'prompt' && pos !== 'an_top' && pos !== 'an_bottom' && pos !== 'depth') {
      pos = DEFAULTS.position;
    }
    return {
      name: o.name != null ? String(o.name) : '',
      description: o.description != null ? String(o.description) : '',
      position: pos,
      depth: clampDepth(o.depth != null ? o.depth : DEFAULTS.depth),
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return normalize(DEFAULTS);
      return normalize(JSON.parse(raw));
    } catch (e) {
      return normalize(DEFAULTS);
    }
  }

  function save(data) {
    var d = normalize(data || {});
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {}
    syncKeys(d);
    return d;
  }

  function syncKeys(d) {
    d = d || load();
    if (window.天青_keys && window.天青_keys.set) {
      window.天青_keys.set('user', d.name || '');
      window.天青_keys.set('producer', d.name || '');
    }
  }

  /** 解析宏后的描述正文；禁用或空则返回 '' */
  function resolvedDescription(data) {
    var d = data || load();
    if (!d.position || d.position === POSITIONS.none) return '';
    var text = String(d.description || '').trim();
    if (!text) return '';
    if (window.天青_keys && window.天青_keys.resolve) {
      text = window.天青_keys.resolve(text);
    }
    return text;
  }

  function charCount(data) {
    var d = data || load();
    return String(d.description || '').length;
  }

  /* 启动时把已存名称同步到宏 */
  syncKeys(load());

  window.天青_persona = {
    KEY: KEY,
    POSITIONS: POSITIONS,
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    syncKeys: syncKeys,
    resolvedDescription: resolvedDescription,
    charCount: charCount,
  };
})();
