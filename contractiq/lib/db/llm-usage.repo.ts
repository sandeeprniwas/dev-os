import 'server-only'
import { computeCost, type TokenUsage } from '@/lib/llm/cost'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import type { LlmOperation } from '@/types/domain'

export type UsageEntry = {
  userId: string
  contractId: string | null
  operation: LlmOperation
  model: string
  usage: TokenUsage | null
  latencyMs: number
  attempts: number
  success: boolean
  finishReason: string | null
}

let warnedMissingKey = false

/**
 * Records one OpenAI call (never prompts or contract text). Uses the service role because clients
 * may not write llm_usage. Never throws: telemetry must not break the user's request.
 */
export async function logUsage(entry: UsageEntry): Promise<void> {
  const admin = createAdminClient()
  if (!admin) {
    if (!warnedMissingKey) {
      logger.warn('llm_usage_skipped', { reason: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
      warnedMissingKey = true
    }
    return
  }

  const usage = entry.usage
  try {
    const { error } = await admin.from('llm_usage').insert({
      user_id: entry.userId,
      contract_id: entry.contractId,
      operation: entry.operation,
      model: entry.model,
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      cached_input_tokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
      cost_usd: usage ? computeCost(entry.model, usage) : 0,
      latency_ms: Math.max(0, Math.round(entry.latencyMs)),
      attempts: Math.min(5, Math.max(1, entry.attempts)),
      success: entry.success,
      finish_reason: entry.finishReason,
    })
    if (error) logger.warn('llm_usage_insert_failed', { code: error.code, errorMessage: error.message })
  } catch (error) {
    logger.warn('llm_usage_insert_failed', { error })
  }
}
