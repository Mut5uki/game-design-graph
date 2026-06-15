import type { Edge, Node } from '@xyflow/react'
import type { DesignEdge, DesignNode, ImpactRole } from '@/domain/types'
import {
  getCommentSize,
  isCommentBlock,
  sortNodesForFlow,
} from '@/domain/group/commentBlock'
import { getListItems, isListBlock } from '@/domain/list/listBlock'
import type { CommentBlockData } from '@/components/canvas/CommentBlockNode'
import type { DesignNodeData } from '@/components/canvas/DesignNode'
import type { ListBlockData } from '@/components/canvas/ListBlockNode'
import { NODE_HANDLES } from '@/domain/templates/relationPins'
import { buildInboundSummary } from '@/components/canvas/DesignNode'
import { resolveDefaultEdgeHandles } from '@/lib/edgeHandles'

export function buildFlowNodes(
  nodes: DesignNode[],
  edges: DesignEdge[],
  nodeNames: Map<string, string>,
  impactMap: Map<string, ImpactRole>,
  selectedNodeIds: string[],
): Node<DesignNodeData | CommentBlockData | ListBlockData>[] {
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

    if (isListBlock(n)) {
      return {
        id: n.id,
        type: 'list',
        position: n.position,
        parentId: n.parentGroupId,
        extent: n.parentGroupId ? ('parent' as const) : undefined,
        expandParent: false,
        data: {
          label: n.name,
          listType: String(n.fields.listType ?? 'ability'),
          items: getListItems(n),
          description: String(n.fields.description ?? ''),
        },
        draggable: true,
        selectable: true,
        connectable: true,
        selected,
        zIndex: n.parentGroupId ? 1 : 0,
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
      },
      draggable: true,
      selectable: true,
      connectable: true,
      selected,
      zIndex: n.parentGroupId ? 1 : 0,
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
    .map((e) => {
      const fromNode = nodes.find((n) => n.id === e.from)
      const toNode = nodes.find((n) => n.id === e.to)
      const handles =
        fromNode && toNode
          ? resolveDefaultEdgeHandles(fromNode, toNode, e.sourceHandle, e.targetHandle)
          : {
              sourceHandle: e.sourceHandle ?? NODE_HANDLES.rightOut,
              targetHandle: e.targetHandle ?? NODE_HANDLES.leftIn,
            }
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'design',
        data: {
          relationType: e.relationType,
          label: e.label,
          edgeId: e.id,
        },
        selected: selectedEdgeId === e.id,
        interactionWidth: 48,
        zIndex: 2,
      }
    })
}
