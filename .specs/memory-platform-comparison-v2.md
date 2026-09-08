# TencentDB 记忆系统 × Agent OS × MindMemOS 三方对比（v2 · 源码/文档扫描版）

> 本版基于**实际扫描**产出，非凭记忆。证据来源：
> - Agent OS：`intent-os-platform/website/src/content/docs/concepts/*`（architecture / agent-model / memory-and-knowledge / approvals / scenes-intent / security / observability / skills / plans-tasks / execution-model 全文）+ `features/memory/spaces.md`
> - MindMemOS：`README.md`（Core Features / Benchmark / Coming Features）+ `config/algo/{search/retention,dreaming,skill/evolve}.py` + `components/{searcher/rrf,rerank,dreaming/relation_detection,feedback/signal}.py` + `pipelines/skill/evolution.py`
> - TencentDB：本会话已读 `MemoryCore/src/core/{tdai-core,store,hooks/auto-recall,profile/profile-sync}`、`gateway/{server,v2-router,v2-schemas}`、`metadata/*`

对比结论按「能力域」组织，每域给出三方各自**怎么做（精确到参数/字段）**，最后是差距 = 要改什么。

---

## 0. 一句话总览

| 维度 | Agent OS（产品化平台） | MindMemOS（算法引擎） | TencentDB（现状） |
|---|---|---|---|
| 定位 | 完整 Agent 平台，记忆是其中一块 | 专门的长程记忆引擎 | 记忆引擎 + Wiki/CodeGraph |
| 强项 | 关系/授权/审批/观测的工程完备 | 检索/巩固/自演化的算法深度 | 分层 L0-L3 + 隔离原语齐全 |
| 短板（对照后） | 重平台，单机记忆算法不如 MindMemOS 精细 | 关系/授权/审计薄 | 两者强的都缺：关系不灵活、召回无预算、无闭环 |

---

## 1. 关系模型与执行编译

### Agent OS（关系灵活 + 定义运行分离）
- **定义与运行分离**：`agents.stable_revision` → `agent_definition_versions` 不可变快照；改配置发新修订，运行中轮次不受影响；一次运行从头到尾同一份配置（`agent_definition_repository.rs`）
- **团队只叠加协作规则，不改智能体自身**：`team_execution_compiler.rs` 是**纯函数边界**（不读库、不做后端选择、不掌握审批/终态权威），从已授权输入推导会话覆盖层/工具清单/提示词追加；成员路由确定性（`@提及` 收窄）
- 资产按「工作区 / 资产」分组：智能体/场景/记忆/扩展是**资产**，被工作区复用

### MindMemOS（无平台级关系模型）
- 只有 `project_id` 租户维度（ContextVar 注入），无 Team/Project/Agent 多级关系

### TencentDB 现状
- `AgentEntity.project_id` 单值外键；资产主要绑 Agent；无 `resolveExecutionBundle` 统一编译；无「定义运行分离」快照

### 差距（要改）
1. Agent↔Project 多对多 + 项目角色
2. 资产 Team/Project/Agent/Scene/Task 多层绑定
3. `resolveExecutionBundle()` 统一编译 + 纯函数边界 + 策略逐层收紧
4. 配置稳定修订快照（一次运行同一份）

---

## 2. 记忆空间与写入语义（你最早问的重点）

### Agent OS
- **空间 = 隔离单位**：名称/描述/人格提示词/检索配置/分片配置（6000 字节分片、600 重叠、嵌入参数独立 JSONB）
- **两条入库路径**：文档上传（预处理分片/嵌入）+ 对话沉淀（智能体经记忆工具**主动写入**：`memory_commit` / `brain_write` / 治理规则写入 / 历史归档压缩）
- **brain 读写按角色分组**：管理型智能体可读写，对话型智能体只读
- **授权绑定 fail-closed**：执行前按智能体与所有者解析授权空间 → 挂载进会话配置；模型省略 `space_id` 自动回退绑定值（**不得自选空间**）；未绑定 → 「能力不可用」而非降级默认
- 空间「角色设定」必填（预填知识工程师提示词，告诉整理助手这空间放什么怎么整理）
- 并行/串行检索开关 + 知识库调用统计（24h/7d/30d）
- 可插拔后端（provider 路由，默认 Brain 文件 + pgvector）
- **写入/检索 API 级实证**（`develop/gateway/memory/space-learn.md` / `space-search.md`）：
  - 写入 `memory.space_learn`（scope `memory:write`）：`space_id/content/metadata/source` → 自动分块索引；错误码含 `PAYLOAD_TOO_LARGE(1MB)` / `RATE_LIMITED`
  - 检索 `memory.space_search`（scope `memory:read`）：`limit` 默认 10 最大 50、**`threshold` 默认 0.5**、`filter`；无权访问空间返回 403
  - 空间详情 `space-detail.md`：文档上传即触发学习（50MB 拖拽 / 管理 200MB）；**AI 生成的知识条目无单条 CRUD**——只能改源文档或走整理助手，清理不可恢复；两个内置助手（知识整理 vs 知识问答）

