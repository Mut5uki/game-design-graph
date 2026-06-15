import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeMeta, getRelationLabel } from '@/domain/templates/nodeTemplates'
import { NODE_HANDLES } from '@/domain/templates/relationPins'
import type { ImpactRole } from '@/domain/types'
import { cn } from '@/lib/utils'
import { InlineNodeName } from './InlineNodeName'

export interface DesignNodeData {
  label: string
  nodeType: string
  inboundSummary?: string
  impactRole?: ImpactRole
  [key: string]: unknown
}

function SideHandles({
  position,
  sideClass,
  inId,
  outId,
  inTitle,
  outTitle,
}: {
  position: Position
  sideClass: string
  inId: string
  outId: string
  inTitle: string
  outTitle: string
}) {
  return (
    <>
      <Handle
        id={inId}
        type="target"
        position={position}
        className={cn('gdg-handle', sideClass)}
        title={inTitle}
      />
      <Handle
        id={outId}
        type="source"
        position={position}
        className={cn('gdg-handle', sideClass)}
        title={outTitle}
      />
    </>
  )
}

function DesignNodeCard({ id, data, selected, dragging }: NodeProps & { data: DesignNodeData }) {
  const meta = getNodeMeta(data.nodeType)
  const impactRole = data.impactRole

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-white shadow-sm w-[200px]',
        !dragging && 'transition-[box-shadow,border-color] duration-100',
        selected && 'ring-2 shadow-md',
        impactRole === 'upstream' && 'bg-blue-50/80',
        impactRole === 'downstream' && 'bg-orange-50/80',
      )}
      style={{
        borderColor: selected ? meta.color : '#E5E7EB',
        ...(selected ? { ringColor: meta.color } : {}),
      }}
    >
      <SideHandles
        position={Position.Left}
        sideClass="gdg-handle-left"
        inId={NODE_HANDLES.leftIn}
        outId={NODE_HANDLES.leftOut}
        inTitle="左侧接入"
        outTitle="左侧连出"
      />
      <SideHandles
        position={Position.Right}
        sideClass="gdg-handle-right"
        inId={NODE_HANDLES.rightIn}
        outId={NODE_HANDLES.rightOut}
        inTitle="右侧接入"
        outTitle="右侧连出"
      />
      <SideHandles
        position={Position.Top}
        sideClass="gdg-handle-top"
        inId={NODE_HANDLES.topIn}
        outId={NODE_HANDLES.topOut}
        inTitle="顶部接入"
        outTitle="顶部连出"
      />
      <SideHandles
        position={Position.Bottom}
        sideClass="gdg-handle-bottom"
        inId={NODE_HANDLES.bottomIn}
        outId={NODE_HANDLES.bottomOut}
        inTitle="底部接入"
        outTitle="底部连出"
      />
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-xs text-gray-500 shrink-0">{meta.label}</span>
          <InlineNodeName
            nodeId={id}
            value={data.label}
            className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0"
            inputClassName="text-sm font-medium"
          />
        </div>
        {data.inboundSummary && (
          <div className="mt-1 text-xs text-gray-400 truncate pl-3">
            {data.inboundSummary}
          </div>
        )}
      </div>
    </div>
  )
}

export const DesignFlowNode = memo(DesignNodeCard)

export function buildInboundSummary(
  nodeId: string,
  edges: Array<{ from: string; to: string; relationType: string; label?: string }>,
  nodeNames: Map<string, string>,
): string | undefined {
  const inbound = edges.filter((e) => e.to === nodeId)
  if (!inbound.length) return undefined
  const e = inbound[0]
  const fromName = nodeNames.get(e.from) ?? e.from
  return `${getRelationLabel(e.relationType)} ← ${fromName}`
}

/** dagre 自动布局用近似尺寸 */
export const DESIGN_NODE_LAYOUT_WIDTH = 200
export const DESIGN_NODE_LAYOUT_HEIGHT = 64
