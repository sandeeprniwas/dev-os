import type { Config } from 'tailwindcss'

// Primitive palettes — the only place raw hex values live (docs/design.md).
const grey = { 25: '#FAFAFA', 50: '#F0F0F1', 100: '#DADADB', 200: '#C1C2C3', 300: '#8F9193', 400: '#5E6062', 500: '#4A4C4F', 600: '#2C2F32', 700: '#25272B', 800: '#151719', 900: '#070A0E' }
const blue = { 50: '#E7EFFC', 100: '#B6CFF5', 200: '#92B7F0', 300: '#6196EA', 400: '#89B7FF', 500: '#115ACB', 600: '#0044AE', 700: '#0D469E', 800: '#0A367B', 900: '#082A5E' }
const green = { 50: '#E7F6E7', 100: '#B6E2B4', 200: '#92D490', 300: '#61C05E', 400: '#42B43E', 500: '#13A10E', 600: '#11930D', 700: '#0D720A', 800: '#0A5908', 900: '#084406' }
const red = { 50: '#FAEBEB', 100: '#F1C0C1', 200: '#EAA2A3', 300: '#E0777A', 400: '#DA5D60', 500: '#D13438', 600: '#BE2F33', 700: '#942528', 800: '#731D1F', 900: '#581618' }
const yellow = { 50: '#FFF9F0', 100: '#FFF2E0', 200: '#FFE3BD', 300: '#FFD294', 400: '#FFC16B', 500: '#FFAA33', 600: '#FA9200', 700: '#DB8000', 800: '#B36800', 900: '#854D00' }
const violet = { 50: '#F7F0FF', 100: '#F2E5FF', 200: '#E3C7FF', 300: '#D1A3FF', 400: '#B870FF', 500: '#7F00FF', 600: '#7000E0', 700: '#6600CC', 800: '#5700AD', 900: '#380070' }
const orange = { 50: '#FFF4F0', 100: '#FFE9E0', 200: '#FFD3C2', 300: '#FFBA9E', 400: '#FF956B', 500: '#FF4405', 600: '#E63900', 700: '#D63D00', 800: '#B33300', 900: '#802400' }

const config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grey,
        orange,
        brand: { ...blue, DEFAULT: blue[500] },
        success: { ...green, DEFAULT: green[500] },
        danger: { ...red, DEFAULT: red[500] },
        warning: { ...yellow, DEFAULT: yellow[500] },
        accent: { ...violet, DEFAULT: violet[500] },
        // Semantic aliases — use these in components
        fg: { DEFAULT: grey[900], muted: grey[500], disabled: grey[400], inverse: '#FFFFFF' },
        page: grey[25],
        surface: '#FFFFFF',
        subtle: grey[50],
        border: { DEFAULT: grey[100], strong: grey[200], focus: blue[500] },
      },
      fontFamily: {
        sans: ['var(--font-inter-display)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h2: ['36px', { lineHeight: '44px', fontWeight: '700' }],
        h3: ['30px', { lineHeight: '38px', fontWeight: '600' }],
        h4: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h5: ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
      letterSpacing: { normal: '0' },
      borderRadius: { none: '0', sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px', xl: '12px', full: '9999px' },
      boxShadow: { overlay: '0 4px 16px rgba(7, 10, 14, 0.08)' },
      spacing: { 18: '72px', 28: '112px' },
      transitionDuration: { micro: '100ms', fast: '150ms', base: '200ms', page: '250ms' },
      keyframes: {
        'pulse-outline': {
          '0%, 100%': { outlineColor: 'transparent' },
          '50%': { outlineColor: blue[500] },
        },
      },
      animation: { 'pulse-outline': 'pulse-outline 1s ease-in-out 2' },
    },
  },
  plugins: [],
} satisfies Config

export default config
