import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import type {
  AuditTask,
  BindTaskDocument,
  CreateTask,
  TaskDocumentBinding,
  TaskList,
  TaskListQuery,
  TaskWithBinding,
  UpdateTask,
} from '../../shared/task.js'
import { taskPermissionRequirements } from './authorization-requirements.js'
import type { ProjectStore } from './project-store.js'
import type { TaskStore, TaskTransaction, TaskUnitOfWork } from './task-store.js'

function projectNotFound(): never {
  throw new ApplicationError({ code: 'PROJECT_NOT_FOUND', message: '项目不存在', status: 404 })
}

function taskNotFound(): never {
  throw new ApplicationError({ code: 'TASK_NOT_FOUND', message: '任务不存在', status: 404 })
}

function bindingNotFound(): never {
  throw new ApplicationError({
    code: 'TASK_DOCUMENT_BINDING_NOT_FOUND',
    message: '任务文档绑定不存在',
    status: 404,
  })
}

function revisionConflict(): never {
  throw new ApplicationError({
    code: 'TASK_REVISION_CONFLICT',
    message: '任务已被其他人修改，请刷新后重试',
    status: 409,
  })
}

async function requireActiveProject(tx: TaskTransaction, context: AuthContext, projectId: string) {
  const status = (await tx.projectStatus(context.tenantId, projectId)) ?? projectNotFound()
  if (status === 'ARCHIVED') {
    throw new ApplicationError({
      code: 'PROJECT_ARCHIVED',
      message: '归档项目不能修改任务',
      status: 409,
    })
  }
}

export class ManageTasks {
  constructor(
    private readonly projects: ProjectStore,
    private readonly tasks: TaskStore,
    private readonly work: TaskUnitOfWork,
    private readonly access: IamAccess,
  ) {}

  async list(context: AuthContext, projectId: string, query: TaskListQuery): Promise<TaskList> {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.view)
    if ((await this.projects.get(context.tenantId, projectId)) === null) projectNotFound()
    return { ...(await this.tasks.list(context.tenantId, projectId, query)), ...query }
  }

  async get(context: AuthContext, projectId: string, taskId: string): Promise<AuditTask> {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.view)
    return (await this.tasks.get(context.tenantId, projectId, taskId)) ?? taskNotFound()
  }

  async listBindings(context: AuthContext, projectId: string, taskId: string) {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.view)
    if ((await this.tasks.get(context.tenantId, projectId, taskId)) === null) taskNotFound()
    return { items: await this.tasks.listBindings(context.tenantId, projectId, taskId) }
  }

  async create(context: AuthContext, projectId: string, input: CreateTask): Promise<AuditTask> {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      await requireActiveProject(tx, context, projectId)
      const now = new Date().toISOString()
      const task: AuditTask = {
        id: newEntityId(),
        projectId,
        name: input.name,
        objective: input.objective,
        status: 'DRAFT',
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }
      await tx.tasks.insert(context, task)
      await tx.recordTask(context, 'task.created', null, task)
      return task
    })
  }

  async update(
    context: AuthContext,
    projectId: string,
    taskId: string,
    input: UpdateTask,
  ): Promise<AuditTask> {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      await requireActiveProject(tx, context, projectId)
      const before =
        (await tx.tasks.get(context.tenantId, projectId, taskId, true)) ?? taskNotFound()
      if (before.revision !== input.expectedRevision) revisionConflict()
      const after: AuditTask = {
        ...before,
        name: input.name ?? before.name,
        objective: input.objective ?? before.objective,
        revision: before.revision + 1,
        updatedAt: new Date().toISOString(),
      }
      if (!(await tx.tasks.update(context, after, before.revision))) revisionConflict()
      await tx.recordTask(context, 'task.updated', before, after)
      return after
    })
  }

  async bind(
    context: AuthContext,
    projectId: string,
    taskId: string,
    input: BindTaskDocument,
  ): Promise<TaskWithBinding> {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      await requireActiveProject(tx, context, projectId)
      const before =
        (await tx.tasks.get(context.tenantId, projectId, taskId, true)) ?? taskNotFound()
      if (before.revision !== input.expectedRevision) revisionConflict()
      const document = await tx.documents.get(context.tenantId, projectId, input.documentId)
      const version =
        document === null
          ? null
          : await tx.documents.getVersion(context.tenantId, document.id, input.documentVersionId)
      if (document === null || version === null) {
        throw new ApplicationError({
          code: 'DOCUMENT_VERSION_NOT_FOUND',
          message: '项目文档版本不存在',
          status: 404,
        })
      }
      if (
        (await tx.tasks.findActiveBinding(context.tenantId, taskId, document.id, input.role)) !==
        null
      ) {
        throw new ApplicationError({
          code: 'TASK_DOCUMENT_BINDING_CONFLICT',
          message: '该文档已按此角色绑定任务',
          status: 409,
        })
      }
      const now = new Date().toISOString()
      const binding: TaskDocumentBinding = {
        id: newEntityId(),
        taskId,
        documentId: document.id,
        documentVersionId: version.id,
        documentName: document.name,
        versionNumber: version.versionNumber,
        fileName: version.fileName,
        role: input.role,
        createdAt: now,
      }
      const task: AuditTask = { ...before, revision: before.revision + 1, updatedAt: now }
      await tx.tasks.insertBinding(context, projectId, binding)
      if (!(await tx.tasks.update(context, task, before.revision))) revisionConflict()
      await tx.recordBinding(context, 'task.document_bound', binding)
      return { task, binding }
    })
  }

  async unbind(
    context: AuthContext,
    projectId: string,
    taskId: string,
    bindingId: string,
    expectedRevision: number,
  ): Promise<AuditTask> {
    await this.access.requireUnscopedPermission(context, taskPermissionRequirements.manage)
    return this.work.run(async (tx) => {
      await requireActiveProject(tx, context, projectId)
      const before =
        (await tx.tasks.get(context.tenantId, projectId, taskId, true)) ?? taskNotFound()
      if (before.revision !== expectedRevision) revisionConflict()
      const binding =
        (await tx.tasks.getBinding(context.tenantId, projectId, taskId, bindingId)) ??
        bindingNotFound()
      if (!(await tx.tasks.removeBinding(context, projectId, taskId, bindingId))) bindingNotFound()
      const task: AuditTask = {
        ...before,
        revision: before.revision + 1,
        updatedAt: new Date().toISOString(),
      }
      if (!(await tx.tasks.update(context, task, before.revision))) revisionConflict()
      await tx.recordBinding(context, 'task.document_unbound', binding)
      return task
    })
  }
}
