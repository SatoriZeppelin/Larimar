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

  var RAW_MV_PLANNING = String.raw`<summernight>
    <summernight_maintext>
        <背景|事务所办公室|事务所工作室>
        <旁白|七月的阳光把工作室的窗户晒得发烫，空调的冷气从你背后的出风口吹过来，带着一股干燥的塑料味。>
        <旁白|天青把企划书摊在桌面上，手指压住纸张边角，指甲上涂着浅蓝色的指甲油，在白纸的反光里显得几乎透明。>
        <旁白|她刚才说了十五分钟，中间没有停顿喝水，桌上那瓶矿泉水的瓶盖还紧紧拧着。>
        <旁白|企划书被她翻到了第三页，上面贴满了从杂志上剪下来的海边风景照片，有些被她用荧光笔圈出来，写着「这里」「这个角度」「日落时分」之类的备注。>
        <旁白|她的头发从肩膀滑下来，发尾的蓝色在窗户透进来的光线里像一片浅海的倒影。那个黑色的蝴蝶结发饰别在耳朵上方，她讲话的时候会轻轻晃动，像一只正在扇翅膀的小蝴蝶。>

        <天青|自信|「小镇叫真浦町，我查过了，从东京坐新干线再转地方线，三个半小时能到。」>

        <旁白|她的手指划过企划书上的地图，指甲轻轻敲了敲某个被红笔圈住的点。那个点旁边写着「防波堤」，字迹是她的，圆润的笔画带着一点向上翘的尾巴。>

        <天青|微笑|「海边有一条石头铺的坡道，两边都是卖渔具和冰淇淋的小店，特别有昭和年代的感觉。」>
        <天青|得意|「坡道走到底是一个小码头，码头尽头有个灯塔，傍晚的时候逆光拍特别好看。」>

        <旁白|她翻到下一页。上面贴着一张照片，是从网上找的小镇全景图，远处的山脉被夏天的雾气模糊成青灰色的剪影，近处的海面平静得像一块摊开的绸缎。>

        <天青|星星眼|「我想拍你递给我汽水的手，拍我们一起走过小镇坡道时地上的影子，拍我在码头唱副歌的时候，镜头后面有一团蓝色星光。」>

        <旁白|她一条一条地数着，声音轻快得像在念购物清单，但说出来的每一个画面都太具体了。>
        <旁白|具体到你几乎能看见那些尚未存在的镜头——便利店冰柜前被冷气冻得起雾的汽水瓶，午后阳光把两个人的影子拉得很长很长，以及码头尽头那个抱着吉他唱歌的女孩背后，某一团正在缓慢呼吸的深蓝色星空。>

        <天青|俏皮|「不要先皱眉哦，我已经帮你把反对意见准备好了。」>
        <天青|做鬼脸|「比如，『制作人出境不太好』，『会让粉丝误会』，『MV焦点应该放在Larimar身上』，『后期宣传会很麻烦』。嗯嗯，我都听见了，木头制作人的标准四连。」>

        <旁白|她模仿你惯用的严肃语气，眉头微微皱起，下巴端得四平八稳，那表情有七分像、三分夸张，看起来又欠揍又可爱。>
        <旁白|然后她撑不住自己笑起来，肩膀抖了抖，黑蓝渐变的长发从肩头滑落，发尾那一截透明的浅蓝在窗外照进来的日光里泛着温润的光泽。>
        <旁白|企划书的第五页是一张手绘的分镜图，线条有些歪歪扭扭，但能看出画的是两个人走在坡道上的背影，一高一矮，影子拉得很长，在石板路上交叠成一个复杂的形状。>
        <旁白|她的手指点了点那张图。>

        <天青|自信|「但是我全部都想好了。后期的时候，你的脸可以用特效处理掉。」>
        <天青|得意|「不是那种打普通马赛克的丑方法——我找了个做Motion Graphics的朋友问过了，可以做成蓝色星空墨水在水里化开的那种效果。」>
        <天青|微笑|「就像把一滴靛蓝颜料滴进清水里，你的五官会被那团流动的深蓝色覆盖住。每一帧的形状都不一样，会呼吸，会流动。」>

        <旁白|她说「呼吸」和「流动」的时候，手在空气中比划了一下，像是在描绘一团真实存在的蓝色雾气。>

        <天青|微笑|「这样观众看到的就只有你的轮廓和身形，大家只知道『有一个和Larimar一起走在海滩上的人』，不知道是谁。」>
        <天青|害羞|「但我知道。看MV的时候我知道那是你。」>

        <旁白|她的声音在最后那几个字变得很轻，轻得像海风吹过贝壳时发出的声音。但她没有移开视线，那双浅蓝色的眼睛直直地看着你，里面没有任何躲闪或者试探。>
        <旁白|空调的风吹过企划书的纸张边缘，发出很轻的沙沙声。桌上的马克笔滚动了一下，撞到了那瓶没有打开的矿泉水，停住了。>
        <旁白|她站起来，绕过桌子走到窗边。她的身高刚好让头顶的发旋被斜射进来的阳光照亮，黑发和蓝发的分界线在那个角度显得格外清晰，像一道潮汐的痕迹。>

        <天青|自信|「整支MV的概念就是『夏天、海、和你一起的约定』，少了你就不完整。」>
        <天青|微笑|「你在里面不需要做任何事，就坐在那里就好了，坐在防波堤上让海风吹着，我来负责所有需要演的部分。」>

        <旁白|她转过身，背对着窗户，脸上的表情被逆光遮去了大半。但你能看到她嘴角的形状，带着一点故意的挑衅，也带着一点理直气壮的任性。>
        <旁白|她把双手撑在窗台上，手指轻轻敲击着白色的窗框。>

        <天青|得意|「怎么样？有没有被我说服？」>
        <天青|俏皮|「还是你要继续假装在认真思考然后用一堆专业术语来婉拒我？」>
    </summernight_maintext>

    <summernight_branches>
        [「先让我看看真浦町的完整企划」]
        [「你从一开始就没打算让我拒绝吧」]
        [无奈又好笑地揉了揉眉心]
    </summernight_branches>

    <summernight_snapshots>
        七月午后的事务所工作室，天青向制作人推销真浦町海边 MV 企划，坚持要制作人出镜并用蓝色星空特效处理面部。
    </summernight_snapshots>

    <UpdateVariable>
        <summernight_variables>
        _.set('stat_data.时间.天数', 1)
        _.set('stat_data.时间.具体时间', [14, 0])
        _.set('stat_data.时间.星期', '二')
        _.set('stat_data.地点', '事务所办公室')
        _.set('stat_data.名气.阶段', '地下偶像期')
        </summernight_variables>
    </UpdateVariable>
</summernight>`;

  var RAW_CHURCH_BRIDE = String.raw`<summernight>
    <summernight_maintext>
        <背景|教堂|教堂>
        <旁白|彩色玻璃把正午的阳光切割成不规则的色块，红、蓝、金、紫，斜斜地落在白色大理石地砖上。>
        <旁白|摄影师正在调整三脚架的高度，助理举着反光板来回移动，试图找到最佳的补光角度。>
        <旁白|祭坛前的红毯上，婚纱的裙摆铺开一整片白色浪花。层叠的欧根纱在地砖上堆出柔软的弧度，束身的胸衣把腰收成一握的宽度，锁骨和肩线完全裸露，皮肤白得像冰镇过的牛奶。>
        <旁白|银白色从发根淌下来，到发尾处沉成透明的湖蓝，卷曲的长发铺在婚纱背后，和裙摆的白混在一起。>
        <旁白|你推开教堂侧门走进来的瞬间，那束白色马蹄莲捧花的角度歪了一下，然后被她自己纠正过来。>
        <旁白|造型师的细毛刷还在颧骨上扫过，带出一层淡淡的珠光。但那双浅蓝色的眼睛已经越过化妆师的肩膀，越过正在搬运打光板的工作人员，准确地钉在你站着的位置。>

        <天青|婚纱俏皮|「麻烦让一让。」>

        <旁白|侧身绕过造型师，婚纱裙摆的重量让动作变得笨拙，鱼骨撑起的裙撑在转向时发出悉悉索索的摩擦声。高跟鞋踩在大理石地面上，清脆的声响在挑高的教堂穹顶里回荡。>

        <天青|婚纱开心|「制作人！」>

        <旁白|裙摆像融化的冰激凌一样摊在地上。头顶的水晶皇冠折射出细碎的光斑，有几颗落在睫毛尖上。>

        <天青|婚纱生气|「怎么这个时间才到？」>

        <旁白|嘴角翘起的弧度出卖了语气里的抱怨。手指扣进衬衫袖口和手腕之间的缝隙，指尖冰凉，大概是在空调开得太足的化妆间待太久了。>
        <旁白|摄影师抬起头，镜头后面的眼睛在你们两个人之间来回移动。几个工作人员停下手里的动作，有人交换了一个意味不明的眼神。>

        <天青|婚纱自豪|「这是我制作人。」>

        <旁白|转向摄影师，像在介绍一件珍藏品。婚纱的拖尾在转身时划出一个漂亮的圆弧，裙摆下隐约露出一截白色缎面高跟鞋的尖头。>

        <天青|婚纱俏皮|「等下我想拍几张有他的。」>
        <摄影师|「呃……今天的拍摄主题是单人婚纱宣传照……」>
        <天青|婚纱wink|「我知道。」>

        <旁白|点头，语气理所当然。>

        <天青|婚纱开心|「所以他不用露脸啊。只要拍到手就可以了。比如他帮我整理头纱的手，或者我们手指交叠的特写，又或者他从背后环住我腰的构图。」>

        <旁白|捧花被夹在腋下，腾出来的两只手在空气中描绘那些尚不存在的画面。银白蓝渐变的长发从肩膀滑落，垂在婚纱的前襟上，衬得锁骨更加单薄透明。>

        <天青|婚纱俏皮|「反正宣传照需要故事感嘛。'幸福的新娘'和'被爱着的新娘'是不一样的概念。有另一个人的存在，画面的情感浓度会更高。」>

        <旁白|转头看你，眼神亮晶晶的。>

        <天青|婚纱开心|「对吧？」>

        <旁白|造型师手里拿着一支唇釉走过来，看见那抓着你袖口不放的姿势，犹豫了一下，没有靠近。>

        <天青|婚纱wink|「而且。」>

        <旁白|声音变轻了一点。不是故意压低的暧昧，只是单纯的音量下降，像在说什么只有你们两个人能听见的话。>

        <天青|婚纱俏皮|「你知道我为什么会接这个工作吗？」>

        <旁白|没等你回答。>

        <天青|婚纱歌唱开心|「因为是婚纱啊。」>

        <旁白|松开你的袖口，退后半步，双手张开，让你看清楚身上这套礼服。裙摆在动作中荡开，欧根纱的层叠像一朵正在绽放的白色花瓣。胸口的蕾丝刺绣在侧面打来的灯光下透出淡淡的金线。>

        <天青|婚纱开心|「婚纱企划，能穿婚纱，能在教堂拍照，能假装一天的新娘。」>

        <旁白|语调轻快得像在念一份菜单。>

        <天青|婚纱俏皮|「然后我想，如果能让你也出镜的话，」>

        <旁白|顿了一下，浅蓝色的眼睛直直地看着你，里面没有半点躲闪。>

        <CG|花海>
        <天青|婚纱开心|「那就更完美了。」>
        </CG>

        <旁白|彩色玻璃窗投下的光斑正好落在她的脸上，把左半边面颊染成温暖的金红色。皇冠上的碎钻在那个角度折射出细密的彩虹，像一层薄薄的极光覆盖在银蓝色长发上。>

        <天青|婚纱wink|「反正只是拍手嘛。」>

        <旁白|伸出自己的手，手心向上，手指微微蜷曲。>

        <天青|婚纱俏皮|「制作人的手很好看的，修长，骨节分明。拍出来肯定很上镜。」>

        <旁白|摄影师放下手里的相机，用一种「我不知道该怎么处理这个局面」的眼神看向你们俩。助理假装在整理器材，但耳朵明显竖起来了。>
        <旁白|往前迈了一步，婚纱的裙摆蹭过你的裤脚。仰起脸，假发的卷曲末梢蹭过肩膀，皇冠上的吊坠轻轻晃动。>

        <天青|婚纱开心|「就当是帮我一个忙好了。」>

        <旁白|声音很轻，轻得像花瓣落在水面上。>

        <天青|婚纱俏皮|「穿婚纱的机会不是每天都有的。如果这一次身边没有你的话，我会觉得很可惜。」>

        <旁白|说「很可惜」的时候，语气里没有任何撒娇或者恳求的成分。只是陈述一个事实，就像在说「如果今天下雨我会觉得很可惜」一样自然。>
        <旁白|眨了眨眼，嘴角的弧度变得有点狡黠。>

        <天青|婚纱wink|「当然，如果你坚持要拒绝的话，我也不会强迫你。」>

        <旁白|手指轻轻碰了一下你的手背，冰凉的触感一闪而过。>

        <天青|婚纱委屈|「只是以后每次看到这套婚纱照的时候，我都会想起来今天制作人不肯配合我，然后我会叹气，会难过，会在深夜的时候翻出来看，会跟粉丝说'其实这套照片本来可以更完美的'。」>

        <旁白|表情变得非常无辜。>

        <天青|婚纱俏皮|「你忍心吗？」>
    </summernight_maintext>

    <summernight_branches>
        [「只拍手，不许再得寸进尺」]
        [「这哪是帮忙，分明是蓄谋已久」]
        [伸手替她理了理歪掉的头纱]
    </summernight_branches>

    <summernight_snapshots>
        正午的教堂婚纱宣传照拍摄，天青穿婚纱向制作人撒娇，坚持要拍两人手部互动镜头。
    </summernight_snapshots>

    <UpdateVariable>
        <summernight_variables>
        _.set('stat_data.时间.天数', 47)
        _.set('stat_data.时间.具体时间', [12, 0])
        _.set('stat_data.时间.星期', '六')
        _.set('stat_data.地点', '教堂')
        _.set('stat_data.名气.阶段', '正式出道期')
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
      title: 'MV企划',
      subtitle: '七月午后 · 真浦町海边',
      coverBgId: '事务所办公室',
      coverExpr: '自信',
      raw: RAW_MV_PLANNING,
    },
    {
      id: 'opening-3',
      title: '婚纱拍摄',
      subtitle: '正午 · 教堂宣传照',
      coverBgId: '教堂',
      coverExpr: '婚纱俏皮',
      raw: RAW_CHURCH_BRIDE,
    },
  ];

  var STORE_KEY = 'tq_plus_openings';
  var STORE_VERSION = 4;
  var REMOVED_BUILTIN_IDS = ['opening-4', 'opening-5', 'opening-6', 'opening-7'];

  function defaultIdsSet() {
    var set = Object.create(null);
    (window.天青_openings_defaults || []).forEach(function (d) {
      if (d && d.id) set[d.id] = true;
    });
    return set;
  }

  /** 用内置默认开局覆盖同 id 缓存项，保留用户自建开局 */
  function mergeWithDefaults(storedList) {
    var defaults = cloneList(window.天青_openings_defaults);
    var defById = Object.create(null);
    defaults.forEach(function (d) {
      defById[d.id] = d;
    });
    var builtinIds = defaultIdsSet();
    var result = [];
    var seen = Object.create(null);

    (storedList || []).forEach(function (s) {
      if (!s || !s.id) return;
      if (REMOVED_BUILTIN_IDS.indexOf(s.id) >= 0) return;
      var item =
        builtinIds[s.id] && defById[s.id] ? cloneOpening(defById[s.id]) : cloneOpening(s);
      result.push(item);
      seen[s.id] = true;
    });

    defaults.forEach(function (d, idx) {
      if (seen[d.id]) return;
      var insertAt = Math.min(idx, result.length);
      result.splice(insertAt, 0, cloneOpening(d));
    });

    return normalizeList(result);
  }

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
      var version = Array.isArray(data) ? 1 : (data && data.version) || 1;
      return { version: version, list: normalizeList(list) };
    } catch (e) {
      return null;
    }
  }

  function persistList(list) {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ version: STORE_VERSION, list: cloneList(list) }),
      );
    } catch (e) {}
  }

  function persist() {
    persistList(window.天青_openings);
  }

  var loaded = loadStored();
  if (!loaded) {
    window.天青_openings = cloneList(window.天青_openings_defaults);
    persist();
  } else if (loaded.version < STORE_VERSION) {
    window.天青_openings = mergeWithDefaults(loaded.list);
    persist();
  } else {
    window.天青_openings = loaded.list;
  }

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
