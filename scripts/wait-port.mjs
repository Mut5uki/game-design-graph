#!/usr/bin/env node
/** 等待本机端口可连接（协作服务就绪检测） */
import { createConnection } from 'node:net'

const port = Number(process.argv[2] ?? 1234)
const timeoutMs = Number(process.argv[3] ?? 60_000)
const host = process.argv[4] ?? '127.0.0.1'

if (!Number.isFinite(port) || port <= 0) {
  console.error('[wait-port] 无效端口:', process.argv[2])
  process.exit(1)
}

const deadline = Date.now() + timeoutMs

function probe() {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port, host })
    socket.once('connect', () => {
      socket.end()
      resolve(undefined)
    })
    socket.once('error', () => {
      if (Date.now() >= deadline) {
        reject(new Error(`等待 ${host}:${port} 超时（${timeoutMs}ms）`))
        return
      }
      setTimeout(() => probe().then(resolve, reject), 400)
    })
  })
}

try {
  await probe()
  console.log(`[wait-port] ${host}:${port} 已就绪`)
} catch (err) {
  console.error('[wait-port]', err instanceof Error ? err.message : err)
  process.exit(1)
}
