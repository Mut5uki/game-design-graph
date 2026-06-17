import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  applyNodeChanges,
  useNodesState,
  useReactFlow,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType, RelationType } from '@/domain/types'
import { isCommentBlock, nodeAbsolutePosition, getCommentColor } from '@/domain/group/commentBlock'
import { computeSpawnBesideNode } from '@/lib/spawnPosition'
import { DesignFlowNode } from './DesignNode'
import { CommentBlockNode } from './CommentBlockNode'
import { DesignFlowEdge } from './DesignEdge'
import { DesignConnectionLine } from './DesignConnectionLine'
import { ConnectionSpawnMenu } from './ConnectionSpawnMenu'
import { RelationPickerPopup } from './RelationTypeChips'
import { generateSpawnNodeDetails } from '@/ai/generateSpawnNode'
import { decryptApiKey } from '@/lib/crypto'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/primitives'
import { getNodeMeta, getRelationLabel } from '@/domain/templates/nodeTemplates'
import { buildFlowEdges, buildFlowNodes } from '@/lib/flowNodes'
import { collectRemoteSelectedNodeIds } from '@/collab/useCollab'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { AiSelectionModal } from '@/components/panels/AiSelectionModal'
import { useCanvasContextMenu } from './useCanvasContextMenu'
import { ExportCanvasPngButton, CanvasPngExportRegistrar } from './ExportCanvasPngButton'
import type { DesignEdgeData } from './DesignEdge'
import type { DesignNodeData } from './DesignNode'
import type { CommentBlockData } from './CommentBlockNode'
import { ListBlockNode, type ListBlockData } from './ListBlockNode'

const nodeTypes = { design: DesignFlowNode, comment: CommentBlockNode, list: ListBlockNode }
const edgeTypes = { design: DesignFlowEdge }

function hexWithAlpha(hex: string, alpha: string): string {
  if (hex.startsWith('#') && hex.length === 7) return `${hex}${alpha}`
  return hex
}

function minimapNodeColor(node: Node): string {
  if (node.type === 'comment') return 'rgba(255, 255, 255, 0.45)'
  if (node.type === 'list') return 'rgba(224, 242, 254, 0.95)'
  const data = node.data as DesignNodeData
  return hexWithAlpha(getNodeMeta(data?.nodeType).color, '55')
}

function minimapNodeStroke(node: Node): string {
  if (node.type === 'comment') {
    const data = node.data as CommentBlockData
    return getCommentColor(data?.colorId).border
  }
  if (node.type === 'list') return '#7DD3FC'
  const data = node.data as DesignNodeData
  return hexWithAlpha(getNodeMeta(data?.nodeType).color, 'CC')
}

function minimapNodeClass(node: Node): string {
  if (node.type === 'comment') return 'gdg-minimap-comment'
  if (node.type === 'list') return 'gdg-minimap-list'
  return 'gdg-minimap-design'
}

