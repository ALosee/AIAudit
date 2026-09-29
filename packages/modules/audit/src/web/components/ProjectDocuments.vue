<script setup lang="ts">
import { Button, Input } from '@jingwei/ui'

import type { Project } from '../../shared/index.js'
import { useDocumentManagement } from '../composables/use-document-management.js'

const props = defineProps<{ project: Project }>()
const documents = useDocumentManagement(props.project.id)

function selectedFile(event: Event): File | null {
  return (event.target as HTMLInputElement).files?.item(0) ?? null
}
</script>

<template>
  <section class="mt-6 rounded-xl border border-border bg-card p-5">
    <div class="mb-4">
      <h2 class="m-0 text-base font-semibold">项目文档</h2>
      <p class="mb-0 mt-1 text-sm text-muted-foreground">上传 PDF 或 DOCX，保留每一次文件版本。</p>
    </div>
    <p
      v-if="documents.error.value"
      role="alert"
      class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ documents.error.value }}
    </p>
    <form
      v-if="documents.canManage.value && project.status === 'ACTIVE'"
      class="mb-5 flex flex-wrap items-end gap-3"
      @submit.prevent="documents.upload"
    >
      <label class="flex min-w-48 flex-1 flex-col gap-2 text-sm font-medium">
        文档名称
        <Input
          v-model="documents.name.value"
          :maxlength="200"
          :disabled="documents.loading.value"
        />
      </label>
      <label class="flex flex-col gap-2 text-sm font-medium">
        选择文件
        <input
          :key="documents.fileInputRevision.value"
          type="file"
          accept=".pdf,.docx"
          :disabled="documents.loading.value"
          @change="documents.chooseFile(selectedFile($event))"
        />
      </label>
      <Button type="submit" :disabled="documents.loading.value || documents.file.value === null"
        >上传文档</Button
      >
    </form>
    <p v-if="documents.items.value.length === 0" class="text-sm text-muted-foreground">
      这个项目还没有文档。
    </p>
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <div class="flex flex-col gap-2">
        <button
          v-for="item in documents.items.value"
          :key="item.id"
          type="button"
          class="rounded-lg border border-border p-3 text-left hover:bg-accent"
          :class="documents.selected.value?.id === item.id ? 'bg-accent' : ''"
          @click="documents.select(item)"
        >
          <span class="block font-medium">{{ item.name }}</span>
          <span class="text-xs text-muted-foreground">{{ item.latestVersionNumber }} 个版本</span>
        </button>
        <div class="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span>共 {{ documents.documentTotal.value }} 份文档</span>
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!documents.hasPreviousDocumentPage.value || documents.loading.value"
              @click="documents.pageDocuments(-1)"
              >上一页</Button
            >
            <Button
              size="sm"
              variant="outline"
              :disabled="!documents.hasNextDocumentPage.value || documents.loading.value"
              @click="documents.pageDocuments(1)"
              >下一页</Button
            >
          </div>
        </div>
      </div>
      <div v-if="documents.selected.value" class="rounded-lg border border-border p-4">
        <h3 class="m-0 text-sm font-semibold">{{ documents.selected.value.name }} · 历史版本</h3>
        <div
          v-for="version in documents.versions.value"
          :key="version.id"
          class="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm"
        >
          <span class="min-w-0 truncate"
            >第 {{ version.versionNumber }} 版 · {{ version.fileName }}</span
          >
          <Button
            size="sm"
            variant="outline"
            :disabled="documents.loading.value"
            @click="documents.download(version.id)"
            >下载</Button
          >
        </div>
        <div class="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>共 {{ documents.versionTotal.value }} 个版本</span>
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!documents.hasPreviousVersionPage.value || documents.loading.value"
              @click="documents.pageVersions(-1)"
              >上一页</Button
            >
            <Button
              size="sm"
              variant="outline"
              :disabled="!documents.hasNextVersionPage.value || documents.loading.value"
              @click="documents.pageVersions(1)"
              >下一页</Button
            >
          </div>
        </div>
        <form
          v-if="documents.canManage.value && project.status === 'ACTIVE'"
          class="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4"
          @submit.prevent="documents.uploadVersion"
        >
          <input
            :key="documents.versionInputRevision.value"
            type="file"
            accept=".pdf,.docx"
            :disabled="documents.loading.value"
            @change="documents.versionFile.value = selectedFile($event)"
          />
          <Button
            type="submit"
            size="sm"
            :disabled="documents.loading.value || documents.versionFile.value === null"
            >上传新版本</Button
          >
        </form>
      </div>
    </div>
  </section>
</template>
