import type { RelationType } from '../types'

export { getRelationOptions, getRelationPinColor, type RelationPinMeta } from './relationTypeRegistry'

export const NODE_HANDLES = {
  leftIn: 'left-in',
  leftOut: 'left-out',
  rightIn: 'right-in',
  rightOut: 'right-out',
  topIn: 'top-in',
  topOut: 'top-out',
  bottomIn: 'bottom-in',
  bottomOut: 'bottom-out',
} as const

export const TARGET_HANDLE_ID = NODE_HANDLES.leftIn
export const SOURCE_HANDLE_ID = NODE_HANDLES.rightOut

export function parseRelationHandle(_handleId: string | null | undefined): RelationType {
  return 'requires'
}
