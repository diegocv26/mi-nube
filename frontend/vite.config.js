import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // permite entrar desde otros dispositivos de la red
    port: 5173,
    proxy: {
      // El navegador le habla a Vite y Vite reenvía al backend.
      // Así no hardcodeamos IPs ni tenemos problemas de CORS.
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
})
