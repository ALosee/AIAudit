import {
  createModuleApiClient,
  postFormData,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  documentDownloadSchema,
  documentListSchema,
  documentVersionListSchema,
  documentWithVersionSchema,
  type DocumentDownload,
  type DocumentList,
  type DocumentVersionList,
  type DocumentWithVersion,
  projectListSchema,
  projectSchema,
  type CreateProject,
  type Project,
  type ProjectList,
  type ProjectStatus,
  type UpdateProject,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/audit'>('/api/v1/audit')

export function listProjects(
  query: { limit: number; offset?: number; status?: ProjectStatus } = { limit: 50 },
  options?: ApiRequestOptions,
): Promise<ApiResult<ProjectList>> {
  return toApiResult(api.client.get('/projects', { query, schema: projectListSchema, ...options }))
}

export function getProject(id: string, options?: ApiRequestOptions): Promise<ApiResult<Project>> {
  return toApiResult(
    api.client.get('/projects/{id}', { pathParams: { id }, schema: projectSchema, ...options }),
  )
}

export function createProject(
  input: CreateProject,
  options?: ApiRequestOptions,
): Promise<ApiResult<Project>> {
  return toApiResult(
    api.client.post('/projects', { body: input, schema: projectSchema, ...options }),
  )
}

export function updateProject(
  id: string,
  input: UpdateProject,
  options?: ApiRequestOptions,
): Promise<ApiResult<Project>> {
  return toApiResult(
    api.client.patch('/projects/{id}', {
      pathParams: { id },
      body: {
        expectedRevision: input.expectedRevision,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
      },
      schema: projectSchema,
      ...options,
    }),
  )
}

export function archiveProject(
  id: string,
  expectedRevision: number,
  options?: ApiRequestOptions,
): Promise<ApiResult<Project>> {
  return toApiResult(
    api.client.post('/projects/{id}/archive', {
      pathParams: { id },
      body: { expectedRevision },
      schema: projectSchema,
      ...options,
    }),
  )
}

export function listDocuments(
  projectId: string,
  query: { limit: number; offset?: number } = { limit: 50 },
  options?: ApiRequestOptions,
): Promise<ApiResult<DocumentList>> {
  return toApiResult(
    api.client.get('/projects/{projectId}/documents', {
      pathParams: { projectId },
      query,
      schema: documentListSchema,
      ...options,
    }),
  )
}

export function createDocument(
  projectId: string,
  name: string,
  file: File,
  options?: ApiRequestOptions,
): Promise<ApiResult<DocumentWithVersion>> {
  const form = new FormData()
  form.set('name', name)
  form.set('file', file)
  return postFormData(
    `/api/v1/audit/projects/${encodeURIComponent(projectId)}/documents`,
    form,
    documentWithVersionSchema,
    options,
  )
}

export function listDocumentVersions(
  projectId: string,
  documentId: string,
  query: { limit: number; offset?: number } = { limit: 50 },
  options?: ApiRequestOptions,
): Promise<ApiResult<DocumentVersionList>> {
  return toApiResult(
    api.client.get('/projects/{projectId}/documents/{documentId}/versions', {
      pathParams: { projectId, documentId },
      query,
      schema: documentVersionListSchema,
      ...options,
    }),
  )
}

export function addDocumentVersion(
  projectId: string,
  documentId: string,
  file: File,
  options?: ApiRequestOptions,
): Promise<ApiResult<DocumentWithVersion>> {
  const form = new FormData()
  form.set('file', file)
  return postFormData(
    `/api/v1/audit/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/versions`,
    form,
    documentWithVersionSchema,
    options,
  )
}

export function getDocumentDownload(
  projectId: string,
  documentId: string,
  versionId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<DocumentDownload>> {
  return toApiResult(
    api.client.get('/projects/{projectId}/documents/{documentId}/versions/{versionId}/download', {
      pathParams: { projectId, documentId, versionId },
      schema: documentDownloadSchema,
      ...options,
    }),
  )
}
