import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { WebrtcProvider } from 'y-webrtc'
import type { Awareness } from 'y-protocols/awareness'
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
  type CollabMode,
  type CollabPeer,
  type CollabUser,
} from '@/collab/types'
import { DEFAULT_WEBRTC_PEER_OPTS } from '@/collab/webrtcConfig'

export interface CanvasCollabCallbacks {
  onGraphChange: (snapshot: { nodes: DesignNode[]; edges: DesignEdge[] }) => void
  onStatusChange: (
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    detail?: string,
  ) => void
  onPeersChange: (peers: CollabPeer[]) => void
  onTransportChange?: (webrtcCount: number, bcCount: number) => void
}

export interface CanvasCollabConnectOptions {
  mode: CollabMode
  roomId: string
  displayName: string
  seed: { nodes: DesignNode[]; edges: DesignEdge[] }
  callbacks: CanvasCollabCallbacks
  serverUrl?: string
  signalingUrls?: string[]
  roomPassword?: string | null
}

interface AwarenessSelection {
  nodeIds?: string[]
  edgeId?: string | null
}

type CollabProvider = HocuspocusProvider | WebrtcProvider

export class CanvasCollabSession {
  private ydoc: CanvasYDoc | null = null
  private provider: CollabProvider | null = null
  private callbacks: CanvasCollabCallbacks | null = null
  private seeded = false
  private graphObserver: (() => void) | null = null
  private synced = false
  private mode: CollabMode | null = null

  get connected(): boolean {
    return this.synced
  }

  get activeMode(): CollabMode | null {
    return this.mode
  }

  private connectTimeoutId: number | null = null

  connect(options: CanvasCollabConnectOptions): void {
    this.disconnect()
    window.setTimeout(() => this.connectImpl(options), 50)
  }

  private connectImpl(options: CanvasCollabConnectOptions): void {
    this.mode = options.mode
    this.callbacks = options.callbacks
    this.callbacks.onStatusChange('connecting')

    const ydoc = createCanvasYDoc()
    this.ydoc = ydoc
    this.attachGraphObserver(ydoc)

    this.connectTimeoutId = window.setTimeout(() => {
      if (!this.synced && this.callbacks) {
        this.callbacks.onStatusChange(
          'error',
          options.mode === 'p2p'
            ? 'P2P 连接超时，请检查信令服务器或网络（设置 → 多人协作）'
            : '协作服务器连接超时，请确认 server 已启动且地址正确',
        )
      }
    }, 12000)

    try {
      if (options.mode === 'p2p') {
        this.connectP2p(options, ydoc)
      } else {
        this.connectServer(options, ydoc)
      }
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

  private connectServer(options: CanvasCollabConnectOptions, ydoc: CanvasYDoc): void {
    const provider = new HocuspocusProvider({
      url: options.serverUrl!,
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
    provider.awareness?.on('change', () => this.emitPeers())
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

  private connectP2p(options: CanvasCollabConnectOptions, ydoc: CanvasYDoc): void {
    const signaling = options.signalingUrls?.length ? options.signalingUrls : undefined
    const password = options.roomPassword?.trim() || undefined
    let hasConnected = false

    const provider = new WebrtcProvider(options.roomId, ydoc.doc, {
      signaling,
      password,
      peerOpts: { ...DEFAULT_WEBRTC_PEER_OPTS },
    })

    this.provider = provider

    const onReady = () => {
      if (!this.ydoc || !this.callbacks || hasConnected) return
      hasConnected = true
      this.clearConnectTimeout()
      this.synced = true
      this.applyInitialGraphState(options.seed)
      this.callbacks.onStatusChange('connected')
      this.publishAwareness(options.displayName)
      this.emitPeers()
    }

    provider.awareness.on('change', () => this.emitPeers())

    provider.on('synced', ({ synced }: { synced: boolean }) => {
      if (synced) onReady()
    })

    provider.on('status', ({ connected }: { connected: boolean }) => {
      if (connected) {
        onReady()
      } else if (hasConnected) {
        this.synced = false
        this.callbacks?.onStatusChange('disconnected', 'P2P 连接已断开')
      }
    })

    provider.on('peers', (event: {
      webrtcPeers?: string[]
      bcPeers?: string[]
    }) => {
      const webrtcCount = event.webrtcPeers?.length ?? 0
      const bcCount = event.bcPeers?.length ?? 0
      this.callbacks?.onTransportChange?.(webrtcCount, bcCount)
      this.emitPeers()
    })

    window.setTimeout(() => {
      if (this.provider === provider && this.ydoc) {
        this.applyInitialGraphState(options.seed)
      }
    }, 400)
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
    replaceCanvasGraph(this.ydoc, { nodes, edges }, COLLAB_ORIGIN_LOCAL)
  }

  publishSelection(selectedNodeIds: string[], selectedEdgeId: string | null): void {
    const awareness = this.getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('selection', {
      nodeIds: selectedNodeIds,
      edgeId: selectedEdgeId,
    } satisfies AwarenessSelection)
    this.emitPeers()
  }

  disconnect(): void {
    this.clearConnectTimeout()
    this.graphObserver?.()
    this.graphObserver = null
    this.provider?.destroy()
    this.provider = null
    this.ydoc?.doc.destroy()
    this.ydoc = null
    this.callbacks = null
    this.seeded = false
    this.synced = false
    this.mode = null
  }

  private getAwareness(): Awareness | null {
    if (!this.provider) return null
    return this.provider.awareness ?? null
  }

  private publishAwareness(displayName: string): void {
    const awareness = this.getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('user', {
      name: displayName || defaultDisplayName(),
      color: pickPeerColor(awareness.clientID),
    })
  }

  private emitPeers(): void {
    const awareness = this.getAwareness()
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
