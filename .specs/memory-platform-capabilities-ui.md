# 「平台能力」模块交互稿（v1）

> 目标：把 MemoryPanel 的「平台能力」从「内核纯函数调试台」重做成「记忆对象管理面」，
> 对齐 Zep / Letta / Mem0 / Agent OS / MindMemOS 对外暴露的能力形态。
> 本文是交互稿（不做代码），先对齐再实现。
>
> 依据：`.specs/memory-platform-comparison-v2.md`（Agent OS / MindMemOS 扫描）、
> `.specs/memory-platform-backlog.md`（D3/D4/D5/D6/D7/D8/D9/D10/D11/D13、B9、C3、C1），
> 本会话抓取的 Zep（Context Graph/Context Types/Governance）、Letta（Memory blocks/Archival/Shared/Evals/HITL）。

---

## 0. 定位：一句话

平台能力 = **把「记忆」当作一个可管理的对象**，覆盖五个用户动作：
`浏览/搜索 → 检索试调 → 显式写入/纠错 → 治理审批 → 评测/观测`。

不再暴露 `review/gate`、`approval/needs`、`lifecycle/decide`、`quality/transition` 这类内核纯函数。

---

## 1. 信息架构

入口不变：`记忆空间` 页 → Segment「空间列表 / 平台能力」。

「平台能力」内部从现在的 7 个 tab（含内核函数）重排为 **5 个 tab**：

| # | Tab | 用户动作 | 对标 | 底座成熟度 |
|---|---|---|---|---|
| 1 | 记忆浏览器 | 浏览/筛选/搜索真实 L1 记忆 | Zep Context Graph 浏览、Mem0 记忆列表 | ✅ 底座现成（`queryL1Records`/`searchL1Hybrid`） |
| 2 | 检索试调台 | query → 命中记忆 + 每条 score/scope/reason | Zep `graph.search`、AO `space_search` | ✅ 底座现成（`searchL1Hybrid`） |
| 3 | 显式写入/纠错 | remember / correct / forget（带来源） | Letta `core memory`、Mem0 `add`、AO `memory_commit`、backlog B9/D10 | ⚠️ 需新建写端点 + 显式来源标记 |
| 4 | 治理/审批 | 空间写策略配置 + 审批队列 + 审计 | AO 审批五档、Zep Governance、backlog C1/C3/D9 | 🟡 审批队列已做（WriteApproval），策略配置/审计待补 |
| 5 | 评测/观测 | 真实评测集跑分 + 回归趋势 + run 回放 | Letta Evals、MM 四基准、AO 三层观测 | 🟡 RunTrace 已做；评测集待接 |

每个 tab 顶部统一带一个「团队 × Agent × 空间」作用域筛选条（复用现有 `space/list` 的四维筛选），
下方内容区随作用域联动。**这是与竞品一致的核心心智：先选空间/主体，再看该空间里的记忆。**

---

## 2. Tab 1 · 记忆浏览器（最高优先）

### 定位
竞品第一能力，我目前零实现。让用户「看到存了什么」。

### 布局（上→下）
1. **作用域筛选条**：团队 / Agent / 空间（`space/list` 四维）＋ 域（domain）＋ 写策略（write_policy）下拉。
2. **统计条**：`N 条记忆` · 按 `type` 分布 chips（persona/episodic/instruction/rule/…）· 按 `write_policy` 分布 chips。
3. **列表（Table）**，每行 = 一条真实 L1 记忆，列：
   - `content`（主列，可点开详情）
   - `type`、`domain`、`write_policy`（Tag）
   - `priority`（数字，-1 标「全局指令」）
   - `scene_name`、`agent_id`、`session_id`
   - `version`（合并/更新历史）
   - `created_at` / `updated_at`
   - 行尾操作：`详情`、`纠正`（跳到 Tab 3 预填）、`归档`（跳到治理）
4. **分页 / 更多**：按 `updated_time` 倒序，默认 20 条，`limit/offset`。

### 详情抽屉（点 `content`）
- 全字段：source_message_ids（来源消息溯源）、timestamps（时间轨迹）、metadata_json（解析后的 episodic 等）、space_id、write_policy、version 链。
- 顶部放「纠正 / 归档 / 查看来源会话」三个动作。

### 交互
- 筛选变化即重新查（防抖 300ms）；空态给「该作用域暂无记忆」。
- 域/写策略筛选在**列表层客户端过滤**（`L1QueryFilter` 当前无 domain/space 字段，见 §7 需补）。

