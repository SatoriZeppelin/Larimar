/**
 * 系统设置 · 图片：三级类型切换 + 缩略图网格 + 大图预览
 * 数据源：天青_backgrounds / 天青_cg / 天青_expressions / 天青_stickers
 * 对外：window.天青_settings_image
 */
(function () {
  var TYPE_META = {
    bg: { map: '天青_backgrounds', fit: 'cover' },
    cg: { map: '天青_cg', fit: 'cover' },
    sprite: { map: '天青_expressions', fit: 'contain' },
    sticker: { map: '天青_stickers', fit: 'contain' },
  };

  var currentType = 'bg';
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function entriesOf(type) {
    var meta = TYPE_META[type];
    if (!meta) return [];
    var map = window[meta.map];
    if (!map || typeof map !== 'object') return [];
    return Object.keys(map)
      .filter(function (k) {
        return map[k];
      })
      .map(function (k) {
        return { name: k, url: String(map[k]) };
      });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function closePreview() {
    var modal = $('img-preview-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    var img = $('img-preview-img');
    if (img) img.removeAttribute('src');
  }

  function openPreview(name, url, fit) {
    var modal = $('img-preview-modal');
    var title = $('img-preview-title');
    var img = $('img-preview-img');
    if (!modal || !img) return;
    if (title) title.textContent = name || '预览';
    img.alt = name || '';
    img.src = url;
    modal.setAttribute('data-fit', fit || 'cover');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function render() {
    var gallery = $('img-gallery');
    var empty = $('img-gallery-empty');
    if (!gallery) return;

    var meta = TYPE_META[currentType] || TYPE_META.bg;
    var list = entriesOf(currentType);
    gallery.setAttribute('data-fit', meta.fit);
    gallery.innerHTML = '';

    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    var frag = document.createDocumentFragment();
    list.forEach(function (item) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'img-card';
      card.setAttribute('role', 'listitem');
      card.title = item.name;
      card.innerHTML =
        '<span class="img-card-media">' +
        '<img alt="" loading="lazy" decoding="async" src="' +
        escapeHtml(item.url) +
        '" />' +
        '</span>' +
        '<span class="img-card-label">' +
        escapeHtml(item.name) +
        '</span>';
      card.addEventListener('click', function () {
        openPreview(item.name, item.url, meta.fit);
      });
      frag.appendChild(card);
    });
    gallery.appendChild(frag);
  }

  function setType(type) {
    if (!TYPE_META[type]) type = 'bg';
    currentType = type;
    document.querySelectorAll('.img-type-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-img-type') === type;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.querySelectorAll('.img-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setType(btn.getAttribute('data-img-type'));
      });
    });

    var closeBtn = $('btn-img-preview-close');
    if (closeBtn) closeBtn.addEventListener('click', closePreview);

    var modal = $('img-preview-modal');
    if (modal) {
      modal.querySelectorAll('[data-img-preview-close]').forEach(function (el) {
        el.addEventListener('click', closePreview);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var box = $('img-preview-modal');
      if (box && box.classList.contains('open')) closePreview();
    });

    render();
  }

  window.天青_settings_image = {
    bind: bind,
    render: render,
    setType: setType,
    openPreview: openPreview,
    closePreview: closePreview,
  };
})();
