# 记忆能力三层接线计划（API + 服务 + UI）

> 背景：三平台比对新增的 21 个 `core/record/*` 模块里，只有 memory-space 被服务层引用、
> redaction/guardrail/retention/archive 已接进自动机制；其余 feedback/审批/剧本/质量/评测/指标等
> 全是「孤立库函数」，既无 HTTP API 也无前端 UI —— 界面（MemoryPanel 5174）零体现。
> 本文定义把它们全部三层接线的方案。后续每层 vitest 验证。

## 0. 接口形态（已核实，全部纯函数/状态机）

| 模块 | 关键导出 | 副作用 |
|---|---|---|
| feedback | `feedbackToAction` / `isUserExplicitSignal` | 无 |
| feedback-detection | `detectFeedbackSignal` / `hasFeedbackSignal` | 无 |
| review-approval | `reviewGate` / `canApprove` / `approveOrReject` | 无 |
| approval-policy | `resolveApprovalLevel` / `needsApproval` / `authorizeDecision` | 无 |
| playbook | `assemblePlaybook` / `groupKeyForWorkMemory` | 无 |
| playbook-synthesis | `synthesizePlaybooks` | 无 |
| scene-executable | `checkSceneReadiness` / `publishScene` / `validateForm` | 无 |
| memory-quality | `transitionQuality` / `qualityRecallable` / `qualityWritable` | 无 |
| retrieval-evaluator | `evaluateRetrieval` / `passesThreshold` | 无 |
| consolidation-metrics | `aggregateConsolidation` / `emptyConsolidationMetrics` | 无 |
| consolidation-executor | `executeConsolidation`(async) / `rowToMemoryRecord` | 有（写回） |
| dreaming | `runDreamingConsolidation` | 无 |
| execution-bundle | `resolveExecutionBundle` | 无 |
| memory-lifecycle | `decideLifecycleAction` / `detectRelationByOverlap` / `isLowValue` | 无 |
| skill-version | `transitionSkillVersion` / `isSkillUsable` | 无 |

## 1. 后端 API 层 —— 新建 `/v3/memory/*` router

新建 `MemoryCore/src/gateway/v3-memory-router.ts`，镜像 `v3-meta-router` 的 `bind()` 模式
（Zod 校验 + successEnvelope/errorEnvelope），全部 POST，前缀 `/v3/memory`。
纯计算端点：输入从 body 传、输出返回 JSON；`consolidation/execute` 走 `IMemoryStore` 读写。

| 端点 | 库函数 | 说明 |
|---|---|---|
| `/feedback/detect` | detectFeedbackSignal | 文本反馈信号检测 |
| `/feedback/decide` | feedbackToAction | 反馈→动作决策 |
| `/review/gate` | reviewGate | 审批门 |
| `/approval/needs` | needsApproval | 是否需要审批 |
| `/playbook/assemble` | assemblePlaybook | 组装剧本 |
| `/playbook/synthesize` | synthesizePlaybooks | 从记忆合成剧本 |
| `/scene/readiness` | checkSceneReadiness | 场景就绪检查 |
| `/scene/publish` | publishScene | 发布为可执行场景 |
| `/scene/validate` | validateForm | 表单校验 |
| `/quality/transition` | transitionQuality | 质量状态转移 |
| `/eval/retrieval` | evaluateRetrieval | 召回评测指标 |
| `/metrics/consolidation` | aggregateConsolidation | 巩固指标聚合 |
| `/dreaming/run` | runDreamingConsolidation | 离线巩固计划 |
| `/consolidation/execute` | executeConsolidation | 巩固执行（读写 L1） |
| `/execution-bundle/resolve` | resolveExecutionBundle | 执行包解析 |
| `/lifecycle/decide` | decideLifecycleAction | 生命周期决策 |
| `/skill-version/transition` | transitionSkillVersion | 技能版本状态机 |
| `/space/list` | (读 meta_agent_spaces) | 记忆空间挂载清单 |

挂载：`gateway/server.ts` 在 v3-meta 之后加 `pathname.startsWith("/v3/memory/")` 分支。
测试：`v3-memory-router.test.ts`（每个端点：正常 + 参数校验失败）。

## 2. 前端增强（现有页面加面板/Tab）

新增 API 客户端 `MemoryPanel/web/src/lib/api/memory.ts`（基于 `api/base.ts` 的现有封装）。

