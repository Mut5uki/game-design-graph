/** 通过 WebRTC ICE 探测本机局域网 IPv4（仅浏览器内可用） */
export async function detectLanIpv4(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.RTCPeerConnection) return null

  try {
    const pc = new RTCPeerConnection({ iceServers: [] })
    pc.createDataChannel('gdg-detect')
    await pc.setLocalDescription(await pc.createOffer())

    return await new Promise<string | null>((resolve) => {
      const done = (ip: string | null) => {
        pc.close()
        resolve(ip)
      }
      const timer = window.setTimeout(() => done(null), 4000)

      pc.onicecandidate = (event) => {
        if (!event.candidate?.candidate) return
        const match = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(event.candidate.candidate)
        const ip = match?.[1]
        if (!ip || ip.startsWith('127.')) return
        window.clearTimeout(timer)
        done(ip)
      }
    })
  } catch {
    return null
  }
}

export function buildHostInviteUrl(ip: string, port = 3888): string {
  return `http://${ip}:${port}`
}

export function buildHostCollabWsUrl(ip: string, port = 3888): string {
  return `ws://${ip}:${port}/collab`
}

export function getCurrentDevPort(): number {
  if (typeof window === 'undefined') return 3888
  const p = Number(window.location.port)
  return p || (window.location.protocol === 'https:' ? 443 : 80)
}
