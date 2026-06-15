import dagre from 'dagre'
import type { DesignEdge, DesignNode } from '../types'

const NODE_WIDTH = 220
const NODE_HEIGHT = 72

export function autoLayout(
  nodes: DesignNode[],
  edges: DesignEdge[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const edge of edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to)
    }
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const layoutNode = g.node(node.id)
    if (layoutNode) {
      positions.set(node.id, {
        x: layoutNode.x - NODE_WIDTH / 2,
        y: layoutNode.y - NODE_HEIGHT / 2,
      })
    }
  }

  return positions
}

export function applyAutoLayoutPositions(
  nodes: DesignNode[],
  edges: DesignEdge[],
): DesignNode[] {
  const positions = autoLayout(nodes, edges)
  return nodes.map((node) => {
    const pos = positions.get(node.id)
    return pos ? { ...node, position: pos, updatedAt: Date.now() } : node
  })
}
