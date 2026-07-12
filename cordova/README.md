# OpenSHSID Mobile (Cordova)

Cordova wrapper that packages the OpenSHSID React frontend as native Android
and iOS apps. Unlike the Electron build, there's no Node process on-device to
run a local reverse proxy — the packaged app talks to the deployed backend
directly over its public domain.

## Layout

```
cordova/
├── config.xml                      # Cordova app manifest: id, icons, network rules
├── package.json                    # cordova-cli + platforms/plugins as devDependencies
├── scripts/
│   └── sync-www.js                 # builds frontend (mode=cordova) and copies it into www/
├── res/
│   ├── android/network_security_config.xml   # cleartext HTTP exception, scoped to one domain
│   └── icon/{android,ios}/*.png    # app icons (generated from frontend/public/favicon.svg)
├── www/                            # generated — build output, not committed
├── platforms/                      # generated — `cordova platform add ...`
└── plugins/                        # generated — `cordova plugin add ...`
```

## How networking works

The frontend normally talks to the backend via **relative URLs** (`/api`,
`/rei`, `/click`, `/translate`, `/admin`), resolved either by the Vite dev
proxy or, in production web deploys, by serving the SPA from the same origin
as Django/Flask. Neither exists inside a Cordova WebView (content is served
from `file://` or an app-local scheme), so relative URLs would resolve
against the app's own origin instead of the real backend.

To fix this, `frontend/src/config.js` exports `API_BASE` / `FLASK_BASE` /
`DJANGO_ORIGIN`, all defaulting to relative paths (so web/Electron behavior
is untouched). `frontend/.env.cordova` overrides them at build time to the
deployed domain:

```
VITE_API_BASE=http://openshsid.zengyuxiang.cn:19424/api
VITE_FLASK_BASE=http://openshsid.zengyuxiang.cn:5000
VITE_DJANGO_ORIGIN=http://openshsid.zengyuxiang.cn:19424
```

`npm run build:cordova` (in `frontend/`) builds with `--mode cordova`, which
Vite uses to load `.env.cordova` automatically. That build also:
- uses `base: './'` (relative asset paths — same reasoning as the Electron
  renderer's `vite.config.js`),
- **skips the PWA plugin** (service workers are meaningless in a native
  WebView shell),
- outputs to `frontend/dist-cordova/` (a separate directory from the regular
  `dist/`, so it never collides with a normal web build).

`scripts/sync-www.js` runs that build and copies the result into
`cordova/www/`.

Update the domain in `.env.cordova` (and in `config.xml` / the network files
below) if the backend ever moves.

## Network security

The deployed backend is plain HTTP today. Both mobile platforms block
cleartext HTTP by default, so `config.xml` carries narrow, domain-scoped
exceptions rather than disabling the protection outright:

- **Android**: `res/android/network_security_config.xml` allows cleartext
  only for `openshsid.zengyuxiang.cn`; wired into the manifest via
  `<edit-config>` in `config.xml`.
- **iOS**: an `NSExceptionDomains` entry in `config.xml`'s `<edit-config
  target="NSAppTransportSecurity">` block, same single domain.

**If the backend moves to HTTPS**, remove both of these (and the `http://`
entries in `.env.cordova` / `<access>` / `<allow-navigation>`) — plain HTTP
should not be exempted once it isn't needed.

## Develop

Requires the Cordova CLI plus each platform's native SDK (Android Studio /
`ANDROID_HOME` for Android; Xcode + CocoaPods for iOS, macOS only).

The Android npm scripts (`add:android` / `run:android` / `build:android`) run
through `scripts/cordova-android.js`, which resolves `ANDROID_HOME` and
`JAVA_HOME` (JDK 21) for Gradle — using those env vars if set, otherwise
auto-detecting the SDK at `%LOCALAPPDATA%\Android\Sdk` and a JDK under
`C:\Program Files\Java`. So a bare `npm run build:android` works without
exporting anything first. Check what got resolved with `npm run env:android`;
override by setting `ANDROID_HOME` / `JAVA_HOME` before the command.

```bash
cd cordova
npm install                # installs cordova-cli, platforms, plugins as local devDeps
npm run add:android        # or: npm run add:ios  (one-time per platform)
npm run run:android         # builds frontend + copies to www/, then cordova run android
```

`sync:www` (build + copy) runs automatically before `run:*`/`build:*`; run it
standalone with `npm run sync:www` if you just want to refresh `www/`.

## Package for release

```bash
npm run build:android      # -> platforms/android/app/build/outputs/...
npm run build:ios          # -> open platforms/ios/*.xcworkspace in Xcode to archive
```

Release builds need signing configured per-platform (Android keystore /
Gradle signing config; iOS provisioning profile in Xcode) — Cordova's release
build only produces an unsigned artifact otherwise.

## Known limitations

- **Popup-based login** (`LinkedClassroom.jsx`'s `window.open(..., 'lc_browser_login', 'width=...')`)
  relies on real browser popup windows, which don't exist in a mobile
  WebView. That flow will likely need a Cordova-specific rework (e.g. an
  in-app browser plugin with a completion callback) if LC login is needed on
  mobile — not addressed by this packaging pass.
- The `/admin/` link opens via `window.open(..., '_blank')`, which
  `cordova-plugin-inappbrowser` (if added) would show as an in-app overlay
  rather than the system browser Electron opens it in. Not currently a
  blocker since Django admin isn't a primary mobile use case.
- No app icon exists for `res/icon/ios/icon-1024.png`'s "single size" App
  Icon requirement on older `cordova-ios`/Xcode combinations — if the build
  complains about missing icon sizes, regenerate a full traditional icon set
  (Xcode 14+ / cordova-ios 7+ should accept the single 1024 icon as-is).

## Security

Same `cordova-plugin-whitelist` model as any Cordova app: only
`openshsid.zengyuxiang.cn` is reachable via `<access>`/`<allow-navigation>`;
anything else falls through to `<allow-intent>` and opens in an external
handler (browser, dialer, mail client) instead of inside the app.
