# Game Design Graph — 开发指南

> 版本：v0.1  
> 状态：已确认，作为后续开发的唯一需求与架构依据  
> 最后更新：2026-06-15

---

## 1. 项目定位

### 1.1 一句话

**面向游戏策划的 Web 端关系图编辑器**：用清晰的节点与连线表达事件、能力、任务等设计要素及其依赖，内置 DeepSeek AI 辅助创建与校验；策划自用，无需导出到引擎。

### 1.2 已确认的产品决策

| 维度 | 决策 | 说明 |
|------|------|------|
| 首要场景 | **通用** | 同一套模型覆盖事件、能力、任务、Buff 等，靠「节点类型模板」区分语义 |
| 运行形态 | **Web 优先** | 浏览器访问；本地开发与部署简单，后续可包 PWA |
| AI 提供商 | **DeepSeek** | 使用 DeepSeek API；Key 由用户自行配置 |
| 导出 | **不需要** | 不做 JSON/Excel/引擎插件导出；数据留在系统内供查阅与编辑 |
| 协作 | **未来做** | MVP 单人使用；架构预留多人实时协作扩展点 |
| 审美 | **简洁易读** | 参考 Notion / Linear 的信息密度与留白，避免游戏 UI 式装饰 |
| **存储策略** | **本地优先** | 项目数据与 DeepSeek API Key **均只存本机浏览器**；云端仅作未来可选同步，不替代本地 |

### 1.2.1 本地优先（已确认，长期有效）

1. **项目数据**：IndexedDB 为唯一权威数据源；autosave 写本地；无网络时仍可编辑（AI 除外）。
2. **API Key**：加密存本地 IndexedDB，**不上传**到任何自建/第三方托管后端；仅在用户主动调用 AI 时，由浏览器带 Key 请求 DeepSeek。
3. **开发代理**（`/api/deepseek`）：仅开发期转发，**禁止**落盘 Key 或 prompt。
4. **未来云端**（Phase 3）：若做协作/同步，须「本地为主、云端为副本/合并层」，且 Key 仍默认本地；不得强制把 Key 存服务端。

### 1.3 非目标（明确不做）

- 不做运行时模拟（如 Machinations 式数值仿真）
- 不做引擎导入/导出管线
- MVP 不做账号体系与实时多人编辑
- 不做移动端原生 App（响应式 Web 即可）

### 1.4 目标用户

游戏策划、系统策划、关卡/叙事策划——需要在版本迭代中维护**有依赖关系**的设计文档，且希望「改一处、全局可见影响」。

---

## 2. 核心概念

### 2.1 三层模型

```
项目 (Project)
  └── 画布 (Canvas)          ← 一个主题域，如「战斗技能」「第一章任务」
        ├── 节点 (Node)      ← 具体设计实体
        └── 边 (Edge)        ← 节点间有语义的关系
```

- **项目**：顶层容器，含全局设置、DeepSeek Key（加密存本地/服务端）、节点类型模板。
- **画布**：无限平面上的一张图；节点坐标仅在该画布内有效。
- **节点**：有 `type`（能力/事件/任务/…）、`id`（项目内唯一）、`fields`（模板定义的字段）。
- **边**：`from`、`to`、`relationType`、可选 `condition`（人类可读 + 简单表达式）。

### 2.2 节点类型（首批内置）

| type | 中文名 | 核心字段 | 典型用途 |
|------|--------|----------|----------|
| `ability` | 能力 | name, description, level, cooldown, tags | 技能、天赋、被动 |
| `event` | 事件 | name, description, trigger, phase | 剧情点、系统事件、触发器 |
| `quest` | 任务 | name, description, status_default | 任务链、目标 |
| `buff` | 效果 | name, description, duration, stack_rule | Buff / Debuff / 状态 |
| `entity` | 实体 | name, description, category | NPC、物品、关卡等通用占位 |
| `group` | 分组 | name, description | 纯容器，用于折叠与视觉分组 |

后续可通过「模板配置」扩展字段，无需改代码（Phase 2）。

