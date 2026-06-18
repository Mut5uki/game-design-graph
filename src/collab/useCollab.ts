import { useEffect } from 'react'
import { canvasCollabSession } from '@/collab/CanvasCollabSession'
import { buildPublicShareUrl } from '@/collab/publicUrls'
import { loadCollabSettings, defaultDisplayName } from '@/collab/types'
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
  }, 500)
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
    const settings = loadCollabSettings()
    const name = settings.displayName.trim() || defaultDisplayName()
    canvasCollabSession.republishLocalPresence(name, selectedNodeIds, selectedEdgeId)
  }, [collabEnabled, collabStatus, selectedNodeIds, selectedEdgeId])

  useEffect(() => {
    if (!collabEnabled || collabStatus !== 'connected') return
    if (isApplyingRemoteCollab()) return
    scheduleCollabPush(nodes, edges)
  }, [collabEnabled, collabStatus, nodes, edges])
}

export type { CollabPeer, CollabStatus } from '@/collab/types'

export function getCollabShareUrl(projectId: string, canvasId: string): string {
  return buildPublicShareUrl(projectId, canvasId)
}

export function readCollabSettingsForUi() {
  return loadCollabSettings()
}
