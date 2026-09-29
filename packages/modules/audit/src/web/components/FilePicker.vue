<script setup lang="ts">
import { ref } from 'vue'

import { Button, Icon } from '@jingwei/ui'

const props = withDefaults(
  defineProps<{
    accept?: string
    disabled?: boolean
    buttonLabel?: string
    hint?: string
  }>(),
  {
    accept: '.pdf,.docx',
    disabled: false,
    buttonLabel: '选择文件',
    hint: '支持 PDF 或 DOCX',
  },
)

const emit = defineEmits<{ change: [file: File | null] }>()

const input = ref<HTMLInputElement | null>(null)
const fileName = ref('')

function onChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.item(0) ?? null
  fileName.value = file?.name ?? ''
  emit('change', file)
}

function openPicker() {
  if (props.disabled) return
  input.value?.click()
}
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <input
      ref="input"
      type="file"
      class="sr-only"
      :accept="props.accept"
      :disabled="props.disabled"
      @change="onChange"
    />
    <Button
      type="button"
      size="sm"
      variant="outline"
      :disabled="props.disabled"
      @click="openPicker"
    >
      <Icon icon="lucide:paperclip" class="mr-1 size-3.5" />
      {{ props.buttonLabel }}
    </Button>
    <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
      {{ fileName || props.hint }}
    </span>
  </div>
</template>
