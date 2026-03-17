import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5050',
      '/auth': 'http://localhost:5050',
      '/healthz': 'http://localhost:5050',
      '/readyz': 'http://localhost:5050',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
