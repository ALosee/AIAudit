import { maximumAuditDocumentBytes, type AuditDocumentVersion } from '../../shared/document.js'

export type DocumentContentType = AuditDocumentVersion['contentType']
export type DocumentFileValidationReason =
  | 'INVALID_NAME'
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'INVALID_PDF'
  | 'INVALID_DOCX'
  | 'UNSUPPORTED'

export class DocumentFileValidationError extends Error {
  constructor(readonly reason: DocumentFileValidationReason) {
    super(`Invalid document file: ${reason}`)
    this.name = 'DocumentFileValidationError'
  }
}

function invalid(reason: DocumentFileValidationReason): never {
  throw new DocumentFileValidationError(reason)
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return true
  }
  return false
}

export function validateDocumentFile(
  fileName: string,
  bytes: Uint8Array,
): {
  fileName: string
  contentType: DocumentContentType
} {
  const normalized = fileName.normalize('NFC').split(/[/\\]/).at(-1)?.trim() ?? ''
  if (normalized.length === 0 || normalized.length > 255 || hasControlCharacter(normalized)) {
    invalid('INVALID_NAME')
  }
  if (bytes.byteLength === 0) invalid('EMPTY')
  if (bytes.byteLength > maximumAuditDocumentBytes) {
    invalid('TOO_LARGE')
  }
  const lower = normalized.toLocaleLowerCase('en-US')
  if (lower.endsWith('.pdf')) {
    if (bytes.byteLength < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') {
      invalid('INVALID_PDF')
    }
    return { fileName: normalized, contentType: 'application/pdf' }
  }
  if (lower.endsWith('.docx')) {
    if (
      bytes.byteLength < 4 ||
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b ||
      bytes[2] !== 0x03 ||
      bytes[3] !== 0x04
    ) {
      invalid('INVALID_DOCX')
    }
    return {
      fileName: normalized,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }
  return invalid('UNSUPPORTED')
}
