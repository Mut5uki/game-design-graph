import { useEffect } from 'react'
import { canvasCollabSession } from '@/collab/CanvasCollabSession'
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

/** 离开编辑器时断开协作 */
export function useCollabLifecycle() {
  const stopCollab = useEditorStore((s) => s.stopCollab)
  useEffect(() => () => stopCollab(), [stopCollab])
}

/** 本地图变更 → 推送到 Yjs；选中态 → awareness */
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

export function getCollabShareUrl(projectId: string, canvasId: string): string {
  const url = new URL(window.location.href)
  url.pathname = `/project/${projectId}/canvas/${canvasId}`
  url.searchParams.set('collab', '1')
  return url.toString()
}

export function readCollabSettingsForUi() {
  return loadCollabSettings()
}

export function collectRemoteSelectedNodeIds(peers: CollabPeer[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const peer of peers) {
    for (const id of peer.selectedNodeIds) {
      if (!map.has(id)) map.set(id, peer.color)
    }
  }
  return map
}
