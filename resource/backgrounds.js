/* 地点·时段背景表 · 从旧版.html 抽出 */
window.天青_backgrounds = {
  /* 键 =「地点·时段段」。时段段：白日 / 黄昏 / 夜晚（由 TIME_BAND 从 MVU 时段换算）。
     有夜晚版的地点写两条(白日+夜晚)；只有一版的只写白日，夜晚会自动回落到白日版(见 paintBG)。 */
  "城郊花田·白日":"https://files.catbox.moe/nsjdq1.png",
  "城郊花田·黄昏":"https://files.catbox.moe/csaulb.png",
  "草原·白日":"https://files.catbox.moe/d2zlog.png",
  "雪山·白日":"https://files.catbox.moe/917l5y.png",
  "小镇·白日":"https://files.catbox.moe/335qgh.jpg",
  "街区·白日":"https://files.catbox.moe/5ptc2s.jpg",
  "教室·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%95%99%E5%AE%A4.png",
  "校园·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%A0%A1%E5%9B%AD.png",
  "教堂·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%95%99%E5%A0%82.png",
  "公园·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%85%AC%E5%9B%AD.png",
  "公园·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E5%85%AC%E5%9B%AD.png",
  "海边·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%B5%B7%E8%BE%B9.png",
  "海边·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E6%B5%B7%E8%BE%B9.png",
  "海边小镇·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%B5%B7%E8%BE%B9%E5%B0%8F%E9%95%87.png",
  "海边小镇·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E6%B5%B7%E8%BE%B9%E5%B0%8F%E9%95%87.png",
  "咖啡馆·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%92%96%E5%95%A1%E9%A6%86.png",
  "咖啡馆·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E5%92%96%E5%95%A1%E9%A6%86.png",
  "录音室·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%BD%95%E9%9F%B3%E5%AE%A4.png",
  "录音室·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E5%BD%95%E9%9F%B3%E5%AE%A4.png",
  "宿舍·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%AE%BF%E8%88%8D.png",
  "宿舍·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E5%AE%BF%E8%88%8D.png",
  "商业街·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%95%86%E4%B8%9A%E8%A1%97.png",
  "商业街·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E5%95%86%E4%B8%9A%E8%A1%97.png",
  "事务所办公室·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E4%BA%8B%E5%8A%A1%E6%89%80%E7%9A%84%E5%8A%9E%E5%85%AC%E5%AE%A4.png",
  "事务所办公室·夜晚":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E5%A4%9C%E6%99%9A%E4%BA%8B%E5%8A%A1%E6%89%80%E5%8A%9E%E5%85%AC%E5%AE%A4.png",
  "车内·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E8%BD%A6%E5%86%85.png",
  "电影院·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E7%94%B5%E5%BD%B1%E9%99%A2.png",
  "水族馆·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%B0%B4%E6%97%8F%E9%A6%86.png",
  "舞台·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E8%88%9E%E5%8F%B0.png",
  "舞台后台·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E8%88%9E%E5%8F%B0%E5%90%8E%E5%8F%B0.png",
  "游乐园·白日":"https://huggingface.co/think-denim-frisk/Larimar/resolve/main/%E5%A4%A9%E9%9D%92%E8%83%8C%E6%99%AF/%E6%B8%B8%E4%B9%90%E5%9B%AD.png"
  // 追加地点（单版·白日，夜晚自动回落）
};
