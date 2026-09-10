# Agent Memory OS UI V2 — Core Flows

## 1. 系统主流程

```mermaid
flowchart TD
  A[用户进入 MemoryPanel] --> B[选择 Team]
  B --> C[选择或创建 Project]
  C --> D{从哪里开始工作?}
  D -->|工作台| E[待办、风险、审批、最近运行]
  D -->|项目| F[Project Workspace]
  D -->|任务| G[创建或打开 Task]
  E --> F
  F --> G
  G --> H[选择 Agent / AgentTeam]
  H --> I[解析 Agent Loadout]
  I --> I1[可访问资产]
  I --> I2[固定装配资产]
  I --> I3[本轮生效 Bundle]
  I1 --> J[启动 Run]
  I2 --> J
  I3 --> J
  J --> K[执行任务并生成 Trace]
  K --> L[交付物 / 决策 / 讨论]
  K --> M[召回已有 Memory]
  K --> N[产生候选 Memory]
  N --> O{写入策略}
  O -->|automatic| P[写入 MemorySpace]
  O -->|review_required| Q[进入审批中心]
  O -->|explicit_only| Q
  O -->|deny| R[拒绝并记录原因]
  Q -->|批准| P
  Q -->|拒绝| R
  P --> S[版本、来源链、审计]
  S --> T[后续 Task / Run 可召回]
  T --> M
  L --> U[沉淀 WorkMemory / Playbook / Skill Candidate]
  U --> V[资产库与治理评测]
```

## 2. Project Workspace 用户流

```mermaid
flowchart LR
  A[Project 列表] --> B[Project Overview]
  B --> C[任务]
  B --> D[Agent]
  B --> E[知识与资产]
  B --> F[记忆]
  B --> G[决策与交付]
  B --> H[运行记录]
  B --> I[成员与设置]
  C --> C1[创建 Task]
  C1 --> C2[关联 Agent]
  C2 --> C3[启动 Run]
  C3 --> H
  D --> D1[Agent 详情]
  D1 --> D2[查看 Loadout]
  D2 --> C2
  E --> E1[Project Assets]
  E1 --> D2
  F --> F1[按 Space / Domain / Layer 浏览]
  F1 --> F2[来源 Task / Run / Conversation]
  F2 --> C
  F2 --> H
  G --> G1[目标 / 决策 / 交付物 / 讨论 / 规范]
  C3 --> G1
  I --> I1[成员与角色]
  I --> I2[可见范围与 Repo 锚点]
```

## 3. Agent Loadout 解析流

```mermaid
flowchart TD
  A[选择 Agent] --> B[读取 Team / Project / Task / User]
  B --> C[计算可访问资产]
  C --> C1[Owner / Visibility]
  C --> C2[ACL allow / deny]
  C --> C3[Project 归属]
  C1 --> D[可访问候选集]
  C2 --> D
  C3 --> D
  A --> E[读取固定装配]
  E --> E1[Skill fork]
  E --> E2[Wiki / CodeGraph allocate]
  E --> E3[ChatMemory fixed binding]
  E1 --> F[固定装配集]
  E2 --> F
  E3 --> F
  D --> G[ExecutionBundle Resolver]
  F --> G
  B --> G
  G --> H[本轮生效配置]
  H --> H1[Assets + versions]
  H --> H2[MemorySpaces + write policies]
  H --> H3[Scenes / tools]
  H --> H4[Policy decisions + source chain]
  H --> I[固化到 Run 快照]
```

> 当前代码只完成 MemorySpaces、sceneIds 和 bundleId；Assets、版本、策略来源、source chain 与 Run 快照属于 ExecutionBundle V2。

## 4. Memory 写入与治理流

```mermaid
flowchart TD
  A[Conversation / Task / Run] --> B[提取候选 Memory]
  B --> C[确定 Domain]
  C --> D[服务端确定 MemorySpace]
  D --> E[解析 WritePolicy]
  E --> F{Policy Gate}
  F -->|automatic| G[去重 / 合并 / 写入]
  F -->|review_required| H[创建 WriteApproval]
  F -->|explicit_only| H
  F -->|deny| I[拒绝并审计]
  H --> J{人工决策}
  J -->|approve| G
  J -->|reject| I
  G --> K[生成新版本]
  K --> L[记录 session / task / message provenance]
  L --> M[进入可召回状态]
  M --> N[后续检索]
  N --> O[按 Team/User/Agent/Task/Space 隔离]
  O --> P[排序与召回解释]
  P --> Q[注入 Run 上下文]
  M --> R[correct]
  M --> S[forget]
  R --> T[版本化修正 + 审计]
  S --> U[归档/删除 + 审计]
```

## 5. UI 实施顺序

```mermaid
flowchart LR
  C1[C1/C2<br/>Project 字段与 Task 缓存] --> C3[C3<br/>ProjectWorkspace 聚合]
  C3 --> P1[导航与 URL 上下文]
  P1 --> P2[Project Workspace]
  P2 --> P3[Agent / Task Workspace]
  C4[C4<br/>ExecutionBundle V2] --> P3
  C5[C5<br/>MemorySpace Commands] --> P4[Memory Center]
  C6[C6<br/>remember/correct/forget] --> P4
  P3 --> P4
  C7[C7<br/>Run/Approval Project 归属] --> P5[Governance]
  C8[C8<br/>Eval 持久化] --> P5
  P4 --> P5
  P5 --> P6[旧入口收敛]
```
