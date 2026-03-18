import { defineConfig } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Dev proxy target — point to production API for local testing.
// This lets you log in with real credentials and see live data,
// while running local frontend code. Safe: only your browser sees
// the local JS/CSS, nothing is deployed.
// Before deploying, this file does NOT affect the build output.
const API_TARGET = 'https://bok.lektorodd.no'

// Vite plugin: stamp the service worker cache name with a build hash
function swCacheVersionPlugin() {
    let buildHash
    return {
        name: 'sw-cache-version',
        buildStart() {
            buildHash = Date.now().toString(36)
        },
        closeBundle() {
            const swPath = resolve('dist/sw.js')
            try {
                let sw = readFileSync(swPath, 'utf8')
                sw = sw.replace(/bokbad-v\d+/, `bokbad-${buildHash}`)
                writeFileSync(swPath, sw)
                console.log(`\n  ✅ SW cache version → bokbad-${buildHash}`)
            } catch {
                // sw.js may not exist if not copied
            }
        }
    }
}

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: API_TARGET,
                changeOrigin: true,
                secure: true
            },
            '/uploads': {
                target: API_TARGET,
                changeOrigin: true,
                secure: true
            }
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'terser',
        rollupOptions: {
            output: {
                manualChunks: {
                    'chart': ['chart.js'],
                    'scanner': ['html5-qrcode']
                }
            }
        }
    },
    plugins: [swCacheVersionPlugin()],
    test: {
        environment: 'jsdom'
    }
})

