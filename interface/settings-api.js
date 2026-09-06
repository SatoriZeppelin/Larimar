/**
 * 系统设置 · API 页（多套命名接口 + 路由绑定）
 * 对外：window.天青_settings_api
 */
(function () {
  var keyTimers = Object.create(null);
  var busyId = '';
  var modelIdsByProfile = Object.create(null);
  var expandedIds = Object.create(null);
  var advancedOpen = Object.create(null);
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function api() {
    return window.天青_api;
  }

  function toast(msg) {
    if (window.天青_settings && window.天青_settings.toast) {
      window.天青_settings.toast(msg);
    }
  }

  function clampNum(n, min, max, fallback) {
    n = Number(n);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function fmt2(n) {
    return clampNum(n, -Infinity, Infinity, 0).toFixed(2);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hostOf(url) {
    try {
      var u = String(url || '').trim();
      if (!u) return '';
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      return new URL(u).host || '';
    } catch (e) {
      return String(url || '')
        .replace(/^https?:\/\//i, '')
        .split('/')[0];
    }
  }

  function setRangePct(rangeEl) {
    if (!rangeEl) return;
    var min = parseFloat(rangeEl.min) || 0;
    var max = parseFloat(rangeEl.max) || 100;
    var val = parseFloat(rangeEl.value);
    if (!isFinite(val)) val = min;
    var pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    rangeEl.style.setProperty('--tq-pct', pct + '%');
  }

  function store() {
    return (api() && api().loadStore && api().loadStore()) || { profiles: [], routes: {}, defaultProfileId: '', activeProfileId: '' };
  }

  function setStatus(profileId, state, text) {
    var card = document.querySelector('.api-profile-card[data-id="' + profileId + '"]');
    if (!card) return;
    var el = card.querySelector('.settings-api-status');
    var txt = card.querySelector('.api-status-text');
    if (el) el.setAttribute('data-state', state || 'idle');
    if (txt) txt.textContent = text || '';
  }

  function fillRouteSelects() {
    var st = store();
    var profiles = st.profiles || [];
    var defSel = $('cfg-api-default-profile');
    if (defSel) {
      defSel.innerHTML = profiles
        .map(function (p) {
          return (
            '<option value="' +
            esc(p.id) +
            '"' +
            (p.id === st.defaultProfileId ? ' selected' : '') +
            '>' +
            esc(p.name) +
            (p.enabled === false ? '（已禁用）' : '') +
            '</option>'
          );
        })
        .join('');
    }
    ['main', 'line', 'twitter', 'twitch'].forEach(function (route) {
      var sel = $('cfg-api-route-' + route);
      if (!sel) return;
      var cur = (st.routes && st.routes[route]) || '';
      var opts =
        '<option value="">使用默认</option>' +
        profiles
          .map(function (p) {
            return (
              '<option value="' +
              esc(p.id) +
              '"' +
              (p.id === cur ? ' selected' : '') +
              '>' +
              esc(p.name) +
              (p.enabled === false ? '（已禁用）' : '') +
              '</option>'
            );
          })
          .join('');
      sel.innerHTML = opts;
    });
  }

  function readCardConfig(card, prev) {
    prev = prev || {};
    var baseUrl = ((card.querySelector('[data-f="baseUrl"]') || {}).value || '').trim();
    var protocol = ((card.querySelector('[data-f="protocol"]') || {}).value || prev.protocol || 'openai').trim();
    var cfg = Object.assign({}, prev, {
      id: card.getAttribute('data-id'),
      name: ((card.querySelector('[data-f="name"]') || {}).value || prev.name || '新接口').trim() || '新接口',
      enabled: !!(card.querySelector('[data-f="enabled"]') || {}).checked,
      protocol: protocol,
      baseUrl: baseUrl,
      apiKey: ((card.querySelector('[data-f="apiKey"]') || {}).value || '').trim(),
      model: ((card.querySelector('[data-f="model"]') || {}).value || '').trim() || prev.model,
      autoConnect: !!(card.querySelector('[data-f="autoConnect"]') || {}).checked,
      stream: !!(card.querySelector('[data-f="stream"]') || {}).checked,
      streamDisplay: !!(card.querySelector('[data-f="streamDisplay"]') || {}).checked,
      contextLength: clampNum((card.querySelector('[data-f="contextLength"]') || {}).value, 1024, 2000000, prev.contextLength || 200000),
      maxTokens: clampNum((card.querySelector('[data-f="maxTokens"]') || {}).value, 1, 2000000, prev.maxTokens || 4096),
      temperature: clampNum((card.querySelector('[data-f="temperature"]') || {}).value, 0, 2, prev.temperature != null ? prev.temperature : 1),
      frequencyPenalty: clampNum((card.querySelector('[data-f="frequencyPenalty"]') || {}).value, -2, 2, prev.frequencyPenalty || 0),
      presencePenalty: clampNum((card.querySelector('[data-f="presencePenalty"]') || {}).value, -2, 2, prev.presencePenalty || 0),
      topP: clampNum((card.querySelector('[data-f="topP"]') || {}).value, 0, 1, prev.topP != null ? prev.topP : 0.99),
      reasoningEffort: ((card.querySelector('[data-f="reasoningEffort"]') || {}).value || prev.reasoningEffort || 'xhigh'),
    });
    if (String(prev.baseUrl || '') !== baseUrl || String(prev.protocol || 'openai') !== protocol) {
      cfg.chatPath = '';
      cfg.modelsPath = '';
    }
    if (api() && api().normalizeConfig) cfg = api().normalizeConfig(cfg);
    return cfg;
  }

  function saveCard(card) {
    if (!api() || !card) return null;
    var id = card.getAttribute('data-id');
    var st = store();
    var prev = null;
    for (var i = 0; i < st.profiles.length; i++) {
      if (st.profiles[i].id === id) {
        prev = st.profiles[i];
        break;
      }
    }
    var cfg = readCardConfig(card, prev || {});
    st.profiles = st.profiles.map(function (p) {
      return p.id === id ? cfg : p;
    });
    st.activeProfileId = id;
    api().saveStore(st);
    var title = card.querySelector('.api-card-title');
    if (title) title.textContent = cfg.name;
    var sub = card.querySelector('.api-card-sub');
    if (sub) sub.textContent = [cfg.model, hostOf(cfg.baseUrl)].filter(Boolean).join(' · ') || '未配置';
    var badge = card.querySelector('.api-badge-enabled');
    if (badge) {
      badge.textContent = cfg.enabled ? '已启用' : '已禁用';
      badge.classList.toggle('is-on', !!cfg.enabled);
      badge.classList.toggle('is-off', !cfg.enabled);
    }
    fillRouteSelects();
    return cfg;
  }

  function closeModelMenu(card) {
    var wrap = card && card.querySelector('.tq-model-field');
    var menu = card && card.querySelector('.tq-model-menu');
    var caret = card && card.querySelector('[data-act="model-menu"]');
    if (wrap) wrap.classList.remove('is-open');
    if (menu) menu.hidden = true;
    if (caret) caret.setAttribute('aria-expanded', 'false');
  }

  function renderModelMenu(card, opts) {
    opts = opts || {};
    var id = card.getAttribute('data-id');
    var menu = card.querySelector('.tq-model-menu');
    var input = card.querySelector('[data-f="model"]');
    if (!menu || !input) return;
    var ids = modelIdsByProfile[id] || [];
    var q = opts.showAll ? '' : String(input.value || '').trim().toLowerCase();
    var filtered = !q
      ? ids.slice()
      : ids.filter(function (m) {
          return String(m).toLowerCase().indexOf(q) >= 0;
        });
    if (!filtered.length) {
      menu.innerHTML = '<li class="tq-model-empty">无匹配模型</li>';
    } else {
      menu.innerHTML = filtered
        .slice(0, 80)
        .map(function (m) {
          return '<li role="option" data-value="' + esc(m) + '">' + esc(m) + '</li>';
        })
        .join('');
    }
  }

  function openModelMenu(card) {
    var wrap = card.querySelector('.tq-model-field');
    var menu = card.querySelector('.tq-model-menu');
    var caret = card.querySelector('[data-act="model-menu"]');
    if (!wrap || !menu) return;
    renderModelMenu(card, { showAll: true });
    wrap.classList.add('is-open');
    menu.hidden = false;
    if (caret) caret.setAttribute('aria-expanded', 'true');
  }

  function bindCardSlider(card, rangeSel, numSel, isFloat) {
    var range = card.querySelector(rangeSel);
    var num = card.querySelector(numSel);
    if (!range || !num) return;
    function fromRange() {
      num.value = isFloat ? fmt2(range.value) : String(Math.round(Number(range.value) || 0));
      setRangePct(range);
      saveCard(card);
    }
    function fromNum() {
      var v = clampNum(num.value, range.min, range.max, Number(range.value) || 0);
      if (isFloat) v = Math.round(v * 100) / 100;
      else v = Math.round(v);
      num.value = isFloat ? fmt2(v) : String(v);
      range.value = String(v);
      setRangePct(range);
      saveCard(card);
    }
    range.addEventListener('input', fromRange);
    num.addEventListener('change', fromNum);
  }

  function cardHtml(p, expanded) {
    var id = p.id;
    var protocol = p.protocol || 'openai';
    var ph =
      protocol === 'claude'
        ? 'https://api.anthropic.com'
        : protocol === 'gemini'
          ? 'https://generativelanguage.googleapis.com'
          : 'https://api.openai.com/v1';
    var sub = [p.model, hostOf(p.baseUrl)].filter(Boolean).join(' · ') || '未配置';
    var adv = !!advancedOpen[id];
    return (
      '<article class="api-profile-card' +
      (expanded ? ' is-expanded' : '') +
      (p.enabled === false ? ' is-disabled' : '') +
      '" data-id="' +
      esc(id) +
      '">' +
      '<header class="api-card-head">' +
      '<button type="button" class="api-card-toggle" data-act="toggle" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '" title="展开/折叠">' +
      '<span class="api-card-chevron" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="api-card-head-main" data-act="toggle">' +
      '<div class="api-card-title-row">' +
      '<span class="api-card-title">' +
      esc(p.name) +
      '</span>' +
      '<span class="api-badge api-badge-enabled ' +
      (p.enabled !== false ? 'is-on' : 'is-off') +
      '">' +
      (p.enabled !== false ? '已启用' : '已禁用') +
      '</span>' +
      '</div>' +
      '<div class="api-card-sub">' +
      esc(sub) +
      '</div>' +
      '</div>' +
      '<div class="api-card-actions">' +
      '<button type="button" class="api-icon-btn" data-act="up" title="上移">↑</button>' +
      '<button type="button" class="api-icon-btn" data-act="down" title="下移">↓</button>' +
      '<button type="button" class="api-icon-btn" data-act="dup" title="复制">复</button>' +
      '<button type="button" class="api-icon-btn api-icon-danger" data-act="del" title="删除">×</button>' +
      '</div>' +
      '</header>' +
      '<div class="api-card-body"' +
      (expanded ? '' : ' hidden') +
      '>' +
      '<div class="api-card-fields">' +
      '<div class="settings-l4"><h4 class="settings-l4-title">名称</h4>' +
      '<input type="text" class="tq-input" data-f="name" value="' +
      esc(p.name) +
      '" autocomplete="off" spellcheck="false" /></div>' +
      '<label class="tq-check-row" for="api-en-' +
      esc(id) +
      '"><input type="checkbox" id="api-en-' +
      esc(id) +
      '" data-f="enabled"' +
      (p.enabled !== false ? ' checked' : '') +
      ' /><span class="tq-check-box" aria-hidden="true"></span>' +
      '<span class="tq-check-label">启用接口</span></label>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">协议</h4>' +
      '<select class="tq-select" data-f="protocol">' +
      '<option value="openai"' +
      (protocol === 'openai' ? ' selected' : '') +
      '>OpenAI（Chat Completions）</option>' +
      '<option value="claude"' +
      (protocol === 'claude' ? ' selected' : '') +
      '>Claude（Messages）</option>' +
      '<option value="gemini"' +
      (protocol === 'gemini' ? ' selected' : '') +
      '>Gemini（generateContent）</option>' +
      '</select></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">接口地址</h4>' +
      '<input type="text" class="tq-input" data-f="baseUrl" value="' +
      esc(p.baseUrl || '') +
      '" placeholder="' +
      esc(ph) +
      '" autocomplete="off" spellcheck="false" /></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">API Key</h4>' +
      '<div class="tq-field"><input type="password" class="tq-input tq-input-has-icon" data-f="apiKey" value="' +
      esc(p.apiKey || '') +
      '" placeholder="sk-..." autocomplete="off" spellcheck="false" />' +
      '<button type="button" class="tq-field-icon" data-act="key-vis" data-visible="0" aria-label="显示密钥" title="显示密钥"></button></div></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">模型</h4>' +
      '<div class="tq-model-field"><div class="tq-field">' +
      '<input type="text" class="tq-input tq-input-has-icon" data-f="model" value="' +
      esc(p.model || '') +
      '" placeholder="连接后选择，也可手动填写" autocomplete="off" spellcheck="false" />' +
      '<button type="button" class="tq-field-icon tq-field-caret" data-act="model-menu" aria-label="选择模型" title="选择模型" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M6.2 9.2h11.6L12 16.4 6.2 9.2z"/></svg>' +
      '</button></div><ul class="tq-model-menu" hidden role="listbox"></ul></div>' +
      '<p class="tq-hint">可直接输入模型名，也可先获取列表后选择。</p></div>' +
      '<div class="settings-api-actions">' +
      '<button type="button" class="tq-action-btn" data-act="connect">获取模型列表</button>' +
      '<button type="button" class="tq-action-btn" data-act="test">发送测试消息</button></div>' +
      '<label class="tq-check-row"><input type="checkbox" data-f="autoConnect"' +
      (p.autoConnect ? ' checked' : '') +
      ' /><span class="tq-check-box" aria-hidden="true"></span><span class="tq-check-label">自动连接</span></label>' +
      '<div class="settings-api-status" data-state="idle"><span class="api-status-icon"></span><span class="api-status-text">未连接</span></div>' +
      '<div class="settings-l4 settings-api-stream-opts">' +
      '<label class="tq-check-row"><input type="checkbox" data-f="stream"' +
      (p.stream ? ' checked' : '') +
      ' /><span class="tq-check-box" aria-hidden="true"></span><span class="tq-check-label">流式传输</span></label>' +
      '<label class="tq-check-row"><input type="checkbox" data-f="streamDisplay"' +
      (p.streamDisplay !== false ? ' checked' : '') +
      ' /><span class="tq-check-box" aria-hidden="true"></span><span class="tq-check-label">流式显示</span></label></div>' +
      '<button type="button" class="api-advanced-toggle" data-act="advanced" aria-expanded="' +
      (adv ? 'true' : 'false') +
      '">高级参数</button>' +
      '<div class="api-advanced"' +
      (adv ? '' : ' hidden') +
      '>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">上下文长度</h4><div class="tq-slider"><div class="tq-range-wrap">' +
      '<input type="range" class="tq-range" data-f="contextLength" min="1024" max="2000000" step="1024" value="' +
      esc(p.contextLength) +
      '" /></div>' +
      '<input type="text" class="tq-slider-num tq-slider-num-wide" data-f="contextLengthNum" inputmode="numeric" value="' +
      esc(Math.round(p.contextLength || 0)) +
      '" /></div></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">最大回复长度</h4>' +
      '<input type="text" class="tq-input" data-f="maxTokens" inputmode="numeric" value="' +
      esc(p.maxTokens) +
      '" autocomplete="off" /></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">温度</h4><div class="tq-slider"><div class="tq-range-wrap">' +
      '<input type="range" class="tq-range" data-f="temperature" min="0" max="2" step="0.01" value="' +
      esc(p.temperature) +
      '" /></div>' +
      '<input type="text" class="tq-slider-num tq-slider-num-wide" data-f="temperatureNum" inputmode="decimal" value="' +
      esc(fmt2(p.temperature)) +
      '" /></div></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">频率惩罚</h4><div class="tq-slider"><div class="tq-range-wrap">' +
      '<input type="range" class="tq-range" data-f="frequencyPenalty" min="-2" max="2" step="0.01" value="' +
      esc(p.frequencyPenalty) +
      '" /></div>' +
      '<input type="text" class="tq-slider-num tq-slider-num-wide" data-f="frequencyPenaltyNum" inputmode="decimal" value="' +
      esc(fmt2(p.frequencyPenalty)) +
      '" /></div></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">存在惩罚</h4><div class="tq-slider"><div class="tq-range-wrap">' +
      '<input type="range" class="tq-range" data-f="presencePenalty" min="-2" max="2" step="0.01" value="' +
      esc(p.presencePenalty) +
      '" /></div>' +
      '<input type="text" class="tq-slider-num tq-slider-num-wide" data-f="presencePenaltyNum" inputmode="decimal" value="' +
      esc(fmt2(p.presencePenalty)) +
      '" /></div></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">Top P</h4><div class="tq-slider"><div class="tq-range-wrap">' +
      '<input type="range" class="tq-range" data-f="topP" min="0" max="1" step="0.01" value="' +
      esc(p.topP) +
      '" /></div>' +
      '<input type="text" class="tq-slider-num tq-slider-num-wide" data-f="topPNum" inputmode="decimal" value="' +
      esc(fmt2(p.topP)) +
      '" /></div></div>' +
      '<div class="settings-l4"><h4 class="settings-l4-title">推理强度</h4>' +
      '<select class="tq-select" data-f="reasoningEffort">' +
      ['auto', 'minimal', 'low', 'medium', 'high', 'xhigh']
        .map(function (v) {
          var labels = { auto: '自动', minimal: '极低', low: '低', medium: '中', high: '高', xhigh: '极高' };
          return (
            '<option value="' +
            v +
            '"' +
            ((p.reasoningEffort || 'xhigh') === v ? ' selected' : '') +
            '>' +
            labels[v] +
            '</option>'
          );
        })
        .join('') +
      '</select></div>' +
      '</div></div></div></article>'
    );
  }

  function wireCard(card) {
    if (!card || card.getAttribute('data-wired') === '1') return;
    card.setAttribute('data-wired', '1');
    var id = card.getAttribute('data-id');

    card.querySelectorAll('.tq-range').forEach(function (r) {
      setRangePct(r);
    });
    bindCardSlider(card, '[data-f="contextLength"]', '[data-f="contextLengthNum"]', false);
    bindCardSlider(card, '[data-f="temperature"]', '[data-f="temperatureNum"]', true);
    bindCardSlider(card, '[data-f="frequencyPenalty"]', '[data-f="frequencyPenaltyNum"]', true);
    bindCardSlider(card, '[data-f="presencePenalty"]', '[data-f="presencePenaltyNum"]', true);
    bindCardSlider(card, '[data-f="topP"]', '[data-f="topPNum"]', true);

    card.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn || !card.contains(btn)) return;
      var act = btn.getAttribute('data-act');
      if (act === 'toggle') {
        e.preventDefault();
        expandedIds[id] = !expandedIds[id];
        if (expandedIds[id] && api() && api().setActiveProfile) api().setActiveProfile(id);
        render();
        return;
      }
      if (act === 'advanced') {
        e.preventDefault();
        advancedOpen[id] = !advancedOpen[id];
        var panel = card.querySelector('.api-advanced');
        if (panel) panel.hidden = !advancedOpen[id];
        btn.setAttribute('aria-expanded', advancedOpen[id] ? 'true' : 'false');
        return;
      }
      if (act === 'up') {
        e.preventDefault();
        api().moveProfile(id, -1);
        render();
        return;
      }
      if (act === 'down') {
        e.preventDefault();
        api().moveProfile(id, 1);
        render();
        return;
      }
      if (act === 'dup') {
        e.preventDefault();
        var copy = api().duplicateProfile(id);
        if (copy) expandedIds[copy.id] = true;
        render();
        return;
      }
      if (act === 'del') {
        e.preventDefault();
        var st0 = store();
        if (st0.profiles.length <= 1) {
          toast('至少保留一套接口');
          return;
        }
        var pname = '';
        for (var di = 0; di < st0.profiles.length; di++) {
          if (st0.profiles[di].id === id) {
            pname = st0.profiles[di].name || '';
            break;
          }
        }
        if (!window.confirm('删除接口「' + pname + '」？')) return;
        api().removeProfile(id);
        delete expandedIds[id];
        delete advancedOpen[id];
        delete modelIdsByProfile[id];
        render();
        return;
      }
      if (act === 'key-vis') {
        e.preventDefault();
        var key = card.querySelector('[data-f="apiKey"]');
        if (!key) return;
        var show = btn.getAttribute('data-visible') !== '1';
        key.type = show ? 'text' : 'password';
        btn.setAttribute('data-visible', show ? '1' : '0');
        btn.setAttribute('aria-label', show ? '隐藏密钥' : '显示密钥');
        btn.setAttribute('title', show ? '隐藏密钥' : '显示密钥');
        return;
      }
      if (act === 'model-menu') {
        e.preventDefault();
        e.stopPropagation();
        var wrap = card.querySelector('.tq-model-field');
        if (wrap && wrap.classList.contains('is-open')) closeModelMenu(card);
        else openModelMenu(card);
        return;
      }
      if (act === 'connect') {
        e.preventDefault();
        connectProfile(id);
        return;
      }
      if (act === 'test') {
        e.preventDefault();
        testProfile(id);
      }
    });

    card.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-f')) {
        saveCard(card);
        if (t.getAttribute('data-f') === 'protocol') {
          var base = card.querySelector('[data-f="baseUrl"]');
          var proto = t.value;
          if (base) {
            if (proto === 'claude') base.placeholder = 'https://api.anthropic.com';
            else if (proto === 'gemini') base.placeholder = 'https://generativelanguage.googleapis.com';
            else base.placeholder = 'https://api.openai.com/v1';
          }
        }
      }
    });

    card.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var f = t.getAttribute('data-f');
      if (!f) return;
      if (f === 'name' || f === 'baseUrl' || f === 'model' || f === 'maxTokens') {
        saveCard(card);
      }
      if (f === 'apiKey') {
        saveCard(card);
        scheduleKeyCheck(id);
      }
      if (f === 'model') {
        if (card.querySelector('.tq-model-field.is-open')) renderModelMenu(card);
      }
    });

    var menu = card.querySelector('.tq-model-menu');
    if (menu) {
      menu.addEventListener('click', function (e) {
        var li = e.target && e.target.closest ? e.target.closest('li[data-value]') : null;
        if (!li) return;
        e.preventDefault();
        var input = card.querySelector('[data-f="model"]');
        if (input) input.value = li.getAttribute('data-value') || '';
        saveCard(card);
        closeModelMenu(card);
      });
    }
  }

  function render() {
    if (!api()) return;
    var list = $('api-profiles-list');
    if (!list) return;
    var st = store();
    var profiles = st.profiles || [];
    if (!Object.keys(expandedIds).length && st.activeProfileId) {
      expandedIds[st.activeProfileId] = true;
    }
    list.innerHTML = profiles
      .map(function (p) {
        return cardHtml(p, !!expandedIds[p.id]);
      })
      .join('');
    list.querySelectorAll('.api-profile-card').forEach(wireCard);
    fillRouteSelects();
  }

  async function connectProfile(id) {
    if (!api() || busyId) return;
    busyId = id;
    if (api().setActiveProfile) api().setActiveProfile(id);
    var card = document.querySelector('.api-profile-card[data-id="' + id + '"]');
    if (card) saveCard(card);
    setStatus(id, 'loading', '连接中…');
    try {
      var ids = await api().listModels({ profileId: id });
      modelIdsByProfile[id] = ids || [];
      setStatus(id, 'ok', '已连接 · ' + modelIdsByProfile[id].length + ' 个模型');
      toast('已获取模型列表');
      render();
      expandedIds[id] = true;
      var card2 = document.querySelector('.api-profile-card[data-id="' + id + '"]');
      if (card2) {
        setStatus(id, 'ok', '已连接 · ' + modelIdsByProfile[id].length + ' 个模型');
        openModelMenu(card2);
      }
    } catch (e) {
      var msg = String((e && e.message) || e || '连接失败');
      setStatus(id, 'fail', msg.slice(0, 120));
      toast('连接失败');
      try {
        await api().testMessage({ profileId: id });
        setStatus(id, 'ok', '测试消息成功（模型列表不可用）');
      } catch (e2) {}
    } finally {
      busyId = '';
    }
  }

  async function testProfile(id) {
    if (!api() || busyId) return;
    busyId = id;
    if (api().setActiveProfile) api().setActiveProfile(id);
    var card = document.querySelector('.api-profile-card[data-id="' + id + '"]');
    if (card) saveCard(card);
    setStatus(id, 'loading', '发送测试…');
    try {
      await api().testMessage({ profileId: id });
      setStatus(id, 'ok', '测试消息成功');
      toast('测试成功');
    } catch (e) {
      setStatus(id, 'fail', String((e && e.message) || e || '失败').slice(0, 120));
      toast('测试失败');
    } finally {
      busyId = '';
    }
  }

  function scheduleKeyCheck(id) {
    if (keyTimers[id]) clearTimeout(keyTimers[id]);
    keyTimers[id] = setTimeout(function () {
      keyTimers[id] = null;
      var st = store();
      var p = null;
      for (var i = 0; i < st.profiles.length; i++) {
        if (st.profiles[i].id === id) p = st.profiles[i];
      }
      if (!p || !p.autoConnect || !p.baseUrl || !p.apiKey) return;
      connectProfile(id);
    }, 650);
  }

  function maybeTryAutoConnect() {
    var st = store();
    var p = null;
    for (var i = 0; i < st.profiles.length; i++) {
      if (st.profiles[i].id === st.activeProfileId) p = st.profiles[i];
    }
    if (!p) p = st.profiles[0];
    if (!p || !p.autoConnect || !String(p.baseUrl || '').trim() || !String(p.apiKey || '').trim()) return;
    connectProfile(p.id);
  }

  function fillDom() {
    render();
  }

  function bind() {
    if (bound) {
      render();
      return;
    }
    bound = true;
    render();

    var addBtn = $('btn-api-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var p = api().addProfile({ name: '新接口' });
        if (p) expandedIds[p.id] = true;
        render();
      });
    }

    var defSel = $('cfg-api-default-profile');
    if (defSel) {
      defSel.addEventListener('change', function () {
        api().setDefaultProfile(defSel.value);
        fillRouteSelects();
      });
    }

    ['main', 'line', 'twitter', 'twitch'].forEach(function (route) {
      var sel = $('cfg-api-route-' + route);
      if (!sel) return;
      sel.addEventListener('change', function () {
        api().setRoute(route, sel.value);
      });
    });

    document.addEventListener('click', function (e) {
      document.querySelectorAll('.api-profile-card .tq-model-field.is-open').forEach(function (wrap) {
        if (wrap.contains(e.target)) return;
        var card = wrap.closest('.api-profile-card');
        if (card) closeModelMenu(card);
      });
    });

    maybeTryAutoConnect();
  }

  window.天青_settings_api = {
    bind: bind,
    fillDom: fillDom,
    connect: function () {
      var st = store();
      if (st.activeProfileId) connectProfile(st.activeProfileId);
    },
    setStatus: function (state, text) {
      var st = store();
      if (st.activeProfileId) setStatus(st.activeProfileId, state, text);
    },
    render: render,
  };
})();
