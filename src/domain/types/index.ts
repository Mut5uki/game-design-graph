export type NodeType = 'ability' | 'event' | 'quest' | 'buff' | 'entity' | 'group'

export type RelationType =
  | 'requires'
  | 'triggers'
  | 'unlocks'
  | 'blocks'
  | 'modifies'
  | 'references'

export type DeepseekModel = 'deepseek-chat' | 'deepseek-reasoner'

export interface ProjectSettings {
  deepseekApiKeyEncrypted?: string
  deepseekModel: DeepseekModel
}

export interface Project {
  id: string
  name: string
  description?: string
  schemaVersion: number
  createdAt: number
  updatedAt: number
  settings: ProjectSettings
}

export interface Canvas {
  id: string
  projectId: string
  name: string
  viewport: { x: number; y: number; zoom: number }
  nodeIds: string[]
  edgeIds: string[]
  createdAt: number
  updatedAt: number
}

export interface DesignNode {
  id: string
  projectId: string
  canvasId: string
  type: NodeType
  name: string
  fields: Record<string, unknown>
  position: { x: number; y: number }
  parentGroupId?: string
  createdAt: number
  updatedAt: number
}

export interface DesignEdge {
  id: string
  projectId: string
  canvasId: string
  from: string
  to: string
  relationType: RelationType
  condition?: string
  label?: string
  priority?: number
  createdAt: number
  updatedAt: number
}

export interface NodeTypeMeta {
  type: NodeType
  label: string
  color: string
  defaultFields: Record<string, unknown>
}

export interface RelationTypeMeta {
  type: RelationType
  label: string
}

export type ValidationLevel = 'error' | 'warn' | 'info'

export type ValidationRuleId =
  | 'DUPLICATE_ID'
  | 'DANGLING_EDGE'
  | 'REQUIRE_CYCLE'
  | 'ORPHAN_NODE'
  | 'EMPTY_NAME'
  | 'BLOCKS_ASYMMETRY'

export interface ValidationIssue {
  id: string
  ruleId: ValidationRuleId
  level: ValidationLevel
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export type EditorView = 'canvas' | 'table'

export type ImpactRole = 'upstream' | 'downstream' | 'none'

export interface AiGraphPatch {
  nodes: Array<{
    id: string
    type: NodeType
    name: string
    fields: Record<string, unknown>
    position?: { x: number; y: number }
  }>
  edges: Array<{
    id?: string
    from: string
    to: string
    relationType: RelationType
    condition?: string
    label?: string
  }>
  explanation?: string
}
