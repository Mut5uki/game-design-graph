import type { CustomNodeTypeDefinition, NodeTypeMeta } from '../types'
import { slugify } from '@/lib/utils'

const CUSTOM_COLOR_PRESETS = [
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
  '#A855F7',
  '#EF4444',
  '#0891B2',
]

let customMetaMap: Record<string, NodeTypeMeta> = {}

export function syncCustomNodeTypes(defs: CustomNodeTypeDefinition[] | undefined): void {
  customMetaMap = {}
  for (const def of defs ?? []) {
    if (!def.type || !def.label) continue
    customMetaMap[def.type] = {
      type: def.type,
      label: def.label,
      color: def.color,
      defaultFields: def.defaultFields ?? { description: '' },
    }
  }
}

export function getCustomNodeMeta(type: string): NodeTypeMeta | undefined {
  return customMetaMap[type]
}

export function getCustomNodeTypesList(): NodeTypeMeta[] {
  return Object.values(customMetaMap)
}

export function isCustomNodeType(type: string): boolean {
  return type.startsWith('custom_')
}

export function createCustomTypeId(
  label: string,
  existing: CustomNodeTypeDefinition[],
  reserved: Set<string>,
): string {
  const base = `custom_${slugify(label) || 'type'}`
  const taken = new Set([...reserved, ...existing.map((d) => d.type)])
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

export function pickCustomTypeColor(index: number): string {
  return CUSTOM_COLOR_PRESETS[index % CUSTOM_COLOR_PRESETS.length]
}

export { CUSTOM_COLOR_PRESETS }
