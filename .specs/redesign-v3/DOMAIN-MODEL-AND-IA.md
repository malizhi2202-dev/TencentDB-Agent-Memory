# V3 领域模型与信息架构收敛稿

> 2026-09-15 · 本文是 V3 的**概念、关系、归属、权限和页面信息架构的唯一阅读入口**。它审查并收敛 `REQUIREMENTS.md` 与 `PRODUCT-DESIGN-V3.md` 中的目标规格；若两份旧稿与本文冲突，以本文为准。本文不改变已有业务实现，也不将原型演示当作后端能力。

## 1. 为什么需要收敛

旧 V3 将组织、项目、执行、知识、接入路由、审核与底层版本机制同时放进一级导航，造成三个问题：

1. **对象边界混乱**：Team/Project 关系、资源 owner、当前筛选范围、Task/Run 上下文和权限被误读为同一件事。
2. **流程重复**：导入归属、治理归属、变更队列、独立 routing 页面都在处理“候选内容下一步去哪”。
3. **实现机制前置**：Manifest、Snapshot、图索引构建等应解释事实的机制，挤占了日常工作的入口。

收敛目标不是删掉必要能力，而是让每一个对象有单一职责、每个候选只有一条处理链、每种授权都能解释来源。

---

## 2. 核心概念定义

| 概念 | 定义 | 明确不是什么 |
|---|---|---|
| **Principal** | 经认证的操作主体，可能是 User 或 Service Principal。 | 不是请求体中的 `userId`，不是 Key 的创建者。 |
| **Credential** | 认证凭据，含 scope、指纹、到期与撤销信息。 | 不是实际操作者证明；共享个人 Key 只能得到 `actor_unknown`。 |
| **Team** | 唯一组织实体，管理成员与 Team 级资源关系。 | 不是 Project 的父目录，也不自动授予 Project 权限。 |
| **Project** | 围绕目标、任务与交付持续协作的工作现场。 | 不等于 Team；可关联多个 Team。 |
| **Task** | Project 中可验收的工作目标。 | 不是一次执行，不因 Run 成功自动完成。 |
| **Run** | 一次不可改写的执行尝试与其证据。 | 不是 Task；失败重试创建新 Run。 |
| **Agent** | 可版本化的执行配置：职责、模型、工具与资源装配。 | 不是 Team 成员权限或项目写权限的替代。 |
| **MemorySpace** | 记忆的归属、可见性和写策略边界。 | 不是普通文件夹，也不是一次 Run 的临时上下文。 |
| **Memory** | 在一个 MemorySpace 中版本化、可追溯的记忆内容。 | 不是 Wiki、Code、Skill 的总称。 |
| **Wiki / Code / Skill** | 各自有专业来源、版本、编辑与阅读语义的资源。 | 不应被一张泛化资产表取代。 |
| **ProcedureTemplate** | 可复用的过程模板；以 `kind=scene` 表示适用情境、`kind=playbook` 表示稳定步骤。 | 不创建第二套运行时或独立编排引擎。 |
| **ContextBinding** | Task、Run 或 Session 的工作上下文：主项目、参考读取项目、单次写目标。 | 不是用户最近项目、浏览器 Tab 或页面筛选。 |
| **ChangeSet** | 人工编辑或 Agent 候选的统一内容变更、合并、审核和发布对象。 | 不是 Run 的执行前批准。 |
| **RunGate** | 对高风险工具副作用的运行时批准。 | 不与 ChangeSet 内容审核混称为 Approval。 |
| **Snapshot** | Task 的 planning snapshot 或 Run 的 actual snapshot。 | 不能被当前 latest 配置回填或篡改。 |

### 2.1 正式归属类型

长期 MemorySpace 仅允许四类 owner：`user`、`team`、`project`、`agent`。

Task/Run/Session 是**工作上下文与来源关联**，不是长期知识 owner。确有暂存需求时，使用绑定到 Task/Run 的隔离草稿，而非创建第五类长期记忆空间。

---

## 3. 概念关系

