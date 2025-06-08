import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: true,
    transformMode: {
      web: [/\.[jt]sx?$/]
    },
    deps: {
      optimizer: {
        web: {
          include: ['react-chartjs-2', 'chart.js']
        }
      }
    }
  }
})
