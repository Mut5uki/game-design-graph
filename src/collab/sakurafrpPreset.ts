import type { CollabSettings } from '@/collab/types'
import { deriveCollabWsFromInviteBase } from '@/collab/publicUrls'

export interface SakuraFrpApplyInput {
  /** 樱花面板日志里的访问地址（只需一条隧道 → 本地 3888） */
  publicUrl: string
}

export interface SakuraFrpApplyResult {
  settings: Pick<CollabSettings, 'mode' | 'inviteBaseUrl' | 'serverUrl'>
  warnings: string[]
}

function trimUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

export function applySakuraFrpPreset(input: SakuraFrpApplyInput): SakuraFrpApplyResult | null {
  const web = trimUrl(input.publicUrl)
  if (!web) return null

  const warnings: string[] = []
  let inviteBaseUrl = web
  try {
    const parsed = new URL(/^https?:\/\//i.test(web) ? web : `http://${web}`)
    inviteBaseUrl = parsed.origin
  } catch {
    warnings.push('地址格式可能有误，请粘贴樱花日志里的完整 URL（含 http(s)://）。')
    return null
  }

  const serverUrl = deriveCollabWsFromInviteBase(inviteBaseUrl)

  try {
    const webParsed = new URL(inviteBaseUrl)
    const wsParsed = new URL(serverUrl)
    if (webParsed.protocol === 'https:' && wsParsed.protocol === 'ws:') {
      warnings.push('网页是 HTTPS 但协作是 ws://，浏览器会拦截。请在樱花隧道开启「自动 HTTPS」。')
    }
  } catch {
    warnings.push('无法解析协作 WebSocket 地址。')
  }

  return {
    settings: {
      mode: 'server',
      inviteBaseUrl,
      serverUrl,
    },
    warnings,
  }
}

export const SAKURAFRP_TUNNEL_HINT = {
  single:
    '只需 1 条隧道：本地 IP 127.0.0.1，本地端口 3888。协作 WebSocket 走同地址的 /collab（本机 Vite 会转发到 1234）。',
  node: '建议选海外/非内地节点；可开「自动 HTTPS」。同事只打开你给的这一个链接即可。',
} as const
