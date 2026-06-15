import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { getListContentNodeTypes, getRelationTypes } from '@/domain/templates/nodeTemplates'
import type { DesignEdge, DesignNode, NodeType } from '@/domain/types'
import { COMMENT_COLOR_PRESETS, getCommentSize } from '@/domain/group/commentBlock'
import {
  createListItem,
  getListContentType,
  getListItems,
} from '@/domain/list/listBlock'
import { useEditorStore } from '@/store/editorStore'
import { Button, Input, Label, Select, Textarea } from '@/components/ui/primitives'
import { createDefaultNodeFields, parseTagsInput, tagsToString } from '@/lib/utils'

function CommentBlockProperties({ node }: { node: DesignNode }) {
  const updateNode = useEditorStore((s) => s.updateNode)
  const updateNodeFields = useEditorStore((s) => s.updateNodeFields)
  const deleteNodes = useEditorStore((s) => s.deleteNodes)
  const ungroupNodes = useEditorStore((s) => s.ungroupNodes)
  const childCount = useEditorStore((s) => s.nodes.filter((n) => n.parentGroupId === node.id).length)

  const { width, height } = getCommentSize(node)
  const desc = String(node.fields.description ?? '')
  const color = String(node.fields.color ?? 'blue')

  return (
    <div className="space-y-3">
      <div>
        <Label>标题</Label>
        <Input
          value={node.name}
          onChange={(e) => updateNode(node.id, { name: e.target.value })}
        />
      </div>
      <div>
        <Label>备注</Label>
        <Textarea
          value={desc}
          onChange={(e) => updateNodeFields(node.id, { description: e.target.value })}
          className="min-h-[100px]"
          placeholder="描述此区块的设计意图…"
        />
      </div>
      <div>
        <Label>颜色</Label>
        <Select
          value={color}
          onChange={(e) => updateNodeFields(node.id, { color: e.target.value })}
        >
          {COMMENT_COLOR_PRESETS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>宽度</Label>
          <Input
            type="number"
            value={width}
            onChange={(e) => updateNodeFields(node.id, { width: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>高度</Label>
          <Input
            type="number"
            value={height}
            onChange={(e) => updateNodeFields(node.id, { height: Number(e.target.value) })}
          />
        </div>
      </div>
      <p className="text-xs text-gray-400">内含 {childCount} 个节点 · 拖入/拖出自动编组</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => ungroupNodes([node.id])}>
          解散区块
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(`删除区块「${node.name}」？内部 ${childCount} 个节点将保留。`)) {
              deleteNodes([node.id])
            }
          }}
        >
          删除区块
        </Button>
      </div>
    </div>
  )
}

function ListBlockProperties({ node }: { node: DesignNode }) {
  const updateNode = useEditorStore((s) => s.updateNode)
  const updateNodeFields = useEditorStore((s) => s.updateNodeFields)
  const updateListItems = useEditorStore((s) => s.updateListItems)
  const deleteNodes = useEditorStore((s) => s.deleteNodes)
  const customNodeTypes = useEditorStore((s) => s.project?.settings.customNodeTypes)

  const listContentTypes = useMemo(() => getListContentNodeTypes(), [customNodeTypes])

  const items = getListItems(node)
  const listType = getListContentType(node)
  const desc = String(node.fields.description ?? '')

  const setItems = (next: typeof items) => updateListItems(node.id, next)

  return (
    <div className="space-y-3">
      <div>
        <Label>列表标题</Label>
        <Input value={node.name} onChange={(e) => updateNode(node.id, { name: e.target.value })} />
      </div>
      <div>
        <Label>条目类型</Label>
        <Select
          value={listType}
          onChange={(e) => updateNodeFields(node.id, { listType: e.target.value })}
        >
          {listContentTypes.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>说明</Label>
        <Textarea
          value={desc}
          onChange={(e) => updateNodeFields(node.id, { description: e.target.value })}
          placeholder="例如：第一章可获得的全部能力"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>条目 ({items.length})</Label>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setItems([...items, createListItem(`条目 ${items.length + 1}`)])}
          >
            + 添加
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.map((item, index) => (
            <div key={item.id} className="flex gap-1 items-center">
              <Input
                value={item.name}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, name: e.target.value }
                  setItems(next)
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setItems(items.filter((x) => x.id !== item.id))}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          画布内可拖动 ⋮⋮ 排序、↔ 微调行位置；每行左右各有连线端口
        </p>
      </div>
      <Button variant="danger" size="sm" onClick={() => deleteNodes([node.id])}>
        删除列表块
      </Button>
    </div>
  )
}

