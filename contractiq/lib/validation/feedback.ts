import { z } from 'zod'

export const feedbackSchema = z.object({
  rating: z.enum(['up', 'down'], { error: 'Choose thumbs up or thumbs down' }),
  comment: z
    .string()
    .trim()
    .max(1000, 'Use 1,000 characters or fewer')
    .optional()
    .transform((value) => value || null),
})
