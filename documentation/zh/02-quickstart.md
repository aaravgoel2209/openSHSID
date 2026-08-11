# 02 — 快速开始与配置

> 相关文档：[目录](index.md) · [概述](01-overview.md) · [后端](03-backend.md) · [API](04-backend-api.md) · [前端](05-frontend.md) · [模型服务](06-model-service.md) · [部署](07-deployment.md) · [开发规范](08-development.md)

## 1. 快速开始

### 环境要求

- Python 3.13 + `pip`（推荐 Conda 环境 `graphics`）
- Node.js ≥ 20（推荐 v24）+ npm
- （可选，OCR 功能）带 CUDA 的 GPU，并安装 OCR 依赖
- （可选，Rei 助手）在 `config.json` 中配置可用的 LLM 接口

### 一键启动（Windows）

```bat
start.bat
```

首次运行会生成 `REI_SESSION_SECRET` 写入 `.env.local`，然后依次启动 Flask（5000）、执行 Django 迁移、启动 Django（19424），等待两个后端就绪后再启动 React 开发服务器（5173）。

Linux/macOS 等价脚本：

```bash
./scripts/start.sh
```

### 手动启动（三个终端）

```bash
# 1. Flask 模型服务（端口 5000）
cd model
python app.py            # 或：python -m flask run --port 5000

# 2. Django API（端口 19424）
python manage.py migrate
python manage.py runserver 19424

# 3. React 开发服务器（端口 5173）
cd frontend
npm install
npm run dev
```

然后打开 **http://localhost:5173**。

### Docker

```bash
# 需要先在环境变量中设置 REI_SESSION_SECRET
export REI_SESSION_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
docker compose up -d
# → 前端 :80、后端 API :19424、模型服务 :5000
```

## 2. 配置

Django 与 Flask 模型服务的全部可调配置集中在项目根目录的 **`config.json`**。密钥**绝不**写入该文件，而是通过环境变量以占位符语法注入：

| 占位符 | 含义 |
|---|---|
| `{"$env": "VAR"}` | 从环境变量读取；未设置返回 `None`（用于密钥 —— fail closed） |
| `{"$env": "VAR", "$default": <值>}` | 环境变量优先；缺省回退 JSON 默认值，类型跟随 `$default` |

由 `OpenSHSID_backend/config_loader.py` 在进程内解析一次（对外暴露为 `cfg`）。

### 2.1 主要配置段

| 配置段 | 用途 | 默认值举例 |
|---|---|---|
| `django` | SECRET_KEY、DEBUG、ALLOWED_HOSTS、CORS、CSRF、SQLite、静态/媒体路径、违禁词、LC 凭据 | SQLite `timeout: 20`；`blocked_words: ["广告","加微信","代写","赌博","色情"]` |
| `services` | 模型服务与 OCR 服务地址 | model `http://localhost:5000`；OCR `http://192.168.2.103:5001` |
| `secrets` | `rei_session_secret`（仅环境变量）、`rei_api_key`、`rei_embed_api_key` | — |
| `flask` | 模型服务 host/port/debug | 端口 5000 |
| `llm` | API 地址、对话/向量模型名、温度、压缩阈值 | `api_base: http://factory.zengyuxiang.cn/v1`，`model_name: gemma-4-E4B-it-Q4_K_M.gguf`，`compact_at_tokens: 100000` |
| `context_budget` | 对话上下文 token 预算 | `ctx_window: 262144`，`max_output: 8192` |
| `session_auth` | AI 会话令牌 TTL 与密钥 | TTL 7 天 |
| `rag` | 检索参数：top_k、min_score、chunk 大小、MMR | `top_k: 4`，`min_score: 0.25`，`chunk_size: 700`，`mmr_lambda: 0.7` |
| `ranking` | 推荐热度权重、推送模式 | `push_mode: "algorithm"`，点击 `0.1`，点赞 `0.3` |
| `reco_model` / `training` | 推荐网络维度、训练路径 | emb_dim 32，hidden 64；`model/data/model.pt` |
| `ocr` | OCR 服务 host/port、PDF DPI 上限 | 端口 5001，DPI 上限 200 |
| `tools` | Bing/天气搜索配置、Django API 地址 | — |
| `crawler` | LinkedClassroom 地址、登录路径、超时 | `https://www.linkedclassroom.com` |
| `ports` | 所有服务端口 | django 19424，flask 5000，ocr 5001，embed 8034，react 5173 |

### 2.2 重要环境变量

| 变量 | 使用方 | 用途 |
|---|---|---|
| `REI_SESSION_SECRET` | Django + Flask | **必填**。AI 会话令牌的 HMAC 密钥。两侧不一致会导致所有 `/rei/*` 请求被拒绝。 |
| `DJANGO_SECRET_KEY`、`DJANGO_DEBUG` | Django | 覆盖 JSON 默认值 |
| `CSRF_TRUSTED_ORIGINS` | Django | 逗号分隔的额外信任来源 |
| `LINKEDCLASSROOM_USERNAME` / `PASSWORD` | Django | 爬虫的兜底凭据 |
| `MODEL_SERVICE_URL`、`OCR_SERVICE_URL` | Django | 服务地址 |
| `REI_API_BASE`、`REI_MODEL`、`REI_EMBED_API_BASE` 等 | Flask | LLM 接口覆盖 |
| `VITE_API_BASE`、`VITE_FLASK_BASE`、`VITE_DJANGO_ORIGIN` | 前端构建 | Cordova 构建的后端地址（`.env.cordova`） |

---

**下一篇**：[03 — 后端：Django](03-backend.md)
