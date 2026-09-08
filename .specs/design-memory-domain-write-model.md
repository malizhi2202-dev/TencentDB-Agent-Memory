# P0.1 记忆空间与写入模型 — 设计（Brain 域 / 写入策略 / 空间挂载 / 路由）

> 目标：把 TencentDB 从「type 一维扛内容+生命周期+作用域」升级为「Brain 域 + 写入策略」的明确分界，落地对比文档 §2 的四项缺失。分三阶段实施，每阶段独立可测、向后兼容。

## 背景（现状）

- `MemoryType`（`l1-writer.ts`）= 7 类：`persona / episodic / instruction / work_fact / work_task / work_method / work_artifact`
- `MemoryRecord` 已有 tenancy 三维（`teamId/userId/agentId`）+ `priority`（`-1` = strict global instruction）
- 唯一写入入口 `writeMemory(params)`，pipeline 自动抽取后直接写入，无「源」判定、无策略门
- **缺失**：`memory_domain` 正交维度、`write_policy`（持久 vs 总结）、`MemorySpace` 一等资源、`MemoryWriteRouter`

## 一、Brain 域（memory_domain）

### 枚举（12 域，新增 5 个）

```ts
export type MemoryDomain =
  | "raw"          // 原始对话/文件（不提炼，短生命周期）
  | "episodic"     // 发生过的事件
  | "semantic"     // 稳定事实（含 work_fact）
  | "preference"   // 用户偏好（从 persona 拆出）
  | "instruction"  // 用户给的指令
  | "rule"         // 治理规则（用户显式）
  | "procedural"   // 怎么做（work_method）
  | "task"         // 任务上下文（work_task）
  | "artifact"     // 产出物（work_artifact）
  | "persona"      // 人设画像（身份，非偏好）
  | "graph"        // 实体/关系边
  | "archive"      // 归档历史（默认不召回）
```

### 与 MemoryType 的关系（渐进式，向后兼容）

- **阶段 A（本阶段）**：`MemoryRecord` 新增**可选** `domain?: MemoryDomain` 字段；`writeMemory` 未显式传 domain 时，按 `type → domain` 推导默认值：

| type | domain 默认 |
|---|---|
| persona | persona |
| episodic | episodic |
| instruction | instruction |
| work_fact | semantic |
| work_task | task |
| work_method | procedural |
| work_artifact | artifact |

- **阶段 B/C**：逐步引入 `preference / rule / raw / graph / archive` 域，并让 `domain` 成为召回/生命周期/读写策略的主维度，`type` 降级为兼容别名。

### 每域的生命周期与召回权重（落到常量表）

```ts
export const MEMORY_DOMAIN_PROFILE: Record<MemoryDomain, {
  lifecycle: "short" | "medium" | "long";
  defaultPolicy: WritePolicy;
  recallWeight: number;      // 召回排序乘数
  defaultRecall: boolean;    // archive 默认不召回
}> = { ... };
```

关键区分（用户点名的「持久 vs 总结」）：`instruction` / `rule` 是**用户显式持久更改**，`semantic` / `episodic` / `preference` 等是**系统总结**——前者 defaultPolicy=`explicit_only`，后者 `automatic`。

## 二、写入策略（write_policy）

```ts
export type WritePolicy =
  | "automatic"        // 系统总结可直接写入
  | "review_required"  // 写入前需用户确认（项目决策、重要事实）
  | "explicit_only"    // 只能用户显式操作（instruction/rule/配置/密钥）
  | "deny"             // 永不写入（密码、token）
```

### 规则（不可覆盖的铁律）

1. 系统总结（`automatic`）**永远不能覆盖**用户显式持久更改（`explicit_only`）
2. 冲突时优先级：`explicit_only` > `review_required` > `automatic`；`deny` 直接拒绝
3. 由 `domain` 推导 defaultPolicy，调用方可**显式收紧**（`automatic → review_required/explicit_only`），不可放宽
4. 落点：`MemoryRecord.write_policy?: WritePolicy`（可选，向后兼容），召回时不注入 `deny` 域

## 三、MemorySpace 挂载 + MemoryWriteRouter（阶段 B/C，本阶段只定接口）

```ts
interface MemorySpace {
  spaceId: string;           // sp_<hash>
  ownerType: "user" | "team" | "project" | "agent" | "task";
  ownerId: string;
  domain: MemoryDomain;      // 该空间主要承载的域
  writePolicy: WritePolicy;  // 空间级策略基线
}

// Agent 创建时自动挂载（personal/team/project 空间）
function mountSpacesForAgent(agentId, { teamId, userId, projectId? }): MemorySpace[]

// 写入路由：模型只能请求，服务端裁决（模型不得自选 spaceId）
function routeMemorySpace(input: {
  domain: MemoryDomain;
  source: "user_explicit" | "agent_insight" | "file_upload" | "system_extract" | "feedback_correction";
  teamId?; userId?; agentId?; taskId?;
}): { spaceId; effectivePolicy: WritePolicy };
```

## 四、实施分期

| 阶段 | 内容 | 交付物 |
|---|---|---|
| **A（本阶段）** | `memory_domain` 枚举 + 12 域 profile 表 + `write_policy` 枚举 + `writeMemory` 加 `domain`/`write_policy` 字段 + `type→domain` 推导 + 「系统总结不可覆盖持久更改」守卫 | 源码 + vitest |
| B | `MemorySpace` 一等资源 + Agent 创建挂载 | 源码 + vitest |
| C | `MemoryWriteRouter`（服务端裁决路由） | 源码 + vitest |

## 五、测试策略（阶段 A）

1. `type→domain` 推导：7 类 type 各得正确默认 domain
2. `write_policy` 推导：instruction/rule→explicit_only，其余→automatic
3. 覆盖守卫：`explicit_only` 记录被 `automatic` 总结尝试覆盖时，返回冲突拒绝
4. 向后兼容：不传 domain/write_policy 时，行为与旧版一致（domain 由 type 推导、policy 由 domain 推导）
5. 12 域 profile 表完整性：每域都有 lifecycle/defaultPolicy/recallWeight/defaultRecall
