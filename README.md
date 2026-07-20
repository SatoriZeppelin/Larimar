# Larimar · SummerNight Plus

独立运行的天青 Galgame 网页：填入 API、导入预设/世界书后即可游玩。

## 目录概览

```
├── index.html       # 入口
├── backend/         # 解析、API、预设、存档
├── interface/       # 舞台、设置、标题界面
├── resource/        # 立绘 / 背景 / CG 等资源表
├── proxy/           # 可选 CORS 代理
└── preset/          # 预设说明
```

- 不依赖 SillyTavern / MVU，可单独部署（含 GitHub Pages）
- 系统图标等资源见 `resource/system.js`（Hugging Face 在线链接）
- 将会在未来加入更多角色（maybe）

## TodoList

### 近期

- [x] 选择界面和 CG 界面的交互
- [ ] 重构变量
- [ ] 手机界面（SNS、Twitter、直播）
- [ ] 傻瓜式添加角色和图片（包括手机部分）
- [ ] 滑动重 roll
- [ ] 手机端支持

### 中期

- [ ] 文生图支持
- [ ] 多人群聊
