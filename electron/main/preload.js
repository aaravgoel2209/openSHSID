// 预加载脚本：在隔离的上下文里向渲染进程暴露一个最小、安全的 API。
// 渲染进程（frontend 副本）完全走 HTTP 与后端通信；这里只暴露平台信息、
// 桌面特效能力标记，以及一个把主题同步给主进程的单向通道。
const { contextBridge, ipcRenderer } = require('electron');

// 主进程通过 additionalArguments 传入的能力标记（sandbox 下依然可读）
const nativeBlur = process.argv.includes('--openshsid-native-blur');
const overlayControls = process.argv.includes('--openshsid-overlay-controls');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  // 系统级毛玻璃是否可用（Win11 acrylic / macOS vibrancy）
  nativeBlur,
  // Windows 隐藏标题栏 + 窗口控制按钮 overlay 是否启用
  overlayControls,
  // 深浅色切换时通知主进程（同步窗口控制按钮配色）
  setTheme: (isDark) => ipcRenderer.send('theme-changed', !!isDark),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
