/**
 * 手机 App 定义与 iOS 风格图标
 * 对外：window.天青_phone_apps
 */
(function () {
  /** iOS 风格图标内 SVG（嵌入 .tq-phone-app-icon 容器） */
  var ICONS = {
    line:
      '<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="64" height="64" rx="14" fill="#06C755"/>' +
      '<path fill="#fff" d="M32 14c-11.6 0-21 7.4-21 16.5 0 8.1 7.2 14.9 17 16.2.66.14 1.56.43 1.79.99.2.48.13 1.24.06 1.73l-.29 1.74c-.09.55-.44 2.15 1.88 1.17 2.32-.98 12.5-7.36 17.05-12.6C50.8 36.2 53 32.5 53 30.5 53 21.4 43.6 14 32 14z"/>' +
      '<text x="32" y="33.5" text-anchor="middle" fill="#06C755" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="800" letter-spacing="-0.4">LINE</text>' +
      '</svg>',
    twitter:
      '<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="64" height="64" rx="14" fill="#1DA1F2"/>' +
      '<path fill="#fff" d="M48.2 22.4c-1.1.5-2.3.8-3.5.9 1.3-.8 2.2-2 2.7-3.5-1.2.7-2.5 1.2-3.9 1.5-1.1-1.2-2.8-2-4.6-2-3.5 0-6.3 2.8-6.3 6.3 0 .5.1 1 .2 1.4-5.2-.3-9.9-2.8-13-6.6-.5.9-.8 2-.8 3.1 0 2.2 1.1 4.1 2.8 5.2-1 0-2-.3-2.8-.8v.1c0 3.1 2.2 5.6 5.1 6.2-.5.1-1.1.2-1.7.2-.4 0-.8 0-1.2-.1.8 2.5 3.1 4.3 5.9 4.4-2.2 1.7-4.9 2.7-7.8 2.7-.5 0-1 0-1.5-.1 2.8 1.8 6.1 2.8 9.7 2.8 11.6 0 18-9.6 18-18v-.8c1.2-.9 2.2-2 3-3.2z"/>' +
      '</svg>',
    x:
      '<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="64" height="64" rx="14" fill="#000"/>' +
      '<path fill="#fff" transform="translate(20 20)" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' +
      '</svg>',
    agency:
      '<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="tq-ag-grad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient></defs>' +
      '<rect width="64" height="64" rx="14" fill="url(#tq-ag-grad)"/>' +
      '<text x="32" y="43" text-anchor="middle" fill="#fff" font-family="PingFang SC,Microsoft YaHei,Helvetica Neue,sans-serif" font-size="30" font-weight="700">務</text>' +
      '</svg>',
    twitch:
      '<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="64" height="64" rx="14" fill="#9146FF"/>' +
      '<path fill="#fff" d="M18.5 14 14 19.2v28.6h9.8V54l5.9-6.2h7.6L49 35.6V14H18.5zm27.3 20.2-5.5 5.8H33.7l-5.9 6.2v-6.2h-7.6V17.2h25.6v17z"/>' +
      '<path fill="#9146FF" d="M37.2 21.5h3.5v10.5H37.2zm-9.5 0h3.5v10.5H27.7z"/>' +
      '</svg>',
  };

  var APPS = [
    { id: 'line', label: 'LINE', title: 'LINE', desc: '与天青的 LINE 私聊将在这里显示。' },
    { id: 'twitter', label: 'Twitter', title: 'Twitter', desc: '动态与时间线将在这里显示。' },
    { id: 'agency', label: '事务所', title: '事务所', desc: '名气与任务数据将在这里显示。' },
    { id: 'twitch', label: 'Twitch', title: 'Twitch', desc: '直播与回放将在这里显示。' },
  ];

  /** young = 小资历(X) · old = 老资历(Twitter) */
  function getSeniority() {
    if (window.天青_settings && window.天青_settings.getPhoneSeniority) {
      return window.天青_settings.getPhoneSeniority();
    }
    return 'old';
  }

  function isYoung() {
    return getSeniority() === 'young';
  }

  function resolveApp(app) {
    if (!app || app.id !== 'twitter') return app;
    if (!isYoung()) return app;
    return {
      id: app.id,
      label: 'X',
      title: 'X',
      desc: app.desc,
      iconKey: 'x',
    };
  }

  function resolveList() {
    return APPS.map(resolveApp);
  }

  function iconHtml(id, uid) {
    var key = id;
    if (id === 'twitter' && isYoung()) key = 'x';
    var svg = ICONS[key] || '';
    if (!svg) return '';
    if (key === 'agency' && uid) {
      var gradId = 'tq-ag-grad-' + uid;
      svg = svg.replace(/tq-ag-grad/g, gradId);
    }
    return svg;
  }

  function get(id) {
    for (var i = 0; i < APPS.length; i++) {
      if (APPS[i].id === id) return resolveApp(APPS[i]);
    }
    return null;
  }

  window.天青_phone_apps = {
    list: APPS,
    resolveList: resolveList,
    iconHtml: iconHtml,
    get: get,
    getSeniority: getSeniority,
  };
})();
