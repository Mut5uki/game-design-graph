import type { RelationType } from '../types'

export const NODE_HANDLES = {
  leftIn: 'left-in',
  rightOut: 'right-out',
  topIn: 'top-in',
  bottomOut: 'bottom-out',
} as const

export const TARGET_HANDLE_ID = NODE_HANDLES.leftIn
export const SOURCE_HANDLE_ID = NODE_HANDLES.rightOut

export interface RelationPinMeta {
  type: RelationType
  label: string
  color: string
}

export const RELATION_OPTIONS: RelationPinMeta[] = [
  { type: 'requires', label: '依赖', color: '#3B82F6' },
  { type: 'triggers', label: '触发', color: '#8B5CF6' },
  { type: 'unlocks', label: '解锁', color: '#10B981' },
  { type: 'modifies', label: '修改', color: '#F59E0B' },
  { type: 'references', label: '引用', color: '#6B7280' },
  { type: 'blocks', label: '互斥', color: '#EF4444' },
]

const PIN_COLOR_MAP = new Map(RELATION_OPTIONS.map((p) => [p.type, p.color]))

export function getRelationPinColor(type: string): string {
  return PIN_COLOR_MAP.get(type as RelationType) ?? '#94A3B8'
}

export function parseRelationHandle(_handleId: string | null | undefined): RelationType {
  return 'requires'
}
