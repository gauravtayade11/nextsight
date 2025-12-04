import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', '@heroicons/react'],
          'vendor-charts': ['recharts', 'd3-scale', 'd3-shape', 'd3-path'],
          'vendor-utils': ['axios', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
