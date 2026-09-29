import * as projectFoundation from './20260929090000_audit_project_foundation.js'
import * as documentVersion from './20260929110000_audit_document_version.js'

export const migrations = {
  '20260929090000_audit_project_foundation': projectFoundation,
  '20260929110000_audit_document_version': documentVersion,
} as const