function NodeProperties({ node }: { node: DesignNode }) {
  const updateNode = useEditorStore((s) => s.updateNode)
  const updateNodeFields = useEditorStore((s) => s.updateNodeFields)
  const customNodeTypes = useEditorStore((s) => s.project?.settings.customNodeTypes)
  const typeOptions = useMemo(() => getListContentNodeTypes(), [customNodeTypes])
  const desc = String(node.fields.description ?? '')

  const changeNodeType = (nextType: string) => {
    if (nextType === node.type) return
    updateNode(node.id, {
      type: nextType as NodeType,
      fields: {
        ...createDefaultNodeFields(nextType as NodeType),
        description: node.fields.description ?? '',
      },
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>ID</Label>
        <Input value={node.id} readOnly className="bg-gray-50 text-gray-500" />
      </div>
      <div>
        <Label>名称</Label>
        <Input
          value={node.name}
          onChange={(e) => updateNode(node.id, { name: e.target.value })}
        />
      </div>
      <div>
        <Label>类型</Label>
        <Select value={node.type} onChange={(e) => changeNodeType(e.target.value)}>
          {typeOptions.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>描述</Label>
        <Textarea
          value={desc}
          onChange={(e) => updateNodeFields(node.id, { description: e.target.value })}
        />
      </div>
      {node.type === 'ability' && (
        <>
          <div>
            <Label>等级</Label>
            <Input
              type="number"
              value={String(node.fields.level ?? 1)}
              onChange={(e) => updateNodeFields(node.id, { level: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>冷却</Label>
            <Input
              value={String(node.fields.cooldown ?? '')}
              onChange={(e) => updateNodeFields(node.id, { cooldown: e.target.value })}
            />
          </div>
          <div>
            <Label>标签（逗号分隔）</Label>
            <Input
              value={tagsToString(node.fields.tags)}
              onChange={(e) => updateNodeFields(node.id, { tags: parseTagsInput(e.target.value) })}
            />
          </div>
        </>
      )}
      {node.type === 'event' && (
        <>
          <div>
            <Label>触发条件</Label>
            <Input
              value={String(node.fields.trigger ?? '')}
              onChange={(e) => updateNodeFields(node.id, { trigger: e.target.value })}
            />
          </div>
          <div>
            <Label>阶段</Label>
            <Input
              value={String(node.fields.phase ?? '')}
              onChange={(e) => updateNodeFields(node.id, { phase: e.target.value })}
            />
          </div>
        </>
      )}
      {node.type === 'quest' && (
        <div>
          <Label>默认状态</Label>
          <Select
            value={String(node.fields.status_default ?? 'locked')}
            onChange={(e) => updateNodeFields(node.id, { status_default: e.target.value })}
          >
            <option value="locked">锁定</option>
            <option value="available">可接取</option>
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
          </Select>
        </div>
      )}
      {node.type === 'buff' && (
        <>
          <div>
            <Label>持续时间</Label>
            <Input
              value={String(node.fields.duration ?? '')}
              onChange={(e) => updateNodeFields(node.id, { duration: e.target.value })}
            />
          </div>
          <div>
            <Label>叠加规则</Label>
            <Input
              value={String(node.fields.stack_rule ?? '')}
              onChange={(e) => updateNodeFields(node.id, { stack_rule: e.target.value })}
            />
          </div>
        </>
      )}
      {node.type === 'entity' && (
        <div>
          <Label>分类</Label>
          <Input
            value={String(node.fields.category ?? '')}
            onChange={(e) => updateNodeFields(node.id, { category: e.target.value })}
          />
        </div>
      )}
      {desc && (
        <div>
          <Label>预览</Label>
          <div className="prose prose-sm max-w-none text-gray-600 border border-gray-100 rounded-md p-2 bg-gray-50">
            <ReactMarkdown>{desc}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function EdgeProperties({ edge, nodes }: { edge: DesignEdge; nodes: DesignNode[] }) {
  const updateEdge = useEditorStore((s) => s.updateEdge)
  const deleteEdge = useEditorStore((s) => s.deleteEdge)
  const customRelationTypes = useEditorStore((s) => s.project?.settings.customRelationTypes)
  const relationColorOverrides = useEditorStore((s) => s.project?.settings.relationTypeColorOverrides)
  const relationTypes = useMemo(
    () => getRelationTypes(),
    [customRelationTypes, relationColorOverrides],
  )
  const fromName = nodes.find((n) => n.id === edge.from)?.name ?? edge.from
  const toName = nodes.find((n) => n.id === edge.to)?.name ?? edge.to

  return (
    <div className="space-y-3">
      <div>
        <Label>从</Label>
        <Input value={fromName} readOnly className="bg-gray-50" />
      </div>
      <div>
        <Label>到</Label>
        <Input value={toName} readOnly className="bg-gray-50" />
      </div>
      <div>
        <Label>关系类型</Label>
        <Select
          value={edge.relationType}
          onChange={(e) => updateEdge(edge.id, { relationType: e.target.value as DesignEdge['relationType'] })}
        >
          {relationTypes.map((r) => (
            <option key={r.type} value={r.type}>{r.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>标签</Label>
        <Input
          value={edge.label ?? ''}
          onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
        />
      </div>
      <div>
        <Label>条件</Label>
        <Textarea
          value={edge.condition ?? ''}
          onChange={(e) => updateEdge(edge.id, { condition: e.target.value })}
          className="min-h-[60px] font-mono text-xs"
        />
      </div>
      {(edge.sourceHandle || edge.targetHandle) && (
        <p className="text-[10px] text-gray-400">
          端口：{edge.sourceHandle ?? '—'} → {edge.targetHandle ?? '—'}
        </p>
      )}
      <Button variant="danger" size="sm" onClick={() => deleteEdge(edge.id)}>删除连线</Button>
    </div>
  )
}

export function PropertyPanel() {
  const nodes = useEditorStore((s) => s.nodes)
  const edges = useEditorStore((s) => s.edges)
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds)
  const selectedEdgeId = useEditorStore((s) => s.selectedEdgeId)
  const deleteNodes = useEditorStore((s) => s.deleteNodes)

  const selectedNode = useMemo(
    () => (selectedNodeIds.length === 1 ? nodes.find((n) => n.id === selectedNodeIds[0]) : null),
    [nodes, selectedNodeIds],
  )

  const selectedEdge = useMemo(
    () => (selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null),
    [edges, selectedEdgeId],
  )

  const downstreamCount = useMemo(() => {
    if (!selectedNode) return 0
    const visited = new Set<string>()
    const queue = [selectedNode.id]
    while (queue.length) {
      const c = queue.pop()!
      for (const e of edges) {
        if (e.from === c && !visited.has(e.to)) {
          visited.add(e.to)
          queue.push(e.to)
        }
      }
    }
    return visited.size
  }, [selectedNode, edges])

  if (selectedEdge) {
    return <EdgeProperties edge={selectedEdge} nodes={nodes} />
  }

  if (selectedNode) {
    if (selectedNode.type === 'group') {
      return <CommentBlockProperties node={selectedNode} />
    }
    if (selectedNode.type === 'list') {
      return <ListBlockProperties node={selectedNode} />
    }
    return (
      <div className="space-y-4">
        <NodeProperties node={selectedNode} />
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (downstreamCount > 0) {
              if (!confirm(`删除「${selectedNode.name}」将同时移除相关连线，下游 ${downstreamCount} 个节点可能受影响。确认删除？`)) return
            }
            deleteNodes([selectedNode.id])
          }}
        >
          删除节点
        </Button>
      </div>
    )
  }

  if (selectedNodeIds.length > 1) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          已选中 <span className="font-medium text-gray-900">{selectedNodeIds.length}</span> 个节点
        </p>
        <p className="text-xs text-gray-400">
          可在画布空白处拖拽框选；按住 Shift 点击或框选可追加选中。按 Delete 或下方按钮批量删除。
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(`确定删除 ${selectedNodeIds.length} 个节点？相关连线也会一并移除。`)) {
              deleteNodes(selectedNodeIds)
            }
          }}
        >
          批量删除
        </Button>
      </div>
    )
  }

  return <p className="text-sm text-gray-400">选中节点或连线以编辑属性</p>
}
