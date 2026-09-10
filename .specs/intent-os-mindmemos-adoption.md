# 参考项目可引入评审（intent-os-platform + MindMemOS → TencentDB）

- **日期**: 2026-09-02
- **方式**: 3 个并行 subagent 通读参考项目文档+源码，静态分析（未运行参考服务）
- **关联**: `.specs/memory-platform-backlog.md`（47 条基线）、`.specs/CONTEXT.md`
- **关键事实**: `intent-os-platform` = backlog 里标注的「Agent OS（AO）」；`MindMemOS` = 「MM」。本次是**深化**（读全部），不是全新比对。

---

## ⚠️ 2026-09 深度复核更正（**读下表前必看**）

2026-09 对两个参考项目做了逐文件深度扫描（报告：`.specs/refs/mindmemos.md` 1003 行、`.specs/refs/intent-os-platform.md` 1946 行），**推翻了本表若干条目的可实现性**：

| 受影响条目 | 原陈述 | 复核结论 |
|---|---|---|
| **A3** | `priority=0.5·relevance+0.25·overlap+0.15·recency−0.10·cost`、30 天半衰期、`mixed-v2` MMR λ=0.70 | **MM 全仓零命中**（含 `src/` / `config/` / `docs/` / `plugins/*.ts`）→ **不是 MindMemOS 的做法，不得作为实现依据**。MM 检索侧只有 rerank + top_k 截断。降级为"待设计的候选方案"，且须先建评测基线 |
| **A12** | BM25 `k1=1.5` / `b=0.75` | MM 的 `encode_document/query` 的 `stats` 参数**全仓 13 个调用点无一传入** ⇒ `k1/b/idf` **全不生效**，永远走 `log_tf` 兜底。参数是装饰品 |
| **A7/A8** | 两阶段 dreaming + implicit feedback | 机制存在但**有真实丢数据风险**：`fast` 一致性下"新建失败但源归档照做"无失败短路；LLM#1 失败仍标 scope `done` ⇒ 永不重试；异常被吞。且有**跨用户越权**：种子采集是用户级，簇扩展 Cypher **只按 `project_id` 过滤** ⇒ 同 project 下他人记忆会被拉进 cluster 并被 update/merge/archive（在 MM 的"project=唯一强隔离"下不算越权，**在我们的四轴 + RBAC 下是明确越权**） |
| **A10** | TemporalEntity 时点回溯 | `validate_to` **全仓无写入点**，且 `exclude_none=True` 使其不落 payload ⇒ 只有**左边界**，不能表达"何时失效"，不构成双时间 |
| **A11** | skill 状态机 observed→…→published | `published_head` **恒 None** ⇒ `/v1/skills/sync` 恒 `has_update=false`；两插件硬编码 `base_version_id:""` ⇒ 纯插件场景演进**停摆** |
| **A13 / A6** | schema 选择、provider 契约 | schema learning **零生产调用方**（`EntityManager.register/update_property` 仅测试可达）；`RoutingMemoryProvider` 构建失败**静默回退 internal** ⇒ "数据实际落在哪"与配置不符 |

**仍成立且应采纳**：A1（RRF K=60）、A2（生命周期加分，刻意轻量）、A4（recall@k/nDCG/MRR + golden set）、A5（embedding 缓存按 `text_hash`）、A9（图扩展 hop 衰减）、A6（provider 契约，但须 fail-closed）。
**复核新增采纳**：检索侧 **Jaccard 近重复折叠**（放 rerank **之前**）、`superseded_by` **自引用关系**（取代是关系不是状态）、**召回可见性只允许一条路径**、**门禁即治理**（AO 元结论：有门禁的不变量完好，没门禁的在其自家代码里被违反）。
**顺序铁律**：**先建 recall@k golden set 评测基线，再动任何召回算法**。
完整依据见 `.specs/redesign/08-SCAN-FINDINGS.md`。

---

## 零、一句话结论

