import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { getProject, listCanvases } from '@/db/repositories'
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
    runValidation,
    setImpactAnalysis,
    duplicateNodes,
    deleteNodes,
    copySelection,
    pasteSelection,
    nodes,
    selectNodes,
  } = useEditorStore()

  useEffect(() => {
    if (!projectId) return
    ;(async () => {
      const p = await getProject(projectId)
      if (!p) {
        navigate('/')
        return
      }
      const cs = await listCanvases(projectId)
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
            <button
              key={c.id}
              onClick={() => switchCanvas(c.id)}
              className={cn(
                'px-3 py-1 rounded-md text-sm shrink-0',
                canvas?.id === c.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={() => setShowNewCanvas(true)}
            className="px-2 py-1 text-gray-400 hover:text-gray-600 text-sm shrink-0"
          >
            + 画布
          </button>
        </div>
        <SearchBar />
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
