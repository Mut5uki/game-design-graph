import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProjectListPage } from './ProjectListPage'
import { EditorPage } from './EditorPage'
import { SettingsPage } from './SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/project/:projectId" element={<EditorPage />} />
        <Route path="/project/:projectId/canvas/:canvasId" element={<EditorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