### 2.3 关系类型（首批内置）

| relationType | 中文 | 语义 | 方向 |
|--------------|------|------|------|
| `requires` | 依赖 | B 需要 A 先满足 | A → B |
| `triggers` | 触发 | A 发生则启动 B | A → B |
| `unlocks` | 解锁 | A 完成后解锁 B | A → B |
| `blocks` | 互斥 | A 与 B 不能同时生效 | A ↔ B（存两条或标记 bidirectional） |
| `modifies` | 修改 | A 改变 B 的属性/行为 | A → B |
| `references` | 引用 | 弱关联，无硬逻辑 | A → B |

边上可选字段：

- `condition`：字符串，如 `player.level >= 10`
- `label`：短说明，显示在连线旁
- `priority`：数字，同目标多边时的展示顺序

### 2.4 统一规则

1. **节点 `id`**：项目内全局唯一，建议 snake_case，创建后默认不可改（防断引用）。
2. **删节点**：必须提示下游影响数量；用户确认后级联删除关联边。
3. **环检测**：`requires` / `unlocks` 链路上不允许有向环；保存时校验并标红。
4. **孤儿节点**：无边且不在 group 内的节点，在「问题面板」中 WARN。

---

## 3. 功能规格

### 3.1 MVP（Phase 1）— 必须交付

#### 3.1.1 项目管理

- [ ] 创建 / 打开 / 删除项目（浏览器 IndexedDB 持久化）
- [ ] 项目内多画布：新建、重命名、删除、切换
- [ ] 项目级设置：名称、描述、DeepSeek API Key

#### 3.1.2 画布编辑器

- [ ] 无限画布：平移、缩放、迷你地图（可选，Phase 1 末尾）
- [ ] 从节点库拖拽或双击创建节点
- [ ] 节点：选中、移动、多选、删除、复制粘贴
- [ ] 连线：从端口拖出、选择关系类型、点击编辑 condition/label
- [ ] 自动布局按钮（dagre 层次布局，可选手动微调）
- [ ] 按类型着色 + 图例；**简洁卡片**样式（见 §6）
- [ ] Undo / Redo（至少 50 步）

#### 3.1.3 属性与检索

- [ ] 右侧属性面板：编辑选中节点/边的全部字段
- [ ] Markdown 渲染的描述预览（编辑用 textarea 即可）
- [ ] 全局搜索：按 name、id、tags、description 跳转并聚焦节点
- [ ] **影响分析**：选中节点 → 高亮所有上游（依赖来源）与下游（被影响）

#### 3.1.4 表格视图

- [ ] 同一项目数据的可切换 Tab：「画布 | 表格」
- [ ] 表格列：id、type、name、关键字段、入度、出度
- [ ] 行内编辑 name 等字段；改 requires 类关系仍建议在画布操作（表内只读展示关系摘要）

#### 3.1.5 校验面板

- [ ] 问题列表：重复 id、悬空边、依赖环、孤儿节点
- [ ] 点击问题项定位到画布

#### 3.1.6 DeepSeek AI

- [ ] 设置页保存 API Key（仅 client 加密存 IndexedDB，不上传第三方）
- [ ] AI 侧边栏对话
- [ ] **生成图**：自然语言 → 解析为 nodes + edges JSON → 预览 → 用户确认后写入当前画布
- [ ] **补全节点**：选中 1+ 节点 → 「AI 补全关联内容」→ 预览 diff → 应用
- [ ] **一致性问答**：基于当前项目摘要回答「X 和 Y 是否矛盾」「改 Z 影响什么」
- [ ] 所有 AI 写入必须经过**预览确认**，禁止 silent apply

#### 3.1.7 数据持久化

- [ ] 全量 autosave（debounce 1s）
- [ ] 手动「立即保存」与保存状态指示
- [ ] 数据结构版本号 `schemaVersion`，便于未来迁移

### 3.2 Phase 2 — 体验增强

