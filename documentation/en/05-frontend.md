# 05 — Frontend: React SPA

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Quick Start](02-quickstart.md) · [Backend](03-backend.md) · [API](04-backend-api.md) · [Model Service](06-model-service.md) · [Deployment](07-deployment.md) · [Development](08-development.md)

## 1. Structure

```
frontend/
├── vite.config.js               # Dual build (web/PWA + cordova), 6 dev proxies
├── nginx.conf                   # Production proxy: /api /admin /media → backend
├── Dockerfile                   # node build → nginx serve
├── .env.cordova                 # Backend origins for the mobile build
├── src/
│   ├── main.jsx                 # React root; detects Electron bridge (window.desktop)
│   ├── App.jsx                  # Router + 5 context providers + 30 routes (29 pages)
│   ├── index.css                # Tailwind v4 + HeroUI + glass/accent/Markdown CSS
│   ├── config.js                # API_BASE / FLASK_BASE / DJANGO_ORIGIN
│   ├── i18n.js                  # zh/en UI string table
│   ├── pwa.js                   # Manual service-worker registration
│   ├── api/                     # 8 Axios modules: client, auth, qa, knowledge, chat,
│   │                            #   postbar, toolbox, crawler, labels, notifications
│   ├── context/                 # Auth, Theme, UI (complexity), Toast, Language
│   ├── components/              # Layout, MarkdownView/Input, GlassPanel, Card,
│   │                            #   NotificationBell, AboutDialog, PwaUpdateToast, ...
│   ├── pages/                   # 29 page components (see below)
│   ├── hooks/useDebounce.js
│   ├── utils/                   # markdown, mathjax, lang, avatar, clipboard
│   ├── config/prefs.js          # theme / complexity / accent prefs (cross-tab sync)
│   ├── styles/Admin.css
│   └── assets/                  # 7 rotating webp wallpapers, logos
```

## 2. Routes (30)

| Route | Page | Purpose |
|---|---|---|
| `/` | HomeArticles | Landing: article feed with recommender feedback |
| `/qa`, `/qa/ask`, `/qa/questions/:id` | Home / AskQuestion / QuestionDetail | Q&A |
| `/knowledge`, `/knowledge/create`, `/knowledge/:id` | KnowledgeBase / CreateArticle / ArticleDetail | Knowledge base |
| `/postbar`, `/postbar/b/:subbarId`, `/postbar/posts/:id` | PostbarHome / SubbarDetail / PostDetail | Postbar |
| `/toolbox`, `/toolbox/ocr`, `/toolbox/markdown` | Toolbox / OcrScan / MarkdownPreview | OCR + Markdown tools |
| `/chat`, `/chat/:userId`, `/chat/ai` | ChatList / ChatDetail / AiChat | DMs + **Rei AI chat** (RAG, image attachments, per-user sessions) |
| `/mailbox` | Mailbox | Notification inbox |
| `/admin`, `/admin/users`, `/admin/content` | AdminDashboard / AdminUsers / AdminContent | Staff panel |
| `/admin/memory` | MemoryView | Rei memory browser (staff) |
| `/profile`, `/profile/:userId`, `/user/:userId` | Profile | Own / others' profiles |
| `/search` | SearchResults | Full-text search |
| `/settings` | Settings | Theme, accent color, UI complexity, server URL override, avatar upload |
| `/linkedclassroom`, `/linkedclassroom/:courseId` | LinkedClassroom / LinkedClassroomCourse | Moodle course browser |
| `/login`, `/register` | Login / Register | Auth (rendered **outside** the Layout shell) |

## 3. API layer

`src/api/client.js` creates the shared Axios instance and injects `Authorization: Token <key>` from `localStorage` on every request. Feature modules (`auth.js`, `qa.js`, `knowledge.js`, `chat.js`, `postbar.js`, `toolbox.js`, `crawler.js`, `notifications.js`) wrap the endpoints listed in [04-backend-api.md](04-backend-api.md).

Notable: `toolbox.js` uses raw `fetch` streaming for `ocr-scan-stream` (NDJSON consumed with `response.body.getReader()`), falling back to the non-streaming endpoint on 503.

## 4. State & contexts

