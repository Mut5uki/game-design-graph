import type { DesignNode } from '../types'

export const COMMENT_DEFAULT_WIDTH = 420
export const COMMENT_DEFAULT_HEIGHT = 300
export const COMMENT_HEADER_HEIGHT = 32
export const COMMENT_MIN_WIDTH = 200
export const COMMENT_MIN_HEIGHT = 120

export const COMMENT_COLOR_PRESETS = [
  { id: 'blue', label: '蓝', bg: 'rgba(59, 130, 246, 0.07)', border: '#93C5FD', header: '#2563EB' },
  { id: 'green', label: '绿', bg: 'rgba(16, 185, 129, 0.07)', border: '#6EE7B7', header: '#059669' },
  { id: 'purple', label: '紫', bg: 'rgba(139, 92, 246, 0.07)', border: '#C4B5FD', header: '#7C3AED' },
  { id: 'amber', label: '琥珀', bg: 'rgba(245, 158, 11, 0.08)', border: '#FCD34D', header: '#D97706' },
  { id: 'gray', label: '灰', bg: 'rgba(107, 114, 128, 0.06)', border: '#D1D5DB', header: '#6B7280' },
] as const

export type CommentColorId = (typeof COMMENT_COLOR_PRESETS)[number]['id']

export function isCommentBlock(node: DesignNode): boolean {
  return node.type === 'group'
}

export function getCommentSize(node: DesignNode): { width: number; height: number } {
  return {
    width: Math.max(COMMENT_MIN_WIDTH, Number(node.fields.width) || COMMENT_DEFAULT_WIDTH),
    height: Math.max(COMMENT_MIN_HEIGHT, Number(node.fields.height) || COMMENT_DEFAULT_HEIGHT),
  }
}

export function getCommentColor(id: unknown) {
  const preset = COMMENT_COLOR_PRESETS.find((c) => c.id === id)
  return preset ?? COMMENT_COLOR_PRESETS[0]
}

export function nodeAbsolutePosition(node: DesignNode, nodes: DesignNode[]): { x: number; y: number } {
  if (!node.parentGroupId) return { ...node.position }
  const parent = nodes.find((n) => n.id === node.parentGroupId)
  if (!parent) return { ...node.position }
  return {
    x: parent.position.x + node.position.x,
    y: parent.position.y + node.position.y,
  }
}

export function relativeToGroup(
  absolute: { x: number; y: number },
  group: DesignNode,
): { x: number; y: number } {
  return {
    x: absolute.x - group.position.x,
    y: absolute.y - group.position.y,
  }
}

export function sortNodesForFlow(nodes: DesignNode[]): DesignNode[] {
  const groups = nodes.filter((n) => n.type === 'group')
  const rest = nodes.filter((n) => n.type !== 'group')
  return [...groups, ...rest]
}

/** 节点中心是否落在备注块内容区内 */
export function isNodeInsideGroup(
  node: DesignNode,
  group: DesignNode,
  nodes: DesignNode[],
): boolean {
  if (node.id === group.id || node.type === 'group') return false
  const abs = nodeAbsolutePosition(node, nodes)
  const { width, height } = getCommentSize(group)
  const cx = abs.x + 110
  const cy = abs.y + 36
  return (
    cx >= group.position.x + 8 &&
    cx <= group.position.x + width - 8 &&
    cy >= group.position.y + COMMENT_HEADER_HEIGHT + 8 &&
    cy <= group.position.y + height - 8
  )
}

export function findGroupContainingNode(
  node: DesignNode,
  nodes: DesignNode[],
): DesignNode | undefined {
  const groups = nodes.filter((n) => n.type === 'group')
  for (let i = groups.length - 1; i >= 0; i--) {
    if (isNodeInsideGroup(node, groups[i], nodes)) return groups[i]
  }
  return undefined
}
