import type { Context } from 'hono'

import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'

import type { ManageProjects } from '../application/manage-projects.js'
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

export function createProjectRoutes(manage: ManageProjects) {
  const app = createApiRouter()
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
  return app
}
