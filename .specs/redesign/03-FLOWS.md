# 重设计 · 流程图与调用时序

> 配套：`00-PROPOSAL.md`、`01-ARCHITECTURE.md`、`02-FUNCTIONS.md`。
> 五条核心链路：① 接入与注入 ② 记忆写入 ③ 召回 ④ 审批 ⑤ 协作项目。

---

## 0. 系统主流程

```mermaid
flowchart TD
  A[用户进入 MemoryPanel] --> B[选择 Team]
  B --> C[选择或创建 Project]
  C --> D{从哪里开始}
  D -->|工作台| E[待办 / 风险 / 审批 / 最近运行]
  D -->|项目| F[Project Workspace]
  D -->|任务| G[创建或打开 Task]
  E --> F
  F --> G
  G --> H[选择 Agent / Agent 编队]
  H --> I[解析 ExecutionBundle]
  I --> I1[① 可访问资产]
  I --> I2[② 固定装配]
  I --> I3[③ 本轮生效]
  I1 --> J[启动 Run]
  I2 --> J
  I3 --> J
  J --> K[执行并生成 Trace]
  K --> L[交付物 / 决策 / 讨论]
  K --> M[召回已有记忆]
  K --> N[产生候选记忆]
  N --> O{写入策略}
  O -->|automatic| P[写入 MemorySpace]
  O -->|review_required| Q[审批中心]
  O -->|explicit_only| Q
  O -->|deny| R[拒绝并记录原因]
  Q -->|批准| P
  Q -->|拒绝| R
  P --> S[版本 / 来源链 / 审计]
  S --> T[后续 Task/Run 可召回]
  T --> M
  L --> U[沉淀 WorkMemory → Playbook → Skill 候选]
  U --> V[资产库与治理评测]
```

---

## 1. 链路① 接入与注入（MemoryProxy，零代码）

```mermaid
sequenceDiagram
  participant CC as Claude Code / DSH
  participant PX as MemoryProxy :8096
  participant CO as MemoryCore :8420
  participant UP as 上游 LLM

  CC->>PX: POST /v1/messages（原样协议）
  PX->>PX: 认证（user_key → identity）
  PX->>CO: session 初始化（team/agent/user 三元组）
  CO-->>PX: session 上下文
  PX->>CO: 召回记忆（performAutoRecall：team/user/agent 窄化）
  CO-->>PX: L1 记忆 + L2/L3 profile
  PX->>PX: 注入 system/context（脱敏后）
  PX->>UP: 转发请求（协议不变）
  UP-->>PX: 流式响应
  PX-->>CC: 原样回传
  PX->>CO: 对话回写（capture → L0）
  CO-->>PX: ack
```

要点：Proxy **不持久化**任何记忆；注入前必须过**脱敏**（backlog C7）与**策略门**（`deny` 域不注入）。

---

## 2. 链路② 记忆写入（域 → 空间 → 策略 → 审批）

```mermaid
sequenceDiagram
  participant SRC as 来源（对话/任务/上传/反馈）
  participant EXT as 抽取（L1 extractor）
  participant WR as MemoryWriteRouter
  participant SP as MemorySpace
  participant GATE as 策略门
  participant AP as 审批（WriteApproval）
  participant ST as 存储（L1 + 索引）
  participant AU as 审计账本

  SRC->>EXT: 候选记忆 + source
  EXT->>EXT: 意图理解（低置信 → 澄清，不硬写）
  EXT->>WR: {domain, source, teamId/userId/agentId/taskId/projectId}
  WR->>WR: resolveSpaceOwner（域决定归属）
  WR->>SP: spaceId = sp_sha1(ownerType:ownerId:domain)
  SP-->>WR: 空间基线策略
  WR->>WR: effectivePolicy = 基线 ⊕ source（只能收紧）
  WR->>GATE: 求值
  alt automatic
    GATE->>ST: 去重/合并 → 写入 L1
  else review_required / explicit_only
    GATE->>AP: 创建审批单（带 before/after + 风险）
    AP-->>GATE: 人工批准
    GATE->>ST: 写入 + 版本化
  else deny
    GATE->>AU: 拒绝并记录原因
  end
  ST->>AU: 写入审计（who/what/when/before/after）
  ST-->>SRC: 完成
```

**铁律**（`memory-domain.ts` 已实现）：
1. `automatic` 永不覆盖 `explicit_only`
2. 优先级 `explicit_only` > `review_required` > `automatic`；`deny` 直接拒绝
3. 调用方只能给 `domain + source + 隔离维度`，**不能自选 spaceId / write_policy**

