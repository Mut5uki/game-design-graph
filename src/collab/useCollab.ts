import { useEffect } from 'react'
import { canvasCollabSession } from '@/collab/CanvasCollabSession'
import { buildPublicShareUrl } from '@/collab/publicUrls'
import { loadCollabSettings, type CollabPeer, type CollabStatus } from '@/collab/types'
import { isApplyingRemoteCollab, useEditorStore } from '@/store/editorStore'

let collabPushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleCollabPush(
  nodes: ReturnType<typeof useEditorStore.getState>['nodes'],
  edges: ReturnType<typeof useEditorStore.getState>['edges'],
) {
  if (collabPushTimer) clearTimeout(collabPushTimer)
  collabPushTimer = setTimeout(() => {
    if (isApplyingRemoteCollab()) return
    canvasCollabSession.pushLocalGraph(nodes, edges)
  }, 300)
}

export function useCollabLifecycle() {
  const stopCollab = useEditorStore((s) => s.stopCollab)
  useEffect(() => () => stopCollab(), [stopCollab])
}

export function useCollabSync() {
  const collabEnabled = useEditorStore((s) => s.collabEnabled)
  const collabStatus = useEditorStore((s) => s.collabStatus)
  const nodes = useEditorStore((s) => s.nodes)
  const edges = useEditorStore((s) => s.edges)
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds)
  const selectedEdgeId = useEditorStore((s) => s.selectedEdgeId)

  useEffect(() => {
    if (!collabEnabled || collabStatus !== 'connected') return
    if (isApplyingRemoteCollab()) return
    scheduleCollabPush(nodes, edges)
  }, [collabEnabled, collabStatus, nodes, edges])

  useEffect(() => {
    if (!collabEnabled || collabStatus !== 'connected') return
    canvasCollabSession.publishSelection(selectedNodeIds, selectedEdgeId)
  }, [collabEnabled, collabStatus, selectedNodeIds, selectedEdgeId])
}

export type { CollabPeer, CollabStatus }

export interface RemotePeerRef {
  color: string
  name: string
}

export function collectRemoteNodeSelections(peers: CollabPeer[]): Map<string, RemotePeerRef[]> {
  const map = new Map<string, RemotePeerRef[]>()
  for (const peer of peers) {
    for (const id of peer.selectedNodeIds) {
      const list = map.get(id) ?? []
      list.push({ color: peer.color, name: peer.name })
      map.set(id, list)
    }
  }
  return map
}

/** @deprecated use collectRemoteNodeSelections */
export function collectRemoteSelectedNodeIds(peers: CollabPeer[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const [id, refs] of collectRemoteNodeSelections(peers)) {
    if (refs[0]) map.set(id, refs[0].color)
  }
  return map
}

export function collectRemoteEdgeSelections(peers: CollabPeer[]): Map<string, RemotePeerRef> {
  const map = new Map<string, RemotePeerRef>()
  for (const peer of peers) {
    if (peer.selectedEdgeId && !map.has(peer.selectedEdgeId)) {
      map.set(peer.selectedEdgeId, { color: peer.color, name: peer.name })
    }
  }
  return map
}

export function getCollabShareUrl(projectId: string, canvasId: string): string {
  return buildPublicShareUrl(projectId, canvasId)
}

export function readCollabSettingsForUi() {
  return loadCollabSettings()
}
