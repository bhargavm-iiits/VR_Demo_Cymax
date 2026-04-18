import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // ── Allow large video/image assets without inlining ──────────────
  assetsInclude: ['**/*.mp4', '**/*.webm', '**/*.ogg', '**/*.mov'],

  build: {
    // Raise the chunk size warning limit (videos are large)
    chunkSizeWarningLimit: 10000,
    assetsInlineLimit: 0,      // never inline video files as base64
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  server: {
    // Allow large file streaming (needed for videos)
    headers: {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    },
    proxy: {
      '/api': 'https://vr-demo-cymax.onrender.com',
      '/socket.io': {
        target: 'https://vr-demo-cymax.onrender.com',
        ws: true,
      },
    },
  },
})