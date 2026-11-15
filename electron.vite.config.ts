import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  // The sandboxed preload cannot require node_modules at runtime, so bundle the SDK bridge into it.
  preload: {
    build: { externalizeDeps: { exclude: ['@smartspectra/node-sdk'] } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