backlog 的「不缺实体、缺四块（灵活关系 + 运行控制面 + 记忆闭环 + 质量治理）」仍然成立。本次「读全部」的增量价值在**算法面的可执行参数**和**产品面的 agent/协作模型细节**：把 backlog 里「RRF / recency / quality eval / dreaming / feedback / 演进链」这些条目从「该做」补成了「具体怎么做」。

---

## 一、算法改进清单（用户最关心，backlog 未写细的部分）

| # | 算法 | 来源 | 具体参数/设计 | TencentDB 落点 | vs backlog |
|---|---|---|---|---|---|
| A1 | RRF 混合召回 | AO+MM | `score += 1/(60+rank)`，三路源（Vector/FullText/Keyword，MM 加 BM25 稀疏哈希 200 万维） | recall 融合层 | B3 只提 tie-break，缺 K=60 + 三路源 |
| A2 | 生命周期加分 | AO | recency=`1/(1+age_days)`、frequency=`ln(access_count+1)`，权重刻意取小（0.01/0.005）防淹没语义 | recall 排序后置 | B1 提 recency，缺对数+有界 |
| A3 | token-budget 保留 | MM | `priority=0.5·relevance+0.25·overlap+0.15·recency−0.10·cost`；recency 指数衰减（半衰期 30 天）；`mixed-v2`=top-m 保底+MMR(λ=0.70)；**只挑不改写** | recall 输出层 | B1 提 token+MMR，缺公式+只挑不改写 — ⚠️ **本条公式已被 2026-09 复核推翻（MM 全仓零命中），见文首更正** |
| A4 | 检索质量评估 harness | AO | recall@k / nDCG@k / MRR + golden set + `compare_rankings(baseline vs hybrid)` 离线可跑 | D1 质量度量尺 | D1 缺具体指标+harness |
| A5 | embedding 去重缓存 | AO | `embedding_cache` 按 `text_hash` 唯一 + hit_count/last_accessed | 降本提速 | 全新 |
| A6 | MemoryProvider 契约 | AO | `store/recall/forget/list/session_open/close(summary)/commit_archive` + `RecallIsolation`(NONE/ALL) fail-closed | 后端可插拔（TD 已被 AO 接为一等 provider） | C2 缺 provider 契约 |
| A7 | 两阶段 dreaming | MM | ①relation_detection 分类(duplicate/conflict/complementary/low_value/ambiguous) ②action_planning 五类动作(create/update/merge/archive/link) + 精确重复确定性归档 | B5 dreaming | B5 缺两阶段+五动作 |
| A8 | implicit feedback | MM | 无显式文本：LLM 从近期轮次探测负面信号 → query rewrite → 规划动作 | B7 feedback | B7 缺 implicit |
| A9 | 图扩展召回 | MM | 种子记忆经 Neo4j 拓邻，分数按 hop 衰减 `graph_decay=0.5` | recall 召回 | 全新 |
| A10 | 时间轴实体 | MM | TemporalEntity 每属性一条时间戳 timeline，支持 `at_time/in_range` 时点回溯 | B8 Entity/Property | B8 缺时点回溯 |
| A11 | skill git-like 版本 | MM | `content_hash`(tree)→`version_id`(commit)→`cloud_skill_id`(repo)+状态机(observed→…→published)，轨迹攒阈值聚 patch 出新版 | A10 演进链 | A10 缺版本治理 |
| A12 | 混合检索 sparse | MM | BM25 稀疏哈希（k1=1.5、b=0.75、porter 词干、spaCy 词形还原），补专有名词（ID/文件名/SQL 标识符）召回 | B2 rerank | B2 缺 sparse 通道 |
| A13 | schema 选择 + episode 客观化 | MM | query-time 挑实体 schema 子集（失败回退全量）；长对话 compaction 保头尾+中部 map-reduce 摘要 | 降本 | 全新 |

**优先级建议**：A1/A4/A5（确定性算法，改动小收益大，P0）→ A2/A3/A7/A8（召回闭环，P1）→ A9/A10/A12/A13（关系+降本，P2）→ A6/A11（生态，P3）。

---

## 二、产品能力清单（对应用户列的 4 大块）

### 1. 协作项目（用户列 9 项 ↔ intent-os 的 project 域）

