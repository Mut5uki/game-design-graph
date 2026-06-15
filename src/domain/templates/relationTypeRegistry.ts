import type { CustomRelationTypeDefinition, RelationTypeMeta } from '../types'
import { slugify } from '@/lib/utils'
import { CUSTOM_COLOR_PRESETS } from './nodeTypeRegistry'

export interface RelationPinMeta {
  type: string
  label: string
  color: string
}

export const BUILTIN_RELATION_PIN_META: RelationPinMeta[] = [
  { type: 'requires', label: '依赖', color: '#3B82F6' },
  { type: 'triggers', label: '触发', color: '#8B5CF6' },
  { type: 'unlocks', label: '解锁', color: '#10B981' },
  { type: 'modifies', label: '修改', color: '#F59E0B' },
  { type: 'references', label: '引用', color: '#6B7280' },
  { type: 'blocks', label: '互斥', color: '#EF4444' },
]

const BUILTIN_RELATION_LABELS = new Map(
  BUILTIN_RELATION_PIN_META.map((p) => [p.type, p.label]),
)

let customRelationMap: Record<string, RelationPinMeta> = {}
let colorOverrides: Record<string, string> = {}

export function syncCustomRelationTypes(defs: CustomRelationTypeDefinition[] | undefined): void {
  customRelationMap = {}
  for (const def of defs ?? []) {
    if (!def.type || !def.label) continue
    customRelationMap[def.type] = {
      type: def.type,
      label: def.label,
      color: def.color,
    }
  }
}

export function syncRelationTypeColorOverrides(overrides: Record<string, string> | undefined): void {
  colorOverrides = overrides ?? {}
}

function applyColorOverride(meta: RelationPinMeta): RelationPinMeta {
  const override = colorOverrides[meta.type]
  return override ? { ...meta, color: override } : meta
}

export function getCustomRelationMeta(type: string): RelationPinMeta | undefined {
  return customRelationMap[type]
}

export function getCustomRelationTypesList(): RelationPinMeta[] {
  return Object.values(customRelationMap)
}

export function isCustomRelationType(type: string): boolean {
  return type.startsWith('rel_')
}

export function getRelationOptions(): RelationPinMeta[] {
  const builtIn = BUILTIN_RELATION_PIN_META.map(applyColorOverride)
  const customs = getCustomRelationTypesList()
  return [...builtIn, ...customs]
}

export function getRelationTypeMetas(): RelationTypeMeta[] {
  return getRelationOptions().map(({ type, label, color }) => ({ type, label, color }))
}

export function getRelationLabel(type: string): string {
  const custom = customRelationMap[type]
  if (custom) return custom.label
  return BUILTIN_RELATION_LABELS.get(type) ?? type.replace(/^rel_/, '').replace(/_/g, ' ')
}

export function getRelationPinColor(type: string): string {
  const custom = customRelationMap[type]
  if (custom) return custom.color
  const builtIn = BUILTIN_RELATION_PIN_META.find((p) => p.type === type)
  if (builtIn) return colorOverrides[type] ?? builtIn.color
  return '#94A3B8'
}

export function getBuiltinRelationColor(type: string): string | undefined {
  return BUILTIN_RELATION_PIN_META.find((p) => p.type === type)?.color
}

export function createCustomRelationTypeId(
  label: string,
  existing: CustomRelationTypeDefinition[],
): string {
  const reserved = new Set(BUILTIN_RELATION_PIN_META.map((p) => p.type))
  const base = `rel_${slugify(label) || 'relation'}`
  const taken = new Set([...reserved, ...existing.map((d) => d.type)])
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

export function pickCustomRelationColor(index: number): string {
  return CUSTOM_COLOR_PRESETS[(index + 3) % CUSTOM_COLOR_PRESETS.length]
}
