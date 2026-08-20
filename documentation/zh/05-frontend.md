# 05 — 前端：React 单页应用

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [快速开始](02-quickstart.md) · [后端](03-backend.md) · [API](04-backend-api.md) · [模型服务](06-model-service.md) · [部署](07-deployment.md) · [开发规范](08-development.md)

## 1. 目录结构

```
frontend/
├── vite.config.js               # 双构建（web/PWA + cordova），6 个开发代理
├── nginx.conf                   # 生产代理：/api /admin /media → 后端
├── Dockerfile                   # node 构建 → nginx 托管
├── .env.cordova                 # 移动端构建的后端地址
├── src/
│   ├── main.jsx                 # React 入口；检测 Electron 桥（window.desktop）
│   ├── App.jsx                  # 路由 + 5 个 Context Provider + 30 条路由（29 个页面）
│   ├── index.css                # Tailwind v4 + HeroUI + 玻璃拟态/主题色/Markdown CSS
│   ├── config.js                # API_BASE / FLASK_BASE / DJANGO_ORIGIN
│   ├── i18n.js                  # 中/英 UI 文案表
│   ├── pwa.js                   # 手动 Service Worker 注册
│   ├── api/                     # 8 个 Axios 模块：client、auth、qa、knowledge、chat、
│   │                            #   postbar、toolbox、crawler、labels、notifications
│   ├── context/                 # Auth、Theme、UI（复杂度）、Toast、Language
│   ├── components/              # Layout、MarkdownView/Input、GlassPanel、Card、
│   │                            #   NotificationBell、AboutDialog、PwaUpdateToast 等
│   ├── pages/                   # 29 个页面组件（见下）
│   ├── hooks/useDebounce.js
│   ├── utils/                   # markdown、mathjax、lang、avatar、clipboard
│   ├── config/prefs.js          # 主题 / 复杂度 / 主题色偏好（跨标签页同步）
│   ├── styles/Admin.css
│   └── assets/                  # 7 张轮播 webp 壁纸、logo
```

## 2. 路由（30 条）

| 路由 | 页面 | 用途 |
|---|---|---|
| `/` | HomeArticles | 首页：文章流（带推荐反馈） |
| `/qa`、`/qa/ask`、`/qa/questions/:id` | Home / AskQuestion / QuestionDetail | 问答 |
| `/knowledge`、`/knowledge/create`、`/knowledge/:id` | KnowledgeBase / CreateArticle / ArticleDetail | 知识库 |
| `/postbar`、`/postbar/b/:subbarId`、`/postbar/posts/:id` | PostbarHome / SubbarDetail / PostDetail | 贴吧 |
| `/toolbox`、`/toolbox/ocr`、`/toolbox/markdown` | Toolbox / OcrScan / MarkdownPreview | OCR + Markdown 工具 |
| `/chat`、`/chat/:userId`、`/chat/ai` | ChatList / ChatDetail / AiChat | 私信 + **Rei AI 对话**（RAG、图片附件、按用户会话） |
| `/mailbox` | Mailbox | 通知收件箱 |
| `/admin`、`/admin/users`、`/admin/content` | AdminDashboard / AdminUsers / AdminContent | 管理后台 |
| `/admin/memory` | MemoryView | Rei 记忆浏览（staff） |
| `/profile`、`/profile/:userId`、`/user/:userId` | Profile | 自己 / 他人主页 |
| `/search` | SearchResults | 全文搜索 |
| `/settings` | Settings | 主题、主题色、UI 复杂度、服务器地址覆盖、头像上传 |
| `/linkedclassroom`、`/linkedclassroom/:courseId` | LinkedClassroom / LinkedClassroomCourse | Moodle 课程浏览 |
| `/login`、`/register` | Login / Register | 认证（**不套** Layout 外壳渲染） |

## 3. API 层

`src/api/client.js` 创建共享的 Axios 实例，并在每个请求上注入 `localStorage` 中的 `Authorization: Token <key>`。功能模块（`auth.js`、`qa.js`、`knowledge.js`、`chat.js`、`postbar.js`、`toolbox.js`、`crawler.js`、`notifications.js`）封装 [04-backend-api.md](04-backend-api.md) 列出的端点。

注意：`toolbox.js` 对 `ocr-scan-stream` 使用原生 `fetch` 流式读取（`response.body.getReader()` 消费 NDJSON），503 时回退到非流式接口。

## 4. 状态与 Context

| Context | 职责 |
|---|---|
| `AuthContext` | token + user 状态；login/register/logout/refreshUser；挂载时拉取画像 |
| `ThemeContext` | 暗色/亮色 + 自定义主题色（8 种预设），通过 `data-accent` 属性生效 |
| `UIContext` | UI 复杂度：`simple` / `normal` / `complex` / `extreme` —— 控制玻璃模糊强度 |
| `ToastContext` | 全局 Toast（`useToast`） |
| `LanguageContext` | 中/英 UI 文案（`t(key)`） |

