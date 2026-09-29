import { createHash } from 'node:crypto'

import type { DocumentDigest } from '../application/document-digest.js'

export class NodeDocumentDigest implements DocumentDigest {
  sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
  }
}
