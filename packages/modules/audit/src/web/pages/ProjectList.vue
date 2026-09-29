<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  Button,
  ButtonLoading,
  Input,
  ManagementListToolbar,
  ManagementWorkspace,
  Segment,
  Tabs,
  Textarea,
  dialog,
} from '@jingwei/ui'
import type { SegmentOptionData, TabsOptionData } from '@jingwei/ui'

import type { ProjectStatus } from '../../shared/index.js'
import ProjectDocuments from '../components/ProjectDocuments.vue'
import ProjectTasks from '../components/ProjectTasks.vue'
import { useProjectManagement } from '../composables/use-project-management.js'
import { formatDateTime, formatPageRange, formatRelativeTime } from '../format.js'

const projects = useProjectManagement()
const mobileDetailOpen = ref(false)
const detailTab = ref<'overview' | 'tasks' | 'documents'>('overview')

const statusTabs: SegmentOptionData<ProjectStatus>[] = [
  { value: 'ACTIVE', label: '进行中' },
  { value: 'ARCHIVED', label: '已归档' },
]

const detailTabs = computed<TabsOptionData[]>(() => {
  if (projects.creating.value || projects.selected.value === null) {
    return [{ value: 'overview', label: projects.creating.value ? '新建项目' : '概览' }]
  }
  return [
    { value: 'overview', label: '概览' },
    { value: 'tasks', label: '审核任务' },
    { value: 'documents', label: '项目文档' },
  ]
})

const statusFilter = computed({
  get: () => projects.status.value,
  set: (value: ProjectStatus) => {
    void projects.showStatus(value)
  },
})

const canEditSelected = computed(() => {
  const project = projects.selected.value
  return projects.canManage.value && (projects.creating.value || project?.status === 'ACTIVE')
})

watch(
  () => (projects.creating.value ? 'create' : (projects.selected.value?.id ?? '')),
  () => {
    detailTab.value = 'overview'
  },
)

function onSelect(id: string) {
  if (projects.loading.value) return
  const project = projects.items.value.find((item) => item.id === id)
  if (project === undefined) return
  projects.select(project)
  mobileDetailOpen.value = true
}

function onBeginCreate() {
  if (projects.loading.value) return
  projects.beginCreate()
  mobileDetailOpen.value = true
}

function onCancelCreate() {
  projects.cancelCreate()
  mobileDetailOpen.value = false
}

function confirmArchive() {
  if (projects.selected.value === null) return
  dialog.warning('归档这个项目？', {
    description: '归档后项目将保留历史记录，不能继续编辑。',
    confirmText: '归档项目',
    cancelText: '取消',
    onConfirm: () => void projects.archive(),
  })
}
</script>

