import { z } from 'zod'
import { MAX_CHAT_INPUT_CHARS } from '@/lib/constants/limits'

export const chatPostSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Type a question')
    .max(MAX_CHAT_INPUT_CHARS, `Use ${MAX_CHAT_INPUT_CHARS.toLocaleString('en-US')} characters or fewer`),
  retryOfMessageId: z.uuid().optional(),
})
