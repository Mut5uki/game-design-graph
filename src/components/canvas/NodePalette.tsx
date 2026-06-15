import { useMemo, useState } from 'react'
import { getPaletteNodeTypes } from '@/domain/templates/nodeTemplates'
import { CUSTOM_COLOR_PRESETS, isCustomNodeType } from '@/domain/templates/nodeTypeRegistry'
import type { NodeType } from '@/domain/types'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

interface NodePaletteProps {
  collapsed: boolean
  onToggle: () => void
  onAddNode: (type: NodeType) => void
}

function NodeTypeButton({
  type,
  label,
  color,
  onAddNode,
  onRemove,
  removable,
}: {
  type: string
  label: string
  color: string
  onAddNode: (type: NodeType) => void
  onRemove?: () => void
  removable?: boolean
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
        )}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </button>
      {removable && onRemove && (
        <button
          type="button"
          title="删除自定义类型"
          onClick={onRemove}
          className="shrink-0 w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 text-xs"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function NodePalette({ collapsed, onToggle, onAddNode }: NodePaletteProps) {
  const customNodeTypes = useEditorStore((s) => s.project?.settings.customNodeTypes)
  const paletteTypes = useMemo(() => getPaletteNodeTypes(), [customNodeTypes])
  const addCustomNodeType = useEditorStore((s) => s.addCustomNodeType)
  const removeCustomNodeType = useEditorStore((s) => s.removeCustomNodeType)
  const nodes = useEditorStore((s) => s.nodes)

  const [adding, setAdding] = useState(false)
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

  async function handleRemove(type: string) {
    const inUse = nodes.some((n) => n.type === type)
    if (inUse) {
      setError('该类型仍被节点使用，无法删除')
      return
    }
    const ok = await removeCustomNodeType(type)
    if (!ok) setError('删除失败')
    else setError(null)
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
    <div className="w-44 border-r border-gray-200 bg-white flex flex-col min-h-0">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-gray-500">节点库</span>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 text-xs">←</button>
      </div>

      <div className="p-2 space-y-1 overflow-y-auto flex-1 min-h-0">
        {paletteTypes.map((t) => (
          <NodeTypeButton
            key={t.type}
            type={t.type}
            label={t.label}
            color={t.color}
            onAddNode={onAddNode}
            removable={isCustomNodeType(t.type)}
            onRemove={() => handleRemove(t.type)}
          />
        ))}

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
            <div className="flex flex-wrap gap-1">
              {CUSTOM_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'w-4 h-4 rounded-full border-2',
                    newColor === c ? 'border-gray-800' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
