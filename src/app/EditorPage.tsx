import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { getProject, listCanvases, ensureCollabStubAccess } from '@/db/repositories'
import { useEditorStore } from '@/store/editorStore'
import { undoGraph, redoGraph } from '@/store/editorStore'
import { CanvasEditor } from '@/components/canvas/CanvasEditor'
import { NodePalette } from '@/components/canvas/NodePalette'
import { RelationTypePalette } from '@/components/canvas/RelationTypePalette'
import { PropertyPanel } from '@/components/panels/PropertyPanel'
import { AiPanel } from '@/components/panels/AiPanel'
import { ValidationPanel } from '@/components/panels/ValidationPanel'
import { SearchBar } from '@/components/panels/SearchBar'
import { TableView } from '@/components/table/TableView'
import { Button, Input } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import type { NodeType } from '@/domain/types'
import { cn } from '@/lib/utils'
import { ExportCanvasPngHeaderButton } from '@/components/canvas/ExportCanvasPngButton'
import { CollabBar } from '@/components/collab/CollabBar'
import { useCollabLifecycle, useCollabSync } from '@/collab/useCollab'
import { buildCollabRoomId, defaultDisplayName, loadCollabSettings, saveCollabSettings } from '@/collab/types'
import { resolveCollabModeFromUrl } from '@/collab/collabMode'
import { isCollabJoinUrl } from '@/collab/publicUrls'

