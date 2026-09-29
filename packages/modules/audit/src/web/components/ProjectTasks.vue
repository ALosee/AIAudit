<script setup lang="ts">
import { Button, Input, Textarea, dialog } from '@jingwei/ui'

import type { Project } from '../../shared/index.js'
import { useTaskManagement } from '../composables/use-task-management.js'

const props = defineProps<{ project: Project }>()
const tasks = useTaskManagement(props.project.id)

function selectedFile(event: Event): File | null {
  return (event.target as HTMLInputElement).files?.item(0) ?? null
}

function confirmUnbind(bindingId: string) {
  dialog.warning('从任务移除这份文档？', {
    description: '只撤销本任务的绑定，项目文件和历史版本仍会保留。',
    confirmText: '移除绑定',
    cancelText: '取消',
    onConfirm: () => void tasks.unbind(bindingId),
  })
}
</script>

<template>
  <section v-if="tasks.canView.value" class="mt-6 rounded-xl border border-border bg-card p-5">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="m-0 text-base font-semibold">审核任务</h2>
        <p class="mb-0 mt-1 text-sm text-muted-foreground">
          每项任务选择项目文档的确定版本，并指定文档在本次审核中的角色。
        </p>
      </div>
      <Button
        v-if="tasks.canManage.value && project.status === 'ACTIVE'"
        size="sm"
        :disabled="tasks.loading.value"
        @click="tasks.beginCreate"
        >新建任务</Button
      >
    </div>
    <p
      v-if="tasks.error.value"
      role="alert"
      class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ tasks.error.value }}
    </p>
    <div class="grid gap-5 lg:grid-cols-[minmax(16rem,1fr)_minmax(24rem,2fr)]">
      <div>
        <div class="mb-3 flex items-center justify-between text-sm">
          <span class="font-medium">任务列表</span
          ><span class="text-muted-foreground">{{ tasks.total.value }} 项</span>
        </div>
        <p v-if="tasks.items.value.length === 0" class="text-sm text-muted-foreground">
          这个项目还没有审核任务。
        </p>
        <div v-else class="flex flex-col gap-2">
          <button
            v-for="task in tasks.items.value"
            :key="task.id"
            type="button"
            class="rounded-lg border border-border p-3 text-left hover:bg-accent"
            :class="tasks.selected.value?.id === task.id ? 'bg-accent' : ''"
            @click="tasks.select(task)"
          >
            <span class="block font-medium">{{ task.name }}</span>
            <span class="mt-1 block text-xs text-muted-foreground">待配置</span>
            <span class="mt-1 block truncate text-xs text-muted-foreground">{{
              task.objective
            }}</span>
          </button>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span
            >第 {{ tasks.total.value === 0 ? 0 : tasks.offset.value + 1 }}–{{
              Math.min(tasks.offset.value + 50, tasks.total.value)
            }}
            项</span
          >
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!tasks.hasPrevious.value || tasks.loading.value"
              @click="tasks.page(-1)"
              >上一页</Button
            >
            <Button
              size="sm"
              variant="outline"
              :disabled="!tasks.hasNext.value || tasks.loading.value"
              @click="tasks.page(1)"
              >下一页</Button
            >
          </div>
        </div>
      </div>
      <div
        v-if="tasks.creating.value || tasks.selected.value"
        class="rounded-lg border border-border p-4"
      >
        <div class="mb-4 flex items-center justify-between gap-2">
          <h3 class="m-0 text-sm font-semibold">
            {{ tasks.creating.value ? '新建审核任务' : '任务详情' }}
          </h3>
          <span v-if="tasks.selected.value" class="text-xs text-muted-foreground"
            >版本 {{ tasks.selected.value.revision }}</span
          >
        </div>
        <form class="flex flex-col gap-3" @submit.prevent="tasks.save">
          <label class="flex flex-col gap-1 text-sm font-medium"
            >任务名称<Input
              v-model="tasks.name.value"
              :maxlength="200"
              :disabled="!tasks.canManage.value || project.status === 'ARCHIVED'"
          /></label>
          <label class="flex flex-col gap-1 text-sm font-medium"
            >审核目标<Textarea
              v-model="tasks.objective.value"
              :rows="3"
              :maxlength="2000"
              :disabled="!tasks.canManage.value || project.status === 'ARCHIVED'"
          /></label>
          <Button
            v-if="tasks.canManage.value && project.status === 'ACTIVE'"
            type="submit"
            size="sm"
            :disabled="tasks.loading.value"
            >{{ tasks.creating.value ? '创建任务' : '保存任务' }}</Button
          >
        </form>
        <template v-if="tasks.selected.value">
          <div class="mt-6 border-t border-border pt-4">
            <h4 class="m-0 text-sm font-semibold">本任务的文档输入</h4>
            <p class="mt-1 text-xs text-muted-foreground">
              版本与角色在绑定时固定。上传新版本不会自动替换已有输入。
            </p>
            <p v-if="tasks.bindings.value.length === 0" class="text-sm text-muted-foreground">
              尚未绑定文档。
            </p>
            <div
              v-for="binding in tasks.bindings.value"
              :key="binding.id"
              class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <div>
                <span class="font-medium">{{ binding.role }}</span
                ><span class="ml-2">{{ binding.documentName }}</span
                ><span class="ml-2 text-muted-foreground"
                  >第 {{ binding.versionNumber }} 版 · {{ binding.fileName }}</span
                >
              </div>
              <div class="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="tasks.loading.value"
                  @click="tasks.download(binding)"
                  >下载</Button
                >
                <Button
                  v-if="tasks.canManage.value && project.status === 'ACTIVE'"
                  size="sm"
                  variant="outline"
                  :disabled="tasks.loading.value"
                  @click="confirmUnbind(binding.id)"
                  >移除</Button
                >
              </div>
            </div>
          </div>
          <div
            v-if="tasks.canManage.value && project.status === 'ACTIVE'"
            class="mt-6 border-t border-border pt-4"
          >
            <div class="mb-3 flex items-center justify-between gap-2">
              <h4 class="m-0 text-sm font-semibold">从项目文档库添加</h4>
              <Button
                size="sm"
                variant="outline"
                :disabled="tasks.loading.value"
                @click="tasks.loadDocuments"
                >刷新文档</Button
              >
            </div>
            <form class="flex flex-col gap-3" @submit.prevent="tasks.bindExisting">
              <label class="flex flex-col gap-1 text-sm font-medium"
                >文档
                <select
                  :value="tasks.selectedDocumentId.value"
                  class="rounded-md border border-border bg-background p-2"
                  :disabled="tasks.loading.value"
                  @change="tasks.chooseDocument(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">选择项目文档</option>
                  <option
                    v-for="document in tasks.documents.value"
                    :key="document.id"
                    :value="document.id"
                  >
                    {{ document.name }}
                  </option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-sm font-medium"
                >固定版本
                <select
                  v-model="tasks.selectedVersionId.value"
                  class="rounded-md border border-border bg-background p-2"
                  :disabled="tasks.loading.value || !tasks.selectedDocumentId.value"
                >
                  <option value="">选择版本</option>
                  <option
                    v-for="version in tasks.versions.value"
                    :key="version.id"
                    :value="version.id"
                  >
                    第 {{ version.versionNumber }} 版 · {{ version.fileName }}
                  </option>
                </select>
              </label>
              <div
                v-if="tasks.selectedDocumentId.value"
                class="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>共 {{ tasks.versionTotal.value }} 个版本</span>
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="!tasks.hasPreviousVersionPage.value || tasks.loading.value"
                    @click="tasks.pageVersions(-1)"
                    >上一页</Button
                  >
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="!tasks.hasNextVersionPage.value || tasks.loading.value"
                    @click="tasks.pageVersions(1)"
                    >下一页</Button
                  >
                </div>
              </div>
              <label class="flex flex-col gap-1 text-sm font-medium"
                >本次审核中的角色<Input
                  v-model="tasks.role.value"
                  placeholder="例如：待审核合同、对照清单"
                  :maxlength="100"
                  :disabled="tasks.loading.value"
              /></label>
              <Button
                size="sm"
                type="submit"
                :disabled="tasks.loading.value || !tasks.selectedVersionId.value"
                >绑定文档版本</Button
              >
            </form>
            <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>项目库共 {{ tasks.documentTotal.value }} 份文档</span>
              <div class="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="!tasks.hasPreviousDocumentPage.value || tasks.loading.value"
                  @click="tasks.pageDocuments(-1)"
                  >上一页</Button
                ><Button
                  size="sm"
                  variant="outline"
                  :disabled="!tasks.hasNextDocumentPage.value || tasks.loading.value"
                  @click="tasks.pageDocuments(1)"
                  >下一页</Button
                >
              </div>
            </div>
          </div>
          <form
            v-if="tasks.canManage.value && tasks.canUpload.value && project.status === 'ACTIVE'"
            class="mt-6 flex flex-col gap-3 border-t border-border pt-4"
            @submit.prevent="tasks.uploadAndBind"
          >
            <div
              v-if="tasks.pendingBinding.value"
              class="rounded-lg border border-border bg-accent/40 p-3 text-sm"
            >
              <p class="m-0">
                {{ tasks.pendingBinding.value.documentName }} 已存入项目文档库，尚未绑定到任务。
              </p>
              <div class="mt-3 flex gap-2">
                <Button
                  size="sm"
                  type="button"
                  :disabled="tasks.loading.value"
                  @click="tasks.retryBinding"
                  >重新绑定现有版本</Button
                >
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  :disabled="tasks.loading.value"
                  @click="tasks.clearPending"
                  >仅保留在项目库</Button
                >
              </div>
            </div>
            <template v-else>
              <h4 class="m-0 text-sm font-semibold">上传并绑定新文档</h4>
              <p class="m-0 text-xs text-muted-foreground">
                上传后文件归入项目文档库，同时把首个版本绑定到当前任务。
              </p>
              <label class="flex flex-col gap-1 text-sm font-medium"
                >文档名称<Input
                  v-model="tasks.uploadName.value"
                  :maxlength="200"
                  :disabled="tasks.loading.value"
              /></label>
              <label class="flex flex-col gap-1 text-sm font-medium"
                >PDF 或 DOCX 文件<input
                  :key="tasks.fileInputRevision.value"
                  type="file"
                  accept=".pdf,.docx"
                  :disabled="tasks.loading.value"
                  @change="tasks.chooseFile(selectedFile($event))"
              /></label>
              <label class="flex flex-col gap-1 text-sm font-medium"
                >本次审核中的角色<Input
                  v-model="tasks.uploadRole.value"
                  placeholder="例如：待审核合同"
                  :maxlength="100"
                  :disabled="tasks.loading.value"
              /></label>
              <Button
                size="sm"
                type="submit"
                :disabled="tasks.loading.value || tasks.uploadFile.value === null"
                >上传并绑定</Button
              >
            </template>
          </form>
          <p class="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
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
  </section>
</template>
