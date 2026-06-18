#!/usr/bin/env node
/**
 * 同步 data/projects → public/projects，并 git 提交 + 推送项目 JSON。
 * 用法：npm run push:projects
 */

import { execSync } from 'node:child_process'
import { syncAllPublicProjects } from './lib/publicProjectSync.mjs'

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
}

async function main() {
  await syncAllPublicProjects()
  run('git add public/projects')
  try {
    run('git diff --cached --quiet public/projects')
    console.log('[push:projects] public/projects 无变更，跳过提交')
    return
  } catch {
    // 有变更
  }
  run('git commit -m "sync public project snapshots."')
  run('git push origin master')
  console.log('[push:projects] 已推送 public/projects')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
