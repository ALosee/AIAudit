import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  AuditDocument,
  AuditDocumentVersion,
  DocumentPageQuery,
} from '../../shared/document.js'

export interface StoredDocumentVersion extends AuditDocumentVersion {
  readonly objectKey: string
}

export interface DocumentStore {
  list(
    tenantId: TenantId,
    projectId: string,
    query: DocumentPageQuery,
  ): Promise<{ items: AuditDocument[]; total: number }>
  get(
    tenantId: TenantId,
    projectId: string,
    id: string,
    lock?: boolean,
  ): Promise<AuditDocument | null>
  listVersions(
    tenantId: TenantId,
    documentId: string,
    query: DocumentPageQuery,
  ): Promise<{ items: AuditDocumentVersion[]; total: number }>
  getVersion(
    tenantId: TenantId,
    documentId: string,
    versionId: string,
  ): Promise<StoredDocumentVersion | null>
  insertDocument(context: ApplicationContext, document: AuditDocument): Promise<void>
  insertVersion(context: ApplicationContext, version: StoredDocumentVersion): Promise<void>
  updateLatestVersion(
    context: ApplicationContext,
    document: AuditDocument,
    expectedVersionNumber: number,
  ): Promise<boolean>
}

export interface DocumentTransaction {
  readonly documents: DocumentStore
  projectStatus(
    tenantId: TenantId,
    projectId: string,
    lock: boolean,
  ): Promise<'ACTIVE' | 'ARCHIVED' | null>
  record(
    context: ApplicationContext,
    action: string,
    document: AuditDocument,
    version: AuditDocumentVersion,
  ): Promise<void>
}

export interface DocumentUnitOfWork {
  run<T>(work: (transaction: DocumentTransaction) => Promise<T>): Promise<T>
}
