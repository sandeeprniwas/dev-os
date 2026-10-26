import { z } from 'zod'

export const CONTRACT_SORTS = ['created_at', 'title', 'contract_type'] as const
export type ContractSort = (typeof CONTRACT_SORTS)[number]

export const contractsQuerySchema = z.object({
  sort: z.enum(CONTRACT_SORTS).catch('created_at'),
  order: z.enum(['asc', 'desc']).catch('desc'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
  type: z.enum(['nda', 'msa']).optional().catch(undefined),
})

export type ContractsQuery = z.infer<typeof contractsQuerySchema>

/** API version: unknown or invalid values are rejected (422) instead of being replaced by defaults. */
export const contractsQueryStrictSchema = z
  .object({
    sort: z.enum(CONTRACT_SORTS).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    type: z.enum(['nda', 'msa']).optional(),
  })
  .strict()

export function parseContractsQueryStrict(params: URLSearchParams): ContractsQuery {
  return contractsQueryStrictSchema.parse(Object.fromEntries(params.entries()))
}

/** Page version (dashboard URL): invalid values fall back to defaults so a bad link never breaks the page. */
export function parseContractsQuery(params: URLSearchParams | Record<string, string | undefined>): ContractsQuery {
  const entries = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params
  return contractsQuerySchema.parse(entries)
}
