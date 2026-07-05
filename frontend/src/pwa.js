// 手动注册 service worker（vite.config.js 里 VitePWA 的 injectRegister: false）。
// registerType: 'prompt' 意味着新版本不会自动接管——需要用户确认后才刷新，
// 避免正在填写的表单/编辑器内容被静默重载打断。
import { registerSW } from 'virtual:pwa-register';

let updateSW = null;
const listeners = new Set();

// 供 PwaUpdateToast 订阅：'needRefresh' | 'offlineReady'
export function onPwaEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyPwaUpdate() {
  updateSW?.(true);
}

export function initPwa() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      listeners.forEach((fn) => fn('needRefresh'));
    },
    onOfflineReady() {
      listeners.forEach((fn) => fn('offlineReady'));
    },
  });
}
