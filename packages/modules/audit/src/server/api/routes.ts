import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'

import { maximumAuditDocumentBytes } from '../../shared/document.js'
import type { ManageDocuments } from '../application/manage-documents.js'
import type { ManageProjects } from '../application/manage-projects.js'
import { documentApiRoutes } from './document-openapi.js'
import { projectApiRoutes } from './openapi.js'

function auth(context: Context<ServerAppEnv>) {
  const value = context.get('authContext')
  if (value === null)
    throw new ApplicationError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '需要登录后访问',
      status: 401,
    })
  return value
}

export function createProjectRoutes(manage: ManageProjects, documents: ManageDocuments) {
  const app = createApiRouter()
  app.use('/projects/*', bodyLimit({ maxSize: maximumAuditDocumentBytes + 128 * 1024 }))
  app.use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(projectApiRoutes.list, async (context) =>
    context.json(await manage.list(auth(context), context.req.valid('query')), 200),
  )
  app.openapi(projectApiRoutes.get, async (context) =>
    context.json(await manage.get(auth(context), context.req.valid('param').id), 200),
  )
  app.openapi(projectApiRoutes.create, async (context) =>
    context.json(await manage.create(auth(context), context.req.valid('json')), 201),
  )
  app.openapi(projectApiRoutes.update, async (context) =>
    context.json(
      await manage.update(auth(context), context.req.valid('param').id, context.req.valid('json')),
      200,
    ),
  )
  app.openapi(projectApiRoutes.archive, async (context) =>
    context.json(
      await manage.archive(
        auth(context),
        context.req.valid('param').id,
        context.req.valid('json').expectedRevision,
      ),
      200,
    ),
  )
  app.openapi(documentApiRoutes.list, async (context) =>
    context.json(
      await documents.list(
        auth(context),
        context.req.valid('param').projectId,
        context.req.valid('query'),
      ),
      200,
    ),
  )
  app.openapi(documentApiRoutes.create, async (context) => {
    const input = context.req.valid('form')
    return context.json(
      await documents.create(
        auth(context),
        context.req.valid('param').projectId,
        input.name,
        input.file.name,
        new Uint8Array(await input.file.arrayBuffer()),
      ),
      201,
    )
  })
  app.openapi(documentApiRoutes.versions, async (context) => {
    const { projectId, documentId } = context.req.valid('param')
    return context.json(
      await documents.listVersions(
        auth(context),
        projectId,
        documentId,
        context.req.valid('query'),
      ),
      200,
    )
  })
  app.openapi(documentApiRoutes.addVersion, async (context) => {
    const { projectId, documentId } = context.req.valid('param')
    const input = context.req.valid('form')
    return context.json(
      await documents.addVersion(
        auth(context),
        projectId,
        documentId,
        input.file.name,
        new Uint8Array(await input.file.arrayBuffer()),
      ),
      201,
    )
  })
  app.openapi(documentApiRoutes.download, async (context) => {
    const { projectId, documentId, versionId } = context.req.valid('param')
    return context.json(
      await documents.download(auth(context), projectId, documentId, versionId),
      200,
    )
  })
  return app
}
