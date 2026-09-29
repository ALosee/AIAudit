import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { Project, ProjectListQuery } from '../../shared/index.js'

export interface ProjectStore {
  list(tenantId: TenantId, query: ProjectListQuery): Promise<{ items: Project[]; total: number }>
  get(tenantId: TenantId, id: string, lock?: boolean): Promise<Project | null>
  insert(context: ApplicationContext, project: Project): Promise<void>
  update(context: ApplicationContext, project: Project, expectedRevision: number): Promise<boolean>
}

export interface ProjectTransaction {
  store: ProjectStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: Project | null,
    after: Project,
  ): Promise<void>
}

export interface ProjectUnitOfWork {
  run<T>(work: (transaction: ProjectTransaction) => Promise<T>): Promise<T>
}
