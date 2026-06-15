import { chatCompletion } from '@/ai/deepseekClient'
import { buildSpawnNodePrompt, type SpawnNodeContext } from '@/ai/prompts/spawnNode'
import { buildSystemPrompt } from '@/ai/prompts/system'
import { validateAiSpawnNode } from '@/ai/schemas/graphSchema'
import type { CustomNodeTypeDefinition, DeepseekModel, NodeType } from '@/domain/types'
import { createDefaultNodeFields } from '@/lib/utils'

export interface GenerateSpawnNodeOptions {
  apiKey: string
  model: DeepseekModel
  context: SpawnNodeContext
  customNodeTypes?: CustomNodeTypeDefinition[]
}

export interface GenerateSpawnNodeResult {
  name: string
  fields: Record<string, unknown>
  explanation?: string
}

export async function generateSpawnNodeDetails(
  options: GenerateSpawnNodeOptions,
): Promise<GenerateSpawnNodeResult> {
  const { apiKey, model, context, customNodeTypes } = options
  const content = await chatCompletion({
    apiKey,
    model,
    systemPrompt: buildSystemPrompt(customNodeTypes ?? context.customNodeTypes),
    messages: [{ role: 'user', content: buildSpawnNodePrompt(context) }],
    jsonMode: true,
  })

  const parsed = validateAiSpawnNode(content)
  const mergedFields = {
    ...createDefaultNodeFields(context.type as NodeType),
    ...parsed.node.fields,
  }

  return {
    name: context.name.trim() || parsed.node.name,
    fields: mergedFields,
    explanation: parsed.explanation,
  }
}
