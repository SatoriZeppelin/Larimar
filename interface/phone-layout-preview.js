/**
 * 主屏布局设置 · 迷你手机预渲染预览
 * 对外：window.天青_phone_layout_preview
 */
(function () {
  var WALLPAPER = 'https://files.catbox.moe/sbg8r1.jpg';

  function getApps() {
    var appsApi = window.天青_phone_apps;
    if (!appsApi) return [];
    return appsApi.resolveList ? appsApi.resolveList() : appsApi.list || [];
  }

  function previewIconHtml(id, layout) {
    if (!window.天青_phone_apps) return '';
    return window.天青_phone_apps.iconHtml(id, 'preview-' + layout + '-' + id);
  }

  function dockHtml(layout) {
    return getApps()
      .map(function (app) {
        return (
          '<span class="phone-layout-preview__app">' +
          '<span class="phone-layout-preview__app-icon phone-layout-preview__app-icon--' +
          app.id +
          '">' +
          previewIconHtml(app.id, layout) +
          '</span>' +
          '<span class="phone-layout-preview__app-label">' +
          app.label +
          '</span></span>'
        );
      })
      .join('');
  }

  function clockHtml(layout) {
    if (layout === 'topleft-stacked') {
      return (
        '<span class="phone-layout-preview__clock phone-layout-preview__clock--stacked">' +
        '<span class="phone-layout-preview__date">第1天 星期一</span>' +
        '<span class="phone-layout-preview__hour">16</span>' +
        '<span class="phone-layout-preview__minute">00</span></span>'
      );
    }
    if (layout === 'topleft-compact') {
      return (
        '<span class="phone-layout-preview__clock phone-layout-preview__clock--compact">' +
        '<span class="phone-layout-preview__time">16:00</span>' +
        '<span class="phone-layout-preview__date">第1天 星期一</span></span>'
      );
    }
    return (
      '<span class="phone-layout-preview__clock phone-layout-preview__clock--center">' +
      '<span class="phone-layout-preview__time">16:00</span>' +
      '<span class="phone-layout-preview__date">第1天 星期一</span></span>'
    );
  }

  function screenHtml(layout) {
    return (
      '<span class="phone-layout-preview__screen">' +
      '<span class="phone-layout-preview__island" aria-hidden="true"></span>' +
      '<span class="phone-layout-preview__status">' +
      '<span class="phone-layout-preview__status-time">16:00</span>' +
      '<span class="phone-layout-preview__status-icons" aria-hidden="true">' +
      '<svg width="10" height="7" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="0.8" fill="currentColor"/>' +
      '<rect x="5" y="5.5" width="3" height="6.5" rx="0.8" fill="currentColor"/>' +
      '<rect x="10" y="3" width="3" height="9" rx="0.8" fill="currentColor"/>' +
      '<rect x="15" y="0" width="3" height="12" rx="0.8" fill="currentColor" opacity=".35"/></svg>' +
      '<svg width="14" height="6" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.2" stroke="currentColor" fill="none" opacity=".45"/>' +
      '<rect x="2.2" y="2.2" width="16.8" height="8.6" rx="2" fill="currentColor"/></svg>' +
      '</span></span>' +
      clockHtml(layout) +
      '<span class="phone-layout-preview__dock">' +
      dockHtml(layout) +
      '</span>' +
      '<span class="phone-layout-preview__home-bar" aria-hidden="true"></span>' +
      '</span>'
    );
  }

  function mount() {
    document.querySelectorAll('.phone-layout-preview[data-layout]').forEach(function (el) {
      var layout = el.getAttribute('data-layout') || 'center';
      el.innerHTML = screenHtml(layout);
      el.style.setProperty('--phone-layout-wallpaper', "url('" + WALLPAPER + "')");
    });
  }

  window.天青_phone_layout_preview = {
    mount: mount,
  };
})();
