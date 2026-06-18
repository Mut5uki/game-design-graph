import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import type { Awareness } from 'y-protocols/awareness'
import type { DesignEdge, DesignNode } from '@/domain/types'
import {
  COLLAB_ORIGIN_LOCAL,
  createCanvasYDoc,
  graphSnapshotEqual,
  isRemoteCollabOrigin,
  readCanvasGraph,
  replaceCanvasGraph,
  seedCanvasGraph,
  type CanvasYDoc,
} from '@/collab/canvasYDoc'
import { useCollabPresenceStore } from '@/collab/collabPresenceStore'
import { peerSelectionSignature } from '@/collab/presenceUtils'
import {
  defaultDisplayName,
  pickPeerColor,
  type CollabPeer,
  type CollabUser,
} from '@/collab/types'

export interface CanvasCollabCallbacks {
  onGraphChange: (snapshot: { nodes: DesignNode[]; edges: DesignEdge[] }) => void
  onStatusChange: (
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    detail?: string,
  ) => void
}

export interface CanvasCollabConnectOptions {
  roomId: string
  displayName: string
  serverUrl: string
  seed: { nodes: DesignNode[]; edges: DesignEdge[] }
  callbacks: CanvasCollabCallbacks
}

interface AwarenessSelection {
  nodeIds?: string[]
  edgeId?: string | null
}

interface AwarenessCursor {
  x?: number
  y?: number
}

const CURSOR_AWARENESS_MS = 120

export class CanvasCollabSession {
  private ydoc: CanvasYDoc | null = null
  private provider: HocuspocusProvider | null = null
  private callbacks: CanvasCollabCallbacks | null = null
  private seeded = false
  private graphObserver: (() => void) | null = null
  private synced = false
  private cursorFlushTimer: number | null = null
  private pendingCursor: { x: number; y: number } | null | undefined = undefined
  private cursorPresenceTimer: number | null = null
  private lastSelectionSignature = ''
  private latestPeers: CollabPeer[] = []

  get connected(): boolean {
    return this.synced
  }

  private connectTimeoutId: number | null = null

  connect(options: CanvasCollabConnectOptions): void {
    this.disconnect()
    window.setTimeout(() => this.connectImpl(options), 50)
  }

  private connectImpl(options: CanvasCollabConnectOptions): void {
    this.callbacks = options.callbacks
    this.callbacks.onStatusChange('connecting')

    const ydoc = createCanvasYDoc()
    this.ydoc = ydoc
    this.attachGraphObserver(ydoc)

    this.connectTimeoutId = window.setTimeout(() => {
      if (!this.synced && this.callbacks) {
        this.callbacks.onStatusChange(
          'error',
          '协作连接超时。请确认已运行 start-with-sakurafrp.bat、樱花隧道已启动，且设置里已填写公网地址。',
        )
      }
    }, 12000)

    try {
      const provider = new HocuspocusProvider({
        url: options.serverUrl,
        name: options.roomId,
        document: ydoc.doc,
        token: options.displayName || defaultDisplayName(),
        onSynced: () => {
          if (!this.ydoc || !this.callbacks) return
          this.clearConnectTimeout()
          this.synced = true
          this.applyInitialGraphState(options.seed)
          this.callbacks.onStatusChange('connected')
          this.publishAwareness(options.displayName)
          this.syncPresence(true)
        },
        onClose: () => {
          this.synced = false
          this.callbacks?.onStatusChange('disconnected')
        },
        onDisconnect: () => {
          this.synced = false
          this.callbacks?.onStatusChange('disconnected')
        },
        onAuthenticationFailed: () => {
          this.callbacks?.onStatusChange('error', '协作认证失败')
        },
      })

      this.provider = provider
      provider.awareness?.on('change', () => this.syncPresence(false))
      provider.on('status', ({ status }: { status: string }) => {
        if (status === 'connected') {
          this.synced = true
          this.callbacks?.onStatusChange('connected')
        }
        if (status === 'connecting') this.callbacks?.onStatusChange('connecting')
        if (status === 'disconnected') {
          this.synced = false
          this.callbacks?.onStatusChange('disconnected')
        }
      })
    } catch (e) {
      this.clearConnectTimeout()
      this.callbacks?.onStatusChange(
        'error',
        e instanceof Error ? e.message : '协作初始化失败',
      )
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutId != null) {
      window.clearTimeout(this.connectTimeoutId)
      this.connectTimeoutId = null
    }
  }

  private applyInitialGraphState(seed: { nodes: DesignNode[]; edges: DesignEdge[] }): void {
    if (!this.ydoc || !this.callbacks) return
    const { nodes: yNodes, edges: yEdges } = this.ydoc
    if (yNodes.size === 0 && yEdges.size === 0 && !this.seeded) {
      seedCanvasGraph(this.ydoc, seed)
      this.seeded = true
    } else if (yNodes.size > 0 || yEdges.size > 0) {
      this.callbacks.onGraphChange(readCanvasGraph(yNodes, yEdges))
    }
  }

