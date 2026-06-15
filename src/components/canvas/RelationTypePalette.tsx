import { useMemo, useState } from 'react'
import { CUSTOM_COLOR_PRESETS } from '@/domain/templates/nodeTypeRegistry'
import {
  isCustomRelationType,
  getBuiltinRelationColor,
  getRelationOptions,
} from '@/domain/templates/relationTypeRegistry'
import type { RelationType } from '@/domain/types'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

interface RelationTypePaletteProps {
  collapsed: boolean
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {CUSTOM_COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'w-4 h-4 rounded-full border-2',
            value === c ? 'border-gray-800' : 'border-transparent',
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function RelationTypeEditor({
  type,
  label,
  color,
  isCustom,
  defaultColor,
  inUse,
  onSave,
  onDelete,
  onResetColor,
  onCancel,
}: {
  type: string
  label: string
  color: string
  isCustom: boolean
  defaultColor?: string
  inUse: boolean
  onSave: (label: string, color: string) => Promise<void>
  onDelete: () => Promise<void>
  onResetColor?: () => Promise<void>
  onCancel: () => void
}) {
  const [editLabel, setEditLabel] = useState(label)
  const [editColor, setEditColor] = useState(color)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const colorChanged = editColor !== color
  const labelChanged = isCustom && editLabel.trim() !== label
  const canSave = (colorChanged || labelChanged) && (!isCustom || editLabel.trim().length > 0)

  async function handleSave() {
    if (!canSave) return
    setBusy(true)
    setLocalError(null)
    try {
      await onSave(editLabel.trim(), editColor)
    } catch {
      setLocalError('保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (inUse) {
      setLocalError('该关系仍被连线使用，无法删除')
      return
    }
    if (!window.confirm(`确定删除关系「${label}」？`)) return
    setBusy(true)
    setLocalError(null)
    try {
      await onDelete()
    } catch {
      setLocalError('删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1 p-2 rounded-md border border-violet-200 bg-violet-50/40 space-y-2">
      {isCustom && (
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          placeholder="关系名称"
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-violet-400 bg-white"
        />
      )}
      <ColorSwatches value={editColor} onChange={setEditColor} />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!canSave || busy}
          onClick={handleSave}
          className="flex-1 text-xs py-1 rounded bg-violet-600 text-white disabled:opacity-40"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 text-xs py-1 rounded border border-gray-200 text-gray-600 bg-white"
        >
          取消
        </button>
      </div>
      {!isCustom && defaultColor && onResetColor && colorChanged && (
        <button
          type="button"
          onClick={onResetColor}
          disabled={busy}
          className="w-full text-[10px] py-1 rounded border border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
        >
          恢复默认颜色
        </button>
      )}
      {isCustom && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="w-full text-[10px] py-1 rounded border border-red-200 text-red-600 bg-white hover:bg-red-50 disabled:opacity-40"
        >
          删除关系
        </button>
      )}
      {localError && <p className="text-[10px] text-red-500">{localError}</p>}
      {!isCustom && <p className="text-[10px] text-gray-400">内置关系仅可改颜色</p>}
      {isCustom && inUse && <p className="text-[10px] text-gray-400">有连线使用时不可删除</p>}
      <p className="text-[10px] text-gray-300 truncate" title={type}>
        {type}
      </p>
    </div>
  )
}

export function RelationTypePalette({ collapsed }: RelationTypePaletteProps) {
  const customRelationTypes = useEditorStore((s) => s.project?.settings.customRelationTypes)
  const colorOverrides = useEditorStore((s) => s.project?.settings.relationTypeColorOverrides)
  const relationOptions = useMemo(
    () => getRelationOptions(),
    [customRelationTypes, colorOverrides],
  )
  const edges = useEditorStore((s) => s.edges)

  const addCustomRelationType = useEditorStore((s) => s.addCustomRelationType)
  const updateCustomRelationType = useEditorStore((s) => s.updateCustomRelationType)
  const setRelationTypeColor = useEditorStore((s) => s.setRelationTypeColor)
  const resetRelationTypeColor = useEditorStore((s) => s.resetRelationTypeColor)
  const removeCustomRelationType = useEditorStore((s) => s.removeCustomRelationType)

  const [adding, setAdding] = useState(false)
  const [editingType, setEditingType] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(CUSTOM_COLOR_PRESETS[3])
  const [error, setError] = useState<string | null>(null)

  if (collapsed) return null

  async function handleAddType() {
    if (!newLabel.trim()) return
    setError(null)
    const def = await addCustomRelationType(newLabel.trim(), newColor)
    if (!def) {
      setError('添加失败')
      return
    }
    setNewLabel('')
    setAdding(false)
  }

  return (
    <div className="w-44 border-r border-gray-200 bg-white flex flex-col max-h-[45%] min-h-0 shrink-0">
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-xs font-medium text-gray-500">关系类型</span>
      </div>

      <div className="p-2 space-y-1 overflow-y-auto flex-1 min-h-0">
        {relationOptions.map((r) => {
          const isCustom = isCustomRelationType(r.type)
          const inUse = edges.some((e) => e.relationType === (r.type as RelationType))
          const defaultColor = getBuiltinRelationColor(r.type)
          const isEditing = editingType === r.type

          return (
            <div key={r.type}>
              <div className="group flex items-center gap-0.5">
                <div
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-gray-700',
                    isEditing && 'bg-violet-50 border border-violet-200',
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="truncate text-xs">{r.label}</span>
                </div>
                <button
                  type="button"
                  title="编辑关系"
                  onClick={() => {
                    setAdding(false)
                    setError(null)
                    setEditingType(isEditing ? null : r.type)
                  }}
                  className={cn(
                    'shrink-0 w-6 h-6 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50 text-[10px]',
                    isEditing
                      ? 'opacity-100 text-violet-600 bg-violet-50'
                      : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  ✎
                </button>
              </div>
              {isEditing && (
                <RelationTypeEditor
                  type={r.type}
                  label={r.label}
                  color={r.color}
                  isCustom={isCustom}
                  defaultColor={defaultColor}
                  inUse={inUse}
                  onCancel={() => setEditingType(null)}
                  onSave={async (label, color) => {
                    if (isCustom) {
                      const ok = await updateCustomRelationType(r.type, { label, color })
                      if (!ok) throw new Error('save failed')
                    } else {
                      const ok = await setRelationTypeColor(r.type, color)
                      if (!ok) throw new Error('save failed')
                    }
                    setEditingType(null)
                  }}
                  onDelete={async () => {
                    const ok = await removeCustomRelationType(r.type)
                    if (!ok) throw new Error('delete failed')
                    setEditingType(null)
                  }}
                  onResetColor={
                    defaultColor
                      ? async () => {
                          await resetRelationTypeColor(r.type)
                          setEditingType(null)
                        }
                      : undefined
                  }
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="p-2 border-t border-gray-100 shrink-0">
        {adding ? (
          <div className="space-y-2 p-2 rounded-md border border-violet-200 bg-violet-50/30">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="新关系名称，如「包含」"
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-violet-400 bg-white"
              onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
              autoFocus
            />
            <ColorSwatches value={newColor} onChange={setNewColor} />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleAddType}
                disabled={!newLabel.trim()}
                className="flex-1 text-xs py-1 rounded bg-violet-600 text-white disabled:opacity-40"
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setError(null)
                }}
                className="flex-1 text-xs py-1 rounded border border-gray-200 text-gray-600 bg-white"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingType(null)
              setAdding(true)
              setError(null)
            }}
            className="w-full py-1.5 text-xs text-violet-600 hover:bg-violet-50 rounded-md border border-dashed border-violet-200"
          >
            + 自定义关系
          </button>
        )}
        {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  )
}
