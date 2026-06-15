import { getRelationOptions, isCustomRelationType } from '@/domain/templates/relationTypeRegistry'
import type { CustomRelationTypeDefinition } from '@/domain/types'

export function formatAiRelationCatalog(
  _customRelationTypes?: CustomRelationTypeDefinition[],
): string {
  return getRelationOptions()
    .map((meta) => {
      const tag = isCustomRelationType(meta.type) ? '，用户自定义' : ''
      return `- ${meta.type}（${meta.label}${tag}）`
    })
    .join('\n')
}

export function resolveAiRelationType(
  value: unknown,
  customRelationTypes?: CustomRelationTypeDefinition[],
): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const lower = trimmed.toLowerCase()
  for (const meta of getRelationOptions()) {
    if (meta.type === lower || meta.type === trimmed) return meta.type
    if (meta.label === trimmed) return meta.type
  }

  for (const def of customRelationTypes ?? []) {
    if (def.type === trimmed || def.type === lower) return def.type
    if (def.label === trimmed) return def.type
  }

  if (trimmed.startsWith('rel_')) return trimmed
  return undefined
}
