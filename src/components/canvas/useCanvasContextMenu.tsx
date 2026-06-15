import { useCallback, useMemo, useState } from 'react'
import type { Node } from '@xyflow/react'
import { isCommentBlock } from '@/domain/group/commentBlock'
import { getGraphClipboard } from '@/lib/graphClipboard'
import { useEditorStore } from '@/store/editorStore'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'

export interface ContextMenuState {
  x: number
  y: number
  nodeId?: string
}

export function useCanvasContextMenu(onAiSelection: () => void) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const {
    nodes,
    selectedNodeIds,
    copySelection,
    pasteSelection,
    deleteNodes,
    duplicateNodes,
    wrapNodesInComment,
    ungroupNodes,
    selectNode,
    clearSelection,
  } = useEditorStore()

  const closeMenu = useCallback(() => setMenu(null), [])

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault()
      if (!selectedNodeIds.includes(node.id)) {
        selectNode(node.id)
      }
      setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
    },
    [selectedNodeIds, selectNode],
  )

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY })
    },
    [],
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

  const hasGroups = targetIds.some((id) => {
    const n = nodes.find((x) => x.id === id)
    return n && isCommentBlock(n)
  })

  const menuItems: ContextMenuItem[] = useMemo(() => {
    const hasSelection = targetIds.length > 0
    const canPaste = Boolean(getGraphClipboard()?.nodes.length)

    const items: ContextMenuItem[] = [
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
    ]

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

    if (!hasSelection) {
      items.push({ id: 'sep4', label: '', separator: true, onClick: () => {} })
      items.push({
        id: 'paste2',
        label: '粘贴',
        shortcut: 'Ctrl+V',
        disabled: !canPaste,
        onClick: () => pasteSelection(),
      })
      items.push({
        id: 'clear',
        label: '取消选择',
        disabled: selectedNodeIds.length === 0,
        onClick: () => clearSelection(),
      })
    }

    return items
  }, [
    targetIds,
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
  ])

  return {
    menu,
    menuItems,
    closeMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    designSelected,
  }
}
