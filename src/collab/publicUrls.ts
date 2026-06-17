/**
 * 公网 / 局域网邀请链接与协作地址解析。
 */

import type { CollabMode } from '@/collab/types'
import { COLLAB_SETTINGS_KEY, loadCollabSettings } from '@/collab/types'

export const LOCAL_COLLAB_WS_URL = 'ws://localhost:1234'

function readInviteBaseUrlFromStorage(): string {
  try {
    const raw = localStorage.getItem(COLLAB_SETTINGS_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { inviteBaseUrl?: string }
    return parsed.inviteBaseUrl?.trim().replace(/\/$/, '') ?? ''
  } catch {
    return ''
  }
}

export function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/** 邀请链接使用的基础 URL（优先：设置 → 构建环境变量 → 当前页面） */
export function getPublicAppBaseUrl(): string {
  const fromSettings = readInviteBaseUrlFromStorage()
  if (fromSettings) return fromSettings

  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window === 'undefined') return ''

  const { hostname, origin } = window.location
  if (!isLocalhostHost(hostname)) return origin

  return origin
}

export function isInviteUrlLocalhostOnly(): boolean {
  const base = getPublicAppBaseUrl()
  if (!base) return true
  try {
    return isLocalhostHost(new URL(base).hostname)
  } catch {
    return true
  }
}

/** 根据当前访问方式推断协作 WebSocket 地址（仅服务器模式） */
export function getSuggestedCollabWsUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_COLLAB_WS_URL?.trim()
  if (fromEnv) return fromEnv

  const inviteBase = readInviteBaseUrlFromStorage()
  if (inviteBase) {
    try {
      const u = new URL(inviteBase)
      const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = u.host
      return `${wsProtocol}//${host}/collab`
    } catch {
      // fall through
    }
  }

  if (typeof window === 'undefined') return LOCAL_COLLAB_WS_URL

  const { protocol, hostname, host } = window.location
  if (isLocalhostHost(hostname)) {
    return LOCAL_COLLAB_WS_URL
  }

  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}/collab`
}

export function resolveCollabServerUrl(savedUrl?: string | null): string {
  const saved = savedUrl?.trim()
  if (saved) return saved
  return getSuggestedCollabWsUrl()
}

export function buildPublicShareUrl(projectId: string, canvasId: string, mode?: CollabMode): string {
  const base = getPublicAppBaseUrl()
  const url = new URL(
    `/project/${projectId}/canvas/${canvasId}`,
    base || 'http://localhost',
  )
  url.searchParams.set('collab', '1')
  const collabMode = mode ?? loadCollabSettings().mode
  if (collabMode === 'p2p') {
    url.searchParams.set('mode', 'p2p')
  }
  return url.toString()
}

export function isCollabJoinUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('collab') === '1'
}
