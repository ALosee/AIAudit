<script setup lang="ts">
import { computed } from 'vue'

import { Button, ButtonLoading, Icon, Input } from '@jingwei/ui'

import type { Project } from '../../shared/index.js'
import { useDocumentManagement } from '../composables/use-document-management.js'
import { formatByteSize, formatDateTime, formatRelativeTime } from '../format.js'
import FilePicker from './FilePicker.vue'

const props = defineProps<{ project: Project }>()
const documents = useDocumentManagement(props.project.id)

const readOnly = computed(() => props.project.status === 'ARCHIVED')
</script>

<template>
  <div class="grid gap-5 pt-5 lg:grid-cols-[minmax(15rem,1fr)_minmax(20rem,1.7fr)]">
    <aside class="min-w-0">
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 class="m-0 text-sm font-semibold">项目文档</h3>
          <p class="m-0 mt-0.5 text-xs text-muted-foreground">
            共 {{ documents.documentTotal.value }} 份 · 保留每一次文件版本
          </p>
        </div>
      </div>
      <p
        v-if="documents.error.value"
        role="alert"
        class="m-0 mb-3 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
      >
        {{ documents.error.value }}
      </p>

      <form
        v-if="documents.canManage.value && !readOnly"
        class="mb-4 grid gap-2 rounded-lg border border-border p-3"
        @submit.prevent="documents.upload"
      >
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">文档名称</span>
          <Input
            v-model="documents.name.value"
            :maxlength="200"
            :disabled="documents.loading.value"
          />
        </label>
        <FilePicker
          :key="documents.fileInputRevision.value"
          :disabled="documents.loading.value"
          button-label="选择文件"
          hint="支持 PDF 或 DOCX"
          @change="documents.chooseFile"
        />
        <div>
          <ButtonLoading
            type="submit"
            size="sm"
            :loading="documents.loading.value"
            :disabled="documents.file.value === null || documents.name.value.trim() === ''"
          >
            上传文档
          </ButtonLoading>
        </div>
      </form>

      <p v-if="documents.items.value.length === 0" class="text-sm text-muted-foreground">
        这个项目还没有文档。
      </p>
      <ul v-else class="m-0 flex list-none flex-col gap-1.5">
        <li v-for="item in documents.items.value" :key="item.id">
          <button
            type="button"
            :disabled="documents.loading.value"
            class="w-full rounded-lg border border-border px-3 py-2.5 text-left transition-colors"
            :class="
              documents.selected.value?.id === item.id
                ? 'border-primary/30 bg-primary/10'
                : 'hover:bg-muted/50'
            "
            @click="documents.select(item)"
          >
            <span class="flex items-center gap-2">
              <Icon icon="lucide:file-text" class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="min-w-0 truncate text-sm font-medium">{{ item.name }}</span>
            </span>
            <span class="mt-1 block text-xs text-muted-foreground">
              最新第 {{ item.latestVersionNumber }} 版 · 更新于
              {{ formatRelativeTime(item.updatedAt) }}
            </span>
          </button>
        </li>
      </ul>
      <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {{ documents.documentTotal.value }} 份文档</span>
        <div class="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            :disabled="!documents.hasPreviousDocumentPage.value || documents.loading.value"
            @click="documents.pageDocuments(-1)"
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="!documents.hasNextDocumentPage.value || documents.loading.value"
            @click="documents.pageDocuments(1)"
          >
            下一页
          </Button>
        </div>
      </div>
    </aside>

    <div v-if="documents.selected.value" class="min-w-0">
      <div class="mb-4">
        <h3 class="m-0 text-sm font-semibold">{{ documents.selected.value.name }}</h3>
        <p class="m-0 mt-0.5 text-xs text-muted-foreground">
          版本时间线 · 每次上传生成不可覆盖的新版本
        </p>
      </div>

      <p v-if="documents.versions.value.length === 0" class="text-sm text-muted-foreground">
        暂无版本记录。
      </p>
      <ol v-else class="m-0 list-none border-l border-border pl-4">
        <li
          v-for="version in documents.versions.value"
          :key="version.id"
          class="relative pb-4 last:pb-0"
        >
          <span
            class="absolute -left-[1.36rem] top-1.5 size-2 rounded-full bg-primary"
            aria-hidden="true"
          />
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="m-0 text-sm font-medium">
                第 {{ version.versionNumber }} 版
                <span class="ml-2 text-xs font-normal text-muted-foreground">
                  {{ formatDateTime(version.createdAt) }}
                </span>
              </p>
              <p class="m-0 mt-1 truncate text-xs text-muted-foreground">
                {{ version.fileName }} · {{ formatByteSize(version.byteSize) }}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              :disabled="documents.loading.value"
              @click="documents.download(version.id)"
            >
              下载
            </Button>
          </div>
        </li>
      </ol>

      <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {{ documents.versionTotal.value }} 个版本</span>
        <div class="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            :disabled="!documents.hasPreviousVersionPage.value || documents.loading.value"
            @click="documents.pageVersions(-1)"
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="!documents.hasNextVersionPage.value || documents.loading.value"
            @click="documents.pageVersions(1)"
          >
            下一页
          </Button>
        </div>
      </div>

      <form
        v-if="documents.canManage.value && !readOnly"
        class="mt-6 border-t border-border pt-5"
        @submit.prevent="documents.uploadVersion"
      >
        <h4 class="m-0 text-sm font-semibold">上传新版本</h4>
        <p class="m-0 mt-1 text-xs text-muted-foreground">旧版本仍可下载，适合合同修订留痕。</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <FilePicker
            :key="documents.versionInputRevision.value"
            :disabled="documents.loading.value"
            button-label="选择新版本"
            hint="支持 PDF 或 DOCX"
            @change="documents.versionFile.value = $event as File | null"
          />
          <ButtonLoading
            type="submit"
            size="sm"
            :loading="documents.loading.value"
            :disabled="documents.versionFile.value === null"
          >
            上传新版本
          </ButtonLoading>
        </div>
      </form>
    </div>
    <div
      v-else
      class="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
    >
      选择文档查看历史版本。
    </div>
  </div>
</template>
