import { useMemo, type ReactNode } from 'react'
import type { RelationType } from '@/domain/types'
import { getRelationOptions } from '@/domain/templates/relationPins'
import { getRelationLabel } from '@/domain/templates/nodeTemplates'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

interface RelationTypeChipsProps {
  value: RelationType
  onChange: (type: RelationType) => void
  compact?: boolean
}

export function RelationTypeChips({ value, onChange, compact }: RelationTypeChipsProps) {
  const customRelationTypes = useEditorStore((s) => s.project?.settings.customRelationTypes)
  const colorOverrides = useEditorStore((s) => s.project?.settings.relationTypeColorOverrides)
  const relationOptions = useMemo(
    () => getRelationOptions(),
    [customRelationTypes, colorOverrides],
  )

  return (
    <div className={cn('flex flex-wrap gap-1', compact && 'gap-0.5')}>
      {relationOptions.map((pin) => {
        const active = value === pin.type
        return (
          <button
            key={pin.type}
            type="button"
            title={getRelationLabel(pin.type)}
            onClick={() => onChange(pin.type as RelationType)}
            className={cn(
              'rounded-full border transition-colors',
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
              active
                ? 'font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700',
            )}
            style={
              active
                ? {
                    color: pin.color,
                    borderColor: pin.color,
                    backgroundColor: `${pin.color}18`,
                  }
                : undefined
            }
          >
            {pin.label}
          </button>
        )
      })}
    </div>
  )
}

export function RelationPickerPopup({
  x,
  y,
  onPick,
  onClose,
}: {
  x: number
  y: number
  onPick: (type: RelationType) => void
  onClose: () => void
}) {
  const customRelationTypes = useEditorStore((s) => s.project?.settings.customRelationTypes)
  const colorOverrides = useEditorStore((s) => s.project?.settings.relationTypeColorOverrides)
  const relationOptions = useMemo(
    () => getRelationOptions(),
    [customRelationTypes, colorOverrides],
  )

  return (
    <RelationPickerShell x={x} y={y} onClose={onClose} title="选择关系类型">
      <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
        {relationOptions.map((pin) => (
          <button
            key={pin.type}
            type="button"
            className="rounded-md border border-gray-200 px-2 py-1.5 text-xs hover:bg-gray-50 text-left"
            onClick={() => onPick(pin.type as RelationType)}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1"
              style={{ backgroundColor: pin.color }}
            />
            {pin.label}
          </button>
        ))}
      </div>
    </RelationPickerShell>
  )
}

function RelationPickerShell({
  x,
  y,
  title,
  children,
  onClose,
}: {
  x: number
  y: number
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed z-[110] w-[220px] rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl"
      style={{
        left: Math.min(x, window.innerWidth - 236),
        top: Math.min(y, window.innerHeight - 200),
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="text-[10px] text-gray-400 mb-2">{title}</p>
      {children}
      <button
        type="button"
        className="mt-2 w-full text-[10px] text-gray-400 hover:text-gray-600"
        onClick={onClose}
      >
        取消
      </button>
    </div>
  )
}
