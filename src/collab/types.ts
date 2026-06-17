import type { DesignEdge, DesignNode } from '@/domain/types'
import { resolveCollabServerUrl } from '@/collab/publicUrls'

export type CollabMode = 'server' | 'p2p'

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
  mode: CollabMode
  /** 发给同事打开的编辑器地址，如 http://120.46.79.53 或 http://192.168.1.5:3888 */
  inviteBaseUrl: string
  serverUrl: string
  /** P2P 信令服务器，每行一个 URL */
  signalingUrls: string[]
  /** P2P 房间密码（可选，加密信令通道） */
  roomPassword: string
  displayName: string
}

export const DEFAULT_COLLAB_SERVER_URL = 'ws://localhost:1234'

/** y-webrtc 公共信令（仅握手，不含画布内容） */
export const DEFAULT_SIGNALING_URLS = [
  'wss://y-webrtc-eu.fly.dev',
] as const

export const COLLAB_SETTINGS_KEY = 'gdg-collab-settings'

/** 已失效的旧信令，加载设置时自动替换 */
const DEPRECATED_SIGNALING_URLS = new Set([
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com',
])

function sanitizeSignalingUrls(urls: string[]): string[] {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean)
  const filtered = cleaned.filter((u) => !DEPRECATED_SIGNALING_URLS.has(u))
  if (filtered.length) return filtered
  return [...DEFAULT_SIGNALING_URLS]
}

function normalizeSignalingUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    const urls = value.map((u) => String(u).trim()).filter(Boolean)
    if (urls.length) return sanitizeSignalingUrls(urls)
  }
  if (typeof value === 'string' && value.trim()) {
    return sanitizeSignalingUrls(parseSignalingUrls(value))
  }
  return [...DEFAULT_SIGNALING_URLS]
}

export function parseSignalingUrls(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatSignalingUrls(urls: string[]): string {
  return urls.join('\n')
}

export function loadCollabSettings(): CollabSettings {
  try {
    const raw = localStorage.getItem(COLLAB_SETTINGS_KEY)
    if (!raw) {
      return {
        mode: 'p2p',
        inviteBaseUrl: '',
        serverUrl: resolveCollabServerUrl(),
        signalingUrls: [...DEFAULT_SIGNALING_URLS],
        roomPassword: '',
        displayName: '',
      }
    }
    const parsed = JSON.parse(raw) as Partial<CollabSettings> & { signalingUrls?: string[] | string }
    return {
      mode: parsed.mode === 'server' ? 'server' : 'p2p',
      inviteBaseUrl: parsed.inviteBaseUrl?.trim().replace(/\/$/, '') ?? '',
      serverUrl: resolveCollabServerUrl(parsed.serverUrl),
      signalingUrls: normalizeSignalingUrls(parsed.signalingUrls),
      roomPassword: parsed.roomPassword?.trim() ?? '',
      displayName: parsed.displayName?.trim() ?? '',
    }
  } catch {
    return {
      mode: 'p2p',
      inviteBaseUrl: '',
      serverUrl: resolveCollabServerUrl(),
      signalingUrls: [...DEFAULT_SIGNALING_URLS],
      roomPassword: '',
      displayName: '',
    }
  }
}

export function saveCollabSettings(settings: CollabSettings): void {
  const normalized = {
    ...settings,
    signalingUrls: sanitizeSignalingUrls(settings.signalingUrls),
  }
  localStorage.setItem(COLLAB_SETTINGS_KEY, JSON.stringify(normalized))
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

export function collabModeLabel(mode: CollabMode): string {
  return mode === 'p2p' ? 'P2P' : '服务器'
}
