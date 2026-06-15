import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { getRelationLabel } from '@/domain/templates/nodeTemplates'

export interface DesignEdgeData {
  relationType: string
  label?: string
  [key: string]: unknown
}

function DesignEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as DesignEdgeData | undefined
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const text = edgeData?.label || (edgeData?.relationType ? getRelationLabel(edgeData.relationType) : '')

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3B82F6' : '#CBD5E1',
          strokeWidth: selected ? 2 : 1.5,
        }}
        markerEnd="url(#arrow)"
      />
      {text && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded text-gray-500"
          >
            {text}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const DesignFlowEdge = memo(DesignEdgeComponent)
