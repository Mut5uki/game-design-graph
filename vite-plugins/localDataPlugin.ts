import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'

const DATA_DIR = path.resolve(process.cwd(), 'data/projects')

function isSafeProjectId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 128
}

function projectFilePath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`)
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function syncPublicProjectAfterSave(projectId: string): Promise<void> {
  try {
    const mod = await import(
      pathToFileURL(path.resolve(process.cwd(), 'scripts/lib/publicProjectSync.mjs')).href
    )
    await mod.syncProjectFile(`${projectId}.json`)
    await mod.rebuildPublicIndex()
  } catch (err) {
    console.warn('[local-data] sync public/projects failed:', err)
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function handleLocalData(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
): Promise<void> {
  if (url === '/api/local-data/health') {
    await ensureDataDir()
    sendJson(res, 200, { ok: true, dataDir: DATA_DIR })
    return
  }

  if (url === '/api/local-data/projects' && req.method === 'GET') {
    await ensureDataDir()
    const files = await fs.readdir(DATA_DIR)
    const metas = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const id = file.slice(0, -5)
      try {
        const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8')
        const snapshot = JSON.parse(raw) as {
          project?: { id?: string; name?: string; updatedAt?: number }
          exportedAt?: number
        }
        const project = snapshot.project
        if (!project?.id) continue
        metas.push({
          id: project.id,
          name: project.name ?? id,
          updatedAt: project.updatedAt ?? 0,
          exportedAt: snapshot.exportedAt ?? 0,
        })
      } catch {
        // 跳过损坏文件
      }
    }
    metas.sort((a, b) => b.updatedAt - a.updatedAt)
    sendJson(res, 200, metas)
    return
  }

  const projectMatch = url.match(/^\/api\/local-data\/projects\/([^/?#]+)$/)
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1])
    if (!isSafeProjectId(projectId)) {
      sendJson(res, 400, { error: '无效的项目 ID' })
      return
    }

    const filePath = projectFilePath(projectId)

    if (req.method === 'GET') {
      try {
        const raw = await fs.readFile(filePath, 'utf8')
        sendJson(res, 200, JSON.parse(raw))
      } catch {
        sendJson(res, 404, { error: '项目不存在' })
      }
      return
    }

    if (req.method === 'PUT') {
      const body = await readBody(req)
      const snapshot = JSON.parse(body)
      if (!snapshot?.project?.id || snapshot.project.id !== projectId) {
        sendJson(res, 400, { error: '快照与项目 ID 不匹配' })
        return
      }
      await ensureDataDir()
      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8')
      void syncPublicProjectAfterSave(projectId)
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'DELETE') {
      try {
        await fs.unlink(filePath)
        sendJson(res, 200, { ok: true })
      } catch {
        sendJson(res, 404, { error: '项目不存在' })
      }
      return
    }
  }

  sendJson(res, 404, { error: 'Not found' })
}

function attachMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''
    if (!url.startsWith('/api/local-data')) {
      next()
      return
    }
    void handleLocalData(req, res, url).catch((err) => {
      console.error('[local-data]', err)
      sendJson(res, 500, { error: '服务器错误' })
    })
  })
}

export function localDataPlugin(): Plugin {
  return {
    name: 'local-data-storage',
    configureServer(server) {
      attachMiddleware(server)
    },
    configurePreviewServer(server) {
      attachMiddleware(server)
    },
  }
}
