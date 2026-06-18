import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, ViewportPortal, type Node } from '@xyflow/react'
import { useCollabPresenceStore } from '@/collab/collabPresenceStore'
import { computeDesignEdgePath, resolveEdgeEndpointsMap } from '@/collab/edgePath'
import { loadCollabSettings } from '@/collab/types'
import type { CollabPeer } from '@/collab/types'
import { estimateNodeBounds, type FlowRect } from '@/collab/nodeBounds'
import type { DesignEdge, DesignNode } from '@/domain/types'
import { useEditorStore } from '@/store/editorStore'

const CURSOR_LERP = 0.28

function resolveNodeRect(
  internal: Node | undefined,
  node: DesignNode,
  designNodes: DesignNode[],
): FlowRect {
  const measured =
    internal?.measured?.width != null && internal?.measured?.height != null
      ? { width: internal.measured.width, height: internal.measured.height }
      : null

  const pos = (internal as { positionAbsolute?: { x: number; y: number } } | undefined)
    ?.positionAbsolute
  if (pos && internal) {
    const width = measured?.width ?? internal.width ?? 200
    const height = measured?.height ?? internal.height ?? 64
    return {
      x: pos.x,
      y: pos.y,
      width: typeof width === 'number' ? width : 200,
      height: typeof height === 'number' ? height : 64,
    }
  }

  return estimateNodeBounds(node, designNodes, measured)
}

