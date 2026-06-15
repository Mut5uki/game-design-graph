import { Server } from '@hocuspocus/server'

const port = Number(process.env.PORT ?? 1234)

const server = Server.configure({
  port,
  address: '0.0.0.0',
  async onAuthenticate({ token }) {
    // MVP：无账号体系，任意 token / 空 token 均可加入房间
    return { user: token ? { name: String(token) } : undefined }
  },
})

server.listen()

console.log(`[gdg-collab] WebSocket server listening on ws://0.0.0.0:${port}`)
