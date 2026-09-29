<script setup lang="ts">
import { Button, Input, Textarea, dialog } from '@jingwei/ui'

import ProjectDocuments from '../components/ProjectDocuments.vue'
import ProjectTasks from '../components/ProjectTasks.vue'
import { useProjectManagement } from '../composables/use-project-management.js'

const projects = useProjectManagement()

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
  <main class="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">AI 智能审核</p>
        <h1 class="m-0 text-2xl font-semibold">审核项目</h1>
        <p class="mb-0 mt-2 text-sm text-muted-foreground">按业务上下文组织审核工作。</p>
      </div>
      <Button
        v-if="projects.canManage.value"
        :disabled="projects.loading.value"
        @click="projects.beginCreate"
      >
        新建项目
      </Button>
    </header>

    <p
      v-if="projects.error.value"
      role="alert"
      class="m-0 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ projects.error.value }}
    </p>

    <div class="grid min-h-[30rem] gap-5 lg:grid-cols-[minmax(18rem,2fr)_minmax(20rem,3fr)]">
      <section class="rounded-xl border border-border bg-card p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="m-0 text-base font-semibold">项目列表</h2>
          <span class="text-sm text-muted-foreground">{{ projects.total.value }} 个</span>
        </div>
        <div class="mb-4 flex gap-2">
          <Button
            size="sm"
            :variant="projects.status.value === 'ACTIVE' ? 'solid' : 'outline'"
            :disabled="projects.loading.value"
            @click="projects.showStatus('ACTIVE')"
            >进行中</Button
          >
          <Button
            size="sm"
            :variant="projects.status.value === 'ARCHIVED' ? 'solid' : 'outline'"
            :disabled="projects.loading.value"
            @click="projects.showStatus('ARCHIVED')"
            >已归档</Button
          >
        </div>
        <p
          v-if="projects.loading.value && projects.items.value.length === 0"
          class="text-sm text-muted-foreground"
        >
          正在加载项目…
        </p>
        <p v-else-if="projects.items.value.length === 0" class="text-sm text-muted-foreground">
          这里还没有项目。
        </p>
        <div v-else class="flex flex-col gap-2">
          <button
            v-for="item in projects.items.value"
            :key="item.id"
            type="button"
            class="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
            :class="projects.selected.value?.id === item.id ? 'bg-accent' : ''"
            @click="projects.select(item)"
          >
            <span class="block font-medium">{{ item.name }}</span>
            <span class="mt-1 block truncate text-sm text-muted-foreground">{{
              item.description || '暂无描述'
            }}</span>
          </button>
        </div>
        <div class="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span class="text-xs text-muted-foreground"
            >第 {{ projects.total.value === 0 ? 0 : projects.offset.value + 1 }}–{{
              Math.min(projects.offset.value + 50, projects.total.value)
            }}
            项</span
          >
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!projects.hasPrevious.value || projects.loading.value"
              @click="projects.page(-1)"
              >上一页</Button
            >
            <Button
              size="sm"
              variant="outline"
              :disabled="!projects.hasNext.value || projects.loading.value"
              @click="projects.page(1)"
              >下一页</Button
            >
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-border bg-card p-5">
        <template v-if="projects.creating.value || projects.selected.value">
          <div class="mb-5 flex items-center justify-between gap-3">
            <h2 class="m-0 text-base font-semibold">
              {{ projects.creating.value ? '新建项目' : '项目资料' }}
            </h2>
            <span v-if="projects.selected.value" class="text-xs text-muted-foreground"
              >版本 {{ projects.selected.value.revision }}</span
            >
          </div>
          <form class="flex flex-col gap-4" @submit.prevent="projects.save">
            <label class="flex flex-col gap-2 text-sm font-medium">
              项目名称
              <Input
                v-model="projects.name.value"
                :maxlength="200"
                :disabled="
                  !projects.canManage.value || projects.selected.value?.status === 'ARCHIVED'
                "
              />
            </label>
            <label class="flex flex-col gap-2 text-sm font-medium">
              描述
              <Textarea
                v-model="projects.description.value"
                :rows="6"
                :maxlength="2000"
                :disabled="
                  !projects.canManage.value || projects.selected.value?.status === 'ARCHIVED'
                "
              />
            </label>
            <div
              v-if="
                projects.canManage.value &&
                (projects.creating.value || projects.selected.value?.status === 'ACTIVE')
              "
              class="flex flex-wrap gap-2"
            >
              <Button type="submit" :disabled="projects.loading.value">{{
                projects.creating.value ? '创建项目' : '保存修改'
              }}</Button>
              <Button
                v-if="projects.selected.value"
                type="button"
                variant="outline"
                :disabled="projects.loading.value"
                @click="confirmArchive"
                >归档项目</Button
              >
            </div>
          </form>
        </template>
        <div
          v-else
          class="flex h-full min-h-64 items-center justify-center text-sm text-muted-foreground"
        >
          选择一个项目查看详情，或创建新的审核项目。
        </div>
      </section>
    </div>
    <ProjectTasks
      v-if="projects.selected.value"
      :key="projects.selected.value.id"
      :project="projects.selected.value"
    />
    <ProjectDocuments
      v-if="projects.selected.value"
      :key="projects.selected.value.id"
      :project="projects.selected.value"
    />
  </main>
</template>
