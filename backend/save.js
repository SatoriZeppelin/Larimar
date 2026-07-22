/**
 * 会话存档：当前进度 + 无限手动槽位 + 独立快速存档
 * 对外：window.天青_save
 */
(function () {
  var KEY = 'tq_plus_chat';
  var SLOTS_KEY = 'tq_plus_save_slots';
  var QUICK_KEY = 'tq_plus_quick_save';
  /** 每页槽位数（4×3，对齐参考 DATA 布局） */
  var PAGE_SIZE = 12;

  function emptyData() {
    return { messages: [], lastRaw: '', updatedAt: 0 };
  }

  function emptySlot(index) {
    return { index: index, empty: true, label: '', updatedAt: 0, data: null };
  }

  function normalizeSlot(s, index) {
    if (!s || s.empty || !s.data) return emptySlot(index);
    return {
      index: index,
      empty: false,
      label: s.label || '存档 ' + (index + 1),
      updatedAt: s.updatedAt || 0,
      data: {
        messages: Array.isArray(s.data.messages) ? s.data.messages : [],
        lastRaw: s.data.lastRaw || '',
        updatedAt: s.data.updatedAt || s.updatedAt || 0,
      },
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return emptyData();
      if (!Array.isArray(d.messages)) d.messages = [];
      if (d.lastRaw == null) d.lastRaw = '';
      return d;
    } catch (e) {
      return emptyData();
    }
  }

  function save(data) {
    try {
      var d = data || emptyData();
      d.updatedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {}
  }

  function clear() {
    save(emptyData());
  }

  function hasProgress() {
    var d = load();
    return !!(d.messages && d.messages.length) || !!(d.lastRaw && String(d.lastRaw).trim());
  }

  function push(role, content) {
    var d = load();
    d.messages.push({ role: role, content: content, at: Date.now() });
    save(d);
    return d;
  }

  function setLastRaw(raw) {
    var d = load();
    d.lastRaw = raw || '';
    save(d);
    return d;
  }

  /** 读取全部槽位（稀疏数组形式，长度按已用最大序号扩展） */
  function loadSlots() {
    try {
      var raw = localStorage.getItem(SLOTS_KEY);
      if (!raw) return [];
      var o = JSON.parse(raw);
      var list = Array.isArray(o) ? o : o && Array.isArray(o.slots) ? o.slots : null;
      if (!list) return [];
      var out = [];
      var max = -1;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (!s || s.empty || !s.data) continue;
        var idx = typeof s.index === 'number' ? s.index : i;
        if (idx > max) max = idx;
        out[idx] = normalizeSlot(s, idx);
      }
      for (var j = 0; j <= max; j++) {
        if (!out[j]) out[j] = emptySlot(j);
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  function persistSlots(slots) {
    try {
      /* 只持久化有数据的槽，支持无限扩展 */
      var packed = [];
      for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (!s || s.empty || !s.data) continue;
        packed.push({
          index: s.index,
          empty: false,
          label: s.label || '',
          updatedAt: s.updatedAt || 0,
          data: {
            messages: Array.isArray(s.data.messages) ? s.data.messages : [],
            lastRaw: s.data.lastRaw || '',
            updatedAt: s.data.updatedAt || s.updatedAt || 0,
          },
        });
      }
      localStorage.setItem(SLOTS_KEY, JSON.stringify({ version: 2, slots: packed }));
    } catch (e) {}
  }

  function highestUsedIndex(slots) {
    var max = -1;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] && !slots[i].empty) max = Math.max(max, i);
    }
    return max;
  }

  /**
   * 保证至少有 minCount 个槽（含空槽），用于写入扩展
   * 始终在已用槽后多留至少一个空位，方便继续存
   */
  function ensureCapacity(minCount) {
    var slots = loadSlots();
    var need = Math.max(minCount || 0, highestUsedIndex(slots) + 2, PAGE_SIZE);
    while (slots.length < need) {
      slots.push(emptySlot(slots.length));
    }
    return slots;
  }

  function pageCount() {
    var slots = ensureCapacity(PAGE_SIZE);
    return Math.max(1, Math.ceil(slots.length / PAGE_SIZE));
  }

  function loadPage(pageIndex) {
    var slots = ensureCapacity(PAGE_SIZE);
    var pages = Math.max(1, Math.ceil(slots.length / PAGE_SIZE));
    var page = Math.max(0, Math.min(pages - 1, Number(pageIndex) || 0));
    var start = page * PAGE_SIZE;
    var end = start + PAGE_SIZE;
    while (slots.length < end) slots.push(emptySlot(slots.length));
    return {
      page: page,
      pageCount: Math.max(1, Math.ceil(slots.length / PAGE_SIZE)),
      pageSize: PAGE_SIZE,
      slots: slots.slice(start, end),
    };
  }

  function writeSlot(index, data, label) {
    var i = Math.max(0, Math.floor(Number(index) || 0));
    var slots = ensureCapacity(i + 2);
    var payload = data || load();
    slots[i] = {
      index: i,
      empty: false,
      label: label || '存档 ' + (i + 1),
      updatedAt: Date.now(),
      data: {
        messages: Array.isArray(payload.messages) ? payload.messages.slice() : [],
        lastRaw: payload.lastRaw || '',
        updatedAt: Date.now(),
      },
    };
    /* 写完后再多留一个空槽 */
    if (slots.length < i + 2) slots.push(emptySlot(slots.length));
    persistSlots(slots);
    return slots[i];
  }

  function readSlot(index) {
    var i = Math.max(0, Math.floor(Number(index) || 0));
    var slots = ensureCapacity(i + 1);
    return slots[i] || emptySlot(i);
  }

  function clearSlot(index) {
    var i = Math.max(0, Math.floor(Number(index) || 0));
    var slots = ensureCapacity(i + 1);
    slots[i] = emptySlot(i);
    persistSlots(slots);
    return slots;
  }

  function applySlotToCurrent(index) {
    var slot = readSlot(index);
    if (!slot || slot.empty || !slot.data) return null;
    var data = {
      messages: Array.isArray(slot.data.messages) ? slot.data.messages.slice() : [],
      lastRaw: slot.data.lastRaw || '',
      updatedAt: Date.now(),
    };
    save(data);
    return data;
  }

  /** 仅返回已写入的手动槽（不含自动存档） */
  function listManualSaves() {
    var slots = loadSlots();
    var out = [];
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] && !slots[i].empty && slots[i].data) out.push(slots[i]);
    }
    return out;
  }

  /** 在末尾追加一个手动存档栏位 */
  function appendManualSave(data, label) {
    var slots = loadSlots();
    var next = highestUsedIndex(slots) + 1;
    if (next < 0) next = 0;
    var n = listManualSaves().length + 1;
    return writeSlot(next, data || load(), label || '存档 ' + n);
  }

  function quickSave(data) {
    var payload = data || load();
    var d = {
      messages: Array.isArray(payload.messages) ? payload.messages.slice() : [],
      lastRaw: payload.lastRaw || '',
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(QUICK_KEY, JSON.stringify(d));
    } catch (e) {}
    return d;
  }

  function quickLoad() {
    try {
      var raw = localStorage.getItem(QUICK_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return null;
      return {
        messages: Array.isArray(d.messages) ? d.messages : [],
        lastRaw: d.lastRaw || '',
        updatedAt: d.updatedAt || 0,
      };
    } catch (e) {
      return null;
    }
  }

  function hasQuickSave() {
    return !!quickLoad();
  }

  function clearQuickSave() {
    try {
      localStorage.removeItem(QUICK_KEY);
    } catch (e) {}
  }

  function applyQuickToCurrent() {
    var data = quickLoad();
    if (!data) return null;
    var out = {
      messages: data.messages.slice(),
      lastRaw: data.lastRaw || '',
      updatedAt: Date.now(),
    };
    save(out);
    return out;
  }

  /** 自动存档：与 quickSave 同一存储 */
  function autoSave(data) {
    return quickSave(data);
  }

  function autoLoad() {
    return quickLoad();
  }

  function hasAutoSave() {
    return hasQuickSave();
  }

  function clearAutoSave() {
    clearQuickSave();
  }

  function applyAutoToCurrent() {
    return applyQuickToCurrent();
  }

  window.天青_save = {
    PAGE_SIZE: PAGE_SIZE,
    load: load,
    save: save,
    clear: clear,
    hasProgress: hasProgress,
    push: push,
    setLastRaw: setLastRaw,
    loadSlots: loadSlots,
    ensureCapacity: ensureCapacity,
    pageCount: pageCount,
    loadPage: loadPage,
    writeSlot: writeSlot,
    readSlot: readSlot,
    clearSlot: clearSlot,
    applySlotToCurrent: applySlotToCurrent,
    listManualSaves: listManualSaves,
    appendManualSave: appendManualSave,
    quickSave: quickSave,
    quickLoad: quickLoad,
    hasQuickSave: hasQuickSave,
    clearQuickSave: clearQuickSave,
    applyQuickToCurrent: applyQuickToCurrent,
    autoSave: autoSave,
    autoLoad: autoLoad,
    hasAutoSave: hasAutoSave,
    clearAutoSave: clearAutoSave,
    applyAutoToCurrent: applyAutoToCurrent,
  };
})();
