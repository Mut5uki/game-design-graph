import type { NodeType, RelationType } from '@/domain/types'
import { NODE_TYPE_META, getRelationLabel } from '@/domain/templates/nodeTemplates'
import { summarizeProject } from './system'

export interface SpawnNodeContext {
  name: string
  type: NodeType
  relationType: RelationType
  sourceNode: {
    type: string
    name: string
    fields: Record<string, unknown>
  }
  existingIds: string[]
  projectNodes: Array<{ id: string; type: string; name: string; fields: Record<string, unknown> }>
  projectEdges: Array<{ from: string; to: string; relationType: string; label?: string }>
}

export function buildSpawnNodePrompt(ctx: SpawnNodeContext): string {
  const meta = NODE_TYPE_META[ctx.type] ?? NODE_TYPE_META.entity
  const fieldKeys = Object.keys(meta.defaultFields)
  const sourceDesc = String(ctx.sourceNode.fields.description ?? '').slice(0, 200)
  const relLabel = getRelationLabel(ctx.relationType)

  return `用户从已有节点拖线到空白处，要创建一个新节点并建立连线。

连线方向：源节点「${ctx.sourceNode.name}」--${ctx.relationType}(${relLabel})--> 新节点「${ctx.name}」
即：新节点是源节点的${relLabel === '依赖' ? '前置' : relLabel === '解锁' ? '被解锁方' : '关联'}对象（关系类型 ${ctx.relationType}）。

源节点信息：
- type: ${ctx.sourceNode.type}
- name: ${ctx.sourceNode.name}
${sourceDesc ? `- description: ${sourceDesc}` : ''}

要创建的新节点：
- type: ${ctx.type}（${meta.label}）
- name: ${ctx.name}（用户指定，不要修改 name）

请补全该节点的 fields，需包含字段：${fieldKeys.join(', ')}
- description 必填，写清楚策划用途（2-4 句）
- 其他字段按游戏策划常识填写合理默认值
- tags 等数组字段用 JSON 数组

已有节点 ID（勿重复）：${ctx.existingIds.slice(0, 40).join(', ') || '无'}

当前画布摘要（供参考上下文）：
${summarizeProject(ctx.projectNodes, ctx.projectEdges, 30)}

只输出 JSON，不要用 markdown 代码块：
{
  "node": {
    "name": "${ctx.name}",
    "fields": { ${fieldKeys.map((k) => `"${k}": "..."`).join(', ')} }
  },
  "explanation": "一句话说明设计意图"
}`
}
