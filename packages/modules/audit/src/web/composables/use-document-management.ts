import { computed, onMounted, ref } from 'vue'

import type { ApiClientError } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'
import { useIamPermission } from '@jingwei/module-iam/session'
import { toast } from '@jingwei/ui'

import * as api from '../../client/index.js'
import type { AuditDocument, AuditDocumentVersion } from '../../shared/document.js'

function message(error: ApiClientError): string {
  return error.message || '操作失败，请稍后重试'
}

/** Owns document uploads, immutable versions and short-lived downloads for one project. */
export function useDocumentManagement(projectId: string) {
  const request = useApiRequestState()
  const canManage = useIamPermission('audit.project.manage')
  const items = ref<AuditDocument[]>([])
  const versions = ref<AuditDocumentVersion[]>([])
  const documentOffset = ref(0)
  const documentTotal = ref(0)
  const versionOffset = ref(0)
  const versionTotal = ref(0)
  const pageSize = 50
  const selectedId = ref<string | null>(null)
  const name = ref('')
  const file = ref<File | null>(null)
  const versionFile = ref<File | null>(null)
  const fileInputRevision = ref(0)
  const versionInputRevision = ref(0)
  const error = ref('')
  const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? null)
  const hasPreviousDocumentPage = computed(() => documentOffset.value > 0)
  const hasNextDocumentPage = computed(() => documentOffset.value + pageSize < documentTotal.value)
  const hasPreviousVersionPage = computed(() => versionOffset.value > 0)
  const hasNextVersionPage = computed(() => versionOffset.value + pageSize < versionTotal.value)

  async function load() {
    const result = await api.listDocuments(
      projectId,
      { limit: pageSize, offset: documentOffset.value },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    items.value = result.data.items
    documentTotal.value = result.data.total
    error.value = ''
    if (selectedId.value !== null && !items.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = null
      versions.value = []
    }
  }

  async function select(document: AuditDocument) {
    selectedId.value = document.id
    versionOffset.value = 0
    await loadVersions(document.id)
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
    error.value = ''
  }

  function chooseFile(value: File | null) {
    file.value = value
    if (value !== null && name.value.trim().length === 0)
      name.value = value.name.replace(/\.(pdf|docx)$/i, '')
  }

  async function upload() {
    if (file.value === null || name.value.trim().length === 0) {
      error.value = '请输入文档名称并选择文件'
      return
    }
    const result = await api.createDocument(
      projectId,
      name.value.trim(),
      file.value,
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    name.value = ''
    file.value = null
    fileInputRevision.value++
    documentOffset.value = 0
    await load()
    await select(result.data.document)
    toast.success('文档已上传')
  }

  async function uploadVersion() {
    const document = selected.value
    if (document === null || versionFile.value === null) {
      error.value = '请选择新版本文件'
      return
    }
    const result = await api.addDocumentVersion(
      projectId,
      document.id,
      versionFile.value,
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    versionFile.value = null
    versionInputRevision.value++
    await load()
    await select(result.data.document)
    toast.success('新版本已保存，旧版本仍可访问')
  }

  async function download(versionId: string) {
    const document = selected.value
    if (document === null) return
    const tab = window.open('', '_blank')
    if (tab !== null) tab.opener = null
    const result = await api.getDocumentDownload(projectId, document.id, versionId, request.options)
    if (result.error !== null) {
      tab?.close()
      error.value = message(result.error)
      return
    }
    error.value = ''
    if (tab !== null) tab.location.href = result.data.url
    else window.location.assign(result.data.url)
  }

  async function pageDocuments(direction: -1 | 1) {
    documentOffset.value = Math.max(0, documentOffset.value + direction * pageSize)
    selectedId.value = null
    versions.value = []
    await load()
  }

  async function pageVersions(direction: -1 | 1) {
    const document = selected.value
    if (document === null) return
    versionOffset.value = Math.max(0, versionOffset.value + direction * pageSize)
    await loadVersions(document.id)
  }

  onMounted(() => {
    void load()
  })

  return {
    items,
    versions,
    documentOffset,
    documentTotal,
    versionOffset,
    versionTotal,
    hasPreviousDocumentPage,
    hasNextDocumentPage,
    hasPreviousVersionPage,
    hasNextVersionPage,
    selected,
    name,
    file,
    versionFile,
    fileInputRevision,
    versionInputRevision,
    error,
    loading: request.loading,
    canManage,
    chooseFile,
    select,
    upload,
    uploadVersion,
    download,
    pageDocuments,
    pageVersions,
  }
}
