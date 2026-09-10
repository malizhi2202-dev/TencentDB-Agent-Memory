# TencentDB Agent Memory 重设计 · 总方案

> 日期：2026-09（重设计启动）
> 校准前提：**`.specs` 历史文档只作「设计意图参考」，一律不作现状事实**；现状以实测为准（见 §1 证据）。
> 参照物：`my-tencentDB-Agent-memory`（早期版，功能基线）、`intent-os-platform`（Agent OS，关系与运行控制面）、`MindMemOS`（记忆 OS，算法与闭环）。

---

## 0. 一句话方案

**不再增加实体，也不再堆页面；用「契约先行 → 关系骨架 → 界面重设计 → 算法治理」四步，把已散落的实体与能力重新连成一条可验收的闭环，并用门禁脚本保证「说做完 = 真做完」。**

---

## 1. 实测诊断

### 1.0 关键反证（机械对账结论，修正前提）

与"能力退化"的直觉相反，逐文件对账（`.specs/refs/page-parity-audit.md`，383 行）显示：

| 维度 | 早期版 | 当前版 | **删除** |
|---|---|---|---|
| MemoryCore 路由 | 173 | 254 | **0**（+81） |
| MemoryPanel 路由 | 67 | 82 | **0**（+15） |
| MemoryPanel meta 白名单 | 55 | 105 | **0**（+50） |
| Core / Knowledge / Proxy 文件级 | — | — | **0** |
| 前端文件 | 181 | 234 | **82（全部在 `MemoryPanel/web/src/`）** |

**结论：后端一条接口都没少，丢失 100% 发生在前端入口层。** 当前版净增 10 个页面（代码分析/GitNexus/记忆空间/协作项目/团队 8Tab/管理后台 4 页），**整体能力是增强而非萎缩**。

所以用户"页面功能丢失严重"的感知成立，但**性质不是能力退化，而是导航重构（`agent-collab-ui-redesign`）时误删了一整页 + 两块 UI**：

| 确定丢失 | 严重度 | 性质 |
|---|---|---|
| **AnalyticsPage「线上调用情况」可观测分析页**（29 文件、2 Tab、KPI/成员/模型/trace/成本/drill-down） | 🔴 高 | **误删**：目录/路由/菜单全无，但 `lib/api/analytics.ts`(540 行)、`usePanelCapabilities.ts`、i18n 151 行、后端 16+16 条接口**全部保留** |
| 默认 Agent 模板管理 UI（2 组件） | 🟠 中 | 误删：后端 action 与 client 都在 |
| Chat_Memory L1 列表「刷新」按钮（`refreshLayer`） | 🟡 低 | 连带删除 |

> **推论**：重设计的第一动作不是"重建界面"，而是**搬回误删（成本极低、用户可感知度最高）**。详见 `07-RESTORE.md`。

### 1.1 四层脱节

除上述误删外，结构性问题是**四层各自断裂**。每条都有实测证据。

### L1 入口层断裂：有页面，没入口

| 证据 | 位置 |
|---|---|
| 6 个管理页 `group: '__hidden__'`，路由注册着但侧边栏无入口 | `constants/menu.tsx:78-81`（user_management / model_config / permissions / audit_log / team_members / team_agents） |
| `AgentsPage` / `MembersPage` 组件完整（包 `TeamManagementPanel`），路由被改成重定向 | `routes/index.tsx`：`team/members`、`team/agents` → `Navigate to="/team"` |
| `pages/codegraph/`（CodeGraphPage + GraphCanvas + FileTreePanel + ProcessesPanel）无独立路由 | 仅剩 `graph → analysis` 重定向 |

### L2 页面层断裂：有页面，没数据（骨架）

