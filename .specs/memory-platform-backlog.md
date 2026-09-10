# Memory Platform 改进 Backlog（TencentDB × Agent OS × MindMemOS 对比）

- **日期**: 2026-09-01
- **状态**: draft（待评审）
- **关联**: `.specs/CONTEXT.md`、`.specs/design-memory-isolation-m1.md`、`ROADMAP.md`
- **范围**: 跨几十轮对比后的唯一对照基线，后续迭代按此逐条推进。

> 标注约定：
> - **来源**：AO = Agent OS（`/home/malizhi/project/intent-os-platform`）；MM = MindMemOS（`/home/malizhi/project/MindMemOS`）；TD = TencentDB 自身已知债务
> - **优先级**：P0 正确性底座 → P1 召回与闭环 → P2 关系与治理 → P3 产品化与生态
> - ▲ = 之前清单遗漏、本轮补回的横切项

---

## 一、定位与已有能力

| 系统 | 定位 | 借鉴点 |
|---|---|---|
| Agent OS | Agent 平台（Team/Project/Agent/Scene/Skill/Memory/任务/执行） | 资源关系模型 + 运行控制面 |
| MindMemOS | 记忆操作系统（抽取/检索/巩固/反馈/Skill 演进） | 记忆算法 + 生命周期闭环 |
| TencentDB-Agent-Memory | 轻量记忆内核 + 元数据管理 + L0-L3 | 保留轻量 + 多租户 + 现有流水线 |

**TencentDB 已具备（源码确证，不重复建设）：**

User / Team / TeamMember / Project / ProjectMember / Task / TaskAgent / Agent（含个人 Agent）/
Asset（skill·llm_wiki·code_graph·chat_memory）/ Agent 固定资产绑定 / L0 对话 + 向量 + checkpoint /
L1 结构化记忆（7 类）+ FTS + 向量 + online dedup / L2 Scene blocks + index + navigation /
L3 Persona / 自动捕获（L0→L1→L2→L3）/ Skill（CRUD·版本·patch·文件·归档·review）/
Knowledge（wiki·code-graph）/ Quota / Trace / Metrics / GenerationLog / 数据 TTL / Backup / Checkpoint / Worker。

**结论：不是缺实体，而是缺「关系灵活性 + 运行控制面 + 记忆闭环 + 质量治理」。**

---

## 二、完整改进清单（5 组 47 条）

### 组 A：关系与运行控制面（来源：AO）

| # | 改进项 | 优先级 | 现状 → 目标 |
|---|---|---|---|
| A1 | `meta_project_agents` 多对多 | P1 | `AgentEntity.project_id` 单值 → 项目角色多对多（role/priority/enabled/config_override） |
| A2 | 多层资产绑定 | P2 | 仅 Agent→Asset → Team/Project/Agent/Scene/Task → Asset |
| A3 | `resolveExecutionBundle()` 统一编译 | P1 | 各入口自拼关系 → 单一深模块输出有效运行配置（agents/skills/memorySpaces/policies/scope/revisions/configHash） |
| A4 ▲ | Readiness 检查 | P2 | 运行时才报缺 → 运行前校验依赖，输出 `missing[{type,id,reason_code}]` |
| A5 ▲ | 配置来源解释 | P2 | 冲突不可解释 → 输出 source_chain + 最终值原因 |
| A6 | 策略只收紧不放宽 | P1 | 无明确规则 → Team∩Project∩Scene∩Task 逐层收紧 |
| A7 | Agent/Skill/Scene 版本快照 | P2 | 运行受后续编辑影响 → 一次运行固定一份 revision |
| A8 | MemoryScene / ExecutableScene 分离 | P3 | L2 scene 语义混用 → 拆分，不破坏现有 L2 |
| A9 | Playbook 独立模型 | P3 | 无 SOP 层 → Memory 与 Skill 之间的步骤化资产 |
| A10 | Memory→Playbook→Skill 演进链 | P3 | 无沉淀路径 → work_method → candidate → 审核 → 版本 |

### 组 B：记忆算法与召回（来源：MM）

> ⚠️ **2026-09 深度复核**：本组多条来自 MM 的"参数"经逐文件核验后被发现**未生效或不存在**（详见 `.specs/intent-os-mindmemos-adoption.md` 文首更正表 与 `.specs/redesign/08-SCAN-FINDINGS.md`）。**B1 的 MMR/priority 公式在 MM 全仓零命中，不得作为实现依据**；B12 是复核**新增**的采纳项；**先建评测基线再改召回**。