export function EditorPage() {
  const { projectId, canvasId } = useParams()
  const navigate = useNavigate()
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const [rightTab, setRightTab] = useState<'property' | 'ai'>('property')
  const [showNewCanvas, setShowNewCanvas] = useState(false)
  const [newCanvasName, setNewCanvasName] = useState('')

  const {
    project,
    canvases,
    canvas,
    isLoading,
    editorView,
    saveStatus,
    validationIssues,
    impactAnalysis,
    selectedNodeIds,
    setProject,
    loadCanvas,
    setEditorView,
    addNode,
    addCanvasTab,
    removeCanvas,
    runValidation,
    setImpactAnalysis,
    duplicateNodes,
    deleteNodes,
    copySelection,
    pasteSelection,
    nodes,
    selectNodes,
  } = useEditorStore()

  useCollabSync()
  useCollabLifecycle()

  useEffect(() => {
    if (!projectId || !canvasId || isLoading) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('collab') !== '1') return
    const timer = window.setTimeout(() => {
      const { collabEnabled, startCollab } = useEditorStore.getState()
      if (collabEnabled) return
      const settings = loadCollabSettings()
      if (!settings.displayName.trim()) {
        saveCollabSettings({ ...settings, displayName: defaultDisplayName() })
      }
      const mode = resolveCollabModeFromUrl() ?? settings.mode ?? 'p2p'
      startCollab(buildCollabRoomId(projectId, canvasId), { mode })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [projectId, canvasId, isLoading])

  useEffect(() => {
    if (!projectId) return
    ;(async () => {
      let p = await getProject(projectId)
      const collabJoin = isCollabJoinUrl()

      if (!p && collabJoin && canvasId) {
        const stub = await ensureCollabStubAccess(projectId, canvasId)
        setProject(stub.project, [stub.canvas])
        await loadCanvas(canvasId)
        return
      }

      if (!p) {
        navigate('/')
        return
      }

      let cs = await listCanvases(projectId)
      if (collabJoin && canvasId && !cs.some((c) => c.id === canvasId)) {
        const stub = await ensureCollabStubAccess(projectId, canvasId)
        cs = [...cs, stub.canvas]
      }

      setProject(p, cs)
      const targetCanvas = canvasId ?? cs[cs.length - 1]?.id
      if (targetCanvas) {
        await loadCanvas(targetCanvas)
        if (!canvasId) navigate(`/project/${projectId}/canvas/${targetCanvas}`, { replace: true })
      }
    })()
  }, [projectId, canvasId, setProject, loadCanvas, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length) {
          e.preventDefault()
          const count = selectedNodeIds.length
          if (confirm(`删除 ${count} 个节点？`)) deleteNodes(selectedNodeIds)
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undoGraph() }
        if (e.key === 'y') { e.preventDefault(); redoGraph() }
        if (e.key === 'd') {
          e.preventDefault()
          if (selectedNodeIds.length) duplicateNodes(selectedNodeIds)
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault()
          if (editorView === 'canvas' && nodes.length) {
            selectNodes(nodes.map((n) => n.id))
          }
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault()
          if (editorView === 'canvas' && selectedNodeIds.length) copySelection()
        }
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault()
          if (editorView === 'canvas') pasteSelection()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNodeIds, deleteNodes, duplicateNodes, copySelection, pasteSelection, editorView, nodes, selectNodes])

  const handleAddNode = (type: NodeType) => {
    const node = addNode(type, { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 })
    if (node) setRightTab('property')
  }

  const switchCanvas = (id: string) => {
    navigate(`/project/${projectId}/canvas/${id}`)
  }

  const handleNewCanvas = async () => {
    if (!newCanvasName.trim()) return
    const c = await addCanvasTab(newCanvasName.trim())
    setShowNewCanvas(false)
    setNewCanvasName('')
    if (c) switchCanvas(c.id)
  }

  const handleDeleteCanvas = async (targetId: string, name: string) => {
    if (canvases.length <= 1) return
    if (
      !confirm(
        `确定删除画布「${name}」？\n其中的所有节点与连线将被删除，此操作不可恢复。`,
      )
    ) {
      return
    }
    const wasActive = canvas?.id === targetId
    const fallback = canvases.find((c) => c.id !== targetId)
    await removeCanvas(targetId)
    if (wasActive && fallback && projectId) {
      navigate(`/project/${projectId}/canvas/${fallback.id}`)
    }
  }

  const issueCount = validationIssues.filter((i) => i.level === 'error' || i.level === 'warn').length

  if (!project || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F7F8FA] text-gray-400 text-sm">
        加载中…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#F7F8FA]">
      <header className="h-12 border-b border-gray-200 bg-white flex items-center px-3 gap-3 shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm shrink-0">← 项目</Link>
        <span className="font-medium text-gray-900 shrink-0">{project.name}</span>
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {canvases.map((c) => (
            <div
              key={c.id}
              className={cn(
                'group flex items-center rounded-md shrink-0',
                canvas?.id === c.id ? 'bg-gray-100' : 'hover:bg-gray-50',
              )}
            >
              <button
                onClick={() => switchCanvas(c.id)}
                className={cn(
                  'pl-3 py-1 text-sm',
                  canvases.length > 1 ? 'pr-1' : 'pr-3',
                  canvas?.id === c.id ? 'text-gray-900 font-medium' : 'text-gray-500',
                )}
              >
                {c.name}
              </button>
              {canvases.length > 1 && (
                <button
                  type="button"
                  title="删除画布"
                  aria-label={`删除画布 ${c.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDeleteCanvas(c.id, c.name)
                  }}
                  className={cn(
                    'mr-1.5 w-5 h-5 rounded flex items-center justify-center text-xs',
                    'text-gray-400 hover:text-red-600 hover:bg-red-50',
                    'opacity-0 group-hover:opacity-100',
                    canvas?.id === c.id && 'opacity-100',
                  )}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setShowNewCanvas(true)}
            className="px-2 py-1 text-gray-400 hover:text-gray-600 text-sm shrink-0"
          >
            + 画布
          </button>
        </div>
        <SearchBar />
        {projectId && canvasId && <CollabBar projectId={projectId} canvasId={canvasId} />}
        {selectedNodeIds.length > 1 && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm(`确定删除 ${selectedNodeIds.length} 个节点？`)) {
                deleteNodes(selectedNodeIds)
              }
            }}
          >
            删除 ({selectedNodeIds.length})
          </Button>
        )}
        <Button
          size="sm"
          variant={impactAnalysis ? 'primary' : 'secondary'}
          onClick={() => setImpactAnalysis(!impactAnalysis)}
        >
          影响分析
        </Button>
        <Button size="sm" onClick={() => runValidation()}>校验</Button>
        {editorView === 'canvas' && <ExportCanvasPngHeaderButton />}
        <Link to="/settings">
          <Button size="sm" variant="ghost">设置</Button>
        </Link>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex flex-col min-h-0 shrink-0 h-full">
          <NodePalette
            collapsed={paletteCollapsed}
            onToggle={() => setPaletteCollapsed(!paletteCollapsed)}
            onAddNode={handleAddNode}
          />
          <RelationTypePalette collapsed={paletteCollapsed} />
        </div>

        <div className="flex-1 min-w-0 relative">
          {editorView === 'canvas' ? (
            <ReactFlowProvider>
              <CanvasEditor />
            </ReactFlowProvider>
          ) : (
            <TableView />
          )}
          <ValidationPanel />
        </div>

        <aside className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="flex border-b border-gray-100">
            <button
              className={cn('flex-1 py-2.5 text-sm', rightTab === 'property' ? 'text-gray-900 font-medium border-b-2 border-blue-600' : 'text-gray-500')}
              onClick={() => setRightTab('property')}
            >
              属性
            </button>
            <button
              className={cn('flex-1 py-2.5 text-sm', rightTab === 'ai' ? 'text-gray-900 font-medium border-b-2 border-blue-600' : 'text-gray-500')}
              onClick={() => setRightTab('ai')}
            >
              AI 助手
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {rightTab === 'property' ? <PropertyPanel /> : <AiPanel onOpenSettings={() => navigate('/settings')} />}
          </div>
        </aside>
      </div>

      <footer className="h-9 border-t border-gray-200 bg-white flex items-center px-4 gap-4 text-xs text-gray-500 shrink-0">
        <div className="flex gap-1">
          <button
            className={cn('px-2 py-0.5 rounded', editorView === 'canvas' && 'bg-gray-100 text-gray-800')}
            onClick={() => setEditorView('canvas')}
          >
            画布
          </button>
          <button
            className={cn('px-2 py-0.5 rounded', editorView === 'table' && 'bg-gray-100 text-gray-800')}
            onClick={() => setEditorView('table')}
          >
            表格
          </button>
        </div>
        <span>
          {saveStatus === 'saved' && '已保存'}
          {saveStatus === 'saving' && '保存中…'}
          {saveStatus === 'unsaved' && '未保存'}
          {saveStatus === 'error' && '保存失败'}
        </span>
        {issueCount > 0 && (
          <button className="text-amber-600 hover:underline" onClick={() => runValidation()}>
            {issueCount} 个问题
          </button>
        )}
        <span className="ml-auto text-gray-400">Ctrl+C/V 复制粘贴 · 右键菜单 · Ctrl+A 全选 · Delete 删除</span>
      </footer>

      <Modal
        open={showNewCanvas}
        onOpenChange={setShowNewCanvas}
        title="新建画布"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewCanvas(false)}>取消</Button>
            <Button variant="primary" onClick={handleNewCanvas} disabled={!newCanvasName.trim()}>创建</Button>
          </>
        }
      >
        <Input
          placeholder="画布名称"
          value={newCanvasName}
          onChange={(e) => setNewCanvasName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNewCanvas()}
          autoFocus
        />
      </Modal>
    </div>
  )
}
