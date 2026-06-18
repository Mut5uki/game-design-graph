import type { CollabPeer } from '@/collab/types'

export function peerSelectionSignature(peers: CollabPeer[]): string {
  return peers
    .map(
      (p) =>
        `${p.clientId}:${p.name}:${p.selectedEdgeId ?? ''}:${(p.selectedNodeIds ?? []).join(',')}`,
    )
    .join('|')
}

export const MIN_CURSOR_STEP = 4
