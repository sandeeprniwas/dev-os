import type { DbClient } from '@/lib/db/types'
import { postSlack } from '@/lib/utils/slack'

export const COST_ALERT_RATIO = 0.8
export const EXTRACTION_COST_TARGET_USD = 0.2
export const CORRECTION_RATE_THRESHOLD = 0.12
export const MIN_TERMS_FOR_CORRECTION_ALERT = 50

const PAGE = 1000

type UsageRow = { cost_usd: number; operation: string; success: boolean }

async function monthToDateUsage(admin: DbClient, now: Date): Promise<UsageRow[]> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const rows: UsageRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('llm_usage')
      .select('cost_usd,operation,success')
      .gte('created_at', monthStart)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`usage query failed: ${error.message}`)
    rows.push(...((data ?? []) as UsageRow[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

/** Daily: alert when month-to-date OpenAI spend reaches 80 % of budget, or extraction cost exceeds target. */
export async function runCostAlert(
  admin: DbClient,
  config: { budgetUsd: number; webhookUrl?: string; now?: Date },
): Promise<{ spendUsd: number; avgExtractionUsd: number; alerted: boolean }> {
  const now = config.now ?? new Date()
  const rows = await monthToDateUsage(admin, now)
  const spendUsd = rows.reduce((sum, row) => sum + Number(row.cost_usd), 0)
  const extractions = rows.filter((row) => row.operation === 'extraction' && row.success)
  const avgExtractionUsd = extractions.length
    ? extractions.reduce((sum, row) => sum + Number(row.cost_usd), 0) / extractions.length
    : 0

  const messages: string[] = []
  const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  if (spendUsd >= COST_ALERT_RATIO * config.budgetUsd) {
    messages.push(
      `:warning: ContractIQ OpenAI spend is $${spendUsd.toFixed(2)} (≥ ${COST_ALERT_RATIO * 100} % of $${config.budgetUsd}) for ${month}.`,
    )
  }
  if (avgExtractionUsd > EXTRACTION_COST_TARGET_USD) {
    messages.push(
      `:warning: Average extraction cost is $${avgExtractionUsd.toFixed(3)} this month (target ≤ $${EXTRACTION_COST_TARGET_USD.toFixed(2)}).`,
    )
  }

  const alerted = messages.length > 0 && (await postSlack(config.webhookUrl, messages.join('\n')))
  return { spendUsd, avgExtractionUsd, alerted }
}

/** Daily: alert when more than 12 % of terms from the last 7 days were corrected by users. */
export async function runCorrectionRateAlert(
  admin: DbClient,
  config: { webhookUrl?: string; now?: Date },
): Promise<{ total: number; edited: number; rate: number; alerted: boolean }> {
  const now = config.now ?? new Date()
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()

  const { data: contracts, error } = await admin.from('contracts').select('id').gte('processed_at', since)
  if (error) throw new Error(`contracts query failed: ${error.message}`)
  const ids = (contracts ?? []).map((row) => row.id)
  if (ids.length === 0) return { total: 0, edited: 0, rate: 0, alerted: false }

  const [totalResult, editedResult] = await Promise.all([
    admin.from('key_terms').select('id', { count: 'exact', head: true }).in('contract_id', ids),
    admin.from('key_terms').select('id', { count: 'exact', head: true }).in('contract_id', ids).eq('is_edited', true),
  ])
  if (totalResult.error) throw new Error(`key_terms count failed: ${totalResult.error.message}`)
  if (editedResult.error) throw new Error(`key_terms count failed: ${editedResult.error.message}`)

  const total = totalResult.count ?? 0
  const edited = editedResult.count ?? 0
  const rate = total ? edited / total : 0

  let alerted = false
  if (total >= MIN_TERMS_FOR_CORRECTION_ALERT && rate > CORRECTION_RATE_THRESHOLD) {
    alerted = await postSlack(
      config.webhookUrl,
      `:warning: Correction rate ${(rate * 100).toFixed(1)} % over the last 7 days (threshold ${CORRECTION_RATE_THRESHOLD * 100} %, ${edited}/${total} terms). Trigger a prompt review.`,
    )
  }
  return { total, edited, rate, alerted }
}