### 数据来源
- 现有内核能力：`IMemoryStore.queryL1Records(filter)` / `countL1(filter)`（team/agent/user/session/task/recordIds 过滤）。
- **需新建**：`POST /v3/memory/l1/list`（走 `deps.getStore()`，返回 `L1RecordRow[]`，镜像 `consolidation/execute` 的依赖注入 seam）。
- **需补**：`L1QueryFilter` 增加 `domain?` / `spaceId?` / `writePolicy?`（或列表层过滤，二选一，建议内核补字段以支持大数据量分页）。

---

## 3. Tab 2 · 检索试调台（召回解释）

### 定位
对标 backlog D3「召回解释与调试台」、Zep `graph.search`、AO `space_search(threshold/limit/filter)`。
让用户看到「为什么召回这几条」。

### 布局（左查询 / 右结果）
1. **查询区**：`query` 输入框 ＋ `topK`（默认 10，最大 50）＋ `threshold`（默认 0.5，可关）＋ 作用域筛选条 ＋ 「检索」按钮。
2. **结果区**（每条命中一张卡）：
   - `content` + `score`（相似度，Tag 高亮）
   - `type / domain / priority / write_policy`
   - **召回解释行**（score 组成 + scope 命中）：`keyword 分 × ×`、`向量分 × ×`、`命中 scope=team/agent`、`recency`（若有 retention 层则展示）
   - 点开看 `source_message_ids` 溯源
3. **无结果/低分提示**：低于 threshold 的折叠为「未过阈值 N 条（score 0.xx）」。

### 交互
- 检索只读、不改写；结果带「写入显式记忆」按钮（跳 Tab 3 预填 content）。
- 空 query 提示必填。

### 数据来源
- 现有：`IMemoryStore.searchL1Hybrid({query, queryEmbedding, topK, filter})`（keyword+vector+RRF）。
- **需新建**：`POST /v3/memory/l1/search`。
- **召回解释**：若 `searchL1Hybrid` 已返回 keyword/vector 两路分数，则直出；否则先用总分 + type/scope 命中，retention 层（B1/B2）落地后再补 recency/MMR 解释。

---

## 4. Tab 3 · 显式写入 / 纠错

### 定位
对标 backlog B9「主动 remember/forget/correct」、D10「记住这个」、D7「纠错反馈」，
Letta core memory、Mem0 `add`、AO `memory_commit`。让「用户显式操作」成为一等入口（对应 write_policy=explicit_only 的语义）。

### 布局
1. **模式切换**：Segment `记住 / 纠正 / 遗忘`。
2. **表单（按模式）**：
   - 记住：`content`（必填）＋ `type` 下拉 ＋ `domain` 下拉 ＋ `来源来源标注`（用户手输/选择来源会话）＋ 目标空间/Agent（作用域条）。
   - 纠正：先检索选一条现有记忆 → 显示旧 content → `新 content` ＋ `纠正原因`（对应 backlog D7）。
   - 遗忘：检索选一条 → 显示 → 「确认遗忘」二次确认。
3. **提交结果**：成功 → 该记忆进入浏览器的 `explicit` 来源标记，并落到审计账本（§5）；走审批门的写策略时 → 弹「待审批」提示并进审批队列（复用已做的 WriteApproval 门）。

### 交互
- 纠错/遗忘必须先检索选记忆，不允许凭空操作（防误删）。
- 所有显式操作写审计事件（who/what/when/before/after）。

### 数据来源
- **需新建**：
  - `POST /v3/memory/l1/remember`（显式写，带 `source=explicit` + 来源标注）
  - `POST /v3/memory/l1/correct`（版本化更新：新版本 + 归档旧版 + lineage，对标 MM「版本化更新」）
  - `POST /v3/memory/l1/forget`（软删/降权，含审计）
  - 均走 `deps.getStore()`，并复用现有 `write_policy` 门决定 automatic/pending/deny。

---

## 5. Tab 4 · 治理 / 审批

### 定位
对标 AO 审批五档 + 闸门、Zep Governance、backlog C1（审计账本）/C3（质量状态机）/D9（冲突审批卡）。

### 布局（三块）
1. **空间写策略配置**：列出当前作用域的空间（`space/list`），每行可改 `write_policy`（automatic / review_required / explicit_only / deny，Select）＋ 展示 domain。→ 需要「更新空间写策略」端点。
2. **审批队列**（复用已做 WriteApprovalPanel）：pending 列表 + 批准（真实执行）/ 拒绝；展示来源 agent / write_policy / plans 摘要。
3. **审计账本**（新）：`时间 / 操作者 / 动作(写入|召回|纠错|遗忘|审批) / 对象 / 作用域 / 结果`，只读分页。

