import type { CustomNodeTypeDefinition, NodeTypeMeta } from '../types'
import { slugify } from '@/lib/utils'

const CUSTOM_COLOR_PRESETS = [
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#F43F5E', // rose
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0891B2', // sky
  '#0EA5E9', // light blue
  '#64748B', // slate
  '#6B7280', // gray
  '#78716C', // stone
  '#92400E', // brown
  '#BE123C', // crimson
  '#7C3AED', // deep purple
]

let customMetaMap: Record<string, NodeTypeMeta> = {}
let colorOverrides: Record<string, string> = {}

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

export function syncNodeTypeColorOverrides(overrides: Record<string, string> | undefined): void {
  colorOverrides = overrides ?? {}
}

export function getNodeTypeColorOverride(type: string): string | undefined {
  return colorOverrides[type]
}

function applyColorOverride(meta: NodeTypeMeta): NodeTypeMeta {
  const override = colorOverrides[meta.type]
  return override ? { ...meta, color: override } : meta
}

export function applyColorOverrideToMeta(meta: NodeTypeMeta): NodeTypeMeta {
  return applyColorOverride(meta)
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
