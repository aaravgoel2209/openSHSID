// 后端服务地址。可用环境变量覆盖（例如指向远程部署的后端）。
// 与 frontend/vite.config.js 的 dev 代理保持一致。
module.exports = {
  // Django REST API（也提供 /admin 与 /static）
  DJANGO_URL: process.env.OPENSHSID_DJANGO_URL || 'http://localhost:19424',
  // Flask 模型服务（/rei、/click、/translate）
  FLASK_URL: process.env.OPENSHSID_FLASK_URL || 'http://127.0.0.1:5000',
  // 生产模式下本地静态+代理服务器监听端口
  LOCAL_PORT: Number(process.env.OPENSHSID_LOCAL_PORT) || 41999,
  // 开发模式下 Vite dev server 地址（npm run dev 启动，端口见 renderer/vite.config.js）
  DEV_SERVER_URL: process.env.OPENSHSID_DEV_URL || 'http://localhost:5180',
};
