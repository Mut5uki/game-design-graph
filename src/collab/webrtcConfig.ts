/** WebRTC ICE，帮助跨网络/跨运营商建立 P2P（公共 STUN，不含 TURN） */
export const DEFAULT_WEBRTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export const DEFAULT_WEBRTC_PEER_OPTS = {
  config: {
    iceServers: DEFAULT_WEBRTC_ICE_SERVERS,
  },
} as const
