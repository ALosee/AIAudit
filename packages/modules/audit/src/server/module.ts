import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createProjectRoutes } from './api/routes.js'
import { ManageProjects } from './application/manage-projects.js'
import {
  PostgresProjectStore,
  PostgresProjectUnitOfWork,
  type ProjectDatabase,
} from './infrastructure/project-store.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const database = context.database.view<ProjectDatabase>()
    const manage = new ManageProjects(
      new PostgresProjectStore(database),
      new PostgresProjectUnitOfWork(database),
      createIamAccess(context.database, context.moduleRegistry, context.logger),
    )
    return Promise.resolve({
      id: manifest.id,
      basePath: '/audit',
      routes: createProjectRoutes(manage),
    })
  },
}