## 5. 样式系统

- Tailwind v4 CSS-first 配置（无 `tailwind.config.js`）：`@import "tailwindcss"` + `@import "@heroui/styles"` + `@custom-variant dark`。
- **玻璃拟态**：`<html>` 上的 `[data-ui-complexity]` 属性按档位缩放卡片的 `backdrop-filter` 模糊/饱和；`simple` 档完全关闭以兼容低性能设备。
- **自定义主题色**：`html[data-accent]` 将 Tailwind 硬编码的 `blue-*` / `indigo-*` 工具类重映射到 `--user-accent`，全站换色无需改动组件。
- **Markdown**：`.md-body` 恢复被 Preflight 剥掉的排版；MathJax SVG 修正（`display: inline-block`）保证行内公式正常。
- **Electron**：`html.native-blur` 让页面背景透明以露出系统毛玻璃；`.app-topbar` 变为窗口拖拽区域。

## 6. PWA

手动注册 Service Worker（`src/pwa.js`），采用**提示式更新**（`registerType: 'prompt'`）——新版本弹出提示而非静默刷新（避免清空表单状态）。Workbox 的 denylist 保证 `/admin`、`/api`、`/static`、`/rei`、`/click`、`/translate` 不被 SW 当作页面导航拦截。MathJax 首次使用后按 CacheFirst 运行时缓存。

## 7. 多语翻译（服务端）

文章 / 问答详情页（`ArticleDetail`、`QuestionDetail`）内嵌「翻译」工具条 `MtTranslateBar`：用户在语言下拉里选「日本語」并点翻译按钮后，前端 POST 到 Flask 模型服务 `/translate`，由服务端 LLM 完成翻译——**手动触发**，不会自动翻译，所选目标语言记入 `localStorage`。

### 触发方式

- 工具条出现在文章 / 问答正文上方；对任意源语言可用（服务端 LLM 通用翻译，不再限 zh/en）。
- 点「翻译」：显示「翻译中…」；译文就绪后展示「已机器翻译·可能不准确」徽标，并提供「显示原文 / 显示译文」切换。
- 目标语言选择持久化到 `localStorage`，刷新后保留。

### 翻译路径：Flask 模型服务 /translate

前端不跑本地推理、不下载模型权重——`MtTranslateBar` 直接 POST `${FLASK_BASE}/translate`（标题、正文各一个请求）：

```json
{ "text": "...", "target": "ja" }
```

- **零额外部署**：翻译与 Rei 助手共用同一 LLM 推理后端（`_get_rei_client()`），模型由 `config.json` 的 `llm.model_name` 指定。
- `target` 接受任意 ISO 语言代码或英文语言名（如 `ja` / `ko` / `fr` / `German`）；留空时自动中↔英互翻。前端 UI 目前只暴露日语——在 `frontend/src/mt/models.js` 的 `MT_TARGETS` 里加一项（并补 i18n 键）即可扩展更多目标语言。
- 返回 `{ translation, source_lang, target_lang }`；失败返回 `{ error }` + 4xx/5xx。

### 质量免责

- 翻译质量由服务端 LLM 决定，通常显著优于原浏览器端 OPUS-MT 小模型方案；UI 在译文上方明确标注「已机器翻译·可能不准确」。
- 日语直译（无英语中转）；韩语服务端亦支持，但 UI 默认仍只展示「日本語」（如需韩语在 `MT_TARGETS` 中取消注释并补 i18n 键）。

### 技术栈

- 前端：普通 `fetch` 双请求（无 Web Worker / 无 `@huggingface/transformers` / 无 onnxruntime / 无 IndexedDB 译文缓存——每次点击都是一次新的服务端请求）。
- 服务端 `_translate_text()`：数学公式 / 代码先由 `_protect_math()` 抠成 PUA 占位符、译后 `_restore_math()` 还原，MathJax 正常渲染。
- `GET /models` 端点代理 LLM 的模型列表，供「关于」弹窗与设置页的「开发者选项」区块展示当前翻译模型名。

## 8. 多目标构建

| 命令 | 产物 | 说明 |
|---|---|---|
| `npm run dev` | — | 开发服务器 :5173，代理到 Django + Flask |
| `npm run build` | `dist/` | Web/PWA 构建 |
| `npm run build:cordova` | `dist-cordova/` | 相对路径 base、HashRouter、无 PWA、`.env.cordova` 后端地址 |

---

**下一篇**：[06 — 模型服务：Flask AI](06-model-service.md)