function CanvasInner() {
  const reactFlow = useReactFlow()
  const {
    project,
    nodes,
    edges,
    canvas,
    selectedNodeIds,
    selectedEdgeId,
    impactMap,
    collabPeers,
    moveNodes,
    resizeCommentBlock,
    autoAssignGroupsAfterMove,
    addEdge,
    updateEdge,
    selectNode,
    selectNodes,
    selectEdge,
    clearSelection,
    setViewport,
    autoLayout,
    addNode,
    wrapNodesInComment,
    applyAiPatch,
  } = useEditorStore()

  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [connectionMenu, setConnectionMenu] = useState<{
    x: number
    y: number
    sourceNodeId: string
    flowPosition: { x: number; y: number }
  } | null>(null)
  const [pendingConnect, setPendingConnect] = useState<{
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
    x: number
    y: number
  } | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [edgeTooltip, setEdgeTooltip] = useState<{ x: number; y: number; text: string } | null>(
    null,
  )
  const [nodeTooltip, setNodeTooltip] = useState<{
    x: number
    y: number
    title: string
    text: string
  } | null>(null)

  const screenToFlow = useCallback(
    (pos: { x: number; y: number }) => reactFlow.screenToFlowPosition(pos),
    [reactFlow],
  )

  const addNodeAt = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      const created = addNode(type, position)
      if (created && type !== 'group') {
        setTimeout(() => autoAssignGroupsAfterMove([created.id]), 0)
      }
    },
    [addNode, autoAssignGroupsAfterMove],
  )

  const addConnectedNode = useCallback(
    (fromNodeId: string, type: NodeType) => {
      const from = nodes.find((n) => n.id === fromNodeId)
      if (!from || type === 'group') return
      const abs = nodeAbsolutePosition(from, nodes)
      const pos = { x: abs.x + 280, y: abs.y }
      const created = addNode(type, pos)
      if (created) {
        addEdge(fromNodeId, created.id, 'unlocks')
        selectNode(created.id)
        setTimeout(() => autoAssignGroupsAfterMove([created.id]), 0)
      }
    },
    [nodes, addNode, addEdge, autoAssignGroupsAfterMove, selectNode],
  )

  const {
    menu,
    menuItems,
    closeMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    onEdgeContextMenu,
  } = useCanvasContextMenu({
    onAiSelection: () => setAiModalOpen(true),
    addNodeAt,
    addConnectedNode,
    screenToFlow,
  })

  const connectPointerRef = useRef({ x: 0, y: 0 })
  const trackConnectPointer = useCallback((e: MouseEvent) => {
    connectPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const nodeNames = useMemo(() => new Map(nodes.map((n) => [n.id, n.name])), [nodes])

  const remoteSelectedColors = useMemo(
    () => collectRemoteSelectedNodeIds(collabPeers),
    [collabPeers],
  )

  const storeFlowNodes = useMemo(
    () =>
      buildFlowNodes(
        nodes,
        edges,
        nodeNames,
        impactMap,
        selectedNodeIds,
        remoteSelectedColors,
      ),
    [nodes, edges, nodeNames, impactMap, selectedNodeIds, remoteSelectedColors],
  )

  const [flowNodes, setFlowNodes] = useNodesState(storeFlowNodes)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (isDraggingRef.current) return
    setFlowNodes(storeFlowNodes)
  }, [storeFlowNodes, setFlowNodes])

  const flowEdges = useMemo(
    () => buildFlowEdges(edges, nodes, selectedEdgeId, hoveredEdgeId),
    [edges, nodes, selectedEdgeId, hoveredEdgeId],
  )

  const onConnectStart = useCallback(() => {
    window.addEventListener('mousemove', trackConnectPointer)
  }, [trackConnectPointer])

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return
      setPendingConnect({
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
        x: connectPointerRef.current.x,
        y: connectPointerRef.current.y,
      })
    },
    [],
  )

  const isValidConnection = useCallback(
    (conn: Connection | { source: string | null; target: string | null }) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return false
      const fromNode = nodes.find((n) => n.id === conn.source)
      const toNode = nodes.find((n) => n.id === conn.target)
      if (!fromNode || !toNode || isCommentBlock(fromNode) || isCommentBlock(toNode)) return false
      return true
    },
    [nodes],
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: { fromNode: { id: string } | null; isValid: boolean | null }) => {
      window.removeEventListener('mousemove', trackConnectPointer)
      if (!state.fromNode || state.isValid === true) return
      const clientX = 'clientX' in event ? event.clientX : event.changedTouches[0]?.clientX ?? 0
      const clientY = 'clientY' in event ? event.clientY : event.changedTouches[0]?.clientY ?? 0
      setConnectionMenu({
        x: clientX,
        y: clientY,
        sourceNodeId: state.fromNode.id,
        flowPosition: reactFlow.screenToFlowPosition({ x: clientX, y: clientY }),
      })
    },
    [reactFlow, trackConnectPointer],
  )

  const handlePickRelation = useCallback(
    (relationType: RelationType) => {
      if (!pendingConnect) return
      addEdge(pendingConnect.source, pendingConnect.target, relationType, {
        sourceHandle: pendingConnect.sourceHandle,
        targetHandle: pendingConnect.targetHandle,
      })
      setPendingConnect(null)
    },
    [pendingConnect, addEdge],
  )

  const handleConnectExisting = useCallback(
    (targetId: string, relationType: RelationType) => {
      if (!connectionMenu) return
      addEdge(connectionMenu.sourceNodeId, targetId, relationType)
      setConnectionMenu(null)
    },
    [connectionMenu, addEdge],
  )

  const handleCreateAndConnect = useCallback(
    (type: NodeType, relationType: RelationType, name?: string) => {
      if (!connectionMenu || type === 'group') return
      const source = nodes.find((n) => n.id === connectionMenu.sourceNodeId)
      const pos = source
        ? computeSpawnBesideNode(source, nodes)
        : {
            x: connectionMenu.flowPosition.x - 100,
            y: connectionMenu.flowPosition.y - 36,
          }
      const created = addNode(type, pos, name ? { name } : undefined)
      if (created) {
        addEdge(connectionMenu.sourceNodeId, created.id, relationType)
        selectNode(created.id)
        setTimeout(() => autoAssignGroupsAfterMove([created.id]), 0)
      }
      setConnectionMenu(null)
    },
    [connectionMenu, nodes, addNode, addEdge, autoAssignGroupsAfterMove, selectNode],
  )

  const handleCreateWithAi = useCallback(
    async (name: string, type: NodeType, relationType: RelationType) => {
      if (!connectionMenu || !project?.settings.deepseekApiKeyEncrypted) {
        throw new Error('请先在设置中配置 DeepSeek API Key')
      }
      const source = nodes.find((n) => n.id === connectionMenu.sourceNodeId)
      if (!source || source.type === 'group') {
        throw new Error('无法从该节点创建连线')
      }

      const apiKey = await decryptApiKey(project.settings.deepseekApiKeyEncrypted)
      const aiResult = await generateSpawnNodeDetails({
        apiKey,
        model: project.settings.deepseekModel,
        customNodeTypes: project.settings.customNodeTypes,
        context: {
          name,
          type,
          relationType,
          sourceNode: {
            type: source.type,
            name: source.name,
            fields: source.fields,
          },
          existingIds: nodes.map((n) => n.id),
          projectNodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            name: n.name,
            fields: n.fields,
          })),
          projectEdges: edges.map((e) => ({
            from: e.from,
            to: e.to,
            relationType: e.relationType,
            label: e.label,
          })),
          customNodeTypes: project.settings.customNodeTypes,
        },
      })

      const pos = source
        ? computeSpawnBesideNode(source, nodes)
        : {
            x: connectionMenu.flowPosition.x - 100,
            y: connectionMenu.flowPosition.y - 36,
          }
      const created = addNode(type, pos, { name: aiResult.name, fields: aiResult.fields })
      if (created) {
        addEdge(connectionMenu.sourceNodeId, created.id, relationType)
        selectNode(created.id)
        setTimeout(() => autoAssignGroupsAfterMove([created.id]), 0)
      }
      setConnectionMenu(null)
    },
    [connectionMenu, project, nodes, edges, addNode, addEdge, autoAssignGroupsAfterMove, selectNode],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((current) =>
        applyNodeChanges(changes, current) as Node<
          DesignNodeData | CommentBlockData | ListBlockData
        >[],
      )

      const updates: Array<{ id: string; position: { x: number; y: number } }> = []
      const movedIds: string[] = []

      for (const change of changes) {
        if (change.type === 'position') {
          if (change.dragging === true) {
            isDraggingRef.current = true
          }
          if (change.dragging === false && change.position != null) {
            updates.push({ id: change.id, position: change.position })
            movedIds.push(change.id)
          }
        }
        if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
          const n = useEditorStore.getState().nodes.find((x) => x.id === change.id)
          if (n && isCommentBlock(n)) {
            resizeCommentBlock(change.id, change.dimensions.width, change.dimensions.height)
          }
        }
      }

      if (updates.length) {
        isDraggingRef.current = false
        moveNodes(updates)
        const assignIds = movedIds.filter((id) => {
          const n = useEditorStore.getState().nodes.find((x) => x.id === id)
          return n && !isCommentBlock(n)
        })
        if (assignIds.length) {
          requestAnimationFrame(() => autoAssignGroupsAfterMove(assignIds))
        }
      }
    },
    [setFlowNodes, moveNodes, resizeCommentBlock, autoAssignGroupsAfterMove],
  )

  const onPaneClick = useCallback(() => {
    clearSelection()
    closeMenu()
    setConnectionMenu(null)
    setPendingConnect(null)
    setHoveredEdgeId(null)
    setEdgeTooltip(null)
    setNodeTooltip(null)
  }, [clearSelection, closeMenu])

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      const { selectedNodeIds: curNodeIds, selectedEdgeId: curEdgeId } = useEditorStore.getState()

      if (selEdges.length === 1 && selNodes.length === 0) {
        if (curEdgeId === selEdges[0].id && curNodeIds.length === 0) return
        selectEdge(selEdges[0].id)
        return
      }
      if (selNodes.length === 1 && selEdges.length === 0) {
        if (curNodeIds.length === 1 && curNodeIds[0] === selNodes[0].id && !curEdgeId) return
        selectNode(selNodes[0].id)
        return
      }
      if (selNodes.length > 1) {
        const ids = selNodes.map((n) => n.id)
        if (
          ids.length === curNodeIds.length &&
          ids.every((id) => curNodeIds.includes(id)) &&
          !curEdgeId
        ) {
          return
        }
        selectNodes(ids)
        return
      }
      if (selNodes.length === 0 && selEdges.length === 0) {
        if (curNodeIds.length === 0 && !curEdgeId) return
        clearSelection()
        return
      }
      if (selNodes.length >= 1) {
        const ids = selNodes.map((n) => n.id)
        if (
          ids.length === curNodeIds.length &&
          ids.every((id) => curNodeIds.includes(id)) &&
          !curEdgeId
        ) {
          return
        }
        selectNodes(ids)
      }
    },
    [selectEdge, selectNode, selectNodes, clearSelection],
  )

  const onMoveEnd = useCallback(() => {
    const vp = reactFlow.getViewport()
    setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
  }, [reactFlow, setViewport])

  const edgeTooltipText = useCallback((data: DesignEdgeData | undefined) => {
    if (!data) return '连线'
    return data.label || getRelationLabel(String(data.relationType ?? 'requires'))
  }, [])

  const nodeDescriptionPreview = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return null
      const desc = String(node.fields.description ?? '').trim()
      if (!desc) return null
      return { title: node.name, text: desc }
    },
    [nodes],
  )

  const showNodeTooltip = useCallback(
    (e: ReactMouseEvent, nodeId: string) => {
      const preview = nodeDescriptionPreview(nodeId)
      if (!preview) {
        setNodeTooltip(null)
        return
      }
      setNodeTooltip({
        x: e.clientX,
        y: e.clientY,
        title: preview.title,
        text: preview.text,
      })
    },
    [nodeDescriptionPreview],
  )

  const onNodeMouseEnter = useCallback(
    (e: ReactMouseEvent, node: { id: string }) => {
      showNodeTooltip(e, node.id)
    },
    [showNodeTooltip],
  )

  const onNodeMouseMove = useCallback(
    (e: ReactMouseEvent, node: { id: string }) => {
      showNodeTooltip(e, node.id)
    },
    [showNodeTooltip],
  )

  const onNodeMouseLeave = useCallback(() => {
    setNodeTooltip(null)
  }, [])

  const onEdgeMouseEnter = useCallback(
    (e: ReactMouseEvent, edge: { id: string; data?: unknown }) => {
      setNodeTooltip(null)
      setHoveredEdgeId(String(edge.id))
      const data = edge.data as DesignEdgeData | undefined
      setEdgeTooltip({
        x: e.clientX,
        y: e.clientY,
        text: edgeTooltipText(data),
      })
    },
    [edgeTooltipText],
  )

  const onEdgeMouseMove = useCallback(
    (e: ReactMouseEvent, edge: { id: string; data?: unknown }) => {
      if (hoveredEdgeId !== String(edge.id)) return
      const data = edge.data as DesignEdgeData | undefined
      setEdgeTooltip({
        x: e.clientX,
        y: e.clientY,
        text: edgeTooltipText(data),
      })
    },
    [hoveredEdgeId, edgeTooltipText],
  )

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null)
    setEdgeTooltip(null)
  }, [])

  const onEdgeClick = useCallback(
    (_: ReactMouseEvent, edge: { id: string; data?: unknown }) => {
      const data = edge.data as DesignEdgeData | undefined
      selectEdge(String(data?.edgeId ?? edge.id))
    },
    [selectEdge],
  )

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return
      const data = oldEdge.data as DesignEdgeData | undefined
      const edgeId = String(data?.edgeId ?? oldEdge.id)
      updateEdge(edgeId, {
        from: newConnection.source,
        to: newConnection.target,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
      })
    },
    [updateEdge],
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail.nodeId
      const node = nodes.find((n) => n.id === nodeId)
      if (node) {
        const abs = nodeAbsolutePosition(node, nodes)
        const offsetX = isCommentBlock(node) ? 210 : 110
        const offsetY = isCommentBlock(node) ? 150 : 36
        reactFlow.setCenter(abs.x + offsetX, abs.y + offsetY, {
          zoom: 1.2,
          duration: 300,
        })
      }
    }
    window.addEventListener('gdg:focus-node', handler)
    return () => window.removeEventListener('gdg:focus-node', handler)
  }, [nodes, reactFlow])

  const defaultViewport = canvas?.viewport ?? { x: 0, y: 0, zoom: 1 }

  const selectedDesignCount = selectedNodeIds.filter((id) => {
    const n = nodes.find((x) => x.id === id)
    return n && !isCommentBlock(n)
  }).length

  return (
    <div className="w-full h-full bg-[#F7F8FA]">
      <CanvasPngExportRegistrar />
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        connectionLineComponent={DesignConnectionLine}
        connectOnClick={false}
        connectionRadius={32}
        autoPanOnConnect
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseMove={onNodeMouseMove}
        onNodeMouseLeave={onNodeMouseLeave}
        onMoveEnd={onMoveEnd}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseMove={onEdgeMouseMove}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onEdgeClick={onEdgeClick}
        onReconnect={onReconnect}
        edgesReconnectable
        reconnectRadius={9}
        edgesFocusable
        nodeClickDistance={6}
        autoPanOnNodeDrag
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        multiSelectionKeyCode="Shift"
        selectNodesOnDrag={false}
        elementsSelectable
        nodesDraggable
        nodesConnectable
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const type = e.dataTransfer.getData('application/gdg-node-type') as NodeType
          if (!type) return
          const pos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const created = addNode(type, pos)
          if (created && type !== 'group') {
            setTimeout(() => autoAssignGroupsAfterMove([created.id]), 0)
          }
        }}
        defaultViewport={defaultViewport}
        fitView={nodes.length > 0 && defaultViewport.zoom === 1 && defaultViewport.x === 0}
        deleteKeyCode={null}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#CBD5E1' },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#E5E7EB" />
        <Controls showInteractive={false} className="!shadow-sm !border-gray-200" />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeColor={minimapNodeStroke}
          nodeStrokeWidth={1}
          nodeClassName={minimapNodeClass}
          nodeBorderRadius={4}
          bgColor="#F8FAFC"
          maskColor="rgba(240, 244, 248, 0.75)"
          className="!bg-slate-50 !border-gray-200 !shadow-sm"
          zoomable
          pannable
        />
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-24">
            <div className="text-center bg-white/90 backdrop-blur rounded-lg border border-gray-200 px-8 py-6 shadow-sm">
              <p className="text-gray-600 text-sm mb-3">从左侧拖入节点，或使用 AI 生成</p>
              <Button variant="primary" onClick={() => addNode('ability', { x: 200, y: 200 })}>
                创建第一个能力节点
              </Button>
            </div>
          </Panel>
        )}
        <Panel position="top-left" className="flex flex-col gap-1 m-2 max-w-md">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={autoLayout}>自动布局</Button>
            <ExportCanvasPngButton />
            <Button size="sm" onClick={() => addNode('group', { x: 120, y: 120 })}>
              + 区块备注
            </Button>
            {selectedDesignCount >= 2 && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => wrapNodesInComment(selectedNodeIds)}
              >
                选区建区块
              </Button>
            )}
            {selectedNodeIds.length > 1 && (
              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                已选 {selectedNodeIds.length} 项
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded border border-gray-100">
            从右侧针脚拖线 · 选中连线后拖动首尾端点可改接
          </p>
        </Panel>
      </ReactFlow>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />}

      {nodeTooltip && (
        <div
          className="fixed z-[120] pointer-events-none max-w-[280px] px-3 py-2.5 text-xs bg-gray-900/92 text-white rounded-lg shadow-lg backdrop-blur-sm border border-white/10"
          style={{ left: nodeTooltip.x + 14, top: nodeTooltip.y + 14 }}
        >
          <div className="font-medium text-[13px] leading-snug mb-1.5">{nodeTooltip.title}</div>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-8">
            {nodeTooltip.text}
          </p>
        </div>
      )}

      {edgeTooltip && (
        <div
          className="fixed z-[120] pointer-events-none px-2.5 py-1.5 text-xs bg-gray-900/90 text-white rounded-md shadow-lg backdrop-blur-sm"
          style={{ left: edgeTooltip.x + 14, top: edgeTooltip.y + 14 }}
        >
          <span className="font-medium">{edgeTooltip.text}</span>
          <span className="ml-2 text-gray-400">拖动首尾改接 · 左键选中</span>
        </div>
      )}

      {connectionMenu && (
        <ConnectionSpawnMenu
          x={connectionMenu.x}
          y={connectionMenu.y}
          sourceNodeId={connectionMenu.sourceNodeId}
          nodes={nodes}
          hasAiKey={Boolean(project?.settings.deepseekApiKeyEncrypted)}
          onConnectExisting={handleConnectExisting}
          onCreateNode={handleCreateAndConnect}
          onCreateNodeWithAi={handleCreateWithAi}
          onClose={() => setConnectionMenu(null)}
        />
      )}

      {pendingConnect && (
        <RelationPickerPopup
          x={pendingConnect.x}
          y={pendingConnect.y}
          onPick={handlePickRelation}
          onClose={() => setPendingConnect(null)}
        />
      )}

      {project && (
        <AiSelectionModal
          open={aiModalOpen}
          onOpenChange={setAiModalOpen}
          project={project}
          selectedNodes={nodes.filter(
            (n) => selectedNodeIds.includes(n.id) && !isCommentBlock(n),
          )}
          allNodes={nodes.filter((n) => !isCommentBlock(n))}
          relatedEdges={edges
            .filter((e) => selectedNodeIds.includes(e.from) || selectedNodeIds.includes(e.to))
            .map((e) => {
              const nameById = new Map(nodes.map((n) => [n.id, n.name]))
              return {
                id: e.id,
                from: e.from,
                to: e.to,
                fromName: nameById.get(e.from) ?? e.from,
                toName: nameById.get(e.to) ?? e.to,
                relationType: e.relationType,
                label: e.label,
                condition: e.condition,
              }
            })}
          allNodeIds={nodes.map((n) => n.id)}
          allEdgeIds={edges.map((e) => e.id)}
          onApply={(patch) => applyAiPatch(patch, { anchorNodeIds: selectedNodeIds })}
        />
      )}
    </div>
  )
}

export function CanvasEditor() {
  return <CanvasInner />
}
