# OpenSHSID Desktop (Electron)

Electron desktop wrapper around the OpenSHSID React frontend. The renderer is a
**copy of `../frontend`** (UI + networking) so the desktop app ships the same
interface. It talks to the same backends over HTTP: Django REST API
(`:19424`) and the Flask model service (`:5000`).

## Layout

```
electron/
├── package.json          # Electron wrapper: deps + dev/build/dist scripts
├── config.js             # backend URLs + ports (env-overridable)
├── main/
│   ├── main.js           # app entry: BrowserWindow, dev/prod URL, external links
│   └── preload.js        # contextBridge — minimal safe API (window.desktop)
├── server/
│   └── proxyServer.js    # prod static + reverse proxy (mirrors Vite dev proxy)
├── renderer/             # copy of ../frontend (the UI + networking)
│   ├── index.html
│   ├── vite.config.js    # base:'./' for packaged assets; same dev proxy
│   ├── package.json
│   ├── public/
│   └── src/
└── resources/            # app icons / installer assets (add icon.ico/.icns/.png)
```

## How networking works

The copied frontend uses **relative URLs** (`/api`, `/admin`, `/static`,
`/rei`, `/click`, `/translate`). Those depend on a proxy:

- **Dev** — `npm run dev` starts the Vite dev server (`:5173`) whose proxy
  forwards those prefixes to Django/Flask. Electron loads `http://localhost:5173`.
- **Prod** — `file://` would break relative fetches, so `server/proxyServer.js`
  starts a local Express server that serves `renderer/dist` **and** reverse-proxies
  the same prefixes to the backends. Electron loads `http://127.0.0.1:<port>`.

This lets the copied networking code run **unchanged** in both modes. Override
backend locations via env vars (see `config.js`): `OPENSHSID_DJANGO_URL`,
`OPENSHSID_FLASK_URL`, `OPENSHSID_LOCAL_PORT`, `OPENSHSID_DEV_URL`.

## Develop

```bash
cd electron
npm install            # also installs renderer deps (postinstall)
# make sure Django (:19424) and Flask (:5000) are running, then:
npm run dev            # Vite dev server + Electron with live reload
```

## Package

```bash
cd electron
npm run dist           # builds renderer, then electron-builder → build/
```

Add an app icon under `resources/` (`icon.ico` on Windows) before distributing.

## Keeping the renderer in sync with `../frontend`

The renderer is a copy, not a symlink. When the web frontend changes and you
want the desktop app to match, re-copy `../frontend` (excluding `node_modules`
and `dist`) over `renderer/`, keeping this folder's `vite.config.js` tweak
(`base: './'`). A sync script can be added later.

## Desktop UI effects

- **Native background blur** — on Windows 11 the window uses the `acrylic`
  background material; on macOS, `vibrancy: 'under-window'`. The renderer
  detects this via `window.desktop.nativeBlur` and switches the page background
  to transparent (skipping the random wallpaper) so the desktop shows through,
  blurred, behind the app's glass panels. On Windows 10 / Linux everything
  falls back to the normal opaque background + wallpaper.
- **Hidden titlebar** — on Windows/macOS the system titlebar is hidden and the
  app's own topbar (48px) becomes the drag region (`-webkit-app-region`).
  Windows keeps native min/max/close buttons via `titleBarOverlay`, whose
  colors follow the app's dark/light theme (IPC `theme-changed`); macOS keeps
  its traffic lights (`hiddenInset`, topbar left-padded). Linux keeps the
  system frame.
- **Smooth startup** — the window is created hidden and shown on
  `ready-to-show`, avoiding the white flash.

All renderer-side behavior is gated on `window.desktop` (from `preload.js`),
so the same code is a no-op in the web frontend.

## Security

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer
gets only the small surface exposed in `preload.js` (`window.desktop`). External
`http(s)` links open in the system browser, not in-app.
