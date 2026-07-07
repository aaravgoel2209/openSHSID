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

// mode === 'cordova'（起于 `vite build --mode cordova`，见 package.json 的 build:cordova 脚本）：
// 给 Cordova 原生壳打包的构建产物（复制进 cordova/www/）。与普通网页构建的区别：
// - base 用相对路径——Cordova 内容跑在 file:// / 自定义 scheme 下，绝对路径 '/assets/...' 会失效
//   （与 electron/renderer 同样的坑，参见那边的 base: './'）
// - 不启用 PWA 插件——service worker/manifest 对原生壳没有意义，且 SW 的 fetch 拦截
//   在部分 WebView 实现里表现不一致，没必要在原生壳里背这个包袱
// - 单独的 outDir，不与网页版的 dist/ 互相覆盖
export default defineConfig(({ mode }) => {
  const cordova = mode === 'cordova'
  return {
    base: cordova ? './' : '/',
    plugins: [
      tailwindcss(),
      react(),
      // Cordova 原生壳不需要 PWA（manifest/service worker 对 WebView 内容没有意义）
      !cordova && VitePWA({
        // 手动注册（见 src/pwa.js），这样能在更新可用时弹一个提示而不是静默刷新
        injectRegister: false,
        registerType: 'prompt',
        includeAssets: ['favicon.png', 'icons/*.png'],
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
    ].filter(Boolean),
    resolve: {
      alias: cordova
        // pwa.js 顶层静态 import 'virtual:pwa-register'——该虚拟模块只在 VitePWA 插件注册时存在，
        // cordova 模式没启用插件，必须在解析阶段就把引用换成空实现，而不能指望运行时判断跳过
        // （ES import 是静态的，构建时必须能解析，与是否执行到无关）。
        ? [{ find: /^\.\/components\/PwaUpdateToast$/, replacement: path.resolve(here, 'src/components/PwaUpdateToast.cordova.jsx') }]
        : [],
    },
    define: {
      __BUILD_INFO__: JSON.stringify(BUILD_INFO),
    },
    build: {
      outDir: cordova ? 'dist-cordova' : 'dist',
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
  }
})
