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
      '/rei': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
