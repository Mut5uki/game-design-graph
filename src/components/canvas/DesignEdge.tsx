import { useMemo, memo, useCallback, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { getRelationLabel, getRelationTypes } from '@/domain/templates/nodeTemplates'
import { useEditorStore } from '@/store/editorStore'
import type { RelationType } from '@/domain/types'
import { cn } from '@/lib/utils'

export interface DesignEdgeData {
  relationType: string
  label?: string
  edgeId?: string
  sourceDx?: number
  sourceDy?: number
  targetDx?: number
  targetDy?: number
  curvature?: number
  remoteSelectColor?: string
  remoteSelectName?: string
  [key: string]: unknown
}

function DesignEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    markerEnd,
  } = props

  const edgeData = data as DesignEdgeData | undefined
  const edgeId = edgeData?.edgeId ?? id
  const selectEdge = useEditorStore((s) => s.selectEdge)
  const updateEdge = useEditorStore((s) => s.updateEdge)
  const customRelationTypes = useEditorStore((s) => s.project?.settings.customRelationTypes)
  const relationColorOverrides = useEditorStore((s) => s.project?.settings.relationTypeColorOverrides)
  const relationTypes = useMemo(
    () => getRelationTypes(),
    [customRelationTypes, relationColorOverrides],
  )
  const [editing, setEditing] = useState(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX + (edgeData?.sourceDx ?? 0),
    sourceY: sourceY + (edgeData?.sourceDy ?? 0),
    sourcePosition,
    targetX: targetX + (edgeData?.targetDx ?? 0),
    targetY: targetY + (edgeData?.targetDy ?? 0),
    targetPosition,
    curvature: edgeData?.curvature ?? 0.25,
  })

  const relationType = edgeData?.relationType ?? 'requires'
  const text = edgeData?.label || getRelationLabel(relationType)
  const remoteColor = edgeData?.remoteSelectColor
  const remoteName = edgeData?.remoteSelectName

  const onLabelClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      selectEdge(edgeId)
      setEditing(true)
    },
    [selectEdge, edgeId],
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={36}
        style={{
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
          ...(remoteColor && !selected ? { stroke: remoteColor, strokeWidth: 2.5 } : {}),
        }}
        className={cn(
          'gdg-edge-path',
          selected && 'gdg-edge-path-selected',
          remoteColor && !selected && 'gdg-edge-path-remote',
        )}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onContextMenu={(e) => e.stopPropagation()}
        >
          {remoteName && !selected && (
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white px-1 py-0.5 rounded whitespace-nowrap pointer-events-none"
              style={{ backgroundColor: remoteColor }}
            >
              {remoteName}
            </div>
          )}
          {editing ? (
            <select
              autoFocus
              value={relationType}
              className="text-[10px] border border-blue-300 rounded px-1 py-0.5 bg-white shadow-sm max-w-[88px]"
              onChange={(e) => {
                updateEdge(edgeId, {
                  relationType: e.target.value as RelationType,
                })
                setEditing(false)
              }}
              onBlur={() => setEditing(false)}
            >
              {relationTypes.map((r) => (
                <option key={r.type} value={r.type}>{r.label}</option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={onLabelClick}
              className={cn(
                'px-2 py-1 text-[10px] bg-white border rounded shadow-sm cursor-pointer',
                'hover:border-blue-300 hover:shadow',
                selected ? 'border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600',
              )}
              title="点击编辑关系"
            >
              {text}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const DesignFlowEdge = memo(DesignEdgeComponent)
