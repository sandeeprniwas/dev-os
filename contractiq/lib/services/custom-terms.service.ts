import 'server-only'
import { AppError } from '@/lib/api/errors'
import { getContractStatus } from '@/lib/db/contracts.repo'
import { replaceCustomTerms as replaceCustomTermsRow } from '@/lib/db/key-terms.repo'
import { toCustomTermDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { customTermsBodySchema } from '@/lib/validation/custom-terms'
import type { CustomTermDTO } from '@/types/api'

/** Replaces a contract's custom-term list; only allowed before processing or after a failure. */
export async function replaceCustomTerms(db: DbClient, contractId: string, body: unknown): Promise<CustomTermDTO[]> {
  const contract = await getContractStatus(db, contractId)
  if (!contract) throw new AppError('NOT_FOUND')
  if (contract.status !== 'uploaded' && contract.status !== 'error') {
    throw new AppError('CONFLICT', "Custom terms can't be changed after processing has started.")
  }

  const { terms } = customTermsBodySchema(contract.contract_type).parse(body)
  // Term names are inserted into the extraction prompt, so they are screened like chat input.
  const safeTerms = terms.map((term, index) => {
    try {
      return sanitizeForLLM(term)
    } catch {
      const message = 'This term looks like an instruction to the AI. Use a plain term name, e.g. "Non-compete radius".'
      throw new AppError('PROMPT_INJECTION', message, { fields: { [`terms.${index}`]: message } })
    }
  })
  const rows = await replaceCustomTermsRow(db, contractId, safeTerms)
  return rows.map(toCustomTermDTO)
}
