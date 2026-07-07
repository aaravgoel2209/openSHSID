// Cordova 原生壳没有 service worker（vite.config.js 里 cordova 模式不注册 VitePWA 插件），
// 构建时通过 resolve.alias 把 PwaUpdateToast 换成这个空实现，
// 避免真实实现里对 'virtual:pwa-register' 的静态 import 在没有该插件时无法解析。
export default function PwaUpdateToast() {
  return null;
}
