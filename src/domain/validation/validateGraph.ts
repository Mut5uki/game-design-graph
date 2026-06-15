import type { DesignEdge, DesignNode, RelationType, ValidationIssue } from '../types'
import { getRelationLabel as resolveRelationLabel } from '../templates/relationTypeRegistry'

const CYCLE_RELATIONS: RelationType[] = ['requires', 'unlocks']

export function detectCycles(
  nodes: DesignNode[],
  edges: DesignEdge[],
): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const adj = new Map<string, string[]>()

  for (const id of nodeIds) adj.set(id, [])
  for (const edge of edges) {
    if (!CYCLE_RELATIONS.includes(edge.relationType)) continue
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue
    adj.get(edge.from)!.push(edge.to)
  }

  const cycles: string[][] = []
  const visited = new Set<string>()
  const stack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): void {
    visited.add(node)
    stack.add(node)
    path.push(node)

    for (const next of adj.get(node) ?? []) {
      if (!visited.has(next)) {
        dfs(next)
      } else if (stack.has(next)) {
        const start = path.indexOf(next)
        if (start >= 0) cycles.push([...path.slice(start), next])
      }
    }

    path.pop()
    stack.delete(node)
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) dfs(id)
  }

  return cycles
}

export function validateGraph(
  nodes: DesignNode[],
  edges: DesignEdge[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const idCounts = new Map<string, number>()

  for (const node of nodes) {
    idCounts.set(node.id, (idCounts.get(node.id) ?? 0) + 1)
  }

  for (const [id, count] of idCounts) {
    if (count > 1) {
      issues.push({
        id: `dup-${id}`,
        ruleId: 'DUPLICATE_ID',
        level: 'error',
        message: `节点 ID「${id}」重复 ${count} 次`,
        nodeIds: [id],
      })
    }
  }

  for (const edge of edges) {
    const missingFrom = !nodeMap.has(edge.from)
    const missingTo = !nodeMap.has(edge.to)
    if (missingFrom || missingTo) {
      issues.push({
        id: `dangle-${edge.id}`,
        ruleId: 'DANGLING_EDGE',
        level: 'error',
        message: `连线「${edge.label || edge.id}」指向不存在的节点`,
        edgeIds: [edge.id],
        nodeIds: [edge.from, edge.to].filter((id) => !nodeMap.has(id)),
      })
    }
  }

  const cycles = detectCycles(nodes, edges)
  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i]
    issues.push({
      id: `cycle-${i}`,
      ruleId: 'REQUIRE_CYCLE',
      level: 'error',
      message: `依赖环：${cycle.map((id) => nodeMap.get(id)?.name || id).join(' → ')}`,
      nodeIds: cycle,
    })
  }

  const connected = new Set<string>()
  for (const edge of edges) {
    connected.add(edge.from)
    connected.add(edge.to)
  }

  for (const node of nodes) {
    if (!node.name.trim()) {
      issues.push({
        id: `empty-${node.id}`,
        ruleId: 'EMPTY_NAME',
        level: 'warn',
        message: `节点「${node.id}」名称为空`,
        nodeIds: [node.id],
      })
    }

    if (
      node.type !== 'group' &&
      !node.parentGroupId &&
      !connected.has(node.id)
    ) {
      issues.push({
        id: `orphan-${node.id}`,
        ruleId: 'ORPHAN_NODE',
        level: 'warn',
        message: `孤立节点「${node.name || node.id}」没有任何连线`,
        nodeIds: [node.id],
      })
    }
  }

  const blocksEdges = edges.filter((e) => e.relationType === 'blocks')
  for (const edge of blocksEdges) {
    const reverse = edges.find(
      (e) =>
        e.relationType === 'blocks' &&
        e.from === edge.to &&
        e.to === edge.from,
    )
    if (!reverse) {
      issues.push({
        id: `blocks-${edge.id}`,
        ruleId: 'BLOCKS_ASYMMETRY',
        level: 'info',
        message: `互斥关系「${nodeMap.get(edge.from)?.name} → ${nodeMap.get(edge.to)?.name}」缺少反向边`,
        edgeIds: [edge.id],
        nodeIds: [edge.from, edge.to],
      })
    }
  }

  return issues
}

export function computeImpact(
  nodeId: string,
  edges: DesignEdge[],
): { upstream: Set<string>; downstream: Set<string> } {
  const upstream = new Set<string>()
  const downstream = new Set<string>()

  const upQueue = [nodeId]
  const downQueue = [nodeId]

  while (upQueue.length) {
    const current = upQueue.pop()!
    for (const edge of edges) {
      if (edge.to === current && !upstream.has(edge.from)) {
        upstream.add(edge.from)
        upQueue.push(edge.from)
      }
    }
  }

  while (downQueue.length) {
    const current = downQueue.pop()!
    for (const edge of edges) {
      if (edge.from === current && !downstream.has(edge.to)) {
        downstream.add(edge.to)
        downQueue.push(edge.to)
      }
    }
  }

  upstream.delete(nodeId)
  downstream.delete(nodeId)

  return { upstream, downstream }
}

export function getRelationLabel(type: RelationType): string {
  return resolveRelationLabel(type)
}
