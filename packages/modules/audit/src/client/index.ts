import {
  createModuleApiClient,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
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
