'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { FormField, fieldDescribedBy } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useResendVerification } from '@/hooks/use-resend-verification'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { loginSchema, type LoginValues } from '@/lib/validation/auth'
import { AuthAlert } from './AuthAlert'
import { PasswordInput } from './PasswordInput'

const NOTICES: Record<string, { tone: 'warning' | 'info'; text: string }> = {
  link_expired: { tone: 'warning', text: 'Your link expired. Sign in, or request a new one.' },
  password_updated: { tone: 'info', text: 'Your password was updated. Sign in with your new password.' },
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get('redirectTo'))
  const notice = NOTICES[searchParams.get('error') ?? searchParams.get('notice') ?? '']

  const [formError, setFormError] = useState<string | null>(null)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const resend = useResendVerification(unconfirmedEmail ?? '')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    setUnconfirmedEmail(null)
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: values, redirectOnUnauthenticated: false })
      router.replace(redirectTo)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === 'EMAIL_NOT_CONFIRMED') setUnconfirmedEmail(values.email)
        setFormError(error.message)
      } else {
        setFormError("We couldn't reach the server. Try again in a moment.")
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 text-fg">Sign in to ContractIQ</h1>
        <p className="text-body text-fg-muted">Review NDAs and MSAs in minutes.</p>
      </div>

      {notice && !formError && <AuthAlert tone={notice.tone}>{notice.text}</AuthAlert>}
      {formError && (
        <AuthAlert tone="danger">
          <span>{formError}</span>
          {unconfirmedEmail && (
            <button
              type="button"
              onClick={resend.resend}
              disabled={resend.pending || resend.cooldown > 0}
              className="self-start font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-60"
            >
              {resend.cooldown > 0 ? `Resend email in ${resend.cooldown}s` : 'Resend email'}
            </button>
          )}
        </AuthAlert>
      )}
      {resend.status && <AuthAlert tone={resend.status.tone}>{resend.status.message}</AuthAlert>}

      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          invalid={!!errors.email}
          aria-describedby={fieldDescribedBy('email', { error: errors.email?.message })}
          {...register('email')}
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <FormField id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            aria-describedby={fieldDescribedBy('password', { error: errors.password?.message })}
            {...register('password')}
          />
        </FormField>
        <Link href="/forgot-password" className="self-end text-body-sm font-medium text-brand hover:text-brand-700">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Sign in
      </Button>

      <p className="text-center text-body text-fg-muted">
        New to ContractIQ?{' '}
        <Link href="/signup" className="font-medium text-brand hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </form>
  )
}
