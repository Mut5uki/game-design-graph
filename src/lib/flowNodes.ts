import type { Edge, Node } from '@xyflow/react'
import type { DesignEdge, DesignNode, ImpactRole } from '@/domain/types'
import {
  getCommentSize,
  isCommentBlock,
  sortNodesForFlow,
} from '@/domain/group/commentBlock'
import type { CommentBlockData } from '@/components/canvas/CommentBlockNode'
import type { DesignNodeData } from '@/components/canvas/DesignNode'
import { buildInboundSummary } from '@/components/canvas/DesignNode'
import { DESIGN_NODE_HEIGHT, DESIGN_NODE_WIDTH } from '@/components/canvas/DesignNode'

export function buildFlowNodes(
  nodes: DesignNode[],
  edges: DesignEdge[],
  nodeNames: Map<string, string>,
  impactMap: Map<string, ImpactRole>,
  selectedNodeIds: string[],
): Node<DesignNodeData | CommentBlockData>[] {
  const sorted = sortNodesForFlow(nodes)

  return sorted.map((n) => {
    const selected = selectedNodeIds.includes(n.id)

    if (isCommentBlock(n)) {
      const { width, height } = getCommentSize(n)
      return {
        id: n.id,
        type: 'comment',
        position: n.position,
        data: {
          label: n.name,
          description: String(n.fields.description ?? ''),
          colorId: String(n.fields.color ?? 'blue'),
        },
        style: { width, height, zIndex: 0 },
        draggable: true,
        selectable: true,
        connectable: false,
        focusable: true,
        selected,
      }
    }

    return {
      id: n.id,
      type: 'design',
      position: n.position,
      parentId: n.parentGroupId,
      extent: n.parentGroupId ? ('parent' as const) : undefined,
      expandParent: false,
      data: {
        label: n.name,
        nodeType: n.type,
        inboundSummary: buildInboundSummary(n.id, edges, nodeNames),
        impactRole: impactMap.get(n.id),
        selected,
      },
      draggable: true,
      selectable: true,
      connectable: true,
      selected,
      zIndex: n.parentGroupId ? 1 : 0,
      width: DESIGN_NODE_WIDTH,
      height: DESIGN_NODE_HEIGHT,
    }
  })
}

export function buildFlowEdges(
  edges: DesignEdge[],
  nodes: DesignNode[],
  selectedEdgeId: string | null,
): Edge[] {
  const groupIds = new Set(nodes.filter(isCommentBlock).map((n) => n.id))

  return edges
    .filter((e) => !groupIds.has(e.from) && !groupIds.has(e.to))
    .map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'design',
      data: { relationType: e.relationType, label: e.label },
      selected: selectedEdgeId === e.id,
      zIndex: 2,
    }))
}
