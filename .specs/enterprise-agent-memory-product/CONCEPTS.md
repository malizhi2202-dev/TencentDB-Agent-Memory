# 产品详细设计：Enterprise Agent Memory Platform

- **Change ID**: `enterprise-agent-memory-product`
- **来源**：`.specs/enterprise-agent-memory-platform/README.md` 与议题 01–10；`.specs/final-v1/` 仅作为历史对象/交互参考。
- **状态**：完整产品概念、交互、架构和原型设计；不表示代码已实现。

## 1. 产品定义

Enterprise Agent Memory Platform 是外部 Harness（Codex、Claude Code、DSH 等）的记忆、知识、血缘和治理平台。Harness 负责执行工作；平台负责保留、理解、授权、复用、撤回、验证并审计工作证据。

```text
Harness / Connector
  → Work Context / Evidence
  → MemorySpace / Code Scenario / Lineage
  → Triage → ChangeSet → Review → Publish
  → Retrieval / Context Manifest
  → Action Proposal → RunGate → Tool Execution
  → Verification / External Effect / Audit
```

## 2. 用户与职责

| 角色 | 核心任务 | 不自动获得的能力 |
|---|---|---|
| User | 查看自己的工作现场、记忆和待办 | Team/Project 管理、跨空间发布 |
| Team Owner | 管成员、共享资源、拥有 Project | Platform 公共目录、任意资源 CRUD |
| Project Admin | 管 Project 成员、Task、上下文和资源 | 放宽 Team/Platform 策略 |
| Memory/Knowledge Owner | 分流、脱敏、审核、发布知识 | 直接跨租户执行 |
| Agent Admin | 配置 Agent、工具、技能、记忆关联 | 回显秘密、绕过 RunGate |
| Governance/Security | 审查权限、撤回、清理、报告 | 代替法务作法律结论 |
| Provider/Processor | 按授权处理指定副本 | 查看无关租户、无限期保留 |
| Auditor/Legal | 查看授权范围内事实和证据 | 修改事实、自动批准删除 |

## 3. 规范概念模型

### 3.1 身份与组织

- `User`：平台主体；身份认证与组织成员关系分离。
- `Team`：组织共享边界；拥有一个或多个 Project。
- `Project`：具体工作现场；必须且仅有一个 owning Team。
- `Agent`：版本化运行配置，可关联多个 Team/Project；关联只授予明确的 view/use 能力。
- `Harness`：外部执行环境；能力、身份和租约独立记录。

### 3.2 工作对象

- `WorkContext`：一次跨 Harness 可交接的工作上下文，包含 Task、目标、当前状态、代码 revision、环境和证据引用。
- `Task`：可验收目标；包含计划、验收标准和交付物。
- `Run`：Task 的一次执行尝试；记录 Harness、Agent、工具调用、结果和外部效果。
- `CodeScenario`：代码版本、症状、失败、根因、修复和验证组成的可恢复场景。
- `Evidence`：对话、Trace、日志、指标、工具结果、代码 diff、测试、人工判断或 Provider 回执。

### 3.3 记忆与知识

- `MemorySpace`：User / Team / Project / Agent 的归属边界；不提供 public Memory。
- `MemoryItem`：记忆候选或已确认记忆，含层级、来源、置信度、敏感性、Owner、Purpose 和生命周期。
- `KnowledgeAsset`：Wiki、Skill、RCA、Template、Code Context 等可复用资产。
- `ChangeSet`：对 Memory/Knowledge/Policy 的变更候选；经 Review 后 Publish。
- `ProcedureTemplate`：可复用步骤/流程；引用固定版本，升级必须显式变更。

### 3.4 安全与副本

- `Purpose`：本次读取、复用、导出或执行的用途。
- `VisibilityContext`：主体、委托、源/目标空间、Purpose、ACL、敏感性、revision、环境和策略版本的可见上下文。
- `ContextManifest`：本次 Run 实际使用的记忆、知识和证据清单。
- `CopyInventory`：源资产、缓存、Index、Embedding、Manifest、Export、Backup、Provider 和终端副本的版本化清单。
- `ExportAsset`：绑定源 revision、范围、接收者、用途、有效期和证据的导出对象。
- `ToolPolicy`：工具能力硬边界；不能被 RunGate 放宽。
- `RunGate`：针对当前主体、目标、Purpose、资产版本、风险、审批和能力的动态执行准入。
- `ActionProposal`：默认不可执行的动作建议；需通过当前 RunGate 才能进入 Run。

## 4. 核心不变量

