# Agent Memory OS UI V2

## 1. 产品定位

MemoryPanel 不再按 Wiki、CodeGraph、Skill、ChatMemory 等后端模块组织，而按用户完成工作的心智组织：

1. 我正在处理什么工作；
2. 哪些人和 Agent 正在协作；
3. 当前工作装配了哪些知识、技能和记忆；
4. 系统记住了什么、为什么召回；
5. 哪些写入、权限和执行需要治理。

核心产品对象分三层：

- **组织层**：User、Team、权限和公共能力；
- **协作层**：Project、Task、Agent、AgentTeam、Run；
- **认知层**：Asset、MemorySpace、Memory、Playbook、Skill。

## 2. 设计原则

1. **关系优先**：Wiki、CodeGraph、Skill、ChatMemory 是资产类型，不是四套独立产品。
2. **Project 是默认工作现场**：任务、成员、Agent、资产、记忆、决策和 Run 都围绕 Project 聚合。
3. **三层语义分开**：权限回答“能访问什么”，装配回答“Agent 固定携带什么”，检索回答“本轮真正使用什么”。
4. **展示真实对象**：普通页面不暴露 `feedback/decide`、`quality/transition` 等内核函数试调表单。
5. **保留现有视觉**：继续使用 Tea Component、腾讯蓝、中性灰和现有密度，只重做信息架构、布局和交互。

## 3. 全局导航

```text
工作
  工作台
  项目
  任务

协作
  Agent
  Agent 编排
  运行记录

知识与记忆
  记忆
  资产库

组织
  团队
  成员与 API Key

治理（按权限显示）
  审批中心
  权限策略
  模型与连接
  审计与评测
```

旧 Wiki、Code、代码分析、Skill、Chat Memory 路由继续兼容，但改为资产库筛选视图或对象详情页。

## 4. 全局上下文

顶栏增加统一上下文：

```text
[Team] / [Project] / [Agent] / [Task 可选]  [全局搜索] [待审批] [帮助]
```

- Team 决定组织公共池；
- Project 决定协作边界；
- Agent 决定装配和运行身份；
- Task 决定本次工作的最小上下文；
- 上下文进入 URL，可分享并在刷新后恢复；
- 无权限或对象失效时自动降级并明确提示。

## 5. 页面蓝图

### 5.1 工作台 `/`

回答“我现在应该做什么”：

```text
┌ 当前上下文与身份 ─────────────────────────────┐
│ Team / Project / Agent / 今日运行状态           │
├──────────────────────┬─────────────────────────┤
│ 我的任务              │ 需要我处理               │
│ 进行中 / 待评审 / 阻塞 │ 写入审批 / 失败 Run / 风险 │
├──────────────────────┼─────────────────────────┤
│ 最近项目              │ 最近沉淀                 │
│ 进度、成员、Agent      │ 新记忆 / Playbook / Skill │
└──────────────────────┴─────────────────────────┘
```

### 5.2 项目 `/projects`

- 列表支持“我负责的 / 我参与的 / 团队公开”；
- 展示主 Team、我的角色、成员数、Agent 数、任务进度、资产数和最后活动；
- 创建项目改为抽屉向导，明确归属、可见范围、Repo 和路径锚定。

### 5.3 项目工作区 `/projects/:projectId/*`

使用持久化二级导航：

```text
概览 / 任务 / Agent / 知识与资产 / 记忆 / 决策与交付 / 运行记录 / 成员与设置
```

概览展示 Project 与 Members、Agents、Tasks、Assets、MemorySpaces、Runs 的关系摘要。所有摘要均可下钻到对象详情。

### 5.4 Agent `/agents` 与 `/agents/:agentId/*`

Agent 提升为一级工作对象。列表展示 owner、Team、参与 Project、角色、资产、MemorySpace、最近 Run 和待审批数。

Agent 工作区包含：

```text
概览 / 参与项目 / 任务与运行 / 能力装配 / 记忆空间 / 策略与权限 / 版本与变更
```

“能力装配”固定分为：可访问资产、固定绑定资产、本次 ExecutionBundle 生效结果。

### 5.5 任务 `/tasks` 与 `/tasks/:taskId`

- 复用现有任务看板并增加列表视图；
- 支持 Project、Agent、状态、风险和创建者筛选；
- 详情聚合参与 Agent、Run、交付物、决策和关联记忆；
- 支持从任务结果沉淀 WorkMemory、Playbook 和 Skill Candidate。

### 5.6 记忆中心 `/memory/*`

合并 Chat Memory 与 MemorySpace，围绕四个用户任务组织：

1. **浏览器**：真实 L0-L3 记忆列表和详情；
2. **检索试调**：展示 query、score、scope、召回理由和来源；
3. **显式管理**：remember、correct、forget；
4. **空间管理**：按 Team、Project、Agent、Task、User 管理挂载和写策略。

记忆详情包含内容、层级、Domain、WritePolicy、Owner、MemorySpace、来源 Conversation/Task/Run、lineage、版本、可见范围和使用 Agent。

### 5.7 资产库 `/assets`

统一承载 Skill、Wiki、CodeGraph、ChatMemory。类型作为筛选条件，不再占据四个一级菜单。

资产详情展示：内容或工具入口、owner、Team、Project、visibility、ACL、固定绑定 Agent、使用情况、版本、状态和来源。类型专属能力继续保留。

### 5.8 Team `/teams/:teamId/*`

Team 只承载组织职责：

```text
概览 / 成员 / 公共资产 / 工作模式 / Agent 编排 / 自动化 / 策略与权限
```

Run、审批和质量评测进入全局治理中心，Team 页面只提供当前 Team 的过滤视图。

### 5.9 治理中心 `/governance/*`

