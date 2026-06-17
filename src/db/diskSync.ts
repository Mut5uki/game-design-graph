import type { ProjectDiskMeta, ProjectSnapshot } from '@/domain/types/projectSnapshot'
import { db } from './index'
import { exportProjectSnapshot, importProjectSnapshot } from './snapshotOps'

let diskAvailable = false
let dataDir: string | null = null

export function isDiskStorageAvailable(): boolean {
  return diskAvailable
}

export function getDiskDataDir(): string | null {
  return dataDir
}

export async function checkDiskStorage(): Promise<boolean> {
  try {
    const res = await fetch('/api/local-data/health')
    if (!res.ok) {
      diskAvailable = false
      dataDir = null
      return false
    }
    const body = (await res.json()) as { ok: boolean; dataDir?: string }
    diskAvailable = body.ok
    dataDir = body.dataDir ?? null
    return diskAvailable
  } catch {
    diskAvailable = false
    dataDir = null
    return false
  }
}

async function listDiskProjects(): Promise<ProjectDiskMeta[]> {
  const res = await fetch('/api/local-data/projects')
  if (!res.ok) throw new Error('读取硬盘项目列表失败')
  return (await res.json()) as ProjectDiskMeta[]
}

async function fetchDiskSnapshot(projectId: string): Promise<ProjectSnapshot> {
  const res = await fetch(`/api/local-data/projects/${encodeURIComponent(projectId)}`)
  if (!res.ok) throw new Error('读取硬盘项目失败')
  return (await res.json()) as ProjectSnapshot
}

/** 启动时从硬盘拉取较新的项目到 IndexedDB */
export async function hydrateFromDisk(): Promise<void> {
  if (!(await checkDiskStorage())) return

  const metas = await listDiskProjects()
  for (const meta of metas) {
    const local = await db.projects.get(meta.id)
    if (!local || meta.updatedAt > local.updatedAt) {
      const snapshot = await fetchDiskSnapshot(meta.id)
      await importProjectSnapshot(snapshot)
    }
  }
}

export async function syncProjectToDisk(projectId: string): Promise<void> {
  if (!diskAvailable) return

  const snapshot = await exportProjectSnapshot(projectId)
  if (!snapshot) return

  const res = await fetch(`/api/local-data/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
  if (!res.ok) throw new Error('写入硬盘失败')
}

export async function deleteProjectFromDisk(projectId: string): Promise<void> {
  if (!diskAvailable) await checkDiskStorage()
  if (!diskAvailable) return

  const res = await fetch(`/api/local-data/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) throw new Error('删除硬盘备份失败')
}

/** 后台写入硬盘，不阻塞 UI */
export function queueProjectDiskSync(projectId: string): void {
  void (async () => {
    if (!diskAvailable) await checkDiskStorage()
    if (!diskAvailable) return
    await syncProjectToDisk(projectId)
  })().catch((err) => {
    console.warn('[diskSync] 写入硬盘失败:', err)
  })
}
