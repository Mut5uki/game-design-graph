#!/usr/bin/env node
/** 释放本机监听端口（上次未退出的 node/vite 残留） */
import { execSync } from 'node:child_process'

const ports = process.argv.slice(2).map(Number).filter((p) => p > 0 && p < 65536)
if (!ports.length) {
  console.error('Usage: node scripts/free-port.mjs <port> [port2 ...]')
  process.exit(1)
}

const isWin = process.platform === 'win32'

function freePort(port) {
  if (isWin) {
    try {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' },
      )
      console.log(`[free-port] cleared ${port} (if any listener existed)`)
    } catch {
      console.log(`[free-port] ${port} ok`)
    }
    return
  }
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore', shell: true })
    console.log(`[free-port] cleared ${port}`)
  } catch {
    console.log(`[free-port] ${port} ok`)
  }
}

for (const port of ports) freePort(port)
