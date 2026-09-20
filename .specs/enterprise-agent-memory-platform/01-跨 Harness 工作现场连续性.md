# 议题 1：跨执行者的工作连续性与现场恢复

**状态：已确认（原则层）**

## 问题定义

未完成的工作可能在不同成员、不同会话、不同 Agent 或不同 Harness 之间转移。任务类型可以非常多样：调查、研究、规划、编码、故障处理、阅读、数据处理、运营、安全响应或尚未命名的新型工作。

本议题要回答的是：

> 一项未完成工作，无论由谁、使用什么 Harness、在什么时间继续，都如何恢复足够的现场，并安全地续办？

## 已确认结论

### 1. 平台的核心单位是 Work Thread

`Work Thread / 工作线程` 是：

> 一项尚未完成、可由不同人或不同 Agent/Harness 持续推进的工作。

它不是任务类型，也不是 Chat Session、Harness Session、某次 Run 或某个 Checkpoint。数据库故障、代码开发、规划、阅读、研究、数据处理、运营、客户支持、安全响应等仅仅是 Work Thread 的具体内容，平台不应按这些类型预先建模。

### 2. 交接是一种统一能力

以下都属于 `Handoff / 交接`：

```text
成员 A → 成员 B
成员 → Agent
Agent → 成员
Codex → Claude Code
Claude Code → OpenClaw
同一 Harness 的跨会话恢复
```

成员和 Harness 都是 `Executor / 执行者` 的不同类型。产品的重点不是“Agent 切换”，而是工作在不同执行者之间保持连续性。

### 3. 交接产物是 Continuation Package

交接向下一执行者提供 `Continuation Package / 续办包`，用于恢复可理解、可验证、可继续推进的工作现场。它不是简单复制聊天记录，也不是只能交给某一种 Harness 的固定 Prompt。

续办包应按不同接手者的需要投影：

- 成员接手：交接简报、风险、待办、关键证据与链接；
- 开发 Harness 接手：目标、约束、计划、代码上下文、repo/branch/diff、命令结果与待执行操作；
- 运维 Harness 接手：事件上下文、指标/日志、系统对象、Runbook、审批状态、禁令和验证标准；
- 平台治理 Agent：证据、来源、成熟度、冲突与可提炼候选。

底层应是同一项工作状态，而非互不关联的多套交接产品。

### 4. 现场恢复分层

| 层级 | 定义 | 责任边界 |
|---|---|---|
| L1：语义续办 | 了解目标、现状、事实/假设、证据、进度、风险与下一步，并可继续推进 | 平台必须保证 |
| L2：操作续办 | 取得代码、文档、查询结果、外部对象、关键工件和引用，继续开展操作 | 平台与 Connector 共同保证 |
| L3：环境续办 | 恢复或重连工作目录、运行任务、容器、终端、浏览器、Job 等环境状态 | 取决于 Connector、环境能力和当前授权 |

平台的合理承诺是：

> 跨人、跨会话、跨 Harness 恢复可验证的工作现场并继续推进；在连接器、环境和授权允许时，进一步恢复操作与运行环境。

平台不承诺任意 Harness 间原样迁移其私有内部会话、私有推理、登录态、活跃进程或权限。

### 5. 续办所需的通用信息类别

- **工作身份**：目标、范围、所属 Workspace / Project、状态和阶段；
- **当前认知**：已确认事实、假设和置信度、未知项、决策及依据；
- **进度**：已完成、待完成、失败或排除的路径、推荐下一步；
- **证据与工件**：对话、工具结果、日志、文件、代码 diff、文档、查询、链接以及来源；
- **可恢复环境**：repo / branch / revision / diff、工作目录、任务或外部系统对象引用；
- **治理与安全**：敏感级别、当前授权、风险、禁止动作、审批和等待条件；
- **交接记录**：交接双方、原因、快照、接手确认及后续审计。

### 6. Work Thread 采用显式创建与自动识别结合的混合模式（已确认）

平台不要求所有 Harness 或成员在开始工作前都手工创建 Work Thread，也不把每个短会话自动提升为正式工作。采用“显式创建 + 自动识别候选 + 规则转正”的混合模式：

```text
明确创建
  → 直接成为正式 Work Thread

Harness Session / 工作事件进入
  → 平台识别是否可能构成持续工作
  → Work Thread Candidate
      ├── 高置信、持续、有目标或重要产物
      │     → 按规则自动转正
      ├── 低置信、跨边界或归属不明
      │     → 请求成员确认或进入治理队列
      └── 普通短会话、一次性查询或闲聊
            → 只保留为 L0，不创建正式 Work Thread
```

这一模式同时满足两类需求：

- **显式创建**保证重要工作可以立即获得明确的归属、权限和连续性主体；
- **自动识别**避免成员忘记创建，允许平台从不同 Harness 的工作过程中发现值得持续保存的工作；
- **候选机制**避免把所有 Chat、一次性查询和闲聊都错误建模为工作；
- **规则转正**与议题二确定的“自动为主、选择性审核”保持一致；
- **可撤回和可合并**：候选误判时可以撤销、合并到已有 Work Thread，或仅保留为 L0 证据，不丢失原始来源。

自动识别是否转正时，平台可综合考虑工作是否持续、是否存在明确目标、是否跨多个事件或 Session、是否产生代码/文档/报告/工单等重要产物、是否发生交接/暂停/阻塞，以及是否需要其他成员继续处理。具体评分、阈值、归属和确认流程在“记忆自动归属”及后续体验设计中继续确定。


### 7. Work Thread、Task、Execution、Session / Run 与 Checkpoint 的关系（阶段性结论）

在当前阶段，采用以下关系作为讨论基线：

```text
Team
└── Project / 归属与权限边界
    └── Work Thread / 跨执行者持续存在的工作主体
        ├── Work State / 当前工作状态
        ├── Task / 可验收目标或子目标
        ├── Execution / 某次实际推进
        │   └── Harness Session / Run
        ├── Checkpoint / 某个时间点的可恢复快照
        ├── Handoff / 执行者变化或责任交接
        └── Continuation Package / 面向接手者的续办投影
```

- **Work Thread** 是跨成员、跨 Harness、跨 Session 持续存在的工作连续性主体；
- **Task** 是 Work Thread 中可以验收、分配、暂停或取消的目标/子目标；Work Thread 可以在尚未形成明确 Task 时存在，也可以包含多个 Task；
- **Execution** 是某个成员或 Harness 推进该 Work Thread 或 Task 的一次执行尝试；
- **Session / Run** 是外部 Harness 的会话或运行容器，不是平台的工作真源；它可以中断、重开、切换 Harness 或对应多个执行尝试；
- **Checkpoint** 是某个时间点的状态快照，不等于 Work Thread，也不等于 Harness 私有 Session；
- **Handoff** 记录执行者、责任或工作上下文的交接；
- **Continuation Package** 是基于当前工作状态和证据，面向具体接手者生成的恢复投影。

因此，平台不把“上一段 Chat”直接当成工作，也不把“某次 Run 成功”直接当成 Work Thread 完成。Work Thread 是否结束，需要结合目标、剩余工作、交付物和责任状态判断；这些生命周期细节仍需继续讨论。

### 8. Work Thread 采用单一规范归属，Owner 可为 Project 或 Team（已确认）

一个 Work Thread 不采用多个 Project 共同持有的多重 owner 模型，而采用：

> **单一规范归属（canonical owner） + 多 Project 参与/关联。**

规范 owner 可以是一个 Project，也可以是一个 Team：

```text
Work Thread
├── canonical_owner_scope
│   ├── Project：项目内或以某个项目为主要责任边界的工作
│   └── Team：天然跨多个 Project 的联合工作
├── participating_projects
├── referenced_projects
└── affected_projects / external_resources
```

#### 归属选择

- **Project 作为 owner**：适用于与某个代码库、业务对象、项目目标或未完成工作强绑定的工作；其他 Project 以 participant、related 或 referenced 参与。
- **Team 作为 owner**：适用于跨多个 Project 的联合故障响应、平台建设、合规整改、架构演进等工作；不必人为选择一个 Project 作为唯一主方。
- **多个 Project 共同参与不等于共同拥有**：参与方可以在授权范围内查看上下文、提交证据、执行 Task、提出结论和接受交接，但不会因此自动获得改变 owner、关闭 Work Thread 或发布跨边界知识的权限。

#### Owner 与 Participant 的职责边界

| 角色 | 主要职责/能力 | 不自动获得的能力 |
|---|---|---|
| **Canonical Owner** | 负责整体目标、默认状态、生命周期、交接、版本发布、冲突升级和最终关闭 | 不得绕过其他资源自身的 ACL、审批和高风险操作策略 |
| **Participant Project / Team** | 在授权范围内查看上下文、添加证据、执行 Task、提出结论、参与交接和审批 | 不自动拥有整体目标修改权、所有权转移权或关闭权 |
| **Referenced / Affected Project** | 作为引用对象、资源提供方或受影响方进入工作关系 | 不因被引用或受影响而获得 Work Thread 访问或修改权 |

该模型的核心边界是：

```text
参与 ≠ 所有
可见 ≠ 可修改
被影响 ≠ 负责
多方审批 ≠ 多重 owner
```

如果需要多方共同决策，可以由 owner 配置 required participants / approvals；这表达“单一规范归属 + 多方协作与审批”，而不是建立多个 owner。


### 10. Owner、Active Executor、Participant 与工作状态分别建模（已确认）

Work Thread 不把所有关系压缩为一个 `assignee` 或 `status` 字段，而分别建模：

```text
Work Thread
├── canonical_owner_scope / 规范归属与整体责任边界
├── active_executor / 当前正在推进工作的成员、Agent 或 Harness
├── participants / 参与协作的成员、Team、Project 或 Agent
├── responsibility_state / 当前责任与交接状态
└── work_status / 工作本身的推进状态
```

已确认规则：

- **Canonical Owner** 负责 Work Thread 的整体归属、目标、生命周期、交接治理和最终关闭；
- **Active Executor** 表示当前实际推进工作的成员、Agent 或 Harness，可以随执行变化而变化；
- **Participant** 表示在授权范围内参与、提供证据、执行 Task 或协作的主体，不因参与自动成为 owner；
- **Work Status** 表示工作处于什么阶段，例如 active、paused、blocked 或 completed；它不表示当前由谁执行；
- **认领不改变 owner**：成员、Agent 或 Harness 认领工作，只改变当前执行关系或 active executor，不改变 canonical owner；
- **责任转移必须显式交接**：不能因为 Session 结束、Harness 切换、成员打开 Work Thread 或开始执行，就推断责任已经转移；
- **新执行者必须确认接手**：在接手确认前，交接处于待确认状态，原责任和新执行者的关系都必须可审计；
- **交接确认不必然改变 canonical owner**：接手可以只是执行责任转移；只有经过单独的 owner 转移流程，规范归属才会改变。

```text
认领 / 开始执行
  → active_executor 变化
  ≠ canonical owner 变化

显式发起交接
  → handoff_pending
  → 新执行者确认
  → execution responsibility transferred
  ≠ owner 自动转移

owner 转移
  → 另一个受控流程
  → 记录审批、权限变化和生效版本
```

这个模型用于避免以下错误推断：

```text
Claude Code 退出 ≠ Work Thread 无人负责
成员 B 开始查看 ≠ owner 已转移
Harness 切换 ≠ 权限自动扩大
Work Thread blocked ≠ 没有 owner
```

### 11. Work Thread 采用三组正交状态与动作级权限（已确认）

Work Thread 的生命周期、责任交接和恢复版本不使用一个 `status` 字段混合表达，而采用三组正交状态：

```text
Work Thread
├── work_status / 工作生命周期
├── responsibility_state / 责任与交接
└── recovery_version_state / 恢复能力与版本
```

#### 1. 工作生命周期状态

```text
candidate → active → paused / blocked → active
                         ├→ completed
                         ├→ cancelled
                         └→ archived
```

- `candidate`：自动识别出的候选工作，尚未正式转正；
- `active`：正在推进或持续产生有效工作事件；
- `paused`：暂时不推进，但未来预计继续；
- `blocked`：有明确阻塞条件，具备继续意愿但暂时无法推进；
- `completed`：目标、必要交付物和验证条件完成；
- `cancelled`：明确停止，但保留证据和历史；
- `archived`：不再作为当前工作使用，但仍可查询、审计、恢复或派生。

`paused` 不等于 `blocked`；`completed` 不等于 `archived`；`cancelled` 不等于删除。Session 结束、Harness 失败或单次 Run 成功，都不能单独决定 Work Thread 的终态。

#### 2. 责任与交接状态

```text
unassigned → claimed → accepted
                  └→ handoff_pending → accepted / rejected / returned
orphaned → reassigned / handoff_pending
```

该状态独立表示当前执行责任，不改变 canonical owner：

- `unassigned`：暂无 active executor；
- `claimed`：已有执行者认领或开始推进；
- `handoff_pending`：已发起交接，等待新执行者确认；
- `accepted`：新执行者已确认接手；
- `orphaned`：原执行者失联、失效或 Connector 断开，但 Work Thread 仍然存在；
- `rejected / returned`：新执行者拒绝或退回交接，需要重新分配或补充信息。

#### 3. 恢复与版本状态

Work Thread 还需独立记录：

- 当前 `Context Manifest` 和 `Continuation Package` 版本；
- 最近的 `Checkpoint` / `Run Context Snapshot`；
- L1 语义续办、L2 操作续办、L3 环境续办的可用性；
- 当前版本是否过期、是否需要重新解析、是否存在冲突或恢复缺口。

#### 4. 权限采用动作级授权

权限不只判断“能否查看 Work Thread”，还分别控制：

- `view`：查看授权范围内的工作状态和上下文；
- `claim`：认领或开始执行；
- `evidence.append`：添加证据和执行结果；
- `checkpoint.create`：创建检查点；
- `handoff.request / accept / reject`：发起、确认或退回交接；
- `status.propose / change`：提出或变更工作状态；
- `owner.transfer`：转移规范 owner；
- `complete / cancel / archive`：完成、取消或归档工作；
- `context.resolve`：解析和获取续办包；
- `share / publish`：跨边界共享或发布知识资产。

不同角色的默认边界为：

- Participant / Active Executor 可以在授权范围内认领、添加证据、创建 Checkpoint、提出状态变更和发起交接；
- 新执行者可以确认接手，但不能仅凭接手自动成为 canonical owner；
- Canonical Owner 负责整体生命周期、交接治理、关闭和 owner 转移；
- 高风险状态、跨 Project 共享、权限变化和生产副作用仍受策略与审批约束；
- 治理 Agent 可以识别、建议和提醒，但不能代表人确认接手、绕过审批或擅自改变 owner。

核心原则：

```text
工作状态 ≠ 当前执行者
当前执行者 ≠ canonical owner
认领 ≠ 责任转移
责任转移 ≠ owner 转移
Session 结束 ≠ Work Thread 结束
Harness 失败 ≠ Work Thread 失败
取消 ≠ 删除
完成 ≠ 归档
```


### 12. 交接必须经接手者明确确认后才生效（已确认）

交接不是发送通知、修改负责人字段或接手者打开续办包就自动完成。采用以下责任转移规则：

```text
当前责任执行者
  → 发起 Handoff
  → handoff_pending
  → 接手者查看续办包并明确确认
  → handoff_accepted
  → execution responsibility transferred
```

确认前：

- 原执行者的责任不会被静默视为已解除；
- 新执行者尚未承担当前执行责任；
- `canonical owner` 仍然承担整体 Work Thread 的治理责任；
- 系统不得因为通知已发送、续办包已被查看、Session 已结束或 Harness 已切换，就推断交接完成。

确认后：

- 新执行者成为当前 `active_executor` 或责任执行者；
- 原执行者记录为 previous executor；
- 交接版本、Context Snapshot、续办包、权限检查和确认时间进入审计记录；
- 交接确认只转移执行责任，不自动改变 `canonical owner`。

#### Handoff 生命周期

普通低风险交接可以采用：

```text
handoff_requested → handoff_pending → handoff_accepted
```

复杂或高风险交接可以增加准备阶段：

```text
handoff_requested → handoff_ready → permission_checked
                   → handoff_pending → handoff_accepted
```

接手者可以：

- **接受**：确认已获得足够的续办信息，并愿意在当前授权范围内继续；
- **拒绝**：没有权限、能力、资源或职责不匹配；回到待分配或重新选择接手者；
- **退回**：愿意接手，但续办包、权限、环境或风险信息不完整；补充后重新提交；
- **超时未响应**：仅触发提醒或升级，不自动视为接受或拒绝。

#### 触发与发起

正式 Handoff 可以由当前 Active Executor、Canonical Owner 或有权限的 Participant 发起。治理 Agent 和系统可以根据失联、阻塞、超时或风险提出 Handoff Candidate、提醒或升级，但默认不能替人确认接手或擅自改变责任归属；只有 Team 预先配置明确的自动接管规则时，才可按规则执行。

Harness 切换但人员责任不变时，记录为 `executor_runtime_changed` 或恢复事件，不自动创建人员责任交接。成员、Agent 或 Harness 之间确实发生责任变化时，才建立正式 Handoff。

接手确认至少应绑定：

- `handoff_id`、来源与目标执行者、发起原因和时间；
- `continuation_package_version`、`context_snapshot_id`；
- 已完成、待完成、风险、禁令和已知缺口；
- 权限检查结果、接手者、确认时间和确认说明；
- 拒绝、退回、超时、升级及后续重新提交记录。

核心边界：

```text
发送通知 ≠ 已交接
被指定 ≠ 已接手
查看续办包 ≠ 已接受责任
确认接手 ≠ 成为 canonical owner
Harness 切换 ≠ 人员责任转移
```


### 13. Owner 转移采用受控 Transfer，责任与资源权限分离（已确认）

Work Thread 的 owner 转移不是普通字段编辑，而是一个可审计、版本化的 `Transfer` 流程：

```text
发起 Transfer
  → 权限与资源影响预检
  → 生成权限差异和不可访问资源报告
  → 新 Owner 明确确认
  → 必要时完成 Team / 安全 / 合规审批
  → 发布新的 owner revision
  → 重新生成 Context Manifest 并通知参与者
```

#### 普通、高风险与紧急转移

- **普通转移**：原 Owner 或有权限主体发起，系统完成预检，新 Owner 确认后生效；
- **高风险转移**：涉及敏感数据、生产操作、权限边界、跨 Team 或跨 Project 时，按策略增加相关 Team、安全或合规审批；
- **紧急接管**：原 Owner 失联、不可用或发生事故时，Team 管理者、值班负责人或授权治理主体可以发起强制接管，但必须记录原因、授权人、风险、临时权限和后续补审要求。

#### 责任转移与资源权限转移分离

Owner 转移只改变 Work Thread 的规范责任边界，不自动授予新 Owner 访问底层资源的权限：

```text
可见资源
= Work Thread 授权
  ∩ 资源 ACL
  ∩ 新 Owner Scope 权限
  ∩ 敏感数据策略
  ∩ 当前凭据能力
```

因此：

- 原始对话、工具结果、日志、代码仓库、数据库结果等仍按各自 ACL 和敏感策略检查；
- 数据库凭据、外部系统登录态和生产权限绝不因 Work Thread 转移自动复制；
- 新 Owner 看不到的资源不会被静默转移；平台必须明确展示恢复缺口；
- L1/L2 可按新授权重新解析，Team L3 不随 Work Thread 自动转移；
- Wiki、Skill、RCA、Template 等跨空间复用仍需经过脱敏、审核和发布流程。

#### Transfer 的审计与并发要求

每次 Transfer 至少记录：

- `transfer_id`、原 owner、新 owner、发起者、审批者和确认者；
- 发起、批准、接受和生效时间；
- 权限差异、不可访问资源和风险评估；
- 生效前后的 owner revision、Context Manifest revision 和快照；
- 转移原因、适用策略、紧急接管标记和后续补审事项。

Transfer 应具备幂等和并发控制：同一 `transfer_id` 重试不能重复转移；并发的两个 owner 转移只能有一个基于当前版本成功发布，另一个必须失败或重新基于最新版本发起。

关键不变量：

```text
Owner 转移 ≠ 资源权限自动转移
Owner 转移 ≠ 历史证据复制
Owner 转移 ≠ Team L3 自动升级
Owner 转移 ≠ 当前 Run Prompt 热更新
Owner 转移 = 责任版本变化 + 权限重新评估 + 上下文重新解析
```

### 14. Continuation Package 采用规范状态与接手者投影（已确认）

`Continuation Package / 续办包` 不是聊天记录导出、固定 Prompt 或 Harness 私有 Session 备份，而是从规范化工作状态和原始证据派生出的、版本化且按接手者权限与能力投影的交接产物。

```text
Canonical Work State + 原始证据
        ↓ 权限过滤 + 接手者能力适配
Continuation Package Projection
```

#### 最小必需内容

续办包至少应包含：

- 工作身份、目标与范围；
- canonical owner、当前 active executor、工作状态和交接状态；
- 已完成事项、待完成事项和推荐下一步；
- 已确认事实、假设、未知项、决策及依据；
- 关键证据、工件、失败尝试和排除路径；
- 风险、禁止动作、敏感级别、审批状态和当前授权；
- L1/L2/L3 恢复能力、环境缺口和不可访问资源；
- 版本、来源、生成时间、已知缺口和后续变化提示。

底层内容应区分 `confirmed_fact`、`inference`、`hypothesis`、`decision`、`failed_attempt`、`pending_action`、`constraint` 和 `unknown`，避免把推测误当成事实。

#### 生成与刷新时机

在以下场景生成或刷新续办包：

- 显式交接、暂停、Checkpoint 或阶段完成；
- Harness Session 中断、Harness 切换、执行者失联；
- 重要工具结果、代码 revision、测试/构建/部署、审批或风险变化；
- Work Thread 阻塞、恢复或责任变化；
- 新成员或 Harness 发起接手请求时，按最新工作版本即时生成/刷新对应投影。

#### 接手者投影

同一规范工作状态可投影为不同视图：

- Member View：交接摘要、风险、待办和关键证据；
- Development Harness View：目标、约束、代码上下文、revision/diff、命令结果和下一步操作；
- Operations Harness View：事件、指标、日志、系统对象、Runbook、审批和禁令；
- Governance Agent View：来源、置信度、冲突、过期情况和知识候选；
- Security / Approver View：影响范围、敏感数据、权限变化和审批状态。

投影必须先经过接手者身份、资源 ACL、敏感数据策略和当前凭据能力过滤，不能因“交接”绕过授权。

#### 版本与边界

- 旧续办包保持不可变，新续办包基于工作状态版本生成；
- 包版本、父版本、Context Manifest、来源事件游标和生成记录必须可追溯；
- 默认提供简明摘要，证据、差异、失败尝试和环境细节按需展开；
- 续办包是可重建的派生物，不替代 L0 原始证据；
- 不承诺恢复任意 Harness 的私有推理、登录态、凭据、活跃进程或不可访问资源；
- 未纳入包的最新事件、恢复缺口和未验证内容必须明确提示。

### 15. V1 采用 L1 必须保证、L2 可验证、L3 能力声明与有限重连（已确认）

本节的 L1/L2/L3 是**现场恢复等级**，不是议题二的记忆分层：

```text
现场恢复：L1 语义续办 → L2 操作续办 → L3 环境续办
记忆分层：L0 Conversation → L1 Atom → L2 Scenario → L3 Team Long-Term Memory
```

#### L1：平台必须保证的语义续办

V1 必须让受支持的成员或 Harness 在不依赖原执行者补充说明的情况下，理解并继续推进工作。至少包括：

- Work Thread 身份、目标和范围；
- 工作状态、canonical owner、active executor 和交接状态；
- 已完成、待完成、失败尝试和排除路径；
- 已确认事实、假设、未知项、决策及依据；
- 关键证据引用、风险、禁令和审批状态；
- 推荐下一步、Context Manifest 版本和已知缺口。

L1 不承诺恢复原 Prompt、模型私有推理、Harness 私有 Session、登录态或凭据。

**L1 验收：**接手者可以复述目标和范围，区分事实/假设/未知，说出已完成和待完成事项，找到关键证据，识别风险和禁令，并在权限允许时执行一个低风险下一步。

#### L2：关键操作材料可引用、可重新获取、可验证

V1 重点支持：

- 代码仓库、分支、revision、commit 和 diff；
- 文档、文件、脚本、报告和其他关键工件；
- 日志、指标、查询结果、测试/构建/部署结果；
- 工单、审批单、发布单和外部系统对象引用。

L2 记录对象位置、revision、读取时间、来源、当前可访问性和是否需要重新获取，不承诺复制完整本地操作环境。

**L2 验收：**接手者可以定位关键对象，确认版本，重新获取并验证材料，在权限允许时继续一个实际操作；无法获取的对象和原因必须明确展示。

#### L3：Connector 驱动的能力声明与有限重连

V1 对 L3 支持：

- 环境、工作目录、容器、Job、终端、浏览器或外部资源的标识和状态检查；
- Connector 能力声明；
- 在环境仍存在且授权允许时的重连入口；
- 明确返回 `restored`、`reconnected`、`partially_available`、`unavailable`、`unsupported`、`expired` 或 `permission_denied` 等结果。

V1 不承诺任意 Harness 私有进程迁移、登录态和凭据复制、任意终端/浏览器内部状态恢复、跨环境迁移模型上下文，或恢复已经不存在的容器和 Job。

#### 恢复能力矩阵与验收边界

Work Thread 应记录按能力拆分的恢复矩阵，而不是仅设置一个“已恢复”字段：

```text
semantic_continuation: platform-guaranteed
code_context / artifact_fetch: connector-supported
terminal_reconnect / container_resume: environment-dependent
browser_resume: connector-dependent or unsupported
database_reconnect: permission-dependent
```

恢复结果至少区分 `not_attempted`、`partially_restored`、`restored` 和 `restored_with_gaps`。恢复成功应结合接手任务的最低要求和接手者确认判断，而不是仅凭续办包生成自动宣布成功。

关键边界：

```text
L1 不可用 → 不得宣称可安全续办
L2 缺失 → 必须指导重新获取或明确降级
L3 不可用 → 可在 L1/L2 支持下重建环境，但不能伪装已恢复
有引用 ≠ 有读取权限
有连接引用 ≠ 有凭据
```

每次恢复必须记录发起者、时间、Package/Manifest 版本、成功和失败对象、失败原因、当时权限以及接手确认。

### 16. 并行工作采用证据追加、提案/分支隔离与显式合并（已确认）

平台支持多人、多 Agent、多 Harness 并行推进，但不允许无来源地并行覆盖主工作现场。

```text
Evidence Ledger
+ Canonical State
+ Proposal / Hypothesis
+ Work Branch / 派生 Work Thread
+ Explicit Merge
+ Conflict Record
```

#### 并行内容的默认处理

- **原始证据**：日志、工具结果、代码 revision、测试结果和人工确认采用追加式记录，不覆盖既有证据；
- **观察和低风险进度**：可追加或按规则自动合并，但必须保留来源、时间和执行者；
- **假设、方案和根因判断**：先作为 Candidate / Proposal，不能直接成为主结论；
- **重要工作状态**：基于 `base_revision` 进行版本化提案，旧版本写入不得静默覆盖新版；
- **互斥方向**：通过 Work Branch 或派生 Work Thread 隔离，并记录父工作、基线版本、分支目标、范围和执行者；
- **代码、文档和高影响变更**：采用 Branch + Review + Merge；
- **Owner、权限和责任**：走受控流程，不允许普通并行写入；
- **生产或其他高风险副作用**：必须经过 RunGate、审批和互斥控制，分析并行不等于副作用并行执行。

#### 合并与冲突

合并必须显式、可审计并记录：

- `merge_id`、来源分支、目标 Work Thread、基线 revision；
- 采纳、拒绝、冲突和失效的变更；
- 验证者、审批者、合并时间和生成的新 revision；
- 参与合并的 L0/L1 证据、Context Manifest 和权限检查结果。

事实冲突不能由最后写入者解决；应保留双方来源，结合时间、环境、Project、revision 和证据判断，无法判断时标记 `disputed`。目标冲突可能意味着应拆分为多个 Work Thread。未验证分支不能自动升级为 Team L3 或正式知识资产。

#### 并发不变量

```text
Evidence 只追加，不覆盖
主状态不接受无版本写入
旧 revision 写入不能静默覆盖新版
分支不能自动改变 owner
分支不能绕过 ACL
冲突不能由最后写入者解决
未验证分支不能自动升级为 Team L3
高风险操作必须互斥并审批
```

### 17. 交接与恢复采用权限交集、按执行者投影和安全降级（已确认）

交接只转移工作责任，不自动转移底层资源权限。每次恢复和续办包生成都必须基于当前接手者身份重新解析：

```text
接手请求
  → 验证主体身份
  → 检查 Work Thread 关系与授权
  → 重新计算资源 ACL
  → 检查 Connector 能力与凭据 scope
  → 对证据过滤、脱敏或拒绝
  → 检查审批有效性
  → 生成接手者专属 Continuation Package
  → 允许低风险继续，高风险进入 RunGate / 审批
```

#### 有效权限采用交集

```text
Effective Access
= Principal Identity
  ∩ Work Thread Grant
  ∩ Owner / Participant Relation
  ∩ Resource ACL
  ∩ Connector Capability
  ∩ Credential Scope
  ∩ Inherited Policy
  ∩ Action Policy
  ∩ Delegation
```

不能因为原执行者曾经能看或能做，就把权限并集授予新执行者：

```text
A 原来能看 + B 现在能看 ≠ B 自动拥有 A 的全部权限
```

#### 内容访问结果

对每个续办包内容或证据对象分别判断：

- `allowed`：当前主体可以查看或使用；
- `redacted`：允许知道存在或查看脱敏内容，但敏感字段被隐藏；
- `denied`：当前主体不能访问，且不得通过错误信息反向泄露敏感内容。

权限至少区分：

```text
Work Thread / Context View
Evidence Read
Tool Execute
Production Change
Approval
Owner Transfer
Knowledge Publish
```

查看 Work Thread 不等于查看全部证据；读取资源不等于执行工具；执行工具不等于拥有生产变更权限。

#### 凭据、敏感信息与审批

凭据、Token、Cookie、私钥、登录态和秘密不得进入 Continuation Package 正文，只能记录受 ACL 保护的 `credential_ref`、所需 capability、scope 和重新连接方式。

审批至少区分上下文查看、工具调用和生产副作用三类。执行者变化、上下文版本变化、目标/资源/操作变化或审批过期时，高风险审批默认不自动继承，必须重新确认。低风险、只读且目标不变的审批是否延续，按 Team 策略判断。

#### 安全降级与治理 Agent 边界

权限或环境不完整时，允许按以下路径降级：

```text
完整恢复
  → 语义恢复 + 操作材料部分恢复
  → 语义恢复 + 脱敏摘要
  → 仅工作元数据
  → 拒绝访问
```

治理 Agent 可以识别敏感内容、建议脱敏、检查权限、发现审批过期和生成差异报告，但默认不能代表接手者确认责任、授予权限、解密秘密或绕过审批。

每次交接和恢复必须记录请求主体、时间、查看/脱敏/拒绝的对象、策略与版本、Context Manifest、审批状态和执行结果。

### 18. 采用阶段、Checkpoint、Revision、Manifest、Run Snapshot 与续办包的六层模型（已确认）

Work Thread 的工作阶段、恢复记录、版本、发布上下文和接手投影分别建模：

```text
Work Phase
  → 组织工作阶段和触发整理
Checkpoint
  → 记录某个时间点的可恢复状态
Work Thread Revision
  → 记录规范工作状态的版本演进
Context Manifest
  → 发布当前允许使用的上下文集合
Run Context Snapshot
  → 记录某次 Run 实际使用的不可变上下文
Continuation Package
  → 面向具体接手者的权限过滤和能力投影
```

#### 各层职责

- **Work Phase**：组织相对明确的阶段目标，触发阶段整理、交接、复盘和知识提炼；阶段完成不等于 Work Thread 完成；
- **Checkpoint**：记录某个时间点的状态、阶段、证据游标、已完成/待完成事项、执行者、风险和阻塞；不自动承诺环境可恢复，也不等于长期记忆；
- **Work Thread Revision**：记录规范工作状态的版本演进；旧版本不可变，可审计、回溯、分支和作为合并基线；
- **Context Manifest**：经过规则、权限和发布检查后，对外提供当前允许使用的上下文集合；必须原子发布；
- **Run Context Snapshot**：某次 Harness Run 或 Prompt 构建实际解析并使用的上下文快照；不可被新版本静默改写；
- **Continuation Package**：基于最新可用 Revision、Manifest、接手者身份和 Harness 能力生成的续办投影，可重建且不替代 L0 原始证据。

#### 版本与恢复不变量

```text
Phase 完成 ≠ Work Thread 完成
Checkpoint ≠ 长期记忆
Checkpoint ≠ Run Context Snapshot
Run Snapshot 不被静默改写
旧 Revision 不被覆盖
Manifest 原子发布
Continuation Package 可重建
历史版本仍受当前 ACL
```

每次重要写入应带 `base_revision`；基于过期 Revision 的写入不能静默进入主状态，必须转为 Merge Candidate 或重新基于最新版本生成。审计链必须能够回答：某次 Run 使用哪个 Snapshot、Snapshot 来自哪个 Manifest、Manifest 基于哪个 Work Thread Revision、Revision 由哪些证据产生、接手者看到哪个续办包版本。

### 19. Connector 采用 V1 最小接入协议，其他能力后续扩展（已确认）

本子问题只确认 **Connector 协议 V1 的最小范围**，不要求所有 Harness 在 V1 支持任意环境恢复。Connector 是外部 Harness 与 Memory Platform 之间的适配边界，不是 Work Thread、Canonical State 或权限真源。

```text
Connector Contract V1
├── Handshake / 协议版本与身份
├── Event Append / 工作事件追加
├── Idempotency + Cursor / 幂等、补发与游标
├── Capability Declaration / 能力声明
├── Resource Reference / 外部资源引用
├── Health / Lease / 健康状态与连接租约
├── Probe / 能力与资源探测
└── Structured Result / 结构化结果与失败告知
```

#### V1 必须支持的最小能力

1. **Handshake**：协商协议版本，声明 Connector、Harness 和实例身份；
2. **Event Append**：追加工作事件，使平台能够接收 L0 过程证据；
3. **幂等与补发**：事件具备唯一标识，支持去重、cursor、重连后的补发，并能标记乱序或缺口；
4. **Capability Declaration**：按能力声明支持、暂不支持或条件支持的范围，不使用单一 `supports_resume` 布尔值；
5. **Resource Reference**：提供代码、文件、日志、工件和外部对象的定位、版本、哈希、来源、访问要求和有效期等信息；
6. **Health / Lease**：报告连接、实例、租约和能力有效性，支持断连、撤销和失效通知；
7. **Probe**：在实际恢复或获取前检查能力、资源存在性、版本、授权和前置条件；
8. **Structured Result**：按能力、资源和恢复阶段返回可验证的结果、失败原因、影响、是否可重试和安全替代路径。

#### V1 的能力与结果边界

能力声明、当前可用性、当前主体授权和本次操作结果必须分开记录：

```text
Connector 声明支持 ≠ 当前实例可用
当前实例可用 ≠ 当前接手者有权使用
有资源引用 ≠ 当前可以读取
连接建立 ≠ 环境已经恢复
部分成功 ≠ 全局恢复成功
```

恢复结果至少应能区分：

```text
not_attempted
restored
restored_with_gaps
partially_restored
unavailable
unsupported
expired
permission_denied
```

结果不得只返回一个不透明的“恢复成功/失败”。L1、L2、L3 以及具体资源的结果应能分别追溯到本次恢复请求、使用的 Package / Manifest 版本、Connector 能力、当前授权、探测结果和验证证据。

V1 的最低承诺是：平台能够接收可追溯的工作过程证据，知道 Connector 声称支持什么，知道本次探测或恢复实际发生了什么，并在失败或降级时明确告诉接手者影响和下一步。V1 不强制终端、容器、浏览器、Job、数据库等环境恢复能力；这些属于可选 Connector 能力，后续按具体场景扩展。

#### 暂缓记录（不纳入本次 V1 最小协议确认）

以下问题保留为后续协议设计或 Connector 具体能力讨论，不影响本次 V1 基线：

- MCP、A2A 或其他协议与平台 Connector Contract 的适配关系；
- 事件完整性、乱序、游标补偿和长期离线缓存的详细实现；
- 各类环境的恢复动作、幂等语义和副作用隔离；
- Connector 能力认证、版本兼容和兼容性测试矩阵；
- 资源引用的复制、缓存、过期、撤销和跨区域访问策略；
- 详细错误码、重试退避、自动降级和用户界面文案；
- 端到端恢复质量指标和验收阈值，转入子问题 14 讨论。

关键不变量：

```text
Connector 是适配边界，不是工作真源
V1 先保证可追溯接入和诚实告知，不假设环境可迁移
未知 ≠ 成功
未探测 ≠ 可用
恢复失败必须可解释、可审计、可降级
```

### 20. 现场恢复采用分层验证、任务级判定与接手确认（已确认）

“现场已恢复”不等于续办包已生成、上下文已加载或 Connector 已重连，而是针对指定的 Work Thread、接手请求、接手者和最低任务要求，完成必要的上下文解析与权限检查，所需的恢复层级和材料通过验证，缺口与风险已明确告知，并由接手者确认可以在当前授权范围内安全继续。

恢复应分别记录：

```text
Recovery Action
  → Context Loaded
  → Context Understood
  → Required Materials Available
  → Safe Next Step Verified
  → Handoff Accepted
```

#### 分层恢复与任务级验收

- **L1 语义续办**：目标、范围、当前状态、owner、executor、事实/假设/未知、证据、风险、禁令和下一步可理解；
- **L2 操作续办**：关键代码、文档、文件、日志、工件或外部对象可定位、可重新获取，并能校验版本或内容；
- **L3 环境续办**：环境、实例、租约、能力、授权和重连/恢复结果可检查、可验证；不要求所有环境都恢复。

最终判定采用：

```text
平台恢复层结果
  + 本次接手任务的最低要求
  → 任务级恢复结论
```

因此，同一 Work Thread 对不同接手者或接手任务可以得出不同结论。恢复结果至少区分 `restored`、`restored_with_gaps`、`partially_restored`、`not_restored`、`blocked`、`expired` 和 `permission_denied`。V1 暂不要求统一综合质量分数，但必须记录分层状态、关键证据、缺口、验证时效和最低安全下一步。

#### 验证与审计要求

- 恢复动作完成不等于现场已恢复；
- 上下文加载不等于接手者理解；
- 可通过结构化目标复述、事实/假设/未知分类、风险识别、版本确认和低风险行为验证外部可观察结果，但不要求暴露模型私有推理；
- 最低安全下一步必须在当前授权范围内、可逆或低副作用，并能验证关键上下文；
- 每次恢复必须记录请求主体、时间、Work Thread Revision、Context Manifest、Continuation Package、Run Snapshot（如有）、各层结果、缺口、验证证据和接手确认；
- 曾经验证不等于当前有效，验证结果必须带 `verified_at` 和有效期或失效条件；
- 目标、权限、审批、关键 revision、风险或恢复能力发生高风险变化时，必须重新解析、重新验证或重新确认。

### 21. 接手确认区分上下文确认与责任确认（已确认）

接手流程将以下两个动作分开建模：

```text
Context Acknowledgement / 上下文确认
  → 已查看并确认了解当前上下文
  → 不转移执行责任

Handoff Acceptance / 接手确认
  → 明确承担当前执行责任
  → handoff_pending → handoff_accepted
```

被指定、收到通知、打开 Work Thread、查看 Continuation Package、启动 Harness 或 Connector 重连成功，都不能单独视为接手确认。

#### 接手确认的最小绑定信息

有效的 Handoff Acceptance 至少绑定：

- 接手者身份和 Executor 类型；
- `work_thread_id`、`handoff_id`；
- `work_thread_revision`；
- `context_manifest_id`；
- `continuation_package_version`；
- 已启动 Run 时的 `run_context_snapshot_id`；
- 当前权限与能力快照；
- 恢复状态、已知缺口、风险和禁令；
- 最低安全下一步及其要求；
- 确认方式和确认时间。

接手者确认的是某个版本的现场，不是对 Work Thread 的永久授权。

#### 确认结果

```text
acknowledged
accepted
accepted_with_gaps
returned
rejected
expired
invalidated
```

- `acknowledged`：已查看上下文，但未承担责任；
- `accepted`：满足本次最低要求并明确接手；
- `accepted_with_gaps`：明确知道缺口，确认仍可在限制下继续；缺口必须结构化记录，并标明是否阻断最低安全下一步；
- `returned`：愿意接手，但要求补充信息、权限或环境；
- `rejected`：不具备责任、权限或能力，或不愿接手；
- `expired`：确认超过有效期；
- `invalidated`：因高风险上下文、权限、目标、审批、版本或恢复能力变化而失效。

确认可以采用“关键摘要确认 + 按接手任务选择最低安全验证动作”的方式。人员、开发 Harness、运维 Harness 和治理 Agent 的确认内容可以不同，但都不得越过当前 ACL、审批和 Connector 能力边界。

以下边界保持不变：

```text
查看 ≠ 理解
理解 ≠ 接手
接手 ≠ canonical owner 转移
接手 ≠ 生产审批
接手 ≠ 永久授权
超时 / 沉默 ≠ 接受
Connector 重连 ≠ 接手确认
```

治理 Agent 默认只能提醒、补充检查和升级，不能代替接手者确认责任，也不能将 Handoff Acceptance 当作 owner transfer、Tool Approval 或 Production Approval。

### 22. L1 / L2 / L3 采用分层验收与任务级判定（已确认）

现场恢复的三层是能力层，不是质量分数，也不是所有工作都必须从 L1 升到 L3。恢复判定采用：

```text
L1 语义恢复
L2 操作材料恢复
L3 环境恢复
        ↓
当前接手任务的最低要求
        ↓
任务级恢复结论
```

#### 分层通过条件

- **L1 通过**：目标与范围正确，当前状态来自有效 Revision，责任关系明确，事实/假设/未知/争议已区分，进度与失败路径完整，关键证据可定位，风险/禁令/审批状态明确，下一步及其前置条件明确；
- **L2 通过**：任务声明的关键代码、文档、文件、日志、工件或外部对象可以定位、读取或重新获取，版本/revision/hash 可确认，当前主体有权限，材料与工作状态的关系可追溯，并完成内容或版本验证；
- **L3 通过**：任务要求的环境对象存在，Connector 能力可用，当前授权有效，租约/实例状态有效，连接或恢复后目标身份匹配，环境状态通过检查，且没有绕过审批或凭据边界。

L1 是所有安全续办的硬基线。L2、L3 是否必须通过，由当前接手任务、Work Phase、Executor 类型和风险等级决定。Connector 只提供事件、资源和探测事实，平台负责结合任务要求作最终判定。

#### 缺口与任务级结果

缺口分为 `blocking_gap`、`non_blocking_gap` 和 `unknown_gap`。关键缺口阻断当前任务，非关键缺口形成明确 gap；未知不能静默当作成功或失败。

```text
restored
  L1 通过，任务所需层级均通过，关键验证仍有效

restored_with_gaps
  最低任务要求已满足，但存在已披露的非阻断缺口

partially_restored
  部分层级或对象已恢复，但尚不能确认最低要求全部满足

not_restored
  L1 或最低任务要求未满足，当前不能安全继续

blocked
  等待权限、审批、人工输入或外部条件
  可与 partially_restored / not_restored 组合
```

每层和每项关键资源都必须记录验证证据、`verified_at`、有效期或失效条件、缺口及是否阻断。不同 Work Phase 可以声明不同最低要求，例如调查阶段通常需要 L1 与关键证据，开发阶段通常需要 L1/L2，发布阶段可能还需要 L3、有效审批和 RunGate。

核心不变量：

```text
L1 是安全续办硬基线
L2/L3 按任务要求决定是否必须
资源可定位 ≠ L2 通过
连接成功 ≠ L3 通过
曾经验证 ≠ 当前有效
关键缺口阻断，非关键缺口形成 gap
Connector 提供事实，平台负责任务级判定
```

### 23. 最低安全下一步采用最小可验证动作（已确认）

`Minimum Safe Next Action / 最低安全下一步` 定义为：与当前接手任务相关、在当前授权范围内、低副作用、可逆或可控、结果可观察并能写回证据链的最小动作。它不是统一固定动作，也不是默认执行任意下一步。

每个接手请求或 Work Phase 应尽可能声明：

```text
required_capabilities
required_evidence
minimum_safe_action
verification_target
risk_class
```

#### 动作准入条件

候选动作必须同时满足：

```text
Relevance / 与当前任务相关
Authorization / 当前主体有权执行
Risk / 风险可接受
Reversibility / 可逆或可控
Observability / 结果可观察
Evidence Link / 结果可关联到证据链
```

动作风险至少分为：

```text
R0：无副作用观察
R1：低风险、可逆验证
R2：可能影响资源或执行环境
R3：生产、高影响、不可逆或跨边界操作
```

默认最低安全下一步只能从 R0/R1 中选择。R2/R3 必须额外确认、资源限制、审批或 RunGate，不能因为“恢复验证”而绕过既有操作策略。风险按实际目标、参数、资源和副作用判断，不能仅按动作名称或 HTTP 方法判断。

#### 按执行者与阶段选择动作

最低动作由 Executor 类型、Work Phase 和接手任务共同决定，例如：

- 成员：确认目标、状态、风险和缺口，必要时打开一个关键证据；
- 开发 Harness：读取并校验指定 repository、branch、revision 或 diff；
- 运维 Harness：核对目标环境身份，读取限定范围的只读指标、日志或事件；
- 治理 Agent：核对关键证据的来源、版本、权限和事实分类。

不要求所有接手者运行测试、连接环境或执行工具；但如果当前任务依赖某项材料或能力，就必须选择足以验证该关键前提的动作。Agent 可以提出替代动作，但不能单方面降低任务要求或扩大权限。

#### 执行、验证与失败处理

动作的执行与验证分开记录：

```text
executed ≠ verified
verified ≠ task completed
```

动作结果至少应关联 `action_id`、Work Thread、Executor、资源、输入版本、开始/结束时间、执行结果、验证结果和 Trace。动作失败、版本不一致、权限不足、超时或结果未知时，平台必须重新计算任务级恢复结论，不得隐藏失败、使用更高权限替代或把 `unknown` 当作成功。

失败后的处理顺序为：

```text
判断是否可安全重试
  → 判断是否有验证同一关键前提的等价低风险替代
  → 重新计算任务级恢复结论
  → 必要时标记 blocked / partially_restored / not_restored
  → 通知接手者并更新续办包
```

替代路径必须不扩大权限、不隐瞒原动作失败，并明确区分：

```text
original_resume / 原环境恢复
reconnect / 重连
refetch / 重新获取
rebuild / 重建
manual_fallback / 人工替代
```

其中 `rebuild ≠ original_resume`。重建环境可以支持继续工作，但不能宣称原环境已经恢复。

关键不变量：

```text
恢复验证 ≠ 生产操作
接手确认 ≠ 工具批准
最低安全下一步 ≠ 任意下一步自动执行
executed ≠ verified
unknown ≠ 成功
重建 ≠ 原环境恢复
```

### 24. V1 采用恢复质量维度与硬护栏，不设统一总分（已确认）

V1 不设置一个容易掩盖关键缺口的统一恢复质量总分，而采用：

```text
硬护栏
  + 多维质量状态
  + 分层恢复结果
  + 可追溯质量证据
```

#### 质量维度

每次 Recovery Attempt 至少记录以下维度：

- **语义完整性**：目标、范围、状态、进度、风险、禁令和下一步是否覆盖；
- **语义准确性**：上下文是否与 Canonical State、Revision 和证据一致；
- **证据覆盖度**：关键结论是否有可访问、可验证的来源；
- **新鲜度**：上下文、资源、权限和验证结果是否仍在有效期内；
- **版本一致性**：Package、Manifest、Snapshot、Revision 和外部资源是否对应；
- **权限正确性**：接手者是否只查看和使用当前授权范围内的内容与能力；
- **能力/环境可用性**：Connector、资源、租约和环境是否满足当前任务要求；
- **缺口透明度**：失败、未知、降级和不可访问内容是否明确告知；
- **可继续性**：接手者是否能在无需原执行者补充说明的情况下安全完成最低安全下一步。

V1 各维度先采用证据状态，不强行统一数值化：

```text
verified
partially_verified
not_verified
unknown
not_applicable
```

#### 硬护栏与核心结果

以下情况不得把恢复标记为安全成功：L1 未通过，关键事实无来源，关键风险或禁令未披露，关键资源版本不一致，接手者无权却被允许继续，高风险变化后未重新确认，最低安全下一步未验证，或 `unknown` 被当作成功。

最重要的结果指标是：

> 接手者能否在无需原执行者补充说明的情况下，安全完成最低安全下一步。

因此应记录最低动作成功率、接手后首次有效动作耗时、接手后发现上下文错误的比例、因恢复缺口返工或重新交接的比例，以及 unknown、阻断性缺口和安全护栏违规情况。

#### 明确暂缓事项及原因

以下内容不纳入本轮 V1 结论，保留为后续设计问题：

| 暂缓内容 | 暂缓原因 |
|---|---|
| 统一 0–100 综合评分 | 不同任务、Work Phase 和风险等级的维度不可直接等权或统一加权；总分可能掩盖权限、版本和安全硬门槛问题，当前证据也不足以支撑伪精确评分 |
| 各 Work Phase 的具体数值阈值 | 需要真实运行样本、任务分类和风险策略校准；当前先确认原则和证据状态，不提前固化未经验证的阈值 |
| 所有质量维度的自动计算算法 | 依赖 Canonical State、证据分类、权限判定和验证数据的成熟度；算法过早固化会把暂时性启发式当成规范真相 |
| 用户最终展示文案 | 属于后续角色投影和交互设计，需要结合用户测试、权限投影和 F 分支统一确定 |
| 具体指标数据库 Schema | 属于实现和数据架构设计，当前先确认指标语义、统计单位和证据要求，避免在对象模型尚未全部稳定时过早定表 |
| 恢复证据链的对象和审计细节 | 单独进入 E 分支，需进一步讨论不可变性、版本绑定、访问审计、迟到事件、冲突和纠错，避免与质量指标混杂 |

#### 统计与治理

质量记录必须保留：

- 分母和统计单位（Recovery Attempt、Work Thread、资源动作等）；
- 统计时间范围和适用范围；
- 取消、未尝试、权限拒绝、重复重试等排除条件；
- 是否将 `restored_with_gaps` 纳入成功统计；
- Executor、Harness、Connector、Work Phase、任务类型和风险等级等切分维度。

平均成功率不能稀释高风险失败。指标异常应能触发 Connector 降级、人工确认增加、TTL 调整、Package / Manifest 策略调整或暂停自动恢复等治理动作。用户看到任务级结论，治理者和审计人员看到维度状态及证据。

核心不变量：

```text
恢复速度不能替代安全与正确性
Package 生成成功不能替代现场可继续
维度状态优先于未经验证的综合分数
平均成功率不能掩盖高风险失败
用户看到任务结论，治理者看到质量证据
```

### 25. 建立不可变的恢复证据链与审计关系（已确认）

V1 为每次恢复建立不可变、可追溯的最小证据链：

```text
L0 Evidence Reference
  → Work Thread Revision
  → Context Manifest
  → Run Context Snapshot
  → 接手者专属 Continuation Package Projection
  → Recovery Attempt
  → Minimum Safe Action
  → Verification Result
  → Handoff Acceptance
```

这是一张带版本、来源、权限和验证关系的证据图，而不是只能记录最终状态的单条日志。Manifest 表示允许使用的上下文集合，Run Snapshot 表示某次 Run 实际使用的不可变上下文，Package Projection 表示具体接手者实际看到的权限和能力投影。

#### V1 最小审计记录

至少记录以下五类关系记录：

1. **RecoveryAttempt**：恢复请求、Work Thread、Handoff、请求者、接手者、Executor 类型、Connector、所需层级、策略版本和结果；
2. **ContextBinding**：Work Thread Revision、Checkpoint、Manifest、Run Snapshot、Package 版本、Projection 标识和来源事件游标；
3. **ObjectResult**：资源引用、操作、授权结果、执行结果、验证结果、期望/实际版本、失败原因和缺口类型；
4. **MinimumActionRecord**：最低动作、风险等级、主体、目标、执行和验证状态、证据引用与 Trace；
5. **HandoffAcceptanceRecord**：接手者、Package/Manifest 版本、已知缺口和风险、最低动作、确认时间以及有效性。

#### 时间、不可变性与纠错

重要时间必须分开记录：

```text
occurred_at
observed_at
generated_at
executed_at
verified_at
accepted_at
expired_at
invalidated_at
corrected_at
```

L0 原始事件、Work Thread Revision、Checkpoint、Run Context Snapshot、Recovery Attempt、最低动作记录、验证结果和接手确认记录不可静默覆盖。Manifest、Continuation Package 和 Projection 可以重新生成，但旧版本和历史实际投影必须保留。迟到事件、版本冲突和高风险并发变化采用影响评估，必要时重新验证或使原确认失效；历史错误采用追加 `correction_record`，不删除或静默修改原记录。

#### 权限投影与审计边界

每个资源或投影内容至少记录：

```text
allowed
redacted
denied
unknown
```

并保留接手者、Executor 类型、能力画像、策略版本、可见/脱敏/拒绝项目和投影标识。审计可以证明访问事实、版本、策略、验证和失败结果，但不得通过审计记录绕过当前 ACL，复制权限外正文、凭据或秘密。

#### 明确暂缓事项及原因

以下内容留待以后讨论，不在本轮固化：

| 暂缓内容 | 暂缓原因 |
|---|---|
| 具体数据库表和字段 Schema | 属于后续数据架构与实现设计；当前先确认审计对象、关系和语义，待对象模型进一步稳定后讨论 |
| 事件存储引擎 | 属于后续技术架构选型；需要结合吞吐、保留、查询和一致性要求讨论 |
| 哈希算法 | 属于后续完整性与安全实现细节；需结合敏感数据、跨系统验证和合规要求讨论 |
| 数据保留期限 | 属于后续合规、成本和业务生命周期策略；需结合 Team、Project 和资源类型分别讨论 |
| 审计索引 | 属于后续查询性能和运营使用设计；需先明确审计场景、查询模式和数据规模 |
| 审计查询 API | 属于后续平台接口设计；需在审计对象、权限模型和使用者角色稳定后讨论 |
| 用户层最终展示方式 | 属于 F 分支的角色投影与交互讨论；留待 F 分支讨论 |

核心不变量：

```text
Package 可重建 ≠ 历史投影可改写
Manifest ≠ Run Context Snapshot
执行成功 ≠ 验证成功
审计存在 ≠ 审计者可读正文
历史记录不可静默覆盖
unknown 不得静默变成成功
```

### 26. 面向不同角色采用 Canonical Recovery Result 的受控投影（已确认）

恢复结果不为成员、Harness、治理 Agent 和审计人员建立互不一致的结果源，而是由同一 `Canonical Recovery Result` 生成不同角色投影：

```text
Canonical Recovery Result
├── Member Projection
├── Harness Projection
├── Governance Projection
└── Audit / Security Projection
```

#### 三层信息表达

面向成员采用渐进披露：

1. **任务级结论**：明确表达“可以继续”“可以继续但存在缺口”“补充后可以继续”“当前不能安全继续”“等待权限/审批/人工输入”“尚未尝试恢复”等结论；
2. **恢复解释**：展示 L1/L2/L3 状态、关键资源、阻断/非阻断缺口、unknown、最低安全下一步、验证时间和重新确认要求；
3. **证据与审计**：在当前权限允许范围内提供 Revision、Manifest、Snapshot、Package Projection、动作、验证、策略和纠错记录。

不能只用颜色或单一“成功/失败”表达。结论必须同时说明影响、缺口和下一步；权限不足、过期、Connector 不支持、资源不存在和未知结果应保持可区分，且不得通过表达投影泄露无权资源的敏感细节。

#### 角色投影边界

- **Member Projection**：优先显示能否继续、责任是否生效、已恢复内容、缺口、责任人和下一步；
- **Harness Projection**：提供稳定结构化结果，包括 `can_continue`、阻断性、所需层级、层级结果、缺口、可用/拒绝资源、最低安全下一步、允许/禁止动作、版本绑定、验证有效期和是否需要重新确认；自然语言仅作补充；
- **Governance Projection**：提供质量维度、证据覆盖、事实/假设/争议、过期内容、权限投影、知识候选和 Connector 系统性问题；
- **Audit / Security Projection**：提供主体、时间、Revision、实际投影、ACL、策略、审批、动作、验证、失败和纠错记录，仍受当前访问控制和用途限制。

所有投影必须来自同一规范恢复结果和证据链。投影可以改变信息密度、字段名称和表达方式，但不得改变事实、影响、恢复结论、权限边界或安全要求。

#### 明确暂缓事项及原因

以下内容留待以后讨论，不在本轮固化：

| 暂缓内容 | 暂缓原因 |
|---|---|
| 最终中文/英文文案 | 需要后续用户测试、语言规范和具体交互设计；留待以后讨论 |
| 页面布局和交互细节 | 属于后续 IA、UX 和原型设计；留待以后讨论 |
| 具体 API 字段 Schema | 属于后续接口和技术架构设计；留待以后讨论 |
| 国际化 | 属于后续多语言产品设计；留待以后讨论 |
| 无障碍细节 | 属于后续可用性和前端实现设计；留待以后讨论 |
| 通知渠道和模板 | 属于后续通知策略与运营设计；留待以后讨论 |

核心不变量：

```text
一个规范恢复结果，多种受控投影
用户结论必须可展开到证据
自然语言不能替代 Harness 结构化契约
投影差异不能改变事实和安全边界
权限投影不能泄露无权资源
```

### 27. Work Thread 采用默认连续、边界变化才拆分的关系模型（已确认）

Work Thread 不因复杂度、步骤增加、多人参与、Session 变化或 Harness 切换而自动拆分。采用“默认连续、治理边界变化才拆分”的分层关系模型：

```text
同一目标下的新步骤 / 阶段
  → Task / Work Phase

同一目标下的并行方案 / 探索
  → Work Branch

具有独立 owner、权限、交付物或生命周期的派生工作
  → Derived Work Thread

目标、责任或治理边界实质独立
  → New Work Thread / Split
```

#### 拆分与派生原则

是否拆分优先判断：

- 目标是否已经独立且可分别验收；
- canonical owner 是否独立；
- 权限、敏感级别或审批边界是否独立；
- 生命周期是否独立；
- 交付物是否独立；
- 并行方向是否需要隔离冲突；
- 继续放在原 Work Thread 是否会造成责任、审计或知识归属混乱。

拆分、派生必须保留父子关系、拆分原因、基线 Revision、继承/不继承的上下文和证据范围，并重新评估 owner、ACL、审批、Context Manifest 与 Continuation Package。子 Work Thread 不自动继承全部权限、owner、审批或 Team L3。

`Work Branch` 表示同一目标下的并行方案、根因假设或实现方向，共享父工作和基线，最终必须显式合并、采纳或废弃。`Derived Work Thread` 具有独立治理边界，可以独立暂停、阻塞、完成或取消，但不自动合并回父工作。

#### 合并原则

合并不是最后写入覆盖，也不是自动采纳所有结论。必须显式记录来源、目标、基线 Revision、采纳/拒绝/冲突的变更、验证者或审批者和新的结果 Revision。来源分支或派生线程保留，并标记其最终关系，例如 `merged`、`rejected`、`superseded`、`abandoned` 或 `kept_as_reference`。未验证分支不能因合并动作自动升级为正式事实、Team L3 或知识资产。

拆分、派生、合并及后续关系变化均产生新的 Work Thread Revision，并重新评估权限、责任、审批、Manifest 和 Package。

#### 完成、取消、归档与复开

- **completed**：目标、必要交付物和验收条件满足，未完成事项已处理、移交或明确排除，关键证据和验证结果齐全，并由 canonical owner 或有权限主体确认；
- **cancelled**：当前目标不再继续，例如业务撤销、方案替代、资源终止、重复工作或风险不可接受；保留原因、授权、未完成事项、工件和全部历史；
- **archived**：保存与展示状态，不再作为默认当前工作，默认禁止普通追加写入，但仍可按权限查询、审计、引用或作为新工作来源。

推荐生命周期：

```text
active → completed → archived
active → cancelled → archived
```

`completed`、`cancelled` 和 `archived` 都不等于删除。终态后需要继续时，采用受控 `reopen`、`follow-up` 或 `derive`；完成后发现新的后续工作，默认创建后续或派生 Work Thread。只有在原完成判定本身错误且经过受控流程时，才允许 `completed → reopened → active`，并保留原完成版本和重新打开证据。复开不静默恢复旧 Run 或旧 Prompt。

#### 明确暂缓事项及原因

以下内容留待以后讨论，不在本轮固化：

| 暂缓内容 | 暂缓原因 |
|---|---|
| 拆分/派生的具体判定阈值 | 需要结合真实工作样本、自动识别准确率和用户管理负担校准；留待以后讨论 |
| Branch、Derived、Follow-up 的具体数据模型 | 属于后续对象模型和数据架构设计，需在关系语义稳定后讨论；留待以后讨论 |
| 合并冲突的详细算法 | 已在“暂缓项深化 3”确认共同基线、三方比较、M0/M1/M2 处置、人工解决记录和合并后重新验证；最终实现细节留待以后讨论 |
| 完成验收的行业/场景模板 | 已在“暂缓项深化 4”确认通用验收骨架、场景模板和组织/行业扩展项；具体模板字段与场景规则仍留待以后讨论 |
| reopen、follow-up、derive 的具体交互流程 | 已在“暂缓项深化 5”确认三种操作的触发、推荐、确认、撤回、异常和状态传播边界；具体 UI/API 仍留待以后讨论 |
| 归档保留期限和恢复策略 | 已在“暂缓项深化 6”确认按对象、风险、业务生命周期、合规和引用关系计算保留，并区分查询、引用、工作和环境恢复；具体期限与删除流程仍留待以后讨论 |
| 终态后的详细权限矩阵 | 已在“暂缓项深化 7”确认终态后按主体、资源、动作、用途、作用域和当前策略重新授权；完整角色矩阵、委托/接管、Break-Glass、删除和导出细节仍留待以后讨论 |
| 自动拆分、自动合并和治理 Agent 介入规则 | 已在“暂缓项深化 8”确认自动化按 M0/M1/M2 分级，并区分候选、审核、阻断、升级和治理 Agent 的建议/执行边界；具体规则、阈值和回滚实现仍留待以后讨论 |

## 暂缓项深化 1：拆分/派生的具体判定阈值

本轮确认：

> **Work Thread 的拆分和派生采用“硬门禁 + 决策矩阵 + 候选确认”，不使用单一相似度、时间间隔或失败次数阈值直接裁决。第一版区分 Continue、Branch、Follow-up 和 Derived Work Thread 四种关系：目标相同、责任和权限边界不变时默认 Continue；同一目标下并行探索时创建 Branch；原工作结束后开启相关但独立的新周期时创建 Follow-up；目标、Owner、权限/敏感性边界、验收标准、生命周期或合规责任发生实质变化时创建 Derived Work Thread。跨 tenant、Project/Team Owner、权限、敏感性、责任或独立审计边界的变化属于硬门禁，不得继续作为普通同一 Thread。自动识别器只生成候选并记录硬门命中、软信号、证据和权限影响；高风险拆分、派生和 Owner 变化需要授权主体确认。新 Thread 只继承最小、明确授权的上下文包，不继承源空间全部原始内容、权限、工具能力或审批；父 Thread 不因子 Thread 创建而自动关闭，所有拆分、派生、合并和纠错均需保留版本、血缘和审计。当前不固化通用数值阈值，待真实运行数据后校准。**

### 1. 四种关系

```text
Continue
  目标、Owner、责任和权限边界连续，继续当前 Work Thread

Branch
  同一目标下并行探索不同方案，保留共同基线，可能合并回父 Thread

Follow-up
  原工作已完成或终止后，开启相关但独立的新工作周期

Derived Work Thread
  目标、Owner、权限/敏感性、验收、生命周期或合规责任发生实质变化
```

### 2. 硬门禁与软信号

以下任一变化禁止普通 Continue：

```text
tenant 边界变化
Project / Team canonical owner 变化
权限或敏感性边界变化
责任需要独立承担
验收标准完全不同
生命周期需要独立关闭
合规要求独立审计
父 Thread 已完成、取消或归档
```

目标语义、资源范围、revision、参与人、工具能力、时间间隔、任务阶段、失败路径和上下文预算等仅作为候选信号，不能单独裁决拆分。

### 3. 决策矩阵

```text
硬边界变化
  → Derived / Follow-up
目标相同、边界不变
  → Continue
目标相同但需要并行探索
  → Branch
目标相关但当前 Thread 已终止或开启新周期
  → Follow-up
存在冲突或证据不足
  → 生成候选并请求确认
```

第一版不固化通用数值阈值；硬门禁采用规则，软信号只用于排序候选，具体阈值留待真实运行数据校准。

### 4. 自动识别与人工确认

自动识别器可以发现明确的新任务、Project/tenant 变化、权限边界变化、资源完全不同、父 Thread 终态、显式后续请求和显式并行方案，但只产生：

```text
continue_candidate
branch_candidate
follow_up_candidate
derived_candidate
```

高风险拆分、派生、Owner 变化、跨边界继承和目标范围变化需要授权主体确认。不得自动复制敏感上下文、扩大权限、关闭父 Thread 或合并未验证分支。

### 5. 最小继承包

新 Thread 只继承明确授权的：

```text
parent_work_thread_id
derivation_reason
source_revision
selected_evidence_refs
accepted_context_refs
excluded_context_refs
open_questions
known_failures
required_permissions
sensitivity_summary
owner_transition
```

不默认继承全部对话、工具参数、日志、凭据、Prompt、缓存、未验证推断、源空间权限、工具能力或审批。

### 6. 版本、血缘与父 Thread 边界

拆分事件至少记录：

```text
split_event_id
parent_thread
child_thread
relation_type
reason
trigger
evidence_refs
actor
approval
created_at
```

关系类型包括 `branch_of`、`follow_up_of`、`derived_from`、`supersedes` 和 `related_to`。父 Thread 不因子 Thread 创建而自动关闭；错误拆分通过 correction 或 supersedes 关系纠正，不删除子 Thread 或静默合并。

### 本项明确暂缓事项及原因

以下内容留待以后讨论，不在本项固化：

| 暂缓内容 | 暂缓原因 |
|---|---|
| Continue / Branch / Follow-up / Derived 的数值阈值 | 需要真实工作样本和误拆分/漏拆分数据，留待以后讨论 |
| 不同行业、Work Phase 的阈值差异 | 业务类型差异大，当前无法统一，留待以后讨论 |
| 自动识别模型和训练数据 | 需要真实运行 Trace、反馈和治理结果，留待以后讨论 |
| Branch 自动合并和结果裁决算法 | 依赖版本、证据、责任和冲突模型，留待以后讨论 |
| 父子 Work Thread 的完整 Schema | 需要结合统一对象模型和持久化架构，留待以后讨论 |
| 派生包的完整权限和脱敏字段 | 依赖议题 7、9、10 的进一步细化，留待以后讨论 |
| 拆分候选的运营指标和告警 SLA | 需要实际接入和用户管理负担数据，留待以后讨论 |

## 暂缓项深化 2：Branch、Derived、Follow-up 的具体数据模型

本轮确认：

> **Branch、Derived Work Thread、Follow-up 不采用单一 parent_id 或普通 Task 层级表达，而采用 `WorkThreadRelation`、`ContextTransfer` 和 `LifecycleLink` 三类对象分离建模。Branch 表示同一目标下基于共同 revision 的并行探索，绑定基线、探索目标、分支 Owner、继承/排除上下文和显式合并策略；Follow-up 表示原工作终止或完成后的相关新周期，引用历史结果和开放问题，但不恢复旧 Run、Prompt、审批或工具权限；Derived 表示目标、Owner、权限/敏感性、验收、生命周期或合规责任独立的新 Thread，必须明确 source/target scope、target Owner、用途、权限边界、敏感性、血缘和派生策略。Context Transfer 逐项记录来源版本、传递模式、用途、敏感性、权限检查和重新验证要求，不能成为复制源空间全部权限和内容的机制。三类 Thread 均重新计算权限和 Context Manifest，父子状态独立，源变化和撤回按 LifecycleLink 传播；Branch 合并必须显式比较、验证和采纳，Follow-up 和 Derived 不直接合并回父 Thread。第一版不固化最终 Schema、复杂合并算法、嵌套/循环规则和实时一致性协议。**

### 1. 三类对象

`WorkThreadRelation` 表达 Thread 之间的关系：

```text
relation_id
source_thread_id / version
target_thread_id / version
relation_type
reason
trigger
created_by
created_at
status
audit_refs
```

`ContextTransfer` 表达哪些上下文从源 Thread 转移到目标 Thread：

```text
transfer_id
source_thread_id / version
target_thread_id / version
selected_refs
excluded_refs
transfer_mode
purpose
sensitivity_before / after
permission_decision
revalidation_required
status
```

`LifecycleLink` 表达源变化、撤回、暂停和通知如何影响目标 Thread：

```text
source_thread_id
target_thread_id
source_change_policy
revoke_policy
pause_policy
notify_policy
status
```

三类对象均需版本化、幂等和可审计，关系对象不等于普通 `parent_id`。

### 2. Branch

```text
relation_type = branch_of

required:
  parent_thread_id
  parent_version
  base_revision
  exploration_goal
  branch_owner
  merge_policy
  inherited_context_refs
  excluded_context_refs
```

Branch 状态可以包括：

```text
proposed
active
paused
selected
merged
rejected
abandoned
superseded
archived
```

Branch 基于共同基线并行探索，可能合并回父 Thread，但不自动改变父 Thread 状态，不继承其他 Branch 的未验证内容。

### 3. Follow-up

```text
relation_type = follow_up_of

required:
  source_thread_id
  source_version
  follow_up_reason
  trigger_type
  previous_outcome_refs
  new_goal
  new_acceptance_criteria
  owner
  revalidation_policy
```

触发类型可以包括：

```text
post_completion_review
new_incident
new_requirement
monitoring_regression
customer_follow_up
scheduled_revalidation
owner_requested
```

Follow-up 是独立新周期，只引用历史结果和开放问题，不恢复旧 Run、Prompt、Tool Call 授权、环境连接或审批。

### 4. Derived Work Thread

```text
relation_type = derived_from

required:
  source_thread_id
  source_version
  derivation_reason
  source_scope
  target_scope
  target_owner
  target_purpose
  derivation_policy_version
  permission_boundary
  sensitivity_state
  lineage_refs
```

Derived Thread 必须明确目标范围、Owner、用途、权限边界、敏感性、血缘和派生策略；缺少这些字段时只能保留为派生候选，不进入正式消费。

### 5. Context Transfer 继承模式

不使用单一 `inherit_context = true`，至少区分：

```text
none
selected
summarized
redacted
reference_only
```

每项转移要记录来源对象和版本、目标 Thread、用途、前后敏感性、权限决策、脱敏策略、重新验证要求和允许消费者。

默认不继承：

```text
全部对话
原始日志
凭据
Prompt
旧 Run
旧审批
源空间权限
源工具能力
未验证推断
```

### 6. 继承和生命周期矩阵

| 能力或数据 | Branch | Follow-up | Derived |
|---|---:|---:|---:|
| 父 Thread 标识 | 必须 | 必须 | 必须 |
| 基线 revision | 必须 | 可选 | 按适用性 |
| 已确认事实 | 可选 | 选定后继承 | 仅授权派生 |
| 未验证假设 | 默认不继承 | 默认不继承 | 默认不继承 |
| 失败路径 | 可继承相关部分 | 可继承摘要 | 仅授权摘要 |
| 原始日志 | 默认不继承 | 默认不继承 | 默认不继承 |
| Owner | 可继承但可变 | 重新确认 | 必须明确目标 Owner |
| 权限 | 重新评估 | 重新评估 | 取授权交集 |
| 审批 | 不继承 | 不继承 | 不继承 |
| 合并回父 Thread | 可 | 不直接合并 | 不直接合并 |
| 源撤回影响 | 按策略 | 重新评估 | 默认暂停/重算 |
| 独立生命周期 | 通常是 | 是 | 必须是 |

### 7. 合并与状态边界

Branch 合并采用：

```text
Branch active
  → 比较基线和差异
  → 验证
  → 责任人选择采用 / 拒绝 / 保留参考
  → 生成新父 Thread Revision
  → 记录 adopted / rejected / superseded / kept_as_reference
```

Follow-up 和 Derived 通过关系、引用或替代关联历史，不直接回写或合并源 Thread。父 Thread 和子 Thread 状态独立；父 Thread 完成、归档或变化不自动关闭、删除或覆盖子 Thread。

## 暂缓项深化 3：合并冲突的详细算法

本轮确认：

> **Branch 合并采用绑定共同基线的三方比较，不使用最后写入者、最高置信度、最新时间、参与人数或模型投票直接裁决。先区分可合并差异、直接冲突和关系不明，再按对象类型、字段、范围、时间、环境、revision、依赖、用途、敏感性、Owner、证据和验证状态处置。M0 仅自动合并低风险、追加式且不冲突的变化；M1 生成 `merge_candidate / needs_review` 并要求有权限责任人作出明确解决；M2 对权限、敏感性、Owner、生产、安全、关键验证、基线不明或血缘断裂等冲突阻断并建立 `MergeConflict`。合并生成新的父 Thread Revision，保留分支版本和 adopted、rejected、superseded、kept_as_reference、disputed 等结果状态；合并后重新计算权限、敏感性、血缘、Context Manifest、验收和执行资格。历史低风险冲突解决模式只能作为候选复用，不能绕过当前验证与治理。最终 Schema、复杂算法和运行参数留待以后讨论。**

### 1. 共同基线与三方比较

每次 Branch 合并必须绑定：

```text
base_revision
left_revision
right_revision
```

- `base_revision` 是两个分支共同继承的 Work Thread 或上下文基线；
- `left_revision` 和 `right_revision` 是待比较的两个分支版本；
- 基线无法确认时，不得用最新版本或当前父 Thread 状态补齐，直接进入 M2 阻断。

对每个对象、字段和关系分别比较 `base → left` 与 `base → right`，不把两个分支当作无基线的文本覆盖。

### 2. 差异、直接冲突与关系不明

合并识别结果至少分为三类：

1. **可合并差异**：两侧修改了不同字段、不同范围或互不影响的对象，且没有共享约束冲突；
2. **直接冲突**：两侧对同一对象、字段或约束给出不可同时成立的结果；
3. **关系不明**：无法证明两侧使用的是同一对象、代码 revision、环境、时间范围或证据基础。

关系不明不等于冲突，但不得自动确认为可合并事实；应至少进入 M1，涉及关键责任、权限或安全边界时进入 M2。

### 3. 对象类型的默认策略

| 对象类型 | 默认策略 |
|---|---|
| Evidence | 追加、去重、保留来源，不覆盖原证据 |
| Fact | 按对象、范围、时间、revision、环境、证据和反证比较 |
| Hypothesis | 保留多个候选，不自动提升为结论 |
| RCA conclusion | 版本化结论，保留支持证据与反证 |
| Decision | 必须明确 adopted、rejected 或 superseded |
| Constraint | 只能合并或收窄，不能自动放宽 |
| Permission / ACL | 任一侧更严格时默认取更严格结果 |
| Owner | 必须唯一；冲突时阻断 |
| Lifecycle state | 不允许自动跨越关键状态 |
| Action / Run Plan | 不直接合并为可执行计划，必须重新生成并重新审批 |
| Context Manifest | 合并后重新计算，不把旧 Manifest 当作最终结果 |
| Lineage relation | 保留来源和验证状态，关系不明时不得确认为事实 |

### 4. M0、M1、M2 处置分级

```text
M0 自动合并
  → 追加且不冲突的 Evidence
  → 去重事实
  → 非敏感、低风险元数据
  → 互不重叠任务
  → 已验证引用

M1 merge_candidate / needs_review
  → 条件化合并
  → 收窄适用范围
  → 轻微不一致
  → 保留多个假设
  → 需要重新验证的结果

M2 blocked / human handling
  → 权限、敏感性或 Owner 冲突
  → 生产、安全或关键验证冲突
  → 基线不明或血缘断裂
  → 目标范围扩大
  → 不可逆操作冲突
```

M1 的人工解决选项至少包括：`adopt_a`、`adopt_b`、`adopt_both_with_conditions`、`create_new_resolution`、`keep_both_as_hypotheses`、`keep_as_reference`、`reject` 和 `escalate_to_m2`。审核不能只记录“已解决”，必须绑定解决人、理由、支持证据、反证、新条件和重新验证要求。

条件化合并必须绑定可验证的 `scope`、`environment`、`repository`、`revision`、`time_range`、`dependency_version`、`purpose`、`exception` 或 `valid_until` 等边界。无法验证、会扩大权限、涉及生产写操作或掩盖基线差异的条件，不得用于绕过 M2。

### 5. MergeConflict 与合并后版本

M2 必须生成可审计的 `MergeConflict`，至少记录：

```text
conflict_id
base_revision
left_revision
right_revision
object_refs
conflict_dimensions
evidence_refs
counter_evidence_refs
risk_level
security_impact
ownership_impact
permission_impact
recommended_action
resolver
status
```

状态至少包括：

```text
open
under_review
needs_more_evidence
resolved
rejected
superseded
cancelled
```

合并不能覆盖原分支版本，而应生成新的父 Thread Revision：

```text
merge_revision = new revision
parents = [left_revision, right_revision]
base = base_revision
```

原分支版本必须保留，并标注其结果关系：

```text
adopted
rejected
superseded
kept_as_reference
disputed
```

合并成功只表示形成了新的可审计版本，不表示其中的建议已经可执行。合并后必须重新验证 canonical owner、ACL、敏感性、血缘、Context Manifest、事实冲突、任务状态、验收条件、代码 revision、Tool Policy 和 RunGate。

### 6. 历史解决模式的受控复用

可以借鉴 Git `rerere`，复用已经审核过的低风险冲突解决模式，但只能生成当前的 `merge_candidate`。复用至少要求对象类型、冲突维度、基线结构、权限和敏感性兼容，且当前上下文没有关键变化；涉及 Owner、ACL、生产操作或安全约束时不得自动复用。

### 7. 本轮边界

本轮确认的是冲突分类、处置等级、人工审核责任、版本保留和合并后重新验证原则，不固化最终数据库 Schema、复杂字段级合并实现、多层 Branch/循环关系规则、实时一致性协议、运行参数或 UI/API 细节；以上内容留待以后讨论。

### 8. 第一版优先能力

第一版优先实现：

1. `WorkThreadRelation`；
2. `ContextTransfer`；
3. `LifecycleLink`；
4. Branch、Follow-up、Derived 的必填字段；
5. 继承矩阵；
6. Owner、权限和敏感性重新评估；
7. Branch 显式合并；
8. Follow-up 和 Derived 独立生命周期；
9. 源变化和撤回传播；
10. 新 Thread 不继承旧 Run、Prompt、审批和工具权限；
11. 父子关系、版本和血缘审计；
12. 关系对象幂等和可纠错。

### 本项明确暂缓事项及原因

以下内容留待以后讨论，不在本项固化：

| 暂缓内容 | 暂缓原因 |
|---|---|
| `WorkThreadRelation`、`ContextTransfer`、`LifecycleLink` 的最终 Schema | 需要结合统一对象模型、血缘和权限架构，留待以后讨论 |
| Branch 合并的完整差异、验证和裁决算法 | 已在“暂缓项深化 3”确认阶段性算法；最终实现 Schema、复杂合并算法和运行参数仍留待以后讨论 |
| 多层 Branch 嵌套和循环关系禁止规则 | 需要结合图结构和生命周期实现，留待以后讨论 |
| Follow-up 与 Incident、Task、RCA 的完整关联协议 | 依赖代码场景和知识化对象模型，留待以后讨论 |
| Derived Thread 的完整脱敏与跨空间继承字段 | 依赖议题 7、9、10 的进一步 Schema，留待以后讨论 |
| LifecycleLink 的实时传播和一致性协议 | 依赖事件系统和运行规模，留待以后讨论 |
| UI 交互和 API 兼容性细节 | 属于后续产品设计和架构实现，留待以后讨论 |

## 暂缓项深化 4：完成验收的行业 / 场景模板

本轮确认：

> **完成验收采用“通用验收骨架 + 场景模板 + 组织/行业扩展项”三层结构，不为每个行业建立完全独立的 Work Thread 完成模型。`completed` 必须综合目标、范围、交付物、验收条件、证据、未完成项、风险和责任确认；运行成功、产物存在、Harness 宣称完成或 Owner 点击完成都不能单独决定完成。工作完成、验证完成、知识发布、风险关闭和后续工作完成必须分开表达。优先覆盖软件开发、Incident、研究分析、规划决策、知识资产、合规安全和数据处理七类场景；行业扩展项可以增加约束、证据等级、复核和审批要求，但不得静默放宽平台通用安全与审计要求。带例外、残余风险或未验证范围的完成必须显式记录。具体模板字段、行业规则和判定参数留待以后讨论。**

### 1. 通用验收骨架

所有 Work Thread 至少应能表达：

```text
objective
scope
exclusions
deliverables
acceptance_criteria
evidence_refs
unresolved_items
risk_summary
follow_up_refs
responsibility_confirmation
accepted_by
accepted_at
```

通用骨架不规定所有场景使用相同的证据类型或验收阈值，只保证目标、边界、产物、条件、证据、缺口、风险和责任确认不会被遗漏。

### 2. 场景模板与行业扩展

场景模板只补充该类工作的专有验收维度：

| 场景 | 重点验收维度 |
|---|---|
| 软件开发 / 代码变更 | 目标功能或缺陷、代码 revision、测试/构建、影响范围、未验证边界、回滚或后续责任 |
| 故障响应 / Incident | 影响止损、服务恢复、监控/用户侧验证、临时缓解与永久修复、残余风险、RCA 和后续行动 |
| 研究 / 调查 / 分析 | 研究问题、来源可追溯性、事实/推断/未知、反证、结论、方法局限 |
| 规划 / 设计 / 决策 | 目标约束、备选方案、取舍影响、决策主体、依赖风险、采纳状态和后续执行 |
| 文档 / 知识资产 | 读者和用途、来源、审核、版本范围、敏感性、发布状态、源变化后的复核责任 |
| 合规 / 安全 / 审批 | 控制项覆盖、证据等级、例外批准、风险接受、独立复核、审计记录和复查时间 |
| 数据处理 / 数据分析 | 输入版本、处理步骤、数据质量、输出、可重复性、异常处理、隐私边界和结论适用范围 |

组织或行业扩展项通过附加约束实现，例如必填证据、独立复核角色、审批要求、保留期限、复查周期和风险等级；扩展不得删除通用骨架中的安全、权限、血缘和审计要求。

### 3. 正交完成状态

不把所有结果压缩为单一 `completed` 字段，至少区分：

```text
work_status
deliverable_status
verification_status
acceptance_status
risk_status
publication_status
follow_up_status
```

例如：

```text
work_status = completed
verification_status = partially_verified
acceptance_status = accepted_with_exceptions
risk_status = residual_risk_open
publication_status = not_published
follow_up_status = required
```

这种状态表示主要目标已完成，但仍有例外、残余风险或后续动作；不能被表达为所有事情均已完成。

### 4. 完成判定边界

以下信号只能作为证据或触发器，不能单独决定 `completed`：

```text
最后一次 Run 成功
Harness 返回“完成”
存在代码 diff、文档或报告
没有新的消息
Owner 点击完成
```

`completed` 还必须结合目标、交付物、验收条件、关键证据、失败或未完成路径、风险和责任确认。工作完成不代表知识资产已发布、所有结论正确、所有风险已关闭或后续工作已经结束。

### 5. 本轮边界

本轮确认的是验收模型的分层方式、优先场景和完成状态边界，不固化各场景最终字段、行业阈值、证据等级数值、审批矩阵、保留期限、UI/API 或自动判定算法；以上内容留待以后讨论。

## 暂缓项深化 5：reopen、follow-up、derive 的具体交互流程

本轮确认：

> **`reopen` 用于纠正原完成/取消判定，不用于承接普通新需求；`follow-up` 用于原工作结束后的相关新周期，原 Thread 保持终态；`derive` 用于目标、Owner、权限、用途、敏感性、生命周期或合规责任发生实质变化的派生工作。三种操作都必须记录原因和证据，执行前检查来源 Revision、权限、重复关系和血缘，并展示影响预览；低风险操作需要明确确认，高风险操作需要授权或审批。Reopen 生成原 Thread 的新 Revision，不改写历史；Follow-up 和 Derived 创建新的 Work Thread，不继承旧 Run、Prompt、审批、工具权限或环境连接。用户入口采用“继续处理”，平台只能推荐内部动作，不能替用户确认高风险操作。撤回、取消和外部副作用分开处理；父子 Thread 默认状态独立，传播必须通过显式 LifecycleLink。具体 UI/API 仍留待以后讨论。**

### 1. 三种操作的判定边界

```text
reopen
  原完成/取消判定可能错误，继续原 Thread 的同一责任边界

follow-up
  原工作已结束，开启相关但独立的新工作周期

derive
  目标、Owner、Project/Team、权限、用途、敏感性、生命周期或合规责任发生实质变化
```

如果多个条件同时满足，优先判断：

```text
权限 / Owner / tenant 边界变化 → Derived
原完成/取消判定错误 → Reopen
原工作已结束且是相关新周期 → Follow-up
```

无法区分时，生成候选并请求授权主体确认，不由模型根据标题相似度或用户口头用词静默裁决。

### 2. 统一入口与推荐

用户侧统一入口可以是“继续处理这项工作”，平台再根据目标、原状态、边界和证据推荐：

```text
Continue / Branch / Reopen / Follow-up / Derived
```

推荐必须说明：

- 为什么推荐该操作；
- 是否创建新 Thread；
- 哪些上下文会继承、引用、摘要或脱敏；
- 哪些权限、审批、工具能力和环境不会继承；
- 谁需要确认或审批；
- 是否影响原 Thread、已有子 Thread 或派生资产。

推荐不等于执行。高风险操作显示“提交审核”而不是“立即创建”。

### 3. Reopen 流程

```text
completed / cancelled / archived
  → 选择 Reopen
  → 说明原因并关联触发证据
  → 指出原判定错误或遗漏
  → 预览影响范围
  → 检查 Owner、权限、敏感性和资源
  → 授权主体确认
  → 生成 reopened Revision
  → 重新解析 Context Manifest
  → active / blocked
```

Reopen 不删除或改写原 `completed`、`cancelled` 或 `archived` 版本。若新目标已经具有独立 Owner、权限、Project、验收或生命周期，应把请求转为 Follow-up 或 Derived 候选。

来源 Revision 发生变化、权限收窄、资源撤回或已有同类操作时，原请求失效并需要重新确认。证据不足、无权操作或会造成重复冲突时，可以记录为：

```text
reopen_rejected
reopen_expired
reopen_needs_more_evidence
```

### 4. Follow-up 流程

```text
completed / cancelled / archived
  → 选择创建后续工作
  → 选择来源 Thread / Revision 和触发类型
  → 说明新目标与新验收条件
  → 指定 Owner 和参与者
  → 选择历史结果、开放问题和证据引用
  → 权限、敏感性和重复检查
  → 创建 Follow-up Thread
```

原 Thread 保持终态，不重新变为 `active`；Follow-up 拥有独立生命周期，不继承旧 Run、Prompt、审批、工具权限或环境连接。

来源 Thread 尚未结束时，默认不创建 Follow-up；确需提前创建，必须显式记录 `early_follow_up`、原因和授权。创建前若发现已有相同目标的活动 Thread 或候选，应优先提供继续、关联、合并或明确确认重复创建的选择。

### 5. Derived 流程

```text
现有 Thread / Revision
  → 发起派生
  → 定义 source scope、target scope、target Owner 和用途
  → 选择证据与上下文的引用 / 摘要 / 脱敏 / 选定转移方式
  → 权限、敏感性、脱敏和血缘检查
  → 生成 Derived Candidate
  → 目标 Owner 或授权主体确认
  → 创建 Derived Work Thread
  → 重新计算 Manifest 和执行边界
```

缺少 `target Scope`、`target Owner`、`target Purpose`、权限边界、敏感性或验收条件时，只能停留在候选状态。目标空间无权接收关键内容时，应排除、限制或阻断，不得生成缺少关键安全上下文的“完整”派生 Thread。

目标 Owner 可以接受、退回补充、拒绝、限制上下文、要求重新脱敏或仅接受为只读参考；拒绝不删除来源 Thread 或派生候选。

### 6. 撤回、取消与外部副作用

尚未生效的 `draft`、`candidate` 或 `pending_confirmation` 可以撤回；已创建的新 Thread 不能通过撤回伪装成从未创建，只能记录为 `cancelled`。已产生外部副作用时，必须进入影响评估、限制/撤回、补偿动作和审计复核流程。

已生效的关系不能物理删除，而应建立版本化事件：

```text
relation_active → relation_revoked
```

源内容撤回时，先阻断未来检索、上下文注入和执行；旧 Package、Run Snapshot 和审计记录不静默改写，受影响的派生内容和消费者再异步重算或治理。

### 7. 父子状态传播与并发

父子 Thread 默认状态独立：

```text
父 Thread 状态变化 ≠ 子 Thread 自动同状态变化
```

- Reopen 不自动 Reopen Follow-up 或 Derived，只产生重新验证要求；
- Follow-up 完成不改变父 Thread 的完成、取消或归档状态；
- Source Thread 变化或撤回可以通过 `LifecycleLink` 使 Derived 内容进入 `restricted`、`revalidation_required`、`blocked` 或 `superseded`；
- 父 Thread 归档、取消或 Reopen 不自动关闭子 Thread；
- 重复或并发的 Reopen、Follow-up、Derived 请求先生成候选或冲突，不静默创建多个正式 Thread；
- 所有操作都必须基于有效 Revision，版本变化会使旧请求失效或需要重新确认。

### 8. 本轮边界

本轮确认的是三种操作的语义边界、统一入口、推荐与确认、异常、撤回、外部副作用和状态传播原则，不固化最终 UI、API 字段、通知模板、撤回 SLA 或复杂自动判定算法；以上内容留待以后讨论。

## 暂缓项深化 6：归档保留期限和恢复策略

本轮确认：

> **归档保留不采用单一 Work Thread 期限，而按对象类型、风险、业务生命周期、合规要求、保留锁定和活动引用关系计算。`archived`、`cold`、`restricted / pending_disposal` 与删除分开建模；合规、审计、争议、安全调查和活动血缘可以锁定保留，隐私请求、秘密暴露、撤回或非法保留要求可以触发提前限制、匿名化或删除。归档后的查看、审计、血缘引用、Follow-up、Derived、工作恢复和环境恢复分开授权，默认禁止直接追加、恢复旧 Run、旧审批和旧工具权限。任何恢复都必须重新检查 Owner、ACL、敏感性、用途、Revision、血缘、撤回状态、Harness 能力、Tool Policy 和 RunGate，并区分查询、引用、工作和环境恢复结果。具体保留期限、冷存储、删除/匿名化流程和恢复失败策略留待以后讨论。**

### 1. 保留对象与理由

归档策略不能只作用于 Work Thread，还要分别考虑：

```text
Work Thread
L0 原始事件
Evidence
Work Thread Revision
Checkpoint
Run Context Snapshot
Continuation Package
Handoff / Acceptance Record
MergeConflict
WorkThreadRelation
ContextTransfer
LifecycleLink
Audit Record
派生知识资产、Follow-up 和 Derived Thread
```

这些对象分别承担工作身份、原始证据、版本不可变、恢复、交接、冲突、父子关系、责任传播、审计和知识血缘职责，不默认使用同一个保留期限。

### 2. 独立的保留状态

保留状态与 Work Thread 生命周期分开建模：

```text
online
  当前可正常查询，允许受控追加或恢复操作

archived
  不作为当前工作，仍可按权限查询和引用

cold
  降低在线访问能力，保留受保护的完整记录或可恢复介质

restricted / pending_disposal
  限制普通访问，等待删除、匿名化、合规复核或影响治理
```

例如：

```text
work_status = completed
retention_state = archived
retrieval_status = restricted
lineage_status = active
recovery_status = reference_only
```

`archived` 不等于 `deleted`，`cold` 不等于不可恢复，`restricted` 也不等于历史记录已消失。

### 3. 保留策略的优先级与锁定

建议按以下优先级计算最终策略：

```text
法律 / 合规强制要求
  > 安全事件、审计和诉讼保全
  > 活动派生资产或未完成责任
  > Team / Project 业务策略
  > 平台默认策略
  > 成本优化策略
```

以下情况可以形成保留锁定：

```text
legal_hold
active_incident
open_audit
unresolved_dispute
security_investigation
regulatory_review
active_lineage_dependency
```

以下情况可以触发提前限制、匿名化或删除流程：

```text
privacy_request
secret_exposure
invalid_consent
policy_violation
source_retraction
unlawful_retention
```

“到期自动删除”不能作为唯一保留策略；锁定和提前处置都必须可审计。

### 4. 归档后的访问分层

归档对象的访问用途分开授权：

```text
view
audit
lineage_reference
follow_up_source
derive_source
restore_work
restore_environment
```

默认规则：

| 操作 | 归档后默认 |
|---|---:|
| 查看工作摘要 | 允许，受当前 ACL 控制 |
| 查看原始内容 | 受限，需用途和权限 |
| 查看血缘 | 允许最小必要投影 |
| 创建 Follow-up | 允许，但需重新授权 |
| 创建 Derived | 允许，但需重新执行权限和脱敏检查 |
| 直接追加原 Thread | 禁止 |
| 恢复为 active | 禁止自动执行 |
| 恢复旧 Run、审批或工具权限 | 禁止 |
| 恢复环境 | 只能重新连接或重建 |

归档后的访问必须按当前 ACL 重新计算，不能因为历史上有访问权就继续保留访问权。

### 5. 四类恢复

```text
查询恢复
  只恢复查看和审计能力，不改变 Work Thread 状态

引用恢复
  允许作为 Follow-up、Derived 或知识候选的受控来源

工作恢复
  生成新的恢复 Revision，重新计算 Manifest、权限和验收

环境恢复
  重新连接或重建 repo、工作目录、Job、终端或外部对象
```

引用恢复只允许带来源、版本和用途的最小引用；工作恢复不恢复旧 Session、审批、工具权限或环境状态；环境恢复必须检查当前存在性、版本、授权、依赖和安全策略。

恢复结果必须可区分：

```text
restored_for_view
restored_for_reference
restored_for_work
environment_reconnected
restore_blocked
restore_partial
restore_unknown
```

核心边界：

```text
历史可见 ≠ 工作可以继续
环境重连成功 ≠ 权限有效
历史证据存在 ≠ 当前结论仍有效
```

### 6. 保留期限的策略类型

本轮不固化具体天数，先区分策略类型：

```text
required_until_event
  保留至审计关闭、Incident 关闭或争议解决等事件完成

required_while_referenced
  只要仍有活动血缘、派生资产或未完成子 Thread 就不能删除源记录

business_retention
  按 Team、Project 或工作类型策略保留

minimum_retention
  满足最低审计或合规要求

disposable
  无独立保留价值，满足条件后可删除或压缩

indefinite_by_policy
  仅对少数高价值且合规允许的记录使用
```

即使是长期保留，也可以分别设置正文、元数据、摘要和原始证据的生命周期。

### 7. 恢复后的重新验证

任何恢复都必须检查：

```text
当前 Owner
当前 ACL
当前敏感性
当前用途
来源 Revision
代码 / 资源版本
血缘有效性
撤回状态
保留锁定
当前 Harness 能力
Tool Policy
RunGate
```

恢复成功只表示某一恢复层已完成，不表示工作、知识发布或执行资格已经自动恢复。

### 8. 本轮边界

本轮确认的是保留对象、保留状态、保留锁定、访问层级、恢复类型和重新验证原则，不固化具体天数、冷存储技术、删除/匿名化工作流、恢复失败 SLA、最终权限矩阵或 UI/API 细节；以上内容留待以后讨论。

## 暂缓项深化 7：终态后的详细权限矩阵

本轮确认：

> **Work Thread 进入 `completed`、`cancelled` 或 `archived` 后，权限不自动消失，也不自动完整保留，而是按当前主体、资源、动作、用途、作用域、敏感性、血缘、风险和策略版本重新计算。终态后禁止普通追加；纠错通过追加式 `correction_record`；查看摘要、正文、证据、血缘、审计和导出分别授权。Reopen、Follow-up、Derived、工作恢复、环境恢复、发布、导出、删除和 Owner 变更分别建模。参与过、执行过或曾经拥有 Owner 身份都不能自动获得恢复、导出或删除权。治理 Agent 只能检测、解释、建议和发起审核候选，不能替人执行高风险终态操作。终态后的派生必须重新执行权限、敏感性、脱敏、血缘和目标 Owner 检查；取消、归档和 Owner 失效不能绕过保留锁定、审计、合规或安全调查。完整角色矩阵、委托/接管、Break-Glass、删除和导出细节留待以后讨论。**

### 1. 终态后的动作分离

```text
view_summary
view_detail
view_evidence
view_audit
view_lineage
append_correction
create_checkpoint
request_reopen
approve_reopen
create_follow_up
create_derived
restore_work
restore_environment
export
share
publish
revoke
delete
change_owner
change_retention_policy
```

上述动作不由一个统一的“管理权限”覆盖。特别是查看、引用、恢复、导出、发布和删除具有不同的用途与风险。

### 2. 主体边界

终态后的权限主体至少区分：

```text
Canonical Owner
Previous Executor
Current Participant
Target Owner
Project / Team Admin
Auditor
Security / Compliance Reviewer
Governance Agent
Derived Consumer
System Retention Worker
```

- `Canonical Owner` 负责工作责任、生命周期和高风险恢复；
- `Previous Executor` 默认只保留授权范围内的历史可见性，不因曾执行过就拥有恢复或导出权；
- `Participant` 可以继续查看其授权范围内的结果，不自动获得终态变更权；
- `Target Owner` 可以确认 Follow-up 或 Derived，但不因此获得源 Thread 全部内容；
- `Auditor` 可以审计授权范围内的事件，不自动读取正文；
- `Governance Agent` 可以检测、解释、建议和生成候选，但不能替人恢复、发布、导出或删除；
- `Retention Worker` 只能按已批准策略执行保留、降级或处置，不得自行改变策略。

### 3. 状态与动作的默认边界

| 动作 | Completed | Cancelled | Archived |
|---|---:|---:|---:|
| 查看摘要 | 允许 | 允许 | 允许，受当前 ACL |
| 查看详细内容 | 受限 | 受限 | 受限 |
| 查看证据 | 受用途和敏感性限制 | 受限 | 受限 |
| 追加普通证据 | 默认禁止 | 禁止 | 禁止 |
| 追加纠错记录 | 允许，需权限 | 允许，需权限 | 允许，需权限 |
| 请求 Reopen | 允许，需原因和证据 | 允许，需原因和证据 | 允许，需恢复检查 |
| 批准 Reopen | Owner / 授权主体 | Owner / 授权主体 | Owner / 授权主体 |
| 创建 Follow-up | 允许，重新授权 | 允许，重新授权 | 允许，重新授权 |
| 创建 Derived | 允许，重新做权限/脱敏检查 | 允许，重新检查 | 允许，重新检查 |
| 恢复工作 | 不自动允许 | 不自动允许 | 需受控流程 |
| 恢复环境 | 不继承旧环境权限 | 不继承旧环境权限 | 仅重新连接或重建 |
| 发布知识资产 | 不自动允许 | 不自动允许 | 不自动允许 |
| 导出原文 | 高度受限 | 高度受限 | 高度受限 |
| 删除 | 受保留和合规策略控制 | 受保留和合规策略控制 | 受保留和合规策略控制 |

矩阵是默认边界，不替代当前主体、资源 ACL、用途、敏感性、血缘、风险和策略版本的交集计算。

### 4. 终态与权限变化

- 终态后的权限必须按当前 ACL 重新计算，不能仅依赖创建时或完成时的授权；
- 权限收窄应立即阻断未来访问、检索、上下文注入和执行，但不静默改写历史 Snapshot、审计或已形成的事实记录；
- Owner 离职、失效或权限被撤销时，可以进入受控重新分配、治理接管或升级流程，但“接管”不等于获得源内容全部权限；
- 取消、归档或 Owner 失效不能绕过 `legal_hold`、审计、安全调查、保留锁定或活动血缘；
- 终态后的派生必须重新检查当前权限、敏感性、脱敏、血缘和目标 Owner，不得因为历史上允许访问就自动允许复制。

### 5. 治理 Agent 的边界

Governance Agent 可以：

```text
detect
explain
propose
open_review
request_revalidation
```

默认不能：

```text
reopen
change_owner
export
publish
delete
grant_permission
```

除非组织预先配置了明确、可审计且低风险的自动规则；涉及终态恢复、跨边界导出、权限放宽、删除或执行资格的操作仍需授权主体或独立审批。

### 6. 本轮边界

本轮确认的是终态后的授权重新计算、动作分离、主体边界、默认状态矩阵和治理 Agent 权限边界，不固化完整角色矩阵、委托与接管协议、Break-Glass、导出格式、删除工作流、最终 API 或 UI 细节；以上内容留待以后讨论。

## 暂缓项深化 8：自动拆分、自动合并和治理 Agent 介入规则

本轮确认：

> **自动化按风险、证据、可逆性、影响范围和权限边界分级，不把自动识别当作自动转正，不把自动合并当作自动采纳结论，也不把治理 Agent 的建议当作治理 Agent 的执行。M0 适用于低风险、可逆、证据充分且不改变 Owner、权限、安全边界或生产状态的规则动作；M1 只生成候选、预览和待审核项，不自动改变责任、权限或生命周期；M2 对权限、Owner、敏感性、安全、生产、不可逆影响、基线不明、证据不足或高影响冲突进行阻断和升级。治理 Agent 可以检测、解释、提出候选、请求复核和跟踪影响，但不能替人确认高风险操作、放宽权限、发布、导出、删除或执行。具体准入规则、数值阈值、异常回滚和运行实现仍留待以后讨论。**

### 1. 自动化分级

```text
M0
  低风险、可逆、证据充分、影响范围有限
  → 可按预先批准的规则自动处理

M1
  存在不确定性、轻微冲突或需要上下文确认
  → 生成候选、预览和审核请求
  → 不自动改变 Owner、权限、责任或生命周期

M2
  涉及权限、Owner、敏感性、安全、生产、不可逆影响、基线不明或高影响冲突
  → 阻断并升级人工处理
```

自动化等级必须同时记录触发证据、策略版本、风险判断、影响范围、可逆性和执行结果，不能只记录“自动完成”。

### 2. 自动拆分与自动合并边界

自动拆分最多生成：

```text
continue_candidate
branch_candidate
follow_up_candidate
derived_candidate
```

自动识别不能直接改变 canonical Owner、跨越权限或敏感性边界、关闭父 Thread、复制全部上下文或创建可执行派生工作。

自动合并只限于低风险变化，例如：

- 不冲突的追加式 Evidence；
- 可验证的重复记录去重；
- 非敏感、低风险元数据；
- 互不重叠的任务状态；
- 已验证且适用范围不变的引用。

自动合并不得直接裁决事实冲突、RCA、Decision、Owner、权限、敏感性、安全约束、生产计划或未验证结论；这些至少生成 M1，关键情况进入 M2。

### 3. 治理 Agent 的介入等级

治理 Agent 可以：

```text
detect
classify
explain
propose
open_review
request_revalidation
track_impact
```

默认不能：

```text
confirm_handoff
change_owner
grant_permission
weaken_constraint
publish
export
delete
execute_production_action
bypass_approval
```

治理 Agent 的建议必须带来源、证据、策略版本、不确定性、影响范围和建议动作；不能用模型置信度代替身份、授权、审批或事实验证。

### 4. 失败、误判与回滚

自动动作失败或事后被发现误判时：

```text
保留原始事件和自动决策
  → 记录 correction / reversal / supersedes
  → 阻断受影响的新检索或执行
  → 评估已传播影响
  → 必要时回滚可逆状态或启动补偿动作
  → 重新验证权限、血缘、Owner 和上下文
```

已经产生的外部副作用不能仅通过修改平台状态伪装为已回滚；必须记录实际结果和后续补偿。

### 5. 规则优先级与防绕过

当自动规则、用户请求、治理 Agent 建议和安全策略冲突时，优先级为：

```text
硬性安全 / 合规 / 权限拒绝
  > RunGate / Tool Policy
  > 当前资源 ACL 与作用域
  > 已批准的高风险流程
  > 组织自动化规则
  > 治理 Agent 建议
  > 模型推断或相似度信号
```

平台必须防止通过多个低风险小动作组合绕过高风险门禁。跨动作的累计影响、Owner 变化、权限变化、目标范围扩大和传播闭包应重新评估；达到更高风险等级时升级为 M2。

### 6. 本轮边界

本轮确认的是自动化分级、自动拆分/合并边界、治理 Agent 能力边界、失败纠正和防绕过原则，不固化具体数值阈值、规则引擎、回滚协议、事件调度、运行 SLA、UI/API 或训练数据；以上内容留待以后讨论。

## 子议题深化 1：核心对象

本轮确认：

> **以 `Work Thread` 作为跨成员、Agent、Harness 和 Session 持续存在的工作主体；`Work State`、`Task`、`Work Phase`、`Execution`、`Harness Session / Run`、`Checkpoint`、`Revision`、`Context Manifest`、`Run Context Snapshot`、`Continuation Package`、`Handoff`、`Evidence`、`Recovery Attempt` 和 `Verification Result` 分别建模。Session/Run 不是工作真源，Execution 成功不决定 Work Thread 完成；Manifest 是当前请求下的授权上下文解析结果，Snapshot 是实际交付给某次 Run 的不可变快照，Package 是面向接手者的受控投影。Revision、Snapshot、Evidence、Handoff 和验证结果不可静默覆盖；Handoff 只在接手者明确确认后转移执行责任，不自动改变 canonical Owner；Recovery Attempt 和 Verification Result 分开，恢复成功不等于验证成功或工作可以继续。具体 Schema、不可变存储、事件协议和 API 仍留待以后讨论。**

### 1. 对象职责边界

```text
Work Thread
  跨执行者持续存在的工作主体

Work State
  某个 Revision 下的规范工作状态，不替代原始事件和 Evidence

Task / Work Phase
  Work Thread 内可分配、推进、暂停、取消或验收的目标/阶段

Execution
  某个 Executor 对 Work Thread 或 Task 的一次实际推进尝试

Harness Session / Run
  外部 Harness 的会话或运行容器，不拥有平台工作状态

Checkpoint
  某个时间点的可恢复检查点，不等于 Work Thread 或 Session 复制

Revision
  Work Thread 或重要对象的不可变版本，用于比较、交接、授权、血缘和冲突处理

Context Manifest
  针对当前主体、Harness、Task、用途和权限解析出的允许上下文集合

Run Context Snapshot
  某次 Run 实际获得的不可变上下文快照，不热更新

Continuation Package
  面向下一 Executor 的续办投影，不是完整聊天记录复制

Handoff
  执行责任或上下文的显式交接过程，不自动改变 canonical Owner

Evidence
  支持、反驳或说明 Work State 的来源材料，采用追加式保存

Recovery Attempt
  L1/L2/L3 工作现场恢复尝试

Verification Result
  对恢复、事实、交付物、动作或环境状态的独立验证结果
```

核心关系为：

```text
Work Thread
├── has Work State
├── contains Task / Work Phase
├── has Execution
│   └── uses Harness Session / Run
├── produces Revision
├── creates Checkpoint
├── resolves Context Manifest
│   └── materializes Run Context Snapshot
├── creates Continuation Package
├── records Handoff
├── references Evidence
├── attempts Recovery
└── records Verification Result
```

这些关系不是简单的普通父子层级：`Execution acts_on Task`、`Run hosts Execution`、`Revision versions Work State`、`Manifest projects authorized context`、`Snapshot records actual injected context`、`Package projects continuation state`、`Evidence supports state`、`Verification validates claim`。

### 2. 核心不变量

```text
Work Thread ≠ Chat Session / Harness Session / Run / Checkpoint
Task ≠ Work Thread
Execution ≠ Run
Manifest ≠ Run Context Snapshot
Continuation Package ≠ 完整聊天记录
Execution 成功 ≠ Work Thread 完成
恢复成功 ≠ 验证成功
历史 Revision 不静默覆盖
Evidence 不因新结论出现而删除
Handoff 确认前 ≠ 责任已转移
Handoff 确认 ≠ canonical Owner 已改变
```

### 3. 本轮边界

本轮确认对象职责、关系和不可混淆的核心边界，不固化最终数据库 Schema、不可变存储实现、事件协议、对象 API、查询索引和 UI；以上内容留待以后讨论。


## 子议题深化 2：交接

本轮确认：

> **交接是执行责任、工作上下文或 Executor 的受控转移过程，不是发送通知、指定接手者、查看续办包或切换 Harness。交接采用 `handoff_requested → handoff_ready → permission_checked → handoff_pending → receiver_confirmed → responsibility_transferred` 的显式状态；接手者必须明确确认后责任才转移，确认前原责任不会被静默解除，新执行者也不自动承担责任。Handoff 不自动改变 canonical Owner；交接后必须绑定 Revision、Context Manifest、Continuation Package、权限检查、能力检查和确认记录。拒绝、退回、超时、撤回和失败都保留历史并进入可审计状态。**

### 1. 交接对象与责任关系

```text
Work Thread
├── canonical_owner
├── active_executor
├── participants
├── responsibility_state
└── Handoff
    ├── source_executor
    ├── target_executor
    ├── source_revision
    ├── package_version
    ├── permission_check
    ├── receiver_confirmation
    └── resulting_responsibility
```

Handoff 只负责记录一次交接请求、准备、确认和责任转移，不替代 Work Thread 的 owner、participant、active executor 或生命周期状态。

### 2. 状态与确认边界

```text
handoff_requested
  已提出交接原因、来源、目标和初步上下文

handoff_ready
  续办包、风险、缺口和最低安全下一步已准备

permission_checked
  已按目标 Executor、用途、Harness 和当前 Revision 检查权限与能力

handoff_pending
  等待目标 Executor 明确确认

receiver_confirmed
  目标 Executor 已确认获得足够信息并愿意承担执行责任

responsibility_transferred
  新 Executor 成为当前责任执行者，原 Executor 记录为 previous executor
```

确认前：

- 原执行者责任不会因通知、Session 结束或 Harness 切换而自动解除；
- 目标执行者不会因被指定、查看 Package 或开始阅读而自动承担责任；
- canonical Owner 继续承担整体治理责任；
- 不得把 `handoff_pending` 视为已完成交接。

确认后：

- 新 Executor 成为当前 `active_executor` 或责任执行者；
- 原 Executor 记录为历史执行者；
- 交接版本、Package、Manifest、权限检查、确认时间和说明进入审计；
- canonical Owner 只有经过独立 Transfer 流程才会改变。

### 3. 接手者必须确认的内容

```text
当前目标与范围
已完成与未完成事项
关键 Evidence 与来源
事实、假设、争议与未知
风险、禁令与阻塞
当前 Revision / Manifest / Package
可用、缺失和被拒绝的资源
目标 Executor 的权限与能力
最低安全下一步
是否接受当前执行责任
```

“接受”表示目标 Executor 在当前授权和能力范围内愿意继续，不表示其确认所有事实正确、所有资源可用或 canonical Owner 已改变。

### 4. 失败、退回与超时

目标 Executor 可以：

```text
accept
reject
return_for_completion
request_more_context
request_permission
request_owner_escalation
```

系统可以记录：

```text
handoff_rejected
handoff_returned
handoff_expired
handoff_withdrawn
handoff_failed
```

拒绝、退回或超时不会删除 Handoff、Package 或历史状态；系统只能提醒、升级、重新分配或生成新的交接候选，不能把超时静默解释为接受。

### 5. 本轮边界

本轮确认交接对象、责任状态、接手确认、权限/能力检查和异常状态边界，不固化最终 Handoff Schema、通知渠道、超时 SLA、自动接管规则、UI/API 和跨组织审批协议；以上内容留待以后讨论。

### 6. 权限投影与上下文版本（已确认）

交接前的 `Continuation Package` 不等于接手者自动拥有其中全部内容。平台必须针对目标 Executor、Harness、用途、Task 和当前 Revision 重新解析：

```text
Work State / Evidence
  → 权限过滤与敏感信息处理
  → Handoff-specific Context Manifest
  → Continuation Package
  → 接手者确认
```

交接包中的内容至少区分：

```text
allowed
redacted
denied
unknown
stale
revalidation_required
```

接手确认必须绑定：

```text
source_thread_revision
context_manifest_version
continuation_package_version
permission_policy_version
handoff_version
```

确认前如果发生 Work Thread 新 Revision、Owner 变化、权限收窄、敏感性升级、关键 Evidence 撤回、代码/资源 revision 变化或新的高风险动作，原 Handoff 必须失效、重算并请求重新确认，不能让接手者基于过期 Package 静默承担责任。

接手确认默认只授予继续当前工作所需的最小权限：

```text
查看授权上下文
追加允许范围内的 Evidence
执行已授权 Task
创建 Checkpoint
请求状态变更
发起后续 Handoff
```

不会自动授予 Owner 转移、跨 Project 共享、原文导出、知识发布、生产写入、旧审批对应的执行权限或旧 Harness 的工具能力。上下文不足时，应通过 `request_more_context`、`request_permission`、`return_for_completion` 或 `request_revalidation` 处理，不能复制全部历史记录或绕过当前权限检查。

### 7. 并发执行、自动接管与 Break-Glass（已确认）

在 `handoff_pending` 阶段允许有限并发，但不允许双重责任不明：

- 原执行者可以维持工作、补充 Evidence、处理最低安全动作和紧急止损；
- 原执行者默认不得扩大范围、改变 Owner、扩大权限或发起新的高风险变更；
- 目标执行者确认前可以查看、提问、验证、请求上下文或退回交接，但不自动承担执行责任；
- 接手确认后，新 Executor 承担后续执行责任，原 Executor 对历史动作、Evidence 和判断保留可追溯责任；
- canonical Owner 不因接手确认而改变。

交接期间的并发修改必须基于 Revision 处理：

```text
并发修改
  → 产生并发 Revision
  → 比较差异
  → 低风险变化按规则处理
  → 关键冲突进入 MergeConflict
```

Owner、权限、敏感性、生产动作、验收状态、关键 RCA/Decision、安全约束和不可逆操作冲突必须阻断或升级，不能使用最后写入者覆盖。

自动接管默认只允许：

```text
标记 orphaned
生成 Handoff Candidate
通知候选接手者
生成最小恢复 Package
执行预先批准的低风险止损动作
```

自动接管不能自动改变 canonical Owner、扩大权限、恢复旧工具能力、确认目标接手、关闭原 Thread 或执行生产写操作。组织配置自动接管规则时，必须绑定适用范围、触发条件、授权主体、允许动作、时限、最大风险、回退路径和审计要求。

Break-Glass 仅用于绑定 Incident 的紧急止损和最小恢复，必须记录：

```text
incident_id
使用主体
使用原因
开始时间
失效时间
允许 Scope
允许动作
禁止动作
事后复核人
```

Break-Glass 不改变长期 Owner、ACL、审批角色或工具权限，不授予无限导出、知识发布、再委托或长期执行能力，并必须进行事后复核。

旧动作在交接时必须明确为 `continued`、`stopped`、`transferred` 或 `unknown`，不能默认视为成功。

### 8. 交接撤回、多人接手、跨 Harness 接手和完成验收（已确认）

在 `handoff_requested`、`handoff_ready`、`permission_checked` 和 `handoff_pending` 状态，可以发起：

```text
handoff_withdrawn
```

撤回后原执行者继续承担原责任，目标执行者不承担责任；已生成的 Package、Manifest、权限检查、通知和历史记录保留。进入 `responsibility_transferred` 后不能普通撤回，必须通过 `request_return`、新的 Handoff、`reassign` 或责任复核流程处理，不能把已发生的接手、Evidence、Task、外部动作或 Checkpoint 伪装成未发生。

默认模型为：

```text
一个 Work Thread
  → 一个当前 active_executor
  → 多个 participants / Task owners
```

多人共同接手只有在显式配置 `co_execution`、`joint_handoff` 或 `required_participants` 时才允许，并且必须明确整体责任人、Task 责任、决策权、审批要求、冲突升级和退出条件。多人同时确认同一责任范围时，保留全部确认记录并生成 `responsibility_conflict`，不能由先确认者、最后确认者或模型自动裁决。

跨 Harness 只转移规范工作状态和受控投影：

```text
转移：Work State、Evidence、Revision、Manifest 投影、Package、Task、风险、禁令和最低安全下一步
不转移：私有 Prompt、私有推理、登录态、缓存、活跃进程、工具权限、旧审批和私有 Session 状态
```

目标 Harness 必须进行格式理解、Connector、资源访问、Task 类型、Tool Policy 和最低恢复层级的能力匹配；能读取 Package 不等于能安全执行工作。能力不匹配时进入 `capability_gap`，请求补充上下文、选择其他 Executor 或退回交接。

交接完成验收至少检查：

```text
目标 Executor 身份
接手者明确确认
责任状态变化
Revision / Manifest / Package 版本
权限检查
能力检查
关键上下文可理解性
风险、禁令和缺口
最低安全下一步
原执行者后续责任边界
审计记录
```

交接结果至少区分：

```text
handoff_accepted
handoff_accepted_with_gaps
handoff_returned
handoff_blocked
handoff_failed
handoff_unknown
```

`handoff_accepted_with_gaps` 允许在已知缺口下接手，但每个缺口必须有 Owner、处理方式和是否阻断执行的明确结论。交接完成不等于 Work Thread 完成、Task 验收完成或环境恢复完成。



## 子议题深化 3：归属

本轮确认：

> **Work Thread 采用一个 `canonical_owner_scope`，并将 Owner、Executor、Participant、Producer、Beneficiary、Referenced Scope 和 Affected Scope 分开建模。Project 适合与代码库、业务目标或具体交付强绑定的工作；Team 适合天然跨多个 Project 的联合故障、平台建设或合规工作。参与、执行、被影响、受益和可见都不自动产生所有权；Agent 不因执行或提供证据成为 canonical Owner；跨 Project/Team 参与不自动改变 Owner、关闭权、Owner 转移权或跨边界发布权。Owner 转移必须通过独立、受控、可审计的 Transfer 流程完成。归属变化必须重新评估权限、敏感性、Manifest、历史引用和知识化影响。**

### 1. 归属关系

```text
Work Thread
├── canonical_owner_scope
├── active_executor
├── participants
├── producers
├── beneficiaries
├── referenced_scopes
└── affected_scopes
```

这些关系分别表达规范责任、当前执行、参与协作、产生证据、获得收益、被引用和受影响，不压缩为单一 `owner` 或 `assignee`。

### 2. Project 与 Team Owner

- `Project` 作为 Owner：适用于与代码库、业务对象、项目目标或具体交付强绑定的工作；
- `Team` 作为 Owner：适用于跨多个 Project 的故障响应、平台建设、合规整改或架构演进；
- 多个 Project 共同参与不等于共同拥有；
- Participant、Agent 或 Harness 可以在授权范围内查看、提供证据、执行 Task 或参与交接，但不因参与自动获得 Owner、关闭、转移或跨边界发布权。

### 3. 归属与执行边界

```text
参与 ≠ 所有
执行 ≠ 归属
被影响 ≠ 负责
受益 ≠ Owner
可见 ≠ 可修改
交接 ≠ Owner 转移
Agent 执行 ≠ Agent 成为 Owner
```

Canonical Owner 负责整体目标、生命周期、交接治理、冲突升级和最终关闭；Active Executor 负责当前推进；Participant、Producer 和 Beneficiary 只在明确授权范围内承担相应职责。

### 4. Owner 转移

Owner 转移必须走独立的 `Transfer` 流程，不因以下事件自动发生：

```text
Session 结束
Harness 切换
成员开始执行
Participant 增加
Agent 提供证据
Handoff 被接受
Project 被引用或受影响
```

Transfer 至少需要重新检查：

```text
source_owner
 target_owner
source_revision
target_scope
permission_diff
sensitivity_diff
active_tasks
open_handoff
pending_approval
lineage_impact
new_owner_confirmation
authorization
```

### 5. 归属变化后的影响

归属变化不静默改写历史 Owner 或旧 Revision，但未来请求必须按当前状态重新判断：

```text
权限与检索范围
Context Manifest
Continuation Package
历史引用和血缘可见性
知识化候选与发布责任
撤回和影响传播
交接与关闭权限
```

如果归属、权限、敏感性、审计或撤回检查失败，默认拒绝、隔离或升级治理，不用模型置信度替代身份、授权、同意或审计。

### 7. 第 1 轮调研与综合决策记录

#### 阶段 1：头脑风暴

本轮曾比较以下归属方向：多 Owner 共同持有、单一 canonical Owner 加类型化关系、按 Work Phase 切换 Owner、工作 Owner 与知识资产 Owner 分离、Agent/Harness 作为 Owner，以及归属不确定时的候选与隔离机制。

#### 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察到的机制 | 对本议题的启发 | 局限 |
|---|---|---|---|
| [GitHub：Assigning issues and pull requests](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users) | Assignee 用于说明谁在处理 Issue 或 Pull Request；有写权限者可分配 | 执行人不等于整体归属；工作对象与仓库/Project 容器分开 | 主要面向代码协作，未覆盖跨空间责任、Agent/Harness 和血缘 |
| [GitHub：About Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) | Projects 用于规划和跟踪工作 | Project 是工作组织与跟踪容器，不自动等于每项工作的 Owner | 未覆盖企业级归属争议和责任转移 |
| [Linear：Teams](https://linear.app/docs/teams) | Workspace 可包含多个 Team；用户可属于一个或多个 Team；Team 可包含 Issue 并关联 Project | Team 与 Project 是不同维度，多 Team 参与不等于共同 Owner | 主要说明组织方式，未覆盖复杂审计、派生和敏感性 |
| [Kubernetes：Owners and Dependents](https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/) | OwnerReference 与 labels/selectors 分离，Owner 与 dependent 有明确资源管理语义 | 规范归属应独立建模，不能用标签、引用或参与关系替代 | 资源控制器模型不能直接覆盖人、组织和责任审批 |
| [Kubernetes：Server-Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/) | 多个 applier 可协作管理同一对象的不同字段 | 多人局部管理不等于多个整体 Owner；整体归属与局部责任分开 | 主要解决字段管理和冲突，不解决组织归属与合规责任 |
| [Atlassian：Manage project permissions](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) | Permission scheme 控制谁可访问和编辑 Jira 空间 | Project 角色/权限、Issue Assignee 和整体 Owner 不应混为一谈 | 本轮目标 Project Roles 页面返回 404，未据此推断完整 Jira 角色矩阵 |
| [ServiceNow：Incident Management](https://www.servicenow.com/docs/r/it-service-management/incident-management/c_IncidentManagement.html?rd301) | 官方 Incident Management 文档提供事件管理机制；页面正文动态加载，字段细节未稳定提取 | Incident、分派组、处理人、报告人和受影响对象应分开 | 本轮不把未稳定取得的具体字段定义作为事实结论 |

#### 阶段 3：综合建议

| 方案 | 决策 | 主要理由 |
|---|---|---|
| 多 Owner 共同持有 | 否决为默认模型 | 整体责任、关闭权、转移权和审计责任不清；多方协作可由类型化关系和审批表达 |
| 单一 canonical Owner + 类型化关系 | 继续 | 同时保持整体责任唯一，并表达 Executor、Participant、Producer、Approver、Beneficiary、Affected Scope 等关系 |
| 按 Work Phase 动态切换 Owner | 暂缓为默认模型 | Phase 不应自动改变规范归属；真实责任变化必须走 Transfer |
| Work Thread Owner 与知识资产 Owner 分离 | 继续 | 工作和知识资产生命周期不同，但必须保留血缘、用途、权限和撤回传播 |
| Agent/Harness 作为默认 Owner | 否决 | Agent/Harness 是执行或运行主体，不能替代 User、Project 或 Team 承担默认规范责任 |
| 归属不确定时自动猜测 | 否决 | 模型置信度、参与人数和最后写入者不能替代身份、授权、同意和审计 |

推荐模型：

```text
一个 canonical_owner_scope
  + 类型化责任与关联关系
  + 显式 Owner Transfer
  + 独立的知识资产 Owner
  + 归属不确定时隔离、候选和人工确认
```

#### 阶段 4：专家团讨论

- **产品/价值**：支持单一规范 Owner；提醒关系类型不能无限增长，前台应使用“整体负责人、当前处理人、协作方、审批方、受影响方”等业务语言。
- **UX**：用户通常只知道工作属于哪个项目；应通过归属向导生成候选和解释，不要求一次填写所有内部关系。
- **架构/工程**：单一 Owner 有利于生命周期、权限、Transfer、审计和派生；归属声明应绑定 scope、purpose、valid time、evidence、asserted by、verified by 和 status。
- **运维/可靠性**：Owner 失效、团队解散或 Project 归档时，需要 `owner_invalid`、`ownership_review_required`、`governance_escalated` 和临时接管等受控状态；临时接管不等于永久转移。
- **安全/隐私**：归属不等于权限；归属冲突或失败时默认 `deny / isolate / escalate`；跨空间派生必须重新执行 Owner、权限、敏感性和脱敏检查。

专家团总体支持推荐模型，但保留以下挑战：关系类型需要控制数量；Owner 失效和临时接管需独立流程；归属声明需要证据、有效期和验证状态；跨空间派生、知识资产 Owner 和源撤回传播仍需后续细化。

### 8. 本轮已批准结论与暂缓项

经用户确认，本轮批准：

1. Work Thread 采用唯一 `canonical_owner_scope`，不采用默认多 Owner；
2. Owner、Executor、Participant、Producer、Task Owner、Approver、Beneficiary、Referenced Scope 和 Affected Scope 分开建模；
3. Project 或 Team 可作为 canonical Owner，依据最终责任边界而非参与人数决定；
4. User 可作为个人或私有工作 Owner；Agent 和 Harness 默认作为 Executor、Producer 或治理候选生成者；
5. Owner Transfer 是独立、受控、可审计流程，不因交接、执行、引用或受影响自动发生；
6. 知识资产可拥有不同于 Work Thread 的 Owner，但必须保留源血缘、用途、权限和撤回传播；
7. 归属判定失败时保留证据、限制跨空间传播、生成候选并请求授权确认；
8. 归属变化不静默改写历史 Revision，未来权限、Manifest、派生、知识化和检索按当前状态重新计算；
9. 归属声明需要范围、用途、证据、声明者、验证者、有效状态和审计记录；
10. 多人参与、执行或受益不能自动产生多个 canonical Owner。

以下内容明确暂缓，留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| 归属判定数值阈值和自动分类模型 | 需要真实 Work Thread 数据和误判成本校准；留待以后讨论 |
| `OwnershipAssertion` / `OwnershipTransfer` 最终 Schema | 依赖统一对象、权限和血缘 Schema；留待以后讨论 |
| User → Project / Team 晋升和转移流程 | 涉及组织目录、同意、知识资产和隐私边界；留待以后讨论 |
| Owner 失效、团队解散和临时接管协议 | 依赖组织治理和 Break-Glass 设计；留待以后讨论 |
| 跨租户归属、派生和责任转移 | 依赖跨空间权限、脱敏和合规协议；留待以后讨论 |
| 归属关系循环、冲突和有效期算法 | 依赖图模型、事件传播和版本算法；留待以后讨论 |
| 前台关系展示和归属向导 | 属于后续 UX / IA 设计；留待以后讨论 |


## 子议题深化 4：版本

本轮确认：

> **采用“规范 Work Thread Revision + 追加事件 + 投影版本 + 实际快照”的混合版本模型。`Work Thread Revision` 是规范业务状态锚点，但不承担所有对象的版本语义；`Context Manifest`、`Continuation Package`、`Run Context Snapshot`、`Handoff` 和 `Verification Result` 各自保留版本或不可变记录，并绑定来源 Work Thread Revision。L0 原始事件、Work Thread Revision、Run Context Snapshot、已发送 Package、Handoff Acceptance、已执行动作和 Verification Result 不得静默覆盖；Manifest、检索结果、治理建议和草稿 Package 可以重算，但历史实际投影不得静默改写。业务 Revision 与数据库 Resource Version / 并发版本分开。Branch、Merge、Reopen、Transfer、Derived 和纠错产生可追溯关系与新版本，不覆盖历史。版本变化只使受影响的 Handoff、Manifest、Approval、Verification 或 Action 进入 stale、invalidated 或 revalidation_required，不无差别废弃整个 Work Thread。旧 Snapshot、Package、审计和血缘记录保留历史事实，但当前正文可见性和使用资格按当前权限重新判断。具体 Schema、版本号、事件重放、兼容协议和 UX 仍留待以后讨论。**

### 1. 版本分层

```text
规范 Work Thread Revision
  → 规范 Work State、Task/Phase、责任状态、Owner、风险和开放问题

追加事件
  → Evidence、Correction、Invalidation、Verification、恢复和权限变化历史

投影版本
  → Context Manifest、Continuation Package、检索结果和治理建议

实际快照 / 记录
  → Run Context Snapshot、Handoff Acceptance、Executed Action、Verification Result
```

规范 Revision 是业务状态锚点；事件提供历史依据；投影可重算；实际快照和已发生记录证明某次 Run、交接或验证实际使用和产生了什么。

### 2. 不可变、追加和可重算边界

强不可变或不可静默覆盖：

```text
L0 原始事件
Work Thread Revision
Run Context Snapshot
已发送的 Continuation Package
Handoff Acceptance
已执行动作记录
Verification Result
审计记录
```

追加式变化：

```text
Evidence
Work State event
责任状态变化
权限检查结果
恢复尝试
风险变化
撤回记录
纠错记录
```

可重算投影：

```text
Context Manifest
检索结果
角色投影
影响分析
治理建议
草稿 Continuation Package
```

可重算不等于可以改写历史实际投影；索引、缓存、统计和 UI 排序可更新，但不作为规范事实来源。

### 3. 版本绑定

实际执行至少绑定：

```text
work_thread_revision
work_state_revision
context_manifest_version
run_context_snapshot_id
permission_policy_version
tool_policy_version
harness_capability_version
resource_revision
code_revision
```

交接至少绑定：

```text
source_thread_revision
context_manifest_version
continuation_package_version
handoff_version
permission_policy_version
receiver_confirmation
```

验证至少绑定：

```text
subject_revision
evidence_set_revision
verification_policy_version
environment_revision
dependency_revision
verified_at
valid_until
```

### 4. 版本变化与局部失效

以下变化按影响范围使相关判断进入过期、失效或重新验证：

```text
Work Thread Revision 变化
Owner / 权限 / 敏感性变化
Context Manifest 变化
代码或资源 revision 变化
环境或依赖变化
验收标准变化
关键 Evidence 撤回
Tool Policy / RunGate 变化
审批计划关键字段变化
```

不得无差别废弃整个 Work Thread；应区分：

```text
manifest_stale
handoff_revalidation_required
verification_expired
approval_invalidated
action_blocked
resource_reference_stale
```

Run Context Snapshot 不热更新；Manifest 变化时，旧 Snapshot 仍保留历史真实状态，新的 Run 必须获得新的 Snapshot。

### 5. 分支、纠错和派生

```text
revision_base
  ├── branch_revision_a
  └── branch_revision_b
       └── merge_revision
```

Branch、Merge、Reopen、Transfer、Derived 和纠错都通过 parent/source/derived 关系和新版本表达，不覆盖历史版本。合并使用共同基线和已确认的冲突处理原则；历史解决模式只能辅助当前候选，不能绕过当前验证。

### 6. 本轮边界

本轮确认版本分层、不可变/追加/重算边界、版本绑定、局部失效和分支/纠错/派生关系，不固化最终 Schema、版本号算法、事件重放、迟到事件、补偿事件、多对象原子提交、版本压缩、冷存储、失效 SLA、Trace 绑定协议或 UX/API；以上内容留待以后讨论。

### 7. 第 1 轮调研与综合决策记录

#### 阶段 1：头脑风暴

本轮曾比较：单一 Work Thread Revision、所有对象独立版本、规范 Revision 加投影/快照、纯事件溯源、内容寻址和混合版本模型，并区分强不可变对象、追加式对象、可重算投影和可变索引。

#### 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察到的机制 | 对本议题的启发 | 局限 |
|---|---|---|---|
| [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) | 对象、树、提交和 parent 分开；提交形成不可变历史 | Revision 可采用 parent 关系；规范版本与内容对象分离 | 主要面向代码和文件树，不能表达权限、Handoff 和业务验收 |
| [git-merge](https://git-scm.com/docs/git-merge) | 快进、三方合并、共同祖先、显式冲突和新合并提交 | Branch Merge 必须绑定共同基线并生成新版本 | 主要解决代码差异 |
| [git-rerere](https://git-scm.com/docs/git-rerere) | 可记录并复用已解决冲突 | 历史解决模式只能作为低风险候选复用 | 不替代当前上下文验证 |
| [Kubernetes API Concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/) | ResourceVersion 用于资源变化识别和并发控制 | 旧请求应检测版本变化；存储并发版本与业务 Revision 分开 | ResourceVersion 不是完整业务审计 Revision |
| [Kubernetes Server-Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/) | 多个 applier 可协作管理同一对象不同字段 | 局部管理者不等于整体 Owner；字段冲突需显式处理 | 主要解决声明式字段管理 |
| [GitHub Event Types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types) | 事件有公共属性和类型化 payload；活动记录与当前对象状态分开 | 原始事件与当前 Work State 分离 | 事件 API 的保留和查询规则不能直接作为企业审计方案 |
| [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/) | Trace 由有 parent 关系的 Span 组成，并带 events、attributes 和时间边界 | Execution / Run 作为实际发生路径，与规范状态分离 | Trace 不决定工作完成、权限或结论正确性 |
| Linear Issue History | 目标官方页面本轮返回 404 | 不据此推断 Linear 的具体历史版本机制 | 官方资料不可稳定取得 |

#### 阶段 3：综合建议

| 方案 | 决策 | 主要理由 |
|---|---|---|
| 单一 Work Thread Revision 承担全部版本 | 暂缓 | 无法充分表达投影、快照和 Handoff 实际记录 |
| 所有对象完全独立版本 | 否决为默认 | 版本拼接和一致性复杂度过高 |
| 规范 Revision + 投影/快照版本 | 继续 | 平衡规范锚点、审计、跨 Harness 投影和实际运行事实 |
| 纯事件溯源 | 暂缓 | 追加事件有价值，但不作为唯一当前状态模型 |
| 纯内容寻址 | 暂缓 | 可做完整性辅助，不能单独表达业务语义和权限变化 |
| 混合模型 | 继续 | 与 Work Thread、Manifest、Snapshot、Package 的既有边界一致 |

#### 阶段 4：专家团讨论

- **产品/价值**：支持“规范 Revision + 投影/快照版本”，但前台不应暴露大量孤立技术版本号，应解释当前工作版本、接手快照、运行快照和重新确认原因。
- **UX**：版本失效要用任务语言说明，例如权限变化、代码变化或证据撤回导致哪一项需要重新确认；区分信息更新、重新确认、操作阻断和审计查看。
- **架构/工程**：支持混合模型，但要求业务 Revision 与存储并发版本分离，明确哪些事件产生 WorkThreadRevision、投影兼容规则、迟到事件和版本压缩协议。
- **运维/可靠性**：必须保留实际提供给 Harness 的上下文、当时权限策略、代码/资源版本、执行和验证结果；高频 Trace 可分层存储，但不能破坏审计和血缘闭包。
- **安全/隐私**：历史 Snapshot 可以证明当时暴露了什么，但当前用户能否读取正文仍按当前 ACL 判断；历史存在性、元数据、正文、检索和执行资格必须分离。

专家团总体支持混合模型，并要求保留业务版本、并发版本、实际快照和局部失效的分离；同时认为版本压缩、事件重放、跨对象一致性和 Trace 绑定必须后续验证。

### 8. 本轮已批准结论与暂缓项

经用户确认，本轮批准：

1. 采用规范 Work Thread Revision、追加事件、投影版本和实际快照的混合版本模型；
2. Work Thread Revision 是规范业务状态锚点，不承担所有对象版本语义；
3. Manifest、Package、Snapshot、Handoff 和 Verification 各自保留版本或不可变记录，并绑定来源 Work Thread Revision；
4. L0、Work Thread Revision、Run Snapshot、已发送 Package、Handoff Acceptance、已执行动作和 Verification Result 不得静默覆盖；
5. Manifest、检索结果、治理建议和草稿 Package 可以重算，历史实际投影不得静默改写；
6. 业务 Revision 与数据库 Resource Version / 并发版本分开；
7. Branch、Merge、Reopen、Transfer、Derived 和纠错产生可追溯关系与新版本，不覆盖历史；
8. 版本变化按影响范围使相关 Handoff、Manifest、Approval、Verification 或 Action 失效，不无差别废弃整个 Work Thread；
9. 旧 Snapshot、Package、审计和血缘记录保留历史事实，当前正文可见性和使用资格按当前权限判断；
10. 版本压缩、归档和冷存储不得破坏审计与血缘闭包。

以下内容明确暂缓，留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| WorkThreadRevision、WorkStateRevision 等最终 Schema | 依赖统一对象模型和存储设计；留待以后讨论 |
| 顺序版本号、内容哈希和组合标识的最终方案 | 需要结合完整性、并发、性能和跨系统兼容性验证；留待以后讨论 |
| 哪些事件产生 WorkThreadRevision 的完整规则 | 依赖事件分类、状态机和实际运行数据；留待以后讨论 |
| 事件重放、迟到事件和补偿事件协议 | 依赖事件存储、一致性和纠错策略；留待以后讨论 |
| 多对象版本兼容和原子提交协议 | 依赖事务、事件系统和跨服务一致性；留待以后讨论 |
| 版本压缩、快照合并和冷存储细节 | 依赖保留策略、审计闭包和成本评估；留待以后讨论 |
| 版本失效传播和重新验证 SLA | 依赖风险等级、消费者和运营能力；留待以后讨论 |
| 用户版版本展示、差异和解释交互 | 属于后续 UX / IA 设计；留待以后讨论 |
| OpenTelemetry / Harness Trace 与 Work Thread Revision 的绑定协议 | 依赖 Connector 和跨 Harness 接入协议；留待以后讨论 |


### 一、阶段性结论总览

议题 1 当前已经形成原则层的连续性模型，但尚未形成可直接实施的完整 Schema、策略矩阵、接口协议和交互设计。当前共识如下：

1. **核心工作主体**：使用 `Work Thread` 表达跨成员、Agent、Harness 和 Session 持续存在的工作，不把 Chat Session、Harness Session、Run 或 Checkpoint 当作工作真源。
2. **执行与交接**：成员、Agent 和 Harness 都是 Executor；通过 `Continuation Package`、L1/L2/L3 恢复能力和显式 Handoff 维持工作连续性；接手者明确确认后责任才转移，交接不自动改变 canonical Owner。
3. **归属与责任**：Work Thread 只有一个 canonical owner，可归属于 Project 或 Team；Owner、Active Executor、Participant、Work Status 和责任状态分开建模。
4. **版本与审计**：Work Thread Revision、Checkpoint、Manifest、Run Context Snapshot、Continuation Package、Handoff、恢复尝试、权限决策、验证结果和纠错记录不可静默覆盖。
5. **拆分关系**：默认 Continue；同目标并行探索使用 Branch；结束后的独立新周期使用 Follow-up；治理边界变化使用 Derived Work Thread。三类关系使用 `WorkThreadRelation`、`ContextTransfer` 和 `LifecycleLink` 分离表达。
6. **合并冲突**：Branch 合并绑定共同基线，采用三方比较；M0 自动合并低风险变化，M1 生成候选并审核，M2 阻断并建立 `MergeConflict`；合并生成新 Revision，不覆盖分支历史。
7. **完成与终态**：完成验收采用通用骨架、场景模板和组织/行业扩展项；工作完成、验证完成、知识发布、风险关闭和后续工作完成分开表达。
8. **Reopen、Follow-up、Derived**：Reopen 用于纠正原完成/取消判定；Follow-up 用于相关新周期；Derived 用于目标、责任、权限、用途或生命周期边界变化。三者均需证据、预览、权限检查和重新计算 Manifest。
9. **归档与恢复**：归档不等于删除；保留状态与工作状态分开建模。查询、引用、工作和环境恢复分别授权，恢复不继承旧 Run、审批、工具权限或环境状态。
10. **终态权限**：Completed、Cancelled 和 Archived 后按当前主体、资源、动作、用途、作用域、敏感性、血缘、风险和策略重新授权；普通追加禁止，纠错使用追加式记录。
11. **自动化与治理 Agent**：自动化按 M0/M1/M2 分级；自动识别不等于转正，自动合并不等于采纳，治理 Agent 可以检测和建议，但不能替人执行高风险操作或绕过审批。

### 二、当前统一不变量

```text
Work Thread ≠ Chat Session / Harness Session / Run / Checkpoint
参与 ≠ 所有
认领 ≠ 责任转移
责任转移 ≠ Owner 转移
换 Harness ≠ 自动获得权限
复杂 ≠ 必须拆分
合并 ≠ 最后写入覆盖
完成 ≠ 验证完成
完成 ≠ 发布或可执行
归档 ≠ 删除
历史可见 ≠ 当前可执行
自动识别 ≠ 自动转正
治理 Agent 建议 ≠ 治理 Agent 执行
```

### 三、未决事项与留待以后讨论的原因

以下事项尚未固化，全部留待以后讨论：

| 未决事项 | 暂缓原因 |
|---|---|
| Continue、Branch、Follow-up、Derived 的数值阈值和行业差异 | 需要真实工作样本、误拆分/漏拆分数据和运营负担校准；留待以后讨论 |
| WorkThreadRelation、ContextTransfer、LifecycleLink 的最终 Schema | 依赖统一对象模型、血缘、权限和持久化架构；留待以后讨论 |
| Branch 多层嵌套、循环关系和完整合并实现 | 依赖图结构、版本协议和运行规模；留待以后讨论 |
| 字段级冲突算法、实时一致性和合并运行参数 | 需要结合证据模型、事件系统和实现验证；留待以后讨论 |
| 完成验收的具体场景字段、行业模板和证据等级 | 需要真实场景、行业规则和用户验证；留待以后讨论 |
| Reopen、Follow-up、Derived 的最终 UI、API 和通知协议 | 属于后续产品交互和接口设计；留待以后讨论 |
| 归档具体保留期限、冷存储和恢复失败 SLA | 依赖合规、成本、访问模式和基础设施能力；留待以后讨论 |
| 删除、匿名化、撤回和派生资产影响治理流程 | 依赖隐私、血缘、审计和跨空间策略；留待以后讨论 |
| 终态后的完整角色权限矩阵、委托、接管和 Break-Glass | 依赖企业权限模型、审批体系和运营责任；留待以后讨论 |
| 导出、删除、发布和高风险恢复的最终审批协议 | 依赖风险分级、合规要求和审计实现；留待以后讨论 |
| 自动化规则引擎、治理 Agent 触发条件、回滚和防绕过实现 | 需要真实 Trace、反馈、误判数据和风险校准；留待以后讨论 |
| Connector 能力差异、环境恢复和跨 Harness 运行协议 | 依赖外部 Harness、Connector 和环境适配能力；留待以后讨论 |
| 具体数据库 Schema、API、事件存储、索引、保留实现和 UI | 属于后续架构、接口和体验设计；留待以后讨论 |

## 子议题深化 5：拆分

本轮确认：

> **采用 `Continue / Branch / Follow-up / Derived` 四分法，并保留必要的 New Work Thread / related 关系；不使用单一 `parent_id` 或普通 Task 层级表达所有拆分，而使用 `WorkThreadRelation`、`ContextTransfer` 和 `LifecycleLink` 分离表达关系、上下文转移和生命周期传播。Continue 由目标、Owner、责任、权限、敏感性、用途、验收和生命周期边界共同判断；Branch 表示同一目标下的并行探索，必须绑定共同基线并显式比较、采纳、拒绝、保留参考或合并；Follow-up 表示原工作结束后的相关新周期，不恢复旧 Run、Prompt、审批或工具权限；Derived 表示目标、Owner、权限、敏感性、用途、验收、生命周期或合规责任发生实质变化，必须重新确认目标边界和授权。默认采用引用、选定证据、摘要或脱敏转移，不全量继承对话、权限、工具能力、审批和未验证推断；父子 Thread 状态默认独立，源变化和撤回通过 LifecycleLink 传播影响；自动识别只生成候选，高风险拆分、派生、Owner 变化、跨边界继承和自动合并需要授权主体确认。最终阈值、Schema、循环规则、传播协议、识别模型和 UI/API 留待以后讨论。**

### 1. 判定顺序与硬门禁

```text
普通推进，目标、Owner、责任、权限和用途连续 → Continue
同一目标下的并行方案、假设或实现路径 → Branch
原工作结束后的相关新周期 → Follow-up
目标、Owner、权限、敏感性、用途、验收、生命周期或合规责任实质变化 → Derived
已经完全独立且无需保持工作关系 → New Work Thread / related
```

以下任一变化禁止普通 Continue：

```text
tenant 边界变化
canonical Owner 变化
Project / Team 责任边界变化
权限或敏感性边界变化
独立合规审计
独立生命周期、验收或风险责任
用途发生实质变化
```

目标文本、参与者、Harness、工具、代码 revision、失败次数、时间间隔、阶段、上下文长度和资源范围只能作为候选信号，不能单独裁决拆分。

### 2. 三类关系对象

```text
WorkThreadRelation  → Branch、Follow-up、Derived、related、supersedes 等关系
ContextTransfer     → 证据和上下文的引用、选定、摘要、脱敏或转移
LifecycleLink       → 源变化、撤回、暂停或失效对目标的影响
```

关系对象至少绑定来源/目标 Revision、关系类型、原因、范围、用途、证据、策略版本和状态；不以普通 `parent_id` 替代。

### 3. Branch、Follow-up 与 Derived

Branch 基于共同 `base_revision` 并行探索，结果必须显式比较、验证并标记 `adopted`、`rejected`、`kept_as_reference`、`superseded`、`disputed` 或 `merged`。未验证 Branch 不得自动进入父 Thread 普通上下文、Team 长期记忆、知识资产发布或可执行计划。

Follow-up 适用于原 Thread 已完成、取消或归档后的相关新周期，引用历史结果和开放问题，重新定义目标、验收和 Owner；不纠正原完成判定，不恢复旧 Run、Prompt、审批、Tool Call 授权、环境连接或工具能力。原 Thread 保持终态，Follow-up 独立运行。

Derived 表示治理边界实质变化。必须明确 source/target scope、target Owner、用途、权限边界、敏感性、验收、血缘和派生策略，并重新进行权限、脱敏和验证；不复制源空间全部内容、权限、工具能力或审批。

### 4. 上下文继承、状态和纠正

默认转移优先级：

```text
引用 > 选定 Evidence > 摘要 > 脱敏派生 > 原文复制
```

不默认继承全部对话、原始日志、Prompt、凭据、旧 Run、旧审批、旧工具权限、源 ACL、未验证推断或环境连接。父子 Thread 状态独立；源撤回、权限收窄、关键证据失效或 Revision 变化可通过 LifecycleLink 使目标进入 `restricted`、`revalidation_required`、`blocked` 或 `superseded`，但不自动关闭或重开父子 Thread。

错误 Continue、Branch、Follow-up、Derived、重复创建或关系方向错误，通过 `correction`、`supersedes`、`reclassifies`、`merges` 或新的关系事件纠正；保留原判断、原因、纠正者、证据、生效 Revision 和影响对象，不删除历史。

### 5. 自动化边界

自动识别最多生成：

```text
continue_candidate
branch_candidate
follow_up_candidate
derived_candidate
```

不得自动改变 canonical Owner、扩大权限、复制敏感上下文、关闭父 Thread、创建可执行派生或合并未验证 Branch。高风险拆分、Derived、Owner 变化、跨边界继承和自动合并需要授权主体确认。

### 6. 第 1 轮完整流程记录

#### 阶段 1：头脑风暴

比较了 Continue/New Work Thread 二分法、四分法、普通 Parent/Child、Branch 内部对象与独立 Thread、全量继承/最小转移/引用/摘要/脱敏，以及父子状态独立或自动级联等方向；识别出误拆分、漏拆分、权限绕过、未验证上下文污染和关系循环等风险。

#### 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察到的机制 | 启发与局限 |
|---|---|---|
| [git-branch](https://git-scm.com/docs/git-branch)、[git-worktree](https://git-scm.com/docs/git-worktree)、[git-merge](https://git-scm.com/docs/git-merge) | 基于共同代码历史并行工作，通过共同祖先合并并显式处理冲突 | 支持 Branch 绑定共同基线；主要面向代码，不表达权限和责任 |
| [GitHub：Adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) | Sub-issue 拆解大型工作，父子关系可嵌套且有层级/数量限制 | 支持 Task 层级；不足以表达 Branch、Derived 和跨空间权限 |
| [GitHub：Creating issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) | `blocked by` / `blocking` 独立表达依赖 | 依赖不等于父子或 Owner |
| [Jira：Link work items](https://support.atlassian.com/jira-software-cloud/docs/link-issues/) | 支持 blocked、cloned、duplicated、implements、reviews、causes、relates 等有向关系 | 复制、依赖、实现、审查和因果不能由单一 parent_id 表达 |
| [Kubernetes：Owners and Dependents](https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/) | Owner、Dependent 与 labels/selectors 分开 | 规范 Owner、普通关联和生命周期传播应分开；资源语义不能直接覆盖人员责任 |
| Jira Issue Hierarchy、Linear Sub-issues | 本轮目标官方页面返回 404 | 不据此推断具体机制 |

#### 阶段 3：综合建议

| 方案 | 决策 | 理由 |
|---|---|---|
| Continue / New Thread 二分法 | 否决 | 无法表达并行、后续和派生 |
| 所有拆分使用 Parent / Child | 否决 | 混淆 Task、Branch、Follow-up 和 Derived |
| 四分法 | 继续 | 覆盖主要工作关系和生命周期边界 |
| 三类关系对象 | 继续 | 分离关系、上下文转移和生命周期传播 |
| 全量继承 | 否决 | 泄露、未验证污染和治理绕过风险高 |
| 最小选择性转移 | 继续 | 平衡连续性、权限和敏感边界 |
| 父子自动级联 | 否决 | 破坏独立生命周期和责任边界 |
| 父子独立 + LifecycleLink | 继续 | 支持撤回、失效和影响传播 |
| 自动直接拆分/合并 | 否决 | 误判和权限绕过风险高 |
| 自动生成候选 | 继续 | 支持发现但保留人工确认 |

#### 阶段 4：专家团讨论

- **产品/价值**：支持四分法；拆分必须解释原因并提供合并、关联和纠错。
- **UX**：用业务语言和判断问题引导；预览新 Thread、父状态、继承内容、权限变化、审批和源变化传播。
- **架构/工程**：支持三类关系对象；防止循环、多层 Branch 无限增长、Derived 反向覆盖源、Follow-up 继承旧审批和关系绕过 ACL。
- **运维/可靠性**：父子状态独立，但运营视图显示活动 Branch、Derived、Follow-up；关注撤回传播、关系数量和误拆分成本。
- **安全/隐私**：强制最小转移、重新授权、敏感性复核、脱敏、血缘和未来使用阻断；反对全量继承和自动跨 tenant 派生。

专家团总体支持“四分法 + 三类关系对象 + 硬门禁 + 最小转移 + 独立状态 + 候选自动化”，并认为阈值、循环规则、传播协议、识别模型和跨空间脱敏需后续验证。

### 7. 本轮已批准结论与暂缓项

经用户确认，本轮批准：

1. 采用 `Continue / Branch / Follow-up / Derived` 四分法，并保留必要的 New Work Thread / related 关系；
2. 不使用单一 `parent_id` 或普通 Task 层级表达所有拆分；
3. 使用 `WorkThreadRelation`、`ContextTransfer` 和 `LifecycleLink` 分离表达关系、上下文转移和生命周期传播；
4. Continue 由目标、Owner、责任、权限、敏感性、用途、验收和生命周期边界共同判断；
5. Branch 绑定共同基线，结果显式比较、采纳、拒绝、保留参考或合并；
6. Follow-up 是原工作结束后的相关新周期，不恢复旧 Run、Prompt、审批或工具权限；
7. Derived 表示治理边界实质变化，必须重新确认目标边界和授权；
8. tenant、Owner、权限、敏感性、合规责任和独立审计边界变化是 Continue 的硬门禁；
9. 默认采用引用、选定证据、摘要或脱敏转移，不全量继承对话、权限、工具能力、审批和未验证推断；
10. 父子 Thread 状态独立，源变化和撤回通过 LifecycleLink 传播，不自动级联关闭或重开；
11. 自动识别只生成候选，高风险拆分、派生、Owner 变化、跨边界继承和自动合并需要授权主体确认；
12. 错误拆分通过追加关系事件纠正，不删除原 Thread 或历史关系。

以下内容明确暂缓，留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| 四类关系的数值阈值和行业差异 | 需要真实工作样本和误拆分/漏拆分数据；留待以后讨论 |
| 三类关系对象的最终 Schema | 依赖统一对象、版本、权限和血缘模型；留待以后讨论 |
| Branch 多层嵌套、循环关系和数量限制 | 依赖图结构、运行规模和管理负担；留待以后讨论 |
| Follow-up 与 Incident、Task、RCA 的完整关联协议 | 依赖代码场景和知识化模型；留待以后讨论 |
| Derived 跨空间字段、脱敏和组合重识别算法 | 依赖权限、血缘和跨空间策略；留待以后讨论 |
| LifecycleLink 实时传播和一致性协议 | 依赖事件系统和运行规模；留待以后讨论 |
| 自动拆分识别模型、训练数据和候选指标 | 需要真实 Trace、反馈和治理结果；留待以后讨论 |
| 拆分向导、关系展示、继承预览和 API | 属于后续 UX、IA 和接口设计；留待以后讨论 |


```text
复杂 ≠ 必须拆分
换 Harness ≠ 必须拆分
多人参与 ≠ 必须拆分
Task ≠ Derived Work Thread
Work Branch ≠ Derived Work Thread
合并 ≠ 最后写入覆盖
完成 ≠ 删除
取消 ≠ 失败
归档 ≠ 删除
复开 ≠ 静默恢复旧现场
```

| 1 | Work Thread 是否采用显式创建与自动识别候选的混合模式 | **已确认** | 已记录于第 6 节 |
| 2 | Work Thread 与 Task、Execution、Session / Run、Checkpoint 的关系 | **阶段性确认** | 已记录于第 7 节；生命周期细节仍待讨论 |
| 3 | Work Thread 的规范归属：单一 Project / Team owner，还是多个 Project 共同持有 | **已确认** | 已记录于第 8 节 |
| 4 | Work Thread 的创建、认领、暂停、恢复、阻塞、取消、完成和归档 | **已确认** | 已记录于第 11 节：三组正交状态与动作级权限 |
| 5 | canonical owner、active executor、participant 与责任人的关系 | **已确认** | 已记录于第 10 节 |
| 6 | 交接的触发、发起、接手确认、拒绝、退回和责任生效时机 | **已确认** | 已记录于第 12 节：明确确认后责任才生效 |
| 7 | owner 转移、跨 Team / Project 转移及权限变化 | **已确认** | 已记录于第 13 节：受控 Transfer 与权限重新评估 |
| 8 | Continuation Package 的最小内容、生成时机和接手者投影 | **已确认** | 已记录于第 14 节：规范状态与接手者投影 |
| 9 | L1 语义续办、L2 操作续办、L3 环境续办的 V1 范围与验收标准 | **已确认** | 已记录于第 15 节：L1 保证、L2 可验证、L3 有限重连 |
| 10 | 多人、多 Agent、多 Harness 并行、分支、合并和冲突处理 | **已确认** | 已记录于第 16 节：证据追加、分支隔离与显式合并 |
| 11 | 交接、认领和恢复过程中的权限、敏感信息和审批约束 | **已确认** | 已记录于第 17 节：权限交集、按执行者投影与安全降级 |
| 12 | Work Phase、Checkpoint、Revision、Manifest、Run Snapshot 与 Continuation Package 的版本关系 | **已确认** | 已记录于第 18 节：六层模型与版本不变量 |
| 13 | Connector 的最小接入协议、能力声明和恢复失败告知 | **已确认** | 已记录于第 19 节：V1 最小协议；其他能力暂缓 |
| 14 | 如何验证“现场已恢复”：接手确认、恢复质量和可追溯指标 | **已确认** | A–F 已确认并记录于第 21–26 节；D、E、F 的暂缓事项均注明原因并留待以后讨论 |
| 15 | Work Thread 的拆分、派生、合并、完成、取消和归档规则 | **已确认** | 已记录于第 27 节；暂缓事项及原因均已注明并留待以后讨论 |

**当前推进位置：** 子议题深化 1“核心对象”、子议题深化 2“交接”、子议题深化 3“归属”、子议题深化 4“版本”、子议题深化 5“拆分”、子议题深化 6“合并”、子议题深化 7“终态后的详细权限矩阵”、子议题深化 8“自动拆分、自动合并和治理 Agent 介入规则”、子议题深化 9“对象、关系与最终 Schema 边界”、子议题深化 10“版本、事件与一致性”、子议题深化 11“拆分、派生与关系图”、子议题深化 12“合并算法与冲突解决的实现边界”、子议题深化 13“完成、恢复与生命周期实现边界”、子议题深化 14“权限、治理与高风险操作实现边界”、子议题深化 15“Connector、跨 Harness 运行与环境恢复协议”、子议题深化 16“Connector Contract V1 最终 Schema、错误码与兼容策略”和子议题深化 17“Connector 可信身份、能力认证、撤销与密钥轮换”、子议题深化 18“离线补发、缺口、乱序、重放与补偿的完整协议”和子议题深化 19“L3 环境恢复的幂等、安全和外部副作用边界”均已按当前流程完成并沉淀；子议题深化 20“MCP、A2A 与 Connector Contract 的具体映射和版本兼容”已完成第 1 轮并经用户确认沉淀；子议题深化 16–25 已按当前 Connector 暂缓项顺序完成当前轮次并经用户确认沉淀；Connector 暂缓清单阶段性完成，后续转入其他一级议题或跨议题实现依赖，按原有暂缓原因和顺序继续。

## 子议题深化 6：合并

**状态：已确认（第 1 轮）**

### 本轮确认

> **Branch 合并必须基于明确的共同基线和来源关系，采用三方比较与企业语义门禁，不使用最后写入者、最高置信度、最新时间、参与人数或模型投票直接裁决。先区分可合并差异、直接冲突、关系不明和已过期候选，再按事实、决策、约束、Owner、权限、敏感性、证据、生命周期、验收和血缘分别处置。M0 仅自动合并低风险、追加式且不冲突的变化；M1 生成候选并由有权限责任人明确审核；M2 对权限、Owner、敏感性、安全、生产、关键验证、基线不明、血缘断裂或组合后高风险的情况阻断并建立 `MergeConflict`。合并生成新的父 Thread Revision，保留所有参与分支历史；合并后重新验证权限、敏感性、血缘、Manifest、验收和执行资格。历史解决模式只能作为当前候选，不能绕过本次验证和治理。**

### 1. 阶段 1：头脑风暴

本轮比较了最后写入覆盖、最高置信度胜出、Git 式三方合并、证据汇聚后重生成结论和条件化并存，识别了事实、决策、约束、Owner、生命周期、范围、证据和验收冲突，并提出 M0/M1/M2 分级、合并后重新验证、`MergeConflict`、分支状态和防止低风险动作组合绕过高风险门禁等问题。

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [Git `git-merge`](https://git-scm.com/docs/git-merge) | 共同祖先上的三方比较；冲突显式停下；合并产生新历史节点 | 合并绑定共同基线，冲突显式建模，新结果不覆盖分支历史 | 主要处理文本/文件，不能直接表达 Owner、权限、敏感性和合规责任 |
| [Git `git-rerere`](https://git-scm.com/docs/git-rerere) | 复用历史人工解决模式 | 历史解决方式只能生成当前候选并重新验证 | 相似文本冲突不等于相同业务语义 |
| [GitHub Merge Queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) | 合并前检查最新基线、队列组合和集成结果 | 分支单独通过不够，必须验证合并后的组合状态；候选需过期重算 | 面向代码和 CI，不直接覆盖企业记忆治理 |
| [GitHub Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-branch-protection-rules/about-protected-branches) | 保护分支、限制高风险操作、要求检查通过 | 合并资格与普通写权限分离，高风险变化设置独立门禁 | 保护规则是仓库/分支维度，粒度不够表达主体、用途和敏感性 |
| [Kubernetes Server-Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/) | 多 applier 管理不同字段；同字段竞争显式冲突 | 可按语义单元记录贡献和冲突；强制接管应是显式高风险动作 | 字段管理不等于业务 Owner 或结论采纳权 |
| [Kubernetes API Concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/) | `resourceVersion` 防止过期写入 | 存储并发版本与业务 Revision 分离；提交前检测候选过期 | 只解决并发，不解决语义、权限和证据冲突 |
| [Jira Linked Work Items](https://support.atlassian.com/jira-software-cloud/docs/link-issues/) | blocked、duplicates、implements、reviews、causes 等关系独立表达 | 关系类型不能压缩为父子或覆盖；合并保留来源关系 | 工作关系本身不定义记忆冲突解决和权限传播 |
| [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)（既有模式） | 状态变化以事件序列追加并可重建 | 合并、采纳、拒绝、撤回和纠错采用追加事件 | 不定义权限、冲突解决、保留和删除策略 |

GitHub Pull Request Reviews 目标页本轮返回 404，未据此作具体结论；未将二手资料当作官方机制依据。

### 3. 阶段 3：综合建议

合并定义为：

> 在明确共同基线、来源关系、当前权限和合并策略的前提下，对多个 Work Thread Revision 的变化、证据与语义结论进行受控组合；合并生成新的父 Thread Revision，不覆盖参与分支，并对冲突、权限、敏感性、血缘和验收进行独立验证。

#### 3.1 合并对象

合并输入至少区分：

- 事实与观察；
- 决策与结论；
- 约束与禁令；
- Owner、Executor、Approver 和受影响范围；
- 状态与生命周期；
- Evidence、引用与血缘；
- 验收、验证和残余风险。

新生成的结论必须标记为新推断，不能伪装成来源事实。允许选择一方、双方并存、条件化采纳、汇聚证据后重生成、暂不统一或升级为新的 Derived Work Thread。

#### 3.2 三方比较与结果分类

每个 Merge Candidate 至少绑定：

```text
base_revision
left_revision / participant_revisions
merge_policy_version
manifest_version
concurrency_version
```

比较 `base → participant` 的变化，结果至少分为：

```text
mergeable_difference
direct_conflict
relationship_unknown
revalidation_required
```

共同基线不明时，不能用最新版本补齐；应进入 `needs_rebase`、`needs_recompute` 或 M2 `blocked_no_safe_base`。

#### 3.3 M0 / M1 / M2

```text
M0 自动合并
  低风险、追加式、不冲突、非敏感、范围不扩大且验证通过

M1 候选并人工审核
  条件化采纳、轻微不一致、多个假设、需要补充验证或人工判断

M2 阻断并升级
  Owner、权限、敏感性、用途、生产、安全、关键验收冲突，
  共同基线不明、血缘断裂、证据撤回或组合后形成高风险
```

M0 仍需记录输入、规则、事件、验证和结果；M1 不能把候选直接写成规范结论；M2 不能通过更高置信度、更新时间或更多参与者自动降级。

对象默认策略：Evidence 追加去重且保留来源；Hypothesis 保留候选；Decision 明确 adopted/rejected/superseded；Constraint 只能合并或收窄，不能自动放宽；Owner 冲突阻断；Action/Run Plan 不直接合并为可执行计划，必须重新生成并重新审批；Manifest 合并后重新计算。

#### 3.4 `MergeConflict` 与新 Revision

`MergeConflict` 至少记录：

```text
conflict_id
base_revision
participant_revisions
object_refs
conflict_dimensions
evidence_refs / counter_evidence_refs
risk_level
security_impact / ownership_impact / permission_impact
resolution_status
resolver / resolution_reason
required_verification
propagation_impact
```

合并结果采用：

```text
merge_revision = new parent Thread Revision
parents = participant revisions
base = base revision
```

分支历史保留，并分别标记 `adopted`、`rejected`、`superseded`、`kept_as_reference`、`disputed` 或 `preserved`。

### 4. 阶段 4：专家团讨论

- **分布式系统 / 版本控制**：支持共同基线、三方比较、新 Revision 和并发检查；要求区分基线不明与需要重新计算，并将合并计算和结果提交分开。
- **企业治理 / 权限合规**：支持 M2 和权限门禁；要求 Merge Package 采用最小披露，审核查看、解决、采纳和发布分开授权，防止合并成为跨空间越权出口。
- **知识工程 / 记忆质量**：支持事实、决策、约束、证据和验收分层；要求保留原始 Evidence，区分来源事实与新推断，并允许不统一合并而并列保留。
- **执行安全 / Agent 与 Harness**：支持合并后重新计算 Manifest、Tool Policy 和 RunGate；要求建议动作与允许动作分离，并记录已有外部副作用及补救责任。

专家团共识：三方比较优于最后写入或置信度胜出；`MergeConflict` 是一等对象；M0/M1/M2 需考虑组合风险；合并审核、知识发布、跨空间传播和执行资格必须分开；投影采用最小披露；历史解决模式不能绕过当前验证。

### 5. 经用户确认的结论

1. 合并必须绑定明确共同基线或可验证来源关系；
2. 采用共同基线上的三方比较，不使用最后写入、最高置信度、最新时间、参与人数或模型投票直接胜出；
3. 区分可合并差异、直接冲突、关系不明和候选过期；
4. M0 仅处理低风险、追加式且不冲突的变化；M1 生成候选并要求有权限责任人审核；M2 对高风险或基线/血缘问题阻断并建立 `MergeConflict`；
5. 合并生成新的父 Thread Revision，不覆盖分支、Evidence、Snapshot、Package、审计或验证历史；
6. 合并后重新计算 Owner、ACL、敏感性、用途、血缘、Manifest、验收、Tool Policy、RunGate 和执行资格；
7. 合并后的组合风险重新评估，不能通过多个 M0 动作绕过 M2；
8. 历史解决模式最多生成当前 `merge_candidate`，不能自动采纳；
9. Merge Package 和审核材料按主体、用途、Scope 和敏感性最小披露；
10. 合并结果中的新推断必须与来源事实、证据和验证结果分开表达；
11. 已发生的外部副作用不能用平台状态修改伪装回滚，必须保留补救和责任记录。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| `MergeCandidate`、`MergeConflict`、`MergePolicy` 最终 Schema | 依赖统一对象、权限和血缘模型；留待以后讨论 |
| 语义单元的最终字段粒度与跨字段约束 | 需要结合知识对象模型和真实冲突样本；留待以后讨论 |
| M0/M1/M2 的行业阈值与策略配置 | 需要真实运行数据、风险校准和运营负担评估；留待以后讨论 |
| 多分支合并算法、队列、公平性和超时 SLA | 依赖版本图、吞吐和运行规模验证；留待以后讨论 |
| 合并后的知识发布与跨空间传播协议 | 依赖自动知识化、权限治理和跨空间脱敏议题；留待以后讨论 |
| 事件历史压缩、冷存储和删除实现 | 依赖保留、合规、成本和审计闭包策略；留待以后讨论 |
| Merge UX、审核工作台、批量操作和 API | 属于后续 IA、UX 和接口设计；留待以后讨论 |
| 已发生外部副作用的补救协议 | 依赖 Connector、RunGate、Incident 和责任治理设计；留待以后讨论 |

核心不变量：

```text
合并 ≠ 最后写入覆盖
自动合并 ≠ 自动采纳
合并成功 ≠ 可执行
合并历史 ≠ 当前可见
分支保留 ≠ 分支结论全部有效
unknown ≠ 成功
审计存在 ≠ 审核者可读全部正文
```

## 子议题深化 7：终态后的详细权限矩阵

**状态：已确认（第 1 轮）**

### 本轮确认

> **Work Thread 进入 `completed`、`cancelled` 或 `archived` 后，权限不自动清零，也不自动完整保留，而是按当前主体、资源、动作、用途、作用域、敏感性、血缘、风险、当前策略、审批/委托和保留锁定重新计算。角色只提供职责骨架，最终采用动态条件授权。终态后禁止普通追加，纠错使用追加式 `correction_record`；查看摘要、正文、Evidence、血缘、审计、检索、上下文注入、执行、导出、发布、删除、Reopen、Follow-up、Derived、恢复和 Owner 变更分别授权。治理 Agent 只能检测、解释、建议和发起复核；Retention Worker 只能执行已批准的保留策略；Break-Glass 必须绑定 Incident、Scope、动作、时限和事后复核。历史可追溯不等于当前正文可见，Owner 不等于底层资源权限，参与或曾执行不产生永久导出、发布、恢复或删除权。**

### 1. 阶段 1：头脑风暴

本轮比较了终态后全部只读、Owner 保留全部管理权、固定 RBAC 矩阵和“角色骨架 + 动态条件授权”四种方向，识别了终态权限清零与纠错需求、Owner 与资源 ACL、历史审计与当前隐私、导出/发布/删除、撤回与血缘、管理员接管和 Break-Glass 等冲突。

初步确定权限动作至少分开为：

```text
view_existence / view_metadata / view_summary / view_detail
view_evidence / view_audit / view_lineage
retrieve / inject / execute
append_correction / request_reopen / approve_reopen
create_follow_up / create_derived
restore_work / restore_environment
export / share / publish / revoke
change_owner / change_retention_policy / delete
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [GitHub Organization Roles](https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/roles-in-an-organization) | 组织成员角色、仓库访问角色和管理职责分开 | 组织角色不等于每个 Work Thread 或 Evidence 的全部权限 | 面向组织和仓库，不能直接表达记忆血缘、撤回和派生知识 |
| [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) | Role、RoleBinding、主体、资源和动词分离；支持 Namespace/集群 Scope | 权限应按主体、资源、动作和作用域拆分，不能只有全局 admin | 主要是静态授权，不直接表达用途、敏感性、血缘和保留锁定 |
| [Jira Project Permissions](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) | Permission Scheme、Project Role 与用户/组关系分离；项目动作可分别控制 | 能进入 Project 不等于能读所有 Evidence；请求与批准应分开 | 主要面向项目和工作项，不能替代内容级脱敏和派生治理 |
| [ServiceNow Access Control Rules](https://www.servicenow.com/docs/bundle/washingtondc-platform-security/page/administer/security/concept/c_AccessControlRules.html) | 记录级、字段级 ACL，可结合主体、角色和条件判断 | 摘要、正文、敏感字段和审计字段可采用不同可见性；`redacted` 是授权结果 | ACL 机制本身不定义 Reopen、Derived、知识发布和撤回传播 |

本轮官方资料共同支持：角色、资源、动作和 Scope 分离；组织/Project 角色不能替代具体资源授权；管理、查看、纠错、导出、发布和删除应分开；静态 RBAC 需要和用途、敏感性、血缘、撤回及保留策略结合。未将产品角色名称直接复制为本平台角色，也未使用失效页面作具体结论。

### 3. 阶段 3：综合建议

#### 3.1 动态权限模型

```text
Effective Permission
= Principal
  ∩ Resource
  ∩ Action
  ∩ Purpose
  ∩ Scope
  ∩ Sensitivity
  ∩ Lineage
  ∩ Risk
  ∩ Current Policy
  ∩ Approval / Delegation
  ∩ Retention Lock
```

角色作为职责骨架，动态条件作为最终判定；权限决策需绑定策略版本、资源/Revision 版本、有效期和解释。

#### 3.2 终态后的默认边界

| 动作 | Completed | Cancelled | Archived |
|---|---|---|---|
| 查看摘要 | 允许，受当前 ACL | 允许，受当前 ACL | 允许，受当前 ACL |
| 查看正文/Evidence | 受用途、敏感性和 ACL 限制 | 同左 | 同左 |
| 查看审计/血缘 | 授权主体可见 | 授权主体可见 | 授权主体可见 |
| 普通追加 | 禁止 | 禁止 | 禁止 |
| 追加纠错 | 需权限、原因和证据 | 同左 | 需恢复检查 |
| 请求/批准 Reopen | 分别授权 | 分别授权 | 受控流程 |
| Follow-up / Derived | 重新授权、脱敏和血缘检查 | 同左 | 同左 |
| 工作/环境恢复 | 不自动允许 | 不自动允许 | 只能重算、重连或重建 |
| 导出/分享/发布 | 高度受限，独立门禁 | 同左 | 同左 |
| 删除 | 受保留锁定、血缘和合规策略 | 同左 | 同左 |

`completed`、`cancelled`、`archived` 只是工作生命周期，不替代当前权限、Retention State、Evidence 状态、Lineage 状态和 Approval 状态。

#### 3.3 主体边界

- **Canonical Owner**：可在自身授权范围内治理生命周期、请求或批准符合策略的操作；不自动获得底层资源、全部正文导出、跨空间发布或删除保留锁定内容的权限。
- **Previous Executor**：保留历史动作、Evidence 和判断的可追溯性；不因曾执行过获得永久 Reopen、导出、发布、Owner 变更、删除或旧工具/审批恢复权。
- **Auditor**：查看授权范围内的主体、时间、版本、策略、动作、验证和纠错事实；不自动获得全部正文或发布权。
- **Governance Agent**：只能 `detect / explain / propose / open_review / request_revalidation / track_impact`，不能替人 Reopen、改 Owner、授权、导出、发布、删除或执行生产动作。
- **Retention Worker**：只能执行已批准的保留、降级、匿名化或处置策略，不能自行改变策略或绕过 `legal_hold`。
- **Break-Glass 主体**：只能在绑定 Incident 的临时 Scope、动作和时限内执行，必须事后复核。
- **Derived Consumer**：只能使用目标 Thread 或资产已授权的投影，不能反向获得源 Thread 权限。

#### 3.4 访问结果与用途

统一支持：

```text
allowed / redacted / denied / unknown
stale / revalidation_required / blocked_by_retention
```

并保持以下边界：

```text
知道存在 ≠ 能看正文
能看正文 ≠ 能检索
能检索 ≠ 能注入 Harness
能注入上下文 ≠ 能执行动作
能执行动作 ≠ 能产生生产副作用
查看 ≠ 导出 ≠ 分享 ≠ 发布 ≠ 删除
```

#### 3.5 纠错、恢复、派生与处置

```text
普通追加 → 终态后禁止
纠错 → 追加 correction_record，绑定原记录、原因、证据、影响和纠正者
Reopen → 原完成/取消判定错误，生成新 Revision
Follow-up → 原工作结束后的新 Work Thread
Derived → Scope、Owner、用途、敏感性或责任边界变化，重新授权和脱敏
```

导出、发布和删除分别检查主体、用途、敏感性、跨空间边界、Evidence 撤回、血缘、保留锁定和批量组合影响。删除不压缩为单一布尔值，至少区分：

```text
block_future_use / restrict_access / revoke_derivation
anonymize / delete_content / retain_audit_fact
```

### 4. 阶段 4：专家团讨论

- **企业权限 / 合规**：支持动作级、资源级和用途级授权；审计者只看最小必要信息；`redacted` 不能通过错误信息、对象数量或时间差泄露正文。
- **平台架构 / RBAC 与 ABAC**：支持角色骨架加动态条件；Role、Grant、Policy Decision 和 Obligation 应分开；批量动作必须计算组合影响。
- **隐私 / 数据治理**：正文、摘要、Evidence、血缘和审计应采用不同可见性；跨空间派生默认从引用、摘要或脱敏开始；源撤回先阻断未来检索/注入，再治理已传播资产。
- **运维 / Incident 与 Break-Glass**：支持终态纠错、Reopen 和 Follow-up；Break-Glass 必须绑定 Incident、Scope、动作、期限和复核；外部副作用不能通过删除平台记录伪装回滚。

专家团共识：终态不等于权限清零，也不等于历史权限永久保留；角色只是职责骨架；当前 ACL 优先于历史角色；查看、纠错、恢复、导出、发布和删除必须分离；Governance Agent 与 Retention Worker 不得自行执行高风险授权或处置。

### 5. 经用户确认的结论

1. 终态后权限按当前主体、资源、动作、用途、Scope、敏感性、血缘、风险、策略、审批/委托和保留锁定重新计算；
2. 采用“角色骨架 + 动态条件授权”，不采用固定角色直接决定全部终态权限；
3. `view_existence`、`view_metadata`、`view_summary`、`view_detail`、`view_evidence`、`view_audit`、`view_lineage`、`retrieve`、`inject`、`execute`、`export`、`publish`、`delete` 等动作分别授权；
4. 终态后禁止普通追加；纠错采用追加式 `correction_record`；Reopen、Follow-up、Derived 和恢复分别建模；
5. Owner、Previous Executor、Participant、Auditor、Governance Agent、Retention Worker、Derived Consumer 和 Break-Glass 主体边界分开；
6. Owner 不自动拥有底层资源权限，参与或曾执行不产生永久导出、发布、恢复或删除权；
7. `allowed`、`redacted`、`denied`、`unknown`、`stale`、`revalidation_required` 和 `blocked_by_retention` 不得折叠；
8. 导出、分享、发布、删除和 Owner 变更需要独立门禁、影响评估和审计；
9. 当前 ACL 和用途限制优先于历史曾经拥有的权限；历史可追溯不等于当前正文可见；
10. 源撤回、保留锁定、活动血缘、安全调查和隐私请求必须参与终态处置；
11. Governance Agent 只能检测、解释、建议和发起复核；Retention Worker 只能执行已批准策略；Break-Glass 必须绑定 Incident 并事后复核；
12. 外部副作用不能通过修改或删除平台状态伪装撤销，必须保留实际结果和补救记录。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| Role、Grant、Policy Decision、Obligation 的最终 Schema | 依赖统一对象、权限和审计架构；留待以后讨论 |
| RBAC 与 ABAC/用途控制的最终职责边界 | 需要真实权限场景、策略数量和可解释性验证；留待以后讨论 |
| 字段级脱敏、检索和上下文注入的最终规则 | 依赖敏感性、血缘和知识化模型；留待以后讨论 |
| 批量导出、发布、删除的组合风险算法 | 需要结合批量操作、传播闭包和运营数据校准；留待以后讨论 |
| Owner 失效、管理员接管和 Break-Glass 的授权层级 | 依赖组织治理、Incident 和合规审批设计；留待以后讨论 |
| 撤回后 Snapshot、Package、Derived Asset 和 Harness 缓存治理 | 依赖 Connector、血缘传播和外部副作用协议；留待以后讨论 |
| Retention Worker 的匿名化、删除、冷存储失败补偿与幂等 | 依赖保留策略、存储实现和合规要求；留待以后讨论 |
| 完整角色矩阵、委托协议、导出格式、删除工作流和 UI/API | 属于后续治理架构、接口和 UX 设计；留待以后讨论 |

核心不变量：

```text
终态 ≠ 历史权限永久保留
Owner ≠ 底层资源权限
参与/执行 ≠ 永久导出权
查看 ≠ 检索 ≠ 注入 ≠ 执行
纠错 ≠ 普通追加
审计可见 ≠ 正文可见
Governance Agent 建议 ≠ 治理 Agent 执行
Retention Worker 执行策略 ≠ Retention Worker 制定策略
删除请求 ≠ 立即物理删除
```

## 子议题深化 8：自动拆分、自动合并和治理 Agent 介入规则

**状态：已确认（第 1 轮）**

### 本轮确认

> **自动化按风险、证据、可逆性、影响范围和权限边界分级，不把自动识别当作自动转正，不把自动合并当作自动采纳结论，也不把治理 Agent 的建议当作治理 Agent 的执行。M0 适用于低风险、可逆、证据充分且不改变 Owner、权限、安全边界或生产状态的预批准规则动作；M1 只生成候选、预览和待审核项，不自动改变责任、权限或生命周期；M2 对权限、Owner、敏感性、安全、生产、不可逆影响、基线不明、证据不足或高影响冲突进行阻断和升级。自动流程分离 Candidate、Admission、Approval、Execution、Verification 和 Adoption；失败或误判通过追加式 correction/reversal/supersedes 纠正，阻断受影响的检索、注入和执行，并评估已传播影响。治理 Agent 只能检测、解释、建议、发起审核和请求重验证，不能替人执行高风险操作或绕过审批。**

### 1. 阶段 1：头脑风暴

本轮比较了自动化优先、全部人工和风险分级自动化，识别了自动拆分误判、自动合并错误采纳、治理 Agent 越权、低风险动作组合绕过门禁、自动重试产生副作用和失败后责任不清等问题。

自动动作区分为：

```text
detect / classify
propose / open_review
admit / approve
execute / verify
adopt / restrict / reverse / escalate
```

核心边界：

```text
automatic identification ≠ automatic promotion
automatic merge ≠ automatic adoption
proposal ≠ approval
approval ≠ execution
execution ≠ verification
verification ≠ publication
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [GitHub Actions Automatic Token Authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication) | 自动化运行使用受范围约束的 Token 权限 | 自动动作采用最小 capability；运行权限不等于业务结果采纳或知识发布权 | 面向 API Token，不解决记忆语义、血缘和人工采纳 |
| [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) | 规则按目标和条件控制操作，满足门禁才允许或拒绝 | Agent 建议之外要有版本化、可审计的策略准入层 | 面向仓库/分支，不能直接表达敏感性和跨空间传播 |
| [Kubernetes Admission Controllers](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/) | 请求持久化前进行验证、修改或拒绝；认证授权后、持久化前执行 | 候选生成后仍须在最终写入前重查 ACL、Owner、敏感性、策略和风险 | API 准入不解决证据质量、知识采纳和跨对象传播 |
| [ServiceNow Flow Designer](https://www.servicenow.com/docs/bundle/washingtondc-servicenow-platform/page/administer/flow-designer/concept/flow-designer.html) | 用触发器、条件、动作和子流程编排自动化 | 触发、判断、候选、执行和验证应分别建模；流程中的高风险节点需独立门禁 | 流程编排本身不保证业务授权和累计风险正确 |

本轮官方机制共同支持：自动动作需要最小且显式的权限；规则准入与 Agent 建议分开；最终提交前要有独立准入；触发、判断、候选、批准、执行和验证分别记录；单个低风险步骤的组合不能自动视为低风险；策略变化、失败或过期后必须重验证。

### 3. 阶段 3：综合建议

#### 3.1 M0 / M1 / M2

```text
M0：低风险、可逆、证据充分、范围明确、无权限/Owner/敏感性/生产变化
     → 按预批准规则自动执行

M1：存在不确定性、轻微冲突或需要业务判断
     → 只生成候选、预览和审核请求

M2：涉及权限、Owner、敏感性、安全、生产、不可逆影响、基线不明、
     证据不足或组合后高风险
     → 阻断并升级授权 / 审批
```

M0 仍须记录规则、输入、策略、执行和验证；M1 不得改变责任、权限或生命周期；M2 不得通过模型置信度、时间新旧或多个参与者自动降级。

M0 可覆盖不冲突的追加式 Evidence、可验证重复去重、低风险元数据、低风险 Checkpoint、Manifest 刷新、撤回内容标记为 `restricted`、标记 `revalidation_required` 和发送通知。自动拆分、Branch 合并候选、事实/决策冲突、Owner 失效、脱敏和知识发布建议默认 M1。Owner、权限、敏感性、生产、安全、导出、发布、删除、责任转移和不可逆动作默认 M2。

#### 3.2 自动识别、合并和治理 Agent

自动识别最多生成：

```text
continue_candidate
branch_candidate
follow_up_candidate
derived_candidate
merge_candidate
revalidation_candidate
retraction_impact_candidate
```

自动合并仅限不冲突、追加式、非敏感、范围不扩大且已验证的低风险变化；不得直接裁决事实、RCA、Decision、Owner、权限、敏感性、安全约束、生产计划或未验证结论。

治理 Agent 可以：

```text
detect / classify / explain / propose
open_review / request_revalidation / track_impact / notify
```

默认不能：

```text
confirm_handoff / change_owner / grant_permission
weaken_constraint / publish / export / delete
execute_production_action / bypass_approval
```

#### 3.3 Candidate—Admission—Execution—Verification—Adoption

```text
Candidate / Proposal
  → Policy Admission
  → Permission + Scope + Risk Check
  → Approval（如需）
  → Execute
  → Verify
  → Adopt / Restrict / Reverse / Escalate
```

执行成功不等于业务结果正确，验证成功不等于获得知识发布资格。每次自动动作至少绑定触发事件、规则/Agent 身份、策略版本、Capability、输入 Revision、Evidence、风险级别、影响对象、决策、执行结果、验证结果、重试、纠正和传播影响。

#### 3.4 防止组合绕过

单动作和批量动作均须计算：权限、Owner、敏感性、跨空间传播、血缘闭包、生命周期、外部副作用和累计风险。组合后达到更高等级时必须升级：

```text
M0 / M1 → M2
```

不能以“每个动作单独已批准”绕过组合门禁。

#### 3.5 失败、误判和外部副作用

```text
保留原事件和决策
  → correction / reversal / supersedes
  → 阻断受影响的检索、注入和执行
  → 评估传播闭包
  → 可逆回滚或补偿
  → 重新验证 Owner、ACL、血缘、Manifest 和状态
  → 通知责任主体并复盘
```

外部副作用分别记录平台状态、外部结果和补偿状态；不能通过修改平台状态伪装外部动作已回滚。

### 4. 阶段 4：专家团讨论

- **自动化平台 / 可靠性**：支持 M0/M1/M2；要求候选、准入、执行和验证分开，自动动作具备幂等、过期、重试和补偿边界。
- **企业治理 / 安全**：支持治理 Agent 只检测、解释、建议和发起审核；规则版本、授权主体、用途和 Scope 必须绑定每次自动决策。
- **知识工程 / 质量**：支持自动生成候选，但模型置信度不能替代事实可信度；自动生成结论必须标记为新推断，采纳、测试成功和发布分开记录。
- **运维 / 外部副作用**：支持绑定 Incident 的低风险自动止损；外部动作必须记录实际结果和补偿，Break-Glass 不能通过多个小动作扩大能力。

专家团共识：自动识别、自动合并、治理 Agent 建议均不能直接等同于规范状态变化；M0/M1/M2 要同时考虑组合影响；Candidate、Admission、Approval、Execution、Verification 和 Adoption 必须分开；高风险责任、权限、发布、删除、生产动作和不可逆操作进入 M2。

### 5. 经用户确认的结论

1. 自动化按风险、证据、可逆性、影响范围和权限边界分为 M0/M1/M2；
2. 自动识别只生成候选，不自动转正；
3. 自动合并只处理低风险、不冲突、追加式变化，不自动采纳事实冲突、RCA、Decision、Owner、权限、安全约束或生产计划；
4. 治理 Agent 只能检测、分类、解释、建议、发起审核、请求重验证和跟踪影响；
5. Candidate、Admission、Approval、Execution、Verification、Adoption、Reverse 和 Escalate 分开建模；
6. M0 必须绑定预批准规则、最小 Capability、策略版本、输入 Revision、Evidence、影响范围、幂等和失败处理；
7. M1 不自动改变 Owner、权限、责任或生命周期；
8. M2 对高风险、不可逆、基线不明、证据不足、权限/Owner/敏感性冲突和组合后高风险进行阻断升级；
9. 自动动作失败或误判通过 correction/reversal/supersedes 追加纠正，阻断受影响使用并评估传播；
10. 外部副作用独立记录实际结果和补偿状态，不能用平台状态修改伪装回滚；
11. 批量动作必须重新计算累计风险和传播闭包，防止多个低风险动作绕过高风险门禁。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| M0/M1/M2 的数值阈值和行业差异 | 需要真实 Trace、风险事件和运营负担校准；留待以后讨论 |
| 自动识别模型、训练数据和评价指标 | 需要真实误拆分、漏拆分、误合并和治理结果；留待以后讨论 |
| `AutomationPolicy`、`Candidate`、`Admission`、`Decision` 最终 Schema | 依赖统一对象、权限和审计模型；留待以后讨论 |
| 规则引擎与治理 Agent 建议的最终冲突裁决 | 需要组织委托、策略优先级和可解释性验证；留待以后讨论 |
| 批量动作的组合风险和传播闭包算法 | 依赖血缘图规模、性能和跨空间传播策略；留待以后讨论 |
| 自动动作的重试、超时、幂等和补偿协议 | 依赖 Connector、外部副作用和事件系统；留待以后讨论 |
| 治理 Agent 的组织级委托和低风险自动规则配置 | 依赖权限治理和审计责任设计；留待以后讨论 |
| 错误候选已被 Harness 执行后的止损与责任复核 | 依赖 RunGate、Incident 和外部副作用协议；留待以后讨论 |
| 自动知识发布与议题 5 发布门禁的完整集成 | 依赖知识化、血缘、权限和跨空间脱敏设计；留待以后讨论 |
| UI、API、规则管理台和运营 SLA | 属于后续架构、产品和体验设计；留待以后讨论 |

核心不变量：

```text
自动识别 ≠ 自动转正
自动合并 ≠ 自动采纳
治理 Agent 建议 ≠ 治理 Agent 执行
Candidate ≠ Admission ≠ Execution ≠ Verification ≠ Adoption
执行成功 ≠ 业务结果正确
验证成功 ≠ 知识发布资格
多个低风险动作 ≠ 允许绕过高风险门禁
平台状态回滚 ≠ 外部副作用已回滚
unknown ≠ 成功
```

## 子议题深化 9：对象、关系与最终 Schema 边界

**状态：已确认（第 1 轮）**

### 本轮确认

> **采用“规范对象 + 追加事件 + 不可变快照 + 派生投影”的分层模型。WorkThread、WorkState、Task、WorkPhase、Execution、Revision、Evidence、关系、候选、准入、决定、权限和实际运行记录分别表达不同语义，不把所有历史、权限、关系和投影嵌入单一 WorkThread 大对象，也不将每个字段过度碎片化为独立业务对象。`WorkThreadRelation`、`ContextTransfer` 和 `LifecycleLink` 分开建模；Candidate、Admission、Decision、Execution 和 Verification 分开建模；Schema 版本、业务 Revision、策略版本和存储并发版本分开。Schema 校验通过不等于动作获准、结果验证成功或知识可以发布。历史 Revision、Evidence、Decision、Snapshot 和 AuditRecord 不静默覆盖，未知字段和未知状态不得当作成功。**

### 1. 阶段 1：头脑风暴

本轮比较了单一 WorkThread 大对象、所有概念独立持久化和“规范对象 + 追加事件 + 快照 + 投影”三种方向，识别了对象过度混杂、过度碎片化、事务边界、权限审计、关系循环、Schema 演进和历史不可变性等问题。

初步对象分层为：

```text
规范核心：WorkThread / WorkState / Task / WorkPhase / Execution / Revision
证据与验证：Evidence / Checkpoint / CorrectionRecord / VerificationResult
关系与责任：WorkThreadRelation / ContextTransfer / LifecycleLink / Handoff
           OwnershipAssertion / OwnershipTransfer
候选与治理：Candidate / MergeCandidate / MergeConflict / MergePolicy
           AutomationPolicy / Admission / Decision
权限与治理：Role / Grant / PolicyDecision / Obligation / Approval
           Delegation / BreakGlassGrant
投影与运行：ContextManifest / RunContextSnapshot / ContinuationPackage
           RecoveryAttempt / AuditRecord
```

核心边界：

```text
规范对象 ≠ 完整历史
Candidate ≠ Decision
Policy ≠ PolicyDecision
Manifest ≠ RunContextSnapshot
Schema 校验通过 ≠ 业务动作获准
Execution ≠ Verification
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [JSON Schema](https://json-schema.org/specification) | 声明数据类型、必填项、枚举、引用和条件约束 | Schema 表达结构契约和静态约束，不承载全部流程与授权逻辑 | 不定义事件顺序、并发、审计和业务状态机 |
| [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) | 分离资源、操作、参数、请求/响应和安全要求 | 资源 Schema 与动作 API 分离；查看、纠错、合并、发布和删除不共用无差别更新接口 | 不自动解决事件溯源、跨对象一致性和权限传播 |
| [Kubernetes API Concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/) | 元数据、规范、状态和 ResourceVersion 分离；声明与观察结果分开 | WorkThread、WorkState、并发版本和业务 Revision 分离；异步动作需要期望/实际/验证结果 | ResourceVersion 只解决并发，不解决业务冲突和权限 |
| [Kubernetes Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) | 通过 CRD 扩展对象，支持版本化 Schema 和控制器状态 | 领域对象保持独立并通过关系连接；扩展采用明确版本，不把未来能力塞入核心对象 | 依赖 Kubernetes 控制器模型，不提供完整企业血缘和权限语义 |
| [GitHub GraphQL / REST](https://docs.github.com/en/graphql) / [REST](https://docs.github.com/en/rest) | 资源、关系、事件和操作接口分离；不同投影暴露不同字段 | Canonical Object 通过角色投影输出；关系和动作拥有明确 API | 面向代码协作，不能直接覆盖记忆敏感性、用途和撤回闭包 |

本轮官方资料共同支持：Schema 契约、业务状态机、事件历史、权限决策和实际快照分层；资源、关系和动作分离；Schema 版本与业务 Revision、策略版本、存储并发版本分开；未知和兼容策略显式处理。

### 3. 阶段 3：综合建议

#### 3.1 分层模型

```text
Canonical Object
  → 当前规范业务状态

Append-only Event
  → 变化、决策、纠错和审计事实

Immutable Snapshot
  → 某次 Run、Handoff、Package 或验证实际使用/产生的内容

Derived Projection
  → 当前权限、检索、治理、角色和 Harness 投影
```

建议的语义层级为：

```text
L0：WorkThread / WorkState / Task / WorkPhase / Execution
L1：Revision / Evidence / Checkpoint / CorrectionRecord / VerificationResult
L2：WorkThreadRelation / ContextTransfer / LifecycleLink / Handoff
    OwnershipAssertion / OwnershipTransfer
L3：Candidate / MergeCandidate / MergeConflict / MergePolicy
    AutomationPolicy / Admission / Decision
L4：Role / Grant / PolicyDecision / Obligation / Approval / Delegation
L5：ContextManifest / RunContextSnapshot / ContinuationPackage
    RecoveryAttempt / AuditRecord
```

以上是语义边界，不是最终数据库表拆分。

#### 3.2 核心对象责任

- **WorkThread**：身份、canonical Owner、目标/Scope、当前规范 Revision、生命周期、责任状态、保留状态和风险摘要；不嵌入全部历史、Evidence、Handoff 和投影。
- **WorkState**：某个 Revision 下的目标、范围、Task/Phase、状态、责任、进度、风险、约束和开放问题。
- **Evidence**：来源、内容或受保护引用、时间、Scope、支持/反驳关系、敏感性、有效性、撤回和争议状态；不因新结论出现而删除。
- **Revision**：业务版本、父版本、产生原因、输入 Evidence、变更摘要、影响范围、策略和验证引用；不替代存储并发版本。
- **WorkThreadRelation**：Thread 之间的 `branch_of`、`follow_up_of`、`derived_from`、`supersedes`、`related_to` 关系。
- **ContextTransfer**：上下文的 `none`、`selected`、`summarized`、`redacted`、`reference_only` 转移方式，以及用途、敏感性、权限决策和重验证要求。
- **LifecycleLink**：源变化、撤回、限制、归档或替代对目标的传播策略、通知策略和重验证策略。
- **Candidate / Admission / Decision**：分别表达待确认候选、提交前准入和有权主体的采纳/拒绝/升级决定。

三类关系不能由一个 `parent_id` 或 `inherit_context` 布尔字段替代。

#### 3.3 版本与兼容

统一区分：

```text
schema_version   → 结构契约版本
object_revision  → 业务对象版本
policy_version   → 策略版本
resource_version → 存储并发版本
```

演进原则：新字段不能把缺失当作成功；删除字段需经历弃用和兼容期；历史对象保留原 Schema 版本；Projection 可以重算但历史实际 Snapshot 不改写；关系方向和来源/目标不能静默改变；未知字段、状态和策略结果保持 `unknown`；高风险对象必须显式记录失效和迁移状态。

#### 3.4 合并与自动化对象

`MergeCandidate` 绑定 `base_revision`、参与 Revision、合并策略、候选变化、冲突引用、风险预览和验证要求；`MergeConflict` 记录冲突类型、基线值、参与值、证据/反证、风险、Scope、解决人、解决结果和验证；`MergePolicy` / `AutomationPolicy` 记录 Scope、触发条件、允许动作、风险、Evidence、可逆性、审批、失败/重试/补偿和有效期。

策略不是实际决定，决定不是实际执行，执行不是验证结果。

### 4. 阶段 4：专家团讨论

- **数据架构 / 事件系统**：支持规范对象、事件、快照和投影分离；反对巨型 WorkThread JSON；要求明确事务、事件顺序、幂等和投影重建边界。
- **API / 平台工程**：支持资源、关系和动作 API 分离；Candidate、Admission、Decision、Execution 不共用无差别更新接口；Schema、业务 Revision 和并发版本独立。
- **安全 / 权限**：支持关系对象绑定 Scope、Purpose、Sensitivity 和 Policy Version；反对默认继承源权限；Evidence、正文、审计和投影分别授权。
- **产品 / UX**：支持内部对象分层，但前台应展示工作、关系、证据、决定、风险和下一步，不直接暴露全部技术对象图。

专家团共识：采用“规范对象 + 追加事件 + 快照 + 投影”；WorkThread 不承担全部历史和权限；关系、候选、准入、决定、执行和验证分离；Schema 版本、业务 Revision、策略版本和并发版本分离；对象拆分必须能解释责任和用途。

### 5. 经用户确认的结论

1. 采用规范对象、追加事件、不可变快照和派生投影的分层模型；
2. WorkThread 不承载全部历史、Evidence、权限、关系和投影；
3. WorkThread、WorkState、Task、WorkPhase、Execution、Revision、Evidence、Handoff、恢复和验证对象分别表达不同语义；
4. `WorkThreadRelation`、`ContextTransfer`、`LifecycleLink` 分开建模；
5. Candidate、MergeCandidate、MergeConflict、MergePolicy、AutomationPolicy、Admission、Decision 分开建模；
6. Role、Grant、PolicyDecision、Obligation、Approval、Delegation 和 Break-Glass 语义分离；
7. Schema 版本、业务 Revision、策略版本和存储并发版本分开；
8. Schema 校验通过不代表动作获准、执行成功、业务结果正确或知识可发布；
9. 历史 Revision、Evidence、Decision、Snapshot 和 AuditRecord 不静默覆盖；
10. 关系对象和派生对象重新授权，不默认继承源对象权限；
11. 未知字段、未知状态和未知策略结果保持 `unknown`，不能静默视为成功；
12. 最终数据库表、字段、事务、事件和 API 仍需在后续实现设计中确定。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| WorkThread、WorkState、Revision 等最终数据库 Schema | 依赖统一对象、事件、权限和持久化架构；留待以后讨论 |
| 三类关系对象的最终字段、索引和状态机 | 需要结合血缘、生命周期、查询和传播规模验证；留待以后讨论 |
| Candidate、Admission、Decision 和 Execution 的统一状态机 | 依赖自动化策略、审批、事件和执行模型；留待以后讨论 |
| 各对象独立持久化还是嵌入式值对象 | 需要结合事务边界、查询模式和运营复杂度取舍；留待以后讨论 |
| Schema 兼容、迁移、弃用和版本压缩协议 | 依赖历史数据规模、保留策略和跨服务兼容；留待以后讨论 |
| 多对象写入的原子性、事件顺序和投影重建 | 依赖事件系统、一致性和故障恢复设计；留待以后讨论 |
| 关系循环、对象爆炸和无效投影治理 | 需要图结构、运行规模和运营指标验证；留待以后讨论 |
| 统一 API 采用资源导向、事件导向还是命令导向 | 属于后续接口与架构设计；留待以后讨论 |
| 字段级 ACL、Lineage、Retention 和审计索引 | 依赖权限、血缘、保留和查询架构；留待以后讨论 |
| UI 中的对象投影、Schema 演进提示和错误解释 | 属于后续 UX / IA 设计；留待以后讨论 |

核心不变量：

```text
规范对象 ≠ 完整历史
Schema ≠ 状态机
Schema 校验通过 ≠ 动作获准
Candidate ≠ Decision
Policy ≠ Policy Decision
Decision ≠ Execution
Execution ≠ Verification
Manifest ≠ Run Snapshot
业务 Revision ≠ 并发 Resource Version
关系 ≠ 上下文转移
上下文转移 ≠ 权限继承
历史快照不可静默改写
unknown ≠ 成功
```

## 子议题深化 10：版本、事件与一致性

**状态：已确认（第 1 轮）**

### 本轮确认

> **采用“业务 Revision + 追加事件 + 不可变实际快照 + 派生投影”的混合模型。Schema 版本、业务 Revision、策略版本、存储/API 并发版本和执行 Trace 分开。事件必须支持幂等、重复、迟到、乱序、隔离、补偿和审计；接收、应用、验证和外部副作用分别记录。平台规范 Revision、父关系、状态变化、审计事件和 Outbox 需要明确原子边界；Manifest、Package、搜索、治理和血缘投影可以最终一致，但必须绑定来源 Revision、投影版本和生成状态。基于过期版本的高风险动作不得静默继续；版本压缩和冷存储不能破坏历史快照、权限、血缘和审计闭包。**

### 1. 阶段 1：头脑风暴

本轮比较了单一递增版本号、纯事件溯源和“规范 Revision + 追加事件 + 快照/投影”三种方向，识别了迟到、乱序、重复、补偿、多对象原子性、外部副作用和版本压缩等问题。

统一区分：

```text
schema_version          结构契约版本
work_thread_revision    规范业务状态版本
object_revision         重要对象自身版本
policy_version          权限/合并/自动化/验收策略版本
resource_version        存储/API 并发版本
event_sequence          事件流顺序或游标
run_context_snapshot    某次 Run 实际使用的上下文
external_revision       外部代码/文件/资源版本
trace_id / span_id      实际执行路径关联
```

事件时间至少区分 `occurred_at`、`observed_at`、`ingested_at`、`applied_at` 和 `verified_at`；事件结果至少区分 `received`、`accepted`、`applied`、`duplicate`、`late`、`out_of_order`、`rejected`、`quarantined`、`superseded` 和 `compensated`。

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [Git References](https://git-scm.com/book/en/v2/Git-Internals-Git-References) | refs 指向对象/提交；parent 形成历史图；当前引用移动不等于历史删除 | Branch、Merge、Reopen、Derived 形成版本图；当前指针与历史对象分离 | 面向代码对象，不能表达权限、Evidence 撤回和运行快照 |
| [Kubernetes API Concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/) | `resourceVersion` 用于资源变化识别和并发控制；规范、状态和元数据分开 | 并发版本与业务 Revision 分离；过期写入重新检查 | 不解决业务冲突、权限和证据语义 |
| [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/) | Trace 由 parent-child Span、属性和事件组成，描述实际执行路径 | Execution、Run、Tool Call 和外部动作可关联 Trace；Trace 不替代业务状态 | 不定义业务版本、权限、血缘和完成判定 |
| [Apache Kafka Delivery Semantics](https://kafka.apache.org/documentation/#semantics) | at-most-once、at-least-once、exactly-once 等交付语义；重试影响重复和顺序 | 事件接收、应用和副作用分开；事件有 ID、幂等键和来源游标 | 消息交付语义不等于跨系统业务效果只发生一次 |
| [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)（既有模式） | 状态变化以事件序列保存并可重建投影 | Revision、Merge、Transfer、Reopen 和纠错采用追加记录 | 不定义事件顺序、权限、冲突、保留和删除策略 |

本轮官方/既有模式共同支持：业务版本、并发版本、Schema、策略和 Trace 分离；事件接收、应用、验证和外部副作用分开；重复、迟到、乱序和重试不能直接覆盖当前状态；快照表达实际事实，投影表达当前重算结果。

### 3. 阶段 3：综合建议

#### 3.1 版本分离

```text
Schema Version
  结构契约版本

Business Revision
  Work Thread / Object 规范业务版本

Policy Version
  权限、合并、自动化和验收策略版本

Concurrency Version
  数据库/API 并发控制版本

Execution Snapshot / Trace
  某次实际执行使用和产生的版本事实
```

#### 3.2 事件最小结构

```text
event_id / event_type / event_schema_version
aggregate_type / aggregate_id / aggregate_revision
parent_event_id / causation_id / correlation_id
idempotency_key / producer
occurred_at / observed_at / ingested_at
payload_ref / policy_version / source_revision
security_context
```

重复事件以 `event_id` 和 `idempotency_key` 去重，不重复推进 Revision 或产生业务副作用。迟到事件保留原始发生时间；影响当前结论时生成新 Revision、标记 stale 或进入 Merge Candidate。无法安全排序的事件进入 quarantine，不能用最后到达事件覆盖当前状态。

#### 3.3 Revision 触发边界

通常产生规范 Revision：

```text
目标、Scope、Owner、责任状态变化
Work Status 关键变化
Task / Phase 关键变化
Branch / Merge / Reopen / Transfer / Derived
关键约束、验收或风险变化
```

通常只追加 Evidence/审计事件：

```text
普通工具结果、低风险日志、通知、读取动作、非规范 Trace、重复事件
```

可能触发局部失效但不改变主 Revision：

```text
Evidence 撤回、Manifest 过期、权限策略变化
Connector 能力变化、外部资源 revision 变化
```

相关 Snapshot、Package、Approval、Verification 和 Action 可进入 `stale`、`invalidated`、`revalidation_required` 或 `blocked`。

#### 3.4 原子性与最终一致性

平台内部规范提交的原子单元为：

```text
new WorkThreadRevision
parent revisions
state transition
causation / correlation
audit event
outbox event
```

Manifest、Package、Search Index、Governance Projection、Lineage Projection 和 Notification 可以最终一致，但必须记录 `source_revision`、`projection_version`、`generated_at`、`generation_status` 和失败原因。

外部副作用必须分开记录：

```text
platform_intent
external_request
external_result
verification_result
compensation_record
```

#### 3.5 版本绑定

- **Merge**：`base_revision`、参与 Revision、`merge_policy_version`、候选版本和结果 Revision；
- **Handoff**：来源 Revision、Manifest、Package、Handoff、权限策略和确认版本；
- **Permission Decision**：主体、资源、动作、用途、Scope、策略版本、资源 Revision、决定、Obligation 和有效期；
- **Automation**：触发事件、输入 Revision、策略、Candidate、Admission、Execution 和 Verification；
- **Run**：Work Thread Revision、Manifest、Run Snapshot、资源版本、Tool Policy、Harness Capability 和 Trace。

基于过期版本的高风险动作进入 `revalidation_required`，不能静默继续。

#### 3.6 版本压缩与冷存储

允许生成可验证压缩快照、迁移旧事件到冷存储并保留版本范围、哈希、父子关系和审计索引；不允许删除活动血缘仍引用的事实、用压缩快照替代实际 Run Snapshot、丢失策略/权限/验证关系或让冷存储绕过当前 ACL。

### 4. 阶段 4：专家团讨论

- **事件系统 / 分布式一致性**：支持业务 Revision、事件、并发版本和快照分离；规范 Revision、父关系、审计和 Outbox 需要明确原子边界；迟到事件不能静默回写。
- **数据架构 / 审计**：支持追加事件和不可变实际快照；时间字段必须分离；事件重放不能替代“当时实际暴露了什么”的 Snapshot；压缩不能破坏血缘和审计闭包。
- **API / Harness 集成**：支持业务 Revision 与 Resource Version 双重保护；Run、Handoff、Merge 和自动动作绑定输入版本；Trace 只能关联执行事实。
- **产品 / 运营**：前台不直接展示大量技术版本号；应解释“基于过期现场”“需要重新确认”“证据已撤回”等业务原因，并区分当前状态、历史事实和执行快照。

专家团共识：采用混合版本模型；事件支持幂等、迟到、乱序、隔离和补偿；平台规范提交具备原子边界；投影可最终一致但必须绑定来源版本；外部副作用独立记录；过期版本不能用于高风险动作。

### 5. 经用户确认的结论

1. 采用业务 Revision、追加事件、不可变 Snapshot 和派生 Projection 的混合模型；
2. Schema 版本、业务 Revision、策略版本、存储并发版本和执行 Trace 分开；
3. 事件支持唯一 ID、幂等键、重复识别、迟到、乱序、隔离、补偿和审计；
4. 事件接收、应用、验证和外部副作用分别记录；
5. 关键规范 Revision、父关系、状态变化、审计事件和 Outbox 处于明确原子提交边界；
6. Manifest、Package、搜索、治理和血缘投影可以最终一致，但绑定来源 Revision、投影版本和生成状态；
7. 迟到或乱序事件不得使用最后到达原则覆盖当前规范状态；
8. 基于过期 Revision 的高风险 Merge、Transfer、Reopen、自动动作和外部操作必须重新验证；
9. 外部副作用独立记录请求、结果、验证和补偿，平台状态不能伪装外部动作已回滚；
10. 版本压缩和冷存储不能破坏历史 Snapshot、权限、血缘、审计和实际执行事实；
11. Trace 关联执行路径，但不单独决定业务状态、完成或结论正确性。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| 哪些事件产生 Work Thread Revision 的完整规则 | 依赖事件分类、状态机和真实运行数据；留待以后讨论 |
| 迟到事件进入新 Revision、Merge Candidate 还是补偿流的判定 | 需要结合业务影响、冲突模型和运营能力；留待以后讨论 |
| 多对象 Revision 的原子提交实现 | 依赖事务、事件系统和跨服务一致性；留待以后讨论 |
| 事件重放遇到策略变化时使用历史策略还是当前策略 | 依赖权限、治理和合规要求；留待以后讨论 |
| Outbox、事件总线、投影失败和补偿协议 | 依赖基础设施选型和故障恢复设计；留待以后讨论 |
| 版本压缩、快照合并、冷存储和完整性证明 | 依赖保留、成本、审计闭包和存储实现；留待以后讨论 |
| OpenTelemetry / Harness Trace 的采样、脱敏和长期保留 | 依赖 Connector、审计和隐私策略；留待以后讨论 |
| 外部副作用幂等键、重试和补偿协议 | 依赖 RunGate、Connector、Incident 和责任治理；留待以后讨论 |
| 版本失效与重新验证 SLA | 依赖风险等级、消费者和运营能力；留待以后讨论 |
| 版本差异、过期解释和事件补偿的 UI/API | 属于后续接口、运营和 UX 设计；留待以后讨论 |

核心不变量：

```text
Schema Version ≠ Business Revision
Business Revision ≠ Resource Version
Policy Version ≠ Decision
Trace ≠ Business State
Snapshot ≠ Current Manifest
事件交付成功 ≠ 事件应用成功
事件应用成功 ≠ 业务结果正确
重复事件 ≠ 新业务动作
迟到事件 ≠ 最后写入覆盖
平台请求成功 ≠ 外部副作用成功
版本压缩 ≠ 历史事实消失
unknown ≠ 成功
```

## 子议题深化 11：拆分、派生与关系图

**状态：已确认（第 1 轮）**

### 本轮确认

> **采用受约束的类型化有向关系图。`WorkThreadRelation` 表达 Thread 之间的业务关系，`ContextTransfer` 表达受控上下文/证据转移，`LifecycleLink` 表达源变化、撤回和限制对目标的影响；三者不互相替代。Branch、Follow-up、Derived、Dependency、Causal 和 Related 关系分别建模，禁止自环和关键关系循环，关系可达、上下文可达、血缘可达、权限可达和生命周期影响闭包分开计算。跨 Scope、Project、Team 或 tenant 的 Derived 必须重新授权、脱敏、建立血缘并由目标方接受；关系存在不等于内容可见、权限继承或可执行资格。自动识别只生成关系候选，不自动污染正式关系图。**

### 1. 阶段 1：头脑风暴

本轮比较了严格树结构、完全自由图和受约束类型化有向图，识别了多层嵌套、循环、关系爆炸、ACL 绕过、跨空间派生、撤回传播和自动候选污染等问题。

关系至少分为：

```text
连续性：continue / branch_of / follow_up_of / derived_from
协作：related_to / blocks / blocked_by / depends_on
结果语义：causes / caused_by / implements / reviews / duplicates / supersedes
生命周期与血缘：source_of / references / retracted_from / propagates_to
```

核心边界：

```text
关系 ≠ 上下文转移
上下文转移 ≠ 权限继承
关系可达 ≠ 内容可见
血缘可达 ≠ 正文可读
生命周期影响 ≠ 自动关闭或重开
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [Git Branch](https://git-scm.com/docs/git-branch) / [Git Merge](https://git-scm.com/docs/git-merge) | Branch 从历史点形成并行线；Merge 通过共同祖先组合；分支历史不因合并消失 | `branch_of` 绑定共同基线和独立生命周期，不自动传播 Owner、权限或全部上下文 | 主要面向代码历史，不表达敏感性、撤回和企业责任 |
| [GitHub Sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) | 父 Issue 与 Sub-issues 分解大型工作；层级和数量受产品约束 | Task 分解、Branch、Derived、Follow-up 分离；父子关系不自动继承全部权限 | 主要表达工作分解，不覆盖 Evidence、脱敏、撤回和血缘 |
| [Jira Linked Work Items](https://support.atlassian.com/jira-software-cloud/docs/link-issues/) | blocked、clones、duplicates、implements、reviews、causes、relates 等类型化关系 | 关系类型决定语义，不能压缩成单一 parent_id；不同关系采用不同传播和查询规则 | 工作关系不定义上下文转移、敏感性和跨空间派生 |
| [Kubernetes Owners and Dependents](https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/) | OwnerReference、Dependent、labels/selectors 和生命周期语义分开 | canonical Owner、普通关系和 LifecycleLink 分离；关系存在不代表控制权 | 资源控制器模型不能直接覆盖人的责任和记忆撤回 |
| [Kubernetes NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/) | 选择器和规则控制网络可达与允许动作；多条规则组合影响有效结果 | 关系可达、内容可达和动作可达分开；组合后重新计算有效权限并默认拒绝越权 | 网络规则不直接解决血缘、事实有效性和责任转移 |

本轮资料共同支持：关系类型化；层级、Owner、Dependency 和普通关联分离；关系图具备深度、数量和循环约束；图上可达性不等于内容可见、权限继承或可执行资格；多关系组合后需要重新计算传播和权限闭包。

### 3. 阶段 3：综合建议

#### 3.1 受约束关系图

关系对象至少包含：

```text
relation_id
relation_type
source_ref / target_ref
source_revision / target_revision
source_scope / target_scope
purpose / sensitivity
policy_version
status
created_by / created_at
effective_at / expired_at
audit_refs
```

不同关系还必须有类型专属字段和状态机，不能用一个通用关系表完全替代。

#### 3.2 传播矩阵

| 关系 | 上下文默认传播 | 权限默认传播 | 生命周期影响 | 是否允许循环 |
|---|---:|---:|---:|---:|
| `branch_of` | 选择性 | 否 | 按策略 | 否 |
| `follow_up_of` | 引用/选定摘要 | 否 | 通知/重验证 | 否 |
| `derived_from` | 选定/摘要/脱敏 | 否 | 可传播撤回/限制 | 否 |
| `related_to` | 否 | 否 | 否 | 可有关联环，但不参与传播闭包 |
| `blocks` | 否 | 否 | 显式处理 | 不允许自循环 |
| `depends_on` | 否 | 否 | 可产生阻塞影响 | 不允许循环依赖 |
| `causes` | 否 | 否 | 可产生因果影响 | 通常不允许循环 |
| `supersedes` | 否 | 否 | 可标记旧对象过期 | 否 |

默认传播不是授权结果，仍需检查当前 ACL、Purpose、Sensitivity、Retention 和 Policy。

#### 3.3 硬约束与软约束

硬约束：明确 source/target 和版本；禁止自环；`branch_of`、`follow_up_of`、`derived_from`、`supersedes` 和业务依赖/因果关系不得形成循环；关系不改变 canonical Owner、不自动继承源权限、不绕过目标 ACL；跨 Scope、Project、Team 或 tenant 重新授权；LifecycleLink 不自动关闭或重开目标。

软约束：Branch/Derived 深度、单 Thread 关系数量、单次传播边数、跨空间派生数量、并行 Branch 数量和查询/传播预算。软约束先配置为策略与治理指标，不提前固化未经校准的统一数值。

#### 3.4 关系生命周期

- **Branch**：`proposed → active → merged / rejected / preserved / abandoned`，绑定基线、探索目标、Owner、继承/排除上下文和合并策略；
- **Follow-up**：`proposed → active → completed / cancelled / archived`，关联触发原因、新目标和新验收，不恢复旧 Run、Prompt、审批或工具权限；
- **Derived**：`candidate → approved → active → restricted / completed / cancelled / archived`，绑定 Source/Target Scope、Target Owner、Purpose、Sensitivity、Lineage 和派生策略；
- **Related / Dependency**：`proposed → active → expired / revoked / superseded`，撤销保留原因、生效版本和影响记录。

#### 3.5 Incident、Task、RCA 关联

Incident 是工作场景或外部对象，不自动等于 Work Thread；Task 是 Thread 内可验收目标，也可通过明确关系关联其他 Thread；RCA 可以是 Work Phase、Task、Evidence 集合或独立 Derived Thread，依据 Owner、验收、生命周期和权限判断。Follow-up 可以关联 Incident、RCA 和 Task，但不自动恢复旧执行权限；`causes`、`implements`、`related_to` 和 `follow_up_of` 不可互换，外部对象版本和可访问性需保留。

#### 3.6 跨空间 Derived

跨空间 Derived 必须定义 Source/Target Scope、Target Owner 和 Purpose，选择具体 Evidence 与 ContextTransfer，执行敏感性和组合重识别检查，生成最小派生内容，建立血缘与撤回策略，由目标方接受，并重新计算目标 ACL、Manifest 和执行资格。默认优先级：

```text
reference_only > selected_evidence > summary > redacted_derivation > raw_copy
```

原文复制不是默认路径；目标无权接收时排除、限制或阻断。

#### 3.7 图查询与自动候选

关系图至少区分：

```text
relation_visibility
context_reachability
lineage_reachability
lifecycle_impact_closure
permission_reachability
```

查询和传播绑定当前 Revision、ACL、Purpose、Sensitivity 和 Retention，并设置深度、边数和时间预算；记录跳过、拒绝、过期和未知节点；`unknown` 不当作可达或不可达的成功结论。

自动识别最多生成：

```text
continue_candidate / branch_candidate / follow_up_candidate
 derived_candidate / relation_candidate / possible_cycle
possible_duplicate / possible_cross_scope
```

正式关系建立前检查方向、Scope、Owner、权限、ContextTransfer、LifecycleLink、循环、传播预算和审批要求。

### 4. 阶段 4：专家团讨论

- **图模型 / 数据架构**：支持受约束有向图；反对统一树或无限自由图；要求循环、深度、数量和传播预算约束；共同元数据加类型专属字段。
- **安全 / 血缘**：支持 Relation、ContextTransfer、LifecycleLink 分离；关系可达不等于内容可达，更不等于权限继承；跨 Scope 派生必须重新授权、脱敏和目标接受。
- **可靠性 / 运维**：支持 Incident、Task、RCA 关系分开；传播可暂停、重试和补偿；图异常不能自动关闭或重开 Thread；记录未知节点和外部对象过期。
- **产品 / UX**：支持内部关系图，前台用来源、派生、阻塞、后续、相关等业务语言解释；自动候选提供确认、拒绝、纠正和影响预览。

专家团共识：采用受约束类型化有向图；三类对象分离；禁止自环和关键关系循环；不同可达性闭包分开；跨空间派生重新授权、脱敏、建血缘并由目标接受；自动识别只生成关系候选；关系传播可审计、可暂停和可补偿。

### 5. 经用户确认的结论

1. 采用受约束的类型化有向关系图，不采用无限自由图或单一树；
2. `WorkThreadRelation`、`ContextTransfer`、`LifecycleLink` 分开建模；
3. Branch、Follow-up、Derived、Dependency、Causal、Related 和 Supersedes 关系分别建模；
4. 禁止自环和关键关系循环，深度、数量和传播边数先作为策略配置与治理指标；
5. 关系可达、上下文可达、血缘可达、权限可达和生命周期影响闭包分开；
6. 关系存在不等于内容可见、权限继承、责任转移或可执行资格；
7. 跨 Scope、Project、Team 或 tenant 的 Derived 必须重新授权、脱敏、建血缘并由目标接受；
8. Follow-up 与 Incident、Task、RCA 可关联但不自动等同，也不恢复旧执行权限；
9. LifecycleLink 不自动关闭或重开目标，关系传播失败、撤回和纠错必须可审计、可暂停和可补偿；
10. 自动识别只生成关系候选，不自动污染正式关系图；
11. 关系撤销保留原因、生效版本和影响记录，不删除历史关系。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| 各关系类型的最终 Schema 和状态机 | 需要结合统一对象、事件、权限和生命周期模型；留待以后讨论 |
| 多层 Branch、Derived、Follow-up 的最终深度和数量限制 | 需要真实关系图规模、管理负担和传播性能数据；留待以后讨论 |
| 循环检测的写入时阻断、异步治理及混合策略 | 依赖图规模、事务边界和治理延迟要求；留待以后讨论 |
| `related_to` 的无向存储、双向投影和关系类型转换 | 需要查询、索引、审计和兼容性验证；留待以后讨论 |
| Incident、Task、RCA 与 Work Thread 的完整关联协议 | 依赖代码场景、RCA 对象和外部系统集成；留待以后讨论 |
| 跨空间 Derived 的重识别算法和人工审核标准 | 依赖敏感性、组合重识别样本和跨空间治理；留待以后讨论 |
| LifecycleLink 的实时传播、暂停、重试和补偿协议 | 依赖事件系统、血缘图和运行规模；留待以后讨论 |
| 关系图查询性能、缓存和权限过滤实现 | 属于后续数据架构、索引和 API 设计；留待以后讨论 |
| 关系候选的误报、漏报和运营指标 | 需要真实自动识别 Trace 和人工纠正数据；留待以后讨论 |
| 关系图的最终 UX、影响预览和批量治理操作 | 属于后续 UX / IA 和运营设计；留待以后讨论 |

核心不变量：

```text
关系 ≠ 上下文转移
上下文转移 ≠ 权限继承
关系可达 ≠ 内容可见
血缘可达 ≠ 正文可读
关系存在 ≠ 责任转移
父子关系 ≠ 同一生命周期
LifecycleLink ≠ 自动关闭或重开
Derived ≠ 源权限复制
自动候选 ≠ 正式关系
unknown ≠ 成功
```

## 子议题深化 12：合并算法与冲突解决的实现边界

**状态：已确认（第 1 轮）**

### 本轮确认

> **合并采用语义单元为主、字段和对象为辅助、合并后跨单元约束验证的模型。`MergeCandidate` 表达一次尚未采纳的合并计算，`MergeConflict` 表达无法由当前规则安全消解的具体冲突，`MergePolicy` 表达适用范围、策略和门禁；三者分开。N 方合并基于共同基线计算各方变化和全局约束，不以简单顺序两两合并作为规范算法。M0/M1/M2 由硬门禁、风险维度、策略和组合影响共同决定；历史冲突解决模式只能生成当前候选。合并采纳、知识发布、跨空间传播和外部执行分开；合并后重新验证权限、敏感性、血缘、验收和执行资格。**

### 1. 阶段 1：头脑风暴

本轮比较了全文/摘要级、字段级和语义单元级合并，识别了摘要覆盖事实、字段过细造成伪冲突、跨字段约束、N 方顺序依赖、批量组合风险、历史模式复用和外部副作用补救等问题。

建议的合并流水线：

```text
选择参与分支
  → 锁定共同基线和输入 Revision
  → 解析 Evidence / Manifest / Policy
  → 规范化对象与语义单元
  → 计算各方相对基线变化
  → 分类差异、冲突、关系不明和过期候选
  → 计算单项与组合风险
  → 生成 Merge Candidate
  → Policy Admission
  → M0 自动 / M1 审核 / M2 阻断
  → 生成新 Revision
  → 重新验证 ACL、敏感性、血缘、Manifest、验收和执行资格
  → 采纳、保留参考、拒绝或升级
```

冲突类型至少包括：

```text
fact / decision / constraint / scope / owner / permission
sensitivity / evidence / lifecycle / acceptance / lineage
base / action
```

值不同不一定是冲突，也可能是不同时间、环境、Scope 下均成立，或一方是事实、一方是推断，或一方已撤回/过期。

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [Git `merge-tree`](https://git-scm.com/docs/git-merge-tree) | 不直接修改工作树即可计算合并并报告冲突；计算与写入分离 | 先生成 Candidate 和冲突预览，再提交新规范 Revision；计算本身不改主 Thread | 主要处理文件内容，不处理权限、敏感性、Owner 和血缘 |
| [Git Merge Strategies](https://git-scm.com/docs/merge-strategies) | 不同合并策略影响共同祖先和结果；策略与结果分离 | `MergePolicy` 独立记录策略、适用范围和版本；策略变更使旧 Candidate 重算 | 面向代码树，不覆盖语义冲突和企业门禁 |
| [GitHub Merge Queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) | 合并前结合目标基线和队列组合检查；组合或基线变化需重新验证 | Candidate 绑定基线、参与集合和检查版本；队列变化使候选过期 | 面向代码/CI，不定义记忆语义、Evidence 权限和跨空间传播 |
| [Kubernetes Server-Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/) | 不同 manager 管理不同字段；同字段竞争显式冲突；强制接管是特殊动作 | 可记录语义单元来源和管理者；强制采纳单独高风险、可审计 | 字段所有权不能替代业务结论、Evidence 和跨字段约束 |
| [Git `rerere`](https://git-scm.com/docs/git-rerere) | 记录并复用历史人工冲突解决；当前结果仍需确认 | 历史解决模式降低审核成本，但只能生成当前 Candidate | 文本相似不等于业务上下文相同，不能变成永久授权 |

本轮资料共同支持：合并计算、冲突预览和最终提交分阶段；策略不是结果；候选绑定基线、参与版本、策略和检查版本；N 方组合变化要重新验证；历史解决只能辅助当前候选。

### 3. 阶段 3：综合建议

#### 3.1 三类对象分工

**MergeCandidate** 表达一次尚未最终采纳的合并计算：

```text
candidate_id
 target_thread
base_revision
participant_revisions
participant_relations
merge_policy_version
input_manifest_versions
candidate_changes
conflict_refs
risk_preview
required_verification
status
expires_at
created_by / created_at
```

状态至少包括：

```text
draft / computed / needs_revalidation / needs_review
blocked / approved / committed / cancelled / expired
```

**MergeConflict** 表达具体冲突：

```text
conflict_id
candidate_id
conflict_type
semantic_unit_refs
base_value
participant_values
evidence_refs / counter_evidence_refs
scope
risk
security_impact / permission_impact / ownership_impact
resolution_status
resolver / resolution_reason
required_verification
```

解决状态至少包括：

```text
open / under_review / needs_more_evidence
resolved / coexist / conditional / rejected / superseded / blocked
```

**MergePolicy** 表达适用范围、策略和门禁：

```text
policy_id
scope
object_types / semantic_unit_types
allowed_strategies
risk_class
hard_gates
required_evidence / required_approvals
revalidation_rules / batch_rules
expiry
policy_version
```

Policy 不记录本次具体决定，不替代 Candidate 或 Conflict。

#### 3.2 语义单元与等价性

语义单元至少包括：

```text
observation / fact / inference / hypothesis
 decision / constraint / owner_assertion
permission_assertion / risk / acceptance_claim
 evidence_reference / action_proposal
```

每个单元绑定 `semantic_unit_id`、类型、subject、Scope、Purpose、有效时间、观察时间、支持 Evidence、反驳关系、Sensitivity 和状态。比较前先检查主体身份、Scope、Purpose、有效时间、环境、资源/代码 Revision、依赖版本和单元类型；边界不足时不得自动判为同一冲突对象。

#### 3.3 N 方合并

N 方合并基于共同基线：各方计算相对基线变化，规范化语义单元，进行两两与全局约束比较，形成可合并差异和多方冲突集合，再计算组合风险并生成一个新的父 Revision。不得将顺序两两合并作为规范算法，以免结果依赖合并顺序。

允许的解决方式：

```text
adopt_one
adopt_multiple_with_conditions
create_new_resolution
keep_as_hypotheses
coexist
keep_as_reference
reject
escalate
```

#### 3.4 M0/M1/M2

**M0** 必须满足：共同基线明确；只涉及低风险语义单元；无 Owner、ACL、Sensitivity、Purpose 或 Scope 变化；Evidence 充分、未撤回、未过期；无直接冲突和跨单元约束违反；无外部副作用；结果可逆；当前策略、权限和并发版本匹配；自动验证通过。

**M1** 适用于条件化采纳、轻微不一致、假设并存、需要人工确认适用条件或补充低风险验证；只能生成候选，不直接改变 Owner、权限、生命周期或发布状态。

**M2** 命中 Owner、ACL、Scope、tenant、Sensitivity、生产、安全、合规、不可逆动作、关键 Evidence 撤回、血缘断裂、基线/对象身份不明、关键验收/RCA/Decision/约束冲突、可见性或用途扩大、组合风险升高或外部补救不明时阻断。

硬门禁优先于风险总分；不以置信度、时间新旧或参与人数降级 M2。

#### 3.5 批量合并与历史模式

批量合并先做单项准入，再做批次组合准入，检查权限闭包、敏感性组合、Scope 扩张、血缘传播闭包、Owner/生命周期变化、外部副作用和累计风险。组合风险升高时整批升级、拆批或阻断，不能逐项 M0 后直接完成。

历史冲突解决模式仅在对象/语义类型、基线结构、Scope、Purpose、Sensitivity、策略、Evidence 和验证状态相容且当前仍通过门禁时生成候选；涉及 Owner、ACL、生产、安全、合规或不可逆动作不得自动复用。

#### 3.6 知识发布与外部副作用

合并成功不等于知识发布。发布前重新检查 Source Lineage、Target Scope/Owner、Purpose、Sensitivity、脱敏、重识别、Evidence 有效性、撤回状态和发布审批。合并结果先保持为 `work_revision`、`verified_candidate` 或 `reference_only`，通过知识化和跨空间发布门禁后才能成为 Wiki、Skill、RCA、Template 或 Team L3。

涉及外部动作时分别记录 `merge_decision`、`external_intent`、`external_request`、`external_result`、`verification`、`compensation` 和 `responsibility_review`；新 Merge Revision 不等于外部动作完成或回滚。

### 4. 阶段 4：专家团讨论

- **版本控制 / 算法**：支持共同基线上的 N 方差集合并；反对顺序两两合并作为规范算法；要求区分基线不明、对象身份不明和需要 Rebase。
- **知识工程 / 语义质量**：支持语义单元，但身份不能只靠文本相似度；Scope、时间、环境和条件参与等价性；并存和条件化是一等结果。
- **安全 / 治理**：支持 M2 硬门禁；Merge Package 最小披露；批量合并计算传播闭包；采纳、发布、跨空间传播和执行分开。
- **运行时 / 外部副作用**：支持 Candidate、Admission、Execution、Verification 分离；过期、重试、幂等和补偿独立处理；不复用旧 Tool Policy、审批或执行资格。

专家团共识：采用语义单元合并；三类对象分开；N 方以共同基线和全局约束为基础；M0/M1/M2 综合硬门禁、风险、策略和组合影响；历史模式只能生成当前候选；合并采纳、知识发布、跨空间传播和外部执行分离。

### 5. 经用户确认的结论

1. 采用语义单元为主、字段和对象为辅助、合并后执行跨单元约束验证；
2. `MergeCandidate`、`MergeConflict`、`MergePolicy` 分开建模；
3. N 方合并基于共同基线和全局约束，不以简单顺序两两合并作为规范算法；
4. 语义单元等价性考虑主体、Scope、Purpose、有效时间、环境、资源/代码 Revision、依赖和类型；
5. M0/M1/M2 由硬门禁、风险维度、策略和组合影响共同决定，硬门禁优先；
6. 批量合并先单项准入，再进行批次组合风险与传播闭包检查；
7. 历史冲突解决模式只能生成当前候选，不能绕过当前门禁；
8. 合并采纳、知识发布、跨空间传播和外部执行分别授权和审计；
9. 合并后重新验证权限、敏感性、血缘、Manifest、验收和执行资格；
10. 外部副作用独立记录请求、结果、验证、补偿和责任复核；
11. 合并 Candidate 过期、重算、取消和阻断必须保留历史，不静默覆盖。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| `MergeCandidate`、`MergeConflict`、`MergePolicy` 最终字段和索引 Schema | 依赖统一对象、版本、权限和血缘架构；留待以后讨论 |
| 语义单元唯一身份、规范化和相似度算法 | 需要真实冲突样本、知识对象模型和可解释性验证；留待以后讨论 |
| N 方冲突图与全局约束求解实现 | 依赖算法复杂度、图规模和运行性能；留待以后讨论 |
| M0/M1/M2 行业、Work Phase 和策略阈值 | 需要风险数据、误判成本和运营负担校准；留待以后讨论 |
| 批量合并整批升级、拆批或部分提交规则 | 依赖事务边界、组合风险和用户操作模型；留待以后讨论 |
| 历史冲突模式的兼容性证明和安全复用算法 | 依赖基线、权限、敏感性和验证数据；留待以后讨论 |
| 合并结果进入知识发布与议题 5 门禁的完整协议 | 依赖知识化、血缘、权限和跨空间脱敏设计；留待以后讨论 |
| 合并与外部副作用的幂等、补偿和责任协议 | 依赖 Connector、RunGate、Incident 和责任治理；留待以后讨论 |
| Candidate 过期、重算、取消和审核 SLA | 依赖运行规模、风险等级和运营能力；留待以后讨论 |
| 合并工作台、批量审核、差异解释和 API | 属于后续 UX / IA 和接口设计；留待以后讨论 |

核心不变量：

```text
合并计算 ≠ 合并提交
MergePolicy ≠ MergeCandidate
MergeCandidate ≠ MergeConflict
字段差异 ≠ 业务冲突
顺序两两合并 ≠ N 方规范合并
自动合并 ≠ 自动采纳
合并采纳 ≠ 知识发布
知识发布 ≠ 跨空间授权
平台状态成功 ≠ 外部副作用成功
历史解决模式 ≠ 当前授权
M0 单项通过 ≠ 批次组合安全
unknown ≠ 成功
```

## 子议题深化 13：完成、恢复与生命周期实现边界

**状态：已确认（第 1 轮）**

### 本轮确认

> **采用正交状态 + 任务级结论 + 受控转换。工作状态、交付物、验证、验收、风险、知识发布、后续工作、保留和恢复分别建模，由当前 Task、Work Phase、风险等级、证据和权限计算 `Canonical Work Conclusion` 与 `Canonical Recovery Result`。Reopen 用于纠正原完成/取消判定，Follow-up 用于原工作结束后的新周期，Derived 用于治理边界实质变化；三者不恢复旧 Run、Prompt、审批、Tool Policy、旧环境或旧执行资格。归档、冷存储、受限和待处置与 Work Status 分离；删除是受保留锁定、血缘、隐私和安全调查约束的多阶段流程，`pending_disposal` 不等于已删除。撤回先阻断未来检索、上下文注入和新执行，再治理派生资产、发布内容和外部影响。恢复区分查询、引用、工作和环境层级，失败、部分成功和未知必须结构化表达。**

### 1. 阶段 1：头脑风暴

本轮比较了单一生命周期状态机、多个互相独立但没有汇总规则的状态，以及“正交状态 + 任务级结论 + 受控转换”，识别了完成与验证混淆、归档与删除混淆、Reopen/Follow-up/Derived 混淆、删除与血缘冲突、恢复部分成功和未知结果等问题。

初步状态分层为：

```text
work_status: candidate / active / paused / blocked / completed / cancelled / archived
deliverable_status: not_started / in_progress / ready / accepted / accepted_with_exceptions / rejected
verification_status: not_attempted / pending / verified / partially_verified / failed / unknown / expired
risk_status: none_identified / open / mitigated / accepted / residual_risk_open / closed / unknown
publication_status: not_applicable / not_ready / candidate / approved / published / restricted / retracted
retention_state: online / archived / cold / restricted / pending_disposal
recovery_state: not_attempted / restored_for_view / restored_for_reference / restored_for_work / environment_reconnected / partial / blocked / unknown / expired
```

核心边界：

```text
completed ≠ verified
verified ≠ published
archived ≠ deleted
environment_reconnected ≠ restored_for_work
restored_for_view ≠ can_continue
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| GitHub Issues 官方入口 [Issues](https://docs.github.com/en/issues) | 本轮指定的关闭 Issue 页面返回 404，未据此推断关闭/重开机制 | 不能将失效目标页作为完成生命周期证据；继续采用本平台验收模型 | 本轮没有可引用的具体 GitHub 关闭/重开机制 |
| Jira 官方入口 [Use workflows](https://support.atlassian.com/jira-cloud-administration/docs/use-workflows/) | 本轮指定工作流页面返回 404，仅确认入口存在 | 不直接复制 Jira 状态转换；本平台需独立处理验证、风险、发布、保留和恢复 | 未据失效目标页推断具体状态或审批机制 |
| [Kubernetes Finalizers](https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/) | 删除请求后可先进入待清理状态，清理完成后才最终移除 | 删除是多阶段受控流程；`pending_disposal` 可阻断处置并等待前置任务 | 不定义企业隐私删除、知识撤回和外部消费者补偿 |
| [ServiceNow Incident Management](https://www.servicenow.com/docs/bundle/washingtondc-it-service-management/page/product/incident-management/concept/c_IncidentManagement.html) | Incident 处理、恢复、问题分析和后续管理分开 | 事件缓解、服务恢复、RCA、风险关闭、Follow-up 和知识沉淀分离 | 字段随版本和组织配置变化，本轮不复制具体 Schema |

本轮有效资料共同支持：删除是可审计的多阶段过程；工作完成、事件恢复、RCA、后续行动和知识发布分离；关闭/完成不等于所有风险和派生工作结束；待处置、受限和已删除必须区分。两个指定目标页面返回 404，未作具体 GitHub/Jira 状态机结论。

### 3. 阶段 3：综合建议

#### 3.1 正交状态与规范结论

分离：

```text
work_status
deliverable_status
verification_status
acceptance_status
risk_status
publication_status
follow_up_status
retention_state
recovery_state
```

计算两个规范结果：

```text
Canonical Work Conclusion
  not_ready / in_progress / completed / completed_with_exceptions / blocked / cancelled / unknown

Canonical Recovery Result
  not_attempted / restored_for_view / restored_for_reference / restored_for_work
  environment_reconnected / restored_with_gaps / partially_restored / blocked / unknown / expired
```

两者均绑定 Work Thread Revision、Manifest/Package 版本、Recovery Attempt 或 Verification Result、最低安全下一步和当前权限。

#### 3.2 完成验收骨架

所有场景至少表达：

```text
objective / scope / exclusions
deliverables / acceptance_criteria
evidence_refs / verification_refs
unresolved_items / risk_summary
responsibility_confirmation
accepted_by / accepted_at
follow_up_refs
```

场景扩展分别覆盖软件开发、Incident、研究分析、规划决策、知识资产、合规安全和数据处理。运行成功、Harness 宣称完成、产物存在或 Owner 点击完成不能单独决定 `completed`。

以下组合可以表达“目标完成但并非全部结束”：

```text
work_status = completed
verification_status = partially_verified
risk_status = residual_risk_open
publication_status = not_published
follow_up_status = required
```

关键交付物缺失、关键证据或验证失败/未知、责任未确认、风险未披露、Evidence 撤回未重算、权限/版本/血缘无效时，不输出无条件 `completed`。

#### 3.3 Reopen / Follow-up / Derived

- **Reopen**：原完成/取消判定错误且目标与责任边界仍成立；需原因、Evidence、来源 Revision、影响预览、权限检查、Owner 确认和新 Revision；不恢复旧执行权限。
- **Follow-up**：原工作已结束后的相关独立新周期；需来源 Thread/Revision、触发原因、新目标/验收、Owner、选定上下文和权限检查；原 Thread 保持终态。
- **Derived**：Scope、Owner、Purpose、权限、敏感性、生命周期或合规责任发生实质变化；需重新定义 Source/Target Scope、Target Owner、Purpose、Sensitivity、派生策略、Lineage 和验收。

#### 3.4 归档、保留和处置

Work Status 与 Retention State 分离：

```text
online / archived / cold / restricted / pending_disposal
```

处置流程：

```text
disposal_requested
  → retention_checked
  → lineage_impact_checked
  → access_blocked_or_restricted
  → revoke_derivations
  → anonymize_or_delete
  → retain_audit_fact
  → disposal_verified
```

每一步记录 `requested`、`blocked`、`in_progress`、`partially_completed`、`completed`、`failed` 或 `unknown`。处置失败不能标记为删除成功；legal hold、active incident、open audit、unresolved dispute、security investigation、active lineage、privacy request 和 secret exposure 参与最终裁决。

#### 3.5 分层恢复

- **查询恢复**：只恢复查看、审计和最小元数据，不改变工作状态；
- **引用恢复**：作为 Follow-up、Derived、知识候选或血缘来源，重新授权；
- **工作恢复**：生成新的恢复 Revision，重算 Owner、ACL、Sensitivity、Purpose、Lineage、Approval、Tool Policy 和 RunGate；
- **环境恢复**：重新连接或重建，不恢复旧凭据、审批、Tool Policy 或 Session。

每个恢复对象记录 `required`、`attempted`、`available`、`verified`、`blocking`、`failure_reason`、`alternative`、`owner`、`next_action` 和 `expires_at`。`unknown` 必须说明原因、影响、是否阻断最低安全下一步和是否可重试。

#### 3.6 撤回、删除和派生资产

源撤回优先执行：

```text
block_future_retrieval
block_context_injection
block_new_execution
mark_derivatives_revalidation_required
revoke_publication_if_required
evaluate_existing_snapshots_and_external_effects
```

删除前计算 Retention Locks、Active Lineage、Derived/Published Assets、Snapshots、Packages、External Consumers、Audit Requirements、Privacy Request 和 Secret Exposure。最终处置可分别为 `block_future_use`、`restrict_access`、`revoke_derivation`、`revoke_publication`、`anonymize`、`delete_content` 和 `retain_audit_fact`；历史 Snapshot、审计和外部实际结果不静默改写。

#### 3.7 SLA 边界

不设统一完成/恢复 SLA，按风险等级、Work Phase、恢复层级、资源类型、外部依赖和 Retention State 配置状态转换响应、恢复启动、证据重取、撤回传播、高风险重验证和处置失败升级时限。未定义 SLA 时不向用户承诺已完成或已恢复。

### 4. 阶段 4：专家团讨论

- **工作流 / 产品**：支持正交状态与任务级结论；前台需表达“工作完成但仍有风险/验证缺口”；统一入口可以推荐 Reopen/Follow-up/Derived，但内部必须分流并展示影响和责任。
- **可靠性 / Incident**：支持 Incident 恢复、RCA、风险关闭和知识发布分离；恢复按 L1/L2/L3 和最低任务要求判断；外部副作用和补偿不能被 Work Status 覆盖。
- **合规 / 数据治理**：支持 `pending_disposal` 和删除前置检查；legal hold、活动血缘、审计、隐私和秘密暴露共同参与；撤回先阻断未来使用。
- **架构 / 状态机**：支持 Work、Retention、Recovery 状态分离；转换事件、并发版本、权限决策和验证绑定；处置、恢复和完成分别定义原子边界和补偿。

专家团共识：采用正交状态、任务级结论和受控转换；完成、验证、风险、发布和后续工作分离；Reopen/Follow-up/Derived 分离；删除多阶段且 `pending_disposal` 不等于删除；恢复分层并结构化表达失败/部分/未知；撤回先阻断未来使用；SLA 按风险、阶段和依赖配置。

### 5. 经用户确认的结论

1. Work、Deliverable、Verification、Acceptance、Risk、Publication、Follow-up、Retention 和 Recovery 分别建模；
2. 由当前 Task、Work Phase、风险、Evidence 和权限计算 Canonical Work Conclusion 与 Canonical Recovery Result；
3. `completed` 不等于 verified、risk closed、published 或 follow-up finished；
4. Reopen、Follow-up、Derived 语义分离，均不恢复旧 Run、Prompt、审批、Tool Policy、环境或执行资格；
5. 归档、冷存储、受限和待处置与 Work Status 分离；
6. 删除是多阶段、可审计、受保留锁定和血缘影响约束的流程，`pending_disposal` 不等于已删除；
7. 查询、引用、工作和环境恢复分层，恢复失败、部分成功和 unknown 结构化表达；
8. 源撤回先阻断未来检索、注入和新执行，再治理派生资产、发布内容、Snapshot、Package 和外部影响；
9. 完成、恢复、撤回和处置 SLA 按风险、阶段、资源和外部依赖配置，不设统一 SLA；
10. 外部副作用、补偿和责任复核不能被 Work Status 或 Recovery State 覆盖。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| 各场景验收字段与状态组合的最终 Schema | 需要真实软件、Incident、研究、数据和合规样本；留待以后讨论 |
| Canonical Work Conclusion / Recovery Result 的计算规则与策略引擎 | 依赖状态机、证据、风险和权限架构；留待以后讨论 |
| `pending_disposal` 与 legal hold、活动血缘、隐私请求冲突的裁决顺序 | 依赖合规、隐私、审计和组织责任规则；留待以后讨论 |
| 匿名化后必须保留的血缘、审计和 Snapshot 元数据 | 依赖数据分类、保留策略和隐私要求；留待以后讨论 |
| 恢复失败自动重试、升级和替代路径 | 依赖 Connector、RunGate、风险和运营能力；留待以后讨论 |
| 处置、撤回和派生资产治理的跨服务事务边界 | 依赖事件系统、血缘传播和外部副作用协议；留待以后讨论 |
| 完成、恢复、撤回和处置 SLA 的行业模板 | 需要真实运营数据和风险分级校准；留待以后讨论 |
| 统一入口下的状态推荐、批量操作和错误解释 UI/API | 属于后续 UX、IA 和接口设计；留待以后讨论 |

核心不变量：

```text
completed ≠ verified
verified ≠ published
work completed ≠ risk closed
archived ≠ deleted
pending_disposal ≠ deleted
reopen ≠ follow-up ≠ derive
restored_for_view ≠ restored_for_work
environment_reconnected ≠ environment_restored
unknown ≠ success
撤回 ≠ 静默删除历史快照
平台状态 ≠ 外部副作用状态
```

## 子议题深化 14：权限、治理与高风险操作实现边界

**状态：已确认（第 1 轮）**

### 本轮确认

> **采用 RBAC 职责骨架 + ABAC / Purpose / Scope 动态授权 + 独立 Admission / Approval / RunGate 门禁。Role、Grant、Policy Decision、Obligation、Approval 和实际 Execution 分开建模；身份、授权、业务准入、审批、执行和验证分层。查看摘要、正文、Evidence、审计、血缘、检索、上下文注入、工具执行、生产变更、导出、发布、删除和 Owner 变更分别授权。Owner 失效不自动转移全部权限；Break-Glass 必须最小、临时、绑定 Incident、限定 Scope/动作/时间并事后复核；批量高风险动作计算组合风险和传播闭包；撤回治理 Snapshot、Package、Derived Asset 和 Harness Cache；Retention Worker 只能执行已批准策略。`unknown`、`revalidation_required` 和 `revocation_unknown` 不得视为成功。**

### 1. 阶段 1：头脑风暴

本轮比较了纯 RBAC、纯 ABAC 和“RBAC 职责骨架 + ABAC 条件授权 + 独立门禁”，识别了角色过宽、用途/Scope/敏感性/血缘条件缺失、Owner 失效接管、Break-Glass 权限叠加、批量组合风险、字段脱敏、撤回缓存和高风险执行等问题。

权限动作至少分为：

```text
view_existence / view_metadata / view_summary / view_detail
view_redacted / view_original / view_evidence / view_audit / view_lineage
retrieve / use_for_search / inject_context / use_for_planning / use_for_execution
append_evidence / append_correction / request_reopen / approve_reopen
create_follow_up / create_derived / change_owner / change_acl / change_policy
export / share / publish / revoke_publication / delete / anonymize
execute_tool / production_change
```

核心边界：

```text
可发现 ≠ 可查看
可查看摘要 ≠ 可看原文
可读 Evidence ≠ 可用于检索
可检索 ≠ 可注入 Harness
可注入 ≠ 可执行工具
可执行工具 ≠ 可生产变更
allow ≠ unrestricted
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) | Role/ClusterRole 定义资源和动作；RoleBinding/ClusterRoleBinding 将权限绑定主体；作用域分离 | Role、Grant、Subject、Resource 和 Scope 分开；Project/Team 授权不等于 Evidence/原文全部权限 | 主要是资源/动词授权，不表达用途、敏感性、血缘、撤回和保留锁定 |
| [Kubernetes Authorization](https://kubernetes.io/docs/reference/access-authn-authz/authorization/) | 授权请求包含主体、资源、动作和作用域；认证、授权和准入分层 | 身份、授权、业务准入和执行分层；高风险动作可继续进入审批/RunGate | 不解决业务用途、脱敏、知识发布和外部副作用 |
| [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) | 按目标、条件和操作设置规则；规则可要求检查或阻止动作 | 高风险导出、发布、删除和生产动作使用独立策略集；策略变化触发重新验证 | 面向仓库/代码变更，不直接覆盖 MemorySpace、血缘和缓存撤回 |
| [ServiceNow Access Control Rules](https://www.servicenow.com/docs/bundle/washingtondc-platform-security/page/administer/security/concept/c_AccessControlRules.html) | 记录级和字段级 ACL，可结合主体、角色和条件 | 摘要、正文、敏感字段、Evidence、审计和血缘可分别授权；`redacted` 是正式结果 | ACL 本身不定义派生、发布、撤回传播和外部副作用 |

本轮资料共同支持：Role、Grant、Subject、Resource、Action 和 Scope 分离；身份、授权、准入、审批、执行和验证分层；记录级和字段级权限分开；策略与具体决定、动作结果分离；授权通过不等于业务动作安全或结果正确。没有将产品角色名称直接复制为本平台最终角色。

### 3. 阶段 3：综合建议

#### 3.1 四层授权模型

```text
Identity
  → 主体是谁

Role / Grant
  → 职责骨架与基础范围

Policy Decision
  → 当前主体对当前资源执行当前动作是否允许

Admission / RunGate / Approval
  → 高风险动作的额外门禁
```

```text
Effective Permission
= Identity
  ∩ Role / Grant
  ∩ Resource ACL
  ∩ Action
  ∩ Purpose
  ∩ Scope
  ∩ Sensitivity
  ∩ Lineage
  ∩ Current Policy
  ∩ Approval / Delegation
  ∩ Retention Lock
  ∩ Capability
```

#### 3.2 Role、Grant、Policy Decision、Obligation

- **Role**：表达 `canonical_owner`、`participant`、`executor`、`auditor`、`security_reviewer`、`compliance_reviewer`、`governance_agent`、`retention_worker`、`break_glass_operator` 等职责骨架，不直接等于全部资源和动作权限。
- **Grant**：绑定主体、资源 Scope、允许动作、Purpose、有效期、条件、委托人和策略版本；不得自动扩大到新敏感资源、新用途、跨空间 Scope 或新高风险动作。
- **Policy Decision**：记录当前请求的 `allow`、`allow_with_obligations`、`redacted`、`deny`、`unknown`、`stale`、`revalidation_required`、`blocked_by_retention`、`blocked_by_approval` 或 `blocked_by_lineage`。
- **Obligation**：表达仅摘要、先脱敏、禁止原文导出、限定 Purpose、人工复核、绑定 Incident、重新验证、时间限制和审计写回等附加条件。

#### 3.3 动作级风险边界

低风险动作可在策略允许时执行：

```text
view_metadata / view_summary / view_redacted
append_low_risk_evidence / create_checkpoint
request_revalidation / send_notification
```

中风险动作通常需要明确授权或审核：

```text
view_original / view_sensitive_evidence / append_correction
request_reopen / create_follow_up / create_derived
retrieve / inject_context
```

高风险动作默认需要独立审批、准入和审计：

```text
change_owner / change_acl / export_original / share_cross_scope
publish / delete / anonymize / execute_tool
production_change / approve_reopen / grant_permission
```

最终风险仍按实际目标、参数、资源、副作用和 Scope 判断，不能只按动作名称固定。

#### 3.4 Owner 失效、委托与接管

```text
owner_invalid
  → ownership_review_required
  → temporary_governance
  → target_owner_confirmation
  → permission_diff_check
  → controlled_transfer
  → new_owner_revision
```

临时治理主体可以保持安全状态、查看最小元数据、阻断高风险使用、发起归属复核、生成交接/接管候选和执行预批准低风险止损；不能自动获得全部正文/Evidence、导出、发布、删除、旧审批、凭据或 Tool Policy，也不能改写历史 Owner 或把临时接管变成永久 Owner。

#### 3.5 Break-Glass

Break-Glass 必须绑定 Incident、主体、原因、资源/Scope、允许与禁止动作、开始/失效时间、审批或双人复核和事后复核；权限最小、临时、到期失效，不改变长期 Owner、ACL、审批角色或 Tool Policy。禁止无 Incident 的长期授权、无限 Scope/时间、自动继承旧审批和通过多次 Break-Glass 叠加绕过门禁。

#### 3.6 脱敏、检索、注入与缓存

使用层级分开：

```text
view_existence / view_metadata / view_summary / view_redacted / view_original
retrieve / inject_context / execute
```

脱敏结果绑定 Source Revision、Redaction Policy Version、Purpose、Target Scope、重识别检查和有效期。允许检索不等于允许注入，允许注入不等于允许执行。

撤回或权限收窄时阻断未来检索、注入和新执行；旧 Snapshot 保留实际历史；旧 Package 标记 `revoked`、`stale` 或 `revalidation_required`；Derived Asset 进入影响评估；Harness Cache 检查授权、有效期和撤回状态。缓存至少区分 `cache_exists`、`cache_current`、`cache_authorized`、`cache_usable`、`cache_revoked`、`cache_expired` 和 `cache_unknown`，并记录撤回请求、确认、验证或未知。

#### 3.7 批量高风险操作

批量导出、发布、删除和权限变更执行：

```text
逐项准入
  → 批次组合风险
  → 敏感性与重识别
  → Scope 扩张
  → 血缘传播闭包
  → 保留锁定
  → 外部消费者影响
  → Approval / RunGate
  → Execute
  → Verify
```

任一对象命中 M2 时，整批不得静默继续；策略可选择 `block_all`、`split_safe_and_high_risk` 或 `require_explicit_partial_approval`。部分执行必须明确已执行和被阻断对象，不能显示为整批成功。

### 4. 阶段 4：专家团讨论

- **权限架构**：支持 RBAC 职责骨架 + ABAC 条件授权；Role、Grant、Policy Decision、Obligation 分开；管理员不能绕过资源 ACL、用途和血缘；授权需可解释、可审计。
- **安全 / 隐私**：支持字段级脱敏和使用层级分离；检索不自动等于注入；撤回传播到 Package、Derived Asset 和 Harness Cache；Break-Glass 短时、最小、绑定 Incident 并复核。
- **运维 / 可靠性**：支持 Owner 失效临时治理但不全集转移；批量动作计算组合风险和外部消费者影响；高风险动作分离 RunGate、审批、执行和验证；`revocation_unknown` 不是撤回成功。
- **合规 / 审计**：Retention Lock、Legal Hold、Active Lineage 和 Privacy Request 作为独立门禁；审计证明主体、策略、版本、Purpose 和实际动作；临时授权到期自动失效并复核。

专家团共识：采用 RBAC + ABAC/Purpose/Scope 动态授权；Role/Grant/Decision/Obligation 分离；身份、授权、准入、审批、执行和验证分层；Owner 失效不自动全集接管；Break-Glass 最小临时并复核；批量操作计算组合风险；撤回治理快照、包、派生资产和缓存；Retention Worker 只能执行已批准策略。

### 5. 经用户确认的结论

1. 采用 RBAC 职责骨架 + ABAC / Purpose / Scope 动态授权 + 独立 Admission / Approval / RunGate；
2. Role、Grant、Policy Decision、Obligation、Approval 和 Execution 分开建模；
3. 身份、授权、业务准入、审批、执行和验证分层；
4. 摘要、正文、Evidence、审计、血缘、检索、注入、工具执行、生产变更、导出、发布、删除和 Owner 变更分别授权；
5. `allow`、`redacted`、`unknown`、`stale`、`revalidation_required`、`blocked_by_retention`、`blocked_by_approval`、`blocked_by_lineage` 不得折叠；
6. Owner 失效不自动转移全部权限；临时治理与永久 Transfer 分离；
7. Break-Glass 必须绑定 Incident、最小 Scope/动作/时间、审批/复核和事后审计；
8. 记录级、字段级、检索、上下文注入和执行权限分开；
9. 撤回治理 Snapshot、Package、Derived Asset 和 Harness Cache，`revocation_unknown` 不视为成功；
10. 批量导出、发布、删除和权限变更计算组合风险、传播闭包、保留锁定和外部消费者影响；
11. Retention Worker 只能执行已批准策略，不能改变策略或绕过 Legal Hold；
12. 高风险动作独立记录授权、准入、审批、执行、验证、补偿和责任复核。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| Role、Grant、Policy Decision、Obligation、Approval、Delegation 最终 Schema | 依赖统一对象、权限、事件和审计架构；留待以后讨论 |
| RBAC 与 ABAC / Purpose 控制冲突时的 deny、allow、unknown 优先级 | 需要策略数量、组织委托和可解释性验证；留待以后讨论 |
| 脱敏后内容能否检索、注入或用于自动决策 | 依赖敏感性、用途、知识化和模型安全评估；留待以后讨论 |
| Harness Cache 撤回无法确认时的平台与组织责任 | 依赖 Connector、外部 Harness 合同和缓存控制能力；留待以后讨论 |
| Owner 失效临时治理的最大权限和最长时限 | 依赖组织治理、Incident 和风险分级；留待以后讨论 |
| 批量操作整批阻断、拆分执行或部分审批规则 | 依赖组合风险、事务边界和用户操作模型；留待以后讨论 |
| Retention Worker 匿名化、删除和冷存储的幂等实现 | 依赖保留策略、事件系统和存储架构；留待以后讨论 |
| 组织级委托、跨空间授权和 Break-Glass 叠加防护 | 依赖企业目录、审批和权限治理架构；留待以后讨论 |
| 高风险审批、RunGate、执行和验证的最终 API/UX | 属于后续安全架构、接口和体验设计；留待以后讨论 |

核心不变量：

```text
Role ≠ Grant
Grant ≠ Policy Decision
Policy Decision ≠ Approval
Approval ≠ Execution
Execution ≠ Verification
可发现 ≠ 可查看
可查看 ≠ 可检索
可检索 ≠ 可注入
可注入 ≠ 可执行
Owner 失效 ≠ 全权接管
Break-Glass ≠ 永久授权
revocation_unknown ≠ 撤回成功
Retention Worker 执行策略 ≠ Retention Worker 制定策略
批量逐项允许 ≠ 批次整体安全
unknown ≠ 成功
```

## 子议题深化 15：Connector、跨 Harness 运行与环境恢复协议

**状态：已确认（第 1 轮）**

### 本轮确认

> **Connector Contract V1 作为 Memory Platform 与外部 Harness/Agent Runtime 的统一接入边界，负责 Handshake、Event Append、Idempotency/Cursor、Capability Declaration、Resource Reference、Health/Lease、Probe 和 Structured Result，但不是 Work Thread、Canonical Owner、最终 ACL、审批、知识发布或保留策略真源。采用 L1 平台必须保证、L2 Connector 协助获取与验证、L3 Connector/Environment 可选重连或重建的分层恢复模型。MCP、A2A、HTTP、SDK 等是适配协议，不替代平台对象和权限。跨 Harness 只转移规范工作状态和受控投影，不转移私有 Prompt、推理、登录态、凭据、缓存、活跃进程、旧审批、旧 Tool Policy 或私有 Session。能力声明、实例可用性、主体授权、本次 Probe 和实际 Result 分开；Connector Result、Verification、Canonical Recovery Result 和 Work Completion 分开。**

### 1. 阶段 1：头脑风暴

本轮比较了 Connector 只上报事件、Connector 负责完整环境迁移和分层 Connector Contract，识别了环境迁移、凭据与私有状态、能力差异、断线补发、资源版本、恢复误报和责任边界等问题。

对象边界为：

```text
Work Thread      跨执行者持续存在的规范工作主体
Harness          外部执行工具或 Agent Runtime
Connector        Harness 与 Memory Platform 的适配边界
Execution        平台记录的一次实际推进尝试
Harness Session  Harness 侧会话容器
Run              Harness 内某次运行或调用
Trace            实际执行路径关联
```

核心边界：

```text
Connector ≠ Work Thread 真源
Harness Session ≠ Work Thread
Run ≠ Execution
Trace ≠ Business Revision
环境重建 ≠ 原环境恢复
```

### 2. 阶段 2：官方同类产品 / 既有模式调研

调研日期：2026-09-18。

| 来源 | 观察机制 | 对本平台的启发 | 局限 |
|---|---|---|---|
| [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-06-18) | 客户端/服务器协商能力，提供资源、工具和提示等协议能力 | Connector 可将 MCP 作为 Harness/工具接入适配层；工具结果转为 Evidence、Execution 和 Verification | MCP 不是工作连续性、责任交接或企业权限协议 |
| [Agent2Agent Protocol](https://a2a-protocol.org/latest/specification/) | Agent 之间交换任务、消息、状态和产物 | A2A 可作为 Agent 协作适配层，只交换受控任务状态和产物引用 | 不定义 canonical Owner、权限交集、长期审计和知识血缘 |
| [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/) | 跨服务传播 Trace/Span 关联上下文 | 传播 `trace_id`、`span_id`、`correlation_id`、`causation_id`，但不传播凭据或全量正文 | Context Propagation 不是业务权限、工作状态或恢复协议 |
| [GitHub Checks Runs](https://docs.github.com/en/rest/checks/runs) | 检查运行的 status 与 conclusion 分离，并绑定执行和结果 | Connector 操作结果与 Verification 分离；运行中、完成和最终结论不混淆 | 面向代码检查，不覆盖环境恢复、权限和交接 |

本轮资料共同支持：能力协商、资源引用、任务/运行状态和实际结果显式分离；协议 Session、Agent、Harness 和 Trace 不等于平台工作真源；能力声明不等于当前可用，当前可用不等于主体有权使用；运行状态与最终结论分开；部分成功和未知不能伪装成功。

### 3. 阶段 3：综合建议

#### 3.1 Connector Contract V1 范围

V1 最小能力：

```text
Handshake
Event Append
Idempotency + Cursor
Capability Declaration
Resource Reference
Health / Lease
Probe
Structured Result
```

Connector 不负责：

```text
Work Thread 真源
Canonical Owner 决策
最终 ACL
高风险审批
知识发布
跨空间授权
长期保留策略
```

#### 3.2 Handshake 与身份

至少绑定：

```text
protocol_version
connector_id / connector_version
harness_id / harness_version
instance_id
principal_identity
tenant / workspace_scope
capability_profile
credential_reference
```

平台独立验证主体身份、Harness 实例、Connector 可信状态、当前 Scope、Credential Scope 和 Tool Policy。Connector 自报身份不等于平台已信任。

#### 3.3 能力声明

不使用单一 `supports_resume`，按能力声明：

```text
capability
status: supported / unsupported / conditional
version
scope
requires_approval
requires_connector
valid_until
evidence
```

分开记录：

```text
Connector 声明支持 ≠ 当前实例可用
当前实例可用 ≠ 当前主体有权
当前主体有权 ≠ 本次资源满足前置条件
本次执行成功 ≠ 业务结果已验证
```

#### 3.4 事件、资源、健康和探测

Event Append 支持 L0 工作事件、Evidence 引用、Tool Call 结果、Execution/Run 状态和 Trace 关联，事件有唯一 ID、幂等键和来源游标。离线补发支持 `source_cursor`、`platform_cursor`、`replay_window`、`gap_marker` 和 `out_of_order_marker`。

Resource Reference 至少记录：

```text
resource_type / resource_id / locator
source_system / revision / content_hash
observed_at / expires_at
access_requirements / sensitivity / current_status
```

Health/Lease 至少记录：

```text
connector_health / instance_health
lease_id / lease_expires_at
last_seen_at / revoked_at
```

Probe 在恢复或执行前检查能力、资源存在、资源 Revision、身份匹配、权限、依赖和环境状态。Probe 是事实检查，不授予权限，也不等于恢复成功。

#### 3.5 结构化结果与任务级恢复

Connector 返回操作事实，平台结合当前主体授权、Work Thread Revision、Context Manifest、最低任务要求和 Verification Result 计算 `Canonical Recovery Result`：

```text
not_attempted
restored
restored_with_gaps
partially_restored
not_restored
blocked
unknown
expired
permission_denied
unsupported
```

结果必须说明 L1/L2/L3 层级、成功/失败资源、失败原因、是否阻断最低安全下一步、替代路径和是否需重新确认。Connector Result、Verification Result、Canonical Recovery Result 和 Work Completion 不混同。

#### 3.6 跨 Harness 交接

可转移：

```text
Work State / Evidence 引用 / Revision
Manifest 投影 / Continuation Package / Task
风险、禁令、最低安全下一步
资源引用和版本
```

禁止转移：

```text
私有 Prompt / 私有推理 / 登录态
Token / Cookie / 私钥 / 缓存 / 活跃进程
旧审批 / 旧 Tool Policy / 私有 Session 状态
```

交接后重新检查目标 Harness/Connector 能力、Principal、ACL、资源 Revision、Tool Policy、RunGate 和最低恢复层级。MCP、A2A 等只承担通信或能力适配，不改变交接和权限边界。

#### 3.7 L1/L2/L3 责任

- **L1**：平台必须保证规范状态、Evidence、风险、禁令、权限和最低下一步可理解；
- **L2**：Connector 协助资源定位、重新获取、版本/内容验证；平台记录结果并作任务级判定；
- **L3**：Connector/Environment 可选支持重连、重建和有限恢复；平台诚实报告能力和结果，不承诺任意环境迁移。

#### 3.8 Trace、Execution、健康和断线

每次 Connector 操作尽可能绑定：

```text
work_thread_revision
execution_id
harness_session_id
run_id
trace_id / span_id
resource_revision
context_manifest
run_context_snapshot
```

Trace 不替代业务 Revision。租约失效时标记实例不可用，保留已接收事件，记录事件缺口/未知，生成恢复候选，不自动宣称环境恢复。离线补发需幂等、游标、缺口和乱序标记。

### 4. 阶段 4：专家团讨论

- **协议与平台架构**：支持 Connector Contract 统一接入；MCP、A2A、HTTP、SDK 是适配协议；Handshake、Capability、Resource、Event 和 Result 独立。
- **运行时与可靠性**：支持 L1/L2/L3；要求幂等、游标、租约、断线补发、缺口和乱序；Connector 成功与恢复结论分离；重建不等于原环境恢复。
- **安全与权限**：支持不转移私有 Prompt、推理、凭据、登录态和旧审批；Probe/执行重新检查主体、ACL、Tool Policy 和 RunGate；Trace 不携带凭据或全量正文。
- **产品与交接**：支持跨 Harness 只转移规范状态和受控投影；分别表达已连接、已获取资源、已恢复环境和可以继续；能力差异以业务语言解释。

专家团共识：Connector V1 是统一接入边界而非工作真源；协议、能力、资源、事件、租约和结果分离；L1 平台保证、L2 协助验证、L3 环境依赖；跨 Harness 不转移私有内部状态；Connector Result、Verification、Recovery Conclusion 和 Work Completion 分离；断线、重复、乱序、缺口、重试和租约失效可审计。

### 5. 经用户确认的结论

1. Connector Contract V1 统一承担 Handshake、Event Append、Idempotency/Cursor、Capability Declaration、Resource Reference、Health/Lease、Probe 和 Structured Result；
2. Connector 不是 Work Thread、Canonical Owner、最终 ACL、审批、知识发布或保留策略真源；
3. MCP、A2A、HTTP、SDK 等是适配协议，不替代平台对象和权限；
4. 能力声明、实例可用性、主体授权、Probe 和实际 Result 分开；
5. L1 由平台保证，L2 由 Connector 协助获取与验证，L3 由 Connector/Environment 按能力支持；
6. 跨 Harness 只转移规范状态和受控投影，不转移私有 Prompt、推理、凭据、登录态、缓存、进程、旧审批、Tool Policy 或私有 Session；
7. Resource Reference 绑定来源、Revision、Hash、可访问性、敏感性和有效期；
8. Event Append 支持唯一 ID、幂等、游标、补发、缺口和乱序标记；
9. Probe 是事实检查，不授予权限、不代表恢复成功；
10. Connector Result、Verification Result、Canonical Recovery Result 和 Work Completion 分开；
11. Trace 关联执行路径，不传播权限、不替代 Business Revision；
12. 环境重连、环境重建和原环境恢复分开表达；
13. 租约失效、断线、重复、乱序、未知和部分成功必须可审计、可解释和可降级。

### 6. 本轮明确暂缓事项及原因

以下内容留待以后讨论：

| 暂缓事项 | 暂缓原因 |
|---|---|
| Connector Contract V1 最终 Schema、错误码和兼容策略 | 依赖多 Harness 接入样本、协议版本和统一 API；留待以后讨论 |
| Connector 可信身份、能力认证、撤销和密钥轮换 | 依赖企业身份、凭据和安全架构；留待以后讨论 |
| 离线补发、缺口、乱序、重放和补偿的完整协议 | 依赖事件系统、游标、存储和故障恢复设计；留待以后讨论 |
| L3 环境恢复的幂等、安全和外部副作用边界 | 依赖各类环境 Connector、RunGate 和 Incident 设计；留待以后讨论 |
| MCP、A2A 与 Connector Contract 的具体映射和版本兼容 | 依赖协议演进和外部 Harness 适配矩阵；留待以后讨论 |
| Harness Cache 撤回和外部缓存清除验证 | 依赖外部 Harness 合同、缓存控制和组织责任；留待以后讨论 |
| Trace 采样、脱敏、长期保留和审计闭包 | 依赖 Connector、隐私、成本和合规策略；留待以后讨论 |
| Connector 失败重试、降级和人工接管配置 | 依赖风险等级、运行规模和运营能力；留待以后讨论 |
| 能力不匹配时的替代 Harness 选择和交接候选 | 依赖 Harness 能力目录、责任模型和调度策略；留待以后讨论 |
| Connector 监控、SLA、兼容测试和 UI/API | 属于后续架构、运营和体验设计；留待以后讨论 |

核心不变量：

```text
Connector ≠ Work Thread 真源
Connector 声明支持 ≠ 当前可用
当前可用 ≠ 当前主体有权
Probe ≠ 权限授予
Probe ≠ 恢复成功
Connector Result ≠ Verification Result
Verification Result ≠ Work Completion
Trace ≠ Business Revision
重连 ≠ 重建 ≠ 原环境恢复
部分成功 ≠ 全局成功
unknown ≠ 成功
```

## 子议题深化 16：Connector Contract V1 最终 Schema、错误码与兼容策略

### 第 1 轮：已确认并沉淀

用户已确认第 1 轮结论并要求进入下一轮。本轮形成并确认的原则如下：

1. Connector Contract V1 采用“稳定公共信封 + 操作类型分层 + 版本化 Payload + 能力协商 + 结构化结果/错误”的双层结构；MCP、A2A、HTTP、SDK 和 CloudEvents 等仅作为适配或传输参考，不替代平台对象、权限和治理真源。
2. 公共信封至少需要表达协议版本、消息身份、消息类型、Connector 身份、实例身份、发生时间、Trace 关联和幂等依据；具体字段名、ID 格式和最终 Schema 留待后续实现协议讨论。
3. Handshake、Event Append、Resource Reference/Probe、Health/Lease 和 Structured Result 分属不同操作与 Payload；Connector Result、Verification Result、Canonical Recovery Result 和 Work Completion 分开表达。
4. 错误必须结构化区分协议、校验、认证、授权、能力、冲突、重复、暂时性故障、依赖故障、策略阻断、部分成功和未知状态；`retryable` 只能作为建议，最终由平台结合风险、幂等性和外部副作用判断。
5. 协议版本、操作版本、事件 Schema 版本、能力集合和适配器版本分开记录；版本号不能替代能力声明。
6. 破坏性变化必须显式协商或拒绝；新增字段原则上保持可忽略；未知事件不得按已知事件处理，应隔离或进入待处理状态；降级、重复、部分成功、未知和版本不匹配必须可追踪、可解释、可审计。
7. “协议兼容”不等于“业务安全可用”；继续执行还需分别满足能力兼容、策略兼容、资源兼容和风险可接受。
8. `tenant_scope`、资源引用、错误详情和 Trace 不能绕过平台授权、脱敏、保留和撤回策略；Connector 不得自行授予权限或宣称恢复、完成和验证成功。

### 第 1 轮官方调研依据

- CloudEvents Specification：<https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>。参考其稳定事件信封、事件身份、来源和事件类型与数据分离机制；不将其当作完整 Connector Contract。
- OpenTelemetry OTLP Specification：<https://opentelemetry.io/docs/specs/otlp/>。参考其传输、数据模型、请求/响应和稳定性边界分离机制；不将遥测协议直接套用于 Work Thread 恢复。
- Stripe API Versioning：<https://docs.stripe.com/api/versioning>。参考其显式请求版本和破坏性变化处理；不直接照搬其 API 生命周期。
- MCP Versioning：<https://modelcontextprotocol.io/specification/2025-06-18/basic/versioning>。参考其初始化阶段版本协商和能力不能由版本号完全表达的原则；不将 MCP 作为平台语义真源。

### 第 1 轮专家团结论

产品、UX、架构、可靠性和安全专家均支持双层协议方向，但提出以下约束：V1 不应要求所有 Connector 一次实现全部能力；协议错误与用户可见状态应分离；多个版本字段需要兼容矩阵避免组合爆炸；重试必须受平台风险策略约束；错误详情、资源引用和 Trace 必须重新经过授权与脱敏。专家团进一步指出，协议兼容、能力兼容、策略兼容、资源兼容和风险可接受必须分开判断。

### 第 1 轮明确暂缓事项及原因

| 暂缓事项 | 暂缓原因 |
|---|---|
| Connector Contract V1 逐字段 JSON / Protobuf Schema | 需要结合多 Harness 接入样本、统一 API 和事件存储边界；留待以后讨论 |
| 错误码编号表、错误详情字段和本地化文案 | 依赖最终操作模型、运营分级和 UI/API 设计；留待以后讨论 |
| Major / Minor 版本支持窗口和废弃周期 | 依赖接入规模、兼容测试和运营 SLA；留待以后讨论 |
| 版本、能力、策略和资源兼容矩阵的具体算法 | 暴露了本轮新的核心讨论点；进入下一轮讨论 |
| MCP、A2A、HTTP 和 SDK 的完整字段映射 | 依赖外部适配矩阵和协议演进；留待以后讨论 |

### 第 2 轮：已确认并沉淀

用户已确认第 2 轮结论并要求进入下一轮。本轮形成并确认的原则如下：

1. Connector 的可用性不使用单一 `compatible: true/false` 表达，而拆分为协议兼容、能力兼容、身份与授权、资源兼容、风险与策略五个维度。
2. `Connector Declaration`、`Platform Observation` 和 `Policy Decision` 分开表达；Connector 自报能力不是平台事实，也不是最终授权。
3. 能力结果至少区分支持、带约束支持、暂时不可用、部分支持、不支持、未验证、已撤销和未知；能力声明应与资源类型、版本、只读/写入、幂等性、副作用、验证和撤回能力等约束关联。
4. 资源结果至少区分可用且已验证、可用但未验证、过期、脱敏、Scope 阻断、缺失、冲突、不可达、已撤回和未知；资源存在不等于可用于当前操作。
5. 策略结果应区分允许、带义务允许、先 Probe、需要审批、仅只读、需要交接、延期、拒绝和未知；高风险外部副作用在风险未知时不得执行。
6. 兼容评估绑定 Connector 实例、能力快照、主体、Purpose、Scope、资源 Revision、策略版本、审批快照、风险上下文、决定时间和有效期；昨日兼容不代表今日仍兼容。
7. 接受 Connector、降级能力、生成交接候选和授予本次执行资格是不同动作；降级必须说明实际能力和未满足项，不能伪装成原请求成功。
8. 兼容评估详情本身属于治理数据，应按主体、用途、敏感性、保留和撤回策略控制暴露；目标 Harness 只有在重新通过能力、权限和敏感性筛选后才能成为交接候选。

### 第 2 轮官方调研依据

- OAuth 2.0 Authorization Framework：<https://www.rfc-editor.org/rfc/rfc6749>。参考 requested scope 与 granted scope 分离；Scope 不足以表达 Purpose、血缘和外部副作用。
- SPIFFE Workload API：<https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/>。参考工作负载身份、生命周期与业务授权分离；身份可信不等于动作获权。
- Kubernetes API Concepts：<https://kubernetes.io/docs/reference/using-api/api-concepts/>；Kubernetes Authorization：<https://kubernetes.io/docs/reference/access-authn-authz/authorization/>。参考资源版本、资源状态、授权和客户端能力分离。
- W3C Trace Context：<https://www.w3.org/TR/trace-context/>。参考 Trace 仅用于调用链关联，不作为权限、业务身份或 Work Completion。

### 第 2 轮专家团结论

产品和 UX 专家支持把复杂判定聚合为“可以继续、先验证、需要审批、需要换 Harness、暂时无法确认、禁止继续”等少量用户状态；架构和可靠性专家要求能力快照、动态观察和策略决定分层，并为高风险动作重新计算；安全专家要求按最小必要原则暴露能力和阻断详情，不向无权主体泄露资源存在性、权限边界或敏感能力。专家团一致要求：自动刷新、降级、重试和交接必须重新经过门禁。

### 第 2 轮明确暂缓事项及原因

| 暂缓事项 | 暂缓原因 |
|---|---|
| 兼容评估结果的具体 JSON / Protobuf Schema | 需要先明确缓存、失效、重算和审计生命周期；留待下一轮讨论 |
| 能力 Profile 与约束的最终字段及评分公式 | 需要多 Harness 样本和场景校准；留待以后讨论 |
| 兼容评估缓存、有效期、失效和并发重算规则 | 暴露了本轮新的核心讨论点；进入下一轮讨论 |
| 自动资源刷新、降级、重试和交接算法 | 依赖 RunGate、外部副作用和运营 SLA；留待以后讨论 |
| 评估详情的字段级脱敏和跨空间传播规则 | 依赖权限、血缘、脱敏和审计架构；留待以后讨论 |

### 第 3 轮：已确认并沉淀

用户已确认第 3 轮结论并要求完成子议题 16、进入下一个暂缓项。本轮确认：

1. 兼容评估采用分层缓存：Identity、Capability Declaration、Capability Observation、Resource Validation、Policy Assessment；Execution Eligibility / RunGate 不作为普通长期缓存。
2. 关键变更采用主动失效，TTL 用于兜底，实际执行前仍需重检；权限撤销、Connector 撤销、审批撤回、策略禁止、资源撤回和安全冻结属于硬失效，旧 `allow` 必须立即阻断。
3. 评估结果绑定输入快照、版本、代次、有效期和失效原因，覆盖 Connector 实例、能力快照、主体、Purpose、Scope、资源 Revision/Hash、策略、审批、风险和 Work Thread 上下文。
4. 同一评估键采用单飞重算和代次保护；迟到的 Probe/Refresh 结果不能覆盖新代次，评估重算、资源刷新、Probe 和实际执行彼此分离。
5. 评估状态与执行资格分开；`assessment.valid` 不等于 `execution.eligible`。高风险动作在关键状态未知、过期或无法重检时必须阻断或进入审批/人工接管。
6. 评估审计保存决定所需的元数据、引用、Revision、Hash、策略/审批版本和重算链，不默认复制凭据、私有 Prompt、私有推理或完整资源正文；评估快照自身也受访问、保留、撤回和匿名化治理。
7. 失效事件可能丢失，因此主动失效、TTL、执行前重检和周期性重同步并存；平台不得以缓存命中或失效传播失败作为继续使用旧 Allow 的理由。

### 第 3 轮官方调研依据

- OPA Management Bundles：<https://www.openpolicyagent.org/docs/latest/management-bundles/>。参考策略数据版本、更新和失败处理边界。
- MDN HTTP `ETag`：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag>。参考资源版本校验与重新获取分离；ETag 不替代授权和业务撤回。
- Kubernetes API Concepts：<https://kubernetes.io/docs/reference/using-api/api-concepts/>。参考 Resource Version、Watch、断线和重新同步；资源缓存不等于永久新鲜。

### 第 3 轮专家团结论

专家团支持“分层缓存 + 主动失效 + TTL 兜底 + 执行前重检 + 单飞重算 + 代次保护 + 周期重同步”。产品和 UX 要求解释重新验证原因；架构和可靠性要求区分可复用评估与即时 RunGate，并限制重算风暴；安全专家要求硬失效优先、关键状态未知时高风险动作 fail-closed，并对评估详情实施最小暴露。

### 第 3 轮明确暂缓事项及原因

| 暂缓事项 | 暂缓原因 |
|---|---|
| 兼容评估最终 JSON / Protobuf Schema、错误码和事件格式 | 需要统一 API、事件存储和身份认证设计；留待以后讨论 |
| 精确 TTL、缓存键、重算队列参数和一致性边界 | 需要运行规模、成本和 SLA 数据；留待以后讨论 |
| 能力 Profile、兼容评分和风险阈值 | 需要多 Harness 样本与真实运营校准；留待以后讨论 |
| 失效详情的字段级脱敏、跨空间传播和匿名化 | 依赖权限、血缘、隐私和审计架构；留待以后讨论 |
| 自动资源刷新、降级、重试、交接和外部副作用协议 | 依赖 RunGate、环境恢复和运营治理；留待以后讨论 |

子议题深化 16 已完成三轮发现、调研、综合建议和专家讨论，并经用户确认沉淀；不表示 Connector Contract 的全部实现细节已经固化。

## 子议题深化 17：Connector 可信身份、能力认证、撤销与密钥轮换

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接暂缓项顺序中的第 2 项，讨论 Connector 如何证明身份、证明能力声明可信、被撤销，以及密钥或身份轮换期间如何保持安全的跨 Harness 连续性。身份、能力、授权、租约和结果必须分离；不把身份认证误当作 Work Thread 权限、资源可信或执行资格。

### 第 1 轮：阶段 1：头脑风暴

需要解决：仿冒 Connector 与真实 Connector 的区分；逻辑 Connector、部署、实例和环境的绑定；能力声明的可信来源；轮换期间的连续性；撤销对新请求、在途动作、旧事件、资源引用和交接候选的影响；离线补发重新上线时的过期身份与重放风险。

候选模型包括长期 API Key、短期签发凭证、工作负载身份、mTLS/证书身份和组合模型。建议将身份拆为：

```text
Connector Logical Identity
Connector Deployment Identity
Connector Instance Identity
Credential / Key Identity
Workload Attestation
```

需要保持：

```text
Connector 身份可信 ≠ Connector 能力真实
Connector 能力真实 ≠ 当前主体有权
凭证有效 ≠ 租约有效
租约有效 ≠ 执行获准
```

撤销至少区分凭证、实例、部署、单项能力和组织/租户；撤销不得只影响下次登录，还应定义事件隔离、在途动作、旧结果证据、资源引用重验和 Incident/人工复核。轮换候选包括重叠轮换、原子切换、租约续接、双重证明和暂停再恢复；低能力 Connector 可以进入只读、Probe 或人工接管。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- SPIFFE Workload API：<https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/>（访问：2026-09-19）。参考工作负载身份、短期 SVID 和生命周期；不解决业务授权、能力认证和 RunGate。
- OAuth 2.0：<https://www.rfc-editor.org/rfc/rfc6749>（访问：2026-09-19）。参考令牌有效期、requested/granted Scope 和刷新；Scope 不表达实例可信、血缘和副作用。
- RFC 5280：<https://www.rfc-editor.org/rfc/rfc5280>（访问：2026-09-19）。参考证书主体、有效期、路径验证和撤销分层；证书有效不等于业务获权。
- Kubernetes ServiceAccount Token：<https://kubernetes.io/docs/reference/access-authn-authz/service-accounts-admin/>（访问：2026-09-19）。参考 audience、subject、expiration 与 RBAC 分离；不直接覆盖 Purpose、血缘和 Work Thread。

共同规律：身份材料有生命周期；身份、授权、能力和资源验证分层；轮换要处理旧身份、在途请求和缓存；撤销要影响后续使用；短期凭证降低暴露窗口但不替代主动撤销。

### 第 1 轮：阶段 3：总结、结论与建议

建议采用：

```text
企业身份/工作负载身份
+ 短期凭证或租约
+ Connector 注册与能力证明
+ 平台授权与 RunGate
```

认证结果不使用单一布尔值，至少区分：`identity_verified`、`credential_valid`、`credential_expiring`、`credential_revoked`、`instance_unrecognized`、`audience_mismatch`、`attestation_missing`、`attestation_stale`、`trust_unknown`。

建议流程为：

```text
Identity Authentication
→ Connector Registration
→ Capability Declaration
→ Capability Evidence / Probe
→ Platform Observation
→ Policy Decision
→ RunGate
```

轮换原则：新凭证先完成身份、受众、Scope 和能力映射验证；重叠窗口中旧凭证不得自动保留全部能力；高风险动作绑定当前凭证/租约代次并在轮换后重过 RunGate；旧凭证不能用于新写入、执行或补发；轮换失败进入受限或人工接管，不无限续用旧身份。

撤销原则：单凭证撤销阻断其后的新请求；实例撤销不必波及健康实例；能力撤销只阻断依赖该能力的操作并使相关评估失效；组织级撤销按传播闭包处理。撤销不自动删除历史事件，历史证据需依据来源、时间、签名、完整性和治理策略重新判定。

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：支持分层，但用户界面应聚合为“已认证、能力未验证、需要重新授权、已撤销、受限运行、需要接管”，并解释凭证过期、Connector 撤销、能力未验证和资源权限不足的差异。
- **架构**：支持逻辑身份、部署、实例和凭证版本分离；要求租约、代次和撤销事件幂等，防止旧身份结果覆盖新状态。
- **可靠性**：担心身份服务不可用；建议保留受限只读、Probe、补发隔离和人工接管，并监控轮换成功率、撤销传播延迟和孤儿实例。
- **安全/隐私**：要求高风险动作 fail-closed；能力认证不能只看自报；撤销优先阻断新副作用，身份和证明详情按最小必要原则暴露。

专家团暂时支持“工作负载身份 + 短期凭证/租约 + 注册与能力证明 + 平台授权/RunGate”的分层模型，不支持长期 API Key 作为企业级默认方案，也不支持把证书有效等同于业务可信。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求进入下一个暂缓项。本轮确认：

1. Connector 身份、能力、授权、租约、资源和执行资格分离表达；Connector 身份可信不等于能力真实、主体获权、资源可用或执行获准。
2. 身份至少区分 Logical Identity、Deployment Identity、Instance Identity、Credential/Key Identity 和 Workload Attestation；认证结果不使用单一布尔值。
3. 企业级默认方向为企业身份/工作负载身份、短期凭证或租约、Connector 注册与能力证明、平台授权和 RunGate 的分层组合；长期 API Key 不作为默认方案。
4. 撤销至少区分凭证、实例、部署、单项能力和组织/租户；撤销需影响新请求、在途动作、评估、交接候选和补发路径，但不自动删除历史事件或结果。
5. 密钥轮换后高风险动作必须重新验证凭证/租约代次并重新通过 RunGate；旧凭证不能无限续用，也不能默认继续用于新写入、执行或补发。
6. 低能力或身份服务暂时不可用时，可进入只读、Probe、补发隔离或人工接管；高风险副作用默认 fail-closed。

## 子议题深化 18：离线补发、缺口、乱序、重放与补偿的完整协议

**状态：已完成（第 1–2 轮，已确认）**

### 主题与成功标准

本主题承接 Connector 暂缓项顺序中的第 3 项，讨论 Connector 离线期间产生的事件如何补发，如何识别缺口、乱序和重放，如何处理重复与部分成功，以及如何在平台、Connector、Harness 和外部副作用之间划分补偿责任。

成功标准是明确：事件来源、游标、幂等、顺序、缺口、接纳状态、隔离、重试和补偿如何分开表达；不把消息送达等同于业务接纳、执行完成或 Work Completion。

### 第 1 轮：阶段 1：头脑风暴

#### 1. 离线补发面对的事实

Connector 离线期间可能出现：

- 事件已在 Connector 本地生成但平台未知；
- 平台已接收但 Connector 未收到确认；
- 同一事件多次补发；
- 事件到达顺序与发生顺序不同；
- 事件中间缺失，无法确认是未产生、未发送还是丢失；
- 旧身份或旧租约产生的消息离线后才到达；
- 事件引用的资源 Revision 已变化或被撤回；
- 事件对应的外部副作用已经发生，但结果未回传；
- 补发过程跨越 Work Thread、策略、权限或保留状态变化。

#### 2. 游标不应只有一个

至少可能存在：

```text
source_sequence
platform_accept_cursor
platform_process_cursor
consumer_projection_cursor
```

它们分别表达：

- Connector 本地生成或排序位置；
- 平台已经接纳的位置；
- 平台规范事件已经处理的位置；
- 某个派生投影或消费者已经处理的位置。

因此：

```text
平台接收游标 ≠ 业务处理游标
业务处理游标 ≠ 投影最新游标
```

#### 3. 缺口的候选状态

缺口不能简单等于失败：

```text
not_observed
not_uploaded
pending_replay
replay_requested
replay_received
replay_rejected
unrecoverable
unknown
```

平台需要知道缺口范围、来源、发现时间、预期事件数（如果可知）、风险影响和补救动作。

#### 4. 乱序的候选处理

事件需要同时记录：

```text
occurred_at
observed_at
received_at
source_sequence
platform_revision
causal_parent
```

不能用接收时间替代发生时间，也不能默认用数字序列解决跨实例并发事件。

候选策略：

- 可安全重排的事件：按因果关系或业务 Revision 处理；
- 依赖前置状态的事件：进入等待或隔离；
- 无法确认因果关系的事件：标记 `causal_unknown`；
- 高风险事件：未满足前置状态时不执行外部副作用；
- 迟到事件：追加为历史事件，不覆盖已确认的新状态。

#### 5. 重放与幂等

需要分开：

```text
same_message_replay
same_business_intent
different_message_same_effect
conflicting_replay
```

`message_id` 只解决同一消息重复，不一定解决两个不同消息指向同一业务意图的重复副作用。高风险动作需要业务幂等键、目标资源版本和 RunGate 约束。

#### 6. 补偿不是回滚的同义词

外部副作用可能已经发生，平台无法保证任意动作可回滚。补偿候选包括：

```text
retry
probe
cancel
reverse
reconcile
manual_review
incident
accept_with_risk
```

补偿动作本身也需要新的权限、风险评估、幂等键、审批和验证；不能由失败重试自动升级为反向操作。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- Apache Kafka Documentation：<https://kafka.apache.org/documentation/>（访问：2026-09-19）。参考 offset、消费位置和传递语义；offset 不等于业务接纳，重复和重放仍需业务幂等。
- CloudEvents Specification：<https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>（访问：2026-09-19）。参考事件 ID、来源、类型和发生时间；不定义离线补发、缺口和补偿。
- AWS EventBridge Event Delivery：<https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-delivery.html>（访问：2026-09-19）。参考重试、重复投递和死信；不替代业务补偿与责任判定。
- Kubernetes API Concepts：<https://kubernetes.io/docs/reference/using-api/api-concepts/>（访问：2026-09-19）。参考 Resource Version、Watch、断线和重新同步；不能直接替代 Work Thread Business Revision。
- Transactional Outbox Pattern（Microservices.io）：<https://microservices.io/patterns/data/transactional-outbox.html>（访问：2026-09-19）。参考业务写入与待发送消息的事务关联和消费者幂等；不能保证外部副作用天然可回滚。

共同规律：传输至少一次时必须接受重复；游标和业务状态分离；断线需要重同步；死信/隔离优于静默丢弃；补偿不是自动回滚，需重新经过治理门禁。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议采用“事件接纳状态机”

```text
created
→ signed_or_authenticated
→ submitted
→ received
→ deduplicated
→ accepted
→ ordered_or_quarantined
→ processed
→ projected
→ reconciled
```

异常分支：

```text
rejected
isolated
missing
conflicting
unknown
compensation_required
```

这些状态必须与 Connector Result、Work Completion 和外部副作用结果分开。

#### 建议采用四类游标

```text
Source Cursor
Acceptance Cursor
Processing Cursor
Projection Cursor
```

游标应绑定：

```text
connector_id
instance_id
stream_id
cursor_epoch
sequence_or_position
observed_at
```

跨实例合并不能简单比较本地序列；需要结合来源、业务 Revision、因果关系或明确的 `ordering_unknown`。

#### 建议的缺口协议原则

1. 平台发现缺口时生成结构化 Gap Record，不静默跳过；
2. Gap Record 记录范围、来源、发现依据、风险、当前状态和建议动作；
3. Connector 可以补发、证明不存在、声明不可恢复或返回未知；
4. 平台不能把“Connector 没有补发”解释为“事件从未发生”；
5. 高风险状态在关键缺口未解决前不得自动执行；
6. 缺口解决后需要重新计算受影响的状态、投影、权限和 RunGate。

#### 建议的幂等与重放原则

- `message_id` 处理消息级重复；
- `idempotency_key` 处理同一业务意图的重复请求；
- 资源 Revision / Hash 防止旧内容覆盖新内容；
- RunGate 代次防止旧执行资格重用；
- 重放事件不覆盖新规范状态，只能追加历史事实或生成冲突候选；
- 已知重复返回原处理结果或重复状态，不重复触发外部副作用。

#### 建议的补偿边界

补偿分为：

```text
transport_retry
state_reconciliation
resource_refresh
external_cancel_or_reverse
manual_decision
```

只有前两类可以在明确的低风险、幂等条件下自动化；外部取消、反向操作和高风险修复需要新的 Policy Decision、Approval、RunGate 和 Verification。

#### 建议确认的核心不变量

```text
接收 ≠ 接纳
接纳 ≠ 处理
处理 ≠ 投影完成
投影完成 ≠ 外部副作用完成
重复消息 ≠ 重复业务意图
缺口未知 ≠ 事件不存在
重试 ≠ 补偿
补偿 ≠ 自动回滚
乱序 ≠ 失败
unknown ≠ 成功
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：建议将复杂状态聚合为“同步中、部分同步、存在缺口、已隔离、需要补发、存在冲突、外部结果未知、需要人工处理”；用户应能看到影响范围与下一步。
- **架构**：支持游标分层、事件接纳状态机和消息/业务幂等分离；要求缺口、乱序和投影状态绑定来源 Revision，不能用一个 offset 覆盖全流程。
- **可靠性**：要求补发退避、死信、隔离、重同步和补偿队列；补发风暴、跨实例乱序和外部副作用未知需要限流和升级。
- **安全/隐私**：要求离线消息重新验证身份、Scope、撤销、敏感性和保留状态；不能借补发绕过当前权限或恢复已撤回内容。

专家团综合建议：采用事件接纳状态机、四类游标、结构化 Gap Record、消息级与业务级幂等分离；自动化优先处理可验证、低风险、幂等的传输和状态协调，高风险副作用补偿必须重新过门禁。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求进入下一轮。本轮确认：

1. 离线补发采用事件接纳状态机，并将 Connector Result、Work Completion 和外部副作用结果分开表达。
2. Source Cursor、Acceptance Cursor、Processing Cursor 和 Projection Cursor 分离；平台接收游标不等于业务处理或投影游标。
3. Gap Record 结构化记录缺口范围、来源、发现依据、风险、状态和建议动作；缺口未知不等于事件不存在，高风险状态在关键缺口未解决前不得自动执行。
4. 事件同时保留发生时间、观察时间、接收时间、来源序列、平台 Revision 和因果关系；乱序、迟到和因果未知不得被简单当作失败或覆盖新规范状态。
5. `message_id` 处理消息级重复，`idempotency_key` 处理业务意图级重复，资源 Revision/Hash 和 RunGate 代次防止旧内容或旧执行资格重用。
6. 补偿与重试分离；传输重试和低风险状态协调可在明确幂等条件下自动化，外部取消、反向操作和高风险修复必须重新经过授权、审批、RunGate 和验证。
7. 离线消息重新接纳必须重新验证身份、Scope、撤销、敏感性、保留状态、完整性、新鲜度、防重放和幂等性；补发不得绕过当前治理。

### 第 2 轮：阶段 1：头脑风暴

本轮聚焦缺口、乱序和重放的版本/因果裁决、补发窗口和补偿责任。

#### 1. 缺口的形成原因必须区分

```text
not_generated
created_but_not_persisted
persisted_not_uploaded
uploaded_not_acknowledged
accepted_not_processed
processed_not_projected
source_deleted_or_unavailable
permission_blocked
retention_blocked
unknown
```

这些状态的补救不同。平台不能把所有缺口都交给 Connector 重发，也不能把无法观察归因于 Connector 丢失。

#### 2. 缺口范围与影响范围分离

缺口本身需要表达：

```text
stream_id
source_instance
cursor_epoch
from_position
to_position
detection_basis
detected_at
```

影响范围需要另行计算：

```text
affected_work_threads
affected_revisions
affected_projections
affected_permissions
affected_run_gates
affected_external_actions
```

缺口范围不等于影响范围；一个缺口可能只影响投影，也可能影响当前执行资格。

#### 3. 乱序裁决候选

优先级候选：

```text
explicit_causal_parent
business_revision_parent
source_sequence_same_stream
observed_at
received_at
```

接收时间只能作为观测信息，不能作为业务顺序真源。

当两个事件无法建立可靠因果关系时，候选结果应为：

```text
order_resolved
order_deferred
causal_conflict
ordering_unknown
```

#### 4. 版本与旧事件

事件至少关联：

```text
schema_version
contract_version
source_cursor_epoch
business_revision
work_thread_revision
resource_revision_set
policy_revision_at_observation
```

旧事件可以作为历史事实保留，但不能自动覆盖当前规范 Revision。若旧事件与当前状态冲突，应生成冲突候选或校正记录，而不是修改历史。

#### 5. 补发窗口候选

补发窗口可能基于：

- Connector 保留窗口；
- 平台事件保留窗口；
- Work Thread 保留和 legal hold；
- 事件风险和敏感性；
- 当前权限与历史权限；
- 资源和凭证有效期；
- 组织合规和删除/匿名化请求。

因此：

```text
事件还在 Connector 本地 ≠ 平台必然允许补发
事件已过期 ≠ 可以静默丢失
当前无权 ≠ 可以复制历史敏感正文
```

补发可能需要：

```text
full_replay
metadata_only_replay
redacted_replay
reference_only
manual_export
unrecoverable_with_evidence
```

#### 6. 补偿责任候选

需要区分责任对象：

```text
Connector persistence
Connector delivery
Platform acceptance
Platform processing
Projection service
Harness execution
External system
```

每个环节只能对可证明的状态负责。平台应记录责任候选和证据，不自动把未知状态归责给某一方。

#### 7. 补偿的状态机

```text
compensation_candidate
assessed
approved
scheduled
executing
observed
verified
failed
rejected
manual_required
```

补偿动作要绑定原动作、原因、风险、幂等键、目标资源 Revision、授权、审批、RunGate 和验证标准。

### 第 2 轮：阶段 2：其他产品如何做（带来源）

- Apache Kafka Documentation：<https://kafka.apache.org/documentation/>（访问：2026-09-19）。参考 offset、transaction、消费位置和传递语义；传输层保证不能自动推出业务因果和补偿成功。
- Transactional Outbox Pattern：<https://microservices.io/patterns/data/transactional-outbox.html>（访问：2026-09-19）。参考业务写入与待发送消息的事务关联及消费者幂等；不能保证跨外部系统副作用可回滚。
- CloudEvents Specification：<https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>（访问：2026-09-19）。参考事件 ID、来源、类型和时间；不定义缺口、补发窗口和业务接纳。
- Kubernetes API Concepts：<https://kubernetes.io/docs/reference/using-api/api-concepts/>（访问：2026-09-19）。参考 Resource Version、Watch、断线和重新同步；不能替代 Work Thread 因果和权限模型。
- AWS EventBridge Event Delivery：<https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-delivery.html>（访问：2026-09-19）。参考重试和死信的运营边界；重试不等于补偿，死信不等于事件不存在。

共同规律：必须区分产生、持久化、投递、接纳、处理和投影；游标/offset 不足以表达业务因果；重复与至少一次投递需要消费者幂等；不可恢复消息应隔离并保留证据。

### 第 2 轮：阶段 3：总结、结论与建议

#### 建议建立“Gap Record + Impact Assessment”两层模型

```text
Gap Record
  → 影响分析
  → 风险与门禁重算
  → 补发 / 隔离 / 降级 / 人工处理
```

Gap Record 只描述观察到的缺口，不直接决定业务影响。Impact Assessment 计算受影响的 Work Thread、Revision、Projection、权限、RunGate 和外部动作。

#### 建议采用来源与版本裁决

事件接纳排序优先使用：

```text
显式因果父关系
> 同一来源流的合法序列
> 业务 Revision 父关系
> 其他可验证的版本依据
> 观测时间
> 接收时间
```

如果依据冲突或不足：

```text
order_deferred / causal_conflict / ordering_unknown
```

不能用“最新接收”直接覆盖当前状态。

#### 建议采用分层补发窗口

补发许可应至少检查：

```text
来源仍可验证
+ 消息未被撤回或处置
+ 当前主体/Connector 有权
+ Purpose 允许
+ 敏感性与脱敏满足
+ 保留和 legal hold 不冲突
+ 事件可防重放
+ 目标 Revision 可重新接纳
```

补发内容按最小必要原则选择：

```text
full / metadata_only / redacted / reference_only / unavailable_with_evidence
```

#### 建议的责任与补偿边界

平台记录每个阶段的事实和证据：

```text
source_persisted
platform_received
platform_accepted
platform_processed
projection_updated
harness_started
external_sent
external_acknowledged
business_verified
```

只有在相应证据存在时才推进状态。补偿由原动作和失败阶段决定，不能把传输重试自动升级为外部反向操作。

#### 建议的补偿决策

```text
低风险 + 幂等 + 无外部副作用 → 可受策略约束自动重试/协调
有外部副作用但可 Probe → 先 Probe，再决定补偿
不可确认外部状态 → unknown + Incident/人工确认
需要取消/反向操作 → 新授权 + Approval + RunGate + Verification
高风险或跨 Scope → 禁止静默自动补偿
```

#### 建议确认的核心不变量

```text
缺口范围 ≠ 业务影响范围
接收游标 ≠ 业务因果
旧事件保留 ≠ 当前状态覆盖
补发可用 ≠ 补发获准
重试成功 ≠ 业务补偿成功
责任未知 ≠ 任意一方失败
死信 ≠ 事件不存在
```

### 第 2 轮：阶段 4：专家团讨论

- **产品/UX**：支持将 Gap Record 和影响分析分别展示；用户应看到“缺了什么、影响什么、建议怎么做”，而不是单一同步失败。
- **架构**：支持因果优先、版本绑定和旧事件追加式处理；要求 Gap Record、Impact Assessment 和补偿决定分开建模。
- **可靠性**：要求补发窗口、死信、重同步和补偿队列有超时、限流、优先级和升级路径；不得因消息堆积而自动跳过关键缺口。
- **安全/隐私**：要求补发重新经过当前权限、Purpose、敏感性、撤回和保留检查；历史敏感正文优先使用脱敏或引用，不得借补发恢复已撤回数据。

专家团综合建议：采用 Gap Record 与 Impact Assessment 两层模型；采用因果/版本优先的乱序裁决；按风险和权限分层补发；补偿责任依证据阶段分配；外部副作用补偿始终独立过门禁。

### 第 2 轮：阶段 4 综合建议

本轮建议确认：

1. 缺口原因、缺口范围和业务影响分开表达；Gap Record 不直接等于业务失败。
2. 乱序按显式因果、合法来源序列和业务 Revision 优先裁决；无法裁决时保留 `order_deferred`、`causal_conflict` 或 `ordering_unknown`。
3. 旧事件可保留为历史，但不能自动覆盖当前规范 Revision；冲突采用追加式候选或校正记录。
4. 补发窗口受来源、撤回、权限、Purpose、敏感性、保留、legal hold、防重放和目标 Revision 共同约束，并支持全量、元数据、脱敏、引用和有证据不可恢复等投影。
5. 补偿责任按持久化、投递、接纳、处理、投影、Harness 执行和外部系统阶段记录；未知不自动归责。
6. 外部取消、反向操作和高风险补偿必须重新授权、审批、RunGate 和验证；低风险幂等传输协调才可受策略约束自动化。

### 第 2 轮确认沉淀

用户已确认第 2 轮结论并要求进入下一轮。本轮确认：

1. 缺口原因、缺口范围和业务影响分开表达；采用 `Gap Record + Impact Assessment` 两层模型，Gap Record 不直接等于业务失败。
2. 乱序按显式因果、合法来源序列和业务 Revision 优先裁决；无法裁决时保留 `order_deferred`、`causal_conflict` 或 `ordering_unknown`，不以最新接收事件覆盖当前状态。
3. 旧事件可作为历史事实保留，但不能自动覆盖当前规范 Revision；冲突采用追加式候选或校正记录。
4. 补发窗口受来源、撤回、权限、Purpose、敏感性、保留、legal hold、防重放和目标 Revision 共同约束，并支持全量、元数据、脱敏、引用和有证据不可恢复等投影。
5. 补偿责任按持久化、投递、接纳、处理、投影、Harness 执行和外部系统阶段记录；未知不自动归责。
6. 外部取消、反向操作和高风险补偿必须重新授权、审批、RunGate 和验证；低风险幂等传输协调才可受策略约束自动化。

### 第 2 轮：已确认并沉淀

用户已确认第 2 轮结论并要求完成子议题 18、进入下一个暂缓项。本轮确认：

1. 缺口原因、缺口范围和业务影响分开表达；采用 `Gap Record + Impact Assessment` 两层模型，Gap Record 不直接等于业务失败。
2. 乱序按显式因果、合法来源序列和业务 Revision 优先裁决；无法裁决时保留 `order_deferred`、`causal_conflict` 或 `ordering_unknown`，不以最新接收事件覆盖当前状态。
3. 旧事件可作为历史事实保留，但不能自动覆盖当前规范 Revision；冲突采用追加式候选或校正记录。
4. 补发窗口受来源、撤回、权限、Purpose、敏感性、保留、legal hold、防重放和目标 Revision 共同约束，并支持全量、元数据、脱敏、引用和有证据不可恢复等投影。
5. 补偿责任按持久化、投递、接纳、处理、投影、Harness 执行和外部系统阶段记录；未知不自动归责。
6. 外部取消、反向操作和高风险补偿必须重新授权、审批、RunGate 和验证；低风险幂等传输协调才可受策略约束自动化。

子议题深化 18 已完成两轮发现、调研、综合建议和专家讨论，并经用户确认沉淀；不表示离线补发的全部实现 Schema、窗口参数和运营 SLA 已固化。

## 子议题深化 19：L3 环境恢复的幂等、安全和外部副作用边界

**状态：第 1 轮待审核**

### 主题与成功标准

本主题承接暂缓项顺序中的第 4 项，讨论 L3 环境重连、重建和原环境恢复如何避免重复副作用、越权恢复和状态误判。成功标准是明确恢复动作、外部副作用、权限/RunGate、幂等、验证和未知状态的边界；不把环境恢复自动等同于 Work Thread 完成或原环境完全恢复。

### 第 1 轮：阶段 1：头脑风暴

#### 需要区分的恢复对象

```text
workspace
repository_checkout
branch_and_revision
container_or_vm
process_or_job
terminal
browser_session
credential_context
private_prompt_or_session
external_resource_state
```

恢复等级继续分开：

```text
L1 semantic continuation
L2 operational continuation
L3 environment continuation
```

L3 又应区分：

```text
reconnect
rebuild
restore_original
```

#### 主要风险

- 重建环境时重复执行启动脚本或部署动作；
- 恢复旧分支、旧资源或旧凭证造成越权；
- 原进程实际仍在运行，平台却再次启动；
- 外部 Job 已提交但结果未知，恢复动作再次提交；
- 环境快照过期、被撤回或与 Work Thread Revision 不匹配；
- 恢复动作本身拥有超过当前主体的工具权限；
- 环境恢复成功但资源、代码或审批状态并未恢复；
- 失败重试把可观测动作升级成外部副作用。

#### 候选恢复动作状态

```text
requested
assessed
authorized
planned
reconnecting
rebuilding
restoring
partially_restored
verified
failed
unknown
blocked
```

动作结果必须与：

```text
environment_state
resource_state
process_state
external_effect_state
work_continuation_state
```

分开表达。

#### 幂等关键

恢复请求至少绑定：

```text
recovery_request_id
work_thread_revision
environment_identity
target_revision
connector_instance
credential_or_lease_revision
run_gate_revision
idempotency_key
```

但幂等键只防止重复同一请求，不代表外部系统已经没有重复动作；必须结合 Probe、目标资源版本和外部幂等能力。

#### 安全边界

恢复前重新检查：主体、Scope、Purpose、敏感性、当前 Tool Policy、Connector 能力、资源 Revision、审批、RunGate 和租约。不得恢复私有 Prompt、私有推理、旧登录态、凭据、旧审批或旧 Tool Policy。

#### 外部副作用

恢复动作可能触发：启动 Job、创建容器、写入代码、部署、发送消息、修改外部对象、重启服务。候选策略：

```text
observe_first
reconnect_only
rebuild_without_side_effect
restore_after_approval
new_execution
manual_recovery
```

默认不能把“恢复环境”理解为“重做上次动作”。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- Kubernetes API Concepts：<https://kubernetes.io/docs/reference/using-api/api-concepts/>（访问：2026-09-19）。参考资源版本、Watch 和状态与请求分离；不直接解决 Work Thread 恢复责任。
- Kubernetes Jobs：<https://kubernetes.io/docs/concepts/workloads/controllers/job/>（访问：2026-09-19）。参考 Job 状态、重试和完成语义；Job 重试不等于业务动作幂等。
- Terraform State：<https://developer.hashicorp.com/terraform/language/state>（访问：2026-09-19）。参考期望状态与实际状态分离、状态锁和刷新；不替代平台权限和外部副作用门禁。
- Temporal Workflows：<https://docs.temporal.io/workflows>（访问：2026-09-19）。参考工作流持久化、重放确定性和 Activity 与副作用分离；不能直接保证任意外部动作可回滚。
- OAuth 2.0：<https://www.rfc-editor.org/rfc/rfc6749>（访问：2026-09-19）。参考访问令牌、Scope 和有效期；恢复时必须重新授权，不能自动继承旧凭证。

共同规律：状态观察、资源重建、工作流恢复和外部动作分开；恢复需要当前版本、当前权限和幂等/验证依据；“任务重新运行”不能等同“原动作只执行一次”。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议的恢复门禁

```text
恢复请求
→ 识别恢复等级和目标
→ 获取当前环境/资源事实
→ 检查版本、权限、Scope、Purpose 和敏感性
→ 评估外部副作用
→ Approval / RunGate
→ 执行 reconnect / rebuild / restore
→ Probe 与结果验证
→ 形成 Recovery Result
```

#### 建议的恢复结果

```text
reconnected
rebuilt
original_restored
partially_restored
restored_but_unverified
blocked
failed
unknown
```

`original_restored` 需要证据支持；工作目录可用不等于原进程、浏览器、登录态或旧权限恢复。

#### 建议的副作用规则

1. 观察和 Probe 默认不产生业务副作用；
2. 重连优先于重建，重建优先于原环境恢复；
3. 任何可能产生外部副作用的恢复动作先经过风险评估和 RunGate；
4. 外部动作状态未知时，不自动重复提交，先 Probe、对账或人工确认；
5. 恢复失败重试必须复用或重新生成明确幂等键，并重新检查当前授权；
6. 恢复动作不恢复旧审批、旧凭证、旧 Tool Policy 或旧执行资格。

#### 核心不变量

```text
重连 ≠ 重建 ≠ 原环境恢复
环境可用 ≠ 工作恢复
恢复成功 ≠ 验证成功
恢复重试 ≠ 外部动作可重复
旧快照 ≠ 当前授权
旧 RunGate ≠ 新执行资格
unknown ≠ 未发生
unknown ≠ 可以重试
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：建议向用户区分“已重连、已重建、部分恢复、待验证、需要审批、外部结果未知”，展示恢复范围和未恢复对象。
- **架构**：支持恢复动作与环境状态、资源状态、外部效果和 Work Completion 分离；要求恢复请求、环境版本和 RunGate 可追踪。
- **可靠性**：要求恢复任务有超时、租约、Probe、对账、限流和人工接管；未知状态不能默认重试，避免 Job/部署重复。
- **安全/隐私**：要求恢复前重新授权；不迁移私有 Prompt、凭据、登录态和旧 Tool Policy；高风险外部副作用 fail-closed。

专家团建议采用“当前事实获取 + 恢复等级选择 + 当前授权/RunGate + 幂等执行 + Probe/验证”的分层模型；原环境恢复应是最强声明、最弱默认承诺。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求进入下一个暂缓项。本轮确认：

1. L3 恢复区分 reconnect、rebuild 和 restore_original；恢复结果与环境状态、资源状态、进程状态、外部效果和 Work Continuation 分开表达。
2. 恢复前重新检查主体、Scope、Purpose、敏感性、Tool Policy、Connector 能力、资源 Revision、审批、RunGate 和租约；不恢复旧凭据、旧审批、旧 Tool Policy、私有 Prompt、私有推理或私有 Session。
3. 重连优先于重建，重建优先于原环境恢复；任何外部副作用都必须独立评估并过当前 RunGate。
4. 恢复请求绑定环境身份、目标 Revision、凭证/租约版本和幂等键；未知外部状态不得自动重复提交，需 Probe、对账或人工确认。
5. 恢复成功、环境可用、验证成功和 Work Completion 分开；`original_restored` 必须有证据支持。
6. 失败、超时、身份服务不可用和外部状态未知时，可进入只读、Probe、隔离或人工接管；不得无限续用旧授权或把重试当作安全幂等。

子议题深化 19 已完成第 1 轮并经用户确认沉淀；不表示 L3 恢复的最终 Schema、幂等参数和外部补偿协议已经固化。

## 子议题深化 20：MCP、A2A 与 Connector Contract 的具体映射和版本兼容

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接暂缓项顺序中的第 5 项，讨论 MCP、A2A、HTTP、SDK 等外部协议如何适配 Connector Contract，而不替代平台对象、权限、事件、恢复和 RunGate。成功标准是明确映射层、能力/版本协商、错误与结果转换、语义丢失标记和兼容边界。

### 第 1 轮：阶段 1：头脑风暴

- MCP 的 tool/resource/prompt 与平台的操作、资源引用、Connector Result 如何映射；
- A2A 的 Agent Card、Task、Message、Artifact 与 Work Thread、Execution、Evidence、Continuation Package 如何映射；
- HTTP/SDK 只作为传输适配，不能创建第二套权限和生命周期真源；
- 外部协议版本、Connector Contract 版本、Operation/Event Schema 版本和 Adapter 版本分开；
- 外部协议无法表达的字段必须标记为 unsupported、lossy、platform_only 或 requires_follow_up，而不是静默丢失；
- MCP/A2A 的能力声明、认证和任务状态不能自动获得平台授权或执行资格。

候选映射原则：

```text
External Protocol
→ Adapter
→ Connector Contract V1
→ Platform Domain Objects
```

禁止反向让外部协议对象成为 Work Thread、Owner、ACL、审批、知识发布或保留策略真源。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- MCP Basic/Versioning：<https://modelcontextprotocol.io/specification/2025-06-18/basic>、<https://modelcontextprotocol.io/specification/2025-06-18/basic/versioning>（访问：2026-09-19）。参考初始化、版本协商、能力声明和错误表达；不解决 Work Thread 权限与 RunGate。
- A2A Specification：<https://a2a-protocol.org/latest/specification/>（访问：2026-09-19）。参考 Agent Card、Task、Message、Artifact 和任务生命周期；不替代平台 Owner、血缘和审批。
- CloudEvents Specification：<https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>（访问：2026-09-19）。参考事件信封、来源、ID 和类型；不定义跨协议业务映射。
- OpenTelemetry OTLP：<https://opentelemetry.io/docs/specs/otlp/>（访问：2026-09-19）。参考传输与数据模型分离；Trace 不替代 Business Revision 或权限。

共同规律：外部协议解决通信、工具、Agent 任务或遥测中的一部分问题；适配层必须保存平台语义，版本和能力不能混为一个字段。

### 第 1 轮：阶段 3：总结、结论与建议

建议建立显式 `Protocol Adapter`，每个映射记录：

```text
external_protocol
external_version
adapter_version
connector_contract_version
mapping_profile
lossiness
unsupported_fields
source_reference
```

建议采用以下映射边界：

| 外部对象 | 可映射的平台对象 | 不自动等同 |
|---|---|---|
| MCP Tool | Connector Operation / Capability | 平台授权、RunGate、Work Completion |
| MCP Resource | Resource Reference / Probe | 可信证据、当前可执行资源 |
| MCP Prompt | 受控输入引用 | 私有 Prompt、平台记忆或审批 |
| A2A Agent Card | Connector/Agent Capability Declaration | Owner、ACL、当前能力事实 |
| A2A Task | Execution / Task Projection | Work Thread、责任转移、完成结论 |
| A2A Message | Event / ContextTransfer Candidate | 规范 Revision、权限授予 |
| A2A Artifact | Evidence / Resource Reference | 已验证事实、知识发布 |
| HTTP/SDK Request | Contract Message | 业务接纳、执行成功 |

映射结果应至少区分：

```text
mapped
mapped_with_loss
unsupported
requires_platform_follow_up
rejected_for_policy
```

版本兼容采用：外部协议版本、Adapter 版本、Contract 版本和 Payload Schema 版本分开；破坏性映射显式拒绝或进入人工处理；未知字段不能静默变成平台事实。

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：建议用户看到“已映射、部分映射、需平台确认、能力不足、被策略阻断”，不要暴露协议字段差异作为主要状态。
- **架构**：要求适配器无权创建第二套 ACL、Owner 或生命周期；映射必须绑定版本、来源和语义损失。
- **可靠性**：要求适配器健康、版本兼容、降级和死信可观测；协议转换失败不能丢失原始受控引用。
- **安全/隐私**：要求外部协议传入的资源、Prompt、Artifact 和 Trace 重新授权、脱敏和验证；协议能力声明不等于执行资格。

专家团建议采用“外部协议适配层 → Connector Contract → 平台规范对象”的单向语义边界；MCP/A2A 映射只能提供候选能力和受控投影，不能绕过平台策略。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求进入下一个暂缓项。本轮确认：

1. MCP、A2A、HTTP 和 SDK 通过显式 Protocol Adapter 接入 Connector Contract；外部协议对象不成为 Work Thread、Owner、ACL、审批、知识发布或保留策略真源。
2. 外部协议版本、Adapter 版本、Connector Contract 版本和 Payload/Event Schema 版本分开记录；版本号不能替代能力、策略和资源兼容判定。
3. MCP Tool/Resource/Prompt、A2A Agent Card/Task/Message/Artifact 只能映射为受控的 Operation、Capability、Resource Reference、Evidence、Execution 或候选 ContextTransfer；不自动等同平台授权、RunGate、Work Completion 或已验证事实。
4. 映射结果至少区分 `mapped`、`mapped_with_loss`、`unsupported`、`requires_platform_follow_up` 和 `rejected_for_policy`；语义损失、未支持字段和来源必须显式记录，不能静默丢失。
5. 外部协议传入的资源、Prompt、Artifact、Trace、能力声明和任务状态仍需经过平台身份、权限、敏感性、血缘、撤回和执行门禁。
6. 适配器失败、降级和死信必须可观测；协议转换成功不等于消息接纳、资源可信、执行成功或 Work Completion。

子议题深化 20 已完成第 1 轮并经用户确认沉淀；不表示 MCP/A2A 的全部字段映射和版本兼容矩阵已经固化。

## 子议题深化 21：Harness Cache 撤回和外部缓存清除验证

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接暂缓项顺序中的第 6 项，讨论 Memory Platform 已撤回、删除、匿名化、降权或策略变更后，如何处理外部 Harness、Connector、浏览器、Agent Runtime 和其他缓存中的工作记忆、资源投影、Continuation Package、Prompt 投影、索引和派生结果。

成功标准是明确：平台撤回能力边界、外部缓存责任、清除请求、清除确认、无法确认、继续传播阻断和审计证据如何表达；不把平台删除成功伪装成所有外部副本已经消失。

### 第 1 轮：阶段 1：头脑风暴

#### 1. 缓存对象需要分层

可能存在：

```text
platform_snapshot
platform_projection
connector_local_cache
harness_context_cache
prompt_projection
retrieval_index
embedding_or_vector_cache
browser_or_terminal_state
artifact_copy
execution_log
external_system_copy
backup_or_cold_storage
```

这些对象的控制权、清除能力、保留周期和可验证性不同，不能统一称为“缓存”。

#### 2. 撤回触发原因

```text
privacy_request
retention_expiry
legal_hold_change
policy_change
permission_revocation
source_correction
security_incident
user_requested_retraction
knowledge_unpublish
```

不同原因可能要求删除、匿名化、停止传播、降权、隔离或仅禁止新检索，不能一律物理删除。

#### 3. 撤回动作候选

```text
stop_new_distribution
revoke_access
invalidate_reference
remove_from_index
redact
anonymize
delete
quarantine
expire
confirm_external_clearance
```

“停止新分发”与“清除历史副本”是不同动作；“从索引移除”不等于正文已清除。

#### 4. 外部清除结果

```text
requested
accepted
in_progress
cleared
cleared_with_evidence
partially_cleared
not_supported
unreachable
unknown
blocked_by_retention_or_legal_hold
```

平台只能对 Connector 或 Harness 回报的可验证范围作结论。无法确认时必须保留 `unknown`，并阻断继续注入和传播。

#### 5. 传播闭包

撤回可能影响：

```text
source_memory
snapshot
projection
retrieval_index
embedding
continuation_package
harness_cache
agent_context
derived_asset
external_copy
```

还需要评估下游传播：已导出文件、已创建分支、已发送消息、已生成知识、已产生摘要和已经进入其他空间的派生资产。

#### 6. 恢复与副作用

缓存清除本身可能触发：Connector 调用、Harness API、索引删除、外部系统删除或重建。高风险清除需要当前授权、审批、幂等、目标范围和验证；不能因清除失败而自动扩大删除范围。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- MDN HTTP Cache-Control：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control>（访问：2026-09-19）。参考 `no-cache`、`no-store`、重新验证和缓存控制；HTTP 指令不保证所有下游副本已清除。
- HTTP ETag：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag>（访问：2026-09-19）。参考资源版本校验；ETag 不表达撤回、删除和跨系统传播闭包。
- Kubernetes API Concepts：<https://kubernetes.io/docs/reference/using-api/api-concepts/>（访问：2026-09-19）。参考资源版本、Watch 和重新同步；资源状态变化不保证所有客户端缓存即时清除。
- RFC 7234 / HTTP Caching：<https://www.rfc-editor.org/rfc/rfc7234>（访问：2026-09-19）。参考缓存新鲜度和验证器；缓存协议不替代组织保留、隐私和审计责任。

共同规律：禁止继续使用、重新验证、索引移除、正文删除和外部清除是不同动作；缓存清除能力必须声明和验证，不能凭平台本地状态推断外部副本已消失。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议采用“撤回请求 + 传播闭包 + 清除证明”模型

```text
Retraction Request
  → Impact / Propagation Assessment
  → Stop New Distribution
  → Revoke / Invalidate / Redact / Delete
  → External Clearance
  → Verification
  → Closure or Closed With Unknowns
```

#### 建议分开五类状态

```text
Distribution Status
Access Status
Content Status
External Clearance Status
Verification Status
```

例如：

```text
Distribution = stopped
Access = revoked
Content = platform_deleted
External_Clearance = unknown
Verification = incomplete
```

不能把它合并成“已删除”。

#### 建议的最小传播记录

```text
source_object
source_revision
sensitivity
retraction_reason
affected_spaces
affected_projections
affected_caches
affected_indexes
affected_connectors
affected_harnesses
required_action
current_status
evidence_reference
```

传播范围必须受权限、血缘、Scope、Purpose、保留锁定和 legal hold 约束。

#### 建议的 Connector / Harness 合同边界

Connector 或 Harness 应声明：

- 可定位哪些缓存或副本；
- 支持撤回、删除、匿名化还是仅停止新注入；
- 是否支持确认清除范围；
- 是否能提供版本、Hash、时间和目标引用；
- 不可达、部分清除和未知如何回报；
- 清除请求是否幂等以及是否产生外部副作用。

Connector 回报 `cleared` 只证明其声明范围内已完成，不自动证明其他 Harness、备份或人工导出副本已清除。

#### 建议的撤回决策

```text
高置信清除 + 已验证 → closed
部分清除 + 影响已知 → partially_cleared
无法确认 + 继续传播有风险 → stopped_with_unknowns
受保留/法律锁定 → blocked_by_retention_or_legal_hold
不支持清除 → access_revoked + not_supported
```

`unknown` 时至少停止新检索、注入、导出和传播；是否允许已在途的低风险只读操作，需要策略明确决定。

#### 核心不变量

```text
平台删除 ≠ 外部副本清除
停止分发 ≠ 历史副本消失
移除索引 ≠ 正文删除
Connector 已清除 ≠ 全部 Harness 已清除
清除请求已接受 ≠ 清除已验证
unknown ≠ cleared
legal hold ≠ 普通删除失败
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：用户需要看到“已停止传播、平台已撤回、外部清除中、部分清除、无法确认、受法律保留阻断”，并能查看影响范围和责任方。
- **架构**：支持撤回请求、传播闭包、外部清除和验证分离；要求引用、Revision、Hash 和证据绑定，防止一个 Connector 回报覆盖全局状态。
- **可靠性**：要求清除任务可重试、幂等、限流、死信和人工升级；外部系统不可达时保持未知并阻断新传播。
- **安全/隐私**：要求撤回优先级高于普通缓存命中和知识发布；清除范围按敏感性、血缘、法律保留和主体授权计算，不能扩大到无关数据。

专家团综合建议：采用“停止新分发优先、传播闭包评估、按能力执行撤回、分范围验证、未知即限制传播”的模型；不宣称对不可控外部副本拥有物理删除能力。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求沉淀子议题 21、进入下一个暂缓项。本轮确认：

1. Harness Cache、Connector Cache、索引、Embedding、Continuation Package、Artifact、浏览器/终端状态和外部副本分开治理；控制权、清除能力、保留周期和可验证性不同。
2. 撤回请求、传播闭包评估、停止新分发、访问撤销、内容处理、外部清除和最终验证分开表达；平台删除不等于外部副本清除。
3. 清除结果区分已清除、部分清除、不支持、不可达、未知和受保留/法律锁定阻断；`unknown` 时至少停止新检索、注入、导出和传播。
4. Connector/Harness 的 `cleared` 只证明其声明范围内的结果；不能推断其他 Harness、备份、人工导出或不可控副本已经清除。
5. 撤回传播按敏感性、血缘、Scope、Purpose、保留锁定和 legal hold 计算；清除请求必须幂等、可重试、可限流、可审计，不能因失败自动扩大删除范围。
6. 撤回优先级高于普通缓存命中和知识发布；停止新分发与清除历史副本分开，无法确认时保持受限状态而不伪装成功。

子议题深化 21 已完成第 1 轮并经用户确认沉淀；不表示外部缓存清除的最终合同、验证算法和责任 SLA 已固化。

## 子议题深化 22：Trace 采样、脱敏、长期保留与审计闭包

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接暂缓项顺序中的第 7 项，讨论 Connector、Harness、平台和治理链路中的 Trace 如何采样、脱敏、关联、保留和撤回，同时保持排障价值、审计完整性与隐私最小化。

成功标准是明确：Trace 与 Business Revision、Audit Record、Event、Evidence 的边界；采样不能漏掉高风险闭包；敏感字段、Prompt、推理、资源正文和凭据如何禁止进入 Trace；长期保留、访问、撤回和法律保留如何治理。

### 第 1 轮：阶段 1：头脑风暴

#### 1. Trace 不是什么

```text
Trace ≠ Business Revision
Trace ≠ Audit Record
Trace ≠ Work Completion
Trace ≠ Evidence
Trace ≠ 完整 Prompt / 推理 / 凭据
```

Trace 主要关联跨服务路径、延迟、错误、重试和调用关系；业务事实、审批、权限决定、外部副作用和验证结论需要独立对象。

#### 2. 采样风险

- 全量采样成本高且可能扩大敏感暴露；
- 随机采样可能漏掉高风险、失败、撤回和安全事件；
- 采样发生在脱敏前可能把敏感正文写入采集链；
- 只保留成功 Trace 会漏掉 unknown、部分成功和权限阻断；
- Trace 被长期保留后，原始资源已删除但 Trace 仍含可重建信息；
- 跨租户 Trace ID、Span Link 和错误详情可能形成越权关联。

#### 3. 候选采样策略

```text
head_sampling
 tail_sampling
priority_sampling
risk_triggered_sampling
error_triggered_sampling
incident_hold_sampling
adaptive_sampling
```

建议按动作、风险、敏感性、失败状态、撤回状态和租户策略共同决定，而不是统一随机采样。

#### 4. 脱敏层次

```text
collection_time_redaction
attribute_allowlist
field_level_masking
tokenization
pseudonymization
content_hash_or_reference
payload_drop
```

默认不收集：凭据、Token、Cookie、私有 Prompt、私有推理、完整资源正文、完整命令输出和未授权的错误堆栈。可保留受控引用、类型、长度、Hash、Revision、状态和策略版本。

#### 5. 审计闭包

需要能够回答：

```text
谁发起了动作
使用了哪个 Connector / Harness
调用经过哪些服务
使用了哪个策略/审批/RunGate
访问了哪个资源 Revision
产生了什么外部副作用
结果和验证是什么
Trace 是否完整或采样
哪些字段被脱敏/删除
```

Trace 不完整时，Audit Record 不能假装完整；应记录缺失原因和替代证据。

#### 6. 长期保留与撤回

Trace 可能受：

```text
retention_policy
legal_hold
privacy_request
security_incident
audit_requirement
cost_limit
```

影响。Trace 的保留、访问、导出、匿名化和删除应与业务事件、审计记录、Evidence 和平台 Snapshot 分开治理。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- OpenTelemetry Trace API/SDK：<https://opentelemetry.io/docs/specs/otel/trace/>（访问：2026-09-19）。参考 Span、Attribute、Status 和 Span Link；Trace 数据模型不替代业务审计和权限。
- W3C Trace Context：<https://www.w3.org/TR/trace-context/>（访问：2026-09-19）。参考跨服务 Trace 关联与信任边界；Trace Context 不证明主体授权或业务完成。
- OpenTelemetry OTLP：<https://opentelemetry.io/docs/specs/otlp/>（访问：2026-09-19）。参考传输、数据模型和稳定性边界分离；不规定企业 Memory 的长期保留与撤回。
- OpenTelemetry Sampling：<https://opentelemetry.io/docs/concepts/sampling/>（访问：2026-09-19）。参考 Head/Tail Sampling 和采样决策；采样策略需要结合风险与审计要求。
- MDN HTTP Cache-Control：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control>（访问：2026-09-19）。参考缓存控制和 `no-store`；不替代 Trace 保留、访问和法律锁定策略。

共同规律：Trace 关联、采样、属性管理、传输和保留分层；采样不能自动满足审计；敏感属性必须在采集边界控制；长期保存需要独立生命周期和访问治理。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议建立四层模型

```text
Trace Context
  → Span / Link
  → Sanitized Telemetry
  → Audit / Business Evidence Closure
```

Trace Context 只关联调用链；Sanitized Telemetry 保留排障所需的最小属性；Audit/Evidence 记录业务决定和事实，不能用 Trace 补齐未发生的证据。

#### 建议的采样门禁

采样决策至少考虑：

```text
operation
risk_level
sensitivity
tenant_policy
error_or_unknown
external_side_effect
approval_or_incident
retraction_or_legal_hold
cost_budget
```

高风险、权限阻断、部分成功、unknown、撤回、Incident、审批和外部副作用相关 Trace 默认提高采样或进入受控保留，但仍必须先脱敏。

#### 建议的 Trace 内容边界

允许优先保留：

```text
trace_id
span_id
parent_span_id
operation_type
connector_id
adapter_version
contract_version
resource_type
resource_revision
policy_revision
outcome_category
latency
retry_count
redaction_profile
sampling_decision
```

禁止默认保留：

```text
credential
token
cookie
private_prompt
private_reasoning
full_resource_body
full_command_output
unredacted_stack
```

#### 建议的完整性表达

Audit Record 应记录：

```text
trace_present
trace_sampling_decision
trace_gap_reason
redaction_profile
linked_event_ids
linked_revision_ids
linked_policy_decision
linked_run_gate
linked_verification
```

如果 Trace 被采样、脱敏、删除或不可达，Audit 记录该事实；不能将 Trace 缺失解释为业务动作未发生。

#### 建议的长期保留与撤回

- Trace 默认短于业务审计和规范事件的保留期；
- 高风险 Incident 或 legal hold 可以延长保留，但必须绑定范围、原因和到期；
- 业务对象撤回时，Trace 中的资源引用、敏感属性和可重建内容也要评估；
- Trace 删除、匿名化、隔离和访问撤销分别表达；
- 导出 Trace 必须重新经过主体、Purpose、Scope、敏感性和审计授权。

#### 核心不变量

```text
Trace 采样 ≠ 审计完整
Trace 存在 ≠ 业务证据成立
Trace 缺失 ≠ 动作未发生
Trace ID ≠ 权限证明
脱敏 ≠ 完整删除
删除 Trace ≠ 删除业务事实
legal hold ≠ 无限保留
unknown ≠ 成功
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：用户需要看到“Trace 完整、部分采样、已脱敏、存在缺口、受保留锁定”，但不应被迫阅读底层 Span。
- **架构**：支持 Trace、Audit、Evidence 和 Event 分开；要求采样决策、脱敏 Profile 和 Trace Gap 可追踪，跨协议关联不改变业务 Revision。
- **可靠性**：要求高峰时自适应采样、Incident 提升、采样后端不可用时的降级和本地安全缓冲；不能让 Trace 采集阻塞业务动作。
- **安全/隐私**：要求采集前脱敏、属性白名单、禁止凭据和私有推理进入 Trace；Trace 访问和长期保留按最小必要、legal hold 和撤回策略治理。

专家团综合建议：采用“风险触发采样 + 采集边界脱敏 + Trace/Audit/Evidence 分离 + 缺口显式记录 + 独立保留/撤回”的模型；高风险采样提高不等于允许采集敏感正文。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求沉淀子议题 22、进入下一个暂缓项。本轮确认：

1. Trace Context、Span/Link、Sanitized Telemetry、Audit Record、Business Evidence 和 Event 分开表达；Trace 不替代 Business Revision、审计事实、权限决定、验证结果或 Work Completion。
2. 采样按操作、风险、敏感性、错误/unknown、外部副作用、审批/Incident、撤回/legal hold 和成本策略决定；高风险与异常链路提高采样，但不得因此采集凭据、私有 Prompt、私有推理或完整资源正文。
3. 脱敏应尽量在采集边界完成，采用属性白名单、字段遮蔽、Tokenization、伪名化、Hash/引用和 Payload Drop；Trace 记录脱敏 Profile 和采样决定。
4. Audit Record 必须记录 Trace 是否存在、采样/脱敏事实、缺口原因及关联 Event、Revision、Policy Decision、RunGate 和 Verification；Trace 缺失不等于动作未发生。
5. Trace 默认短于业务审计和规范事件保留期；legal hold、Incident、隐私请求、撤回、匿名化、删除和导出分别治理，且导出重新经过主体、Purpose、Scope 和敏感性授权。
6. Trace 采集或后端不可用时不能阻塞业务，但应记录 Trace Gap；高风险审计闭包不能假装完整。

子议题深化 22 已完成第 1 轮并经用户确认沉淀；不表示 Trace 的最终采样算法、脱敏 Profile、保留参数和审计接口已经固化。

## 子议题深化 23：Connector 失败重试、降级和人工接管配置

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接暂缓项顺序中的第 8 项，讨论 Connector 失败后何时重试、何时降级、何时暂停、何时交给人工，以及如何避免重试风暴、重复副作用、责任漂移和永久悬置。

成功标准是明确：失败分类、重试资格、退避、预算、降级能力、人工接管、责任和审计如何分离；不把网络重试自动等同业务重做，不把降级自动等同原操作完成。

### 第 1 轮：阶段 1：头脑风暴

#### 1. 失败不是单一状态

```text
protocol_error
validation_error
authentication_error
authorization_error
capability_error
rate_limited
transient_dependency_error
connector_unavailable
resource_conflict
policy_blocked
external_effect_unknown
partial_result
unknown
```

不同失败的默认动作不同：校验/授权通常不重试；暂时依赖故障可退避；能力不匹配应交接或降级；外部效果未知应先 Probe/对账，不能盲目重试。

#### 2. 重试的边界

重试对象需要分开：

```text
transport_retry
handshake_retry
resource_fetch_retry
probe_retry
event_append_retry
workflow_step_retry
external_side_effect_retry
compensation_retry
```

“重试 Connector 请求”不等于“重试外部业务动作”。每类操作需要独立的幂等键、预算、最大次数、时间窗和终止条件。

#### 3. 降级候选

```text
full_operation
read_only
probe_only
reference_only
metadata_only
manual_approval
handoff_to_other_harness
pause_until_dependency_recovers
reject
```

降级必须声明未满足项和实际能力：

```text
requested: environment.restore_original
effective: environment.reconnect
```

不应把降级结果标记为原请求成功。

#### 4. 重试风暴和级联失败

风险包括：

- 多层 Connector、Adapter、Harness 和外部服务各自重试；
- 同一 Work Thread 的多个 Run 并发重试；
- 失败消息批量补发造成突发流量；
- 外部系统已执行但响应丢失，重试造成重复副作用；
- 自动降级后仍保留旧 RunGate 或审批；
- 人工接管队列无限增长，责任无人确认。

候选控制：预算、退避、抖动、熔断、限流、单飞、优先级队列和 Retry-After。

#### 5. 人工接管不是简单报错

人工接管需要表达：

```text
handoff_candidate
reason
missing_capability
risk
affected_scope
suggested_harness
required_approver
waiting_for_confirmation
owner
sla
next_review_at
```

接管候选不自动转移 Owner、责任、审批、凭据、Tool Policy 或执行资格。

#### 6. 终止与升级

重试应有明确终止原因：

```text
retry_budget_exhausted
retry_window_expired
hard_failure
risk_budget_exhausted
external_state_unknown
policy_changed
connector_revoked
manual_required
```

终止后可以进入：隔离、Incident、人工接管、替代 Harness、受控关闭或带风险关闭。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- OpenTelemetry Sampling：<https://opentelemetry.io/docs/concepts/sampling/>（访问：2026-09-19）。参考按 Head/Tail 和错误/状态提高采样；不能替代 Connector 重试策略。
- AWS EventBridge Event Delivery：<https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-delivery.html>（访问：2026-09-19）。参考有限重试、退避、死信和投递失败处理；不定义业务副作用幂等。
- Kubernetes Jobs：<https://kubernetes.io/docs/concepts/workloads/controllers/job/>（访问：2026-09-19）。参考 backoffLimit、失败和完成状态；Job 重试不是任意外部动作的幂等保证。
- gRPC Retry：<https://grpc.io/docs/guides/retry/>（访问：2026-09-19）。参考可重试状态、退避、限流和透明重试；业务层仍需决定副作用安全性。
- HTTP Semantics：<https://www.rfc-editor.org/rfc/rfc9110>（访问：2026-09-19）。参考方法语义、状态和重试判断；HTTP 状态不能单独表达外部业务效果。

共同规律：重试需要有限预算、退避和可重试分类；重试与死信/人工处理相连；传输层的重试不能替代业务幂等、Probe 和责任判定。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议采用“失败分类 → 重试决策 → 降级/接管 → 终止/验证”模型

```text
Failure Classification
  → Retry Assessment
  → Retry / Backoff / Circuit Breaker
  → Degrade / Handoff / Pause
  → Probe / Reconcile
  → Verify / Close / Escalate
```

#### 建议的重试决策结果

```text
retry_now
retry_after
probe_before_retry
degrade_to_read_only
handoff_required
pause_until_dependency
manual_required
reject
unknown
```

`retryable` 只是 Connector 或传输层建议，最终由平台结合风险、幂等性、外部副作用、资源版本和 RunGate 决定。

#### 建议的重试预算

每次重试策略至少绑定：

```text
operation_type
idempotency_key
attempt_count
max_attempts
retry_deadline
backoff_policy
rate_limit
circuit_state
risk_budget
external_effect_state
```

预算按 Work Thread、Connector、Tenant、外部目标和动作风险分层，不能只按 HTTP 请求计数。

#### 建议的默认规则

- 协议、校验、认证、授权和策略阻断：不盲目重试；
- 暂时网络/依赖故障：有限退避重试；
- Rate Limit：尊重 Retry-After 和全局预算；
- 能力不匹配：降级、交接或拒绝；
- 资源冲突：刷新 Revision、重新评估，不直接覆盖；
- 外部效果未知：Probe/对账优先，不能盲目重做；
- 部分成功：按成功/失败/未知项分开补偿；
- 高风险副作用：每次重试重新检查 RunGate 或使用明确的一次性执行凭证。

#### 建议的降级和接管边界

降级后必须产生新的有效能力和状态投影，并使不适用的旧 RunGate、审批和结果失效。人工接管生成候选和责任确认，不自动变更 Owner。替代 Harness 需重新通过能力、权限、资源、敏感性和风险评估。

#### 核心不变量

```text
retryable ≠ safe_to_retry
transport_retry ≠ business_retry
retry_success ≠ business_success
degraded ≠ original_request_satisfied
handoff_candidate ≠ responsibility_transferred
external_unknown ≠ failed
external_unknown ≠ safe_to_repeat
retry_exhausted ≠ risk_closed
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：建议向用户展示“重试中、等待依赖、已降级、需要接管、外部结果未知、已终止”，并说明下一步和责任状态，不展示单纯次数。
- **架构**：支持按操作类型分离重试、Probe、补偿和执行；要求预算、幂等键、RunGate、资源 Revision 和结果状态绑定。
- **可靠性**：要求退避抖动、熔断、限流、死信、优先级和人工队列 SLA；避免多层重试放大和永久 pending。
- **安全/隐私**：要求授权/策略阻断不自动重试；外部未知高风险 fail-closed；降级不得扩大 Scope 或泄露更多数据；人工接管详情按最小必要暴露。

专家团综合建议：采用按失败类别和操作风险驱动的有限重试；外部副作用未知时 Probe 优先；降级、交接和人工接管是有治理的状态转换，不是异常吞掉。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求沉淀子议题 23、进入下一个暂缓项。本轮确认：

1. 失败按协议、校验、认证、授权、能力、限流、暂时依赖故障、资源冲突、策略阻断、外部效果未知、部分成功和 unknown 分类；不同类别不能共享默认重试。
2. Transport、Handshake、Resource Fetch、Probe、Event Append、Workflow Step、External Side Effect 和 Compensation Retry 分开治理；传输重试不等于业务动作重做。
3. 重试策略绑定操作、幂等键、尝试次数、最大次数、截止时间、退避、限流、熔断、风险预算和外部效果状态；高风险外部效果未知时 Probe/对账优先。
4. 降级、暂停、交接、拒绝和人工接管是显式治理状态；降级必须说明实际能力和未满足项，不满足原请求不伪装成功。
5. 人工接管生成候选和责任确认，不自动转移 Owner、审批、凭据、Tool Policy 或执行资格；替代 Harness 必须重新通过能力、权限、资源、敏感性和风险评估。
6. 重试耗尽、策略变化、Connector 撤销、外部状态未知和风险预算耗尽必须终止、隔离、升级或人工处理，不得永久 pending。

子议题深化 23 已完成第 1 轮并经用户确认沉淀；不表示重试参数、降级算法、接管 SLA 和跨层运营协议已经固化。

## 子议题深化 24：能力不匹配时的替代 Harness 选择和交接候选

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接暂缓项顺序中的第 9 项，讨论当前 Harness 能力不足、不可用、被撤销或不适合承担某项工作时，平台如何选择替代 Harness、生成交接候选并安全完成责任确认。

成功标准是明确：能力需求如何描述，候选如何发现与筛选，权限/敏感性/资源/风险如何重算，推荐与自动选择如何分离，交接与 Owner/责任/审批/执行资格如何分离；不把能力匹配结果自动当作交接完成。

### 第 1 轮：阶段 1：头脑风暴

#### 1. 能力不匹配的原因

```text
unsupported
partially_supported
temporarily_unavailable
revoked
unverified
policy_blocked
resource_incompatible
risk_unacceptable
credential_or_lease_invalid
```

不同原因的替代路径不同：能力缺失可能换 Harness，临时不可用可等待，权限阻断需审批，资源不兼容需刷新或重建，风险不可接受不能简单换工具绕过。

#### 2. 能力需求表达

候选需求：

```text
required_operations
required_resource_types
required_protocols
required_recovery_level
required_verification
required_side_effect_constraints
required_data_sensitivity
required_scope
required_latency_or_sla
required_human_approval
```

能力需求来自 Work Thread 当前目标、Task、Manifest、风险和治理策略，而不是只来自 Connector 名称。

#### 3. 候选 Harness 发现与筛选

候选来源：

- 已注册并有有效身份/租约的 Harness；
- 能力声明和近期能力观察；
- 当前 Scope、Purpose、敏感性和资源可达性；
- 可承担的 L1/L2/L3 恢复等级；
- 当前负载、SLA、可用区和成本；
- 审批、责任、审计和撤回能力；
- 组织策略允许的 Harness 类型。

候选结果需要区分：

```text
eligible
eligible_with_obligations
requires_probe
requires_approval
not_eligible
unknown
```

#### 4. 推荐与选择

```text
candidate_discovered
candidate_ranked
candidate_recommended
candidate_accepted
handoff_requested
handoff_confirmed
responsibility_transferred
execution_eligible
```

推荐不等于选择，选择不等于接手确认，接手确认不等于责任转移，责任转移不等于执行资格。

#### 5. 不能用换 Harness 绕过治理

以下情况不得通过选择另一个 Harness 规避：

- 当前主体没有权限；
- 资源被撤回、法律保留或 Scope 阻断；
- 当前操作需要审批但尚未批准；
- 风险未知或外部副作用不可验证；
- 原 Connector 被安全撤销；
- 目标 Harness 的能力声明尚未验证；
- 目标 Harness 无法承担敏感数据和审计义务。

#### 6. 交接包最小内容

```text
work_thread_revision
current_work_state
task_and_phase
known_facts_and_unknowns
evidence_references
resource_manifest
required_capabilities
constraints_and_prohibitions
risk_and_approval_state
handoff_reason
unresolved_external_effects
acceptance_requirements
```

不得默认包含旧 Prompt、私有推理、凭据、登录态、旧 Tool Policy、旧 Run 或无法授权的正文。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- A2A Agent Card：<https://a2a-protocol.org/latest/specification/>（访问：2026-09-19）。参考能力和接口描述用于发现；Agent Card 不证明当前实例健康、主体授权或任务完成。
- MCP Basic/Versioning：<https://modelcontextprotocol.io/specification/2025-06-18/basic>（访问：2026-09-19）。参考能力协商和工具/资源发现；能力声明不替代平台 RunGate。
- Kubernetes Scheduling：<https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/>（访问：2026-09-19）。参考候选筛选、约束和调度；资源调度不等于业务责任交接。
- Temporal Workflows：<https://docs.temporal.io/workflows>（访问：2026-09-19）。参考持久化工作流和活动边界；工作流恢复不自动迁移权限和 Owner。

共同规律：能力描述用于发现，不等于当前可用或获权；候选筛选必须结合约束与状态；调度/推荐和执行/责任分离；失败接管需要明确状态和审计。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议采用“需求 → 候选 → 评估 → 推荐 → 接受 → 交接 → 责任/执行”链路

```text
Capability Requirement
  → Candidate Discovery
  → Eligibility Assessment
  → Recommendation
  → Human/Policy Acceptance
  → Handoff Request
  → Receiver Confirmation
  → Responsibility Transfer
  → RunGate / Execution
```

#### 建议的候选评估维度

```text
protocol_compatibility
capability_fit
identity_and_lease
authorization_and_scope
resource_accessibility
sensitivity_and_purpose
verification_capacity
side_effect_safety
availability_and_sla
cost_and_operational_policy
```

候选排名可以作为建议，但不应只按模型置信度、最新时间、负载或成本自动裁决；高风险候选必须保留依据和审批。

#### 建议的交接决策

```text
recommend
recommend_with_obligations
probe_candidate
require_approval
wait_for_current_harness
handoff_required
reject
unknown
```

目标 Harness 接受前，平台不转移 Owner、责任、审批、凭据、Tool Policy 或执行资格。接受后仍需单独计算责任转移和 RunGate。

#### 建议的连续性降级

如果没有完全匹配的 Harness，可按语义层级降级：

```text
L3 restore_original
→ L3 reconnect_or_rebuild
→ L2 operational_continuation
→ L1 semantic_handoff
```

降级结果必须说明未满足能力、丢失的环境状态、待验证资源和新的风险/审批条件。

#### 核心不变量

```text
能力声明 ≠ 能力事实
能力匹配 ≠ 当前获权
候选推荐 ≠ 候选接受
候选接受 ≠ 接手确认
接手确认 ≠ 责任转移
责任转移 ≠ 执行资格
换 Harness ≠ 绕过治理
unknown ≠ eligible
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：建议展示候选缺口、推荐理由、约束、风险、接手状态和下一步；不要只给一个“最佳 Harness”。
- **架构**：支持候选评估与责任/执行分离；要求能力快照、策略版本、资源 Revision 和推荐依据绑定。
- **可靠性**：要求候选过载、租约失效、交接超时和无人接管有队列 SLA、升级和替代路径；不能在候选不稳定时循环转交。
- **安全/隐私**：要求目标 Harness 重新授权、脱敏和能力验证；禁止通过换 Harness 绕过撤回、审批、Scope、风险或安全撤销。

专家团综合建议：采用需求驱动的候选评估和受控交接；推荐可以自动化，接受、责任转移和高风险执行必须按策略和风险分级门禁；L1 语义交接是匹配不足时的安全兜底。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求自动沉淀子议题 24、进入下一个暂缓项。本轮确认：

1. 能力不匹配按不支持、部分支持、暂时不可用、已撤销、未验证、策略阻断、资源不兼容、风险不可接受和身份/租约无效区分；不同原因不能共用换 Harness 逻辑。
2. 候选 Harness 按协议、能力、身份/租约、授权/Scope、资源、敏感性/Purpose、验证能力、副作用安全、可用性/SLA 和运营策略评估。
3. 推荐、接受、交接请求、接手确认、责任转移和执行资格严格分离；候选推荐不自动转移 Owner、审批、凭据、Tool Policy 或 RunGate。
4. 替代 Harness 必须重新通过能力、权限、资源、敏感性和风险评估；换 Harness 不得绕过撤回、审批、Scope、风险或安全撤销。
5. 无完全匹配候选时，允许从 L3 原环境恢复降级到 L3 重连/重建、L2 操作续办或 L1 语义交接，并明确未满足能力、丢失环境状态和新的风险/审批条件。
6. 候选发现和接管队列需要状态、责任人、SLA、超时、升级和审计；unknown 不得自动视为 eligible。

子议题深化 24 已完成第 1 轮并经用户确认沉淀；不表示候选排名算法、能力需求 Schema、责任转移协议和 SLA 已固化。

## 子议题深化 25：Connector 监控、SLA、兼容测试和 UI/API

**状态：已完成（第 1 轮，已确认）**

### 主题与成功标准

本主题承接当前暂缓项顺序中的第 10 项，也是 Connector 相关暂缓清单的最后一项，讨论 Connector 的健康监控、能力与协议兼容测试、SLA/SLO、用户可见状态以及 UI/API 的边界。

成功标准是建立可观测性、测试、运营承诺和交互/API 表达之间的边界；监控不能替代事实验证，SLA 不能伪装成业务成功，UI/API 不能暴露超出权限的敏感信息。

### 第 1 轮：阶段 1：头脑风暴

#### 1. 监控对象分层

```text
identity_and_lease
protocol_health
capability_health
resource_access
latency_and_throughput
error_and_retry
replay_gap_and_projection
external_effect_and_verification
security_and_revocation
```

Connector 在线不等于能力可用；健康 Probe 成功不等于当前主体有权或外部动作成功。

#### 2. 指标候选

- Handshake 成功率、版本协商失败率；
- Lease 续租、过期、孤儿实例和撤销传播延迟；
- Event Append 接纳、重复、隔离、缺口和乱序数量；
- Resource Fetch/Probe 延迟、可验证率和过期率；
- 重试次数、退避、熔断、死信和人工接管队列；
- L1/L2/L3 恢复成功、部分成功和 unknown 比例；
- 外部副作用发送、确认、验证和未知状态；
- Trace Gap、审计缺口、敏感字段拦截和策略阻断。

指标必须按 Connector、实例、租户、Scope、操作类型、风险等级和版本分层，并避免把敏感正文作为标签。

#### 3. SLA/SLO 边界

可承诺：

```text
platform_event_acceptance_availability
connector_health_observation_freshness
resource_probe_latency
handoff_candidate_response_time
retraction_propagation_attempt
```

不应无条件承诺：

```text
external_harness_availability
original_environment_restoration
external副作用完成
所有缓存物理清除
unknown 状态自动消除
```

SLA 必须说明测量范围、排除项、证据来源、降级和补偿，不把平台可控指标包装成端到端业务保证。

#### 4. 兼容测试层次

```text
contract_conformance
schema_compatibility
capability_probe
security_and_revocation
fault_injection
replay_and_idempotency
resource_and_permission
cross_harness_handoff
external_effect_verification
```

测试通过不等于永久可信；Connector 版本、能力、配置、证书、环境和策略变化后需要重新评估。

#### 5. UI/API 的候选状态

用户层可聚合为：

```text
healthy
partially_available
needs_probe
degraded
blocked
revoked
stale
unknown
```

API 层应保留维度化结果、来源、时间、版本、有效期、阻断原因和推荐动作。UI 不应向无权用户暴露资源存在性、凭据、私有 Prompt 或内部堆栈。

### 第 1 轮：阶段 2：其他产品如何做（带来源）

- Prometheus Metric Naming：<https://prometheus.io/docs/practices/naming/>（访问：2026-09-19）。参考指标命名、标签控制和避免高基数；不定义 Connector 业务状态。
- OpenTelemetry Semantic Conventions：<https://opentelemetry.io/docs/specs/semconv/>（访问：2026-09-19）。参考跨组件遥测属性的统一表达；不替代业务 Revision、权限和审计。
- Kubernetes Probes：<https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/>（访问：2026-09-19）。参考 liveness、readiness、startup 分离；健康状态不等于业务能力和授权。
- OpenTelemetry Collector：<https://opentelemetry.io/docs/collector/>（访问：2026-09-19）。参考遥测接收、处理、导出和后端不可用时的运营边界；不定义平台 SLA。
- Pact Contract Testing：<https://docs.pact.io/>（访问：2026-09-19）。参考消费者驱动契约测试和兼容验证；通过契约测试不等于运行时资源、权限和副作用安全。

共同规律：健康、就绪、能力、兼容、授权和业务结果分层；指标需要低基数和稳定语义；契约测试与运行时 Probe、故障注入和安全撤销测试互补。

### 第 1 轮：阶段 3：总结、结论与建议

#### 建议采用“监控事实 + 兼容测试 + 运营承诺 + 受控展示”四层模型

```text
Observability Facts
  → Compatibility / Fault Tests
  → SLA/SLO Decision
  → UI/API Projection
```

#### 建议的监控状态

```text
healthy
ready
partially_available
degraded
stale
blocked
revoked
unknown
```

`healthy` 仅表示相应监控维度健康；不能推导所有能力、资源、权限或执行资格健康。

#### 建议的 SLA/SLO 维度

每个 SLA/SLO 绑定：

```text
scope
operation
measurement_window
objective
exclusions
evidence_source
error_budget
degradation_policy
escalation_policy
```

平台、Connector、Harness 和外部系统的责任边界分别计量；unknown、外部不可控和法律保留不得被静默计为平台成功或失败。

#### 建议的兼容测试门禁

```text
static_contract_check
→ version_matrix
→ capability_probe
→ auth_and_revocation_test
→ fault_and_replay_test
→ resource_permission_test
→ handoff_test
→ external_effect_test
→ certification_expiry
```

测试证书或通过状态有版本、时间和适用 Scope；发生协议、能力、身份、配置或策略变化时重新评估。

#### 建议的 UI/API 边界

API 返回维度化状态、时间、来源、版本、有效期、阻断原因、证据引用和推荐动作；UI 将其安全聚合为“健康、部分可用、需验证、已降级、已阻断、已撤销、已过期、未知”。详情展开仍需主体、Purpose、Scope 和敏感性授权。

#### 核心不变量

```text
在线 ≠ 健康
健康 ≠ 能力可用
能力可用 ≠ 当前获权
契约通过 ≠ 运行时安全
SLA 达标 ≠ 业务完成
UI 状态 ≠ 全量事实
unknown ≠ healthy
```

### 第 1 轮：阶段 4：专家团讨论

- **产品/UX**：支持用少量状态聚合复杂事实，并提供“依据、有效期、下一步”；不建议把内部指标直接堆进主界面。
- **架构**：要求健康、能力、兼容、授权、资源和业务结果分层；API 必须保留来源 Revision、版本和状态维度。
- **可靠性**：要求低基数指标、错误预算、告警抑制、故障注入、证书过期和撤销演练；SLA 必须区分平台可控与外部依赖。
- **安全/隐私**：要求指标标签和 UI/API 过滤敏感信息；测试环境不能使用真实凭据或生产正文；撤销、权限和缓存清除测试要纳入兼容认证。

专家团综合建议：采用多层健康/兼容/安全测试和责任分层的 SLA；UI/API 只投影经过授权的维度化事实，不把 Connector 在线或契约通过包装成业务可用。

### 第 1 轮确认沉淀

用户已确认第 1 轮结论并要求自动沉淀子议题 25、继续检查下一项。当前 Connector 暂缓清单已按顺序处理至最后一项。本轮确认：

1. 健康、就绪、能力、协议兼容、身份/租约、授权、资源可达性、运行结果和验证结果分层；Connector 在线或 Probe 成功不等于当前主体获权或外部动作成功。
2. 监控指标覆盖协议、租约、能力、资源、事件接纳、缺口/乱序、重试/死信、恢复、外部效果、安全撤销和审计缺口；标签按稳定维度控制基数，不放敏感正文。
3. SLA/SLO 绑定 Scope、Operation、窗口、目标、排除项、证据来源、错误预算、降级和升级策略；区分平台、Connector、Harness 和外部系统责任，不把外部不可控结果包装成平台承诺。
4. 兼容测试分为契约、版本、能力 Probe、认证/撤销、故障注入、重放/幂等、资源/权限、交接和外部效果验证；通过测试有版本、时间和适用 Scope，变化后需要重新评估。
5. API 返回来源、时间、版本、有效期、维度化状态、阻断原因、证据引用和推荐动作；UI 只展示经过授权的聚合状态，不暴露凭据、私有 Prompt、资源存在性或内部堆栈。
6. `unknown`、过期、撤销、部分可用和审计缺口必须显式表达；健康或 SLA 达标不等于业务完成。

子议题深化 25 已完成第 1 轮并经用户确认沉淀；不表示监控指标最终字典、SLA 参数、兼容认证周期和 UI/API Schema 已固化。

### Connector 暂缓清单阶段性完成说明

子议题深化 16–25 已按当前已确认的暂缓项顺序完成当前轮次的讨论、调研、综合建议和专家审阅，并已分别沉淀。此处仅表示 Connector 暂缓清单的当前讨论批次完成，不表示所有实现 Schema、阈值、算法、运营 SLA、UI/API 或其他一级议题依赖已经最终固化。

后续可继续处理的跨议题实现依赖，仍按原有“暂缓原因”和“留待以后讨论”保留，包括统一 API、事件存储、索引、保留实现、知识发布/跨空间传播、权限与治理具体协议，以及各子议题中未固化的 Schema、阈值、错误码、兼容窗口、脱敏和运营细节。
