/**
 * 生成管线：按 ST 顺序组装 messages → 调 API → 解析 summernight / Gal
 * 对外：window.天青_chat
 */
(function () {
  function logAiReply(raw, data) {
    var lines = Array.isArray(data && data.modules) ? data.modules.length : 0;
    var choices = Array.isArray(data && data.choices) ? data.choices.length : 0;
    var title =
      '[SummerNight Plus] AI 回复' +
      ' · format=' +
      ((data && data.format) || '?') +
      ' · lines=' +
      lines +
      ' · choices=' +
      choices;
    if (data && data.snapshot) title += ' · snapshot';

    /* 分组折叠：一眼能看清完整原文与解析摘要 */
    if (typeof console.groupCollapsed === 'function') {
      console.groupCollapsed(title);
      console.info('—— AI 原文 ——');
      console.log(String(raw == null ? '' : raw));
      if (data && data.snapshot) {
        console.info('—— snapshots ——');
        console.log(data.snapshot);
      }
      if (data && data.choices && data.choices.length) {
        console.info('—— branches ——');
        console.log(data.choices);
      }
      console.info('—— 解析 modules（摘要）——');
      console.log(
        (data.modules || []).map(function (m, i) {
          if (!m) return i + ': (empty)';
          if (m.type === 'line') {
            return (
              i +
              ': [' +
              (m.who || '') +
              (m.expr && m.expr !== '-' ? '|' + m.expr : '') +
              '] ' +
              String(m.text || '').slice(0, 80)
            );
          }
          return i + ': ' + m.type + ' ' + JSON.stringify(m).slice(0, 80);
        }),
      );
      console.groupEnd();
      return;
    }

    console.info(title);
    console.log(String(raw == null ? '' : raw));
  }

  async function generate(userText, opts) {
    opts = opts || {};
    if (!window.天青_api || !window.天青_parse) {
      throw new Error('核心模块未加载');
    }
    if (!window.天青_prompt_builder || !window.天青_prompt_builder.buildChatMessages) {
      throw new Error('提示词组装模块未加载');
    }

    var userLine = userText || '（继续）';
    var hist = window.天青_save.load().messages || [];
    var messages = window.天青_prompt_builder.buildChatMessages({
      userText: userText || '（请根据当前状态继续演出下一轮）',
      history: hist.slice(-16),
    });

    /* 成功后再写入会话，避免失败污染历史 */
    var raw = await window.天青_api.chat({
      messages: messages,
      onDelta: typeof opts.onDelta === 'function' ? opts.onDelta : undefined,
    });
    if (window.天青_regex && window.天青_regex.applyAiOutput) {
      raw = window.天青_regex.applyAiOutput(raw);
    }
    window.天青_save.push('user', userLine);
    window.天青_save.push('assistant', raw);
    window.天青_save.setLastRaw(raw);

    var data = window.天青_parse.parseGal(raw);
    logAiReply(raw, data);
    return { raw: raw, data: data };
  }

  function continueWith(choiceText) {
    return generate(choiceText);
  }

  window.天青_chat = {
    generate: generate,
    continueWith: continueWith,
  };
})();
