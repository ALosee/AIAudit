<script setup lang="ts">
import { computed } from 'vue'

import { Button, ButtonLoading, Icon, Input, Select, Textarea, dialog } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { Project } from '../../shared/index.js'
import { useTaskManagement } from '../composables/use-task-management.js'
import { formatRelativeTime } from '../format.js'
import FilePicker from './FilePicker.vue'

const props = defineProps<{ project: Project }>()
const tasks = useTaskManagement(props.project.id)

const NONE = '__none__'
const readOnly = computed(() => props.project.status === 'ARCHIVED')

const documentItems = computed<SelectSingleOptionData<string>[]>(() => [
  { value: NONE, label: '选择项目文档' },
  ...tasks.documents.value.map((item) => ({ value: item.id, label: item.name })),
])

const versionItems = computed<SelectSingleOptionData<string>[]>(() => [
  { value: NONE, label: tasks.versions.value.length === 0 ? '暂无版本' : '选择版本' },
  ...tasks.versions.value.map((version) => ({
    value: version.id,
    label: `第 ${version.versionNumber} 版 · ${version.fileName}`,
  })),
])

const selectedVersion = computed({
  get: () => tasks.selectedVersionId.value || NONE,
  set: (value: string | number) => {
    tasks.selectedVersionId.value = value === NONE ? '' : String(value)
  },
})

const canSaveTask = computed(
  () =>
    !tasks.loading.value && tasks.name.value.trim() !== '' && tasks.objective.value.trim() !== '',
)

function confirmUnbind(bindingId: string) {
  dialog.warning('从任务移除这份文档？', {
    description: '只撤销本任务的绑定，项目文件和历史版本仍会保留。',
    confirmText: '移除绑定',
    cancelText: '取消',
    onConfirm: () => void tasks.unbind(bindingId),
  })
}

function onDocumentChange(value: string | number) {
  void tasks.chooseDocument(value === NONE ? '' : String(value))
}
</script>

