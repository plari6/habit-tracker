import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'"

// Strict CSP for the built app only: the dev server needs inline scripts for HMR.
const csp = (): Plugin => ({
  name: 'inject-csp',
  transformIndexHtml(html, ctx) {
    if (ctx.server) return html
    return html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  }
})

const alias = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias }
  },
  renderer: {
    plugins: [react(), tailwindcss(), csp()],
    resolve: { alias }
  }
})
