import { createHash } from 'node:crypto'

import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { AuditTask, TaskDocumentBinding, TaskListQuery } from '../../shared/task.js'
import type { TaskStore, TaskTransaction, TaskUnitOfWork } from '../application/task-store.js'
import { PostgresDocumentStore, type DocumentDatabase } from './document-store.pg.js'

interface TaskRow {
  id: string
  tenant_id: string
  project_id: string
  name: string
  objective: string
  status: AuditTask['status']
  revision: number
  created_at: Date
  created_by: string
  updated_at: Date
  updated_by: string
}

interface BindingRow {
  id: string
  tenant_id: string
  project_id: string
  task_id: string
  document_id: string
  document_version_id: string
  role: string
  created_at: Date
  created_by: string
  removed_at: Date | null
  removed_by: string | null
}

export interface TaskDatabase extends DocumentDatabase {
  'audit.task': TaskRow
  'audit.task_document_binding': BindingRow
}

function toTask(row: TaskRow): AuditTask {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function auditedTask(task: AuditTask) {
  return {
    projectId: task.projectId,
    revision: task.revision,
    nameSha256: createHash('sha256').update(task.name).digest('hex'),
    objectiveSha256: createHash('sha256').update(task.objective).digest('hex'),
  }
}

function bindingQuery(db: Kysely<TaskDatabase>) {
  return db
    .selectFrom('audit.task_document_binding as binding')
    .innerJoin('audit.document as document', (join) =>
      join
        .onRef('document.tenant_id', '=', 'binding.tenant_id')
        .onRef('document.project_id', '=', 'binding.project_id')
        .onRef('document.id', '=', 'binding.document_id'),
    )
    .innerJoin('audit.document_version as version', (join) =>
      join
        .onRef('version.tenant_id', '=', 'binding.tenant_id')
        .onRef('version.document_id', '=', 'binding.document_id')
        .onRef('version.id', '=', 'binding.document_version_id'),
    )
    .select([
      'binding.id as id',
      'binding.task_id as taskId',
      'binding.document_id as documentId',
      'binding.document_version_id as documentVersionId',
      'binding.role as role',
      'binding.created_at as createdAt',
      'document.name as documentName',
      'version.version_number as versionNumber',
      'version.file_name as fileName',
    ])
    .where('binding.removed_at', 'is', null)
}

function toBinding(
  row: Awaited<ReturnType<ReturnType<typeof bindingQuery>['execute']>>[number],
): TaskDocumentBinding {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

export class PostgresTaskStore implements TaskStore {
  constructor(private readonly db: Kysely<TaskDatabase>) {}

  async list(tenantId: TenantId, projectId: string, query: TaskListQuery) {
    const base = this.db
      .selectFrom('audit.task')
      .where('tenant_id', '=', tenantId)
      .where('project_id', '=', projectId)
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
    return { items: rows.map(toTask), total: Number(count.count) }
  }

  async get(tenantId: TenantId, projectId: string, taskId: string, lock = false) {
    const query = this.db
      .selectFrom('audit.task')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('project_id', '=', projectId)
      .where('id', '=', taskId)
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst()
    return row === undefined ? null : toTask(row)
  }

  async insert(context: ApplicationContext, task: AuditTask) {
    await this.db
      .insertInto('audit.task')
      .values({
        id: task.id,
        tenant_id: context.tenantId,
        project_id: task.projectId,
        name: task.name,
        objective: task.objective,
        status: task.status,
        revision: task.revision,
        created_at: new Date(task.createdAt),
        created_by: context.userId,
        updated_at: new Date(task.updatedAt),
        updated_by: context.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async update(context: ApplicationContext, task: AuditTask, expectedRevision: number) {
    const result = await this.db
      .updateTable('audit.task')
      .set({
        name: task.name,
        objective: task.objective,
        revision: task.revision,
        updated_at: new Date(task.updatedAt),
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('project_id', '=', task.projectId)
      .where('id', '=', task.id)
      .where('revision', '=', expectedRevision)
      .executeTakeFirstOrThrow()
    return result.numUpdatedRows === 1n
  }

  async listBindings(tenantId: TenantId, projectId: string, taskId: string) {
    const rows = await bindingQuery(this.db)
      .where('binding.tenant_id', '=', tenantId)
      .where('binding.project_id', '=', projectId)
      .where('binding.task_id', '=', taskId)
      .orderBy('binding.created_at', 'asc')
      .orderBy('binding.id', 'asc')
      .execute()
    return rows.map(toBinding)
  }

  async getBinding(tenantId: TenantId, projectId: string, taskId: string, bindingId: string) {
    const row = await bindingQuery(this.db)
      .where('binding.tenant_id', '=', tenantId)
      .where('binding.project_id', '=', projectId)
      .where('binding.task_id', '=', taskId)
      .where('binding.id', '=', bindingId)
      .executeTakeFirst()
    return row === undefined ? null : toBinding(row)
  }

  async findActiveBinding(tenantId: TenantId, taskId: string, documentId: string, role: string) {
    const row = await bindingQuery(this.db)
      .where('binding.tenant_id', '=', tenantId)
      .where('binding.task_id', '=', taskId)
      .where('binding.document_id', '=', documentId)
      .where('binding.role', '=', role)
      .executeTakeFirst()
    return row === undefined ? null : toBinding(row)
  }

  async insertBinding(
    context: ApplicationContext,
    projectId: string,
    binding: TaskDocumentBinding,
  ) {
    await this.db
      .insertInto('audit.task_document_binding')
      .values({
        id: binding.id,
        tenant_id: context.tenantId,
        project_id: projectId,
        task_id: binding.taskId,
        document_id: binding.documentId,
        document_version_id: binding.documentVersionId,
        role: binding.role,
        created_at: new Date(binding.createdAt),
        created_by: context.userId,
        removed_at: null,
        removed_by: null,
      })
      .executeTakeFirstOrThrow()
  }

  async removeBinding(
    context: ApplicationContext,
    projectId: string,
    taskId: string,
    bindingId: string,
  ) {
    const result = await this.db
      .updateTable('audit.task_document_binding')
      .set({ removed_at: new Date(), removed_by: context.userId })
      .where('tenant_id', '=', context.tenantId)
      .where('project_id', '=', projectId)
      .where('task_id', '=', taskId)
      .where('id', '=', bindingId)
      .where('removed_at', 'is', null)
      .executeTakeFirstOrThrow()
    return result.numUpdatedRows === 1n
  }
}

export class PostgresTaskUnitOfWork implements TaskUnitOfWork {
  constructor(private readonly db: Kysely<TaskDatabase>) {}

  run<T>(work: (transaction: TaskTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        tasks: new PostgresTaskStore(transaction),
        documents: new PostgresDocumentStore(transaction.$pickTables<keyof DocumentDatabase>()),
        projectStatus: async (tenantId, projectId) => {
          const row = await transaction
            .selectFrom('audit.project')
            .select('status')
            .where('tenant_id', '=', tenantId)
            .where('id', '=', projectId)
            .forUpdate()
            .executeTakeFirst()
          return row?.status ?? null
        },
        recordTask: async (context, action, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'audit',
            action,
            entityType: 'task',
            entityId: after.id,
            result: 'SUCCESS',
            before: before === null ? null : auditedTask(before),
            after: {
              ...auditedTask(after),
              changedFields:
                before === null
                  ? ['name', 'objective']
                  : [
                      ...(before.name === after.name ? [] : ['name']),
                      ...(before.objective === after.objective ? [] : ['objective']),
                    ],
            },
          })
        },
        recordBinding: async (context, action, binding) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'audit',
            action,
            entityType: 'task_document_binding',
            entityId: binding.id,
            result: 'SUCCESS',
            after: {
              taskId: binding.taskId,
              documentId: binding.documentId,
              documentVersionId: binding.documentVersionId,
              role: binding.role,
            },
          })
        },
      }),
    )
  }
}
