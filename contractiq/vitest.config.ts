import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.int.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'components/**', 'hooks/**'],
    },
  },
})
