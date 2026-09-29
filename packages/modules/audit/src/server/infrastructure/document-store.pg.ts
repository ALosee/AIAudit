import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  AuditDocument,
  AuditDocumentVersion,
  DocumentPageQuery,
} from '../../shared/document.js'
import type {
  DocumentStore,
  DocumentTransaction,
  DocumentUnitOfWork,
  StoredDocumentVersion,
} from '../application/document-store.js'
import type { ProjectDatabase } from './project-store.pg.js'

interface DocumentRow {
  id: string
  tenant_id: string
  project_id: string
  name: string
  latest_version_number: number
  created_at: Date
  created_by: string
  updated_at: Date
  updated_by: string
}

interface DocumentVersionRow {
  id: string
  tenant_id: string
  document_id: string
  version_number: number
  file_name: string
  content_type: AuditDocumentVersion['contentType']
  byte_size: number
  sha256: string
  object_key: string
  created_at: Date
  created_by: string
}

export interface DocumentDatabase extends ProjectDatabase {
  'audit.document': DocumentRow
  'audit.document_version': DocumentVersionRow
}

function toDocument(row: DocumentRow): AuditDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    latestVersionNumber: row.latest_version_number,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function toVersion(row: DocumentVersionRow): StoredDocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNumber: row.version_number,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    objectKey: row.object_key,
    createdAt: row.created_at.toISOString(),
  }
}

function publicVersion(row: DocumentVersionRow): AuditDocumentVersion {
  const version = toVersion(row)
  return {
    id: version.id,
    documentId: version.documentId,
    versionNumber: version.versionNumber,
    fileName: version.fileName,
    contentType: version.contentType,
    byteSize: version.byteSize,
    sha256: version.sha256,
    createdAt: version.createdAt,
  }
}

export class PostgresDocumentStore implements DocumentStore {
  constructor(private readonly db: Kysely<DocumentDatabase>) {}

  async list(tenantId: TenantId, projectId: string, query: DocumentPageQuery) {
    const base = this.db
      .selectFrom('audit.document')
      .where('tenant_id', '=', tenantId)
      .where('project_id', '=', projectId)
    const [rows, count] = await Promise.all([
      base
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      base
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow(),
    ])
    return { items: rows.map(toDocument), total: Number(count.count) }
  }

  async get(tenantId: TenantId, projectId: string, id: string, lock = false) {
    const query = this.db
      .selectFrom('audit.document')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('project_id', '=', projectId)
      .where('id', '=', id)
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst()
    return row === undefined ? null : toDocument(row)
  }

  async listVersions(tenantId: TenantId, documentId: string, query: DocumentPageQuery) {
    const base = this.db
      .selectFrom('audit.document_version')
      .where('tenant_id', '=', tenantId)
      .where('document_id', '=', documentId)
    const [rows, count] = await Promise.all([
      base
        .selectAll()
        .orderBy('version_number', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      base
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow(),
    ])
    return { items: rows.map(publicVersion), total: Number(count.count) }
  }

  async getVersion(tenantId: TenantId, documentId: string, versionId: string) {
    const row = await this.db
      .selectFrom('audit.document_version')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('document_id', '=', documentId)
      .where('id', '=', versionId)
      .executeTakeFirst()
    return row === undefined ? null : toVersion(row)
  }

  async insertDocument(context: ApplicationContext, document: AuditDocument): Promise<void> {
    await this.db
      .insertInto('audit.document')
      .values({
        id: document.id,
        tenant_id: context.tenantId,
        project_id: document.projectId,
        name: document.name,
        latest_version_number: document.latestVersionNumber,
        created_at: new Date(document.createdAt),
        created_by: context.userId,
        updated_at: new Date(document.updatedAt),
        updated_by: context.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async insertVersion(context: ApplicationContext, version: StoredDocumentVersion): Promise<void> {
    await this.db
      .insertInto('audit.document_version')
      .values({
        id: version.id,
        tenant_id: context.tenantId,
        document_id: version.documentId,
        version_number: version.versionNumber,
        file_name: version.fileName,
        content_type: version.contentType,
        byte_size: version.byteSize,
        sha256: version.sha256,
        object_key: version.objectKey,
        created_at: new Date(version.createdAt),
        created_by: context.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async updateLatestVersion(
    context: ApplicationContext,
    document: AuditDocument,
    expectedVersionNumber: number,
  ) {
    const result = await this.db
      .updateTable('audit.document')
      .set({
        latest_version_number: document.latestVersionNumber,
        updated_at: new Date(document.updatedAt),
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('project_id', '=', document.projectId)
      .where('id', '=', document.id)
      .where('latest_version_number', '=', expectedVersionNumber)
      .executeTakeFirstOrThrow()
    return result.numUpdatedRows === 1n
  }
}

export class PostgresDocumentUnitOfWork implements DocumentUnitOfWork {
  constructor(private readonly db: Kysely<DocumentDatabase>) {}

  run<T>(work: (transaction: DocumentTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        documents: new PostgresDocumentStore(transaction),
        projectStatus: async (tenantId, projectId, lock) => {
          const query = transaction
            .selectFrom('audit.project')
            .select('status')
            .where('tenant_id', '=', tenantId)
            .where('id', '=', projectId)
          const row = await (lock ? query.forUpdate() : query).executeTakeFirst()
          return row?.status ?? null
        },
        record: async (context, action, document, version) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'audit',
            action,
            entityType: 'document',
            entityId: document.id,
            result: 'SUCCESS',
            after: {
              projectId: document.projectId,
              documentId: document.id,
              versionId: version.id,
              versionNumber: version.versionNumber,
              byteSize: version.byteSize,
              sha256: version.sha256,
            },
          })
        },
      }),
    )
  }
}
