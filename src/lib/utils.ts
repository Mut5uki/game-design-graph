import { v4 as uuidv4 } from 'uuid'
import type { NodeType } from '@/domain/types'
import { getNodeMeta } from '@/domain/templates/nodeTemplates'

export function generateId(prefix = 'node'): string {
  return `${prefix}_${uuidv4().slice(0, 8)}`
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\u4e00-\u9fff]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'item'
}

export function createNodeId(type: NodeType, name: string, existingIds: Set<string>): string {
  const base = `${type}_${slugify(name)}`
  if (!existingIds.has(base)) return base
  let i = 2
  while (existingIds.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

export function createDefaultNodeFields(type: NodeType): Record<string, unknown> {
  return structuredClone(getNodeMeta(type).defaultFields)
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function tagsToString(tags: unknown): string {
  if (Array.isArray(tags)) return tags.join(', ')
  return ''
}
