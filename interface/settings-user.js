/**
 * 通用设置 · 用户设定
 * 对外：window.天青_settings_user
 */
(function () {
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function api() {
    return window.天青_persona;
  }

  function syncCount() {
    var el = $('cfg-user-desc');
    var out = $('cfg-user-desc-count');
    if (!out) return;
    out.textContent = String(el ? el.value.length : 0);
  }

  function syncDepthVisibility() {
    var pos = $('cfg-user-position');
    var wrap = $('cfg-user-depth-wrap');
    if (!wrap || !pos) return;
    wrap.hidden = pos.value !== 'depth';
  }

  function readForm() {
    return {
      name: ($('cfg-user-name') || {}).value || '',
      description: ($('cfg-user-desc') || {}).value || '',
      position: ($('cfg-user-position') || {}).value || 'prompt',
      depth: ($('cfg-user-depth') || {}).value || 4,
    };
  }

  function fillForm(d) {
    d = d || (api() && api().load()) || {};
    var name = $('cfg-user-name');
    var desc = $('cfg-user-desc');
    var pos = $('cfg-user-position');
    var depth = $('cfg-user-depth');
    if (name) name.value = d.name || '';
    if (desc) desc.value = d.description || '';
    if (pos) pos.value = d.position || 'prompt';
    if (depth) depth.value = String(d.depth != null ? d.depth : 4);
    syncCount();
    syncDepthVisibility();
  }

  function commit() {
    if (!api()) return;
    api().save(readForm());
    if (window.天青_settings && window.天青_settings.syncKeyLabels) {
      window.天青_settings.syncKeyLabels();
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    if (!api()) return;
    fillForm(api().load());

    ['cfg-user-name', 'cfg-user-desc', 'cfg-user-position', 'cfg-user-depth'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var ev = id === 'cfg-user-desc' || id === 'cfg-user-name' ? 'input' : 'change';
      el.addEventListener(ev, function () {
        if (id === 'cfg-user-desc') syncCount();
        if (id === 'cfg-user-position') syncDepthVisibility();
        commit();
      });
    });
  }

  function onEnter() {
    if (api()) fillForm(api().load());
  }

  window.天青_settings_user = {
    bind: bind,
    onEnter: onEnter,
    fillForm: fillForm,
    commit: commit,
  };
})();