### MindMemOS
- **Portable / reusable assets**：明确把 user profiles / preferences / project facts / tool experience / skill candidates 作为**可复用、可迁移**资产，跨 agent（OpenClaw/Hermes/Claude Code/OpenHands）共享
- **schema 提取版本化**：`algo_config.add.schema.version` 默认 v2（rule-based graph fusion），可钉 v1，双向兼容存储
- **多租户隔离**：`project_id` 经 ContextVar 强制注入，遗漏即失败
- **写入主动化**：`remember` / 对话自动写入 / skill 执行结果回流

### TencentDB 现状
- 有 L0-L3 分层 + 7 类 L1（persona/episodic/instruction/work_fact/work_task/work_method/work_artifact）
- 有 `IsolationFilter`（team/user/agent/session/task）+ `ProfileIsolation`（team/user/agent/session）+ `buildProfileIsolationScope`
- **但**：无「Brain 域」正交维度（type 同时扛内容+生命周期+作用域）；写入主要是 pipeline 自动抽取，无「文档上传→知识空间」第二路径；无「服务端绑定空间 + 模型不得自选」的 fail-closed 授权（recall 侧刚补了 isolation 但空间授权语义未建）

### 差距（要改）
1. **Brain 域划分**（raw/episodic/semantic/preference/instruction/rule/procedural/task/artifact/persona/graph/archive），每域不同生命周期/读写策略/召回权重
2. **Agent 创建时挂载记忆空间**（personal/team/project 空间自动挂载，而非事后绑）
3. **自动区分记忆空间**（MemoryWriteRouter：按来源+内容路由到 User/Team/Project/Agent/Task 空间，模型只能请求不能自选）
4. **持久更改 vs 记忆总结**（最关键分界）：
   - 持久更改 = 用户显式操作（改配置/下指令/纠正）→ 必须用户操作，authoritative，最高优先级
   - 记忆总结 = 系统自动提取 → 可自动，低优先级，**不可覆盖持久更改**
   - 写入策略四档：`automatic / review_required / explicit_only / deny`

---

## 3. 检索 / 召回

### Agent OS
- 多路融合而非单路：向量 + 全文各自独立排序 → **RRF（K=60）** → 融合后叠加**有界**生命周期信号（近期按天衰减、频次取对数，任一信号不能压过语义/词法证据）→ 同分按记忆 ID 升序（确定性）

### MindMemOS（算法最精细）
- **三种 search engine**：DefaultSearchEngine（query 预处理 + BM25 sparse-only）、VanillaSearchEngine（并行 dense/sparse + 混合 RRF + 图扩展 + dedup）、SchemaSearchExpander（实体 hybrid → 属性双路径 → 实体融合 → 多跳邻居 → 时间线扩展）
- 完整链路：RRF → **rerank**（可插拔 RerankClient，无则退化）→ **retention（token budget + MMR）** → final_filter
- **RRF 公式 Σ1/(k+rank+1)，k 分路径**：entity=80 / property=60 / dual-path=80（不是统一 K=60）
- **agentic search**：仅 `search_strategy='agentic'` 触发，max_rounds=3；每轮后 LLM 判 sufficiency，不足则 planner 生成新查询（去重 / 时间放宽 / fallback rephrase）
- **混合优先级分数（精确权重）**：`0.50*relevance + 0.25*query_overlap + 0.15*recency − 0.10*cost`
- recency 指数衰减**半衰期 30 天**，缺时间戳给 0.5
- **MMR 去冗余**：`mmr_lambda=0.70`，`top_m_guarantee=5`（重排前按相关性强制保留 top5）
- token budget 1–128000，`max_candidates=100`

