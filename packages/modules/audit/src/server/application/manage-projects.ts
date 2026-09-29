import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import type {
  CreateProject,
  Project,
  ProjectList,
  ProjectListQuery,
  UpdateProject,
} from '../../shared/index.js'
import { projectPermissionRequirements } from './authorization-requirements.js'
import type { ProjectStore, ProjectUnitOfWork } from './project-store.js'

function notFound(): never {
  throw new ApplicationError({ code: 'PROJECT_NOT_FOUND', message: '项目不存在', status: 404 })
}

function revisionConflict(): never {
  throw new ApplicationError({
    code: 'PROJECT_REVISION_CONFLICT',
    message: '项目已被其他人修改，请刷新后重试',
    status: 409,
  })
}

/** Project is tenant scoped. Application owns permission, transaction and audit boundaries. */
export class ManageProjects {
  constructor(
    private readonly store: ProjectStore,
    private readonly work: ProjectUnitOfWork,
    private readonly access: IamAccess,
  ) {}

  async list(context: AuthContext, query: ProjectListQuery): Promise<ProjectList> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.view)
    const result = await this.store.list(context.tenantId, query)
    return { ...result, limit: query.limit, offset: query.offset }
  }

  async get(context: AuthContext, id: string): Promise<Project> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.view)
    return (await this.store.get(context.tenantId, id)) ?? notFound()
  }

  async create(context: AuthContext, input: CreateProject): Promise<Project> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      const now = new Date().toISOString()
      const project: Project = {
        id: newEntityId(),
        name: input.name,
        description: input.description,
        status: 'ACTIVE',
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }
      await tx.store.insert(context, project)
      await tx.record(context, 'created', project.id, null, project)
      return project
    })
  }

  async update(context: AuthContext, id: string, input: UpdateProject): Promise<Project> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      const before = (await tx.store.get(context.tenantId, id, true)) ?? notFound()
      if (before.revision !== input.expectedRevision) revisionConflict()
      if (before.status !== 'ACTIVE')
        throw new ApplicationError({
          code: 'PROJECT_ARCHIVED',
          message: '归档项目不能修改',
          status: 409,
        })
      const after: Project = {
        ...before,
        name: input.name ?? before.name,
        description: input.description ?? before.description,
        revision: before.revision + 1,
        updatedAt: new Date().toISOString(),
      }
      if (!(await tx.store.update(context, after, before.revision))) revisionConflict()
      await tx.record(context, 'updated', id, before, after)
      return after
    })
  }

  async archive(context: AuthContext, id: string, expectedRevision: number): Promise<Project> {
    await this.access.requireUnscopedPermission(context, projectPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      const before = (await tx.store.get(context.tenantId, id, true)) ?? notFound()
      if (before.revision !== expectedRevision) revisionConflict()
      if (before.status === 'ARCHIVED') return before
      const after: Project = {
        ...before,
        status: 'ARCHIVED',
        revision: before.revision + 1,
        updatedAt: new Date().toISOString(),
      }
      if (!(await tx.store.update(context, after, before.revision))) revisionConflict()
      await tx.record(context, 'archived', id, before, after)
      return after
    })
  }
}
