import { computed, onMounted, ref } from 'vue'

import { ApiClientError } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'
import { useIamPermission } from '@jingwei/module-iam/session'
import { toast } from '@jingwei/ui'

import * as api from '../../client/index.js'
import type { Project, ProjectStatus } from '../../shared/index.js'

function message(cause: unknown): string {
  if (cause instanceof ApiClientError) return cause.message
  return cause instanceof Error ? cause.message : '操作失败，请稍后重试'
}

/** Owns project listing and editing; the page only binds and presents this state. */
export function useProjectManagement() {
  const request = useApiRequestState()
  const canManage = useIamPermission('audit.project.manage')
  const items = ref<Project[]>([])
  const total = ref(0)
  const offset = ref(0)
  const status = ref<ProjectStatus>('ACTIVE')
  const selectedId = ref<string | null>(null)
  const creating = ref(false)
  const name = ref('')
  const description = ref('')
  const error = ref('')
  const limit = 50

  const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? null)
  const hasPrevious = computed(() => offset.value > 0)
  const hasNext = computed(() => offset.value + limit < total.value)

  async function load() {
    const result = await api.listProjects(
      { limit, offset: offset.value, status: status.value },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    error.value = ''
    items.value = result.data.items
    total.value = result.data.total
    if (selectedId.value !== null && !items.value.some((item) => item.id === selectedId.value))
      selectedId.value = null
  }

  function select(project: Project) {
    creating.value = false
    selectedId.value = project.id
    name.value = project.name
    description.value = project.description
    error.value = ''
  }

  function beginCreate() {
    creating.value = true
    selectedId.value = null
    name.value = ''
    description.value = ''
    error.value = ''
  }

  async function save() {
    const trimmedName = name.value.trim()
    if (!trimmedName) {
      error.value = '请输入项目名称'
      return
    }
    if (creating.value) {
      const result = await api.createProject(
        { name: trimmedName, description: description.value.trim() },
        request.options,
      )
      if (result.error !== null) {
        error.value = message(result.error)
        return
      }
      status.value = 'ACTIVE'
      offset.value = 0
      await load()
      select(result.data)
      toast.success('审核项目已创建')
      return
    }
    const current = selected.value
    if (current === null) return
    const result = await api.updateProject(
      current.id,
      {
        name: trimmedName,
        description: description.value.trim(),
        expectedRevision: current.revision,
      },
      request.options,
    )
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    items.value = items.value.map((item) => (item.id === result.data.id ? result.data : item))
    error.value = ''
    toast.success('项目已保存')
  }

  async function archive() {
    const current = selected.value
    if (current === null) return
    const result = await api.archiveProject(current.id, current.revision, request.options)
    if (result.error !== null) {
      error.value = message(result.error)
      return
    }
    selectedId.value = null
    await load()
    toast.success('项目已归档')
  }

  async function showStatus(value: ProjectStatus) {
    status.value = value
    offset.value = 0
    selectedId.value = null
    creating.value = false
    await load()
  }

  async function page(direction: -1 | 1) {
    offset.value = Math.max(0, offset.value + direction * limit)
    selectedId.value = null
    await load()
  }

  onMounted(() => {
    void load()
  })

  return {
    items,
    total,
    offset,
    status,
    selected,
    creating,
    name,
    description,
    error,
    loading: request.loading,
    canManage,
    hasPrevious,
    hasNext,
    load,
    select,
    beginCreate,
    save,
    archive,
    showStatus,
    page,
  }
}