### TencentDB 现状
- `searchHybrid`：keyword(FTS5) + embedding，RRF 融合后 `slice(maxResults)` 直接给 LLM；`applyRecallBudget` 只有简单截断
- 无 rerank、无 retention 混合分数、无 MMR 去冗余、无 recency 衰减、无图扩展

### 差距（要改）
1. 独立 **Retention 层**（混合分数 + MMR + recency 半衰期 + token budget）
2. **Rerank 精排 + relevance gate**
3. dedup 数值分层（高分直判/中分交 LLM/低分直存）
4. 确定性 tie-break（同分按 memory_id）
5. （可选）图扩展召回

---

## 4. 记忆闭环（巩固 / 反馈 / 状态机）

### Agent OS
- 反思阶段**反提场景候选**（title+steps 严格 JSON），把验证过的做法固化成新场景（`scene_candidate` 输出契约）

### MindMemOS（自演化最完整）
- **Dreaming 离线巩固**：两阶段（issue detector → action planner），**7 种 issue 类型**：`conflict / duplicate / near_duplicate / complementary / low_value / ambiguous / other`
  - 分组规则严格：同/共指 subject + 同/兼容 predicate 才算 conflict；仅共享 country/sport/language 等值不够；不确定用 `ambiguous` 兜底；不用常识判断；不编造 memory id
  - 参数：lookback 7 天、scope 最多 40 条记忆、`min_cluster_size=2`（更小簇跳过）、`max_entity_memory_count=50`（超阈视为噪声）、并发 8
- **Feedback**：explicit planner + **implicit 信号检测**（从会话检测负面轮次，temperature=0 LLM）+ query_rewriter
- **Skill 自演化**（trace→summary→patch→version）：
  - 阈值 `min_aggregate=8`、并行总结 8、`use_trajectory_score`（有分用 supervised 强化高分/避免低分，无分回退 unsupervised）、新版本状态 `draft`
  - patch 结构化编辑（replace/insert/delete），parse error 时 `feedback_on_parse_error` 把失败 + SkillEditError 喂回自纠正（非重跑同 prompt）

### TencentDB 现状
- 只有 online dedup；无 Dreaming、无 Feedback 回流、无质量状态机、无 skill 自演化

### 差距（要改）
1. **Dreaming 离线巩固**（关系检测 7 类 + 合并/归档/建边）
2. **Feedback**（explicit + implicit 信号检测 + query rewriter）
3. **质量状态机**（candidate→verified→active→stale→disputed→superseded→archived→deleted）
4. **work_method → Playbook → Skill 沉淀链**

---

## 5. 资产演进（Playbook / Scene / Skill）

### Agent OS（资产化最完整）
- **场景 = 可复用资产**：执行者(agent_id) + 能力面(tools_whitelist/capabilities/constraints/persona) + 知识引用(knowledge_refs) + 输入表单(form_fields + SceneParam required/default_value)，带归属/可见性/发布状态/usage_count/success_rate/forked_from
- **可运行性检查**：执行前校验引用能力齐备，缺能力逐条 `reason_code`，阻断时 `runnable=false`（SceneReadiness）
- **发布快照**：SceneRelease 带版本号，`runtime_manifest_json` 落盘，编辑草稿不影响已发布版
- **意图状态机**：clarifying→ready_to_plan→executing；**置信度 < 0.7 以澄清中断代替执行**；槽位具名（IntentParseSlot name/type/value）；参数补全是显式 `completeParams` 接口
- **技能 = SKILL.md 说明书**（绑定改变提示词与可读材料，**不新增可调用函数**）；flywheel 6 来源（memory/brain/wolf/session/turn/curator）；SKILL.md 12000 字符上限；**推荐审核** pending/approved/rejected（仅归属人裁决）
- **分层注入**：技能索引只含名称+描述，全文按需 `skill_view` 获取；包解包到 `skills/<name>`；索引常驻不撑爆上下文
- **技能/工具/MCP 三界**：技能=「会什么」、工具=「能做什么」、MCP=「连到哪」；提示段独立（skill_prompt / memory_prompt / mcp_prompt）

