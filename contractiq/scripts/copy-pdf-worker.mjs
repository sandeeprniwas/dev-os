// Copies the pdf.js worker that matches the installed pdfjs-dist into public/ so the browser viewer
// loads it same-origin (CSP worker-src 'self'). Runs on postinstall.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
const target = join(root, 'public', 'pdf.worker.min.mjs')

mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.info(`Copied pdf.js worker → public/pdf.worker.min.mjs (pdfjs-dist ${require('pdfjs-dist/package.json').version})`)
