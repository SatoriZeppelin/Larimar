/**
 * Twitch · LLM 生成（主线 <summernight_hook><twitch|…>）
 * 对外：window.天青_phone_twitch_generate
 */
(function () {
  var generating = false;

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
      return;
    }
    console.info('[Twitch]', msg);
  }

  function appParseRaw(raw) {
    if (window.天青_hooks && typeof window.天青_hooks.stripHookBlock === 'function') {
      return window.天青_hooks.stripHookBlock(raw);
    }
    return raw;
  }

  async function dispatchSecondaryIfPrimary(raw, secondary) {
    if (secondary || !raw) return;
    if (!window.天青_hooks || typeof window.天青_hooks.dispatchSecondaryFromRaw !== 'function') return;
    try {
      await window.天青_hooks.dispatchSecondaryFromRaw(raw);
    } catch (e) {
      console.warn('[Twitch] 二级钩子失败', e);
    }
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
    var h = 21;
    var m = 0;
    var day = 1;
    var weekday = '';
    var api = window.天青_stat_data;
    if (api && api.getByPath) {
      var t = api.getByPath('时间.具体时间');
      var d = api.getByPath('时间.天数');
      var w = api.getByPath('时间.星期');
      if (Array.isArray(t) && t.length >= 2) {
        h = parseInt(t[0], 10) || 21;
        m = parseInt(t[1], 10) || 0;
      }
      if (d != null && d !== '') day = d;
      weekday = String(w || '').trim();
      if (weekday && weekday.indexOf('星期') !== 0) weekday = '星期' + weekday;
    }
    return { day: day, h: h, m: m, weekday: weekday };
  }

  function formatGameTimeLabel() {
    var g = readGameParts();
    var parts = ['第' + g.day + '天'];
    if (g.weekday) parts.push(g.weekday);
    parts.push(pad2(g.h) + ':' + pad2(g.m));
    return parts.join(' ');
  }

  function hourToBand(h) {
    h = parseInt(h, 10);
    if (isNaN(h)) return '夜晚';
    if (h >= 5 && h < 8) return '清晨';
    if (h >= 8 && h < 12) return '上午';
    if (h >= 12 && h < 17) return '午后';
    if (h >= 17 && h < 19) return '傍晚';
    if (h >= 19 && h < 23) return '夜晚';
    return '深夜';
  }

  function readFameStat(path, fallback) {
    var api = window.天青_stat_data;
    if (api && api.getByPath) {
      var v = api.getByPath(path);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return fallback;
  }

  function readFameSummary() {
    var twitter = readFameStat('名气.twitter', 0);
    var tongjie = readFameStat('名气.同接', 0);
    var albums = readFameStat('名气.专辑', []);
    var live = readFameStat('名气.Live', []);
    var agency = window.天青_phone_agency;
    var normAlbums =
      agency && typeof agency.normalizeAlbumList === 'function'
        ? agency.normalizeAlbumList(albums)
        : albums;
    var normLive =
      agency && typeof agency.normalizeLiveList === 'function'
        ? agency.normalizeLiveList(live)
        : live;
    var albumText =
      Array.isArray(normAlbums) && normAlbums.length
        ? normAlbums
            .map(function (row) {
              var sales = parseInt(row[1], 10) || 0;
              return row[0] + (sales ? '（首发 ' + sales + '）' : '');
            })
            .join('、')
        : '暂无';
    var liveText = '暂无';
    if (Array.isArray(normLive) && normLive.length) {
      var last = normLive[normLive.length - 1];
      liveText =
        normLive.length +
        ' 场（最近 ' +
        String(last[0] || '—') +
        ' ' +
        (parseInt(last[1], 10) || 0) +
        ' 人）';
    }
    return (
      'Twitter 粉丝 ' +
      twitter +
      '，直播同接 ' +
      tongjie +
      '，已发行专辑 ' +
      albumText +
      '，Live ' +
      liveText
    );
  }

  function fillTwitchPrompt(opts) {
    opts = opts || {};
    var hookText = String(opts.hook || '').trim();
    var phoneSys = window.天青_settings_phone_sys;
    var tpl =
      phoneSys && typeof phoneSys.getPrompt === 'function' ? phoneSys.getPrompt('twitch') : '';
    if (!tpl) {
      console.warn('[Twitch] 未找到系统设置 · 手机 · Twitch 提示词');
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
      .replace(/\{\{\s*message\s*\}\}/g, hookText)
      .replace(/\{\{\s*stage\s*\}\}/g, readFameSummary())
      .replace(/\{\{\s*twitter\s*\}\}/g, String(readFameStat('名气.twitter', 0)))
      .replace(/\{\{\s*同接\s*\}\}/g, String(readFameStat('名气.同接', 0)));
    if (hookText && out.indexOf(hookText) < 0 && !/\{\{\s*hook\s*\}\}/.test(tpl)) {
      out = out.trim() + '\n\n[本回合钩子]\n' + hookText;
    }
    if (!hasTimeMacro) {
      out = '[当前游戏时间]\n' + timeLabel + '\n\n' + out.trim();
    }
    if (!opts.secondary && window.天青_hooks && typeof window.天青_hooks.appendPrimaryHookPrompt === 'function') {
      out = window.天青_hooks.appendPrimaryHookPrompt(out);
    }
    return out;
  }

  function isDialogueText(text) {
    return /^「[\s\S]*」$/.test(String(text || '').trim());
  }

  /**
   * 解析 <twitch_message>…</twitch_message>
   * 支持：
   *   <live|形式|背景|标题>
   *   <dm|观众ID|内容>
   *   <sc|观众ID|金额|内容>
   *   <天青|表情|台词>
   *   <旁白|正文> 或 <旁白|-|正文>
   */
  function parseTwitchMessage(raw) {
    var text = String(raw == null ? '' : raw);
    var block = text.match(/<twitch_message>([\s\S]*?)<\/twitch_message>/i);
    var body = block ? block[1] : text;
    var session = {
      form: '杂谈',
      bg: '宿舍',
      title: '',
      band: hourToBand(readGameParts().h),
      expr: '微笑',
      modules: [],
    };

    var re = /<([^<>]+)>/g;
    var m;
    while ((m = re.exec(body))) {
      var inner = String(m[1] || '').trim();
      if (!inner) continue;
      var lower = inner.toLowerCase();
      if (lower === 'twitch_message' || lower === '/twitch_message') continue;

      var parts = inner.split('|');
      var head = String(parts[0] || '').trim();
      var headLower = head.toLowerCase();

      if (headLower === 'live' || headLower === 'meta') {
        if (parts[1]) session.form = String(parts[1]).trim() || session.form;
        if (parts[2]) session.bg = String(parts[2]).trim() || session.bg;
        if (parts[3]) session.title = String(parts[3]).trim();
        if (parts[4]) {
          var b = String(parts[4]).trim();
          if (/^(清晨|上午|午后|傍晚|夜晚|深夜|白日|黄昏)$/.test(b)) {
            session.band = b === '白日' ? '午后' : b;
          }
        }
        continue;
      }

      if (headLower === 'dm') {
        session.modules.push({
          type: 'dm',
          who: String(parts[1] || '观众').trim() || '观众',
          text: String(parts.slice(2).join('|') || '').trim(),
        });
        continue;
      }

      if (headLower === 'sc') {
        session.modules.push({
          type: 'sc',
          who: String(parts[1] || '观众').trim() || '观众',
          yen: parseInt(parts[2], 10) || 30,
          text: String(parts.slice(3).join('|') || '').trim(),
        });
        continue;
      }

      if (head === '旁白' || head === '旁白。') {
        var narr =
          parts.length >= 3
            ? String(parts.slice(2).join('|')).trim()
            : String(parts.slice(1).join('|')).trim();
        if (narr === '-') narr = '';
        if (!narr) continue;
        session.modules.push({
          type: 'line',
          who: '旁白',
          expr: '-',
          text: narr,
          dialogue: false,
        });
        continue;
      }

      if (head === '天青' || head === '制作人' || head === '同学' || head === '摄影师') {
        var expr = parts.length >= 3 ? String(parts[1] || '-').trim() : '-';
        var lineText =
          parts.length >= 3
            ? String(parts.slice(2).join('|')).trim()
            : String(parts.slice(1).join('|')).trim();
        if (!lineText) continue;
        session.modules.push({
          type: 'line',
          who: head,
          expr: expr || '-',
          text: lineText,
          dialogue: head === '天青' ? isDialogueText(lineText) || true : isDialogueText(lineText),
        });
        if (head === '天青' && expr && expr !== '-' && !session._firstExpr) {
          session.expr = expr;
          session._firstExpr = true;
        }
        continue;
      }
    }

    delete session._firstExpr;
    if (!session.modules.length) return null;
    return session;
  }

  function applySession(session, bindIndex) {
    var api = window.天青_phone_twitch;
    if (!api || typeof api.setLiveSession !== 'function') {
      console.warn('[Twitch] 前端模块未就绪');
      return;
    }
    api.setLiveSession(session, { bindIndex: bindIndex });
    if (typeof api.markUnread === 'function') api.markUnread(true);
    if (window.天青_phone && typeof window.天青_phone.refreshTwitchBadge === 'function') {
      window.天青_phone.refreshTwitchBadge();
    } else if (window.天青_phone && typeof window.天青_phone.refreshAllUnreadBadges === 'function') {
      window.天青_phone.refreshAllUnreadBadges();
    }
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
    return -1;
  }

  function buildManualRefreshHook() {
    var summary = '';
    try {
      if (window.天青_prompt_builder && typeof window.天青_prompt_builder.getLastMainChatTurnSummary === 'function') {
        var turns = window.天青_prompt_builder.getLastMainChatTurnSummary() || [];
        for (var i = turns.length - 1; i >= 0; i--) {
          var c = String((turns[i] && turns[i].content) || '').trim();
          if (!c || c.indexOf('（本轮暂无摘要）') >= 0) continue;
          summary = c.replace(/^\[本轮剧情摘要\]\s*/i, '').trim();
          if (summary) break;
        }
      }
    } catch (e) {}
    if (summary.length > 220) summary = summary.slice(0, 220) + '…';
    if (summary) {
      return (
        '玩家手动刷新 Twitch 直播：请根据最近剧情生成天青（Larimar）的一场短直播切片。最近剧情：' +
        summary
      );
    }
    return '玩家手动刷新 Twitch 直播：请生成与天青（Larimar）当前日常相关的一场短直播切片。';
  }

  async function runTwitchGeneration(hookText, sourceLabel, opts) {
    opts = opts || {};
    var secondary = !!opts.secondary;
    if (!String(hookText || '').trim()) return null;
    if (generating) {
      console.warn('[Twitch] 正在生成中，跳过');
      return null;
    }
    if (
      !window.天青_prompt_builder ||
      !(
        window.天青_prompt_builder.buildTwitchHookChatMessages ||
        window.天青_prompt_builder.buildTwitterHookChatMessages ||
        window.天青_prompt_builder.buildLineHookChatMessages
      )
    ) {
      console.warn('[Twitch] 提示词组装模块未加载');
      return null;
    }
    if (!window.天青_api || !window.天青_api.chat) {
      console.warn('[Twitch] API 未连接');
      return null;
    }

    var bindIndex = getBindIndex();

    if (window.天青_tokens && window.天青_tokens.ensureReady) {
      try {
        var model =
          window.天青_api && window.天青_api.resolveConfig
            ? window.天青_api.resolveConfig('twitch').model
            : window.天青_api && window.天青_api.loadConfig
              ? window.天青_api.loadConfig().model
              : '';
        await window.天青_tokens.ensureReady(model);
      } catch (e) {
        console.warn('[Twitch] tokenizer 预加载失败', e);
      }
    }

    var filled = fillTwitchPrompt({ hook: hookText, secondary: secondary });
    if (!filled) {
      console.warn('[Twitch] Twitch 提示词为空');
      return null;
    }

    generating = true;
    var result = null;
    try {
      var messages;
      if (window.天青_prompt_builder.buildTwitchHookChatMessages) {
        messages = window.天青_prompt_builder.buildTwitchHookChatMessages({
          twitchPrompt: filled,
        });
      } else if (window.天青_prompt_builder.buildTwitterHookChatMessages) {
        messages = window.天青_prompt_builder.buildTwitterHookChatMessages({
          twitterPrompt: filled,
        });
      } else {
        messages = window.天青_prompt_builder.buildLineHookChatMessages({
          linePrompt: filled,
        });
      }
      console.info(
        '[Twitch] ' + sourceLabel + ' · messages=',
        messages.length,
        '· hook=',
        String(hookText).slice(0, 80),
      );
      var raw = await window.天青_api.chat({ messages: messages, route: 'twitch' });
      if (window.天青_regex && window.天青_regex.applyAiOutput) {
        raw = window.天青_regex.applyAiOutput(raw);
      }
      var session = parseTwitchMessage(appParseRaw(raw));
      logPhoneAiReply(
        sourceLabel,
        raw,
        session ? 'modules=' + session.modules.length : 'empty',
        session,
      );
      if (!bindIndexStillValid(bindIndex)) {
        console.info('[Twitch] 主线已回退，丢弃本轮结果');
        result = { raw: raw, session: null, discarded: true };
        return result;
      }
      var api = window.天青_api;
      var hasTag = api && api.hasXmlPair && api.hasXmlPair(raw, 'twitch_message');
      var hasMods = session && Array.isArray(session.modules) && session.modules.length > 0;
      if (!hasTag || !hasMods) {
        if (api && api.reportFormatError) {
          api.reportFormatError('Twitch', '<twitch_message>…</twitch_message>', raw);
        }
        result = { raw: raw, session: null, formatError: true };
        return result;
      }
      applySession(session, bindIndex);
      result = { raw: raw, session: session };
      return result;
    } catch (err) {
      console.error('[Twitch] 生成失败', err);
      if (window.天青_settings && window.天青_settings.showError) {
        window.天青_settings.showError(err);
      }
      return null;
    } finally {
      generating = false;
      if (result && !result.discarded && !result.formatError) {
        await dispatchSecondaryIfPrimary(result.raw, secondary);
      }
    }
  }

  async function generateFromHook(hookText, opts) {
    opts = opts || {};
    var result = await runTwitchGeneration(
      hookText,
      opts.secondary ? 'Twitch 二级钩子' : 'Twitch 钩子',
      opts,
    );
    if (result && result.session) toast('天青开播了');
    return result;
  }

  async function generateManualRefresh() {
    if (generating) {
      toast('正在生成直播…');
      return null;
    }
    if (!window.天青_api || !window.天青_api.chat) {
      toast('请先连接 API');
      return null;
    }
    toast('正在生成直播…');
    var result = await runTwitchGeneration(buildManualRefreshHook(), 'Twitch 手动刷新');
    if (!result) {
      toast('直播生成失败');
      return null;
    }
    if (result.discarded || result.formatError) return result;
    if (!result.session) {
      toast('未解析到直播内容，请重试');
      return result;
    }
    toast('天青开播了');
    return result;
  }

  window.天青_phone_twitch_generate = {
    fillTwitchPrompt: fillTwitchPrompt,
    parseTwitchMessage: parseTwitchMessage,
    generateFromHook: generateFromHook,
    generateManualRefresh: generateManualRefresh,
    isGenerating: function () {
      return generating;
    },
  };
})();
