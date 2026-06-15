import { useCallback, useMemo, useState } from 'react'

import type { Edge, Node } from '@xyflow/react'

import { isCommentBlock } from '@/domain/group/commentBlock'

import { isListBlock } from '@/domain/list/listBlock'

import { RELATION_OPTIONS } from '@/domain/templates/relationPins'

import { getCreatableNodeTypes, getPaletteNodeTypes } from '@/domain/templates/nodeTemplates'

import { getGraphClipboard } from '@/lib/graphClipboard'

import { useEditorStore } from '@/store/editorStore'

import type { NodeType, RelationType } from '@/domain/types'

import type { ContextMenuItem } from '@/components/ui/ContextMenu'



export interface ContextMenuState {

  x: number

  y: number

  flowX?: number

  flowY?: number

  nodeId?: string

  edgeId?: string

}



interface CanvasContextMenuOptions {

  onAiSelection: () => void

  addNodeAt: (type: NodeType, position: { x: number; y: number }) => void

  addConnectedNode: (fromNodeId: string, type: NodeType) => void

  screenToFlow: (pos: { x: number; y: number }) => { x: number; y: number }

}



export function useCanvasContextMenu(options: CanvasContextMenuOptions) {

  const { onAiSelection, addNodeAt, addConnectedNode, screenToFlow } = options

  const [menu, setMenu] = useState<ContextMenuState | null>(null)



  const {

    nodes,

    edges,

    selectedNodeIds,

    copySelection,

    pasteSelection,

    deleteNodes,

    duplicateNodes,

    wrapNodesInComment,

    ungroupNodes,

    selectNode,

    selectEdge,

    clearSelection,

    updateEdge,

    deleteEdge,

  } = useEditorStore()

  const customNodeTypes = useEditorStore((s) => s.project?.settings.customNodeTypes)



  const closeMenu = useCallback(() => setMenu(null), [])



  const onNodeContextMenu = useCallback(

    (e: React.MouseEvent, node: Node) => {

      e.preventDefault()

      if (!selectedNodeIds.includes(node.id)) {

        selectNode(node.id)

      }

      const flow = screenToFlow({ x: e.clientX, y: e.clientY })

      setMenu({ x: e.clientX, y: e.clientY, flowX: flow.x, flowY: flow.y, nodeId: node.id })

    },

    [selectedNodeIds, selectNode, screenToFlow],

  )



  const onPaneContextMenu = useCallback(

    (e: React.MouseEvent | MouseEvent) => {

      e.preventDefault()

      const flow = screenToFlow({ x: e.clientX, y: e.clientY })

      setMenu({ x: e.clientX, y: e.clientY, flowX: flow.x, flowY: flow.y })

    },

    [screenToFlow],

  )



  const onEdgeContextMenu = useCallback(

    (e: React.MouseEvent, edge: Edge) => {

      e.preventDefault()

      selectEdge(String(edge.id))

      setMenu({ x: e.clientX, y: e.clientY, edgeId: String(edge.id) })

    },

    [selectEdge],

  )



  const targetIds = menu?.nodeId && selectedNodeIds.includes(menu.nodeId)

    ? selectedNodeIds

    : menu?.nodeId

      ? [menu.nodeId]

      : selectedNodeIds



  const designSelected = targetIds.filter((id) => {

    const n = nodes.find((x) => x.id === id)

    return n && !isCommentBlock(n)

  })



  const singleDesignNode = menu?.nodeId

    ? nodes.find((n) => n.id === menu.nodeId && !isCommentBlock(n))

    : null



  const hasGroups = targetIds.some((id) => {

    const n = nodes.find((x) => x.id === id)

    return n && isCommentBlock(n)

  })



  const contextEdge = menu?.edgeId ? edges.find((e) => e.id === menu.edgeId) : null



  const menuItems: ContextMenuItem[] = useMemo(() => {

    if (contextEdge) {

      const items: ContextMenuItem[] = RELATION_OPTIONS.map((r) => ({

        id: `rel-${r.type}`,

        label: `设为${r.label}`,

        onClick: () => updateEdge(contextEdge.id, { relationType: r.type as RelationType }),

      }))

      items.push({ id: 'sep-edge', label: '', separator: true, onClick: () => {} })

      items.push({

        id: 'del-edge',

        label: '删除连线',

        danger: true,

        onClick: () => deleteEdge(contextEdge.id),

      })

      return items

    }



    const hasSelection = targetIds.length > 0

    const canPaste = Boolean(getGraphClipboard()?.nodes.length)

    const flowPos =

      menu?.flowX != null && menu?.flowY != null

        ? { x: menu.flowX, y: menu.flowY }

        : null



    const items: ContextMenuItem[] = []



    if (singleDesignNode && !isListBlock(singleDesignNode)) {

      items.push({ id: 'add-header', label: '— 添加并连接 —', disabled: true, onClick: () => {} })

      for (const t of getCreatableNodeTypes()) {

        if (t.type === 'group') continue

        items.push({

          id: `conn-${t.type}`,

          label: `+ ${t.label}`,

          onClick: () => addConnectedNode(singleDesignNode.id, t.type as NodeType),

        })

      }

      items.push({ id: 'sep-add', label: '', separator: true, onClick: () => {} })

    }



    if (flowPos) {

      items.push({ id: 'create-header', label: '— 在此处创建 —', disabled: true, onClick: () => {} })

      for (const t of getPaletteNodeTypes()) {

        items.push({

          id: `create-${t.type}`,

          label: t.label,

          onClick: () => addNodeAt(t.type as NodeType, flowPos),

        })

      }

      items.push({ id: 'sep-create', label: '', separator: true, onClick: () => {} })

    }



    items.push(

      {

        id: 'copy',

        label: '复制',

        shortcut: 'Ctrl+C',

        disabled: !hasSelection,

        onClick: () => copySelection(),

      },

      {

        id: 'paste',

        label: '粘贴',

        shortcut: 'Ctrl+V',

        disabled: !canPaste,

        onClick: () => pasteSelection(),

      },

      {

        id: 'dup',

        label: '复制副本',

        shortcut: 'Ctrl+D',

        disabled: !hasSelection,

        onClick: () => duplicateNodes(targetIds),

      },

      { id: 'sep1', label: '', separator: true, onClick: () => {} },

      {

        id: 'delete',

        label: '删除',

        shortcut: 'Del',

        danger: true,

        disabled: !hasSelection,

        onClick: () => {

          if (confirm(`删除 ${targetIds.length} 项？`)) deleteNodes(targetIds)

        },

      },

    )



    if (designSelected.length >= 2) {

      items.push({ id: 'sep2', label: '', separator: true, onClick: () => {} })

      items.push({

        id: 'wrap',

        label: '选区建区块',

        onClick: () => wrapNodesInComment(targetIds),

      })

    }



    if (hasGroups) {

      items.push({

        id: 'ungroup',

        label: '解散区块',

        onClick: () => ungroupNodes(targetIds.filter((id) => {

          const n = nodes.find((x) => x.id === id)

          return n && isCommentBlock(n)

        })),

      })

    }



    if (designSelected.length >= 1) {

      items.push({ id: 'sep3', label: '', separator: true, onClick: () => {} })

      items.push({

        id: 'ai',

        label: 'AI 改选区',

        onClick: onAiSelection,

      })

    }



    if (!hasSelection && flowPos) {

      items.push({

        id: 'clear',

        label: '取消选择',

        disabled: selectedNodeIds.length === 0,

        onClick: () => clearSelection(),

      })

    }



    return items

  }, [

    contextEdge,

    targetIds,

    menu,

    singleDesignNode,

    designSelected.length,

    hasGroups,

    nodes,

    selectedNodeIds.length,

    copySelection,

    pasteSelection,

    duplicateNodes,

    deleteNodes,

    wrapNodesInComment,

    ungroupNodes,

    clearSelection,

    onAiSelection,

    addNodeAt,

    addConnectedNode,

    updateEdge,

    deleteEdge,

    customNodeTypes,

  ])



  return {

    menu,

    menuItems,

    closeMenu,

    onNodeContextMenu,

    onPaneContextMenu,

    onEdgeContextMenu,

    designSelected,

  }

}


