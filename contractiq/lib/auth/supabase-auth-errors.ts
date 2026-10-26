import type { AuthError } from '@supabase/supabase-js'
import { AppError } from '@/lib/api/errors'

/** Maps Supabase Auth errors from server-side auth calls to the API error model. */
export function fromAuthError(error: AuthError): AppError {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return new AppError('INVALID_CREDENTIALS')
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return new AppError('EMAIL_NOT_CONFIRMED')
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) {
    return new AppError('RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.', { retryAfterSeconds: 60 })
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return new AppError('VALIDATION_ERROR', 'Choose a stronger password: at least 8 characters with a letter and a number.', {
      fields: { password: 'Choose a stronger password' },
    })
  }
  if (code === 'same_password') {
    return new AppError('VALIDATION_ERROR', 'Choose a password you have not used before.', { fields: { password: 'Choose a new password' } })
  }
  if (code === 'signup_disabled') return new AppError('CONFLICT', 'Sign-ups are currently disabled.')
  return new AppError('INTERNAL_ERROR', undefined, { cause: { code, status: error.status } })
}