- [ ] 自定义节点模板（JSON 配置增加字段）
- [ ] 边条件语法高亮与简单校验
- [ ] 画布内 group 折叠
- [ ] 版本快照（本地历史列表， diff 摘要）
- [ ] 键盘快捷键 cheatsheet
- [ ] PWA：离线只读或离线编辑（视 IndexedDB 策略）

### 3.3 Phase 3 — 多人实时协作（未来）

架构预留，MVP 不实现，但**禁止**做以下短视决策：

- 不要把节点坐标或业务数据绑死在「仅前端、无 sync 层」的私有结构里
- 使用可合并的 CRDT 或 OT 友好的文档模型（见 §5.3）

Phase 3 目标：

- [ ] 账号 / 工作区
- [ ] 同一项目多人同时编辑画布
- [ ] 在线 presence、选中态、冲突合并
- [ ] 服务端持久化 + 权限

---

## 4. DeepSeek 集成规范

### 4.1 API 配置

| 项 | 值 |
|----|-----|
| Base URL | `https://api.deepseek.com` |
| 对话模型 | `deepseek-chat`（默认） |
| 可选推理模型 | `deepseek-reasoner`（复杂校验时用户可切换） |
| 认证 | `Authorization: Bearer <API_KEY>` |

Key 存储（**长期本地，不迁服务端**）：

- 浏览器 `IndexedDB`（随项目 `settings`）+ Web Crypto 加密（device secret derived key）
- 禁止将 Key 写入日志、URL、Cookie 或非用户控制的远程存储
- 用户换浏览器/换机需重新填写 Key（或通过未来的本地备份文件迁移）

### 4.2 请求路径

MVP 推荐 **浏览器直连 DeepSeek**（CORS 需验证；若不通，加一层极简本地/自托管 proxy，仅转发，不存 Key）。

备选：`/api/ai/chat` 薄代理（部署时用户自建）。

### 4.3 Prompt 与结构化输出

所有「会改动画布」的能力，模型必须输出 **JSON**，经 Zod / JSON Schema 校验后再展示预览。

#### 4.3.1 系统提示词要点

- 角色：资深游戏系统策划助手
- 输出语言：简体中文（字段 name/description；id 用英文 snake_case）
- 遵守本项目 `relationType` 枚举，不得自造关系名
- 新建节点必须生成唯一 `id`（基于 name 转写 + 随机后缀防冲突）
- 不得编造项目中已存在 id 的冲突含义；若引用已有节点，必须使用已有 id

#### 4.3.2 「生成图」输出 Schema（示例）

```json
{
  "nodes": [
    {
      "id": "skill_fireball",
      "type": "ability",
      "name": "火球",
      "fields": {
        "description": "基础火焰伤害技能",
        "level": 1,
        "tags": ["fire", "magic"]
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "edge_001",
      "from": "skill_fireball",
      "to": "skill_meteor",
      "relationType": "requires",
      "condition": "skill_fireball.level >= 5",
      "label": "5级解锁"
    }
  ],
  "explanation": "一句话说明生成逻辑"
}
```

布局：若 AI 未给合理坐标，前端用 dagre 自动排版后再展示预览。

#### 4.3.3 上下文裁剪策略

项目过大时不能全量塞入 context：

1. 始终附带：项目 node type 枚举、relation 枚举、命名规范
2. 用户选中节点时：附带选中节点 + 1-hop 邻居
3. 「生成图」：仅附带同画布已有 id 列表（不含全文），防 id 冲突
4. 全局问答：先做关键词检索取 Top-K 相关节点摘要（本地 embedding 可选 Phase 2）

### 4.4 AI UI 交互

| 入口 | 行为 |
|------|------|
| 右侧 AI 面板 | 自由对话；检测意图为「改图」时走结构化流程 |
| 画布工具栏「AI 生成」 | 打开 prompt 输入框 → 预览 → 应用 |
| 节点右键 | 「AI 补全下游」「AI 解释影响链」 |
| 应用前 | Modal 预览：新增/修改/删除列表，可逐项勾选 |

错误处理：API 失败、JSON 解析失败、Schema 校验失败均需可读中文提示，保留用户输入可重试。

