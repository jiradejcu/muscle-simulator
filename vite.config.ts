import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/muscle-simulator/' : '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 2000 },
})
