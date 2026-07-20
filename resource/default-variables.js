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
      "具体时间": [
        16,
        0
      ]
    },
    "地点": "校园",
    "名气": {
      "阶段": "地下偶像期"
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
    "名气\u0000阶段": {
      "varName": "名气.阶段",
      "comment": "分为'地下偶像期' | '正式出道期' | 'MV突破期' | '专辑稳定期'，仅在达成条件的情况下允许变动"
    },
    "时间\u0000具体时间": {
      "varName": "时间.具体时间",
      "comment": "以[小时,分钟]的形式显示"
    }
  }
};
