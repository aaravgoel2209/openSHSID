import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

// 构建时抓取当前 commit 信息（首行 = 版本说明），注入给「关于」弹窗。
// 无 git 环境（如脱离仓库打包）时降级为空串，不阻塞构建。
function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: here, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf-8'))
const BUILD_INFO = {
  version: pkg.version,
  commit: git('log -1 --pretty=%s'),   // commit message 首行
  hash: git('log -1 --pretty=%h'),
  date: git('log -1 --pretty=%cs'),
  builtAt: new Date().toISOString(),
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // 手动注册（见 src/pwa.js），这样能在更新可用时弹一个提示而不是静默刷新
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'openSHSID',
        short_name: 'openSHSID',
        description: 'openSHSID —— 问答 / 知识库 / LinkedClassroom',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#6366f1',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 只预缓存构建产物本身；后端路由绝不能被 service worker 拦截/离线回退，
        // 否则 /admin（Django 后台）离线时会被错误地换成 SPA 的 index.html，
        // /api /rei /click /translate 等接口也绝不能被当成页面导航处理。
        navigateFallbackDenylist: [/^\/admin/, /^\/api/, /^\/static/, /^\/rei/, /^\/click/, /^\/translate/],
      },
      devOptions: {
        // dev 模式默认不启用 SW，避免本地开发时缓存干扰热更新
        enabled: false,
      },
    }),
  ],
  define: {
    __BUILD_INFO__: JSON.stringify(BUILD_INFO),
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:19424',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:19424',
        changeOrigin: true,
      },
      // Django admin 的静态资源（CSS/JS），否则后台页面会渲染成无样式的裸 HTML
      '/static': {
        target: 'http://localhost:19424',
        changeOrigin: true,
      },
      '/rei': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/click': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/translate': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
