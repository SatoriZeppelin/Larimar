/**
 * stat_data 读取与 {{stat_data::路径}} 宏替换
 * 对外：window.天青_stat_data
 */
(function () {
  var VAR_KEY = 'tq_plus_variables';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function getStatData() {
    var api = window.天青_settings_variable;
    if (api && typeof api.get === 'function') {
      try {
        var d = api.get();
        if (d && typeof d === 'object' && !Array.isArray(d)) return d;
      } catch (e) {}
    }
    var stored = readJson(VAR_KEY, null);
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  }

  function dig(obj, parts) {
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /** stat_data.时间.天数 → 时间.天数 */
  function normalizePath(pathStr) {
    var p = String(pathStr || '').trim();
    if (!p) return '';
    if (p.indexOf('stat_data.') === 0) p = p.slice('stat_data.'.length);
    return p;
  }

  function pathParts(pathStr) {
    var p = normalizePath(pathStr);
    if (!p) return [];
    return p.split('.').filter(Boolean);
  }

  function getByPath(pathStr) {
    var parts = pathParts(pathStr);
    if (!parts.length) return undefined;
    return dig(getStatData(), parts);
  }

  /**
   * 发给 AI 时的字面量：数组/对象 → 紧凑 JSON（如 [16,0]）；字符串原样。
   */
  function formatStatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  var MACRO_RE = /\{\{stat_data::([^}]+)\}\}/g;

  function substituteStatDataMacros(text) {
    if (text == null || text === '') return text;
    return String(text).replace(MACRO_RE, function (full, path) {
      var v = getByPath(String(path || '').trim());
      if (v === undefined) return full;
      return formatStatValue(v);
    });
  }

  window.天青_stat_data = {
    getStatData: getStatData,
    getByPath: getByPath,
    formatStatValue: formatStatValue,
    substituteStatDataMacros: substituteStatDataMacros,
  };
})();