<template>
  <ManagementWorkspace
    title="审核项目"
    :mobile-detail-open="mobileDetailOpen"
    @back="mobileDetailOpen = false"
  >
    <template v-if="projects.error.value" #notice>
      <p
        role="alert"
        class="m-0 shrink-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
      >
        {{ projects.error.value }}
      </p>
    </template>

    <template #list>
      <section class="flex h-full min-h-0 flex-col">
        <ManagementListToolbar
          v-model="projects.search.value"
          title="项目列表"
          :summary="`${projects.total.value} 个项目`"
          search-label="搜索项目"
          search-placeholder="搜索项目名称或描述"
          create-label="新建项目"
          :can-create="projects.canManage.value"
          :busy="projects.loading.value"
          @create="onBeginCreate"
        />
        <div class="shrink-0 border-b border-border px-2 py-2">
          <Segment v-model="statusFilter" :items="statusTabs" size="sm" fill="full" />
        </div>
        <ul class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
          <li v-for="item in projects.filteredItems.value" :key="item.id">
            <button
              type="button"
              :disabled="projects.loading.value"
              class="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="
                item.id === projects.selected.value?.id && !projects.creating.value
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/60'
              "
              @click="onSelect(item.id)"
            >
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="min-w-0 truncate text-sm font-medium">{{ item.name }}</span>
                  <span
                    class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                    :class="
                      item.status === 'ACTIVE'
                        ? 'bg-success/12 text-success'
                        : 'bg-muted text-muted-foreground'
                    "
                  >
                    {{ item.status === 'ACTIVE' ? '进行中' : '已归档' }}
                  </span>
                </span>
                <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                  {{ item.description || '暂无描述' }}
                </span>
                <span class="mt-1 block text-[11px] text-muted-foreground">
                  更新于 {{ formatRelativeTime(item.updatedAt) }}
                </span>
              </span>
            </button>
          </li>
          <li
            v-if="projects.filteredItems.value.length === 0"
            class="grid place-items-center gap-2 px-3 py-10 text-center"
          >
            <p class="m-0 text-sm text-muted-foreground">
              {{ projects.search.value ? '没有匹配的项目' : '这里还没有项目' }}
            </p>
            <Button
              v-if="!projects.search.value && projects.canManage.value"
              size="sm"
              @click="onBeginCreate"
            >
              新建项目
            </Button>
          </li>
        </ul>
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          <span
            >{{ formatPageRange(projects.offset.value, projects.pageSize, projects.total.value) }} ·
            共 {{ projects.total.value }} 个</span
          >
          <div class="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              :disabled="!projects.hasPrevious.value || projects.loading.value"
              @click="projects.page(-1)"
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="!projects.hasNext.value || projects.loading.value"
              @click="projects.page(1)"
            >
              下一页
            </Button>
          </div>
        </div>
      </section>
    </template>

    <template #detail>
      <section
        v-if="projects.creating.value || projects.selected.value"
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <header
          class="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-2"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="m-0 truncate text-base font-semibold">
                {{ projects.creating.value ? '新建项目' : projects.selected.value?.name }}
              </h2>
              <span
                v-if="projects.selected.value"
                class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                :class="
                  projects.selected.value.status === 'ACTIVE'
                    ? 'bg-success/12 text-success'
                    : 'bg-muted text-muted-foreground'
                "
              >
                {{ projects.selected.value.status === 'ACTIVE' ? '进行中' : '已归档' }}
              </span>
            </div>
            <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">
              <template v-if="projects.creating.value"> 创建后即可配置审核任务与文档 </template>
              <template v-else>
                更新于 {{ formatDateTime(projects.selected.value?.updatedAt) }} · 版本
                {{ projects.selected.value?.revision }}
              </template>
            </p>
          </div>
          <template v-if="projects.canManage.value">
            <template v-if="projects.creating.value">
              <Button variant="ghost" @click="onCancelCreate">取消</Button>
              <ButtonLoading
                :loading="projects.loading.value"
                :disabled="projects.name.value.trim() === ''"
                @click="projects.save"
              >
                创建项目
              </ButtonLoading>
            </template>
            <template v-else-if="projects.selected.value?.status === 'ACTIVE'">
              <Button color="destructive" variant="ghost" @click="confirmArchive">归档</Button>
              <ButtonLoading
                :loading="projects.loading.value"
                :disabled="projects.name.value.trim() === ''"
                @click="projects.save"
              >
                保存修改
              </ButtonLoading>
            </template>
          </template>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Tabs v-model="detailTab" :items="detailTabs" fill="auto">
            <template #content="{ value }">
              <div v-if="value === 'overview'" class="max-w-3xl pt-5">
                <div
                  v-if="projects.selected.value?.status === 'ARCHIVED'"
                  class="mb-5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                >
                  项目已归档，资料只读。历史任务与文档仍可查看。
                </div>
                <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="projects.save">
                  <label class="grid gap-1.5 text-sm sm:col-span-2">
                    <span class="text-muted-foreground">项目名称</span>
                    <Input
                      v-model="projects.name.value"
                      :maxlength="200"
                      :disabled="!canEditSelected"
                      placeholder="例如：2026 年度供应商合同审查"
                    />
                  </label>
                  <label class="grid gap-1.5 text-sm sm:col-span-2">
                    <span class="text-muted-foreground">描述</span>
                    <Textarea
                      v-model="projects.description.value"
                      :rows="5"
                      :maxlength="2000"
                      :disabled="!canEditSelected"
                      placeholder="说明业务背景、审核范围或协作方式"
                    />
                  </label>
                </form>
                <dl
                  v-if="projects.selected.value"
                  class="m-0 mt-8 grid gap-x-6 gap-y-4 border-t border-border pt-5 text-sm sm:grid-cols-2"
                >
                  <div>
                    <dt class="text-xs text-muted-foreground">状态</dt>
                    <dd class="m-0 mt-1">
                      {{ projects.selected.value.status === 'ACTIVE' ? '进行中' : '已归档' }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted-foreground">乐观锁版本</dt>
                    <dd class="m-0 mt-1">revision {{ projects.selected.value.revision }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted-foreground">创建时间</dt>
                    <dd class="m-0 mt-1">
                      {{ formatDateTime(projects.selected.value.createdAt) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted-foreground">最近更新</dt>
                    <dd class="m-0 mt-1">
                      {{ formatDateTime(projects.selected.value.updatedAt) }}
                    </dd>
                  </div>
                </dl>
              </div>
              <ProjectTasks
                v-else-if="value === 'tasks' && projects.selected.value"
                :key="`tasks-${projects.selected.value.id}`"
                :project="projects.selected.value"
              />
              <ProjectDocuments
                v-else-if="value === 'documents' && projects.selected.value"
                :key="`documents-${projects.selected.value.id}`"
                :project="projects.selected.value"
              />
            </template>
          </Tabs>
        </div>
      </section>
      <div
        v-else
        class="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground"
      >
        选择左侧项目，或新建审核项目
      </div>
    </template>
  </ManagementWorkspace>
</template>
