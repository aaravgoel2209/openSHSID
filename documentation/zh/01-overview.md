# 01 — 概述与架构

> 相关文档：[目录](index.md) · [快速开始](02-quickstart.md) · [后端](03-backend.md) · [API](04-backend-api.md) · [前端](05-frontend.md) · [模型服务](06-model-service.md) · [部署](07-deployment.md) · [开发规范](08-development.md)

## 1. 项目概述

OpenSHSID 是面向 SHSID 师生的一体化校园平台，主要功能包括：

| 功能 | 说明 |
|---|---|
| **问答**（`qa`） | 提问、回答、嵌套回复、点赞、浏览、标签、个性化排序 |
| **知识库**（`knowledge`） | 按年级/学科筛选的文章、评论、点赞、搜索、自动翻译 |
| **AI 助手「Rei」** | 基于大语言模型的对话，支持对知识库 / 问答区 / 记忆库的 RAG 检索；流式回答；在问答回复中 @Rei 即可召唤 |
| **OCR 工具箱** | 上传 PDF/图片 → OCR 转 Markdown → 高亮区域 → 用大模型总结 → 存入知识库 |
| **站内私信**（`chat`） | 一对一对话，未读计数与通知 |
| **贴吧**（`postbar`） | 类 Reddit 的子吧、帖子、嵌套回复、吧务管理 |
| **通知中心**（`notifications`） | 由 Django signal 驱动的回答 / 回复 / 点赞 / 私信收件箱 |
| **LinkedClassroom**（`crawler`） | Moodle 课程浏览：个人凭据、课程/章节/活动同步、图片与文件代理 |
| **管理后台** | 仅 staff 可用的内容与用户管理、周榜用户 |

产品共有 **四种形态**：网页 SPA（含 PWA）、Electron 桌面应用、Cordova Android/iOS 应用 —— 全部基于同一套 React 前端。

## 2. 系统架构

系统由**三个后端进程**和**一个前端**组成：

```
┌─────────────────────────────────────────────────────────────────────┐
│  前端（React + Vite）                                                │
│  • Web SPA / PWA      （开发 :5173，Docker 中 :80）                  │
│  • Electron 桌面应用   （renderer = 前端副本）                        │
│  • Cordova Android/iOS（build:cordova → 原生 WebView）               │
└───────┬──────────────────────┬───────────────────────┬──────────────┘
        │ /api /admin /media   │ /rei /click /translate│ /ocr /summarize
        ▼                      ▼                       ▼
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ Django REST API │   │ Flask 模型服务        │   │ OCR 微服务           │
│ 端口 19424      │   │ 端口 5000            │   │ 端口 5001            │
│ • 7 个 app      │   │ • Rei LLM 对话（SSE）│   │ • baidu Unlimited-OCR│
│ • SQLite        │   │ • RAG 检索           │   │ • 需要 CUDA GPU      │
│ • Token 认证    │   │ • 推荐排序           │   │ • 图片/PDF → Markdown│
└─────────────────┘   │ • 翻译               │   └──────────────────────┘
                      └──────────────────────┘
```

**关键集成点：**

- **Django → Flask（model）**：翻译（`/translate`）、总结（`/summarize`）、Rei 回复（`/rei/reply`、`/rei/stream`、`/rei/history`）、推荐（`/rank`、`/click`）。
- **Django → OCR**：`knowledge/ocr_client.py` 调用 OCR 服务进行文档扫描。
- **Flask（model）→ Django**：RAG 语料同步拉取文章/问题（`GET /api/knowledge/articles/`、`/api/qa/questions/`），工具函数调用 Django API（`kb_read`、`qa_read` 等）。
- **共享密钥**：`REI_SESSION_SECRET`（HMAC）由 Django（`OpenSHSID_backend/rei_session.py`）与 Flask（`model/session_auth.py`）共同用于签发/校验 AI 会话令牌。这两个文件互为副本，**必须保持同步**。
- **共享配置**：Django 与模型服务通过 `config_loader.py` 读取同一个 `config.json`。

## 3. 技术栈

### 后端（Python 3.13）
- **Django 6.0.5** + **Django REST Framework 3.17** —— 纯 JSON REST API
- **SQLite 3**（`db.sqlite3`），启用 WAL 模式与 busy_timeout pragma
- **django-cors-headers**、**DRF authtoken**（Token 认证）
- **gunicorn** —— 生产 WSGI 服务器
- **Flask 3** + **flask-cors** —— AI 模型服务
- **PyTorch** —— 推荐排序模型（BPR 训练）
- **OpenAI SDK + httpx** —— Rei 助手的 LLM 客户端（llama.cpp OpenAI 兼容接口）
- **transformers**（baidu **Unlimited-OCR**）—— OCR，仅支持 CUDA（独立 `model/requirements-ocr.txt`）

