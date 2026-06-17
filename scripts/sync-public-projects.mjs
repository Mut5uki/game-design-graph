/**
 * 将 data/projects/*.json 同步到 public/projects/（供 GitHub Pages 静态加载）
 * 会移除 DeepSeek API Key，避免提交到公开仓库。
 *
 * 用法：node scripts/sync-public-projects.mjs [projectId.json ...]
 */

import fs from 'fs/promises'
import path from 'path'

const root = process.cwd()
const dataDir = path.join(root, 'data/projects')
const publicDir = path.join(root, 'public/projects')

function sanitizeSnapshot(snapshot) {
  const copy = structuredClone(snapshot)
  if (copy.project?.settings?.deepseekApiKeyEncrypted) {
    delete copy.project.settings.deepseekApiKeyEncrypted
  }
  return copy
}

function toMeta(snapshot) {
  return {
    id: snapshot.project.id,
    name: snapshot.project.name ?? snapshot.project.id,
    updatedAt: snapshot.project.updatedAt ?? 0,
    exportedAt: snapshot.exportedAt ?? 0,
  }
}

async function main() {
  const args = process.argv.slice(2)
  await fs.mkdir(publicDir, { recursive: true })

  let files
  if (args.length) {
    files = args.map((f) => (f.endsWith('.json') ? f : `${f}.json`))
  } else {
    const all = await fs.readdir(dataDir)
    files = all.filter((f) => f.endsWith('.json'))
  }

  const metas = []

  for (const file of files) {
    const raw = await fs.readFile(path.join(dataDir, file), 'utf8')
    const snapshot = sanitizeSnapshot(JSON.parse(raw))
    const id = snapshot.project?.id
    if (!id) {
      console.warn(`[skip] ${file} 无 project.id`)
      continue
    }
    const outPath = path.join(publicDir, `${id}.json`)
    await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2), 'utf8')
    metas.push(toMeta(snapshot))
    console.log(`[ok] public/projects/${id}.json`)
  }

  metas.sort((a, b) => b.updatedAt - a.updatedAt)
  await fs.writeFile(path.join(publicDir, 'index.json'), JSON.stringify(metas, null, 2), 'utf8')
  console.log(`[ok] public/projects/index.json (${metas.length} 项)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