function useSmoothedPeerCursors(peers: CollabPeer[], enabled: boolean): CollabPeer[] {
  const smoothRef = useRef(new Map<number, { x: number; y: number }>())
  const [, bump] = useState(0)
  const hasCursors = enabled && peers.some((p) => p.cursor != null)

  useEffect(() => {
    if (!hasCursors) return
    let raf = 0
    const tick = () => {
      let moved = false
      for (const peer of peers) {
        const id = peer.clientId
        if (id == null || !peer.cursor) continue
        const prev = smoothRef.current.get(id) ?? peer.cursor
        const dx = peer.cursor.x - prev.x
        const dy = peer.cursor.y - prev.y
        if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) moved = true
        smoothRef.current.set(id, {
          x: prev.x + dx * CURSOR_LERP,
          y: prev.y + dy * CURSOR_LERP,
        })
      }
      if (moved) bump((n) => n + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [peers, hasCursors])

  if (!enabled) return peers

  return peers.map((peer) => {
    if (!peer.cursor || peer.clientId == null) return peer
    const smooth = smoothRef.current.get(peer.clientId)
    return smooth ? { ...peer, cursor: smooth } : peer
  })
}

function PeerCursor({ color, name }: { color: string; name: string }) {
  return (
    <div className="pointer-events-none relative">
      <svg width="18" height="18" viewBox="0 0 24 24" className="drop-shadow-md" aria-hidden>
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.25"
        />
      </svg>
      <span
        className="absolute left-3.5 top-3.5 text-[10px] font-medium text-white px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  )
}

function RemoteEdgeSelectionLayer({
  peers,
  designNodes,
  designEdges,
  trackedPeerClientId,
}: {
  peers: CollabPeer[]
  designNodes: DesignNode[]
  designEdges: DesignEdge[]
  trackedPeerClientId: number | null
}) {
  const nodeLookup = useStore((s) => s.nodeLookup)

  const marks = useMemo(() => {
    const endpoints = resolveEdgeEndpointsMap(designEdges, designNodes)
    const byId = new Map(designEdges.map((e) => [e.id, e]))
    const out: Array<{ key: string; peer: CollabPeer; path: string; labelX: number; labelY: number }> =
      []

    for (const peer of peers) {
      if (!peer.selectedEdgeId) continue
      const edge = byId.get(peer.selectedEdgeId)
      if (!edge) continue
      const pathInfo = computeDesignEdgePath(
        edge,
        designNodes,
        (node) => {
          const internal = nodeLookup.get(node.id)
          return resolveNodeRect(internal, node, designNodes)
        },
        endpoints,
      )
      if (!pathInfo) continue
      out.push({
        key: `${peer.clientId}-${peer.selectedEdgeId}`,
        peer,
        path: pathInfo.path,
        labelX: pathInfo.labelX,
        labelY: pathInfo.labelY,
      })
    }
    return out
  }, [peers, designNodes, designEdges, nodeLookup])

  if (!marks.length) return null

  return (
    <>
      {marks.map(({ key, peer, path, labelX, labelY }) => {
        const tracked = trackedPeerClientId === peer.clientId
        const strokeWidth = tracked ? 4 : 3
        return (
          <Fragment key={key}>
            <svg
              className="absolute overflow-visible pointer-events-none"
              style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 9998 }}
              aria-hidden
            >
              <path
                d={path}
                fill="none"
                stroke={peer.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 2px ${peer.color}88)`,
                }}
              />
            </svg>
            <span
              className="absolute text-[10px] font-medium text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: labelX,
                top: labelY,
                backgroundColor: peer.color,
                zIndex: 9999,
              }}
            >
              {peer.name}
            </span>
          </Fragment>
        )
      })}
    </>
  )
}

function RemoteSelectionLayer({
  peers,
  designNodes,
  trackedPeerClientId,
}: {
  peers: CollabPeer[]
  designNodes: DesignNode[]
  trackedPeerClientId: number | null
}) {
  const nodeLookup = useStore((s) => s.nodeLookup)

  const marks = useMemo(() => {
    const out: Array<{ key: string; peer: CollabPeer; node: DesignNode }> = []
    const byId = new Map(designNodes.map((n) => [n.id, n]))
    for (const peer of peers) {
      for (const nodeId of peer.selectedNodeIds) {
        const node = byId.get(nodeId)
        if (node) out.push({ key: `${peer.clientId}-${nodeId}`, peer, node })
      }
    }
    return out
  }, [peers, designNodes])

  if (!marks.length) return null

  return (
    <>
      {marks.map(({ key, peer, node }) => {
        const internal = nodeLookup.get(node.id)
        const bounds = resolveNodeRect(internal, node, designNodes)
        const tracked = trackedPeerClientId === peer.clientId
        return (
          <div
            key={key}
            className="absolute pointer-events-none rounded-md"
            style={{
              left: bounds.x - 2,
              top: bounds.y - 2,
              width: bounds.width + 4,
              height: bounds.height + 4,
              border: `${tracked ? 3 : 2}px solid ${peer.color}`,
              boxShadow: `0 0 0 1px ${peer.color}66`,
              zIndex: 9999,
            }}
          >
            <span
              className="absolute -top-2 left-1 text-[10px] font-medium text-white px-1.5 py-0.5 rounded shadow-sm truncate max-w-[8rem]"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
            </span>
          </div>
        )
      })}
    </>
  )
}

function RemoteCursorsLayer({ peers }: { peers: CollabPeer[] }) {
  const withCursor = peers.filter((p) => p.cursor != null)
  if (!withCursor.length) return null

  return (
    <>
      {withCursor.map((peer) => (
        <div
          key={peer.clientId}
          className="absolute pointer-events-none"
          style={{
            left: peer.cursor!.x,
            top: peer.cursor!.y,
            transform: 'translate(-2px, -2px)',
            zIndex: 10000,
          }}
        >
          <PeerCursor color={peer.color} name={peer.name} />
        </div>
      ))}
    </>
  )
}

export function RemoteCollabPresence() {
  const collabEnabled = useEditorStore((s) => s.collabEnabled)
  const collabStatus = useEditorStore((s) => s.collabStatus)
  const designNodes = useEditorStore((s) => s.nodes)
  const designEdges = useEditorStore((s) => s.edges)
  const peers = useCollabPresenceStore((s) => s.peers)
  const trackedPeerClientId = useCollabPresenceStore((s) => s.trackedPeerClientId)
  const prefs = loadCollabSettings()
  const showCursors = prefs.showPeerCursors !== false
  const showSelections = prefs.showPeerSelections !== false

  const active = collabEnabled && collabStatus === 'connected'
  const smoothed = useSmoothedPeerCursors(peers, active && showCursors)

  if (!active) return null
  if (!showCursors && !showSelections) return null
  if (!peers.length) return null

  return (
    <ViewportPortal>
      {showSelections && (
        <>
          <RemoteEdgeSelectionLayer
            peers={peers}
            designNodes={designNodes}
            designEdges={designEdges}
            trackedPeerClientId={trackedPeerClientId}
          />
          <RemoteSelectionLayer
            peers={peers}
            designNodes={designNodes}
            trackedPeerClientId={trackedPeerClientId}
          />
        </>
      )}
      {showCursors && <RemoteCursorsLayer peers={smoothed} />}
    </ViewportPortal>
  )
}
