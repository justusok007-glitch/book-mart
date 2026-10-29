import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the same build works on GitHub Pages and inside the Android APK (Capacitor)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
