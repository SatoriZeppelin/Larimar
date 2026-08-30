/**
 * 系统设置 · 手机（各 App 提示词）
 * 对外：window.天青_settings_phone_sys
 */
(function () {
  var KEY = 'tq_plus_phone_prompts';

  var APPS = [
    { id: 'line', label: 'LINE' },
    { id: 'twitter', label: 'Twitter' },
    { id: 'agency', label: '事务所' },
    { id: 'twitch', label: 'Twitch' },
  ];

  /* 升高版本号 → 下次加载强制用 DEFAULT_PROMPTS 覆盖本地对应项 */
  var LINE_PROMPT_VER = 6;
  var LINE_PROMPT_VER_KEY = 'tq_plus_phone_prompt_line_ver';
  var TWITTER_PROMPT_VER = 4;
  var TWITTER_PROMPT_VER_KEY = 'tq_plus_phone_prompt_twitter_ver';
  var AGENCY_PROMPT_VER = 1;
  var AGENCY_PROMPT_VER_KEY = 'tq_plus_phone_prompt_agency_ver';
  var TWITCH_PROMPT_VER = 2;
  var TWITCH_PROMPT_VER_KEY = 'tq_plus_phone_prompt_twitch_ver';

  var DEFAULT_PROMPTS = {
    line:
      '[ LINE 私聊回复]\n' +
      '你现在是天青，在 LINE 上回复制作人（{{user}}）的私聊。天青是透明直球、心口如一的偶像，喜欢直接表达。\n' +
      '\n' +
      '[ 回复格式 ]文字和表情包可以混合使用，但一行只允许存在一种形式：\n' +
      '  - 文字：直接写出口语化的短信内容（不要动作/旁白/括号/markdown），但注意不可过于繁琐和过于跳跃性的在多个话题来回跳跃\n' +
      '  - 表情包：在单独一行启用，包含以下字段: 不知道、不行、举白旗、从墙边探头、从纸箱里探头、低落、叹气、害怕或哭泣、少女祈祷中、开心、得意、思考、点赞、生气、疑问\n' +
      '  - 格式统一为：<天青|回复|小时:分钟>\n' +
      '  - 表情为慎重使用的文化符号，切勿隔一行使用一个，正常一段对话只可使用1-2次\n' +
      '  - 控制每次回复的信息为6句以内（不含表情）\n' +
      '\n' +
      '  example:\n' +
      '    <line_message>\n' +
      '        <天青|普~罗~丢~色~|17:20>\n' +
      '        <天青|生气|17:20> #此处的生气调用生气表情包\n' +
      '        <天青|为什么不回我！|17:21>\n' +
      '    </line_message>\n' +
      '\n' +
      '[最近的对话]\n' +
      '{{line_recent_message}}\n' +
      '\n' +
      '直接输出天青的回复：',
    twitter:
      '[ Twitter / X 动态生成]\n' +
      '根据本回合钩子，生成与天青（Larimar）相关的 Twitter/X 内容，风格贴近真实社交平台。\n' +
      '可同时输出多个账号发帖（官方、粉丝、路人等），评论只保留最精华的几条（每帖不超过7条）。\n' +
      '回复人数须 ≥ 列出的评论条数。tag 数量与措辞贴合发帖者性格。\n' +
      '需要时附带 <trends> 热搜；可同时多个趋势。趋势帖文量单位为「万」。\n' +
      '同一趋势名在后续回合再次出现时，前端会累加帖文量（追加），不要故意改名规避。\n' +
      '\n' +
      '[ 输出格式 ]\n' +
      '<twitter_message>\n' +
      '    <twitter_account>\n' +
      '        账号名称|账号ID|小时:分钟|查看人数\n' +
      '        <twitter_context>正文</twitter_context>\n' +
      '        <twitter_tag>#tag |转推人数|喜欢人数|回复人数</twitter_tag>\n' +
      '        评论账号|评论账号ID|评论\n' +
      '    </twitter_account>\n' +
      '    <trends>\n' +
      '        <趋势名|趋势贴文>\n' +
      '    </trends>\n' +
      '</twitter_message>\n' +
      '\n' +
      'example:\n' +
      '<twitter_message>\n' +
      '    <twitter_account>\n' +
      '        Larimar|larimar_official|16:20|12k\n' +
      '        <twitter_context>排练结束～嗓子有点哑，但今天副歌那段抓到感觉了！制作人听了会不会夸我？ 💙</twitter_context>\n' +
      '        <twitter_tag>#排练日常 #新曲制作中 #海纹石蓝 |126|892|48</twitter_tag>\n' +
      '        海纹石收藏家|larimar_fan01|夸！！副歌那段真的会单曲循环！\n' +
      '        小夏|natsu_live|天青老师请收下我的膝盖（不是\n' +
      '    </twitter_account>\n' +
      '    <trends>\n' +
      '        <#海纹石蓝|1.2>\n' +
      '        <#今晚livehouse|0.54>\n' +
      '    </trends>\n' +
      '</twitter_message>\n' +
      '\n' +
      '[本回合钩子]\n' +
      '{{hook}}\n' +
      '\n' +
      '直接输出 <twitter_message>：',
    agency:
      '[独立任务 · 事务所界面，忽略之前的角色扮演格式]\n' +
      '（在此编写事务所相关生成提示词。可用占位符：{{user}} 等）\n',
    twitch:
      '[ Twitch 直播片段生成]\n' +
      '根据本回合钩子，生成天青（Larimar）的一场短直播切片。风格贴近真实弹幕直播：观众吐槽、天青直球回应、偶尔 SC。\n' +
      '当前名气阶段：{{stage}}\n' +
      '形式通常为「杂谈」或「唱歌」；背景优先「宿舍」或「录音室」。\n' +
      '天青表情名必须来自立绘表（如 微笑/得意/俏皮/星星眼/卖萌/不满/害羞…；穿婚纱时用 婚纱* 前缀）。\n' +
      '\n' +
      '[ 输出格式 ]\n' +
      '<twitch_message>\n' +
      '    <live|形式|背景|标题>\n' +
      '    <dm|观众ID|弹幕内容>\n' +
      '    <天青|表情|「台词」>\n' +
      '    <旁白|镜头旁白（可选）>\n' +
      '    <sc|观众ID|金额|醒目留言>\n' +
      '</twitch_message>\n' +
      '\n' +
      '规则：\n' +
      '- 只输出 <twitch_message>，不要解释\n' +
      '- 总模块约 10～18 条；弹幕与天青台词交错，弹幕可连发数条再接一句天青\n' +
      '- 观众 ID 像真实网名；弹幕口语、短句\n' +
      '- SC 金额只用 30/50/100/500/1000/2000\n' +
      '- 内容紧扣钩子，可轻度提到制作人，但不要喧宾夺主\n' +
      '\n' +
      'example:\n' +
      '<twitch_message>\n' +
      '    <live|杂谈|宿舍|深夜小电台>\n' +
      '    <dm|柠檬汽水不加冰|p桑浓度预警>\n' +
      '    <dm|第一排的位置是我的|她每次提到制作人表情都不一样>\n' +
      '    <天青|微笑|「他真的很厉害的。」>\n' +
      '    <dm|困困困|稍微>\n' +
      '    <dm|柠檬汽水不加冰|以天青的性格，稍微=吹了半小时>\n' +
      '    <天青|得意|「你们不要笑啦，我说真的！」>\n' +
      '    <sc|海纹石收藏家|100|加油 Larimar！>\n' +
      '</twitch_message>\n' +
      '\n' +
      '[本回合钩子]\n' +
      '{{hook}}\n' +
      '\n' +
      '直接输出 <twitch_message>：',
  };

  var store = { prompts: {} };
  var activeAppId = 'line';

  function $(id) {
    return document.getElementById(id);
  }

  function defaultStore() {
    return {
      prompts: {
        line: DEFAULT_PROMPTS.line,
        twitter: DEFAULT_PROMPTS.twitter,
        agency: DEFAULT_PROMPTS.agency,
        twitch: DEFAULT_PROMPTS.twitch,
      },
    };
  }

  function migrateLinePrompt(data) {
    try {
      var ver = parseInt(localStorage.getItem(LINE_PROMPT_VER_KEY) || '0', 10);
      if (ver >= LINE_PROMPT_VER) return false;
      if (!data.prompts) data.prompts = {};
      data.prompts.line = DEFAULT_PROMPTS.line;
      localStorage.setItem(LINE_PROMPT_VER_KEY, String(LINE_PROMPT_VER));
      return true;
    } catch (e) {
      return false;
    }
  }

  function migrateTwitterPrompt(data) {
    try {
      var ver = parseInt(localStorage.getItem(TWITTER_PROMPT_VER_KEY) || '0', 10);
      if (ver >= TWITTER_PROMPT_VER) return false;
      if (!data.prompts) data.prompts = {};
      data.prompts.twitter = DEFAULT_PROMPTS.twitter;
      localStorage.setItem(TWITTER_PROMPT_VER_KEY, String(TWITTER_PROMPT_VER));
      return true;
    } catch (e) {
      return false;
    }
  }

  function migrateAgencyPrompt(data) {
    try {
      var ver = parseInt(localStorage.getItem(AGENCY_PROMPT_VER_KEY) || '0', 10);
      if (ver >= AGENCY_PROMPT_VER) return false;
      if (!data.prompts) data.prompts = {};
      data.prompts.agency = DEFAULT_PROMPTS.agency;
      localStorage.setItem(AGENCY_PROMPT_VER_KEY, String(AGENCY_PROMPT_VER));
      return true;
    } catch (e) {
      return false;
    }
  }

  function migrateTwitchPrompt(data) {
    try {
      var ver = parseInt(localStorage.getItem(TWITCH_PROMPT_VER_KEY) || '0', 10);
      if (ver >= TWITCH_PROMPT_VER) return false;
      if (!data.prompts) data.prompts = {};
      data.prompts.twitch = DEFAULT_PROMPTS.twitch;
      localStorage.setItem(TWITCH_PROMPT_VER_KEY, String(TWITCH_PROMPT_VER));
      return true;
    } catch (e) {
      return false;
    }
  }

  function normalizeStore(o) {
    if (!o || typeof o !== 'object') return defaultStore();
    if (!o.prompts || typeof o.prompts !== 'object') o.prompts = {};
    /* 丢弃旧版总提示词 / 总时间 / 空闲秒数字段 */
    delete o.globalPrompt;
    delete o.timePrompt;
    delete o.replyIdleSec;
    migrateLinePrompt(o);
    migrateTwitterPrompt(o);
    migrateAgencyPrompt(o);
    migrateTwitchPrompt(o);
    return o;
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        var fresh = defaultStore();
        try {
          localStorage.setItem(KEY, JSON.stringify(fresh));
          localStorage.setItem(LINE_PROMPT_VER_KEY, String(LINE_PROMPT_VER));
          localStorage.setItem(TWITTER_PROMPT_VER_KEY, String(TWITTER_PROMPT_VER));
          localStorage.setItem(AGENCY_PROMPT_VER_KEY, String(AGENCY_PROMPT_VER));
          localStorage.setItem(TWITCH_PROMPT_VER_KEY, String(TWITCH_PROMPT_VER));
        } catch (e) {}
        return fresh;
      }
      var data = normalizeStore(JSON.parse(raw));
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) {}
      return data;
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function ensureDefaults() {
    if (!store.prompts || typeof store.prompts !== 'object') store.prompts = {};
    var changed = false;
    APPS.forEach(function (app) {
      if (store.prompts[app.id] == null) {
        store.prompts[app.id] = DEFAULT_PROMPTS[app.id] || '';
        changed = true;
      }
    });
    if (store.globalPrompt != null || store.timePrompt != null || store.replyIdleSec != null) {
      delete store.globalPrompt;
      delete store.timePrompt;
      delete store.replyIdleSec;
      changed = true;
    }
    if (changed) saveStore();
  }

  function approxTokens(text) {
    return Math.max(0, Math.ceil(String(text || '').length / 1.7));
  }

  function activeApp() {
    for (var i = 0; i < APPS.length; i++) {
      if (APPS[i].id === activeAppId) return APPS[i];
    }
    return APPS[0];
  }

  function syncActiveEditor() {
    var editor = $('phone-prompt-editor');
    if (!editor) return;
    var ta = editor.querySelector('[data-field="content"]');
    if (!ta) return;
    var next = String(ta.value || '');
    if (String(store.prompts[activeAppId] || '') === next) return;
    store.prompts[activeAppId] = next;
    saveStore();
    var meta = editor.querySelector('.char-wb-meta');
    if (meta) meta.textContent = '(词符: ' + approxTokens(next) + ')';
  }

  function renderTabs() {
    var nav = $('phone-app-tabs');
    if (!nav) return;
    nav.innerHTML = APPS.map(function (app) {
      var active = app.id === activeAppId;
      return (
        '<button type="button" class="settings-tab phone-app-tab' +
        (active ? ' active' : '') +
        '" data-phone-app="' +
        app.id +
        '"' +
        (active ? ' aria-current="page"' : '') +
        '>' +
        '<span class="tab-inner"><span class="tab-label">' +
        app.label +
        '</span></span></button>'
      );
    }).join('');
  }

  function renderEditor() {
    var editor = $('phone-prompt-editor');
    if (!editor) return;
    ensureDefaults();
    var app = activeApp();
    var content = store.prompts[app.id] || '';
    editor.dataset.id = app.id;
    editor.innerHTML =
      '<div class="phone-prompt-editor__head">' +
      '<span class="regex-place is-constant">提示词</span>' +
      '<span class="char-wb-meta">(词符: ' +
      approxTokens(content) +
      ')</span></div>' +
      '<div class="preset-field phone-prompt-editor__body">' +
      '<div class="char-wb-content-head">' +
      '<div class="char-wb-content-label">' +
      '<span class="preset-field-label">内容</span>' +
      '<button type="button" class="preset-icon-btn char-wb-expand-btn" data-act="expand-content" title="扩展到全屏" aria-label="扩展到全屏">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="15 3 21 3 21 9"/>' +
      '<polyline points="9 21 3 21 3 15"/>' +
      '<line x1="21" y1="3" x2="14" y2="10"/>' +
      '<line x1="3" y1="21" x2="10" y2="14"/>' +
      '</svg></button></div></div>' +
      '<textarea class="tq-input regex-code char-wb-content-ta phone-prompt-editor__ta" data-field="content" rows="12" spellcheck="false"></textarea>' +
      '</div>';
    var ta = editor.querySelector('[data-field="content"]');
    if (ta) ta.value = content;
  }

  function setActiveApp(id) {
    if (!id || id === activeAppId) return;
    var found = false;
    APPS.forEach(function (app) {
      if (app.id === id) found = true;
    });
    if (!found) return;
    syncActiveEditor();
    activeAppId = id;
    renderTabs();
    renderEditor();
  }

  function renderList() {
    ensureDefaults();
    renderTabs();
    renderEditor();
  }

  function onEditorClick(e) {
    var editor = $('phone-prompt-editor');
    if (!editor || !editor.contains(e.target)) return;
    var actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    if (actBtn.getAttribute('data-act') !== 'expand-content') return;
    e.preventDefault();
    e.stopPropagation();
    var charEditor = window.天青_settings_character;
    if (charEditor && charEditor.openContentEditor) {
      charEditor.openContentEditor(editor, function () {
        syncActiveEditor();
      });
    }
  }

  function onEditorChange(e) {
    var editor = $('phone-prompt-editor');
    if (!editor || !editor.contains(e.target)) return;
    if (!e.target.getAttribute || !e.target.getAttribute('data-field')) return;
    syncActiveEditor();
  }

  function bind() {
    store = loadStore();
    ensureDefaults();
    renderList();

    var nav = $('phone-app-tabs');
    var editor = $('phone-prompt-editor');
    if (nav && !nav.dataset.phoneAppTabsBound) {
      nav.dataset.phoneAppTabsBound = '1';
      nav.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-phone-app]');
        if (!btn) return;
        e.preventDefault();
        setActiveApp(btn.getAttribute('data-phone-app') || 'line');
      });
    }

    if (editor && !editor.dataset.phoneEditorBound) {
      editor.dataset.phoneEditorBound = '1';
      editor.addEventListener('click', onEditorClick);
      editor.addEventListener('input', onEditorChange);
      editor.addEventListener('change', onEditorChange);
      editor.addEventListener('blur', onEditorChange, true);
      editor.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var ta = e.target;
        if (!ta || !ta.getAttribute || ta.getAttribute('data-field') !== 'content') return;
        e.preventDefault();
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        var val = ta.value;
        ta.value = val.slice(0, start) + '\t' + val.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 1;
        syncActiveEditor();
      });
    }
  }

  function getPrompt(id) {
    if (!store.prompts || !Object.keys(store.prompts).length) {
      store = loadStore();
    }
    ensureDefaults();
    return String((store.prompts && store.prompts[id]) || '');
  }

  /* 脚本加载即迁移，不等打开设置页 */
  store = loadStore();

  window.天青_settings_phone_sys = {
    bind: bind,
    renderList: renderList,
    getPrompt: getPrompt,
    getStore: function () {
      return store;
    },
  };
})();
