import { z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'
import { createApiRoute, permissionApiAccess } from '@jingwei/module-sdk/server'

import {
  archiveProjectSchema,
  createProjectSchema,
  projectListQuerySchema,
  projectListSchema,
  projectSchema,
  updateProjectSchema,
} from '../../shared/index.js'
import { projectPermissionRequirements } from '../application/authorization-requirements.js'

const json = <TSchema>(schema: TSchema) => ({ 'application/json': { schema } })
const error = (description: string) => ({ description, content: json(apiErrorSchema) })
const authenticated = [{ [openApiSecurityNames.accessTokenCookie]: [] }]
const mutation = [
  { [openApiSecurityNames.accessTokenCookie]: [], [openApiSecurityNames.csrfHeader]: [] },
]
const idParam = z.object({ id: z.uuid() })
const viewAccess = permissionApiAccess(projectPermissionRequirements.view)
const manageAccess = permissionApiAccess(projectPermissionRequirements.manage)

export const projectApiRoutes = {
  list: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects',
    operationId: 'projectList',
    tags: ['Project'],
    summary: '分页读取审核项目',
    security: authenticated,
    request: { query: projectListQuerySchema },
    responses: {
      200: { description: '项目列表', content: json(projectListSchema) },
      400: error('查询参数无效'),
      401: error('尚未登录'),
      403: error('缺少 audit.project.view 权限'),
      500: error('服务器内部错误'),
    },
  }),
  get: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{id}',
    operationId: 'projectGet',
    tags: ['Project'],
    summary: '读取审核项目',
    security: authenticated,
    request: { params: idParam },
    responses: {
      200: { description: '项目详情', content: json(projectSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      403: error('缺少 audit.project.view 权限'),
      404: error('项目不存在'),
      500: error('服务器内部错误'),
    },
  }),
  create: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects',
    operationId: 'projectCreate',
    tags: ['Project'],
    summary: '创建审核项目',
    security: mutation,
    request: { body: { required: true, content: json(createProjectSchema) } },
    responses: {
      201: { description: '新项目', content: json(projectSchema) },
      400: error('请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  update: createApiRoute(manageAccess, {
    method: 'patch',
    path: '/projects/{id}',
    operationId: 'projectUpdate',
    tags: ['Project'],
    summary: '修改审核项目',
    security: mutation,
    request: { params: idParam, body: { required: true, content: json(updateProjectSchema) } },
    responses: {
      200: { description: '已修改项目', content: json(projectSchema) },
      400: error('请求参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('项目不存在'),
      409: error('编辑版本冲突或项目已归档'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  archive: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects/{id}/archive',
    operationId: 'projectArchive',
    tags: ['Project'],
    summary: '归档审核项目',
    security: mutation,
    request: { params: idParam, body: { required: true, content: json(archiveProjectSchema) } },
    responses: {
      200: { description: '已归档项目', content: json(projectSchema) },
      400: error('请求参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('项目不存在'),
      409: error('编辑版本冲突'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
} as const

export const auditOpenApiContract = {
  id: 'audit',
  title: 'Audit',
  basePath: '/audit',
  routes: Object.values(projectApiRoutes),
} as const
