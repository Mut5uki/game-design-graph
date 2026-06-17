import type { DesignNode } from '../types'

export const COMMENT_DEFAULT_WIDTH = 420
export const COMMENT_DEFAULT_HEIGHT = 300
export const COMMENT_MIN_WIDTH = 200
export const COMMENT_MIN_HEIGHT = 120

/** @deprecated 旧版顶栏高度，新样式不再使用 */
export const COMMENT_HEADER_HEIGHT = 0

export const COMMENT_COLOR_PRESETS = [
  {
    id: 'blue',
    label: '蓝',
    bg: 'rgba(59, 130, 246, 0.06)',
    border: 'rgba(59, 130, 246, 0.32)',
    borderMuted: 'rgba(59, 130, 246, 0.16)',
    title: 'rgba(37, 99, 235, 0.14)',
    header: '#2563EB',
  },
  {
    id: 'green',
    label: '绿',
    bg: 'rgba(16, 185, 129, 0.06)',
    border: 'rgba(16, 185, 129, 0.32)',
    borderMuted: 'rgba(16, 185, 129, 0.16)',
    title: 'rgba(5, 150, 105, 0.14)',
    header: '#059669',
  },
  {
    id: 'purple',
    label: '紫',
    bg: 'rgba(139, 92, 246, 0.06)',
    border: 'rgba(139, 92, 246, 0.32)',
    borderMuted: 'rgba(139, 92, 246, 0.16)',
    title: 'rgba(124, 58, 237, 0.14)',
    header: '#7C3AED',
  },
  {
    id: 'amber',
    label: '琥珀',
    bg: 'rgba(245, 158, 11, 0.07)',
    border: 'rgba(245, 158, 11, 0.32)',
    borderMuted: 'rgba(245, 158, 11, 0.16)',
    title: 'rgba(217, 119, 6, 0.15)',
    header: '#D97706',
  },
  {
    id: 'red',
    label: '红',
    bg: 'rgba(239, 68, 68, 0.06)',
    border: 'rgba(239, 68, 68, 0.32)',
    borderMuted: 'rgba(239, 68, 68, 0.16)',
    title: 'rgba(220, 38, 38, 0.14)',
    header: '#DC2626',
  },
  {
    id: 'pink',
    label: '粉',
    bg: 'rgba(244, 63, 94, 0.06)',
    border: 'rgba(244, 63, 94, 0.32)',
    borderMuted: 'rgba(244, 63, 94, 0.16)',
    title: 'rgba(225, 29, 72, 0.14)',
    header: '#E11D48',
  },
  {
    id: 'orange',
    label: '橙',
    bg: 'rgba(249, 115, 22, 0.07)',
    border: 'rgba(249, 115, 22, 0.32)',
    borderMuted: 'rgba(249, 115, 22, 0.16)',
    title: 'rgba(234, 88, 12, 0.15)',
    header: '#EA580C',
  },
  {
    id: 'yellow',
    label: '黄',
    bg: 'rgba(234, 179, 8, 0.08)',
    border: 'rgba(234, 179, 8, 0.34)',
    borderMuted: 'rgba(234, 179, 8, 0.18)',
    title: 'rgba(202, 138, 4, 0.16)',
    header: '#CA8A04',
  },
  {
    id: 'lime',
    label: '黄绿',
    bg: 'rgba(132, 204, 22, 0.07)',
    border: 'rgba(132, 204, 22, 0.32)',
    borderMuted: 'rgba(132, 204, 22, 0.16)',
    title: 'rgba(101, 163, 13, 0.15)',
    header: '#65A30D',
  },
  {
    id: 'teal',
    label: '青绿',
    bg: 'rgba(20, 184, 166, 0.06)',
    border: 'rgba(20, 184, 166, 0.32)',
    borderMuted: 'rgba(20, 184, 166, 0.16)',
    title: 'rgba(13, 148, 136, 0.14)',
    header: '#0D9488',
  },
  {
    id: 'cyan',
    label: '青',
    bg: 'rgba(6, 182, 212, 0.06)',
    border: 'rgba(6, 182, 212, 0.32)',
    borderMuted: 'rgba(6, 182, 212, 0.16)',
    title: 'rgba(8, 145, 178, 0.14)',
    header: '#0891B2',
  },
  {
    id: 'indigo',
    label: '靛',
    bg: 'rgba(99, 102, 241, 0.06)',
    border: 'rgba(99, 102, 241, 0.32)',
    borderMuted: 'rgba(99, 102, 241, 0.16)',
    title: 'rgba(79, 70, 229, 0.14)',
    header: '#4F46E5',
  },
  {
    id: 'gray',
    label: '灰',
    bg: 'rgba(100, 116, 139, 0.05)',
    border: 'rgba(100, 116, 139, 0.28)',
    borderMuted: 'rgba(100, 116, 139, 0.14)',
    title: 'rgba(71, 85, 105, 0.12)',
    header: '#64748B',
  },
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
    cy >= group.position.y + 8 &&
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
