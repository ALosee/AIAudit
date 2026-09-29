export interface DocumentDigest {
  sha256(bytes: Uint8Array): string
}
