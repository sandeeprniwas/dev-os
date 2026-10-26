import type { Config } from '@netlify/functions'
import { createAdminClient } from '../../lib/supabase/admin'
import { purgeExpiredPdfs } from '../../lib/jobs/purge-expired-pdfs'
import { logger } from '../../lib/utils/logger'

export default async function handler(): Promise<Response> {
  const admin = createAdminClient()
  if (!admin) {
    logger.warn('purge_expired_pdfs_skipped', { reason: 'service role not configured' })
    return new Response('skipped', { status: 200 })
  }
  const result = await purgeExpiredPdfs(admin)
  return Response.json(result)
}

export const config: Config = { schedule: '0 3 * * *' }
