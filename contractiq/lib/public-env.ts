// Browser-safe configuration. Next.js inlines NEXT_PUBLIC_* values at build time,
// so each variable must be referenced literally.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  calibrationWarning: process.env.NEXT_PUBLIC_CALIBRATION_WARNING === 'true',
} as const
