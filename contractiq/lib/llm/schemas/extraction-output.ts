import { z } from 'zod'

/** Sent to OpenAI as a strict JSON schema: every field required, nullable via null, no length keywords. */
export const extractionWireSchema = z.object({
  detected_type: z.enum(['nda', 'msa', 'other']),
  terms: z.array(
    z.object({
      term_key: z.string(),
      term_name: z.string(),
      value: z.string().nullable(),
      page_number: z.number().int().nullable(),
      confidence_score: z.number().int(),
      source_sentence: z.string().nullable(),
    }),
  ),
})

export type ExtractionWire = z.infer<typeof extractionWireSchema>

/** What the app accepts after parsing (limits strict mode cannot express are enforced here). */
export const extractionAppSchema = z.object({
  detected_type: z.enum(['nda', 'msa', 'other']),
  terms: z
    .array(
      z.object({
        term_key: z.string(),
        term_name: z.string(),
        value: z.string().trim().max(1000).nullable(),
        page_number: z.number().int().nullable(),
        confidence_score: z.number(),
        source_sentence: z.string().trim().max(1000).nullable(),
      }),
    )
    .max(40),
})

export type ExtractionOutput = z.infer<typeof extractionAppSchema>

export type ExtractionTarget = { term_key: string; term_name: string; definition: string | null }