---

## 5. 技术架构

### 5.1 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | **React 19 + TypeScript** | 生态成熟，与 XYFlow 契合 |
| 构建 | **Vite** | 快，适合 Web 优先 |
| 路由 | **React Router** | 项目列表 / 编辑器 / 设置 |
| 图编辑 | **@xyflow/react** | 维护活跃，自定义节点简单 |
| 布局 | **dagre** | 自动层次布局 |
| 状态 | **Zustand** + **immer** | 图数据 + UI 态；便于 undo |
| 历史 | **zundo** 或自研栈 | Undo/redo |
| 持久化 | **IndexedDB（dexie）** | 大项目、结构化查询 |
| 样式 | **Tailwind CSS** | 简洁设计令牌易控 |
| 组件基座 | **Radix UI** | 无障碍、无强视觉风格 |
| AI 客户端 | **fetch** + 自封装 `deepseekClient` | 无多余依赖 |
| 校验 | **Zod** | Schema 与 AI 输出校验 |

### 5.2 目录结构（规划）

```
游戏策划自制软件/
├── docs/
│   └── DEVELOPMENT_GUIDE.md      ← 本文档
├── public/
├── src/
│   ├── app/                      # 路由、布局
│   ├── components/
│   │   ├── canvas/               # 画布、节点、边、工具栏
│   │   ├── panels/               # 属性、AI、校验、搜索
│   │   ├── table/                # 表格视图
│   │   └── ui/                   # 按钮、输入等基础 UI
│   ├── domain/
│   │   ├── types/                # Node, Edge, Project, Canvas
│   │   ├── templates/            # 节点类型默认字段
│   │   ├── validation/           # 环检测、孤儿检测
│   │   └── layout/               # dagre 封装
│   ├── store/                    # Zustand stores
│   ├── db/                       # Dexie schema & repositories
│   ├── ai/
│   │   ├── deepseekClient.ts
│   │   ├── prompts/
│   │   └── schemas/              # AI 输出 Zod
│   └── lib/                      # 工具函数
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

### 5.3 数据模型（TypeScript 摘要）

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  settings: {
    deepseekApiKeyEncrypted?: string;
    deepseekModel: 'deepseek-chat' | 'deepseek-reasoner';
  };
}

interface Canvas {
  id: string;
  projectId: string;
  name: string;
  viewport: { x: number; y: number; zoom: number };
  nodeIds: string[];  // 冗余索引，便于查询
  edgeIds: string[];
}

interface DesignNode {
  id: string;
  projectId: string;
  canvasId: string;
  type: NodeType;
  name: string;
  fields: Record<string, unknown>;
  position: { x: number; y: number };
  parentGroupId?: string;
  createdAt: number;
  updatedAt: number;
}

interface DesignEdge {
  id: string;
  projectId: string;
  canvasId: string;
  from: string;
  to: string;
  relationType: RelationType;
  condition?: string;
  label?: string;
  createdAt: number;
  updatedAt: number;
}
```

**协作预留**：每个实体含 `updatedAt` 与将来可加的 `revision` / `clientId`；整项目可序列化为单文档快照，便于 CRDT（如 Yjs）包裹。

### 5.4 路由

| 路径 | 页面 |
|------|------|
| `/` | 项目列表（新建、最近打开、删除） |
| `/project/:projectId` | 默认进入该项目最后一个画布 |
| `/project/:projectId/canvas/:canvasId` | 编辑器主界面 |
| `/settings` | DeepSeek Key、主题（明/暗）、关于 |

### 5.5 性能基线

- 单画布 **500 节点 / 800 边** 内操作流畅（60fps 平移缩放为目标）
- 超出时：非可见区域节点简化渲染（仅显示 label）
- 搜索索引在 worker 中构建（Phase 2 优化项，MVP 可同步）

---

## 6. UI / UX 设计规范

### 6.1 设计原则

