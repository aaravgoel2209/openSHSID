import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
  plugins: [tailwindcss(), react()],
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
    },
  },
})
