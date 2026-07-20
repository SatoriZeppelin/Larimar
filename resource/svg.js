/**
 * SummerNight Plus · SVG 图标集中存放
 * 对外：window.天青_svg
 */
(function () {
  /** 设置齿轮（对话框右下角） */
  var GEAR =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.48.48 0 0 0 14 2h-4a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.49.49 0 0 0-.59.22L2.63 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.75 14.5a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.24.41.48.41h4c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.22.09.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>' +
    '</svg>';

  /**
   * 退出 / 关闭设置（log-out：右侧开口圆角框 + 右向箭头）
   */
  var EXIT =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
    '<polyline points="16 17 21 12 16 7"/>' +
    '<line x1="21" y1="12" x2="9" y2="12"/>' +
    '</svg>';

  /**
   * 柱状图（通用设置左侧）
   */
  var CHART =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<path d="M8 16v-3"/>' +
    '<path d="M12 16V8"/>' +
    '<path d="M16 16v-5"/>' +
    '</svg>';

  /**
   * 四横条列表（系统设置左侧）
   */
  var LIST =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M6 7h12"/>' +
    '<path d="M6 11h12"/>' +
    '<path d="M6 15h12"/>' +
    '<path d="M6 19h12"/>' +
    '</svg>';

  /** 角色设置（用户头像轮廓） */
  var USER =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="8" r="3.5"/>' +
    '<path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5"/>' +
    '</svg>';

  /** 调试设置（虫子） */
  var BUG =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 9V5a3 3 0 0 1 6 0v4"/>' +
    '<rect x="7" y="9" width="10" height="10" rx="5"/>' +
    '<path d="M12 13v4"/>' +
    '<path d="M5 12H3"/>' +
    '<path d="M21 12h-2"/>' +
    '<path d="M6 8L4 6"/>' +
    '<path d="M18 8l2-2"/>' +
    '<path d="M6 18l-2 2"/>' +
    '<path d="M18 18l2 2"/>' +
    '</svg>';

  /** 重置 / 刷新（顺时针圆弧箭头） */
  var REFRESH =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 12a9 9 0 1 1-2.64-6.36"/>' +
    '<polyline points="21 3 21 9 15 9"/>' +
    '</svg>';

  /** 确认 / 是（对勾） */
  var CHECK =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="4 12 10 18 20 6"/>' +
    '</svg>';

  /** 取消 / 否（叉） */
  var CROSS =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '</svg>';

  /** 显示密钥（眼睛） */
  var EYE =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>' +
    '<circle cx="12" cy="12" r="2.75" fill="currentColor" stroke="none"/>' +
    '</svg>';

  /** 隐藏密钥（眼睛 + 斜线） */
  var EYE_OFF =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>' +
    '<circle cx="12" cy="12" r="2.75" fill="currentColor" stroke="none"/>' +
    '<line x1="4" y1="4" x2="20" y2="20"/>' +
    '</svg>';

  /** 铅笔 / 编辑 */
  var PENCIL =
    '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 20h9"/>' +
    '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
    '</svg>';

  /** 向右展开 */
  var CHEVRON =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="9 6 15 12 9 18"/>' +
    '</svg>';

  /** 上移 */
  var ARROW_UP =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="6 14 12 8 18 14"/>' +
    '</svg>';

  /** 下移 */
  var ARROW_DOWN =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="6 10 12 16 18 10"/>' +
    '</svg>';

  /** 下拉倒三角（实心） */
  var CARET =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<path fill="currentColor" d="M6.2 9.2h11.6L12 16.4 6.2 9.2z"/>' +
    '</svg>';

  var GRIP =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M5 8h14"/>' +
    '<path d="M5 12h14"/>' +
    '<path d="M5 16h14"/>' +
    '</svg>';

  /** 调色盘 */
  var PALETTE =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="13.5" cy="6.5" r="2"/>' +
    '<circle cx="17.5" cy="10.5" r="2"/>' +
    '<circle cx="8.5" cy="7.5" r="2"/>' +
    '<circle cx="6.5" cy="12.5" r="2"/>' +
    '<path d="M12 22a8 8 0 0 1-8-8c0-4.5 4-10 8-10s5 2.5 5 6a3 3 0 0 1-3 3h-1a2 2 0 0 0-2 2c0 1.5 1.5 3 3 3z"/>' +
    '</svg>';

  /** 删除 / 垃圾桶 */
  var TRASH =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M8 6V4h8v2"/>' +
    '<path d="M19 6l-1 14H6L5 6"/>' +
    '<path d="M10 11v6"/>' +
    '<path d="M14 11v6"/>' +
    '</svg>';

  /** 问号 / 求救说明 */
  var HELP =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M9.6 9.2a2.6 2.6 0 0 1 5.05.9c0 1.55-1.35 2.15-2.15 2.7-.55.38-.9.8-.9 1.5"/>' +
    '<circle cx="12" cy="17.2" r="1.05" fill="currentColor" stroke="none"/>' +
    '</svg>';

  /** 导入预设（箭头向下入托盘） */
  var IMPORT =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v12"/>' +
    '<polyline points="7 11 12 16 17 11"/>' +
    '<path d="M4 21h16"/>' +
    '<path d="M4 21v-4"/>' +
    '<path d="M20 21v-4"/>' +
    '</svg>';

  /** 导出预设（箭头向上出托盘） */
  var EXPORT =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 16V4"/>' +
    '<polyline points="7 9 12 4 17 9"/>' +
    '<path d="M4 21h16"/>' +
    '<path d="M4 21v-4"/>' +
    '<path d="M20 21v-4"/>' +
    '</svg>';

  /** 工具栏锁定（闭锁；描边加粗，配合 CSS 黑色包边） */
  var LOCK =
    '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="5" y="11" width="14" height="10" rx="2"/>' +
    '<path d="M8 11V8a4 4 0 0 1 8 0v3"/>' +
    '</svg>';

  /** 工具栏解锁（开锁） */
  var UNLOCK =
    '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="5" y="11" width="14" height="10" rx="2"/>' +
    '<path d="M8 11V8a4 4 0 0 1 7.5-1.8"/>' +
    '</svg>';

  /** 快退：向左双箭头 */
  var REWIND =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="11 17 6 12 11 7"/>' +
    '<polyline points="18 17 13 12 18 7"/>' +
    '</svg>';

  /** 三级后退：向左三箭头（上一轮） */
  var TRIPLE_BACK =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="9 17 4 12 9 7"/>' +
    '<polyline points="15 17 10 12 15 7"/>' +
    '<polyline points="21 17 16 12 21 7"/>' +
    '</svg>';

  /** 后退：向左单箭头 */
  var STEP_BACK =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="15 18 9 12 15 6"/>' +
    '</svg>';

  /** 前进：向右单箭头 */
  var STEP_FWD =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="9 18 15 12 9 6"/>' +
    '</svg>';

  /** 快进：向右双箭头 */
  var FAST_FWD =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="6 17 11 12 6 7"/>' +
    '<polyline points="13 17 18 12 13 7"/>' +
    '</svg>';

  /** 自动前进：向右箭头 + 竖线 */
  var AUTO_FWD =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="7 18 13 12 7 6"/>' +
    '<line x1="17" y1="5" x2="17" y2="19"/>' +
    '</svg>';

  /** 对话日志：圆角纸张 + 三条横线 */
  var SCRIPT_PAGE =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
    '<rect x="5" y="3" width="14" height="18" rx="2.5"/>' +
    '<rect x="7.5" y="7.2" width="9" height="1.7" rx="0.85" fill="#1a2834"/>' +
    '<rect x="7.5" y="11.15" width="9" height="1.7" rx="0.85" fill="#1a2834"/>' +
    '<rect x="7.5" y="15.1" width="9" height="1.7" rx="0.85" fill="#1a2834"/>' +
    '</svg>';

  /** CG / 舞台切换：两个互指的圆弧箭头 */
  var SWAP =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>' +
    '<path d="M3 3v5h5"/>' +
    '<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>' +
    '<path d="M16 16h5v5"/>' +
    '</svg>';

  /** 手机悬浮钮（SF Symbols · iphone 线稿） */
  var PHONE =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="6.75" y="2.75" width="10.5" height="18.5" rx="2.75"/>' +
    '<line x1="10.25" y1="18.25" x2="13.75" y2="18.25"/>' +
    '</svg>';

  function mount(el, html) {
    if (!el || !html) return;
    el.innerHTML = html;
  }

  window.天青_svg = {
    gear: GEAR,
    exit: EXIT,
    chart: CHART,
    list: LIST,
    user: USER,
    bug: BUG,
    refresh: REFRESH,
    check: CHECK,
    cross: CROSS,
    eye: EYE,
    eyeOff: EYE_OFF,
    caret: CARET,
    pencil: PENCIL,
    chevron: CHEVRON,
    arrowUp: ARROW_UP,
    arrowDown: ARROW_DOWN,
    grip: GRIP,
    palette: PALETTE,
    trash: TRASH,
    help: HELP,
    importIcon: IMPORT,
    exportIcon: EXPORT,
    lock: LOCK,
    unlock: UNLOCK,
    rewind: REWIND,
    tripleBack: TRIPLE_BACK,
    stepBack: STEP_BACK,
    stepFwd: STEP_FWD,
    fastFwd: FAST_FWD,
    autoFwd: AUTO_FWD,
    scriptPage: SCRIPT_PAGE,
    swap: SWAP,
    phone: PHONE,
    mount: mount,
  };
})();
