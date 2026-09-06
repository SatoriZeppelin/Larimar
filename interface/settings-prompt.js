/**
 * 系统设置 · 提示词（按世界书二级分组）
 * 含不可删除的「变量列表」词条，内容由变量树自动生成
 * 对外：window.天青_settings_prompt
 */
(function () {
  var KEY = 'tq_plus_system_prompts';
  var SEED_KEY = 'tq_plus_prompt_wb_seed';
  var SEED_VER = 'prompt-default-wb-v5';
  var FAME_STAGE_KEY = 'tq_plus_prompt_drop_fame_stage_v1';
  var STAT_DATA_UID = 'tq_locked_stat_data';
  var BASE_BOOK_NAME = '默认提示词';
  var LEGACY_BASE_BOOK_NAME = '基础提示词';
  var store = { books: [], expandedBookId: null };
  var expandedIds = Object.create(null);
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

  function makeBookId() {
    return 'book_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function books() {
    if (!store || !Array.isArray(store.books)) store.books = [];
    return store.books;
  }

  function findBook(id) {
    var list = books();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function findBookIndex(id) {
    var list = books();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return i;
    }
    return -1;
  }

  /** 当前展开的世界书（条目增删改都作用于此） */
  function activeBook() {
    return findBook(store.expandedBookId) || null;
  }

  function entries() {
    var b = activeBook();
    if (!b) return [];
    if (!Array.isArray(b.entries)) b.entries = [];
    return b.entries;
  }

  function setActiveEntries(list) {
    var b = activeBook();
    if (!b) return;
    b.entries = Array.isArray(list) ? list : [];
  }

  function normalizeBook(b) {
    b = b && typeof b === 'object' ? b : {};
    return {
      id: String(b.id || makeBookId()),
      name: String(b.name != null ? b.name : '未命名世界书').trim() || '未命名世界书',
      enabled: b.enabled !== false,
      entries: Array.isArray(b.entries) ? b.entries.map(migrateLegacy) : [],
    };
  }

  function uniqueBookName(name) {
    var base = String(name || '世界书').trim() || '世界书';
    var names = {};
    books().forEach(function (b) {
      names[String(b.name || '')] = 1;
    });
    if (!names[base]) return base;
    var n = 2;
    while (names[base + ' (' + n + ')']) n++;
    return base + ' (' + n + ')';
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
    return i < 0 ? null : entries()[i];
  }

  function findBookContainingEntry(uid) {
    var list = books();
    for (var i = 0; i < list.length; i++) {
      var ents = list[i].entries || [];
      for (var j = 0; j < ents.length; j++) {
        if (ents[j] && String(ents[j].uid) === String(uid)) return list[i];
      }
    }
    return null;
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
      if (!raw) return { books: [], expandedBookId: null };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return { books: [], expandedBookId: null };

      /* 新结构 */
      if (Array.isArray(o.books)) {
        var booksNorm = o.books.map(normalizeBook);
        var expanded = o.expandedBookId != null ? String(o.expandedBookId) : null;
        if (expanded && !booksNorm.some(function (b) { return b.id === expanded; })) expanded = null;
        return { books: booksNorm, expandedBookId: expanded };
      }

      /* 旧扁平 entries → 一本「基础提示词」 */
      if (Array.isArray(o.entries)) {
        return {
          books: [
            normalizeBook({
              id: 'book_base',
              name: BASE_BOOK_NAME,
              enabled: true,
              entries: o.entries,
            }),
          ],
          expandedBookId: null,
        };
      }
      return { books: [], expandedBookId: null };
    } catch (err) {
      return { books: [], expandedBookId: null };
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
   * 首次：写入「基础提示词」世界书
   * 已有其它世界书/条目则跳过
   */
  function ensureDefaultPrompts() {
    var seeded = '';
    try {
      seeded = localStorage.getItem(SEED_KEY) || '';
    } catch (e) {}

    var list = books();
    var hasCustom = list.some(function (b) {
      if (!b) return false;
      if (b.name !== BASE_BOOK_NAME) return true;
      return (b.entries || []).some(function (e) {
        return e && e.uid !== STAT_DATA_UID;
      });
    });
    if (hasCustom) {
      if (seeded !== SEED_VER) {
        try {
          localStorage.setItem(SEED_KEY, SEED_VER);
        } catch (e) {}
      }
      return false;
    }

    if (seeded === SEED_VER && list.length) return false;

    var defaults = loadDefaultPromptEntries();
    if (!defaults.length) {
      console.warn('[天青 提示词] 默认基础提示词未加载（检查 default-prompt-worldbook.js）');
      return false;
    }

    var base = list.find(function (b) {
      return b && b.name === BASE_BOOK_NAME;
    });
    if (!base) {
      base = normalizeBook({
        id: 'book_base',
        name: BASE_BOOK_NAME,
        enabled: true,
        entries: defaults,
      });
      store.books = [base];
    } else {
      var onlyStat = (base.entries || []).every(function (e) {
        return !e || e.uid === STAT_DATA_UID;
      });
      if (onlyStat || !(base.entries || []).length) {
        base.entries = defaults;
      }
    }
    store.expandedBookId = null;
    saveStore();
    try {
      localStorage.setItem(SEED_KEY, SEED_VER);
    } catch (e) {}
    console.info('[天青 提示词] 已载入默认基础提示词', defaults.length + ' 条');
    return true;
  }

  /** 已有存档：去掉提示词里残留的 名气.阶段 示例 */
  function migrateDropFameStage() {
    try {
      if (localStorage.getItem(FAME_STAGE_KEY)) return false;
    } catch (e) {}
    var changed = false;
    var from = "_.set('stat_data.名气.阶段', '地下偶像期')";
    var to = "_.set('stat_data.名气.twitter', 1000)";
    books().forEach(function (b) {
      (b.entries || []).forEach(function (e) {
        if (!e || typeof e.content !== 'string') return;
        if (e.content.indexOf(from) < 0) return;
        e.content = e.content.split(from).join(to);
        changed = true;
      });
    });
    try {
      localStorage.setItem(FAME_STAGE_KEY, '1');
    } catch (e) {}
    if (changed) {
      saveStore();
      console.info('[天青 提示词] 已去掉 名气.阶段');
    }
    return changed;
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
    var book = findBookContainingEntry(STAT_DATA_UID);
    if (!book) {
      book =
        books().find(function (b) {
          return b && b.name === BASE_BOOK_NAME;
        }) || books()[0];
    }
    if (!book) {
      book = normalizeBook({ id: 'book_base', name: BASE_BOOK_NAME, enabled: true, entries: [] });
      store.books = [book];
    }
    if (!Array.isArray(book.entries)) book.entries = [];

    var content = buildStatDataContent();
    var kept = null;
    var keptIdx = -1;
    var others = [];
    book.entries.forEach(function (e, i) {
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
    book.entries = others;
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
    if (!keys.length) return '关键词';
    var s = keys.slice(0, 3).join(', ');
    if (keys.length > 3) s += '…';
    return s;
  }

  function positionShortLabel(entry) {
    var v = positionSelectValue(entry);
    var map = {
      '0': '角色定义前',
      '1': '角色定义后',
      '5': '↑EM',
      '6': '↓EM',
      '2': '作者注释前',
      '3': '作者注释后',
      '4:0': '@D 系统',
      '4:1': '@D 用户',
      '4:2': '@D AI',
    };
    return map[v] || v;
  }

  function migrateLegacyBookNames() {
    var changed = false;
    books().forEach(function (b) {
      if (!b) return;
      if (String(b.name) === LEGACY_BASE_BOOK_NAME) {
        b.name = BASE_BOOK_NAME;
        changed = true;
      }
    });
    if (changed) saveStore();
    return changed;
  }

  function setEntryExpanded(id, open) {
    id = String(id || '');
    if (!id) return;
    if (open) expandedIds[id] = true;
    else delete expandedIds[id];
  }

  function isEntryExpanded(id) {
    return !!expandedIds[String(id || '')];
  }

  function expandAllEntriesInBook(book) {
    if (!book || !Array.isArray(book.entries)) return;
    book.entries.forEach(function (e, i) {
      setEntryExpanded(entryUid(e, i), true);
    });
  }

  function collapseAllEntriesInBook(book) {
    if (!book || !Array.isArray(book.entries)) return;
    book.entries.forEach(function (e, i) {
      setEntryExpanded(entryUid(e, i), false);
    });
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
    if (el && !locked) {
      setBool('constant', el.checked);
      var strategyEl = card.querySelector('.prompt-col-strategy');
      if (strategyEl) {
        strategyEl.textContent = entry.constant ? '常驻' : '关键词';
        strategyEl.classList.toggle('is-constant', !!entry.constant);
      }
    }
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
    var strategyEl = card.querySelector('.prompt-col-strategy');
    var meta = card.querySelector('.char-wb-meta');
    var name = entry.comment || (entry.key && entry.key[0]) || '未命名条目';
    if (title) {
      title.textContent = name;
      title.title = name;
    }
    if (strategyEl) {
      strategyEl.textContent = entry.constant ? '常驻' : '关键词';
      strategyEl.classList.toggle('is-constant', !!entry.constant);
    }
    if (meta) meta.textContent = '(词符: ' + approxTokens(entry.content) + ') (UID: ' + entry.uid + ')';
    /* 同步摘要列 */
    var sumPos = card.querySelector('[data-summary="position"]');
    if (sumPos) sumPos.value = positionSelectValue(entry);
    var sumDepth = card.querySelector('[data-summary="depth"]');
    if (sumDepth) sumDepth.value = entry.depth != null ? entry.depth : 4;
    var sumOrder = card.querySelector('[data-summary="order"]');
    if (sumOrder) sumOrder.value = entry.order != null ? entry.order : 100;
    var sumProb = card.querySelector('[data-summary="probability"]');
    if (sumProb) sumProb.value = entry.probability != null ? entry.probability : 100;
    return true;
  }

  function syncFromBody(card) {
    if (writeFromBody(card)) saveStore();
  }

  function flushOpen() {
    var root = $('prompt-book-list') || $('prompt-list');
    if (!root) return;
    root.querySelectorAll('.prompt-card').forEach(function (card) {
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
    var root = $('prompt-book-list') || $('prompt-list');
    var empty = $('prompt-list-empty');
    var svg = window.天青_svg;
    if (!root) return;
    root.innerHTML = '';
    var bookList = books();
    if (empty) empty.style.display = bookList.length ? 'none' : '';

    bookList.forEach(function (book, bookIndex) {
      if (!book) return;
      if (!book.id) book.id = makeBookId();
      if (!Array.isArray(book.entries)) book.entries = [];
      var bookOpen = String(store.expandedBookId) === String(book.id);
      var bookOn = book.enabled !== false;

      var bookLi = document.createElement('li');
      bookLi.className =
        'prompt-book-card' + (bookOpen ? ' is-expanded' : '') + (bookOn ? '' : ' is-off');
      bookLi.dataset.bookId = book.id;

      var head = document.createElement('div');
      head.className = 'prompt-book-head';

      var toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'prompt-book-toggle';
      toggleBtn.setAttribute('data-act', 'book-expand');
      toggleBtn.setAttribute('aria-expanded', bookOpen ? 'true' : 'false');
      toggleBtn.title = bookOpen ? '收起' : '展开';
      var chevron = document.createElement('span');
      chevron.className = 'prompt-book-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      if (svg && svg.chevron) svg.mount(chevron, svg.chevron);
      toggleBtn.appendChild(chevron);

      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'prompt-book-main';
      main.setAttribute('data-act', 'book-expand');
      var title = document.createElement('span');
      title.className = 'prompt-book-title';
      title.textContent = book.name || '未命名世界书';
      title.title = book.name || '';
      var meta = document.createElement('span');
      meta.className = 'prompt-book-meta';
      meta.textContent = book.entries.length + ' 条';
      main.appendChild(title);
      main.appendChild(meta);

      var side = document.createElement('div');
      side.className = 'prompt-book-side';

      if (bookOpen) {
        var tools = document.createElement('div');
        tools.className = 'prompt-book-tools';

        var addTool = document.createElement('button');
        addTool.type = 'button';
        addTool.className = 'prompt-book-tool-btn';
        addTool.title = '创建新条目';
        addTool.setAttribute('data-act', 'book-add-entry');
        addTool.setAttribute('aria-label', '创建新条目');
        addTool.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

        var openAll = document.createElement('button');
        openAll.type = 'button';
        openAll.className = 'prompt-book-tool-btn';
        openAll.title = '打开所有条目';
        openAll.setAttribute('data-act', 'book-expand-all');
        openAll.setAttribute('aria-label', '打开所有条目');
        openAll.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

        var closeAll = document.createElement('button');
        closeAll.type = 'button';
        closeAll.className = 'prompt-book-tool-btn';
        closeAll.title = '关闭所有条目';
        closeAll.setAttribute('data-act', 'book-collapse-all');
        closeAll.setAttribute('aria-label', '关闭所有条目');
        closeAll.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

        tools.appendChild(addTool);
        tools.appendChild(openAll);
        tools.appendChild(closeAll);
        side.appendChild(tools);
      }

      var nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'prompt-book-tool-btn';
      nameBtn.title = '重命名';
      nameBtn.setAttribute('data-act', 'book-rename');
      nameBtn.setAttribute('aria-label', '重命名');
      if (svg && svg.pencil) svg.mount(nameBtn, svg.pencil);

      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'preset-switch' + (bookOn ? ' is-on' : '');
      sw.title = bookOn ? '已启用' : '已关闭';
      sw.setAttribute('data-act', 'book-toggle');
      sw.setAttribute('aria-pressed', bookOn ? 'true' : 'false');

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'preset-icon-btn char-wb-delete-btn';
      delBtn.title = '删除世界书';
      delBtn.setAttribute('data-act', 'book-delete');
      delBtn.disabled = bookList.length <= 1;
      if (svg && svg.trash) svg.mount(delBtn, svg.trash);

      side.appendChild(nameBtn);
      side.appendChild(sw);
      side.appendChild(delBtn);

      head.appendChild(toggleBtn);
      head.appendChild(main);
      head.appendChild(side);
      bookLi.appendChild(head);

      var list = document.createElement('ul');
      list.className = 'preset-list regex-list prompt-entry-list';
      list.hidden = !bookOpen;
      list.setAttribute('data-book-id', book.id);

      var items = book.entries;
      if (!bookOpen) {
        bookLi.appendChild(list);
        root.appendChild(bookLi);
        return;
      }

      items.forEach(function (entry, index) {
      ensureEntryShape(entry, index);
      var id = entryUid(entry, index);
      var open = isEntryExpanded(id);
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

      titleRow.appendChild(title);
      main.appendChild(titleRow);

      var chevron = document.createElement('span');
      chevron.className = 'regex-card-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      if (svg && svg.chevron) svg.mount(chevron, svg.chevron);

      hit.appendChild(idx);
      hit.appendChild(main);
      hit.appendChild(chevron);

      var cols = document.createElement('div');
      cols.className = 'prompt-card-cols';
      cols.addEventListener('click', function (ev) {
        ev.stopPropagation();
      });
      cols.addEventListener('mousedown', function (ev) {
        ev.stopPropagation();
      });

      var strategy = document.createElement('span');
      strategy.className =
        'prompt-col prompt-col-strategy' + (entry.constant ? ' is-constant' : '');
      strategy.title = '触发策略';
      strategy.textContent = entry.constant ? '常驻' : '关键词';
      cols.appendChild(strategy);

      var posSel = document.createElement('select');
      posSel.className = 'tq-select prompt-col-pos';
      posSel.setAttribute('data-summary', 'position');
      posSel.title = '插入位置';
      posSel.innerHTML =
        '<option value="0">角色定义前</option>' +
        '<option value="1">角色定义后</option>' +
        '<option value="5">↑EM</option>' +
        '<option value="6">↓EM</option>' +
        '<option value="2">作者注释前</option>' +
        '<option value="3">作者注释后</option>' +
        '<option value="4:0">@D 系统</option>' +
        '<option value="4:1">@D 用户</option>' +
        '<option value="4:2">@D AI</option>';
      posSel.value = positionSelectValue(entry);
      cols.appendChild(posSel);

      var depthInp = document.createElement('input');
      depthInp.type = 'number';
      depthInp.className = 'tq-input prompt-col-num';
      depthInp.setAttribute('data-summary', 'depth');
      depthInp.title = '深度';
      depthInp.min = '0';
      depthInp.value = entry.depth != null ? entry.depth : 4;
      cols.appendChild(depthInp);

      var orderInp = document.createElement('input');
      orderInp.type = 'number';
      orderInp.className = 'tq-input prompt-col-num';
      orderInp.setAttribute('data-summary', 'order');
      orderInp.title = '顺序';
      orderInp.value = entry.order != null ? entry.order : 100;
      if (locked) orderInp.readOnly = true;
      cols.appendChild(orderInp);

      var probInp = document.createElement('input');
      probInp.type = 'number';
      probInp.className = 'tq-input prompt-col-num';
      probInp.setAttribute('data-summary', 'probability');
      probInp.title = '触发概率 %';
      probInp.min = '0';
      probInp.max = '100';
      probInp.value = entry.probability != null ? entry.probability : 100;
      cols.appendChild(probInp);

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

      var right = document.createElement('div');
      right.className = 'prompt-card-right';
      right.appendChild(cols);
      right.appendChild(side);

      top.appendChild(hit);
      top.appendChild(right);
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

      bookLi.appendChild(list);
      root.appendChild(bookLi);
    });
  }

  function addEntry() {
    var book = activeBook();
    if (!book) {
      if (!books().length) {
        toast('请先导入或等待默认世界书加载');
        return;
      }
      store.expandedBookId = books()[0].id;
      book = activeBook();
    }
    var list = entries();
    var entry = makeBlankEntry(list.length ? (list[list.length - 1].order || 100) + 1 : 100);
    list.push(entry);
    setEntryExpanded(String(entry.uid), true);
    saveStore();
    renderList();
    toast('已新增条目到「' + (book.name || '世界书') + '」');
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
    setEntryExpanded(String(clone.uid), true);
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
    var name = uniqueBookName(pendingImport.name || '世界书');
    /* 导入一律新增一本世界书（覆盖/追加语义已废弃） */
    var book = normalizeBook({
      id: makeBookId(),
      name: name,
      enabled: true,
      entries: incoming,
    });
    books().push(book);
    store.expandedBookId = book.id;
    expandedIds = Object.create(null);
    pendingImport = null;
    saveStore();
    syncStatDataPrompt({ silent: true });
    renderList();
    closeOverwriteModal(false);
    toast('已导入世界书「' + name + '」（' + incoming.length + ' 条）');
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
        applyImport('new');
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
    var book = activeBook();
    if (!book) {
      toast('请先展开要导出的世界书');
      return;
    }
    var list = book.entries || [];
    if (!list.length) {
      toast('没有可导出的条目');
      return;
    }
    var name = book.name || '提示词';
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
    var list = card && card.closest ? card.closest('.prompt-entry-list') : null;
    if (!list) list = $('prompt-book-list') || $('prompt-list');
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
    var card = drag.card;
    var list = (card && card.closest && card.closest('.prompt-entry-list')) || $('prompt-book-list') || $('prompt-list');
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

    var bookId = list.getAttribute('data-book-id');
    if (bookId) store.expandedBookId = bookId;

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
    setActiveEntries(next);
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
    var list = drag.card && drag.card.closest ? drag.card.closest('.prompt-entry-list') : null;
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
    var list = card && card.closest ? card.closest('.prompt-entry-list') : null;
    if (!card || !list) return;
    var bookId = list.getAttribute('data-book-id');
    if (bookId) store.expandedBookId = bookId;
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
    var act = btn.getAttribute('data-act');

    if (act && act.indexOf('book-') === 0) {
      var bookCard = btn.closest('.prompt-book-card');
      var bookId = bookCard && bookCard.dataset.bookId;
      var book = findBook(bookId);
      if (act === 'book-expand') {
        flushOpen();
        store.expandedBookId = String(store.expandedBookId) === String(bookId) ? null : bookId;
        expandedIds = Object.create(null);
        saveStore();
        renderList();
        return;
      }
      if (act === 'book-add-entry') {
        if (bookId) store.expandedBookId = bookId;
        addEntry();
        return;
      }
      if (act === 'book-expand-all') {
        if (!book) return;
        store.expandedBookId = bookId;
        expandAllEntriesInBook(book);
        renderList();
        return;
      }
      if (act === 'book-collapse-all') {
        if (!book) return;
        collapseAllEntriesInBook(book);
        renderList();
        return;
      }
      if (act === 'book-toggle') {
        if (!book) return;
        book.enabled = book.enabled === false;
        saveStore();
        renderList();
        return;
      }
      if (act === 'book-rename') {
        if (!book) return;
        var nextName = window.prompt('世界书名称', book.name || '');
        if (nextName == null) return;
        nextName = String(nextName).trim().slice(0, 48);
        if (!nextName) return;
        book.name = nextName;
        saveStore();
        renderList();
        return;
      }
      if (act === 'book-delete') {
        if (books().length <= 1) {
          toast('至少保留一本世界书');
          return;
        }
        if (!book) return;
        var askBook = window.天青_settings && window.天青_settings.confirm ? window.天青_settings.confirm : null;
        var runDelBook = function () {
          store.books = books().filter(function (b) {
            return String(b.id) !== String(bookId);
          });
          if (String(store.expandedBookId) === String(bookId)) store.expandedBookId = null;
          expandedIds = Object.create(null);
          saveStore();
          syncStatDataPrompt({ silent: true });
          renderList();
          toast('已删除世界书');
        };
        if (askBook) askBook('确定删除世界书「' + (book.name || '') + '」及其全部条目吗？', runDelBook);
        else if (window.confirm('确定删除世界书「' + (book.name || '') + '」及其全部条目吗？')) runDelBook();
      }
      return;
    }

    var row = btn.closest('.prompt-card');
    if (!row) return;
    var entryList = row.closest('.prompt-entry-list');
    if (entryList && entryList.getAttribute('data-book-id')) {
      store.expandedBookId = entryList.getAttribute('data-book-id');
    }
    var entry = findEntry(row.dataset.id);

    if (act === 'expand') {
      flushOpen();
      setEntryExpanded(row.dataset.id, !isEntryExpanded(row.dataset.id));
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
      var label = (entry && (entry.comment || (entry.key && entry.key[0]))) || '该条目';
      var ask = window.天青_settings && window.天青_settings.confirm ? window.天青_settings.confirm : null;
      var run = function () {
        setActiveEntries(
          entries().filter(function (item, i) {
            return entryUid(item, i) !== String(row.dataset.id);
          }),
        );
        if (isEntryExpanded(row.dataset.id)) setEntryExpanded(row.dataset.id, false);
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
    var summary = e.target.getAttribute && e.target.getAttribute('data-summary');
    if (summary) {
      var entry = findEntry(card.dataset.id);
      if (!entry) return;
      ensureEntryShape(entry, 0);
      var locked = isStatDataEntry(entry);
      if (summary === 'position') applyPositionSelect(entry, e.target.value);
      else if (summary === 'depth') {
        var d = Number(e.target.value);
        entry.depth = isNaN(d) ? 4 : d;
      } else if (summary === 'order' && !locked) {
        var o = Number(e.target.value);
        entry.order = isNaN(o) ? 100 : o;
      } else if (summary === 'probability') {
        var p = Number(e.target.value);
        entry.probability = isNaN(p) ? 100 : Math.max(0, Math.min(100, p));
      }
      var body = card.querySelector('.regex-card-body');
      if (body && !body.hidden) {
        var bodyEl = body.querySelector('[data-field="' + summary + '"]');
        if (bodyEl) {
          if (summary === 'position') bodyEl.value = positionSelectValue(entry);
          else bodyEl.value = entry[summary] == null ? '' : String(entry[summary]);
        }
      }
      saveStore();
      return;
    }
    if (e.target.getAttribute('data-field')) syncFromBody(card);
  }

  function bind() {
    store = loadStore();
    migrateLegacyBookNames();
    ensureDefaultPrompts();
    migrateDropFameStage();
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
    var list = $('prompt-book-list') || $('prompt-list');
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
