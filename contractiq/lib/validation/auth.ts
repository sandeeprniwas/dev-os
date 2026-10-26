import { z } from 'zod'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .pipe(z.email('Enter a valid email address'))

const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})

export const signupSchema = z
  .object({
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
