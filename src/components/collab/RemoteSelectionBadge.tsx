import type { RemotePeerRef } from '@/collab/useCollab'

export function RemoteSelectionBadge({ selections }: { selections: RemotePeerRef[] }) {
  if (!selections.length) return null
  const primary = selections[0]
  const label =
    selections.length > 1 ? `${primary.name} +${selections.length - 1}` : primary.name

  return (
    <div
      className="absolute -top-2.5 left-1.5 z-20 pointer-events-none max-w-[calc(100%-0.75rem)]"
      title={selections.map((s) => s.name).join('、')}
    >
      <span
        className="inline-block text-[10px] font-medium text-white px-1.5 py-0.5 rounded shadow-sm truncate max-w-full"
        style={{ backgroundColor: primary.color }}
      >
        {label}
      </span>
    </div>
  )
}

export function remoteSelectionRingStyle(
  color: string,
): { boxShadow: string; borderColor: string } {
  return {
    boxShadow: `0 0 0 2px ${color}, 0 0 0 4px ${color}33`,
    borderColor: color,
  }
}
