import { useState } from 'react'
import { Link } from 'react-router-dom'
import { chatCompletion } from '@/ai/deepseekClient'
import {
  buildCompletePrompt,
  buildGeneratePrompt,
  buildQaPrompt,
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

  async function getApiKey(): Promise<string | null> {
    if (!project?.settings.deepseekApiKeyEncrypted) return null
    return decryptApiKey(project.settings.deepseekApiKeyEncrypted)
  }

  async function runGenerate(prompt: string, mode: 'generate' | 'complete' | 'qa') {
    setError(null)
    setLoading(true)
    let rawContent = ''
    try {
      const apiKey = await getApiKey()
      if (!apiKey) {
        setError('请先在设置中配置 DeepSeek API Key')
        return
      }

      const existingIds = nodes.map((n) => n.id)
      let userContent: string

      if (mode === 'generate') {
        userContent = buildGeneratePrompt(prompt, existingIds)
      } else if (mode === 'complete') {
        const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
        const summary = selected.map((n) => `[${n.type}] ${n.id}: ${n.name}`).join('\n')
        userContent = buildCompletePrompt(summary, existingIds)
      } else {
        userContent = buildQaPrompt(prompt, summarizeProject(nodes, edges))
      }

      const content = await chatCompletion({
        apiKey,
        model: project!.settings.deepseekModel,
        messages: [{ role: 'user', content: userContent }],
        jsonMode: mode !== 'qa',
      })
      rawContent = content

      if (mode === 'qa') {
        setMessages((m) => [...m, { role: 'user', content: prompt }, { role: 'assistant', content }])
        setInput('')
      } else {
        const graph = validateAiGraph(content)
        setPreview(graph)
        setMessages((m) => [
          ...m,
          { role: 'user', content: prompt },
          { role: 'assistant', content: graph.explanation ?? '已生成结构，请预览确认。' },
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
      runGenerate(input, 'complete')
    } else if (isQuestion) {
      runGenerate(input, 'qa')
    } else {
      runGenerate(input, 'generate')
    }
  }

  if (!hasKey) {
    return (
      <div className="text-sm text-gray-500 space-y-3">
        <p>配置 DeepSeek API Key 后可使用 AI 生成、补全与问答。</p>
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
            描述你想设计的系统，例如：「火球 5 级解锁烈焰风暴，完成任务 A 后触发事件 B」
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
          <p className="text-xs text-gray-400">已选 {selectedNodeIds.length} 个节点 — 输入将尝试补全关联</p>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="描述设计或提问…"
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
        <p className="text-[10px] text-gray-400">Ctrl+Enter 发送 · 改图结果需预览确认</p>
      </div>

      {preview && (
        <AiPreviewModal
          open={Boolean(preview)}
          onOpenChange={(o) => !o && setPreview(null)}
          data={preview}
          onApply={(patch) => {
            applyAiPatch(patch)
            setPreview(null)
          }}
        />
      )}
    </div>
  )
}
