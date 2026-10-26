'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { FormField, fieldDescribedBy } from '@/components/ui/FormField'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/validation/auth'
import { AuthAlert } from './AuthAlert'
import { PasswordInput } from './PasswordInput'

const PASSWORD_HINT = '8+ characters, with a letter and a number.'

export function ResetPasswordForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null)
    try {
      await apiFetch('/api/auth/reset-password', { method: 'POST', body: values, redirectOnUnauthenticated: false })
      // End the recovery session everywhere and require a fresh sign-in with the new password.
      await apiFetch('/api/auth/logout', { method: 'POST', redirectOnUnauthenticated: false }).catch(() => undefined)
      router.replace('/login?notice=password_updated')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'UNAUTHENTICATED') {
        router.replace('/login?error=link_expired')
        return
      }
      setFormError(error instanceof ApiClientError ? error.message : "We couldn't reach the server. Try again in a moment.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 text-fg">Choose a new password</h1>
        <p className="text-body text-fg-muted">You&apos;ll sign in again with it afterwards.</p>
      </div>
      {formError && <AuthAlert tone="danger">{formError}</AuthAlert>}
      <FormField id="password" label="New password" hint={PASSWORD_HINT} error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          autoFocus
          invalid={!!errors.password}
          aria-describedby={fieldDescribedBy('password', { error: errors.password?.message, hint: PASSWORD_HINT })}
          {...register('password')}
        />
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          invalid={!!errors.confirmPassword}
          aria-describedby={fieldDescribedBy('confirmPassword', { error: errors.confirmPassword?.message })}
          {...register('confirmPassword')}
        />
      </FormField>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Update password
      </Button>
    </form>
  )
}
