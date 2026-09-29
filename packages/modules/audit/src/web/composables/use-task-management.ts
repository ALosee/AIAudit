import { computed, ref, watch } from 'vue'

import type { ApiClientError } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'
import { useIamPermission } from '@jingwei/module-iam/session'
import { toast } from '@jingwei/ui'

import * as api from '../../client/index.js'
import type { AuditDocument, AuditDocumentVersion } from '../../shared/document.js'
import type { AuditTask, TaskDocumentBinding } from '../../shared/task.js'

interface PendingBinding {
  documentId: string
  documentVersionId: string
  documentName: string
  role: string
}

function message(error: ApiClientError): string {
  return error.message || '操作失败，请稍后重试'
}

/** Owns task editing and its explicit, version-pinned document inputs for one project. */
export function useTaskManagement(projectId: string) {
  const request = useApiRequestState()
  const canView = useIamPermission('audit.task.view')
  const canManage = useIamPermission('audit.task.manage')
  const canUpload = useIamPermission('audit.project.manage')
  const items = ref<AuditTask[]>([])
  const total = ref(0)
  const offset = ref(0)
  const pageSize = 50
  const selectedId = ref<string | null>(null)
  const creating = ref(false)
  const name = ref('')
  const objective = ref('')
  const bindings = ref<TaskDocumentBinding[]>([])
  const documents = ref<AuditDocument[]>([])
  const documentTotal = ref(0)
  const documentOffset = ref(0)
  const versions = ref<AuditDocumentVersion[]>([])
  const versionTotal = ref(0)
  const versionOffset = ref(0)
  const selectedDocumentId = ref('')
  const selectedVersionId = ref('')
  const role = ref('')
  const uploadRole = ref('')
  const uploadName = ref('')
  const uploadFile = ref<File | null>(null)
  const fileInputRevision = ref(0)
  const pendingBindings = ref<Record<string, PendingBinding>>({})
  const error = ref('')

  const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? null)
  const pendingBinding = computed(() =>
    selectedId.value === null ? null : (pendingBindings.value[selectedId.value] ?? null),
  )
  const hasPrevious = computed(() => offset.value > 0)
  const hasNext = computed(() => offset.value + pageSize < total.value)
  const hasPreviousDocumentPage = computed(() => documentOffset.value > 0)
  const hasNextDocumentPage = computed(() => documentOffset.value + pageSize < documentTotal.value)
  const hasPreviousVersionPage = computed(() => versionOffset.value > 0)
  const hasNextVersionPage = computed(() => versionOffset.value + pageSize < versionTotal.value)

  async function load() {
    if (!canView.value) return
    const result = await api.listTasks(
      projectId,
      { limit: pageSize, offset: offset.value },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    items.value = result.data.items
    total.value = result.data.total
    error.value = ''
    if (selectedId.value !== null && !items.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = null
      bindings.value = []
    }
  }

  async function loadBindings(taskId: string) {
    const result = await api.listTaskDocuments(projectId, taskId, request.options)
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    bindings.value = result.data.items
    error.value = ''
  }

  async function loadDocuments() {
    const result = await api.listDocuments(
      projectId,
      { limit: pageSize, offset: documentOffset.value },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    documents.value = result.data.items
    documentTotal.value = result.data.total
    error.value = ''
    if (
      selectedDocumentId.value &&
      !documents.value.some((item) => item.id === selectedDocumentId.value)
    ) {
      selectedDocumentId.value = ''
      selectedVersionId.value = ''
      versions.value = []
    }
  }

  async function chooseDocument(documentId: string) {
    selectedDocumentId.value = documentId
    selectedVersionId.value = ''
    versions.value = []
    versionOffset.value = 0
    if (!documentId) return
    await loadVersions(documentId)
  }

  async function loadVersions(documentId: string) {
    const result = await api.listDocumentVersions(
      projectId,
      documentId,
      { limit: pageSize, offset: versionOffset.value },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    versions.value = result.data.items
    versionTotal.value = result.data.total
    selectedVersionId.value = result.data.items[0]?.id ?? ''
    error.value = ''
  }

  async function select(task: AuditTask) {
    selectedId.value = task.id
    creating.value = false
    name.value = task.name
    objective.value = task.objective
    error.value = ''
    await Promise.all([loadBindings(task.id), loadDocuments()])
  }

  function beginCreate() {
    creating.value = true
    selectedId.value = null
    bindings.value = []
    name.value = ''
    objective.value = ''
    error.value = ''
  }

  async function save() {
    const trimmedName = name.value.trim()
    const trimmedObjective = objective.value.trim()
    if (!trimmedName || !trimmedObjective) {
      error.value = '请输入任务名称和审核目标'
      return
    }
    const current = selected.value
    if (creating.value) {
      const result = await api.createTask(
        projectId,
        { name: trimmedName, objective: trimmedObjective },
        request.options,
      )
      if (result.error !== null) {
        error.value = message(result.error)
        return
      }
      offset.value = 0
      await load()
      await select(result.data)
      toast.success('审核任务已创建，请配置文档输入')
      return
    }
    if (current === null) return
    const result = await api.updateTask(
      projectId,
      current.id,
      {
        name: trimmedName,
        objective: trimmedObjective,
        expectedRevision: current.revision,
      },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    replaceTask(result.data)
    error.value = ''
    toast.success('任务已保存')
  }

  function replaceTask(task: AuditTask) {
    items.value = items.value.map((item) => (item.id === task.id ? task : item))
  }

  async function bindDocument(documentId: string, documentVersionId: string, roleValue: string) {
    const task = selected.value
    if (task === null) return false
    const result = await api.bindTaskDocument(
      projectId,
      task.id,
      {
        documentId,
        documentVersionId,
        role: roleValue,
        expectedRevision: task.revision,
      },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return false
    }
    replaceTask(result.data.task)
    bindings.value = [...bindings.value, result.data.binding]
    error.value = ''
    role.value = ''
    toast.success('文档版本已绑定到任务')
    return true
  }

  async function bindExisting() {
    if (!selectedDocumentId.value || !selectedVersionId.value || !role.value.trim()) {
      error.value = '请选择文档、版本并填写本次审核中的角色'
      return
    }
    await bindDocument(selectedDocumentId.value, selectedVersionId.value, role.value.trim())
  }

  function chooseFile(file: File | null) {
    uploadFile.value = file
    if (file !== null && !uploadName.value.trim())
      uploadName.value = file.name.replace(/\.(pdf|docx)$/i, '')
  }

  async function uploadAndBind() {
    const task = selected.value
    if (task === null) return
    if (pendingBinding.value !== null) {
      await retryBinding()
      return
    }
    const file = uploadFile.value
    const nameValue = uploadName.value.trim()
    const roleValue = uploadRole.value.trim()
    if (file === null || !nameValue || !roleValue) {
      error.value = '请输入文档名称和角色，并选择 PDF 或 DOCX 文件'
      return
    }
    const uploaded = await api.createDocument(projectId, nameValue, file, request.options)
    if (uploaded.error !== null) {
      error.value = message(uploaded.error)
      return
    }
    pendingBindings.value = {
      ...pendingBindings.value,
      [task.id]: {
        documentId: uploaded.data.document.id,
        documentVersionId: uploaded.data.version.id,
        documentName: uploaded.data.document.name,
        role: roleValue,
      },
    }
    const bound = await bindDocument(uploaded.data.document.id, uploaded.data.version.id, roleValue)
    const bindingError = error.value
    documentOffset.value = 0
    await loadDocuments()
    if (!bound) {
      error.value = `文件已上传到项目文档库，但未绑定任务：${bindingError}`
      return
    }
    clearPending()
  }

  function clearPending() {
    if (selectedId.value === null) return
    const next: Record<string, PendingBinding> = {}
    for (const [taskId, binding] of Object.entries(pendingBindings.value)) {
      if (taskId !== selectedId.value) next[taskId] = binding
    }
    pendingBindings.value = next
    uploadName.value = ''
    uploadRole.value = ''
    uploadFile.value = null
    fileInputRevision.value++
    error.value = ''
  }

  async function retryBinding() {
    const task = selected.value
    const pending = pendingBinding.value
    if (task === null || pending === null) return
    const fresh = await api.getTask(projectId, task.id, request.options)
    if (fresh.error !== null) {
      error.value = message(fresh.error)
      return
    }
    replaceTask(fresh.data)
    const bound = await bindDocument(pending.documentId, pending.documentVersionId, pending.role)
    if (bound) clearPending()
  }

  async function unbind(bindingId: string) {
    const task = selected.value
    if (task === null) return
    const result = await api.unbindTaskDocument(
      projectId,
      task.id,
      bindingId,
      task.revision,
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    replaceTask(result.data)
    bindings.value = bindings.value.filter((binding) => binding.id !== bindingId)
    error.value = ''
    toast.success('已移除任务绑定，文档仍保留在项目库中')
  }

  async function download(binding: TaskDocumentBinding) {
    const tab = window.open('', '_blank')
    if (tab !== null) tab.opener = null
    const result = await api.getDocumentDownload(
      projectId,
      binding.documentId,
      binding.documentVersionId,
      request.options,
    )
    if (result.error !== null) {
      tab?.close()
      error.value = message(result.error)
      return
    }
    error.value = ''
    if (tab !== null) tab.location.href = result.data.url
    else window.location.assign(result.data.url)
  }

  async function page(direction: -1 | 1) {
    offset.value = Math.max(0, offset.value + direction * pageSize)
    selectedId.value = null
    bindings.value = []
    await load()
  }

  async function pageDocuments(direction: -1 | 1) {
    documentOffset.value = Math.max(0, documentOffset.value + direction * pageSize)
    await loadDocuments()
  }

  async function pageVersions(direction: -1 | 1) {
    if (!selectedDocumentId.value) return
    versionOffset.value = Math.max(0, versionOffset.value + direction * pageSize)
    await loadVersions(selectedDocumentId.value)
  }

  watch(
    canView,
    (allowed) => {
      if (allowed) void load()
    },
    { immediate: true },
  )

  return {
    canView,
    canManage,
    canUpload,
    loading: request.loading,
    error,
    items,
    total,
    offset,
    hasPrevious,
    hasNext,
    selected,
    creating,
    name,
    objective,
    bindings,
    documents,
    documentTotal,
    hasPreviousDocumentPage,
    hasNextDocumentPage,
    versions,
    versionTotal,
    hasPreviousVersionPage,
    hasNextVersionPage,
    selectedDocumentId,
    selectedVersionId,
    role,
    uploadRole,
    uploadName,
    uploadFile,
    fileInputRevision,
    pendingBinding,
    load,
    loadDocuments,
    select,
    beginCreate,
    save,
    bindExisting,
    chooseDocument,
    chooseFile,
    uploadAndBind,
    retryBinding,
    clearPending,
    unbind,
    download,
    page,
    pageDocuments,
    pageVersions,
  }
}
