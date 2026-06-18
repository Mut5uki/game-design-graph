import { create } from 'zustand'
import type { AiGraphOutput } from '@/ai/schemas/graphSchema'
import type {
  Canvas,
  CustomNodeTypeDefinition,
  CustomRelationTypeDefinition,
  DesignEdge,
  DesignNode,
  EditorView,
  ImpactRole,
  NodeType,
  Project,
  RelationType,
  SaveStatus,
  ValidationIssue,
} from '@/domain/types'
import { applyAutoLayoutPositions } from '@/domain/layout/autoLayout'
import { validateGraph } from '@/domain/validation/validateGraph'
import {
  createCanvas,
  deleteCanvas,
  loadCanvasData,
  saveCanvasData,
  updateCanvas,
  updateProject,
} from '@/db/repositories'
import { createDefaultNodeFields, createNodeId, debounce, generateId } from '@/lib/utils'
import { resolveDefaultEdgeHandles } from '@/lib/edgeHandles'
import {
  computeSpawnNearAnchor,
  getNodeAbsolutePosition,
  isUnsetNodePosition,
} from '@/lib/spawnPosition'
import {
  buildClipboardFromSelection,
  getGraphClipboard,
  setGraphClipboard,
} from '@/lib/graphClipboard'
import { getListItems, isListBlock, type ListBlockItem } from '@/domain/list/listBlock'
import {
  COMMENT_DEFAULT_HEIGHT,
  COMMENT_DEFAULT_WIDTH,
  findGroupContainingNode,
  isCommentBlock,
  nodeAbsolutePosition,
  relativeToGroup,
} from '@/domain/group/commentBlock'
import { getNodeMeta, NODE_TYPE_META } from '@/domain/templates/nodeTemplates'
import {
  createCustomTypeId,
  pickCustomTypeColor,
  syncCustomNodeTypes,
  syncNodeTypeColorOverrides,
} from '@/domain/templates/nodeTypeRegistry'
import {
  createCustomRelationTypeId,
  pickCustomRelationColor,
  syncCustomRelationTypes,
  syncRelationTypeColorOverrides,
} from '@/domain/templates/relationTypeRegistry'
import { canvasCollabSession } from '@/collab/CanvasCollabSession'
import { graphSnapshotEqual } from '@/collab/canvasYDoc'
import { resolveActiveCollabServerUrl } from '@/collab/publicUrls'
import {
  defaultDisplayName,
  loadCollabSettings,
  type CollabStatus,
} from '@/collab/types'

let applyingRemoteCollab = false

export function isApplyingRemoteCollab(): boolean {
  return applyingRemoteCollab
}

export interface GraphSnapshot {
  nodes: DesignNode[]
  edges: DesignEdge[]
}

export interface AiGraphPatchInput {
  nodes: AiGraphOutput['nodes']
  edges: AiGraphOutput['edges']
}

export interface ApplyAiPatchOptions {
  /** 新节点默认生成在这些节点旁边（如画布选中项） */
  anchorNodeIds?: string[]
}

interface EditorState {
  project: Project | null
  canvases: Canvas[]
  canvas: Canvas | null
  nodes: DesignNode[]
  edges: DesignEdge[]
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  saveStatus: SaveStatus
  editorView: EditorView
  validationIssues: ValidationIssue[]
  showValidationPanel: boolean
  impactAnalysis: boolean
  impactMap: Map<string, ImpactRole>
  searchQuery: string
  isLoading: boolean

  setProject: (project: Project, canvases: Canvas[]) => void
  loadCanvas: (canvasId: string) => Promise<void>
  setEditorView: (view: EditorView) => void
  setSearchQuery: (q: string) => void
  setShowValidationPanel: (show: boolean) => void
  setImpactAnalysis: (on: boolean) => void

  selectNode: (id: string | null, additive?: boolean) => void
  selectNodes: (ids: string[]) => void
  selectEdge: (id: string | null) => void
  clearSelection: () => void

  addNode: (
    type: NodeType,
    position?: { x: number; y: number },
    opts?: { name?: string; fields?: Record<string, unknown> },
  ) => DesignNode | null
  updateNode: (id: string, patch: Partial<DesignNode>) => void
  updateNodeFields: (id: string, fields: Record<string, unknown>) => void
  deleteNodes: (ids: string[]) => void
  duplicateNodes: (ids: string[]) => void
  copySelection: () => void
  pasteSelection: () => void
  canPaste: () => boolean

  addEdge: (
    from: string,
    to: string,
    relationType: RelationType,
    handles?: { sourceHandle?: string | null; targetHandle?: string | null },
  ) => DesignEdge | null
  updateEdge: (id: string, patch: Partial<DesignEdge>) => void
  deleteEdge: (id: string) => void

  updateListItems: (nodeId: string, items: ListBlockItem[]) => void
  reorderListItems: (nodeId: string, fromIndex: number, toIndex: number) => void
  setListItemOffset: (nodeId: string, itemId: string, offsetX: number) => void

  moveNodes: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void
  resizeCommentBlock: (id: string, width: number, height: number) => void
  assignNodeToGroup: (nodeId: string, groupId: string | null) => void
  autoAssignGroupsAfterMove: (movedIds: string[]) => void
  wrapNodesInComment: (nodeIds: string[]) => DesignNode | null
  ungroupNodes: (nodeIds: string[]) => void
  setViewport: (viewport: Canvas['viewport']) => void
  autoLayout: () => void

