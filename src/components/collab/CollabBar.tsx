import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCollabShareUrl, readCollabSettingsForUi } from '@/collab/useCollab'
import { isInviteUrlLocalhostOnly } from '@/collab/publicUrls'
import { saveCollabSettings, buildCollabRoomId } from '@/collab/types'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

interface CollabBarProps {
  projectId: string
  canvasId: string
  /** 顶栏单行紧凑布局（桌面） */
  compact?: boolean
}

export function CollabBar({ projectId, canvasId, compact = false }: CollabBarProps) {
  const collabEnabled = useEditorStore((s) => s.collabEnabled)
  const collabStatus = useEditorStore((s) => s.collabStatus)
  const collabPeers = useEditorStore((s) => s.collabPeers)
  const collabError = useEditorStore((s) => s.collabError)
  const startCollab = useEditorStore((s) => s.startCollab)
  const stopCollab = useEditorStore((s) => s.stopCollab)

  const [copied, setCopied] = useState(false)
  const [copyWarn, setCopyWarn] = useState<string | null>(null)
  const settings = readCollabSettingsForUi()
  const inviteLocalhost = isInviteUrlLocalhostOnly()
  const remotePeerCount = collabPeers.length
  const totalOnline = remotePeerCount + (collabStatus === 'connected' ? 1 : 0)

  const statusLabel = useMemo(() => {
    switch (collabStatus) {
      case 'connecting':
        return compact ? '连接中' : '协作 · 连接中…'
      case 'connected':
        if (remotePeerCount > 0) {
          return compact ? `${totalOnline} 人在线` : `协作 · ${totalOnline} 人在线`
        }
        return compact ? '等待加入' : '协作 · 等待同伴加入'
      case 'error':
        return collabError ?? '连接失败'
      default:
        return compact ? '' : '协作'
    }
  }, [collabStatus, remotePeerCount, totalOnline, collabError, compact])

  const waitingHint = useMemo(() => {
    if (compact) return null
    if (!collabEnabled || collabStatus !== 'connected' || remotePeerCount > 0) return null
    if (!settings.inviteBaseUrl.trim()) {
      return '请先在设置填写樱花公网地址，并运行 start-with-sakurafrp.bat。'
    }
    return '请复制邀请链接发给同伴；对方打开链接后会自动加入。'
  }, [collabEnabled, collabStatus, remotePeerCount, settings.inviteBaseUrl, compact])

  const handleToggle = () => {
    if (collabEnabled) {
      stopCollab()
      return
    }
    const s = readCollabSettingsForUi()
    if (!s.inviteBaseUrl.trim()) {
      useEditorStore.setState({
        collabError: '请先在设置填写樱花公网地址',
        collabStatus: 'error',
      })
      return
    }
    if (!s.displayName.trim()) {
      const name = `策划-${Math.floor(Math.random() * 900 + 100)}`
      saveCollabSettings({ ...s, displayName: name })
    }
    useEditorStore.setState({ collabError: null, collabStatus: 'offline' })
    startCollab(buildCollabRoomId(projectId, canvasId))
  }

  const handleCopyLink = async () => {
    const url = getCollabShareUrl(projectId, canvasId)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (inviteLocalhost) {
      setCopyWarn(compact ? '链接仍是 localhost' : '链接仍是 localhost。请到设置填写樱花公网地址。')
    } else {
      setCopyWarn(compact ? '已复制邀请链接' : '已复制。发给同伴打开即可（含 ?collab=1）。')
    }
    if (compact) {
      setTimeout(() => setCopyWarn(null), 2500)
    }
  }

  const statusClass = cn(
    'text-[11px] whitespace-nowrap shrink-0',
    collabStatus === 'connected' && remotePeerCount > 0
      ? 'text-emerald-600'
      : collabStatus === 'connected'
        ? 'text-amber-600'
        : collabStatus === 'error'
          ? 'text-red-600'
          : 'text-gray-400',
  )

  const peerBadges = collabPeers.length > 0 && (
    <div className="flex items-center gap-0.5 shrink-0">
      {collabPeers.slice(0, compact ? 2 : 5).map((p) => (
        <span
          key={p.clientId}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0',
            compact ? 'px-1.5 py-0.5 text-[10px] max-w-[4.5rem] truncate' : 'px-2 py-0.5 text-[10px]',
          )}
          title={`${p.name}${p.selectedNodeIds.length ? ` · 选中 ${p.selectedNodeIds.length} 个节点` : ''}`}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          {!compact && p.name}
        </span>
      ))}
      {compact && collabPeers.length > 2 && (
        <span className="text-[10px] text-gray-400">+{collabPeers.length - 2}</span>
      )}
    </div>
  )

  const mainRow = (
    <div
      className={cn(
        'flex items-center gap-1.5',
        compact ? 'flex-nowrap shrink-0' : 'flex-wrap justify-end',
      )}
    >
      <Button
        size="sm"
        variant={collabEnabled ? 'primary' : 'ghost'}
        className={cn(
          'text-xs shrink-0 whitespace-nowrap',
          collabEnabled && collabStatus === 'connected' && remotePeerCount > 0 && 'bg-emerald-600 hover:bg-emerald-700',
          collabEnabled && collabStatus === 'connected' && remotePeerCount === 0 && 'bg-amber-500 hover:bg-amber-600',
        )}
        onClick={handleToggle}
      >
        {collabEnabled ? (compact ? '退出' : '退出协作') : compact ? '协作' : '开始协作'}
      </Button>

      {collabEnabled && statusLabel && (
        <span className={statusClass} title={waitingHint ?? statusLabel}>
          {statusLabel}
        </span>
      )}

      {collabEnabled && collabStatus === 'connected' && (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs shrink-0 whitespace-nowrap px-2"
          onClick={handleCopyLink}
          title="复制邀请链接（含 ?collab=1）"
        >
          {copied ? '已复制' : compact ? '复制链接' : '复制邀请链接'}
        </Button>
      )}

      {!collabEnabled && collabStatus === 'error' && collabError && (
        <span
          className={cn(
            'text-[11px] text-red-600 shrink-0',
            compact ? 'max-w-[10rem] truncate' : 'max-w-xs text-right',
          )}
          title={collabError}
        >
          {collabError}
        </span>
      )}

      {peerBadges}

      {!collabEnabled && !compact && (
        <Link to="/settings#collab" className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0">
          樱花协作设置
        </Link>
      )}
    </div>
  )

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 shrink-0 border-l border-gray-200 pl-2 ml-1">
        {mainRow}
        {copyWarn && (
          <span className="text-[10px] text-amber-600 whitespace-nowrap max-w-[7rem] truncate" title={copyWarn}>
            {copyWarn}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch gap-1 w-full">
      {mainRow}
      {waitingHint && (
        <p className="text-[10px] text-amber-700 leading-snug">{waitingHint}</p>
      )}
      {copyWarn && !compact && (
        <p className="text-[10px] text-amber-600 leading-snug">{copyWarn}</p>
      )}
      {!collabEnabled && inviteLocalhost && (
        <p className="text-[10px] text-amber-600">
          尚未配置樱花公网地址，
          <Link to="/settings#collab" className="underline ml-0.5">去设置</Link>
        </p>
      )}
    </div>
  )
}
