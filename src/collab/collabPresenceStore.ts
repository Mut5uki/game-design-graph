import { create } from 'zustand'
import type { CollabPeer } from '@/collab/types'

function peersEqual(a: CollabPeer[], b: CollabPeer[]): boolean {
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 与画布文档分离的 ephemeral presence（光标/选中），不触发 editorStore / flowNodes 更新 */
interface CollabPresenceState {
  peers: CollabPeer[]
  /** 顶栏点击头像后正在跟踪的同伴 */
  trackedPeerClientId: number | null
  setPeers: (peers: CollabPeer[]) => void
  setTrackedPeerClientId: (clientId: number | null) => void
  clear: () => void
}

export const useCollabPresenceStore = create<CollabPresenceState>((set, get) => ({
  peers: [],
  trackedPeerClientId: null,
  setPeers: (peers) => {
    if (peersEqual(get().peers, peers)) return
    set({ peers })
  },
  setTrackedPeerClientId: (clientId) => set({ trackedPeerClientId: clientId }),
  clear: () => set({ peers: [], trackedPeerClientId: null }),
}))

export function clearCollabPresence(): void {
  useCollabPresenceStore.getState().clear()
}
