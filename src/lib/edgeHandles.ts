import type { DesignNode } from '@/domain/types'
import { isListBlock, LIST_BLOCK_HANDLE } from '@/domain/list/listBlock'
import { NODE_HANDLES } from '@/domain/templates/relationPins'

export function resolveDefaultEdgeHandles(
  fromNode: DesignNode,
  toNode: DesignNode,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): { sourceHandle: string; targetHandle: string } {
  return {
    sourceHandle:
      sourceHandle ??
      (isListBlock(fromNode) ? LIST_BLOCK_HANDLE.output : NODE_HANDLES.rightOut),
    targetHandle:
      targetHandle ??
      (isListBlock(toNode) ? LIST_BLOCK_HANDLE.input : NODE_HANDLES.leftIn),
  }
}
