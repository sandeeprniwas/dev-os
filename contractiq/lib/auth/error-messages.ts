type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined

export const AUTH_NETWORK_ERROR = "We couldn't reach the server. Try again in a moment."

/** Maps Supabase Auth errors to user-facing copy (auth spec §4.3, §6). */
export function authErrorMessage(error: AuthErrorLike): string {
  if (!error) return AUTH_NETWORK_ERROR
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email or password is incorrect.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please verify your email first.'
  }
  if (code === 'user_already_exists' || message.includes('already registered')) {
    return 'An account with this email already exists.'
  }
  if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) {
    return 'Too many emails were sent. Please wait a few minutes and try again.'
  }
  if (code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return 'Choose a stronger password: at least 8 characters with a letter and a number.'
  }
  if (code === 'signup_disabled') {
    return 'Sign-ups are currently disabled.'
  }
  if (error.status === undefined || error.status >= 500 || message.includes('fetch')) {
    return AUTH_NETWORK_ERROR
  }
  return 'Something went wrong. Please try again.'
}

export function isEmailNotConfirmed(error: AuthErrorLike): boolean {
  return error?.code === 'email_not_confirmed' || (error?.message ?? '').toLowerCase().includes('email not confirmed')
}
