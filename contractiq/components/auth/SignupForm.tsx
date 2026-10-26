'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { FormField, fieldDescribedBy } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { signupSchema, type SignupValues } from '@/lib/validation/auth'
import { AuthAlert } from './AuthAlert'
import { PasswordInput } from './PasswordInput'

const PASSWORD_HINT = '8+ characters, with a letter and a number.'

export function SignupForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values: SignupValues) {
    setFormError(null)
    try {
      const { status } = await apiFetch<{ status: 'signed_in' | 'verify_email' }>('/api/auth/signup', {
        method: 'POST',
        body: values,
        redirectOnUnauthenticated: false,
      })
      if (status === 'signed_in') {
        router.replace('/dashboard')
        router.refresh()
        return
      }
      router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`)
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "We couldn't reach the server. Try again in a moment.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 text-fg">Create your account</h1>
        <p className="text-body text-fg-muted">Start reviewing contracts in minutes.</p>
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

      <FormField id="password" label="Password" hint={PASSWORD_HINT} error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          aria-describedby={fieldDescribedBy('password', { error: errors.password?.message, hint: PASSWORD_HINT })}
          {...register('password')}
        />
      </FormField>

      <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          invalid={!!errors.confirmPassword}
          aria-describedby={fieldDescribedBy('confirmPassword', { error: errors.confirmPassword?.message })}
          {...register('confirmPassword')}
        />
      </FormField>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Create account
      </Button>

      <p className="text-center text-body text-fg-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </form>
  )
}