| # | 改进项 | 优先级 | 现状 → 目标 |
|---|---|---|---|
| B1 | Recall Retention Selector | P1 | RRF 后 `slice(maxResults)` → token budget + MMR + recency + priority |
| B2 | Relevance Gate + Rerank | P1 | RRF 分数无绝对含义 → RRF 粗排 + rerank 精排 + gate 拒绝不相关 |
| B3 | 确定性 tie-break | P1 | 同分依赖插入顺序 → 按 memory_id 稳定排序 |
| B4 | L1 dedup 相似度分层 | P1 | 全量候选喂 LLM → 高分直判 / 中分交 LLM / 低分直存 |
| B5 | Dreaming 离线巩固 | P1 | 仅 online dedup → relation detection → action planning（duplicate/conflict/complementary/low_value） |
| B6 | 冲突显式处理 | P1 | 静默 drop → 登记待裁决 + before/after diff + confidence |
| B7 | Feedback 闭环 | P1 | 无回流 → 五类反馈（correct/incorrect/outdated/irrelevant/missing）→ 状态/权重/重抽 |
| B8 | Entity/Property/Edge | P2 | 固定 7 类 → 先加结构化字段（entity/predicate/value/time/provenance），保留 7 类。**⚠️ 2026-09 复核：MM 的 schema learning 零生产调用方（仅测试可达）；本项目加入字段前必须先定「谁写入」——无生产者等于空表** |
| B9 | 主动记忆接口 | P1 | 仅自动抽取 → remember/forget/correct_memory + 来源标注 |
| B10 ▲ | 意图理解/澄清 | P1 | 直接按 query 召回 → 低置信不硬注入，触发澄清或标注不确定 |
| B11 ▲ | 近重复折叠（Jaccard） | P1 | 近重复条目直接注入 → 在 **rerank 之前**做 Jaccard 折叠 + 数字指纹否决 + 短文本豁免（MM 复核中最高性价比项） |
| B12 ▲ | 取代是关系不是状态 | P1 | 用状态字段标记失效 → `superseded_by` **自引用** + `ON DELETE SET NULL`（替代者被删时旧项自动复活）；**必须有生产者**，否则同为空能力 |
| B13 ▲ | 召回可见性**单入口** | P0 | 多路径各自实现过滤 → **单函数 + 枚举式门禁**；写入/召回各只允许一条路径（AO 实测其"三个读写世界"致同一条记忆可见性不一致，且每条路径单独测都通过） |
| B14 ▲ | 时间边**只承诺左边界** | P2 | 假装双时间 → `valid_from` 必须有真实写入点；`valid_to` 无生产者就不建字段（MM 的 `validate_to` 全仓无写入点且不落 payload） |

### 组 C：治理 / 安全 / 合规（来源：AO+MM）

| # | 改进项 | 优先级 | 现状 → 目标 |
|---|---|---|---|
| C1 | Memory Audit Ledger | P0 | 观测分散 → 写入/召回/治理/安全四类审计事件统一记账 |
| C2 | Recall 侧 scope 隔离 | P0 | `actorId="default_user"` 单租户 → ✅ 已实施（HTTP `/recall` + `performAutoRecall` 链已接 team/user/agent 窄化 L1 + L2/L3 profile scope；standalone harness 保持单租户默认） |
| C3 | 记忆质量状态机 | P1 | 状态弱 → candidate→verified→active→stale→disputed→superseded→archived→deleted |
| C4 ▲ | RBAC 服务端解析授权 | P0 | 客户端声明不设防 → `owner⊇admin⊇member⊇viewer`，未知角色降级 viewer |
| C5 ▲ | 隔离默认拒绝 | P0 | 403 泄露存在性 → 私有资源返回「不存在」，未绑定即能力不可用 |
| C6 ▲ | 密钥加密 + 掩码 | P2 | 明文风险 → AES-256-GCM，回显只给前缀 + `****` |
| C7 | 敏感内容脱敏 | P1 | 密钥/连接串可能进 prompt → 召回注入前脱敏 |
| C8 ▲ | 留存期配置 + 级联删除 | P2 | 无完整生命周期 → 归档/过期/留存 + 删 user/team 级联 |
| C9 | 删除/撤回/过期/恢复语义 | P1 | 只有 TTL 清理 → 软删 + 审计 + lineage + 恢复 |
| C10 | 统一后台 Job 模型 | P2 | 调度分散 → 幂等/重试/断点/取消/并发 + 任务互斥 |
| C11 ▲ | **配置项必须有生效路径** | P1 | 「配置开了但代码不读」→ 加 `check-config-live` 门禁（MM 头号病：BM25 的 `stats` 13 个调用点无一传入、`recall.*`(8)、`safety_gate.*`、`use_property_filter`、`enable_entities`、`compaction_soft_token_budget` 等一批配置全无生效路径） |
| C12 ▲ | **禁止静默回退** | P0 | provider/路由解析失败静默换目标（AO 的 `RoutingMemoryProvider` 构建失败→静默回退 internal，致「数据实际落在哪」与配置不符，记忆平台属**合规级**问题）→ 解析失败必须显式失败或显式告警 |
| C13 ▲ | **遗忘/衰减必须有生产调用方** | P1 | 声称有遗忘闭环但零调用方（AO 的 `MemoryWriteScope::review_durable`、`archive_stale`、`restore_archived` 全零生产调用方）→ 无生产者即视为**不具备该能力** |
| C14 ▲ | **巩固/聚类必须带全部 scope 条件** | P0 | 种子采集是用户级、簇扩展只按 `project_id` 过滤 → 同 project 下他人记忆被拉进 cluster 并被 update/merge/archive（MM 实测缺陷；在其「project=唯一强隔离」下不算越权，**在我国四轴 + RBAC 下是明确越权**）→ 聚类查询携带与种子相同的全部 scope 条件 + 目标侧独立写权限校验 + 断言 `cluster.scope ⊆ seed.scope` |
| C15 ▲ | 审计覆盖面与鉴权同源 | P1 | AO 的 audit 只覆盖 Agent CRUD、admin-only 声明未挂中间件 → 审计账本（C1）必须覆盖**四类事件**且与鉴权中间件同源 |