| 证据 | 位置 |
|---|---|
| 文件头自写「**骨架阶段：字段用前端类型占位，不接后端**」，界面渲染 `<Tag>骨架阶段</Tag>` | `pages/team/AgentDetailPage.tsx`（64 行） |
| 「**骨架阶段为空态，不接真实数据**」，Brain 域标签写死「待定」 | `pages/memory-space/MemorySpaceDetailPage.tsx`（36 行） |

### L3 模型层断裂：实体都在，关系断了

| 断点 | 现状 | 位置 |
|---|---|---|
| Agent ↔ Project 单值 | `AgentEntity.project_id` 单值字段 | `meta_agents` |
| 绑定关系散落 | skill/知识库/MCP 塞 JSONB + 专用表混用 | `meta_agent_fixed_assets` 等 |
| 无统一运行编译 | 各入口自拼关系，无单一深模块输出有效配置 | 无 `resolveExecutionBundle()` |
| 协作产物与记忆脱节 | Task/OKR/交付物/决策与 MemorySpace 无关系边 | — |

### L4 声明层断裂：文档说完成，代码是骨架/死代码

| 证据 | 位置 |
|---|---|
| i18n **52 个键缺失**（界面显示生键） | 活的：`team.deleteTeam.success`、`menu.desc.memory_spaces`；死的：44 个 `admin.*` |
| 重复实现（同名两套） | `pages/WorkbenchPage/` vs `pages/workbench/WorkbenchPage/`；`pages/admin/UserManagementPage.tsx`(452) vs `UserManagementPage/index.tsx`(488，未路由=死代码) |
| 类型重复声明（interface 静默合并 → 类型错位） | `lib/api/types.ts`：`Project` 在 68/94、`ProjectMember` 在 84/110、`Automation` 在 198/217 |
| 后端重复注册（请求重复处理） | `panel/http/app.ts:38` 与 `:40` 重复 `registerMemoryProxyRoutes()`；`routes/chat-memory.ts:229` 与 `:276` 重复 `/chat-memory/list-combined` |

**结论**：这四层里，**L2/L4 是"假完成"，L1 是"入口丢失"，L3 是"关系没接通"**。直接做页面重设计（阶段 P3）会继续产出骨架页 —— 现有的两个骨架页就是 UI V2 计划跳过前置门禁的产物。

---

## 2. 核心主张

1. **契约先行**：先把"前端需要什么"定义成后端可兑现的**读模型（read model）+ 命令（command）**，再做界面。UI V2 定义了 C1–C8 八道前置门禁，**一个都没做**，这就是骨架页的来源。
2. **关系骨架优先于功能门面**：F 系列功能（协作项目 9 项 / agent 10 字段）几乎全部卡在关系层 —— "挂载记忆空间"要关联表、"决策/交付物进记忆"要写入路由、"任务沉淀成剧本"要接通沉淀链。**关系不通，功能做不牢。**
3. **保留轻量内核，不做第二个 Agent OS**：TencentDB 的差异化是「多租户隔离 + L0–L3 流水线 + 轻量」，借鉴 AO/MM 只取**算法参数与关系模型**，不引入其重型运行时（Scene 执行引擎、A2A、文件态 Brain 记忆暂不引入）。
4. **声明必须可验证**：任何"已完成"都要附证据（curl / 浏览器实测 / 测试）；无证据只能标"未验证"。这是对 L4 断裂的制度性修复。
5. **界面参考早期版的"直白"，吸收 UI V2 的"关系组织"**：早期版优点＝入口直白、菜单完整、页面薄而全；缺点＝按后端模块平铺、缺一级业务对象。目标＝入口直白 + 关系组织。

---

## 3. 五阶路线（每阶独立可验收）

```
P0 搬回+止血 ─▶ P1 立契约 ─▶ P2 立关系 ─▶ P3 重设计界面 ─▶ P4 注入算法与治理
（搬回误删·修假完成）（定能力边界）（连实体关系）（参考早期版重建）（A/B/C/D/E 逐条落地）
```

