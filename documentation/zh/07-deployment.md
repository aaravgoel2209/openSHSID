# 07 — 部署

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [快速开始](02-quickstart.md) · [后端](03-backend.md) · [API](04-backend-api.md) · [前端](05-frontend.md) · [模型服务](06-model-service.md) · [开发规范](08-development.md)

## 1. Docker Compose

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| `backend` | 根 `Dockerfile` | 19424 | gunicorn 3 workers；SQLite 卷挂载；必须设置 `REI_SESSION_SECRET` |
| `model` | `model/Dockerfile` | 5000 | Flask；使用与 backend 相同的 `REI_SESSION_SECRET` |
| `frontend` | `frontend/Dockerfile` | 80 | nginx 托管 SPA 并代理 `/api/ /admin/ /media/` → `backend` |

`docker compose up -d` 在未设置 `REI_SESSION_SECRET` 时直接失败。注意：nginx 只代理 Django 前缀——`/rei`、`/click`、`/translate` **不在** Docker Web 部署的代理范围内（开发环境走 Vite 代理，Electron/Cordova 目标另行处理）。

### 1.1 后端镜像

`python:3.13-slim` + 阿里云 apt 镜像 + `requirements.txt` + `collectstatic --noinput`；运行 `gunicorn OpenSHSID_backend.wsgi:application --bind [::]:19424 --workers 3`。

### 1.2 模型服务镜像

`python:3.13-slim` + `gcc g++ cmake` + 根 `requirements.txt` + `flask flask-cors openai`；运行 `flask run --port 5000 --host 0.0.0.0`。**不包含** OCR 依赖。

### 1.3 前端镜像

两阶段构建：`node:24-alpine` 构建（`npm ci && npm run build`），然后 `nginx:alpine` 托管 `dist/` 并套用 `nginx.conf`（代理 `/api/ /admin/ /media/` 到 `backend:19424`，其余路径 SPA 回退）。

## 2. Electron 桌面端（Windows/macOS/Linux）

- `electron/` 封装了**前端副本**（`renderer/`）以及主进程与本地 Express 代理。
- **开发**：Vite 开发服务器运行在 :5180，Electron 直接加载。
- **生产**：`server/proxyServer.js` 托管 `renderer/dist` 并反向代理 `/api /admin /static → Django`、`/rei /click /translate → Flask`（带路径改写，否则 Django 只会收到 `/auth/...` 而非 `/api/auth/...`）。
- **界面效果**：Windows 11 acrylic 背景材质、macOS `vibrancy: 'under-window'`、隐藏标题栏（主题色随动，IPC `theme-changed`）、`ready-to-show` 后再显示窗口避免白屏。
- **安全**：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；渲染进程只拿到 `preload.js` 暴露的极简 `window.desktop` 桥。
- **打包**：`npm run dist` → `electron-builder` → NSIS（Win）/ DMG（mac）/ AppImage（Linux）。分发前需在 `resources/` 下放应用图标。
- 后端地址可通过环境变量覆盖：`OPENSHSID_DJANGO_URL`、`OPENSHSID_FLASK_URL`、`OPENSHSID_LOCAL_PORT`、`OPENSHSID_DEV_URL`。

## 3. Cordova 移动端（Android/iOS）

- `cordova/` 封装同一套前端；设备上**没有本地代理** —— App 直连已部署的后端。
- `frontend/.env.cordova` 在构建时覆盖后端地址（当前为 `https://openshsid.zengyuxiang.cn`，通过 443 反向代理将 `/api` + `/admin` 路由到 Django、`/translate` + `/click` + `/rei` 路由到 Flask 模型服务）。
- `npm run build:cordova`（在 `frontend/` 下）→ `dist-cordova/` → `cordova/scripts/sync-www.js` 复制到 `cordova/www/`。
- **网络安全**：网络配置中仍保留 `openshsid.zengyuxiang.cn` 的明文 HTTP 例外（`res/android/network_security_config.xml` 与 iOS 的 `NSAppTransportSecurity` 例外），这是后端还是明文 HTTP 时期的遗留。当前 `.env.cordova` 已指向 HTTPS，待 HTTP 端点完全下线后请移除这两处例外。
- 构建：`cd cordova && npm install && npm run add:android && npm run run:android`（自动探测 `ANDROID_HOME`/`JAVA_HOME`；iOS 需要 macOS 上的 Xcode + CocoaPods）。
- 已知移动端限制：LinkedClassroom 的弹窗登录（`window.open`）在 WebView 中不可用；若移动端需要 LC 登录，需要改用应用内浏览器插件。

---

**下一篇**：[08 — 开发规范与已知限制](08-development.md)
