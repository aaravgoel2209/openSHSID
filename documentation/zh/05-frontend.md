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

## 7. 浏览器端多语翻译

文章 / 问答详情页（`ArticleDetail`、`QuestionDetail`）内嵌「翻译」工具条 `MtTranslateBar`：用户在语言下拉里选「日本語」并点翻译按钮后，浏览器端直接跑 OPUS-MT 把正文译成日语——**手动触发**，不会自动翻译，所选目标语言记入 `localStorage`。

### 触发方式

- 工具条出现在文章 / 问答正文上方；源语言为 `zh` / `en` 时启用，其他源语言按钮置灰并显示 `mt.unsupported`。
- 点「翻译」：首次下载模型（显示进度条），完成后切到「翻译中…」；译文就绪后展示「已机器翻译·可能不准确」徽标，并提供「显示原文 / 显示译文」切换。
- 目标语言选择持久化到 `localStorage`，刷新后保留。

### 模型来源：ModelScope 直链

模型**不打包进前端产物，也不走自有服务器**——首次翻译时由浏览器直接从 [ModelScope（魔搭）](https://modelscope.cn/models) CDN 下载：

```js
env.remoteHost = 'https://modelscope.cn/models'
env.remotePathTemplate = '{model}/resolve/master/'   // 结尾斜杠，无 {file}
```

- **服务器零带宽**：Django / Flask 镜像无需任何改动，完全不参与模型分发。
- 单个量化 ONNX 模型首次下载 ~35–80 MB；浏览器 IndexedDB + Cache API 缓存后**离线可用**，二次翻译秒出。
- CDN 链路：`modelscope.cn` → 302 → `cdn-lfs-cn-1.modelscope.cn`（大文件），CORS 与 `Content-Length` 均已实测放行。

### `VITE_MT_MODEL_BASE` 覆盖法

构建时可通过环境变量改写模型来源：

```bash
VITE_MT_MODEL_BASE=https://my-mirror.example.com/models npm run build
```

默认指向 ModelScope。该变量经 `new URL(...).origin` 处理后作为 `env.remoteHost`，仅替换 origin，路径模板仍是 `{model}/resolve/master/`。

### 回退 nginx 反代片段（仅文档，不实现）

正常情况下直连 ModelScope 即可。仅当 ModelScope 实测出现 CORS 失败时，可在自有服务器加一条反代做逃生门，并把 `VITE_MT_MODEL_BASE` 指向自有域：

```nginx
location /mt-models/ {
  proxy_pass https://modelscope.cn/models/;
  add_header Access-Control-Allow-Origin * always;
  add_header Access-Control-Expose-Headers "Content-Length, Accept-Ranges, ETag" always;
  gzip off;
}
```

### Cordova 白名单

`cordova/config.xml` 已加入 `https://*.modelscope.cn/*`，覆盖 ModelScope 源站 + CDN 重定向域（`cdn-lfs-cn-1.modelscope.cn` 等），移动端可直接外网拉取模型。

### 质量免责

- OPUS-MT 是小模型（30–80 MB），翻译质量显著低于服务端 LLM 中英互译；UI 在译文上方明确标注「已机器翻译·可能不准确」。
- **日语路径**：`zh → en`（opus-mt-zh-en）→ `ja`（en-mul 加 `>>jpn<<` 前缀），共两跳、经英语中转；`en → ja` 为单跳（en-mul:>>jpn<<）。
- **韩语未启用**：en-mul 模型不支持 `>>kor<<` 目标前缀（输出会回退到法语等其他语种），故 `MT_TARGETS` 暂时移除 `ko`，工具条只展示「日本語」一项。后续如要启用韩语，需引入真正支持韩语的模型并更新 `resolveChain`。

### 技术栈

- `@huggingface/transformers@^3.8.1`（npm 打包进 worker chunk，懒加载）+ `onnxruntime-web` WASM。
- Web Worker 内执行推理，主线程零阻塞；ONNX WASM 通过 Cache API 缓存。
- IndexedDB 译文缓存：以 `srcLang>target|modelRev|sha256(原文)` 为键，模型版本一变即作废。
- Markdown / LaTeX 占位符保护：翻译前把行内代码、代码块、`$...$`、`$$...$$` 用 PUA 字符替换为占位符，译完再按 id 倒序还原，避免模型破坏公式 / 代码。

## 8. 多目标构建

| 命令 | 产物 | 说明 |
|---|---|---|
| `npm run dev` | — | 开发服务器 :5173，代理到 Django + Flask |
| `npm run build` | `dist/` | Web/PWA 构建 |
| `npm run build:cordova` | `dist-cordova/` | 相对路径 base、HashRouter、无 PWA、`.env.cordova` 后端地址 |

---

**下一篇**：[06 — 模型服务：Flask AI](06-model-service.md)