| 阶段 | 目标 | 关键交付 | 验收判据 | 依赖 |
|---|---|---|---|---|
| **P0 搬回+止血** | 搬回误删、消除"假完成"、恢复入口、补安全缺口 | **① 搬回 AnalyticsPage（29 文件 + 3 处注册）② 修 `/admin/users` 缺 `AdminOnlyGuard`** ③ 搬回默认 Agent 模板 UI ④ 接线 8 个孤儿组件或删除归档 ⑤ 补 52 个 i18n 键 ⑥ 删 **3 处**重复注册 ⑦ 删死实现 + 合并双实现 ⑧ 去重 `types.ts` ⑨ 6 隐藏页/孤儿页入口决策（ADR） | Analytics 两 Tab 有真实数据；`check-i18n`/`check-routes`/`check-duplicates` 通过；`tsc`+`build` 通过；后台路由全部有守卫 | — |
| **P1 立契约** | 定义后端能力边界 | C1–C8 全部契约 + 4 个聚合读模型（ProjectWorkspace / AgentWorkspace / TaskWorkspace / GovernanceInbox）+ 记忆命令（remember/correct/forget） | 契约有 openapi/类型 + 契约测试；读模型不泄露未授权计数；无 fan-out | P0 |
| **P2 立关系** | 实体连成可查询可编译的图 | R1 Agent↔Project 多对多；R3 绑定关联表化；R4 `resolveExecutionBundle()` 统一编译；协作产物→记忆写入路由 | 关系表落地 + 迁移零回归；bundle 可解释（source_chain）；单测覆盖 | P1 |
| **P3 重设计界面** | 参考早期版重建页面 | 5 组导航 + 一级/二级页面集 + 全局上下文（URL 权威）+ 共享实体组件 | 每个页面有真实数据来源；无骨架页；浏览器回归（320/768/1024/1440 + 键盘 + URL 恢复） | P1/P2 |
| **P4 算法与治理** | 记忆算得准、管得住 | P0 算法（RRF K=60 / 检索评估 harness / embedding 缓存）→ P1 闭环（token-budget MMR / 两阶段 dreaming / implicit feedback）→ 治理（审计账本 / 质量状态机 / 评测趋势） | recall@k / MRR / nDCG 可跑；scope leakage = 0；审计四类事件齐全 | P2/P3 |

**顺序理由**：P0 让现状"不骗人"；P1 定死能力边界（否则界面必假）；P2 把关系立起来（否则功能做不牢）；P3 才做界面（参考早期版）；P4 在闭环上注入算法。

---

## 4. 门禁机制（防退化，直击 L4 断裂）

新增 `scripts/guard/` 五个脚本，进 CI 与 pre-commit：

| 门禁 | 检查 | 失败处理 |
|---|---|---|
| `check-i18n` | 代码用到的每个 `t('key')` 必须在 zh-CN/en-US 中定义 | 缺键即 fail（当前会报 52 个） |
| `check-routes` | 每个路由有菜单入口或标 `__subpage__`；每个 `pages/*` 目录被路由引用 | 孤儿页面 / 无入口路由即 fail |
| `check-duplicates` | 同名文件+目录冲突、同文件重复 route 注册、重复 interface 声明 | 即 fail |
| `check-skeleton` | main 分支禁止出现「骨架阶段 / 骨架 / placeholder 待接」等标记 | 即 fail（除非带 `// GUARD-ALLOW:` + issue 号） |
| `check-claims` | `.specs/**` 中「✅ 已落地/已完成」必须同行附证据（文件:行 / 命令 / 测试名） | 无证据即 fail |

---

## 5. 与现有 `.specs` 资产的映射（意图注入，不继承完成度）