  applyAiPatch: (patch: AiGraphPatchInput, opts?: ApplyAiPatchOptions) => void
  runValidation: () => ValidationIssue[]
  computeImpactForSelection: () => void
  focusNode: (id: string) => void

  markUnsaved: () => void
  setSaveStatus: (status: SaveStatus) => void
  persist: () => Promise<void>

  collabEnabled: boolean
  collabStatus: CollabStatus
  collabRoomId: string | null
  collabError: string | null
  startCollab: (roomId: string) => void
  stopCollab: () => void

  addCanvasTab: (name: string) => Promise<Canvas | null>
  renameCanvas: (id: string, name: string) => Promise<void>
  removeCanvas: (id: string) => Promise<void>

  addCustomNodeType: (label: string, color?: string) => Promise<CustomNodeTypeDefinition | null>
  updateCustomNodeType: (
    type: string,
    patch: { label?: string; color?: string },
  ) => Promise<boolean>
  setNodeTypeColor: (type: string, color: string) => Promise<boolean>
  resetNodeTypeColor: (type: string) => Promise<boolean>
  removeCustomNodeType: (type: string) => Promise<boolean>

  addCustomRelationType: (label: string, color?: string) => Promise<CustomRelationTypeDefinition | null>
  updateCustomRelationType: (
    type: string,
    patch: { label?: string; color?: string },
  ) => Promise<boolean>
  setRelationTypeColor: (type: string, color: string) => Promise<boolean>
  resetRelationTypeColor: (type: string) => Promise<boolean>
  removeCustomRelationType: (type: string) => Promise<boolean>
}

function buildImpactMap(
  selectedIds: string[],
  edges: DesignEdge[],
): Map<string, ImpactRole> {
  const map = new Map<string, ImpactRole>()
  if (selectedIds.length !== 1) return map

  const nodeId = selectedIds[0]
  const up = new Set<string>()
  const down = new Set<string>()
  const upQ = [nodeId]
  const downQ = [nodeId]

  while (upQ.length) {
    const c = upQ.pop()!
    for (const e of edges) {
      if (e.to === c && !up.has(e.from)) {
        up.add(e.from)
        upQ.push(e.from)
      }
    }
  }

  while (downQ.length) {
    const c = downQ.pop()!
    for (const e of edges) {
      if (e.from === c && !down.has(e.to)) {
        down.add(e.to)
        downQ.push(e.to)
      }
    }
  }

  up.delete(nodeId)
  down.delete(nodeId)

  for (const id of up) map.set(id, 'upstream')
  for (const id of down) map.set(id, 'downstream')
  return map
}

interface HistoryState {
  past: GraphSnapshot[]
  future: GraphSnapshot[]
}

let history: HistoryState = { past: [], future: [] }

function snapshot(nodes: DesignNode[], edges: DesignEdge[]): GraphSnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  }
}

