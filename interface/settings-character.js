/**
 * 角色设置 · 动态二级目录
 * 对外：window.天青_settings_character
 */
(function () {
  var KEY = 'tq_plus_character_tabs';
  var SEED_KEY = 'tq_plus_tianqing_wb_seed';
  var SEED_VER = 'tianqing-default-wb-v2';
  var DEFAULT_COLOR = '#2a6f9e';
  var LONG_MS = 500;
  var MOVE_PX = 10;

  var store = null;
  var drag = null; /* 二级目录拖拽 */
  var entryDrag = null; /* 世界书条目拖拽 */
  var ENTRY_LONG_MS = 300;
  var ENTRY_MOVE_PX = 10;
  var pendingImport = null;
  var expandedEntryId = null;
  var contentEditorTarget = null;
  var contentEditorBound = false;
  var contentEditorSaveHook = null;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function makeId() {
    return 'char_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /** 内嵌默认世界书 → 规范条目列表 */
  function loadDefaultTianqingEntries() {
    var raw = window.天青_default_worldbook_tianqing;
    if (!raw) return [];
    var api = window.天青_preset;
    if (api && typeof api.importWorldbook === 'function') {
      try {
        return api.importWorldbook(raw) || [];
      } catch (e) {
        console.warn('[天青 角色] 默认世界书解析失败', e);
      }
    }
    return [];
  }

  function defaultStore() {
    return {
      activeId: 'tianqing',
      tabs: [
        {
          id: 'tianqing',
          name: '天青',
          color: DEFAULT_COLOR,
          locked: true,
          enabled: true,
          entries: loadDefaultTianqingEntries(),
        },
      ],
    };
  }

  /**
   * 首次载入：给「天青」写入内嵌世界书（仅播种一次，不覆盖已有条目）
   */
  function ensureTianqingDefaultWorldbook() {
    var seeded = '';
    try {
      seeded = localStorage.getItem(SEED_KEY) || '';
    } catch (e) {}
    if (seeded === SEED_VER) return false;

    if (!store || !Array.isArray(store.tabs)) return false;
    var tab = findTab('tianqing');
    if (!tab) {
      tab = store.tabs.find(function (t) {
        return t && t.locked;
      });
    }
    if (!tab) {
      try {
        localStorage.setItem(SEED_KEY, SEED_VER);
      } catch (e) {}
      return false;
    }

    var filled = false;
    if (!Array.isArray(tab.entries) || !tab.entries.length) {
      var entries = loadDefaultTianqingEntries();
      if (!entries.length) return false;
      tab.entries = entries;
      if (!tab.name) tab.name = '天青';
      filled = true;
    }

    saveStore();
    try {
      localStorage.setItem(SEED_KEY, SEED_VER);
    } catch (e) {}
    if (filled) {
      console.info('[天青 角色] 已载入默认世界书「天青」', tab.entries.length + ' 条');
    }
    return filled;
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultStore();
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.tabs) || !o.tabs.length) return defaultStore();
      o.tabs = o.tabs.map(function (t) {
        return {
          id: String(t.id || makeId()),
          name: String(t.name || '未命名').slice(0, 48),
          color: t.color || DEFAULT_COLOR,
          locked: t.id === 'tianqing' || !!t.locked,
          enabled: t.enabled !== false,
          entries: Array.isArray(t.entries) ? t.entries : [],
        };
      });
      var hasLocked = o.tabs.some(function (t) {
        return t.locked;
      });
      if (!hasLocked) o.tabs[0].locked = true;
      var found = false;
      for (var i = 0; i < o.tabs.length; i++) {
        if (String(o.tabs[i].id) === String(o.activeId)) {
          found = true;
          break;
        }
      }
      if (!found) o.activeId = o.tabs[0].id;
      return o;
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function findTab(id) {
    for (var i = 0; i < store.tabs.length; i++) {
      if (String(store.tabs[i].id) === String(id)) return store.tabs[i];
    }
    return null;
  }

  function findIndex(id) {
    for (var i = 0; i < store.tabs.length; i++) {
      if (String(store.tabs[i].id) === String(id)) return i;
    }
    return -1;
  }

  function activeTab() {
    return findTab(store.activeId) || store.tabs[0];
  }

  function tintStyle(color) {
    var c = color || DEFAULT_COLOR;
    return {
      '--sub-blue': c,
      '--tab-tint': c,
    };
  }

  function applyTint(el, color) {
    var style = tintStyle(color);
    el.style.setProperty('--sub-blue', style['--sub-blue']);
    el.style.setProperty('--tab-tint', style['--tab-tint']);
    el.classList.add('has-tint');
  }

  function updateContent() {
    var tab = activeTab();
    if (!tab) return;
    var title = $('char-pane-title');
    var colorInput = $('char-tab-color');
    var delBtn = $('btn-char-delete');
    if (title) title.textContent = tab.name;
    if (colorInput) colorInput.value = tab.color || DEFAULT_COLOR;
    if (delBtn) {
      delBtn.disabled = !!tab.locked;
      delBtn.title = tab.locked ? '默认角色不可删除' : '删除此二级目录';
    }
    renderEntryList();
  }

  function entryUid(entry, index) {
    if (entry && entry.uid != null && String(entry.uid) !== '') return String(entry.uid);
    return 'wb_' + index;
  }

  function findEntryIndex(entries, id) {
    for (var i = 0; i < entries.length; i++) {
      if (entryUid(entries[i], i) === String(id)) return i;
    }
    return -1;
  }

  function findEntry(entries, id) {
    var i = findEntryIndex(entries, id);
    return i < 0 ? null : entries[i];
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

  function ensureEntryShape(entry, index) {
    if (!entry || typeof entry !== 'object') return entry;
    if (entry.uid == null || entry.uid === '') {
      entry.uid = 'wb_' + Date.now().toString(36) + '_' + index;
    }
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
      uid: 'wb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
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

  function triSelectValue(v) {
    if (v == null) return '';
    return v ? '1' : '0';
  }

  function parseTriSelect(raw) {
    if (raw === '' || raw == null) return null;
    return raw === '1' || raw === 'true';
  }

  function approxTokens(text) {
    return Math.max(0, Math.ceil(String(text || '').length / 1.7));
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

  function writeEntryFromBody(card) {
    if (!card) return false;
    var tab = activeTab();
    var entries = tabEntries(tab);
    var entry = findEntry(entries, card.dataset.id);
    if (!entry) return false;
    ensureEntryShape(entry, 0);
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
    if (el) setStr('comment', String(el.value || '').trim());
    el = card.querySelector('[data-field="key"]');
    if (el) {
      var nextKey = parseKeyList(el.value);
      if (JSON.stringify(nextKey) !== JSON.stringify(entry.key || [])) {
        entry.key = nextKey;
        changed = true;
      }
    }
    el = card.querySelector('[data-field="keysecondary"]');
    if (el) {
      var nextKey2 = parseKeyList(el.value);
      if (JSON.stringify(nextKey2) !== JSON.stringify(entry.keysecondary || [])) {
        entry.keysecondary = nextKey2;
        changed = true;
      }
    }
    el = card.querySelector('[data-field="content"]');
    if (el) setStr('content', String(el.value || ''));
    el = card.querySelector('[data-field="position"]');
    if (el) {
      var prevPos = positionSelectValue(entry);
      if (String(el.value) !== String(prevPos)) {
        applyPositionSelect(entry, el.value);
        changed = true;
      }
    }
    el = card.querySelector('[data-field="order"]');
    if (el) setNum('order', el.value === '' ? 100 : el.value);
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
    if (el) setBool('constant', el.checked);
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

  function syncEntryFromBody(card) {
    if (writeEntryFromBody(card)) saveStore();
  }

  function flushOpenEntries() {
    var list = $('char-wb-list');
    if (!list) return;
    list.querySelectorAll('.char-wb-card').forEach(function (card) {
      if (card.querySelector('[data-field]') && writeEntryFromBody(card)) saveStore();
    });
  }

  function fillEntryBody(body, entry) {
    function q(field) {
      return body.querySelector('[data-field="' + field + '"]');
    }
    var el;
    el = q('comment');
    if (el) el.value = entry.comment || '';
    el = q('key');
    if (el) el.value = (entry.key || []).join(', ');
    el = q('keysecondary');
    if (el) el.value = (entry.keysecondary || []).join(', ');
    el = q('content');
    if (el) el.value = entry.content || '';
    el = q('position');
    if (el) el.value = positionSelectValue(entry);
    el = q('order');
    if (el) el.value = entry.order != null ? entry.order : 100;
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
    if (el) el.checked = !!entry.constant;
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
  }

  function renderEntryList() {
    var list = $('char-wb-list');
    var empty = $('char-wb-list-empty');
    var svg = window.天青_svg;
    if (!list) return;
    var tab = activeTab();
    if (!tab) return;
    var entries = tabEntries(tab);
    list.innerHTML = '';
    if (empty) empty.style.display = entries.length ? 'none' : '';

    entries.forEach(function (entry, index) {
      ensureEntryShape(entry, index);
      var id = entryUid(entry, index);
      var open = String(expandedEntryId) === String(id);
      var on = entry.enabled !== false;

      var li = document.createElement('li');
      li.className = 'regex-card char-wb-card' + (on ? '' : ' is-off') + (open ? ' is-open' : '');
      li.dataset.id = id;

      var top = document.createElement('div');
      top.className = 'regex-card-top';

      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'preset-drag-handle';
      handle.title = '长按拖动排序';
      handle.setAttribute('aria-label', '长按拖动排序');
      if (svg && svg.grip) svg.mount(handle, svg.grip);

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
      downBtn.disabled = index >= entries.length - 1;
      if (svg && svg.arrowDown) svg.mount(downBtn, svg.arrowDown);

      move.appendChild(upBtn);
      move.appendChild(downBtn);

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

      side.appendChild(move);
      side.appendChild(sw);
      side.appendChild(delBtn);
      top.appendChild(handle);
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
    var tab = activeTab();
    if (!tab) return;
    var entries = tabEntries(tab);
    var entry = makeBlankEntry(entries.length ? entries[entries.length - 1].order + 1 : 100);
    entries.push(entry);
    expandedEntryId = String(entry.uid);
    saveStore();
    renderEntryList();
    toast('已新增条目');
  }

  function duplicateEntry(id) {
    var tab = activeTab();
    if (!tab) return;
    var entries = tabEntries(tab);
    var i = findEntryIndex(entries, id);
    if (i < 0) return;
    flushOpenEntries();
    var src = entries[i];
    var clone = JSON.parse(JSON.stringify(src));
    clone.uid = 'wb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    clone.comment = (src.comment || '条目') + '（副本）';
    entries.splice(i + 1, 0, clone);
    expandedEntryId = String(clone.uid);
    saveStore();
    renderEntryList();
    toast('已复制条目');
  }

  function renderContentGuides(text, guidesEl) {
    if (!guidesEl) return;
    var lines = String(text || '').split('\n');
    var html = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cols = 0;
      for (var j = 0; j < line.length; j++) {
        var ch = line.charAt(j);
        if (ch === '\t') cols += 4;
        else if (ch === ' ') cols += 1;
        else break;
      }
      var levels = Math.floor(cols / 4);
      html += '<div class="char-wb-guide-line">';
      for (var lv = 1; lv <= levels; lv++) {
        html +=
          '<span class="char-wb-guide-bar" style="left:' + lv * 4 + 'ch"></span>';
      }
      html += '</div>';
    }
    if (!lines.length) html = '<div class="char-wb-guide-line"></div>';
    guidesEl.innerHTML = html;
  }

  function syncContentEditorScroll() {
    var ta = $('char-wb-editor-ta');
    var guides = $('char-wb-editor-guides');
    if (!ta || !guides) return;
    guides.scrollTop = ta.scrollTop;
    guides.scrollLeft = ta.scrollLeft;
  }

  function refreshContentEditorGuides() {
    var ta = $('char-wb-editor-ta');
    var guides = $('char-wb-editor-guides');
    if (!ta || !guides) return;
    renderContentGuides(ta.value, guides);
    syncContentEditorScroll();
  }

  function openContentEditor(card, saveHook) {
    if (!card) return;
    var src = card.querySelector('[data-field="content"]');
    var modal = $('char-wb-editor-modal');
    var ta = $('char-wb-editor-ta');
    if (!src || !modal || !ta) return;
    contentEditorTarget = src;
    contentEditorSaveHook = typeof saveHook === 'function' ? saveHook : null;
    ta.value = src.value || '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    refreshContentEditorGuides();
    setTimeout(function () {
      ta.focus();
      try {
        ta.setSelectionRange(ta.value.length, ta.value.length);
      } catch (e) {}
    }, 30);
  }

  function closeContentEditor(save) {
    var modal = $('char-wb-editor-modal');
    var ta = $('char-wb-editor-ta');
    if (save !== false && contentEditorTarget && ta) {
      contentEditorTarget.value = ta.value;
      if (contentEditorSaveHook) {
        contentEditorSaveHook(contentEditorTarget);
      } else {
        var card = contentEditorTarget.closest
          ? contentEditorTarget.closest('.char-wb-card')
          : null;
        if (card) syncEntryFromBody(card);
      }
    }
    contentEditorTarget = null;
    contentEditorSaveHook = null;
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function insertTabAtCursor(ta) {
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var val = ta.value;
    ta.value = val.slice(0, start) + '\t' + val.slice(end);
    ta.selectionStart = ta.selectionEnd = start + 1;
  }

  function bindContentEditor() {
    if (contentEditorBound) return;
    contentEditorBound = true;
    var modal = $('char-wb-editor-modal');
    var ta = $('char-wb-editor-ta');
    var closeBtn = $('btn-char-wb-editor-close');
    var svg = window.天青_svg;
    if (svg && svg.exit) svg.mount($('btn-char-wb-editor-close-icon'), svg.exit);

    function onEditorKeydown(e) {
      if (!modal || !modal.classList.contains('open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeContentEditor(true);
        return;
      }
      if (e.key === 'Tab' && e.target === ta) {
        e.preventDefault();
        insertTabAtCursor(ta);
        refreshContentEditorGuides();
      }
    }

    if (ta) {
      ta.addEventListener('input', refreshContentEditorGuides);
      ta.addEventListener('scroll', syncContentEditorScroll);
      ta.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        insertTabAtCursor(ta);
        refreshContentEditorGuides();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', function () {
      closeContentEditor(true);
    });
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeContentEditor(true);
      });
    }
    document.addEventListener('keydown', onEditorKeydown);
  }

  function moveEntry(id, dir) {
    var tab = activeTab();
    if (!tab) return;
    var list = tabEntries(tab);
    var i = findEntryIndex(list, id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= list.length) return;
    var tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    tab.entries = list;
    saveStore();
    renderEntryList();
  }

  function clearEntryDragTimer() {
    if (entryDrag && entryDrag.timer) {
      clearTimeout(entryDrag.timer);
      entryDrag.timer = null;
    }
  }

  function endEntryDragListeners() {
    document.removeEventListener('pointermove', onEntryDragPointerMove);
    document.removeEventListener('pointerup', onEntryDragPointerUp);
    document.removeEventListener('pointercancel', onEntryDragPointerUp);
  }

  function clearEntryCardDragStyles(card) {
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

  function removeEntryPlaceholder() {
    if (entryDrag && entryDrag.placeholder && entryDrag.placeholder.parentNode) {
      entryDrag.placeholder.parentNode.removeChild(entryDrag.placeholder);
    }
    if (entryDrag) entryDrag.placeholder = null;
  }

  function moveEntryPlaceholder(list, placeholder, clientY) {
    if (!list || !placeholder) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll('.char-wb-card:not(.is-dragging)'));
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

  function autoScrollEntryList(list, clientY) {
    var rect = list.getBoundingClientRect();
    var edge = 40;
    var step = 14;
    if (clientY < rect.top + edge) list.scrollTop -= step;
    else if (clientY > rect.bottom - edge) list.scrollTop += step;
  }

  function positionFloatingEntryCard(card, clientX, clientY) {
    if (!card || !entryDrag) return;
    card.style.left = clientX - entryDrag.offsetX + 'px';
    card.style.top = clientY - entryDrag.offsetY + 'px';
  }

  function beginEntryDrag(card, pointerId, clientX, clientY) {
    var list = $('char-wb-list');
    if (!list || !card || !entryDrag) return;
    var rect = card.getBoundingClientRect();
    var placeholder = document.createElement('li');
    placeholder.className = 'preset-drag-placeholder';
    placeholder.style.height = Math.max(rect.height, 44) + 'px';
    placeholder.setAttribute('aria-hidden', 'true');

    list.insertBefore(placeholder, card);
    entryDrag.active = true;
    entryDrag.card = card;
    entryDrag.placeholder = placeholder;
    entryDrag.pointerId = pointerId;
    entryDrag.offsetX = clientX - rect.left;
    entryDrag.offsetY = clientY - rect.top;
    entryDrag.lastY = clientY;

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

  function finishEntryDrag(commit) {
    if (!entryDrag) return;
    clearEntryDragTimer();
    endEntryDragListeners();
    var list = $('char-wb-list');
    var card = entryDrag.card;
    var placeholder = entryDrag.placeholder;
    var wasActive = entryDrag.active;
    var handle = card && card.querySelector('.preset-drag-handle');

    if (wasActive && list && card && placeholder && placeholder.parentNode) {
      list.insertBefore(card, placeholder);
    }
    removeEntryPlaceholder();
    if (list) list.classList.remove('is-reordering');
    clearEntryCardDragStyles(card);
    if (handle) handle.classList.remove('is-hot');

    entryDrag = null;
    if (!wasActive || !commit || !list) return;

    var tab = activeTab();
    if (!tab) return;
    var map = {};
    tabEntries(tab).forEach(function (entry, i) {
      map[entryUid(entry, i)] = entry;
    });
    var next = [];
    list.querySelectorAll('.char-wb-card').forEach(function (el) {
      var entry = map[String(el.dataset.id)];
      if (entry) next.push(entry);
    });
    if (!next.length) return;
    tab.entries = next;
    saveStore();
    renderEntryList();
  }

  function onEntryDragPointerMove(e) {
    if (!entryDrag) return;
    if (entryDrag.pointerId != null && e.pointerId !== entryDrag.pointerId) return;
    var dy = Math.abs(e.clientY - entryDrag.startY);
    var dx = Math.abs(e.clientX - entryDrag.startX);
    if (!entryDrag.active) {
      if (dy > ENTRY_MOVE_PX || dx > ENTRY_MOVE_PX) {
        clearEntryDragTimer();
        finishEntryDrag(false);
      }
      return;
    }
    e.preventDefault();
    var list = $('char-wb-list');
    if (!list || !entryDrag.card) return;
    positionFloatingEntryCard(entryDrag.card, e.clientX, e.clientY);
    autoScrollEntryList(list, e.clientY);
    moveEntryPlaceholder(list, entryDrag.placeholder, e.clientY);
    entryDrag.lastY = e.clientY;
  }

  function onEntryDragPointerUp(e) {
    if (!entryDrag) return;
    if (entryDrag.pointerId != null && e.pointerId !== entryDrag.pointerId) return;
    finishEntryDrag(!!entryDrag.active);
  }

  function onEntryHandlePointerDown(e) {
    var handle = e.target && e.target.closest ? e.target.closest('.preset-drag-handle') : null;
    if (!handle) return;
    if (e.button != null && e.button !== 0) return;
    var card = handle.closest('.char-wb-card');
    var list = $('char-wb-list');
    if (!card || !list) return;
    e.preventDefault();
    e.stopPropagation();
    finishEntryDrag(false);
    handle.classList.add('is-hot');
    entryDrag = {
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
    document.addEventListener('pointermove', onEntryDragPointerMove, { passive: false });
    document.addEventListener('pointerup', onEntryDragPointerUp);
    document.addEventListener('pointercancel', onEntryDragPointerUp);
    entryDrag.timer = setTimeout(function () {
      if (!entryDrag || entryDrag.card !== card) return;
      beginEntryDrag(card, e.pointerId, e.clientX, e.clientY);
    }, ENTRY_LONG_MS);
  }

  function onEntryListClick(e) {
    if (e.target && e.target.closest && e.target.closest('.preset-drag-handle')) return;
    var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn || btn.disabled) return;
    var row = btn.closest('.char-wb-card');
    if (!row) return;
    var act = btn.getAttribute('data-act');
    var tab = activeTab();
    var entries = tabEntries(tab);
    var entry = findEntry(entries, row.dataset.id);

    if (act === 'expand') {
      flushOpenEntries();
      expandedEntryId = String(expandedEntryId) === String(row.dataset.id) ? null : row.dataset.id;
      renderEntryList();
      return;
    }
    if (act === 'expand-content') {
      e.preventDefault();
      e.stopPropagation();
      openContentEditor(row);
      return;
    }
    if (act === 'toggle') {
      if (!entry) return;
      entry.enabled = entry.enabled === false;
      saveStore();
      renderEntryList();
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
      duplicateEntry(row.dataset.id);
      return;
    }
    if (act === 'delete') {
      var label =
        (entry && (entry.comment || (entry.key && entry.key[0]))) || '该条目';
      var ask =
        window.天青_settings && window.天青_settings.confirm
          ? window.天青_settings.confirm
          : null;
      var run = function () {
        tab.entries = entries.filter(function (item, i) {
          return entryUid(item, i) !== String(row.dataset.id);
        });
        if (String(expandedEntryId) === String(row.dataset.id)) expandedEntryId = null;
        saveStore();
        renderEntryList();
        toast('已删除条目');
      };
      if (ask) ask('确定删除世界书条目「' + label + '」吗？', run);
      else if (window.confirm('确定删除世界书条目「' + label + '」吗？')) run();
    }
  }

  function onEntryListChange(e) {
    var card = e.target && e.target.closest ? e.target.closest('.char-wb-card') : null;
    if (!card) return;
    if (e.target.getAttribute('data-field')) syncEntryFromBody(card);
  }

  function renderNav() {
    var nav = $('character-subnav');
    if (!nav || !store) return;
    var svg = window.天青_svg;
    nav.innerHTML = '';

    store.tabs.forEach(function (tab) {
      var on = tab.enabled !== false;
      var btn = document.createElement('div');
      btn.className =
        'settings-subtab char-subtab' +
        (String(tab.id) === String(store.activeId) ? ' active' : '') +
        (on ? '' : ' is-off');
      btn.dataset.sub = tab.id;
      btn.dataset.id = tab.id;
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      applyTint(btn, tab.color);

      var grip = document.createElement('span');
      grip.className = 'char-subtab-grip';
      grip.title = '拖动排序';
      grip.setAttribute('aria-hidden', 'true');
      if (svg && svg.grip) svg.mount(grip, svg.grip);
      else grip.textContent = '≡';

      var label = document.createElement('span');
      label.className = 'sub-label';
      label.textContent = tab.name;

      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'preset-switch char-subtab-switch' + (on ? ' is-on' : '');
      sw.title = on ? '已开启' : '已关闭';
      sw.setAttribute('data-act', 'toggle');
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');
      sw.setAttribute('aria-label', on ? '关闭角色世界书' : '开启角色世界书');

      btn.appendChild(grip);
      btn.appendChild(label);
      btn.appendChild(sw);
      nav.appendChild(btn);
    });

    requestAnimationFrame(function () {
      nav.querySelectorAll('.char-subtab .sub-label').forEach(function (el) {
        var prevClamp = el.style.webkitLineClamp;
        var prevMax = el.style.maxHeight;
        el.style.webkitLineClamp = 'unset';
        el.style.maxHeight = 'none';
        var full = el.scrollHeight;
        el.style.webkitLineClamp = prevClamp;
        el.style.maxHeight = prevMax;
        var limit = parseFloat(getComputedStyle(el).lineHeight) * 2 || el.clientHeight;
        if (full > limit + 1) el.classList.add('is-overflow');
        else el.classList.remove('is-overflow');
      });
    });

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'settings-subtab char-subtab-add';
    add.id = 'btn-char-tab-add';
    add.title = '新增二级目录';
    add.setAttribute('aria-label', '新增二级目录');
    add.innerHTML = '<span class="char-add-plus" aria-hidden="true">+</span>';
    nav.appendChild(add);

    updateContent();
  }

  function selectTab(id) {
    if (!findTab(id)) return;
    if (String(store.activeId) !== String(id)) {
      flushOpenEntries();
      expandedEntryId = null;
    }
    store.activeId = id;
    saveStore();
    renderNav();
  }

  function setTabEnabled(id, enabled) {
    var tab = findTab(id);
    if (!tab) return;
    tab.enabled = !!enabled;
    saveStore();
    renderNav();
  }

  function addTab() {
    var n = store.tabs.length + 1;
    var tab = {
      id: makeId(),
      name: '角色' + n,
      color: DEFAULT_COLOR,
      locked: false,
      enabled: true,
      entries: [],
    };
    store.tabs.push(tab);
    store.activeId = tab.id;
    saveStore();
    renderNav();
    toast('已新增「' + tab.name + '」');
  }

  function renameActive() {
    var tab = activeTab();
    if (!tab) return;
    var next = window.prompt('重命名二级目录', tab.name);
    if (next == null) return;
    next = String(next).trim().slice(0, 48);
    if (!next) {
      toast('名称不能为空');
      return;
    }
    tab.name = next;
    saveStore();
    renderNav();
    toast('已重命名');
  }

  function deleteActive() {
    var tab = activeTab();
    if (!tab) return;
    if (tab.locked) {
      toast('默认角色不可删除');
      return;
    }
    var ask =
      window.天青_settings && window.天青_settings.confirm
        ? window.天青_settings.confirm
        : null;
    var run = function () {
      var idx = findIndex(tab.id);
      if (idx < 0) return;
      store.tabs.splice(idx, 1);
      if (!store.tabs.length) store = defaultStore();
      else store.activeId = store.tabs[Math.max(0, Math.min(idx, store.tabs.length - 1))].id;
      saveStore();
      renderNav();
      toast('已删除「' + tab.name + '」');
    };
    if (ask) ask('确定删除角色「' + tab.name + '」吗？', run);
    else if (window.confirm('确定删除角色「' + tab.name + '」吗？')) run();
  }

  function setActiveColor(hex) {
    var tab = activeTab();
    if (!tab) return;
    tab.color = hex || DEFAULT_COLOR;
    saveStore();
    renderNav();
  }

  function tabEntries(tab) {
    if (!tab) return [];
    if (!Array.isArray(tab.entries)) tab.entries = [];
    return tab.entries;
  }

  function openOverwriteModal() {
    var modal = $('char-wb-overwrite-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeOverwriteModal(clearPending) {
    var modal = $('char-wb-overwrite-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (clearPending !== false) pendingImport = null;
  }

  function applyWorldbookImport(mode) {
    var tab = activeTab();
    if (!tab || !pendingImport || !pendingImport.entries) return;
    var incoming = pendingImport.entries.slice();
    var name = pendingImport.name || '世界书';
    if (mode === 'overwrite') {
      tab.entries = incoming;
      toast('已覆盖导入「' + name + '」（' + incoming.length + ' 条）');
    } else {
      tab.entries = tabEntries(tab).concat(incoming);
      toast('已追加导入「' + name + '」（+' + incoming.length + ' 条，共 ' + tab.entries.length + ' 条）');
    }
    pendingImport = null;
    saveStore();
    updateContent();
    closeOverwriteModal(false);
  }

  function parseWorldbookFile(file) {
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
        var entries = api.importWorldbook(json);
        if (!entries || !entries.length) {
          toast('未解析到有效世界书条目');
          return;
        }
        var nameHint = String(file.name || '').replace(/\.json$/i, '');
        var name = (json && json.name) || nameHint || '世界书';
        pendingImport = { entries: entries, name: name };
        var tab = activeTab();
        if (tabEntries(tab).length) {
          openOverwriteModal();
        } else {
          applyWorldbookImport('overwrite');
        }
      } catch (err) {
        console.warn('[天青 角色] import worldbook', err);
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
    var s = String(name || '世界书')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ');
    return s || '世界书';
  }

  function exportActiveWorldbook() {
    var tab = activeTab();
    if (!tab) {
      toast('没有可导出的二级目录');
      return;
    }
    var api = window.天青_preset;
    if (!api || typeof api.exportWorldbook !== 'function') {
      toast('世界书导出模块未加载');
      return;
    }
    var name = String(tab.name || '').trim() || '世界书';
    var entries = tabEntries(tab);
    if (!entries.length) {
      toast('当前目录没有可导出的条目');
      return;
    }
    var payload = api.exportWorldbook(entries, name);
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
    toast('已导出世界书「' + name + '」（' + entries.length + ' 条）');
  }

  function clearDragStyles(btn) {
    if (!btn) return;
    btn.classList.remove('is-dragging');
    btn.style.position = '';
    btn.style.left = '';
    btn.style.top = '';
    btn.style.width = '';
    btn.style.height = '';
    btn.style.margin = '';
    btn.style.zIndex = '';
    btn.style.pointerEvents = '';
    btn.style.transform = '';
    btn.style.transition = '';
  }

  function removePlaceholder() {
    if (drag && drag.placeholder && drag.placeholder.parentNode) {
      drag.placeholder.parentNode.removeChild(drag.placeholder);
    }
    if (drag) drag.placeholder = null;
  }

  function clearDrag(commitOrder) {
    if (!drag) return;
    if (drag.timer) clearTimeout(drag.timer);
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragUp);
    document.removeEventListener('pointercancel', onDragUp);

    var nav = $('character-subnav');
    var btn = drag.btn;
    var placeholder = drag.placeholder;
    var wasActive = drag.active;
    var grip = btn && btn.querySelector('.char-subtab-grip');

    if (wasActive && nav && btn && placeholder && placeholder.parentNode) {
      nav.insertBefore(btn, placeholder);
    }
    removePlaceholder();
    if (nav) nav.classList.remove('is-reordering');
    clearDragStyles(btn);
    if (grip) grip.classList.remove('is-hot');

    drag = null;
    if (wasActive && commitOrder) commitDomOrder();
  }

  function movePlaceholder(nav, placeholder, clientY) {
    if (!nav || !placeholder) return;
    var tabs = Array.prototype.slice.call(nav.querySelectorAll('.char-subtab:not(.is-dragging)'));
    var addBtn = nav.querySelector('.char-subtab-add');
    var firstTops = {};
    tabs.forEach(function (el) {
      firstTops[String(el.dataset.id)] = el.getBoundingClientRect().top;
    });

    var target = null;
    for (var i = 0; i < tabs.length; i++) {
      var rect = tabs[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        target = tabs[i];
        break;
      }
    }

    var moved = false;
    if (target) {
      if (placeholder.nextSibling !== target) {
        nav.insertBefore(placeholder, target);
        moved = true;
      }
    } else if (addBtn) {
      /* 不允许低于加号：占位始终在加号之前 */
      if (placeholder.nextSibling !== addBtn) {
        nav.insertBefore(placeholder, addBtn);
        moved = true;
      }
    }

    if (!moved) return;

    tabs.forEach(function (el) {
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

  function autoScrollNav(nav, clientY) {
    var rect = nav.getBoundingClientRect();
    var edge = 28;
    var step = 10;
    if (clientY < rect.top + edge) nav.scrollTop -= step;
    else if (clientY > rect.bottom - edge) nav.scrollTop += step;
  }

  function positionFloating(btn, clientX, clientY) {
    if (!btn || !drag) return;
    btn.style.left = clientX - drag.offsetX + 'px';
    btn.style.top = clientY - drag.offsetY + 'px';
  }

  function commitDomOrder() {
    var nav = $('character-subnav');
    if (!nav) return;
    var ids = [];
    nav.querySelectorAll('.char-subtab').forEach(function (el) {
      if (el.dataset.id) ids.push(el.dataset.id);
    });
    var map = {};
    store.tabs.forEach(function (t) {
      map[String(t.id)] = t;
    });
    var next = [];
    ids.forEach(function (id) {
      if (map[id]) next.push(map[id]);
    });
    if (next.length !== store.tabs.length) return;
    store.tabs = next;
    saveStore();
    renderNav();
  }

  function beginDrag(btn, clientX, clientY) {
    var nav = $('character-subnav');
    if (!nav || !btn || !drag) return;
    var rect = btn.getBoundingClientRect();
    var placeholder = document.createElement('div');
    placeholder.className = 'char-subtab-placeholder';
    placeholder.style.height = Math.max(rect.height, 36) + 'px';
    placeholder.setAttribute('aria-hidden', 'true');
    nav.insertBefore(placeholder, btn);

    drag.active = true;
    drag.btn = btn;
    drag.placeholder = placeholder;
    drag.offsetX = clientX - rect.left;
    drag.offsetY = clientY - rect.top;

    nav.classList.add('is-reordering');
    btn.classList.add('is-dragging');
    btn.style.position = 'fixed';
    btn.style.left = rect.left + 'px';
    btn.style.top = rect.top + 'px';
    btn.style.width = rect.width + 'px';
    btn.style.height = rect.height + 'px';
    btn.style.margin = '0';
    btn.style.zIndex = '60';
    btn.style.pointerEvents = 'none';
    btn.style.transform = 'scale(1.06)';

    var grip = btn.querySelector('.char-subtab-grip');
    if (grip) grip.classList.add('is-hot');
  }

  function onDragMove(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    var dy = Math.abs(e.clientY - drag.startY);
    var dx = Math.abs(e.clientX - drag.startX);
    if (!drag.active) {
      if (dy > MOVE_PX || dx > MOVE_PX) {
        clearTimeout(drag.timer);
        drag.timer = null;
        clearDrag(false);
      }
      return;
    }
    e.preventDefault();
    var nav = $('character-subnav');
    if (!nav || !drag.btn) return;
    positionFloating(drag.btn, e.clientX, e.clientY);
    autoScrollNav(nav, e.clientY);
    movePlaceholder(nav, drag.placeholder, e.clientY);
  }

  function onDragUp(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    var was = drag.active;
    var btn = drag.btn;
    clearDrag(!!was);
    if (!was && btn && btn.dataset.id) selectTab(btn.dataset.id);
  }

  function onGripPointerDown(e) {
    var grip = e.target && e.target.closest ? e.target.closest('.char-subtab-grip') : null;
    if (!grip) return;
    var btn = grip.closest('.char-subtab');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    clearDrag(false);
    grip.classList.add('is-hot');
    drag = {
      timer: null,
      active: false,
      btn: btn,
      placeholder: null,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: 0,
      offsetY: 0,
    };
    document.addEventListener('pointermove', onDragMove, { passive: false });
    document.addEventListener('pointerup', onDragUp);
    document.addEventListener('pointercancel', onDragUp);
    drag.timer = setTimeout(function () {
      if (!drag || drag.btn !== btn) return;
      beginDrag(btn, e.clientX, e.clientY);
    }, LONG_MS);
  }

  function bind() {
    store = loadStore();
    ensureTianqingDefaultWorldbook();
    var svg = window.天青_svg;
    if (svg) {
      if (svg.importIcon) svg.mount($('btn-char-import-wb-icon'), svg.importIcon);
      if (svg.exportIcon) svg.mount($('btn-char-export-wb-icon'), svg.exportIcon);
      if (svg.palette) svg.mount($('char-color-icon'), svg.palette);
      if (svg.pencil) svg.mount($('btn-char-rename-icon'), svg.pencil);
      if (svg.trash) svg.mount($('btn-char-delete-icon'), svg.trash);
      if (svg.help) svg.mount($('btn-char-help-icon'), svg.help);
      if (svg.exit) svg.mount($('btn-char-wb-overwrite-exit-icon'), svg.exit);
    }

    renderNav();

    var helpBtn = $('btn-char-help');
    var helpModal = $('char-help-modal');
    var helpClose = $('btn-char-help-close');

    function openHelp() {
      if (!helpModal) return;
      helpModal.classList.add('open');
      helpModal.setAttribute('aria-hidden', 'false');
    }

    function closeHelp() {
      if (!helpModal) return;
      helpModal.classList.remove('open');
      helpModal.setAttribute('aria-hidden', 'true');
    }

    if (helpBtn) helpBtn.addEventListener('click', openHelp);
    if (helpClose) helpClose.addEventListener('click', closeHelp);
    if (helpModal) {
      helpModal.addEventListener('click', function (e) {
        if (e.target === helpModal) closeHelp();
      });
    }

    var importBtn = $('btn-char-import-wb');
    var exportBtn = $('btn-char-export-wb');
    var importFile = $('cfg-char-wb-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () {
        importFile.value = '';
        importFile.click();
      });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (file) parseWorldbookFile(file);
        importFile.value = '';
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', exportActiveWorldbook);
    }

    var overwriteModal = $('char-wb-overwrite-modal');
    var overwriteBtn = $('btn-char-wb-overwrite');
    var keepBtn = $('btn-char-wb-keep');
    var overwriteExit = $('btn-char-wb-overwrite-exit');
    if (overwriteBtn) {
      overwriteBtn.addEventListener('click', function () {
        applyWorldbookImport('overwrite');
      });
    }
    if (keepBtn) {
      keepBtn.addEventListener('click', function () {
        applyWorldbookImport('merge');
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

    var nav = $('character-subnav');
    if (nav) {
      nav.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.char-subtab-grip')) return;
        var sw = e.target.closest ? e.target.closest('.char-subtab-switch') : null;
        if (sw) {
          e.preventDefault();
          e.stopPropagation();
          var host = sw.closest('.char-subtab');
          if (!host || !host.dataset.id) return;
          var tab = findTab(host.dataset.id);
          if (!tab) return;
          setTabEnabled(host.dataset.id, tab.enabled === false);
          return;
        }
        if (e.target.closest && e.target.closest('.char-subtab-add')) {
          e.preventDefault();
          addTab();
          return;
        }
        var tabBtn = e.target.closest ? e.target.closest('.char-subtab') : null;
        if (tabBtn && tabBtn.dataset.id) selectTab(tabBtn.dataset.id);
      });
      nav.addEventListener('keydown', function (e) {
        var tabBtn = e.target.closest ? e.target.closest('.char-subtab') : null;
        if (!tabBtn || !tabBtn.dataset.id) return;
        if (e.target.closest && e.target.closest('.char-subtab-switch')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTab(tabBtn.dataset.id);
        }
      });
      nav.addEventListener('pointerdown', onGripPointerDown);
      nav.addEventListener('contextmenu', function (e) {
        if (e.target.closest && e.target.closest('.char-subtab-grip')) e.preventDefault();
      });
    }

    var renameBtn = $('btn-char-rename');
    var deleteBtn = $('btn-char-delete');
    var colorInput = $('char-tab-color');
    var addEntryBtn = $('btn-char-wb-add');
    var entryList = $('char-wb-list');
    if (renameBtn) renameBtn.addEventListener('click', renameActive);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteActive);
    if (addEntryBtn) addEntryBtn.addEventListener('click', addEntry);
    if (entryList) {
      entryList.addEventListener('click', onEntryListClick);
      entryList.addEventListener('pointerdown', onEntryHandlePointerDown);
      entryList.addEventListener('change', onEntryListChange);
      entryList.addEventListener('input', onEntryListChange);
      entryList.addEventListener('blur', onEntryListChange, true);
      entryList.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var ta = e.target;
        if (!ta || !ta.getAttribute || ta.getAttribute('data-field') !== 'content') return;
        e.preventDefault();
        insertTabAtCursor(ta);
        syncEntryFromBody(ta.closest('.char-wb-card'));
      });
      entryList.addEventListener('contextmenu', function (e) {
        if (e.target.closest && e.target.closest('.preset-drag-handle')) e.preventDefault();
      });
    }
    bindContentEditor();
    if (colorInput) {
      colorInput.addEventListener('input', function () {
        setActiveColor(colorInput.value);
      });
      colorInput.addEventListener('change', function () {
        setActiveColor(colorInput.value);
      });
    }
  }

  window.天青_settings_character = {
    bind: bind,
    renderNav: renderNav,
    renderEntryList: renderEntryList,
    openContentEditor: openContentEditor,
    getStore: function () {
      return store;
    },
  };
})();