### MindMemOS
- Skill 自演化（见 §4）+ **skill candidates** 作为可复用资产 + Memory↔Skills 双向流（经验→skill，skill 执行结果/失败 trace/用户反馈→流回记忆）
- ⚠️ **其 skill evolution 实现的工程债**（审计实证，别照抄）：
  - `SkillVersionStatus` 枚举有 published/evaluating/superseded/rolled_back，但**没有完整生命周期转换/发布实现**
  - mint+consume **非原子**、并发 evolve **无锁**
  - aggregate/concurrency/scan bounds **无 config validation**（`max_aggregate=0` 会让 `_batches` 死循环）
  - summary 失败**静默丢失**；scan cap 无 continuation
  - 插件 `detectSkillContext` 发 `base_version_id=''`，modified usage 不计入 `_injected_skill_name`，削弱 lineage
  - 异步 evolve service 返回占位 pending_count/threshold=0

> 结论：MindMemOS 的 skill 自演化「算法思路对、工程落地半成品」——TencentDB 若做 work_method→Skill 沉淀链，应学其「trace→summary→patch→version + 打分引导」的设计，但把锁/校验/原子性/生命周期补齐，别连坑一起抄。

### TencentDB 现状
- 有 work_method/work_artifact 类型，但无 Playbook、无 ExecutableScene、无 SceneRelease、无可运行性检查、无 skill flywheel

### 差距（要改）
1. **Playbook**（⚠️ 重要修正：Agent OS 文档里 Playbook 也**没有独立实体/生命周期定义**——仅作为 Agent 内置能力绑定工具组 + Claw 运行面板资源出现。所以「建 Playbook 实体」不是照抄 Agent OS，而是把「可执行流程资产」做成独立一等实体，**这是双方都没做到的空白**，TencentDB 有机会领先）
2. **ExecutableScene**（能力面/知识引用/输入表单/可运行性检查/发布快照）
3. **work_method → Playbook → Skill 的审核/版本演进链**

---

## 6. 审批 / 安全 / 授权

### Agent OS（工程最完备）
- **审批五档**：不可信命令审批 / 失败后审批 / **按需审批（默认）** / 智能审批（安全工具自动放行、风险工具要求确认）/ 永不审批
- **档位服务端解析**（客户端声明不生效；受执行者授权基线约束，低于下限不可选）；「声明与强制分离」
- **闸门三阶段**：身份策略授权 → 注册审批（SSE `interaction.approval_required`）→ 等待裁决；副作用发生在裁决之后；**120s 超时自动拒绝**；**模型无法批准自己的调用**（裁决只来自 API 调用方，原子认领防重复）
- **工具全生命周期 8 环**：能力定义→按智能体解析→分类暴露→可信上下文→调用前授权→审批→执行→结果终态；**未知能力默认拒绝**
- **身份**：JWT + API Token（SHA-256 哈希存储）+ 流式 Token（60s TTL）；双令牌（访问+刷新，刷新有寿命上限）；吊销跨进程广播（fail-closed）；**身份头不可伪造**（重写 x-user-id）
- **RBAC**：owner⊇admin⊇member⊇viewer，未知角色降 viewer；创建 Agent owner 强制取认证用户；执行权限上限由不可变定义修订推导
- **隔离**：注入型 project_id 进入 handler 前拒绝；私有资源拒绝返回「不存在」而非 403（避免泄露存在性）
- **工具防线**：未分类即拒绝 / 路径 canonicalize 越界拒绝（符号链接视为不安全）/ **输入护栏**（提示词覆盖企图、密钥外传、凭据材料、扫描超限 → 告警事件，载荷不含原始文本）
- **密钥**：`${secret:NAME}` 引用而非内联；AES-256-GCM 信封加密 `[nonce 12B][ciphertext+tag]`；不回显（前缀+****）；SSE 线共享脱敏，原始逐字输出只进管理员 trace，永不跨 SSE（契约测试固定）

### MindMemOS
- 多租户 project_id ContextVar 强制注入（隔离强但授权模型简单，无 RBAC 层级、无审批流）

### TencentDB 现状
- 有 `resolveIsolation`、`executeMemorySearch({filter})`、`/v3` 严格隔离、`profileIsolation`、recall 隔离（本轮已补）
- **缺**：审批五档 + 闸门、RBAC 服务端解析层级、输入护栏、`${secret}` 引用 + 信封加密、SSE 脱敏契约

