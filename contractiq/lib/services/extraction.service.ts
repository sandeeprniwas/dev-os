import 'server-only'
import { zodResponseFormat } from 'openai/helpers/zod'
import { AppError } from '@/lib/api/errors'
import { LLM_TIMEOUT_MS } from '@/lib/constants/limits'
import { STANDARD_TERMS } from '@/lib/constants/standard-terms'
import { completeContract, failContract, getContract } from '@/lib/db/contracts.repo'
import { listCustomTerms, replaceKeyTerms } from '@/lib/db/key-terms.repo'
import { logUsage } from '@/lib/db/llm-usage.repo'
import type { DbClient } from '@/lib/db/types'
import { addUsage, type TokenUsage } from '@/lib/llm/cost'
import type { CompletionResult, LlmGateway, LlmMessage } from '@/lib/llm/gateway'
import { buildExtractionMessages, EXTRACTION_REPAIR_INSTRUCTION } from '@/lib/llm/prompts/extraction'
import { EXTRACTION_PROMPT_VERSION } from '@/lib/llm/prompts/versions'
import {
  extractionAppSchema,
  extractionWireSchema,
  type ExtractionOutput,
  type ExtractionTarget,
} from '@/lib/llm/schemas/extraction-output'
import { validateExtraction } from '@/lib/llm/validators/extraction'
import { RetryableLLMError, withRetry } from '@/lib/llm/with-retry'
import { detectPromptInjection } from '@/lib/security/promptInjectionGuard'
import { assertContractTokens } from '@/lib/security/tokenLimiter'
import { requireAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { slugify } from '@/lib/utils/slugify'
import type { ProcessEvent } from '@/types/api'
import type { ContractType } from '@/types/domain'

const EXTRACTION_MAX_TOKENS = 4000
const responseFormat = zodResponseFormat(extractionWireSchema, 'contract_extraction')

/** Standard terms for the type, then custom terms with collision-safe `custom_*` keys. */
export function buildTargets(contractType: ContractType, customTermNames: string[]): ExtractionTarget[] {
  const targets: ExtractionTarget[] = STANDARD_TERMS[contractType].map((term) => ({
    term_key: term.key,
    term_name: term.name,
    definition: term.definition,
  }))
  const used = new Set<string>()
  for (const name of customTermNames) {
    const base = `custom_${slugify(name).replace(/-/g, '_').slice(0, 60) || 'term'}`
    let key = base
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`
    used.add(key)
    targets.push({ term_key: key, term_name: name, definition: null })
  }
  return targets
}

/** Parses and validates one completion; throws retryable / terminal errors per spec §7 step 4. */
export function parseCompletion(result: CompletionResult): ExtractionOutput | null {
  if (result.refusal || result.finishReason === 'content_filter') throw new AppError('LLM_REFUSED')
  if (result.finishReason === 'length') throw new RetryableLLMError('Extraction output truncated')
  if (!result.content) return null
  try {
    const parsed = extractionAppSchema.safeParse(JSON.parse(result.content))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

type ProcessArgs = {
  db: DbClient
  llm: LlmGateway
  userId: string
  userHash: string
  contractId: string
  emit: (event: ProcessEvent) => void
  deadline: number
}

/**
 * Runs extraction for a contract already claimed as `processing` (key-term-extraction spec §7).
 * Reads with the user-scoped client (RLS) and writes results with the service role, scoped to userId.
 * On failure the contract is marked `error` and an error event is emitted; never throws.
 */
export async function processContract({ db, llm, userId, userHash, contractId, emit, deadline }: ProcessArgs): Promise<void> {
  const startedAt = Date.now()
  let usage: TokenUsage | null = null
  let attempts = 0
  let finishReason: string | null = null
  let calledModel = false

  const admin = requireAdminClient()

  try {
    emit({ step: 'analysing' })

    const contract = await getContract(db, contractId)
    if (!contract || contract.user_id !== userId) throw new AppError('NOT_FOUND')
    // Never trust the stored token count: re-count the exact text that will be sent to the model.
    assertContractTokens(contract.contract_text)

    const customTerms = await listCustomTerms(db, contractId)
    // Custom term names reach the prompt; re-screen them even though the API validated them on save.
    const injected = customTerms.find((term) => detectPromptInjection(term.term_name).detected)
    if (injected) throw new AppError('PROMPT_INJECTION', 'One of the custom terms looks like an instruction to the AI. Remove it and try again.')
    const targets = buildTargets(
      contract.contract_type,
      customTerms.map((term) => term.term_name),
    )
    const messages = buildExtractionMessages({
      contractType: contract.contract_type,
      contractText: contract.contract_text,
      targets,
    })

    const call = async (callMessages: LlmMessage[]) => {
      calledModel = true
      attempts++
      const result = await llm.completeJson({
        messages: callMessages,
        responseFormat,
        temperature: 0.1,
        maxTokens: EXTRACTION_MAX_TOKENS,
        user: userHash,
        timeoutMs: Math.max(1000, Math.min(LLM_TIMEOUT_MS, deadline - Date.now())),
      })
      usage = addUsage(usage, result.usage)
      finishReason = result.finishReason
      return result
    }

    const { result: output } = await withRetry(
      async () => {
        const first = await call(messages)
        const parsed = parseCompletion(first)
        if (parsed) return parsed

        // One repair attempt with the previous output appended (PRD §8 error recovery).
        const repair = await call([
          ...messages,
          { role: 'assistant', content: first.content ?? '' },
          { role: 'user', content: EXTRACTION_REPAIR_INSTRUCTION },
        ])
        const repaired = parseCompletion(repair)
        if (repaired) return repaired
        throw new AppError('LLM_INVALID_OUTPUT')
      },
      { deadline },
    )

    const { detectedType, terms } = validateExtraction(output, {
      targets,
      contractText: contract.contract_text,
      pageCount: contract.page_count,
    })

    emit({ step: 'compiling' })

    await replaceKeyTerms(
      admin,
      contractId,
      userId,
      terms.map((term) => ({ ...term, contract_id: contractId, user_id: userId })),
    )
    await completeContract(admin, contractId, userId, {
      detectedType,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      model: llm.model,
      processingMs: Date.now() - startedAt,
    })

    const { error: countError } = await db.rpc('increment_analyses_count')
    if (countError) logger.warn('increment_analyses_count_failed', { code: countError.code })

    await logUsage({
      userId,
      contractId,
      operation: 'extraction',
      model: llm.model,
      usage,
      latencyMs: Date.now() - startedAt,
      attempts: Math.max(1, attempts),
      success: true,
      finishReason,
    })

    emit({ step: 'done', contractId, termCount: terms.length, detectedType })
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', undefined, { cause: error })
    logger.error('extraction_failed', { contractId, code: appError.code, cause: appError.details.cause ?? error })

    await failContract(admin, contractId, userId, appError.code, appError.message).catch((failError) =>
      logger.error('mark_contract_failed_failed', { contractId, error: failError }),
    )
    if (calledModel) {
      await logUsage({
        userId,
        contractId,
        operation: 'extraction',
        model: llm.model,
        usage,
        latencyMs: Date.now() - startedAt,
        attempts: Math.max(1, attempts),
        success: false,
        finishReason,
      })
    }
    emit({ step: 'error', code: appError.code, message: appError.message })
  }
}
