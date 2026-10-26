const DEFAULT_REDIRECT = '/dashboard'

/**
 * Accepts only same-origin relative paths (prevents open redirects via ?redirectTo= / ?next=).
 */
export function safeRedirectPath(input: string | null | undefined, fallback: string = DEFAULT_REDIRECT): string {
  if (!input) return fallback
  if (input.length > 200) return fallback
  if (!input.startsWith('/')) return fallback
  if (input.startsWith('//') || input.startsWith('/\\')) return fallback
  if (input.includes('://') || input.includes('\\')) return fallback
  if (/[\u0000-\u001f]/.test(input)) return fallback
  return input
}
