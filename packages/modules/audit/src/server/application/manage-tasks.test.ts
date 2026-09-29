import { describe, expect, it, vi } from 'vitest'

import {
  newEntityId,
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type AuthContext,
  type TenantId,
} from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import type { AuditDocument, AuditDocumentVersion, Project } from '../../shared/index.js'
import type { AuditTask, TaskDocumentBinding, TaskListQuery } from '../../shared/task.js'
import { ManageTasks } from './manage-tasks.js'
import type { ProjectStore } from './project-store.js'
import type { TaskStore, TaskTransaction, TaskUnitOfWork } from './task-store.js'

function context(tenantId = newTenantId()): AuthContext {
  return {
    requestId: newRequestId(),
    tenantId,
    userId: newUserId(),
    sessionId: newSessionId(),
    roleIds: [],
  }
}

class MemoryProjects implements ProjectStore {
  readonly rows = new Map<string, { tenantId: TenantId; project: Project }>()
  list() {
    return Promise.resolve({ items: [], total: 0 })
  }
  get(tenantId: TenantId, id: string) {
    const row = this.rows.get(id)
    return Promise.resolve(row?.tenantId === tenantId ? row.project : null)
  }
  insert() {
    return Promise.resolve()
  }
  update() {
    return Promise.resolve(false)
  }
}

class MemoryTasks implements TaskStore {
  readonly rows = new Map<string, { tenantId: TenantId; task: AuditTask }>()
  readonly bindings = new Map<
    string,
    { tenantId: TenantId; projectId: string; binding: TaskDocumentBinding; removed: boolean }
  >()

  list(tenantId: TenantId, projectId: string, query: TaskListQuery) {
    const items = [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId && row.task.projectId === projectId)
      .map((row) => row.task)
    return Promise.resolve({
      items: items.slice(query.offset, query.offset + query.limit),
      total: items.length,
    })
  }
  get(tenantId: TenantId, projectId: string, taskId: string) {
    const row = this.rows.get(taskId)
    return Promise.resolve(
      row?.tenantId === tenantId && row.task.projectId === projectId ? row.task : null,
    )
  }
  insert(input: AuthContext, task: AuditTask) {
    this.rows.set(task.id, { tenantId: input.tenantId, task })
    return Promise.resolve()
  }
  update(input: AuthContext, task: AuditTask, expectedRevision: number) {
    const before = this.rows.get(task.id)
    if (before?.tenantId !== input.tenantId || before.task.revision !== expectedRevision)
      return Promise.resolve(false)
    this.rows.set(task.id, { tenantId: input.tenantId, task })
    return Promise.resolve(true)
  }
  listBindings(tenantId: TenantId, projectId: string, taskId: string) {
    return Promise.resolve(
      [...this.bindings.values()]
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            row.projectId === projectId &&
            row.binding.taskId === taskId &&
            !row.removed,
        )
        .map((row) => row.binding),
    )
  }
  getBinding(tenantId: TenantId, projectId: string, taskId: string, bindingId: string) {
    const row = this.bindings.get(bindingId)
    return Promise.resolve(
      row?.tenantId === tenantId &&
        row.projectId === projectId &&
        row.binding.taskId === taskId &&
        !row.removed
        ? row.binding
        : null,
    )
  }
  findActiveBinding(tenantId: TenantId, taskId: string, documentId: string, role: string) {
    return Promise.resolve(
      [...this.bindings.values()].find(
        (row) =>
          row.tenantId === tenantId &&
          row.binding.taskId === taskId &&
          row.binding.documentId === documentId &&
          row.binding.role === role &&
          !row.removed,
      )?.binding ?? null,
    )
  }
  insertBinding(input: AuthContext, projectId: string, binding: TaskDocumentBinding) {
    this.bindings.set(binding.id, { tenantId: input.tenantId, projectId, binding, removed: false })
    return Promise.resolve()
  }
  removeBinding(input: AuthContext, projectId: string, taskId: string, bindingId: string) {
    const row = this.bindings.get(bindingId)
    if (
      row?.tenantId !== input.tenantId ||
      row.projectId !== projectId ||
      row.binding.taskId !== taskId ||
      row.removed
    )
      return Promise.resolve(false)
    row.removed = true
    return Promise.resolve(true)
  }
}

function fixture(accessOverride?: Partial<IamAccess>) {
  const user = context()
  const now = new Date().toISOString()
  const project: Project = {
    id: newEntityId(),
    name: '采购审核',
    description: '',
    status: 'ACTIVE',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
  const projects = new MemoryProjects()
  projects.rows.set(project.id, { tenantId: user.tenantId, project })
  const documents = new Map<string, { tenantId: TenantId; document: AuditDocument }>()
  const versions = new Map<string, { tenantId: TenantId; version: AuditDocumentVersion }>()
  const document: AuditDocument = {
    id: newEntityId(),
    projectId: project.id,
    name: '合同',
    latestVersionNumber: 1,
    createdAt: now,
    updatedAt: now,
  }
  const version: AuditDocumentVersion = {
    id: newEntityId(),
    documentId: document.id,
    versionNumber: 1,
    fileName: '合同.pdf',
    contentType: 'application/pdf',
    byteSize: 9,
    sha256: 'a'.repeat(64),
    createdAt: now,
  }
  documents.set(document.id, { tenantId: user.tenantId, document })
  versions.set(version.id, { tenantId: user.tenantId, version })
  const tasks = new MemoryTasks()
  const recorded: string[] = []
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
    ...accessOverride,
  }
  const work: TaskUnitOfWork = {
    run<T>(operation: (transaction: TaskTransaction) => Promise<T>) {
      return operation({
        tasks,
        documents: {
          get: (tenantId, projectId, id) => {
            const row = documents.get(id)
            return Promise.resolve(
              row?.tenantId === tenantId && row.document.projectId === projectId
                ? row.document
                : null,
            )
          },
          getVersion: (tenantId, documentId, id) => {
            const row = versions.get(id)
            return Promise.resolve(
              row?.tenantId === tenantId && row.version.documentId === documentId
                ? { ...row.version, objectKey: 'private' }
                : null,
            )
          },
        },
        projectStatus: async (tenantId, projectId) =>
          (await projects.get(tenantId, projectId))?.status ?? null,
        recordTask: (_context, action) => {
          recorded.push(action)
          return Promise.resolve()
        },
        recordBinding: (_context, action) => {
          recorded.push(action)
          return Promise.resolve()
        },
      })
    },
  }
  const manage = new ManageTasks(projects, tasks, work, access)
  return {
    user,
    project,
    projects,
    document,
    version,
    documents,
    versions,
    tasks,
    manage,
    recorded,
  }
}