| 用户列 | intent-os 对应 | 引入建议 |
|---|---|---|
| 对话记忆 | 已有（chat_memory） | ✅ 已就位 |
| 任务拆解 | `tasks`（scene 一步生成步骤 scene_steps 分表） | 借鉴「AI 一句话生成步骤 + fork/收藏/参数化」 |
| 工作空间 | `workspace_mode(interactive/batch/form_app)` + Studio | 借鉴 workspace 模式枚举 |
| 成员管理 | 已有 | ✅ 已就位 |
| 交付物 | `deliverables`（Blackboard 层，需 review） | 引入「交付物需 review」门 |
| 决策 | `decisions` + DecisionRecord（context+proposal+outcome+reviewer） | 引入决策审计留痕 |
| 规约心智 | `mindset`（工作模式）+ `persona_prompt` | 引入工作模式字段 |
| OKR | `objectives` + `key_results` | 引入 OKR 分解 |
| 挂载记忆空间 | `agent_memory_spaces`（关联表） | 已有，改走关联表 |

### 2. team（用户列 4 项 ↔ TeamSpec/Scene）

| 用户列 | intent-os 对应 | 引入建议 |
|---|---|---|
| 成员 | 已有 | ✅ 已就位 |
| 项目组件入口 | project 下挂 Scene/Panels/工具 | 引入「项目挂组件」 |
| 团队工具权限 | 工具两层：scene 共享 + agent 追加(extra_tools)；TrustRecord 渐进授信 | 引入渐进授信（批准一次→同类放行） |
| 运行基线 | 运行配置 + policy_override（策略只收紧） | 已对应 A6 策略收紧 |

### 3. agent（用户列 9+1 字段 ↔ intent-os agent 字段模型）

| 用户列 | intent-os 对应 | 现状 |
|---|---|---|
| 名称 | `name`（唯一必填） | ✅ 已有 |
| 描述 | `description` | ✅ 已有 |
| 类型 | 无显式 type（用 role Leader/Member + capability 语义分类映射） | 🆕 新增 |
| 可见性 | `visibility: private/team/public`（默认 private） | 🆕 新增 |
| 执行环境 | Studio.claw_config：`network_policy(offline/restricted/open)+allow_shell+approval_mode(never/on_failure/always)` | 🆕 新增 |
| 角色设定 | `persona`（**可选**，心智可后补/从知识库派生） | 已有，建议降为可选 |
| 绑定 skill | `agent_capabilities`（关联表，非 JSONB） | 已有，改走关联表 |
| 知识库 | `agent_memory_spaces`（关联表） | 已有，改走关联表 |
| MCP | `mcp_resolver`（McpServerConfig，stdio/SSE，密钥 AES-GCM） | 🆕 新增 |
| 是否提供 API | Capability Manifest `surface.tool`(给 AI) + `surface.api`(`POST /capabilities/{id}/invoke` 给外部) 双通道 | 🆕 新增（声明式，非布尔开关） |

### 4. 记忆空间

- 已有：memory-space（刚做完三层接线）
- 增强：A6 provider 契约 + A10 时间轴实体 + A11 演进链

---

## 三、对 backlog 的增量（本次读全部的额外价值）

backlog 47 条中，本次「读全部」补深了 **13 条算法细节（A1–A13）** 和 **11 条产品设计**（关联表绑定、AgentFullConfig 缓存、persona 可选、单 agent=团队退化态、AgentBus+send_message 深度上限、SSE 带 agent_name+TeamIdle、协作模式枚举+Blackboard、渐进授信+决策审计、panel→operate_* 派生、handler 自注册、Capability Manifest+Dispatcher）。

**backlog 未变**：5 组 47 条的骨架和优先级路线不变；本文件是它的「算法参数 + 产品细节」补充附录。

---

## 四、落地建议（一句话路线）

