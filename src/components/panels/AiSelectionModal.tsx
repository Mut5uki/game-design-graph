import { useState } from 'react'
import { chatCompletion } from '@/ai/deepseekClient'
import { buildCompletePrompt } from '@/ai/prompts/system'
import { validateAiGraph, type AiGraphOutput } from '@/ai/schemas/graphSchema'
import { decryptApiKey } from '@/lib/crypto'
import type { DesignNode } from '@/domain/types'
import { Modal } from '@/components/ui/Modal'
import { Button, Textarea } from '@/components/ui/primitives'
import { AiPreviewModal } from './AiPreviewModal'

interface AiSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: { settings: { deepseekApiKeyEncrypted?: string; deepseekModel: 'deepseek-chat' | 'deepseek-reasoner' } }
  selectedNodes: DesignNode[]
  allNodeIds: string[]
  onApply: (patch: AiGraphOutput) => void
}

export function AiSelectionModal({
  open,
  onOpenChange,
  project,
  selectedNodes,
  allNodeIds,
  onApply,
}: AiSelectionModalProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AiGraphOutput | null>(null)

  async function handleGenerate() {
    if (!prompt.trim() || loading) return
    setError(null)
    setLoading(true)
    try {
      if (!project.settings.deepseekApiKeyEncrypted) {
        setError('请先在设置中配置 DeepSeek API Key')
        return
      }
      const apiKey = await decryptApiKey(project.settings.deepseekApiKeyEncrypted)
      const summary = selectedNodes.map((n) => `[${n.type}] ${n.id}: ${n.name}`).join('\n')
      const content = await chatCompletion({
        apiKey,
        model: project.settings.deepseekModel,
        messages: [{ role: 'user', content: buildCompletePrompt(summary, allNodeIds) + `\n\n用户补充说明：${prompt}` }],
        jsonMode: true,
      })
      setPreview(validateAiGraph(content))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal
        open={open && !preview}
        onOpenChange={onOpenChange}
        title="AI 改选区"
        className="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button variant="primary" disabled={loading || !prompt.trim()} onClick={handleGenerate}>
              {loading ? '生成中…' : '生成'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-gray-500 mb-3">
          已选 {selectedNodes.length} 个节点。描述你想如何补全或修改（例如：「补充下游依赖并加两个事件节点」）。
        </p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入修改意图…"
          className="min-h-[96px]"
          autoFocus
        />
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </Modal>

      {preview && (
        <AiPreviewModal
          open={Boolean(preview)}
          onOpenChange={(o) => {
            if (!o) setPreview(null)
          }}
          data={preview}
          onApply={(patch) => {
            onApply(patch)
            setPreview(null)
            setPrompt('')
            onOpenChange(false)
          }}
        />
      )}
    </>
  )
}
