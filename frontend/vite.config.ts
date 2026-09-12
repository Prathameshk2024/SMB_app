import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const here = path.dirname(fileURLToPath(import.meta.url))
const shared = path.resolve(here, '../shared/src')

/**
 * THE TWO BUILDS OF THIS APP NEED DIFFERENT ASSET PATHS.
 *
 * Capacitor loads the built files off the phone's filesystem, where there is
 * no server root, so every reference has to be relative - `./assets/…`.
 *
 * On the web that same relative path is wrong for any route deeper than one
 * segment. Reloading `/seller/orders` makes the browser resolve `./assets/…`
 * against `/seller/`, ask for `/seller/assets/index-xxx.js`, and get
 * `index.html` back from the SPA rewrite - a script tag served HTML, which is
 * a blank page and a console full of MIME errors. Absolute `/assets/…` is
 * correct at every depth.
 *
 * Chosen by `--mode capacitor`, which `npm run cap:sync` passes, rather than
 * by an environment variable that has to be remembered and that needs a
 * cross-platform shim to set on Windows. Nobody has to know the flag: the
 * command that builds the APK carries it, and the failure it prevents only
 * shows up after a deploy, on the routes nobody reloads first.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'capacitor' ? './' : '/',
  resolve: {
    alias: [{ find: /^@shared\/(.*)\.js$/, replacement: `${shared}/$1.ts` }],
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [here, shared] },
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: true },
}))
