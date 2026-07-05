import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
// electron/config.js 是打包后 proxyServer.js 用的同一份后端地址配置（CommonJS）。
// dev 模式下 Electron 直接加载这个 Vite dev server，走的是下面 server.proxy，
// 而不是 proxyServer.js —— 两边必须共用同一份配置，否则 dev 模式会一直打本地，
// 即使 config.js 已经改成指向远程部署的域名。
const require = createRequire(import.meta.url)
const { DJANGO_URL, FLASK_URL } = require('../config.js')

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
  plugins: [tailwindcss(), react()],
  define: {
    __BUILD_INFO__: JSON.stringify(BUILD_INFO),
  },
  // Electron 打包后由本地静态+代理服务器从根路径提供，资源用相对路径更稳妥
  base: './',
  server: {
    host: '0.0.0.0',
    // 固定端口，避免与网页版前端(5173)冲突；占用则报错而非静默改端口
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: DJANGO_URL,
        changeOrigin: true,
      },
      '/admin': {
        target: DJANGO_URL,
        changeOrigin: true,
      },
      // Django admin 的静态资源（CSS/JS），否则后台页面会渲染成无样式的裸 HTML
      '/static': {
        target: DJANGO_URL,
        changeOrigin: true,
      },
      '/rei': {
        target: FLASK_URL,
        changeOrigin: true,
      },
      '/click': {
        target: FLASK_URL,
        changeOrigin: true,
      },
      '/translate': {
        target: FLASK_URL,
        changeOrigin: true,
      },
    },
  },
})
