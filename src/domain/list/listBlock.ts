import type { DesignNode, NodeType } from '../types'
import { generateId } from '@/lib/utils'

export type ListContentType = Exclude<NodeType, 'group' | 'list'>

export interface ListBlockItem {
  id: string
  name: string
  note?: string
  /** 行内横向微调（px），便于排版 */
  offsetX?: number
}

export function isListBlock(node: DesignNode): boolean {
  return node.type === 'list'
}

export function getListItems(node: DesignNode): ListBlockItem[] {
  if (!isListBlock(node)) return []
  const raw = node.fields.items
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is ListBlockItem => {
    return typeof x === 'object' && x != null && typeof (x as ListBlockItem).id === 'string'
  })
}

export function getListContentType(node: DesignNode): string {
  return String(node.fields.listType ?? 'ability')
}

export function createListItem(name = '新条目'): ListBlockItem {
  return { id: generateId('li'), name, offsetX: 0 }
}

export function listItemHandleId(itemId: string): string {
  return `item-${itemId}`
}

export function parseListItemHandleId(handleId: string | null | undefined): string | null {
  if (!handleId?.startsWith('item-')) return null
  return handleId.slice(5)
}

export const LIST_BLOCK_HANDLE = {
  input: 'in',
  output: 'out',
  leftOut: 'left-out',
  rightIn: 'right-in',
  top: 'top-in',
  topOut: 'top-out',
  bottom: 'bottom-out',
  bottomIn: 'bottom-in',
} as const
