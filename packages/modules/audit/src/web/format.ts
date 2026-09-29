export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} 天前`
  return formatDateTime(value)
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatPageRange(offset: number, limit: number, total: number): string {
  if (total === 0) return '第 0 项'
  const start = offset + 1
  const end = Math.min(offset + limit, total)
  return `第 ${start}–${end} 项`
}
