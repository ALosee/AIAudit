import { z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'
import { createApiRoute, permissionApiAccess } from '@jingwei/module-sdk/server'

import {
  documentDownloadSchema,
  documentListSchema,
  documentNameSchema,
  documentPageQuerySchema,
  documentVersionListSchema,
  documentWithVersionSchema,
  maximumAuditDocumentBytes,
} from '../../shared/document.js'
import { projectPermissionRequirements } from '../application/authorization-requirements.js'

const json = <TSchema>(schema: TSchema) => ({ 'application/json': { schema } })
const error = (description: string) => ({ description, content: json(apiErrorSchema) })
const authenticated = [{ [openApiSecurityNames.accessTokenCookie]: [] }]
const mutation = [
  { [openApiSecurityNames.accessTokenCookie]: [], [openApiSecurityNames.csrfHeader]: [] },
]
const projectParam = z.object({ projectId: z.uuid() })
const documentParam = z.object({ projectId: z.uuid(), documentId: z.uuid() })
const versionParam = z.object({ projectId: z.uuid(), documentId: z.uuid(), versionId: z.uuid() })
const file = z.file().max(maximumAuditDocumentBytes).openapi({ type: 'string', format: 'binary' })
const viewAccess = permissionApiAccess(projectPermissionRequirements.view)
const manageAccess = permissionApiAccess(projectPermissionRequirements.manage)

export const documentApiRoutes = {
  list: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{projectId}/documents',
    operationId: 'auditDocumentList',
    tags: ['Audit Document'],
    summary: '列出项目文档',
    security: authenticated,
    request: { params: projectParam, query: documentPageQuerySchema },
    responses: {
      200: { description: '项目文档列表', content: json(documentListSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无查看权限'),
      404: error('项目不存在'),
      500: error('服务器内部错误'),
    },
  }),
  create: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects/{projectId}/documents',
    operationId: 'auditDocumentCreate',
    tags: ['Audit Document'],
    summary: '上传新文档及首个版本',
    security: mutation,
    request: {
      params: projectParam,
      body: {
        required: true,
        content: {
          'multipart/form-data': { schema: z.object({ name: documentNameSchema, file }) },
        },
      },
    },
    responses: {
      201: { description: '文档与首个版本', content: json(documentWithVersionSchema) },
      400: error('表单无效'),
      401: error('尚未登录'),
      403: error('无管理权限'),
      404: error('项目不存在'),
      409: error('项目已归档'),
      413: error('文件过大'),
      415: error('文件类型不支持'),
      422: error('文件内容无效'),
      500: error('服务器内部错误'),
      503: error('对象存储不可用'),
    },
  }),
  versions: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{projectId}/documents/{documentId}/versions',
    operationId: 'auditDocumentVersions',
    tags: ['Audit Document'],
    summary: '列出不可覆盖的文档版本',
    security: authenticated,
    request: { params: documentParam, query: documentPageQuerySchema },
    responses: {
      200: { description: '版本列表', content: json(documentVersionListSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('无查看权限'),
      404: error('文档不存在'),
      500: error('服务器内部错误'),
    },
  }),
  addVersion: createApiRoute(manageAccess, {
    method: 'post',
    path: '/projects/{projectId}/documents/{documentId}/versions',
    operationId: 'auditDocumentAddVersion',
    tags: ['Audit Document'],
    summary: '上传新版本',
    security: mutation,
    request: {
      params: documentParam,
      body: { required: true, content: { 'multipart/form-data': { schema: z.object({ file }) } } },
    },
    responses: {
      201: { description: '新增版本', content: json(documentWithVersionSchema) },
      400: error('表单无效'),
      401: error('尚未登录'),
      403: error('无管理权限'),
      404: error('项目或文档不存在'),
      409: error('项目已归档或版本冲突'),
      413: error('文件过大'),
      415: error('文件类型不支持'),
      422: error('文件内容无效'),
      500: error('服务器内部错误'),
      503: error('对象存储不可用'),
    },
  }),
  download: createApiRoute(viewAccess, {
    method: 'get',
    path: '/projects/{projectId}/documents/{documentId}/versions/{versionId}/download',
    operationId: 'auditDocumentDownload',
    tags: ['Audit Document'],
    summary: '签发短期下载地址',
    security: authenticated,
    request: { params: versionParam },
    responses: {
      200: { description: '短期访问地址', content: json(documentDownloadSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      403: error('无查看权限'),
      404: error('文档版本不存在'),
      500: error('服务器内部错误'),
      503: error('对象存储不可用'),
    },
  }),
} as const
