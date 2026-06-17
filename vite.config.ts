import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { localDataPlugin } from './vite-plugins/localDataPlugin'

/** GitHub Pages 项目站（/repo/）或自定义子路径；也可设环境变量 VITE_BASE_PATH */
function resolvePagesBase(): string {
  const explicit = process.env.VITE_BASE_PATH?.trim()
  if (explicit) {
    const normalized = explicit.startsWith('/') ? explicit : `/${explicit}`
    return normalized.endsWith('/') ? normalized : `${normalized}/`
  }

  const appUrl = process.env.VITE_PUBLIC_APP_URL?.trim()
  if (appUrl) {
    try {
      const pathname = new URL(appUrl).pathname
      if (pathname && pathname !== '/') {
        return pathname.endsWith('/') ? pathname : `${pathname}/`
      }
    } catch {
      // ignore invalid URL
    }
  }

  return '/'
}

export default defineConfig({
  base: resolvePagesBase(),
  plugins: [react(), tailwindcss(), localDataPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3888,
    strictPort: true,
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
})
