// 后端地址：全站唯一集中配置处。api/client.js、Layout、头像解析、AI 聊天等
// 所有需要后端地址的地方都从这里取，不要在别处硬编码。
//
// 优先级：设置页的运行时覆盖（localStorage）> 构建时环境变量 > 同源相对路径。
//
// 构建时变量（见 .env.cordova / cordova/README.md）：
//   VITE_API_BASE       Django REST API 根（含 /api 前缀）
//   VITE_FLASK_BASE     Flask 模型服务根（/rei、/click 等）
//   VITE_DJANGO_ORIGIN  Django 站点根（/admin、/media 等非 REST 路径）
//
// 设置页「后端地址」存的是站点根（如 https://example.com），三个值统一推导：
//   API_BASE = <root>/api，FLASK_BASE = <root>，DJANGO_ORIGIN = <root>
const OVERRIDE_KEY = 'shsid_server_url';

// 当前生效的运行时覆盖（已规范化的站点根，无则为 ''）
export function getServerOverride() {
  try {
    return (localStorage.getItem(OVERRIDE_KEY) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

// 保存/清除覆盖。输入可省略协议（默认补 https://），允许带路径（只取 origin），
// 空串 = 恢复默认。返回规范化后的地址；非法输入由 new URL 抛错，调用方负责提示。
export function setServerOverride(url) {
  let u = (url || '').trim();
  if (u) {
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    u = new URL(u).origin;
  }
  try {
    if (u) localStorage.setItem(OVERRIDE_KEY, u);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* WebView 隐私模式等场景下 localStorage 不可用，静默忽略 */
  }
  return u;
}

const override = getServerOverride();

export const API_BASE = override
  ? `${override}/api`
  : import.meta.env.VITE_API_BASE || '/api';
export const FLASK_BASE = override || import.meta.env.VITE_FLASK_BASE || '';
// Django 站点根（不含 /api 前缀），用于 /admin/ 等非 REST 路径
export const DJANGO_ORIGIN = override || import.meta.env.VITE_DJANGO_ORIGIN || '';
