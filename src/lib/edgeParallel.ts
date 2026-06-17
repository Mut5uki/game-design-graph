import { Position } from '@xyflow/react'
import type { DesignEdge, DesignNode } from '@/domain/types'
import { resolveDefaultEdgeHandles } from '@/lib/edgeHandles'

/** 完全重合的重复连线之间的垂直/水平间距（像素） */
export const PARALLEL_SPACING = 22

export interface ResolvedFlowEdgeEndpoints {
  sourceHandle: string
  targetHandle: string
  sourceDx: number
  sourceDy: number
  targetDx: number
  targetDy: number
  curvature: number
}

function handleSidePosition(handleId: string): Position {
  if (handleId.includes('left')) return Position.Left
  if (handleId.includes('right')) return Position.Right
  if (handleId.includes('top')) return Position.Top
  if (handleId.includes('bottom')) return Position.Bottom
  return Position.Right
}

function perpendicularShift(
  position: Position,
  index: number,
  total: number,
  spacing: number,
): { dx: number; dy: number } {
  if (total <= 1) return { dx: 0, dy: 0 }
  const centered = index - (total - 1) / 2
  const amount = centered * spacing
  switch (position) {
    case Position.Left:
    case Position.Right:
      return { dx: 0, dy: amount }
    case Position.Top:
    case Position.Bottom:
      return { dx: amount, dy: 0 }
    default:
      return { dx: 0, dy: 0 }
  }
}

function indexInGroup(groupIds: string[], edgeId: string): { index: number; total: number } {
  const sorted = [...groupIds].sort()
  return { index: sorted.indexOf(edgeId), total: sorted.length }
}

/**
 * 为画布连线解析展示用针脚。
 * 同一节点扇出到多个目标时共用同一锚点；仅当两端完全重合的重复连线才施加偏移。
 */
export function resolveFlowEdgeEndpoints(
  edges: DesignEdge[],
  nodes: DesignNode[],
): Map<string, ResolvedFlowEdgeEndpoints> {
  const result = new Map<string, ResolvedFlowEdgeEndpoints>()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const finalHandles = new Map<string, { sourceHandle: string; targetHandle: string }>()
  for (const e of edges) {
    const fromNode = nodeMap.get(e.from)
    const toNode = nodeMap.get(e.to)
    if (!fromNode || !toNode) continue
    finalHandles.set(e.id, resolveDefaultEdgeHandles(fromNode, toNode, e.sourceHandle, e.targetHandle))
  }

  const pairGroups = new Map<string, string[]>()

  for (const e of edges) {
    const h = finalHandles.get(e.id)
    if (!h) continue
    const pk = `${e.from}|${e.to}|${h.sourceHandle}|${h.targetHandle}`
    pairGroups.set(pk, [...(pairGroups.get(pk) ?? []), e.id])
  }

  for (const e of edges) {
    const h = finalHandles.get(e.id)
    if (!h) continue

    const pairG =
      pairGroups.get(`${e.from}|${e.to}|${h.sourceHandle}|${h.targetHandle}`) ?? [e.id]
    const pairIdx = indexInGroup(pairG, e.id)

    const duplicatePair = pairIdx.total > 1
    const srcShift = duplicatePair
      ? perpendicularShift(
          handleSidePosition(h.sourceHandle),
          pairIdx.index,
          pairIdx.total,
          PARALLEL_SPACING,
        )
      : { dx: 0, dy: 0 }
    const tgtShift = duplicatePair
      ? perpendicularShift(
          handleSidePosition(h.targetHandle),
          pairIdx.index,
          pairIdx.total,
          PARALLEL_SPACING,
        )
      : { dx: 0, dy: 0 }

    let curvature = 0.25
    if (duplicatePair) {
      curvature = 0.25 + (pairIdx.index - (pairIdx.total - 1) / 2) * 0.16
    }

    result.set(e.id, {
      sourceHandle: h.sourceHandle,
      targetHandle: h.targetHandle,
      sourceDx: srcShift.dx,
      sourceDy: srcShift.dy,
      targetDx: tgtShift.dx,
      targetDy: tgtShift.dy,
      curvature,
    })
  }

  return result
}
