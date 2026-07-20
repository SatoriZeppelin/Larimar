/**
 * 宏 / 键值统一注册表
 * 用法：天青_keys.register('producer', '实际名字')
 * 读取：天青_keys.get('producer') / 天青_keys.macro('producer') → {{producer}}
 * {{producer}} 与 {{user}} 等价（读写任一键会同步另一键）
 */
(function () {
  var store = Object.create(null);
  var ALIASES = {
    producer: 'user',
    user: 'producer',
  };

  function normalize(key) {
    return String(key || '')
      .replace(/^\{\{\s*/, '')
      .replace(/\s*\}\}$/, '')
      .trim();
  }

  function isUserAlias(k) {
    return k === 'producer' || k === 'user';
  }

  function register(key, value) {
    var k = normalize(key);
    if (!k) return '';
    var v = value == null ? '' : String(value);
    if (isUserAlias(k)) {
      store.producer = v;
      store.user = v;
      return k;
    }
    store[k] = v;
    return k;
  }

  function get(key) {
    var k = normalize(key);
    if (isUserAlias(k)) {
      if (store.producer != null && store.producer !== '') return store.producer;
      if (store.user != null) return store.user;
      return '';
    }
    return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : '';
  }

  function set(key, value) {
    return register(key, value);
  }

  function has(key) {
    var k = normalize(key);
    if (isUserAlias(k)) {
      return Object.prototype.hasOwnProperty.call(store, 'producer') || Object.prototype.hasOwnProperty.call(store, 'user');
    }
    return Object.prototype.hasOwnProperty.call(store, k);
  }

  /** 显示用宏名，如 {{producer}} */
  function macro(key) {
    return '{{' + normalize(key) + '}}';
  }

  function resolve(text) {
    return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, function (full, k) {
      if (isUserAlias(k)) {
        return has(k) ? get(k) : full;
      }
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : full;
    });
  }

  function all() {
    return Object.assign({}, store);
  }

  /** 是否与 producer/user 同族宏 */
  function isProducerAlias(key) {
    return isUserAlias(normalize(key));
  }

  /* —— 在此统一注册键值 —— */
  register('producer', '');
  register('user', '');

  window.天青_keys = {
    register: register,
    get: get,
    set: set,
    has: has,
    macro: macro,
    resolve: resolve,
    all: all,
    isProducerAlias: isProducerAlias,
    ALIASES: ALIASES,
  };
})();
