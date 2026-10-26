'use client'

import { FileText, FileUp } from 'lucide-react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ERROR_DEFINITIONS } from '@/lib/api/errors'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants/limits'
import { cn } from '@/lib/utils/cn'
import { formatNumber } from '@/lib/utils/format'
import type { UploadedContractDTO } from '@/types/api'

type PdfDropzoneProps = {
  disabled: boolean
  disabledReason?: string
  uploading: boolean
  fileName: string | null
  contract: UploadedContractDTO | null
  error: string | null
  onFile: (file: File) => void
  onReject: (message: string) => void
  onChangeFile: () => void
}

function rejectionMessage(rejections: FileRejection[]): string {
  const code = rejections[0]?.errors[0]?.code
  if (code === 'file-too-large') return ERROR_DEFINITIONS.FILE_TOO_LARGE.message
  if (code === 'file-invalid-type') return 'Only PDF files are supported.'
  if (code === 'too-many-files') return 'Upload one PDF at a time.'
  return ERROR_DEFINITIONS.INVALID_PDF.message
}

export function PdfDropzone({
  disabled,
  disabledReason,
  uploading,
  fileName,
  contract,
  error,
  onFile,
  onReject,
  onChangeFile,
}: PdfDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: false,
    disabled: disabled || uploading || Boolean(contract),
    noClick: Boolean(contract),
    onDropAccepted: (files) => files[0] && onFile(files[0]),
    onDropRejected: (rejections) => onReject(rejectionMessage(rejections)),
  })

  if (contract) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 text-center">
        <FileText className="h-8 w-8 text-brand" aria-hidden="true" />
        <p className="max-w-full truncate text-body font-medium text-fg" title={fileName ?? contract.title}>
          {fileName ?? contract.title}
        </p>
        <p className="text-body-sm text-fg-muted">
          {formatNumber(contract.pageCount)} {contract.pageCount === 1 ? 'page' : 'pages'} ·{' '}
          {formatNumber(contract.wordCount)} words
        </p>
        <Button variant="ghost" size="sm" onClick={onChangeFile}>
          Change file
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps({
          'aria-label': 'Upload a PDF contract',
          'aria-describedby': error ? 'dropzone-error' : 'dropzone-hint',
          'aria-disabled': disabled || uploading,
        })}
        className={cn(
          'flex h-60 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 text-center transition-colors duration-micro',
          disabled ? 'cursor-not-allowed border-border bg-grey-25 opacity-70' : 'cursor-pointer border-border-strong bg-page',
          isDragActive && 'border-brand bg-brand-50',
          error && !isDragActive && 'border-danger bg-danger-50',
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <>
            <Spinner size={24} className="text-brand" />
            <p className="max-w-full truncate text-body font-medium text-fg">{fileName}</p>
            <p className="text-body-sm text-fg-muted">Extracting text…</p>
          </>
        ) : (
          <>
            <FileUp className="h-8 w-8 text-fg-muted" aria-hidden="true" />
            <p className="text-body-lg text-fg">{isDragActive ? 'Drop to upload' : 'Drag and drop your PDF here'}</p>
            <p id="dropzone-hint" className="text-body-sm text-fg-muted">
              {disabled && disabledReason ? (
                disabledReason
              ) : (
                <>
                  or <span className="font-medium text-brand">browse files</span> · PDF up to 10 MB, 20 pages
                </>
              )}
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id="dropzone-error" role="alert" className="text-body text-danger-700">
            {error}
          </p>
          <Button variant="secondary" size="sm" onClick={open} disabled={disabled}>
            Choose another file
          </Button>
        </div>
      )}
    </div>
  )
}
