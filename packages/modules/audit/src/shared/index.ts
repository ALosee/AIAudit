import { z } from 'zod'

export * from './document.js'
export * from './task.js'

export const projectStatusSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export const projectNameSchema = z.string().trim().min(1).max(200)
export const projectDescriptionSchema = z.string().trim().max(2_000)
export const projectSchema = z
  .object({
    id: z.uuid(),
    name: projectNameSchema,
    description: projectDescriptionSchema,
    status: projectStatusSchema,
    revision: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'AuditProject' })

export const projectListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100),
    offset: z.coerce.number().int().min(0).default(0),
    status: projectStatusSchema.optional(),
  })
  .strict()

export const projectListSchema = z
  .object({
    items: z.array(projectSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ id: 'AuditProjectList' })

export const createProjectSchema = z
  .object({
    name: projectNameSchema,
    description: projectDescriptionSchema.default(''),
  })
  .strict()
  .meta({ id: 'CreateAuditProject' })

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema.optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: '至少修改一个字段',
  })
  .meta({ id: 'UpdateAuditProject' })

export const archiveProjectSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict()
  .meta({ id: 'ArchiveAuditProject' })

export type Project = z.infer<typeof projectSchema>
export type ProjectStatus = z.infer<typeof projectStatusSchema>
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
export type ProjectList = z.infer<typeof projectListSchema>
export type CreateProject = z.infer<typeof createProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>
