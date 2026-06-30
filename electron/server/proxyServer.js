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

  const toDjango = createProxyMiddleware({
    target: DJANGO_URL,
    changeOrigin: true,
  });
  const toFlask = createProxyMiddleware({
    target: FLASK_URL,
    changeOrigin: true,
    ws: true,            // 预留：SSE/长连接
    proxyTimeout: 0,     // 模型流式输出不超时
    timeout: 0,
  });

  // 后端前缀 → 对应服务
  app.use('/api', toDjango);
  app.use('/admin', toDjango);
  app.use('/static', toDjango);
  app.use('/rei', toFlask);
  app.use('/click', toFlask);
  app.use('/translate', toFlask);

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
