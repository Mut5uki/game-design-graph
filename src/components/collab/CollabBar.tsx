import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getCollabShareUrl,
  readCollabSettingsForUi,
} from '@/collab/useCollab'
import { isInviteUrlLocalhostOnly } from '@/collab/publicUrls'
import { collabModeLabel, saveCollabSettings, buildCollabRoomId } from '@/collab/types'
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
  const collabMode = useEditorStore((s) => s.collabMode)
  const collabPeers = useEditorStore((s) => s.collabPeers)
  const collabWebrtcLinks = useEditorStore((s) => s.collabWebrtcLinks)
  const collabBcLinks = useEditorStore((s) => s.collabBcLinks)
  const collabError = useEditorStore((s) => s.collabError)
  const startCollab = useEditorStore((s) => s.startCollab)
  const stopCollab = useEditorStore((s) => s.stopCollab)

  const [copied, setCopied] = useState(false)
  const [copyWarn, setCopyWarn] = useState<string | null>(null)
  const settings = readCollabSettingsForUi()
  const activeMode = collabMode ?? settings.mode
  const inviteLocalhost = isInviteUrlLocalhostOnly()
  const remotePeerCount = collabPeers.length
  const totalOnline = remotePeerCount + (collabStatus === 'connected' ? 1 : 0)

  const statusLabel = useMemo(() => {
    const modeTag = collabModeLabel(activeMode)
    switch (collabStatus) {
      case 'connecting':
        return `${modeTag} · 连接中…`
      case 'connected':
        if (remotePeerCount > 0) {
          return `${modeTag} · ${totalOnline} 人在线`
        }
        return `${modeTag} · 已就绪，等待同伴加入`
      case 'error':
        return collabError ?? '连接失败'
      default:
        return modeTag
    }
  }, [collabStatus, remotePeerCount, totalOnline, collabError, activeMode])

  const waitingHint = useMemo(() => {
    if (!collabEnabled || collabStatus !== 'connected' || remotePeerCount > 0) return null
    if (collabWebrtcLinks > 0) return '数据通道已建立，正在等待对方同步…'
    if (collabBcLinks > 0) return '已检测到同浏览器其它标签页；跨设备需对方打开邀请链接并进入协作。'
    return '请复制邀请链接发给同伴；对方打开后也会自动加入（或手动点「开始协作」）。双方须同时在线。'
  }, [collabEnabled, collabStatus, remotePeerCount, collabWebrtcLinks, collabBcLinks])

  const handleToggle = () => {
    if (collabEnabled) {
      stopCollab()
      return
    }
    const s = readCollabSettingsForUi()
    if (!s.displayName.trim()) {
      const name = `策划-${Math.floor(Math.random() * 900 + 100)}`
      saveCollabSettings({ ...s, displayName: name })
    }
    useEditorStore.setState({ collabError: null, collabStatus: 'offline' })
    startCollab(buildCollabRoomId(projectId, canvasId), { mode: s.mode })
  }

  const handleCopyLink = async () => {
    const url = getCollabShareUrl(projectId, canvasId, activeMode)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (inviteLocalhost) {
      setCopyWarn('链接仍是 localhost，同事无法打开。请到设置填写「邀请链接地址」。')
    } else {
      setCopyWarn('已复制。请发给同伴，并确认对方也已进入协作（链接含 ?collab=1）。')
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5 max-w-lg">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Button
          size="sm"
          variant={collabEnabled ? 'primary' : 'ghost'}
          className={cn(
            'text-xs',
            collabEnabled && collabStatus === 'connected' && remotePeerCount > 0 && 'bg-emerald-600 hover:bg-emerald-700',
            collabEnabled && collabStatus === 'connected' && remotePeerCount === 0 && 'bg-amber-500 hover:bg-amber-600',
          )}
          onClick={handleToggle}
        >
          {collabEnabled ? '退出协作' : '开始协作'}
        </Button>

        {collabEnabled && (
          <>
            <span
              className={cn(
                'text-[11px]',
                collabStatus === 'connected' && remotePeerCount > 0
                  ? 'text-emerald-600'
                  : collabStatus === 'connected'
                    ? 'text-amber-600'
                    : collabStatus === 'error'
                      ? 'text-red-600'
                      : 'text-gray-400',
              )}
            >
              {statusLabel}
            </span>
            {collabStatus === 'connected' && (
              <Button size="sm" variant="ghost" className="text-xs" onClick={handleCopyLink}>
                {copied ? '已复制' : '复制邀请链接'}
              </Button>
            )}
          </>
        )}

        {!collabEnabled && collabStatus === 'error' && collabError && (
          <span className="text-[11px] text-red-600 max-w-xs text-right">{collabError}</span>
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
            协作设置 · {collabModeLabel(settings.mode)}
          </Link>
        )}
      </div>

      {waitingHint && (
        <p className="text-[10px] text-amber-700 max-w-md text-right leading-snug">{waitingHint}</p>
      )}
      {copyWarn && (
        <p className="text-[10px] text-amber-600 max-w-md text-right leading-snug">{copyWarn}</p>
      )}
      {!collabEnabled && inviteLocalhost && (
        <p className="text-[10px] text-amber-600 max-w-md text-right">
          邀请链接需公网/局域网地址，
          <Link to="/settings#collab" className="underline ml-0.5">去设置</Link>
        </p>
      )}
    </div>
  )
}
