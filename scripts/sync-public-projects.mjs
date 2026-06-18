/**
 * 将 data/projects/*.json 同步到 public/projects/（供 GitHub Pages 静态加载）
 * 会移除 DeepSeek API Key，避免提交到公开仓库。
 *
 * 用法：node scripts/sync-public-projects.mjs [projectId.json ...]
 */

import { syncAllPublicProjects } from './lib/publicProjectSync.mjs'

const args = process.argv.slice(2)
await syncAllPublicProjects(args.length ? args : null)
