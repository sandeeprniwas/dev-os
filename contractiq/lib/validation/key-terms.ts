import { z } from 'zod'

export const editKeyTermSchema = z.object({
  value: z.string().trim().min(1, 'Enter a value').max(1000, 'Use 1,000 characters or fewer'),
})
