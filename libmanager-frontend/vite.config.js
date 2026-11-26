import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Bind IPv4+IPv6 — tránh lỗi ẩn danh/Chrome dùng 127.0.0.1 trong khi Vite chỉ listen [::1]
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8010',
        changeOrigin: true,
      }
    }
  }
})