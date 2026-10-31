import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// base './' so the same build works on GitHub Pages and inside the Android APK (Capacitor)
// "harness" mode builds a separate design-check page with fake data (never deployed)
export default defineConfig(({ mode }) => ({
  base: './',
  // shown in Settings so you can see which version a phone runs (APK builds pass APP_BUILD)
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(process.env.APP_BUILD || ''),
  },
  plugins: [react(), tailwindcss()],
  build:
    mode === 'harness'
      ? { outDir: 'dist-harness', rollupOptions: { input: { harness: 'harness.html' } } }
      : undefined,
}))
