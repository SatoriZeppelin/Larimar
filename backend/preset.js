/**
 * 酒馆预设 / 世界书导入
 *
 * 参考 SillyTavern Chat Completion 预设结构自动解析：
 * - prompts[] + prompt_order[].order（identifier / enabled / marker）
 * - 采样参数：temperature / top_p / openai_max_* / stream_openai 等
 * - 世界书 World Info、角色卡 Character Card V2
 *
 * 对外：window.天青_preset
 */
(function () {
  var KEY = 'tq_plus_preset';

  /** ST Prompt Manager 运行时占位（无静态 content，导入时跳过正文） */
  var MARKER_IDS = {
    dialogueExamples: 1,
    chatHistory: 1,
    worldInfoAfter: 1,
    worldInfoBefore: 1,
    charDescription: 1,
    charPersonality: 1,
    scenario: 1,
    personaDescription: 1,
  };

  var DEFAULTS = {
    name: 'SummerNight Plus 默认',
    systemPrompt: '',
    /** 解析后的可注入提示词条目（已按 order 展开、去掉 marker） */
    prompts: [],
    /** 原始 ST prompts 备份 */
    rawPrompts: [],
    /** 选用的 prompt_order.order */
    promptOrder: [],
    /** 世界书条目 */
    worldbook: [],
    /** ST 正则脚本（随预设导入） */
    regexScripts: [],
    importedMeta: null,
  };

  function makePresetId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function makeRegexId() {
    return 'rx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** 规范化单条 ST RegexScriptData */
  function normalizeRegexScript(s, i) {
    if (!s || typeof s !== 'object') return null;
    var trim = s.trimStrings;
    if (!Array.isArray(trim)) {
      trim = String(trim || '')
        .split(/\r?\n/)
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean);
    }
    var placement = Array.isArray(s.placement)
      ? s.placement.map(Number).filter(function (n) {
          return isFinite(n);
        })
      : [2];
    return {
      id: String(s.id || makeRegexId() + '_' + (i || 0)),
      scriptName: String(s.scriptName || s.name || '未命名正则'),
      findRegex: String(s.findRegex != null ? s.findRegex : s.find || ''),
      replaceString: String(s.replaceString != null ? s.replaceString : s.replace || ''),
      trimStrings: trim.map(String),
      placement: placement.length ? placement : [2],
      disabled: !!s.disabled,
      markdownOnly: !!s.markdownOnly,
      promptOnly: !!s.promptOnly,
      runOnEdit: s.runOnEdit !== false,
      substituteRegex: s.substituteRegex != null ? Number(s.substituteRegex) : 0,
      minDepth: s.minDepth != null && s.minDepth !== '' && !isNaN(Number(s.minDepth)) ? Number(s.minDepth) : null,
      maxDepth: s.maxDepth != null && s.maxDepth !== '' && !isNaN(Number(s.maxDepth)) ? Number(s.maxDepth) : null,
    };
  }

  function extractRegexScripts(data) {
    if (!data || typeof data !== 'object') return [];
    var list = null;
    if (Array.isArray(data.regexScripts)) list = data.regexScripts;
    else if (Array.isArray(data.regex_scripts)) list = data.regex_scripts;
    else if (data.extensions && Array.isArray(data.extensions.regex_scripts)) list = data.extensions.regex_scripts;
    else if (data.data && data.data.extensions && Array.isArray(data.data.extensions.regex_scripts)) {
      list = data.data.extensions.regex_scripts;
    } else if (data.extensions && data.extensions.regex && Array.isArray(data.extensions.regex.scripts)) {
      list = data.extensions.regex.scripts;
    }
    if (!list) return [];
    return list.map(normalizeRegexScript).filter(Boolean);
  }

  function normalizePreset(raw, fallbackId) {
    var o = raw && typeof raw === 'object' ? raw : {};
    var scripts = Array.isArray(o.regexScripts)
      ? o.regexScripts.map(normalizeRegexScript).filter(Boolean)
      : extractRegexScripts(o);
    return {
      id: String(o.id || fallbackId || makePresetId()),
      name: o.name || DEFAULTS.name,
      systemPrompt: typeof o.systemPrompt === 'string' ? o.systemPrompt : '',
      prompts: Array.isArray(o.prompts) ? o.prompts : [],
      rawPrompts: Array.isArray(o.rawPrompts) ? o.rawPrompts : [],
      promptOrder: Array.isArray(o.promptOrder) ? o.promptOrder : [],
      worldbook: Array.isArray(o.worldbook) ? o.worldbook : [],
      regexScripts: scripts,
      importedMeta: o.importedMeta || null,
    };
  }

  function defaultStore() {
    var item = normalizePreset({ name: DEFAULTS.name }, 'default');
    return { version: 2, activeId: item.id, items: [item] };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultStore();
      var o = JSON.parse(raw);
      if (o && o.version === 2 && Array.isArray(o.items)) {
        var items = o.items.map(function (it, i) {
          return normalizePreset(it, 'p_' + i);
        });
        if (!items.length) return defaultStore();
        var activeId = String(o.activeId || items[0].id);
        var found = false;
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === activeId) {
            found = true;
            break;
          }
        }
        if (!found) activeId = items[0].id;
        return { version: 2, activeId: activeId, items: items };
      }
      /* 旧版：整份 JSON 就是当前预设 */
      var legacy = normalizePreset(o, 'legacy');
      return { version: 2, activeId: legacy.id, items: [legacy] };
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function findPresetIndex(store, id) {
    var sid = String(id || '');
    for (var i = 0; i < store.items.length; i++) {
      if (String(store.items[i].id) === sid) return i;
    }
    return -1;
  }

  function load() {
    var store = loadStore();
    var idx = findPresetIndex(store, store.activeId);
    if (idx < 0) idx = 0;
    return normalizePreset(store.items[idx], store.activeId);
  }

  function save(p) {
    var store = loadStore();
    var next = normalizePreset(p, store.activeId);
    if (!next.id) next.id = store.activeId || makePresetId();
    var idx = findPresetIndex(store, next.id);
    if (idx < 0) {
      store.items.push(next);
    } else {
      store.items[idx] = next;
    }
    store.activeId = next.id;
    saveStore(store);
  }

  function listPresets() {
    var store = loadStore();
    return store.items.map(function (it) {
      return {
        id: it.id,
        name: it.name || '未命名预设',
        active: String(it.id) === String(store.activeId),
      };
    });
  }

  function getActiveId() {
    return loadStore().activeId;
  }

  function uniquePresetName(store, base) {
    var name = String(base || '未命名预设').trim() || '未命名预设';
    var names = {};
    store.items.forEach(function (it) {
      names[String(it.name || '')] = 1;
    });
    if (!names[name]) return name;
    var n = 2;
    while (names[name + ' (' + n + ')']) n += 1;
    return name + ' (' + n + ')';
  }

  /** 切换启用的预设；返回新的当前预设 */
  function switchPreset(id) {
    var store = loadStore();
    var idx = findPresetIndex(store, id);
    if (idx < 0) return null;
    store.activeId = store.items[idx].id;
    saveStore(store);
    return load();
  }

  /** 把一份预设加入库并设为当前 */
  function addPreset(data, opts) {
    opts = opts || {};
    var store = loadStore();
    var item = normalizePreset(data, makePresetId());
    item.id = makePresetId();
    item.name = uniquePresetName(store, item.name || opts.nameHint || DEFAULTS.name);
    store.items.push(item);
    store.activeId = item.id;
    saveStore(store);
    return load();
  }

  /** 删除预设；若删的是当前项则切到剩余第一项，库空则重建默认 */
  function deletePreset(id) {
    var store = loadStore();
    var targetId = id != null ? String(id) : String(store.activeId);
    var idx = findPresetIndex(store, targetId);
    if (idx < 0) return null;
    var removed = store.items[idx];
    store.items.splice(idx, 1);
    if (!store.items.length) {
      var fresh = normalizePreset({ name: DEFAULTS.name }, 'default');
      store.items = [fresh];
      store.activeId = fresh.id;
    } else if (String(store.activeId) === targetId) {
      store.activeId = store.items[Math.min(idx, store.items.length - 1)].id;
    }
    saveStore(store);
    return { removed: removed, current: load() };
  }

  function asArray(entries) {
    if (!entries) return [];
    if (Array.isArray(entries)) return entries;
    if (typeof entries === 'object') {
      return Object.keys(entries).map(function (k) {
        return entries[k];
      });
    }
    return [];
  }

  function normEntry(e, i) {
    if (!e || typeof e !== 'object') return null;
    var keys = e.key != null ? e.key : e.keys;
    var keyArr = Array.isArray(keys)
      ? keys
      : String(keys || '')
          .split(',')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
    var keys2 = e.keysecondary != null ? e.keysecondary : e.secondary_keys;
    var key2Arr = Array.isArray(keys2)
      ? keys2
      : String(keys2 || '')
          .split(',')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
    function num(v, fallback) {
      if (v == null || v === '') return fallback;
      var n = Number(v);
      return isNaN(n) ? fallback : n;
    }
    function tri(v) {
      if (v == null || v === '') return null;
      return !!v;
    }
    return {
      uid: e.uid != null ? e.uid : e.id != null ? e.id : i,
      key: keyArr,
      keysecondary: key2Arr,
      content: e.content || e.entry || '',
      enabled: e.enabled !== false && e.disable !== true,
      constant: !!(e.constant || e.always || e.forceActivation),
      order: num(e.order != null ? e.order : e.displayIndex, i),
      comment: e.comment || e.name || e.title || '',
      position: num(e.position, 0),
      depth: num(e.depth, 4),
      role: num(e.role, 0),
      probability: num(e.probability, 100),
      selectiveLogic: num(e.selectiveLogic, 0),
      scanDepth: e.scanDepth == null || e.scanDepth === '' ? null : num(e.scanDepth, null),
      caseSensitive: tri(e.caseSensitive),
      matchWholeWords: tri(e.matchWholeWords),
      useGroupScoring: !!e.useGroupScoring,
      automationId: e.automationId != null ? String(e.automationId) : '',
      excludeRecursion: !!e.excludeRecursion,
      preventRecursion: !!e.preventRecursion,
      delayUntilRecursion: !!e.delayUntilRecursion,
      ignoreBudget: !!(e.ignoreBudget || e.ignore_budget),
    };
  }

  function importWorldbook(json) {
    var data = typeof json === 'string' ? JSON.parse(json) : json;
    var entries = data.entries != null ? data.entries : data;
    if (data.character_book && data.character_book.entries) {
      entries = data.character_book.entries;
    }
    return asArray(entries)
      .map(normEntry)
      .filter(Boolean)
      .filter(function (e) {
        return e.content;
      });
  }

  /**
   * 导出为 SillyTavern 兼容世界书 JSON
   * @param {object[]} entries
   * @param {string} name 世界书名称（通常为二级目录名）
   */
  function exportWorldbook(entries, name) {
    var list = Array.isArray(entries) ? entries : [];
    var mapped = {};
    list.forEach(function (e, i) {
      var n = normEntry(e, i) || e;
      if (!n) return;
      var uid = n.uid != null ? n.uid : i;
      mapped[String(i)] = {
        uid: uid,
        key: Array.isArray(n.key) ? n.key : [],
        keysecondary: Array.isArray(n.keysecondary) ? n.keysecondary : [],
        comment: n.comment || '',
        content: n.content || '',
        constant: !!n.constant,
        order: n.order != null ? n.order : i,
        position: n.position != null ? n.position : 0,
        depth: n.depth != null ? n.depth : 4,
        role: n.role != null ? n.role : 0,
        probability: n.probability != null ? n.probability : 100,
        selectiveLogic: n.selectiveLogic != null ? n.selectiveLogic : 0,
        scanDepth: n.scanDepth == null ? null : n.scanDepth,
        caseSensitive: n.caseSensitive == null ? null : n.caseSensitive,
        matchWholeWords: n.matchWholeWords == null ? null : n.matchWholeWords,
        useGroupScoring: !!n.useGroupScoring,
        automationId: n.automationId != null ? String(n.automationId) : '',
        excludeRecursion: !!n.excludeRecursion,
        preventRecursion: !!n.preventRecursion,
        delayUntilRecursion: !!n.delayUntilRecursion,
        ignoreBudget: !!n.ignoreBudget,
        enabled: n.enabled !== false,
        disable: n.enabled === false,
      };
    });
    return {
      name: String(name || '世界书').trim() || '世界书',
      description: '',
      entries: mapped,
    };
  }

  function isStChatPreset(data) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.prompts) || Array.isArray(data.prompt_order)) return true;
    if (data.chat_completion_source || data.openai_model || data.openai_max_context != null) return true;
    if (data.main_prompt || data.system_prompt) return true;
    return false;
  }

  /** 选取 ST prompt_order：优先 character_id=100001（单角色常用），否则第一项 */
  function pickPromptOrder(data) {
    var list = data.prompt_order;
    if (!Array.isArray(list) || !list.length) return [];
    var preferred = null;
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row) continue;
      if (Array.isArray(row.order)) {
        if (row.character_id === 100001 || row.character_id === '100001') return row.order;
        if (!preferred) preferred = row.order;
      } else if (row.identifier) {
        /* 扁平 order：整表即 order */
        return list;
      }
    }
    return preferred || [];
  }

  function flattenOrderItems(order) {
    var out = [];
    function walk(items) {
      (items || []).forEach(function (item) {
        if (!item) return;
        if (Array.isArray(item.items) && item.items.length) {
          if (item.enabled === false) return;
          walk(item.items);
          return;
        }
        out.push(item);
      });
    }
    walk(order);
    return out;
  }

  function findPromptById(prompts, id) {
    if (!id) return null;
    for (var i = 0; i < prompts.length; i++) {
      var p = prompts[i];
      if (!p) continue;
      if (p.identifier === id || p.name === id) return p;
    }
    return null;
  }

  function isMarkerPrompt(p) {
    if (!p) return true;
    if (p.marker === true) return true;
    if (MARKER_IDS[p.identifier]) return true;
    return false;
  }

  /**
   * 按 SillyTavern Prompt Manager 规则解析 Chat Completion 预设
   * - 依 prompt_order 顺序展开全部条目（含 marker / 空内容，供列表展示）
   * - systemPrompt 仅拼接：enabled 且非 marker 且有正文
   */
  function importChatPreset(json, opts) {
    var data = typeof json === 'string' ? JSON.parse(json) : json;
    opts = opts || {};
    var name =
      data.name ||
      data.preset_name ||
      data.presetName ||
      opts.nameHint ||
      '导入的预设';

    var prompts = asArray(data.prompts || data.prompt || []);
    var orderRaw = pickPromptOrder(data);
    var order = flattenOrderItems(orderRaw);

    var entries = [];

    function pushEntry(p, enabledFromOrder) {
      if (!p) return;
      var content = String(p.content != null ? p.content : p.prompt || '').trim();
      var marker = isMarkerPrompt(p);
      var enabled = enabledFromOrder !== false;
      /* 以 prompt_order.enabled 为准；库条目自身的 enabled 在 ST 里常为 false，不能 AND 掉 */
      entries.push({
        id: String(p.identifier || p.name || 'p_' + entries.length),
        identifier: p.identifier || '',
        name: p.name || p.identifier || '未命名',
        role: p.role || 'system',
        content: content,
        enabled: enabled,
        marker: marker,
        visible: true,
        system_prompt: p.system_prompt !== false,
        depth: p.injection_depth != null ? Number(p.injection_depth) : p.depth != null ? Number(p.depth) : 0,
        injection_position:
          p.injection_position != null && p.injection_position !== ''
            ? Number(p.injection_position)
            : 0,
        /* position 仅作兼容缓存；组装时绝对/相对以 injection_position 为准 */
        position:
          p.injection_position != null && p.injection_position !== ''
            ? Number(p.injection_position)
            : 0,
      });
    }

    if (order.length) {
      order.forEach(function (item) {
        var id = typeof item === 'string' ? item : item.identifier;
        var enabled = typeof item === 'object' ? item.enabled !== false : true;
        var found = findPromptById(prompts, id);
        if (found) pushEntry(found, enabled);
        else if (id) {
          entries.push({
            id: String(id),
            identifier: id,
            name: id,
            role: 'system',
            content: '',
            enabled: enabled,
            marker: !!MARKER_IDS[id],
            visible: true,
            system_prompt: true,
          });
        }
      });
      /* order 未列出、但 prompts 里有正文的条目一并收入（插在 chatHistory 前） */
      var inOrder = {};
      entries.forEach(function (e) {
        if (e && e.identifier) inOrder[e.identifier] = true;
        if (e && e.id) inOrder[e.id] = true;
      });
      var orphans = [];
      prompts.forEach(function (p) {
        if (!p) return;
        var pid = p.identifier || p.name;
        if (!pid || inOrder[pid]) return;
        if (isMarkerPrompt(p)) return;
        var content = String(p.content != null ? p.content : p.prompt || '').trim();
        if (!content) return;
        orphans.push(p);
      });
      if (orphans.length) {
        var hIdx = -1;
        for (var hi = 0; hi < entries.length; hi++) {
          if (entries[hi] && entries[hi].identifier === 'chatHistory') {
            hIdx = hi;
            break;
          }
        }
        var mapped = [];
        orphans.forEach(function (p) {
          pushEntry(p, p.enabled !== false);
          mapped.push(entries.pop());
        });
        if (hIdx < 0) {
          mapped.forEach(function (e) {
            entries.push(e);
          });
        } else {
          entries = entries.slice(0, hIdx).concat(mapped).concat(entries.slice(hIdx));
        }
      }
    } else {
      prompts.forEach(function (p) {
        pushEntry(p, p && p.enabled !== false);
      });
    }

    if (!entries.length) {
      if (typeof data.main_prompt === 'string' && data.main_prompt.trim()) {
        entries.push({
          id: 'main_prompt',
          identifier: 'main_prompt',
          name: 'Main Prompt',
          role: 'system',
          content: data.main_prompt.trim(),
          enabled: true,
          marker: false,
          visible: true,
          system_prompt: true,
        });
      }
      if (typeof data.system_prompt === 'string' && data.system_prompt.trim()) {
        entries.push({
          id: 'system_prompt',
          identifier: 'system_prompt',
          name: 'System Prompt',
          role: 'system',
          content: data.system_prompt.trim(),
          enabled: true,
          marker: false,
          visible: true,
          system_prompt: true,
        });
      }
    }

    var sampling = extractSampling(data);
    var systemPrompt = buildSystemFromEntries(entries);
    var regexScripts = extractRegexScripts(data);

    return {
      name: name,
      systemPrompt: systemPrompt,
      prompts: entries,
      rawPrompts: prompts,
      promptOrder: order,
      regexScripts: regexScripts,
      importedMeta: {
        type: 'chat_preset',
        name: name,
        source: data.chat_completion_source || '',
        model: data.openai_model || data.custom_model || '',
        promptCount: entries.length,
        regexCount: regexScripts.length,
      },
      sampling: sampling,
    };
  }

  function buildSystemFromEntries(entries) {
    return (entries || [])
      .filter(function (e) {
        return e && e.enabled !== false && e.visible !== false && !e.marker && e.content;
      })
      .map(function (e) {
        return e.content;
      })
      .join('\n\n');
  }

  function rebuildSystemPrompt(preset) {
    var p = preset || load();
    p.systemPrompt = buildSystemFromEntries(p.prompts);
    save(p);
    return p;
  }

  function extractSampling(data) {
    if (!data || typeof data !== 'object') return null;
    var out = {};
    if (data.temperature != null) out.temperature = Number(data.temperature);
    if (data.frequency_penalty != null) out.frequencyPenalty = Number(data.frequency_penalty);
    if (data.presence_penalty != null) out.presencePenalty = Number(data.presence_penalty);
    if (data.top_p != null) out.topP = Number(data.top_p);
    if (data.openai_max_tokens != null) out.maxTokens = Number(data.openai_max_tokens);
    if (data.openai_max_context != null) out.contextLength = Number(data.openai_max_context);
    if (data.stream_openai != null) out.stream = !!data.stream_openai;
    var model = data.openai_model || data.custom_model || data.claude_model || '';
    if (model && model !== 'OR_Website') out.model = String(model);
    return Object.keys(out).length ? out : null;
  }

  /** 把预设里的采样参数同步进 API 配置（若存在） */
  function applySamplingToApi(sampling) {
    if (!sampling || !window.天青_api) return;
    var cfg = window.天青_api.loadConfig();
    var next = Object.assign({}, cfg);
    if (sampling.temperature != null && isFinite(sampling.temperature)) next.temperature = sampling.temperature;
    if (sampling.frequencyPenalty != null && isFinite(sampling.frequencyPenalty)) {
      next.frequencyPenalty = sampling.frequencyPenalty;
    }
    if (sampling.presencePenalty != null && isFinite(sampling.presencePenalty)) {
      next.presencePenalty = sampling.presencePenalty;
    }
    if (sampling.topP != null && isFinite(sampling.topP)) next.topP = sampling.topP;
    if (sampling.maxTokens != null && isFinite(sampling.maxTokens)) next.maxTokens = sampling.maxTokens;
    if (sampling.contextLength != null && isFinite(sampling.contextLength)) {
      next.contextLength = sampling.contextLength;
    }
    if (sampling.stream != null) next.stream = !!sampling.stream;
    if (sampling.model) next.model = sampling.model;
    if (window.天青_api.normalizeConfig) next = window.天青_api.normalizeConfig(next);
    window.天青_api.saveConfig(next);
    if (window.天青_settings_api && window.天青_settings_api.fillDom) {
      window.天青_settings_api.fillDom();
    }
  }

  function importCharacterCard(json) {
    var data = typeof json === 'string' ? JSON.parse(json) : json;
    var d = data.data || data;
    var parts = [];
    if (d.system_prompt) parts.push(String(d.system_prompt).trim());
    if (d.description) parts.push('【角色描述】\n' + String(d.description).trim());
    if (d.personality) parts.push('【性格】\n' + String(d.personality).trim());
    if (d.scenario) parts.push('【场景】\n' + String(d.scenario).trim());
    if (d.mes_example) parts.push('【对话示例】\n' + String(d.mes_example).trim());
    if (d.post_history_instructions) {
      parts.push('【后置指令】\n' + String(d.post_history_instructions).trim());
    }

    var wb = [];
    if (d.character_book) wb = importWorldbook({ entries: d.character_book.entries });

    return {
      name: d.name || data.name || '导入的角色卡',
      systemPrompt: parts.filter(Boolean).join('\n\n'),
      prompts: parts.filter(Boolean).map(function (c, i) {
        return {
          id: 'card_' + i,
          identifier: 'card_' + i,
          name: '角色卡',
          role: 'system',
          content: c,
          enabled: true,
          marker: false,
          visible: true,
        };
      }),
      rawPrompts: [],
      promptOrder: [],
      worldbook: wb,
      regexScripts: (function () {
        var a = extractRegexScripts(data);
        if (a.length) return a;
        return extractRegexScripts(d);
      })(),
      importedMeta: { type: 'character_card', name: d.name || data.name },
    };
  }

  /**
   * 自动识别格式并合并 / 入库
   * - 完整预设 / 角色卡：作为新预设加入库并启用
   * - 仅世界书：合并进当前预设
   * @param {string|object} text
   * @param {{nameHint?: string}} opts
   */
  function importAuto(text, opts) {
    var json = typeof text === 'string' ? JSON.parse(text) : text;
    opts = opts || {};
    var cur = load();
    var result;
    var sampling = null;
    var asNewPreset = false;

    if (json.spec === 'chara_card_v2' || (json.data && (json.data.description || json.data.character_book))) {
      result = importCharacterCard(json);
      asNewPreset = true;
    } else if (
      json.entries &&
      !json.prompts &&
      !json.prompt_order &&
      !(json.data && json.data.description)
    ) {
      result = {
        name: cur.name || json.name || opts.nameHint || '世界书',
        systemPrompt: cur.systemPrompt,
        prompts: cur.prompts,
        rawPrompts: cur.rawPrompts,
        promptOrder: cur.promptOrder,
        worldbook: importWorldbook(json),
        importedMeta: { type: 'worldbook', name: json.name || 'worldbook' },
      };
    } else if (json.character_book && json.character_book.entries && !json.prompts) {
      result = {
        name: cur.name || json.name || opts.nameHint || '世界书',
        systemPrompt: cur.systemPrompt,
        prompts: cur.prompts,
        rawPrompts: cur.rawPrompts,
        promptOrder: cur.promptOrder,
        worldbook: importWorldbook(json),
        importedMeta: { type: 'worldbook', name: json.name || 'worldbook' },
      };
    } else if (isStChatPreset(json) || json.format === 'tq_plus_preset') {
      asNewPreset = true;
      if (json.format === 'tq_plus_preset' || (typeof json.systemPrompt === 'string' && !json.prompts && !json.prompt_order)) {
        result = Object.assign({}, DEFAULTS, json);
        if (!Array.isArray(result.prompts)) result.prompts = [];
        result.regexScripts = extractRegexScripts(json);
      } else {
        result = importChatPreset(json, opts);
        sampling = result.sampling || null;
        delete result.sampling;
        result.worldbook = Array.isArray(result.worldbook) ? result.worldbook : [];
      }
    } else if (typeof json.systemPrompt === 'string') {
      result = Object.assign({}, DEFAULTS, json);
      result.regexScripts = extractRegexScripts(json);
      asNewPreset = true;
    } else {
      throw new Error('无法识别的 JSON 格式（请导入 SillyTavern 预设 / 世界书 / 角色卡）');
    }

    var merged;
    if (asNewPreset) {
      if (!Array.isArray(result.regexScripts)) result.regexScripts = extractRegexScripts(result);
      merged = addPreset(result, opts);
    } else {
      merged = Object.assign({}, cur, result, { id: cur.id });
      if (!Array.isArray(merged.worldbook)) merged.worldbook = [];
      if (!Array.isArray(merged.prompts)) merged.prompts = [];
      if (!Array.isArray(merged.rawPrompts)) merged.rawPrompts = [];
      if (!Array.isArray(merged.promptOrder)) merged.promptOrder = [];
      if (!Array.isArray(merged.regexScripts)) merged.regexScripts = cur.regexScripts || [];
      save(merged);
      merged = load();
    }
    if (sampling) applySamplingToApi(sampling);
    return merged;
  }

  function activateWorldbook(scanText, preset) {
    var p = preset || load();
    var text = String(scanText || '');
    var active = p.worldbook
      .filter(function (e) {
        return e && e.enabled && e.content;
      })
      .filter(function (e) {
        if (e.constant) return true;
        var keys = [].concat(e.key || [], e.keysecondary || []);
        if (!keys.length) return false;
        return keys.some(function (k) {
          return k && text.indexOf(k) !== -1;
        });
      })
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });

    return active
      .map(function (e) {
        var head = e.comment ? '【' + e.comment + '】\n' : '';
        return head + e.content;
      })
      .join('\n\n');
  }

  function buildSystemMessage(extraScanText) {
    if (window.天青_prompt_builder && window.天青_prompt_builder.buildSystemMessage) {
      return window.天青_prompt_builder.buildSystemMessage(extraScanText);
    }
    var p = load();
    var stateBlock =
      window.天青_state && window.天青_state.promptBlock ? window.天青_state.promptBlock() : '';
    var wb = activateWorldbook((extraScanText || '') + '\n' + stateBlock, p);
    var chunks = [];

    if (Array.isArray(p.prompts) && p.prompts.length) {
      p.prompts.forEach(function (item) {
        if (
          item &&
          item.enabled !== false &&
          item.visible !== false &&
          !item.marker &&
          item.content
        ) {
          chunks.push(item.content);
        }
      });
    } else if (p.systemPrompt) {
      chunks.push(p.systemPrompt);
    }

    if (wb) chunks.push('【世界书】\n' + wb);
    if (stateBlock) chunks.push(stateBlock);
    return chunks.filter(Boolean).join('\n\n');
  }

  function exportPayload() {
    var p = load();
    return {
      name: p.name || DEFAULTS.name,
      systemPrompt: p.systemPrompt || '',
      prompts: Array.isArray(p.prompts) ? p.prompts : [],
      rawPrompts: Array.isArray(p.rawPrompts) ? p.rawPrompts : [],
      promptOrder: Array.isArray(p.promptOrder) ? p.promptOrder : [],
      worldbook: Array.isArray(p.worldbook) ? p.worldbook : [],
      regexScripts: Array.isArray(p.regexScripts) ? p.regexScripts : [],
      regex_scripts: Array.isArray(p.regexScripts) ? p.regexScripts : [],
      importedMeta: p.importedMeta || null,
      exportedAt: new Date().toISOString(),
      format: 'tq_plus_preset',
    };
  }

  window.天青_preset = {
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    listPresets: listPresets,
    getActiveId: getActiveId,
    switchPreset: switchPreset,
    addPreset: addPreset,
    deletePreset: deletePreset,
    importWorldbook: importWorldbook,
    exportWorldbook: exportWorldbook,
    importChatPreset: importChatPreset,
    importCharacterCard: importCharacterCard,
    importAuto: importAuto,
    activateWorldbook: activateWorldbook,
    buildSystemMessage: buildSystemMessage,
    buildChatMessages: function (opts) {
      if (window.天青_prompt_builder) return window.天青_prompt_builder.buildChatMessages(opts);
      return [{ role: 'system', content: buildSystemMessage((opts && opts.userText) || '') }];
    },
    exportPayload: exportPayload,
    applySamplingToApi: applySamplingToApi,
    rebuildSystemPrompt: rebuildSystemPrompt,
    buildSystemFromEntries: buildSystemFromEntries,
    extractRegexScripts: extractRegexScripts,
    normalizeRegexScript: normalizeRegexScript,
  };
})();
