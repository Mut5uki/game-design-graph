import type { DesignEdge, DesignNode } from '@/domain/types'
import { nodeAbsolutePosition } from '@/domain/group/commentBlock'

export interface GraphClipboard {
  nodes: DesignNode[]
  edges: DesignEdge[]
}

let clipboard: GraphClipboard | null = null

export function getGraphClipboard(): GraphClipboard | null {
  return clipboard
}

export function setGraphClipboard(data: GraphClipboard | null): void {
  clipboard = data
}

export function buildClipboardFromSelection(
  nodes: DesignNode[],
  edges: DesignEdge[],
  selectedIds: string[],
): GraphClipboard | null {
  if (!selectedIds.length) return null
  const selected = new Set(selectedIds)

  const copiedNodes = nodes
    .filter((n) => selected.has(n.id))
    .map((n) => {
      const copy = structuredClone(n)
      if (copy.parentGroupId && !selected.has(copy.parentGroupId)) {
        copy.position = nodeAbsolutePosition(n, nodes)
        copy.parentGroupId = undefined
      }
      return copy
    })

  const copiedEdges = edges
    .filter((e) => selected.has(e.from) && selected.has(e.to))
    .map((e) => structuredClone(e))

  return { nodes: copiedNodes, edges: copiedEdges }
}
