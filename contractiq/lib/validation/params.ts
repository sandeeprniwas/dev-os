import { z } from 'zod'
import { AppError } from '@/lib/api/errors'

export const idParamSchema = z.object({ id: z.uuid() })

/** Validates a route [id] param; malformed ids are reported as 404 so ids can't be probed. */
export function parseIdParam(params: { id?: string }): string {
  const parsed = idParamSchema.safeParse(params)
  if (!parsed.success) throw new AppError('NOT_FOUND')
  return parsed.data.id
}
