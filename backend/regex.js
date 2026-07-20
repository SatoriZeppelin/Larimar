/**
 * SillyTavern 风格正则脚本执行
 * 对外：window.天青_regex
 */
(function () {
  /** 与 ST regex_placement 对齐 */
  var PLACEMENT = {
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SLASH_COMMAND: 3,
    WORLD_INFO: 5,
    REASONING: 6,
  };

  var PLACEMENT_LABELS = {
    1: '用户输入',
    2: 'AI回复',
    3: '斜杠命令',
    5: '世界书',
    6: '推理',
  };

  function regexFromString(input) {
    var raw = String(input || '').trim();
    if (!raw) return null;
    try {
      if (raw[0] === '/') {
        var last = raw.lastIndexOf('/');
        if (last > 0) {
          var body = raw.slice(1, last);
          var flags = raw.slice(last + 1);
          return new RegExp(body, flags);
        }
      }
      return new RegExp(raw);
    } catch (e) {
      console.warn('[天青 正则] 无效表达式', raw, e);
      return null;
    }
  }

  function filterTrim(match, trimStrings) {
    var out = String(match == null ? '' : match);
    (trimStrings || []).forEach(function (t) {
      if (t) out = out.split(String(t)).join('');
    });
    return out;
  }

  function runScript(script, rawString) {
    if (!script || script.disabled || !script.findRegex || typeof rawString !== 'string') {
      return rawString;
    }
    var findRegex = regexFromString(script.findRegex);
    if (!findRegex) return rawString;

    return rawString.replace(findRegex, function (match) {
      var args = Array.prototype.slice.call(arguments);
      var replaceString = String(script.replaceString || '').replace(/\{\{match\}\}/gi, '$0');
      return replaceString.replace(/\$(\d+)|\$<([^>]+)>/g, function (_, num, groupName) {
        var captured = '';
        if (num) captured = args[Number(num)] || '';
        else if (groupName) {
          var groups = args[args.length - 1];
          captured = groups && typeof groups === 'object' ? groups[groupName] || '' : '';
        }
        return filterTrim(captured, script.trimStrings);
      });
    });
  }

  /**
   * @param {string} raw
   * @param {number} placement
   * @param {object[]} [scripts]
   */
  function apply(raw, placement, scripts) {
    if (typeof raw !== 'string' || !raw) return raw || '';
    var list = scripts;
    if (!list) {
      var p = window.天青_preset && window.天青_preset.load ? window.天青_preset.load() : null;
      list = (p && p.regexScripts) || [];
    }
    var out = raw;
    (list || []).forEach(function (script) {
      if (!script || script.disabled) return;
      if (script.markdownOnly || script.promptOnly) return;
      var places = Array.isArray(script.placement) ? script.placement : [];
      if (places.indexOf(placement) === -1) return;
      out = runScript(script, out);
    });
    return out;
  }

  function applyAiOutput(raw, scripts) {
    return apply(raw, PLACEMENT.AI_OUTPUT, scripts);
  }

  function placementLabel(n) {
    return PLACEMENT_LABELS[n] || String(n);
  }

  function placementSummary(script) {
    var places = (script && script.placement) || [];
    if (!places.length) return '未指定作用域';
    return places
      .map(placementLabel)
      .filter(Boolean)
      .join(' · ');
  }

  window.天青_regex = {
    PLACEMENT: PLACEMENT,
    PLACEMENT_LABELS: PLACEMENT_LABELS,
    regexFromString: regexFromString,
    runScript: runScript,
    apply: apply,
    applyAiOutput: applyAiOutput,
    placementLabel: placementLabel,
    placementSummary: placementSummary,
  };
})();
