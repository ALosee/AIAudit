import { definePermissionRequirement } from '@jingwei/module-sdk'

export const projectPermissionRequirements = Object.freeze({
  view: definePermissionRequirement({
    permission: 'audit.project.view',
    capability: 'audit.projects',
    scope: 'UNSCOPED',
  }),
  manage: definePermissionRequirement({
    permission: 'audit.project.manage',
    capability: 'audit.projects',
    scope: 'UNSCOPED',
  }),
})
