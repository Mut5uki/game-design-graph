import { NODE_TYPE_META } from '@/domain/templates/nodeTemplates'
import type { CustomNodeTypeDefinition, NodeTypeMeta } from '@/domain/types'

/** AI 可创建/修改的设计节点类型（不含 group 区块备注） */
const AI_BUILTIN_TYPE_ORDER = ['ability', 'event', 'quest', 'buff', 'entity', 'list'] as const

export function getAiNodeTypeMetas(
  customNodeTypes?: CustomNodeTypeDefinition[],
): NodeTypeMeta[] {
  const builtIn = AI_BUILTIN_TYPE_ORDER.map((t) => NODE_TYPE_META[t]).filter(Boolean)
  const customs: NodeTypeMeta[] = (customNodeTypes ?? [])
    .filter((d) => d.type && d.label)
    .map((d) => ({
      type: d.type,
      label: d.label,
      color: d.color,
      defaultFields: d.defaultFields ?? { description: '' },
    }))

  const listIdx = builtIn.findIndex((m) => m.type === 'list')
  if (listIdx === -1) return [...builtIn, ...customs]
  return [...builtIn.slice(0, listIdx), ...customs, ...builtIn.slice(listIdx)]
}

export function formatAiNodeTypeCatalog(
  customNodeTypes?: CustomNodeTypeDefinition[],
): string {
  return getAiNodeTypeMetas(customNodeTypes)
    .map((m) => {
      const fields = Object.keys(m.defaultFields).join(', ') || 'description'
      const tag = m.type.startsWith('custom_') ? ' [用户自定义]' : ''
      return `- type \`${m.type}\`（${m.label}）${tag}：fields 含 ${fields}`
    })
    .join('\n')
}

export function buildCustomNodeTypeAliases(
  customNodeTypes?: CustomNodeTypeDefinition[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const def of customNodeTypes ?? []) {
    if (!def.type || !def.label) continue
    map[def.type] = def.type
    map[def.type.toLowerCase()] = def.type
    map[def.label] = def.type
    map[def.label.trim()] = def.type
    map[def.label.toLowerCase()] = def.type
  }
  return map
}

export function resolveAiNodeType(
  value: unknown,
  customNodeTypes?: CustomNodeTypeDefinition[],
): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const customAliases = buildCustomNodeTypeAliases(customNodeTypes)
  const lower = trimmed.toLowerCase()

  if (customAliases[trimmed]) return customAliases[trimmed]
  if (customAliases[lower]) return customAliases[lower]

  for (const meta of getAiNodeTypeMetas(customNodeTypes)) {
    if (meta.type === trimmed || meta.type === lower) return meta.type
    if (meta.label === trimmed || meta.label.toLowerCase() === lower) return meta.type
  }

  return undefined
}
