import { Position, getBezierPath } from '@xyflow/react'
import type { DesignEdge, DesignNode } from '@/domain/types'
import { resolveFlowEdgeEndpoints, type ResolvedFlowEdgeEndpoints } from '@/lib/edgeParallel'
import type { FlowRect } from '@/collab/nodeBounds'

function handleSidePosition(handleId: string): Position {
  if (handleId.includes('left')) return Position.Left
  if (handleId.includes('right')) return Position.Right
  if (handleId.includes('top')) return Position.Top
  if (handleId.includes('bottom')) return Position.Bottom
  return Position.Right
}

function handlePointOnRect(
  bounds: FlowRect,
  handleId: string,
): { x: number; y: number; position: Position } {
  const { x, y, width, height } = bounds
  if (handleId.includes('left')) {
    return { x, y: y + height / 2, position: Position.Left }
  }
  if (handleId.includes('right')) {
    return { x: x + width, y: y + height / 2, position: Position.Right }
  }
  if (handleId.includes('top')) {
    return { x: x + width / 2, y, position: Position.Top }
  }
  if (handleId.includes('bottom')) {
    return { x: x + width / 2, y: y + height, position: Position.Bottom }
  }
  return { x: x + width, y: y + height / 2, position: Position.Right }
}

export interface DesignEdgePath {
  path: string
  labelX: number
  labelY: number
}

export function computeDesignEdgePath(
  edge: DesignEdge,
  nodes: DesignNode[],
  getBounds: (node: DesignNode) => FlowRect,
  endpointsMap: Map<string, ResolvedFlowEdgeEndpoints>,
): DesignEdgePath | null {
  const from = nodes.find((n) => n.id === edge.from)
  const to = nodes.find((n) => n.id === edge.to)
  if (!from || !to) return null

  const resolved = endpointsMap.get(edge.id)
  const sourceHandle = resolved?.sourceHandle ?? edge.sourceHandle ?? 'right-out'
  const targetHandle = resolved?.targetHandle ?? edge.targetHandle ?? 'left-in'
  const sourceDx = resolved?.sourceDx ?? 0
  const sourceDy = resolved?.sourceDy ?? 0
  const targetDx = resolved?.targetDx ?? 0
  const targetDy = resolved?.targetDy ?? 0
  const curvature = resolved?.curvature ?? 0.25

  const src = handlePointOnRect(getBounds(from), sourceHandle)
  const tgt = handlePointOnRect(getBounds(to), targetHandle)

  const [path, labelX, labelY] = getBezierPath({
    sourceX: src.x + sourceDx,
    sourceY: src.y + sourceDy,
    sourcePosition: handleSidePosition(sourceHandle),
    targetX: tgt.x + targetDx,
    targetY: tgt.y + targetDy,
    targetPosition: handleSidePosition(targetHandle),
    curvature,
  })

  return { path, labelX, labelY }
}

export function resolveEdgeEndpointsMap(
  edges: DesignEdge[],
  nodes: DesignNode[],
): Map<string, ResolvedFlowEdgeEndpoints> {
  return resolveFlowEdgeEndpoints(edges, nodes)
}
