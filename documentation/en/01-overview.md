# 01 — Overview & Architecture

> Applies to: [Index](index.md) · [Quick Start](02-quickstart.md) · [Backend](03-backend.md) · [API](04-backend-api.md) · [Frontend](05-frontend.md) · [Model Service](06-model-service.md) · [Deployment](07-deployment.md) · [Development](08-development.md)

## 1. Overview

OpenSHSID is a full-stack campus platform for SHSID students and faculty. Its features include:

| Feature | Description |
|---|---|
| **Q&A** (`qa`) | Questions, answers, nested replies, likes, views, labels, personalized ranking |
| **Knowledge base** (`knowledge`) | Grade/subject-filtered articles, comments, likes, search, auto-translation |
| **AI assistant "Rei"** | LLM-powered chat with RAG retrieval over the knowledge base, Q&A, and a persistent memory bank; streams answers; can be invoked with `@Rei` in Q&A answers |
| **OCR toolbox** | Upload PDF/images, OCR to Markdown, highlight regions, summarize with the LLM, save into the knowledge base |
| **Direct messaging** (`chat`) | 1:1 conversations with unread counts and notifications |
| **Postbar** (`postbar`) | Reddit-style subbars (子吧), posts, nested comments, bar managers |
| **Notifications** (`notifications`) | Signal-driven inbox for answers, replies, likes, messages |
| **LinkedClassroom** (`crawler`) | Moodle course browsing: per-user credentials, course/section/activity sync, image/file proxying |
| **Admin dashboard** | Staff-only content & user management, weekly top users |

The product ships to **four targets**: a web SPA (with PWA support), an Electron desktop app, and Cordova Android/iOS apps — all built from the same React frontend.

## 2. Architecture

The system is composed of **three backend processes** and **one frontend**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                            │
│  • Web SPA / PWA  (port 5173 dev, port 80 in Docker)                │
│  • Electron desktop app  (renderer = copy of frontend)              │
│  • Cordova Android/iOS  (build:cordova → native WebView)            │
└───────┬──────────────────────┬───────────────────────┬──────────────┘
        │ /api /admin /media   │ /rei /click /translate│ /ocr /summarize
        ▼                      ▼                       ▼
┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ Django REST API  │   │ Flask model service  │   │ OCR microservice     │
│ port 19424       │   │ port 5000            │   │ port 5001            │
│ • 7 apps         │   │ • Rei LLM chat (SSE) │   │ • baidu Unlimited-OCR│
│ • SQLite / MySQL │   │ • RAG retrieval      │   │ • requires CUDA GPU  │
│ • Token auth     │   │ • Recommendation     │   │ • image/PDF → Markdown
└──────────────────┘   │ • Translation        │   └──────────────────────┘
                      └──────────────────────┘
