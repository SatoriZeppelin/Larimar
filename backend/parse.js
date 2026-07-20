/**
 * 剧情解析：优先 <summernight>，兼容旧版 <Gal>
 * 对外：window.天青_parse
 */
(function () {
  function emptyResult() {
    return {
      modules: [],
      choices: [],
      live: null,
      image: null,
      snapshot: '',
      variablesRaw: '',
      format: '',
      partial: false,
      complete: true,
    };
  }

  function pushLine(r, who, expr, text, cg, bg) {
    who = String(who || '').trim();
    expr = String(expr == null ? '' : expr).trim();
    text = String(text || '').trim();
    if (!text && !who) return;
    var isNarr = who === '旁白' || who === '旁白。' || !who;
    /* 勿把 CG / 背景 开闭标签误解析成台词 */
    if (/^cg$/i.test(who) || /^\/cg$/i.test(who)) return;
    if (who === '背景' || who === '/背景') return;
    r.modules.push({
      type: 'line',
      text: text,
      who: who || '旁白',
      expr: !expr || expr === '-' ? '-' : expr,
      dialogue: !isNarr,
      cg: cg || null,
      bgId: bg && bg.id ? bg.id : null,
      bgName: bg && bg.name ? bg.name : null,
    });
  }

  /** 新格式：<说话人|表情|正文> 或 <说话人|正文> / <旁白|正文> */
  function parseSummerNightTag(tagInner, r, cgScene, bgScene) {
    var parts = String(tagInner || '').split('|');
    if (parts.length >= 3) {
      pushLine(r, parts[0], parts[1], parts.slice(2).join('|'), cgScene, bgScene);
      return;
    }
    if (parts.length === 2) {
      pushLine(r, parts[0], '-', parts[1], cgScene, bgScene);
      return;
    }
    if (parts.length === 1 && parts[0].trim()) {
      pushLine(r, '旁白', '-', parts[0], cgScene, bgScene);
    }
  }

  function parseBranchesBlock(block) {
    var choices = [];
    String(block || '').replace(/\[([^\]]*)\]/g, function (_, c) {
      var t = String(c || '').trim();
      if (t) choices.push(t);
      return '';
    });
    return choices;
  }

  function isContainerTag(lower) {
    return (
      lower === 'summernight' ||
      lower === '/summernight' ||
      lower.indexOf('summernight_') === 0 ||
      lower.indexOf('/summernight_') === 0 ||
      lower === 'updatevariable' ||
      lower === '/updatevariable'
    );
  }

  /**
   * 从缓冲文本中取出「正文区」（允许外壳未闭合）
   */
  function extractMaintextZone(full) {
    var text = String(full || '');
    var start = 0;
    var open = text.search(/<summernight_maintext\b[^>]*>/i);
    if (open >= 0) {
      var gt = text.indexOf('>', open);
      start = gt >= 0 ? gt + 1 : open;
    } else {
      var root = text.search(/<summernight\b[^>]*>/i);
      if (root >= 0) {
        var gt2 = text.indexOf('>', root);
        start = gt2 >= 0 ? gt2 + 1 : root;
      }
    }

    var end = text.length;
    var closeMain = text.search(/<\/summernight_maintext>/i);
    if (closeMain >= 0 && closeMain >= start) end = closeMain;

    var cutters = [
      /<\/summernight>/i,
      /<summernight_branches\b/i,
      /<summernight_snapshots\b/i,
      /<summernight_variables\b/i,
      /<UpdateVariable\b/i,
    ];
    cutters.forEach(function (re) {
      var m = text.slice(start, end).search(re);
      if (m >= 0) {
        var abs = start + m;
        if (abs < end) end = abs;
      }
    });

    return {
      zone: text.slice(start, end),
      mainClosed: closeMain >= 0,
      hasOpen: open >= 0,
    };
  }

  /** 扫描已闭合的 <...>；忽略末尾半截标签 */
  function scanCompleteTags(zone, r) {
    var cgScene = null;
    var bgScene = null;
    var re = /<([^<>]+)>/g;
    var m;
    while ((m = re.exec(zone))) {
      var inner = m[1].trim();
      if (!inner) continue;
      var lower = inner.toLowerCase();
      if (isContainerTag(lower)) continue;

      if (lower === '/cg') {
        cgScene = null;
        continue;
      }
      var cgOpen = inner.match(/^CG\s*\|\s*(.+)$/i);
      if (cgOpen) {
        cgScene = String(cgOpen[1] || '').trim() || null;
        continue;
      }

      /* <背景|图片ID|名称> — 切换后续句的背景；名称先挂载，供后续说明 */
      var bgOpen = inner.match(/^背景\s*\|\s*([^|]*)(?:\s*\|\s*(.*))?$/);
      if (bgOpen || lower === '背景') {
        var bgId = String((bgOpen && bgOpen[1]) || '').trim();
        var bgName = String((bgOpen && bgOpen[2]) || '').trim();
        if (bgId) {
          bgScene = { id: bgId, name: bgName || bgId };
        }
        continue;
      }

      parseSummerNightTag(inner, r, cgScene, bgScene);
    }
  }

  function parseSummerNight(raw) {
    var r = emptyResult();
    r.format = 'summernight';
    var full = String(raw || '');
    var root = full.match(/<summernight>([\s\S]*?)<\/summernight>/i);
    var body = root ? root[1] : full;

    var main = body.match(/<summernight_maintext>([\s\S]*?)<\/summernight_maintext>/i);
    var mainText = main ? main[1] : body;

    scanCompleteTags(mainText, r);

    var br = body.match(/<summernight_branches>([\s\S]*?)<\/summernight_branches>/i);
    if (br) r.choices = parseBranchesBlock(br[1]);

    var snap = body.match(/<summernight_snapshots>([\s\S]*?)<\/summernight_snapshots>/i);
    if (snap) r.snapshot = snap[1].replace(/\s+/g, ' ').trim();

    var vars = body.match(
      /<summernight_variables>([\s\S]*?)<\/summernight_variables>/i,
    );
    if (vars) r.variablesRaw = vars[1].trim();

    return r;
  }

  /**
   * 流式增量解析：不要求外壳标签闭合，只产出已完整的句子标签。
   */
  function parseSummerNightPartial(raw) {
    var r = emptyResult();
    r.format = 'summernight';
    r.partial = true;
    var full = String(raw || '');
    var zoneInfo = extractMaintextZone(full);
    scanCompleteTags(zoneInfo.zone, r);

    var br = full.match(/<summernight_branches>([\s\S]*?)<\/summernight_branches>/i);
    if (br) r.choices = parseBranchesBlock(br[1]);
    var snap = full.match(/<summernight_snapshots>([\s\S]*?)<\/summernight_snapshots>/i);
    if (snap) r.snapshot = snap[1].replace(/\s+/g, ' ').trim();
    var vars = full.match(/<summernight_variables>([\s\S]*?)<\/summernight_variables>/i);
    if (vars) r.variablesRaw = vars[1].trim();

    var rootClosed = /<\/summernight>/i.test(full);
    r.complete = !!(zoneInfo.mainClosed || rootClosed);
    return r;
  }

  /** 旧版 <Gal> 兼容 */
  function parseLegacyGal(raw) {
    if (raw == null) raw = '';
    raw = String(raw);
    var m = raw.match(/<Gal>([\s\S]*?)<\/Gal>/);
    if (m) raw = m[1];

    var r = emptyResult();
    r.format = 'gal';
    var mode = '';
    var cgScene = null;

    var im = raw.match(/<image>([\s\S]*?)<\/image>/i);
    if (im) {
      r.image = im[1]
        .replace(/^\s*image\s*###/i, '')
        .replace(/###\s*$/, '')
        .trim();
      raw = raw.replace(im[0], '');
    }

    raw.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var x;

      if (/^<env>[\s\S]*?<\/env>$/.test(line) || /^<inner>[\s\S]*?<\/inner>$/.test(line)) return;

      if ((x = line.match(/^<live>([\s\S]*?)<\/live>$/))) {
        var p = x[1].split('|');
        r.live = {
          form: (p[0] || '杂谈').trim(),
          bg: (p[1] || '宿舍').trim(),
          title: (p[2] || '').trim(),
        };
        return;
      }
      if ((x = line.match(/^<dm>([\s\S]*?)<\/dm>$/))) {
        var p2 = x[1].split('|');
        r.modules.push({
          type: 'dm',
          who: (p2[0] || '?').trim(),
          text: (p2.slice(1).join('|') || '').trim(),
        });
        return;
      }
      if ((x = line.match(/^<sc>([\s\S]*?)<\/sc>$/))) {
        var p3 = x[1].split('|');
        r.modules.push({
          type: 'sc',
          who: (p3[0] || '?').trim(),
          yen: +((p3[1] || '').trim()) || 30,
          text: (p3.slice(2).join('|') || '').trim(),
        });
        return;
      }
      if ((x = line.match(/^<cg=([\s\S]*?)>$/))) {
        cgScene = x[1].trim();
        return;
      }
      if (line === '</cg>') {
        cgScene = null;
        return;
      }
      if ((x = line.match(/^<cg>([\s\S]*?)<\/cg>$/))) {
        var p4 = x[1].split('|');
        r.modules.push({ type: 'cg', name: p4[0].trim(), tag: (p4[1] || '').trim() });
        return;
      }
      if ((x = line.match(/^<choice>(.*)<\/choice>$/))) {
        (x[1].match(/\[([^\]]*)\]/g) || []).forEach(function (c) {
          r.choices.push(c.replace(/^\[|\]$/g, ''));
        });
        return;
      }
      if (line === '<choice>') {
        mode = 'choice';
        return;
      }
      if (line === '</choice>') {
        mode = '';
        return;
      }
      if (mode === 'choice') {
        r.choices.push(line.replace(/^\[|\]$/g, ''));
        return;
      }
      if (line.indexOf('|') > -1) {
        var f = line.split('|');
        r.modules.push({
          type: 'line',
          text: (f[0] || '').trim(),
          who: (f[1] || '').trim(),
          expr: (f[2] || '').trim(),
          dialogue: /^「[\s\S]*」$/.test((f[0] || '').trim()),
          cg: cgScene,
        });
      }
    });

    return r;
  }

  function parseGal(raw) {
    var text = raw == null ? '' : String(raw);
    if (/<summernight[\s>]/i.test(text) || /<summernight_maintext[\s>]/i.test(text)) {
      return parseSummerNight(text);
    }
    /* 宽松：正文里大量 <旁白|…> / <天青|…|…> 也按新格式抓 */
    if (/<(旁白|天青|制作人|同学)\|/.test(text)) {
      return parseSummerNight(text);
    }
    return parseLegacyGal(text);
  }

  window.天青_parse = {
    parseGal: parseGal,
    parseSummerNight: parseSummerNight,
    parseSummerNightPartial: parseSummerNightPartial,
    parseLegacyGal: parseLegacyGal,
  };
})();