### 数据来源
- 审批队列：✅ 已做（`/v3/memory/write-approval/*` + `meta_write_approvals`）。
- 空间写策略更新：**需新建** `POST /v3/meta/agent-space/update-policy`（或复用现有空间更新）。
- 审计账本：**需新建** `meta_memory_audits` 实体（backlog C1，四类审计事件统一记账）。

---

## 6. Tab 5 · 评测 / 观测

### 定位
对标 Letta Evals（suites/graders/gates）、MM 四基准、AO 三层观测、backlog D1/D2/D13。

### 布局（两块）
1. **评测集跑分**：
   - 预置评测集（先内置 FactConsolidation 风格：`query / relevant_ids / 领域`，后续接 LoCoMo/PersonaMem）
   - 跑分按钮 → 输出 `recall@k / MRR / nDCG / archived%` + **与上次对比的涨跌箭头**（回归趋势）
   - scope 泄漏硬门禁显示为「0 泄漏 ✅ / N 泄漏 ❌」
2. **运行回放**：复用已做的 RunTracePanel（L1 提取 / 巩固 / 审批 的 run 记录）。

### 数据来源
- 运行回放：✅ 已做（`meta_run_traces` 自动落库 + RunTracePanel）。
- 评测：**需新建** 评测集存取 + `/v3/memory/eval/run`（跑评测集，存历史分数 → 趋势）。
- 现有 `/v3/memory/eval/retrieval`（一次性玩具输入）**降级为内部函数**，不再作为 UI 主入口。

---

## 7. 数据来源对照（现有 vs 需新建）

| 能力 | 内核/网关现状 | 需新建 |
|---|---|---|
| 浏览 L1 记忆 | `queryL1Records`/`countL1` 已有 | `/v3/memory/l1/list` 端点 + 面板代理 |
| 检索 L1 记忆 | `searchL1Hybrid` 已有 | `/v3/memory/l1/search` 端点 + 面板代理 |
| 显式 remember/correct/forget | 无（仅 pipeline 自动 + `consolidation/execute`） | 3 个 `/v3/memory/l1/*` 写端点 |
| 空间写策略配置 | `AgentSpaceEntity.write_policy` 已存、`space/list` 可读 | 空间写策略更新端点 |
| 审批队列 | ✅ 已做（WriteApproval 全套） | — |
| 审计账本 | 无 | `meta_memory_audits` 实体 + 记账钩子 |
| 评测集跑分 + 回归 | 无（仅玩具 `eval/retrieval`） | 评测集存取 + `/v3/memory/eval/run` + 历史分数 |
| 运行回放 | ✅ 已做（RunTrace 自动落库） | — |
| 域/空间过滤 | `L1QueryFilter` 无 domain/space | 补 `domain`/`spaceId` 过滤字段（或列表层过滤） |

---

## 8. 与竞品逐点印证（防再跑偏）

| 竞品能力 | 本稿对应 |
|---|---|
| Zep Context Types（facts/entities/episodes/…） | Tab 1 的 `type/domain` 分布 chips + 列表列 |
| Zep `graph.search` / AO `space_search` | Tab 2 检索试调台 |
| Zep Fact Invalidation | Tab 3 纠正（版本化 + 失效时间） |
| Letta core memory / Mem0 `add` / AO `memory_commit` | Tab 3 记住（显式 + 来源） |
| AO 审批五档 + 闸门、Zep Governance | Tab 4 治理/审批 |
| Letta Evals、MM 四基准 | Tab 5 评测 |
| AO 三层观测 / Zep Debug mode | Tab 5 运行回放（RunTrace） |

---

## 9. 建议实施顺序（确认后执行）

1. **Tab 1 + Tab 2**（`l1/list` + `l1/search` 端点 → 面板代理 → 浏览器 + 检索试调台 UI）——底座现成、竞品第一能力、最快见效。
2. **Tab 3**（`remember/correct/forget` 写端点 + 来源/审计 + 审批门复用）。
3. **Tab 4 补全**（空间写策略更新 + 审计账本实体）。
4. **Tab 5 补全**（评测集 + 回归趋势）。

> 每个 tab 落地时：后端端点 + vitest、面板白名单 + 代理、前端 UI、curl + Playwright 端到端，四层一起验，不交「只通接口没 UI」或「只 UI 假数据」的半成品。