### 差距（要改）
1. 审批门禁（五档 + 服务端解析 + 120s + 模型不能自批）
2. RBAC 服务端解析（owner⊇admin⊇member⊇viewer，未知降 viewer）
3. 输入护栏（提示词注入/密钥外传检测）
4. 密钥信封加密 + 脱敏契约

---

## 7. 观测 / 监控（你点名的）

### Agent OS
- **三层可观测面**：事件账本（chat_events / project_chat_events，断线回放）+ run 持久化（runs/execution_events/execution_approvals）+ 工具取证（tool_invocation_events：category/outcome/latency_ms/session_id/turn_id，裁决四值 allowed/approved/auto_approved/denied）
- **事件账本边界**：进账本 = 控制/工具/审批/计划/终态（脱敏后）；不进 = token 增量/原始推理/原始工具参数输出
- **run 状态机**：accepted→compiling→prepared→queued→running（approval_pending 等待审批）；终态 succeeded/failed/cancelled/timed_out/rejected
- **追踪**：四表带 trace_id/span_id/parent_span_id/span_kind，按 trace_id 串起；排障 4 步证伪（事件白名单→审批记录→工具取证→run 状态）
- **哲学**：排障查取证表/事件账本，不翻服务日志

### MindMemOS
- OTel + ClickHouse + Grafana；`make db-observability` 起观测栈；llm.chat.parse_error 等 span 事件落 ClickHouse

### TencentDB 现状
- 有 trace/metrics/log（otel-sdk、traced-task-executor、metric-tracking-recall、api-trace），但无「三层可观测面」结构、无事件账本持久化回放、无工具取证表、无主动告警/趋势面板

### 差距（要改）
1. 三层可观测面（事件账本 + run 状态机 + 工具取证）
2. 监控告警六类（质量/泄漏/成本/健康/运行时/回归）
3. 排障路径结构化（按 trace/session 收敛，而非翻日志）

---

## 8. 任务 / 计划 / 自动化

### Agent OS
- **计划/任务/run 三分**：计划=「这一轮怎么做」（会话内快照，`session.plan.*` 事件 + 4 元工具 plan_write/item_update/view/clear）；任务=「这件事办没办完」（跨会话 `board_tasks`，含 dependencies/blocker_reason/token_cost）；run=「这次执行走到哪」
- **交付物**：deliverables 表，submitted→approved/rejected（记录裁决人/时间）
- **自动化**：调度器 `SELECT FOR UPDATE SKIP LOCKED` + 冲突跳过 = 恰好一次 fire；`automation_fire` 入口类型进同一执行内核；FireAndForgetAck 入队即确认
- **19 种入口类型**统一进同一 run 状态机

### TencentDB 现状
- 有 TaskPayload / TaskExecutor / WorkerPermitPool / pipeline manager，但无「计划/任务/run」清晰三分、无 deliverable 评审、无恰好一次 fire 的 automation 模型

### 差距（要改）
1. 计划/任务/run 清晰三分 + 状态机
2. 交付物登记与评审（submitted→approved/rejected）
3. 自动化恰好一次 fire + 入口类型统一

---

## 9. 评测体系

### MindMemOS（最可复制）
- **四基准**：LoCoMo（single/multi-hop/temporal/open-domain）、PersonaMem（7 维：recall/ack-latency/tracking-evolution/revisit/suggest/recommend/generalization）、MemoryAgentBench FactConsolidation（SH/MH score + **archived%**）、SpreadsheetBench-Verified（success rate + tokens）
- **Dreaming 的量化收益**：FactConsolidation SH 0.635→0.738（+16%），archived 21.4%
- **Skill 演进收益**：SpreadsheetBench 51.3%→57.2%（supervised）

### Agent OS
- benchmark/ 目录多份 run 报告（enterprise-bench、team-eval、swe-agent、worksurface 等）

### TencentDB 现状
- 只有 vitest 正确性测试；无基准对接、无 recall 命中率/误召回/时序/scope 泄漏指标

### 差距（要改）
1. 接 LoCoMo + PersonaMem（7 维）+ FactConsolidation（archived%）
2. scope 泄漏硬门禁 = 0
3. 每次改算法看分数涨跌（回归告警）

---

## 10. MindMemOS 自己承认还没做的（TencentDB 的机会窗口）