### 组 D：质量与功能（用户面）

| # | 改进项 | 优先级 | 现状 → 目标 |
|---|---|---|---|
| D1 | Memory Quality Eval | P0 | 只有 vitest 正确性 → 抽取/召回/时序/冲突/scope 泄漏指标 |
| D2 | scope leakage 硬门禁 | P0 | 无专项 → 泄漏率必须 0 |
| D3 | 召回解释与调试台 | P1 | 只知「召回几条」→ rank/score/scope/lineage/reason |
| D4 | 记忆浏览器 | P3 | 只有 recall 注入 → keyword/语义搜 + 单条详情 |
| D5 | 记忆统计/健康面板 | P3 | 看不见 → 数量/类型/冲突/低价值 |
| D6 ▲ | 显式记忆 CRUD | P2 | 仅批量写 → 单条 get/update/delete |
| D7 ▲ | 记忆纠错反馈 | P1 | 无入口 → 「错了/过时了」按钮 → 标记重抽 |
| D8 ▲ | 离线整理触发 + diff | P1 | 无入口 → 「整理记忆」按钮 + 前后 diff |
| D9 ▲ | 冲突审批卡 | P1 | 静默 → 冲突/低置信写入弹「确认/拒绝」卡 |
| D10 ▲ | 「记住这个」显式写入 | P1 | 仅自动抽取 → 带来源标注的显式入口 |
| D11 ▲ | 空间级人设 + 检索配置 | P2 | 无配置面 → chat_memory 加 persona + 检索参数 |
| D12 ▲ | 记忆助手对话验证 | P3 | 无法自检 → 空间内问答验证抽取/召回 |
| D13 | 成本/命中报表 | P3 | 有日志无可视化 → token/延迟/命中率按 user/team/project |

### 组 E：生态与迁移（来源：AO+MM）

| # | 改进项 | 优先级 | 现状 → 目标 |
|---|---|---|---|
| E1 | 文档统一导入流水线 | P3 | Wiki/CodeGraph/对话三套入口 → 上传→分块→embedding→索引→MemorySpace |
| E2 | Copy/Share/Transfer/Import | P3 | 无完整语义 → 四操作 + scope 重映射 + 冲突报告 |
| E3 | SDK/CLI/插件协议 | P3 | 服务 dsh 为主 → 统一 recall/capture/search/feedback 接入 |
| E4 | 记忆预览/撤回/屏蔽 | P2 | 无用户控制权 → 预览 + 主题撤回 + 召回屏蔽 |

---

## 三、优先级路线（4 阶段）

