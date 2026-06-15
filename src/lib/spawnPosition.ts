import type { DesignNode } from '@/domain/types'
import { nodeAbsolutePosition } from '@/domain/group/commentBlock'
import { DESIGN_NODE_LAYOUT_WIDTH } from '@/components/canvas/DesignNode'

const SPAWN_GAP_X = 80
const SPAWN_ROW_DY = 96

/** AI 或缺省占位 {0,0} 视为未指定位置 */
export function isUnsetNodePosition(pos?: { x: number; y: number } | null): boolean {
  if (!pos) return true
  return Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1
}

export function getNodeAbsolutePosition(node: DesignNode, allNodes: DesignNode[]): { x: number; y: number } {
  return nodeAbsolutePosition(node, allNodes)
}

/** 在源节点右侧（或左侧）生成新块，避免叠在源节点上 */
export function computeSpawnBesideNode(
  source: DesignNode,
  allNodes: DesignNode[],
  slotIndex = 0,
  side: 'right' | 'left' = 'right',
): { x: number; y: number } {
  const abs = nodeAbsolutePosition(source, allNodes)
  const dx = side === 'right' ? DESIGN_NODE_LAYOUT_WIDTH + SPAWN_GAP_X : -(DESIGN_NODE_LAYOUT_WIDTH + SPAWN_GAP_X)
  return {
    x: abs.x + dx,
    y: abs.y + slotIndex * SPAWN_ROW_DY,
  }
}

export function computeSpawnNearAnchor(
  anchor: { x: number; y: number },
  slotIndex = 0,
): { x: number; y: number } {
  return {
    x: anchor.x + DESIGN_NODE_LAYOUT_WIDTH + SPAWN_GAP_X + (slotIndex % 2) * 48,
    y: anchor.y + Math.floor(slotIndex / 2) * SPAWN_ROW_DY,
  }
}
