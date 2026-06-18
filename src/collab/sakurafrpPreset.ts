import type { CollabSettings } from '@/collab/types'

export interface SakuraFrpApplyInput {
  /** 樱花面板日志里「网页」隧道的访问地址，如 https://xxx.natfrp.cloud:51906 */
  webPublicUrl: string
  /** 樱花面板日志里「协作 WS」隧道的地址，如 wss://xxx.natfrp.cloud:51907；留空则尝试由网页地址推断协议 */
  wsPublicUrl?: string
}

export interface SakuraFrpApplyResult {
  settings: Pick<CollabSettings, 'mode' | 'inviteBaseUrl' | 'serverUrl'>
  warnings: string[]
}

function trimUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

/** 将 http(s) 转为 ws(s)，保留 host:port */
export function httpUrlToWsUrl(httpUrl: string): string {
  const trimmed = trimUrl(httpUrl)
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withScheme)
  const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  const port = parsed.port ? `:${parsed.port}` : ''
  return `${wsProtocol}//${parsed.hostname}${port}`
}

function normalizeWsInput(ws: string, webUrl: string): string {
  const trimmed = trimUrl(ws)
  if (/^wss?:\/\//i.test(trimmed)) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return httpUrlToWsUrl(trimmed)
  const web = trimUrl(webUrl)
  const webParsed = new URL(/^https?:\/\//i.test(web) ? web : `https://${web}`)
  const wsProtocol = webParsed.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${trimmed}`
}

export function applySakuraFrpPreset(input: SakuraFrpApplyInput): SakuraFrpApplyResult | null {
  const web = trimUrl(input.webPublicUrl)
  if (!web) return null

  const warnings: string[] = []
  let inviteBaseUrl = web
  try {
    const parsed = new URL(/^https?:\/\//i.test(web) ? web : `https://${web}`)
    inviteBaseUrl = parsed.origin
  } catch {
    warnings.push('网页地址格式可能有误，请核对樱花面板日志中的完整 URL。')
  }

  const wsRaw = input.wsPublicUrl?.trim()
  if (!wsRaw) {
    warnings.push('未填写协作 WebSocket 地址，请从樱花第二条隧道日志复制后填入。')
    return null
  }

  const serverUrl = normalizeWsInput(wsRaw, inviteBaseUrl)

  try {
    const webParsed = new URL(/^https?:\/\//i.test(inviteBaseUrl) ? inviteBaseUrl : `http://${inviteBaseUrl}`)
    const wsParsed = new URL(serverUrl)
    if (webParsed.protocol === 'https:' && wsParsed.protocol === 'ws:') {
      warnings.push(
        '网页是 HTTPS，但 WebSocket 是 ws://，浏览器会拦截。请给协作隧道开启「自动 HTTPS」并填 wss:// 地址。',
      )
    }
  } catch {
    warnings.push('WebSocket 地址格式可能有误。')
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
  web: '本地 IP：127.0.0.1，本地端口：3888（编辑器网页）',
  ws: '本地 IP：127.0.0.1，本地端口：1234（协作 WebSocket）',
  node: '建议选海外/非内地节点；两条隧道选同一节点，便于批量启动 frpc。',
} as const
