import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeMeta } from '@/domain/templates/nodeTemplates'
import {
  LIST_BLOCK_HANDLE,
  createListItem,
  listItemHandleId,
  type ListBlockItem,
} from '@/domain/list/listBlock'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'
import { InlineNodeName } from './InlineNodeName'

export interface ListBlockData {
  label: string
  listType: string
  items: ListBlockItem[]
  description?: string
  [key: string]: unknown
}

function ListBlockCard({ data, selected, id }: NodeProps & { data: ListBlockData }) {
  const contentType = (data.listType ?? 'ability') as string
  const meta = getNodeMeta(contentType)
  const items: ListBlockItem[] = Array.isArray(data.items) ? data.items : []
  const updateListItems = useEditorStore((s) => s.updateListItems)
  const reorderListItems = useEditorStore((s) => s.reorderListItems)
  const setListItemOffset = useEditorStore((s) => s.setListItemOffset)

  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const onRowDragStart = useCallback((index: number) => {
    dragIndexRef.current = index
  }, [])

  const onRowDrop = useCallback(
    (toIndex: number) => {
      const from = dragIndexRef.current
      dragIndexRef.current = null
      setDragOverIndex(null)
      if (from == null || from === toIndex) return
      reorderListItems(id, from, toIndex)
    },
    [id, reorderListItems],
  )

  const onOffsetDrag = useCallback(
    (itemId: string, startX: number, startOffset: number) => {
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX - startX
        setListItemOffset(id, itemId, Math.max(-40, Math.min(40, startOffset + dx)))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [id, setListItemOffset],
  )

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-white shadow-sm min-w-[220px] max-w-[280px]',
        selected && 'ring-2 ring-sky-400 shadow-md',
      )}
      style={{ borderColor: selected ? meta.color : '#E5E7EB' }}
    >
      <Handle
        id={LIST_BLOCK_HANDLE.input}
        type="target"
        position={Position.Left}
        className="gdg-handle gdg-handle-left"
        style={{ top: '50%' }}
        title="左侧接入"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.leftOut}
        type="source"
        position={Position.Left}
        className="gdg-handle gdg-handle-left"
        style={{ top: '50%' }}
        title="左侧连出"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.top}
        type="target"
        position={Position.Top}
        className="gdg-handle gdg-handle-top"
        title="顶部接入"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.topOut}
        type="source"
        position={Position.Top}
        className="gdg-handle gdg-handle-top"
        title="顶部连出"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.rightIn}
        type="target"
        position={Position.Right}
        className="gdg-handle gdg-handle-right"
        style={{ top: '50%' }}
        title="右侧接入"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.output}
        type="source"
        position={Position.Right}
        className="gdg-handle gdg-handle-right"
        style={{ top: '50%' }}
        title="右侧连出"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.bottomIn}
        type="target"
        position={Position.Bottom}
        className="gdg-handle gdg-handle-bottom"
        title="底部接入"
      />
      <Handle
        id={LIST_BLOCK_HANDLE.bottom}
        type="source"
        position={Position.Bottom}
        className="gdg-handle gdg-handle-bottom"
        title="底部连出"
      />

      <div className="px-3 py-2 border-b border-gray-100 bg-sky-50/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
          <span className="text-xs text-gray-500">{meta.label}列表</span>
        </div>
        <div className="text-sm font-medium text-gray-900 mt-0.5 min-w-0">
          <InlineNodeName
            nodeId={id}
            value={data.label}
            className="truncate block"
            inputClassName="text-sm font-medium"
          />
        </div>
      </div>

      <div className="py-1 min-h-[32px]">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">右键或属性面板添加条目</p>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'gdg-list-row relative flex items-center min-h-[26px] pr-2 nodrag',
                dragOverIndex === index && 'bg-sky-50',
              )}
              style={{ paddingLeft: 8 + (item.offsetX ?? 0) }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRowDrop(index)
              }}
            >
              <Handle
                type="target"
                id={listItemHandleId(item.id)}
                position={Position.Left}
                className="gdg-pin !left-0"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                title={`连接：${item.name}`}
              />
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
                  onRowDragStart(index)
                }}
                className="shrink-0 w-4 h-4 mr-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-[10px]"
                title="拖动排序"
              >
                ⋮⋮
              </button>
              <span
                className="shrink-0 w-3 h-3 mr-1 cursor-ew-resize text-transparent hover:text-gray-300 text-[8px] select-none"
                title="左右拖动微调位置"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  onOffsetDrag(item.id, e.clientX, item.offsetX ?? 0)
                }}
              >
                ↔
              </span>
              <span className="text-xs text-gray-800 truncate flex-1">{item.name}</span>
              <Handle
                type="source"
                id={listItemHandleId(item.id)}
                position={Position.Right}
                className="gdg-pin !right-0"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                title={`从 ${item.name} 连出`}
              />
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        className="w-full py-1 text-[10px] text-sky-600 hover:bg-sky-50 border-t border-gray-100 nodrag"
        onClick={(e) => {
          e.stopPropagation()
          const next = [...items, createListItem(`${meta.label} ${items.length + 1}`)]
          updateListItems(id, next)
        }}
      >
        + 添加条目
      </button>
    </div>
  )
}

export const ListBlockNode = memo(ListBlockCard)

export const LIST_NODE_LAYOUT_WIDTH = 240
export const LIST_NODE_LAYOUT_HEIGHT = 120
