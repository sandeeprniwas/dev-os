import 'server-only'
import { z } from 'zod'

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  // Optional locally: usage logging and scheduled jobs degrade gracefully without it.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o'),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  USER_ID_HASH_SALT: z
    .string()
    .min(16, 'must be at least 16 characters (e.g. openssl rand -hex 32)')
    .refine((v) => !v.startsWith('change-me'), 'still set to the placeholder value'),
  LLM_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(300),
  SLACK_ALERT_WEBHOOK_URL: z.union([z.url(), z.literal('')]).optional(),
  LLM_MODE: z.enum(['live', 'fixture']).default('live'),
  MAX_CHAT_HISTORY: z.coerce.number().int().min(0).max(198).default(100),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | null = null

/** Validated server environment. Throws a message naming every missing or invalid variable. */
export function getEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Invalid environment configuration — ${problems.join('; ')}`)
  }
  cached = parsed.data
  return cached
}
