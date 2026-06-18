import type { DesignEdge, DesignNode } from '@/domain/types'
import { deriveCollabWsFromInviteBase, resolveCollabServerUrl } from '@/collab/publicUrls'

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
  /** 樱花公网地址（同事打开的网页），如 https://cn-xx.natfrp.cloud:51906 */
  inviteBaseUrl: string
  /** 协作 WebSocket，由 inviteBaseUrl 自动推导为 …/collab */
  serverUrl: string
  displayName: string
}

export const COLLAB_SETTINGS_KEY = 'gdg-collab-settings'

export function loadCollabSettings(): CollabSettings {
  try {
    const raw = localStorage.getItem(COLLAB_SETTINGS_KEY)
    if (!raw) {
      return {
        inviteBaseUrl: '',
        serverUrl: resolveCollabServerUrl(),
        displayName: '',
      }
    }
    const parsed = JSON.parse(raw) as Partial<CollabSettings> & {
      mode?: string
      signalingUrls?: unknown
      roomPassword?: string
    }
    const inviteBaseUrl = parsed.inviteBaseUrl?.trim().replace(/\/$/, '') ?? ''
    const serverUrl = parsed.serverUrl?.trim()
      ? resolveCollabServerUrl(parsed.serverUrl)
      : inviteBaseUrl
        ? deriveCollabWsFromInviteBase(inviteBaseUrl)
        : resolveCollabServerUrl()
    return {
      inviteBaseUrl,
      serverUrl,
      displayName: parsed.displayName?.trim() ?? '',
    }
  } catch {
    return {
      inviteBaseUrl: '',
      serverUrl: resolveCollabServerUrl(),
      displayName: '',
    }
  }
}

export function saveCollabSettings(settings: CollabSettings): void {
  const inviteBaseUrl = settings.inviteBaseUrl.trim().replace(/\/$/, '')
  const serverUrl = inviteBaseUrl
    ? deriveCollabWsFromInviteBase(inviteBaseUrl)
    : settings.serverUrl.trim() || resolveCollabServerUrl()
  localStorage.setItem(
    COLLAB_SETTINGS_KEY,
    JSON.stringify({
      inviteBaseUrl,
      serverUrl,
      displayName: settings.displayName.trim(),
    }),
  )
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
