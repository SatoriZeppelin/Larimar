/**
 * 系统设置 · 正则页（绑定当前预设的 regexScripts）
 * 对外：window.天青_settings_regex
 */
(function () {
  var expandedId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function presetApi() {
    return window.天青_settings_preset;
  }

  function working() {
    var api = presetApi();
    if (api && api.getWorking) return api.getWorking();
    return window.天青_preset ? window.天青_preset.load() : null;
  }

  function markDirty() {
    var api = presetApi();
    if (api && api.markDirty) api.markDirty();
  }

  function scriptsOf(p) {
    if (!p) return [];
    if (!Array.isArray(p.regexScripts)) p.regexScripts = [];
    return p.regexScripts;
  }

  function findIndex(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return i;
    }
    return -1;
  }

  function findScript(p, id) {
    var list = scriptsOf(p);
    var i = findIndex(list, id);
    return i < 0 ? null : list[i];
  }

  function updateMeta(p) {
    var nameEl = $('regex-panel-name');
    var statEl = $('regex-panel-stat');
    var list = scriptsOf(p);
    var on = 0;
    list.forEach(function (s) {
      if (s && !s.disabled) on += 1;
    });
    if (nameEl) nameEl.textContent = (p && p.name) || '未命名预设';
    if (statEl) statEl.textContent = on + '/' + list.length + ' 条正则已启用';
  }

  function placementSummary(script) {
    if (window.天青_regex && window.天青_regex.placementSummary) {
      return window.天青_regex.placementSummary(script);
    }
    return '';
  }

  function previewText(script) {
    return String((script && script.findRegex) || '').replace(/\s+/g, ' ').trim();
  }

  function writeFromBody(card) {
    if (!card) return false;
    var p = working();
    var script = findScript(p, card.dataset.id);
    if (!script) return false;
    var changed = false;

    var nameInput = card.querySelector('[data-field="scriptName"]');
    var findInput = card.querySelector('[data-field="findRegex"]');
    var replaceInput = card.querySelector('[data-field="replaceString"]');
    var trimInput = card.querySelector('[data-field="trimStrings"]');

    if (nameInput) {
      var nextName = String(nameInput.value || '').trim() || '未命名正则';
      if (nextName !== script.scriptName) {
        script.scriptName = nextName;
        changed = true;
      }
    }
    if (findInput) {
      var nextFind = String(findInput.value || '');
      if (nextFind !== script.findRegex) {
        script.findRegex = nextFind;
        changed = true;
      }
    }
    if (replaceInput) {
      var nextRep = String(replaceInput.value || '');
      if (nextRep !== script.replaceString) {
        script.replaceString = nextRep;
        changed = true;
      }
    }
    if (trimInput) {
      var nextTrim = String(trimInput.value || '')
        .split(/\r?\n/)
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean);
      if (JSON.stringify(nextTrim) !== JSON.stringify(script.trimStrings || [])) {
        script.trimStrings = nextTrim;
        changed = true;
      }
    }

    var places = [];
    card.querySelectorAll('[data-place]').forEach(function (box) {
      if (box.checked) places.push(Number(box.getAttribute('data-place')));
    });
    if (JSON.stringify(places) !== JSON.stringify(script.placement || [])) {
      script.placement = places;
      changed = true;
    }

    if (!changed) return false;

    updateMeta(p);
    var title = card.querySelector('.regex-card-title');
    var preview = card.querySelector('.regex-card-preview');
    var badge = card.querySelector('.regex-place');
    if (title) {
      title.textContent = script.scriptName;
      title.title = script.scriptName;
    }
    if (preview) {
      var pv = previewText(script);
      preview.textContent = pv;
      preview.hidden = !pv;
      preview.title = pv;
    }
    if (badge) badge.textContent = placementSummary(script);
    return true;
  }

  function syncFromBody(card) {
    if (writeFromBody(card)) markDirty();
  }

  function flushOpen() {
    var list = $('regex-list');
    if (!list) return;
    list.querySelectorAll('.regex-card').forEach(function (card) {
      if (card.querySelector('[data-field]') && writeFromBody(card)) markDirty();
    });
  }

  function renderList() {
    var list = $('regex-list');
    var empty = $('regex-list-empty');
    var svg = window.天青_svg;
    if (!list) return;
    var p = working();
    if (!p) return;
    var entries = scriptsOf(p);
    list.innerHTML = '';
    if (empty) empty.style.display = entries.length ? 'none' : '';
    updateMeta(p);

    entries.forEach(function (entry, index) {
      var open = String(expandedId) === String(entry.id);
      var li = document.createElement('li');
      li.className =
        'regex-card' + (entry.disabled ? ' is-off' : '') + (open ? ' is-open' : '');
      li.dataset.id = entry.id || String(index);

      var top = document.createElement('div');
      top.className = 'regex-card-top';

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
      title.textContent = entry.scriptName || '未命名正则';
      title.title = title.textContent;

      var badge = document.createElement('span');
      badge.className = 'regex-place';
      badge.textContent = placementSummary(entry);

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
      if (svg) svg.mount(chevron, svg.chevron);

      hit.appendChild(idx);
      hit.appendChild(main);
      hit.appendChild(chevron);

      var side = document.createElement('div');
      side.className = 'regex-card-side';

      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'preset-switch' + (!entry.disabled ? ' is-on' : '');
      sw.title = entry.disabled ? '已关闭' : '已启用';
      sw.setAttribute('data-act', 'toggle');
      sw.setAttribute('aria-pressed', entry.disabled ? 'false' : 'true');

      side.appendChild(sw);
      top.appendChild(hit);
      top.appendChild(side);
      li.appendChild(top);

      var body = document.createElement('div');
      body.className = 'regex-card-body';
      if (!open) body.hidden = true;

      var places = entry.placement || [];
      function placeChecked(n) {
        return places.indexOf(n) >= 0 ? ' checked' : '';
      }

      body.innerHTML =
        '<label class="preset-field">' +
        '<span class="preset-field-label">名称</span>' +
        '<input type="text" class="tq-input" data-field="scriptName" autocomplete="off" spellcheck="false" />' +
        '</label>' +
        '<label class="preset-field">' +
        '<span class="preset-field-label">查找正则</span>' +
        '<textarea class="tq-input regex-code" data-field="findRegex" rows="3" spellcheck="false"></textarea>' +
        '</label>' +
        '<label class="preset-field">' +
        '<span class="preset-field-label">替换为</span>' +
        '<textarea class="tq-input regex-code" data-field="replaceString" rows="3" spellcheck="false"></textarea>' +
        '</label>' +
        '<label class="preset-field">' +
        '<span class="preset-field-label">裁剪（每行一条）</span>' +
        '<textarea class="tq-input regex-code" data-field="trimStrings" rows="2" spellcheck="false"></textarea>' +
        '</label>' +
        '<div class="preset-field">' +
        '<span class="preset-field-label">作用于</span>' +
        '<div class="regex-places">' +
        '<label class="regex-place-opt"><input type="checkbox" data-place="1"' +
        placeChecked(1) +
        ' /><span>用户输入</span></label>' +
        '<label class="regex-place-opt"><input type="checkbox" data-place="2"' +
        placeChecked(2) +
        ' /><span>AI回复</span></label>' +
        '<label class="regex-place-opt"><input type="checkbox" data-place="3"' +
        placeChecked(3) +
        ' /><span>斜杠命令</span></label>' +
        '<label class="regex-place-opt"><input type="checkbox" data-place="5"' +
        placeChecked(5) +
        ' /><span>世界书</span></label>' +
        '<label class="regex-place-opt"><input type="checkbox" data-place="6"' +
        placeChecked(6) +
        ' /><span>推理</span></label>' +
        '</div>' +
        '</div>' +
        '<div class="preset-card-footer">' +
        '<button type="button" class="preset-delete-btn" data-act="delete">删除正则</button>' +
        '</div>';

      var nameInput = body.querySelector('[data-field="scriptName"]');
      var findInput = body.querySelector('[data-field="findRegex"]');
      var replaceInput = body.querySelector('[data-field="replaceString"]');
      var trimInput = body.querySelector('[data-field="trimStrings"]');
      if (nameInput) nameInput.value = entry.scriptName || '';
      if (findInput) findInput.value = entry.findRegex || '';
      if (replaceInput) replaceInput.value = entry.replaceString || '';
      if (trimInput) trimInput.value = (entry.trimStrings || []).join('\n');

      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function addScript() {
    var p = working();
    if (!p) return;
    var list = scriptsOf(p);
    var id =
      window.天青_preset && window.天青_preset.normalizeRegexScript
        ? window.天青_preset.normalizeRegexScript(
            {
              scriptName: '新正则',
              findRegex: '',
              replaceString: '',
              placement: [2],
              disabled: false,
            },
            list.length,
          ).id
        : 'rx_' + Date.now().toString(36);
    var script =
      window.天青_preset && window.天青_preset.normalizeRegexScript
        ? window.天青_preset.normalizeRegexScript(
            {
              id: id,
              scriptName: '新正则',
              findRegex: '',
              replaceString: '',
              placement: [2],
              disabled: false,
            },
            list.length,
          )
        : {
            id: id,
            scriptName: '新正则',
            findRegex: '',
            replaceString: '',
            trimStrings: [],
            placement: [2],
            disabled: false,
            markdownOnly: false,
            promptOnly: false,
            runOnEdit: true,
            substituteRegex: 0,
            minDepth: null,
            maxDepth: null,
          };
    list.push(script);
    expandedId = script.id;
    markDirty();
    renderList();
    toast('已新增正则');
  }

  function onListClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn || btn.disabled) return;
    var row = btn.closest('.regex-card');
    if (!row) return;
    var act = btn.getAttribute('data-act');
    var p = working();
    if (!p) return;
    var script = findScript(p, row.dataset.id);

    if (act === 'expand') {
      flushOpen();
      expandedId = String(expandedId) === String(row.dataset.id) ? null : row.dataset.id;
      renderList();
      return;
    }
    if (act === 'toggle') {
      if (!script) return;
      script.disabled = !script.disabled;
      markDirty();
      renderList();
      return;
    }
    if (act === 'delete') {
      if (!window.confirm('确定删除该正则？')) return;
      p.regexScripts = scriptsOf(p).filter(function (s) {
        return String(s.id) !== String(row.dataset.id);
      });
      if (String(expandedId) === String(row.dataset.id)) expandedId = null;
      markDirty();
      renderList();
      toast('已删除正则');
    }
  }

  function onListChange(e) {
    var card = e.target && e.target.closest ? e.target.closest('.regex-card') : null;
    if (!card) return;
    if (
      e.target.getAttribute('data-field') ||
      e.target.getAttribute('data-place') != null
    ) {
      syncFromBody(card);
    }
  }

  function bind() {
    var btnAdd = $('btn-regex-add');
    var btnSave = $('btn-regex-save');
    var list = $('regex-list');
    if (btnAdd) btnAdd.addEventListener('click', addScript);
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        if (window.天青_settings_preset && window.天青_settings_preset.saveChanges) {
          window.天青_settings_preset.saveChanges();
        }
      });
    }
    if (list) {
      list.addEventListener('click', onListClick);
      list.addEventListener('change', onListChange);
      list.addEventListener('input', onListChange);
      list.addEventListener('blur', onListChange, true);
    }
    renderList();
  }

  window.天青_settings_regex = {
    bind: bind,
    renderList: renderList,
    flushOpen: flushOpen,
  };
})();
