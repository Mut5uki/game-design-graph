/**
 * 将 data/projects/*.json 同步到 public/projects/（脱敏 API Key，供 Git 提交与 Pages 加载）
 */

import fs from 'fs/promises'
import path from 'path'

const root = process.cwd()
export const dataDir = path.join(root, 'data/projects')
export const publicDir = path.join(root, 'public/projects')

export function sanitizeSnapshot(snapshot) {
  const copy = structuredClone(snapshot)
  if (copy.project?.settings?.deepseekApiKeyEncrypted) {
    delete copy.project.settings.deepseekApiKeyEncrypted
  }
  return copy
}

export function toMeta(snapshot) {
  return {
    id: snapshot.project.id,
    name: snapshot.project.name ?? snapshot.project.id,
    updatedAt: snapshot.project.updatedAt ?? 0,
    exportedAt: snapshot.exportedAt ?? 0,
  }
}

/** @returns {Promise<string | null>} project id */
export async function syncProjectFile(fileName) {
  const file = fileName.endsWith('.json') ? fileName : `${fileName}.json`
  const raw = await fs.readFile(path.join(dataDir, file), 'utf8')
  const snapshot = sanitizeSnapshot(JSON.parse(raw))
  const id = snapshot.project?.id
  if (!id) {
    console.warn(`[skip] ${file} 无 project.id`)
    return null
  }
  await fs.mkdir(publicDir, { recursive: true })
  await fs.writeFile(path.join(publicDir, `${id}.json`), JSON.stringify(snapshot, null, 2), 'utf8')
  console.log(`[ok] public/projects/${id}.json`)
  return id
}

export async function rebuildPublicIndex() {
  await fs.mkdir(publicDir, { recursive: true })
  const files = await fs.readdir(publicDir)
  const metas = []
  for (const file of files) {
    if (!file.endsWith('.json') || file === 'index.json') continue
    try {
      const raw = await fs.readFile(path.join(publicDir, file), 'utf8')
      const snapshot = JSON.parse(raw)
      if (snapshot.project?.id) metas.push(toMeta(snapshot))
    } catch {
      // skip
    }
  }

  metas.sort((a, b) => b.updatedAt - a.updatedAt)
  await fs.writeFile(path.join(publicDir, 'index.json'), JSON.stringify(metas, null, 2), 'utf8')
  console.log(`[ok] public/projects/index.json (${metas.length} 项)`)
}

/** @param {string[] | null} [fileNames] */
export async function syncAllPublicProjects(fileNames = null) {
  await fs.mkdir(dataDir, { recursive: true })
  let files = fileNames
  if (!files?.length) {
    const all = await fs.readdir(dataDir)
    files = all.filter((f) => f.endsWith('.json'))
  }

  for (const file of files) {
    await syncProjectFile(file)
  }

  await rebuildPublicIndex()
}
