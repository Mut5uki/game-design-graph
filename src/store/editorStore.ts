import { create } from 'zustand'
import type { AiGraphOutput } from '@/ai/schemas/graphSchema'
import type {
  Canvas,
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
} from '@/db/repositories'
import { createDefaultNodeFields, createNodeId, debounce, generateId } from '@/lib/utils'
import {
  COMMENT_DEFAULT_HEIGHT,
  COMMENT_DEFAULT_WIDTH,
  COMMENT_HEADER_HEIGHT,
  findGroupContainingNode,
  isCommentBlock,
  nodeAbsolutePosition,
  relativeToGroup,
} from '@/domain/group/commentBlock'

export interface GraphSnapshot {
  nodes: DesignNode[]
  edges: DesignEdge[]
}

export interface AiGraphPatchInput {
  nodes: AiGraphOutput['nodes']
  edges: AiGraphOutput['edges']
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

  addNode: (type: NodeType, position?: { x: number; y: number }) => DesignNode | null
  updateNode: (id: string, patch: Partial<DesignNode>) => void
  updateNodeFields: (id: string, fields: Record<string, unknown>) => void
  deleteNodes: (ids: string[]) => void
  duplicateNodes: (ids: string[]) => void

  addEdge: (from: string, to: string, relationType: RelationType) => DesignEdge | null
  updateEdge: (id: string, patch: Partial<DesignEdge>) => void
  deleteEdge: (id: string) => void

  moveNodes: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void
  resizeCommentBlock: (id: string, width: number, height: number) => void
  assignNodeToGroup: (nodeId: string, groupId: string | null) => void
  autoAssignGroupsAfterMove: (movedIds: string[]) => void
  wrapNodesInComment: (nodeIds: string[]) => DesignNode | null
  ungroupNodes: (nodeIds: string[]) => void
  setViewport: (viewport: Canvas['viewport']) => void
  autoLayout: () => void

  applyAiPatch: (patch: AiGraphPatchInput) => void
  runValidation: () => ValidationIssue[]
  computeImpactForSelection: () => void
  focusNode: (id: string) => void

  markUnsaved: () => void
  setSaveStatus: (status: SaveStatus) => void
  persist: () => Promise<void>

  addCanvasTab: (name: string) => Promise<Canvas | null>
  renameCanvas: (id: string, name: string) => Promise<void>
  removeCanvas: (id: string) => Promise<void>
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

  setProject: (project, canvases) => set({ project, canvases }),

  loadCanvas: async (canvasId) => {
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

  addNode: (type, position = { x: 100, y: 100 }) => {
    const { project, canvas, nodes } = get()
    if (!project || !canvas) return null

    const existingIds = new Set(nodes.map((n) => n.id))
    const defaultName = type === 'ability' ? '新能力' : type === 'event' ? '新事件' : type === 'quest' ? '新任务' : type === 'buff' ? '新效果' : type === 'group' ? '新区块' : '新实体'
    const id = createNodeId(type, defaultName, existingIds)
    const now = Date.now()

    const node: DesignNode = {
      id,
      projectId: project.id,
      canvasId: canvas.id,
      type,
      name: defaultName,
      fields: createDefaultNodeFields(type),
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

  addEdge: (from, to, relationType) => {
    const { project, canvas, nodes, edges } = get()
    if (!project || !canvas || from === to) return null
    const fromNode = nodes.find((n) => n.id === from)
    const toNode = nodes.find((n) => n.id === to)
    if (!fromNode || !toNode || isCommentBlock(fromNode) || isCommentBlock(toNode)) return null
    if (edges.some((e) => e.from === from && e.to === to && e.relationType === relationType))
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
      createdAt: now,
      updatedAt: now,
    }
    const nextEdges = [...edges, edge]
    set({
      edges: nextEdges,
      selectedEdgeId: edge.id,
      validationIssues: validateGraph(nodes, nextEdges),
      saveStatus: 'unsaved',
    })
    get().persist()
    return edge
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
    const groupY = minY - padding - COMMENT_HEADER_HEIGHT
    const width = Math.max(COMMENT_DEFAULT_WIDTH, maxX - minX + padding * 2)
    const height = Math.max(COMMENT_DEFAULT_HEIGHT, maxY - minY + padding * 2 + COMMENT_HEADER_HEIGHT)

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

  applyAiPatch: (patch) => {
    const { project, canvas, nodes, edges } = get()
    if (!project || !canvas) return
    pushHistory(nodes, edges)

    const existingIds = new Set(nodes.map((n) => n.id))
    const now = Date.now()
    const newNodes: DesignNode[] = patch.nodes.map((n, i) => ({
      id: n.id,
      projectId: project.id,
      canvasId: canvas.id,
      type: n.type,
      name: n.name,
      fields: n.fields,
      position: n.position ?? { x: 100 + (i % 4) * 240, y: 100 + Math.floor(i / 4) * 120 },
      createdAt: now,
      updatedAt: now,
    }))

    for (const n of newNodes) existingIds.add(n.id)

    const newEdges: DesignEdge[] = patch.edges.map((e) => ({
      id: e.id ?? generateId('edge'),
      projectId: project.id,
      canvasId: canvas.id,
      from: e.from,
      to: e.to,
      relationType: e.relationType,
      condition: e.condition,
      label: e.label,
      createdAt: now,
      updatedAt: now,
    }))

    const mergedNodes = [...nodes]
    for (const n of newNodes) {
      const idx = mergedNodes.findIndex((x) => x.id === n.id)
      if (idx >= 0) mergedNodes[idx] = n
      else mergedNodes.push(n)
    }

    const mergedEdges = [...edges, ...newEdges.filter(
      (ne) => !edges.some((e) => e.from === ne.from && e.to === ne.to && e.relationType === ne.relationType),
    )]

    const laidOut = applyAutoLayoutPositions(mergedNodes, mergedEdges)
    set({
      nodes: laidOut,
      edges: mergedEdges,
      validationIssues: validateGraph(laidOut, mergedEdges),
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
}))

const debouncedPersist = debounce(() => {
  useEditorStore.getState().persist()
}, 1000)

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
