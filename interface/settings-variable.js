/**
 * 系统设置 · 变量（JSON / YAML ↔ 资源管理器式变量树）
 * 独立网页：仅 localStorage 持久化，不写入酒馆
 * 每个值/布尔节点自动生成注册键：{{stat_data::路径}}，如 {{stat_data::时间.天数}}
 * 「变量名」栏为额外给 AI 的显示名，可与路径键不同
 * 对外：window.天青_settings_variable
 */
(function () {
  var KEY = 'tq_plus_variables';
  var VIEW_KEY = 'tq_plus_variables_view';
  var SEED_KEY = 'tq_plus_variables_seed';
  var SEED_VER = 'variables-default-v1';
  var data = {};
  var meta = {}; /* pathKey -> { varName, comment } */
  var view = 'json';
  var expanded = {};
  var textDirty = false;
  var renamingPath = null;
  var selectedPathKey = null;
  var ctxTarget = null; /* { path: string[], kind: 'node'|'blank' } */
  var dragState = null;
  var hydrated = false;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function clone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return {};
    }
  }

  function pathKey(path) {
    return (path || []).map(String).join('\0');
  }

  function getMeta(path) {
    var k = pathKey(path);
    var m = meta[k];
    if (!m || typeof m !== 'object') return { varName: '', comment: '' };
    return {
      varName: m.varName != null ? String(m.varName) : '',
      comment: m.comment != null ? String(m.comment) : '',
    };
  }

  /** 树路径 → 注册键，如 时间/天数 → {{stat_data::时间.天数}} */
  function macroKeyForPath(path) {
    if (!path || !path.length) return '{{stat_data::}}';
    return '{{stat_data::' + path.map(String).join('.') + '}}';
  }

  function isLegacyMacroVarName(name) {
    return /^\{\{stat_data::/.test(String(name || ''));
  }

  function walkValueNodes(node, path, fn) {
    if (node == null) return;
    if (Array.isArray(node)) {
      fn(path, node);
      for (var i = 0; i < node.length; i++) {
        var item = node[i];
        var p = path.concat([i]);
        if (isPlainObject(item) || Array.isArray(item)) walkValueNodes(item, p, fn);
        else fn(p, item);
      }
      return;
    }
    if (isPlainObject(node)) {
      Object.keys(node).forEach(function (key) {
        var p = path.concat([key]);
        var v = node[key];
        if (isPlainObject(v) || Array.isArray(v)) walkValueNodes(v, p, fn);
        else fn(p, v);
      });
    }
  }

  /** 清理已删除路径的 meta；并把旧版「变量名=宏键」迁移为空 */
  function syncAllRegisteredKeys() {
    var alive = {};
    function mark(path) {
      if (path && path.length) alive[pathKey(path)] = true;
    }
    if (isPlainObject(data)) {
      Object.keys(data).forEach(function (key) {
        var v = data[key];
        var p = [key];
        if (isPlainObject(v) || Array.isArray(v)) walkValueNodes(v, p, mark);
        else mark(p);
      });
    } else if (Array.isArray(data)) {
      walkValueNodes(data, [], mark);
    }
    Object.keys(meta).forEach(function (k) {
      if (!alive[k]) {
        delete meta[k];
        return;
      }
      if (!meta[k] || typeof meta[k] !== 'object') {
        delete meta[k];
        return;
      }
      if (isLegacyMacroVarName(meta[k].varName)) meta[k].varName = '';
      if (!meta[k].varName && !meta[k].comment) delete meta[k];
    });
  }

  function writeMetaField(path, field, value) {
    var k = pathKey(path);
    if (!meta[k] || typeof meta[k] !== 'object') meta[k] = { varName: '', comment: '' };
    meta[k][field] = value == null ? '' : String(value);
    if (!meta[k].varName && !meta[k].comment) delete meta[k];
    persist();
  }

  function remapMetaPrefix(oldPrefix, newPrefix) {
    var next = {};
    Object.keys(meta).forEach(function (k) {
      if (k === oldPrefix || k.indexOf(oldPrefix + '\0') === 0) {
        next[newPrefix + k.slice(oldPrefix.length)] = meta[k];
      } else {
        next[k] = meta[k];
      }
    });
    meta = next;
  }

  function deleteMetaPrefix(prefix) {
    Object.keys(meta).forEach(function (k) {
      if (k === prefix || k.indexOf(prefix + '\0') === 0) delete meta[k];
    });
  }

  /** 规范化本地读入 */
  function normalizeLoaded(raw) {
    var result = { data: {}, meta: {} };
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return result;

    if (raw.__tq === 1 && raw.data != null && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
      result.data = clone(raw.data);
      result.meta = clone(raw.meta || {});
      return result;
    }

    /* 兼容旧版：整包即 data */
    result.data = clone(raw);
    return result;
  }

  function packageLocal() {
    return { __tq: 1, data: clone(data), meta: clone(meta) };
  }

  function applyLoaded(pack) {
    data = pack && pack.data ? pack.data : {};
    meta = pack && pack.meta ? pack.meta : {};
    if (!isPlainObject(data)) data = {};
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) meta = {};
    syncAllRegisteredKeys();
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return normalizeLoaded({});
      return normalizeLoaded(JSON.parse(raw));
    } catch (e) {
      return normalizeLoaded({});
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(packageLocal()));
      return true;
    } catch (e) {
      console.warn('[天青] 写入本地变量失败', e);
      return false;
    }
  }

  function load() {
    applyLoaded(loadLocal());
    hydrated = true;
  }

  /** 内嵌默认基础变量 */
  function loadDefaultVariables() {
    var raw = window.天青_default_variables;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    try {
      return JSON.parse(JSON.stringify(raw));
    } catch (e) {
      return null;
    }
  }

  function isDataEmpty() {
    return !isPlainObject(data) || !Object.keys(data).length;
  }

  /**
   * 首次载入：写入内嵌基础变量（仅播种一次，不覆盖已有内容）
   */
  function ensureDefaultVariables() {
    var seeded = '';
    try {
      seeded = localStorage.getItem(SEED_KEY) || '';
    } catch (e) {}
    if (seeded === SEED_VER) return false;

    if (!isDataEmpty()) {
      try {
        localStorage.setItem(SEED_KEY, SEED_VER);
      } catch (e) {}
      return false;
    }

    var defaults = loadDefaultVariables();
    if (!defaults) return false;
    data = defaults;
    meta = {};
    syncAllRegisteredKeys();
    saveLocal();
    try {
      localStorage.setItem(SEED_KEY, SEED_VER);
    } catch (e) {}
    console.info('[天青 变量] 已载入默认基础变量');
    return true;
  }

  /** 同步文本区 + 本地持久化 */
  function persist() {
    syncAllRegisteredKeys();
    syncTextarea();
    var ok = saveLocal();
    if (window.天青_settings_prompt && window.天青_settings_prompt.syncStatDataPrompt) {
      try {
        window.天青_settings_prompt.syncStatDataPrompt({ silent: true });
      } catch (e) {}
    }
    return ok;
  }

  function loadView() {
    try {
      var v = localStorage.getItem(VIEW_KEY);
      if (v === 'yaml' || v === 'tree' || v === 'json') return v;
      if (v === 'text') return 'json';
      return 'json';
    } catch (e) {
      return 'json';
    }
  }

  function saveView() {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch (e) {}
  }

  function isTextView(v) {
    return v === 'json' || v === 'yaml';
  }

  function yamlApi() {
    return window.jsyaml || window.YAML || null;
  }

  function dumpText(obj) {
    if (view === 'yaml') {
      var y = yamlApi();
      if (!y || typeof y.dump !== 'function') {
        toast('YAML 库未加载');
        return '{}';
      }
      try {
        return y.dump(obj, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          sortKeys: false,
        });
      } catch (e) {
        return '';
      }
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return '{}';
    }
  }

  function parseText(raw) {
    if (view === 'yaml') {
      var y = yamlApi();
      if (!y || typeof y.load !== 'function') {
        throw new Error('YAML 库未加载');
      }
      return y.load(raw);
    }
    return JSON.parse(raw);
  }

  function isPlainObject(v) {
    return v != null && typeof v === 'object' && !Array.isArray(v);
  }

  function isBranch(v) {
    return Array.isArray(v) || isPlainObject(v);
  }

  function pathEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (String(a[i]) !== String(b[i])) return false;
    }
    return true;
  }

  function isAncestorPath(ancestor, descendant) {
    if (!ancestor.length || ancestor.length >= descendant.length) return false;
    for (var i = 0; i < ancestor.length; i++) {
      if (String(ancestor[i]) !== String(descendant[i])) return false;
    }
    return true;
  }

  function getAt(root, path) {
    if (!path || !path.length) return root;
    var cur = root;
    for (var i = 0; i < path.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }

  function parentPathOf(path) {
    return path.slice(0, -1);
  }

  function setAt(root, path, value) {
    if (!path.length) return value;
    var cur = root;
    for (var i = 0; i < path.length - 1; i++) {
      var k = path[i];
      if (cur[k] == null || typeof cur[k] !== 'object') {
        cur[k] = typeof path[i + 1] === 'number' ? [] : {};
      }
      cur = cur[k];
    }
    cur[path[path.length - 1]] = value;
    return root;
  }

  function deleteAt(root, path) {
    if (!path.length) return false;
    var parent = getAt(root, parentPathOf(path));
    if (parent == null || typeof parent !== 'object') return false;
    var key = path[path.length - 1];
    if (Array.isArray(parent)) {
      var idx = Number(key);
      if (isNaN(idx) || idx < 0 || idx >= parent.length) return false;
      parent.splice(idx, 1);
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(parent, key)) return false;
    delete parent[key];
    return true;
  }

  function childKeys(parent) {
    if (Array.isArray(parent)) {
      var arr = [];
      for (var i = 0; i < parent.length; i++) arr.push(i);
      return arr;
    }
    if (isPlainObject(parent)) return Object.keys(parent);
    return [];
  }

  function uniqueKey(parent, base) {
    var name = String(base || 'Object');
    if (Array.isArray(parent)) return parent.length;
    if (!Object.prototype.hasOwnProperty.call(parent, name)) return name;
    var n = 1;
    while (Object.prototype.hasOwnProperty.call(parent, name + '_' + n)) n++;
    return name + '_' + n;
  }

  function typeOfValue(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (isPlainObject(v)) return 'object';
    return typeof v;
  }

  /** UI 大类由实际数据类型自动判定：boolean → 布尔，其余叶子/数组 → 值，object → 文件夹 */

  function defaultOfType(type) {
    if (type === 'object') return {};
    if (type === 'boolean') return false;
    if (type === 'value') return '';
    return '';
  }

  function keyBaseForType(type) {
    if (type === 'object') return '文件夹';
    if (type === 'boolean') return '布尔';
    if (type === 'value') return '键';
    return '键';
  }

  /** 根据文本内容自动判断为 数组 / 数字 / 文本 */
  function classifyValueInput(raw) {
    var s = String(raw == null ? '' : raw);
    var trimmed = s.trim();
    if (trimmed === '') return '';

    if (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') {
      try {
        var arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr;
      } catch (e) {}
    }

    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
      var n = Number(trimmed);
      if (!isNaN(n)) return n;
    }

    return s;
  }

  function formatValueInput(value) {
    if (Array.isArray(value)) {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '[]';
      }
    }
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function expandAllBranches(node, path) {
    if (!isBranch(node)) return;
    expanded[pathKey(path)] = true;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) expandAllBranches(node[i], path.concat([i]));
    } else {
      Object.keys(node).forEach(function (k) {
        expandAllBranches(node[k], path.concat([k]));
      });
    }
  }

  function commitTextarea() {
    var ta = $('cfg-var-text');
    if (!ta) return true;
    var raw = ta.value.trim();
    if (!raw) {
      data = {};
      textDirty = false;
      persist();
      return true;
    }
    try {
      var parsed = parseText(raw);
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast('变量根节点须为对象');
        return false;
      }
      data = parsed;
      textDirty = false;
      expandAllBranches(data, []);
      persist();
      return true;
    } catch (e) {
      toast(view === 'yaml' ? 'YAML 格式无效' : 'JSON 格式无效');
      return false;
    }
  }

  function syncTextarea() {
    var ta = $('cfg-var-text');
    if (!ta) return;
    ta.value = dumpText(data);
    ta.placeholder = view === 'yaml' ? '# YAML' : '{ }';
    textDirty = false;
  }

  function refreshUi() {
    if (isTextView(view)) syncTextarea();
    else renderTree();
  }

  function reload() {
    load();
    textDirty = false;
    expandAllBranches(data, []);
    refreshUi();
  }

  function setView(next) {
    if (next !== 'json' && next !== 'yaml' && next !== 'tree') return;
    if (next === view) {
      applyViewUi();
      return;
    }

    var wasText = isTextView(view);
    if (wasText) {
      if (!commitTextarea()) return;
    }

    view = next;
    saveView();
    applyViewUi();

    if (view === 'tree') {
      expandAllBranches(data, []);
      renderTree();
    } else {
      syncTextarea();
    }
  }

  function applyViewUi() {
    document.querySelectorAll('.var-view-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-view') === view;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.var-view').forEach(function (pane) {
      var paneId = pane.getAttribute('data-viewpane');
      var on = paneId === 'text' ? isTextView(view) : paneId === view;
      pane.classList.toggle('active', on);
      if (on) pane.removeAttribute('hidden');
      else pane.setAttribute('hidden', '');
    });
  }

  function toggleExpand(path) {
    var k = pathKey(path);
    expanded[k] = !isExpanded(path);
    renderTree();
  }

  function isExpanded(path) {
    var k = pathKey(path);
    if (Object.prototype.hasOwnProperty.call(expanded, k)) return !!expanded[k];
    return true;
  }

  function folderIconSvg(open) {
    if (open) {
      return (
        '<svg class="var-tree-folder" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
        '<path fill="#f3d27a" stroke="#8a6a1a" stroke-width="1.2" d="M2.5 10h19v8.2A1.8 1.8 0 0 1 19.7 20H4.3A1.8 1.8 0 0 1 2.5 18.2V10z"/>' +
        '<path fill="#e8b84a" stroke="#8a6a1a" stroke-width="1.2" d="M2.5 9.2h8.2l1.3 1.4H21.5V9.2H2.5z"/>' +
        '<path fill="#d4a43a" stroke="#8a6a1a" stroke-width="1.2" d="M2.5 6.8h6.4l1.4 1.5H2.5V6.8z"/>' +
        '</svg>'
      );
    }
    return (
      '<svg class="var-tree-folder" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path fill="#f0c35a" stroke="#8a6a1a" stroke-width="1.2" d="M3 8h6.2l1.4 1.5H21v8.7A1.8 1.8 0 0 1 19.2 20H4.8A1.8 1.8 0 0 1 3 18.2V8z"/>' +
      '<path fill="#e8b84a" stroke="#8a6a1a" stroke-width="1.2" d="M3 6.5h6l1.2 1.4H3V6.5z"/>' +
      '</svg>'
    );
  }

  function arrayIconSvg() {
    return (
      '<svg class="var-tree-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
      '<path fill="none" stroke="#2a6fa8" stroke-width="1.8" stroke-linecap="round" d="M5 2.5v11M11 2.5v11"/>' +
      '</svg>'
    );
  }

  function leafIconSvg(type) {
    if (type === 'number') {
      return (
        '<svg class="var-tree-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
        '<text x="8" y="12" text-anchor="middle" fill="#3d8a4a" font-size="9" font-weight="800" font-family="Segoe UI,sans-serif">#</text>' +
        '</svg>'
      );
    }
    if (type === 'boolean') {
      return (
        '<svg class="var-tree-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
        '<path fill="none" stroke="#a85a3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.2 8.2l3 3 6.4-6.6"/>' +
        '</svg>'
      );
    }
    /* 文本 */
    return (
      '<svg class="var-tree-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
      '<path fill="none" stroke="#5a6a78" stroke-width="1.7" stroke-linecap="round" d="M3 4.2h10M3 8h7M3 11.8h9"/>' +
      '</svg>'
    );
  }

  function iconForValue(value, open) {
    var t = typeOfValue(value);
    if (t === 'object') return folderIconSvg(open);
    if (t === 'array') return arrayIconSvg();
    if (t === 'number') return leafIconSvg('number');
    if (t === 'boolean') return leafIconSvg('boolean');
    return leafIconSvg('string');
  }

  function findRowByPath(path) {
    var pk = pathKey(path);
    var rows = document.querySelectorAll('.var-tree-row');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-path') === pk) return rows[i];
    }
    return null;
  }

  function hideContextMenu() {
    var menu = $('var-tree-menu');
    if (menu) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
    }
    ctxTarget = null;
  }

  function showContextMenu(x, y, target) {
    var menu = $('var-tree-menu');
    if (!menu) return;
    ctxTarget = target;
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');

    var isBlank = target.kind === 'blank';
    var path = target.path || [];
    var node = isBlank ? data : getAt(data, path);
    var branch = isBlank || isBranch(node);
    var canRename = !isBlank && path.length > 0 && isPlainObject(getAt(data, parentPathOf(path)));
    var canDelete = !isBlank && path.length > 0;
    var canNew = branch;

    menu.querySelectorAll('[data-act]').forEach(function (btn) {
      var act = btn.getAttribute('data-act');
      var enable = true;
      if (act.indexOf('new-') === 0) enable = canNew;
      if (act === 'rename') enable = canRename;
      if (act === 'delete') enable = canDelete;
      btn.disabled = !enable;
      btn.classList.toggle('is-disabled', !enable);
    });

    var pad = 8;
    var mw = menu.offsetWidth || 160;
    var mh = menu.offsetHeight || 160;
    var left = Math.min(x, window.innerWidth - mw - pad);
    var top = Math.min(y, window.innerHeight - mh - pad);
    menu.style.left = Math.max(pad, left) + 'px';
    menu.style.top = Math.max(pad, top) + 'px';
  }

  function ensureParentObject(path) {
    if (!path.length) {
      if (!isPlainObject(data)) data = {};
      return data;
    }
    var node = getAt(data, path);
    if (isPlainObject(node) || Array.isArray(node)) return node;
    toast('只能在文件夹 / 数组 下新建');
    return null;
  }

  function addChild(parentPath, type) {
    var parent = ensureParentObject(parentPath);
    if (!parent) return;
    var value = defaultOfType(type);
    var newPath;
    if (Array.isArray(parent)) {
      parent.push(value);
      newPath = parentPath.concat([parent.length - 1]);
    } else {
      var key = uniqueKey(parent, keyBaseForType(type));
      parent[key] = value;
      newPath = parentPath.concat([key]);
    }
    expanded[pathKey(parentPath)] = true;
    renamingPath = isPlainObject(getAt(data, parentPathOf(newPath))) ? newPath : null;
    selectedPathKey = pathKey(newPath);
    persist();
    renderTree();
    if (renamingPath) focusRename(newPath);
  }

  function focusRename(path) {
    requestAnimationFrame(function () {
      var row = findRowByPath(path);
      var input = row && row.querySelector('.var-tree-name-input');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function renameNode(path, nextName) {
    if (!path.length) return;
    var parent = getAt(data, parentPathOf(path));
    if (!isPlainObject(parent)) {
      toast('数组下标不可重命名');
      renamingPath = null;
      renderTree();
      return;
    }
    var oldKey = path[path.length - 1];
    var name = String(nextName || '').trim();
    if (!name) {
      renamingPath = null;
      renderTree();
      return;
    }
    if (name === String(oldKey)) {
      renamingPath = null;
      renderTree();
      return;
    }
    if (Object.prototype.hasOwnProperty.call(parent, name)) {
      toast('同级已存在同名键');
      focusRename(path);
      return;
    }
    var val = parent[oldKey];
    delete parent[oldKey];
    parent[name] = val;
    /* remap expanded keys under this node */
    var oldPrefix = pathKey(path);
    var newPrefix = pathKey(parentPathOf(path).concat([name]));
    var nextExpanded = {};
    Object.keys(expanded).forEach(function (k) {
      if (k === oldPrefix || k.indexOf(oldPrefix + '\0') === 0) {
        nextExpanded[newPrefix + k.slice(oldPrefix.length)] = expanded[k];
      } else {
        nextExpanded[k] = expanded[k];
      }
    });
    expanded = nextExpanded;
    remapMetaPrefix(oldPrefix, newPrefix);
    renamingPath = null;
    selectedPathKey = newPrefix;
    persist();
    renderTree();
  }

  function deleteNode(path) {
    if (!path.length) return;
    if (!deleteAt(data, path)) return;
    deleteMetaPrefix(pathKey(path));
    renamingPath = null;
    selectedPathKey = null;
    persist();
    renderTree();
  }

  function moveNode(fromPath, toParentPath, beforeKey) {
    if (!fromPath.length) return false;
    if (pathEqual(fromPath, toParentPath)) return false;
    if (isAncestorPath(fromPath, toParentPath)) return false;

    var oldMetaPrefix = pathKey(fromPath);
    var value = getAt(data, fromPath);
    if (value === undefined) return false;

    var toParent = toParentPath.length ? getAt(data, toParentPath) : data;
    if (!isBranch(toParent)) return false;

    /* detach */
    var fromParent = getAt(data, parentPathOf(fromPath));
    var fromKey = fromPath[fromPath.length - 1];
    if (Array.isArray(fromParent)) {
      var fi = Number(fromKey);
      value = fromParent.splice(fi, 1)[0];
      /* adjust beforeKey if same parent array */
      if (Array.isArray(toParent) && pathEqual(parentPathOf(fromPath), toParentPath) && beforeKey != null) {
        var bi = Number(beforeKey);
        if (!isNaN(bi) && bi > fi) beforeKey = bi - 1;
      }
    } else if (isPlainObject(fromParent)) {
      delete fromParent[fromKey];
    } else {
      return false;
    }

    /* attach */
    if (Array.isArray(toParent)) {
      var insertAt = toParent.length;
      if (beforeKey != null && beforeKey !== '') {
        var idx = Number(beforeKey);
        if (!isNaN(idx)) insertAt = Math.max(0, Math.min(toParent.length, idx));
      }
      toParent.splice(insertAt, 0, value);
      expanded[pathKey(toParentPath)] = true;
      selectedPathKey = pathKey(toParentPath.concat([insertAt]));
    } else {
      var keyName = String(fromKey);
      if (Object.prototype.hasOwnProperty.call(toParent, keyName)) {
        keyName = uniqueKey(toParent, keyName);
      }
      /* rebuild with order: insert before beforeKey */
      if (beforeKey != null && beforeKey !== '' && Object.prototype.hasOwnProperty.call(toParent, beforeKey)) {
        var ordered = {};
        Object.keys(toParent).forEach(function (k) {
          if (k === String(beforeKey)) ordered[keyName] = value;
          ordered[k] = toParent[k];
        });
        /* clear and assign */
        Object.keys(toParent).forEach(function (k) {
          delete toParent[k];
        });
        Object.keys(ordered).forEach(function (k) {
          toParent[k] = ordered[k];
        });
      } else {
        toParent[keyName] = value;
      }
      expanded[pathKey(toParentPath)] = true;
      selectedPathKey = pathKey(toParentPath.concat([keyName]));
    }

    if (selectedPathKey != null) {
      remapMetaPrefix(oldMetaPrefix, selectedPathKey);
    }
    persist();
    renderTree();
    return true;
  }

  function decodePathAttr(raw) {
    if (raw == null || raw === '') return [];
    return String(raw).split('\0');
  }

  function clearDropMarks() {
    document.querySelectorAll('.var-tree-row.is-drop-into, .var-tree-row.is-drop-before, .var-tree-row.is-drop-after').forEach(function (el) {
      el.classList.remove('is-drop-into', 'is-drop-before', 'is-drop-after');
    });
    var root = $('var-tree');
    if (root) root.classList.remove('is-drop-root');
  }

  function onDragStart(e, path) {
    if (!path.length) {
      e.preventDefault();
      return;
    }
    dragState = { path: path.slice() };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pathKey(path));
    var row = e.currentTarget;
    if (row && row.classList) row.classList.add('is-dragging');
  }

  function onDragEnd() {
    dragState = null;
    clearDropMarks();
    document.querySelectorAll('.var-tree-row.is-dragging').forEach(function (el) {
      el.classList.remove('is-dragging');
    });
  }

  function dropZoneForEvent(row, e) {
    var rect = row.getBoundingClientRect();
    var y = e.clientY - rect.top;
    var ratio = y / Math.max(rect.height, 1);
    var path = decodePathAttr(row.getAttribute('data-path'));
    var node = getAt(data, path);
    if (isBranch(node)) {
      if (ratio < 0.25) return { mode: 'before', path: path };
      if (ratio > 0.75) return { mode: 'after', path: path };
      return { mode: 'into', path: path };
    }
    if (ratio < 0.5) return { mode: 'before', path: path };
    return { mode: 'after', path: path };
  }

  function applyDrop(zone) {
    if (!dragState || !zone) return;
    var from = dragState.path;
    var targetPath = zone.path;
    if (pathEqual(from, targetPath) || isAncestorPath(from, targetPath)) return;

    if (zone.mode === 'into') {
      moveNode(from, targetPath, null);
      return;
    }

    var parent = parentPathOf(targetPath);
    var key = targetPath[targetPath.length - 1];
    if (zone.mode === 'before') {
      moveNode(from, parent, key);
      return;
    }
    /* after: insert before next sibling, or append */
    var parentNode = parent.length ? getAt(data, parent) : data;
    var keys = childKeys(parentNode);
    var idx = -1;
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]) === String(key)) {
        idx = i;
        break;
      }
    }
    var beforeKey = idx >= 0 && idx + 1 < keys.length ? keys[idx + 1] : null;
    moveNode(from, parent, beforeKey);
  }

  function bindRowDrag(row, path) {
    row.draggable = path.length > 0;
    row.addEventListener('dragstart', function (e) {
      if (e.target && e.target.closest && e.target.closest('input,button,textarea,select')) {
        e.preventDefault();
        return;
      }
      onDragStart(e, path);
    });
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', function (e) {
      if (!dragState) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDropMarks();
      var zone = dropZoneForEvent(row, e);
      if (zone.mode === 'into') row.classList.add('is-drop-into');
      else if (zone.mode === 'before') row.classList.add('is-drop-before');
      else row.classList.add('is-drop-after');
    });
    row.addEventListener('dragleave', function () {
      row.classList.remove('is-drop-into', 'is-drop-before', 'is-drop-after');
    });
    row.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var zone = dropZoneForEvent(row, e);
      applyDrop(zone);
      onDragEnd();
    });
  }

  function appendMetaFields(row, path) {
    var m = getMeta(path);
    var registered = macroKeyForPath(path);
    var displayName = isLegacyMacroVarName(m.varName) ? '' : m.varName || '';

    var varInput = document.createElement('input');
    varInput.type = 'text';
    varInput.className = 'var-tree-extra var-tree-varname tq-input';
    varInput.placeholder = '变量名（给 AI）';
    varInput.title = '给 AI 看的变量名；注册键：' + registered;
    varInput.value = displayName;
    varInput.spellcheck = false;
    varInput.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    varInput.addEventListener('change', function () {
      writeMetaField(path, 'varName', varInput.value.trim());
    });
    varInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        varInput.blur();
      }
    });
    row.appendChild(varInput);

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'var-tree-macro-copy';
    copyBtn.title = '复制注册键 ' + registered;
    copyBtn.setAttribute('aria-label', '复制注册键');
    copyBtn.textContent = '{}';
    copyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(registered).then(
          function () {
            toast('已复制 ' + registered);
          },
          function () {},
        );
      }
    });
    row.appendChild(copyBtn);

    var commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.className = 'var-tree-extra var-tree-comment tq-input';
    commentInput.placeholder = '注释';
    commentInput.title = '注释';
    commentInput.value = m.comment || '';
    commentInput.spellcheck = false;
    commentInput.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    commentInput.addEventListener('change', function () {
      writeMetaField(path, 'comment', commentInput.value);
    });
    commentInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commentInput.blur();
      }
    });
    row.appendChild(commentInput);
  }

  function renderNode(parentEl, value, path, keyLabel, depth, isLast, ancestorLast) {
    var li = document.createElement('li');
    li.className = 'var-tree-node' + (isLast ? ' is-last' : '');
    li.setAttribute('role', 'treeitem');

    var branch = isBranch(value);
    var open = branch && isExpanded(path);
    var pk = pathKey(path);
    var isRenaming = renamingPath && pathEqual(renamingPath, path);

    var row = document.createElement('div');
    row.className = 'var-tree-row' + (selectedPathKey === pk ? ' is-selected' : '');
    row.setAttribute('data-path', pk);
    row.style.setProperty('--depth', String(depth));

    var guides = document.createElement('span');
    guides.className = 'var-tree-guides';
    guides.setAttribute('aria-hidden', 'true');
    var guideHtml = '';
    for (var d = 0; d < depth; d++) {
      if (d === depth - 1) {
        guideHtml += '<span class="var-guide-elbow">' + (isLast ? '└──' : '├──') + '</span>';
      } else {
        guideHtml += '<span class="var-guide-rail">' + (ancestorLast[d] ? '&nbsp;&nbsp;&nbsp;&nbsp;' : '│&nbsp;&nbsp;&nbsp;') + '</span>';
      }
    }
    guides.innerHTML = guideHtml;
    row.appendChild(guides);

    if (branch) {
      var twist = document.createElement('button');
      twist.type = 'button';
      twist.className = 'var-tree-twist' + (open ? ' is-open' : '');
      twist.setAttribute('aria-label', open ? '折叠' : '展开');
      twist.innerHTML =
        '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="currentColor" d="M8.2 6.2h11.6L14 15.4 8.2 6.2z"/>' +
        '</svg>';
      twist.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleExpand(path.slice());
      });
      row.appendChild(twist);
    } else {
      var spacer = document.createElement('span');
      spacer.className = 'var-tree-twist-spacer';
      row.appendChild(spacer);
    }

    var icon = document.createElement('span');
    icon.className = 'var-tree-icon';
    icon.innerHTML = iconForValue(value, open);
    row.appendChild(icon);

    if (isRenaming) {
      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'var-tree-name-input tq-input';
      nameInput.value = String(keyLabel);
      nameInput.spellcheck = false;
      nameInput.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          renameNode(path, nameInput.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          renamingPath = null;
          renderTree();
        }
      });
      nameInput.addEventListener('blur', function () {
        if (renamingPath && pathEqual(renamingPath, path)) {
          renameNode(path, nameInput.value);
        }
      });
      row.appendChild(nameInput);
    } else {
      var nameEl = document.createElement('span');
      nameEl.className = 'var-tree-name' + (branch ? ' is-folder' : '');
      if (Array.isArray(value)) nameEl.classList.add('is-array');
      nameEl.textContent = String(keyLabel);
      row.appendChild(nameEl);
    }

    if (branch) {
      var meta = document.createElement('span');
      meta.className = 'var-tree-meta';
      if (Array.isArray(value)) meta.textContent = '[' + value.length + ']';
      else meta.textContent = '{' + Object.keys(value).length + '}';
      row.appendChild(meta);

      if (Array.isArray(value)) {
        var arrInput = document.createElement('input');
        arrInput.type = 'text';
        arrInput.className = 'var-tree-value tq-input';
        arrInput.value = formatValueInput(value);
        arrInput.spellcheck = false;
        arrInput.placeholder = '[1, 2]';
        arrInput.addEventListener('click', function (e) {
          e.stopPropagation();
        });
        arrInput.addEventListener('change', function () {
          var next = classifyValueInput(arrInput.value);
          setAt(data, path, next);
          if (Array.isArray(next)) expanded[pathKey(path)] = true;
          persist();
          renderTree();
        });
        arrInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            arrInput.blur();
          }
        });
        row.appendChild(arrInput);
        appendMetaFields(row, path);
      }
    } else if (typeof value === 'boolean') {
      var boolSel = document.createElement('select');
      boolSel.className = 'var-tree-value var-tree-value-select';
      ;[
        { v: 'true', t: 'true' },
        { v: 'false', t: 'false' },
      ].forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.v;
        opt.textContent = item.t;
        if (String(value) === item.v) opt.selected = true;
        boolSel.appendChild(opt);
      });
      boolSel.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      boolSel.addEventListener('change', function () {
        setAt(data, path, boolSel.value === 'true');
        persist();
        renderTree();
      });
      row.appendChild(boolSel);
      appendMetaFields(row, path);
    } else {
      var valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.className = 'var-tree-value tq-input';
      valInput.value = formatValueInput(value);
      valInput.spellcheck = false;
      valInput.placeholder = '文本 / 数字 / [数组]';
      valInput.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      valInput.addEventListener('change', function () {
        var next = classifyValueInput(valInput.value);
        setAt(data, path, next);
        if (Array.isArray(next)) expanded[pathKey(path)] = true;
        persist();
        renderTree();
      });
      valInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          valInput.blur();
        }
      });
      row.appendChild(valInput);
      appendMetaFields(row, path);
    }

    row.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('input,button,select')) return;
      if (branch) toggleExpand(path.slice());
      else {
        renamingPath = path.slice();
        renderTree();
        focusRename(path);
      }
    });

    row.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('button,input,select')) return;
      selectedPathKey = pk;
      document.querySelectorAll('.var-tree-row.is-selected').forEach(function (el) {
        el.classList.remove('is-selected');
      });
      row.classList.add('is-selected');
    });

    row.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      selectedPathKey = pk;
      document.querySelectorAll('.var-tree-row.is-selected').forEach(function (el) {
        el.classList.remove('is-selected');
      });
      row.classList.add('is-selected');
      showContextMenu(e.clientX, e.clientY, { kind: 'node', path: path.slice() });
    });

    bindRowDrag(row, path);
    li.appendChild(row);

    if (branch && open) {
      var kids = document.createElement('ul');
      kids.className = 'var-tree-children';
      kids.setAttribute('role', 'group');
      var keys = childKeys(value);
      keys.forEach(function (k, i) {
        var childLast = i === keys.length - 1;
        renderNode(kids, value[k], path.concat([k]), k, depth + 1, childLast, ancestorLast.concat([isLast]));
      });
      li.appendChild(kids);
    }

    parentEl.appendChild(li);
  }

  function renderTree() {
    var root = $('var-tree');
    var empty = $('var-tree-empty');
    if (!root) return;
    root.innerHTML = '';

    if (!isPlainObject(data)) data = {};

    var keys = Object.keys(data);
    var emptyData = keys.length === 0;
    if (empty) empty.hidden = !emptyData;

    var ul = document.createElement('ul');
    ul.className = 'var-tree-root';
    ul.setAttribute('role', 'group');

    keys.forEach(function (k, i) {
      renderNode(ul, data[k], [k], k, 0, i === keys.length - 1, []);
    });
    root.appendChild(ul);

    if (renamingPath) focusRename(renamingPath);
  }

  function onMenuClick(act) {
    var target = ctxTarget;
    hideContextMenu();
    if (!target) return;
    var path = target.path || [];
    var parentPath = target.kind === 'blank' ? [] : path;

    if (act === 'new-object') {
      addChild(parentPath, 'object');
      return;
    }
    if (act === 'new-value') {
      addChild(parentPath, 'value');
      return;
    }
    if (act === 'new-boolean') {
      addChild(parentPath, 'boolean');
      return;
    }
    if (act === 'rename') {
      if (!path.length) return;
      renamingPath = path.slice();
      renderTree();
      focusRename(path);
      return;
    }
    if (act === 'delete') {
      deleteNode(path);
    }
  }

  function onEnter() {
    reload();
  }

  function bind() {
    view = loadView();
    applyViewUi();
    reload();
    if (ensureDefaultVariables()) refreshUi();

    document.querySelectorAll('.var-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view'));
      });
    });

    var ta = $('cfg-var-text');
    if (ta) {
      ta.addEventListener('input', function () {
        textDirty = true;
      });
      ta.addEventListener('blur', function () {
        if (!textDirty) return;
        if (commitTextarea()) syncTextarea();
      });
    }

    var tree = $('var-tree');
    if (tree) {
      tree.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, { kind: 'blank', path: [] });
      });
      tree.addEventListener('dragover', function (e) {
        if (!dragState) return;
        e.preventDefault();
        clearDropMarks();
        tree.classList.add('is-drop-root');
      });
      tree.addEventListener('drop', function (e) {
        if (!dragState) return;
        e.preventDefault();
        moveNode(dragState.path, [], null);
        onDragEnd();
      });
    }

    var menu = $('var-tree-menu');
    if (menu) {
      menu.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn || btn.disabled) return;
        onMenuClick(btn.getAttribute('data-act'));
      });
    }

    document.addEventListener('click', function (e) {
      var menuEl = $('var-tree-menu');
      if (!menuEl || !menuEl.classList.contains('open')) return;
      if (menuEl.contains(e.target)) return;
      hideContextMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideContextMenu();
    });
  }

  window.天青_settings_variable = {
    bind: bind,
    onEnter: onEnter,
    reload: reload,
    get: function () {
      return clone(data);
    },
    set: function (next) {
      if (next == null || typeof next !== 'object' || Array.isArray(next)) return;
      data = clone(next);
      expandAllBranches(data, []);
      persist();
      refreshUi();
    },
    /** 叶子列表：供提示词「变量列表」词条生成 */
    listLeaves: function () {
      if (!hydrated) load();
      syncAllRegisteredKeys();
      var out = [];
      function pushLeaf(path, value) {
        if (!path || !path.length) return;
        var m = getMeta(path);
        var varName = isLegacyMacroVarName(m.varName) ? '' : String(m.varName || '').trim();
        out.push({
          path: path.slice(),
          label: String(path[path.length - 1]),
          varName: varName,
          macro: macroKeyForPath(path),
          comment: m.comment || '',
          value: value,
        });
      }
      if (!isPlainObject(data)) return out;
      Object.keys(data).forEach(function (key) {
        var v = data[key];
        var p = [key];
        if (isPlainObject(v) || Array.isArray(v)) {
          walkValueNodes(v, p, pushLeaf);
        } else {
          pushLeaf(p, v);
        }
      });
      return out;
    },
  };
})();