describe('audit task document binding', () => {
  it('pins a version and lets another task reuse the same project document with a different role', async () => {
    const { user, project, document, version, versions, manage, recorded } = fixture()
    const first = await manage.create(user, project.id, {
      name: '合同审查',
      objective: '检查合同金额',
    })
    const bound = await manage.bind(user, project.id, first.id, {
      documentId: document.id,
      documentVersionId: version.id,
      role: '待审核合同',
      expectedRevision: first.revision,
    })
    expect(bound.task.revision).toBe(2)
    const secondVersion = {
      ...version,
      id: newEntityId(),
      versionNumber: 2,
      fileName: '合同-新版.pdf',
    }
    versions.set(secondVersion.id, { tenantId: user.tenantId, version: secondVersion })
    expect(
      (await manage.listBindings(user, project.id, first.id)).items[0]?.documentVersionId,
    ).toBe(version.id)
    const second = await manage.create(user, project.id, {
      name: '条款对照',
      objective: '检查条款变化',
    })
    const reused = await manage.bind(user, project.id, second.id, {
      documentId: document.id,
      documentVersionId: secondVersion.id,
      role: '对照文件',
      expectedRevision: second.revision,
    })
    expect(reused.binding.documentVersionId).toBe(secondVersion.id)
    expect(recorded).toEqual([
      'task.created',
      'task.document_bound',
      'task.created',
      'task.document_bound',
    ])
  })

  it('rejects cross-project and cross-tenant inputs, duplicates and stale revisions', async () => {
    const { user, project, projects, document, version, documents, manage } = fixture()
    const task = await manage.create(user, project.id, { name: '审查', objective: '核对主体' })
    const input = {
      documentId: document.id,
      documentVersionId: version.id,
      role: '待审核文件',
      expectedRevision: task.revision,
    }
    const otherProject = { ...project, id: newEntityId() }
    projects.rows.set(otherProject.id, { tenantId: user.tenantId, project: otherProject })
    const foreign = { ...document, id: newEntityId(), projectId: otherProject.id }
    documents.set(foreign.id, { tenantId: user.tenantId, document: foreign })
    await expect(
      manage.bind(user, project.id, task.id, { ...input, documentId: foreign.id }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_VERSION_NOT_FOUND' })
    await expect(manage.bind(context(), project.id, task.id, input)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    })
    const bound = await manage.bind(user, project.id, task.id, input)
    await expect(manage.bind(user, project.id, task.id, input)).rejects.toMatchObject({
      code: 'TASK_REVISION_CONFLICT',
    })
    await expect(
      manage.bind(user, project.id, task.id, { ...input, expectedRevision: bound.task.revision }),
    ).rejects.toMatchObject({ code: 'TASK_DOCUMENT_BINDING_CONFLICT' })
    const removed = await manage.unbind(
      user,
      project.id,
      task.id,
      bound.binding.id,
      bound.task.revision,
    )
    expect((await manage.listBindings(user, project.id, task.id)).items).toEqual([])
    expect(removed.revision).toBe(3)
    const rebound = await manage.bind(user, project.id, task.id, {
      ...input,
      expectedRevision: removed.revision,
    })
    expect(rebound.binding.id).not.toBe(bound.binding.id)
  })

  it('enforces task permission before reading and blocks writes to an archived project', async () => {
    const permission = vi.fn<IamAccess['requireUnscopedPermission']>(() =>
      Promise.reject(new Error('denied')),
    )
    const denied = fixture({ requireUnscopedPermission: permission })
    await expect(
      denied.manage.list(denied.user, denied.project.id, { limit: 50, offset: 0 }),
    ).rejects.toThrow('denied')
    expect(permission).toHaveBeenCalledOnce()
    const allowed = fixture()
    const task = await allowed.manage.create(allowed.user, allowed.project.id, {
      name: '任务',
      objective: '检查材料',
    })
    allowed.projects.rows.set(allowed.project.id, {
      tenantId: allowed.user.tenantId,
      project: { ...allowed.project, status: 'ARCHIVED' },
    })
    await expect(
      allowed.manage.bind(allowed.user, allowed.project.id, task.id, {
        documentId: allowed.document.id,
        documentVersionId: allowed.version.id,
        role: '材料',
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'PROJECT_ARCHIVED' })
  })
})
