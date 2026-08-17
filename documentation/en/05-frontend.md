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

## 7. Browser-side multilingual translation

The article / Q&A detail pages (`ArticleDetail`, `QuestionDetail`) embed a "Translate" toolbar (`MtTranslateBar`). The user picks "日本語" from the language dropdown and clicks translate — the browser runs OPUS-MT directly to translate the body into Japanese. **Manual trigger only**, never auto-translates; the chosen target language persists in `localStorage`.

### Trigger

- The toolbar appears above the article / question body. It is enabled only when the source language is `zh` or `en` (other sources disable the button and show `mt.unsupported`).
- On click: the first run downloads the model (progress bar), then switches to "Translating…", then shows the "Machine-translated · may be inaccurate" badge with a "Show original / Show translation" toggle.
- The target language is persisted to `localStorage` across reloads.

### Model source: ModelScope direct link

Models are **not bundled into the frontend artifact, nor routed through our own servers** — on first translation the browser fetches them directly from the [ModelScope](https://modelscope.cn/models) CDN:

```js
env.remoteHost = 'https://modelscope.cn/models'
env.remotePathTemplate = '{model}/resolve/master/'   // trailing slash, no {file}
```

- **Zero server bandwidth**: the Django / Flask images require NO changes — they don't participate in model distribution at all.
- Per quantized ONNX model, first download is ~35–80 MB; the browser IndexedDB + Cache API cache makes it **offline-capable**, so repeat translations are instant.
- CDN chain: `modelscope.cn` → 302 → `cdn-lfs-cn-1.modelscope.cn` (large files). CORS and `Content-Length` are both verified open.

### `VITE_MT_MODEL_BASE` override

At build time you can repoint the model source via an env var:

```bash
VITE_MT_MODEL_BASE=https://my-mirror.example.com/models npm run build
```

Defaults to ModelScope. The variable is passed through `new URL(...).origin` and becomes `env.remoteHost` — only the origin is replaced; the path template stays `{model}/resolve/master/`.

### Fallback nginx reverse-proxy snippet (documentation only, not implemented)

Direct connection to ModelScope works in the normal case. Only if ModelScope's CORS fails in practice, add a reverse proxy on your own server as an escape hatch and point `VITE_MT_MODEL_BASE` at your own domain:

```nginx
location /mt-models/ {
  proxy_pass https://modelscope.cn/models/;
  add_header Access-Control-Allow-Origin * always;
  add_header Access-Control-Expose-Headers "Content-Length, Accept-Ranges, ETag" always;
  gzip off;
}
```

### Cordova whitelist

`cordova/config.xml` already includes `https://*.modelscope.cn/*`, covering the ModelScope origin + CDN redirect domains (`cdn-lfs-cn-1.modelscope.cn` etc.). The mobile build can fetch models over the public internet directly.

### Quality disclaimer

- OPUS-MT is a small model (30–80 MB); translation quality is noticeably lower than the server-side LLM zh↔en translation. The UI labels the result "Machine-translated · may be inaccurate".
- **Japanese path**: `zh → en` (opus-mt-zh-en) → `ja` (en-mul with `>>jpn<<` prefix) — two hops, relayed via English. `en → ja` is a single hop (en-mul:>>jpn<<).
- **Korean not enabled**: the en-mul model does NOT support the `>>kor<<` target prefix (output falls back to French or other languages), so `ko` is currently removed from `MT_TARGETS` and the toolbar only offers "日本語". To re-enable Korean in the future, add a Korean-capable model and update `resolveChain`.

### Tech stack

- `@huggingface/transformers@^3.8.1` (npm-bundled into a lazy-loaded worker chunk) + `onnxruntime-web` WASM.
- Inference runs in a Web Worker — the main thread is never blocked. The ONNX WASM is cached via the Cache API.
- IndexedDB translation cache: keyed by `srcLang>target|modelRev|sha256(original)`, invalidated when the model revision changes.
- Markdown / LaTeX placeholder protection: inline code, fenced code, `$...$`, `$$...$$` are replaced with PUA-char placeholders before translation and restored (descending id order) after, so formulas / code survive the model round-trip.

## 8. Multi-target builds

| Command | Output | Notes |
|---|---|---|
| `npm run dev` | — | Dev server :5173, proxies to Django + Flask |
| `npm run build` | `dist/` | Web/PWA build |
| `npm run build:cordova` | `dist-cordova/` | Relative base, HashRouter, no PWA, `.env.cordova` origins |

---

**Next**: [06 — Model Service: Flask AI](06-model-service.md)
