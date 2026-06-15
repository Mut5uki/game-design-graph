import { useMemo, useState } from 'react'
import { getBuiltinNodeTypeColor, getPaletteNodeTypes } from '@/domain/templates/nodeTemplates'
import { CUSTOM_COLOR_PRESETS, isCustomNodeType } from '@/domain/templates/nodeTypeRegistry'
import type { NodeType } from '@/domain/types'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

interface NodePaletteProps {
  collapsed: boolean
  onToggle: () => void
  onAddNode: (type: NodeType) => void
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

function NodeTypeEditor({
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
      setLocalError('该类型仍被节点使用，无法删除')
      return
    }
    if (!window.confirm(`确定删除类型「${label}」？`)) return
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
    <div className="mt-1 p-2 rounded-md border border-blue-200 bg-blue-50/40 space-y-2">
      {isCustom && (
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          placeholder="类型名称"
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400 bg-white"
        />
      )}
      <ColorSwatches value={editColor} onChange={setEditColor} />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!canSave || busy}
          onClick={handleSave}
          className="flex-1 text-xs py-1 rounded bg-blue-600 text-white disabled:opacity-40"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 text-xs py-1 rounded border border-gray-200 text-gray-500 bg-white"
        >
          取消
        </button>
      </div>
      {!isCustom && defaultColor && color !== defaultColor && onResetColor && (
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
          删除类型
        </button>
      )}
      {localError && <p className="text-[10px] text-red-500">{localError}</p>}
      {!isCustom && (
        <p className="text-[10px] text-gray-400">内置类型仅可改颜色</p>
      )}
      {isCustom && inUse && (
        <p className="text-[10px] text-gray-400">有节点使用时不可删除</p>
      )}
      <p className="text-[10px] text-gray-300 truncate" title={type}>{type}</p>
    </div>
  )
}

function NodeTypeButton({
  type,
  label,
  color,
  onAddNode,
  onEdit,
  editing,
}: {
  type: string
  label: string
  color: string
  onAddNode: (type: NodeType) => void
  onEdit: () => void
  editing: boolean
}) {
  return (
    <div className="group flex items-center gap-0.5">
      <button
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/gdg-node-type', type)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => onAddNode(type as NodeType)}
        className={cn(
          'flex-1 flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-gray-700',
          'hover:bg-gray-50 border border-transparent hover:border-gray-200',
          editing && 'bg-blue-50 border-blue-200',
        )}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        title="编辑类型"
        onClick={onEdit}
        className={cn(
          'shrink-0 w-6 h-6 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 text-[10px]',
          editing ? 'opacity-100 text-blue-600 bg-blue-50' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        ✎
      </button>
    </div>
  )
}

export function NodePalette({ collapsed, onToggle, onAddNode }: NodePaletteProps) {
  const customNodeTypes = useEditorStore((s) => s.project?.settings.customNodeTypes)
  const colorOverrides = useEditorStore((s) => s.project?.settings.nodeTypeColorOverrides)
  const paletteTypes = useMemo(
    () => getPaletteNodeTypes(),
    [customNodeTypes, colorOverrides],
  )
  const addCustomNodeType = useEditorStore((s) => s.addCustomNodeType)
  const updateCustomNodeType = useEditorStore((s) => s.updateCustomNodeType)
  const setNodeTypeColor = useEditorStore((s) => s.setNodeTypeColor)
  const resetNodeTypeColor = useEditorStore((s) => s.resetNodeTypeColor)
  const removeCustomNodeType = useEditorStore((s) => s.removeCustomNodeType)
  const nodes = useEditorStore((s) => s.nodes)

  const [adding, setAdding] = useState(false)
  const [editingType, setEditingType] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(CUSTOM_COLOR_PRESETS[0])
  const [error, setError] = useState<string | null>(null)

  async function handleAddType() {
    if (!newLabel.trim()) return
    setError(null)
    const def = await addCustomNodeType(newLabel.trim(), newColor)
    if (def) {
      setNewLabel('')
      setAdding(false)
    }
  }

  if (collapsed) {
    return (
      <div className="w-12 border-r border-gray-200 bg-white flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-md text-gray-500 hover:bg-gray-100 text-sm"
          title="展开节点库"
        >
          →
        </button>
        {paletteTypes.map((t) => (
          <button
            key={t.type}
            onClick={() => onAddNode(t.type as NodeType)}
            className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center"
            title={t.label}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="w-44 border-r border-gray-200 bg-white flex flex-col min-h-0 flex-1">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-gray-500">节点库</span>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 text-xs">←</button>
      </div>

      <div className="p-2 space-y-1 overflow-y-auto flex-1 min-h-0">
        {paletteTypes.map((t) => {
          const isCustom = isCustomNodeType(t.type)
          const inUse = nodes.some((n) => n.type === t.type)
          const defaultColor = getBuiltinNodeTypeColor(t.type)
          const isEditing = editingType === t.type

          return (
            <div key={t.type}>
              <NodeTypeButton
                type={t.type}
                label={t.label}
                color={t.color}
                onAddNode={onAddNode}
                editing={isEditing}
                onEdit={() => {
                  setAdding(false)
                  setError(null)
                  setEditingType(isEditing ? null : t.type)
                }}
              />
              {isEditing && (
                <NodeTypeEditor
                  type={t.type}
                  label={t.label}
                  color={t.color}
                  isCustom={isCustom}
                  defaultColor={defaultColor}
                  inUse={inUse}
                  onCancel={() => setEditingType(null)}
                  onSave={async (label, color) => {
                    if (isCustom) {
                      const ok = await updateCustomNodeType(t.type, { label, color })
                      if (!ok) throw new Error('save failed')
                    } else {
                      const ok = await setNodeTypeColor(t.type, color)
                      if (!ok) throw new Error('save failed')
                    }
                    setEditingType(null)
                  }}
                  onDelete={async () => {
                    const ok = await removeCustomNodeType(t.type)
                    if (!ok) throw new Error('delete failed')
                    setEditingType(null)
                  }}
                  onResetColor={
                    defaultColor
                      ? async () => {
                          await resetNodeTypeColor(t.type)
                          setEditingType(null)
                        }
                      : undefined
                  }
                />
              )}
            </div>
          )
        })}

        {adding ? (
          <div className="mt-2 p-2 rounded-md border border-gray-200 bg-gray-50 space-y-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="类型名称，如：资源"
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddType()
                if (e.key === 'Escape') setAdding(false)
              }}
            />
            <ColorSwatches value={newColor} onChange={setNewColor} />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleAddType}
                disabled={!newLabel.trim()}
                className="flex-1 text-xs py-1 rounded bg-blue-600 text-white disabled:opacity-40"
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="px-2 text-xs py-1 rounded border border-gray-200 text-gray-500"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setEditingType(null)
              setError(null)
            }}
            className="w-full mt-1 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-md border border-dashed border-blue-200"
          >
            + 添加类型
          </button>
        )}

        {error && <p className="text-[10px] text-red-500 px-1">{error}</p>}
      </div>
    </div>
  )
}
