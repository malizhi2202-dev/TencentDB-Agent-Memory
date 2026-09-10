# 重设计 · 搬回清单（对账结论落地）

> 依据：`.specs/refs/page-parity-audit.md`（383 行机械对账，含复现命令）。
> 结论一句话：**后端一条接口都没少，丢失 100% 发生在 `MemoryPanel/web/src/` —— 是前端入口层的误删，不是能力退化。**

---

## 0. 对账硬事实

| 维度 | 早期版 | 当前版 | 删除 | 新增 |
|---|---|---|---|---|
| MemoryCore 路由 | 173 | **254** | **0** | +81 |
| MemoryPanel 路由 | 67 | **82** | **0** | +15 |
| MemoryPanel meta 白名单 | 55 | **105** | **0** | +50 |
| MemoryCore / Knowledge / Proxy 文件级 | — | — | **0** | 大量 |
| 前端文件 | 181 | 234 | **82（全部在 `MemoryPanel/web/src/`）** | — |
| 前端页面 | 10 个已注册 | **20 个真实路由** + 5 重定向 | 3 项 | +10 |

**校正后的判断**：用户"丢失严重"的**感知成立**，但**范围被高估** —— 当前版整体能力是**增强**（净增 10 页：代码分析/GitNexus/记忆空间/协作项目/团队 8Tab/管理后台 4 页），真正丢的是**一个整页 + 两块 UI + 一个按钮**。

---

## 1. 确定丢失（3 项，按严重度）

### 1.1 🔴 AnalyticsPage「线上调用情况」可观测分析页 —— **误删**

| 项 | 状态 |
|---|---|
| 页面 | 早期版 29 文件（`components`/`hooks`/`styles`/`utils`/`index.tsx`），2 Tab，含 KPI / 成员 / 模型 / trace / 成本 / drill-down |
| 当前版 | **目录不存在**；`routes/index.tsx` 未注册；`menu.tsx` 的 `PageId` 已删 `'analytics'`；`ConsoleLayout` 删了三层可见性判定 |
| **周边设施（全在）** | ✅ `lib/api/analytics.ts` **540 行**；✅ `services/usePanelCapabilities.ts` **76 行**；✅ i18n `analytics.*` **151 行**；✅ 后端 `/api/v1/analytics/*` **16 条**（`routes/analytics/proxy.ts:65-66`）+ `/v3/analytics/*` **16 条**（`analytics-router.ts:78-93`） |
| 定性 | **误删**：`.specs/agent-collab-ui-redesign/CHANGE.md` 从未提及删 analytics，且周边设施 100% 保留 |

**搬回步骤（后端零改动）**：

```
1. 拷目录：my-tencentDB-Agent-memory/MemoryPanel/web/src/pages/AnalyticsPage
        → TencentDB-Agent-Memory/MemoryPanel/web/src/pages/analytics/
2. routes/index.tsx   注册 { path: 'analytics', element: <AnalyticsPage /> }
3. constants/menu.tsx  PageId 加回 'analytics'，恢复 observability 分组入口
4. ConsoleLayout.tsx   恢复 usePanelAnalyticsEnabled / useAnalyticsChConfigured 三层可见性判定
                       （这会让当前成为孤儿的 usePanelCapabilities.ts 重新有用）
5. 验证：tsc --noEmit + vite build + 浏览器实测 /analytics 两 Tab 有真实数据
```

**备选方案**（若确认要下线）：删除 `lib/api/analytics.ts`、`usePanelCapabilities.ts`、i18n 151 行、后端 analytics 代理 16 条 + 内核 16 条。**但证据指向误删，建议搬回。**

### 1.2 🟠 默认 Agent 模板管理 UI —— 误删

