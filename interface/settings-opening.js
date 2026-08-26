/**
 * 通用设置 · 开局设置：开局列表增删改排
 * 默认折叠为 2:3 封面图，点击展开细节
 * 对外：window.天青_settings_opening
 */
(function () {
  var expandedId = null;
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function api() {
    return window.天青_opening_api;
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function confirmDialog(msg, onOk) {
    if (window.天青_settings && window.天青_settings.confirm) {
      window.天青_settings.confirm(msg, onOk);
      return;
    }
    if (window.confirm(msg) && onOk) onOk();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var RAW_PLACEHOLDER =
    '请在此处输入开局文本，开局文本遵从以下格式\n' +
    '<summernight>\n' +
    '    <summernight_maintext>\n' +
    '        正文内容\n' +
    '    </summernight_maintext>\n' +
    '\n' +
    '    <summernight_branches>\n' +
    '        分支选项\n' +
    '    </summernight_branches>\n' +
    '\n' +
    '    <summernight_snapshots>\n' +
    '        快照信息（当前对话轮快照）\n' +
    '    </summernight_snapshots>\n' +
    '\n' +
    '</summernight>';

  function coverHintText(op) {
    var bg = (op && op.coverBgId) || '';
    var expr = (op && op.coverExpr) || '';
    if (!bg && !expr) return '封面：正文中尚未解析到地点/表情';
    if (bg && expr) return '封面：' + bg + ' · ' + expr;
    if (bg) return '封面：' + bg;
    return '封面表情：' + expr;
  }

  function updateStat() {
    var el = $('opening-panel-stat');
    if (!el || !api()) return;
    var list = api().list();
    var playable = 0;
    list.forEach(function (op) {
      if (op && !op.placeholder && op.raw) playable += 1;
    });
    el.textContent = playable + '/' + list.length + ' 个可开局';
  }

  function posterHtml(op, i) {
    var thumbBg = api().coverUrl(op) || '';
    var thumbSp = api().spriteUrl(op) || '';
    return (
      '<button type="button" class="opening-set-poster" data-act="toggle" aria-label="' +
      escapeHtml((op.title || '开局') + (op.subtitle ? '，' + op.subtitle : '')) +
      '">' +
      '<span class="opening-set-face"' +
      (thumbBg ? ' style="background-image:url(&quot;' + escapeHtml(thumbBg) + '&quot;)"' : '') +
      '>' +
      (thumbSp
        ? '<img class="opening-set-sprite" src="' + escapeHtml(thumbSp) + '" alt="" draggable="false" />'
        : '') +
      '</span>' +
      '<span class="opening-set-idx">' +
      (i + 1) +
      '</span>' +
      (op.subtitle
        ? '<span class="opening-set-badge">' + escapeHtml(op.subtitle) + '</span>'
        : '') +
      '<span class="opening-set-caption">' +
      '<span class="opening-set-title">' +
      escapeHtml(op.title || '未命名开局') +
      '</span>' +
      '</span>' +
      '</button>'
    );
  }

  function bodyHtml(op, i, n) {
    return (
      '<div class="opening-set-body">' +
      '<div class="opening-set-body-bar">' +
      '<div class="opening-set-body-titles">' +
      '<strong class="opening-set-body-title">' +
      escapeHtml(op.title || '未命名开局') +
      '</strong>' +
      '<span class="opening-set-body-sub">' +
      escapeHtml(op.subtitle || '') +
      '</span>' +
      '</div>' +
      '<div class="opening-set-tools">' +
      '<button type="button" class="opening-set-tool" data-act="up" title="上移" aria-label="上移"' +
      (i === 0 ? ' disabled' : '') +
      '>↑</button>' +
      '<button type="button" class="opening-set-tool" data-act="down" title="下移" aria-label="下移"' +
      (i === n - 1 ? ' disabled' : '') +
      '>↓</button>' +
      '<button type="button" class="opening-set-tool is-danger" data-act="remove" title="删除" aria-label="删除">删除</button>' +
      '<button type="button" class="opening-set-tool" data-act="toggle" title="收起" aria-label="收起">收起</button>' +
      '</div>' +
      '</div>' +
      '<label class="opening-set-field">' +
      '<span>标题</span>' +
      '<input type="text" class="tq-input" data-field="title" value="' +
      escapeHtml(op.title || '') +
      '" autocomplete="off" spellcheck="false" />' +
      '</label>' +
      '<label class="opening-set-field">' +
      '<span>副标题</span>' +
      '<input type="text" class="tq-input" data-field="subtitle" value="' +
      escapeHtml(op.subtitle || '') +
      '" autocomplete="off" spellcheck="false" />' +
      '</label>' +
      '<p class="tq-hint opening-set-cover-hint" data-cover-hint>' +
      escapeHtml(coverHintText(op)) +
      '</p>' +
      '<label class="opening-set-field opening-set-field--block">' +
      '<span>开局正文</span>' +
      '<textarea class="user-desc opening-set-raw" data-field="raw" spellcheck="false" autocomplete="off" placeholder="' +
      escapeHtml(RAW_PLACEHOLDER).replace(/\n/g, '&#10;') +
      '">' +
      escapeHtml(op.raw || '') +
      '</textarea>' +
      '</label>' +
      '</div>'
    );
  }

  function renderList() {
    var root = $('opening-settings-list');
    if (!root || !api()) return;
    var list = api().list();
    root.innerHTML = '';
    root.classList.toggle('has-open', !!expandedId);

    if (!list.length) {
      root.innerHTML = '<p class="tq-hint opening-list-empty">暂无开局，请点击「新增开局」</p>';
      updateStat();
      return;
    }

    list.forEach(function (op, i) {
      var open = expandedId === op.id;
      var card = document.createElement('article');
      card.className = 'opening-set-card' + (open ? ' is-open' : '');
      card.dataset.id = op.id;
      card.setAttribute('aria-expanded', open ? 'true' : 'false');
      card.innerHTML = posterHtml(op, i) + (open ? bodyHtml(op, i, list.length) : '');
      root.appendChild(card);
    });

    updateStat();
  }

  function refreshPoster(card, op) {
    if (!card || !op || !api()) return;
    var face = card.querySelector('.opening-set-face');
    var title = card.querySelector('.opening-set-title');
    var badge = card.querySelector('.opening-set-badge');
    var bodyTitle = card.querySelector('.opening-set-body-title');
    var bodySub = card.querySelector('.opening-set-body-sub');
    if (face) {
      var url = api().coverUrl(op);
      face.style.backgroundImage = url ? 'url("' + url + '")' : '';
      var img = face.querySelector('.opening-set-sprite');
      var sp = api().spriteUrl(op);
      if (sp) {
        if (!img) {
          img = document.createElement('img');
          img.className = 'opening-set-sprite';
          img.alt = '';
          img.draggable = false;
          face.appendChild(img);
        }
        img.src = sp;
      } else if (img) {
        img.remove();
      }
    }
    if (title) title.textContent = op.title || '未命名开局';
    if (bodyTitle) bodyTitle.textContent = op.title || '未命名开局';
    if (bodySub) bodySub.textContent = op.subtitle || '';
    var hint = card.querySelector('[data-cover-hint]');
    if (hint) hint.textContent = coverHintText(op);
    if (badge) {
      var sub = String(op.subtitle || '').trim();
      if (sub) {
        badge.hidden = false;
        badge.textContent = sub;
        badge.classList.remove('is-ready');
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
    } else if (String(op.subtitle || '').trim()) {
      var poster = card.querySelector('.opening-set-poster');
      if (poster) {
        var b = document.createElement('span');
        b.className = 'opening-set-badge';
        b.textContent = op.subtitle;
        var caption = poster.querySelector('.opening-set-caption');
        if (caption) poster.insertBefore(b, caption);
        else poster.appendChild(b);
      }
    }
  }

  function patchFromCard(card) {
    if (!card || !api()) return;
    var id = card.dataset.id;
    var patch = {};
    var title = card.querySelector('[data-field="title"]');
    var subtitle = card.querySelector('[data-field="subtitle"]');
    var raw = card.querySelector('[data-field="raw"]');
    if (title) patch.title = String(title.value || '').trim() || '未命名开局';
    if (subtitle) patch.subtitle = String(subtitle.value || '');
    if (raw) patch.raw = String(raw.value || '');
    /* 无正文则视为占位 */
    if (raw) patch.placeholder = !String(patch.raw || '').trim();
    var next = api().update(id, patch);
    updateStat();
    refreshPoster(card, next || api().get(id));
  }

  function bind() {
    if (bound) return;
    bound = true;

    var addBtn = $('btn-opening-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (!api()) return;
        api().add();
        expandedId = null;
        renderList();
        toast('已新增开局');
      });
    }

    var resetBtn = $('btn-opening-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        confirmDialog('将开局列表恢复为默认 7 项？当前自定义会丢失。', function () {
          if (!api()) return;
          api().resetDefaults();
          expandedId = null;
          renderList();
          toast('已恢复默认开局');
        });
      });
    }

    var list = $('opening-settings-list');
    if (list) {
      list.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn || !list.contains(btn)) return;
        var card = btn.closest('.opening-set-card');
        if (!card) return;
        var id = card.dataset.id;
        var act = btn.getAttribute('data-act');

        if (act === 'toggle') {
          expandedId = expandedId === id ? null : id;
          renderList();
          return;
        }
        if (act === 'up') {
          api().move(id, -1);
          renderList();
          return;
        }
        if (act === 'down') {
          api().move(id, 1);
          renderList();
          return;
        }
        if (act === 'remove') {
          if ((api().list() || []).length <= 1) {
            toast('至少保留一个开局');
            return;
          }
          confirmDialog('删除这个开局？', function () {
            if (!api().remove(id)) {
              toast('至少保留一个开局');
              return;
            }
            if (expandedId === id) expandedId = null;
            renderList();
            toast('已删除开局');
          });
        }
      });

      list.addEventListener('input', function (e) {
        var field = e.target && e.target.closest ? e.target.closest('[data-field]') : null;
        if (!field) return;
        var card = field.closest('.opening-set-card');
        if (card) patchFromCard(card);
      });

      list.addEventListener('change', function (e) {
        var field = e.target && e.target.closest ? e.target.closest('[data-field]') : null;
        if (!field) return;
        var card = field.closest('.opening-set-card');
        if (card) patchFromCard(card);
      });
    }
  }

  function onEnter() {
    expandedId = null;
    renderList();
  }

  window.天青_settings_opening = {
    bind: bind,
    onEnter: onEnter,
    renderList: renderList,
  };
})();
