/**
 * 公网邀请链接与樱花协作 WebSocket 地址解析。
 */

import { COLLAB_SETTINGS_KEY } from '@/collab/types'

export const LOCAL_COLLAB_WS_URL = 'ws://localhost:3888/collab'

/** 由樱花公网地址推导协作 WebSocket（同域 /collab） */
export function deriveCollabWsFromInviteBase(inviteBaseUrl: string): string {
  const raw = inviteBaseUrl.trim().replace(/\/$/, '')
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
  const u = new URL(withScheme)
  const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${u.host}/collab`
}

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

export function getSuggestedCollabWsUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_COLLAB_WS_URL?.trim()
  if (fromEnv) return fromEnv

  const inviteBase = readInviteBaseUrlFromStorage()
  if (inviteBase) {
    try {
      return deriveCollabWsFromInviteBase(inviteBase)
    } catch {
      // fall through
    }
  }

  if (typeof window === 'undefined') return LOCAL_COLLAB_WS_URL

  const { protocol, hostname, host } = window.location
  if (isLocalhostHost(hostname)) {
    return deriveCollabWsFromInviteBase(window.location.origin)
  }

  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}/collab`
}

export function resolveCollabServerUrl(savedUrl?: string | null): string {
  const saved = savedUrl?.trim()
  if (saved) return saved
  return getSuggestedCollabWsUrl()
}

/**
 * 建立协作连接时使用的 WebSocket：与当前页面同域（/collab → 本机 1234）。
 * 樱花地址仅用于邀请链接；在本机 127.0.0.1 编辑时不应绕公网再连回来。
 */
export function resolveActiveCollabServerUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_COLLAB_WS_URL?.trim()
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    return deriveCollabWsFromInviteBase(window.location.origin)
  }

  const inviteBase = readInviteBaseUrlFromStorage()
  if (inviteBase) {
    try {
      return deriveCollabWsFromInviteBase(inviteBase)
    } catch {
      // fall through
    }
  }

  return LOCAL_COLLAB_WS_URL
}

function getAppOriginAndPathPrefix(): { origin: string; pathPrefix: string } {
  const appBase = getPublicAppBaseUrl().replace(/\/$/, '') || 'http://localhost'
  try {
    const parsed = new URL(appBase)
    const pathPrefix = parsed.pathname.replace(/\/$/, '')
    return { origin: parsed.origin, pathPrefix }
  } catch {
    return { origin: appBase, pathPrefix: import.meta.env.BASE_URL.replace(/\/$/, '') || '' }
  }
}

export function buildPublicShareUrl(projectId: string, canvasId: string): string {
  const { origin, pathPrefix } = getAppOriginAndPathPrefix()
  const path = `${pathPrefix}/project/${projectId}/canvas/${canvasId}`.replace(/\/+/g, '/')
  const url = new URL(path, origin)
  url.searchParams.set('collab', '1')
  return url.toString()
}

export function isCollabJoinUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('collab') === '1'
}
