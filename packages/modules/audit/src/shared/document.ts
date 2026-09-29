import { z } from 'zod'

export const maximumAuditDocumentBytes = 20 * 1024 * 1024

export const documentNameSchema = z.string().trim().min(1).max(200)
export const documentSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    name: documentNameSchema,
    latestVersionNumber: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'AuditDocument' })

export const documentVersionSchema = z
  .object({
    id: z.uuid(),
    documentId: z.uuid(),
    versionNumber: z.number().int().positive(),
    fileName: z.string().min(1).max(255),
    contentType: z.enum([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    byteSize: z.number().int().positive().max(maximumAuditDocumentBytes),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'AuditDocumentVersion' })

export const documentWithVersionSchema = z
  .object({ document: documentSchema, version: documentVersionSchema })
  .strict()
  .meta({ id: 'AuditDocumentWithVersion' })

export const documentPageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()

export const documentListSchema = z
  .object({
    items: z.array(documentSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ id: 'AuditDocumentList' })

export const documentVersionListSchema = z
  .object({
    items: z.array(documentVersionSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ id: 'AuditDocumentVersionList' })

export const documentDownloadSchema = z
  .object({ url: z.url(), expiresAt: z.iso.datetime() })
  .strict()
  .meta({ id: 'AuditDocumentDownload' })

export type AuditDocument = z.infer<typeof documentSchema>
export type AuditDocumentVersion = z.infer<typeof documentVersionSchema>
export type DocumentPageQuery = z.infer<typeof documentPageQuerySchema>
export type DocumentWithVersion = z.infer<typeof documentWithVersionSchema>
export type DocumentList = z.infer<typeof documentListSchema>
export type DocumentVersionList = z.infer<typeof documentVersionListSchema>
export type DocumentDownload = z.infer<typeof documentDownloadSchema>