1. **先落算法底座（P0）**：A1 RRF(K=60) + A4 检索评估 harness + A5 embedding 缓存 —— 都是确定性算法，直接进现有 recall 链路，改动小、可测、立即见效。
2. **再落召回闭环（P1）**：A3 token-budget MMR + A2 生命周期加分 + A7 两阶段 dreaming + A8 implicit feedback。
3. **产品面（P2）**：agent 关联表绑定 + visibility + 执行环境（对应你的 agent 字段清单）+ Blackboard 协作项目（任务/交付物/决策/OKR/规约）。
4. **生态（P3）**：A6 provider 契约 + A11 skill git-like 版本库。

> 均为静态分析结论，未在本系统落地实现。要落地任何一条，需走 change 流程（见 code-kit）。

---

## 五、第二轮核查补充（首轮遗漏，价值不低）

| # | 补充项 | 来源 | 一句话 | 落点 |
|---|---|---|---|---|
| A14 | **Brain 2.0 文件态记忆** | AO | markdown 按 domain/section 存工作区，`write_deduplicated` 去重 + 原子写 + 域摘要缓存 + keyword 搜索 | 向量库之外的「透明记忆」形态——记忆可被人类 grep/版本管理，适合运维 agent 的「可审计记忆」 |
| A15 | **case_library 案例库 + critique_buffer 批判闭环** | AO | `case_library(problem_embedding/solution/reuse_count)` 经验复用；`critique_buffer(原始→批判→精炼, confidence_delta)` 自我改进 | 问题→解→复用次数的「经验库」+ 记忆自批判闭环，backlog 未覆盖 |
| A16 | **知识图谱时间边** | AO | `temporal_edges(valid_from/valid_to/change_reason)`——关系「何时成立、何时失效、为何变」 | 与 A10 时间轴实体互补：实体属性有 timeline，关系也有时间维 |
| A17 | **add_recall 写时召回** | MM | add 前先召回现有记忆作为抽取上下文，用于 dedup/merge/冲突判断 | 「写≠盲写」，写读合一；backlog B4/B5 有 dedup 但没点破「add 先 recall」 |
| A18 | **RAG 预处理流水线 + 分块参数** | AO | `extract(plain/html/csv)→clean_text→chunk_text`，6000 字节 chunk + 600 重叠 | 对应 backlog E1 文档导入，把「分块」参数化、可配 |
| A19 | **renforcement_count 强化计数** | MM | 重提的记忆被强化（幂等，metadata 去重防重放） | 遗忘/重要度排序的输入信号 |
| A20 | **内核隔离 intent-protocol** | AO | 平台自建原生 Op/事件词汇表，LLM 内核类型关进 harness，业务层零内核依赖 | 架构决策：LLM 后端（codex/claude/cursor…）可替换，防供应商绑定 |
| A21 | **A2A 对等互操作** | AO | 跨 agent 对等协议，默认 `internal_only` + private discovery | 对应你 agent 清单的「是否提供 API」更深一层：agent↔agent 直接对话 |

**其中 A14/A15/A17 尤其值得单列**——它们不是「调参」，而是「形态」级差异（透明文件态记忆 / 经验复用库 / 写读合一），backlog 的 47 条骨架里没有对应物。

---

## 六、实体关系层面改进（R 系列 · 实体之间「怎么连」）

> 现状痛点：Agent→Project 是单值字段；Asset 只绑 Agent；skill/知识库/MCP 塞 JSONB；关系散落各入口、无统一编译；记忆无血缘。

