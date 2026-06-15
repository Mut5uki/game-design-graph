import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import {
  COMMENT_COLOR_PRESETS,
  COMMENT_HEADER_HEIGHT,
  COMMENT_MIN_HEIGHT,
  COMMENT_MIN_WIDTH,
  getCommentColor,
} from '@/domain/group/commentBlock'
import { cn } from '@/lib/utils'

export interface CommentBlockData {
  label: string
  description?: string
  colorId?: string
  [key: string]: unknown
}

function CommentBlockComponent({ data, selected }: NodeProps & { data: CommentBlockData }) {
  const color = getCommentColor(data.colorId)

  return (
    <>
      <NodeResizer
        minWidth={COMMENT_MIN_WIDTH}
        minHeight={COMMENT_MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-blue-400"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border-white !rounded-sm"
      />
      <div
        className={cn(
          'w-full h-full rounded-lg border-2 border-dashed flex flex-col overflow-hidden',
          selected && 'ring-2 ring-blue-400/50 ring-offset-1',
        )}
        style={{
          backgroundColor: color.bg,
          borderColor: selected ? color.header : color.border,
        }}
      >
        <div
          className="shrink-0 px-3 flex items-center gap-2 text-white text-xs font-medium select-none"
          style={{
            height: COMMENT_HEADER_HEIGHT,
            backgroundColor: color.header,
          }}
        >
          <span className="opacity-80">▤</span>
          <span className="truncate flex-1">{data.label || '区块备注'}</span>
        </div>
        <div className="flex-1 px-3 py-2 overflow-hidden pointer-events-none">
          {data.description ? (
            <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-6">{data.description}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">拖入节点以编组；在右侧编辑备注</p>
          )}
        </div>
      </div>
    </>
  )
}

export const CommentBlockNode = memo(CommentBlockComponent)

export { COMMENT_COLOR_PRESETS }