function pushHistory(nodes: DesignNode[], edges: DesignEdge[]) {
  history.past.push(snapshot(nodes, edges))
  if (history.past.length > 50) history.past.shift()
  history.future = []
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  canvases: [],
  canvas: null,
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeId: null,
  saveStatus: 'saved',
  editorView: 'canvas',
  validationIssues: [],
  showValidationPanel: false,
  impactAnalysis: false,
  impactMap: new Map(),
  searchQuery: '',
  isLoading: false,
  collabEnabled: false,
  collabStatus: 'offline',
  collabRoomId: null,
  collabError: null,

  setProject: (project, canvases) => {
    syncCustomNodeTypes(project.settings.customNodeTypes)
    syncNodeTypeColorOverrides(project.settings.nodeTypeColorOverrides)
    syncCustomRelationTypes(project.settings.customRelationTypes)
    syncRelationTypeColorOverrides(project.settings.relationTypeColorOverrides)
    set({ project, canvases })
  },

  loadCanvas: async (canvasId) => {
    get().stopCollab()
    const { project, canvases } = get()
    if (!project) return
    set({ isLoading: true })
    const canvas = canvases.find((c) => c.id === canvasId)
    if (!canvas) {
      set({ isLoading: false })
      return
    }
    const { nodes, edges } = await loadCanvasData(canvasId)
    history = { past: [], future: [] }
    const issues = validateGraph(nodes, edges)
    set({
      canvas,
      nodes,
      edges,
      selectedNodeIds: [],
      selectedEdgeId: null,
      saveStatus: 'saved',
      validationIssues: issues,
      impactMap: new Map(),
      isLoading: false,
    })
  },

  setEditorView: (view) => set({ editorView: view }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowValidationPanel: (show) => set({ showValidationPanel: show }),
  setImpactAnalysis: (on) => {
    set({ impactAnalysis: on })
    if (on) get().computeImpactForSelection()
    else set({ impactMap: new Map() })
  },

  selectNode: (id, additive = false) => {
    if (!id) {
      set({ selectedNodeIds: [], selectedEdgeId: null, impactMap: new Map() })
      return
    }
    const { selectedNodeIds, impactAnalysis, edges } = get()
    const next = additive
      ? selectedNodeIds.includes(id)
        ? selectedNodeIds.filter((x) => x !== id)
        : [...selectedNodeIds, id]
      : [id]
    const impactMap =
      impactAnalysis && next.length === 1 ? buildImpactMap(next, edges) : new Map()
    set({ selectedNodeIds: next, selectedEdgeId: null, impactMap })
  },

  selectNodes: (ids) => {
    const { impactAnalysis, edges } = get()
    const unique = [...new Set(ids)]
    const impactMap =
      impactAnalysis && unique.length === 1 ? buildImpactMap(unique, edges) : new Map()
    set({ selectedNodeIds: unique, selectedEdgeId: null, impactMap })
  },

  selectEdge: (id) =>
    set({ selectedEdgeId: id, selectedNodeIds: [], impactMap: new Map() }),

  clearSelection: () =>
    set({ selectedNodeIds: [], selectedEdgeId: null, impactMap: new Map() }),

  addNode: (type, position = { x: 100, y: 100 }, opts) => {
    const { project, canvas, nodes } = get()
    if (!project || !canvas) return null

    const existingIds = new Set(nodes.map((n) => n.id))
    const meta = getNodeMeta(type)
    const defaultName = `新${meta.label}`
    const name = opts?.name?.trim() || defaultName
    const id = createNodeId(type, name, existingIds)
    const now = Date.now()

    const node: DesignNode = {
      id,
      projectId: project.id,
      canvasId: canvas.id,
      type,
      name,
      fields: opts?.fields ? { ...createDefaultNodeFields(type), ...opts.fields } : createDefaultNodeFields(type),
      position,
      createdAt: now,
      updatedAt: now,
    }

    pushHistory(nodes, get().edges)
    const nextNodes = [...nodes, node]
    set({
      nodes: nextNodes,
      selectedNodeIds: [id],
      validationIssues: validateGraph(nextNodes, get().edges),
      saveStatus: 'unsaved',
    })
    get().persist()
    return node
  },

  updateNode: (id, patch) => {
    const { nodes, edges } = get()
    pushHistory(nodes, edges)
    const nextNodes = nodes.map((n) =>
      n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
    )
    set({
      nodes: nextNodes,
      validationIssues: validateGraph(nextNodes, edges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  updateNodeFields: (id, fields) => {
    const { nodes, edges } = get()
    pushHistory(nodes, edges)
    const nextNodes = nodes.map((n) =>
      n.id === id
        ? { ...n, fields: { ...n.fields, ...fields }, updatedAt: Date.now() }
        : n,
    )
    set({
      nodes: nextNodes,
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  deleteNodes: (ids) => {
    const { nodes, edges, selectedNodeIds } = get()
    pushHistory(nodes, edges)
    const idSet = new Set(ids)
    const deletedGroups = new Set(ids.filter((id) => nodes.some((n) => n.id === id && isCommentBlock(n))))

    const nextNodes = nodes
      .filter((n) => !idSet.has(n.id))
      .map((n) => {
        if (n.parentGroupId && deletedGroups.has(n.parentGroupId)) {
          const parent = nodes.find((p) => p.id === n.parentGroupId)
          if (!parent) return { ...n, parentGroupId: undefined }
          const abs = nodeAbsolutePosition(n, nodes)
          return {
            ...n,
            parentGroupId: undefined,
            position: abs,
            updatedAt: Date.now(),
          }
        }
        return n
      })

    const nextEdges = edges.filter((e) => !idSet.has(e.from) && !idSet.has(e.to))
    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeIds: selectedNodeIds.filter((id) => !idSet.has(id)),
      validationIssues: validateGraph(nextNodes, nextEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  duplicateNodes: (ids) => {
    const { nodes, edges, project, canvas } = get()
    if (!project || !canvas) return
    pushHistory(nodes, edges)
    const existingIds = new Set(nodes.map((n) => n.id))
    const idMap = new Map<string, string>()
    const now = Date.now()
    const copies: DesignNode[] = []

    for (const id of ids) {
      const src = nodes.find((n) => n.id === id)
      if (!src) continue
      const newId = createNodeId(src.type, `${src.name}_copy`, existingIds)
      existingIds.add(newId)
      idMap.set(id, newId)
      copies.push({
        ...structuredClone(src),
        id: newId,
        name: `${src.name} (副本)`,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        parentGroupId: undefined,
        createdAt: now,
        updatedAt: now,
      })
    }

    const nextNodes = [...nodes, ...copies]
    set({
      nodes: nextNodes,
      selectedNodeIds: copies.map((n) => n.id),
      validationIssues: validateGraph(nextNodes, edges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  copySelection: () => {
    const { nodes, edges, selectedNodeIds } = get()
    const data = buildClipboardFromSelection(nodes, edges, selectedNodeIds)
    if (data) setGraphClipboard(data)
  },

  canPaste: () => Boolean(getGraphClipboard()?.nodes.length),

  pasteSelection: () => {
    const clip = getGraphClipboard()
    const { project, canvas, nodes, edges } = get()
    if (!clip?.nodes.length || !project || !canvas) return

    pushHistory(nodes, edges)
    const offset = 40
    const idMap = new Map<string, string>()
    const existingIds = new Set(nodes.map((n) => n.id))
    const now = Date.now()

    for (const n of clip.nodes) {
      const newId = createNodeId(n.type, n.name.replace(/ \(副本\)$/, ''), existingIds)
      existingIds.add(newId)
      idMap.set(n.id, newId)
    }

    const newNodes: DesignNode[] = clip.nodes.map((n) => {
      const newParentId =
        n.parentGroupId && idMap.has(n.parentGroupId) ? idMap.get(n.parentGroupId) : undefined
      const pos = newParentId
        ? { x: n.position.x, y: n.position.y }
        : { x: n.position.x + offset, y: n.position.y + offset }
      return {
        ...structuredClone(n),
        id: idMap.get(n.id)!,
        projectId: project.id,
        canvasId: canvas.id,
        position: pos,
        parentGroupId: newParentId,
        createdAt: now,
        updatedAt: now,
      }
    })

    const newEdges: DesignEdge[] = clip.edges.map((e) => ({
      ...structuredClone(e),
      id: generateId('edge'),
      from: idMap.get(e.from)!,
      to: idMap.get(e.to)!,
      projectId: project.id,
      canvasId: canvas.id,
      createdAt: now,
      updatedAt: now,
    }))

    const nextNodes = [...nodes, ...newNodes]
    const nextEdges = [...edges, ...newEdges]
    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeIds: newNodes.map((n) => n.id),
      validationIssues: validateGraph(nextNodes, nextEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  addEdge: (from, to, relationType, handles) => {
    const { project, canvas, nodes, edges } = get()
    if (!project || !canvas || from === to) return null
    const fromNode = nodes.find((n) => n.id === from)
    const toNode = nodes.find((n) => n.id === to)
    if (!fromNode || !toNode || isCommentBlock(fromNode) || isCommentBlock(toNode)) return null
    const resolved = resolveDefaultEdgeHandles(fromNode, toNode, handles?.sourceHandle, handles?.targetHandle)
    const sourceHandle = resolved.sourceHandle
    const targetHandle = resolved.targetHandle
    if (
      edges.some(
        (e) =>
          e.from === from &&
          e.to === to &&
          e.relationType === relationType &&
          (e.sourceHandle ?? null) === (sourceHandle ?? null) &&
          (e.targetHandle ?? null) === (targetHandle ?? null),
      )
    )
      return null

    pushHistory(nodes, edges)
    const now = Date.now()
    const edge: DesignEdge = {
      id: generateId('edge'),
      projectId: project.id,
      canvasId: canvas.id,
      from,
      to,
      relationType,
      sourceHandle: sourceHandle ?? undefined,
      targetHandle: targetHandle ?? undefined,
      createdAt: now,
      updatedAt: now,
    }
    const nextEdges = [...edges, edge]
    set({
      edges: nextEdges,
      validationIssues: validateGraph(nodes, nextEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
    return edge
  },

  updateListItems: (nodeId, items) => {
    const { nodes, edges } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || !isListBlock(node)) return
    pushHistory(nodes, edges)
    const nextNodes = nodes.map((n) =>
      n.id === nodeId
        ? { ...n, fields: { ...n.fields, items }, updatedAt: Date.now() }
        : n,
    )
    set({ nodes: nextNodes, saveStatus: 'unsaved' })
    get().persist()
  },

  reorderListItems: (nodeId, fromIndex, toIndex) => {
    const { nodes, edges } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || !isListBlock(node)) return
    const items = getListItems(node)
    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    pushHistory(nodes, edges)
    const nextNodes = nodes.map((n) =>
      n.id === nodeId
        ? { ...n, fields: { ...n.fields, items: next }, updatedAt: Date.now() }
        : n,
    )
    set({ nodes: nextNodes, saveStatus: 'unsaved' })
    get().persist()
  },

  setListItemOffset: (nodeId, itemId, offsetX) => {
    const { nodes } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || !isListBlock(node)) return
    const items = getListItems(node).map((it) =>
      it.id === itemId ? { ...it, offsetX } : it,
    )
    const nextNodes = nodes.map((n) =>
      n.id === nodeId
        ? { ...n, fields: { ...n.fields, items }, updatedAt: Date.now() }
        : n,
    )
    set({ nodes: nextNodes, saveStatus: 'unsaved' })
    debouncedPersist()
  },

  updateEdge: (id, patch) => {
    const { nodes, edges } = get()
    pushHistory(nodes, edges)
    const nextEdges = edges.map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
    )
    set({
      edges: nextEdges,
      validationIssues: validateGraph(nodes, nextEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  deleteEdge: (id) => {
    const { nodes, edges } = get()
    pushHistory(nodes, edges)
    const nextEdges = edges.filter((e) => e.id !== id)
    set({
      edges: nextEdges,
      selectedEdgeId: null,
      validationIssues: validateGraph(nodes, nextEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  moveNodes: (updates) => {
    const { nodes } = get()
    const posMap = new Map(updates.map((u) => [u.id, u.position]))
    const nextNodes = nodes.map((n) => {
      const pos = posMap.get(n.id)
      return pos ? { ...n, position: pos, updatedAt: Date.now() } : n
    })
    set({ nodes: nextNodes, saveStatus: 'unsaved' })
    debouncedPersist()
  },

  resizeCommentBlock: (id, width, height) => {
    const { nodes, edges } = get()
    const node = nodes.find((n) => n.id === id)
    if (!node || !isCommentBlock(node)) return
    pushHistory(nodes, edges)
    const nextNodes = nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            fields: { ...n.fields, width: Math.round(width), height: Math.round(height) },
            updatedAt: Date.now(),
          }
        : n,
    )
    set({ nodes: nextNodes, saveStatus: 'unsaved' })
    get().persist()
  },

  assignNodeToGroup: (nodeId, groupId) => {
    const { nodes, edges } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || isCommentBlock(node)) return

    pushHistory(nodes, edges)

    let nextNodes = [...nodes]

    if (!groupId) {
      if (!node.parentGroupId) return
      const parent = nodes.find((n) => n.id === node.parentGroupId)
      if (!parent) return
      const abs = nodeAbsolutePosition(node, nodes)
      nextNodes = nextNodes.map((n) =>
        n.id === nodeId
          ? { ...n, parentGroupId: undefined, position: abs, updatedAt: Date.now() }
          : n,
      )
    } else {
      const group = nodes.find((n) => n.id === groupId)
      if (!group || !isCommentBlock(group)) return
      const abs = nodeAbsolutePosition(node, nodes)
      const rel = relativeToGroup(abs, group)
      nextNodes = nextNodes.map((n) =>
        n.id === nodeId
          ? { ...n, parentGroupId: groupId, position: rel, updatedAt: Date.now() }
          : n,
      )
    }

    set({
      nodes: nextNodes,
      validationIssues: validateGraph(nextNodes, edges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  autoAssignGroupsAfterMove: (movedIds) => {
    const { nodes } = get()
    let current = nodes
    let changed = false

    for (const id of movedIds) {
      const node = current.find((n) => n.id === id)
      if (!node || isCommentBlock(node)) continue

      const containing = findGroupContainingNode(node, current)
      const targetGroupId = containing?.id ?? null

      if (targetGroupId === (node.parentGroupId ?? null)) continue

      if (!targetGroupId) {
        if (!node.parentGroupId) continue
        const parent = current.find((n) => n.id === node.parentGroupId)
        if (!parent) continue
        const abs = nodeAbsolutePosition(node, current)
        current = current.map((n) =>
          n.id === id
            ? { ...n, parentGroupId: undefined, position: abs, updatedAt: Date.now() }
            : n,
        )
        changed = true
      } else {
        const group = current.find((n) => n.id === targetGroupId)!
        const abs = nodeAbsolutePosition(node, current)
        const rel = relativeToGroup(abs, group)
        current = current.map((n) =>
          n.id === id
            ? { ...n, parentGroupId: targetGroupId, position: rel, updatedAt: Date.now() }
            : n,
        )
        changed = true
      }
    }

    if (changed) {
      pushHistory(nodes, get().edges)
      set({
        nodes: current,
        validationIssues: validateGraph(current, get().edges),
        saveStatus: 'unsaved',
      })
      get().persist()
    }
  },

  wrapNodesInComment: (nodeIds) => {
    const { project, canvas, nodes, edges } = get()
    if (!project || !canvas) return null

    const targets = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is DesignNode => Boolean(n && !isCommentBlock(n)))

    if (targets.length === 0) return null

    pushHistory(nodes, edges)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const n of targets) {
      const abs = nodeAbsolutePosition(n, nodes)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + 220)
      maxY = Math.max(maxY, abs.y + 72)
    }

    const padding = 48
    const groupX = minX - padding
    const groupY = minY - padding
    const width = Math.max(COMMENT_DEFAULT_WIDTH, maxX - minX + padding * 2)
    const height = Math.max(COMMENT_DEFAULT_HEIGHT, maxY - minY + padding * 2)

    const existingIds = new Set(nodes.map((n) => n.id))
    const groupId = createNodeId('group', '新区块', existingIds)
    const now = Date.now()

    const group: DesignNode = {
      id: groupId,
      projectId: project.id,
      canvasId: canvas.id,
      type: 'group',
      name: '新区块',
      fields: createDefaultNodeFields('group'),
      position: { x: groupX, y: groupY },
      createdAt: now,
      updatedAt: now,
    }
    group.fields = { ...group.fields, width, height }

    const targetIds = new Set(targets.map((t) => t.id))
    let nextNodes: DesignNode[] = [
      group,
      ...nodes.map((n) => {
        if (!targetIds.has(n.id)) return n
        const abs = nodeAbsolutePosition(n, nodes)
        return {
          ...n,
          parentGroupId: groupId,
          position: relativeToGroup(abs, group),
          updatedAt: now,
        }
      }),
    ]

    set({
      nodes: nextNodes,
      selectedNodeIds: [groupId],
      validationIssues: validateGraph(nextNodes, edges),
      saveStatus: 'unsaved',
    })
    get().persist()
    return group
  },

  ungroupNodes: (nodeIds) => {
    const { nodes, edges } = get()
    const toUngroup = nodeIds.filter((id) => {
      const n = nodes.find((x) => x.id === id)
      return n && isCommentBlock(n)
    })
    if (!toUngroup.length) return

    pushHistory(nodes, edges)
    const groupSet = new Set(toUngroup)

    const nextNodes = nodes
      .filter((n) => !groupSet.has(n.id))
      .map((n) => {
        if (n.parentGroupId && groupSet.has(n.parentGroupId)) {
          const parent = nodes.find((p) => p.id === n.parentGroupId)
          if (!parent) return { ...n, parentGroupId: undefined }
          return {
            ...n,
            parentGroupId: undefined,
            position: nodeAbsolutePosition(n, nodes),
            updatedAt: Date.now(),
          }
        }
        return n
      })

    set({
      nodes: nextNodes,
      selectedNodeIds: [],
      validationIssues: validateGraph(nextNodes, edges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  setViewport: (viewport) => {
    const { canvas } = get()
    if (!canvas) return
    set({ canvas: { ...canvas, viewport } })
    debouncedPersistViewport()
  },

  autoLayout: () => {
    const { nodes, edges } = get()
    pushHistory(nodes, edges)
    const layoutTargets = nodes.filter((n) => !isCommentBlock(n) && !n.parentGroupId)
    const layoutEdges = edges.filter((e) =>
      layoutTargets.some((n) => n.id === e.from) && layoutTargets.some((n) => n.id === e.to),
    )
    const laidOutPart = applyAutoLayoutPositions(layoutTargets, layoutEdges)
    const laidOutMap = new Map(laidOutPart.map((n) => [n.id, n]))
    const nextNodes = nodes.map((n) => laidOutMap.get(n.id) ?? n)
    set({
      nodes: nextNodes,
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  applyAiPatch: (patch, opts) => {
    const { project, canvas, nodes, edges } = get()
    if (!project || !canvas) return
    pushHistory(nodes, edges)

    const existingById = new Map(nodes.map((n) => [n.id, n]))
    const now = Date.now()

    const mergedNodes = [...nodes]
    const needsPosition = new Set<string>()

    for (const n of patch.nodes) {
      const existing = existingById.get(n.id)
      if (existing) {
        const idx = mergedNodes.findIndex((x) => x.id === n.id)
        const nextPosition =
          existing && isUnsetNodePosition(n.position) ? existing.position : (n.position ?? existing.position)
        mergedNodes[idx] = {
          ...existing,
          type: (n.type as NodeType) || existing.type,
          name: n.name ?? existing.name,
          fields: { ...existing.fields, ...n.fields },
          position: nextPosition,
          updatedAt: now,
        }
      } else {
        if (isUnsetNodePosition(n.position)) needsPosition.add(n.id)
        const created: DesignNode = {
          id: n.id,
          projectId: project.id,
          canvasId: canvas.id,
          type: n.type as NodeType,
          name: n.name,
          fields: { ...createDefaultNodeFields(n.type as NodeType), ...n.fields },
          position: isUnsetNodePosition(n.position) ? { x: 0, y: 0 } : n.position!,
          createdAt: now,
          updatedAt: now,
        }
        mergedNodes.push(created)
        existingById.set(n.id, created)
      }
    }

    if (needsPosition.size > 0) {
      const nodeMap = new Map(mergedNodes.map((n) => [n.id, n]))
      const anchorCandidates = (opts?.anchorNodeIds ?? []).filter((id) => {
        const n = nodeMap.get(id)
        return n && !needsPosition.has(id)
      })
      let defaultAnchor = { x: 120, y: 120 }
      if (anchorCandidates.length > 0) {
        defaultAnchor = getNodeAbsolutePosition(nodeMap.get(anchorCandidates[0])!, mergedNodes)
      } else {
        const firstExisting = mergedNodes.find((n) => !needsPosition.has(n.id))
        if (firstExisting) {
          defaultAnchor = getNodeAbsolutePosition(firstExisting, mergedNodes)
        }
      }

      let offset = 0
      for (const id of needsPosition) {
        const node = nodeMap.get(id)
        if (!node) continue

        const link = patch.edges.find((e) => e.from === id || e.to === id)
        let anchor = defaultAnchor
        if (link) {
          const otherId = link.from === id ? link.to : link.from
          const other = nodeMap.get(otherId)
          if (other && !needsPosition.has(otherId)) {
            anchor = getNodeAbsolutePosition(other, mergedNodes)
          }
        } else if (anchorCandidates.length > 0) {
          const anchorNode = nodeMap.get(anchorCandidates[0]!)
          if (anchorNode) anchor = getNodeAbsolutePosition(anchorNode, mergedNodes)
        }

        node.position = computeSpawnNearAnchor(anchor, offset)
        offset++
      }
    }

    const mergedEdges = [...edges]
    for (const e of patch.edges) {
      const edgePayload = {
        from: e.from,
        to: e.to,
        relationType: e.relationType,
        condition: e.condition,
        label: e.label,
      }

      if (e.id) {
        const idx = mergedEdges.findIndex((x) => x.id === e.id)
        if (idx >= 0) {
          mergedEdges[idx] = { ...mergedEdges[idx], ...edgePayload, updatedAt: now }
          continue
        }
      }

      const dupIdx = mergedEdges.findIndex(
        (x) => x.from === e.from && x.to === e.to && x.relationType === e.relationType,
      )
      if (dupIdx >= 0) {
        mergedEdges[dupIdx] = {
          ...mergedEdges[dupIdx],
          condition: e.condition ?? mergedEdges[dupIdx].condition,
          label: e.label ?? mergedEdges[dupIdx].label,
          updatedAt: now,
        }
      } else {
        mergedEdges.push({
          id: e.id ?? generateId('edge'),
          projectId: project.id,
          canvasId: canvas.id,
          ...edgePayload,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    set({
      nodes: mergedNodes,
      edges: mergedEdges,
      validationIssues: validateGraph(mergedNodes, mergedEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
  },

  runValidation: () => {
    const issues = validateGraph(get().nodes, get().edges)
    set({ validationIssues: issues, showValidationPanel: true })
    return issues
  },

  computeImpactForSelection: () => {
    const { selectedNodeIds, edges, impactAnalysis } = get()
    if (!impactAnalysis) return
    set({ impactMap: buildImpactMap(selectedNodeIds, edges) })
  },

  focusNode: (id) => {
    set({ selectedNodeIds: [id], selectedEdgeId: null })
    window.dispatchEvent(new CustomEvent('gdg:focus-node', { detail: { nodeId: id } }))
  },

  markUnsaved: () => set({ saveStatus: 'unsaved' }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  persist: async () => {
    const { canvas, nodes, edges } = get()
    if (!canvas) return
    set({ saveStatus: 'saving' })
    try {
      await saveCanvasData(canvas, nodes, edges)
      set({ saveStatus: 'saved' })
    } catch {
      set({ saveStatus: 'error' })
    }
  },

  startCollab: (roomId) => {
    const { nodes, edges, canvas } = get()
    if (!canvas) {
      set({
        collabError: '画布尚未加载，请稍后再试',
        collabStatus: 'error',
      })
      return
    }

    const settings = loadCollabSettings()
    const displayName = settings.displayName.trim() || defaultDisplayName()

    set({
      collabEnabled: true,
      collabRoomId: roomId,
      collabStatus: 'connecting',
      collabError: null,
    })

    const serverUrl = resolveActiveCollabServerUrl()

    canvasCollabSession.connect({
      roomId,
      displayName,
      serverUrl,
      seed: { nodes, edges },
      callbacks: {
        onGraphChange: (snapshot) => {
          const { nodes, edges } = get()
          if (graphSnapshotEqual({ nodes, edges }, snapshot)) return

          applyingRemoteCollab = true
          const issues = validateGraph(snapshot.nodes, snapshot.edges)
          set({
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            validationIssues: issues,
          })
          applyingRemoteCollab = false
          debouncedCollabRemotePersist()
        },
        onStatusChange: (status, detail) => {
          if (status === 'connected') {
            set({ collabStatus: 'connected', collabError: null })
            return
          }
          if (status === 'connecting') {
            set({ collabStatus: 'connecting' })
            return
          }
          if (status === 'error') {
            set({
              collabStatus: 'error',
              collabError: detail ?? '协作连接失败',
            })
            return
          }
          if (status === 'disconnected') {
            set({
              collabStatus: 'error',
              collabError: detail ?? '协作已断开',
              collabEnabled: false,
              collabRoomId: null,
            })
            return
          }
          set({
            collabStatus: 'offline',
            collabEnabled: false,
            collabRoomId: null,
          })
        },
      },
    })
  },

  stopCollab: () => {
    canvasCollabSession.disconnect()
    set({
      collabEnabled: false,
      collabRoomId: null,
      collabStatus: 'offline',
      collabError: null,
    })
  },

  addCanvasTab: async (name) => {
    const { project } = get()
    if (!project) return null
    const canvas = await createCanvas(project.id, name)
    set({ canvases: [...get().canvases, canvas] })
    return canvas
  },

  renameCanvas: async (id, name) => {
    const { canvases } = get()
    const canvas = canvases.find((c) => c.id === id)
    if (!canvas) return
    const updated = { ...canvas, name, updatedAt: Date.now() }
    await updateCanvas(updated)
    set({ canvases: canvases.map((c) => (c.id === id ? updated : c)), canvas: get().canvas?.id === id ? updated : get().canvas })
  },

  removeCanvas: async (id) => {
    const { project, canvases, canvas } = get()
    if (!project || canvases.length <= 1) return
    await deleteCanvas(id, project.id)
    const next = canvases.filter((c) => c.id !== id)
    set({ canvases: next })
    if (canvas?.id === id) {
      await get().loadCanvas(next[0].id)
    }
  },

  addCustomNodeType: async (label, color) => {
    const { project } = get()
    const trimmed = label.trim()
    if (!project || !trimmed) return null

    const customs = project.settings.customNodeTypes ?? []
    const typeId = createCustomTypeId(trimmed, customs, new Set(Object.keys(NODE_TYPE_META)))
    const def: CustomNodeTypeDefinition = {
      type: typeId,
      label: trimmed,
      color: color ?? pickCustomTypeColor(customs.length),
      defaultFields: { description: '' },
    }
    const nextCustoms = [...customs, def]
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, customNodeTypes: nextCustoms },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncCustomNodeTypes(nextCustoms)
    set({ project: updatedProject })
    return def
  },

  updateCustomNodeType: async (type, patch) => {
    const { project } = get()
    if (!project || !type.startsWith('custom_')) return false

    const trimmedLabel = patch.label?.trim()
    if (patch.label !== undefined && !trimmedLabel) return false

    const customs = project.settings.customNodeTypes ?? []
    const idx = customs.findIndex((d) => d.type === type)
    if (idx === -1) return false

    const nextCustoms = customs.map((d, i) =>
      i === idx
        ? {
            ...d,
            ...(trimmedLabel ? { label: trimmedLabel } : {}),
            ...(patch.color ? { color: patch.color } : {}),
          }
        : d,
    )
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, customNodeTypes: nextCustoms },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncCustomNodeTypes(nextCustoms)
    set({ project: updatedProject })
    return true
  },

  setNodeTypeColor: async (type, color) => {
    const { project } = get()
    if (!project || !color) return false

    if (type.startsWith('custom_')) {
      return get().updateCustomNodeType(type, { color })
    }

    const overrides = { ...(project.settings.nodeTypeColorOverrides ?? {}), [type]: color }
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, nodeTypeColorOverrides: overrides },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncNodeTypeColorOverrides(overrides)
    set({ project: updatedProject })
    return true
  },

  resetNodeTypeColor: async (type) => {
    const { project } = get()
    if (!project || type.startsWith('custom_')) return false

    const overrides = { ...(project.settings.nodeTypeColorOverrides ?? {}) }
    if (!(type in overrides)) return true
    delete overrides[type]

    const updatedProject: Project = {
      ...project,
      settings: {
        ...project.settings,
        nodeTypeColorOverrides: Object.keys(overrides).length ? overrides : undefined,
      },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncNodeTypeColorOverrides(updatedProject.settings.nodeTypeColorOverrides)
    set({ project: updatedProject })
    return true
  },

  removeCustomNodeType: async (type) => {
    const { project, nodes } = get()
    if (!project || !type.startsWith('custom_')) return false
    if (nodes.some((n) => n.type === type)) return false

    const customs = (project.settings.customNodeTypes ?? []).filter((d) => d.type !== type)
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, customNodeTypes: customs },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncCustomNodeTypes(customs)
    set({ project: updatedProject })
    return true
  },

  addCustomRelationType: async (label, color) => {
    const { project } = get()
    const trimmed = label.trim()
    if (!project || !trimmed) return null

    const customs = project.settings.customRelationTypes ?? []
    const typeId = createCustomRelationTypeId(trimmed, customs)
    const def: CustomRelationTypeDefinition = {
      type: typeId,
      label: trimmed,
      color: color ?? pickCustomRelationColor(customs.length),
    }
    const nextCustoms = [...customs, def]
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, customRelationTypes: nextCustoms },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncCustomRelationTypes(nextCustoms)
    set({ project: updatedProject })
    return def
  },

  updateCustomRelationType: async (type, patch) => {
    const { project } = get()
    if (!project || !type.startsWith('rel_')) return false

    const trimmedLabel = patch.label?.trim()
    if (patch.label !== undefined && !trimmedLabel) return false

    const customs = project.settings.customRelationTypes ?? []
    const idx = customs.findIndex((d) => d.type === type)
    if (idx === -1) return false

    const nextCustoms = customs.map((d, i) =>
      i === idx
        ? {
            ...d,
            ...(trimmedLabel ? { label: trimmedLabel } : {}),
            ...(patch.color ? { color: patch.color } : {}),
          }
        : d,
    )
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, customRelationTypes: nextCustoms },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncCustomRelationTypes(nextCustoms)
    set({ project: updatedProject })
    return true
  },

  setRelationTypeColor: async (type, color) => {
    const { project } = get()
    if (!project || !color) return false

    if (type.startsWith('rel_')) {
      return get().updateCustomRelationType(type, { color })
    }

    const overrides = { ...(project.settings.relationTypeColorOverrides ?? {}), [type]: color }
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, relationTypeColorOverrides: overrides },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncRelationTypeColorOverrides(overrides)
    set({ project: updatedProject })
    return true
  },

  resetRelationTypeColor: async (type) => {
    const { project } = get()
    if (!project || type.startsWith('rel_')) return false

    const overrides = { ...(project.settings.relationTypeColorOverrides ?? {}) }
    if (!(type in overrides)) return true
    delete overrides[type]

    const updatedProject: Project = {
      ...project,
      settings: {
        ...project.settings,
        relationTypeColorOverrides: Object.keys(overrides).length ? overrides : undefined,
      },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncRelationTypeColorOverrides(updatedProject.settings.relationTypeColorOverrides)
    set({ project: updatedProject })
    return true
  },

  removeCustomRelationType: async (type) => {
    const { project, edges } = get()
    if (!project || !type.startsWith('rel_')) return false
    if (edges.some((e) => e.relationType === type)) return false

    const customs = (project.settings.customRelationTypes ?? []).filter((d) => d.type !== type)
    const updatedProject: Project = {
      ...project,
      settings: { ...project.settings, customRelationTypes: customs },
      updatedAt: Date.now(),
    }
    await updateProject(updatedProject)
    syncCustomRelationTypes(customs)
    set({ project: updatedProject })
    return true
  },
}))

const debouncedPersist = debounce(() => {
  useEditorStore.getState().persist()
}, 1000)

const debouncedCollabRemotePersist = debounce(() => {
  const { collabEnabled, collabStatus, canvas } = useEditorStore.getState()
  if (!canvas || !collabEnabled || collabStatus !== 'connected') return
  useEditorStore.getState().persist()
}, 1500)

const debouncedPersistViewport = debounce(async () => {
  const { canvas } = useEditorStore.getState()
  if (canvas) await updateCanvas(canvas)
}, 500)

export function undoGraph(): boolean {
  const snap = history.past.pop()
  if (!snap) return false
  const { nodes, edges } = useEditorStore.getState()
  history.future.push(snapshot(nodes, edges))
  useEditorStore.setState({
    nodes: snap.nodes,
    edges: snap.edges,
    validationIssues: validateGraph(snap.nodes, snap.edges),
    saveStatus: 'unsaved',
  })
  useEditorStore.getState().persist()
  return true
}

export function redoGraph(): boolean {
  const snap = history.future.pop()
  if (!snap) return false
  const { nodes, edges } = useEditorStore.getState()
  history.past.push(snapshot(nodes, edges))
  useEditorStore.setState({
    nodes: snap.nodes,
    edges: snap.edges,
    validationIssues: validateGraph(snap.nodes, snap.edges),
    saveStatus: 'unsaved',
  })
  useEditorStore.getState().persist()
  return true
}
