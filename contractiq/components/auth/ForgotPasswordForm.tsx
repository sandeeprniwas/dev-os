'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { FormField, fieldDescribedBy } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validation/auth'
import { AuthAlert } from './AuthAlert'

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null)
    try {
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: values, redirectOnUnauthenticated: false })
      setSentTo(values.email)
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "We couldn't reach the server. Try again in a moment.")
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <MailCheck className="h-10 w-10 text-brand" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <h1 className="text-h5 text-fg">Check your inbox</h1>
          <p className="text-body text-fg-muted">
            If an account exists for <strong className="font-medium text-fg">{sentTo}</strong>, we sent a link to reset
            the password. The link works once and expires soon.
          </p>
        </div>
        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 text-fg">Reset your password</h1>
        <p className="text-body text-fg-muted">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      {formError && <AuthAlert tone="danger">{formError}</AuthAlert>}
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
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-body text-fg-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </form>
  )
}
