import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { Project, ProjectListQuery, ProjectStatus } from '../../shared/index.js'
import type {
  ProjectStore,
  ProjectTransaction,
  ProjectUnitOfWork,
} from '../application/project-store.js'

interface ProjectRow {
  id: string
  tenant_id: string
  name: string
  description: string
  status: ProjectStatus
  revision: number
  created_at: Date
  created_by: string
  updated_at: Date
  updated_by: string
}

export interface ProjectDatabase {
  'audit.project': ProjectRow
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresProjectStore implements ProjectStore {
  constructor(private readonly db: Kysely<ProjectDatabase>) {}

  async list(tenantId: TenantId, query: ProjectListQuery) {
    const tenantRows = this.db.selectFrom('audit.project').where('tenant_id', '=', tenantId)
    const base =
      query.status === undefined ? tenantRows : tenantRows.where('status', '=', query.status)
    const [rows, count] = await Promise.all([
      base
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      base
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow(),
    ])
    return { items: rows.map(toProject), total: Number(count.count) }
  }

  async get(tenantId: TenantId, id: string, lock = false) {
    const query = this.db
      .selectFrom('audit.project')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst()
    return row === undefined ? null : toProject(row)
  }

  async insert(context: ApplicationContext, project: Project) {
    await this.db
      .insertInto('audit.project')
      .values({
        id: project.id,
        tenant_id: context.tenantId,
        name: project.name,
        description: project.description,
        status: project.status,
        revision: project.revision,
        created_at: new Date(project.createdAt),
        created_by: context.userId,
        updated_at: new Date(project.updatedAt),
        updated_by: context.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async update(context: ApplicationContext, project: Project, expectedRevision: number) {
    const result = await this.db
      .updateTable('audit.project')
      .set({
        name: project.name,
        description: project.description,
        status: project.status,
        revision: project.revision,
        updated_at: new Date(project.updatedAt),
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', project.id)
      .where('revision', '=', expectedRevision)
      .executeTakeFirstOrThrow()
    return result.numUpdatedRows === 1n
  }
}

export class PostgresProjectUnitOfWork implements ProjectUnitOfWork {
  constructor(private readonly db: Kysely<ProjectDatabase>) {}

  run<T>(work: (transaction: ProjectTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresProjectStore(transaction),
        record: async (context, action, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'audit',
            action,
            entityType: 'project',
            entityId,
            result: 'SUCCESS',
            before,
            after,
          })
        },
      }),
    )
  }
}
