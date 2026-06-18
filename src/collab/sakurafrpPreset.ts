import type { CollabSettings } from '@/collab/types'
import { deriveCollabWsFromInviteBase } from '@/collab/publicUrls'

export interface SakuraFrpApplyInput {
  /** 樱花面板日志里的访问地址（一条隧道 → 本地 3888） */
  publicUrl: string
}

export interface SakuraFrpApplyResult {
  settings: Pick<CollabSettings, 'inviteBaseUrl' | 'serverUrl'>
  warnings: string[]
}

function trimUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

/** 樱花公网域名：禁止 plain HTTP，需开「自动 HTTPS」并用 https:// 访问 */
function isSakuraFrpHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'frp-tip.com' ||
    h.endsWith('.frp-tip.com') ||
    h.endsWith('.natfrp.cloud') ||
    h.endsWith('.natfrp.vip') ||
    h.endsWith('.natfrp.cc') ||
    h.endsWith('.frp.one')
  )
}

function parsePublicUrl(web: string): URL | null {
  const trimmed = trimUrl(web)
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

export function applySakuraFrpPreset(input: SakuraFrpApplyInput): SakuraFrpApplyResult | null {
  const parsed = parsePublicUrl(input.publicUrl)
  if (!parsed) return null

  const warnings: string[] = []
  let inviteBaseUrl = parsed.origin

  if (isSakuraFrpHost(parsed.hostname)) {
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
      inviteBaseUrl = parsed.origin
      warnings.push(
        '樱花已禁止 HTTP 访问（会出现 501）。已改为 https://；请在 natfrp 隧道设置中开启「自动 HTTPS」。',
      )
    } else if (!/^https?:\/\//i.test(trimUrl(input.publicUrl))) {
      warnings.push('未写协议时已默认 https://（樱花隧道需开启「自动 HTTPS」）。')
    }
  }

  const serverUrl = deriveCollabWsFromInviteBase(inviteBaseUrl)

  try {
    const webParsed = new URL(inviteBaseUrl)
    const wsParsed = new URL(serverUrl)
    if (webParsed.protocol === 'https:' && wsParsed.protocol === 'ws:') {
      warnings.push('网页是 HTTPS 但协作是 ws://，浏览器会拦截。请确认樱花隧道已开启「自动 HTTPS」（协作应为 wss://）。')
    }
  } catch {
    warnings.push('无法解析协作 WebSocket 地址。')
  }

  if (!inviteBaseUrl) return null

  return {
    settings: { inviteBaseUrl, serverUrl },
    warnings,
  }
}

export const SAKURAFRP_TUNNEL_HINT = {
  single:
    '只需 1 条樱花隧道：本地 127.0.0.1:3888。协作走同地址 /collab（本机自动转发，同事不用记端口）。',
  node: '必须在 natfrp 隧道开启「自动 HTTPS」，邀请链接用 https://（plain HTTP 会 501）。',
} as const
