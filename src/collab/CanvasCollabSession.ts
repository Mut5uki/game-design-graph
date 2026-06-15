import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import type { DesignEdge, DesignNode } from '@/domain/types'
import {
  COLLAB_ORIGIN_LOCAL,
  createCanvasYDoc,
  isRemoteCollabOrigin,
  readCanvasGraph,
  replaceCanvasGraph,
  seedCanvasGraph,
  type CanvasYDoc,
} from '@/collab/canvasYDoc'
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
  onPeersChange: (peers: CollabPeer[]) => void
}

export interface CanvasCollabConnectOptions {
  serverUrl: string
  roomId: string
  displayName: string
  seed: { nodes: DesignNode[]; edges: DesignEdge[] }
  callbacks: CanvasCollabCallbacks
}

interface AwarenessSelection {
  nodeIds?: string[]
  edgeId?: string | null
}

export class CanvasCollabSession {
  private ydoc: CanvasYDoc | null = null
  private provider: HocuspocusProvider | null = null
  private callbacks: CanvasCollabCallbacks | null = null
  private seeded = false
  private graphObserver: (() => void) | null = null
  private synced = false

  get connected(): boolean {
    return this.synced
  }

  connect(options: CanvasCollabConnectOptions): void {
    this.disconnect()

    this.callbacks = options.callbacks
    this.callbacks.onStatusChange('connecting')

    const ydoc = createCanvasYDoc()
    this.ydoc = ydoc

    const provider = new HocuspocusProvider({
      url: options.serverUrl,
      name: options.roomId,
      document: ydoc.doc,
      token: options.displayName || defaultDisplayName(),
      onSynced: () => {
        if (!this.ydoc || !this.callbacks) return
        this.synced = true
        const { nodes: yNodes, edges: yEdges } = this.ydoc
        if (yNodes.size === 0 && yEdges.size === 0 && !this.seeded) {
          seedCanvasGraph(this.ydoc, options.seed)
          this.seeded = true
        } else {
          this.callbacks.onGraphChange(readCanvasGraph(yNodes, yEdges))
        }
        this.callbacks.onStatusChange('connected')
        this.publishAwareness(options.displayName)
        this.emitPeers()
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

    provider.awareness?.on('change', () => {
      this.emitPeers()
    })

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
  }

  pushLocalGraph(nodes: DesignNode[], edges: DesignEdge[]): void {
    if (!this.ydoc || !this.connected) return
    replaceCanvasGraph(this.ydoc, { nodes, edges }, COLLAB_ORIGIN_LOCAL)
  }

  publishSelection(selectedNodeIds: string[], selectedEdgeId: string | null): void {
    const awareness = this.provider?.awareness
    if (!awareness) return
    awareness.setLocalStateField('selection', {
      nodeIds: selectedNodeIds,
      edgeId: selectedEdgeId,
    } satisfies AwarenessSelection)
    this.emitPeers()
  }

  disconnect(): void {
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

  private publishAwareness(displayName: string): void {
    const awareness = this.provider?.awareness
    if (!awareness) return
    awareness.setLocalStateField('user', {
      name: displayName || defaultDisplayName(),
      color: pickPeerColor(awareness.clientID),
    })
  }

  private emitPeers(): void {
    const awareness = this.provider?.awareness
    if (!awareness || !this.callbacks) return

    const peers: CollabPeer[] = []
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return
      const user = state.user as CollabUser | undefined
      if (!user?.name) return
      const selection = state.selection as AwarenessSelection | undefined
      peers.push({
        clientId,
        name: user.name,
        color: user.color || pickPeerColor(clientId),
        selectedNodeIds: selection?.nodeIds ?? [],
        selectedEdgeId: selection?.edgeId ?? null,
      })
    })
    this.callbacks.onPeersChange(peers)
  }
}

export const canvasCollabSession = new CanvasCollabSession()
