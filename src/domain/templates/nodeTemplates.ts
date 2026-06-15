import type { NodeTypeMeta, RelationTypeMeta } from '../types'

export const NODE_TYPE_META: Record<string, NodeTypeMeta> = {
  ability: {
    type: 'ability',
    label: '能力',
    color: '#3B82F6',
    defaultFields: {
      description: '',
      level: 1,
      cooldown: '',
      tags: [] as string[],
    },
  },
  event: {
    type: 'event',
    label: '事件',
    color: '#8B5CF6',
    defaultFields: {
      description: '',
      trigger: '',
      phase: '',
    },
  },
  quest: {
    type: 'quest',
    label: '任务',
    color: '#F59E0B',
    defaultFields: {
      description: '',
      status_default: 'locked',
    },
  },
  buff: {
    type: 'buff',
    label: '效果',
    color: '#10B981',
    defaultFields: {
      description: '',
      duration: '',
      stack_rule: 'replace',
    },
  },
  entity: {
    type: 'entity',
    label: '实体',
    color: '#6B7280',
    defaultFields: {
      description: '',
      category: '',
    },
  },
  group: {
    type: 'group',
    label: '区块备注',
    color: '#64748B',
    defaultFields: {
      description: '',
      width: 420,
      height: 300,
      color: 'blue',
    },
  },
}

export const NODE_TYPES = Object.values(NODE_TYPE_META)

export const RELATION_TYPE_META: Record<string, RelationTypeMeta> = {
  requires: { type: 'requires', label: '依赖' },
  triggers: { type: 'triggers', label: '触发' },
  unlocks: { type: 'unlocks', label: '解锁' },
  blocks: { type: 'blocks', label: '互斥' },
  modifies: { type: 'modifies', label: '修改' },
  references: { type: 'references', label: '引用' },
}

export const RELATION_TYPES = Object.values(RELATION_TYPE_META)

export function getNodeMeta(type: string): NodeTypeMeta {
  return NODE_TYPE_META[type] ?? NODE_TYPE_META.entity
}

export function getRelationLabel(type: string): string {
  return RELATION_TYPE_META[type]?.label ?? type
}