| 项 | 状态 |
|---|---|
| 丢失 | `components/team/DefaultAgentTemplateSection.tsx`、`DefaultAgentTemplateDialog.tsx` |
| 后端（在） | `meta-actions.ts:61-62` 白名单（`agent/get-default-template`、`agent/set-default-template`）+ `routes/meta/proxy.ts:186,198` 专门逻辑 |
| 前端 client（在） | `lib/api/agents.ts:191,198`，**0 调用点** |

**搬回步骤**：拷回两个组件（路径适配 `pages/team/components/`），在 `TeamManagementPanel` 的 AgentGrid 上方按 `isAdmin` 渲染。后端与 client 零改动。

### 1.3 🟡 Chat_Memory L1 层列表「刷新」按钮 —— 连带删除

`refreshLayer` hook 与调用点一起被删（`grep -rn refreshLayer` 全仓 **0 命中**）。早期版在 `useChatMemory.ts:589`。

**搬回步骤**：恢复 `refreshLayer` 并以 `onRefresh` 传入 L1 层列表。

---

## 2. 后端有、前端无入口（5 项，按价值）

| # | 能力 | 后端证据 | 前端现状 | 严重度 |
|---|---|---|---|---|
| 1 | **analytics 16 action** | `analytics/proxy.ts:65-66` + 内核 16 条 | 整页消失（见 §1.1） | 🔴 高 |
| 2 | **默认 Agent 模板 2 action** | `meta-actions.ts:61-62` | UI 被删（见 §1.2） | 🟠 中 |
| 3 | **代码图谱引擎 8 只读 + GitNexus 17 工具** | `code-graph-routes.ts:273,290,323,355-362`；`gitnexus-routes.ts:43` | **8 个组件 802 行已写好但 0 引用**；`CodeGraphPage` 只装配 6 项 | 🟠 中 |
| 4 | **记忆能力 4 条** | `approval/resolve-level`、`approval/authorize-decision`、`execution-bundle/resolve`、`review/approve-or-reject` | 前 2 条连 client 方法都没有；后 2 条有方法但 0 UI 调用点 | 🟡 低 |
| 5 | **LLM 模型发现 3 条** | `server.ts:1415,1421,1427`（`GET /v3/llm/{providers,models}`、`POST /v3/llm/models/discover`） | 前端**无任何 client**（`grep -rn '/v3/llm' web/src` 无命中）；`ModelConfigPage` 只配静态字段 | 🟡 低 |

### 2.1 第 3 项的接线清单（已写一半，802 行闲置）

| 组件 | 功能 | 目标装配位置 |
|---|---|---|
| `NexusChatPanel` | GitNexus 对话（F1） | `CodeGraphPage` |
| `ProcessesPanel` + `ProcessFlowModal` | 流程视图（F2） | `CodeGraphPage` |
| `CodeInspector` | 代码检视（F3） | `CodeGraphPage` |
| `CodeReferencesPanel` | 引用面板（F4） | `CodeGraphPage` |
| `QueryFAB` | 查询浮钮（F5） | `CodeGraphPage` |
| `NodeTypeLegend` | 节点类型图例（F6） | `CodeGraphPage` |

> `restore-analysis-features` change 只写了组件没接线（`CHANGE.md` 阶段）。二选一：**接线**，或**删除组件 + 归档该 change**（避免继续误导为"已完成"）。

---

## 3. 假 UI 复核（澄清，非新增）

对账确认：**没有「后端彻底不存在、前端却在正常发请求」的活动假 UI**。三个骨架页是有意占位（`CHANGE.md` 明确"范围排除：本次交付骨架 + 样式"）：

| 入口 | 后端 | 判定 |
|---|---|---|
| `/memory-spaces/:spaceId` | 只有 `space/list` 只读，**无 `space/get`** | ⚠️ 骨架（可点进去永远空） |
| `/team/agents/:id` | `agent/get` 存在但页面**未调用** | ⚠️ 骨架（4 Tab 占位文案） |
| 项目详情「记忆空间」Tab | 无项目级空间接口 | ⚠️ 骨架 |
| `environmentBindingsApi` | 两版后端都无 `/users` 路由 | ⚠️ 死 client（**0 UI 调用点**，两版皆有，非本次回归） |

