import { Position } from '@xyflow/react'
import type { DesignEdge, DesignNode } from '@/domain/types'
import { isListBlock } from '@/domain/list/listBlock'
import { NODE_HANDLES } from '@/domain/templates/relationPins'
import { resolveDefaultEdgeHandles } from '@/lib/edgeHandles'

/** 同一针脚多条连线时的垂直/水平间距（像素） */
export const PARALLEL_SPACING = 22

const SOURCE_HANDLE_CYCLE = [
  NODE_HANDLES.rightOut,
  NODE_HANDLES.topOut,
  NODE_HANDLES.bottomOut,
  NODE_HANDLES.leftOut,
] as const

const TARGET_HANDLE_CYCLE = [
  NODE_HANDLES.leftIn,
  NODE_HANDLES.topIn,
  NODE_HANDLES.bottomIn,
  NODE_HANDLES.rightIn,
] as const

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

function stableSortEdges(list: DesignEdge[]): DesignEdge[] {
  return [...list].sort((a, b) => {
    const byPeer = a.to.localeCompare(b.to)
    if (byPeer !== 0) return byPeer
    return a.id.localeCompare(b.id)
  })
}

function indexInGroup(groupIds: string[], edgeId: string): { index: number; total: number } {
  const sorted = [...groupIds].sort()
  return { index: sorted.indexOf(edgeId), total: sorted.length }
}

/**
 * 为画布连线解析展示用针脚，并在仍共用同一针脚时施加路径偏移，避免热区重叠。
 */
export function resolveFlowEdgeEndpoints(
  edges: DesignEdge[],
  nodes: DesignNode[],
): Map<string, ResolvedFlowEdgeEndpoints> {
  const result = new Map<string, ResolvedFlowEdgeEndpoints>()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const baseHandles = new Map<string, { sourceHandle: string; targetHandle: string }>()
  for (const e of edges) {
    const fromNode = nodeMap.get(e.from)
    const toNode = nodeMap.get(e.to)
    if (!fromNode || !toNode) continue
    baseHandles.set(
      e.id,
      resolveDefaultEdgeHandles(fromNode, toNode, e.sourceHandle, e.targetHandle),
    )
  }

  const distributedSource = new Map<string, string>()
  const implicitSourceByNode = new Map<string, DesignEdge[]>()
  for (const e of edges) {
    if (e.sourceHandle) continue
    const from = nodeMap.get(e.from)
    if (!from || isListBlock(from)) continue
    const list = implicitSourceByNode.get(e.from) ?? []
    list.push(e)
    implicitSourceByNode.set(e.from, list)
  }
  for (const [, group] of implicitSourceByNode) {
    const sorted = stableSortEdges(group)
    if (sorted.length <= 1) continue
    sorted.forEach((e, i) => {
      distributedSource.set(e.id, SOURCE_HANDLE_CYCLE[i % SOURCE_HANDLE_CYCLE.length])
    })
  }

  const distributedTarget = new Map<string, string>()
  const implicitTargetByNode = new Map<string, DesignEdge[]>()
  for (const e of edges) {
    if (e.targetHandle) continue
    const to = nodeMap.get(e.to)
    if (!to || isListBlock(to)) continue
    const list = implicitTargetByNode.get(e.to) ?? []
    list.push(e)
    implicitTargetByNode.set(e.to, list)
  }
  for (const [, group] of implicitTargetByNode) {
    const sorted = stableSortEdges(group)
    if (sorted.length <= 1) continue
    sorted.forEach((e, i) => {
      distributedTarget.set(e.id, TARGET_HANDLE_CYCLE[i % TARGET_HANDLE_CYCLE.length])
    })
  }

  const finalHandles = new Map<string, { sourceHandle: string; targetHandle: string }>()
  for (const e of edges) {
    const base = baseHandles.get(e.id)
    if (!base) continue
    finalHandles.set(e.id, {
      sourceHandle: distributedSource.get(e.id) ?? base.sourceHandle,
      targetHandle: distributedTarget.get(e.id) ?? base.targetHandle,
    })
  }

  const sourceGroups = new Map<string, string[]>()
  const targetGroups = new Map<string, string[]>()
  const pairGroups = new Map<string, string[]>()

  for (const e of edges) {
    const h = finalHandles.get(e.id)
    if (!h) continue
    const sk = `${e.from}|${h.sourceHandle}`
    sourceGroups.set(sk, [...(sourceGroups.get(sk) ?? []), e.id])
    const tk = `${e.to}|${h.targetHandle}`
    targetGroups.set(tk, [...(targetGroups.get(tk) ?? []), e.id])
    const pk = `${e.from}|${e.to}|${h.sourceHandle}|${h.targetHandle}`
    pairGroups.set(pk, [...(pairGroups.get(pk) ?? []), e.id])
  }

  for (const e of edges) {
    const h = finalHandles.get(e.id)
    if (!h) continue

    const srcG = sourceGroups.get(`${e.from}|${h.sourceHandle}`) ?? [e.id]
    const tgtG = targetGroups.get(`${e.to}|${h.targetHandle}`) ?? [e.id]
    const pairG =
      pairGroups.get(`${e.from}|${e.to}|${h.sourceHandle}|${h.targetHandle}`) ?? [e.id]

    const srcIdx = indexInGroup(srcG, e.id)
    const tgtIdx = indexInGroup(tgtG, e.id)
    const pairIdx = indexInGroup(pairG, e.id)

    const srcShift = perpendicularShift(
      handleSidePosition(h.sourceHandle),
      srcIdx.index,
      srcIdx.total,
      PARALLEL_SPACING,
    )
    const tgtShift = perpendicularShift(
      handleSidePosition(h.targetHandle),
      tgtIdx.index,
      tgtIdx.total,
      PARALLEL_SPACING,
    )

    let curvature = 0.25
    if (pairIdx.total > 1) {
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