```

**Key integration points:**

- **Django → Flask (model)**: translation (`/translate`), summarization (`/summarize`), Rei replies (`/rei/reply`, `/rei/stream`, `/rei/history`), recommendation (`/rank`, `/click`).
- **Django → OCR**: `knowledge/ocr_client.py` calls the OCR service for document scanning.
- **Flask (model) → Django**: RAG sync pulls articles/questions (`GET /api/knowledge/articles/`, `/api/qa/questions/`), tool functions call the Django API (`kb_read`, `qa_read`, etc.).
- **Shared secret**: `REI_SESSION_SECRET` (HMAC) is used by both Django (`OpenSHSID_backend/rei_session.py`) and Flask (`model/session_auth.py`) to sign/verify AI session tokens. The two files are copies and **must stay in sync**.
- **Shared config**: both Django and the model service read the same `config.json` via `config_loader.py`.

## 3. Tech Stack

### Backend (Python 3.13)
- **Django 6.0.5** + **Django REST Framework 3.17** — JSON-only REST API
- **SQLite 3 / MySQL (choose one)**: default `db.sqlite3` (WAL + busy_timeout pragmas); remote MySQL (`192.168.2.198`, shared test/deploy) via `config.json django.database.type` (see 02-quickstart §2.3)
- **django-cors-headers**, **django-rest-framework authtoken** (Token auth)
- **gunicorn** — production WSGI server
- **Flask 3** + **flask-cors** — the AI model service
- **PyTorch** — recommendation ranking model (BPR training)
- **OpenAI SDK + httpx** — LLM client for the Rei assistant (llama.cpp OpenAI-compatible endpoint)
- **transformers** (baidu **Unlimited-OCR**) — OCR, CUDA-only (separate `model/requirements-ocr.txt`)

### Frontend (Node 24, Vite 8)
- **React 19** + **react-router-dom 7**
- **HeroUI 3** component library (subpath imports, no provider needed)
- **Tailwind CSS v4** (zero-config via `@tailwindcss/vite`), class-based dark mode
- **axios** — HTTP client with token interceptor
- **marked + DOMPurify** — Markdown rendering with XSS sanitization
- **MathJax 3** — lazy-loaded math typesetting
- **framer-motion** — animations
- **vite-plugin-pwa** — PWA with prompt-style updates
- **@khvicha/react-liquid-glass** — glass effects for high "UI complexity" modes

## 4. Repository Structure

```
OpenSHSID-backend/
├── manage.py                       # Django entry point
├── requirements.txt                # Backend + model service deps
├── config.json                     # Central config (Django + Flask share, gitignored)
├── config.example.json             # Config template (source for filling config.json, see scripts/ensure_config.py)
├── Dockerfile                      # Django backend image (gunicorn :19424)
├── docker-compose.yml              # backend + model + frontend services
├── start.bat                       # Windows one-click launcher (all services)
├── scripts/
│   ├── start.ps1                   # PowerShell launcher
│   ├── start.sh                    # Bash launcher
│   └── ensure_config.py            # Auto-create/fill config.json (idempotent, additive only)
├── OpenSHSID_backend/              # Django project package
│   ├── settings.py                 # All settings read from config.json
│   ├── urls.py                     # Root URLconf
│   ├── config_loader.py            # Loads config.json with $env placeholders
│   ├── signals.py                  # DB connection pragmas (SQLite), embedding init, profile auto-create
│   ├── moderation.py               # Blocked-words content filter
│   ├── translation.py              # Async translation via Flask /translate
│   └── rei_session.py              # HMAC session token signing (mirror of model/session_auth.py)
├── accounts/                       # Auth, profile, notices, admin dashboard, AI sessions
├── qa/                             # Q&A forum (incl. @Rei streaming replies)
├── knowledge/                      # Knowledge base + OCR pipeline + ranking
├── chat/                           # Direct messaging
├── postbar/                        # Reddit-style subbars
├── crawler/                        # LinkedClassroom (Moodle) scraper
├── notifications/                  # Signal-driven notification inbox
├── simpletable/                    # ⚠️ Abandoned app — no source files, not in INSTALLED_APPS
├── model/                          # Flask AI service (separate process, port 5000)
│   ├── app.py                      # Flask routes: /rei/*, /rank, /click, /translate, /summarize
│   ├── SYSTEM.md                   # Rei system prompt (persona + RAG rules)
│   ├── rag.py                      # Embedding + MMR retrieval over kb/qa/memory
│   ├── database.py                 # Local SQLite: memory bank, chat history, summaries
│   ├── tools.py                    # LLM function-calling tools (kb/qa/memory/bing/weather)
│   ├── context_budget.py           # Token budget assembly for chat history
│   ├── session_auth.py             # HMAC session auth (mirror of Django's rei_session.py)
│   ├── model.py                    # PyTorch recommendation model (dual-encoder)
│   ├── train.py                    # BPR online training loop
│   ├── config.py                   # Heat scoring + embedding updates
│   ├── ocr_infer.py                # baidu Unlimited-OCR wrapper (CUDA)
│   ├── ocr_service.py              # Standalone OCR microservice (port 5001)
│   ├── config_loader.py            # Re-exports the Django config loader
│   └── Dockerfile
├── frontend/                       # React SPA (see 05-frontend.md)
├── electron/                       # Electron desktop wrapper (see 07-deployment.md)
├── cordova/                        # Cordova mobile wrapper (see 07-deployment.md)
├── media/                          # User uploads (avatars)
└── documentation/                  # This documentation
```

> **Note on `simpletable/`**: this directory contains only compiled `.pyc` leftovers and an empty migrations folder. It has **no source files** and is **not registered** in `INSTALLED_APPS`. It is abandoned scaffolding and safe to delete.

---

**Next**: [02 — Quick Start & Configuration](02-quickstart.md)