结论：骨架页是**决策产物**，不是谎报；但 `check-skeleton` 门禁要求它们**不得静默留在 main**，必须挂 issue 追踪。

---

## 4. 顺带发现的可修缺陷（4 类）

| # | 缺陷 | 证据 | 处置 |
|---|---|---|---|
| 1 | **`/admin/users` 缺 `AdminOnlyGuard`** —— 4 个后台路由里唯一没套守卫的，页面内部也无角色判定 | `routes/index.tsx:59` | 🔴 立即修（安全） |
| 2 | **重复路由注册 3 处**（我此前只发现 2 处） | `app.ts:38/40` memory 代理；`chat-memory.ts:228/275` list-combined；**`code-graph-routes.ts:290/323` engine/tree** | 删重复 |
| 3 | **23 个死模块** | 含 `pages/admin/UserManagementPage/index.tsx`（488 行，被同名 `.tsx` 遮蔽）；`components/asset/*` 与 `pages/ResourcePage/components/*` **三对重复** | 清理 |
| 4 | **两份 API 文档严重滞后** | `v3-api-memorycore-doc.md` 与 `panel-api-doc.md` 两版 **md5 完全相同**；文档称 108 接口 vs 实现 **254 条** → **104 条已实现未文档化** | 🔴 **文档不能作为能力证据**（这正是"说做完实际没有"的另一面） |

---

## 5. 综合优先级（修正版 P0）

把搬回并入 P0，因为它**成本最低、用户可感知度最高**：

| 序 | 动作 | 成本 | 收益 |
|---|---|---|---|
| 1 | **搬回 AnalyticsPage** | 29 文件 + 3 处注册 | 🔴 恢复一个完整功能页（用户最能感知） |
| 2 | **修 `/admin/users` 缺守卫** | 1 行 | 🔴 安全 |
| 3 | 搬回默认 Agent 模板 UI | 2 组件 | 🟠 |
| 4 | 接线 8 个孤儿组件（或删除+归档） | 装配 6 处 | 🟠 |
| 5 | 补 52 个 i18n 键 | — | 🟠 消除生键 |
| 6 | 删 3 处重复注册 | — | 🟠 |
| 7 | 删死实现 `UserManagementPage/index.tsx` + 合并两套 Workbench | — | 🟡 |
| 8 | 去重 `types.ts` 三处 interface | — | 🟡 |
| 9 | 恢复 `refreshLayer` 按钮 | — | 🟡 |
| 10 | 6 隐藏页 / 孤儿页入口决策（记 ADR） | — | 🟡 |
| 11 | 5 个门禁脚本 + baseline | — | 🟢 防回归 |
| 12 | 文档对齐（104 条未文档化接口）或明确标注"文档滞后" | — | 🟢 |

---

## 6. 对重设计方案的修正

| 原判断 | 修正后 |
|---|---|
| "功能丢失严重，需大规模重设计" | **丢失范围有限（3 项，1 项重大）；重设计的重点是「先搬回、再补齐契约、后重排界面」** |
| P0 = 止血（修生键/重复/骨架） | P0 = **搬回 + 止血**（搬回优先级更高，因成本极低且用户可感知） |
| "界面参考早期版重设计" | **早期版是"功能基线"而非"代码基线"**：Analytics 整页直接搬回即可，不需要重设计；其余页面按新 IA 重排 |
| 文档可作为设计输入 | **文档只作意图参考**（md5 相同但滞后 104 条接口，已证实） |

> **注**：两仓**无共享 git 历史**（`merge-base` 失败），且早期版 tip 提交时间（2026-09-10）**晚于**当前版（2026-09-09），"谁是更早版本"在 git 层面**无法证实**。但"早期版后端是当前版的严格子集"这一机械事实已确认。
