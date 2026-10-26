import { Inter } from 'next/font/google'

// Design system typeface. Inter Display isn't on Google Fonts; Inter is the agreed substitute,
// self-hosted at build time by next/font.
export const interDisplay = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-display',
  display: 'swap',
})
