import { NextResponse } from 'next/server'
import { AppError } from '@/lib/api/errors'
import { enforceRateLimit } from '@/lib/security/rateLimiter'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants/limits'
import { createContractFromUpload } from '@/lib/services/contract.service'
import { uploadFieldsSchema, validateFileUpload } from '@/lib/security/inputValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 26

const MULTIPART_OVERHEAD_BYTES = 512 * 1024

export const POST = withApiHandler(async (request) => {
  const { user, supabase } = await requireAuth()
  await enforceRateLimit('upload', { userId: user.id })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_FILE_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES) throw new AppError('FILE_TOO_LARGE')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Upload a PDF file.', { fields: { file: 'Upload a PDF file.' } })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new AppError('VALIDATION_ERROR', 'Upload a PDF file.', { fields: { file: 'Upload a PDF file.' } })
  }
  // Extension (blocklist → allowlist) → MIME type → size, before any bytes are read.
  validateFileUpload(file)
  const fields = uploadFieldsSchema.parse({
    contractType: form.get('contractType') ?? undefined,
    title: form.get('title') || undefined,
  })

  const contract = await createContractFromUpload(supabase, {
    userId: user.id,
    file,
    contractType: fields.contractType,
    title: fields.title,
  })
  return NextResponse.json({ contract }, { status: 201 })
})
