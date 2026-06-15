import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type Connection,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodeType } from '@/domain/types'
import { isCommentBlock } from '@/domain/group/commentBlock'
import { DesignFlowNode } from './DesignNode'
import { CommentBlockNode } from './CommentBlockNode'
import { DesignFlowEdge } from './DesignEdge'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/primitives'
import { getNodeMeta } from '@/domain/templates/nodeTemplates'
import { buildFlowEdges, buildFlowNodes } from '@/lib/flowNodes'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { AiSelectionModal } from '@/components/panels/AiSelectionModal'
import { useCanvasContextMenu } from './useCanvasContextMenu'
import type { DesignNodeData } from './DesignNode'
import type { CommentBlockData } from './CommentBlockNode'

const nodeTypes = { design: DesignFlowNode, comment: CommentBlockNode }
const edgeTypes = { design: DesignFlowEdge }

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
    moveNodes,
    resizeCommentBlock,
    autoAssignGroupsAfterMove,
    addEdge,
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

  const {
    menu,
    menuItems,
    closeMenu,
    onNodeContextMenu,
    onPaneContextMenu,
  } = useCanvasContextMenu(() => setAiModalOpen(true))

  const nodeNames = useMemo(() => new Map(nodes.map((n) => [n.id, n.name])), [nodes])

  const storeFlowNodes = useMemo(
    () => buildFlowNodes(nodes, edges, nodeNames, impactMap, selectedNodeIds),
    [nodes, edges, nodeNames, impactMap, selectedNodeIds],
  )

  const [flowNodes, setFlowNodes] = useNodesState(storeFlowNodes)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (isDraggingRef.current) return
    setFlowNodes(storeFlowNodes)
  }, [storeFlowNodes, setFlowNodes])

  const flowEdges = useMemo(
    () => buildFlowEdges(edges, nodes, selectedEdgeId),
    [edges, nodes, selectedEdgeId],
  )

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return
      addEdge(conn.source, conn.target, 'requires')
    },
    [addEdge],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((current) =>
        applyNodeChanges(changes, current) as Node<DesignNodeData | CommentBlockData>[],
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

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      if (selEdges.length === 1 && selNodes.length === 0) {
        selectEdge(selEdges[0].id)
      } else if (selNodes.length === 1 && selEdges.length === 0) {
        selectNode(selNodes[0].id)
      } else if (selNodes.length > 1) {
        selectNodes(selNodes.map((n) => n.id))
      } else if (selNodes.length === 0 && selEdges.length === 0) {
        clearSelection()
      } else if (selNodes.length >= 1) {
        selectNodes(selNodes.map((n) => n.id))
      }
    },
    [selectEdge, selectNode, selectNodes, clearSelection],
  )

  const onMoveEnd = useCallback(() => {
    const vp = reactFlow.getViewport()
    setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
  }, [reactFlow, setViewport])

  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail.nodeId
      const node = nodes.find((n) => n.id === nodeId)
      if (node) {
        const offsetX = isCommentBlock(node) ? 210 : 110
        const offsetY = isCommentBlock(node) ? 150 : 36
        reactFlow.setCenter(node.position.x + offsetX, node.position.y + offsetY, {
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
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onMoveEnd={onMoveEnd}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
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
        proOptions={{ hideAttribution: true }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
          </marker>
        </defs>
        <Background gap={20} size={1} color="#E5E7EB" />
        <Controls showInteractive={false} className="!shadow-sm !border-gray-200" />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as DesignNodeData | CommentBlockData
            if (n.type === 'comment') return '#64748B'
            return getNodeMeta((data as DesignNodeData)?.nodeType).color
          }}
          className="!bg-white !border-gray-200"
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
            右键菜单 · Ctrl+C/V 复制粘贴 · 拖节点进区块自动编组
          </p>
        </Panel>
      </ReactFlow>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />}

      {project && (
        <AiSelectionModal
          open={aiModalOpen}
          onOpenChange={setAiModalOpen}
          project={project}
          selectedNodes={nodes.filter(
            (n) => selectedNodeIds.includes(n.id) && !isCommentBlock(n),
          )}
          allNodeIds={nodes.map((n) => n.id)}
          onApply={applyAiPatch}
        />
      )}
    </div>
  )
}

export function CanvasEditor() {
  return <CanvasInner />
}
