import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeMeta, getRelationLabel } from '@/domain/templates/nodeTemplates'
import type { ImpactRole } from '@/domain/types'
import { cn } from '@/lib/utils'

export interface DesignNodeData {
  label: string
  nodeType: string
  inboundSummary?: string
  impactRole?: ImpactRole
  selected?: boolean
  [key: string]: unknown
}

function DesignNodeCard({ data, selected }: NodeProps & { data: DesignNodeData }) {
  const meta = getNodeMeta(data.nodeType)
  const impactRole = data.impactRole

  return (
    <div className="p-3 -m-3">
      <div
        className={cn(
          'rounded-lg border bg-white shadow-sm min-w-[180px] max-w-[240px] transition-shadow',
          selected && 'ring-2 shadow-md',
          impactRole === 'upstream' && 'bg-blue-50/80',
          impactRole === 'downstream' && 'bg-orange-50/80',
        )}
        style={{
          borderColor: selected ? meta.color : '#E5E7EB',
          ...(selected ? { ringColor: meta.color } : {}),
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!w-4 !h-4 !-left-1 !bg-gray-300 !border-2 !border-white"
        />
        <div className="px-3 py-3 min-h-[52px]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            <span className="text-xs text-gray-500 shrink-0">{meta.label}</span>
            <span className="text-sm font-medium text-gray-900 truncate">{data.label}</span>
          </div>
          {data.inboundSummary && (
            <div className="mt-1.5 text-xs text-gray-400 truncate pl-4">
              {data.inboundSummary}
            </div>
          )}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !-right-1 !bg-gray-300 !border-2 !border-white"
        />
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

/** 画布布局用节点近似尺寸（含点击扩展区） */
export const DESIGN_NODE_WIDTH = 240
export const DESIGN_NODE_HEIGHT = 88
