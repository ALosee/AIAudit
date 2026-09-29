# ADR 0023: Use an S3-Compatible Port for Audit Documents

- Status: Accepted for the AI audit document slice
- Date: 2026-09-29

## Context

Audit needs durable original files and immutable document versions. Files are larger than ordinary database rows, and the local RustFS service is operated independently of the AIAudit repository. The server must authorize each upload and download using the existing tenant and permission infrastructure.

## Decision

- `@jingwei/storage` provides a small `ObjectStorage` port and an S3-compatible adapter using AWS SDK v3. The platform owns transport configuration and client lifecycle; Audit owns object keys, document metadata, validation, access control and retention decisions.
- The server uses an internal endpoint for object writes and an externally reachable endpoint for signed download URLs. These may differ in container deployments. The bucket is provisioned by operations, not during app creation.
- Audit constructs tenant-prefixed keys on the server, accepts PDF/DOCX up to 20 MiB, derives the stored content type from validated bytes and extension, and never returns an object key in a document API response.
- Download URLs expire after 60 seconds. Authorization and URL issuance are audited with the specific document version; the URL and storage credentials are never written to the audit log.
- Object upload precedes the metadata transaction. On transaction failure, the application deletes the uploaded object. Failure of that compensation has its own stable error code for operator follow-up.

## Consequences

S3-compatible storage can be replaced without changing Audit domain contracts. The current multipart route buffers a whole file in memory, so raising the size limit requires a streaming design. Object storage and PostgreSQL cannot share an atomic transaction; the compensation path and its failure remain operational concerns. Virus scanning and quarantine are required before opening uploads to untrusted production users.