| # | 关系改进 | 现状 → 目标 | 来源 |
|---|---|---|---|
| R1 | Agent↔Project 多对多 | `AgentEntity.project_id` 单值 → 项目角色多对多（role/priority/enabled/config_override） | backlog A1 |
| R2 | 多层资产绑定 | 仅 Agent→Asset → **Team/Project/Agent/Scene/Task 都→Asset** | backlog A2 |
| R3 | 绑定关联表化 | skill/知识库/MCP 塞 agent 行 JSONB → 拆成 `agent_capabilities` / `agent_memory_spaces` 多对多表 | intent-os（新） |
| R4 | 统一运行编译 | 各入口自拼关系 → `resolveExecutionBundle()` 单一深模块输出（agents/skills/memorySpaces/policies/scope/revisions/configHash） | backlog A3 |
| R5 | 配置来源可解释 | 冲突不可解释 → 输出 `source_chain` + 最终值原因 | backlog A5 |
| R6 | 版本快照 | 运行受后续编辑影响 → 一次运行固定一份 revision | backlog A7 |
| R7 | 血缘 lineage | 记忆无衍生关系 → `parent_ids/root_id/derived_from`，被谁取代/由谁衍生 | MM（新） |
| R8 | 演进链 | 无沉淀路径 → Memory → Playbook → Skill（work_method→candidate→审核→版本） | backlog A9/A10 |
| R9 | 知识图谱关系 | 无概念层 → `knowledge_nodes + concept_edges + script_concepts`（概念、脚本、关系） | intent-os（新） |
| R10 | 关系时间维 | 关系无时效 → `temporal_edges(valid_from/valid_to/change_reason)` 关系「何时成立/失效/为何变」 | intent-os（新） |

**核心判断**：R1/R3/R4 是「关系层」的三大件——把「谁属于谁」从字段/JSON 升级为**可查询、可级联、可编译**的图结构；R7/R9/R10 是「记忆本体」的关系化（血缘 + 概念图 + 时间维）。

---

## 七、功能层面改进（F 系列 · 用户能「做什么」）

### 7.1 协作项目（对应用户列 9 项）

| # | 功能 | 说明 | 来源 |
|---|---|---|---|
| F1 | 任务拆解 | AI 一句话生成步骤（`scene_steps` 分表），支持 fork/收藏/参数化/草稿 | intent-os |
| F2 | 交付物 review 门 | 交付物落 Blackboard，需 review 才算完成 | intent-os |
| F3 | 决策审计 | `decisions` + DecisionRecord（context+proposal+outcome+reviewer），重大决策留痕 | intent-os |
| F4 | OKR 分解 | `objectives` + `key_results` 目标拆解 | intent-os |
| F5 | 规约心智 | `mindset`（工作模式）+ 空间级 `persona_prompt` | intent-os |
| F6 | 工作空间 | `workspace_mode(interactive/batch/form_app)` 工作形态枚举 | intent-os |
| F7 | 挂载记忆空间 | 项目/agent 关联 `agent_memory_spaces`，运行即注入 | 已有，改关联表 |

### 7.2 team 功能（对应用户列 4 项）

| # | 功能 | 说明 | 来源 |
|---|---|---|---|
| F8 | 项目组件入口 | 项目下挂 Scene/Panels/工具（组件入口） | intent-os |
| F9 | 团队工具权限 | 工具两层（scene 共享 + agent 追加）+ **渐进授信 TrustRecord**（批准一次→同类放行） | intent-os |
| F10 | 运行基线 | 运行配置 + `policy_override`（策略只收紧不放宽） | backlog A6 |

### 7.3 agent 功能（对应用户列 9+1 字段）

| # | 功能 | 说明 | 来源 |
|---|---|---|---|
| F11 | 可见性 | `visibility: private/team/public`，决定复用与对外暴露 | intent-os（新） |
| F12 | 执行环境 | `network_policy(offline/restricted/open) + allow_shell + approval_mode(never/on_failure/always)` | intent-os（新） |
| F13 | MCP 绑定 | MCP 独立管理（stdio/SSE，密钥 AES-GCM），`mcp_resolver` 注入运行时 | intent-os（新） |
| F14 | 是否提供 API | Capability `surface.tool`（给 AI）+ `surface.api`（`POST /capabilities/{id}/invoke` 给外部）双通道，非布尔开关 | intent-os（新） |
| F15 | 类型/角色 | role(Leader/Member) + capability 语义分类（data/compute/integration/system） | intent-os（新） |
| F16 | 角色设定可选化 | `persona` 降为可选，心智可后补/从知识库派生 | intent-os（新） |

### 7.4 记忆空间功能

