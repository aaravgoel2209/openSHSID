# 07 — Deployment

> Applies to: [Index](index.md) · [Overview](01-overview.md) · [Quick Start](02-quickstart.md) · [Backend](03-backend.md) · [API](04-backend-api.md) · [Frontend](05-frontend.md) · [Model Service](06-model-service.md) · [Development](08-development.md)

## 1. Docker Compose

| Service | Image | Port | Notes |
|---|---|---|---|
| `backend` | root `Dockerfile` | 19424 | gunicorn, 3 workers; DB defaults to SQLite (volume-mounted), MySQL switchable — see 1.1; requires `REI_SESSION_SECRET` |
| `model` | `model/Dockerfile` | 5000 | Flask; same `REI_SESSION_SECRET` |
| `frontend` | `frontend/Dockerfile` | 80 | nginx serves the SPA and proxies `/api/ /admin/ /media/` → `backend` |

`docker compose up -d` fails fast if `REI_SESSION_SECRET` is not set. Note that nginx proxies only the Django prefixes — `/rei`, `/click`, `/translate` are **not** proxied in the Docker web deploy (they work in dev via the Vite proxy; the Electron/Cordova targets handle them separately).

### 1.1 Backend image

`python:3.13-slim` + Aliyun apt mirror + `requirements.txt` + `collectstatic --noinput`; runs `gunicorn OpenSHSID_backend.wsgi:application --bind [::]:19424 --workers 3`.

**Database mode**: when `config.json` is absent from the image (it's gitignored), the build step auto-runs `cp config.example.json config.json` as a fallback; pick the database at runtime via env vars:

```bash
# Option A: local SQLite (default; mounts ./db.sqlite3)
DB_TYPE=sqlite docker compose up -d --build

# Option B: remote MySQL (shared test/deploy at 192.168.2.198)
DB_TYPE=mysql DB_HOST=192.168.2.198 DB_PORT=3306 \
DB_NAME=openshsid DB_USER=openshsid DB_PASSWORD=<password> \
docker compose up -d --build
```

`DB_TYPE` defaults to `sqlite`; in MySQL mode each `DB_*` falls back to the `django.database.mysql` section inside the image's `config.json` (embed your own `config.json` before building if you want). Before first deploy against a MySQL instance with existing data, wipe it and rebuild:

```bash
# On the dev machine (MySQL mode): migrate local db.sqlite3 data to the remote DB
python manage.py migrate_sqlite_to_mysql --reset --yes

# In the container: fallback cleanup when the target already holds stale data
docker compose exec backend python manage.py reset_db --yes
```

### 1.2 Model image

`python:3.13-slim` + `gcc g++ cmake` + root `requirements.txt` + `flask flask-cors openai`; runs `flask run --port 5000 --host 0.0.0.0`. Does **not** install OCR dependencies.

### 1.3 Frontend image

Two-stage: `node:24-alpine` builds (`npm ci && npm run build`), then `nginx:alpine` serves `dist/` with `nginx.conf` (proxies `/api/ /admin/ /media/` to `backend:19424`, SPA fallback for everything else).

## 2. Electron desktop (Windows/macOS/Linux)

- `electron/` wraps a **copy of the frontend** (`renderer/`) plus a main process and a local Express proxy.
- **Dev**: Vite dev server on :5180, Electron loads it.
- **Prod**: `server/proxyServer.js` serves `renderer/dist` and reverse-proxies `/api /admin /static → Django` and `/rei /click /translate → Flask` (path-rewrite included, otherwise Django would receive `/auth/...` instead of `/api/auth/...`).
- **UI effects**: Windows 11 acrylic background material, macOS `vibrancy: 'under-window'`, hidden titlebar with theme-aware overlay (IPC `theme-changed`), window shown on `ready-to-show` to avoid white flash.
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; renderer gets only the tiny `window.desktop` bridge from `preload.js`.
- **Package**: `npm run dist` → `electron-builder` → NSIS (Win) / DMG (mac) / AppImage (Linux). Add an icon under `resources/` before distributing.
- Backend URLs overridable: `OPENSHSID_DJANGO_URL`, `OPENSHSID_FLASK_URL`, `OPENSHSID_LOCAL_PORT`, `OPENSHSID_DEV_URL`.

## 3. Cordova mobile (Android/iOS)

- `cordova/` wraps the same frontend; **no local proxy on device** — the app talks to the deployed backend directly.
- `frontend/.env.cordova` overrides the backend origins at build time (currently `https://openshsid.zengyuxiang.cn`, served through a 443 reverse proxy that routes `/api` + `/admin` to Django and `/translate` + `/click` + `/rei` to the Flask model service).
- `npm run build:cordova` (in `frontend/`) → `dist-cordova/` → `cordova/scripts/sync-www.js` copies it into `cordova/www/`.
- **Network security**: the network configs still carry a cleartext-HTTP exception for `openshsid.zengyuxiang.cn` (via `res/android/network_security_config.xml` and the iOS `NSAppTransportSecurity` exception), left over from when the backend was plain HTTP. The current `.env.cordova` targets HTTPS, so once the HTTP endpoint is fully retired, remove both exceptions.
- Build: `cd cordova && npm install && npm run add:android && npm run run:android` (env auto-detection for `ANDROID_HOME`/`JAVA_HOME`; iOS needs Xcode + CocoaPods on macOS).
- Known mobile limitation: the LinkedClassroom popup-login flow (`window.open`) doesn't work in a WebView; an in-app browser plugin rework is needed if LC login is required on mobile.

## 4. Browser-side machine translation (no server-side changes)

The browser-side MT (multilingual translation) feature does **not** touch our own servers — models are fetched directly from the [ModelScope](https://modelscope.cn/models) CDN by the browser on first translation. The Django / Flask images require NO changes. See [05-frontend.md §7 Browser-side multilingual translation](05-frontend.md#7-browser-side-multilingual-translation).

**Escape hatch**: to self-host the models (e.g. if ModelScope's CORS fails in your network), add the reverse-proxy snippet from [05-frontend.md](05-frontend.md#7-browser-side-multilingual-translation) to your own nginx (`/mt-models/` → `modelscope.cn/models`) and set `VITE_MT_MODEL_BASE=https://your-domain/mt-models` at frontend build time.

**Electron / Cordova**: models are fetched over the public internet directly — no Electron main-process or Cordova proxy changes needed. The Cordova `config.xml` whitelist already includes `https://*.modelscope.cn/*` (covers the origin + CDN redirect domains).

---

**Next**: [08 — Development & Limitations](08-development.md)
