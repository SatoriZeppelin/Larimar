# Larimar · SummerNight Plus

独立运行的天青 Galgame 网页：填入 API、导入预设/世界书后即可游玩。

仓库地址：[SatoriZeppelin/Larimar](https://github.com/SatoriZeppelin/Larimar)

## 快速开始

1. 用浏览器打开 `index.html`（若 `file://` 受限，可用 `npx serve .`）
2. 打开 **设置**，填写 API URL / 密钥 / 模型
3. （推荐）导入 SillyTavern 预设、世界书或角色卡
4. 从标题界面开始新游戏，或继续已有进度

若浏览器报 CORS，可在本机启动可选代理：

```bash
cd proxy
npm start
```

## 目录概览

```
├── index.html       # 入口
├── backend/         # 解析、API、预设、存档
├── interface/       # 舞台、设置、标题界面
├── resource/        # 立绘 / 背景 / CG 等资源表
├── proxy/           # 可选 CORS 代理
└── preset/          # 预设说明
```

## 说明

- 不依赖 SillyTavern / MVU，可单独部署（含 GitHub Pages）
- 系统图标等资源见 `resource/system.js`（Hugging Face 在线链接）
