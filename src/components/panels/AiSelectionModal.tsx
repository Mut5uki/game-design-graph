import { useState } from 'react'
import { chatCompletion } from '@/ai/deepseekClient'
import { buildEditGraphPrompt, buildSystemPrompt } from '@/ai/prompts/system'
import { validateAiGraph, type AiGraphOutput } from '@/ai/schemas/graphSchema'
import { decryptApiKey } from '@/lib/crypto'
import type { DesignNode } from '@/domain/types'
import { Modal } from '@/components/ui/Modal'
import { Button, Textarea } from '@/components/ui/primitives'
import { AiPreviewModal } from './AiPreviewModal'

interface AiSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: {
    settings: {
      deepseekApiKeyEncrypted?: string
      deepseekModel: 'deepseek-chat' | 'deepseek-reasoner'
      customNodeTypes?: import('@/domain/types').CustomNodeTypeDefinition[]
      customRelationTypes?: import('@/domain/types').CustomRelationTypeDefinition[]
    }
  }
  selectedNodes: DesignNode[]
  allNodes: DesignNode[]
  relatedEdges: Array<{
    id: string
    from: string
    to: string
    fromName: string
    toName: string
    relationType: string
    label?: string
    condition?: string
  }>
  allNodeIds: string[]
  allEdgeIds: string[]
  onApply: (patch: AiGraphOutput) => void
}

export function AiSelectionModal({
  open,
  onOpenChange,
  project,
  selectedNodes,
  allNodes,
  relatedEdges,
  allNodeIds,
  allEdgeIds,
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
      const customNodeTypes = project.settings.customNodeTypes
      const customRelationTypes = project.settings.customRelationTypes
      const canvasNodes = allNodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        fields: n.fields,
      }))
      const content = await chatCompletion({
        apiKey,
        model: project.settings.deepseekModel,
        systemPrompt: buildSystemPrompt(customNodeTypes, customRelationTypes),
        messages: [
          {
            role: 'user',
            content: buildEditGraphPrompt(
              prompt,
              selectedNodes.map((n) => ({
                id: n.id,
                type: n.type,
                name: n.name,
                fields: n.fields,
              })),
              canvasNodes,
              relatedEdges,
              customNodeTypes,
              customRelationTypes,
            ),
          },
        ],
        jsonMode: true,
      })
      setPreview(
        validateAiGraph(content, {
          existingNodes: allNodes.map((n) => ({ id: n.id, name: n.name })),
          customNodeTypes,
          customRelationTypes,
        }),
      )
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
          已选 {selectedNodes.length} 个节点。请用中文名称描述要改什么（如「火球术」「濒死冒险者」）。
        </p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：把火球术描述写详细；让濒死冒险者解锁火符文…"
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
          existingNodeIds={allNodeIds}
          existingEdgeIds={allEdgeIds}
          nodeNameById={new Map(allNodes.map((n) => [n.id, n.name]))}
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