---

## 3. 链路③ 召回（RRF → Retention → 注入）

```mermaid
flowchart LR
  Q["query"] --> IG["意图理解<br/>低置信不硬注入"]
  IG --> SB["Scope 解析<br/>public ∪ user ∪ project"]
  SB --> R1["向量召回"]
  SB --> R2["全文/BM25 召回"]
  SB --> R3["关键词召回"]
  SB --> R4["图扩展召回（种子邻接，hop 衰减 0.5）"]
  R1 --> RRF["RRF 融合<br/>score += 1/(60+rank)"]
  R2 --> RRF
  R3 --> RRF
  R4 --> RRF
  RRF --> RET["Retention 层<br/>token budget + MMR(λ=0.70)<br/>+ recency/frequency（权重取小）"]
  RET --> RER["Rerank + Relevance Gate<br/>（低于阈值拒绝）"]
  RER --> EXP["召回解释<br/>rank/score/scope/lineage/reason"]
  EXP --> INJ["脱敏 → 注入"]
  INJ --> AUD["召回审计"]
```

**关键工程判断**（来自 MindMemOS）：时间/冗余/优先级**不进 RRF**，放在独立 Retention 层；`mixed-v2` = top-m 保底 + MMR，**只挑不改写**。

---

## 4. 链路④ 审批（写入治理）

```mermaid
stateDiagram-v2
  [*] --> pending: 策略门产单
  pending --> approved: 人工批准 → 真实执行写入
  pending --> rejected: 人工拒绝 → 记录原因
  pending --> expired: 超时
  approved --> [*]
  rejected --> [*]
  expired --> [*]
```

审批单最小字段（`meta_write_approvals` 已有）：
`team_id / agent_id / task_id / session_id / write_policy / risk / plans_json / status / decided_by_user_id / decision_note`

**缺口**：无 `project_id`（项目归属只能经 Task/Agent 间接推导，见 C7）；无前端入口（菜单隐藏）。

---

## 5. 链路⑤ 协作项目（目标态）

```mermaid
sequenceDiagram
  participant U as 用户
  participant W as 项目工作区
  participant RM as ProjectWorkspaceOverview
  participant TM as 任务/Agent
  participant RUN as Run
  participant MEM as Memory
  participant KB as 知识条目/交付物

  U->>W: 打开项目（URL: team/project）
  W->>RM: 一次聚合读（不 fan-out）
  RM-->>W: counts + recent + warnings（权限内）
  U->>TM: 创建 Task 并关联 Agent
  U->>RUN: 启动 Run（解析 ExecutionBundle）
  RUN->>MEM: 召回上下文
  RUN-->>KB: 产出交付物/决策（需 review）
  RUN->>MEM: 产生候选记忆（域路由 → 策略门）
  MEM-->>W: 记忆计数与最近条目
  KB-->>W: 交付物/决策列表
  U->>MEM: 纠错 / 遗忘（显式）
  MEM-->>U: 版本化结果 + 审计
```

---

## 6. Agent Loadout 解析流（三层，术语固定）

```mermaid
flowchart TD
  A[选择 Agent] --> B[读 Team / Project / Task / User]
  B --> C[① 可访问：Owner+Visibility+ACL+Project 归属]
  A --> D[② 固定装配：Skill fork / Wiki+CodeGraph allocate / ChatMemory fixed]
  C --> E[ExecutionBundleResolver]
  D --> E
  B --> E
  E --> F[③ 本轮生效：assets+versions / spaces+policies / scenes / policy decisions / source chain]
  F --> G[固化到 Run 快照（可回放）]
```

**术语铁律**：三层**不得统称"绑定"**；② 与 ③ 必须在 UI 上分区展示，否则用户无法判断"为什么这次没生效"。

---

## 7. UI 实施顺序（依赖契约）

```mermaid
flowchart LR
  C1[C1/C2 Project 字段与 Task 缓存] --> C3[C3 ProjectWorkspace 聚合]
  C3 --> P1[P1 导航与 URL 上下文]
  P1 --> P2[P2 项目工作区]
  C4[C4 ExecutionBundle V2] --> P3[P3 Agent/Task 工作区]
  P2 --> P3
  C5[C5 Space 命令] --> P4[P4 记忆中心]
  C6[C6 记忆命令] --> P4
  P3 --> P4
  C7[C7 Run/审批 Project 归属] --> P5[P5 治理]
  C8[C8 评测持久化] --> P5
  P4 --> P5
  P5 --> P6[P6 旧入口收敛]
```