```
【第一阶段 · 正确性底座】(P0)
C2 Recall scope 隔离          ← scope leakage 必须 0
D1 Memory Quality Eval        ← 质量度量尺
D2 scope leakage 硬门禁
B10 意图理解/澄清             ← 低置信不硬注入
C4 RBAC 服务端解析授权
C5 隔离默认拒绝               ← 服务端解析，防泄露
A1 meta_project_agents
A3 resolveExecutionBundle()
C1 Memory Audit Ledger

【第二阶段 · 召回与闭环】(P1)
B1 Retention Selector + B2 Rerank + MMR
B3 确定性 tie-break
B4 L1 dedup 数值分层
B7 Feedback + D9 冲突审批卡
B5 Dreaming + D8 离线整理 diff
B9 主动 remember/forget
C3 记忆质量状态机
C7 敏感脱敏 + C9 删除/撤回/恢复

【第三阶段 · 关系与治理】(P2)
A2 多层资产绑定 + A4 Readiness + A5 配置来源解释
A6 策略收紧 + A7 版本快照
C6 密钥加密 + C8 留存/级联 + C10 Job 模型
D6 显式 CRUD + D11 空间配置
B8 Entity/Property/Edge
E4 记忆预览/撤回/屏蔽

【第四阶段 · 产品化与生态】(P3)
D4 浏览器 + D5 统计 + D12 助手验证
A8 ExecutableScene + A9 Playbook + A10 演进链
D13 成本/命中报表
E1 文档导入 + E2 迁移 + E3 SDK/CLI
```

---

## 四、目标完整链路

```
回合捕获 / 主动 commit / 文件上传 / 任务结果
  → 意图理解（低置信澄清）
  → MemoryWriteRouter（按域 + 空间路由）
  → Dedup / Conflict / Approval（+ 审批卡）
  → L1 + Entity/Property/Edge
  → 索引
  → Audit（+ 脱敏 + RBAC + 加密）
  → Dreaming / Feedback / L2 / L3 / Skill candidate
  → Recall（Retention + Rerank + MMR）
  → 注入
  → Recall Audit + Quality Metrics
```

---

## 五、最终结论

1. **不缺基础实体**：Team / Project / Agent / Scene(记忆) / Skill / Asset / L0-L3 / Quota / Trace / 数据 TTL / AutoCapture 均已存在。
2. **真正缺的是四块**：灵活关系 + 运行控制面 + 记忆闭环 + 质量治理。
3. **最核心的一句话**：下一步不应继续增加实体或 `asset_type`，而应把已有实体用「多对多绑定 + 统一运行编译器 + Brain 域路由 + 生命周期状态机 + 审计账本 + 质量评测」串成闭环。
4. **关键工程判断（注意：非 MindMemOS 事实，是本项目的设计判断）**：时间/冗余/优先级不进 RRF，放独立 Retention 层；Dreaming 与 online dedup 并存；Feedback 用版本化更新（新版本 + 归档旧版 + lineage）。—— ⚠️ 2026-09 复核：MM 检索侧实际**只有 rerank + top_k 截断**，没有独立的 Retention 层，此条属"我们的设计取向"，**不是从 MM 抄来的既成做法**。
5. **⭐ 治理的唯一有效形式是可执行门禁**（2026-09 新增，来源：intent-os-platform 元结论）：有门禁的不变量（其 4 套 Chat API 白名单，实跑 `exit=0`）**完好**；无门禁的不变量（其 `AGENTS.md:90` 明令禁止的"全局流后本地过滤"）**在其自家代码里被违反**（`handler.rs:1777,1801`）。
   → 本项目一切不变量（架构约束、能力声明、配置生效、可见性单入口）**必须落成可执行门禁**，否则不被遵守；文档与规范本身不产生约束力。落地清单见 `.specs/redesign/05-TECH-PLAN.md §3`（7 个脚本，ratchet 模式只减不增）。
6. **先建评测基线，再改召回**（2026-09 新增，来源：intent-os-platform）：`recall@k` / `nDCG@k` / `MRR` golden set + `compare_rankings(baseline vs 新方案)` 离线可跑，**是 D1/D2 的 P0 属性**而非"以后再说"。

> **2026-09 复核状态**：本文 47 条基线已按逐文件深度扫描复核，新增 B11–B14、C11–C15；B1/B8 已加更正标注。深度扫描报告：`.specs/refs/intent-os-platform.md`（1946 行）、`.specs/refs/mindmemos.md`（1003 行）、`.specs/refs/page-parity-audit.md`（383 行）；结论汇总：`.specs/redesign/08-SCAN-FINDINGS.md`。
>
> 这是前面几十轮对比的合并版。后续迭代以此文件为唯一对照基线，避免重复讨论同一批对比。