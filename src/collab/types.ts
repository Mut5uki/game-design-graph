import type { DesignEdge, DesignNode } from '@/domain/types'

export type CollabStatus = 'offline' | 'connecting' | 'connected' | 'error'

export interface CollabUser {
  clientId?: number
  name: string
  color: string
}

export interface CollabPeer extends CollabUser {
  selectedNodeIds: string[]
  selectedEdgeId: string | null
}

export interface CollabSettings {
  serverUrl: string
  displayName: string
}

export const DEFAULT_COLLAB_SERVER_URL = 'ws://localhost:1234'

export const COLLAB_SETTINGS_KEY = 'gdg-collab-settings'

export function loadCollabSettings(): CollabSettings {
  try {
    const raw = localStorage.getItem(COLLAB_SETTINGS_KEY)
    if (!raw) {
      return { serverUrl: DEFAULT_COLLAB_SERVER_URL, displayName: '' }
    }
    const parsed = JSON.parse(raw) as Partial<CollabSettings>
    return {
      serverUrl: parsed.serverUrl?.trim() || DEFAULT_COLLAB_SERVER_URL,
      displayName: parsed.displayName?.trim() ?? '',
    }
  } catch {
    return { serverUrl: DEFAULT_COLLAB_SERVER_URL, displayName: '' }
  }
}

export function saveCollabSettings(settings: CollabSettings): void {
  localStorage.setItem(COLLAB_SETTINGS_KEY, JSON.stringify(settings))
}

export function buildCollabRoomId(projectId: string, canvasId: string): string {
  return `${projectId}:${canvasId}`
}

export function parseCollabRoomId(roomId: string): { projectId: string; canvasId: string } | null {
  const idx = roomId.indexOf(':')
  if (idx <= 0 || idx >= roomId.length - 1) return null
  return {
    projectId: roomId.slice(0, idx),
    canvasId: roomId.slice(idx + 1),
  }
}

export interface CanvasGraphSnapshot {
  nodes: DesignNode[]
  edges: DesignEdge[]
}

export const PEER_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
] as const

export function pickPeerColor(clientId: number): string {
  return PEER_COLORS[Math.abs(clientId) % PEER_COLORS.length]
}

export function defaultDisplayName(): string {
  const saved = loadCollabSettings().displayName
  if (saved) return saved
  return `策划-${Math.floor(Math.random() * 900 + 100)}`
}
