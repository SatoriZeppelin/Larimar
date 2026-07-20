/**
 * 游戏状态（替代酒馆 MVU）
 *
 * 旧版 gal 从 SillyTavern 的 MVU 变量读：地点 / 时段 / 天数 / 名气.阶段
 * Plus 版自己在浏览器里维护这份状态，并在提示词里注入给 AI。
 *
 * 对外：window.天青_state
 */
(function () {
  var KEY = 'tq_plus_state';
  var DEFAULTS = {
    天数: 1,
    时段: '午后',
    地点: '校园',
    阶段: '地下偶像期',
    playerName: '旅人',
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }

  var state = load();

  function get() {
    return Object.assign({}, state);
  }

  function set(patch) {
    Object.assign(state, patch || {});
    if (state.地点) state.地点 = cleanLoc(state.地点);
    save(state);
    return get();
  }

  function reset() {
    state = Object.assign({}, DEFAULTS);
    save(state);
    return get();
  }

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

  /** 塞进 system / user 提示词的状态摘要 */
  function promptBlock() {
    var s = get();
    return (
      '【当前世界状态】\n' +
      '天数: ' +
      s.天数 +
      '\n时段: ' +
      s.时段 +
      '\n地点: ' +
      s.地点 +
      '\n名气阶段: ' +
      s.阶段 +
      '\n玩家称呼: ' +
      s.playerName
    );
  }

  window.天青_state = {
    DEFAULTS: DEFAULTS,
    get: get,
    set: set,
    reset: reset,
    cleanLoc: cleanLoc,
    promptBlock: promptBlock,
  };
})();
