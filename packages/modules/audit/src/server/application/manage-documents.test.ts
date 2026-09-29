import { describe, expect, it, vi } from 'vitest'

import {
  newEntityId,
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
  type TenantId,
} from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'
import type { ObjectStorage, StoredObject } from '@jingwei/storage'

import type { AuditDocument, DocumentPageQuery, Project } from '../../shared/index.js'
import { DocumentFileValidationError, validateDocumentFile } from '../domain/document-file.js'
import type {
  DocumentStore,
  DocumentTransaction,
  DocumentUnitOfWork,
  StoredDocumentVersion,
} from './document-store.js'
import { ManageDocuments } from './manage-documents.js'
import type { ProjectStore } from './project-store.js'

const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10])

function context(tenantId = newTenantId()): AuthContext {
  return {
    requestId: newRequestId(),
    tenantId,
    userId: newUserId(),
    sessionId: newSessionId(),
    roleIds: [],
  }
}

class MemoryProjects implements ProjectStore {
  readonly rows = new Map<string, { tenantId: TenantId; project: Project }>()
  list() {
    return Promise.resolve({ items: [], total: 0 })
  }
  get(tenantId: TenantId, id: string) {
    const row = this.rows.get(id)
    return Promise.resolve(row?.tenantId === tenantId ? row.project : null)
  }
  insert() {
    return Promise.resolve()
  }
  update() {
    return Promise.resolve(false)
  }
}

class MemoryDocuments implements DocumentStore {
  readonly documents = new Map<string, { tenantId: TenantId; document: AuditDocument }>()
  readonly versions = new Map<string, { tenantId: TenantId; version: StoredDocumentVersion }>()
  failInsert = false

  list(tenantId: TenantId, projectId: string, query: DocumentPageQuery) {
    const items = [...this.documents.values()]
      .filter((row) => row.tenantId === tenantId && row.document.projectId === projectId)
      .map((row) => row.document)
    return Promise.resolve({
      items: items.slice(query.offset, query.offset + query.limit),
      total: items.length,
    })
  }
  get(tenantId: TenantId, projectId: string, id: string) {
    const row = this.documents.get(id)
    return Promise.resolve(
      row?.tenantId === tenantId && row.document.projectId === projectId ? row.document : null,
    )
  }
  listVersions(tenantId: TenantId, documentId: string, query: DocumentPageQuery) {
    const items = [...this.versions.values()]
      .filter((row) => row.tenantId === tenantId && row.version.documentId === documentId)
      .map((row) => {
        const version = row.version
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
      })
      .sort((a, b) => b.versionNumber - a.versionNumber)
    return Promise.resolve({
      items: items.slice(query.offset, query.offset + query.limit),
      total: items.length,
    })
  }
  getVersion(tenantId: TenantId, documentId: string, versionId: string) {
    const row = this.versions.get(versionId)
    return Promise.resolve(
      row?.tenantId === tenantId && row.version.documentId === documentId ? row.version : null,
    )
  }
  insertDocument(input: ApplicationContext, document: AuditDocument) {
    if (this.failInsert) return Promise.reject(new Error('database unavailable'))
    this.documents.set(document.id, { tenantId: input.tenantId, document })
    return Promise.resolve()
  }
  insertVersion(input: ApplicationContext, version: StoredDocumentVersion) {
    this.versions.set(version.id, { tenantId: input.tenantId, version })
    return Promise.resolve()
  }
  updateLatestVersion(
    input: ApplicationContext,
    document: AuditDocument,
    expectedVersionNumber: number,
  ) {
    const before = this.documents.get(document.id)
    if (
      before?.tenantId !== input.tenantId ||
      before.document.latestVersionNumber !== expectedVersionNumber
    )
      return Promise.resolve(false)
    this.documents.set(document.id, { tenantId: input.tenantId, document })
    return Promise.resolve(true)
  }
}

class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, Uint8Array>()
  put(input: { key: string; body: Uint8Array; contentType: string }): Promise<StoredObject> {
    this.objects.set(input.key, input.body)
    return Promise.resolve({
      key: input.key,
      contentType: input.contentType,
      size: input.body.byteLength,
    })
  }
  get(key: string) {
    return Promise.resolve(this.objects.get(key) ?? null)
  }
  delete(key: string) {
    this.objects.delete(key)
    return Promise.resolve()
  }
  getSignedUrl(key: string) {
    return Promise.resolve(`https://storage.example.test/${key}`)
  }
}

