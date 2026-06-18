import type { CollabPeer } from '@/collab/types'
import { computeDesignEdgePath, resolveEdgeEndpointsMap } from '@/collab/edgePath'
import { estimateNodeBounds } from '@/collab/nodeBounds'
import { useEditorStore } from '@/store/editorStore'

export function buildPeerFocusTitle(peer: CollabPeer): string {
  const parts = [peer.name]
  if (peer.selectedNodeIds.length) {
    parts.push(`选中 ${peer.selectedNodeIds.length} 个节点`)
  }
  if (peer.selectedEdgeId) {
    parts.push('选中连线')
  }
  if (!peer.selectedNodeIds.length && !peer.selectedEdgeId && peer.cursor) {
    parts.push('光标位置')
  }
  parts.push('点击定位')
  return parts.join(' · ')
}

export function focusCollabPeer(peer: CollabPeer): void {
  const { nodes, edges, focusNode, selectEdge, selectNodes } = useEditorStore.getState()

  if (peer.selectedEdgeId) {
    const edge = edges.find((e) => e.id === peer.selectedEdgeId)
    if (edge) {
      selectEdge(peer.selectedEdgeId)
      const endpoints = resolveEdgeEndpointsMap(edges, nodes)
      const getBounds = (node: typeof nodes[number]) => estimateNodeBounds(node, nodes)
      const pathInfo = computeDesignEdgePath(edge, nodes, getBounds, endpoints)
      if (pathInfo) {
        window.dispatchEvent(
          new CustomEvent('gdg:focus-point', {
            detail: { x: pathInfo.labelX, y: pathInfo.labelY, zoom: 1.2 },
          }),
        )
        return
      }
      const from = nodes.find((n) => n.id === edge.from)
      const to = nodes.find((n) => n.id === edge.to)
      if (from && to) {
        const a = estimateNodeBounds(from, nodes)
        const b = estimateNodeBounds(to, nodes)
        window.dispatchEvent(
          new CustomEvent('gdg:focus-point', {
            detail: {
              x: (a.x + a.width / 2 + b.x + b.width / 2) / 2,
              y: (a.y + a.height / 2 + b.y + b.height / 2) / 2,
              zoom: 1.2,
            },
          }),
        )
      }
      return
    }
  }

  if (peer.selectedNodeIds.length === 1) {
    focusNode(peer.selectedNodeIds[0])
    return
  }

  if (peer.selectedNodeIds.length > 1) {
    selectNodes(peer.selectedNodeIds)
    window.dispatchEvent(
      new CustomEvent('gdg:focus-nodes', { detail: { nodeIds: peer.selectedNodeIds } }),
    )
    return
  }

  if (peer.cursor) {
    window.dispatchEvent(
      new CustomEvent('gdg:focus-point', {
        detail: { x: peer.cursor.x, y: peer.cursor.y, zoom: 1.2 },
      }),
    )
  }
}
