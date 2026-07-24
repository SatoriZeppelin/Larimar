/**
 * 按 SillyTavern Chat Completion / Prompt Manager 顺序组装 messages
 * 世界书来源：角色设定各二级目录 + 系统设置-提示词（+ 预设内 worldbook 兼容）
 * 对外：window.天青_prompt_builder
 */
(function () {
  var WI_BEFORE = 0;
  var WI_AFTER = 1;
  var WI_AN_TOP = 2;
  var WI_AN_BOTTOM = 3;
  var WI_AT_DEPTH = 4;
  var WI_EM_TOP = 5;
  var WI_EM_BOTTOM = 6;

  var MARKERS = {
    dialogueExamples: 1,
    chatHistory: 1,
    worldInfoAfter: 1,
    worldInfoBefore: 1,
    charDescription: 1,
    charPersonality: 1,
    scenario: 1,
    personaDescription: 1,
  };

  /** ST 默认 prompt_order 骨架（无自定义 order 时使用） */
  var DEFAULT_ORDER = [
    'main',
    'worldInfoBefore',
    'personaDescription',
    'charDescription',
    'charPersonality',
    'scenario',
    'enhanceDefinitions',
    'nsfw',
    'worldInfoAfter',
    'dialogueExamples',
    'chatHistory',
    'jailbreak',
  ];

  function isMarkerId(id) {
    return !!MARKERS[String(id || '')];
  }

  /** 结构性占位（无正文可推）；有正文却被标成 marker 的自定义条目不当成占位 */
  function isStructuralMarker(item) {
    if (!item) return true;
    var id = item.identifier || item.id || '';
    if (isMarkerId(id)) return true;
    if (item.marker === true && !String(item.content || '').trim()) return true;
    return false;
  }

  function resolveActivePreset() {
    var ui = window.天青_settings_preset;
    if (ui && typeof ui.getRuntimePreset === 'function') {
      try {
        var runtime = ui.getRuntimePreset();
        if (runtime) {
          if (ui.isDirty && ui.isDirty()) {
            console.warn(
              '[SummerNight Plus] 预设有未保存更改，本次生成已使用界面草稿；请点「保存更改」以免刷新后丢失',
            );
          }
          return runtime;
        }
      } catch (e) {}
    }
    return (window.天青_preset && window.天青_preset.load && window.天青_preset.load()) || {};
  }

  function normalizeRole(role) {
    if (role === 1 || role === '1' || role === 'user') return 'user';
    if (role === 2 || role === '2' || role === 'assistant') return 'assistant';
    if (role === 'assistant' || role === 'user' || role === 'system') return role;
    return 'system';
  }

  function wiRole(role) {
    return normalizeRole(role == null ? 0 : role);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  /** 角色设定：启用中的二级目录下全部世界书条目 */
  function getCharacterWorldbookEntries() {
    var store = readJson('tq_plus_character_tabs', null);
    if (!store || !Array.isArray(store.tabs)) return [];
    var out = [];
    store.tabs.forEach(function (tab) {
      if (!tab || tab.enabled === false) return;
      (tab.entries || []).forEach(function (e) {
        if (!e) return;
        out.push(Object.assign({}, e, { _source: 'character', _tab: tab.name || tab.id || '' }));
      });
    });
    return out;
  }

  /** 系统设置 · 提示词（世界书形） */
  function getSystemPromptEntries() {
    var store = readJson('tq_plus_system_prompts', { entries: [] });
    var list = Array.isArray(store.entries) ? store.entries : [];
    return list.map(function (e) {
      return Object.assign({}, e, { _source: 'system_prompt' });
    });
  }

  /** 预设内嵌世界书（兼容旧导入） */
  function getPresetWorldbookEntries(preset) {
    var p = preset || (window.天青_preset && window.天青_preset.load());
    if (!p || !Array.isArray(p.worldbook)) return [];
    return p.worldbook.map(function (e) {
      return Object.assign({}, e, { _source: 'preset' });
    });
  }

  function collectWorldbookPool(preset) {
    /* 用户定义：角色设定 + 系统提示词；另附预设内 worldbook 以免旧数据丢失 */
    return []
      .concat(getCharacterWorldbookEntries())
      .concat(getSystemPromptEntries())
      .concat(getPresetWorldbookEntries(preset));
  }

  /** LINE 私聊：仅角色设定世界书（不含系统提示词 / 预设内嵌世界书） */
  function collectLineWorldbookPool() {
    return getCharacterWorldbookEntries();
  }

  function matchKeys(text, keys, caseSensitive) {
    var src = String(text || '');
    var list = Array.isArray(keys) ? keys : [];
    if (!list.length) return false;
    return list.some(function (k) {
      if (!k) return false;
      var needle = String(k);
      if (caseSensitive) return src.indexOf(needle) !== -1;
      return src.toLowerCase().indexOf(needle.toLowerCase()) !== -1;
    });
  }

  function entryActivated(entry, scanText) {
    if (!entry || entry.enabled === false) return false;
    if (!String(entry.content || '').trim()) return false;
    var prob = entry.probability == null ? 100 : Number(entry.probability);
    if (!isNaN(prob) && prob < 100 && Math.random() * 100 >= prob) return false;
    if (entry.constant) return true;
    var primary = entry.key || [];
    var secondary = entry.keysecondary || [];
    var caseSensitive = !!entry.caseSensitive;
    var hitPrimary = matchKeys(scanText, primary, caseSensitive);
    if (!primary.length && !secondary.length) return false;
    if (!secondary.length) return hitPrimary;
    var hitSecondary = matchKeys(scanText, secondary, caseSensitive);
    var logic = Number(entry.selectiveLogic) || 0;
    /* 0 与任意 AND_ANY: primary AND (secondary empty OR any secondary) — ST 简化为 primary 命中即可，次要作额外 OR */
    if (logic === 0) return hitPrimary || hitSecondary;
    if (logic === 1) return hitPrimary && !hitSecondary; /* NOT_ALL 简化 */
    if (logic === 2) return hitPrimary && !hitSecondary;
    if (logic === 3) return hitPrimary && hitSecondary; /* AND_ALL */
    return hitPrimary;
  }

  function formatEntry(entry) {
    var head = entry.comment ? '【' + entry.comment + '】\n' : '';
    return head + String(entry.content || '').trim();
  }

  function sortByOrder(a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  }

  /**
   * 激活世界书并按 ST position 分桶
   * @param {string} scanText
   * @param {object} [preset]
   * @param {Array} [pool] 可选；不传则用 collectWorldbookPool
   * @returns {{ before, after, anTop, anBottom, atDepth, emTop, emBottom }}
   */
  function activateWorldbookBuckets(scanText, preset, pool) {
    var active = (Array.isArray(pool) ? pool : collectWorldbookPool(preset)).filter(function (e) {
      return entryActivated(e, scanText);
    });
    active.sort(sortByOrder);

    var buckets = {
      before: [],
      after: [],
      anTop: [],
      anBottom: [],
      atDepth: [],
      emTop: [],
      emBottom: [],
    };

    active.forEach(function (e) {
      var pos = Number(e.position);
      if (isNaN(pos)) pos = WI_BEFORE;
      if (pos === WI_AFTER) buckets.after.push(e);
      else if (pos === WI_AN_TOP) buckets.anTop.push(e);
      else if (pos === WI_AN_BOTTOM) buckets.anBottom.push(e);
      else if (pos === WI_AT_DEPTH) buckets.atDepth.push(e);
      else if (pos === WI_EM_TOP) buckets.emTop.push(e);
      else if (pos === WI_EM_BOTTOM) buckets.emBottom.push(e);
      else buckets.before.push(e);
    });

    return buckets;
  }

  function pushJoinedSystem(messages, entries, label) {
    if (!entries || !entries.length) return;
    var text = entries.map(formatEntry).filter(Boolean).join('\n\n');
    if (!text) return;
    if (label) text = '【' + label + '】\n' + text;
    messages.push({ role: 'system', content: text });
  }

  function pushEachAsRole(messages, entries) {
    if (!entries || !entries.length) return;
    entries.forEach(function (e) {
      var text = formatEntry(e);
      if (!text) return;
      messages.push({ role: wiRole(e.role), content: text });
    });
  }

  /** token 计数：优先 gpt-tokenizer，未加载时回退粗估 */
  function estimateTokens(text) {
    if (window.天青_tokens && typeof window.天青_tokens.countText === 'function') {
      return window.天青_tokens.countText(text);
    }
    return Math.ceil(String(text == null ? '' : text).length / 2);
  }

  function estimateMessageTokens(msg) {
    if (window.天青_tokens && typeof window.天青_tokens.countMessage === 'function') {
      return window.天青_tokens.countMessage(msg);
    }
    if (!msg) return 0;
    return 4 + estimateTokens(msg.content);
  }

  function estimateMessagesTokens(msgs) {
    var n = 0;
    (msgs || []).forEach(function (m) {
      n += estimateMessageTokens(m);
    });
    return n;
  }

  function getContextLength() {
    try {
      if (window.天青_api && window.天青_api.loadConfig) {
        var cfg = window.天青_api.loadConfig();
        var n = Number(cfg && cfg.contextLength);
        if (isFinite(n) && n > 0) return Math.round(n);
      }
    } catch (e) {}
    return 200000;
  }

  function defaultUserLine(userText) {
    return String(userText || '').trim() || '（请根据当前状态继续演出下一轮）';
  }

  function cleanChatTurns(messages) {
    var out = [];
    (messages || []).forEach(function (m) {
      if (!m) return;
      if (m.role !== 'user' && m.role !== 'assistant') return;
      var c = String(m.content || '').trim();
      if (!c) return;
      out.push({ role: m.role, content: c });
    });
    return out;
  }

  /**
   * 从最新一条往前累加，超出 budget 时丢弃导致超限的那条及更早内容。
   * 若全部遍历完仍未超限，则保留全部。
   * @returns {{ history: Array, userLine: string, picked: number, total: number, budget: number, used: number }}
   */
  function selectHistoryByTokenBudget(savedHistory, userText, budget) {
    var userLine = defaultUserLine(userText);
    var chain = cleanChatTurns(savedHistory);
    chain.push({ role: 'user', content: userLine });

    if (!chain.length) {
      return { history: [], userLine: userLine, picked: 0, total: 0, budget: budget, used: 0 };
    }

    var picked = [];
    var used = 0;
    var hitLimit = false;
    for (var i = chain.length - 1; i >= 0; i--) {
      var cost = estimateMessageTokens(chain[i]);
      if (used + cost > budget) {
        hitLimit = true;
        break;
      }
      used += cost;
      picked.unshift(chain[i]);
    }

    if (!hitLimit) {
      return {
        history: chain.slice(0, -1),
        userLine: userLine,
        picked: chain.length,
        total: chain.length,
        budget: budget,
        used: used,
        allIncluded: true,
      };
    }

    if (!picked.length) {
      return {
        history: chain.slice(0, -1),
        userLine: userLine,
        picked: chain.length,
        total: chain.length,
        budget: budget,
        used: estimateMessagesTokens(chain),
        forcedAll: true,
      };
    }

    var histOnly = picked.slice();
    if (histOnly.length && histOnly[histOnly.length - 1].role === 'user') {
      histOnly.pop();
    }
    return {
      history: histOnly,
      userLine: userLine,
      picked: picked.length,
      total: chain.length,
      budget: budget,
      used: used,
    };
  }

  /** appendChatHistory 中除 user/assistant 正文外的注入项 token */
  function measureHistoryInjectionsTokens(wiBuckets, absolutePrompts, userText) {
    var msgs = [];
    appendChatHistory(msgs, [], userText, wiBuckets, absolutePrompts);
    var userLine = defaultUserLine(userText);
    var total = estimateMessagesTokens(msgs);
    total -= estimateMessageTokens({ role: 'user', content: userLine });
    return Math.max(0, total);
  }

  function getOpeningRaw() {
    return (window.天青_opening && String(window.天青_opening)) || '';
  }

  /** 确保存档历史以开局 assistant 开头 */
  function ensureOpeningInHistory(messages) {
    var list = cleanChatTurns(messages);
    var opening = String(getOpeningRaw() || '').trim();
    if (!opening) return list;
    if (list.length && list[0].role === 'assistant' && list[0].content === opening) return list;
    var has = list.some(function (m) {
      return m.role === 'assistant' && m.content === opening;
    });
    if (!has) list.unshift({ role: 'assistant', content: opening });
    return list;
  }

  function applyRelativePresetEntries(messages, relativeEntries, ctx) {
    ctx = ctx || {};
    var wi = ctx.wi || {};
    var stateBlock = ctx.stateBlock || '';
    var absolutePrompts = ctx.absolutePrompts || [];
    var history = ctx.history || [];
    var userText = ctx.userText || '';
    var includeHistory = !!ctx.includeHistory;
    var diag = ctx.diag;

    relativeEntries.forEach(function (item) {
      var id = item.identifier || item.id || '';
      var structural = isStructuralMarker(item) || isMarkerId(id);

      if (structural) {
        if (diag && diag.markers) diag.markers.push(id || item.name || '?');
        if (id === 'worldInfoBefore') {
          pushJoinedSystem(messages, wi.before, '世界书·角色定义前');
          if (ctx.flags) ctx.flags.sawWiBefore = true;
        } else if (id === 'worldInfoAfter') {
          pushJoinedSystem(messages, wi.after, '世界书·角色定义后');
          if (stateBlock) messages.push({ role: 'system', content: stateBlock });
          if (ctx.flags) ctx.flags.sawWiAfter = true;
        } else if (id === 'personaDescription') {
          var personaPrompt = getPersonaInjection('prompt');
          if (personaPrompt) {
            messages.push({ role: 'system', content: personaPrompt });
            if (ctx.flags) ctx.flags.personaPromptInjected = true;
          }
        } else if (id === 'dialogueExamples') {
          pushJoinedSystem(messages, wi.emTop, '世界书·示例前');
          pushJoinedSystem(messages, wi.emBottom, '世界书·示例后');
        } else if (id === 'chatHistory') {
          if (includeHistory) {
            appendChatHistory(messages, history, userText, wi, absolutePrompts);
          }
          if (ctx.flags) ctx.flags.chatInserted = true;
        }
        return;
      }

      var content = String(item.content || '').trim();
      if (!content) {
        if (diag && diag.skipped) {
          diag.skipped.push({
            name: item.name || id,
            reason: 'empty content',
          });
        }
        return;
      }
      messages.push({
        role: normalizeRole(item.role),
        content: content,
      });
      if (diag && diag.included) {
        diag.included.push({
          name: item.name || id,
          role: normalizeRole(item.role),
          chars: content.length,
        });
      }
    });
  }

  function finalizePresetShell(messages, ctx) {
    ctx = ctx || {};
    var wi = ctx.wi || {};
    var stateBlock = ctx.stateBlock || '';
    var absolutePrompts = ctx.absolutePrompts || [];
    var history = ctx.history || [];
    var userText = ctx.userText || '';
    var flags = ctx.flags || {};
    var diag = ctx.diag;

    if (!flags.personaPromptInjected) {
      var fallbackPersona = getPersonaInjection('prompt');
      if (fallbackPersona) {
        var insertAt = 0;
        for (var pi = 0; pi < messages.length; pi++) {
          if (messages[pi] && messages[pi].role === 'user') {
            insertAt = pi;
            break;
          }
          insertAt = pi + 1;
        }
        messages.splice(insertAt, 0, { role: 'system', content: fallbackPersona });
        if (diag && diag.included) {
          diag.included.push({ name: 'persona(fallback)', role: 'system', chars: fallbackPersona.length });
        }
      }
    }

    if (!flags.chatInserted && !ctx.skipHistoryAppend) {
      if (!flags.sawWiBefore && wi.before && wi.before.length) {
        pushJoinedSystem(messages, wi.before, '世界书·角色定义前');
      }
      if (!flags.sawWiAfter && wi.after && wi.after.length) {
        pushJoinedSystem(messages, wi.after, '世界书·角色定义后');
      }
      if (!flags.sawWiAfter && stateBlock) messages.push({ role: 'system', content: stateBlock });
      appendChatHistory(messages, history, userText, wi, absolutePrompts);
    }
  }

  function buildScanText(history, userText) {
    var parts = (history || [])
      .map(function (m) {
        return m && m.content ? String(m.content) : '';
      });
    parts.push(String(userText || ''));
    return parts.join('\n');
  }

  function findPrompt(prompts, identifier) {
    for (var i = 0; i < prompts.length; i++) {
      var p = prompts[i];
      if (!p) continue;
      if (p.identifier === identifier || p.id === identifier || p.name === identifier) return p;
    }
    return null;
  }

  /**
   * 回填空壳条目正文，并用 prompt_order 纠正 enabled。
   * ST 导入常见坑：order 先占位空 content，真正正文在 rawPrompts；
   * 以及库条目 enabled=false 却被 AND 进最终 enabled。
   */
  function hydratePromptList(preset) {
    var p = preset || {};
    var list = Array.isArray(p.prompts)
      ? p.prompts.map(function (x) {
          return x ? Object.assign({}, x) : x;
        })
      : [];
    var rawPool = [];
    if (Array.isArray(p.rawPrompts)) rawPool = rawPool.concat(p.rawPrompts);
    if (Array.isArray(p.prompts)) rawPool = rawPool.concat(p.prompts);

    var byKey = Object.create(null);
    function remember(r) {
      if (!r || typeof r !== 'object') return;
      var content = String(r.content != null ? r.content : r.prompt != null ? r.prompt : '').trim();
      var keys = [r.identifier, r.id, r.name]
        .filter(Boolean)
        .map(function (k) {
          return String(k);
        });
      keys.forEach(function (k) {
        var prev = byKey[k];
        if (!prev || (content && !String(prev.content != null ? prev.content : prev.prompt || '').trim())) {
          byKey[k] = r;
        }
      });
    }
    rawPool.forEach(remember);

    var orderEnabled = Object.create(null);
    var hasOrderFlags = false;
    (Array.isArray(p.promptOrder) ? p.promptOrder : []).forEach(function (item) {
      if (item == null) return;
      var id = typeof item === 'string' ? item : item.identifier;
      if (!id) return;
      hasOrderFlags = true;
      orderEnabled[String(id)] = typeof item === 'object' ? item.enabled !== false : true;
    });

    list.forEach(function (item) {
      if (!item) return;
      var id = String(item.identifier || item.id || '');
      var name = String(item.name || '');
      if (hasOrderFlags && id && Object.prototype.hasOwnProperty.call(orderEnabled, id)) {
        item.enabled = orderEnabled[id];
      }
      if (String(item.content || '').trim()) {
        if (!isMarkerId(id)) item.marker = false;
        return;
      }
      if (isMarkerId(id)) return;
      var src = byKey[id] || byKey[name] || byKey[String(item.id || '')];
      if (!src) return;
      var c = String(src.content != null ? src.content : src.prompt != null ? src.prompt : '').trim();
      if (!c) return;
      item.content = c;
      item.marker = false;
      if (src.role != null && (item.role == null || item.role === '' || item.role === 'system')) {
        item.role = src.role;
      }
      if (src.injection_position != null && item.injection_position == null) {
        item.injection_position = src.injection_position;
      }
      if (src.injection_depth != null && item.depth == null) {
        item.depth = src.injection_depth;
      }
    });

    /* raw 里有正文、但 list 完全没这条的（order 漏了） */
    var seen = Object.create(null);
    list.forEach(function (item) {
      if (!item) return;
      [item.identifier, item.id, item.name].filter(Boolean).forEach(function (k) {
        seen[String(k)] = true;
      });
    });
    Object.keys(byKey).forEach(function (k) {
      if (seen[k]) return;
      var src = byKey[k];
      if (!src || isMarkerId(src.identifier || src.id || k)) return;
      var c = String(src.content != null ? src.content : src.prompt != null ? src.prompt : '').trim();
      if (!c) return;
      if (src.enabled === false && !(hasOrderFlags && orderEnabled[k])) return;
      var enabled = hasOrderFlags && Object.prototype.hasOwnProperty.call(orderEnabled, k) ? orderEnabled[k] : src.enabled !== false;
      list.push({
        id: String(src.identifier || src.id || k),
        identifier: src.identifier || k,
        name: src.name || src.identifier || k,
        role: src.role || 'system',
        content: c,
        enabled: enabled,
        marker: false,
        visible: true,
        injection_position:
          src.injection_position != null && src.injection_position !== ''
            ? Number(src.injection_position)
            : 0,
        depth: src.injection_depth != null ? Number(src.injection_depth) : src.depth != null ? Number(src.depth) : 0,
      });
      seen[k] = true;
    });

    return list;
  }

  /**
   * 得到有序提示词条目（含 marker）
   * 优先用预设已按 prompt_order 展开的 prompts[]
   */
  function getOrderedPromptEntries(preset) {
    var p = preset || {};
    var list = hydratePromptList(p);

    function isContentEntry(item) {
      if (!item || item.enabled === false || item.visible === false) return false;
      if (isStructuralMarker(item)) return false;
      return !!String(item.content || '').trim();
    }

    var hasContent = list.some(isContentEntry);

    /* 正文只在 systemPrompt 扁平字段时（常见：导入后 prompts 全是 marker） */
    if (!hasContent && String(p.systemPrompt || '').trim()) {
      list.unshift({
        id: 'main',
        identifier: 'main',
        name: 'Main Prompt',
        role: 'system',
        content: String(p.systemPrompt).trim(),
        enabled: true,
        marker: false,
        visible: true,
        injection_position: 0,
      });
      hasContent = true;
    }

    /* 若缺少关键 marker，按 ST 默认序补全 */
    var ids = {};
    list.forEach(function (item) {
      if (item && item.identifier) ids[item.identifier] = true;
    });

    function ensureMarker(id) {
      if (ids[id]) return;
      list.push({
        id: id,
        identifier: id,
        name: id,
        role: 'system',
        content: '',
        enabled: true,
        marker: true,
        visible: true,
      });
      ids[id] = true;
    }

    var hasOrder =
      (Array.isArray(p.promptOrder) && p.promptOrder.length) ||
      list.some(function (x) {
        return x && (x.marker || isMarkerId(x.identifier));
      });

    if (!hasOrder && list.length) {
      var contents = list.filter(isContentEntry);
      var rebuilt = [];
      DEFAULT_ORDER.forEach(function (id) {
        if (id === 'main') {
          contents.forEach(function (c) {
            rebuilt.push(c);
          });
          contents = [];
          return;
        }
        if (MARKERS[id]) {
          rebuilt.push({
            id: id,
            identifier: id,
            name: id,
            role: 'system',
            content: '',
            enabled: true,
            marker: true,
            visible: true,
          });
        } else {
          var named = findPrompt(list, id);
          if (named) rebuilt.push(named);
        }
      });
      contents.forEach(function (c) {
        rebuilt.push(c);
      });
      list = rebuilt;
    } else {
      ensureMarker('worldInfoBefore');
      ensureMarker('worldInfoAfter');
      ensureMarker('dialogueExamples');
      ensureMarker('chatHistory');

      /* 保证有正文时，正文出现在 chatHistory 之前 */
      var histIdx = list.findIndex(function (x) {
        return x && (x.identifier === 'chatHistory' || x.id === 'chatHistory');
      });
      if (histIdx > 0) {
        var before = list.slice(0, histIdx);
        var after = list.slice(histIdx);
        var contentBefore = before.some(isContentEntry);
        if (!contentBefore) {
          var moved = [];
          var restAfter = [];
          after.forEach(function (x) {
            if (isContentEntry(x)) moved.push(x);
            else restAfter.push(x);
          });
          /* 也把落在 hist 之后的 content 往前搬；再把 systemPrompt 补上 */
          list = before.concat(moved).concat(restAfter);
        }
      }
    }

    hasContent = list.some(isContentEntry);
    if (!hasContent && String(p.systemPrompt || '').trim()) {
      var hi = list.findIndex(function (x) {
        return x && (x.identifier === 'chatHistory' || x.id === 'chatHistory');
      });
      var mainEntry = {
        id: 'main',
        identifier: 'main',
        name: 'Main Prompt',
        role: 'system',
        content: String(p.systemPrompt).trim(),
        enabled: true,
        marker: false,
        visible: true,
        injection_position: 0,
      };
      if (hi < 0) list.unshift(mainEntry);
      else list.splice(hi, 0, mainEntry);
    }

    return list;
  }

  /**
   * ST 绝对注入：仅当 injection_position === 1
   * 不可用 position===1 判断（与世界书插入位、误导入字段冲突，会导致整份预设被挪进 @D 而不进相对序）
   */
  function isAbsolutePrompt(item) {
    if (!item) return false;
    if (item.absolute === true) return true;
    if (item.injection_position != null && item.injection_position !== '') {
      return Number(item.injection_position) === 1;
    }
    return false;
  }

  function getPersonaData() {
    if (!window.天青_persona || !window.天青_persona.load) return null;
    return window.天青_persona.load();
  }

  /** 指定插入位的人设正文（已 resolve）；不匹配或空则 '' */
  function getPersonaInjection(position) {
    var d = getPersonaData();
    if (!d || d.position !== position) return '';
    if (!window.天青_persona.resolvedDescription) return '';
    return String(window.天青_persona.resolvedDescription(d) || '').trim();
  }

  function getPersonaDepthInjection() {
    var d = getPersonaData();
    if (!d || d.position !== 'depth') return null;
    var text = getPersonaInjection('depth');
    if (!text) return null;
    return {
      content: text,
      role: 'system',
      depth: d.depth != null ? d.depth : 4,
      order: 50,
      _isPrompt: true,
    };
  }

  /**
   * 将 @D 世界书 / 绝对注入提示词插入历史（depth=0 紧贴最新消息之前）
   */
  function injectDepthEntries(chatMsgs, depthItems) {
    if (!depthItems || !depthItems.length) return;
    var groups = {};
    depthItems.forEach(function (e) {
      var d = Number(e.depth);
      if (isNaN(d) || d < 0) d = 0;
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    });
    Object.keys(groups)
      .map(Number)
      .sort(function (a, b) {
        return b - a;
      })
      .forEach(function (depth) {
        var items = groups[depth].slice().sort(sortByOrder);
        var idx = Math.max(0, chatMsgs.length - depth);
        items.forEach(function (e) {
          var content = e._isPrompt ? String(e.content || '').trim() : formatEntry(e);
          if (!content) return;
          var role = e._isPrompt ? normalizeRole(e.role) : wiRole(e.role);
          chatMsgs.splice(idx, 0, { role: role, content: content });
          idx += 1;
        });
      });
  }

  function appendChatHistory(messages, history, userText, wiBuckets, absolutePrompts) {
    var chatMsgs = [];
    (history || []).forEach(function (m) {
      if (!m) return;
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') return;
      var c = String(m.content || '');
      if (!c) return;
      chatMsgs.push({ role: m.role, content: c });
    });

    /* 用户设定 → 作者注顶部 */
    var personaAnTop = getPersonaInjection('an_top');
    if (personaAnTop) {
      chatMsgs.unshift({ role: 'system', content: personaAnTop });
    }

    /* AN Top：历史段开头 */
    pushEachAsRole(chatMsgs, wiBuckets.anTop);

    var depthItems = (wiBuckets.atDepth || []).slice();
    (absolutePrompts || []).forEach(function (p) {
      depthItems.push({
        content: p.content,
        role: p.role,
        depth: p.depth != null ? p.depth : 0,
        order: p.order != null ? p.order : 100,
        _isPrompt: true,
      });
    });

    /* 用户设定 → 聊天特定深度 */
    var personaDepth = getPersonaDepthInjection();
    if (personaDepth) depthItems.push(personaDepth);

    var userLine = String(userText || '').trim() || '（请根据当前状态继续演出下一轮）';
    chatMsgs.push({ role: 'user', content: userLine });

    injectDepthEntries(chatMsgs, depthItems);

    /* AN Bottom：在最新 user 之前再插一层（若 depth 未覆盖） */
    if (wiBuckets.anBottom && wiBuckets.anBottom.length) {
      var insertAt = Math.max(0, chatMsgs.length - 1);
      wiBuckets.anBottom
        .slice()
        .sort(sortByOrder)
        .forEach(function (e, i) {
          var text = formatEntry(e);
          if (!text) return;
          chatMsgs.splice(insertAt + i, 0, { role: wiRole(e.role), content: text });
        });
    }

    /* 用户设定 → 作者注底部（紧贴最新 user 之前） */
    var personaAnBottom = getPersonaInjection('an_bottom');
    if (personaAnBottom) {
      var anInsert = Math.max(0, chatMsgs.length - 1);
      chatMsgs.splice(anInsert, 0, { role: 'system', content: personaAnBottom });
    }

    chatMsgs.forEach(function (m) {
      messages.push(m);
    });
  }

  /** LINE：无完整主线历史；本轮 LINE 提示词 + 主线最近 1 轮 + @D / AN / 用户人设 */
  function appendLineUserTurn(messages, linePrompt, wiBuckets, absolutePrompts) {
    var chatMsgs = [];

    /* 用户设定 → 作者注顶部 */
    var personaAnTop = getPersonaInjection('an_top');
    if (personaAnTop) {
      chatMsgs.unshift({ role: 'system', content: personaAnTop });
    }

    pushEachAsRole(chatMsgs, wiBuckets.anTop);

    var depthItems = (wiBuckets.atDepth || []).slice();
    (absolutePrompts || []).forEach(function (p) {
      depthItems.push({
        content: p.content,
        role: p.role,
        depth: p.depth != null ? p.depth : 0,
        order: p.order != null ? p.order : 100,
        _isPrompt: true,
      });
    });

    /* 用户设定 → 聊天特定深度 */
    var personaDepth = getPersonaDepthInjection();
    if (personaDepth) depthItems.push(personaDepth);

    /* 主线最近 1 次常规 LLM 对话 → 总结性消息 */
    getLastMainChatTurnSummary().forEach(function (m) {
      chatMsgs.push({ role: m.role, content: m.content });
    });

    chatMsgs.push({
      role: 'user',
      content: String(linePrompt || '').trim() || '（请回复 LINE 私聊）',
    });
    injectDepthEntries(chatMsgs, depthItems);

    if (wiBuckets.anBottom && wiBuckets.anBottom.length) {
      var insertAt = Math.max(0, chatMsgs.length - 1);
      wiBuckets.anBottom
        .slice()
        .sort(sortByOrder)
        .forEach(function (e, i) {
          var text = formatEntry(e);
          if (!text) return;
          chatMsgs.splice(insertAt + i, 0, { role: wiRole(e.role), content: text });
        });
    }

    /* 用户设定 → 作者注底部（紧贴最新 user 之前） */
    var personaAnBottom = getPersonaInjection('an_bottom');
    if (personaAnBottom) {
      var anInsert = Math.max(0, chatMsgs.length - 1);
      chatMsgs.splice(anInsert, 0, { role: 'system', content: personaAnBottom });
    }

    chatMsgs.forEach(function (m) {
      messages.push(m);
    });
  }

  /**
   * 主线存档中最近 1 次常规对话：优先取末轮 user + assistant；
   * 若末条为 assistant 且前一条为 user，则取这两条；否则取末 1～2 条有效消息。
   * @returns {Array<{role:string,content:string}>}
   */
  function getLastMainChatTurn() {
    var hist = [];
    try {
      if (window.天青_save && typeof window.天青_save.load === 'function') {
        hist = (window.天青_save.load().messages || []).slice();
      }
    } catch (e) {
      hist = [];
    }
    var cleaned = [];
    hist.forEach(function (m) {
      if (!m) return;
      if (m.role !== 'user' && m.role !== 'assistant') return;
      var c = String(m.content || '').trim();
      if (!c) return;
      cleaned.push({ role: m.role, content: c });
    });
    if (!cleaned.length) return [];

    var last = cleaned[cleaned.length - 1];
    if (last.role === 'assistant' && cleaned.length >= 2) {
      var prev = cleaned[cleaned.length - 2];
      if (prev.role === 'user') return [prev, last];
      return [last];
    }
    if (last.role === 'user') return [last];
    /* 末条是 user 之外的异常：尽量带上前一条 */
    if (cleaned.length >= 2) return cleaned.slice(-2);
    return [last];
  }

  /**
   * 从主线消息正文提取总结性文案（优先快照，其次正文摘要）
   * @param {string} content
   * @param {{maxLen?: number}} [opts]
   */
  function extractMainTurnSummary(content, opts) {
    opts = opts || {};
    var maxLen = opts.maxLen != null ? opts.maxLen : 280;
    var text = String(content || '');
    if (!text.trim()) return '';

    var snap = text.match(/<summernight_snapshots\b[^>]*>([\s\S]*?)<\/summernight_snapshots>/i);
    if (snap && String(snap[1] || '').trim()) {
      return String(snap[1]).replace(/\s+/g, ' ').trim();
    }

    var main = text.match(/<summernight_maintext\b[^>]*>([\s\S]*?)<\/summernight_maintext>/i);
    if (main && String(main[1] || '').trim()) {
      text = String(main[1]);
    }

    var plain = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return '';
    if (plain.length > maxLen) plain = plain.slice(0, maxLen) + '…';
    return plain;
  }

  /**
   * LINE 用：主线最近 1 轮改为总结性消息（避免塞入整段 summernight XML）
   * @returns {Array<{role:string,content:string}>}
   */
  function getLastMainChatTurnSummary() {
    return getLastMainChatTurn().map(function (m) {
      var summary = extractMainTurnSummary(m.content);
      if (!summary) {
        return { role: m.role, content: '（本轮暂无摘要）' };
      }
      if (m.role === 'assistant') {
        return { role: 'assistant', content: '[本轮剧情摘要]\n' + summary };
      }
      return { role: 'user', content: summary };
    });
  }

  /**
   * 组装 Chat Completion messages。
   * 正文来自：预设 / 提示词界面 / 角色世界书 / 用户设定（按插入位置）。
   * @param {{ userText?: string, history?: Array<{role:string,content:string}> }} opts
   * @returns {Array<{role:string,content:string}>}
   */
  function buildChatMessages(opts) {
    opts = opts || {};
    var preset = resolveActivePreset();
    var savedHistory = ensureOpeningInHistory(opts.history || []);
    var userText = opts.userText || '';
    var scan = buildScanText(savedHistory, userText);
    var wi = activateWorldbookBuckets(scan, preset);
    var promptEntries = getOrderedPromptEntries(preset);

    var messages = [];
    var absolutePrompts = [];
    var relativeEntries = [];
    var stateBlock = '';
    var diag = {
      presetName: preset && preset.name,
      promptTotal: promptEntries.length,
      included: [],
      skipped: [],
      markers: [],
      absolute: [],
      wi: {
        before: (wi.before && wi.before.length) || 0,
        after: (wi.after && wi.after.length) || 0,
        atDepth: (wi.atDepth && wi.atDepth.length) || 0,
      },
    };

    promptEntries.forEach(function (item) {
      if (!item || item.enabled === false || item.visible === false) {
        if (item) {
          diag.skipped.push({
            name: item.name || item.identifier || item.id,
            reason: item.enabled === false ? 'enabled=false' : 'visible=false',
          });
        }
        return;
      }
      if (!isStructuralMarker(item) && !isMarkerId(item.identifier || item.id) && isAbsolutePrompt(item)) {
        if (String(item.content || '').trim()) {
          absolutePrompts.push(item);
          diag.absolute.push(item.name || item.identifier || item.id);
        } else {
          diag.skipped.push({
            name: item.name || item.identifier || item.id,
            reason: 'absolute but empty content',
          });
        }
        return;
      }
      relativeEntries.push(item);
    });

    var shellFlags = {
      sawWiBefore: false,
      sawWiAfter: false,
      personaPromptInjected: false,
      chatInserted: false,
    };
    var shellMessages = [];
    applyRelativePresetEntries(shellMessages, relativeEntries, {
      wi: wi,
      stateBlock: stateBlock,
      absolutePrompts: absolutePrompts,
      history: [],
      userText: '',
      includeHistory: false,
      flags: shellFlags,
      diag: { markers: [], skipped: [], included: [] },
    });
    finalizePresetShell(shellMessages, {
      wi: wi,
      stateBlock: stateBlock,
      absolutePrompts: absolutePrompts,
      history: [],
      userText: '',
      flags: shellFlags,
      diag: null,
      skipHistoryAppend: true,
    });

    var fixedTokens =
      estimateMessagesTokens(shellMessages) + measureHistoryInjectionsTokens(wi, absolutePrompts, userText);
    var contextLength = getContextLength();
    var historyBudget = Math.max(512, contextLength - fixedTokens);
    var picked = selectHistoryByTokenBudget(savedHistory, userText, historyBudget);
    var history = picked.history;

    diag.history = {
      contextLength: contextLength,
      fixedTokens: fixedTokens,
      historyBudget: historyBudget,
      savedTurns: cleanChatTurns(savedHistory).length,
      pickedTurns: picked.picked,
      totalTurns: picked.total,
      usedTokens: picked.used,
      allIncluded: !!picked.allIncluded,
      forcedAll: !!picked.forcedAll,
      tokenizer:
        window.天青_tokens && window.天青_tokens.resolveEncoding
          ? window.天青_tokens.resolveEncoding()
          : 'fallback',
    };

    messages = [];
    var buildFlags = {
      sawWiBefore: false,
      sawWiAfter: false,
      personaPromptInjected: false,
      chatInserted: false,
    };
    applyRelativePresetEntries(messages, relativeEntries, {
      wi: wi,
      stateBlock: stateBlock,
      absolutePrompts: absolutePrompts,
      history: history,
      userText: userText,
      includeHistory: true,
      flags: buildFlags,
      diag: diag,
    });
    finalizePresetShell(messages, {
      wi: wi,
      stateBlock: stateBlock,
      absolutePrompts: absolutePrompts,
      history: history,
      userText: userText,
      flags: buildFlags,
      diag: diag,
    });

    var hasUser = messages.some(function (m) {
      return m && m.role === 'user';
    });
    if (!hasUser) {
      messages.push({
        role: 'user',
        content: defaultUserLine(userText),
      });
    }

    try {
      var skipTally = {};
      diag.skipped.forEach(function (s) {
        var r = (s && s.reason) || '?';
        skipTally[r] = (skipTally[r] || 0) + 1;
      });
      diag.skipTally = skipTally;
      console.groupCollapsed(
        '[SummerNight Plus] 提示词组装 · 预设正文 ' +
          diag.included.length +
          ' 条 / 跳过 ' +
          diag.skipped.length +
          ' · messages=' +
          messages.length,
      );
      console.log(diag);
      if (!diag.included.length) {
        console.warn(
          '没有拼进任何预设正文条目。跳过原因统计：',
          skipTally,
          '。建议：重新导入 Chat Completion 预设，或打开预设页确认卡片正文非空后点「保存更改」。',
        );
      }
      console.groupEnd();
    } catch (e) {}

    var substitute =
      window.天青_stat_data && typeof window.天青_stat_data.substituteStatDataMacros === 'function'
        ? window.天青_stat_data.substituteStatDataMacros
        : null;

    return messages.map(function (m) {
      var content = m.content;
      if (substitute && content != null && content !== '') {
        content = substitute(content);
      }
      return { role: m.role, content: content };
    });
  }

  /**
   * LINE 私聊专用组装：
   * - 系统设置 · 预设（prompt_order / prompts）
   * - 角色设置 · 角色世界书
   * - 用户设定（人设，按插入位置）
   * - 主线最近 1 次常规 LLM 对话（总结性消息，非全文）
   * - 系统设置 · 手机 · LINE 提示词（作为本轮 user，已填占位符；含当前游戏时间）
   * 不含：系统设置-提示词、Gal 状态块、完整主线历史
   * @param {{ linePrompt: string, scanText?: string }} opts
   */
  function buildLineChatMessages(opts) {
    opts = opts || {};
    var preset = resolveActivePreset();
    var linePrompt = String(opts.linePrompt || '').trim();
    var scan = String(opts.scanText != null ? opts.scanText : linePrompt);
    var wi = activateWorldbookBuckets(scan, preset, collectLineWorldbookPool());
    var promptEntries = getOrderedPromptEntries(preset);

    var messages = [];
    var absolutePrompts = [];
    var relativeEntries = [];
    var chatInserted = false;
    var personaPromptInjected = false;
    var diag = {
      mode: 'line',
      presetName: preset && preset.name,
      promptTotal: promptEntries.length,
      included: [],
      skipped: [],
      markers: [],
      absolute: [],
      mainTurn: getLastMainChatTurnSummary().length,
      wi: {
        before: (wi.before && wi.before.length) || 0,
        after: (wi.after && wi.after.length) || 0,
        atDepth: (wi.atDepth && wi.atDepth.length) || 0,
      },
    };

    promptEntries.forEach(function (item) {
      if (!item || item.enabled === false || item.visible === false) {
        if (item) {
          diag.skipped.push({
            name: item.name || item.identifier || item.id,
            reason: item.enabled === false ? 'enabled=false' : 'visible=false',
          });
        }
        return;
      }
      if (!isStructuralMarker(item) && !isMarkerId(item.identifier || item.id) && isAbsolutePrompt(item)) {
        if (String(item.content || '').trim()) {
          absolutePrompts.push(item);
          diag.absolute.push(item.name || item.identifier || item.id);
        } else {
          diag.skipped.push({
            name: item.name || item.identifier || item.id,
            reason: 'absolute but empty content',
          });
        }
        return;
      }
      relativeEntries.push(item);
    });

    var sawWiBefore = false;
    var sawWiAfter = false;

    relativeEntries.forEach(function (item) {
      var id = item.identifier || item.id || '';
      var structural = isStructuralMarker(item) || isMarkerId(id);

      if (structural) {
        diag.markers.push(id || item.name || '?');
        if (id === 'worldInfoBefore') {
          pushJoinedSystem(messages, wi.before, '世界书·角色定义前');
          sawWiBefore = true;
        } else if (id === 'worldInfoAfter') {
          pushJoinedSystem(messages, wi.after, '世界书·角色定义后');
          sawWiAfter = true;
        } else if (id === 'dialogueExamples') {
          pushJoinedSystem(messages, wi.emTop, '世界书·示例前');
          pushJoinedSystem(messages, wi.emBottom, '世界书·示例后');
        } else if (id === 'chatHistory') {
          appendLineUserTurn(messages, linePrompt, wi, absolutePrompts);
          chatInserted = true;
        } else if (id === 'personaDescription') {
          var personaPrompt = getPersonaInjection('prompt');
          if (personaPrompt) {
            messages.push({ role: 'system', content: personaPrompt });
            personaPromptInjected = true;
            diag.included.push({
              name: 'personaDescription',
              role: 'system',
              chars: personaPrompt.length,
            });
          }
        }
        return;
      }

      var content = String(item.content || '').trim();
      if (!content) {
        diag.skipped.push({
          name: item.name || id,
          reason: 'empty content',
        });
        return;
      }
      messages.push({
        role: normalizeRole(item.role),
        content: content,
      });
      diag.included.push({
        name: item.name || id,
        role: normalizeRole(item.role),
        chars: content.length,
      });
    });

    if (!chatInserted) {
      if (!sawWiBefore && wi.before.length) {
        pushJoinedSystem(messages, wi.before, '世界书·角色定义前');
      }
      if (!sawWiAfter && wi.after.length) {
        pushJoinedSystem(messages, wi.after, '世界书·角色定义后');
      }
      appendLineUserTurn(messages, linePrompt, wi, absolutePrompts);
    }

    if (!personaPromptInjected) {
      var fallbackPersona = getPersonaInjection('prompt');
      if (fallbackPersona) {
        var insertAt = 0;
        for (var pi = 0; pi < messages.length; pi++) {
          if (messages[pi] && messages[pi].role === 'user') {
            insertAt = pi;
            break;
          }
          insertAt = pi + 1;
        }
        messages.splice(insertAt, 0, { role: 'system', content: fallbackPersona });
        diag.included.push({
          name: 'persona(fallback)',
          role: 'system',
          chars: fallbackPersona.length,
        });
      }
    }

    var hasUser = messages.some(function (m) {
      return m && m.role === 'user';
    });
    if (!hasUser) {
      messages.push({
        role: 'user',
        content: linePrompt || '（请回复 LINE 私聊）',
      });
    }

    try {
      console.groupCollapsed(
        '[SummerNight Plus] LINE 提示词组装 · 预设正文 ' +
          diag.included.length +
          ' 条 · messages=' +
          messages.length,
      );
      console.log(diag);
      console.groupEnd();
    } catch (e) {}

    var substitute =
      window.天青_stat_data && typeof window.天青_stat_data.substituteStatDataMacros === 'function'
        ? window.天青_stat_data.substituteStatDataMacros
        : null;

    return messages.map(function (m) {
      var content = m.content;
      if (substitute && content != null && content !== '') {
        content = substitute(content);
      }
      return { role: m.role, content: content };
    });
  }

  /**
   * LINE 钩子专用组装：
   * - 系统设置 · 预设（仅正文条目，不含世界书 / chatHistory）
   * - 用户设定（人设）
   * - 主线最近 1 轮（总结性消息）
   * - 系统设置 · 手机 · LINE 提示词（本轮 user，含当前游戏时间）
   * @param {{ linePrompt: string }} opts
   */
  function buildLineHookChatMessages(opts) {
    opts = opts || {};
    var preset = resolveActivePreset();
    var linePrompt = String(opts.linePrompt || '').trim();
    var promptEntries = getOrderedPromptEntries(preset);
    var messages = [];
    var personaPromptInjected = false;
    var diag = {
      mode: 'line-hook',
      presetName: preset && preset.name,
      mainTurn: getLastMainChatTurnSummary().length,
      included: [],
    };

    promptEntries.forEach(function (item) {
      if (!item || item.enabled === false || item.visible === false) return;
      if (!isStructuralMarker(item) && !isMarkerId(item.identifier || item.id) && isAbsolutePrompt(item)) {
        return;
      }
      var id = item.identifier || item.id || '';
      if (isStructuralMarker(item) || isMarkerId(id)) {
        if (id === 'personaDescription') {
          var personaAtMarker = getPersonaInjection('prompt');
          if (personaAtMarker) {
            messages.push({ role: 'system', content: personaAtMarker });
            personaPromptInjected = true;
            diag.included.push({
              name: 'personaDescription',
              role: 'system',
              chars: personaAtMarker.length,
            });
          }
        }
        return;
      }

      var content = String(item.content || '').trim();
      if (!content) return;
      messages.push({
        role: normalizeRole(item.role),
        content: content,
      });
      diag.included.push({
        name: item.name || id,
        role: normalizeRole(item.role),
        chars: content.length,
      });
    });

    if (!personaPromptInjected) {
      var fallbackPersona = getPersonaInjection('prompt');
      if (fallbackPersona) {
        messages.push({ role: 'system', content: fallbackPersona });
        diag.included.push({
          name: 'persona(fallback)',
          role: 'system',
          chars: fallbackPersona.length,
        });
      }
    }

    /* an_top / depth / an_bottom 与主线一致（钩子无世界书桶时仅人设） */
    var personaAnTop = getPersonaInjection('an_top');
    if (personaAnTop) messages.push({ role: 'system', content: personaAnTop });

    getLastMainChatTurnSummary().forEach(function (m) {
      messages.push({ role: m.role, content: m.content });
    });

    var personaDepth = getPersonaDepthInjection();
    var hookUser = {
      role: 'user',
      content: linePrompt || '（请根据钩子回复 LINE 私聊）',
    };
    messages.push(hookUser);
    if (personaDepth) {
      injectDepthEntries(messages, [personaDepth]);
    }

    var personaAnBottom = getPersonaInjection('an_bottom');
    if (personaAnBottom) {
      var anInsert = Math.max(0, messages.length - 1);
      messages.splice(anInsert, 0, { role: 'system', content: personaAnBottom });
    }
    try {
      console.groupCollapsed(
        '[SummerNight Plus] LINE 钩子提示词 · 预设 ' +
          diag.included.length +
          ' 条 · 主线 ' +
          diag.mainTurn +
          ' 条 · messages=' +
          messages.length,
      );
      console.log(diag);
      console.groupEnd();
    } catch (e) {}

    var substitute =
      window.天青_stat_data && typeof window.天青_stat_data.substituteStatDataMacros === 'function'
        ? window.天青_stat_data.substituteStatDataMacros
        : null;

    return messages.map(function (m) {
      var content = m.content;
      if (substitute && content != null && content !== '') {
        content = substitute(content);
      }
      return { role: m.role, content: content };
    });
  }

  /** 兼容旧接口：拼成单条 system（调试用） */
  function buildSystemMessage(extraScanText) {
    var msgs = buildChatMessages({
      userText: extraScanText || '',
      history: [],
    });
    return msgs
      .filter(function (m) {
        return m.role === 'system';
      })
      .map(function (m) {
        return m.content;
      })
      .join('\n\n');
  }

  /** Twitter 钩子：组装方式与 LINE 钩子相同，仅替换手机 App 提示词内容 */
  function buildTwitterHookChatMessages(opts) {
    opts = opts || {};
    return buildLineHookChatMessages({
      linePrompt: opts.twitterPrompt || opts.linePrompt || '',
    });
  }

  window.天青_prompt_builder = {
    buildChatMessages: buildChatMessages,
    buildLineChatMessages: buildLineChatMessages,
    buildLineHookChatMessages: buildLineHookChatMessages,
    buildTwitterHookChatMessages: buildTwitterHookChatMessages,
    buildSystemMessage: buildSystemMessage,
    activateWorldbookBuckets: activateWorldbookBuckets,
    collectWorldbookPool: collectWorldbookPool,
    collectLineWorldbookPool: collectLineWorldbookPool,
    getLastMainChatTurn: getLastMainChatTurn,
    getLastMainChatTurnSummary: getLastMainChatTurnSummary,
    extractMainTurnSummary: extractMainTurnSummary,
    selectHistoryByTokenBudget: selectHistoryByTokenBudget,
    ensureOpeningInHistory: ensureOpeningInHistory,
    estimateMessageTokens: estimateMessageTokens,
    WI: {
      BEFORE: WI_BEFORE,
      AFTER: WI_AFTER,
      AN_TOP: WI_AN_TOP,
      AN_BOTTOM: WI_AN_BOTTOM,
      AT_DEPTH: WI_AT_DEPTH,
      EM_TOP: WI_EM_TOP,
      EM_BOTTOM: WI_EM_BOTTOM,
    },
  };
})();
