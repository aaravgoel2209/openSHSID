import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
