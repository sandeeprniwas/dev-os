import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// `server-only` throws when imported outside a React Server environment; tests import server modules directly.
vi.mock('server-only', () => ({}))
