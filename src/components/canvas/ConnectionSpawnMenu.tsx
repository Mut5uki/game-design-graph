import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DesignNode, NodeType, RelationType } from '@/domain/types'
import { getCreatableNodeTypes, getNodeMeta } from '@/domain/templates/nodeTemplates'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'
import { RelationTypeChips } from './RelationTypeChips'

interface ConnectionSpawnMenuProps {
  x: number
  y: number
  sourceNodeId: string
  nodes: DesignNode[]
  hasAiKey: boolean
  onConnectExisting: (targetId: string, relationType: RelationType) => void
  onCreateNode: (type: NodeType, relationType: RelationType, name?: string) => void
  onCreateNodeWithAi: (name: string, type: NodeType, relationType: RelationType) => Promise<void>
  onClose: () => void
}

export function ConnectionSpawnMenu({
  x,
  y,
  sourceNodeId,
  nodes,
  hasAiKey,
  onConnectExisting,
  onCreateNode,
  onCreateNodeWithAi,
  onClose,
}: ConnectionSpawnMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [relationType, setRelationType] = useState<RelationType>('requires')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const customNodeTypes = useEditorStore((s) => s.project?.settings.customNodeTypes)
  const creatableTypes = useMemo(() => getCreatableNodeTypes(), [customNodeTypes])

  const sourceNode = nodes.find((n) => n.id === sourceNodeId)
  const trimmedName = query.trim()

  const candidates = useMemo(() => {
    const q = trimmedName.toLowerCase()
    return nodes.filter((n) => {
      if (n.id === sourceNodeId || n.type === 'group') return false
      if (!q) return true
      const meta = getNodeMeta(n.type)
      return (
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q)
      )
    })
  }, [nodes, trimmedName, sourceNodeId])

  const hasExactNameMatch = useMemo(() => {
    if (!trimmedName) return false
    const q = trimmedName.toLowerCase()
    return nodes.some((n) => n.id !== sourceNodeId && n.type !== 'group' && n.name.toLowerCase() === q)
  }, [nodes, trimmedName, sourceNodeId])

  const { exactCandidates, similarCandidates } = useMemo(() => {
    if (!trimmedName) {
      return { exactCandidates: candidates, similarCandidates: [] as DesignNode[] }
    }
    const q = trimmedName.toLowerCase()
    const exact = candidates.filter((n) => n.name.toLowerCase() === q)
    const similar = candidates.filter((n) => n.name.toLowerCase() !== q)
    return { exactCandidates: exact, similarCandidates: similar }
  }, [candidates, trimmedName])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (aiLoading) return
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !aiLoading) onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, aiLoading])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
  }, [x, y, candidates.length, trimmedName, aiLoading])

  async function handleAiCreate(type: NodeType) {
    if (!trimmedName || aiLoading) return
    setAiError(null)
    setAiLoading(true)
    try {
      await onCreateNodeWithAi(trimmedName, type, relationType)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI 补全失败')
      setAiLoading(false)
    }
  }

  return (
    <div
      ref={ref}
      className="fixed z-[110] w-[280px] rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="text-xs text-gray-500">从</div>
        <div className="font-medium text-sm text-gray-800 truncate">
          {sourceNode?.name ?? sourceNodeId}
        </div>
        <div className="mt-2">
          <p className="text-[10px] text-gray-400 mb-1">关系类型</p>
          <RelationTypeChips value={relationType} onChange={setRelationType} compact />
        </div>
      </div>

      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAiError(null)
          }}
          disabled={aiLoading}
          placeholder="搜索节点，或输入新节点名称…"
          className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-gray-50"
        />
      </div>

      {trimmedName && (
        <div className="px-2 py-2 border-b border-gray-100 bg-sky-50/50">
          <p className="px-1 pb-1.5 text-[10px] font-medium text-sky-700 uppercase tracking-wide">
            AI 补全创建
          </p>
          {!hasAiKey ? (
            <p className="px-1 text-xs text-gray-500">
              需先配置 DeepSeek API Key。
              <Link to="/settings" className="text-blue-600 hover:underline ml-1">
                前往设置
              </Link>
            </p>
          ) : (
            <>
              <p className="px-1 pb-1.5 text-[10px] text-gray-500">
                仅输入名称「{trimmedName}」，AI 将补全描述与属性
              </p>
              <div className="grid grid-cols-2 gap-1">
                {creatableTypes.map((t) => (
                  <button
                    key={`ai-${t.type}`}
                    type="button"
                    disabled={aiLoading}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-left',
                      'hover:bg-white border border-sky-100 hover:border-sky-200 bg-white/80',
                      'disabled:opacity-50 disabled:pointer-events-none',
                    )}
                    onClick={() => handleAiCreate(t.type as NodeType)}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-gray-700 truncate">{t.label}</span>
                    <span className="ml-auto text-sky-500 text-[10px]">AI</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {aiError && (
            <p className="px-1 pt-1.5 text-[10px] text-red-600">{aiError}</p>
          )}
        </div>
      )}

      {aiLoading && (
        <div className="px-3 py-2 text-xs text-sky-600 border-b border-gray-100 flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
          AI 正在补全节点信息…
        </div>
      )}

      {trimmedName && !hasExactNameMatch && (
        <p className="px-3 pt-1 text-[10px] text-sky-600">
          画布上没有名为「{trimmedName}」的节点，请用下方 AI 补全或空白创建
        </p>
      )}

      <div className="max-h-[160px] overflow-y-auto py-1">
        {exactCandidates.length === 0 && similarCandidates.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">
            {trimmedName ? '没有名称完全匹配的现有节点' : '没有可连接的节点'}
          </p>
        ) : (
          <>
            {exactCandidates.map((n) => {
              const meta = getNodeMeta(n.type)
              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={aiLoading}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => onConnectExisting(n.id, relationType)}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-xs text-gray-400 shrink-0">{meta.label}</span>
                  <span className="truncate text-gray-800">{n.name}</span>
                </button>
              )
            })}
            {similarCandidates.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-0.5 text-[10px] text-amber-600">
                  {trimmedName
                    ? '以下为名称相似的已有节点（不会自动创建新块）'
                    : '其它可连接节点'}
                </p>
                {similarCandidates.map((n) => {
                  const meta = getNodeMeta(n.type)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      disabled={aiLoading}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-amber-50/60 disabled:opacity-50"
                      onClick={() => onConnectExisting(n.id, relationType)}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-xs text-gray-400 shrink-0">{meta.label}</span>
                      <span className="truncate text-gray-800">{n.name}</span>
                    </button>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      <div className="border-t border-gray-100 px-2 py-2">
        <p className="px-1 pb-1.5 text-[10px] text-gray-400 uppercase tracking-wide">
          {trimmedName ? '创建空白节点（不调用 AI）' : '创建并连接'}
        </p>
        <div className="grid grid-cols-2 gap-1">
          {creatableTypes.map((t) => (
            <button
              key={t.type}
              type="button"
              disabled={aiLoading}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-left',
                'hover:bg-gray-50 border border-transparent hover:border-gray-200',
                'disabled:opacity-50',
              )}
              onClick={() => onCreateNode(t.type as NodeType, relationType, trimmedName || undefined)}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className="text-gray-700 truncate">
                {trimmedName ? trimmedName : t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
