// 预加载脚本：在隔离的上下文里向渲染进程暴露一个最小、安全的 API。
// 渲染进程（frontend 副本）目前完全走 HTTP 与后端通信，暂不需要原生能力；
// 这里先暴露平台信息和版本号，后续按需扩展（如文件保存、原生通知）。
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
