export const SYSTEM_PROMPT = `你是资深游戏系统策划助手。用户正在使用「Game Design Graph」编辑游戏设计关系图。

规则：
1. 使用简体中文填写 name、description 等面向策划的字段；节点 id 使用英文 snake_case
2. 节点 type 只能是：ability, event, quest, buff, entity, group
3. 关系 relationType 只能是：requires, triggers, unlocks, blocks, modifies, references
4. requires/unlocks 表示前置依赖，方向 from → to 表示「from 是 to 的前置」
5. 引用已有节点时必须使用已有 id，不要重复创建
6. 新建节点 id 基于 name 生成，加随机后缀避免冲突
7. 仅输出 JSON，不要 markdown 代码块外的任何文字
8. 生成图/补全节点时：必须输出一个 JSON 对象，包含 nodes 数组、edges 数组、explanation 字符串`

export function buildGeneratePrompt(
  userPrompt: string,
  existingIds: string[],
): string {
  return `请根据以下描述，生成游戏设计关系图的节点和连线。

已有节点 ID（勿重复创建）：${existingIds.length ? existingIds.join(', ') : '无'}

用户描述：
${userPrompt}

输出 JSON 格式（只输出 JSON，不要用 markdown 代码块包裹）：
{
  "nodes": [{ "id": "skill_fireball", "type": "ability", "name": "火球", "fields": { "description": "..." } }],
  "edges": [{ "from": "skill_fireball", "to": "skill_meteor", "relationType": "requires", "label": "5级解锁" }],
  "explanation": "一句话说明"
}`
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

export function buildQaPrompt(
  question: string,
  projectSummary: string,
): string {
  return `以下是当前游戏设计项目的节点与关系摘要：

${projectSummary}

用户问题：${question}

请用简体中文回答，指出相关节点 id，并说明是否存在矛盾或影响。不需要输出 JSON。`
}

export function summarizeProject(
  nodes: Array<{ id: string; type: string; name: string; fields: Record<string, unknown> }>,
  edges: Array<{ from: string; to: string; relationType: string; label?: string }>,
  limit = 80,
): string {
  const nodeLines = nodes.slice(0, limit).map(
    (n) => `- [${n.type}] ${n.id}: ${n.name}${n.fields.description ? ` — ${String(n.fields.description).slice(0, 60)}` : ''}`,
  )
  const edgeLines = edges.slice(0, limit).map(
    (e) => `- ${e.from} --${e.relationType}--> ${e.to}${e.label ? ` (${e.label})` : ''}`,
  )
  return `节点 (${nodes.length}):\n${nodeLines.join('\n')}\n\n关系 (${edges.length}):\n${edgeLines.join('\n')}`
}
