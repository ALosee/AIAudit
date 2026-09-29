import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createProjectRoutes } from './api/routes.js'
import { ManageDocuments } from './application/manage-documents.js'
import { ManageProjects } from './application/manage-projects.js'
import { ManageTasks } from './application/manage-tasks.js'
import { NodeDocumentDigest } from './infrastructure/document-digest.node.js'
import {
  PostgresDocumentStore,
  PostgresDocumentUnitOfWork,
  type DocumentDatabase,
} from './infrastructure/document-store.pg.js'
import {
  PostgresProjectStore,
  PostgresProjectUnitOfWork,
  type ProjectDatabase,
} from './infrastructure/project-store.pg.js'
import {
  PostgresTaskStore,
  PostgresTaskUnitOfWork,
  type TaskDatabase,
} from './infrastructure/task-store.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const database = context.database.view<ProjectDatabase>()
    const documentDatabase = context.database.view<DocumentDatabase>()
    const taskDatabase = context.database.view<TaskDatabase>()
    const access = createIamAccess(context.database, context.moduleRegistry, context.logger)
    const manage = new ManageProjects(
      new PostgresProjectStore(database),
      new PostgresProjectUnitOfWork(database),
      access,
    )
    const documents = new ManageDocuments(
      new PostgresProjectStore(database),
      new PostgresDocumentStore(documentDatabase),
      new PostgresDocumentUnitOfWork(documentDatabase),
      access,
      context.objectStorage,
      new NodeDocumentDigest(),
    )
    const tasks = new ManageTasks(
      new PostgresProjectStore(database),
      new PostgresTaskStore(taskDatabase),
      new PostgresTaskUnitOfWork(taskDatabase),
      access,
    )
    return Promise.resolve({
      id: manifest.id,
      basePath: '/audit',
      routes: createProjectRoutes(manage, documents, tasks),
    })
  },
}