| # | 功能 | 说明 | 来源 |
|---|---|---|---|
| F17 | 记忆浏览器/统计 | keyword/语义搜 + 单条详情 + 数量/类型/冲突/低价值统计 | backlog D4/D5 |
| F18 | 显式 CRUD | 单条 get/update/delete | backlog D6 |
| F19 | 冲突审批卡 | 冲突/低置信写入弹「确认/拒绝」 | backlog D9 |
| F20 | 主动 remember/forget | 带来源标注的显式写入/删除 | backlog B9 |

### 7.5 平台横切功能（intent-os 独有，TencentDB 无）

| # | 功能 | 说明 |
|---|---|---|
| F21 | 场景库 Scene | 可复用步骤化工作流（生成/fork/收藏/参数化） |
| F22 | 执行引擎 Run | Scene→Run 直链，七类 Runtime Profile（Ephemeral/Durable/Scoped/Workspace/Fanout/WorkflowJob/Structured），事件流按 run_id 订阅 + durable ledger |
| F23 | 审批中心 | 高风险 run/工具调用人工审批，最小 typed decision |
| F24 | 面板→工具派生 | panel `element_type` 自动派生 `operate_doc/data/code/workflow`（统一 action 枚举），面板即工具 |
| F25 | 审计/可观测 | audit logs + OTel GenAI spans + trace correlation |

---

## 八、三个层面总览（回答「除了算法还要改什么」）

| 层面 | 条目 | 一句话定位 |
|---|---|---|
| **算法** | A1–A21 | 「记忆怎么算得准、排得对、压得小」 |
| **实体关系** | R1–R10 | 「实体之间怎么连成可查询、可编译、可溯源的图」 |
| **功能** | F1–F25 | 「用户能做什么：协作/授权/可见性/执行环境/审计」 |

三者优先级：**算法（P0/P1）是地基**，**实体关系（R1/R3/R4）是骨架**，**功能（F 系列）是门面**。建议顺序：先把 R1/R3/R4 的关系骨架立起来（否则功能都做不牢），再铺算法，最后挂功能。

---

## 九、实体关系断点（代码确证的 5 处断裂）

交叉核对 `playbook.ts` / `memory-domain.ts` / `memory-space.ts` / `scene-executable.ts` 后，确认这些实体「已散落存在，但关系断/混」：

| 断点 | 现状（代码确证） | 该修 |
|---|---|---|
| ① 沉淀链断在上半段 | `assemblePlaybook()` 是「纯逻辑无 IO」，WorkMemory→Playbook→Skill **只写了纯函数，未接服务/HTTP/UI** | 把 Playbook 接进 `v3-memory` 路由 + 面板，让「任务做完→固化成剧本→晋级 Skill」能运行 |
| ② Scene 语义没拆 | L2 Scene（`scene-extraction.ts` 记忆块）与 ExecutableScene（`scene-executable.ts`）共词、无明确关系 | 拆名 + 建「Playbook ↔ ExecutableScene」等价关系（playbook 可升级为 executable scene） |
| ③ Agent↔Project 单值 | `AgentEntity.project_id` 单值字段 | 改多对多（role/priority/enabled），一个 agent 服务多个协作项目 |
| ④ 协作产物与记忆脱节 | Project 的 Task/OKR/交付物/决策是平铺的，与 MemorySpace 无关系边 | 建「协作产物 → Brain 域 → MemorySpace」写入路由（决策→semantic/rule，交付物→artifact，OKR→task） |
| ⑤ 演进权值缺衔接 | Playbook 有 `confidence+reusable`，但与 Skill 晋级无判定衔接 | 复用「reusable 阈值 → skill_candidate」挂到 A10 演进链 |

**核心判断**：实体都已存在，缺的是「实体之间的确定性关系路由」——①④ 是「关系没接通」，②③ 是「关系没拆清」，⑤ 是「演化缺门」。

---

## 十、领域模型（术语冲突 + 实体关系全景）

### 10.1 术语冲突（先拆名，再谈关系）

