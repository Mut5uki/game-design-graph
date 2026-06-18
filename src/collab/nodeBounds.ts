import type { DesignNode } from '@/domain/types'
import {
  getCommentSize,
  isCommentBlock,
  nodeAbsolutePosition,
} from '@/domain/group/commentBlock'
import { getListItems, isListBlock } from '@/domain/list/listBlock'
import {
  DESIGN_NODE_LAYOUT_HEIGHT,
  DESIGN_NODE_LAYOUT_WIDTH,
} from '@/components/canvas/DesignNode'

export interface FlowRect {
  x: number
  y: number
  width: number
  height: number
}

export function estimateNodeBounds(
  node: DesignNode,
  allNodes: DesignNode[],
  measured?: { width: number; height: number } | null,
): FlowRect {
  const abs = nodeAbsolutePosition(node, allNodes)
  if (measured && measured.width > 0 && measured.height > 0) {
    return { x: abs.x, y: abs.y, width: measured.width, height: measured.height }
  }
  if (isCommentBlock(node)) {
    const { width, height } = getCommentSize(node)
    return { x: abs.x, y: abs.y, width, height }
  }
  if (isListBlock(node)) {
    const items = getListItems(node)
    const height = 56 + Math.max(1, items.length) * 26
    return { x: abs.x, y: abs.y, width: 240, height: Math.min(height, 320) }
  }
  return {
    x: abs.x,
    y: abs.y,
    width: DESIGN_NODE_LAYOUT_WIDTH,
    height: DESIGN_NODE_LAYOUT_HEIGHT,
  }
}
