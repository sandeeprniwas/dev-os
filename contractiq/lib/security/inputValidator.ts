import { AppError } from '@/lib/api/errors'
import { TOKEN_LIMITS } from './tokenLimiter'

/** Every Zod request schema, re-exported so routes validate through one module. */
export * from '@/lib/validation'

/** PRD FR-02: PDF is the only supported contract format. */
export const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf'] as const
export const ALLOWED_UPLOAD_MIME_TYPES = ['application/pdf'] as const
export const BLOCKED_UPLOAD_EXTENSIONS = [
  '.exe', '.js', '.mjs', '.cjs', '.php', '.zip', '.sh', '.bat', '.cmd', '.py', '.rb', '.ps1',
  '.html', '.htm', '.svg', '.jar', '.msi', '.dll', '.scr', '.vbs', '.app', '.dmg',
] as const

const ONLY_PDF = 'Only PDF files are supported.'

function extensionOf(name: string): string {
  const base = name.trim().toLowerCase()
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}

/**
 * Validates an uploaded file in the required order — (1) extension blocklist then allowlist,
 * (2) MIME type, (3) size — before any bytes are read. Rejects double extensions that hide an
 * executable (e.g. `contract.exe.pdf`) and path characters in the name.
 */
export function validateFileUpload(file: { name: string; type: string; size: number }): void {
  const name = file.name ?? ''
  const fields = { file: ONLY_PDF }

  if (!name || /[\\/\u0000]/.test(name) || name.length > 255) {
    throw new AppError('VALIDATION_ERROR', ONLY_PDF, { fields })
  }

  const segments = name.toLowerCase().split('.').slice(1).map((segment) => `.${segment}`)
  if (segments.some((segment) => (BLOCKED_UPLOAD_EXTENSIONS as readonly string[]).includes(segment))) {
    throw new AppError('VALIDATION_ERROR', 'This file type is not allowed.', { fields: { file: 'This file type is not allowed.' } })
  }
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extensionOf(name))) {
    throw new AppError('VALIDATION_ERROR', ONLY_PDF, { fields })
  }

  if (!(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError('VALIDATION_ERROR', ONLY_PDF, { fields })
  }

  if (file.size <= 0) throw new AppError('INVALID_PDF')
  if (file.size > TOKEN_LIMITS.maxFileSizeBytes) throw new AppError('FILE_TOO_LARGE')
}

/** Content check after reading: the bytes must actually be a PDF (magic number), whatever the name says. */
export function assertPdfSignature(buffer: Buffer): void {
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new AppError('INVALID_PDF')
}
