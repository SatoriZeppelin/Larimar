/**
 * 设置面板：一级目录 + 左侧竖排二级目录
 * 规则：若某一级下没有二级目录按钮，则不显示二级侧栏。
 * 对外：window.天青_settings
 */
(function () {
  var UI_KEY = 'tq_plus_ui';
  var UI_DEFAULTS = {
    dlgOpacity: 100,
    dlgBorderColor: '#ffffff',
    dlgBorderAlpha: 16,
    dlgBgColor: '#0f141c',
    dlgBgAlpha: 48,
    dlgBlur: 16,
    textSize: 16,
    textShadow: 90,
    textTqColor: '#8dd4e0',
    textProducerColor: '#f2f5f8',
    textOtherColor: '#f2f5f8',
    autoEnterCg: true,
    disableTitleVideo: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.classList.remove('show');
    }, 2200);
  }

  function clampInt(n, min, max) {
    n = parseInt(n, 10);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var n = parseInt(h, 16);
    if (isNaN(n)) return { r: 15, g: 20, b: 28 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbaFrom(hex, alphaPct) {
    var rgb = hexToRgb(hex);
    var a = clampInt(alphaPct, 0, 100) / 100;
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
  }

  function setRangePct(rangeEl) {
    if (!rangeEl) return;
    var min = parseFloat(rangeEl.min) || 0;
    var max = parseFloat(rangeEl.max) || 100;
    var val = parseFloat(rangeEl.value);
    /* 圆钮可外溢：中心走满色带，分界直接用数值比例 */
    var pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    rangeEl.style.setProperty('--tq-pct', pct + '%');
  }

  function bindSliderPair(rangeId, numId, onChange) {
    var range = $(rangeId);
    var num = $(numId);
    if (!range || !num) return;

    function syncFromRange() {
      num.value = String(range.value);
      setRangePct(range);
      if (onChange) onChange();
    }

    function syncFromNum() {
      var v = clampInt(num.value, range.min, range.max);
      num.value = String(v);
      range.value = String(v);
      setRangePct(range);
      if (onChange) onChange();
    }

    range.addEventListener('input', syncFromRange);
    num.addEventListener('change', syncFromNum);
    num.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        syncFromNum();
        num.blur();
      }
    });
    setRangePct(range);
    window.addEventListener('resize', function () {
      setRangePct(range);
    });
  }

  /** X = 单字宽的一半；用于一级目录内边距与图标-文字间距 */
  function measureCharHalf(labelEl) {
    var cs = window.getComputedStyle(labelEl);
    var probe = document.createElement('span');
    probe.textContent = '字';
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;' +
      'font-size:' +
      cs.fontSize +
      ';font-family:' +
      cs.fontFamily +
      ';font-weight:' +
      cs.fontWeight +
      ';letter-spacing:' +
      cs.letterSpacing +
      ';';
    document.body.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    document.body.removeChild(probe);
    return w > 0 ? w / 2 : 8;
  }

  function sizeTabs() {
    document.querySelectorAll('.settings-tab').forEach(function (btn) {
      var label = btn.querySelector('.tab-label');
      var inner = btn.querySelector('.tab-inner');
      if (!label) return;
      var x = measureCharHalf(label);
      btn.style.setProperty('--tab-x', x + 'px');
      btn.style.width = 'auto';
      btn.style.aspectRatio = 'auto';
      if (inner) inner.style.gap = x + 'px';
    });
  }

  /** 假如目前没有二级目录就不需要显示二级目录 */
  function syncSubnavVisibility() {
    document.querySelectorAll('.settings-pane').forEach(function (pane) {
      var nav = pane.querySelector(':scope > .settings-subnav');
      var hasSubs = !!(nav && nav.querySelector('.settings-subtab'));
      pane.classList.toggle('no-subnav', !hasSubs);
      if (nav) nav.hidden = !hasSubs;
    });
  }

  var FADE_MS = 200;
  var fading = false;

  /** 内容区先淡出 → 换页 → 再淡入 */
  function withFade(target, run) {
    if (!target || fading) {
      run();
      return;
    }
    fading = true;
    target.classList.add('is-fading');
    setTimeout(function () {
      run();
      requestAnimationFrame(function () {
        target.classList.remove('is-fading');
        setTimeout(function () {
          fading = false;
        }, FADE_MS);
      });
    }, FADE_MS);
  }

  function showSub(paneRoot, subId, instant) {
    if (!paneRoot) return;
    var cur = paneRoot.querySelector('.settings-subtab.active');
    var prevSub = cur ? cur.getAttribute('data-sub') : '';
    if (prevSub === subId) return;

    if (prevSub === 'preset' && subId !== 'preset' && window.天青_settings_preset && window.天青_settings_preset.onLeave) {
      window.天青_settings_preset.onLeave();
    }

    function apply() {
      paneRoot.querySelectorAll('.settings-subtab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-sub') === subId);
      });
      paneRoot.querySelectorAll('.settings-subpane').forEach(function (pane) {
        pane.classList.toggle('active', pane.getAttribute('data-subpane') === subId);
      });
      if (subId === 'preset' && window.天青_settings_preset && window.天青_settings_preset.onEnter) {
        window.天青_settings_preset.onEnter();
      }
      if (subId === 'regex' && window.天青_settings_regex && window.天青_settings_regex.renderList) {
        window.天青_settings_regex.renderList();
      }
      if (subId === 'prompt' && window.天青_settings_prompt) {
        if (window.天青_settings_prompt.syncStatDataPrompt) {
          window.天青_settings_prompt.syncStatDataPrompt();
        } else if (window.天青_settings_prompt.renderList) {
          window.天青_settings_prompt.renderList();
        }
      }
      if (subId === 'variable' && window.天青_settings_variable && window.天青_settings_variable.onEnter) {
        window.天青_settings_variable.onEnter();
      }
      if (subId === 'user' && window.天青_settings_user && window.天青_settings_user.onEnter) {
        window.天青_settings_user.onEnter();
      }
      if (subId === 'gal') syncKeyLabels();
    }

    var content = paneRoot.querySelector(':scope > .settings-subcontent');
    if (instant || !content) apply();
    else withFade(content, apply);
  }

  function showTab(name, instant) {
    var cur = document.querySelector('.settings-tab.active');
    var prevTab = cur ? cur.getAttribute('data-tab') : '';
    if (prevTab === name) return;

    if (prevTab === 'system' && name !== 'system' && window.天青_settings_preset && window.天青_settings_preset.onLeave) {
      window.天青_settings_preset.onLeave();
    }

    function apply() {
      document.querySelectorAll('.settings-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
      });
      document.querySelectorAll('.settings-pane').forEach(function (pane) {
        pane.classList.toggle('active', pane.getAttribute('data-pane') === name);
      });
      syncSubnavVisibility();
    }

    var body = document.querySelector('#settings-panel .settings-body');
    var panelOpen = $('settings-panel') && $('settings-panel').classList.contains('open');
    if (instant || !panelOpen || !body) apply();
    else withFade(body, apply);
  }

  function loadUi() {
    try {
      var raw = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {};
      /* 兼容旧版：dlgOpacity 曾为 0~1 小数 */
      if (typeof raw.dlgOpacity === 'number' && raw.dlgOpacity > 0 && raw.dlgOpacity <= 1) {
        if (raw.dlgBgAlpha == null) raw.dlgBgAlpha = Math.round(raw.dlgOpacity * 100);
        raw.dlgOpacity = 100;
      }
      return Object.assign({}, UI_DEFAULTS, raw);
    } catch (e) {
      return Object.assign({}, UI_DEFAULTS);
    }
  }

  function saveUi(ui) {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch (e) {}
  }

  function readUiFromDom() {
    var autoCg = $('cfg-auto-enter-cg');
    var disableTitleVideo = $('cfg-disable-title-video');
    return {
      dlgOpacity: clampInt(($('cfg-dlg-opacity') || {}).value, 0, 100),
      dlgBorderColor: ($('cfg-dlg-border-color') || {}).value || UI_DEFAULTS.dlgBorderColor,
      dlgBorderAlpha: clampInt(($('cfg-dlg-border-alpha') || {}).value, 0, 100),
      dlgBgColor: ($('cfg-dlg-bg-color') || {}).value || UI_DEFAULTS.dlgBgColor,
      dlgBgAlpha: clampInt(($('cfg-dlg-bg-alpha') || {}).value, 0, 100),
      dlgBlur: clampInt(($('cfg-dlg-blur') || {}).value, 0, 40),
      textSize: clampInt(($('cfg-text-size') || {}).value, 12, 28),
      textShadow: clampInt(($('cfg-text-shadow') || {}).value, 0, 100),
      textTqColor: ($('cfg-text-tq-color') || {}).value || UI_DEFAULTS.textTqColor,
      textProducerColor: ($('cfg-text-producer-color') || {}).value || UI_DEFAULTS.textProducerColor,
      textOtherColor: ($('cfg-text-other-color') || {}).value || UI_DEFAULTS.textOtherColor,
      autoEnterCg: autoCg ? !!autoCg.checked : UI_DEFAULTS.autoEnterCg,
      disableTitleVideo: disableTitleVideo
        ? !!disableTitleVideo.checked
        : UI_DEFAULTS.disableTitleVideo,
    };
  }

  function fillUiDom(ui) {
    var map = [
      ['cfg-dlg-opacity', 'cfg-dlg-opacity-num', ui.dlgOpacity],
      ['cfg-dlg-border-alpha', 'cfg-dlg-border-alpha-num', ui.dlgBorderAlpha],
      ['cfg-dlg-bg-alpha', 'cfg-dlg-bg-alpha-num', ui.dlgBgAlpha],
      ['cfg-dlg-blur', 'cfg-dlg-blur-num', ui.dlgBlur],
      ['cfg-text-size', 'cfg-text-size-num', ui.textSize],
      ['cfg-text-shadow', 'cfg-text-shadow-num', ui.textShadow],
    ];
    map.forEach(function (row) {
      var r = $(row[0]);
      var n = $(row[1]);
      if (r) {
        r.value = String(row[2]);
        setRangePct(r);
      }
      if (n) n.value = String(row[2]);
    });
    var bc = $('cfg-dlg-border-color');
    var bg = $('cfg-dlg-bg-color');
    var tq = $('cfg-text-tq-color');
    var tp = $('cfg-text-producer-color');
    var to = $('cfg-text-other-color');
    var autoCg = $('cfg-auto-enter-cg');
    var disableTitleVideo = $('cfg-disable-title-video');
    if (bc) bc.value = ui.dlgBorderColor || UI_DEFAULTS.dlgBorderColor;
    if (bg) bg.value = ui.dlgBgColor || UI_DEFAULTS.dlgBgColor;
    if (tq) tq.value = ui.textTqColor || UI_DEFAULTS.textTqColor;
    if (tp) tp.value = ui.textProducerColor || UI_DEFAULTS.textProducerColor;
    if (to) to.value = ui.textOtherColor || UI_DEFAULTS.textOtherColor;
    if (autoCg) autoCg.checked = ui.autoEnterCg !== false;
    if (disableTitleVideo) disableTitleVideo.checked = !!ui.disableTitleVideo;
  }

  function syncKeyLabels() {
    var keys = window.天青_keys;
    var name = '';
    if (keys) name = String(keys.get('user') || keys.get('producer') || '').trim();
    var lab = $('cfg-label-producer');
    if (lab) {
      lab.textContent = name || (keys ? keys.macro('producer') + ' / ' + keys.macro('user') : '{{producer}} / {{user}}');
    }
    var previewProducer = document.querySelector('#dlg-preview .dlg-preview-text.is-producer');
    if (previewProducer) {
      var shown = name || (keys ? keys.macro('producer') : '{{producer}}');
      previewProducer.textContent = '这是一段' + shown + '的示例文本';
    }
  }

  function applyUi(ui) {
    var root = document.documentElement.style;
    /* 对话框透明度：整体强度，同时缩放背景/边框 alpha 与磨砂模糊，不隐文字 */
    var strength = clampInt(ui.dlgOpacity, 0, 100) / 100;
    var bgA = Math.round(clampInt(ui.dlgBgAlpha, 0, 100) * strength);
    var bdA = Math.round(clampInt(ui.dlgBorderAlpha, 0, 100) * strength);
    var blur = Math.round(clampInt(ui.dlgBlur, 0, 40) * strength);
    var shadowA = clampInt(ui.textShadow, 0, 100) / 100;
    root.setProperty('--dlg-border', rgbaFrom(ui.dlgBorderColor, bdA));
    root.setProperty('--dlg-bg', rgbaFrom(ui.dlgBgColor, bgA));
    root.setProperty('--dlg-blur', blur + 'px');
    root.setProperty('--dlg-text-size', clampInt(ui.textSize, 12, 28) + 'px');
    root.setProperty('--dlg-text-shadow-a', String(shadowA));
    root.setProperty('--dlg-text-tq', ui.textTqColor || UI_DEFAULTS.textTqColor);
    root.setProperty('--dlg-text-producer', ui.textProducerColor || UI_DEFAULTS.textProducerColor);
    root.setProperty('--dlg-text-other', ui.textOtherColor || UI_DEFAULTS.textOtherColor);
    document.documentElement.classList.toggle('title-video-off', !!ui.disableTitleVideo);
    fillUiDom(ui);
    syncKeyLabels();
    if (window.天青_system && window.天青_system.applyTitleVideo) {
      window.天青_system.applyTitleVideo();
    }
  }

  function commitUi() {
    var ui = readUiFromDom();
    saveUi(ui);
    applyUi(ui);
  }

  /** 重置本页全部 UI 设置为默认值 */
  function resetPageSettings() {
    var ui = Object.assign({}, UI_DEFAULTS);
    saveUi(ui);
    applyUi(ui);
    requestAnimationFrame(function () {
      document.querySelectorAll('#settings-panel .tq-range').forEach(setRangePct);
    });
    if (window.天青_stage && window.天青_stage.onAutoCgSettingChange) {
      window.天青_stage.onAutoCgSettingChange();
    }
    toast('已重置本页面设置');
  }

  function blurIfInside(root) {
    var ae = document.activeElement;
    if (ae && root && root.contains(ae) && typeof ae.blur === 'function') ae.blur();
  }

  function closeConfirm() {
    var box = $('tq-confirm');
    if (!box) return;
    blurIfInside(box);
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    box.setAttribute('inert', '');
    confirmYesHandler = null;
  }

  var confirmYesHandler = null;

  function openConfirm(message, onYes) {
    var box = $('tq-confirm');
    var msg = $('tq-confirm-msg');
    if (!box) return;
    if (msg) msg.textContent = message || '确认执行此操作？';
    confirmYesHandler = typeof onYes === 'function' ? onYes : null;
    box.removeAttribute('inert');
    box.setAttribute('aria-hidden', 'false');
    box.classList.add('open');
  }

  function closeApiError() {
    var box = $('tq-api-error');
    if (!box) return;
    blurIfInside(box);
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    box.setAttribute('inert', '');
  }

  function showApiError(errOrMsg) {
    var box = $('tq-api-error');
    var codeEl = $('tq-api-error-code');
    var bodyEl = $('tq-api-error-body');
    if (!box) {
      toast(String((errOrMsg && errOrMsg.message) || errOrMsg || '请求失败'));
      return;
    }
    var code = '请求错误';
    var detail = '';
    if (errOrMsg && typeof errOrMsg === 'object') {
      if (errOrMsg.codeLabel) code = String(errOrMsg.codeLabel);
      else if (errOrMsg.status) code = 'HTTP ' + errOrMsg.status;
      detail = String(errOrMsg.body || errOrMsg.message || errOrMsg);
    } else {
      detail = String(errOrMsg || '未知错误');
      var m = detail.match(/\bHTTP\s*(\d{3})\b/i) || detail.match(/\bAPI\s+(\d{3})\b/i);
      if (m) code = 'HTTP ' + m[1];
    }
    if (codeEl) codeEl.textContent = code;
    if (bodyEl) bodyEl.value = detail;
    box.removeAttribute('inert');
    box.setAttribute('aria-hidden', 'false');
    box.classList.add('open');
  }

  function openResetConfirm() {
    openConfirm('是否需要重置本页面设置为默认状态？', resetPageSettings);
  }

  /** 清除全部 tq_plus_* 本地数据并刷新，回到首次载入状态 */
  function factoryResetAll() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('tq_plus_') === 0) keys.push(k);
      }
      keys.forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (e) {
      console.warn('[天青] 全量重置失败', e);
      toast('重置失败：无法清除本地数据');
      return;
    }
    toast('正在重置…');
    window.location.reload();
  }

  function openFactoryResetConfirm() {
    openConfirm('确定重置为初始状态？将清除全部设置、存档、对话与世界书，且无法撤销。', factoryResetAll);
  }

  function readJsonStorage(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return value;
    }
  }

  function downloadJsonFile(name, payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /** 调试：导出 seed（角色世界书、提示词、变量库、基础变量） */
  function exportSeedSettings() {
    var presetApi = window.天青_preset;
    if (!presetApi || typeof presetApi.exportWorldbook !== 'function') {
      toast('世界书导出模块未加载');
      return;
    }

    if (window.天青_settings_prompt && window.天青_settings_prompt.syncStatDataPrompt) {
      try {
        window.天青_settings_prompt.syncStatDataPrompt({ silent: true });
      } catch (e) {}
    }

    var charStore =
      window.天青_settings_character && typeof window.天青_settings_character.getStore === 'function'
        ? window.天青_settings_character.getStore()
        : readJsonStorage('tq_plus_character_tabs', null);
    var promptStore =
      window.天青_settings_prompt && typeof window.天青_settings_prompt.getStore === 'function'
        ? window.天青_settings_prompt.getStore()
        : readJsonStorage('tq_plus_system_prompts', null);

    var characterWorldbooks = [];
    var tabs = charStore && Array.isArray(charStore.tabs) ? charStore.tabs : [];
    tabs.forEach(function (tab) {
      if (!tab) return;
      var entries = Array.isArray(tab.entries) ? tab.entries : [];
      var name = String(tab.name || '世界书').trim() || '世界书';
      characterWorldbooks.push({
        tab: {
          id: String(tab.id || ''),
          name: name,
          color: tab.color || '',
          locked: !!tab.locked,
          enabled: tab.enabled !== false,
        },
        worldbook: presetApi.exportWorldbook(entries, name),
      });
    });

    var promptEntries =
      promptStore && Array.isArray(promptStore.entries) ? promptStore.entries : [];
    var promptWorldbook = presetApi.exportWorldbook(promptEntries, '提示词');

    var variablesPack = readJsonStorage('tq_plus_variables', null);
    if (!variablesPack || typeof variablesPack !== 'object') {
      variablesPack = { __tq: 1, data: {}, meta: {} };
    }
    var defaultVariables =
      variablesPack.data && typeof variablesPack.data === 'object' && !Array.isArray(variablesPack.data)
        ? cloneJson(variablesPack.data)
        : {};

    var payload = {
      format: 'tq_plus_seed',
      version: 1,
      exportedAt: new Date().toISOString(),
      characterWorldbooks: characterWorldbooks,
      promptWorldbook: promptWorldbook,
      variables: variablesPack,
      defaultVariables: defaultVariables,
    };

    downloadJsonFile('seed.json', payload);
    toast(
      '已导出 seed.json（角色 ' +
        characterWorldbooks.length +
        ' · 提示词 ' +
        promptEntries.length +
        ' 条）',
    );
  }

  function bindUiControls() {
    bindSliderPair('cfg-dlg-opacity', 'cfg-dlg-opacity-num', commitUi);
    bindSliderPair('cfg-dlg-border-alpha', 'cfg-dlg-border-alpha-num', commitUi);
    bindSliderPair('cfg-dlg-bg-alpha', 'cfg-dlg-bg-alpha-num', commitUi);
    bindSliderPair('cfg-dlg-blur', 'cfg-dlg-blur-num', commitUi);
    bindSliderPair('cfg-text-size', 'cfg-text-size-num', commitUi);
    bindSliderPair('cfg-text-shadow', 'cfg-text-shadow-num', commitUi);

    [
      'cfg-dlg-border-color',
      'cfg-dlg-bg-color',
      'cfg-text-tq-color',
      'cfg-text-producer-color',
      'cfg-text-other-color',
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', commitUi);
    });

    var autoCg = $('cfg-auto-enter-cg');
    if (autoCg) {
      autoCg.addEventListener('change', function () {
        commitUi();
        if (window.天青_stage && window.天青_stage.onAutoCgSettingChange) {
          window.天青_stage.onAutoCgSettingChange();
        }
      });
    }

    var disableTitleVideo = $('cfg-disable-title-video');
    if (disableTitleVideo) {
      disableTitleVideo.addEventListener('change', commitUi);
    }

    var resetBtn = $('btn-reset-page');
    if (resetBtn) resetBtn.addEventListener('click', openResetConfirm);

    var factoryResetBtn = $('btn-debug-factory-reset');
    if (factoryResetBtn) factoryResetBtn.addEventListener('click', openFactoryResetConfirm);

    var exportSeedBtn = $('btn-debug-export-seed');
    if (exportSeedBtn) exportSeedBtn.addEventListener('click', exportSeedSettings);

    var yesBtn = $('tq-confirm-yes');
    var noBtn = $('tq-confirm-no');
    var confirmBox = $('tq-confirm');
    if (yesBtn) {
      yesBtn.addEventListener('click', function () {
        var fn = confirmYesHandler;
        closeConfirm();
        if (fn) fn();
      });
    }
    if (noBtn) noBtn.addEventListener('click', closeConfirm);
    if (confirmBox) {
      confirmBox.addEventListener('click', function (e) {
        if (e.target === confirmBox) closeConfirm();
      });
    }

    var errClose = $('tq-api-error-close');
    var errOk = $('tq-api-error-ok');
    var errCopy = $('tq-api-error-copy');
    var errBox = $('tq-api-error');
    if (errClose) errClose.addEventListener('click', closeApiError);
    if (errOk) errOk.addEventListener('click', closeApiError);
    if (errBox) {
      errBox.addEventListener('click', function (e) {
        if (e.target === errBox) closeApiError();
      });
    }
    if (errCopy) {
      errCopy.addEventListener('click', function () {
        var bodyEl = $('tq-api-error-body');
        var text = bodyEl ? bodyEl.value : '';
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              toast('已复制错误信息');
            },
            function () {},
          );
        }
      });
    }
  }

  function open() {
    showTab('general', true);
    var systemPane = $('pane-system');
    if (systemPane) showSub(systemPane, 'api', true);
    var panel = $('settings-panel');
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('open');
    requestAnimationFrame(function () {
      sizeTabs();
      syncSubnavVisibility();
      document.querySelectorAll('#settings-panel .tq-range').forEach(setRangePct);
    });
  }

  function close() {
    if (window.天青_settings_preset && window.天青_settings_preset.onLeave) {
      window.天青_settings_preset.onLeave();
    }
    var panel = $('settings-panel');
    var ae = document.activeElement;
    if (ae && panel.contains(ae) && typeof ae.blur === 'function') {
      ae.blur();
    }
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
  }

  function init() {
    var svg = window.天青_svg;
    if (svg) {
      svg.mount($('btn-gear'), svg.gear);
      svg.mount($('btn-settings-close'), svg.exit);
      svg.mount($('tab-icon-general'), svg.chart);
      svg.mount($('tab-icon-character'), svg.user);
      svg.mount($('tab-icon-system'), svg.list);
      svg.mount($('tab-icon-debug'), svg.bug);
      svg.mount($('btn-reset-page-icon'), svg.refresh);
      svg.mount($('btn-debug-export-seed-icon'), svg.exportIcon);
      svg.mount($('btn-debug-factory-reset-icon'), svg.refresh);
      svg.mount($('tq-confirm-yes-icon'), svg.check);
      svg.mount($('tq-confirm-no-icon'), svg.cross);
    }

    applyUi(loadUi());
    bindUiControls();
    syncSubnavVisibility();
    if (window.天青_settings_api) window.天青_settings_api.bind();
    if (window.天青_settings_preset) window.天青_settings_preset.bind();
    if (window.天青_settings_regex) window.天青_settings_regex.bind();
    /* 变量需先于提示词绑定，以便「变量列表」词条能读到叶子 */
    if (window.天青_settings_variable) window.天青_settings_variable.bind();
    if (window.天青_settings_prompt) window.天青_settings_prompt.bind();
    if (window.天青_settings_image) window.天青_settings_image.bind();
    if (window.天青_settings_user) window.天青_settings_user.bind();
    if (window.天青_settings_character) window.天青_settings_character.bind();

    var gear = $('btn-gear');
    if (gear) {
      gear.addEventListener('click', function (e) {
        e.stopPropagation();
        open();
      });
    }

    document.querySelectorAll('.settings-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showTab(btn.getAttribute('data-tab'));
      });
    });

    document.querySelectorAll('.settings-pane').forEach(function (pane) {
      pane.querySelectorAll('.settings-subtab').forEach(function (btn) {
        if (btn.classList.contains('char-subtab') || btn.classList.contains('char-subtab-add')) return;
        btn.addEventListener('click', function () {
          showSub(pane, btn.getAttribute('data-sub'));
          btn.classList.remove('press');
          void btn.offsetWidth;
          btn.classList.add('press');
        });
        btn.addEventListener('animationend', function (e) {
          if (e.animationName === 'settings-subtab-press') {
            btn.classList.remove('press');
          }
        });
      });
    });

    var closeBtn = $('btn-settings-close');
    if (closeBtn) {
      closeBtn.onclick = function () {
        closeBtn.classList.remove('press');
        void closeBtn.offsetWidth;
        closeBtn.classList.add('press');
        close();
      };
      closeBtn.addEventListener('animationend', function (e) {
        if (e.animationName === 'settings-subtab-press') {
          closeBtn.classList.remove('press');
        }
      });
    }

    window.天青_settings = {
      open: open,
      close: close,
      toast: toast,
      confirm: openConfirm,
      showError: showApiError,
      showTab: showTab,
      showSub: showSub,
      syncSubnavVisibility: syncSubnavVisibility,
      syncKeyLabels: syncKeyLabels,
      getUi: loadUi,
      isAutoEnterCg: function () {
        var ui = loadUi();
        return ui.autoEnterCg !== false;
      },
      isTitleVideoDisabled: function () {
        var ui = loadUi();
        return !!ui.disableTitleVideo;
      },
    };
  }

  window.天青_settings_boot = init;
})();
