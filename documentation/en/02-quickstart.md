# 02 — Quick Start & Configuration

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Backend](03-backend.md) · [API](04-backend-api.md) · [Frontend](05-frontend.md) · [Model Service](06-model-service.md) · [Deployment](07-deployment.md) · [Development](08-development.md)

## 1. Quick Start

### Prerequisites

- Python 3.13 + `pip` (Conda env `graphics` recommended)
- Node.js ≥ 20 (v24 recommended) + npm
- (Optional, for OCR) a CUDA-capable GPU with the OCR dependencies installed
- (Optional, for the Rei assistant) a running LLM endpoint configured via `config.json`

### One-click launch (Windows)

```bat
scripts\start.bat
```

This generates a `REI_SESSION_SECRET` into `.env.local` on first run, then starts Flask (5000), runs Django migrations, starts Django (19424), waits for both to accept connections, and finally starts the React dev server (5173).

Linux/macOS equivalent:

```bash
./scripts/start.sh
```

### Manual launch (three terminals)

```bash
# 1. Flask model service (port 5000)
cd model
python app.py            # or: python -m flask run --port 5000

# 2. Django API (port 19424)
python manage.py migrate
python manage.py runserver 19424

# 3. React dev server (port 5173)
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**.

### Docker

```bash
# requires REI_SESSION_SECRET in the environment
export REI_SESSION_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
docker compose up -d
# → frontend on :80, backend API on :19424, model on :5000
```

## 2. Configuration

All tunable settings for both Django and the Flask model service live in **`config.json`** at the project root. Secrets are **never** stored in the file — they are injected via environment variables using a placeholder syntax:

| Placeholder | Meaning |
|---|---|
| `{"$env": "VAR"}` | Read from environment; returns `None` if unset (used for secrets — fail closed) |
| `{"$env": "VAR", "$default": <value>}` | Environment wins; falls back to the JSON value, coerced to the `$default` type |

Loaded once per process by `OpenSHSID_backend/config_loader.py` (exposed as `cfg`).

**If `config.json` is missing or lacks newly added keys, fill it automatically** (idempotent, additive only — existing values are never overwritten; `scripts/start.bat` / `scripts/backend.ps1` also run this on startup):

```bash
python scripts/ensure_config.py              # merge missing keys from config.example.json
python scripts/ensure_config.py --dry-run    # preview only, write nothing
```

- `config.json` missing → generated verbatim from the template (placeholders stay, resolved at runtime)
- Template gained new sections (e.g. `django.database.mysql`) → only missing keys are added; your local host / passwords are never touched
- On exit it lists `$env`-only placeholders without defaults whose env var is unset (fail-closed points); the script never generates secrets — inject them yourself

### 2.1 Key sections

| Section | Purpose | Notable defaults |
|---|---|---|
| `django` | SECRET_KEY, DEBUG, ALLOWED_HOSTS, CORS, CSRF, database (SQLite/MySQL), static/media, blocked words, LC creds | SQLite by default `timeout: 20`; MySQL connection — see 2.3 |
| `services` | Model & OCR service URLs | model `http://localhost:5000`; OCR `http://192.168.2.103:5001` |
| `secrets` | `rei_session_secret` (env only), `rei_api_key`, `rei_embed_api_key` | — |
| `flask` | Model service host/port/debug | port 5000 |
| `llm` | API base, chat/embed model names, temperatures, compaction thresholds | `api_base: http://factory.zengyuxiang.cn/v1`, `model_name: gemma-4-E4B-it-Q4_K_M.gguf`, `compact_at_tokens: 100000` |
| `context_budget` | Token budget for chat context | `ctx_window: 262144`, `max_output: 8192` |
| `session_auth` | AI session token TTL + secret | TTL 7 days |
| `rag` | Retrieval params: top_k, min_score, chunk size, MMR | `top_k: 4`, `min_score: 0.25`, `chunk_size: 700`, `mmr_lambda: 0.7` |
| `ranking` | Recommendation heat weights, push mode | `push_mode: "algorithm"`, click `0.1`, like `0.3` |
| `reco_model` / `training` | Recommendation network dims, training paths | emb_dim 32, hidden 64; `model/data/model.pt` |
| `ocr` | OCR service host/port, PDF DPI caps | port 5001, dpi cap 200 |
| `tools` | Bing/weather search config, Django API base | — |
| `crawler` | LinkedClassroom base URL, login path, timeouts | `https://www.linkedclassroom.com` |
| `ports` | All service ports | django 19424, flask 5000, ocr 5001, embed 8034, react 5173 |

### 2.2 Important environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `REI_SESSION_SECRET` | Django + Flask | **Required.** HMAC key for AI session tokens. Both sides must match or every `/rei/*` request is rejected. |
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG` | Django | Override the JSON defaults |
| `CSRF_TRUSTED_ORIGINS` | Django | Comma-separated extra origins |
| `LINKEDCLASSROOM_USERNAME` / `PASSWORD` | Django | Fallback credentials for the crawler |
| `MODEL_SERVICE_URL`, `OCR_SERVICE_URL` | Django | Service endpoints |
| `REI_API_BASE`, `REI_MODEL`, `REI_EMBED_API_BASE`, ... | Flask | LLM endpoint overrides |
| `VITE_API_BASE`, `VITE_FLASK_BASE`, `VITE_DJANGO_ORIGIN` | Frontend build | Backend origins for Cordova (`.env.cordova`) |

### 2.3 Database: SQLite or MySQL

The Django database is chosen by `config.json → django.database.type` (or the `DB_TYPE` env var, which wins at deploy time):

- **`"sqlite"` (default)**: local `db.sqlite3` with WAL + busy_timeout pragmas (`signals.py`), zero dependencies — for local development.
- **`"mysql"`**: remote MySQL (shared by testing and deployment). Connection params live in the `django.database.mysql` section:

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

- Keep the password in the `MYSQL_PASSWORD` env var (`$env` placeholder, see section 2); at deploy time each value can also be overridden with `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`.
- The driver is **PyMySQL** (added to `requirements.txt`) — pure Python, no system `mysqlclient` needed; registered as MySQLdb in `OpenSHSID_backend/__init__.py`.
- When switching databases, clear existing data first (the MySQL instance serves both test and deploy):

```bash
python manage.py reset_db --yes     # drop all tables / delete file, then re-migrate
python manage.py flush --noinput    # lighter: keep schema, clear rows only
```

**Migrating existing data from SQLite to MySQL** (first switch, when the source has data):

```bash
python manage.py migrate_sqlite_to_mysql --reset --yes
```

Run it while in MySQL mode: it wipes the target (`--reset`), then `dumpdata`s from the local
`db.sqlite3`, `loaddata`s into MySQL and resets auto-increment counters. Q&A/articles/chat etc.
keep their original ids; natural-keyed models (`auth.User`, permissions) are re-resolved by
username/codename, so all references stay consistent.

---

**Next**: [03 — Backend: Django](03-backend.md)
