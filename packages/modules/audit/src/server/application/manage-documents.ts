import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'
import type { ObjectStorage } from '@jingwei/storage'

import type {
  AuditDocument,
  AuditDocumentVersion,
  DocumentDownload,
  DocumentList,
  DocumentPageQuery,
  DocumentVersionList,
  DocumentWithVersion,
} from '../../shared/document.js'
import { validateDocumentFile } from '../domain/document-file.js'
import { projectPermissionRequirements } from './authorization-requirements.js'
import type { DocumentDigest } from './document-digest.js'
import type { DocumentStore, DocumentUnitOfWork, StoredDocumentVersion } from './document-store.js'
import type { ProjectStore } from './project-store.js'

function notFound(): never {
  throw new ApplicationError({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在', status: 404 })
}

function projectNotFound(): never {
  throw new ApplicationError({ code: 'PROJECT_NOT_FOUND', message: '项目不存在', status: 404 })
}

function archived(): never {
  throw new ApplicationError({
    code: 'PROJECT_ARCHIVED',
    message: '归档项目不能上传文档',
    status: 409,
  })
}

function storageRequired(storage: ObjectStorage | null): ObjectStorage {
  if (storage === null) {
    throw new ApplicationError({
      code: 'OBJECT_STORAGE_UNAVAILABLE',
      message: '对象存储尚未配置',
      status: 503,
    })
  }
  return storage
}

function publicVersion(version: StoredDocumentVersion): AuditDocumentVersion {
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

export class ManageDocuments {
  constructor(
    private readonly projects: ProjectStore,
    private readonly documents: DocumentStore,
    private readonly work: DocumentUnitOfWork,
    private readonly access: IamAccess,
    private readonly storage: ObjectStorage | null,
    private readonly digest: DocumentDigest,
  ) {}

  async list(
    context: AuthContext,
    projectId: string,
    query: DocumentPageQuery,
  ): Promise<DocumentList> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.view)
    if ((await this.projects.get(context.tenantId, projectId)) === null) projectNotFound()
    return { ...(await this.documents.list(context.tenantId, projectId, query)), ...query }
  }

  async listVersions(
    context: AuthContext,
    projectId: string,
    documentId: string,
    query: DocumentPageQuery,
  ): Promise<DocumentVersionList> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.view)
    if ((await this.documents.get(context.tenantId, projectId, documentId)) === null) notFound()
    return { ...(await this.documents.listVersions(context.tenantId, documentId, query)), ...query }
  }

  async create(
    context: AuthContext,
    projectId: string,
    name: string,
    fileName: string,
    bytes: Uint8Array,
  ): Promise<DocumentWithVersion> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.manage)
    const project = (await this.projects.get(context.tenantId, projectId)) ?? projectNotFound()
    if (project.status === 'ARCHIVED') archived()
    const storage = storageRequired(this.storage)
    const file = validateDocumentFile(fileName, bytes)
    const now = new Date().toISOString()
    const documentId = newEntityId()
    const versionId = newEntityId()
    const document: AuditDocument = {
      id: documentId,
      projectId,
      name,
      latestVersionNumber: 1,
      createdAt: now,
      updatedAt: now,
    }
    const version = this.version(context, documentId, versionId, 1, now, file, bytes)
    return this.saveObjectThenCommit(context, storage, version, bytes, async () =>
      this.work.run(async (tx) => {
        const status =
          (await tx.projectStatus(context.tenantId, projectId, true)) ?? projectNotFound()
        if (status === 'ARCHIVED') archived()
        await tx.documents.insertDocument(context, document)
        await tx.documents.insertVersion(context, version)
        await tx.record(context, 'document.created', document, publicVersion(version))
        return { document, version: publicVersion(version) }
      }),
    )
  }

  async addVersion(
    context: AuthContext,
    projectId: string,
    documentId: string,
    fileName: string,
    bytes: Uint8Array,
  ): Promise<DocumentWithVersion> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.manage)
    const project = (await this.projects.get(context.tenantId, projectId)) ?? projectNotFound()
    if (project.status === 'ARCHIVED') archived()
    if ((await this.documents.get(context.tenantId, projectId, documentId)) === null) notFound()
    const storage = storageRequired(this.storage)
    const file = validateDocumentFile(fileName, bytes)
    const now = new Date().toISOString()
    const versionId = newEntityId()
    const provisional = this.version(context, documentId, versionId, 1, now, file, bytes)
    return this.saveObjectThenCommit(context, storage, provisional, bytes, async () =>
      this.work.run(async (tx) => {
        const status =
          (await tx.projectStatus(context.tenantId, projectId, true)) ?? projectNotFound()
        if (status === 'ARCHIVED') archived()
        const before =
          (await tx.documents.get(context.tenantId, projectId, documentId, true)) ?? notFound()
        const version = { ...provisional, versionNumber: before.latestVersionNumber + 1 }
        const document = {
          ...before,
          latestVersionNumber: version.versionNumber,
          updatedAt: now,
        }
        if (
          !(await tx.documents.updateLatestVersion(context, document, before.latestVersionNumber))
        ) {
          throw new ApplicationError({
            code: 'DOCUMENT_VERSION_CONFLICT',
            message: '文档版本冲突',
            status: 409,
          })
        }
        await tx.documents.insertVersion(context, version)
        await tx.record(context, 'document.version_added', document, publicVersion(version))
        return { document, version: publicVersion(version) }
      }),
    )
  }

  async download(
    context: AuthContext,
    projectId: string,
    documentId: string,
    versionId: string,
  ): Promise<DocumentDownload> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.view)
    if ((await this.documents.get(context.tenantId, projectId, documentId)) === null) notFound()
    const version =
      (await this.documents.getVersion(context.tenantId, documentId, versionId)) ?? notFound()
    const expiresInSeconds = 60
    return {
      url: await storageRequired(this.storage).getSignedUrl(version.objectKey, expiresInSeconds),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    }
  }

  private version(
    context: AuthContext,
    documentId: string,
    id: string,
    versionNumber: number,
    createdAt: string,
    file: ReturnType<typeof validateDocumentFile>,
    bytes: Uint8Array,
  ): StoredDocumentVersion {
    return {
      id,
      documentId,
      versionNumber,
      fileName: file.fileName,
      contentType: file.contentType,
      byteSize: bytes.byteLength,
      sha256: this.digest.sha256(bytes),
      createdAt,
      objectKey: `tenants/${context.tenantId}/audit/documents/${documentId}/versions/${id}`,
    }
  }

  private async saveObjectThenCommit<T>(
    context: AuthContext,
    storage: ObjectStorage,
    version: StoredDocumentVersion,
    bytes: Uint8Array,
    commit: () => Promise<T>,
  ): Promise<T> {
    try {
      await storage.put({ key: version.objectKey, body: bytes, contentType: version.contentType })
    } catch (cause) {
      throw new ApplicationError({
        code: 'DOCUMENT_STORAGE_FAILED',
        message: '文件存储失败',
        status: 503,
        cause,
      })
    }
    try {
      return await commit()
    } catch (cause) {
      try {
        await storage.delete(version.objectKey)
      } catch (cleanupCause) {
        throw new ApplicationError({
          code: 'DOCUMENT_CLEANUP_FAILED',
          message: '文档保存失败，请联系管理员处理',
          status: 503,
          cause: new AggregateError(
            [cause, cleanupCause],
            `Orphan object after request ${context.requestId}`,
          ),
        })
      }
      throw cause
    }
  }
}
