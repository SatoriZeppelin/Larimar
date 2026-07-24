/**
 * LINE 私聊 · LLM 生成
 * 组装：预设 + 角色世界书 + 系统设置-手机-LINE 提示词
 * 对外：window.天青_phone_line_generate
 */
(function () {
  var generating = false;
  var STICKER_NAMES = null;

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
      return;
    }
    console.info('[LINE]', msg);
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

  function stickerNameSet() {
    if (STICKER_NAMES) return STICKER_NAMES;
    var map = {};
    var stickers = window.天青_stickers && typeof window.天青_stickers === 'object' ? window.天青_stickers : {};
    Object.keys(stickers).forEach(function (k) {
      map[k] = true;
    });
    var api = window.天青_sticker_groups;
    if (api && api.getGroups) {
      (api.getGroups() || []).forEach(function (g) {
        (g.stickers || []).forEach(function (n) {
          map[n] = true;
        });
      });
    }
    STICKER_NAMES = map;
    return map;
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

  function getLineApi() {
    return window.天青_phone_line || null;
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    return n < 10 ? '0' + n : String(n);
  }

  /** 当前游戏时间文案：第N天 星期X HH:MM */
  function formatGameTimeLabel() {
    var g = lineApiReadGame();
    var parts = ['第' + g.day + '天'];
    if (g.weekday) parts.push(g.weekday);
    parts.push(pad2(g.h) + ':' + pad2(g.m));
    return parts.join(' ');
  }

  /** 填充 LINE 提示词占位符（仅私聊）；并确保带上当前游戏时间 */
  function fillLinePrompt(chat, opts) {
    opts = opts || {};
    var hookText = String(opts.hook || '').trim();
    var phoneSys = window.天青_settings_phone_sys;
    var tpl =
      phoneSys && typeof phoneSys.getPrompt === 'function' ? phoneSys.getPrompt('line') : '';
    if (!tpl) {
      console.warn('[LINE] 未找到系统设置 · 手机 · LINE 提示词');
      return '';
    }
    var lineApi = getLineApi();
    var recent =
      lineApi && lineApi.buildLineRecentMessage
        ? lineApi.buildLineRecentMessage(chat)
        : '（暂无对话）';
    var user = resolveUserName();
    var timeLabel = formatGameTimeLabel();
    var hasTimeMacro = /\{\{\s*(time|game_time|line_time)\s*\}\}/i.test(tpl);
    var out = String(tpl)
      .replace(/\{\{\s*line_recent_message\s*\}\}/g, recent)
      .replace(/\{\{\s*user\s*\}\}/g, user)
      .replace(/\{\{\s*hook\s*\}\}/g, hookText)
      .replace(/\{\{\s*(time|game_time|line_time)\s*\}\}/gi, timeLabel);
    if (hookText && out.indexOf(hookText) < 0 && !/\{\{\s*hook\s*\}\}/.test(tpl)) {
      out = out.trim() + '\n\n[本回合钩子]\n' + hookText;
    }
    /* 模板未写时间宏时，自动前置当前游戏时间 */
    if (!hasTimeMacro) {
      out = '[当前游戏时间]\n' + timeLabel + '\n\n' + out.trim();
    }
    return out;
  }

  /**
   * 解析 <line_message> / <角色|内容|HH:MM>
   * @returns {Array<{name:string,text?:string,type?:string,sticker?:string,day:*,h:number,m:number,me:false}>}
   */
  function parseLineMessage(raw, fallbackDay) {
    var text = String(raw == null ? '' : raw);
    var block = text.match(/<line_message\b[^>]*>([\s\S]*?)<\/line_message>/i);
    var body = block ? block[1] : text;
    var day = fallbackDay != null ? fallbackDay : 1;
    var stickers = stickerNameSet();
    var items = [];
    var re = /<\s*([^|>\n]+)\s*\|\s*([^|>\n]*?)\s*(?:\|\s*([^|>\n]*?))?\s*>/g;
    var m;
    while ((m = re.exec(body))) {
      var who = String(m[1] || '').trim();
      var content = String(m[2] || '')
        .replace(/#.*$/, '')
        .trim();
      var timeStr = String(m[3] || '').trim();
      if (!who || !content) continue;
      var h = 0;
      var min = 0;
      var msgDay = day;
      var tm = timeStr.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
      if (tm) {
        h = Math.max(0, Math.min(23, parseInt(tm[1], 10) || 0));
        min = Math.max(0, Math.min(59, parseInt(tm[2], 10) || 0));
      } else {
        var g = lineApiReadGame();
        h = g.h;
        min = g.m;
        msgDay = g.day;
      }
      if (stickers[content]) {
        items.push({
          me: false,
          name: who,
          type: 'sticker',
          sticker: content,
          day: msgDay,
          h: h,
          m: min,
          sendStatus: 'sent',
        });
      } else {
        items.push({
          me: false,
          name: who,
          text: content,
          day: msgDay,
          h: h,
          m: min,
          sendStatus: 'sent',
        });
      }
    }
    return items;
  }

  function lineApiReadGame() {
    var lineApi = getLineApi();
    if (lineApi && typeof lineApi.readGameParts === 'function') return lineApi.readGameParts();
    return { day: 1, h: 16, m: 0 };
  }

  function appendInboundMessages(chatId, items, bindIndex) {
    var lineApi = getLineApi();
    if (!lineApi || !lineApi.appendInboundMessages) return;
    lineApi.appendInboundMessages(chatId, items, bindIndex);
  }

  function getBindIndex() {
    if (window.天青_phone && typeof window.天青_phone.getCurrentMainAsstIndex === 'function') {
      return window.天青_phone.getCurrentMainAsstIndex();
    }
    if (window.天青_phone_line && typeof window.天青_phone_line.getCurrentMainAsstIndex === 'function') {
      return window.天青_phone_line.getCurrentMainAsstIndex();
    }
    return -1;
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

  /**
   * 私聊生成一轮回复
   * @param {string} chatId
   * @returns {Promise<{raw:string,items:Array}|null>}
   */
  async function generateDmReply(chatId) {
    if (!chatId) return null;
    if (generating) {
      console.warn('[LINE] 正在生成中，跳过重复请求');
      return null;
    }

    var lineApi = getLineApi();
    if (!lineApi || !lineApi.loadStore) {
      toast('LINE 模块未就绪');
      return null;
    }
    var store = lineApi.loadStore();
    var chat = store.chats && store.chats[chatId];
    if (!chat) {
      toast('找不到会话');
      return null;
    }
    if (chat.type === 'group') {
      console.warn('[LINE] generateDmReply：群聊暂不调用 LLM');
      return null;
    }
    if (!window.天青_prompt_builder || !window.天青_prompt_builder.buildLineChatMessages) {
      toast('提示词组装模块未加载');
      return null;
    }
    if (!window.天青_api || !window.天青_api.chat) {
      toast('API 未连接');
      return null;
    }

    var bindIndex = getBindIndex();
    var filled = fillLinePrompt(chat);
    if (!filled) {
      toast('LINE 提示词为空');
      return null;
    }

    generating = true;
    try {
      var messages = window.天青_prompt_builder.buildLineChatMessages({
        linePrompt: filled,
        scanText: filled,
      });
      console.info('[LINE] 调用 LLM · messages=', messages.length);
      var raw = await window.天青_api.chat({ messages: messages });
      if (window.天青_regex && window.天青_regex.applyAiOutput) {
        raw = window.天青_regex.applyAiOutput(raw);
      }
      var g = lineApiReadGame();
      var items = parseLineMessage(raw, g.day);
      logPhoneAiReply('LINE', raw, 'items=' + items.length, items);
      if (!bindIndexStillValid(bindIndex)) {
        console.info('[LINE] 主线已回退，丢弃本轮结果');
        return { raw: raw, items: [], discarded: true };
      }
      if (!items.length) {
        console.warn('[LINE] 未解析到 <line_message> 条目', raw);
        toast('天青没有回上来…');
        return { raw: raw, items: [] };
      }
      /* 无时间戳时用游戏时间兜底 */
      items.forEach(function (it) {
        if (it.h == null || it.m == null) {
          it.h = g.h;
          it.m = g.m;
        }
        if (it.day == null) it.day = g.day;
      });
      appendInboundMessages(chatId, items, bindIndex);
      return { raw: raw, items: items };
    } catch (err) {
      console.error('[LINE] 生成失败', err);
      toast(String((err && err.message) || err || '生成失败'));
      return null;
    } finally {
      generating = false;
    }
  }

  /**
   * 主线 <summernight_hook><line|…> 触发
   * 组装：预设 + 主线最近 1 轮 + 系统设置-手机-LINE 提示词（含钩子）
   * @param {string} chatId
   * @param {string} hookText
   */
  async function generateFromHook(chatId, hookText) {
    if (!chatId || !String(hookText || '').trim()) return null;
    if (generating) {
      console.warn('[LINE] 正在生成中，跳过钩子');
      return null;
    }

    var lineApi = getLineApi();
    if (!lineApi || !lineApi.loadStore) {
      console.warn('[LINE] 钩子：LINE 模块未就绪');
      return null;
    }
    var store = lineApi.loadStore();
    var chat = store.chats && store.chats[chatId];
    if (!chat || chat.type === 'group') {
      console.warn('[LINE] 钩子：仅支持天青私聊');
      return null;
    }
    if (!window.天青_prompt_builder || !window.天青_prompt_builder.buildLineHookChatMessages) {
      console.warn('[LINE] 钩子：提示词组装模块未加载');
      return null;
    }
    if (!window.天青_api || !window.天青_api.chat) {
      console.warn('[LINE] 钩子：API 未连接');
      return null;
    }

    var bindIndex = getBindIndex();

    if (window.天青_tokens && window.天青_tokens.ensureReady) {
      try {
        var model =
          window.天青_api && window.天青_api.loadConfig ? window.天青_api.loadConfig().model : '';
        await window.天青_tokens.ensureReady(model);
      } catch (e) {
        console.warn('[LINE] 钩子：tokenizer 预加载失败', e);
      }
    }

    var filled = fillLinePrompt(chat, { hook: hookText });
    if (!filled) {
      console.warn('[LINE] 钩子：LINE 提示词为空');
      return null;
    }

    generating = true;
    try {
      var messages = window.天青_prompt_builder.buildLineHookChatMessages({
        linePrompt: filled,
      });
      console.info('[LINE] 钩子调用 LLM · messages=', messages.length, '· hook=', hookText.slice(0, 80));
      var raw = await window.天青_api.chat({ messages: messages });
      if (window.天青_regex && window.天青_regex.applyAiOutput) {
        raw = window.天青_regex.applyAiOutput(raw);
      }
      var g = lineApiReadGame();
      var items = parseLineMessage(raw, g.day);
      logPhoneAiReply('LINE 钩子', raw, 'items=' + items.length, items);
      if (!bindIndexStillValid(bindIndex)) {
        console.info('[LINE] 钩子：主线已回退，丢弃本轮结果');
        return { raw: raw, items: [], discarded: true };
      }
      if (!items.length) {
        console.warn('[LINE] 钩子：未解析到 <line_message>', raw);
        return { raw: raw, items: [] };
      }
      items.forEach(function (it) {
        if (it.h == null || it.m == null) {
          it.h = g.h;
          it.m = g.m;
        }
        if (it.day == null) it.day = g.day;
      });
      appendInboundMessages(chatId, items, bindIndex);
      return { raw: raw, items: items };
    } catch (err) {
      console.error('[LINE] 钩子生成失败', err);
      return null;
    } finally {
      generating = false;
    }
  }

  function isGenerating() {
    return generating;
  }

  window.天青_phone_line_generate = {
    fillLinePrompt: fillLinePrompt,
    parseLineMessage: parseLineMessage,
    generateDmReply: generateDmReply,
    generateFromHook: generateFromHook,
    isGenerating: isGenerating,
  };
})();