| 词 | 冲突 | 命名建议 |
|---|---|---|
| **Scene** | ①L2 记忆提炼块（`scene-extraction.ts`）②可执行场景（`scene-executable.ts`）③intent-os 工作流宿主 三义混用 | L2 记忆块→**MemoryScene**；可执行→**ExecutableScene**；工作流宿主→**Workflow**（暂不引入） |
| **Brain** | ①TD 的 Brain 域=记忆分类（`memory-domain.ts` 12 类）②intent-os Brain 2.0=文件态记忆形态 双义 | TD 分类维度→保留 **MemoryDomain**；文件态记忆→**FileMemory**（暂不引入） |

### 10.2 实体定义（TD 现状，代码确证）

| 实体 | 定义 | 代码位置 |
|---|---|---|
| Project | 协作项目容器（Task/OKR/交付物/决策 待建模） | — |
| Team | 团队，含 Agent 成员 | `TeamMember` |
| Agent | 智能体（Leader/Member），`visibility` 字段已存在 | `AgentEntity` |
| MemorySpace | 记忆空间 = `(ownerType × ownerId × domain)` 隔离容器 | `memory-space.ts` |
| MemoryDomain（Brain 域） | 记忆分类 12 类，每类带 lifecycle/write_policy/recall_weight | `memory-domain.ts` |
| WorkMemory | 工作记忆 `work_task/work_method/work_artifact` | `playbook.ts` |
| Playbook | 可复用流程 `steps+artifacts+confidence+reusable` | `playbook.ts` |
| ExecutableScene | 可执行场景 `SceneDefinition/Readiness/Release` | `scene-executable.ts` |
| Skill | 技能（版本演进 `skill-version.ts`） | `skill-version.ts` |

### 10.3 实体关系全景图

```
════════ 协作维度（谁包含谁）════════
Project ──contains──▶ Team ──contains──▶ Agent（Leader/Member）
   │                    └────contains────▶ Task
   └──────────（OKR/交付物/决策 未建模 ← 断点④）

════════ 隔离维度（谁拥有记忆）════════
{Project, Team, Agent, Task, User} ──owns──▶ MemorySpace
   MemorySpace = (ownerType × ownerId × MemoryDomain)   ← 已实现

════════ 记忆维度（内容怎么分）════════
MemorySpace ──承载──▶ MemoryDomain（12 类）
MemoryDomain ──决定──▶ WritePolicy（automatic/review_required/explicit_only/deny）

════════ 分层维度 ════════
L0 对话 → L1 记忆(7 类) → L2 MemoryScene 块 → L3 Persona

════════ 沉淀维度（怎么升华成资产）════════
WorkMemory(work_task/work_method/work_artifact)
   ──▶ Playbook（steps+artifacts+confidence+reusable）  ← 已有，纯逻辑无 IO（断点①）
        ──▶ Skill（版本演进）                            ← 已有 skill-version.ts
        ──▶ ExecutableScene                              ← 已有 scene-executable.ts（断点②）
```

---

## 十一、最终落地路线

**四层统一顺序（先骨架 → 再接线 → 后算法 → 最后门面）：**

```
阶段 1 · 立关系骨架（断点③④ + R1/R3/R4）
    Agent↔Project 多对多 + 绑定关联表化 + 协作产物→记忆路由 + 统一运行编译
    ↓
阶段 2 · 接沉淀链（断点①⑤）
    Playbook 接 v3-memory 路由/面板 + reusable→skill_candidate 晋级判定
    ↓
阶段 3 · 铺算法（P0 → P1）
    RRF(K=60) + 检索评估 harness + embedding 缓存  →  token-budget MMR + 两阶段 dreaming + implicit feedback
    ↓
阶段 4 · 挂功能（F 系列）
    协作项目/team/agent/记忆空间/平台横切，在骨架与算法之上逐块上线
```

**理由**：功能清单（协作项目 9 项 / agent 10 字段）几乎都卡在关系层——「挂载记忆空间」要 R3 关联表、「决策/交付物进记忆」要断点④路由、「任务沉淀成剧本」要接通断点①。**关系不通，功能做不牢，算法无处落脚。**

**下一步建议**：以「阶段 1（断点③④ + R1/R3/R4）」为第一个 change 落地，范围小、纯关系层、可独立验收，是四层里收益最高且不依赖算法的一步。