1. `owner ≠ visibility ≠ ACL ≠ execution authority`。
2. 发布/检索不授予执行权；读取目标空间不等于修改资源。
3. 权限过滤发生在召回、图分析、投影和模板渲染之前。
4. `requested ≠ executed ≠ verified`；`retained ≠ service-visible`；`unknown ≠ zero`。
5. 恢复、重建、迁移、重试会产生新副本/新 revision，旧证明不自动继承。
6. 外部副本无法证明时，停止高敏复用、导出和全量清理声明。
7. 技术阻断先于法务判断；报告事实与法律决定分离。
8. 补偿、回滚、重试和替代 Provider 是新的受授权动作。

## 5. 端到端用户流程

### 5.1 Harness 接入与跨 Harness 交接

```text
Connector 身份/能力认证
 → 接收 Evidence + source revision
 → 去重/脱敏/归属候选
 → Triage（目标 MemorySpace）
 → WorkContext 更新
 → 新 Harness 读取最小 ContextManifest
 → 形成新 Run 证据
```

缺失元数据、低置信度、乱序、重复、撤销未知或权限不足时进入待分流/隔离，不默认写入更宽 scope。

### 5.2 记忆知识化

```text
Memory Candidate → Quality/Lineage/Sensitivity
 → Triage → ChangeSet → Review
 → Publish Wiki/Skill/RCA/Template
 → Consumer Feedback → Update / Narrow / Retire
```

### 5.3 跨空间复用与执行

```text
可引用 → 可检索 → 可建议 → Action Proposal
 → 当前身份/用途/目标 ACL/血缘/脱敏/ToolPolicy/审批
 → RunGate（持续重检）
 → 受约束 Run → Verification → External Effect
```

Action 默认 `blocked`；结果 unknown 时冻结扩大副作用并对账。

### 5.4 撤回与清理证明

```text
源撤回/策略变化
 → Propagation Stop
 → Copy Inventory snapshot
 → Online / Cache / Index / Embedding / Manifest 处置
 → Backup / Legal Hold / Provider / Offline 分支
 → 独立验证
 → 分层报告/通知
```

## 6. 状态矩阵

| 领域 | 正向状态 | 不确定/阻断状态 | 必须显示 |
|---|---|---|---|
| Triage | staged / assigned | low-confidence / conflict / denied | 理由、候选目标、写权限 |
| Knowledge | candidate / reviewed / published | stale / withdrawn / superseded | 来源、revision、Owner |
| RunGate | approved / executing / verified | blocked / expired / revoked / unknown | 当前策略、门槛、责任 |
| Copy | requested / executed / verified | partial / retained / unknown / stale | 副本范围、证据时间 |
| Delivery | accepted / delivered / acknowledged | failed / delivery_unknown / revoked | 渠道、接收者、版本 |
| Report | draft / approved / superseded | restricted / stale / revoked | 事实/判断、投影、依据 |

## 7. 信息架构与页面细节

- **Home**：scope switcher、待分流、待审核、清理 unknown、RunGate blocked、最近证据。
- **Projects**：Project 卡片；点击进入概览，不直跳 Task。
- **Project**：概览、Tasks、Agents、成员与访问、引用模板、知识与接入、版本与变更。
- **Task**：目标、验收、计划、Runs、交付物、ContextManifest。
- **Run**：当前 Harness/Agent、工具调用、输入证据、输出、验证、External Effect 和审计。
- **Memory**：按 MemorySpace 浏览；显示层级、Owner、来源、Purpose、敏感性、可见范围和生命周期。
- **Triage**：候选归属、理由、置信度、脱敏预览、血缘、目标、冲突和决策记录。
- **Knowledge**：Wiki/Skill/RCA/Template/Code Context 专业页；显示版本、适用范围和 Publish 状态。
- **Agent**：配置、工具、技能、记忆、关联 scope、Vault reference、Policy、RunGate 和运行证据。
- **Cleanup**：Copy Inventory、传播状态、处置任务、验证证据、保留/保全和未知边界。
- **Reports**：事实内核、受众投影、批准、Delivery Intent、渠道 Attempt、修订/撤回。
- **Team / Settings**：成员、Project ownership、资源策略、公共模型引用、审计和通知配置。

所有页面必须覆盖 loading、empty、filtered-empty、partial、denied、error、offline、stale、success；不能用一个“暂无数据”覆盖不同原因。

## 8. 进入实现前的验证

1. 低敏数据验证 CopyInventory、血缘和撤回闭包。
2. 恢复/重建、Provider 回执冲突、外部 unknown 的 fail-closed 验证。
3. 多受众字段投影、翻译、投递/撤回和报告版本验证。
4. Purpose、ACL、敏感性、跨租户和 RunGate 审计验证。

未经过验证不得冻结最终 Schema、阈值、SLA、合同或法域模板。
