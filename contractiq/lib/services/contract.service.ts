import 'server-only'
import { AppError } from '@/lib/api/errors'
import { MAX_PAGES, MIN_WORDS, SIGNED_URL_TTL_SECONDS, STALE_PROCESSING_MS } from '@/lib/constants/limits'
import * as contractsRepo from '@/lib/db/contracts.repo'
import { getFeedback } from '@/lib/db/feedback.repo'
import { listCustomTerms, listKeyTerms } from '@/lib/db/key-terms.repo'
import { toCustomTermDTO, toFeedbackDTO, toKeyTermDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import { extractText, PdfExtractionError } from '@/lib/pdf/extract-text'
import { assertPdfSignature } from '@/lib/security/inputValidator'
import { assertContractTokens, assertFileSize, assertPageCount } from '@/lib/security/tokenLimiter'
import { requireAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { slugify, stripPdfExtension } from '@/lib/utils/slugify'
import type { ContractDetailDTO, UploadedContractDTO } from '@/types/api'
import type { ContractType } from '@/types/domain'

export const STORAGE_BUCKET = 'contracts'
const LAST_ACCESS_THROTTLE_MS = 10 * 60_000

/**
 * Validates and extracts an uploaded PDF, then stores the contract (upload spec §4).
 * The file's name / MIME type / size were already checked by validateFileUpload() in the route.
 * The row is written with the service role (clients cannot insert contracts); the PDF is uploaded with
 * the user's client so Storage RLS confines it to the user's own folder.
 */
export async function createContractFromUpload(
  db: DbClient,
  args: { userId: string; file: File; contractType: ContractType; title?: string },
): Promise<UploadedContractDTO> {
  const { file } = args
  assertFileSize(file.size)

  const buffer = Buffer.from(await file.arrayBuffer())
  assertFileSize(buffer.byteLength)
  assertPdfSignature(buffer)

  let extracted
  try {
    extracted = await extractText(buffer, { maxPages: MAX_PAGES })
  } catch (error) {
    if (error instanceof PdfExtractionError) throw new AppError('INVALID_PDF', undefined, { cause: error.cause })
    throw error
  }

  assertPageCount(extracted.pageCount)
  if (extracted.wordCount < MIN_WORDS) throw new AppError('SCANNED_PDF')
  const tokenCount = assertContractTokens(extracted.markedText)

  const admin = requireAdminClient()
  const contractId = crypto.randomUUID()
  const baseName = stripPdfExtension(file.name) || 'Untitled contract'
  const contract = await contractsRepo.insertContract(admin, {
    id: contractId,
    user_id: args.userId,
    title: (args.title ?? baseName).slice(0, 200),
    contract_type: args.contractType,
    original_filename: file.name.slice(0, 255) || 'contract.pdf',
    file_size_bytes: file.size,
    page_count: extracted.pageCount,
    word_count: extracted.wordCount,
    token_count: tokenCount,
    contract_text: extracted.markedText,
    status: 'uploaded',
  })

  // Storage is best-effort: the AI pipeline only needs contract_text (PRD §5).
  const storagePath = `${args.userId}/${contractId}/${slugify(baseName) || 'contract'}.pdf`
  let storageAvailable = false
  try {
    const { error } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })
    if (error) throw error
    await contractsRepo.setFilePath(admin, contractId, args.userId, storagePath)
    storageAvailable = true
  } catch (error) {
    logger.warn('storage_upload_failed', { contractId, error })
  }

  return {
    id: contract.id,
    title: contract.title,
    contractType: contract.contract_type,
    status: contract.status,
    pageCount: contract.page_count,
    wordCount: contract.word_count,
    tokenCount: contract.token_count,
    storageAvailable,
    createdAt: contract.created_at,
  }
}

/** Results-page payload: contract (+ fresh signed URL), terms, custom terms and feedback. */
export async function getContractDetail(db: DbClient, contractId: string, userId: string): Promise<ContractDetailDTO | null> {
  const contract = await contractsRepo.getContract(db, contractId)
  if (!contract || contract.user_id !== userId) return null

  const [keyTerms, customTerms, feedback] = await Promise.all([
    listKeyTerms(db, contractId),
    listCustomTerms(db, contractId),
    getFeedback(db, contractId),
  ])

  let signedUrl: string | null = null
  let signedUrlExpiresAt: string | null = null
  if (contract.file_path) {
    const { data, error } = await db.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(contract.file_path, SIGNED_URL_TTL_SECONDS)
    if (error || !data) {
      logger.warn('signed_url_failed', { contractId, errorMessage: error?.message })
    } else {
      signedUrl = data.signedUrl
      signedUrlExpiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()
    }
  }

  const stale =
    contract.status === 'processing' && Date.now() - new Date(contract.updated_at).getTime() > STALE_PROCESSING_MS

  if (Date.now() - new Date(contract.last_accessed_at).getTime() > LAST_ACCESS_THROTTLE_MS) {
    contractsRepo.touchLastAccessed(requireAdminClient(), contractId, userId).catch((error) => logger.warn('touch_last_accessed_failed', { error }))
  }

  return {
    contract: {
      id: contract.id,
      title: contract.title,
      contractType: contract.contract_type,
      detectedType: contract.detected_type,
      status: stale ? 'error' : contract.status,
      pageCount: contract.page_count,
      contractText: contract.contract_text,
      signedUrl,
      signedUrlExpiresAt,
      errorCode: stale ? 'TIMEOUT' : contract.error_code,
      errorMessage: stale ? 'Processing took too long. Try again.' : contract.error_message,
      processedAt: contract.processed_at,
      reviewCompletedAt: contract.review_completed_at,
      createdAt: contract.created_at,
    },
    keyTerms: keyTerms.map(toKeyTermDTO),
    customTerms: customTerms.map(toCustomTermDTO),
    feedback: feedback ? toFeedbackDTO(feedback) : null,
  }
}

export async function markReviewComplete(db: DbClient, contractId: string, userId: string): Promise<void> {
  const contract = await contractsRepo.getContract(db, contractId)
  if (!contract || contract.user_id !== userId) throw new AppError('NOT_FOUND')
  await contractsRepo.markReviewComplete(requireAdminClient(), contractId, userId, contract.review_completed_at)
}

/** Deletes the PDF (best-effort) then the row; child rows cascade (retention spec §3). */
export async function deleteContract(db: DbClient, contractId: string): Promise<void> {
  const contract = await contractsRepo.getContractStatus(db, contractId)
  if (!contract) throw new AppError('NOT_FOUND')

  if (contract.file_path) {
    const { error } = await db.storage.from(STORAGE_BUCKET).remove([contract.file_path])
    if (error) logger.warn('storage_delete_failed', { contractId, path: contract.file_path, errorMessage: error.message })
  }

  const deleted = await contractsRepo.deleteContract(db, contractId)
  if (!deleted) throw new AppError('NOT_FOUND')
}
