import { describe, expect, it, vi } from 'vitest'

import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
  type TenantId,
} from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import type { Project, ProjectListQuery } from '../../shared/index.js'
import { ManageProjects } from './manage-projects.js'
import type { ProjectStore, ProjectTransaction, ProjectUnitOfWork } from './project-store.js'

function context(tenantId = newTenantId()): AuthContext {
  return {
    requestId: newRequestId(),
    tenantId,
    userId: newUserId(),
    sessionId: newSessionId(),
    roleIds: [],
  }
}

class MemoryProjectStore implements ProjectStore {
  rows = new Map<string, { tenantId: TenantId; project: Project }>()

  list(tenantId: TenantId, query: ProjectListQuery) {
    const matching = [...this.rows.values()]
      .filter(
        (row) =>
          row.tenantId === tenantId &&
          (query.status === undefined || row.project.status === query.status),
      )
      .map((row) => row.project)
    return Promise.resolve({
      items: matching.slice(query.offset, query.offset + query.limit),
      total: matching.length,
    })
  }

  get(tenantId: TenantId, id: string) {
    const row = this.rows.get(id)
    return Promise.resolve(row?.tenantId === tenantId ? row.project : null)
  }

  insert(input: ApplicationContext, project: Project) {
    this.rows.set(project.id, { tenantId: input.tenantId, project })
    return Promise.resolve()
  }

  update(input: ApplicationContext, project: Project, expectedRevision: number) {
    const row = this.rows.get(project.id)
    if (row?.tenantId !== input.tenantId || row.project.revision !== expectedRevision)
      return Promise.resolve(false)
    this.rows.set(project.id, { tenantId: input.tenantId, project })
    return Promise.resolve(true)
  }
}

function fixture(accessOverride?: Partial<IamAccess>) {
  const store = new MemoryProjectStore()
  const recorded: string[] = []
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
    ...accessOverride,
  }
  const work: ProjectUnitOfWork = {
    run<T>(operation: (transaction: ProjectTransaction) => Promise<T>) {
      return operation({
        store,
        record: (_context, action) => {
          recorded.push(action)
          return Promise.resolve()
        },
      })
    },
  }
  return { store, recorded, manage: new ManageProjects(store, work, access) }
}

describe('audit project application', () => {
  it('keeps projects within their tenant and audits mutations', async () => {
    const { manage, recorded } = fixture()
    const first = context()
    const second = context()
    const project = await manage.create(first, { name: '采购资料审核', description: '' })

    expect((await manage.list(first, { limit: 50, offset: 0 })).items).toEqual([project])
    expect((await manage.list(second, { limit: 50, offset: 0 })).items).toEqual([])
    await expect(manage.get(second, project.id)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    })
    await expect(
      manage.update(second, project.id, { name: '越权修改', expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    expect(recorded).toEqual(['created'])
  })

  it('rejects stale revisions and preserves archived projects', async () => {
    const { manage, recorded } = fixture()
    const user = context()
    const created = await manage.create(user, { name: '合同审核', description: '' })
    const updated = await manage.update(user, created.id, {
      name: '合同一致性审核',
      expectedRevision: 1,
    })
    expect(updated.revision).toBe(2)
    await expect(
      manage.update(user, created.id, { name: '旧编辑', expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
    const archived = await manage.archive(user, created.id, 2)
    expect(archived).toMatchObject({ status: 'ARCHIVED', revision: 3 })
    await expect(
      manage.update(user, created.id, { name: '已归档', expectedRevision: 3 }),
    ).rejects.toMatchObject({ code: 'PROJECT_ARCHIVED' })
    expect(await manage.archive(user, created.id, 3)).toEqual(archived)
    expect(recorded).toEqual(['created', 'updated', 'archived'])
  })

  it('checks audit permissions before querying or mutating', async () => {
    const requirePermission = vi.fn<IamAccess['requireUnscopedPermission']>(() =>
      Promise.reject(new Error('denied')),
    )
    const { manage, recorded } = fixture({ requireUnscopedPermission: requirePermission })
    const user = context()
    await expect(manage.list(user, { limit: 50, offset: 0 })).rejects.toThrow('denied')
    await expect(manage.create(user, { name: '不能创建', description: '' })).rejects.toThrow(
      'denied',
    )
    expect(requirePermission.mock.calls.map(([, requirement]) => requirement.permission)).toEqual([
      'audit.project.view',
      'audit.project.manage',
    ])
    expect(recorded).toEqual([])
  })
})
