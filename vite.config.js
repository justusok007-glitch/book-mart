import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the same build works on GitHub Pages and inside the Android APK (Capacitor)
// "harness" mode builds a separate design-check page with fake data (never deployed)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  build:
    mode === 'harness'
      ? { outDir: 'dist-harness', rollupOptions: { input: { harness: 'harness.html' } } }
      : undefined,
}))
