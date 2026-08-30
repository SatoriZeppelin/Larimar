/**
 * 主线 <summernight_hook> 分发
 * 对外：window.天青_hooks
 */
(function () {
  var DEFAULT_LINE_CHAT = 'tianqing';

  var APP_LABELS = {
    line: 'LINE',
    twitter: 'Twitter',
    twitch: 'Twitch',
    agency: '事务所',
  };

  function parseHooks(raw) {
    if (window.天青_parse && typeof window.天青_parse.parseSummernightHooks === 'function') {
      return window.天青_parse.parseSummernightHooks(raw);
    }
    return [];
  }

  function appLabel(app) {
    var key = String(app || '')
      .trim()
      .toLowerCase();
    if (APP_LABELS[key]) return APP_LABELS[key];
    if (!key) return 'APP';
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function isRunnableHook(h) {
    if (!h || !h.app) return false;
    if (h.app === 'line') {
      return !!(window.天青_phone_line_generate && window.天青_phone_line_generate.generateFromHook);
    }
    if (h.app === 'twitter') {
      return !!(window.天青_phone_twitter_generate && window.天青_phone_twitter_generate.generateFromHook);
    }
    if (h.app === 'twitch') {
      return !!(window.天青_phone_twitch_generate && window.天青_phone_twitch_generate.generateFromHook);
    }
    return false;
  }

  function setAppProgress(active, index, total, app) {
    if (window.天青_app && typeof window.天青_app.setAppGenerating === 'function') {
      window.天青_app.setAppGenerating(
        active
          ? { active: true, index: index, total: total, appName: appLabel(app) }
          : { active: false },
      );
    }
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

  async function runTwitchHook(hookText) {
    var gen = window.天青_phone_twitch_generate;
    if (!gen || typeof gen.generateFromHook !== 'function') {
      console.warn('[hooks] Twitch 生成模块未就绪');
      return null;
    }
    return gen.generateFromHook(hookText);
  }

  /**
   * 解析 AI 原文中的钩子并异步执行（不阻塞主线）
   * 主线生成结束后左上角显示：正在生成APPX/n
   * @param {string} raw
   */
  async function dispatchFromRaw(raw) {
    var hooks = parseHooks(raw).filter(isRunnableHook);
    if (!hooks.length) return [];

    var total = hooks.length;
    var results = [];
    try {
      for (var i = 0; i < hooks.length; i++) {
        var h = hooks[i];
        var index = i + 1;
        setAppProgress(true, index, total, h.app);
        console.info('[hooks] ' + appLabel(h.app) + ' 钩子 ' + index + '/' + total, h.text);
        try {
          if (h.app === 'line') {
            results.push(await runLineHook(h.text));
          } else if (h.app === 'twitter') {
            results.push(await runTwitterHook(h.text));
          } else if (h.app === 'twitch') {
            results.push(await runTwitchHook(h.text));
          }
        } catch (e) {
          console.warn('[hooks] ' + appLabel(h.app) + ' 生成失败', e);
          results.push(null);
        }
      }
    } finally {
      setAppProgress(false);
    }
    return results;
  }

  window.天青_hooks = {
    dispatchFromRaw: dispatchFromRaw,
    parseHooks: parseHooks,
    appLabel: appLabel,
  };
})();
