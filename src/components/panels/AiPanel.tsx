import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { chatCompletion } from '@/ai/deepseekClient'
import {
  buildEditGraphPrompt,
  buildGeneratePrompt,
  buildQaPrompt,
  buildSystemPrompt,
  summarizeProject,
} from '@/ai/prompts/system'
import { validateAiGraph, formatAiGraphError, type AiGraphOutput } from '@/ai/schemas/graphSchema'
import { decryptApiKey } from '@/lib/crypto'
import { useEditorStore } from '@/store/editorStore'
import { Button, Textarea } from '@/components/ui/primitives'
import { AiPreviewModal } from './AiPreviewModal'

interface AiPanelProps {
  onOpenSettings: () => void
}

export function AiPanel({ onOpenSettings }: AiPanelProps) {
  const project = useEditorStore((s) => s.project)
  const nodes = useEditorStore((s) => s.nodes)
  const edges = useEditorStore((s) => s.edges)
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds)
  const applyAiPatch = useEditorStore((s) => s.applyAiPatch)

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AiGraphOutput | null>(null)

  const hasKey = Boolean(project?.settings.deepseekApiKeyEncrypted)
  const existingNodeIds = nodes.map((n) => n.id)

  const canvasNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        fields: n.fields,
      })),
    [nodes],
  )
  const canvasNodesForResolve = useMemo(
    () => nodes.map((n) => ({ id: n.id, name: n.name })),
    [nodes],
  )
  const nodeNameById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.name])),
    [nodes],
  )

  const customNodeTypes = project?.settings.customNodeTypes
  const customRelationTypes = project?.settings.customRelationTypes
  const aiOptions = useMemo(
    () => ({
      existingNodes: canvasNodesForResolve,
      customNodeTypes,
      customRelationTypes,
    }),
    [canvasNodesForResolve, customNodeTypes, customRelationTypes],
  )
  const systemPrompt = useMemo(
    () => buildSystemPrompt(customNodeTypes, customRelationTypes),
    [customNodeTypes, customRelationTypes],
  )

  async function getApiKey(): Promise<string | null> {
    if (!project?.settings.deepseekApiKeyEncrypted) return null
    return decryptApiKey(project.settings.deepseekApiKeyEncrypted)
  }

  async function runGenerate(prompt: string, mode: 'generate' | 'edit' | 'qa') {
    setError(null)
    setLoading(true)
    let rawContent = ''
    try {
      const apiKey = await getApiKey()
      if (!apiKey) {
        setError('请先在设置中配置 DeepSeek API Key')
        return
      }

      let userContent: string

      if (mode === 'generate') {
        userContent = buildGeneratePrompt(
          prompt,
          nodes.map((n) => ({ id: n.id, name: n.name, type: n.type })),
          customNodeTypes,
          customRelationTypes,
        )
      } else if (mode === 'edit') {
        const selectedSet = new Set(selectedNodeIds)
        const selected = canvasNodes.filter((n) => selectedSet.has(n.id))
        const nameById = new Map(nodes.map((n) => [n.id, n.name]))
        const relatedEdges = edges
          .filter((e) => selectedSet.has(e.from) || selectedSet.has(e.to))
          .map((e) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            fromName: nameById.get(e.from) ?? e.from,
            toName: nameById.get(e.to) ?? e.to,
            relationType: e.relationType,
            label: e.label,
            condition: e.condition,
          }))
        userContent = buildEditGraphPrompt(
          prompt,
          selected,
          canvasNodes,
          relatedEdges,
          customNodeTypes,
          customRelationTypes,
        )
      } else {
        userContent = buildQaPrompt(prompt, summarizeProject(nodes, edges))
      }

      const content = await chatCompletion({
        apiKey,
        model: project!.settings.deepseekModel,
        systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        jsonMode: mode !== 'qa',
      })
      rawContent = content

      if (mode === 'qa') {
        setMessages((m) => [...m, { role: 'user', content: prompt }, { role: 'assistant', content }])
        setInput('')
      } else {
        const graph = validateAiGraph(content, aiOptions)
        setPreview(graph)
        setMessages((m) => [
          ...m,
          { role: 'user', content: prompt },
          { role: 'assistant', content: graph.explanation ?? '已生成变更，请预览确认。' },
        ])
        setInput('')
      }
    } catch (e) {
      setError(formatAiGraphError(e, rawContent))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    if (!input.trim() || loading) return
    const isQuestion = input.includes('?') || input.includes('？') || input.startsWith('问')
    if (selectedNodeIds.length > 0 && !isQuestion) {
      runGenerate(input, 'edit')
    } else if (isQuestion) {
      runGenerate(input, 'qa')
    } else {
      runGenerate(input, 'generate')
    }
  }

  if (!hasKey) {
    return (
      <div className="text-sm text-gray-500 space-y-3">
        <p>配置 DeepSeek API Key 后可使用 AI 生成、修改与问答。</p>
        <p className="text-xs text-gray-400">数据将发送至 DeepSeek 进行处理，Key 仅保存在本地浏览器。</p>
        <Link to="/settings">
          <Button variant="primary" size="sm" onClick={onOpenSettings}>前往设置</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400">
            描述你想设计的系统；选中节点后，用中文名称说明要改什么（如「把火球术描述写详细」）
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-md px-3 py-2 ${
              m.role === 'user' ? 'bg-blue-50 text-blue-900 ml-4' : 'bg-gray-50 text-gray-700 mr-4'
            }`}
          >
            {m.content}
          </div>
        ))}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="shrink-0 space-y-2 border-t border-gray-100 pt-3">
        {selectedNodeIds.length > 0 && (
          <p className="text-xs text-gray-400">
            已选 {selectedNodeIds.length} 个节点 — 请用中文名称描述修改意图
          </p>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            selectedNodeIds.length > 0
              ? '例如：把描述改详细、改成任务类型、增加冷却 3 秒…'
              : '描述设计或提问…'
          }
          className="min-h-[72px] text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
          }}
        />
        <div className="flex gap-2">
          <Button variant="primary" size="sm" disabled={loading || !input.trim()} onClick={handleSubmit}>
            {loading ? '处理中…' : '发送'}
          </Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => input.trim() && runGenerate(input, 'generate')}
          >
            生成图
          </Button>
        </div>
        <p className="text-[10px] text-gray-400">Ctrl+Enter 发送 · 变更需预览确认后应用</p>
      </div>

      {preview && (
        <AiPreviewModal
          open={Boolean(preview)}
          onOpenChange={(o) => !o && setPreview(null)}
          data={preview}
          existingNodeIds={existingNodeIds}
          existingEdgeIds={edges.map((e) => e.id)}
          nodeNameById={nodeNameById}
          onApply={(patch) => {
            applyAiPatch(patch, { anchorNodeIds: selectedNodeIds })
            setPreview(null)
          }}
        />
      )}
    </div>
  )
}