| Context | Responsibility |
|---|---|
| `AuthContext` | token + user state; login/register/logout/refreshUser; hydrates profile on mount |
| `ThemeContext` | dark/light + custom accent color (8 presets) via `data-accent` attribute |
| `UIContext` | UI complexity: `simple` / `normal` / `complex` / `extreme` — controls glass blur strength |
| `ToastContext` | global toasts (`useToast`) |
| `LanguageContext` | zh/en UI chrome via `t(key)` |

## 5. Styling system

- Tailwind v4 CSS-first config (no `tailwind.config.js`): `@import "tailwindcss"` + `@import "@heroui/styles"` + `@custom-variant dark`.
- **Glass effect**: the `[data-ui-complexity]` attribute on `<html>` scales `backdrop-filter` blur/saturate across cards; `simple` disables it for compatibility/perf.
- **Custom accent**: `html[data-accent]` remaps Tailwind's hardcoded `blue-*`/`indigo-*` utilities to `--user-accent`, restyling the whole site without touching components.
- **Markdown**: `.md-body` restores typography stripped by Preflight; MathJax SVG fix (`display: inline-block`) for inline math.
- **Electron**: `html.native-blur` makes the page transparent for OS-level acrylic/vibrancy; `.app-topbar` becomes a drag region.

## 6. PWA

Manual service-worker registration (`src/pwa.js`) with **prompt-style updates** (`registerType: 'prompt'`) so a new version shows a toast instead of silently reloading (avoids wiping form state). Workbox denylist keeps `/admin`, `/api`, `/static`, `/rei`, `/click`, `/translate` out of the SW navigation fallback. MathJax is runtime-cached CacheFirst after first use.

## 7. Server-side multilingual translation

The article / Q&A detail pages (`ArticleDetail`, `QuestionDetail`) embed a "Translate" toolbar (`MtTranslateBar`). The user picks "日本語" from the language dropdown and clicks translate — the frontend POSTs to the Flask model service `/translate` and the server-side LLM does the translation. **Manual trigger only**, never auto-translates; the chosen target language persists in `localStorage`.

### Trigger

- The toolbar appears above the article / question body and works for any source language (general-purpose server LLM; no longer limited to zh/en).
- On click: shows "Translating…", then the "Machine-translated · may be inaccurate" badge with a "Show original / Show translation" toggle.
- The target language is persisted to `localStorage` across reloads.

### Translation path: Flask model service /translate

The frontend runs no local inference and downloads no model weights — `MtTranslateBar` POSTs `${FLASK_BASE}/translate` directly (one request for the title, one for the content):

```json
{ "text": "...", "target": "ja" }
```

- **Zero extra deployment**: translation shares the same LLM backend as the Rei assistant (`_get_rei_client()`); the model is selected via `config.json` → `llm.model_name`.
- `target` accepts any ISO language code or English language name (`ja` / `ko` / `fr` / `German`, ...); omitted/null means auto zh↔en. The UI currently offers Japanese only — add an entry to `MT_TARGETS` in `frontend/src/mt/models.js` (plus matching i18n keys) to expose more targets.
- Returns `{ translation, source_lang, target_lang }`; on failure `{ error }` with a 4xx/5xx status.

### Quality disclaimer

- Translation quality depends on the server LLM and is typically well above the old browser-side OPUS-MT pipeline; the UI still labels the result "Machine-translated · may be inaccurate".
- Japanese is translated directly (no English pivot); Korean also works server side, but the UI still only offers "日本語" by default (uncomment in `MT_TARGETS` and add the i18n key to enable).

### Tech stack

- Frontend: plain `fetch` (two requests) — no Web Worker, no `@huggingface/transformers`, no onnxruntime, no IndexedDB translation cache (every click is a fresh server request).
- Server: `_translate_text()` in `model/app.py`; math / code spans are masked into PUA placeholders server-side (`_protect_math`) and restored after translation (`_restore_math`) so MathJax keeps rendering.
- `GET /models` proxies the LLM's model list, surfaced in the About dialog and the Settings page's "Developer" section as the current translation model.

## 8. Multi-target builds

| Command | Output | Notes |
|---|---|---|
| `npm run dev` | — | Dev server :5173, proxies to Django + Flask |
| `npm run build` | `dist/` | Web/PWA build |
| `npm run build:cordova` | `dist-cordova/` | Relative base, HashRouter, no PWA, `.env.cordova` origins |

---

**Next**: [06 — Model Service: Flask AI](06-model-service.md)
