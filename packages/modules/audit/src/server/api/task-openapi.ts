import { z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'
import { createApiRoute, permissionApiAccess } from '@jingwei/module-sdk/server'

import {
  auditTaskSchema,
  bindTaskDocumentSchema,
  createTaskSchema,
  taskDocumentBindingListSchema,
  taskListQuerySchema,
  taskListSchema,
  taskWithBindingSchema,
  unbindTaskDocumentSchema,
  updateTaskSchema,
} from '../../shared/task.js'
import {
  projectPermissionRequirements,
  taskPermissionRequirements,
} from '../application/authorization-requirements.js'

const json = <TSchema>(schema: TSchema) => ({ 'application/json': { schema } })
const error = (description: string) => ({ description, content: json(apiErrorSchema) })
const authenticated = [{ [openApiSecurityNames.accessTokenCookie]: [] }]
const mutation = [
  { [openApiSecurityNames.accessTokenCookie]: [], [openApiSecurityNames.csrfHeader]: [] },
]
const projectParam = z.object({ projectId: z.uuid() })
const taskParam = z.object({ projectId: z.uuid(), taskId: z.uuid() })
const bindingParam = z.object({ projectId: z.uuid(), taskId: z.uuid(), bindingId: z.uuid() })
const viewAccess = permissionApiAccess(
  taskPermissionRequirements.view,
  projectPermissionRequirements.view,
)
const manageAccess = permissionApiAccess(
  taskPermissionRequirements.manage,
  projectPermissionRequirements.view,
)

export const taskApiRoutes = {
  list: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{projectId}/tasks',
    operationId: 'auditTaskList',
    tags: ['Audit Task'],
    summary: '列出项目审核任务',
    security: authenticated,
    request: { params: projectParam, query: taskListQuerySchema },
    responses: {
      200: { description: '任务列表', content: json(taskListSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无查看权限'),
      404: error('项目不存在'),
      500: error('服务器内部错误'),
    },
  }),
  get: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{projectId}/tasks/{taskId}',
    operationId: 'auditTaskGet',
    tags: ['Audit Task'],
    summary: '读取审核任务',
    security: authenticated,
    request: { params: taskParam },
    responses: {
      200: { description: '任务详情', content: json(auditTaskSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无查看权限'),
      404: error('任务不存在'),
      500: error('服务器内部错误'),
    },
  }),
  create: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects/{projectId}/tasks',
    operationId: 'auditTaskCreate',
    tags: ['Audit Task'],
    summary: '创建待配置的审核任务',
    security: mutation,
    request: { params: projectParam, body: { required: true, content: json(createTaskSchema) } },
    responses: {
      201: { description: '新任务', content: json(auditTaskSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无管理权限'),
      404: error('项目不存在'),
      409: error('项目已归档'),
      500: error('服务器内部错误'),
    },
  }),
  update: createApiRoute(manageAccess, {
    method: 'patch',
    path: '/projects/{projectId}/tasks/{taskId}',
    operationId: 'auditTaskUpdate',
    tags: ['Audit Task'],
    summary: '修改审核任务目标',
    security: mutation,
    request: { params: taskParam, body: { required: true, content: json(updateTaskSchema) } },
    responses: {
      200: { description: '已修改任务', content: json(auditTaskSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无管理权限'),
      404: error('任务不存在'),
      409: error('任务版本冲突或项目已归档'),
      500: error('服务器内部错误'),
    },
  }),
  bindings: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{projectId}/tasks/{taskId}/documents',
    operationId: 'auditTaskDocuments',
    tags: ['Audit Task'],
    summary: '列出任务绑定的文档版本和角色',
    security: authenticated,
    request: { params: taskParam },
    responses: {
      200: { description: '任务文档绑定', content: json(taskDocumentBindingListSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无查看权限'),
      404: error('任务不存在'),
      500: error('服务器内部错误'),
    },
  }),
  bind: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects/{projectId}/tasks/{taskId}/documents',
    operationId: 'auditTaskBindDocument',
    tags: ['Audit Task'],
    summary: '将项目文档的指定版本和角色绑定到任务',
    security: mutation,
    request: { params: taskParam, body: { required: true, content: json(bindTaskDocumentSchema) } },
    responses: {
      201: { description: '任务和新绑定', content: json(taskWithBindingSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无管理权限'),
      404: error('任务或项目文档版本不存在'),
      409: error('绑定重复、任务版本冲突或项目已归档'),
      500: error('服务器内部错误'),
    },
  }),
  unbind: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects/{projectId}/tasks/{taskId}/documents/{bindingId}/unbind',
    operationId: 'auditTaskUnbindDocument',
    tags: ['Audit Task'],
    summary: '撤销任务文档绑定，保留历史记录',
    security: mutation,
    request: {
      params: bindingParam,
      body: { required: true, content: json(unbindTaskDocumentSchema) },
    },
    responses: {
      200: { description: '已更新任务', content: json(auditTaskSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无管理权限'),
      404: error('任务或绑定不存在'),
      409: error('任务版本冲突或项目已归档'),
      500: error('服务器内部错误'),
    },
  }),
} as const