| 页面 | 增强 | 调用的端点 |
|---|---|---|
| `/memory` ChatMemoryPage | 记忆条目加「对错反馈」按钮 → detect + decide | feedback/* |
| `/team/agents` AgentsPage | agent 详情加「记忆空间」面板 | space/list |
| `/workbench` WorkbenchPage | 加「记忆健康」面板：质量分布 + 召回评测 + 巩固指标 | quality/transition、eval/retrieval、metrics/consolidation |
| `/skills` SkillsPage | 加「剧本/可执行场景」Tab + 技能版本状态 | playbook/*、scene/*、skill-version/transition |
| `/workbench`（新 Tab：治理） | 审批门 + 生命周期决策 + 执行包解析 | review/gate、approval/needs、lifecycle/decide、execution-bundle/resolve、dreaming/run |

## 3. 实现顺序

1. **后端 router + 测试**（纯计算端点先行，`consolidation/execute`/`space/list` 依赖 store）
2. **gateway 挂载 + 冒烟**
3. **前端 API 客户端 + 页面增强**（记忆反馈 → 记忆空间 → workbench 面板 → skills 剧本/场景）
4. 全量 vitest + web 构建校验

## 4. 边界 / 不做

- 不改既有自动机制（redaction/guardrail/retention/archive）——它们已接线且背后静默运行。
- `consolidation/execute` 只做「L1 批处理巩固」的最小落库，不引入新的 LLM 调用（LLM 由既有 pipeline 负责）。
- 前端做「增强」不重写页面；新 UI 一律复用现有 `api/base.ts` 封装与 i18n 风格。

---

## 5. 实现状态（已完成，端到端验证）

### 5.1 后端 API 层 ✅
- `MemoryCore/src/gateway/v3-memory-router.ts`：23 个端点（21 纯计算 + consolidation/execute + space/list）。
- `MemoryCore/src/gateway/v3-memory-router.test.ts`：24 个测试，全绿。
- `MemoryCore/src/gateway/server.ts`：挂载 `/v3/memory/*` 分支（Bearer apiKey 同 /v3/meta）。
- 全量 MemoryCore vitest：**225 passed**（原 201 + 24 新增）。

### 5.2 面板后端代理 ✅（`MemoryPanel/src/panel/`）
- `api/memory-actions.ts`（23 action 白名单）
- `kernel/ports/memory-kernel-port.ts` + `kernel/adapters/fetch-memory-kernel-adapter.ts`
- `http/routes/memory/proxy.ts`（POST `/api/v1/memory/*` → gateway `/v3/memory/*`）
- `panel-deps.ts`（装配 memoryKernel）+ `http/app.ts`（注册路由）
- `npx tsc --noEmit`：本交付文件零错误（残留 5 个错误是他人 code-graph 文件的既有问题）。

### 5.3 前端 API + 页面 ✅（`MemoryPanel/web/`）
- `web/src/lib/api/memory.ts`：23 个类型化封装（`memoryCall` → `/api/v1/memory/{action}`）。
- `web/src/pages/workbench/WorkbenchPage/components/MemoryCapabilitiesPanel.tsx`：
  5 个 Tab（记忆空间 / 反馈回路 / 治理 / 资产沉淀 / 监控评测），直调内核展示真实计算结果。
- 挂载到 `WorkbenchPage`（首页）。
- `npx tsc --noEmit`：零错误。

### 5.4 端到端验证 ✅
- `GET /health` → ok。
- `POST /v3/memory/feedback/detect` → `{detected:true, signal:"correction"}`。
- `POST /v3/memory/quality/transition`、`/eval/retrieval`、`/space/list` → code 0。
- `POST /api/v1/memory/feedback/detect`（面板代理）→ 同结果。
- `POST /v3/memory/execution-bundle/resolve` → 12 个挂载空间（agent 4 + team 4 + user 2 + project 2）。

### 5.5 深度集成（已完成）✅
- **AgentsPage 记忆空间徽章**：`useAgentSpaceCounts`（`useAgentAssets.ts`）批量并发查各 agent 的 `space/list`；`AgentGrid.tsx` 卡片/列表视图均新增 `memory_spaces` 计数 chip。
- **ChatMemoryPage 反馈按钮**：`BlockDetail.tsx` 的 L1 条目三点菜单新增「反馈：标记正确 / 需纠正」，直调 `feedback/decide` 并 toast 决策结果。
- **前端 i18n**：`MemoryCapabilitiesPanel.tsx` 文案全部进 `zh-CN.ts` / `en-US.ts`（`memoryCap.*` 21 key + `memory.feedback.*` 6 key）。
- `tsc --noEmit`：MemoryPanel web 零错误。

### 5.6 端到端落库验证 ✅
- 创建 agent → `space/list` 返回 **10 个挂载空间**（agent4 + team4 + user2，无 project_id 故无 project 空间），证明「记忆空间」真实落库、`AgentGrid` 徽章显示真实数据。
- 测试 agent 已删除清理。