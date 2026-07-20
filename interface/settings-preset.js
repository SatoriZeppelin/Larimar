/**
 * 系统设置 · 预设页
 * 对外：window.天青_settings_preset
 */
(function () {
  var expandedId = null;
  var drag = null;
  var LONG_PRESS_MS = 300;
  var MOVE_CANCEL_PX = 10;
  /** 编辑中的草稿；未点「保存更改」前不写 localStorage */
  var draft = null;
  var dirty = false;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function preset() {
    return window.天青_preset;
  }

  function cloneData(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function working() {
    var api = preset();
    if (!api) return null;
    if (!draft) draft = cloneData(api.load());
    return draft;
  }

  function updateSaveBtn() {
    var btn = $('btn-preset-save');
    if (btn) {
      btn.disabled = !dirty;
      btn.classList.toggle('is-dirty', !!dirty);
    }
    var btnRx = $('btn-regex-save');
    if (btnRx) {
      btnRx.disabled = !dirty;
      btnRx.classList.toggle('is-dirty', !!dirty);
    }
  }

  function markDirty() {
    dirty = true;
    updateSaveBtn();
  }

  function safeFileName(name) {
    return String(name || '天青预设')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 48);
  }

  function persist(p) {
    var api = preset();
    if (!api) return p;
    if (api.rebuildSystemPrompt) return api.rebuildSystemPrompt(p);
    api.save(p);
    return p;
  }

  function writeEntryFromBody(card) {
    if (!card) return false;
    var p = working();
    if (!p) return false;
    var entry = findEntry(p, card.dataset.id);
    if (!entry) return false;
    var changed = false;
    var nameInput = card.querySelector('[data-field="name"]');
    var roleSelect = card.querySelector('[data-field="role"]');
    var contentInput = card.querySelector('[data-field="content"]');
    if (nameInput) {
      var nextName = String(nameInput.value || '').trim() || entry.identifier || '未命名';
      if (nextName !== entry.name) {
        entry.name = nextName;
        changed = true;
      }
    }
    if (roleSelect) {
      var nextRole = roleSelect.value || 'system';
      if (nextRole !== (entry.role || 'system')) {
        entry.role = nextRole;
        changed = true;
      }
    }
    if (contentInput) {
      var nextContent = String(contentInput.value || '');
      if (nextContent !== (entry.content || '')) {
        entry.content = nextContent;
        if (entry.content.trim()) entry.marker = false;
        changed = true;
      }
    }
    if (!changed) return false;
    updatePanelMeta(p);
    var title = card.querySelector('.preset-card-title');
    var badge = card.querySelector('.preset-role');
    var preview = card.querySelector('.preset-card-preview');
    var hint = card.querySelector('.preset-field-hint');
    if (title) {
      title.textContent = entry.name || entry.identifier || '未命名';
      title.title = title.textContent;
    }
    if (badge) {
      badge.className = 'preset-role ' + roleClass(entry.role);
      badge.textContent = roleLabel(entry.role);
    }
    if (preview) {
      var pv = previewText(entry);
      preview.textContent = pv;
      preview.hidden = !pv;
      preview.title = pv;
    }
    if (hint) hint.textContent = roleHint(entry.role);
    return true;
  }

  function syncEntryFromBody(card) {
    if (writeEntryFromBody(card)) markDirty();
  }

  function flushOpenFields() {
    var list = $('preset-list');
    if (!list) return false;
    var changed = false;
    list.querySelectorAll('.preset-card').forEach(function (card) {
      if (card.querySelector('[data-field]') && writeEntryFromBody(card)) changed = true;
    });
    if (changed) markDirty();
    return changed;
  }

  function saveChanges() {
    var api = preset();
    if (!api) return;
    if (window.天青_settings_regex && window.天青_settings_regex.flushOpen) {
      window.天青_settings_regex.flushOpen();
    }
    flushOpenFields();
    var p = working();
    if (!p) return;
    if (!dirty) {
      toast('没有需要保存的更改');
      return;
    }
    persist(p);
    draft = cloneData(api.load());
    dirty = false;
    updateSaveBtn();
    updatePanelMeta(draft);
    if (window.天青_settings_regex && window.天青_settings_regex.renderList) {
      window.天青_settings_regex.renderList();
    }
    toast('预设已保存');
  }

  function askDeletePreset() {
    var api = preset();
    if (!api || !api.deletePreset) return;
    var p = api.load();
    var name = (p && p.name) || '未命名预设';
    var ask =
      window.天青_settings && window.天青_settings.confirm
        ? window.天青_settings.confirm
        : null;
    var run = function () {
      var result = api.deletePreset(p.id);
      draft = null;
      dirty = false;
      expandedId = null;
      updateSaveBtn();
      renderList();
      notifyRegex();
      var nextName = (result && result.current && result.current.name) || '未命名预设';
      toast('已删除「' + name + '」，当前为「' + nextName + '」');
    };
    if (ask) {
      ask('确定删除预设「' + name + '」吗？删除后不可恢复。', run);
    } else if (window.confirm('确定删除预设「' + name + '」吗？')) {
      run();
    }
  }

  /** 离开预设页：丢弃未保存草稿 */
  function onLeave() {
    closeSwitcher();
    if (!dirty && !draft) return;
    var hadDirty = dirty;
    draft = null;
    dirty = false;
    expandedId = null;
    updateSaveBtn();
    if (hadDirty) toast('未保存的更改已还原');
  }

  function onEnter() {
    if (!dirty) draft = null;
    renderList();
    updateSaveBtn();
    if (window.天青_settings_regex && window.天青_settings_regex.renderList) {
      window.天青_settings_regex.renderList();
    }
  }

  function notifyRegex() {
    if (window.天青_settings_regex && window.天青_settings_regex.renderList) {
      window.天青_settings_regex.renderList();
    }
  }

  function roleClass(role) {
    var r = String(role || 'system').toLowerCase();
    if (r === 'user') return 'is-user';
    if (r === 'assistant') return 'is-assistant';
    return 'is-system';
  }

  function roleLabel(role) {
    var r = String(role || 'system').toLowerCase();
    if (r === 'user') return '用户';
    if (r === 'assistant') return 'AI助手';
    return '系统';
  }

  function roleHint(role) {
    var r = String(role || 'system').toLowerCase();
    if (r === 'user') return '作为用户上下文发送';
    if (r === 'assistant') return '作为助手上下文发送';
    return '作为系统上下文发送';
  }

  function previewText(entry) {
    var raw = String((entry && entry.content) || '').replace(/\s+/g, ' ').trim();
    return raw;
  }

  function findIndex(entries, id) {
    for (var i = 0; i < entries.length; i++) {
      if (String(entries[i].id) === String(id)) return i;
    }
    return -1;
  }

  function findEntry(p, id) {
    var entries = Array.isArray(p.prompts) ? p.prompts : [];
    for (var i = 0; i < entries.length; i++) {
      if (String(entries[i].id) === String(id)) return entries[i];
    }
    return null;
  }

  function updatePanelMeta(p) {
    var nameEl = $('preset-panel-name');
    var statEl = $('preset-panel-stat');
    var entries = Array.isArray(p.prompts) ? p.prompts : [];
    var total = entries.length;
    var on = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].enabled !== false) on += 1;
    }
    if (nameEl) {
      nameEl.textContent = p.name || '未命名预设';
      nameEl.title = nameEl.textContent;
    }
    if (statEl) statEl.textContent = on + '/' + total + ' 个条目已启用';
    renderSwitcherMenu();
  }

  function closeSwitcher() {
    var root = $('preset-switcher');
    var menu = $('preset-switch-menu');
    var btn = $('btn-preset-switch');
    if (root) root.classList.remove('is-open');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openSwitcher() {
    renderSwitcherMenu();
    var root = $('preset-switcher');
    var menu = $('preset-switch-menu');
    var btn = $('btn-preset-switch');
    if (root) root.classList.add('is-open');
    if (menu) menu.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function toggleSwitcher() {
    var root = $('preset-switcher');
    if (root && root.classList.contains('is-open')) closeSwitcher();
    else openSwitcher();
  }

  function renderSwitcherMenu() {
    var api = preset();
    var list = $('preset-switch-list');
    if (!list || !api || !api.listPresets) return;
    var items = api.listPresets();
    list.innerHTML = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-switch-item' + (it.active ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', it.active ? 'true' : 'false');
      btn.dataset.id = it.id;
      btn.textContent = it.name || '未命名预设';
      btn.title = btn.textContent;
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function activatePreset(id) {
    var api = preset();
    if (!api || !api.switchPreset) return;
    var curId = api.getActiveId ? api.getActiveId() : '';
    if (String(curId) === String(id)) {
      closeSwitcher();
      return;
    }
    var hadDirty = dirty;
    draft = null;
    dirty = false;
    expandedId = null;
    updateSaveBtn();
    var next = api.switchPreset(id);
    closeSwitcher();
    if (!next) {
      toast('切换预设失败');
      return;
    }
    renderList();
    toast(
      (hadDirty ? '未保存的更改已还原，' : '') + '已启用「' + (next.name || '未命名预设') + '」',
    );
    notifyRegex();
  }

  function renderList() {
    var list = $('preset-list');
    var empty = $('preset-list-empty');
    var svg = window.天青_svg;
    if (!list) return;
    var p = working();
    if (!p) return;
    var entries = Array.isArray(p.prompts) ? p.prompts : [];
    list.innerHTML = '';
    if (empty) empty.style.display = entries.length ? 'none' : '';
    updatePanelMeta(p);

    entries.forEach(function (entry, index) {
      var open = String(expandedId) === String(entry.id);
      var li = document.createElement('li');
      li.className =
        'preset-card' +
        (entry.enabled === false ? ' is-off' : '') +
        (open ? ' is-open' : '');
      li.dataset.id = entry.id || String(index);

      var top = document.createElement('div');
      top.className = 'preset-card-top';

      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'preset-drag-handle';
      handle.title = '长按拖动排序';
      handle.setAttribute('aria-label', '长按拖动排序');
      if (svg) svg.mount(handle, svg.grip);

      var hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'preset-card-hit';
      hit.setAttribute('data-act', 'expand');
      hit.setAttribute('aria-expanded', open ? 'true' : 'false');

      var idx = document.createElement('span');
      idx.className = 'preset-card-index';
      idx.textContent = String(index + 1);

      var main = document.createElement('div');
      main.className = 'preset-card-main';

      var titleRow = document.createElement('div');
      titleRow.className = 'preset-card-title-row';

      var title = document.createElement('span');
      title.className = 'preset-card-title';
      title.textContent = entry.name || entry.identifier || '未命名';
      title.title = title.textContent;

      var badge = document.createElement('span');
      badge.className = 'preset-role ' + roleClass(entry.role);
      badge.textContent = roleLabel(entry.role);

      titleRow.appendChild(title);
      titleRow.appendChild(badge);
      main.appendChild(titleRow);

      var pv = previewText(entry);
      var preview = document.createElement('div');
      preview.className = 'preset-card-preview';
      preview.textContent = pv;
      preview.title = pv;
      preview.hidden = !pv;
      main.appendChild(preview);

      var chevron = document.createElement('span');
      chevron.className = 'preset-card-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      if (svg) svg.mount(chevron, svg.chevron);

      hit.appendChild(idx);
      hit.appendChild(main);
      hit.appendChild(chevron);

      var side = document.createElement('div');
      side.className = 'preset-card-side';

      var move = document.createElement('div');
      move.className = 'preset-move';

      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'preset-icon-btn';
      upBtn.title = '上移';
      upBtn.setAttribute('data-act', 'up');
      upBtn.disabled = index === 0;
      if (svg) svg.mount(upBtn, svg.arrowUp);

      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'preset-icon-btn';
      downBtn.title = '下移';
      downBtn.setAttribute('data-act', 'down');
      downBtn.disabled = index >= entries.length - 1;
      if (svg) svg.mount(downBtn, svg.arrowDown);

      move.appendChild(upBtn);
      move.appendChild(downBtn);

      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'preset-switch' + (entry.enabled !== false ? ' is-on' : '');
      sw.title = entry.enabled !== false ? '已启用' : '已关闭';
      sw.setAttribute('data-act', 'toggle');
      sw.setAttribute('aria-pressed', entry.enabled !== false ? 'true' : 'false');

      side.appendChild(move);
      side.appendChild(sw);
      top.appendChild(handle);
      top.appendChild(hit);
      top.appendChild(side);
      li.appendChild(top);

      var body = document.createElement('div');
      body.className = 'preset-card-body';
      if (!open) body.hidden = true;

      body.innerHTML =
        '<label class="preset-field">' +
        '<span class="preset-field-label">名称</span>' +
        '<input type="text" class="tq-input" data-field="name" autocomplete="off" spellcheck="false" />' +
        '</label>' +
        '<label class="preset-field">' +
        '<span class="preset-field-label">角色</span>' +
        '<select class="tq-select" data-field="role">' +
        '<option value="system">系统</option>' +
        '<option value="user">用户</option>' +
        '<option value="assistant">AI助手</option>' +
        '</select>' +
        '<span class="preset-field-hint"></span>' +
        '</label>' +
        '<label class="preset-field">' +
        '<span class="preset-field-label">内容</span>' +
        '<textarea class="tq-input preset-content" data-field="content" rows="8" spellcheck="false"></textarea>' +
        '</label>' +
        '<div class="preset-card-footer">' +
        '<button type="button" class="preset-delete-btn" data-act="delete">删除条目</button>' +
        '</div>';

      var nameInput = body.querySelector('[data-field="name"]');
      var roleSelect = body.querySelector('[data-field="role"]');
      var contentInput = body.querySelector('[data-field="content"]');
      var hint = body.querySelector('.preset-field-hint');
      if (nameInput) nameInput.value = entry.name || '';
      if (roleSelect) roleSelect.value = entry.role || 'system';
      if (contentInput) contentInput.value = entry.content || '';
      if (hint) hint.textContent = roleHint(entry.role);

      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function moveEntry(id, dir) {
    var p = working();
    if (!p) return;
    var entries = Array.isArray(p.prompts) ? p.prompts : [];
    var i = findIndex(entries, id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= entries.length) return;
    var tmp = entries[i];
    entries[i] = entries[j];
    entries[j] = tmp;
    p.prompts = entries;
    markDirty();
    renderList();
  }

  function deleteEntry(id) {
    if (!window.confirm('确定删除该条目？')) return;
    var p = working();
    if (!p) return;
    p.prompts = (p.prompts || []).filter(function (e) {
      return String(e.id) !== String(id);
    });
    if (String(expandedId) === String(id)) expandedId = null;
    markDirty();
    renderList();
    toast('已删除条目');
  }

  function makeEntryId() {
    return 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function addEntry() {
    var p = working();
    if (!p) return;
    if (!Array.isArray(p.prompts)) p.prompts = [];
    var id = makeEntryId();
    p.prompts.push({
      id: id,
      identifier: id,
      name: '新条目',
      role: 'system',
      content: '',
      enabled: true,
      marker: false,
      visible: true,
      system_prompt: true,
      depth: 0,
      position: 0,
    });
    expandedId = id;
    markDirty();
    renderList();
    toast('已新增条目');
    var list = $('preset-list');
    var card = list && list.querySelector('.preset-card[data-id="' + id + '"]');
    if (card && card.scrollIntoView) {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
    var cards = Array.prototype.slice.call(list.querySelectorAll('.preset-card:not(.is-dragging)'));
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
    var x = clientX - drag.offsetX;
    var y = clientY - drag.offsetY;
    card.style.left = x + 'px';
    card.style.top = y + 'px';
  }

  function beginDrag(card, pointerId, clientX, clientY) {
    var list = $('preset-list');
    if (!list || !card || !drag) return;
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
    var list = $('preset-list');
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

    var p = working();
    if (!p) return;
    var map = {};
    (p.prompts || []).forEach(function (entry) {
      map[String(entry.id)] = entry;
    });
    var next = [];
    list.querySelectorAll('.preset-card').forEach(function (el) {
      var entry = map[String(el.dataset.id)];
      if (entry) next.push(entry);
    });
    if (!next.length) return;
    p.prompts = next;
    markDirty();
    renderList();
  }

  function onDragPointerMove(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    var dy = Math.abs(e.clientY - drag.startY);
    var dx = Math.abs(e.clientX - drag.startX);
    if (!drag.active) {
      if (dy > MOVE_CANCEL_PX || dx > MOVE_CANCEL_PX) {
        clearDragTimer();
        finishDrag(false);
      }
      return;
    }
    e.preventDefault();
    var list = $('preset-list');
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
    var card = handle.closest('.preset-card');
    var list = $('preset-list');
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
    drag.timer = setTimeout(function () {
      if (!drag || drag.card !== card) return;
      beginDrag(card, e.pointerId, e.clientX, e.clientY);
    }, LONG_PRESS_MS);
  }

  function onListClick(e) {
    if (e.target && e.target.closest && e.target.closest('.preset-drag-handle')) return;
    var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn || btn.disabled) return;
    var row = btn.closest('.preset-card');
    if (!row) return;
    var act = btn.getAttribute('data-act');
    var p = working();
    if (!p) return;
    var entry = findEntry(p, row.dataset.id);

    if (act === 'expand') {
      flushOpenFields();
      expandedId = String(expandedId) === String(row.dataset.id) ? null : row.dataset.id;
      renderList();
      return;
    }
    if (act === 'toggle') {
      if (!entry) return;
      entry.enabled = entry.enabled === false;
      markDirty();
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
    if (act === 'delete') {
      deleteEntry(row.dataset.id);
    }
  }

  function onListChange(e) {
    var field = e.target && e.target.getAttribute ? e.target.getAttribute('data-field') : '';
    if (!field) return;
    var card = e.target.closest('.preset-card');
    if (!card) return;
    syncEntryFromBody(card);
  }

  function doExport() {
    try {
      flushOpenFields();
      var p = working();
      if (!p) return;
      var payload = {
        name: p.name || 'SummerNight Plus 默认',
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
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = safeFileName(payload.name) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
      toast('已导出预设');
    } catch (err) {
      console.warn('[天青 预设] export', err);
      toast(String((err && err.message) || err));
    }
  }

  function doImportFile(file) {
    var api = preset();
    if (!api || !file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result || '');
        var nameHint = String(file.name || '').replace(/\.json$/i, '');
        var merged = api.importAuto(text, { nameHint: nameHint });
        var n = (merged.prompts && merged.prompts.length) || 0;
        var rx = (merged.regexScripts && merged.regexScripts.length) || 0;
        draft = cloneData(api.load());
        dirty = false;
        expandedId = null;
        updateSaveBtn();
        renderList();
        notifyRegex();
        toast(
          '已解析预设「' +
            (merged.name || nameHint || '未命名') +
            '」' +
            (n ? '（' + n + ' 条提示词' : '') +
            (rx ? (n ? '，' : '（') + rx + ' 条正则' : '') +
            (n || rx ? '）' : ''),
        );
      } catch (err) {
        console.warn('[天青 预设] import', err);
        toast(String((err && err.message) || err));
      }
    };
    reader.onerror = function () {
      toast('读取文件失败');
    };
    reader.readAsText(file, 'utf-8');
  }

  function bind() {
    var svg = window.天青_svg;
    var importIcon = $('btn-preset-import-icon');
    var exportIcon = $('btn-preset-export-icon');
    if (svg && importIcon && !importIcon.querySelector('svg') && svg.importIcon) {
      svg.mount(importIcon, svg.importIcon);
    }
    if (svg && exportIcon && !exportIcon.querySelector('svg') && svg.exportIcon) {
      svg.mount(exportIcon, svg.exportIcon);
    }

    var btnSave = $('btn-preset-save');
    var btnAdd = $('btn-preset-add');
    var btnImport = $('btn-preset-import');
    var btnExport = $('btn-preset-export');
    var btnDelete = $('btn-preset-delete');
    var btnSwitch = $('btn-preset-switch');
    var switchList = $('preset-switch-list');
    var file = $('cfg-preset-file');
    var list = $('preset-list');

    if (btnSave) btnSave.addEventListener('click', saveChanges);
    if (btnAdd) btnAdd.addEventListener('click', addEntry);
    if (btnDelete) btnDelete.addEventListener('click', askDeletePreset);
    if (btnSwitch) {
      btnSwitch.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSwitcher();
      });
    }
    if (switchList) {
      switchList.addEventListener('click', function (e) {
        var item = e.target && e.target.closest ? e.target.closest('.preset-switch-item') : null;
        if (!item) return;
        e.preventDefault();
        activatePreset(item.dataset.id);
      });
    }
    document.addEventListener('click', function (e) {
      var root = $('preset-switcher');
      if (!root || !root.classList.contains('is-open')) return;
      if (e.target && root.contains(e.target)) return;
      closeSwitcher();
    });
    if (btnImport && file) {
      btnImport.addEventListener('click', function () {
        file.value = '';
        file.click();
      });
    }
    if (file) {
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (f) doImportFile(f);
      });
    }
    if (btnExport) btnExport.addEventListener('click', doExport);
    if (list) {
      list.addEventListener('pointerdown', onHandlePointerDown);
      list.addEventListener('contextmenu', function (e) {
        if (e.target && e.target.closest && e.target.closest('.preset-drag-handle')) {
          e.preventDefault();
        }
      });
      list.addEventListener('click', onListClick);
      list.addEventListener('change', onListChange);
      list.addEventListener('blur', onListChange, true);
      list.addEventListener('input', onListChange);
    }

    updateSaveBtn();
    renderList();
  }

  window.天青_settings_preset = {
    bind: bind,
    renderList: renderList,
    onLeave: onLeave,
    onEnter: onEnter,
    saveChanges: saveChanges,
    getWorking: working,
    markDirty: markDirty,
    isDirty: function () {
      return !!dirty;
    },
    /** 生成时用：有未保存草稿则带上当前编辑内容 */
    getRuntimePreset: function () {
      var api = preset();
      if (!api) return null;
      if (dirty) {
        flushOpenFields();
        return working();
      }
      return api.load();
    },
  };
})();
