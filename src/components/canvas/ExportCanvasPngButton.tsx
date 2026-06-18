import { useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Button } from '@/components/ui/primitives'
import { useEditorStore } from '@/store/editorStore'
import {
  exportCanvasToPng,
  registerCanvasPngExport,
  sanitizeExportFileName,
  triggerCanvasPngExport,
} from '@/lib/exportCanvasPng'

export function useCanvasPngExport() {
  const reactFlow = useReactFlow()
  const { project, canvas } = useEditorStore()
  const [exporting, setExporting] = useState(false)

  const exportPng = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    try {
      const fileName = `${sanitizeExportFileName(project?.name ?? 'project')}-${sanitizeExportFileName(canvas?.name ?? 'canvas')}`
      await exportCanvasToPng(reactFlow, fileName)
    } finally {
      setExporting(false)
    }
  }, [exporting, reactFlow, project?.name, canvas?.name])

  return { exportPng, exporting }
}

export function ExportCanvasPngButton() {
  const { exportPng, exporting } = useCanvasPngExport()

  return (
    <Button size="sm" disabled={exporting} onClick={() => void exportPng()}>
      {exporting ? '导出中…' : '导出 PNG'}
    </Button>
  )
}

export function ExportCanvasPngHeaderButton({ compact }: { compact?: boolean } = {}) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setError(null)
    try {
      await triggerCanvasPngExport()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
      window.setTimeout(() => setError(null), 4000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button size="sm" disabled={exporting} className="whitespace-nowrap shrink-0" onClick={() => void handleExport()}>
        {exporting ? '导出中…' : compact ? 'PNG' : '导出 PNG'}
      </Button>
      {error && !compact && <span className="text-xs text-red-600 max-w-[8rem] truncate" title={error}>{error}</span>}
    </div>
  )
}

export function CanvasPngExportRegistrar() {
  const { exportPng } = useCanvasPngExport()

  useEffect(() => {
    registerCanvasPngExport(exportPng)
    return () => registerCanvasPngExport(null)
  }, [exportPng])

  return null
}
