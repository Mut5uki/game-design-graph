import type { CustomNodeTypeDefinition, CustomRelationTypeDefinition } from '@/domain/types'
import { formatAiNodeTypeCatalog } from '@/ai/nodeTypesForAi'
import { formatAiRelationCatalog } from '@/ai/relationsForAi'

const SYSTEM_PROMPT_BASE = `你是资深游戏系统策划助手。用户正在使用「Game Design Graph」编辑游戏设计关系图。

规则：
1. 使用简体中文填写 name、description 等面向策划的字段；节点 id 使用英文 snake_case
2. 节点 type 必须使用下方「可用节点类型」中的 type 值（含用户自定义 custom_* 类型）
3. 关系 relationType 必须使用下方「可用关系类型」中的 type 值（含用户自定义 rel_* 类型）
4. requires/unlocks 表示前置依赖，方向 from → to 表示「from 是 to 的前置」
5. 引用已有节点时：根据用户提到的**中文名称（name）**在节点对照表中查找，输出 JSON 必须使用对应的 id；禁止把中文名称当作 id
6. 新建节点 id 基于 name 生成英文 snake_case，加随机后缀避免冲突
7. 仅输出 JSON，不要 markdown 代码块外的任何文字
8. 生成图/补全/修改时：必须输出一个 JSON 对象，包含 nodes 数组、edges 数组、explanation 字符串
9. 修改已有节点时：先理解用户中文描述指哪个「名称」，再查对照表得到 id；nodes 中 id 必须与对照表一致，只更新需要变更的字段
10. 用户指令中的节点指代以中文名称为准，不要要求用户说 id，也不要仅凭 id 猜测意图
11. 用户提到自定义类型（如「资源」「符文」）时，使用对应 custom_* type，不要擅自改成内置 ability/event 等
12. 用户提到自定义关系（如「包含」「产出」）时，使用对应 rel_* relationType，不要擅自改成内置 requires/triggers 等`

/** @deprecated 请使用 buildSystemPrompt(customNodeTypes) */
export const SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}

## 可用节点类型（内置）
${formatAiNodeTypeCatalog()}`

export function buildSystemPrompt(
  customNodeTypes?: CustomNodeTypeDefinition[],
  customRelationTypes?: CustomRelationTypeDefinition[],
): string {
  return `${SYSTEM_PROMPT_BASE}

## 可用节点类型（内置 + 本项目用户自定义）
${formatAiNodeTypeCatalog(customNodeTypes)}

## 可用关系类型（内置 + 本项目用户自定义）
${formatAiRelationCatalog(customRelationTypes)}`
}

export function buildGeneratePrompt(
  userPrompt: string,
  existingNodes: Array<{ id: string; name: string; type: string }>,
  customNodeTypes?: CustomNodeTypeDefinition[],
  customRelationTypes?: CustomRelationTypeDefinition[],
): string {
  const catalog = formatNodeCatalogLines(existingNodes)
  const typeCatalog = formatAiNodeTypeCatalog(customNodeTypes)
  const relationCatalog = formatAiRelationCatalog(customRelationTypes)
  return `请根据以下描述，生成游戏设计关系图的节点和连线。

## 可用节点类型（新建节点时 type 必须从下列选择）
${typeCatalog}

## 可用关系类型（edges.relationType 必须从下列选择）
${relationCatalog}

## 画布已有节点（用户会用中文「名称」指代，输出时须用对应 id）
${catalog || '无'}

用户描述：
${userPrompt}

输出 JSON 格式（只输出 JSON，不要用 markdown 代码块包裹）：
{
  "nodes": [{ "id": "skill_fireball", "type": "ability", "name": "火球", "fields": { "description": "..." } }],
  "edges": [{ "from": "skill_fireball", "to": "skill_meteor", "relationType": "requires", "label": "5级解锁" }],
  "explanation": "一句话说明"
}

注意：用户若提到已有节点的中文名称，edges/nodes 中必须使用对照表里的 id，勿重复创建。用户自定义类型请用 custom_* / rel_* 的 type 值。`
}

export function buildCompletePrompt(
  selectedSummary: string,
  existingIds: string[],
): string {
  return `请为以下选中的游戏设计节点补全相关的下游节点和连线（2-6 个为宜）。

已有节点 ID：${existingIds.join(', ')}

选中节点：
${selectedSummary}

