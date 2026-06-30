const path = require('path');
const { app, BrowserWindow, shell } = require('electron');
const { DEV_SERVER_URL, LOCAL_PORT } = require('../config');

const isDev = !app.isPackaged;
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
    backgroundColor: '#0b0b0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

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

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
