import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/** User-scoped (RLS) or admin Supabase client typed with our schema. */
export type DbClient = SupabaseClient<Database>
