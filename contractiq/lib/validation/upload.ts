import { z } from 'zod'

export const contractTypeSchema = z.enum(['nda', 'msa'], { error: 'Select a contract type' })

export const uploadFieldsSchema = z.object({
  contractType: contractTypeSchema,
  title: z
    .string()
    .trim()
    .min(1)
    .max(200, 'Use 200 characters or fewer')
    .optional(),
})
