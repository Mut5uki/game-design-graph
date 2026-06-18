#!/usr/bin/env node
/**
 * 协作主机启动：本机协作服务 (1234) + 前端 (3888)
 * 用法：npm run start:collab
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

/** @type {import('node:child_process').ChildProcess | null} */
let collabProc = null
/** @type {import('node:child_process').ChildProcess | null} */
let viteProc = null
let shuttingDown = false

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function freePorts(ports) {
  const script = path.join(root, 'scripts', 'free-port.mjs')
  spawnSync(process.execPath, [script, ...ports.map(String)], { cwd: root, stdio: 'inherit' })
}

function runNpm(args, cwd = root) {
  if (isWin) {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], {
      cwd,
      stdio: 'inherit',
    })
  }
  return spawn('npm', args, { cwd, stdio: 'inherit' })
}

function killTree(proc) {
  if (!proc || proc.killed || proc.exitCode != null) return
  try {
    if (isWin) {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { stdio: 'ignore', shell: true })
    } else {
      proc.kill('SIGTERM')
    }
  } catch {
    proc.kill('SIGKILL')
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  killTree(viteProc)
  killTree(collabProc)
  setTimeout(() => process.exit(code), 300)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const waitScript = path.join(root, 'scripts', 'wait-port.mjs')
    const wait = spawn(process.execPath, [waitScript, String(port), String(timeoutMs)], {
      cwd: root,
      stdio: 'inherit',
    })
    wait.on('exit', (code) => {
      if (code === 0) resolve(undefined)
      else reject(new Error(`port ${port} not ready`))
    })
  })
}

async function main() {
  console.log('[gdg] Releasing ports 1234 / 3888 (leftover from last run)...')
  freePorts(['1234', '3888'])
  await sleep(800)

  console.log('[gdg] Starting collab ws://127.0.0.1:1234 ...')
  collabProc = runNpm(['run', 'collab:server'])

  collabProc.on('exit', (code) => {
    if (shuttingDown) return
    if (code && code !== 0) console.error(`[gdg] Collab server exited (${code})`)
    shutdown(code ?? 0)
  })

  try {
    await waitForPort(1234, 60_000)
  } catch {
    console.error('[gdg] Collab not ready. Run: npm run collab:install')
    shutdown(1)
    return
  }

  console.log('[gdg] Starting frontend http://127.0.0.1:3888 ...')
  viteProc = runNpm(['run', 'start'])

  viteProc.on('exit', (code) => {
    if (code && code !== 0) console.error(`[gdg] Frontend exited (${code})`)
    shutdown(code ?? 0)
  })
}

main().catch((err) => {
  console.error('[gdg]', err.message ?? err)
  shutdown(1)
})
