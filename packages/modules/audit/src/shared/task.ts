import { z } from 'zod'

export const taskNameSchema = z.string().trim().min(1).max(200)
export const taskObjectiveSchema = z.string().trim().min(1).max(2_000)
export const taskDocumentRoleSchema = z.string().trim().min(1).max(100)
export const taskStatusSchema = z.literal('DRAFT')

export const auditTaskSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    name: taskNameSchema,
    objective: taskObjectiveSchema,
    status: taskStatusSchema,
    revision: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'AuditTask' })

export const taskDocumentBindingSchema = z
  .object({
    id: z.uuid(),
    taskId: z.uuid(),
    documentId: z.uuid(),
    documentVersionId: z.uuid(),
    documentName: z.string(),
    versionNumber: z.number().int().positive(),
    fileName: z.string(),
    role: taskDocumentRoleSchema,
    createdAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'AuditTaskDocumentBinding' })

export const taskListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()

export const taskListSchema = z
  .object({
    items: z.array(auditTaskSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ id: 'AuditTaskList' })

export const taskDocumentBindingListSchema = z
  .object({ items: z.array(taskDocumentBindingSchema) })
  .strict()
  .meta({ id: 'AuditTaskDocumentBindingList' })

export const taskWithBindingSchema = z
  .object({ task: auditTaskSchema, binding: taskDocumentBindingSchema })
  .strict()
  .meta({ id: 'AuditTaskWithBinding' })

export const createTaskSchema = z
  .object({ name: taskNameSchema, objective: taskObjectiveSchema })
  .strict()
  .meta({ id: 'CreateAuditTask' })

export const updateTaskSchema = z
  .object({
    name: taskNameSchema.optional(),
    objective: taskObjectiveSchema.optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.objective !== undefined, {
    message: '至少修改一个字段',
  })
  .meta({ id: 'UpdateAuditTask' })

export const bindTaskDocumentSchema = z
  .object({
    documentId: z.uuid(),
    documentVersionId: z.uuid(),
    role: taskDocumentRoleSchema,
    expectedRevision: z.number().int().positive(),
  })
  .strict()
  .meta({ id: 'BindAuditTaskDocument' })

export const unbindTaskDocumentSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict()
  .meta({ id: 'UnbindAuditTaskDocument' })

export type AuditTask = z.infer<typeof auditTaskSchema>
export type TaskDocumentBinding = z.infer<typeof taskDocumentBindingSchema>
export type TaskWithBinding = z.infer<typeof taskWithBindingSchema>
export type TaskListQuery = z.infer<typeof taskListQuerySchema>
export type TaskList = z.infer<typeof taskListSchema>
export type CreateTask = z.infer<typeof createTaskSchema>
export type UpdateTask = z.infer<typeof updateTaskSchema>
export type BindTaskDocument = z.infer<typeof bindTaskDocumentSchema>
