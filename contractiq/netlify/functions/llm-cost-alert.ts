import type { Config } from '@netlify/functions'
import { createAdminClient } from '../../lib/supabase/admin'
import { runCostAlert } from '../../lib/jobs/alerts'
import { logger } from '../../lib/utils/logger'

export default async function handler(): Promise<Response> {
  const admin = createAdminClient()
  if (!admin) {
    logger.warn('llm_cost_alert_skipped', { reason: 'service role not configured' })
    return new Response('skipped', { status: 200 })
  }
  const budgetUsd = Number(process.env.LLM_MONTHLY_BUDGET_USD ?? 300) || 300
  const result = await runCostAlert(admin, { budgetUsd, webhookUrl: process.env.SLACK_ALERT_WEBHOOK_URL || undefined })
  logger.info('llm_cost_alert', result)
  return Response.json(result)
}

export const config: Config = { schedule: '0 8 * * *' }