输出 JSON，包含 nodes、edges、explanation 字段。只输出 JSON，不要用 markdown 代码块。可引用已有 id 建立关系。`
}

export function buildEditGraphPrompt(
  userPrompt: string,
  selectedNodes: Array<{
    id: string
    type: string
    name: string
    fields: Record<string, unknown>
  }>,
  allNodes: Array<{
    id: string
    type: string
    name: string
    fields: Record<string, unknown>
  }>,
  relatedEdges: Array<{
    id: string
    from: string
    to: string
    fromName: string
    toName: string
    relationType: string
    label?: string
    condition?: string
  }>,
  customNodeTypes?: CustomNodeTypeDefinition[],
  customRelationTypes?: CustomRelationTypeDefinition[],
): string {
  const selectedNames = selectedNodes.map((n) => n.name).join('、') || '无'
  const catalog = allNodes.map((n) => formatNodeForAi(n, selectedNodes.some((s) => s.id === n.id)))
  const typeCatalog = formatAiNodeTypeCatalog(customNodeTypes)
  const relationCatalog = formatAiRelationCatalog(customRelationTypes)

  return `用户希望修改或扩展当前画布上的游戏设计图。

## 核心规则（必须遵守）
1. **用户用中文「名称」描述要改什么**，例如「火球术」「濒死冒险者」——不要要求用户提供 id，也不要仅凭 id 理解意图
2. 先在下方「画布节点对照表」中按**名称**找到节点，再在输出 JSON 里使用该行的 **id** 字段
3. **禁止**把中文名称写入 id、from、to 字段
4. 修改已有节点：id 必须来自对照表，只写需要变更的 name/type/fields；改 type 时须用「可用节点类型」中的 type（含 custom_*）
5. 新增节点：type 从「可用节点类型」选择；id 用英文 snake_case；连线 from/to 必须用对照表 id
6. 连线 relationType 须从「可用关系类型」选择（含 rel_* 自定义）

## 可用节点类型（内置 + 用户自定义）
${typeCatalog}

## 可用关系类型（内置 + 用户自定义）
${relationCatalog}

## 当前选中的节点（用户操作焦点，优先处理）
${selectedNames}

## 选中节点详情
${JSON.stringify(selectedNodes.map((n) => formatNodeForAi(n, true)), null, 2)}

## 画布节点对照表（名称 → id）
${JSON.stringify(catalog, null, 2)}

## 与选中节点相关的现有连线（含中文名称）
${relatedEdges.length ? JSON.stringify(relatedEdges, null, 2) : '[]'}

## 用户要求（按中文名称理解）
${userPrompt}

仅输出 JSON：{ "nodes": [...], "edges": [...], "explanation": "..." }，不要 markdown 代码块。`
}

function formatNodeForAi(
  n: { id: string; type: string; name: string; fields: Record<string, unknown> },
  selected: boolean,
) {
  const typeLabel = n.type.startsWith('custom_') ? `${n.type}（自定义）` : n.type
  return {
    名称: n.name,
    id: n.id,
    类型: typeLabel,
    已选中: selected,
    字段: n.fields,
  }
}

function formatNodeCatalogLines(
  nodes: Array<{ id: string; name: string; type: string }>,
): string {
  if (!nodes.length) return ''
  return nodes
    .map((n) => {
      const typePart = n.type.startsWith('custom_') ? `${n.type}（自定义）` : n.type
      return `- 名称「${n.name}」→ id \`${n.id}\`（${typePart}）`
    })
    .join('\n')
}

export function buildQaPrompt(
  question: string,
  projectSummary: string,
): string {
  return `以下是当前游戏设计项目的节点与关系摘要：

${projectSummary}

用户问题：${question}

请用简体中文回答，优先使用节点的**中文名称**说明，必要时括号注明 id。不需要输出 JSON。`
}

export function summarizeProject(
  nodes: Array<{ id: string; type: string; name: string; fields: Record<string, unknown> }>,
  edges: Array<{ from: string; to: string; relationType: string; label?: string }>,
  limit = 80,
): string {
  const nameById = new Map(nodes.map((n) => [n.id, n.name]))
  const nodeLines = nodes.slice(0, limit).map(
    (n) => `- [${n.type}] 「${n.name}」（${n.id}）${n.fields.description ? ` — ${String(n.fields.description).slice(0, 60)}` : ''}`,
  )
  const edgeLines = edges.slice(0, limit).map(
    (e) => {
      const from = nameById.get(e.from) ?? e.from
      const to = nameById.get(e.to) ?? e.to
      return `- 「${from}」--${e.relationType}-->「${to}」${e.label ? ` (${e.label})` : ''}`
    },
  )
  return `节点 (${nodes.length}):\n${nodeLines.join('\n')}\n\n关系 (${edges.length}):\n${edgeLines.join('\n')}`
}
