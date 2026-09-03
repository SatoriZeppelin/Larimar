/**
 * 默认基础变量——首次载入写入「系统设置·变量」（含 data + meta：变量名/注释）
 * 由 scripts/seed-to-defaults.js 从 seed.json 生成，请勿手改
 * 对外：天青_default_variables
 */
window.天青_default_variables = {
  "__tq": 1,
  "data": {
    "时间": {
      "天数": 1,
      "具体时间": [16, 0],
      "星期": "一"
    },
    "地点": "校园",
    "名气": {
      "twitter": 1000,
      "同接": 200,
      "专辑": [
        ["AOI", 3200],
        ["透明な夜", 8500]
      ],
      "Live": [
        ["下北泽 Shelter", 85],
        ["渋谷 CLUB QUATTRO", 350],
        ["Zepp Haneda", 1200]
      ]
    }
  },
  "meta": {
    "时间\u0000天数": {
      "varName": "时间.天数",
      "comment": "整数"
    },
    "地点": {
      "varName": "地点",
      "comment": "参照标准地点，如无则自建地点"
    },
    "时间\u0000具体时间": {
      "varName": "时间.具体时间",
      "comment": "以[小时,分钟]的形式显示"
    },
    "时间\u0000星期": {
      "varName": "时间.星期",
      "comment": "包含日一二三四五六"
    },
    "名气\u0000twitter": {
      "varName": "名气.twitter",
      "comment": "Twitter/X 粉丝数，整数"
    },
    "名气\u0000同接": {
      "varName": "名气.同接",
      "comment": "最近直播同接人数，整数"
    },
    "名气\u0000专辑": {
      "varName": "名气.专辑",
      "comment": "每条 [专辑名称, 首发销量]；新专辑用 _.append('stat_data.名气.专辑', [\"名称\", 销量]) 追加"
    },
    "名气\u0000Live": {
      "varName": "名气.Live",
      "comment": "每条 [地点, 参加人数]；新现场用 _.append('stat_data.名气.Live', [\"地点\", 人数]) 追加"
    }
  }
};
