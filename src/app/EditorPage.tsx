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
import { MobileSheet } from '@/components/ui/MobileSheet'
import type { NodeType } from '@/domain/types'
import { cn } from '@/lib/utils'
import { ExportCanvasPngHeaderButton } from '@/components/canvas/ExportCanvasPngButton'
import { CollabBar } from '@/components/collab/CollabBar'
import { useCollabLifecycle, useCollabSync } from '@/collab/useCollab'
import { buildCollabRoomId, defaultDisplayName, loadCollabSettings, saveCollabSettings } from '@/collab/types'
import { resolveCollabModeFromUrl } from '@/collab/collabMode'
import { isCollabJoinUrl } from '@/collab/publicUrls'
import { useIsMobile } from '@/hooks/useMediaQuery'

type MobilePanel = 'none' | 'tools' | 'inspect' | 'more'

export function EditorPage() {
  const { projectId, canvasId } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const [rightTab, setRightTab] = useState<'property' | 'ai'>('property')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('none')
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
    if (!isMobile) setMobilePanel('none')
  }, [isMobile])

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
    if (node) {
      setRightTab('property')
      if (isMobile) {
        setMobilePanel('inspect')
      }
    }
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

  const openMobilePanel = (panel: MobilePanel) => {
    setMobilePanel((prev) => (prev === panel ? 'none' : panel))
  }

  const toolbarActions = (
    <>
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
    </>
  )

  const inspectPanelBody = (
    <>
      <div className="flex border-b border-gray-100 shrink-0">
        <button
          type="button"
          className={cn(
            'flex-1 py-2.5 text-sm',
            rightTab === 'property' ? 'text-gray-900 font-medium border-b-2 border-blue-600' : 'text-gray-500',
          )}
          onClick={() => setRightTab('property')}
        >
          属性
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 py-2.5 text-sm',
            rightTab === 'ai' ? 'text-gray-900 font-medium border-b-2 border-blue-600' : 'text-gray-500',
          )}
          onClick={() => setRightTab('ai')}
        >
          AI 助手
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {rightTab === 'property' ? (
          <PropertyPanel />
        ) : (
          <AiPanel onOpenSettings={() => navigate('/settings')} />
        )}
      </div>
    </>
  )

  if (!project || isLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#F7F8FA] text-gray-400 text-sm">
        加载中…
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[#F7F8FA]">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2 min-w-0 md:h-12 md:py-0 md:gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm shrink-0">← 项目</Link>
          <span className="font-medium text-gray-900 truncate min-w-0 flex-1 md:flex-none">{project.name}</span>
          <div className="hidden md:flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
            {canvases.map((c) => (
              <CanvasTab
                key={c.id}
                name={c.name}
                active={canvas?.id === c.id}
                canDelete={canvases.length > 1}
                onSelect={() => switchCanvas(c.id)}
                onDelete={() => void handleDeleteCanvas(c.id, c.name)}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowNewCanvas(true)}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 text-sm shrink-0"
            >
              + 画布
            </button>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <SearchBar />
            {projectId && canvasId && <CollabBar projectId={projectId} canvasId={canvasId} />}
            {toolbarActions}
          </div>
          <Link to="/settings" className="md:hidden text-xs text-gray-500 shrink-0 px-1">设置</Link>
        </div>

        <div className="flex md:hidden items-center gap-1 overflow-x-auto px-2 pb-2 border-t border-gray-50 pt-1.5">
          {canvases.map((c) => (
            <CanvasTab
              key={c.id}
              name={c.name}
              active={canvas?.id === c.id}
              canDelete={canvases.length > 1}
              onSelect={() => switchCanvas(c.id)}
              onDelete={() => void handleDeleteCanvas(c.id, c.name)}
              compact
            />
          ))}
          <button
            type="button"
            onClick={() => setShowNewCanvas(true)}
            className="px-2 py-1 text-gray-400 text-sm shrink-0"
          >
            +
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative pb-12 md:pb-0">
        <div className="hidden md:flex flex-col min-h-0 shrink-0 h-full">
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

        <aside className="hidden md:flex w-72 border-l border-gray-200 bg-white flex-col shrink-0">
          {inspectPanelBody}
        </aside>
      </div>

      <footer className="hidden md:flex h-9 border-t border-gray-200 bg-white items-center px-4 gap-4 text-xs text-gray-500 shrink-0">
        <div className="flex gap-1">
          <button
            type="button"
            className={cn('px-2 py-0.5 rounded', editorView === 'canvas' && 'bg-gray-100 text-gray-800')}
            onClick={() => setEditorView('canvas')}
          >
            画布
          </button>
          <button
            type="button"
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
          <button type="button" className="text-amber-600 hover:underline" onClick={() => runValidation()}>
            {issueCount} 个问题
          </button>
        )}
        <span className="ml-auto text-gray-400">Ctrl+C/V 复制粘贴 · 右键菜单 · Ctrl+A 全选 · Delete 删除</span>
      </footer>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(0px,env(safe-area-inset-bottom))]"
        aria-label="编辑器导航"
      >
        <div className="grid grid-cols-4 h-12 text-[11px]">
          <MobileNavButton
            active={mobilePanel === 'tools'}
            label="节点"
            onClick={() => openMobilePanel('tools')}
          />
          <MobileNavButton
            active={editorView === 'table'}
            label={editorView === 'canvas' ? '画布' : '表格'}
            onClick={() => {
              setMobilePanel('none')
              setEditorView(editorView === 'canvas' ? 'table' : 'canvas')
            }}
          />
          <MobileNavButton
            active={mobilePanel === 'inspect'}
            label="属性"
            badge={selectedNodeIds.length > 0 ? selectedNodeIds.length : undefined}
            onClick={() => openMobilePanel('inspect')}
          />
          <MobileNavButton
            active={mobilePanel === 'more'}
            label="更多"
            badge={issueCount > 0 ? issueCount : undefined}
            onClick={() => openMobilePanel('more')}
          />
        </div>
      </nav>

      <MobileSheet open={mobilePanel === 'tools'} onClose={() => setMobilePanel('none')} title="节点与关系">
        <div className="flex flex-col max-h-[70vh]">
          <NodePalette
            collapsed={false}
            embedded
            onToggle={() => setMobilePanel('none')}
            onAddNode={handleAddNode}
          />
          <RelationTypePalette collapsed={false} embedded />
        </div>
      </MobileSheet>

      <MobileSheet
        open={mobilePanel === 'inspect'}
        onClose={() => setMobilePanel('none')}
        title={rightTab === 'property' ? '属性' : 'AI 助手'}
        className="max-h-[min(90vh,100dvh)]"
      >
        <div className="flex flex-col min-h-[50vh]">{inspectPanelBody}</div>
      </MobileSheet>

      <MobileSheet open={mobilePanel === 'more'} onClose={() => setMobilePanel('none')} title="更多">
        <div className="space-y-4 p-4">
          <SearchBar className="w-full" />
          {projectId && canvasId && (
            <div className="flex justify-start">
              <CollabBar projectId={projectId} canvasId={canvasId} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">{toolbarActions}</div>
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-gray-100">
            <span>
              {saveStatus === 'saved' && '已保存'}
              {saveStatus === 'saving' && '保存中…'}
              {saveStatus === 'unsaved' && '未保存'}
              {saveStatus === 'error' && '保存失败'}
            </span>
            {issueCount > 0 && <span className="text-amber-600">{issueCount} 个校验问题</span>}
          </div>
        </div>
      </MobileSheet>

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

function CanvasTab({
  name,
  active,
  canDelete,
  onSelect,
  onDelete,
  compact,
}: {
  name: string
  active: boolean
  canDelete: boolean
  onSelect: () => void
  onDelete: () => void
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'group flex items-center rounded-md shrink-0',
        active ? 'bg-gray-100' : 'hover:bg-gray-50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'text-sm',
          compact ? 'px-2.5 py-1' : 'pl-3 py-1',
          canDelete && !compact ? 'pr-1' : compact ? 'pr-2.5' : 'pr-3',
          active ? 'text-gray-900 font-medium' : 'text-gray-500',
        )}
      >
        {name}
      </button>
      {canDelete && (
        <button
          type="button"
          title="删除画布"
          aria-label={`删除画布 ${name}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={cn(
            'rounded flex items-center justify-center text-xs text-gray-400 hover:text-red-600 hover:bg-red-50',
            compact ? 'w-4 h-4 mr-1' : 'w-5 h-5 mr-1.5 opacity-0 group-hover:opacity-100',
            active && 'opacity-100',
          )}
        >
          ×
        </button>
      )}
    </div>
  )
}

function MobileNavButton({
  label,
  active,
  badge,
  onClick,
}: {
  label: string
  active?: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 transition-colors',
        active ? 'text-blue-600 bg-blue-50/80' : 'text-gray-600',
      )}
    >
      {badge != null && badge > 0 && (
        <span className="absolute top-1 right-[22%] min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <span className="font-medium">{label}</span>
    </button>
  )
}