```text
User ──< TeamMembership >── Team ──< TeamProject >── Project ──< ProjectMembership >── User
                                      │
                                      └── 协作关系；不授予 Project 权限

Agent ──< AgentTeamRelation >── Team
Agent ──< AgentProjectRelation >── Project

Project ──< Task ──< Run ──< RunGate（仅高风险副作用）
                     │
                     └── actual snapshot / artifacts / evidence
Task ── planning snapshot
Task | Run | Session ── ContextBinding

MemorySpace(owner=user|team|project|agent) ──< Memory ──< MemoryRevision
Agent ──< fixed resource / space mount >── Wiki | Code | Skill | MemorySpace
Run ── actual snapshot ── effective resources

Incoming memory → Triage → ChangeSet → Review → Published revision
```

### 3.1 关系解释

- **Team ↔ Project**：多对多协作关联。它解释“哪些组织参与项目”，不解释“谁能访问项目”。
- **User ↔ Team / Project**：两种独立成员关系。用户可有项目权限而不属于关联 Team。
- **Agent ↔ Team / Project**：独立关联。Agent 被列为 Team 服务成员，不获得写入、工具或审批权。
- **Project → Task → Run**：Project 是现场、Task 是目标、Run 是一次尝试。
- **MemorySpace → Memory**：空间决定 owner、ACL、domain 和写策略；Memory 带来源、版本与生命周期。
- **Agent 资源关系**：`accessible` 是当前主体可用候选；`mounted` 是 Agent 默认装配；`effective` 是具体 Run 实际解析出的不可变集合。
- **变更关系**：内容类候选只走 `Incoming memory → Triage → ChangeSet → Review → Publish`；高风险工具调用才走独立 `RunGate`。

---

## 4. 归属与权限规则

### 4.1 五个不能混淆的维度

| 维度 | 回答的问题 | 权威来源 |
|---|---|---|
| 身份 | 谁正在操作？ | 认证出的 Principal；未验证用户为 `actor_unknown`。 |
| 关系 | 对象之间是否有关联？ | Membership、TeamProject、AgentProject、mount 等关系边。 |
| 资源归属 | 内容由哪个边界负责？ | MemorySpace 的 owner、visibility、ACL。 |
| 工作上下文 | 本次执行在哪工作、读哪里、写哪里？ | ContextBinding。 |
| 权限 | 当前主体可否读、用、写、审批、发布？ | scope ∩ Principal 权限 ∩ ACL ∩ 动作策略 ∩ 委托范围。 |

### 4.2 禁止的权限推导

- Team 成员 **不等于** Team 关联 Project 的成员。
- TeamProject 关联 **不等于** 项目读写授权。
- Agent 加入 Team **不等于** Agent 可写、可调用工具或可审批。
- 当前 Team/Project 筛选 **不等于** 授权或执行绑定。
- Agent `mounted` 资源 **不等于** Run `effective` 资源。
- 服务凭据创建者 **不等于** 服务主体的权限来源。
- 历史 Snapshot **不等于** 可以绕过当前撤权。
- Agent 提出候选 **不等于** Agent 可以审批或发布。

### 4.3 ContextBinding 的固定字段

| 字段 | 意义 | 不授予的能力 |
|---|---|---|
| `primaryProjectId` | 任务的主要工作现场。 | 对其他项目的读取或写入。 |
| `referenceProjectIds[]` | 每一个都单独授权的只读来源。 | 向该项目写入或复制来源内容。 |
| `writeTargetSpaceId` | 本次唯一写入目标。 | 对同 owner 的其他空间写入。 |

显式无权目标直接拒绝；绑定冲突返回 `context_conflict`；弱证据或多候选进入 Triage；不得回退至最近项目、个人空间或相似项目。

### 4.4 筛选语义

资源目录仅使用可解释的四维关系筛选：

- Team：`relatedTeamId`
- Project：`relatedProjectId`
- User：`ownerUserId`
- Agent：明确选择 `mountedByAgentId` 或 `usedInRunByAgentId` 的关系类型

同维 OR，维间 AND，且**先授权再筛选**。`actor` 是独立维度，不能与 owner 混用。

---

## 5. 审查后的范围收敛

### 保留

1. Project → Task → Run 的工作闭环。
2. Team 与 Project 的独立多对多关系。
3. Principal、权限、Binding 三层分离。
4. MemorySpace、Memory、provenance 和 `accessible / mounted / effective`。
5. ChangeSet 三方合并、locked、`mergedHash + headRevision` 审核、CAS 发布。
6. incoming memory 的去重、unknown、lineage、validated example。
7. Wiki 三种关系视图和 Code 的 source + revision 专业工作台。

### 合并或降级