1. **内容优先**：节点默认只显示 `type` 图标 + `name` + 一条关键字段；详情在面板
2. **低噪音配色**：浅灰背景 `#F7F8FA`，卡片白底，细边框 `#E5E7EB`
3. **类型色**（柔和，非 neon）：
   - ability `#3B82F6` 蓝
   - event `#8B5CF6` 紫
   - quest `#F59E0B` 琥珀
   - buff `#10B981` 绿
   - entity `#6B7280` 灰
   - group `#CBD5E1` 浅灰框
4. **字体**：系统 UI 栈，`14px` 正文，`12px` 辅助
5. **动效**：≤150ms，仅 opacity / transform

### 6.2 编辑器布局

```
┌─────────────────────────────────────────────────────────────────┐
│ Logo   项目名 ▾   画布 Tab…              [搜索]  [校验]  [设置] │
├────────┬──────────────────────────────────────────┬─────────────┤
│ 节点库 │                                          │ 属性        │
│        │              画 布                       │─────────────│
│ 能力   │                                          │ AI 助手     │
│ 事件   │                                          │             │
│ 任务   │                                          │             │
│ …      │                                          │             │
├────────┴──────────────────────────────────────────┴─────────────┤
│ 画布 | 表格                          已保存 · 3 个问题          │
└─────────────────────────────────────────────────────────────────┘
```

- 左侧栏可折叠（48px 图标条）
- 右侧面板：属性 / AI 用 Tab 切换，默认可只开属性
- 底栏：视图切换 + 保存状态 + 问题计数点击展开校验面板

### 6.3 节点卡片线框

```
┌──────────────────────────┐
│ ● 能力    火球            │  ← 类型色点 + 类型名 + title
│ requires ← 烈焰风暴       │  ← 可选：最多 1 条入边摘要
└──────────────────────────┘
```

选中：2px 类型色描边 + 轻微 shadow。  
影响分析模式：上游淡蓝底、下游淡橙底。

### 6.4 空状态

- 新画布：居中提示「从左侧拖入节点，或用 AI 生成」+ 主按钮
- 无 DeepSeek Key：AI 面板引导去设置页，不阻塞画布编辑

---

## 7. 校验规则详表

| 规则 ID | 级别 | 条件 | 提示 |
|---------|------|------|------|
| `DUPLICATE_ID` | error | 项目内 node.id 重复 | 列出冲突 id |
| `DANGLING_EDGE` | error | edge 指向不存在节点 | 边 id + 缺失端 |
| `REQUIRE_CYCLE` | error | requires/unlocks 有向环 | 环上节点列表 |
| `ORPHAN_NODE` | warn | 无边且非 group 成员 | 节点 name |
| `EMPTY_NAME` | warn | name 为空或纯空格 | 节点 id |
| `BLOCKS_ASYMMETRY` | info | blocks 只单向 | 建议补反向 |

环检测算法：对 `requires` + `unlocks` 边建邻接表，DFS 三色标记。

---

## 8. 开发里程碑与任务顺序

### Sprint 0 — 脚手架（约 1–2 天）

1. Vite + React + TS + Tailwind + Router
2. Dexie 数据库与 Project / Canvas / Node / Edge CRUD
3. 项目列表页 + 空白编辑器路由

**完成标准**：能创建项目、画布，刷新后数据仍在。

### Sprint 1 — 画布核心（约 3–4 天）

1. XYFlow 集成，自定义 `DesignNode` 组件
2. 创建、移动、删除、连线
3. Zustand 图状态 + Undo/redo
4. 右侧属性面板双向绑定
5. Autosave

**完成标准**：纯手动完成一张技能依赖图并持久化。

### Sprint 2 — 视图与质量（约 2–3 天）

1. 表格视图
2. 搜索与聚焦
3. 影响分析高亮
4. 校验面板 + 环检测
5. dagre 自动布局

**完成标准**：500 节点规模下可接受；校验能捕获故意造的环。

### Sprint 3 — DeepSeek（约 2–3 天）

1. 设置页 Key 存取
2. `deepseekClient` + 流式可选（MVP 非流式即可）
3. 生成图 / 补全 / 问答三条 prompt + Zod
4. 预览确认 Modal

