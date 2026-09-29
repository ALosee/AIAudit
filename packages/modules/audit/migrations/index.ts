import * as projectFoundation from './20260929090000_audit_project_foundation.js'
import * as documentVersion from './20260929110000_audit_document_version.js'
import * as taskDocumentBinding from './20260929130000_audit_task_document_binding.js'
import * as taskDraftStatus from './20260929131000_audit_task_draft_status.js'
import * as documentVersionImmutable from './20260929132000_audit_document_version_immutable.js'

export const migrations = {
  '20260929090000_audit_project_foundation': projectFoundation,
  '20260929110000_audit_document_version': documentVersion,
  '20260929130000_audit_task_document_binding': taskDocumentBinding,
  '20260929131000_audit_task_draft_status': taskDraftStatus,
  '20260929132000_audit_document_version_immutable': documentVersionImmutable,
} as const