### 前端（Node 24, Vite 8）
- **React 19** + **react-router-dom 7**
- **HeroUI 3** 组件库（子路径导入，无需 Provider）
- **Tailwind CSS v4**（`@tailwindcss/vite` 零配置），基于 class 的暗色模式
- **axios** —— HTTP 客户端，带 token 拦截器
- **marked + DOMPurify** —— Markdown 渲染 + XSS 消毒
- **MathJax 3** —— 懒加载的数学公式排版
- **framer-motion** —— 动画
- **vite-plugin-pwa** —— PWA，提示式更新
- **@khvicha/react-liquid-glass** —— 高「UI 复杂度」模式下的玻璃拟态效果

## 4. 仓库结构

```
OpenSHSID-backend/
├── manage.py                       # Django 入口
├── requirements.txt                # 后端 + 模型服务依赖
├── config.json                     # 中央配置（Django 与 Flask 共用）
├── Dockerfile                      # Django 后端镜像（gunicorn :19424）
├── docker-compose.yml              # backend + model + frontend 三个服务
├── start.bat                       # Windows 一键启动脚本（所有服务）
├── scripts/
│   ├── start.ps1                   # PowerShell 启动脚本
│   └── start.sh                    # Bash 启动脚本
├── OpenSHSID_backend/              # Django 项目包
│   ├── settings.py                 # 全部配置读取自 config.json
│   ├── urls.py                     # 根 URLconf
│   ├── config_loader.py            # 加载 config.json，支持 $env 占位符
│   ├── signals.py                  # SQLite pragma、向量初始化、Profile 自动创建
│   ├── moderation.py               # 违禁词内容过滤
│   ├── translation.py              # 通过 Flask /translate 异步翻译
│   └── rei_session.py              # HMAC 会话令牌签发（model/session_auth.py 的镜像）
├── accounts/                       # 认证、用户画像、公告、管理后台、AI 会话
├── qa/                             # 问答社区（含 @Rei 流式回复）
├── knowledge/                      # 知识库 + OCR 流水线 + 排序
├── chat/                           # 站内私信
├── postbar/                        # 类 Reddit 贴吧
├── crawler/                        # LinkedClassroom（Moodle）爬虫
├── notifications/                  # signal 驱动的通知收件箱
├── simpletable/                    # ⚠️ 废弃 app —— 无源码，未注册 INSTALLED_APPS
├── model/                          # Flask AI 服务（独立进程，端口 5000）
│   ├── app.py                      # Flask 路由：/rei/*、/rank、/click、/translate、/summarize
│   ├── SYSTEM.md                   # Rei 系统提示词（人设 + RAG 规则）
│   ├── rag.py                      # 基于向量 + MMR 的 kb/qa/memory 检索
│   ├── database.py                 # 本地 SQLite：记忆库、对话历史、摘要
│   ├── tools.py                    # LLM 函数调用工具（kb/qa/memory/bing/weather）
│   ├── context_budget.py           # 对话上下文的 token 预算装配
│   ├── session_auth.py             # HMAC 会话认证（Django rei_session.py 的镜像）
│   ├── model.py                    # PyTorch 推荐模型（双编码器）
│   ├── train.py                    # BPR 在线训练循环
│   ├── config.py                   # 热度计算 + 向量更新
│   ├── ocr_infer.py                # baidu Unlimited-OCR 封装（CUDA）
│   ├── ocr_service.py              # 独立 OCR 微服务（端口 5001）
│   ├── config_loader.py            # 复用 Django 的配置加载器
│   └── Dockerfile
├── frontend/                       # React 单页应用（见 05-frontend.md）
├── electron/                       # Electron 桌面封装（见 07-deployment.md）
├── cordova/                        # Cordova 移动端封装（见 07-deployment.md）
├── media/                          # 用户上传（头像等）
└── documentation/                  # 本文档
```

> **关于 `simpletable/`**：该目录只残留编译后的 `.pyc` 缓存和一个空的 migrations 目录，**没有任何源码文件**，也**未注册**到 `INSTALLED_APPS`。属于废弃脚手架，可直接删除。

---

**下一篇**：[02 — 快速开始与配置](02-quickstart.md)
