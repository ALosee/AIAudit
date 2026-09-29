import { ApplicationError } from '@jingwei/kernel'

import { maximumAuditDocumentBytes, type AuditDocumentVersion } from '../../shared/document.js'

export type DocumentContentType = AuditDocumentVersion['contentType']

function invalid(code: string, message: string, status: number): never {
  throw new ApplicationError({ code, message, status })
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
    invalid('DOCUMENT_FILE_NAME_INVALID', '文件名无效', 422)
  }
  if (bytes.byteLength === 0) invalid('DOCUMENT_FILE_EMPTY', '文件不能为空', 422)
  if (bytes.byteLength > maximumAuditDocumentBytes) {
    invalid('DOCUMENT_FILE_TOO_LARGE', '文件不能超过 20 MiB', 413)
  }
  const lower = normalized.toLocaleLowerCase('en-US')
  if (lower.endsWith('.pdf')) {
    if (bytes.byteLength < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') {
      invalid('DOCUMENT_FILE_INVALID', 'PDF 文件内容无效', 422)
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
      invalid('DOCUMENT_FILE_INVALID', 'DOCX 文件内容无效', 422)
    }
    return {
      fileName: normalized,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }
  return invalid('DOCUMENT_FILE_UNSUPPORTED', '仅支持 PDF 和 DOCX 文件', 415)
}
