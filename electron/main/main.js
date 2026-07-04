const path = require('path');
const os = require('os');
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { DEV_SERVER_URL, LOCAL_PORT } = require('../config');

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
// Windows 11（build 22000+）才支持 acrylic/mica 背景材质；macOS 用 vibrancy
const winBuild = isWin ? parseInt(os.release().split('.')[2] || '0', 10) : 0;
const supportsNativeBlur = isMac || (isWin && winBuild >= 22000);
// 隐藏系统标题栏、让应用自己的 topbar 充当标题栏（Linux 保留系统窗框，避免丢失窗口按钮）
const useCustomTitleBar = isWin || isMac;
const TOPBAR_HEIGHT = 48; // 与 renderer 里 h-12 的 topbar 对齐

// Windows 窗口控制按钮（最小化/最大化/关闭）配色，随应用深浅色主题切换
const OVERLAY_COLORS = {
  dark: { color: '#00000000', symbolColor: '#9ca3af' },
  light: { color: '#00000000', symbolColor: '#4b5563' },
};

let mainWindow = null;

async function resolveAppUrl() {
  if (isDev) {
    // 开发：直接用 Vite dev server（自带 /api、/rei 等代理）
    return DEV_SERVER_URL;
  }
  // 生产：启动本地静态+代理服务器托管构建产物，复刻 dev 代理
  const { startProxyServer } = require('../server/proxyServer');
  const distDir = path.join(__dirname, '..', 'renderer', 'dist');
  const port = await startProxyServer({ port: LOCAL_PORT, distDir });
  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 960,
    minHeight: 600,
    // 支持原生模糊时窗口底色透明，让系统毛玻璃透出来；否则退回不透明底色
    backgroundColor: supportsNativeBlur ? '#00000000' : '#0b0b0f',
    // Windows 11 亚克力材质（DWM 级模糊，桌面背景透过窗口呈现）
    ...(isWin && supportsNativeBlur ? { backgroundMaterial: 'acrylic' } : {}),
    // macOS 毛玻璃
    ...(isMac ? { vibrancy: 'under-window', visualEffectState: 'active' } : {}),
    ...(useCustomTitleBar
      ? {
          titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
          ...(isWin ? { titleBarOverlay: { ...OVERLAY_COLORS.dark, height: TOPBAR_HEIGHT } } : {}),
        }
      : {}),
    show: false, // ready-to-show 后再显示，避免白屏闪烁
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 把能力标记传给 preload（sandbox 下 preload 仍可读 process.argv）
      additionalArguments: [
        ...(supportsNativeBlur ? ['--openshsid-native-blur'] : []),
        ...(isWin && useCustomTitleBar ? ['--openshsid-overlay-controls'] : []),
      ],
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 外部链接（target=_blank / window.open）交给系统浏览器，不在应用内开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const url = await resolveAppUrl();
  await mainWindow.loadURL(url);

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// 渲染进程切换深浅色时，同步 Windows 窗口控制按钮配色
ipcMain.on('theme-changed', (event, isDark) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !isWin || !useCustomTitleBar) return;
  try {
    win.setTitleBarOverlay({ ...OVERLAY_COLORS[isDark ? 'dark' : 'light'], height: TOPBAR_HEIGHT });
  } catch { /* 旧版 Electron / 无 overlay 时静默忽略 */ }
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
