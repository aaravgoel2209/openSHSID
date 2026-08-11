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
start.bat
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

### 2.1 Key sections

| Section | Purpose | Notable defaults |
|---|---|---|
| `django` | SECRET_KEY, DEBUG, ALLOWED_HOSTS, CORS, CSRF, SQLite, static/media, blocked words, LC creds | SQLite `timeout: 20`; `blocked_words: ["广告","加微信","代写","赌博","色情"]` |
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

---

**Next**: [03 — Backend: Django](03-backend.md)
