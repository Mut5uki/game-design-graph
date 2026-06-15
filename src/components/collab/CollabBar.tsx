import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getCollabShareUrl,
  readCollabSettingsForUi,
} from '@/collab/useCollab'
import { saveCollabSettings } from '@/collab/types'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

interface CollabBarProps {
  projectId: string
  canvasId: string
}

export function CollabBar({ projectId, canvasId }: CollabBarProps) {
  const collabEnabled = useEditorStore((s) => s.collabEnabled)
  const collabStatus = useEditorStore((s) => s.collabStatus)
  const collabPeers = useEditorStore((s) => s.collabPeers)
  const collabError = useEditorStore((s) => s.collabError)
  const startCollab = useEditorStore((s) => s.startCollab)
  const stopCollab = useEditorStore((s) => s.stopCollab)

  const [copied, setCopied] = useState(false)

  const statusLabel = useMemo(() => {
    switch (collabStatus) {
      case 'connecting':
        return '连接中…'
      case 'connected':
        return `已协作 · ${collabPeers.length + 1} 人在线`
      case 'error':
        return collabError ?? '连接失败'
      default:
        return '离线'
    }
  }, [collabStatus, collabPeers.length, collabError])

  const handleToggle = () => {
    if (collabEnabled) {
      stopCollab()
      return
    }
    const settings = readCollabSettingsForUi()
    if (!settings.displayName.trim()) {
      const name = `策划-${Math.floor(Math.random() * 900 + 100)}`
      saveCollabSettings({ ...settings, displayName: name })
    }
    startCollab(`${projectId}:${canvasId}`)
  }

  const handleCopyLink = async () => {
    const url = getCollabShareUrl(projectId, canvasId)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={collabEnabled ? 'primary' : 'ghost'}
        className={cn('text-xs', collabEnabled && collabStatus === 'connected' && 'bg-emerald-600 hover:bg-emerald-700')}
        onClick={handleToggle}
      >
        {collabEnabled ? '退出协作' : '开始协作'}
      </Button>

      {collabEnabled && (
        <>
          <span
            className={cn(
              'text-[11px]',
              collabStatus === 'connected' ? 'text-emerald-600' : 'text-gray-400',
            )}
          >
            {statusLabel}
          </span>
          <Button size="sm" variant="ghost" className="text-xs" onClick={handleCopyLink}>
            {copied ? '已复制' : '复制邀请链接'}
          </Button>
        </>
      )}

      {collabPeers.length > 0 && (
        <div className="flex items-center gap-1 ml-1">
          {collabPeers.map((p) => (
            <span
              key={p.clientId}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
              title={`${p.name}${p.selectedNodeIds.length ? ` · 选中 ${p.selectedNodeIds.length} 个节点` : ''}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      )}

      {!collabEnabled && (
        <Link to="/settings#collab" className="text-[10px] text-gray-400 hover:text-gray-600">
          协作设置
        </Link>
      )}
    </div>
  )
}