`README.md §Coming Features` 明确列出：
1. **Lite mode**（低依赖可嵌入）
2. **Skills system**（治理大技能库 + 离线仿真优化）
3. **File system memory**（本地文件→知识图）← **TencentDB 已有 Wiki/CodeGraph，这是直接领先点**
4. 更多 agent 集成

**反过来 MindMemOS 强、TencentDB 弱的**：retention 混合分数、Dreaming 关系检测、Feedback、skill 自演化——这四块是算法差距。

---

## 11. 扫描补充发现（含 subagent 交叉验证）

两条审计链（Agent OS 103 篇文档 / MindMemOS 源码）与我的亲手读取交叉验证后，补出的边角能力——之前几版完全没提：

| 发现 | 详情 | 对 TencentDB 的含义 |
|---|---|---|
| **Playbook 双方都无独立实体** | Agent OS 文档里 Playbook 仅作工具组 + Claw 资源，无生命周期定义 | 「建 Playbook 实体」是空白点，有机会领先，非照抄 |
| **Agent OS 也有后台「做梦」** | 自动化草稿/启用/5 分钟下限 + 目标预算（release-notes） | dreaming 是共同方向，非 MindMemOS 独有；TencentDB 可对标两者 |
| **灰度发布 + 回滚** | Agent revision 支持来源哈希、稳定/灰度百分比发布与回滚；Scene 发布不可自动回滚但保留 20 条修改记录 | 资产/算法变更的可控发布 |
| **A2A 双向授权** | 双向授权 + 白名单 + 限速/并发/到期 | 多 agent 协作底座，TencentDB 无 |
| **post-turn 异步不阻塞** | SDK PostTurnHook 异步总结/学习不阻塞 turn；Skill Added/Removed 热挂载 | capture 应异步化，不拖慢对话 |
| **健壮性纵深** | Team 1800s watchdog / 整树预算终止 / 孤儿清扫；持久队列**消费前授权复查**；resume 工具漂移→fresh start | 长任务/恢复的健壮性样板 |
| **多模态 view_image fail-closed** | 仅模型真实声明支持才注册，否则 fail-closed；IM 白名单 + @触发 | 多模态授权要 fail-closed（非 TencentDB 独缺） |
| **导入导出 / 迁移 / 分享** | 项目 ZIP 导入 ≤10MB、工作台导出/归档恢复、资产归属迁移 | 记忆/资产可移植性缺口 |
| **MindMemOS agentic search** | `agentic/loop.py` max_rounds=3 + LLM sufficiency + planner 重查询 | TencentDB 只有工具式搜索，无 agentic 循环 |
| **MindMemOS 图扩展召回** | `entity_recall.py` + `schema_search_expander.py` 实体召回 + 多跳邻居 + 时间线扩展 | TencentDB 无图扩展（CodeGraph 未接记忆召回） |
| **MindMemOS 租户强制注入** | `memory.py#build_tenant_conditions` + `api/deps.py#get_request_context` | TencentDB 已有 IsolationFilter，语义对齐 |
| **接口契约与质量闭环** | Agent OS 615 接口响应契约 + 质量测评→finding→当日修复闭环 | 契约测试 + 质量门禁，TencentDB 缺 |

---

## 结论：要改的优先级（重排后）

| 优先 | 改什么 | 学谁 | 为什么先做 |
|---|---|---|---|
| P0 | 记忆空间与写入模型（Brain 域 + Agent 挂载 + 自动路由 + 持久 vs 总结） | Agent OS + MindMemOS | 你说的核心；关系/召回/闭环都依赖它做地基 |
| P0 | 召回 Retention 层（混合分数 + MMR + recency） | MindMemOS | 参数现成（0.50/0.25/0.15/0.10，λ=0.70，半衰期 30d），直接可抄 |
| P1 | 关系灵活化（多对多 + resolveExecutionBundle） | Agent OS | 解决「关联不如别人」 |
| P1 | 记忆闭环（Dreaming 7 类 + Feedback + 状态机） | MindMemOS | 从单向变自演化 |
| P1 | 资产演进（Playbook + ExecutableScene + 沉淀链） | Agent OS | 从引擎变产品 |
| P2 | 治理（审批/RBAC/护栏/加密脱敏）+ 监控 + 评测 | Agent OS | 正确性底座，recall 隔离已修 |

> 注：本轮 recall 侧 scope 隔离（P0 #C2）已实施并测试通过，属 P2 治理底座里已闭环的一项。
