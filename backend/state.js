/**
 * 地点名清洗等小工具（旧版 tq_plus_state 世界状态已废弃）
 * 世界状态权威：系统设置·变量（stat_data）+ 用户设定
 * 对外：window.天青_state
 */
(function () {
  var LEGACY_KEY = 'tq_plus_state';

  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) {}

  /** 剥掉 AI 可能误写的「咖啡馆·夜晚」时段后缀 */
  function cleanLoc(s) {
    if (s == null || s === '') return s;
    return (
      String(s)
        .trim()
        .replace(/[·・.\-\/\s]*(白日|黄昏|夜晚|清晨|上午|午后|傍晚|深夜)$/, '')
        .trim() || String(s).trim()
    );
  }

  /** 由 时间.具体时间 的小时换算背景段：白日 / 黄昏 / 夜晚 */
  function bandFromHour(h) {
    h = parseInt(h, 10);
    if (isNaN(h)) return '白日';
    h = ((h % 24) + 24) % 24;
    if (h >= 5 && h < 17) return '白日';
    if (h >= 17 && h < 19) return '黄昏';
    return '夜晚';
  }

  function getLocation() {
    var api = window.天青_stat_data;
    var loc = '';
    if (api && typeof api.getByPath === 'function') {
      var v = api.getByPath('地点');
      if (v != null && String(v).trim()) loc = String(v).trim();
    }
    return cleanLoc(loc) || '校园';
  }

  function getTimeBand() {
    var api = window.天青_stat_data;
    if (api && typeof api.getByPath === 'function') {
      var t = api.getByPath('时间.具体时间');
      if (Array.isArray(t) && t.length) return bandFromHour(t[0]);
      if (typeof t === 'number') return bandFromHour(t);
    }
    return '白日';
  }

  function setLocation(loc) {
    var next = cleanLoc(loc);
    if (!next) return getLocation();
    var vars = window.天青_settings_variable;
    if (vars && typeof vars.get === 'function' && typeof vars.set === 'function') {
      var d = vars.get() || {};
      if (typeof d !== 'object' || Array.isArray(d)) d = {};
      d.地点 = next;
      vars.set(d);
    }
    return next;
  }

  /** @deprecated 旧 promptBlock 已移除，避免再注入冲突的天数/时段/阶段/旅人 */
  function promptBlock() {
    return '';
  }

  window.天青_state = {
    cleanLoc: cleanLoc,
    bandFromHour: bandFromHour,
    getLocation: getLocation,
    getTimeBand: getTimeBand,
    setLocation: setLocation,
    promptBlock: promptBlock,
  };
})();