| `.specs` 文档 | 在本次重设计中的用途 | 落到阶段 |
|---|---|---|
| `CONTEXT.md` | 术语表、技术栈、禁动清单、既有抽象索引 | 全程 |
| `memory-platform-backlog.md`（47 条） | 改进基线 A/B/C/D/E 五组 | P1–P4 |
| `intent-os-mindmemos-adoption.md`（A/R/F） | 算法参数（A1–A21）、关系改进（R1–R10）、功能（F1–F25） | P2/P4 |
| `tasks/plan.md` + `todo.md`（T1–T25 + C1–C8） | UI V2 任务分解与契约门禁 | P1/P3 |
| `agent-memory-os-ui-v2/CODE-SCAN.md` | 关系基数表、Loadout 三层、聚合契约草案 | P1/P2/P3 |
| `agent-memory-os-ui-v2/FLOWS.md` | 五条目标流程 | 流程图基线 |
| `memory-platform-capabilities-ui.md` | 平台能力 5 Tab 交互稿 | P3/P4 |
| `design-memory-isolation-m1.md` | project 一等实体 + scope 派生（表已建，前端未接） | P2 |
| `design-memory-domain-write-model.md` | Brain 域 12 类 + 写策略 + 空间路由（**代码真落地**） | P4 基线 |
| `health/2026-08-25-HEALTH.md` | 技术债清单 | P0 |
| `LESSONS.md` | 失败知识库（DEV 前必扫） | 全程 |
| `.specs/refs/intent-os-platform.md`（1946 行） | Agent OS 扫描：分层/智能体/工具/审批/场景/会话/技能/记忆/安全/观测 + 18 条借鉴 | P1–P4 |
| `.specs/refs/mindmemos.md`（1003 行） | 记忆 OS 扫描：实体/关系/架构/算法/4 张时序 + 12 条借鉴 | P2/P4 |
| `.specs/refs/page-parity-audit.md`（383 行） | 早期版对账：后端零删除、3 项误删、5 项无入口、4 类缺陷 | P0 |

---

## 6. 交付物清单（本设计包）

| 文档 | 内容 |
|---|---|
| `00-PROPOSAL.md` | 本文件：诊断、主张、路线、门禁 |
| `01-ARCHITECTURE.md` | 架构图（分层/部署/模块/依赖）+ 技术方案 |
| `02-FUNCTIONS.md` | 功能方案 + 功能图（功能域 → 页面 → 接口） |
| `03-FLOWS.md` | 流程图与调用时序图（5 条核心链路） |
| `04-SCHEMA.md` | 表设计（现状 25 表 + 新增/改造 DDL + 迁移） |
| `05-TECH-PLAN.md` | 技术方案（契约/读模型/门禁/测试/兼容） |
| `06-UI-DESIGN.md` | UI 设计（IA 5 组 + 页面集 + 早期版对照 + 组件） |
| `07-RESTORE.md` | **搬回清单**（对账结论：3 项误删 + 5 项无入口 + 4 类缺陷 + 修正版 P0） |
| `08-SCAN-FINDINGS.md` | **外部扫描结论与更正**（AO/MM 的结论、可借鉴项、对既有文档的更正回灌） |

---

## 7. 未决问题（需评审确认）

1. **`ChatMemory` 是否保留为独立资产类型**，还是降为 `MemorySpace` 的一种视图？（影响 P3 记忆中心设计）
2. **`codegraph` 页面**：恢复为独立一级入口，还是永久并入 `analysis` 的 Tab？
3. **6 个隐藏管理页**：恢复侧边栏入口，还是收敛到「设置」二级页？
4. **`meta_agent_spaces` 命名**：其 `ownerType` 有 5 种（user/team/project/agent/task），是否改名 `meta_memory_spaces` 以正名？（涉及迁移）
5. **Agent 跨 Project**：多对多后是否允许同一 Agent 在不同 Project 用不同 Prompt/模型？
6. **早期版 `AnalyticsPage`**：其能力现在散落在 `analysis` + `codeanalysis`，是恢复独立页还是并入治理组？
7. **策略放宽**：MemorySpace 写策略是否允许管理员显式放宽（需审批）？
