/**
 * 主线 <summernight_hook> 分发（一级 / 二级）
 * 对外：window.天青_hooks
 */
(function () {
  var DEFAULT_LINE_CHAT = 'tianqing';
  var dispatchDepth = 0;

  var APP_LABELS = {
    line: 'LINE',
    twitter: 'Twitter',
    twitch: 'Twitch',
    agency: 'HOOK',
  };

  function parseHooks(raw) {
    if (window.天青_parse && typeof window.天青_parse.parseSummernightHooks === 'function') {
      return window.天青_parse.parseSummernightHooks(raw);
    }
    return [];
  }

  function stripHookBlock(raw) {
    return String(raw == null ? '' : raw).replace(
      /<summernight_hook\b[\s\S]*?<\/summernight_hook>/gi,
      '',
    );
  }

  function resolveUserName() {
    try {
      if (window.天青_persona && typeof window.天青_persona.getName === 'function') {
        var n = window.天青_persona.getName();
        if (n) return String(n);
      }
    } catch (e) {}
    return '制作人';
  }

  /** 一级 App 生成：在 LINE / Twitter / Twitch 提示词后附带 HOOK 词条 */
  function appendPrimaryHookPrompt(appPrompt) {
    var phoneSys = window.天青_settings_phone_sys;
    var tpl =
      phoneSys && typeof phoneSys.getPrompt === 'function' ? phoneSys.getPrompt('agency') : '';
    tpl = String(tpl || '').trim();
    if (!tpl) return String(appPrompt || '');
    var addon = tpl.replace(/\{\{\s*user\s*\}\}/g, resolveUserName());
    return String(appPrompt || '').trim() + '\n\n' + addon;
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

  async function runLineHook(hookText, secondary) {
    var gen = window.天青_phone_line_generate;
    if (!gen || typeof gen.generateFromHook !== 'function') {
      console.warn('[hooks] LINE 生成模块未就绪');
      return null;
    }
    return gen.generateFromHook(DEFAULT_LINE_CHAT, hookText, { secondary: !!secondary });
  }

  async function runTwitterHook(hookText, secondary) {
    var gen = window.天青_phone_twitter_generate;
    if (!gen || typeof gen.generateFromHook !== 'function') {
      console.warn('[hooks] Twitter 生成模块未就绪');
      return null;
    }
    return gen.generateFromHook(hookText, { secondary: !!secondary });
  }

  async function runTwitchHook(hookText, secondary) {
    var gen = window.天青_phone_twitch_generate;
    if (!gen || typeof gen.generateFromHook !== 'function') {
      console.warn('[hooks] Twitch 生成模块未就绪');
      return null;
    }
    return gen.generateFromHook(hookText, { secondary: !!secondary });
  }

  /**
   * 解析 AI 原文中的钩子并异步执行（不阻塞主线）
   * secondary: true → 二级，不再附带 HOOK、也不再向下派发
   * @param {string} raw
   * @param {{ secondary?: boolean }} [opts]
   */
  async function dispatchFromRaw(raw, opts) {
    opts = opts || {};
    var secondary = !!opts.secondary;
    var hooks = parseHooks(raw).filter(isRunnableHook);
    if (!hooks.length) return [];

    var total = hooks.length;
    var results = [];
    dispatchDepth += 1;
    try {
      for (var i = 0; i < hooks.length; i++) {
        var h = hooks[i];
        var index = i + 1;
        setAppProgress(true, index, total, h.app);
        console.info(
          '[hooks] ' +
            (secondary ? '二级 ' : '') +
            appLabel(h.app) +
            ' 钩子 ' +
            index +
            '/' +
            total,
          h.text,
        );
        try {
          if (h.app === 'line') {
            results.push(await runLineHook(h.text, secondary));
          } else if (h.app === 'twitter') {
            results.push(await runTwitterHook(h.text, secondary));
          } else if (h.app === 'twitch') {
            results.push(await runTwitchHook(h.text, secondary));
          }
        } catch (e) {
          console.warn('[hooks] ' + appLabel(h.app) + ' 生成失败', e);
          results.push(null);
        }
      }
    } finally {
      dispatchDepth -= 1;
      if (dispatchDepth < 1) {
        dispatchDepth = 0;
        setAppProgress(false);
      }
    }
    return results;
  }

  /** 一级 App 文段里的钩子 → 二级生成（不再附带 HOOK） */
  async function dispatchSecondaryFromRaw(raw) {
    return dispatchFromRaw(raw, { secondary: true });
  }

  window.天青_hooks = {
    dispatchFromRaw: dispatchFromRaw,
    dispatchSecondaryFromRaw: dispatchSecondaryFromRaw,
    parseHooks: parseHooks,
    stripHookBlock: stripHookBlock,
    appendPrimaryHookPrompt: appendPrimaryHookPrompt,
    appLabel: appLabel,
  };
})();