| 原设计项 | 收敛决定 |
|---|---|
| Scene 与 Playbook 三套并列目录 | 合并为 Templates 下的 ProcedureTemplate，以 kind 区分。 |
| 内容审批与运行审批 | 内容用 ChangeSet Review；工具副作用用 RunGate。 |
| routing 独立工作台 | 降为 Task、Run、Triage 中的 binding 解释与确认面板。 |
| governance/classification、ingestion/import 多队列 | 统一为 Ingestion 的 Import → Triage → Quality / Examples；候选再进入 Changes。 |
| `task` owner 的长期 MemorySpace | 删除；改为临时草稿/来源绑定。 |
| `spaces` 一级导航 | 并入 Memory 的“空间与策略”管理视图。 |
| Snapshots/Manifest 一级日常入口 | Task、Run、ChangeSet 详情就近解释；全局构建诊断仅管理员可见。 |
| Assets 一级目录 | 删除；Library/Team Resources 只做授权后的发现与跳转。 |
| Analytics 与日常治理并列 | 保持与 incoming-memory quality 分离，移动到 Settings/Admin。 |

---

## 6. 新信息架构

### 工作

- **工作台**：只显示可行动事项：我的 Task、等待分诊、等待审核、失败 Run。
- **项目**：Overview、Tasks、Agents、Runs、Resources、Activity、Access。
- **任务**：目标、计划、Runs、交付与验收；Binding 与 planning snapshot 在此解释。
- **运行**：Explorer 列表；详情采用树形事件、实际上下文、工具证据、交付。RunGate 就近显示。
- **Agent**：配置、项目关系、装配、版本、实际运行。
- **编排**：仅管理现有手动/自动触发和运行记录，不承诺新的 Flow 引擎。

### 知识与复用

- **资源库**：授权后的跨类型发现页；四维关系筛选，只跳转，不编辑资源。
- **记忆**：浏览、来源、版本、纠错；“空间与策略”作为其管理视图。
- **Wiki**：文档、搜索、图谱（显式链接 / 向量相似 / 知识关系是同一页的视图模式）。
- **Code**：来源、树、查询、关系和调用链共用同一 source + revision。
- **Skill**：已发布 Skill 目录及使用关系。
- **Templates**：AgentTemplate、ProcedureTemplate 两类模板。

### 输入、治理与发布

- **导入**：Import、Triage、Quality、Examples。唯一的归属人工处理入口。
- **变更**：Queue、Review、Publish。唯一的内容审核入口；发布构建状态在这里显示。

### 组织与平台

- **Team**：成员、关联项目、Team 级资源入口。不是权限替代品。
- **Settings**：Users、Keys、Models、Integrations；权限、审计、运营 Analytics 位于 Admin 工具区，仅按角色显示。
- **Login**：壳外页面；不混入 API Key 或组织管理。

---

## 7. 竞品参考及采用边界

| 产品 | 采用的模式 | 不照搬的前提 |
|---|---|---|
| [Linear Concepts](https://linear.app/docs/conceptual-model) | Team、Project、工作项分层；Project 围绕共同结果聚合工作。 | 本产品的 Task/Run/Memory 仍有独立执行与证据语义。 |
| [Linear Teams](https://linear.app/docs/teams) | Team 有局部主页、成员与项目关联；工作对象和项目不混作同一种对象。 | Team 不作为本产品 Project 权限的来源。 |
| [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) | 同一批工作项提供列表、字段、筛选和多种投影视图。 | 不复制 GitHub 的仓库/Issue 权限模型。 |
| [LangSmith observability concepts](https://docs.langchain.com/langsmith/observability-concepts) | Trace/Run 分层、Explorer 列表和可回溯详情。 | 本产品 Run 仍绑定 Task、上下文和审核语义。 |
| [OpenAI RBAC](https://developers.openai.com/api/docs/guides/rbac) | Organization/Project/Role 的范围化权限；项目角色只在项目内生效。 | 本产品保留 Team 与 Project 的独立多对多协作关系。 |

---

## 8. 原型验收主链

原型只需让用户清晰完成下列链路，而不是遍历所有底层机制：

```text
选择 Project → 创建/处理 Task → 查看 Run 的实际上下文与证据
→ 导入内容 → Triage 确认归属 → ChangeSet 审核与发布
→ 在资源库重新发现已发布内容
```

任何页面若不能服务于一个对象、一个关系解释或上述链路，应降为详情面板、管理员工具或后续能力。
