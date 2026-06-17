import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { hydrateFromDisk } from '@/db/diskSync'
import { ProjectListPage } from './ProjectListPage'
import { EditorPage } from './EditorPage'
import { SettingsPage } from './SettingsPage'

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void hydrateFromDisk().finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center text-sm text-gray-400">
        正在加载本地数据…
      </div>
    )
  }

  return children
}

function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return base || undefined
}

export function App() {
  return (
    <AppBootstrap>
      <BrowserRouter basename={routerBasename()}>
        <Routes>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/project/:projectId" element={<EditorPage />} />
          <Route path="/project/:projectId/canvas/:canvasId" element={<EditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppBootstrap>
  )
}
