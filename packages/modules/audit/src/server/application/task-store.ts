import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { AuditTask, TaskDocumentBinding, TaskListQuery } from '../../shared/task.js'
import type { DocumentStore } from './document-store.js'

export interface TaskStore {
  list(
    tenantId: TenantId,
    projectId: string,
    query: TaskListQuery,
  ): Promise<{ items: AuditTask[]; total: number }>
  get(
    tenantId: TenantId,
    projectId: string,
    taskId: string,
    lock?: boolean,
  ): Promise<AuditTask | null>
  insert(context: ApplicationContext, task: AuditTask): Promise<void>
  update(context: ApplicationContext, task: AuditTask, expectedRevision: number): Promise<boolean>
  listBindings(
    tenantId: TenantId,
    projectId: string,
    taskId: string,
  ): Promise<TaskDocumentBinding[]>
  getBinding(
    tenantId: TenantId,
    projectId: string,
    taskId: string,
    bindingId: string,
  ): Promise<TaskDocumentBinding | null>
  findActiveBinding(
    tenantId: TenantId,
    taskId: string,
    documentId: string,
    role: string,
  ): Promise<TaskDocumentBinding | null>
  insertBinding(
    context: ApplicationContext,
    projectId: string,
    binding: TaskDocumentBinding,
  ): Promise<void>
  removeBinding(
    context: ApplicationContext,
    projectId: string,
    taskId: string,
    bindingId: string,
  ): Promise<boolean>
}

export interface TaskTransaction {
  readonly tasks: TaskStore
  readonly documents: Pick<DocumentStore, 'get' | 'getVersion'>
  projectStatus(tenantId: TenantId, projectId: string): Promise<'ACTIVE' | 'ARCHIVED' | null>
  recordTask(
    context: ApplicationContext,
    action: string,
    before: AuditTask | null,
    after: AuditTask,
  ): Promise<void>
  recordBinding(
    context: ApplicationContext,
    action: string,
    binding: TaskDocumentBinding,
  ): Promise<void>
}

export interface TaskUnitOfWork {
  run<T>(work: (transaction: TaskTransaction) => Promise<T>): Promise<T>
}
