/**
 * 系统设置 · 提示词（世界书分条目，解析/字段对齐角色设置）
 * 含不可删除的「变量列表」词条，内容由变量树自动生成
 * 对外：window.天青_settings_prompt
 */
(function () {
  var KEY = 'tq_plus_system_prompts';
  var SEED_KEY = 'tq_plus_prompt_wb_seed';
  var SEED_VER = 'prompt-default-wb-v4';
  var STAT_DATA_UID = 'tq_locked_stat_data';
  var store = { entries: [] };
  var expandedId = null;
  var pendingImport = null;
  var drag = null;
  var LONG_PRESS_MS = 180;
  var MOVE_CANCEL_PX = 8;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function makeUid() {
    return 'wb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function entries() {
    if (!Array.isArray(store.entries)) store.entries = [];
    return store.entries;
  }

  function entryUid(entry, index) {
    if (entry && entry.uid != null && String(entry.uid) !== '') return String(entry.uid);
    return 'wb_' + index;
  }

  function findIndex(id) {
    var list = entries();
    for (var i = 0; i < list.length; i++) {
      if (entryUid(list[i], i) === String(id)) return i;
    }
    return -1;
  }

  function findEntry(id) {
    var i = findIndex(id);
    return i < 0 ? null : store.entries[i];
  }

  function ensureEntryShape(entry, index) {
    if (!entry || typeof entry !== 'object') return entry;
    if (entry.uid == null || entry.uid === '') entry.uid = makeUid() + '_' + index;
    if (!Array.isArray(entry.key)) entry.key = [];
    if (!Array.isArray(entry.keysecondary)) entry.keysecondary = [];
    if (entry.content == null) entry.content = '';
    if (entry.comment == null) entry.comment = '';
    if (entry.enabled == null) entry.enabled = true;
    if (entry.constant == null) entry.constant = false;
    if (entry.order == null) entry.order = index;
    if (entry.position == null) entry.position = 0;
    if (entry.depth == null) entry.depth = 4;
    if (entry.role == null) entry.role = 0;
    if (entry.probability == null) entry.probability = 100;
    if (entry.selectiveLogic == null) entry.selectiveLogic = 0;
    if (entry.useGroupScoring == null) entry.useGroupScoring = false;
    if (entry.automationId == null) entry.automationId = '';
    if (entry.excludeRecursion == null) entry.excludeRecursion = false;
    if (entry.preventRecursion == null) entry.preventRecursion = false;
    if (entry.delayUntilRecursion == null) entry.delayUntilRecursion = false;
    if (entry.ignoreBudget == null) entry.ignoreBudget = false;
    return entry;
  }

  function makeBlankEntry(index) {
    return {
      uid: makeUid(),
      key: [],
      keysecondary: [],
      content: '',
      enabled: true,
      constant: false,
      order: index != null ? index : 100,
      comment: '新条目',
      position: 0,
      depth: 4,
      role: 0,
      probability: 100,
      selectiveLogic: 0,
      scanDepth: null,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: false,
      automationId: '',
      excludeRecursion: false,
      preventRecursion: false,
      delayUntilRecursion: false,
      ignoreBudget: false,
    };
  }

  function migrateLegacy(e, i) {
    if (!e || typeof e !== 'object') return makeBlankEntry(i);
    /* 旧版提示词：name/role(string) → 世界书字段 */
    if (e.comment == null && e.name != null && !Array.isArray(e.key)) {
      return ensureEntryShape(
        {
          uid: e.uid || e.id || makeUid(),
          comment: String(e.name || '未命名'),
          content: String(e.content || ''),
          enabled: e.enabled !== false,
          key: [],
          keysecondary: [],
          constant: false,
          order: i,
        },
        i,
      );
    }
    return ensureEntryShape(e, i);
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { entries: [] };
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.entries)) return { entries: [] };
      o.entries = o.entries.map(migrateLegacy);
      return o;
    } catch (err) {
      return { entries: [] };
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (err) {}
  }

  /** 内嵌默认提示词世界书 → 规范条目 */
  function loadDefaultPromptEntries() {
    var raw = window.天青_default_prompt_worldbook;
    if (!raw) return [];
    var api = window.天青_preset;
    if (api && typeof api.importWorldbook === 'function') {
      try {
        return (api.importWorldbook(raw) || []).map(function (e, i) {
          return ensureEntryShape(e, i);
        });
      } catch (e) {
        console.warn('[天青 提示词] 默认提示词解析失败', e);
      }
    }
    return [];
  }

  /**
   * 首次 / 仅有「变量列表」时：写入内嵌基础提示词
   * 已有其它条目则跳过；仅有锁定词条时会补种（修复旧缓存/旧 seed）
   */
  function ensureDefaultPrompts() {
    var seeded = '';
    try {
      seeded = localStorage.getItem(SEED_KEY) || '';
    } catch (e) {}

    var list = entries();
    var custom = list.filter(function (e) {
      return e && e.uid !== STAT_DATA_UID;
    });
    if (custom.length) {
      if (seeded !== SEED_VER) {
        try {
          localStorage.setItem(SEED_KEY, SEED_VER);
        } catch (e) {}
      }
      return false;
    }

    /* 无自定义条目：即使旧版 seed 已写，仍补种一次（v2） */
    if (seeded === SEED_VER) return false;

    var defaults = loadDefaultPromptEntries();
    if (!defaults.length) {
      console.warn('[天青 提示词] 默认基础提示词未加载（检查 default-prompt-worldbook.js）');
      return false;
    }
    store.entries = defaults;
    saveStore();
    try {
      localStorage.setItem(SEED_KEY, SEED_VER);
    } catch (e) {}
    console.info('[天青 提示词] 已载入默认基础提示词', defaults.length + ' 条');
    return true;
  }

  function isStatDataEntry(entry) {
    return !!(entry && (entry.uid === STAT_DATA_UID || (entry.locked === true && entry.uid === STAT_DATA_UID)));
  }

  /** 变量列表：默认 AUTO；statAuto===false 为 CLOSE 手动 */
  function isStatAuto(entry) {
    if (!isStatDataEntry(entry)) return true;
    return entry.statAuto !== false;
  }

  function buildStatDataContent() {
    var api = window.天青_settings_variable;
    if (!api || typeof api.listLeaves !== 'function') return '';
    var leaves = api.listLeaves() || [];
    return leaves
      .map(function (leaf) {
        var name = String(leaf.varName || leaf.label || '').trim();
        var line = name + '：' + String(leaf.macro || '');
        if (leaf.comment) line += ' #' + String(leaf.comment);
        return line;
      })
      .join('\n');
  }

  function makeStatDataEntry() {
    return ensureEntryShape(
      {
        uid: STAT_DATA_UID,
        locked: true,
        statAuto: true,
        comment: '变量列表',
        content: buildStatDataContent(),
        enabled: true,
        constant: true,
        order: -1000,
        key: [],
        keysecondary: [],
        position: 0,
        depth: 4,
        role: 0,
        probability: 100,
        selectiveLogic: 0,
        useGroupScoring: false,
        automationId: '',
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        ignoreBudget: false,
      },
      0,
    );
  }

  /** 确保存在不可删除的「变量列表」词条；AUTO 时刷新捕获内容 */
  function syncStatDataPrompt(opt) {
    opt = opt || {};
    var list = entries();
    var content = buildStatDataContent();
    var kept = null;
    var keptIdx = -1;
    var others = [];
    list.forEach(function (e, i) {
      if (e && e.uid === STAT_DATA_UID) {
        if (!kept) {
          kept = e;
          keptIdx = i;
        }
        return;
      }
      others.push(e);
    });
    var entry = kept || makeStatDataEntry();
    ensureEntryShape(entry, keptIdx < 0 ? 0 : keptIdx);
    entry.locked = true;
    entry.uid = STAT_DATA_UID;
    entry.comment = '变量列表';
    entry.constant = true;
    if (entry.statAuto == null) entry.statAuto = true;
    if (isStatAuto(entry)) entry.content = content;
    if (entry.order == null) entry.order = -1000;
    if (keptIdx < 0) {
      others.unshift(entry);
    } else {
      var insertAt = Math.min(keptIdx, others.length);
      others.splice(insertAt, 0, entry);
    }
    store.entries = others;
    saveStore();
    if (!opt.silent) renderList();
    else {
      var card = document.querySelector('.prompt-card[data-id="' + STAT_DATA_UID + '"]');
      if (card) {
        var preview = card.querySelector('.regex-card-preview');
        var ta = card.querySelector('[data-field="content"]');
        var pv = previewText(entry);
        if (preview) {
          preview.textContent = pv;
          preview.hidden = !pv;
          preview.title = pv;
        }
        if (ta && isStatAuto(entry)) ta.value = entry.content || '';
        var metaEl = card.querySelector('.char-wb-meta');
        if (metaEl) metaEl.textContent = '(词符: ' + approxTokens(entry.content) + ') (UID: ' + STAT_DATA_UID + ')';
      }
    }
  }

  function parseKeyList(text) {
    return String(text || '')
      .split(/[,，\n\r]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function keysBadge(entry) {
    if (entry && entry.constant) return '常驻';
    var keys = (entry && entry.key) || [];
    if (!keys.length) return '无关键词';
    var s = keys.slice(0, 3).join(', ');
    if (keys.length > 3) s += '…';
    return s;
  }

  function previewText(entry) {
    return String((entry && entry.content) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function approxTokens(text) {
    return Math.max(0, Math.ceil(String(text || '').length / 1.7));
  }

  function triSelectValue(v) {
    if (v == null) return '';
    return v ? '1' : '0';
  }

  function parseTriSelect(raw) {
    if (raw === '' || raw == null) return null;
    return raw === '1' || raw === 'true';
  }

  function positionSelectValue(entry) {
    var pos = entry && entry.position != null ? Number(entry.position) : 0;
    if (pos === 4) {
      var role = entry && entry.role != null ? Number(entry.role) : 0;
      if (role !== 0 && role !== 1 && role !== 2) role = 0;
      return '4:' + role;
    }
    return String(pos);
  }

  function applyPositionSelect(entry, raw) {
    var s = String(raw || '0');
    if (s.indexOf('4:') === 0) {
      entry.position = 4;
      entry.role = Number(s.slice(2)) || 0;
      return;
    }
    entry.position = Number(s) || 0;
    if (entry.position !== 4 && entry.role == null) entry.role = 0;
  }

  function writeFromBody(card) {
    if (!card) return false;
    var entry = findEntry(card.dataset.id);
    if (!entry) return false;
    ensureEntryShape(entry, 0);
    var locked = isStatDataEntry(entry);
    var auto = isStatAuto(entry);
    var contentLocked = locked && auto;
    var changed = false;

    function setStr(field, next) {
      if (String(entry[field] || '') !== String(next)) {
        entry[field] = next;
        changed = true;
      }
    }
    function setNum(field, next) {
      var n = next == null || next === '' || isNaN(Number(next)) ? null : Number(next);
      if (entry[field] !== n && !(entry[field] == null && n == null)) {
        entry[field] = n;
        changed = true;
      }
    }
    function setBool(field, next) {
      next = !!next;
      if (!!entry[field] !== next) {
        entry[field] = next;
        changed = true;
      }
    }
    function setTri(field, next) {
      if (entry[field] !== next) {
        entry[field] = next;
        changed = true;
      }
    }

    var el;
    el = card.querySelector('[data-field="comment"]');
    if (el && !locked) setStr('comment', String(el.value || '').trim());
    el = card.querySelector('[data-field="key"]');
    if (el && !locked) {
      var nextKey = parseKeyList(el.value);
      if (JSON.stringify(nextKey) !== JSON.stringify(entry.key || [])) {
        entry.key = nextKey;
        changed = true;
      }
    }
    el = card.querySelector('[data-field="keysecondary"]');
    if (el && !locked) {
      var nextKey2 = parseKeyList(el.value);
      if (JSON.stringify(nextKey2) !== JSON.stringify(entry.keysecondary || [])) {
        entry.keysecondary = nextKey2;
        changed = true;
      }
    }
    el = card.querySelector('[data-field="content"]');
    if (el && !contentLocked) setStr('content', String(el.value || ''));
    el = card.querySelector('[data-field="position"]');
    if (el) {
      var prevPos = positionSelectValue(entry);
      if (String(el.value) !== String(prevPos)) {
        applyPositionSelect(entry, el.value);
        changed = true;
      }
    }
    el = card.querySelector('[data-field="order"]');
    if (el && !locked) setNum('order', el.value === '' ? 100 : el.value);
    el = card.querySelector('[data-field="probability"]');
    if (el) setNum('probability', el.value === '' ? 100 : el.value);
    el = card.querySelector('[data-field="depth"]');
    if (el) setNum('depth', el.value === '' ? 4 : el.value);
    el = card.querySelector('[data-field="selectiveLogic"]');
    if (el) setNum('selectiveLogic', el.value);
    el = card.querySelector('[data-field="scanDepth"]');
    if (el) setNum('scanDepth', el.value === '' ? null : el.value);
    el = card.querySelector('[data-field="caseSensitive"]');
    if (el) setTri('caseSensitive', parseTriSelect(el.value));
    el = card.querySelector('[data-field="matchWholeWords"]');
    if (el) setTri('matchWholeWords', parseTriSelect(el.value));
    el = card.querySelector('[data-field="useGroupScoring"]');
    if (el) setBool('useGroupScoring', el.value === '1');
    el = card.querySelector('[data-field="automationId"]');
    if (el) setStr('automationId', String(el.value || '').trim());
    el = card.querySelector('[data-field="constant"]');
    if (el && !locked) setBool('constant', el.checked);
    el = card.querySelector('[data-field="excludeRecursion"]');
    if (el) setBool('excludeRecursion', el.checked);
    el = card.querySelector('[data-field="preventRecursion"]');
    if (el) setBool('preventRecursion', el.checked);
    el = card.querySelector('[data-field="delayUntilRecursion"]');
    if (el) setBool('delayUntilRecursion', el.checked);
    el = card.querySelector('[data-field="ignoreBudget"]');
    if (el) setBool('ignoreBudget', el.checked);

    if (!changed) return false;

    var title = card.querySelector('.regex-card-title');
    var preview = card.querySelector('.regex-card-preview');
    var badge = card.querySelector('.regex-place');
    var meta = card.querySelector('.char-wb-meta');
    var name = entry.comment || (entry.key && entry.key[0]) || '未命名条目';
    if (title) {
      title.textContent = name;
      title.title = name;
    }
    if (preview) {
      var pv = previewText(entry);
      preview.textContent = pv;
      preview.hidden = !pv;
      preview.title = pv;
    }
    if (badge) {
      badge.textContent = keysBadge(entry);
      badge.classList.toggle('is-constant', !!entry.constant);
    }
    if (meta) meta.textContent = '(词符: ' + approxTokens(entry.content) + ') (UID: ' + entry.uid + ')';
    return true;
  }

  function syncFromBody(card) {
    if (writeFromBody(card)) saveStore();
  }

  function flushOpen() {
    var list = $('prompt-list');
    if (!list) return;
    list.querySelectorAll('.prompt-card').forEach(function (card) {
      if (card.querySelector('[data-field]') && writeFromBody(card)) saveStore();
    });
  }

  function fillEntryBody(body, entry) {
    function q(field) {
      return body.querySelector('[data-field="' + field + '"]');
    }
    var locked = isStatDataEntry(entry);
    var auto = isStatAuto(entry);
    var contentLocked = locked && auto;
    var el;
    el = q('comment');
    if (el) {
      el.value = entry.comment || '';
      el.readOnly = locked;
      el.disabled = locked;
    }
    el = q('key');
    if (el) {
      el.value = (entry.key || []).join(', ');
      el.readOnly = locked;
    }
    el = q('keysecondary');
    if (el) {
      el.value = (entry.keysecondary || []).join(', ');
      el.readOnly = locked;
    }
    el = q('content');
    if (el) {
      el.value = entry.content || '';
      el.readOnly = contentLocked;
    }
    el = q('position');
    if (el) el.value = positionSelectValue(entry);
    el = q('order');
    if (el) {
      el.value = entry.order != null ? entry.order : 100;
      el.readOnly = locked;
    }
    el = q('probability');
    if (el) el.value = entry.probability != null ? entry.probability : 100;
    el = q('depth');
    if (el) el.value = entry.depth != null ? entry.depth : 4;
    el = q('selectiveLogic');
    if (el) el.value = String(entry.selectiveLogic != null ? entry.selectiveLogic : 0);
    el = q('scanDepth');
    if (el) el.value = entry.scanDepth == null ? '' : entry.scanDepth;
    el = q('caseSensitive');
    if (el) el.value = triSelectValue(entry.caseSensitive);
    el = q('matchWholeWords');
    if (el) el.value = triSelectValue(entry.matchWholeWords);
    el = q('useGroupScoring');
    if (el) el.value = entry.useGroupScoring ? '1' : '0';
    el = q('automationId');
    if (el) el.value = entry.automationId || '';
    el = q('constant');
    if (el) {
      el.checked = !!entry.constant;
      el.disabled = locked;
    }
    el = q('excludeRecursion');
    if (el) el.checked = !!entry.excludeRecursion;
    el = q('preventRecursion');
    if (el) el.checked = !!entry.preventRecursion;
    el = q('delayUntilRecursion');
    if (el) el.checked = !!entry.delayUntilRecursion;
    el = q('ignoreBudget');
    if (el) el.checked = !!entry.ignoreBudget;
    var meta = body.querySelector('.char-wb-meta');
    if (meta) meta.textContent = '(词符: ' + approxTokens(entry.content) + ') (UID: ' + entry.uid + ')';
    var dup = body.querySelector('[data-act="duplicate"]');
    if (dup) dup.hidden = locked;
    var expandContent = body.querySelector('[data-act="expand-content"]');
    if (expandContent) expandContent.hidden = contentLocked;
  }

  function renderList() {
    var list = $('prompt-list');
    var empty = $('prompt-list-empty');
    var svg = window.天青_svg;
    if (!list) return;
    var items = entries();
    list.innerHTML = '';
    if (empty) empty.style.display = items.length ? 'none' : '';

    items.forEach(function (entry, index) {
      ensureEntryShape(entry, index);
      var id = entryUid(entry, index);
      var open = String(expandedId) === String(id);
      var on = entry.enabled !== false;

      var li = document.createElement('li');
      li.className =
        'regex-card char-wb-card prompt-card' +
        (on ? '' : ' is-off') +
        (open ? ' is-open' : '') +
        (isStatDataEntry(entry) ? ' is-locked' : '');
      li.dataset.id = id;

      var top = document.createElement('div');
      top.className = 'regex-card-top';

      var locked = isStatDataEntry(entry);
      var auto = isStatAuto(entry);

      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'preset-drag-handle';
      handle.title = '拖动排序（按住手柄拖动）';
      handle.setAttribute('aria-label', '拖动排序');
      if (svg && svg.grip) svg.mount(handle, svg.grip);
      top.appendChild(handle);

      var hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'regex-card-hit';
      hit.setAttribute('data-act', 'expand');
      hit.setAttribute('aria-expanded', open ? 'true' : 'false');

      var idx = document.createElement('span');
      idx.className = 'regex-card-index';
      idx.textContent = String(index + 1);

      var main = document.createElement('div');
      main.className = 'regex-card-main';

      var titleRow = document.createElement('div');
      titleRow.className = 'regex-card-title-row';

      var title = document.createElement('span');
      title.className = 'regex-card-title';
      var name = entry.comment || (entry.key && entry.key[0]) || '未命名条目';
      title.textContent = name;
      title.title = name;

      var badge = document.createElement('span');
      badge.className = 'regex-place' + (entry.constant ? ' is-constant' : '');
      badge.textContent = keysBadge(entry);

      titleRow.appendChild(title);
      titleRow.appendChild(badge);
      main.appendChild(titleRow);

      var pv = previewText(entry);
      var preview = document.createElement('div');
      preview.className = 'regex-card-preview';
      preview.textContent = pv;
      preview.title = pv;
      preview.hidden = !pv;
      main.appendChild(preview);

      var chevron = document.createElement('span');
      chevron.className = 'regex-card-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      if (svg && svg.chevron) svg.mount(chevron, svg.chevron);

      hit.appendChild(idx);
      hit.appendChild(main);
      hit.appendChild(chevron);

      var side = document.createElement('div');
      side.className = 'regex-card-side';

      var move = document.createElement('div');
      move.className = 'preset-move';

      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'preset-icon-btn';
      upBtn.title = '上移';
      upBtn.setAttribute('data-act', 'up');
      upBtn.disabled = index === 0;
      if (svg && svg.arrowUp) svg.mount(upBtn, svg.arrowUp);

      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'preset-icon-btn';
      downBtn.title = '下移';
      downBtn.setAttribute('data-act', 'down');
      downBtn.disabled = index >= items.length - 1;
      if (svg && svg.arrowDown) svg.mount(downBtn, svg.arrowDown);

      move.appendChild(upBtn);
      move.appendChild(downBtn);
      side.appendChild(move);

      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'preset-switch' + (on ? ' is-on' : '');
      sw.title = on ? '已启用' : '已关闭';
      sw.setAttribute('data-act', 'toggle');
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'preset-icon-btn char-wb-delete-btn';
      delBtn.title = '删除条目';
      delBtn.setAttribute('data-act', 'delete');
      delBtn.setAttribute('aria-label', '删除条目');
      if (svg && svg.trash) svg.mount(delBtn, svg.trash);

      side.appendChild(sw);
      if (locked) {
        li.classList.toggle('is-stat-manual', !auto);
        var modeBtn = document.createElement('button');
        modeBtn.type = 'button';
        modeBtn.className =
          'preset-icon-btn char-wb-delete-btn prompt-stat-mode-btn' + (auto ? ' is-auto' : ' is-close');
        modeBtn.setAttribute('data-act', 'stat-mode');
        modeBtn.setAttribute('aria-pressed', auto ? 'true' : 'false');
        modeBtn.title = auto ? 'AUTO：随变量自动更新内容' : 'CLOSE：手动编辑内容';
        modeBtn.setAttribute('aria-label', auto ? 'AUTO' : 'CLOSE');
        var modeLabel = document.createElement('span');
        modeLabel.className = 'prompt-stat-mode-label';
        modeLabel.textContent = auto ? 'AUTO' : 'CLOSE';
        modeBtn.appendChild(modeLabel);
        side.appendChild(modeBtn);
      } else {
        side.appendChild(delBtn);
      }
      top.appendChild(hit);
      top.appendChild(side);
      li.appendChild(top);

      var body = document.createElement('div');
      body.className = 'regex-card-body';
      if (!open) body.hidden = true;

      body.innerHTML =
        '<div class="char-wb-toolbar">' +
        '<label class="preset-field"><span class="preset-field-label">标题</span>' +
        '<input type="text" class="tq-input" data-field="comment" autocomplete="off" spellcheck="false" /></label>' +
        '<label class="preset-field"><span class="preset-field-label">插入位置</span>' +
        '<select class="tq-select" data-field="position">' +
        '<option value="0">角色定义之前</option>' +
        '<option value="1">角色定义之后</option>' +
        '<option value="5">示例消息前（↑EM）</option>' +
        '<option value="6">示例消息后（↓EM）</option>' +
        '<option value="2">作者注释之前</option>' +
        '<option value="3">作者注释之后</option>' +
        '<option value="4:0">@D ⚙️ [系统]在深度</option>' +
        '<option value="4:1">@D 👤 [用户]在深度</option>' +
        '<option value="4:2">@D 🤖 [AI]在深度</option>' +
        '</select></label>' +
        '<label class="preset-field"><span class="preset-field-label">顺序</span>' +
        '<input type="number" class="tq-input char-wb-num" data-field="order" /></label>' +
        '<label class="preset-field"><span class="preset-field-label">概率</span>' +
        '<input type="number" class="tq-input char-wb-num" data-field="probability" min="0" max="100" /></label>' +
        '<button type="button" class="preset-icon-btn char-wb-dup-btn" data-act="duplicate" title="复制条目" aria-label="复制条目">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="9" y="9" width="11" height="11" rx="2"/>' +
        '<path d="M5 15V5a2 2 0 0 1 2-2h10"/>' +
        '</svg></button>' +
        '</div>' +
        '<div class="char-wb-keys">' +
        '<label class="preset-field"><span class="preset-field-label">主要关键字</span>' +
        '<textarea class="tq-input regex-code" data-field="key" rows="2" placeholder="逗号分隔列表" spellcheck="false"></textarea></label>' +
        '<label class="preset-field"><span class="preset-field-label">逻辑</span>' +
        '<select class="tq-select" data-field="selectiveLogic">' +
        '<option value="0">与任意</option>' +
        '<option value="1">非全部</option>' +
        '<option value="2">非任意</option>' +
        '<option value="3">与全部</option>' +
        '</select></label>' +
        '<label class="preset-field"><span class="preset-field-label">可选过滤器</span>' +
        '<textarea class="tq-input regex-code" data-field="keysecondary" rows="2" placeholder="逗号分隔列表（如果为空则忽略）" spellcheck="false"></textarea></label>' +
        '</div>' +
        '<div class="char-wb-scan">' +
        '<label class="preset-field"><span class="preset-field-label">扫描深度</span>' +
        '<input type="number" class="tq-input" data-field="scanDepth" min="0" placeholder="使用全局设置" /></label>' +
        '<label class="preset-field"><span class="preset-field-label">区分大小写</span>' +
        '<select class="tq-select" data-field="caseSensitive">' +
        '<option value="">使用全局</option><option value="1">是</option><option value="0">否</option>' +
        '</select></label>' +
        '<label class="preset-field"><span class="preset-field-label">完整单词</span>' +
        '<select class="tq-select" data-field="matchWholeWords">' +
        '<option value="">使用全局</option><option value="1">是</option><option value="0">否</option>' +
        '</select></label>' +
        '<label class="preset-field"><span class="preset-field-label">组评分</span>' +
        '<select class="tq-select" data-field="useGroupScoring">' +
        '<option value="0">否</option><option value="1">是</option>' +
        '</select></label>' +
        '<label class="preset-field"><span class="preset-field-label">自动化 ID</span>' +
        '<input type="text" class="tq-input" data-field="automationId" placeholder="(没有任何)" autocomplete="off" spellcheck="false" /></label>' +
        '</div>' +
        '<div class="char-wb-checks">' +
        '<label class="char-wb-opt"><input type="checkbox" data-field="excludeRecursion" /><span>不可递归（不会被其他条目激活）</span></label>' +
        '<label class="char-wb-opt"><input type="checkbox" data-field="delayUntilRecursion" /><span>延迟到递归</span></label>' +
        '<label class="char-wb-opt"><input type="checkbox" data-field="preventRecursion" /><span>防止进一步递归</span></label>' +
        '<label class="char-wb-opt"><input type="checkbox" data-field="ignoreBudget" /><span>忽视回复限额</span></label>' +
        '<label class="char-wb-opt"><input type="checkbox" data-field="constant" /><span>常驻激活（不依赖关键词）</span></label>' +
        '<label class="preset-field" style="margin:0"><span class="preset-field-label">深度 (@ D)</span>' +
        '<input type="number" class="tq-input char-wb-num" data-field="depth" min="0" /></label>' +
        '</div>' +
        '<div class="preset-field">' +
        '<div class="char-wb-content-head">' +
        '<div class="char-wb-content-label">' +
        '<span class="preset-field-label">内容</span>' +
        '<button type="button" class="preset-icon-btn char-wb-expand-btn" data-act="expand-content" title="扩展到全屏" aria-label="扩展到全屏">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="15 3 21 3 21 9"/>' +
        '<polyline points="9 21 3 21 3 15"/>' +
        '<line x1="21" y1="3" x2="14" y2="10"/>' +
        '<line x1="3" y1="21" x2="10" y2="14"/>' +
        '</svg></button>' +
        '</div>' +
        '<span class="char-wb-meta"></span>' +
        '</div>' +
        '<textarea class="tq-input regex-code char-wb-content-ta" data-field="content" rows="8" spellcheck="false"></textarea>' +
        '</div>';

      fillEntryBody(body, entry);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function addEntry() {
    var list = entries();
    var entry = makeBlankEntry(list.length ? (list[list.length - 1].order || 100) + 1 : 100);
    list.push(entry);
    expandedId = String(entry.uid);
    saveStore();
    renderList();
    toast('已新增条目');
  }

  function duplicateEntry(id) {
    var list = entries();
    var i = findIndex(id);
    if (i < 0) return;
    var src = list[i];
    if (isStatDataEntry(src)) {
      toast('变量列表词条不可复制');
      return;
    }
    flushOpen();
    var clone = JSON.parse(JSON.stringify(src));
    clone.uid = makeUid();
    delete clone.locked;
    clone.comment = (src.comment || '条目') + '（副本）';
    list.splice(i + 1, 0, clone);
    expandedId = String(clone.uid);
    saveStore();
    renderList();
    toast('已复制条目');
  }

  function openOverwriteModal() {
    var modal = $('prompt-overwrite-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeOverwriteModal(clearPending) {
    var modal = $('prompt-overwrite-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (clearPending !== false) pendingImport = null;
  }

  function applyImport(mode) {
    if (!pendingImport || !pendingImport.entries) return;
    var incoming = pendingImport.entries.slice();
    var name = pendingImport.name || '世界书';
    if (mode === 'overwrite') {
      store.entries = incoming;
      toast('已覆盖导入「' + name + '」（' + incoming.length + ' 条）');
    } else {
      store.entries = entries().concat(incoming);
      toast('已追加导入「' + name + '」（+' + incoming.length + ' 条，共 ' + store.entries.length + ' 条）');
    }
    pendingImport = null;
    expandedId = null;
    saveStore();
    syncStatDataPrompt({ silent: true });
    renderList();
    closeOverwriteModal(false);
  }

  function parseImportFile(file) {
    if (!file) return;
    var api = window.天青_preset;
    if (!api || typeof api.importWorldbook !== 'function') {
      toast('世界书解析模块未加载');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result || '');
        var json = JSON.parse(text);
        var list = api.importWorldbook(json);
        if (!list || !list.length) {
          toast('未解析到有效世界书条目');
          return;
        }
        list = list.map(function (e, i) {
          return ensureEntryShape(e, i);
        });
        var nameHint = String(file.name || '').replace(/\.json$/i, '');
        var name = (json && json.name) || nameHint || '世界书';
        pendingImport = { entries: list, name: name };
        if (entries().length) openOverwriteModal();
        else applyImport('overwrite');
      } catch (err) {
        console.warn('[天青 提示词] import worldbook', err);
        toast(String((err && err.message) || err));
        pendingImport = null;
      }
    };
    reader.onerror = function () {
      toast('读取文件失败');
    };
    reader.readAsText(file, 'utf-8');
  }

  function safeFileName(name) {
    var s = String(name || '提示词')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ');
    return s || '提示词';
  }

  function exportWorldbook() {
    var api = window.天青_preset;
    if (!api || typeof api.exportWorldbook !== 'function') {
      toast('世界书导出模块未加载');
      return;
    }
    var list = entries();
    if (!list.length) {
      toast('没有可导出的条目');
      return;
    }
    var name = '提示词';
    var payload = api.exportWorldbook(list, name);
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(name) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    toast('已导出世界书「' + name + '」（' + list.length + ' 条）');
  }

  function moveEntry(id, dir) {
    var list = entries();
    var i = findIndex(id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= list.length) return;
    var tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    saveStore();
    renderList();
  }

  function clearDragTimer() {
    if (drag && drag.timer) {
      clearTimeout(drag.timer);
      drag.timer = null;
    }
  }

  function endDragListeners() {
    document.removeEventListener('pointermove', onDragPointerMove);
    document.removeEventListener('pointerup', onDragPointerUp);
    document.removeEventListener('pointercancel', onDragPointerUp);
  }

  function clearCardDragStyles(card) {
    if (!card) return;
    card.classList.remove('is-dragging');
    card.classList.remove('is-drag-origin');
    card.style.position = '';
    card.style.left = '';
    card.style.top = '';
    card.style.width = '';
    card.style.zIndex = '';
    card.style.margin = '';
    card.style.pointerEvents = '';
    card.style.transform = '';
    card.style.transition = '';
  }

  function removePlaceholder() {
    if (drag && drag.placeholder && drag.placeholder.parentNode) {
      drag.placeholder.parentNode.removeChild(drag.placeholder);
    }
    if (drag) drag.placeholder = null;
  }

  function movePlaceholder(list, placeholder, clientY) {
    if (!list || !placeholder) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll('.prompt-card:not(.is-dragging)'));
    var firstTops = {};
    cards.forEach(function (el) {
      firstTops[String(el.dataset.id)] = el.getBoundingClientRect().top;
    });

    var target = null;
    for (var i = 0; i < cards.length; i++) {
      var rect = cards[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        target = cards[i];
        break;
      }
    }
    var moved = false;
    if (target) {
      if (placeholder.nextSibling !== target) {
        list.insertBefore(placeholder, target);
        moved = true;
      }
    } else {
      var last = cards[cards.length - 1];
      if (!last) {
        if (placeholder.parentNode !== list) {
          list.appendChild(placeholder);
          moved = true;
        }
      } else if (last.nextSibling !== placeholder) {
        if (last.nextSibling) list.insertBefore(placeholder, last.nextSibling);
        else list.appendChild(placeholder);
        moved = true;
      }
    }
    if (!moved) return;

    cards.forEach(function (el) {
      var first = firstTops[String(el.dataset.id)];
      if (first == null) return;
      var lastTop = el.getBoundingClientRect().top;
      var dy = first - lastTop;
      if (!dy) return;
      el.style.transition = 'none';
      el.style.transform = 'translateY(' + dy + 'px)';
      void el.offsetWidth;
      el.style.transition = 'transform 0.22s ease';
      el.style.transform = '';
    });
  }

  function autoScrollList(list, clientY) {
    var rect = list.getBoundingClientRect();
    var edge = 40;
    var step = 14;
    if (clientY < rect.top + edge) list.scrollTop -= step;
    else if (clientY > rect.bottom - edge) list.scrollTop += step;
  }

  function positionFloatingCard(card, clientX, clientY) {
    if (!card || !drag) return;
    card.style.left = clientX - drag.offsetX + 'px';
    card.style.top = clientY - drag.offsetY + 'px';
  }

  function beginDrag(card, pointerId, clientX, clientY) {
    var list = $('prompt-list');
    if (!list || !card || !drag || drag.active) return;
    var rect = card.getBoundingClientRect();
    var placeholder = document.createElement('li');
    placeholder.className = 'preset-drag-placeholder';
    placeholder.style.height = Math.max(rect.height, 44) + 'px';
    placeholder.setAttribute('aria-hidden', 'true');

    list.insertBefore(placeholder, card);
    drag.active = true;
    drag.card = card;
    drag.placeholder = placeholder;
    drag.pointerId = pointerId;
    drag.offsetX = clientX - rect.left;
    drag.offsetY = clientY - rect.top;
    drag.lastY = clientY;

    list.classList.add('is-reordering');
    card.classList.add('is-dragging');
    card.style.position = 'fixed';
    card.style.left = rect.left + 'px';
    card.style.top = rect.top + 'px';
    card.style.width = rect.width + 'px';
    card.style.margin = '0';
    card.style.zIndex = '50';
    card.style.pointerEvents = 'none';
    card.style.transform = 'scale(1.02)';

    var handle = card.querySelector('.preset-drag-handle');
    if (handle) handle.classList.add('is-hot');
  }

  function finishDrag(commit) {
    if (!drag) return;
    clearDragTimer();
    endDragListeners();
    var list = $('prompt-list');
    var card = drag.card;
    var placeholder = drag.placeholder;
    var wasActive = drag.active;
    var handle = card && card.querySelector('.preset-drag-handle');

    if (wasActive && list && card && placeholder && placeholder.parentNode) {
      list.insertBefore(card, placeholder);
    }
    removePlaceholder();
    if (list) list.classList.remove('is-reordering');
    clearCardDragStyles(card);
    if (handle) handle.classList.remove('is-hot');

    drag = null;
    if (!wasActive || !commit || !list) return;

    var map = {};
    entries().forEach(function (entry, i) {
      map[entryUid(entry, i)] = entry;
    });
    var next = [];
    list.querySelectorAll('.prompt-card').forEach(function (el) {
      var entry = map[String(el.dataset.id)];
      if (entry) next.push(entry);
    });
    if (!next.length) return;
    store.entries = next;
    saveStore();
    renderList();
  }

  function onDragPointerMove(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    var dy = Math.abs(e.clientY - drag.startY);
    var dx = Math.abs(e.clientX - drag.startX);
    if (!drag.active) {
      /* 按住后稍一移动即开始拖拽（不必死等长按） */
      if (dy > MOVE_CANCEL_PX || dx > MOVE_CANCEL_PX) {
        clearDragTimer();
        beginDrag(drag.card, drag.pointerId, e.clientX, e.clientY);
      }
      if (!drag || !drag.active) return;
    }
    e.preventDefault();
    var list = $('prompt-list');
    if (!list || !drag.card) return;
    positionFloatingCard(drag.card, e.clientX, e.clientY);
    autoScrollList(list, e.clientY);
    movePlaceholder(list, drag.placeholder, e.clientY);
    drag.lastY = e.clientY;
  }

  function onDragPointerUp(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    finishDrag(!!drag.active);
  }

  function onHandlePointerDown(e) {
    var handle = e.target && e.target.closest ? e.target.closest('.preset-drag-handle') : null;
    if (!handle) return;
    if (e.button != null && e.button !== 0) return;
    var card = handle.closest('.prompt-card');
    var list = $('prompt-list');
    if (!card || !list) return;
    e.preventDefault();
    e.stopPropagation();
    finishDrag(false);
    handle.classList.add('is-hot');
    drag = {
      timer: null,
      active: false,
      card: card,
      placeholder: null,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      offsetX: 0,
      offsetY: 0,
    };
    document.addEventListener('pointermove', onDragPointerMove, { passive: false });
    document.addEventListener('pointerup', onDragPointerUp);
    document.addEventListener('pointercancel', onDragPointerUp);
    if (typeof handle.setPointerCapture === 'function' && e.pointerId != null) {
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    drag.timer = setTimeout(function () {
      if (!drag || drag.card !== card || drag.active) return;
      beginDrag(card, e.pointerId, e.clientX, e.clientY);
    }, LONG_PRESS_MS);
  }

  function onListClick(e) {
    if (e.target && e.target.closest && e.target.closest('.preset-drag-handle')) return;
    var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn || btn.disabled) return;
    var row = btn.closest('.prompt-card');
    if (!row) return;
    var act = btn.getAttribute('data-act');
    var entry = findEntry(row.dataset.id);

    if (act === 'expand') {
      flushOpen();
      expandedId = String(expandedId) === String(row.dataset.id) ? null : row.dataset.id;
      renderList();
      return;
    }
    if (act === 'expand-content') {
      e.preventDefault();
      e.stopPropagation();
      if (isStatDataEntry(entry) && isStatAuto(entry)) {
        toast('AUTO 模式下内容由变量树自动生成');
        return;
      }
      var api = window.天青_settings_character;
      if (api && api.openContentEditor) {
        api.openContentEditor(row, function () {
          syncFromBody(row);
        });
      }
      return;
    }
    if (act === 'stat-mode') {
      if (!isStatDataEntry(entry)) return;
      entry.statAuto = !isStatAuto(entry);
      if (isStatAuto(entry)) {
        entry.content = buildStatDataContent();
        toast('已切换为 AUTO');
      } else {
        toast('已切换为 CLOSE（可手动编辑）');
      }
      saveStore();
      renderList();
      return;
    }
    if (act === 'toggle') {
      if (!entry) return;
      entry.enabled = entry.enabled === false;
      saveStore();
      renderList();
      return;
    }
    if (act === 'up') {
      moveEntry(row.dataset.id, -1);
      return;
    }
    if (act === 'down') {
      moveEntry(row.dataset.id, 1);
      return;
    }
    if (act === 'duplicate') {
      if (isStatDataEntry(entry)) {
        toast('变量列表词条不可复制');
        return;
      }
      duplicateEntry(row.dataset.id);
      return;
    }
    if (act === 'delete') {
      if (isStatDataEntry(entry)) {
        toast('变量列表词条不可删除');
        return;
      }
      var label =
        (entry && (entry.comment || (entry.key && entry.key[0]))) || '该条目';
      var ask =
        window.天青_settings && window.天青_settings.confirm
          ? window.天青_settings.confirm
          : null;
      var run = function () {
        store.entries = entries().filter(function (item, i) {
          return entryUid(item, i) !== String(row.dataset.id);
        });
        if (String(expandedId) === String(row.dataset.id)) expandedId = null;
        saveStore();
        renderList();
        toast('已删除条目');
      };
      if (ask) ask('确定删除世界书条目「' + label + '」吗？', run);
      else if (window.confirm('确定删除世界书条目「' + label + '」吗？')) run();
    }
  }

  function onListChange(e) {
    var card = e.target && e.target.closest ? e.target.closest('.prompt-card') : null;
    if (!card) return;
    if (e.target.getAttribute('data-field')) syncFromBody(card);
  }

  function bind() {
    store = loadStore();
    ensureDefaultPrompts();
    var svg = window.天青_svg;
    if (svg && svg.importIcon) svg.mount($('btn-prompt-import-icon'), svg.importIcon);
    if (svg && svg.exportIcon) svg.mount($('btn-prompt-export-icon'), svg.exportIcon);
    if (svg && svg.exit) svg.mount($('btn-prompt-overwrite-exit-icon'), svg.exit);

    syncStatDataPrompt({ silent: true });
    renderList();

    var addBtn = $('btn-prompt-add');
    var importBtn = $('btn-prompt-import');
    var exportBtn = $('btn-prompt-export');
    var importFile = $('cfg-prompt-file');
    var list = $('prompt-list');
    if (addBtn) addBtn.addEventListener('click', addEntry);
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () {
        importFile.value = '';
        importFile.click();
      });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (file) parseImportFile(file);
        importFile.value = '';
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', exportWorldbook);
    }
    if (list) {
      list.addEventListener('click', onListClick);
      list.addEventListener('pointerdown', onHandlePointerDown);
      list.addEventListener('change', onListChange);
      list.addEventListener('input', onListChange);
      list.addEventListener('blur', onListChange, true);
      list.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var ta = e.target;
        if (!ta || !ta.getAttribute || ta.getAttribute('data-field') !== 'content') return;
        e.preventDefault();
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        var val = ta.value;
        ta.value = val.slice(0, start) + '\t' + val.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 1;
        syncFromBody(ta.closest('.prompt-card'));
      });
      list.addEventListener('contextmenu', function (e) {
        if (e.target.closest && e.target.closest('.preset-drag-handle')) e.preventDefault();
      });
    }

    var overwriteModal = $('prompt-overwrite-modal');
    var overwriteBtn = $('btn-prompt-overwrite');
    var keepBtn = $('btn-prompt-keep');
    var overwriteExit = $('btn-prompt-overwrite-exit');
    if (overwriteBtn) {
      overwriteBtn.addEventListener('click', function () {
        applyImport('overwrite');
      });
    }
    if (keepBtn) {
      keepBtn.addEventListener('click', function () {
        applyImport('merge');
      });
    }
    if (overwriteExit) {
      overwriteExit.addEventListener('click', function () {
        closeOverwriteModal(true);
        toast('已取消导入');
      });
    }
    if (overwriteModal) {
      overwriteModal.addEventListener('click', function (e) {
        if (e.target === overwriteModal) {
          closeOverwriteModal(true);
          toast('已取消导入');
        }
      });
    }
  }

  window.天青_settings_prompt = {
    bind: bind,
    renderList: renderList,
    syncStatDataPrompt: syncStatDataPrompt,
    getStore: function () {
      return store;
    },
  };
})();