<template>
  <div
    v-if="tasks.canView.value"
    class="grid gap-5 pt-5 lg:grid-cols-[minmax(15rem,1fr)_minmax(20rem,1.7fr)]"
  >
    <aside class="min-w-0">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 class="m-0 text-sm font-semibold">任务列表</h3>
          <p class="m-0 mt-0.5 text-xs text-muted-foreground">{{ tasks.total.value }} 项</p>
        </div>
        <Button
          v-if="tasks.canManage.value && !readOnly"
          size="sm"
          :disabled="tasks.loading.value"
          @click="tasks.beginCreate"
        >
          新建任务
        </Button>
      </div>
      <p
        v-if="tasks.error.value"
        role="alert"
        class="m-0 mb-3 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
      >
        {{ tasks.error.value }}
      </p>
      <p v-if="tasks.items.value.length === 0" class="text-sm text-muted-foreground">
        这个项目还没有审核任务。
      </p>
      <ul v-else class="m-0 flex list-none flex-col gap-1.5">
        <li v-for="task in tasks.items.value" :key="task.id">
          <button
            type="button"
            :disabled="tasks.loading.value"
            class="w-full rounded-lg border border-border px-3 py-2.5 text-left transition-colors"
            :class="
              tasks.selected.value?.id === task.id
                ? 'border-primary/30 bg-primary/10'
                : 'hover:bg-muted/50'
            "
            @click="tasks.select(task)"
          >
            <span class="flex items-center gap-2">
              <span class="min-w-0 truncate text-sm font-medium">{{ task.name }}</span>
              <span
                class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                草稿
              </span>
            </span>
            <span class="mt-1 block truncate text-xs text-muted-foreground">
              {{ task.objective }}
            </span>
            <span class="mt-1 block text-[11px] text-muted-foreground">
              更新于 {{ formatRelativeTime(task.updatedAt) }}
            </span>
          </button>
        </li>
      </ul>
      <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          第
          {{ tasks.total.value === 0 ? 0 : tasks.offset.value + 1 }}–{{
            Math.min(tasks.offset.value + 50, tasks.total.value)
          }}
          项
        </span>
        <div class="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            :disabled="!tasks.hasPrevious.value || tasks.loading.value"
            @click="tasks.page(-1)"
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="!tasks.hasNext.value || tasks.loading.value"
            @click="tasks.page(1)"
          >
            下一页
          </Button>
        </div>
      </div>
    </aside>

    <div v-if="tasks.creating.value || tasks.selected.value" class="min-w-0">
      <div class="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 class="m-0 text-sm font-semibold">
            {{ tasks.creating.value ? '新建审核任务' : '任务详情' }}
          </h3>
          <p v-if="tasks.selected.value" class="m-0 mt-0.5 text-xs text-muted-foreground">
            版本 {{ tasks.selected.value.revision }}
          </p>
        </div>
      </div>

      <form class="grid gap-3" @submit.prevent="tasks.save">
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">任务名称</span>
          <Input
            v-model="tasks.name.value"
            :maxlength="200"
            :disabled="tasks.loading.value || readOnly || !tasks.canManage.value"
            placeholder="例如：主合同条款一致性审核"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">审核目标</span>
          <Textarea
            v-model="tasks.objective.value"
            :rows="3"
            :maxlength="2000"
            :disabled="tasks.loading.value || readOnly || !tasks.canManage.value"
            placeholder="描述本次审核要核对的范围与判定标准"
          />
        </label>
        <div v-if="tasks.canManage.value && !readOnly">
          <ButtonLoading
            type="submit"
            size="sm"
            variant="solid"
            :loading="tasks.loading.value"
            :disabled="!canSaveTask"
          >
            {{ tasks.creating.value ? '创建任务' : '保存任务' }}
          </ButtonLoading>
        </div>
      </form>

      <template v-if="tasks.selected.value">
        <section class="mt-6 border-t border-border pt-5">
          <h4 class="m-0 text-sm font-semibold">本任务的文档输入</h4>
          <p class="m-0 mt-1 text-xs text-muted-foreground">
            版本与角色在绑定时固定。上传新版本不会自动替换已有输入。
          </p>
          <p v-if="tasks.bindings.value.length === 0" class="mt-3 text-sm text-muted-foreground">
            尚未绑定文档。
          </p>
          <ul v-else class="m-0 mt-3 flex list-none flex-col gap-2">
            <li
              v-for="binding in tasks.bindings.value"
              :key="binding.id"
              class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
            >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                    {{ binding.role }}
                  </span>
                  <span class="min-w-0 truncate text-sm font-medium">{{
                    binding.documentName
                  }}</span>
                </div>
                <p class="m-0 mt-1 truncate text-xs text-muted-foreground">
                  第 {{ binding.versionNumber }} 版 · {{ binding.fileName }}
                </p>
              </div>
              <div class="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="tasks.loading.value"
                  @click="tasks.download(binding)"
                >
                  下载
                </Button>
                <Button
                  v-if="tasks.canManage.value && !readOnly"
                  size="sm"
                  variant="ghost"
                  color="destructive"
                  :disabled="tasks.loading.value"
                  @click="confirmUnbind(binding.id)"
                >
                  移除
                </Button>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="tasks.canManage.value && !readOnly" class="mt-6 border-t border-border pt-5">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h4 class="m-0 text-sm font-semibold">从项目文档库添加</h4>
            <Button
              size="sm"
              variant="ghost"
              :disabled="tasks.loading.value"
              @click="tasks.loadDocuments"
            >
              刷新文档
            </Button>
          </div>
          <form class="grid gap-3" @submit.prevent="tasks.bindExisting">
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">文档</span>
              <Select
                :model-value="tasks.selectedDocumentId.value || NONE"
                :items="documentItems"
                :disabled="tasks.loading.value"
                @update:model-value="onDocumentChange"
              />
            </label>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">固定版本</span>
              <Select
                v-model="selectedVersion"
                :items="versionItems"
                :disabled="tasks.loading.value || !tasks.selectedDocumentId.value"
              />
            </label>
            <div
              v-if="tasks.selectedDocumentId.value"
              class="flex items-center justify-between text-xs text-muted-foreground"
            >
              <span>共 {{ tasks.versionTotal.value }} 个版本</span>
              <div class="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="!tasks.hasPreviousVersionPage.value || tasks.loading.value"
                  @click="tasks.pageVersions(-1)"
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="!tasks.hasNextVersionPage.value || tasks.loading.value"
                  @click="tasks.pageVersions(1)"
                >
                  下一页
                </Button>
              </div>
            </div>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">本次审核中的角色</span>
              <Input
                v-model="tasks.role.value"
                placeholder="例如：待审核合同、对照清单"
                :maxlength="100"
                :disabled="tasks.loading.value"
              />
            </label>
            <div>
              <ButtonLoading
                type="submit"
                size="sm"
                :loading="tasks.loading.value"
                :disabled="!tasks.selectedVersionId.value || tasks.role.value.trim() === ''"
              >
                绑定文档版本
              </ButtonLoading>
            </div>
          </form>
          <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>项目库共 {{ tasks.documentTotal.value }} 份文档</span>
            <div class="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                :disabled="!tasks.hasPreviousDocumentPage.value || tasks.loading.value"
                @click="tasks.pageDocuments(-1)"
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                :disabled="!tasks.hasNextDocumentPage.value || tasks.loading.value"
                @click="tasks.pageDocuments(1)"
              >
                下一页
              </Button>
            </div>
          </div>
        </section>

        <section
          v-if="tasks.canManage.value && tasks.canUpload.value && !readOnly"
          class="mt-6 border-t border-border pt-5"
        >
          <div
            v-if="tasks.pendingBinding.value"
            class="rounded-lg border border-border bg-accent/40 p-3 text-sm"
          >
            <p class="m-0">
              {{ tasks.pendingBinding.value.documentName }} 已存入项目文档库，尚未绑定到任务。
            </p>
            <div class="mt-3 flex gap-2">
              <Button size="sm" :disabled="tasks.loading.value" @click="tasks.retryBinding">
                重新绑定现有版本
              </Button>
              <Button
                size="sm"
                variant="outline"
                :disabled="tasks.loading.value"
                @click="tasks.clearPending"
              >
                仅保留在项目库
              </Button>
            </div>
          </div>
          <form v-else class="grid gap-3" @submit.prevent="tasks.uploadAndBind">
            <div>
              <h4 class="m-0 text-sm font-semibold">上传并绑定新文档</h4>
              <p class="m-0 mt-1 text-xs text-muted-foreground">
                上传后文件归入项目文档库，同时把首个版本绑定到当前任务。
              </p>
            </div>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">文档名称</span>
              <Input
                v-model="tasks.uploadName.value"
                :maxlength="200"
                :disabled="tasks.loading.value"
              />
            </label>
            <div class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">PDF 或 DOCX 文件</span>
              <FilePicker
                :key="tasks.fileInputRevision.value"
                :disabled="tasks.loading.value"
                button-label="选择文件"
                hint="支持 PDF 或 DOCX，最大 20 MB"
                @change="tasks.chooseFile"
              />
            </div>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">本次审核中的角色</span>
              <Input
                v-model="tasks.uploadRole.value"
                placeholder="例如：待审核合同"
                :maxlength="100"
                :disabled="tasks.loading.value"
              />
            </label>
            <div>
              <ButtonLoading
                type="submit"
                size="sm"
                :loading="tasks.loading.value"
                :disabled="tasks.uploadFile.value === null"
              >
                上传并绑定
              </ButtonLoading>
            </div>
          </form>
        </section>

        <p
          class="mt-6 flex items-start gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground"
        >
          <Icon icon="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
          当前阶段仅配置任务和文档输入；审核计划、解析、规则与运行尚未接入。
        </p>
      </template>
    </div>
    <div
      v-else
      class="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
    >
      选择任务查看输入，或创建新的审核任务。
    </div>
  </div>
</template>
