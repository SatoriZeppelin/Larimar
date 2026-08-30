# Larimar · SummerNight Plus

独立运行的天青 Galgame 网页：填入 API、导入预设/世界书后即可游玩。

## 目录概览

```
├── index.html       # 入口
├── backend/         # 解析、API、预设、存档
├── interface/       # 舞台、设置、标题界面
├── resource/        # 立绘 / 背景 / CG 等资源表
├── proxy/           # 可选：本地 CORS 中转（server.js）
└── preset/          # 预设说明
```

- 不依赖 SillyTavern / MVU，可单独部署（含 GitHub Pages）
- API 默认浏览器直连（需密钥）；遇 CORS 时可另开 `proxy/` 本地中转
- 系统图标等资源见 `resource/system.js`（Hugging Face 在线链接）
- 将会在未来加入更多角色（maybe）

## TodoList

- [x] 手机适配（预设 + 世界书）
- [x] 「正在生成」提示（本体）
- [x] 「正在生成」提示（次生）
- [x] 立绘切换延迟
- [x] API 地址两种格式（/v1 根与 /proxy/openai 类；不含 CORS 直连）
- [x] 多首条选择
- [x] 直播（Twitch 手机界面：历史列表 / 手动刷新 / 回放 / 主线挂靠）
- [x] 对话框相对高度位置（窄屏贴底叠工具栏 + 设置滑块）
- [x] 对话框动态设定高度
- [x] 选择界面和 CG 界面的交互
- [x] 重构变量
- [x] 手机界面（SNS、Twitter、直播）
- [ ] LINE 私聊通话「连接」按钮：接入提示词钩子（`onCallConnect`）
- [ ] 傻瓜式添加角色和图片（包括手机部分）
- [ ] 滑动重 roll
- [ ] 手机端支持
- [ ] 文生图支持
- [ ] 多人群聊
