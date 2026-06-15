import { z } from 'zod'

export const aiNodeSchema = z.object({
  id: z.string(),
  type: z.string().min(1),
  name: z.string(),
  fields: z
    .union([z.record(z.unknown()), z.null(), z.undefined()])
    .transform((v) => (v && typeof v === 'object' ? v : {})),
  position: z
    .object({
      x: z.coerce.number(),
      y: z.coerce.number(),
    })
    .optional(),
})

export const aiEdgeSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  relationType: z.enum(['requires', 'triggers', 'unlocks', 'blocks', 'modifies', 'references']),
  condition: z.string().optional(),
  label: z.string().optional(),
})

export const aiGraphSchema = z.object({
  nodes: z.array(aiNodeSchema).default([]),
  edges: z.array(aiEdgeSchema).default([]),
  explanation: z.string().optional(),
})

export type AiGraphOutput = z.infer<typeof aiGraphSchema>

const RELATION_ALIASES: Record<string, z.infer<typeof aiEdgeSchema>['relationType']> = {
  requires: 'requires',
  require: 'requires',
  dependency: 'requires',
  depend: 'requires',
  depends: 'requires',
  依赖: 'requires',
  需要: 'requires',
  前置: 'requires',
  triggers: 'triggers',
  trigger: 'triggers',
  触发: 'triggers',
  unlocks: 'unlocks',
  unlock: 'unlocks',
  解锁: 'unlocks',
  blocks: 'blocks',
  block: 'blocks',
  互斥: 'blocks',
  排斥: 'blocks',
  modifies: 'modifies',
  modify: 'modifies',
  修改: 'modifies',
  references: 'references',
  reference: 'references',
  ref: 'references',
  引用: 'references',
}

const NODE_TYPE_ALIASES: Record<string, z.infer<typeof aiNodeSchema>['type']> = {
  ability: 'ability',
  skill: 'ability',
  能力: 'ability',
  技能: 'ability',
  event: 'event',
  事件: 'event',
  quest: 'quest',
  任务: 'quest',
  buff: 'buff',
  debuff: 'buff',
  效果: 'buff',
  buffs: 'buff',
  entity: 'entity',
  实体: 'entity',
  npc: 'entity',
  item: 'entity',
  group: 'group',
  分组: 'group',
}

function removeTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1')
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text)
}

export function parseAiJson(text: string): unknown {
  if (!text?.trim()) {
    throw new Error('AI 返回内容为空')
  }

  const candidates: string[] = []
  const trimmed = text.trim()
  candidates.push(trimmed)

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim())

  const extracted = extractJsonObject(trimmed)
  if (extracted) candidates.push(extracted)

  // 去掉常见前缀说明文字后的 JSON 片段
  const afterColon = trimmed.match(/(?:输出|结果|如下|JSON)[：:]\s*(\{[\s\S]*)/i)
  if (afterColon?.[1]) {
    const obj = extractJsonObject(afterColon[1])
    if (obj) candidates.push(obj)
  }

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)

    for (const variant of [candidate, removeTrailingCommas(candidate)]) {
      try {
        return tryParseJson(variant)
      } catch {
        // continue
      }
    }
  }

  throw new Error('无法解析 AI 返回的 JSON，请重试或换用 deepseek-chat 模型')
}

function normalizeRelationType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const key = value.trim().toLowerCase()
  return RELATION_ALIASES[key] ?? RELATION_ALIASES[value.trim()]
}

function normalizeNodeType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const key = value.trim().toLowerCase()
  return NODE_TYPE_ALIASES[key] ?? NODE_TYPE_ALIASES[value.trim()]
}

export function normalizeAiGraphRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw

  const obj = raw as Record<string, unknown>
  const nodesRaw = Array.isArray(obj.nodes) ? obj.nodes : []
  const edgesRaw = Array.isArray(obj.edges) ? obj.edges : []

  const nodes = nodesRaw
    .filter((n) => n && typeof n === 'object')
    .map((n) => {
      const node = n as Record<string, unknown>
      const type = normalizeNodeType(node.type) ?? node.type
      const id = node.id ?? node.nodeId ?? node.key
      const name = node.name ?? node.title ?? node.label ?? id
      return {
        ...node,
        id: String(id ?? ''),
        type,
        name: String(name ?? ''),
        fields: node.fields ?? node.properties ?? node.attrs ?? {},
      }
    })
    .filter((n) => n.id && n.type)

  const edges = edgesRaw
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      const edge = e as Record<string, unknown>
      const relationType =
        normalizeRelationType(edge.relationType) ??
        normalizeRelationType(edge.type) ??
        normalizeRelationType(edge.relation) ??
        edge.relationType
      return {
        ...edge,
        from: String(edge.from ?? edge.source ?? edge.sourceId ?? ''),
        to: String(edge.to ?? edge.target ?? edge.targetId ?? ''),
        relationType,
        condition: edge.condition ?? edge.when,
        label: edge.label,
      }
    })
    .filter((e) => e.from && e.to && e.relationType)

  return {
    nodes,
    edges,
    explanation:
      typeof obj.explanation === 'string'
        ? obj.explanation
        : typeof obj.summary === 'string'
          ? obj.summary
          : typeof obj.message === 'string'
            ? obj.message
            : undefined,
  }
}

export function validateAiGraph(text: string): AiGraphOutput {
  const raw = parseAiJson(text)
  const normalized = normalizeAiGraphRaw(raw)
  const result = aiGraphSchema.safeParse(normalized)

  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('；')
    throw new Error(`AI 返回的数据格式不正确：${detail}`)
  }

  if (result.data.nodes.length === 0 && result.data.edges.length === 0) {
    throw new Error('AI 未生成任何节点或连线，请换一种描述重试')
  }

  return result.data
}

export const aiSpawnNodeSchema = z.object({
  node: z.object({
    name: z.string().min(1),
    fields: z
      .union([z.record(z.unknown()), z.null(), z.undefined()])
      .transform((v) => (v && typeof v === 'object' ? v : {})),
  }),
  explanation: z.string().optional(),
})

export type AiSpawnNodeOutput = z.infer<typeof aiSpawnNodeSchema>

export function validateAiSpawnNode(text: string): AiSpawnNodeOutput {
  const raw = parseAiJson(text)
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const nodeRaw =
    obj.node ??
    (Array.isArray(obj.nodes) && obj.nodes.length > 0 ? obj.nodes[0] : null)

  const normalized = {
    node: nodeRaw,
    explanation:
      typeof obj.explanation === 'string'
        ? obj.explanation
        : typeof obj.summary === 'string'
          ? obj.summary
          : undefined,
  }

  const result = aiSpawnNodeSchema.safeParse(normalized)
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('；')
    throw new Error(`AI 返回的数据格式不正确：${detail}`)
  }
  return result.data
}

export function formatAiGraphError(error: unknown, rawContent?: string): string {
  if (error instanceof z.ZodError) {
    const detail = error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('；')
    return `AI 返回的数据格式不正确：${detail}`
  }
  if (error instanceof Error) return error.message
  if (rawContent) {
    return `无法解析 AI 返回的 JSON。原始内容开头：${rawContent.slice(0, 120)}…`
  }
  return 'AI 请求失败'
}
