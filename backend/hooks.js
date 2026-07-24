/**
 * 主线 <summernight_hook> 分发
 * 对外：window.天青_hooks
 */
(function () {
  var DEFAULT_LINE_CHAT = 'tianqing';

  function parseHooks(raw) {
    if (window.天青_parse && typeof window.天青_parse.parseSummernightHooks === 'function') {
      return window.天青_parse.parseSummernightHooks(raw);
    }
    return [];
  }

  async function runLineHook(hookText, chatId) {
    var gen = window.天青_phone_line_generate;
    if (!gen || typeof gen.generateFromHook !== 'function') {
      console.warn('[hooks] LINE 生成模块未就绪');
      return null;
    }
    return gen.generateFromHook(chatId || DEFAULT_LINE_CHAT, hookText);
  }

  async function runTwitterHook(hookText) {
    var gen = window.天青_phone_twitter_generate;
    if (!gen || typeof gen.generateFromHook !== 'function') {
      console.warn('[hooks] Twitter 生成模块未就绪');
      return null;
    }
    return gen.generateFromHook(hookText);
  }

  /**
   * 解析 AI 原文中的钩子并异步执行（不阻塞主线）
   * @param {string} raw
   */
  async function dispatchFromRaw(raw) {
    var hooks = parseHooks(raw);
    if (!hooks.length) return [];

    var results = [];
    for (var i = 0; i < hooks.length; i++) {
      var h = hooks[i];
      if (!h || !h.app) continue;
      if (h.app === 'line') {
        console.info('[hooks] LINE 钩子', h.text);
        results.push(await runLineHook(h.text));
      } else if (h.app === 'twitter') {
        console.info('[hooks] Twitter 钩子', h.text);
        results.push(await runTwitterHook(h.text));
      } else {
        console.info('[hooks] 未实现的 App 钩子:', h.app, h.text);
      }
    }
    return results;
  }

  window.天青_hooks = {
    dispatchFromRaw: dispatchFromRaw,
    parseHooks: parseHooks,
  };
})();
