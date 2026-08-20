<p align="center">
  <img src="https://img.shields.io/badge/OpenSHSID-亮色?style=for-the-badge&logo=github&color=informational" alt="OpenSHSID" width="200">
  <img src="https://img.shields.io/badge/Django-6.0.5-green?style=for-the-badge&logo=django" alt="Django">
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/version-a0.7.0-orange?style=for-the-badge" alt="version">
</p>

<h1 align="center">OpenSHSID</h1>

<p align="center">
  <em>上海中学国际部（SHSID）校园网站的新版现代化实现 —— A modern re-implementation of the SHSID website</em>
</p>

<p align="center">
  <a href="documentation/README.md"><b>📖 项目文档（中 / EN）</b></a>
</p>

---

##  功能特性

-  **问答社区** —— 提问、回答、嵌套回复、点赞、标签、个性化排序，回答中 `@Rei` 即可召唤 AI 助手
-  **知识库** —— 按年级 / 学科筛选的文章、评论、搜索，发布内容自动中英互译
-  **AI 助手 Rei** —— 大语言模型对话，RAG 检索知识库 / 问答区 / 持久记忆库，流式输出，支持图片
-  **OCR 工具箱** —— 上传 PDF / 图片，OCR 转 Markdown，区域高亮，AI 总结并一键存入知识库
-  **站内私信** —— 一对一对话，未读计数与通知
-  **贴吧** —— 类 Reddit 的子吧、帖子、嵌套回复、吧务管理
-  **通知中心** —— 回答 / 回复 / 点赞 / 私信实时通知
-  **LinkedClassroom** —— Moodle 课程浏览：课程 / 章节 / 活动同步，图片与文件代理
-  **浏览器端多语翻译** —— 文章/问答详情页一键翻译成日语（OPUS-MT 浏览器端推理，模型从 ModelScope 直链下载，服务器零带宽）
-  **多端形态** —— 网页（含 PWA）、Electron 桌面端、Cordova Android / iOS，同一套前端

##  演示

<p align="center">
  <img src="images/chat.png" alt="演示截图" width="600"/>
  <br/>
  <em>AI 对话界面截图</em>
</p>

---

## 🚀 快速开始

### 环境要求

- Python 3.13 + `pip`
- Node.js ≥ 20 + npm
- （可选）CUDA GPU —— OCR 功能需要
- （可选）可用的 LLM 接口 —— Rei 助手需要，在 `config.json` 中配置

### 一键启动（Windows）

```bat
scripts\start.bat
```

首次运行自动生成 `REI_SESSION_SECRET` 到 `.env.local`，随后依次启动 Flask 模型服务（:5000）、Django（:19424）、React（:5173）。

Linux / macOS：

```bash
./scripts/start.sh
```

### 手动启动（三个终端）

```bash
# 1. Flask 模型服务（:5000）
cd model && python app.py

# 2. Django API（:19424）
python manage.py migrate
python manage.py runserver 19424

# 3. React 开发服务器（:5173）
cd frontend && npm install && npm run dev
```

打开 **http://localhost:5173** 即可访问。

### Docker

```bash
export REI_SESSION_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
docker compose up -d
```

---

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| **后端 API** | Django 6.0.5 · Django REST Framework 3.17 · SQLite（WAL）/ MySQL 二选一 · Token 认证 |
| **AI 模型服务** | Flask · PyTorch（推荐模型，BPR 在线训练） · OpenAI SDK · baidu Unlimited-OCR |
| **前端** | React 19 · Vite 8 · HeroUI 3 · Tailwind CSS v4 · axios · marked + DOMPurify · MathJax |
| **部署** | gunicorn · nginx · Docker Compose · electron-builder · Cordova |

架构概览：**Django**（REST API）与 **Flask**（AI 服务）双后端，共享 `config.json` 配置与 `REI_SESSION_SECRET` 密钥；**React** 前端一套代码构建 Web / PWA / Electron / Cordova 四种形态。

## 📄 文档

完整技术文档见 [`documentation/`](documentation/README.md)，包含中英双语、按模块拆分：

| 文档 | 说明 |
|---|---|
| [概述与架构](documentation/zh/01-overview.md) | 系统架构、技术栈、仓库结构 |
| [快速开始与配置](documentation/zh/02-quickstart.md) | `config.json`、环境变量 |
| [后端 —— Django](documentation/zh/03-backend.md) | App、模型、认证、横切行为 |
| [后端 —— API 参考](documentation/zh/04-backend-api.md) | 全部 `/api/*` 端点 |
| [前端 —— React](documentation/zh/05-frontend.md) | 路由、API 层、样式、PWA |
| [模型服务 —— Flask AI](documentation/zh/06-model-service.md) | Rei、RAG、推荐、OCR |
| [部署](documentation/zh/07-deployment.md) | Docker、Electron、Cordova |

---

## 📌 开发须知

### Commit 规范

Commit 主题必须以阶段标签开头：

```text
Phrase (phrase代号) x.x.x pre(version) p(part) c(correction) fork-(fork) (merge)
```

例如：

```
Alpha a0.7.0pre2 Added Markdown previewer
Alpha a0.6.3 part2 p1 fixed cordova android preparing for ios
```

阶段为 0 的标签可以省略；没有该头的提交一律不通过。

### 约定

- Python 使用 **Black** 格式化；模型变更记得 `makemigrations` + `migrate`
- 前端使用 ESLint，HeroUI 组件走子路径导入（如 `@heroui/react/button`）
- `OpenSHSID_backend/rei_session.py` 与 `model/session_auth.py` 互为镜像，务必保持同步

---

## 📝 说明

- 项目处于 **Alpha** 阶段（当前 `a0.7.0`），部分默认配置面向开发环境，公网部署前请参考文档「已知限制」一节加固
- 详细部署与运维细节见 [`documentation/`](documentation/README.md)
- 本项目准备使用GPL license v3 