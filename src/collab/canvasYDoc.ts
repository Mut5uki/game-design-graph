import * as Y from 'yjs'
import type { DesignEdge, DesignNode } from '@/domain/types'
import type { CanvasGraphSnapshot } from '@/collab/types'

/** Yjs transaction origin：本地 store 写入 */
export const COLLAB_ORIGIN_LOCAL = 'gdg-local'
/** 远程同步回放时跳过回写 */
export const COLLAB_ORIGIN_REMOTE = 'gdg-remote'

export interface CanvasYDoc {
  doc: Y.Doc
  nodes: Y.Map<DesignNode>
  edges: Y.Map<DesignEdge>
}

export function createCanvasYDoc(): CanvasYDoc {
  const doc = new Y.Doc()
  return {
    doc,
    nodes: doc.getMap<DesignNode>('nodes'),
    edges: doc.getMap<DesignEdge>('edges'),
  }
}

export function readCanvasGraph(yNodes: Y.Map<DesignNode>, yEdges: Y.Map<DesignEdge>): CanvasGraphSnapshot {
  return {
    nodes: Array.from(yNodes.values()),
    edges: Array.from(yEdges.values()),
  }
}

/** 避免 Yjs 回显导致 store ↔ ydoc 无限同步 */
export function graphSnapshotEqual(a: CanvasGraphSnapshot, b: CanvasGraphSnapshot): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false
  const sortNodes = (nodes: DesignNode[]) => [...nodes].sort((x, y) => x.id.localeCompare(y.id))
  const sortEdges = (edges: DesignEdge[]) => [...edges].sort((x, y) => x.id.localeCompare(y.id))
  return (
    JSON.stringify(sortNodes(a.nodes)) === JSON.stringify(sortNodes(b.nodes)) &&
    JSON.stringify(sortEdges(a.edges)) === JSON.stringify(sortEdges(b.edges))
  )
}

export function seedCanvasGraph(
  { doc, nodes: yNodes, edges: yEdges }: CanvasYDoc,
  snapshot: CanvasGraphSnapshot,
): void {
  doc.transact(() => {
    for (const n of snapshot.nodes) yNodes.set(n.id, n)
    for (const e of snapshot.edges) yEdges.set(e.id, e)
  }, COLLAB_ORIGIN_LOCAL)
}

export function replaceCanvasGraph(
  { doc, nodes: yNodes, edges: yEdges }: CanvasYDoc,
  snapshot: CanvasGraphSnapshot,
  origin: string = COLLAB_ORIGIN_LOCAL,
): void {
  doc.transact(() => {
    const nextNodeIds = new Set(snapshot.nodes.map((n) => n.id))
    for (const id of Array.from(yNodes.keys())) {
      if (!nextNodeIds.has(id)) yNodes.delete(id)
    }
    for (const n of snapshot.nodes) yNodes.set(n.id, n)

    const nextEdgeIds = new Set(snapshot.edges.map((e) => e.id))
    for (const id of Array.from(yEdges.keys())) {
      if (!nextEdgeIds.has(id)) yEdges.delete(id)
    }
    for (const e of snapshot.edges) yEdges.set(e.id, e)
  }, origin)
}

export function isRemoteCollabOrigin(origin: unknown): boolean {
  return origin !== COLLAB_ORIGIN_LOCAL && origin !== null && origin !== undefined
}
