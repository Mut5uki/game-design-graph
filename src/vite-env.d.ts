/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 公网站点根 URL，用于生成协作邀请链接 */
  readonly VITE_PUBLIC_APP_URL?: string
  /** 公网协作 WebSocket（HTTPS 页面请用 wss://） */
  readonly VITE_PUBLIC_COLLAB_WS_URL?: string
  /** 静态站子路径（一般不必手填，会从 VITE_PUBLIC_APP_URL 推断） */
  readonly VITE_BASE_PATH?: string
  /** Vite 注入：与 vite.config base 一致 */
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
