# TencentDB-Agent-Memory 补全核对（实现证据）

> 本文件是「补全所有缺失」的**证据清单**：每个对比发现的缺失项 → 实现文件 → vitest → 接线点。
> 生成依据 `.specs/memory-platform-comparison-v2.md`（§1–§10 差距清单）。

## 一、objective 三个 P 的字面项（全部落地）

### P0 — 记忆空间与写入模型 + 召回 Retention 层

| 缺失项 | 实现 | 测试 | 接线点 |
|---|---|---|---|
| Brain 域划分（12 域） | `record/memory-domain.ts`（`MemoryDomain`/`MEMORY_DOMAINS`/`MEMORY_DOMAIN_PROFILE`/`defaultDomainForType`） | 8 | `l1-writer.writeMemory` 推导 domain |
| 写入策略四档 + 持久 vs 总结守卫 | `memory-domain.ts`（`WritePolicy`/`canOverwrite`/`resolveWritePolicy`） | 8 | `writeMemory` 覆盖守卫（automatic 不可覆盖 explicit_only） |
| Agent 创建挂载记忆空间 | `record/memory-space.ts`（`mountSpacesForAgent`，agent/team/user/project 四层） | 6 | `execution-bundle.ts` 调用 |
| 自动区分记忆空间（服务端裁决） | `record/memory-write-router.ts`（`routeMemorySpace`/`resolveSpaceOwner`/`sourcePolicyFor`） | 12 | `l1-extractor` 两写入点（`applyDecisions`/`storeAllDirectly`） |
| space_id 落库 | `store/sqlite.ts`（`l1_records` 加列 + 8 处贯穿）+ `store/types.ts` | 6 | `writeMemory`/`upsertL1` |
| 召回 Retention 层（混合分数+MMR+token） | `record/retention.ts`（`retentionPriority`/`selectRetention`/`estimateTokens`/`recencyDecay`） | 8 | `searchHybrid`（tokenBudget>0 走 Retention） |
| RecallConfig tokenBudget | `config.ts`（`tokenBudget`/`retentionLambda`/`retentionTopM`） | 1（集成） | `searchMemories` 传 retention |

### P1 — 关系灵活化 / 记忆闭环 / 资产演进

| 缺失项 | 实现 | 测试 | 接线点 |
|---|---|---|---|
| 关系灵活化（多对多 + 纯函数编译 + 快照） | `record/execution-bundle.ts`（`resolveExecutionBundle` + 确定性 `bundleId`） | 5 | 供召回/执行上下文编译 |
| Dreaming 离线巩固（7 类关系检测） | `record/memory-lifecycle.ts`（状态机+关系检测）+ `record/dreaming.ts`（编排） | 15 | — |
| 巩固执行层 | `record/consolidation-executor.ts`（merge→deleteL1 / archive→改 domain） | 5 | 调 `store.deleteL1`/`upsertL1` |
| Feedback（信号→动作 + 检测） | `record/feedback.ts` + `record/feedback-detection.ts` | 12 | 检测+动作=完整回路 |
| 质量状态机（8 态） | `record/memory-quality.ts` | 9 | — |
| Playbook | `record/playbook.ts`（沉淀链组装+可复用判定） | 7 | — |
| 沉淀检测编排 | `record/playbook-synthesis.ts` | 5 | — |
| ExecutableScene | `record/scene-executable.ts`（可运行性检查+发布快照） | 5 | — |
| skill 版本生命周期 | `record/skill-version.ts` | 7 | — |

### P2 — 治理 / 监控 / 评测

| 缺失项 | 实现 | 测试 | 接线点 |
|---|---|---|---|
| 脱敏（PII/密钥/密码） | `record/redaction.ts` | 7 | **`writeMemory` 写前脱敏** |
| 护栏（注入防护） | `record/guardrail.ts` | 7 | **`searchHybrid` 召回前过滤 high 注入** |
| RBAC 审批门 | `record/review-approval.ts`（owner⊇admin⊇member⊇viewer） | 7 | — |
| 审批五档 | `record/approval-policy.ts`（服务端解析 + 模型不能自批） | 7 | — |
| 监控（巩固健康度） | `record/consolidation-metrics.ts` | 4 | 接 `ConsolidationResult` |
| 评测（retrieval 指标） | `record/retrieval-evaluator.ts`（recall@k/precision@k/MRR/NDCG） | 7 | — |
| 召回侧空间隔离（archive 排除） | `memory-domain.ts`（`isRecallableDomain`） | 2 | **`searchHybrid` 召回后排除 archive** |
| 确定性 tie-break | `searchHybrid` sort（同分按 id 升序） | — | — |

## 二、测试规模

- 起点（对比完成时）：44 tests
- 现状：**197 tests / 29 文件全绿**

## 三、剩余（超出租户记忆系统范畴，如实标注）

| 剩余项 | 性质 |
|---|---|
| Rerank 精排模型（§3.2） | 需 rerank 模型/外部服务，纯逻辑只能做接口抽象 |
| 三层可观测面（事件账本+run 状态机+工具取证，§7.1） | Agent 编排平台观测，TencentDB 已有 trace/metrics/log 基础 |
| 计划/任务/run 三分 + 交付物评审 + 自动化 fire（§8） | Agent 编排平台（dsh-task-board 插件范畴） |
| 外部基准对接 LoCoMo/PersonaMem/FactConsolidation（§9.1） | 需外部评测数据集 |
| AgentEntity 多 team / memory 多 space 持久化（§1.1） | Agent 平台关系管理；多对多语义已由 `resolveExecutionBundle` 挂载 + `review-approval` 角色覆盖 |
