import { memo, useState } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import {
  COMMENT_COLOR_PRESETS,
  COMMENT_MIN_HEIGHT,
  COMMENT_MIN_WIDTH,
  getCommentColor,
} from '@/domain/group/commentBlock'
import { cn } from '@/lib/utils'
import { InlineNodeName } from './InlineNodeName'
import type { RemotePeerRef } from '@/collab/useCollab'
import { RemoteSelectionBadge, remoteSelectionRingStyle } from '@/components/collab/RemoteSelectionBadge'

export interface CommentBlockData {
  label: string
  description?: string
  colorId?: string
  remoteSelections?: RemotePeerRef[]
  remoteSelectColor?: string
  [key: string]: unknown
}

function CommentBlockComponent({ id, data, selected }: NodeProps & { data: CommentBlockData }) {
  const color = getCommentColor(data.colorId)
  const title = data.label || '区块备注'
  const [editing, setEditing] = useState(false)
  const remoteSelections = data.remoteSelections ?? []
  const remoteColor = data.remoteSelectColor ?? remoteSelections[0]?.color

  return (
    <>
      <NodeResizer
        minWidth={COMMENT_MIN_WIDTH}
        minHeight={COMMENT_MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-blue-400/50"
        handleClassName="!w-2 !h-2 !bg-blue-500/70 !border-white/80 !rounded-sm"
      />
      <div
        className={cn(
          'gdg-comment-block w-full h-full relative overflow-visible rounded-sm',
          selected && 'ring-1 ring-blue-400/30',
        )}
        style={{
          backgroundColor: color.bg,
          border: `1px solid ${selected ? color.border : remoteColor && !selected ? remoteColor : color.borderMuted}`,
          ...(!selected && remoteColor ? remoteSelectionRingStyle(remoteColor) : {}),
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        title="双击修改名称"
      >
        {!selected && remoteSelections.length > 0 && (
          <RemoteSelectionBadge selections={remoteSelections} />
        )}
        {editing ? (
          <div
            className="absolute inset-0 flex items-center justify-center px-6 py-4 z-10 nodrag nopan"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <InlineNodeName
              nodeId={id}
              value={title}
              autoEdit
              onDone={() => setEditing(false)}
              className="hidden"
              inputClassName="text-lg font-semibold text-center text-gray-700 max-w-full"
              placeholder="区块名称"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center px-6 py-4 select-none pointer-events-none"
            aria-hidden
          >
            <p
              className="gdg-comment-watermark text-center font-bold leading-tight tracking-wide"
              style={{ color: color.title }}
            >
              {title}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export const CommentBlockNode = memo(CommentBlockComponent)

export { COMMENT_COLOR_PRESETS }