**完成标准**：用一句中文生成 5+ 节点图，应用后可在画布编辑。

### Sprint 4 — 打磨（约 1–2 天）

1. 键盘快捷键（Delete、Ctrl+Z/Y、Ctrl+D 复制）
2. 空状态、错误 toast、加载态
3. 暗色主题（可选）
4. 本文档与代码 README 对齐

**MVP 发布标准**：策划可独立完成「建项目 → 手动画图 / AI 生成 → 校验 → 搜索」闭环，无需导出。

---

## 9. 测试策略

| 类型 | 范围 |
|------|------|
| 单元测试 | `validation/`（环检测、孤儿）、AI JSON Schema 解析 |
| 集成测试 | Dexie 读写、store undo 链 |
| 手工测试清单 | 见 §9.1 |

### 9.1 MVP 手工测试清单

- [ ] 新建项目 → 多画布切换
- [ ] 创建各类型节点，连线各 relationType
- [ ] 刷新浏览器后数据完整
- [ ] 制造依赖环 → 校验报错 → 定位节点
- [ ] 影响分析上下游正确
- [ ] AI 生成 → 预览 → 部分勾选应用
- [ ] 无 Key 时 AI 引导，画布仍可用
- [ ] 删除有下游的节点 → 确认提示

---

## 10. 安全与隐私

- **本地优先**：项目与 API Key 均以本机 IndexedDB 为准（见 §1.2.1）
- DeepSeek Key **仅存用户浏览器**；不上传到任何自建服务器（proxy 仅转发、不存 Key）
- 若使用 proxy：HTTPS only，日志禁止打印 Key 与 prompt 全文
- AI 请求时：Key 与 prompt 内容**仅发往 DeepSeek**（用户已知情）；图数据不会上传到本项目的服务器（因无此服务器）
- 无账号阶段：数据丢失风险由用户承担，设置页提示定期备份（Phase 2 快照导出仅作备份，非引擎导出）

---

## 11. 协作扩展备忘（Phase 3 设计约束）

MVP 实现时请遵守：

1. **ID 生成**：客户端 UUID v4，避免日后多端冲突
2. **时间戳**：所有写操作更新 `updatedAt`
3. **Store 边界**：图变更经统一 `applyPatch` / `applyTransaction`，便于接 Yjs
4. **禁止**在组件内直接改 Dexie 绕过 store
5. 画布 `viewport` 与节点 `position` 分离，协作时视口不同步

候选协作栈（Phase 3 再定）：**Yjs + y-websocket + 自托管 hocuspocus**，或 **Liveblocks**（付费省事）。

---

## 12. 术语表

| 术语 | 含义 |
|------|------|
| 节点 | 游戏设计实体的一格卡片 |
| 边 / 连线 | 两节点间的有向关系 |
| 画布 | 一张可编辑的关系图 |
| 影响分析 | 高亮某节点的上游依赖与下游受影响项 |
| 预览确认 | AI 改图前的 diff 审查步骤 |

---

## 13. 文档维护

- 任何**范围变更**（新节点类型、改 AI 提供商、加导出）须先更新本文档再写代码
- 每个 Sprint 结束时核对 §8 完成标准
- 代码内 TODO 格式：`// GUIDE: Phase3-collab — 说明`

---

## 附录 A：DeepSeek 请求示例

```typescript
const response = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  }),
});
```

> 注：若 `response_format` 在某一模型不可用，退化为 prompt 内强调「仅输出 JSON」+ 前端提取 `` ```json `` 块。

---

## 附录 B：后续可扩展方向（不在 MVP）

- 本地 embedding 语义搜索（DeepSeek embedding 或 bge-small）
- 评论 / @mention（协作前置）
- 模板市场：常见 RPG 技能树模板
- 与 Notion 双向同步（策划已有工具链时）

---

**本文档为开发唯一依据。开始编码前无需再确认大纲；若与用户口头需求冲突，以本文档为准并回溯更新本文档。**
