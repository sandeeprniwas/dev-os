const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isDev = process.env.NODE_ENV === 'development'

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl}`.trim(),
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^https/, 'wss')}`.trim(),
  `frame-src 'self' ${supabaseUrl}`.trim(),
  "worker-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets verification builds use a separate output folder so they never clobber a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Next 14 advisory mitigation: never serve /_next/image (docs/specs/foundation-and-conventions.md §1.1)
  images: { unoptimized: true },
  experimental: {
    // pdf.js (server-side text extraction) is loaded natively, not bundled
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  webpack: (config) => {
    // react-pdf / pdfjs-dist optionally require `canvas`, which is not used in the browser
    config.resolve.alias.canvas = false
    return config
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
