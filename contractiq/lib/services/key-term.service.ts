import 'server-only'
import { editKeyTerm } from '@/lib/db/key-terms.repo'
import { toKeyTermDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import { editKeyTermSchema } from '@/lib/validation/key-terms'
import type { KeyTermDTO } from '@/types/api'

/** Inline correction; the SQL function keeps the first AI value in original_value. */
export async function updateKeyTermValue(db: DbClient, keyTermId: string, body: unknown): Promise<KeyTermDTO> {
  const { value } = editKeyTermSchema.parse(body)
  return toKeyTermDTO(await editKeyTerm(db, keyTermId, value))
}
