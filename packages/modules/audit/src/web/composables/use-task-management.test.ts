// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError } from '@jingwei/api-client'
import { setIamSessionPermissions } from '@jingwei/module-iam/session'

import * as api from '../../client/index.js'
import type { AuditDocument, AuditDocumentVersion } from '../../shared/document.js'
import type { AuditTask, TaskDocumentBinding } from '../../shared/task.js'
import { useTaskManagement } from './use-task-management.js'

vi.mock('../../client/index.js', () => ({
  listTasks: vi.fn(),
  listTaskDocuments: vi.fn(),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  bindTaskDocument: vi.fn(),
  getTask: vi.fn(),
}))
vi.mock('@jingwei/ui', () => ({ toast: { success: vi.fn() } }))

const projectId = '01994619-73e8-76ad-823a-90cd0d1325cc'
const taskId = '01994619-74ae-71a4-8e66-751d7bea8418'
const documentId = '01994619-7512-7c83-8092-fc91776db4e8'
const versionId = '01994619-75d5-7415-a690-3d75bf031671'
const now = '2026-09-29T00:00:00.000Z'
const task: AuditTask = {
  id: taskId,
  projectId,
  name: '采购合同审核',
  objective: '核对金额和签章',
  status: 'DRAFT',
  revision: 1,
  createdAt: now,
  updatedAt: now,
}
const document: AuditDocument = {
  id: documentId,
  projectId,
  name: '采购合同',
  latestVersionNumber: 1,
  createdAt: now,
  updatedAt: now,
}
const version: AuditDocumentVersion = {
  id: versionId,
  documentId,
  versionNumber: 1,
  fileName: '合同.pdf',
  contentType: 'application/pdf',
  byteSize: 9,
  sha256: 'a'.repeat(64),
  createdAt: now,
}
const binding: TaskDocumentBinding = {
  id: '01994619-765c-7e7e-9abf-941d9757b116',
  taskId,
  documentId,
  documentVersionId: versionId,
  documentName: document.name,
  versionNumber: 1,
  fileName: version.fileName,
  role: '待审核合同',
  createdAt: now,
}

beforeEach(() => {
  vi.clearAllMocks()
  setIamSessionPermissions([
    'audit.task.view',
    'audit.task.manage',
    'audit.project.view',
    'audit.project.manage',
  ])
  vi.mocked(api.listTasks).mockResolvedValue({
    data: { items: [task], total: 1, limit: 50, offset: 0 },
    error: null,
  })
  vi.mocked(api.listTaskDocuments).mockResolvedValue({ data: { items: [] }, error: null })
  vi.mocked(api.listDocuments).mockResolvedValue({
    data: { items: [document], total: 1, limit: 50, offset: 0 },
    error: null,
  })
  vi.mocked(api.createDocument).mockResolvedValue({
    data: { document, version },
    error: null,
  })
})

describe('useTaskManagement upload and bind recovery', () => {
  it('clears a successful upload once and leaves no pending binding', async () => {
    vi.mocked(api.bindTaskDocument).mockResolvedValue({
      data: { task: { ...task, revision: 2 }, binding },
      error: null,
    })
    const state = useTaskManagement(projectId)
    await vi.waitFor(() => expect(state.items.value).toHaveLength(1))
    await state.select(task)
    state.uploadName.value = '采购合同'
    state.uploadRole.value = '待审核合同'
    state.chooseFile(new File(['%PDF-1.7\n'], '合同.pdf', { type: 'application/pdf' }))

    await state.uploadAndBind()

    expect(api.createDocument).toHaveBeenCalledTimes(1)
    expect(state.pendingBinding.value).toBeNull()
    expect(state.uploadName.value).toBe('')
    expect(state.uploadRole.value).toBe('')
    expect(state.uploadFile.value).toBeNull()
    expect(state.fileInputRevision.value).toBe(1)
  })

  it('reuses the uploaded version and a fresh task revision after binding fails', async () => {
    vi.mocked(api.bindTaskDocument)
      .mockResolvedValueOnce({
        data: null,
        error: new ApiClientError('TASK_REVISION_CONFLICT', '任务已变更', null, 409),
      })
      .mockResolvedValueOnce({ data: { task: { ...task, revision: 3 }, binding }, error: null })
    vi.mocked(api.getTask).mockResolvedValue({
      data: { ...task, revision: 2 },
      error: null,
    })

    const state = useTaskManagement(projectId)
    await vi.waitFor(() => expect(state.items.value).toHaveLength(1))
    await state.select(task)
    state.uploadName.value = '采购合同'
    state.uploadRole.value = '待审核合同'
    state.chooseFile(new File(['%PDF-1.7\n'], '合同.pdf', { type: 'application/pdf' }))
    await state.uploadAndBind()

    expect(api.createDocument).toHaveBeenCalledTimes(1)
    expect(state.pendingBinding.value?.documentVersionId).toBe(versionId)
    expect(state.error.value).toContain('文件已上传到项目文档库')
    await state.uploadAndBind()

    expect(api.createDocument).toHaveBeenCalledTimes(1)
    expect(api.getTask).toHaveBeenCalledWith(projectId, taskId, expect.anything())
    expect(vi.mocked(api.bindTaskDocument).mock.calls[1]?.[2]).toMatchObject({
      documentId,
      documentVersionId: versionId,
      expectedRevision: 2,
    })
    expect(state.pendingBinding.value).toBeNull()
    expect(state.bindings.value).toEqual([binding])
  })
})