function fixture(accessOverride?: Partial<IamAccess>) {
  const projects = new MemoryProjects()
  const documents = new MemoryDocuments()
  const storage = new MemoryStorage()
  const recorded: string[] = []
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
    ...accessOverride,
  }
  const work: DocumentUnitOfWork = {
    run<T>(operation: (transaction: DocumentTransaction) => Promise<T>) {
      return operation({
        documents,
        projectStatus: async (tenantId, id) => (await projects.get(tenantId, id))?.status ?? null,
        record: (_context, action) => {
          recorded.push(action)
          return Promise.resolve()
        },
      })
    },
  }
  const manage = new ManageDocuments(projects, documents, work, access, storage, {
    sha256: () => '0'.repeat(64),
  })
  const user = context()
  const project: Project = {
    id: newEntityId(),
    name: '中文采购审核',
    description: '',
    status: 'ACTIVE',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  projects.rows.set(project.id, { tenantId: user.tenantId, project })
  return { manage, projects, documents, storage, recorded, user, project }
}

describe('audit documents', () => {
  it('keeps versions immutable, tenant scoped and absent of object keys in responses', async () => {
    const { manage, storage, recorded, user, project } = fixture()
    const created = await manage.create(user, project.id, '采购合同', '合同.pdf', pdf)
    const next = await manage.addVersion(
      user,
      project.id,
      created.document.id,
      '合同-修订.pdf',
      pdf,
    )
    expect(created.version.versionNumber).toBe(1)
    expect(next.version.versionNumber).toBe(2)
    expect('objectKey' in created.version).toBe(false)
    expect('objectKey' in next.version).toBe(false)
    expect(
      (
        await manage.listVersions(user, project.id, created.document.id, { limit: 50, offset: 0 })
      ).items.map((version) => version.versionNumber),
    ).toEqual([2, 1])
    expect(storage.objects.size).toBe(2)
    expect(recorded).toEqual(['document.created', 'document.version_added'])
    const other = context()
    await expect(manage.list(other, project.id, { limit: 50, offset: 0 })).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    })
    await expect(
      manage.download(other, project.id, created.document.id, created.version.id),
    ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' })
    const url = await manage.download(user, project.id, created.document.id, created.version.id)
    expect(url.url).toContain(`/tenants/${user.tenantId}/audit/documents/`)
    expect(recorded).toEqual([
      'document.created',
      'document.version_added',
      'document.download_issued',
    ])
  })

  it('rejects invalid bytes before storage and compensates a failed database write', async () => {
    const { manage, documents, storage, user, project } = fixture()
    await expect(
      manage.create(user, project.id, '坏文件', 'bad.pdf', new Uint8Array([1, 2])),
    ).rejects.toMatchObject({ code: 'DOCUMENT_FILE_INVALID', status: 422 })
    expect(storage.objects.size).toBe(0)
    documents.failInsert = true
    await expect(manage.create(user, project.id, '合同', '合同.pdf', pdf)).rejects.toThrow(
      'database unavailable',
    )
    expect(storage.objects.size).toBe(0)
  })

  it('keeps file validation reasons independent from HTTP response status', () => {
    let caught: unknown
    try {
      validateDocumentFile('合同.pdf', new Uint8Array([1, 2]))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(DocumentFileValidationError)
    expect(caught).toMatchObject({ reason: 'INVALID_PDF' })
    expect(caught).not.toHaveProperty('status')
  })

  it('returns a stable conflict and removes the uploaded object when version CAS fails', async () => {
    const { manage, documents, storage, user, project } = fixture()
    const created = await manage.create(user, project.id, '合同', '合同.pdf', pdf)
    vi.spyOn(documents, 'updateLatestVersion').mockResolvedValueOnce(false)
    await expect(
      manage.addVersion(user, project.id, created.document.id, '合同-新版.pdf', pdf),
    ).rejects.toMatchObject({ code: 'DOCUMENT_VERSION_CONFLICT', status: 409 })
    expect(storage.objects.size).toBe(1)
    expect(documents.versions.size).toBe(1)
  })

  it('checks permission before reading or writing and prevents upload to archived projects', async () => {
    const requirePermission = vi.fn<IamAccess['requireUnscopedPermission']>(() =>
      Promise.reject(new Error('denied')),
    )
    const denied = fixture({ requireUnscopedPermission: requirePermission })
    await expect(
      denied.manage.list(denied.user, denied.project.id, { limit: 50, offset: 0 }),
    ).rejects.toThrow('denied')
    await expect(
      denied.manage.create(denied.user, denied.project.id, '合同', '合同.pdf', pdf),
    ).rejects.toThrow('denied')
    expect(denied.storage.objects.size).toBe(0)
    const allowed = fixture()
    allowed.projects.rows.set(allowed.project.id, {
      tenantId: allowed.user.tenantId,
      project: { ...allowed.project, status: 'ARCHIVED' },
    })
    await expect(
      allowed.manage.create(allowed.user, allowed.project.id, '合同', '合同.pdf', pdf),
    ).rejects.toMatchObject({ code: 'PROJECT_ARCHIVED' })
  })
})
