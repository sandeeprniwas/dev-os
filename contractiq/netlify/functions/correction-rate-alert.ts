import type { Config } from '@netlify/functions'
import { createAdminClient } from '../../lib/supabase/admin'
import { runCorrectionRateAlert } from '../../lib/jobs/alerts'
import { logger } from '../../lib/utils/logger'

export default async function handler(): Promise<Response> {
  const admin = createAdminClient()
  if (!admin) {
    logger.warn('correction_rate_alert_skipped', { reason: 'service role not configured' })
    return new Response('skipped', { status: 200 })
  }
  const result = await runCorrectionRateAlert(admin, { webhookUrl: process.env.SLACK_ALERT_WEBHOOK_URL || undefined })
  logger.info('correction_rate_alert', result)
  return Response.json(result)
}

export const config: Config = { schedule: '0 8 * * *' }