  private attachGraphObserver(ydoc: CanvasYDoc): void {
    const onGraphUpdate = (
      _events: Y.YEvent<Y.AbstractType<unknown>>[],
      transaction: Y.Transaction,
    ) => {
      if (!this.ydoc || !this.callbacks) return
      if (!isRemoteCollabOrigin(transaction.origin)) return
      this.callbacks.onGraphChange(readCanvasGraph(this.ydoc.nodes, this.ydoc.edges))
    }

    ydoc.nodes.observeDeep(onGraphUpdate)
    ydoc.edges.observeDeep(onGraphUpdate)
    this.graphObserver = () => {
      ydoc.nodes.unobserveDeep(onGraphUpdate)
      ydoc.edges.unobserveDeep(onGraphUpdate)
    }
  }

  pushLocalGraph(nodes: DesignNode[], edges: DesignEdge[]): void {
    if (!this.ydoc || !this.connected) return
    const snapshot = { nodes, edges }
    const current = readCanvasGraph(this.ydoc.nodes, this.ydoc.edges)
    if (graphSnapshotEqual(current, snapshot)) return
    replaceCanvasGraph(this.ydoc, snapshot, COLLAB_ORIGIN_LOCAL)
  }

  publishSelection(selectedNodeIds: string[], selectedEdgeId: string | null): void {
    const awareness = this.getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('selection', {
      nodeIds: selectedNodeIds,
      edgeId: selectedEdgeId,
    } satisfies AwarenessSelection)
    this.syncPresence(true)
  }

  publishCursor(cursor: { x: number; y: number } | null): void {
    this.pendingCursor = cursor
    if (this.cursorFlushTimer != null) return
    const delay = cursor == null ? 0 : CURSOR_AWARENESS_MS
    this.cursorFlushTimer = window.setTimeout(() => {
      this.cursorFlushTimer = null
      const awareness = this.getAwareness()
      if (!awareness) return
      awareness.setLocalStateField('cursor', this.pendingCursor ?? null)
      this.pendingCursor = undefined
      this.syncPresence(false)
    }, delay)
  }

  republishLocalPresence(
    displayName: string,
    selectedNodeIds: string[],
    selectedEdgeId: string | null,
  ): void {
    this.publishAwareness(displayName)
    this.publishSelection(selectedNodeIds, selectedEdgeId)
  }

  disconnect(): void {
    this.clearConnectTimeout()
    if (this.cursorFlushTimer != null) {
      window.clearTimeout(this.cursorFlushTimer)
      this.cursorFlushTimer = null
    }
    if (this.cursorPresenceTimer != null) {
      window.clearTimeout(this.cursorPresenceTimer)
      this.cursorPresenceTimer = null
    }
    this.pendingCursor = undefined
    this.lastSelectionSignature = ''
    this.latestPeers = []
    useCollabPresenceStore.getState().clear()
    this.graphObserver?.()
    this.graphObserver = null
    this.provider?.destroy()
    this.provider = null
    this.ydoc?.doc.destroy()
    this.ydoc = null
    this.callbacks = null
    this.seeded = false
    this.synced = false
  }

  private getAwareness(): Awareness | null {
    return this.provider?.awareness ?? null
  }

  private publishAwareness(displayName: string): void {
    const awareness = this.getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('user', {
      name: displayName || defaultDisplayName(),
      color: pickPeerColor(awareness.clientID),
    })
  }

  private buildPeers(): CollabPeer[] {
    const awareness = this.getAwareness()
    if (!awareness) return []

    const peers: CollabPeer[] = []
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return
      const user = state.user as CollabUser | undefined
      if (!user?.name) return
      const selection = state.selection as AwarenessSelection | undefined
      const rawCursor = state.cursor as AwarenessCursor | null | undefined
      const cursor =
        rawCursor != null &&
        typeof rawCursor.x === 'number' &&
        typeof rawCursor.y === 'number'
          ? { x: rawCursor.x, y: rawCursor.y }
          : null
      peers.push({
        clientId,
        name: user.name,
        color: user.color || pickPeerColor(clientId),
        selectedNodeIds: selection?.nodeIds ?? [],
        selectedEdgeId: selection?.edgeId ?? null,
        cursor,
      })
    })
    return peers
  }

  /** 选中立即刷新；仅光标变化时节流，避免拖动画布时整图重绘 */
  private syncPresence(force: boolean): void {
    const peers = this.buildPeers()
    this.latestPeers = peers
    const selectionSig = peerSelectionSignature(peers)

    if (force || selectionSig !== this.lastSelectionSignature) {
      this.lastSelectionSignature = selectionSig
      if (this.cursorPresenceTimer != null) {
        window.clearTimeout(this.cursorPresenceTimer)
        this.cursorPresenceTimer = null
      }
      useCollabPresenceStore.getState().setPeers(peers)
      return
    }

    if (this.cursorPresenceTimer != null) return
    this.cursorPresenceTimer = window.setTimeout(() => {
      this.cursorPresenceTimer = null
      useCollabPresenceStore.getState().setPeers(this.latestPeers)
    }, CURSOR_AWARENESS_MS)
  }
}

export const canvasCollabSession = new CanvasCollabSession()
