/**
 * Twitter / X · LLM 生成（主线 hook）
 * 组装同 LINE 钩子：预设 + 主线最近 1 轮总结 + 系统设置-手机-Twitter 提示词
 * 对外：window.天青_phone_twitter_generate
 */
(function () {
  var generating = false;

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
      return;
    }
    console.info('[Twitter]', msg);
  }

  function logPhoneAiReply(source, raw, summary, detail) {
    if (window.天青_chat && typeof window.天青_chat.logAiReply === 'function') {
      window.天青_chat.logAiReply(raw, null, {
        source: source,
        summary: summary || '',
        detail: detail,
      });
      return;
    }
    console.info('[SummerNight Plus] AI 回复 · ' + source + (summary ? ' · ' + summary : ''));
    console.log(String(raw == null ? '' : raw));
  }

  function resolveUserName() {
    try {
      if (window.天青_persona && window.天青_persona.load) {
        var d = window.天青_persona.load();
        if (d && String(d.name || '').trim()) return String(d.name).trim();
      }
    } catch (e) {}
    var el = document.getElementById('cfg-user-name');
    if (el && String(el.value || '').trim()) return String(el.value).trim();
    return '制作人';
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    return n < 10 ? '0' + n : String(n);
  }

  function readGameParts() {
    var lineApi = window.天青_phone_line;
    if (lineApi && typeof lineApi.readGameParts === 'function') return lineApi.readGameParts();
    return { day: 1, h: 16, m: 0, weekday: '' };
  }

  function formatGameTimeLabel() {
    var g = readGameParts();
    var parts = ['第' + g.day + '天'];
    if (g.weekday) parts.push(g.weekday);
    parts.push(pad2(g.h) + ':' + pad2(g.m));
    return parts.join(' ');
  }

  function fillTwitterPrompt(opts) {
    opts = opts || {};
    var hookText = String(opts.hook || '').trim();
    var phoneSys = window.天青_settings_phone_sys;
    var tpl =
      phoneSys && typeof phoneSys.getPrompt === 'function' ? phoneSys.getPrompt('twitter') : '';
    if (!tpl) {
      console.warn('[Twitter] 未找到系统设置 · 手机 · Twitter 提示词');
      return '';
    }
    var user = resolveUserName();
    var timeLabel = formatGameTimeLabel();
    var hasTimeMacro = /\{\{\s*(time|game_time|line_time)\s*\}\}/i.test(tpl);
    var out = String(tpl)
      .replace(/\{\{\s*user\s*\}\}/g, user)
      .replace(/\{\{\s*hook\s*\}\}/g, hookText)
      .replace(/\{\{\s*(time|game_time|line_time)\s*\}\}/gi, timeLabel)
      .replace(/\{\{\s*recent\s*\}\}/g, '')
      .replace(/\{\{\s*message\s*\}\}/g, hookText);
    if (hookText && out.indexOf(hookText) < 0 && !/\{\{\s*hook\s*\}\}/.test(tpl)) {
      out = out.trim() + '\n\n[本回合钩子]\n' + hookText;
    }
    if (!hasTimeMacro) {
      out = '[当前游戏时间]\n' + timeLabel + '\n\n' + out.trim();
    }
    return out;
  }

  function avatarSvg(name, color) {
    var initial = String(name || '?').charAt(0);
    var c = color || '#1d9bf0';
    return (
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect width="64" height="64" rx="32" fill="' +
          c +
          '"/>' +
          '<text x="32" y="40" text-anchor="middle" fill="#fff" font-size="26" font-family="sans-serif" font-weight="700">' +
          initial +
          '</text></svg>',
      )
    );
  }

  function tqAvatar() {
    var map = window.天青_avatars;
    if (map && map['微笑']) return map['微笑'];
    if (map && map['高兴']) return map['高兴'];
    return 'https://files.catbox.moe/08zgoe.jpg';
  }

  var AVATAR_COLORS = ['#0ea5e9', '#64748b', '#f472b6', '#8b5cf6', '#22c55e', '#f59e0b', '#94a3b8', '#6366f1'];

  function colorFor(handle) {
    var s = String(handle || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function isOfficialAccount(name, handle) {
    var h = String(handle || '').toLowerCase();
    var n = String(name || '');
    return h === 'larimar_official' || /天青|larimar/i.test(n);
  }

  function normalizeTime(raw) {
    var s = String(raw || '')
      .trim()
      .replace(/^\[|\]$/g, '');
    var m = s.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
    if (!m) return { label: s || '刚刚', h: null, min: null };
    var h = Math.max(0, Math.min(23, parseInt(m[1], 10) || 0));
    var min = Math.max(0, Math.min(59, parseInt(m[2], 10) || 0));
    return { label: pad2(h) + ':' + pad2(min), h: h, min: min };
  }

  function formatTimeFull(h, min) {
    var g = readGameParts();
    var hh = h != null ? h : g.h;
    var mm = min != null ? min : g.m;
    var period = hh < 12 ? '上午' : '下午';
    var displayH = hh % 12;
    if (displayH === 0) displayH = 12;
    return period + ' ' + displayH + ':' + pad2(mm) + ' · 第' + g.day + '天';
  }

  function parseCount(raw) {
    var s = String(raw == null ? '' : raw)
      .trim()
      .replace(/,/g, '')
      .replace(/\s+/g, '');
    if (!s) return 0;
    var m = s.match(/^([\d.]+)\s*([kKmMbB万千]?)$/);
    if (!m) {
      var n = parseInt(s, 10);
      return isNaN(n) ? 0 : Math.max(0, n);
    }
    var num = parseFloat(m[1]);
    if (isNaN(num)) return 0;
    var u = m[2] || '';
    if (u === 'k' || u === 'K' || u === '千') return Math.round(num * 1000);
    if (u === 'm' || u === 'M') return Math.round(num * 1000000);
    if (u === 'b' || u === 'B') return Math.round(num * 1000000000);
    if (u === '万') return Math.round(num * 10000);
    return Math.max(0, Math.round(num));
  }

  function parseTagLine(raw) {
    var s = String(raw || '').trim();
    /* 支持 126 / 2.3k / 1.2万 等热度写法 */
    var m = s.match(
      /^(.*?)\s*\|\s*([\d.]+[kKmMbB万千]?)\s*\|\s*([\d.]+[kKmMbB万千]?)\s*\|\s*([\d.]+[kKmMbB万千]?)\s*$/,
    );
    if (!m) {
      return { tags: s, reposts: 0, likes: 0, replies: 0 };
    }
    return {
      tags: String(m[1] || '').trim(),
      reposts: parseCount(m[2]),
      likes: parseCount(m[3]),
      replies: parseCount(m[4]),
    };
  }

  function parseMetaLine(line) {
    var parts = String(line || '')
      .split('|')
      .map(function (p) {
        return String(p || '').trim();
      });
    if (parts.length < 4) return null;
    return {
      name: parts[0],
      handle: parts[1].replace(/^@/, ''),
      timeRaw: parts[2],
      views: parts.slice(3).join('|'),
    };
  }

  function parseCommentLine(line) {
    var parts = String(line || '')
      .split('|')
      .map(function (p) {
        return String(p || '').trim();
      });
    if (parts.length < 3) return null;
    var name = parts[0];
    var handle = parts[1].replace(/^@/, '');
    var text = parts.slice(2).join('|');
    if (!name || !handle || !text) return null;
    return { name: name, handle: handle, text: text };
  }

  /**
   * 解析 <twitter_message> / <twitter_account>
   * @returns {Array<object>}
   */
  function parseTwitterMessage(raw) {
    var text = String(raw == null ? '' : raw);
    var block = text.match(/<twitter_message\b[^>]*>([\s\S]*?)<\/twitter_message>/i);
    var body = block ? block[1] : text;
    var accounts = [];
    var reAcc = /<twitter_account\b[^>]*>([\s\S]*?)<\/twitter_account>/gi;
    var am;
    var stamp = Date.now();
    while ((am = reAcc.exec(body))) {
      var inner = am[1];
      var ctxM = inner.match(/<twitter_context\b[^>]*>([\s\S]*?)<\/twitter_context>/i);
      var tagM = inner.match(/<twitter_tag\b[^>]*>([\s\S]*?)<\/twitter_tag>/i);
      var ctx = ctxM ? String(ctxM[1] || '').trim() : '';
      var tagInfo = parseTagLine(tagM ? tagM[1] : '');
      var withoutTags = inner
        .replace(/<twitter_context\b[^>]*>[\s\S]*?<\/twitter_context>/gi, '\n')
        .replace(/<twitter_tag\b[^>]*>[\s\S]*?<\/twitter_tag>/gi, '\n');
      var lines = withoutTags
        .split(/\n+/)
        .map(function (l) {
          return String(l || '').trim();
        })
        .filter(Boolean);

      var meta = null;
      var comments = [];
      lines.forEach(function (line) {
        if (!meta) {
          var maybe = parseMetaLine(line);
          if (maybe) {
            meta = maybe;
            return;
          }
        }
        var c = parseCommentLine(line);
        if (c) comments.push(c);
      });
      if (!meta || !ctx) continue;

      var tm = normalizeTime(meta.timeRaw);
      var tags = tagInfo.tags;
      var textOut = ctx;
      if (tags) {
        var tagBits = tags.split(/\s+/).filter(Boolean);
        tagBits.forEach(function (tg) {
          if (textOut.indexOf(tg) < 0) textOut += (textOut ? ' ' : '') + tg;
        });
      }

      var official = isOfficialAccount(meta.name, meta.handle);
      var commentsOut = comments.slice(0, 7).map(function (c, i) {
        var off = isOfficialAccount(c.name, c.handle);
        return {
          id: 'c_' + stamp + '_' + accounts.length + '_' + i,
          name: c.name,
          handle: c.handle,
          avatar: off ? tqAvatar() : avatarSvg(c.name, colorFor(c.handle)),
          verified: off,
          text: c.text,
          time: '刚刚',
          likes: 0,
        };
      });

      accounts.push({
        id: 'tw_gen_' + stamp + '_' + accounts.length,
        name: meta.name,
        handle: meta.handle,
        avatar: official ? tqAvatar() : avatarSvg(meta.name, colorFor(meta.handle)),
        verified: official,
        text: textOut,
        time: tm.label || '刚刚',
        timeFull: formatTimeFull(tm.h, tm.min),
        replies: Math.max(tagInfo.replies, commentsOut.length),
        reposts: tagInfo.reposts,
        likes: tagInfo.likes,
        views: meta.views || '0',
        comments: commentsOut,
      });
    }
    return accounts;
  }

  function applyTweets(tweets, bindIndex) {
    var api = window.天青_phone_twitter;
    if (!api || typeof api.prependTweets !== 'function') {
      console.warn('[Twitter] 前端模块未就绪');
      return;
    }
    api.prependTweets(tweets, bindIndex);
  }

  function bindIndexStillValid(bindIndex) {
    try {
      if (!window.天青_save || !window.天青_save.load) return false;
      var msgs = window.天青_save.load().messages || [];
      return !!(msgs[bindIndex] && msgs[bindIndex].role === 'assistant');
    } catch (e) {
      return false;
    }
  }

  function getBindIndex() {
    if (window.天青_phone && typeof window.天青_phone.getCurrentMainAsstIndex === 'function') {
      return window.天青_phone.getCurrentMainAsstIndex();
    }
    if (window.天青_phone_twitter && typeof window.天青_phone_twitter.getCurrentMainAsstIndex === 'function') {
      return window.天青_phone_twitter.getCurrentMainAsstIndex();
    }
    return -1;
  }

  /**
   * 主线 <summernight_hook><twitter|…> 触发
   */
  async function generateFromHook(hookText) {
    if (!String(hookText || '').trim()) return null;
    if (generating) {
      console.warn('[Twitter] 正在生成中，跳过钩子');
      return null;
    }
    if (!window.天青_prompt_builder || !(window.天青_prompt_builder.buildTwitterHookChatMessages || window.天青_prompt_builder.buildLineHookChatMessages)) {
      console.warn('[Twitter] 钩子：提示词组装模块未加载');
      return null;
    }
    if (!window.天青_api || !window.天青_api.chat) {
      console.warn('[Twitter] 钩子：API 未连接');
      return null;
    }

    var bindIndex = getBindIndex();

    if (window.天青_tokens && window.天青_tokens.ensureReady) {
      try {
        var model =
          window.天青_api && window.天青_api.loadConfig ? window.天青_api.loadConfig().model : '';
        await window.天青_tokens.ensureReady(model);
      } catch (e) {
        console.warn('[Twitter] 钩子：tokenizer 预加载失败', e);
      }
    }

    var filled = fillTwitterPrompt({ hook: hookText });
    if (!filled) {
      console.warn('[Twitter] 钩子：Twitter 提示词为空');
      return null;
    }

    generating = true;
    try {
      var messages =
        window.天青_prompt_builder.buildTwitterHookChatMessages
          ? window.天青_prompt_builder.buildTwitterHookChatMessages({ twitterPrompt: filled })
          : window.天青_prompt_builder.buildLineHookChatMessages({ linePrompt: filled });
      console.info(
        '[Twitter] 钩子调用 LLM · messages=',
        messages.length,
        '· hook=',
        String(hookText).slice(0, 80),
      );
      var raw = await window.天青_api.chat({ messages: messages });
      if (window.天青_regex && window.天青_regex.applyAiOutput) {
        raw = window.天青_regex.applyAiOutput(raw);
      }
      var tweets = parseTwitterMessage(raw);
      logPhoneAiReply('Twitter 钩子', raw, 'tweets=' + tweets.length, tweets);
      if (!bindIndexStillValid(bindIndex)) {
        console.info('[Twitter] 钩子：主线已回退，丢弃本轮结果');
        return { raw: raw, tweets: [], discarded: true };
      }
      if (!tweets.length) {
        console.warn('[Twitter] 钩子：未解析到 <twitter_message>', raw);
        return { raw: raw, tweets: [] };
      }
      applyTweets(tweets, bindIndex);
      toast('Twitter 有新动态');
      return { raw: raw, tweets: tweets };
    } catch (err) {
      console.error('[Twitter] 钩子生成失败', err);
      return null;
    } finally {
      generating = false;
    }
  }

  window.天青_phone_twitter_generate = {
    fillTwitterPrompt: fillTwitterPrompt,
    parseTwitterMessage: parseTwitterMessage,
    generateFromHook: generateFromHook,
    isGenerating: function () {
      return generating;
    },
  };
})();
