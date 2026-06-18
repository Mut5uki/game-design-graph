import type { CollabMode, CollabSettings } from '@/collab/types'
import { DEFAULT_SIGNALING_URLS } from '@/collab/types'
import {
  buildHostCollabWsUrl,
  buildHostInviteUrl,
  detectLanIpv4,
  getCurrentDevPort,
} from '@/lib/localNetwork'

export interface HostPresetResult {
  settings: Partial<CollabSettings>
  lanIp: string
  inviteUrl: string
  wsUrl?: string
}

/** 本机作为主机：局域网同事连你的电脑 */
export async function applyLocalHostPreset(
  mode: CollabMode,
  current: CollabSettings,
): Promise<HostPresetResult | null> {
  const ip = await detectLanIpv4()
  if (!ip) return null

  const port = getCurrentDevPort()
  const inviteUrl = buildHostInviteUrl(ip, port)

  if (mode === 'p2p') {
    return {
      lanIp: ip,
      inviteUrl,
      settings: {
        mode: 'p2p',
        inviteBaseUrl: inviteUrl,
        signalingUrls: current.signalingUrls.length
          ? current.signalingUrls
          : [...DEFAULT_SIGNALING_URLS],
      },
    }
  }

  return {
    lanIp: ip,
    inviteUrl,
    wsUrl: buildHostCollabWsUrl(ip),
    settings: {
      mode: 'server',
      inviteBaseUrl: inviteUrl,
      serverUrl: buildHostCollabWsUrl(ip),
    },
  }
}

export const HOST_MODE_HINT = {
  p2p: '你的电脑跑网页；同事打开你的局域网地址即可 P2P 协作（需先运行 npm run start，且用 --host）。',
  server:
    '你的电脑跑 start-with-collab.bat；同事只访问 http://你的IP:3888，协作走同端口 /collab（无需单独暴露 1234）。',
  remote:
    '外地同事用樱花等穿透时，也只需映射 3888 一个端口；或 Tailscale 虚拟组网。',
} as const
