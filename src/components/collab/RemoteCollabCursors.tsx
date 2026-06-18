import { ViewportPortal } from '@xyflow/react'
import { useEditorStore } from '@/store/editorStore'

function PeerCursor({ color, name }: { color: string; name: string }) {
  return (
    <div className="pointer-events-none relative">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        className="drop-shadow-sm"
        aria-hidden
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.25"
        />
      </svg>
      <span
        className="absolute left-[14px] top-[14px] text-[10px] font-medium text-white px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  )
}

export function RemoteCollabCursors() {
  const collabEnabled = useEditorStore((s) => s.collabEnabled)
  const collabStatus = useEditorStore((s) => s.collabStatus)
  const collabPeers = useEditorStore((s) => s.collabPeers)

  if (!collabEnabled || collabStatus !== 'connected') return null

  const withCursor = collabPeers.filter((p) => p.cursor != null)
  if (!withCursor.length) return null

  return (
    <ViewportPortal>
      {withCursor.map((peer) => (
        <div
          key={peer.clientId}
          className="absolute z-[1000]"
          style={{
            left: peer.cursor!.x,
            top: peer.cursor!.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          <PeerCursor color={peer.color} name={peer.name} />
        </div>
      ))}
    </ViewportPortal>
  )
}
