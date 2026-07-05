// 生产模式下的本地静态 + 反向代理服务器。
//
// 打包后的渲染进程（frontend 的副本）仍使用相对地址请求后端：
//   /api、/admin、/static  → Django
//   /rei、/click、/translate → Flask
// 浏览器里这些靠 Vite dev 代理转发；file:// 下相对地址会失效，
// 因此这里复刻一份代理：用本地 http 服务器托管构建产物，并把上述前缀转发到后端，
// 让复制过来的网络代码无需改动即可在 Electron 中运行。

const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { DJANGO_URL, FLASK_URL } = require('../config');

// 启动服务器，返回 Promise<actualPort>
function startProxyServer({ port, distDir }) {
  const app = express();

  // 注意：app.use('/prefix', middleware) 会让 Express 在调用 middleware 前
  // 把 req.url 里的挂载前缀剥掉（例如 /api/auth/login/ 进来时 middleware 只
  // 看到 /auth/login/）。http-proxy-middleware 直接转发被剥过的 req.url，
  // 于是后端收到的请求丢了前缀（如 Django 收到 /auth/login/ 而非
  // /api/auth/login/，404）。用 pathRewrite 把前缀加回去。
  // dev 模式下 Vite 的代理不走 app.use 挂载，没有这个坑，所以只在打包后才炸。
  const mount = (prefix, target, extra = {}) => {
    app.use(prefix, createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { '^/': `${prefix}/` },
      ...extra,
    }));
  };

  mount('/api', DJANGO_URL);
  mount('/admin', DJANGO_URL);
  mount('/static', DJANGO_URL);
  mount('/rei', FLASK_URL, { ws: true, proxyTimeout: 0, timeout: 0 });
  mount('/click', FLASK_URL);
  mount('/translate', FLASK_URL);

  // 静态资源（构建产物）
  app.use(express.static(distDir));

  // SPA 回退：其余路由交给 index.html（React Router 接管）
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      resolve(server.address().port);
    });
    server.on('error', reject);
  });
}

module.exports = { startProxyServer };
