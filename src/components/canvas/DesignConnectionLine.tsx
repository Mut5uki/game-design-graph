import { getBezierPath, type ConnectionLineComponentProps } from '@xyflow/react'

export function DesignConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  })

  const baseColor = '#64748B'
  const stroke =
    connectionStatus === 'invalid' ? '#EF4444' : connectionStatus === 'valid' ? baseColor : '#94A3B8'

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={connectionStatus == null ? '6 4' : undefined}
      />
    </g>
  )
}