- 待审批：记忆写入、冲突和风险操作；
- 权限：角色、ACL、可见性和共享关系；
- 审计：谁在何时修改、召回、删除或授权；
- 运行回放：Run / Trace；
- 质量评测：召回指标、scope leakage、趋势和回归；
- 开发者诊断：保留纯函数试调能力，但与普通业务页隔离。

## 6. 关键交互

### 6.1 关系抽屉

Project、Agent、Task、Asset、Memory 都提供一致的“关系”入口，展示上游归属、下游包含、当前装配、来源与衍生。第一阶段用分组列表，不急于做复杂关系图。

### 6.2 创建向导

Project、Agent、Asset 统一使用抽屉：基本信息 → 归属与可见性 → 成员或绑定 → 影响范围确认。

### 6.3 可见范围

UI 不只显示 `private/team/restricted`，而显示实际结果，例如“仅我可见”“当前 Team 12 人可见”“Project 5 位成员可见”。

### 6.4 状态与安全

所有页面提供 loading、empty、error、permission denied 和 partial data 状态。破坏性操作说明影响数量并明确确认。

## 7. 路由建议

```text
/
/projects
/projects/:projectId/{overview,tasks,agents,assets,memory,decisions,runs,settings}
/tasks
/tasks/:taskId
/agents
/agents/:agentId/{overview,projects,runs,loadout,memory,policies}
/memory/{browser,search,manage,spaces}
/assets
/assets/:assetId
/teams
/teams/:teamId/{overview,members,assets,patterns,policies}
/governance/{approvals,permissions,audit,runs,evals}
/settings/{models,keys}
```

## 8. 响应式与可访问性

- 1440px：固定侧栏、主区、可选上下文栏；
- 1024px：上下文栏改抽屉；
- 768px：侧栏折叠，二级导航横向滚动；
- 320px：单列，只保留主要动作和关键状态；
- 所有筛选保存在 URL；
- 使用原生可聚焦控件；
- 状态不只依赖颜色；
- 抽屉关闭后焦点返回触发元素。

## 9. 分阶段交付

1. **导航与上下文骨架**：新导航、全局上下文、共享组件、旧路由兼容。
2. **Project 工作区**：概览、任务、Agent、资产、记忆、成员。
3. **Agent 与 Task 工作区**：Loadout 三层视图和关系链。
4. **记忆中心**：浏览、检索、详情、显式操作、空间策略。
5. **资产库与治理**：统一资产、审批、审计、Run、质量评测。

## 10. 成功标准

- 新用户 5 分钟内理解 Team、Project、Agent、Task、Asset、MemorySpace 的关系；
- 任一 Project 关联对象两次点击内可达；
- 普通页面不再暴露内核纯函数；
- 创建对象时明确归属、可见范围和绑定结果；
- 旧路由与现有核心功能不回归；
- 320/768/1024/1440px 均可操作；
- 键盘可完成导航、筛选、抽屉和主要 CRUD。


## 11. 代码扫描后的实现修正

详细证据与关系矩阵见 [CODE-SCAN.md](./CODE-SCAN.md)。本轮扫描后，方案增加以下约束：

1. **不从 UI 直接拼 Project 全景**：新增 Panel `ProjectWorkspaceOverview` 聚合 read model，避免多接口 fan-out。
2. **Agent ↔ Project 第一阶段按单值实现**：Core 当前是可空 `agent.project_id`，多 Project 关系落地前不提供多选假 UI。
3. **先补前端 Project 字段**：Core 支持 Agent/Task 创建时传 `project_id`，前端 create/type 尚未完整暴露。
4. **Run 与审批的 Project 视图先经 Task 推导**：两者当前没有 `project_id`，是否冗余该字段另做 ADR。
5. **Loadout 第三层依赖 ExecutionBundle V2**：现有 bundle 不含实际资产、版本、策略来源和解析链。
6. **MemorySpace 管理晚于只读浏览**：当前只有组合筛选列表，没有策略更新和显式挂载命令。
7. **显式记忆操作需要业务命令**：feedback/lifecycle 是纯函数，`remember/correct/forget` 必须携带 actor、source、scope、version 与 audit。
8. **评测分两阶段**：即时计算器留在开发者诊断；EvalSuite/EvalRun 持久化后才展示业务趋势。
9. **动态详情路由替换静态前缀识别**：现有 PageId TabBar 无法正确区分多个 Project/Agent/Task 实例。
10. **URL 是上下文权威**：Zustand `activeTeamId` 仅作为默认值缓存，不扩展成不可分享的隐式过滤器。

## 12. 页面建设分级

### 12.1 现在可迁移

- Project CRUD、成员、资产和 KnowledgeEntry；
- Project 任务与 Agent 列表（补齐前端字段后）；
- Agent 固定资产、Chat Memory L0–L3、搜索、编辑、导入和分配；
- AgentTeam、Automation、RunTrace、WriteApproval、ACL 和审计。

### 12.2 需要 Panel 聚合层

- Project Overview；
- Agent Overview；
- Task Detail 的参与者、Run、知识与记忆关系；
- Governance Inbox 的审批、失败 Run 和风险事件摘要。

### 12.3 需要 Core 能力

- Agent 多 Project；
- ExecutionBundle 完整快照；
- MemorySpace 挂载、卸载和策略管理；
- remember/correct/forget；
- Memory provenance 中的一等 Run 关系；
- 持久化评测集、评测运行与趋势。

## 13. 第一批可交付边界

```text
URL 上下文
  → Project 列表
  → Project Overview 聚合摘要
  → Project Tasks / Agents / Assets
  → 进入真实 Task 或 Agent 详情
  → 返回 Project 时保留筛选和上下文
```

第一批只使用已有权限模型和真实关系；高级记忆写操作、完整 Run Bundle 和评测趋势不进入首批验收。
