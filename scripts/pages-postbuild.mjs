import fs from 'fs'
import path from 'path'

const dist = path.resolve('dist')
const index = path.join(dist, 'index.html')
const fallback = path.join(dist, '404.html')

if (!fs.existsSync(index)) {
  console.error('[pages-postbuild] dist/index.html 不存在，请先 npm run build')
  process.exit(1)
}

fs.copyFileSync(index, fallback)
console.log('[pages-postbuild] 已生成 dist/404.html（GitHub Pages SPA 回退）')
