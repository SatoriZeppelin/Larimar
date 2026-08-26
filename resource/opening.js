/**
 * 开局剧情列表（summernight 格式）
 * 背景：<背景|图片ID|名称>
 * CG 区间：<CG|名字> … </CG>（标记不进文本）
 * 对外：window.天青_openings / window.天青_opening / window.天青_opening_api
 */
(function () {
  var RAW_SCHOOL_GATE = String.raw`<summernight>
    <summernight_maintext>
        <背景|校园|校门口>
        <旁白|三月末的风还带着凉意，校门口的银杏树刚冒出嫩黄的新叶。>
        <旁白|你靠在离校门十几米远的路灯柱上，手机显示下午四点十七分——距离她说的放学时间，过去了整整十二分钟。>
        <旁白|三三两两的学生从校门里走出来，有人骑车，有人边走边拆便利店的面包。你换了个姿势，手边还提着两杯热可可。>
        <旁白|一阵嬉闹声从校门方向传来。>
        <旁白|她走在三四个女生中间，黑蓝渐变的长发被风吹起，发尾那段透明的浅蓝在银杏漏下的光斑里一闪一闪。>
        <旁白|然后她抬头看见你，那双浅蓝色的眼睛亮起来的速度快得过分，像有人在她眼球后面按下了开关。>
        <旁白|她跑了两步就刹住，转过身面对那群还没反应过来的同学，一只手指向你站着的路灯。>

        <天青|完全胜利|看到没！那个是我的制作人！>

        <旁白|她的声音大到路过的学生都侧目，那群女孩顺着她的手指看过来，有茫然的，有好奇的，也有一个红着脸捂住嘴的。>

        <同学|每次都这样……>

        <旁白|天青完全没理会她的吐槽，反而凑近一步压低声音——但那所谓的压低，依然能让五米外的你听得一清二楚。>

        <天青|得意|帅吧？而且很温柔的哦，上次我说想吃草莓大福，第二天就给我带了。>

        <制作人|……你不是说那是顺路买的吗？>

        <天青|不满|顺路买的难道就不算温柔了吗！>

        <天青|卖萌|而且你看那个站姿，是不是特别好看，我之前偷偷拍过背影发群里，你们都点赞了的。>

        <同学|那是天青你逼我们点的……>

        <天青|不满|我没有逼！我只是说，你们不点赞的话我会伤心而已！>
        <CG|璀璨笑容>
        <旁白|她说完也不等回应，转身小跑过来，裙摆随着动作扬起又落下，黑色连裤袜在阳光下泛着柔和的雾面光泽。>
        <旁白|她在离你还有两步远的地方停住，仰起脸，刘海被风吹得有点乱，露出一小截干净的额头。>

        <天青|微笑|让你久等了，辛苦啦。>

        <旁白|她的语气轻飘飘的，像在说今天天气不错。但她看你的眼神里带着某种毫不掩饰的满足，像一只成功把漂亮羽毛展示给全世界的小孔雀。>
        <旁白|她转身把你推到同学面前，动作理直气壮得像在展示自己养的宠物。>

        <天青|高兴|介绍一下，这是我的制作人。>

        <旁白|她的手圈住你的手臂，手指扣在你外套的袖口，那个动作亲密到不像艺人和制作人，倒像女朋友在宣示主权。>

        <天青|得意|长得好看吧？对我也超好的。今天还专门来接我放学，带了热可可。>

        <旁白|她抽走一杯热可可喝了一口，满足地叹了口气，然后故意把杯子举到同学面前晃了晃。>

        <天青|得意|我的制作人会记得我喜欢喝什么，还会算好时间，让我出来的时候刚好是最好喝的温度。羡慕吗？>

        <同学|天青你也太离谱了吧，人家制作人不是工作关系吗？>

        <天青|不满|工作关系怎么了，工作关系也可以很好啊。>

        <天青|星星眼|而且我跟你说哦，我制作人比你们见过的任何男朋友都靠谱一百倍。>

        <天青|卖萌|他会帮我检查作业，会在我练习的时候给我买宵夜，还会……>

        <旁白|她顿了顿，脸上浮出一个狡黠的笑。>

        <天青|卖萌|嗯，剩下的不告诉你们。>

        <同学|天青，你这是在……炫耀吧？>

        <天青|得意|是啊。>

        <旁白|她的嘴角翘起一个角度，那个笑容里没有任何心虚或不好意思，只有一种透明的、几乎可以说是嚣张的满足感。>

        <天青|完全胜利|我就是在炫耀。>

        <旁白|她侧过头，视线从同学们脸上扫过，最后停在你的侧脸上，停顿了半秒。>

        <天青|微笑|因为我的制作人真的很厉害。>

        <旁白|她的几个同学集体发出了一声意味复杂的「哇」。>

        <同学|好了好了，知道了，你们关系好、你制作人帅、你人生赢家，可以了吧？>

        <天青|高兴|不可以。>

        <天青|卖萌|还没夸够。>
		</CG>
    </summernight_maintext>

    <summernight_branches>
        [「行了行了，该回去排练了」]
        [无奈又好笑地摸摸她的头]
        [「你同学都快被你说服了」]
    </summernight_branches>

    <summernight_snapshots>
        校门口接天青放学，天青当众向同学炫耀制作人并表现出明显亲近与占有欲。
    </summernight_snapshots>

    <UpdateVariable>
        <summernight_variables>
        _.set('stat_data.时间.天数', 1)
        _.set('stat_data.时间.具体时间', [16, 0])
        _.set('stat_data.时间.星期', '一')
        _.set('stat_data.地点', '校园')
        _.set('stat_data.名气.阶段', '地下偶像期')
        </summernight_variables>
    </UpdateVariable>
</summernight>`;

  window.天青_openings_defaults = [
    {
      id: 'school-gate',
      title: '校门口',
      subtitle: '三月末 · 接天青放学',
      coverBgId: '校园',
      coverExpr: '完全胜利',
      raw: RAW_SCHOOL_GATE,
    },
    {
      id: 'opening-2',
      title: '开局二',
      subtitle: '占位 · 敬请期待',
      coverBgId: '公园',
      coverExpr: '微笑',
      placeholder: true,
      raw: '',
    },
    {
      id: 'opening-3',
      title: '开局三',
      subtitle: '占位 · 敬请期待',
      coverBgId: '海边',
      coverExpr: '星星眼',
      placeholder: true,
      raw: '',
    },
    {
      id: 'opening-4',
      title: '开局四',
      subtitle: '占位 · 敬请期待',
      coverBgId: '教室',
      coverExpr: '思考',
      placeholder: true,
      raw: '',
    },
    {
      id: 'opening-5',
      title: '开局五',
      subtitle: '占位 · 敬请期待',
      coverBgId: '咖啡馆',
      coverExpr: '害羞',
      placeholder: true,
      raw: '',
    },
    {
      id: 'opening-6',
      title: '开局六',
      subtitle: '占位 · 敬请期待',
      coverBgId: '宿舍',
      coverExpr: '卖萌',
      placeholder: true,
      raw: '',
    },
    {
      id: 'opening-7',
      title: '开局七',
      subtitle: '占位 · 敬请期待',
      coverBgId: '商业街',
      coverExpr: '高兴',
      placeholder: true,
      raw: '',
    },
  ];

  var STORE_KEY = 'tq_plus_openings';

  function resolveBgUrl(bgId) {
    if (!bgId) return '';
    var map = window.天青_backgrounds || {};
    var band =
      window.天青_state && window.天青_state.getTimeBand
        ? window.天青_state.getTimeBand()
        : '白日';
    var bands = [band, '白日', '黄昏', '夜晚'];
    for (var i = 0; i < bands.length; i++) {
      var u = map[bgId + '·' + bands[i]];
      if (u) return u;
    }
    return '';
  }

  /**
   * 从开局正文提取最上层封面：
   * - 地点：首个 <背景|地点|…>
   * - 表情：首个非旁白/背景的 <角色|表情|正文>
   */
  function extractCoverFromRaw(raw) {
    var text = String(raw || '');
    var coverBgId = '';
    var coverExpr = '';
    var bgM = text.match(/<\s*背景\s*\|\s*([^|>\n]+)\s*(?:\|[^>]*)?>/);
    if (bgM) coverBgId = String(bgM[1] || '').trim();

    var re = /<\s*([^|>\n\/]+)\s*\|\s*([^|>\n]+)\s*\|\s*([^>]*)>/g;
    var m;
    while ((m = re.exec(text))) {
      var who = String(m[1] || '').trim();
      var expr = String(m[2] || '').trim();
      if (!who || !expr || expr === '-') continue;
      if (who === '背景' || who === '旁白' || who === '旁白。') continue;
      if (/^cg$/i.test(who)) continue;
      coverExpr = expr;
      break;
    }
    return { coverBgId: coverBgId, coverExpr: coverExpr };
  }

  function applyCoverFromRaw(op) {
    if (!op) return op;
    var extracted = extractCoverFromRaw(op.raw);
    if (extracted.coverBgId) op.coverBgId = extracted.coverBgId;
    if (extracted.coverExpr) op.coverExpr = extracted.coverExpr;
    return op;
  }

  function cloneOpening(op) {
    if (!op || typeof op !== 'object') return null;
    return applyCoverFromRaw({
      id: String(op.id || ''),
      title: String(op.title || ''),
      subtitle: String(op.subtitle || ''),
      coverBgId: String(op.coverBgId || ''),
      coverExpr: String(op.coverExpr || ''),
      coverUrl: op.coverUrl ? String(op.coverUrl) : '',
      placeholder: !!op.placeholder,
      raw: String(op.raw || ''),
    });
  }

  function cloneList(list) {
    return (list || []).map(cloneOpening).filter(Boolean);
  }

  function normalizeList(list) {
    var out = [];
    var seen = Object.create(null);
    (list || []).forEach(function (op, i) {
      var item = cloneOpening(op);
      if (!item) return;
      if (!item.id) item.id = 'opening-' + Date.now() + '-' + i;
      var base = item.id;
      var n = 1;
      while (seen[item.id]) {
        item.id = base + '-' + n;
        n += 1;
      }
      seen[item.id] = true;
      if (!item.title) item.title = '开局 ' + (out.length + 1);
      out.push(item);
    });
    return out;
  }

  function loadStored() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      var list = Array.isArray(data) ? data : data && data.list;
      if (!Array.isArray(list) || !list.length) return null;
      return normalizeList(list);
    } catch (e) {
      return null;
    }
  }

  function persist() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ version: 1, list: cloneList(window.天青_openings) }),
      );
    } catch (e) {}
  }

  var stored = loadStored();
  window.天青_openings = stored || cloneList(window.天青_openings_defaults);

  /** 兼容旧代码：默认开局正文 */
  window.天青_opening =
    (window.天青_openings[0] && window.天青_openings[0].raw) || RAW_SCHOOL_GATE;

  function syncCompatRaw() {
    var first = window.天青_openings[0];
    window.天青_opening = (first && first.raw) || RAW_SCHOOL_GATE;
  }

  function findIndex(id) {
    var list = window.天青_openings || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return i;
    }
    return -1;
  }

  window.天青_opening_api = {
    list: function () {
      return cloneList(window.天青_openings);
    },
    get: function (id) {
      var list = window.天青_openings || [];
      if (id) {
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].id === id) return cloneOpening(list[i]);
        }
      }
      return list[0] ? cloneOpening(list[0]) : null;
    },
    getRaw: function (id) {
      var op = this.get(id);
      if (op && op.raw) return String(op.raw);
      return String(window.天青_opening || '');
    },
    coverUrl: function (op) {
      if (!op) return '';
      if (op.coverUrl) return String(op.coverUrl);
      var o = cloneOpening(op);
      return resolveBgUrl((o && o.coverBgId) || '校园');
    },
    spriteUrl: function (op) {
      if (!op) return '';
      var o = cloneOpening(op);
      var expr = (o && o.coverExpr) || '';
      if (!expr) return '';
      var map = window.天青_expressions || {};
      return map[expr] || '';
    },
    extractCover: extractCoverFromRaw,
    placeOptions: function () {
      var map = window.天青_backgrounds || {};
      var set = Object.create(null);
      Object.keys(map).forEach(function (k) {
        var place = String(k).split('·')[0];
        if (place) set[place] = true;
      });
      return Object.keys(set).sort();
    },
    exprOptions: function () {
      var map = window.天青_expressions || {};
      return Object.keys(map).sort();
    },
    replaceAll: function (list) {
      var next = normalizeList(list);
      if (!next.length) return false;
      window.天青_openings = next;
      syncCompatRaw();
      persist();
      return true;
    },
    add: function (partial) {
      var list = window.天青_openings || [];
      var item = cloneOpening(
        partial || {
          title: '新开局',
          subtitle: '占位 · 敬请期待',
          placeholder: true,
          raw: '',
        },
      );
      if (!item.id) item.id = 'opening-' + Date.now();
      if (!item.title) item.title = '开局 ' + (list.length + 1);
      list.push(item);
      window.天青_openings = list;
      syncCompatRaw();
      persist();
      return cloneOpening(item);
    },
    update: function (id, patch) {
      var i = findIndex(id);
      if (i < 0) return null;
      var cur = window.天青_openings[i];
      var next = cloneOpening(Object.assign({}, cur, patch || {}, { id: cur.id }));
      window.天青_openings[i] = next;
      syncCompatRaw();
      persist();
      return cloneOpening(next);
    },
    remove: function (id) {
      var list = window.天青_openings || [];
      if (list.length <= 1) return false;
      var i = findIndex(id);
      if (i < 0) return false;
      list.splice(i, 1);
      window.天青_openings = list;
      syncCompatRaw();
      persist();
      return true;
    },
    move: function (id, dir) {
      var list = window.天青_openings || [];
      var i = findIndex(id);
      if (i < 0) return false;
      var j = i + (dir < 0 ? -1 : 1);
      if (j < 0 || j >= list.length) return false;
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
      window.天青_openings = list;
      syncCompatRaw();
      persist();
      return true;
    },
    resetDefaults: function () {
      window.天青_openings = cloneList(window.天青_openings_defaults);
      syncCompatRaw();
      persist();
      return this.list();
    },
  };
})();
