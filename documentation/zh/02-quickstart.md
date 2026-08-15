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

**`config.json` 缺失或缺少新配置项时，可一键自动补齐**（幂等、只增不改，已有值不会被覆盖；`start.bat` / `backend.ps1` 启动时也会自动执行）：

```bash
python scripts/ensure_config.py              # 从 config.example.json 补齐缺失键
python scripts/ensure_config.py --dry-run    # 只预览会补什么，不写文件
```

- `config.json` 不存在 → 用模板原样生成（`$env` / `$default` 占位符保留，运行时解析）
- 模板新增了配置段（如 `django.database.mysql`）→ 只补缺失键，本地改过的 host / 密码等一律不动
- 结束时提示"只有 `$env`、无默认值且环境变量未设置"的项（fail closed 点），密钥需自行注入环境变量，脚本不生成密钥

### 2.1 主要配置段

| 配置段 | 用途 | 默认值举例 |
|---|---|---|
| `django` | SECRET_KEY、DEBUG、ALLOWED_HOSTS、CORS、CSRF、数据库（SQLite/MySQL 二选一）、静态/媒体路径、违禁词、LC 凭据 | 默认 SQLite `timeout: 20`；MySQL 连接见下方 2.3 节 |
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

### 2.3 数据库选择（SQLite / MySQL 二选一）

Django 数据库由 `config.json → django.database.type` 决定，也可用 `DB_TYPE` 环境变量覆盖（部署时优先）：

- **`"sqlite"`（默认）**：本地文件库 `db.sqlite3`，启用 WAL + busy_timeout pragma（见 `signals.py`），零依赖，适合本地开发。
- **`"mysql"`**：远程 MySQL（测试/部署共用同一库）。连接参数在 `django.database.mysql` 段：

```json
"database": {
  "type": "mysql",
  "name": "db.sqlite3",
  "timeout": 20,
  "mysql": {
    "host": "192.168.2.198",
    "port": 3306,
    "name": "openshsid",
    "user": "openshsid",
    "password": {"$env": "MYSQL_PASSWORD"},
    "options": {"charset": "utf8mb4"}
  }
}
```

- 密码建议走环境变量 `MYSQL_PASSWORD`（config_loader 的 `$env` 占位，见第 2 节）；部署时也可用 `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` 逐个覆盖。
- 驱动为 **PyMySQL**（已加入 `requirements.txt`），纯 Python 实现，无需系统级 `mysqlclient`；由 `OpenSHSID_backend/__init__.py` 注册为 MySQLdb。
- 切换库后需要清数据时（该 MySQL 库同时承担测试与部署，务必在切换环境前清理）：

```bash
python manage.py reset_db --yes     # 删掉全部表/文件并重新 migrate
python manage.py flush --noinput    # 轻量版：保留表结构，只清数据
```

`reset_db` 会 DROP 当前库全部表后重建；SQLite 模式则删除 db 文件后重建。

**从 SQLite 迁移既有数据到 MySQL**（首次切库、源库有数据时）：

```bash
python manage.py migrate_sqlite_to_mysql --reset --yes
```

该命令在 MySQL 模式下运行：先用 `reset_db` 清空目标库（`--reset`），再从本地 `db.sqlite3`
`dumpdata` 导出、`loaddata` 导入，最后重置自增序列。问答/文章/聊天等数据保留原 id；
`auth.User` 等带自然键的模型按用户名/权限名重新解析，引用关系全部保持一致。

---

**下一篇**：[03 — 后端：Django](03-backend.md)
