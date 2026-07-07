// 后端地址：网页版留空，用相对路径（同源部署 / Vite dev 代理）；
// 打包 Cordova（原生壳跑在 file://，没有反向代理层）时，构建时通过
// VITE_API_BASE / VITE_FLASK_BASE 环境变量指向已部署的公网域名（见 cordova/README.md）。
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';
export const FLASK_BASE = import.meta.env.VITE_FLASK_BASE || '';
// Django 站点根（不含 /api 前缀），用于 /admin/ 等非 REST 路径
export const DJANGO_ORIGIN = import.meta.env.VITE_DJANGO_ORIGIN || '';
