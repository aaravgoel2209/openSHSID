import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Electron 打包后由本地静态+代理服务器从根路径提供，资源用相对路径更稳妥
  base: './',
  server: {
    host: '0.0.0.0',
    // 固定端口，避免与网页版前端(5173)冲突；占用则报错而非静默改端口
    port: 5180,
    strictPort: true,
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
