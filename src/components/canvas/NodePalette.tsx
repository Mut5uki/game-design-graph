import { NODE_TYPES } from '@/domain/templates/nodeTemplates'
import type { NodeType } from '@/domain/types'
import { cn } from '@/lib/utils'

interface NodePaletteProps {
  collapsed: boolean
  onToggle: () => void
  onAddNode: (type: NodeType) => void
}

export function NodePalette({ collapsed, onToggle, onAddNode }: NodePaletteProps) {
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
        {NODE_TYPES.map((t) => (
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
    <div className="w-44 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">节点库</span>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 text-xs">←</button>
      </div>
      <div className="p-2 space-y-1">
        {NODE_TYPES.map((t) => (
          <button
            key={t.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/gdg-node-type', t.type)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => onAddNode(t.type as NodeType)}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-gray-700',
              'hover:bg-gray-50 border border-transparent hover:border-gray-200',
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
