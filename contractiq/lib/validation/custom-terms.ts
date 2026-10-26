import { z } from 'zod'
import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits'
import { STANDARD_TERMS } from '@/lib/constants/standard-terms'
import type { ContractType } from '@/types/domain'

export const customTermNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(80, 'Use 80 characters or fewer')
  .regex(/[\p{L}\p{N}]/u, 'Enter a term name')
  .transform((value) => value.replace(/\s+/g, ' '))

export type CustomTermIssue = 'duplicate' | 'standard' | null

/** Shared duplicate / standard-term check (client and server). */
export function customTermIssue(name: string, existing: string[], contractType: ContractType): CustomTermIssue {
  const key = name.trim().replace(/\s+/g, ' ').toLowerCase()
  if (STANDARD_TERMS[contractType].some((term) => term.name.toLowerCase() === key)) return 'standard'
  if (existing.some((term) => term.trim().toLowerCase() === key)) return 'duplicate'
  return null
}

export const CUSTOM_TERM_ISSUE_MESSAGES: Record<Exclude<CustomTermIssue, null>, string> = {
  duplicate: 'You already added this term',
  standard: 'This term is already included',
}

export function customTermsBodySchema(contractType: ContractType) {
  return z
    .object({
      terms: z.array(customTermNameSchema).max(MAX_CUSTOM_TERMS, `Up to ${MAX_CUSTOM_TERMS} custom terms`),
    })
    .superRefine(({ terms }, ctx) => {
      terms.forEach((term, index) => {
        const issue = customTermIssue(term, terms.slice(0, index), contractType)
        if (issue) ctx.addIssue({ code: 'custom', path: ['terms', index], message: CUSTOM_TERM_ISSUE_MESSAGES[issue] })
      })
    })
}
