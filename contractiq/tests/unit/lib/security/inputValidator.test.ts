import { describe, expect, it } from 'vitest'
import { assertPdfSignature, validateFileUpload } from '@/lib/security/inputValidator'

const file = (name: string, type = 'application/pdf', size = 1024) => ({ name, type, size })

describe('validateFileUpload', () => {
  it('accepts a normal PDF', () => {
    expect(() => validateFileUpload(file('Acme NDA (final).pdf'))).not.toThrow()
  })

  it.each(['run.exe', 'x.js', 'x.mjs', 'x.cjs', 'x.php', 'x.zip', 'x.sh', 'x.bat', 'x.cmd', 'x.py', 'x.rb', 'x.ps1'])(
    'blocks %s',
    (name) => {
      expect(() => validateFileUpload(file(name))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', status: 422 }))
    },
  )

  it('blocks executables hidden behind a double extension', () => {
    expect(() => validateFileUpload(file('contract.exe.pdf'))).toThrow(expect.objectContaining({ message: 'This file type is not allowed.' }))
  })

  it('rejects non-PDF extensions not on the blocklist (allowlist)', () => {
    expect(() => validateFileUpload(file('contract.docx'))).toThrow(expect.objectContaining({ message: 'Only PDF files are supported.' }))
  })

  it('checks extension before MIME type, then size', () => {
    expect(() => validateFileUpload(file('a.pdf', 'text/html'))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(() => validateFileUpload(file('a.pdf', 'application/pdf', 11 * 1024 * 1024))).toThrow(
      expect.objectContaining({ code: 'FILE_TOO_LARGE', status: 413 }),
    )
    expect(() => validateFileUpload(file('a.pdf', 'application/pdf', 0))).toThrow(expect.objectContaining({ code: 'INVALID_PDF' }))
  })

  it('rejects path characters in the name', () => {
    expect(() => validateFileUpload(file('../../etc/passwd.pdf'))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
  })
})

describe('assertPdfSignature', () => {
  it('requires the %PDF- magic number', () => {
    expect(() => assertPdfSignature(Buffer.from('%PDF-1.7 ...'))).not.toThrow()
    expect(() => assertPdfSignature(Buffer.from('<html>'))).toThrow(expect.objectContaining({ code: 'INVALID_PDF' }))
  })
})
