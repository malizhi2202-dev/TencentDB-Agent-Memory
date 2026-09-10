# Agent Memory OS UI V2 Tasks

## Phase 1 — Navigation and Context

- [ ] **T1** 导航与路由：新增工作/协作/知识记忆/组织/治理五组，旧 URL 兼容；验收：`tsc --noEmit`、`npm run build`、旧路由浏览器回归。
- [ ] **T2** 全局上下文：Team/Project/Agent/Task 级联选择，URL + Zustand 持久化；验收：刷新、前进后退、无权限对象均有正确状态。
- [ ] **T3** 共享实体组件：PageHeader、FilterBar、EntityLink、RelationshipDrawer、loading/empty/error/denied 状态；验收：键盘可操作，支持 Project/Agent/Task/Asset/Memory。

### Checkpoint 1

- [ ] 五组导航可用，旧路由无 404。
- [ ] 320/768/1024/1440px 主布局可用。
- [ ] Web typecheck/build 通过。

## Phase 2 — Project Workspace

- [ ] **T4** 项目列表与创建抽屉：我负责/我参与/团队公开视图，展示成员/Agent/任务/资产摘要。
- [ ] **T5** 项目工作区壳层：概览、任务、Agent、资产、记忆、决策交付、运行、设置二级导航。
- [ ] **T6** 项目关系概览：真实成员、Agent、Task、Asset、MemorySpace、Run 摘要及下钻。
- [ ] **T7** 项目任务与 Agent：双向导航、状态筛选、项目角色展示。
- [ ] **T8** 项目资产与记忆：按类型/owner/visibility 和 layer/domain/space 筛选，拒绝泄露未授权对象。

### Checkpoint 2

- [ ] Project 核心关联对象两次点击内可达。
- [ ] 跨 Team Project 成员与权限行为正确。
- [ ] Project 主流程浏览器验证通过。

## Phase 3 — Agent and Task

- [ ] **T9** Agent 一级列表：Team/Project/owner/status 筛选，显示资产、空间、Run、审批摘要。
- [ ] **T10** Agent 工作区：概览、项目、任务运行、装配、记忆、策略、版本。
- [ ] **T11** Agent Loadout 三层视图：可访问、固定绑定、本次 ExecutionBundle 生效。
- [ ] **T12** 全局任务列表与详情：列表/看板、Project/Agent/状态/风险筛选。
- [ ] **T13** Task 关系链：串联 Agent、Run、交付物、决策和来源记忆。

### Checkpoint 3

- [ ] Agent/Task/Run/Memory 关联导航完整。
- [ ] 权限候选、固定装配、本轮生效不混淆。
- [ ] 相关 API、组件和浏览器测试通过。

## Phase 4 — Memory Center

- [ ] **T14** 记忆中心：合并 ChatMemory 与 MemorySpace，统一 Team/Project/Agent/Task/User 作用域。
- [ ] **T15** L1 浏览器：真实分页、domain/write policy/space/owner 筛选、详情入口。
- [ ] **T16** 检索试调：展示 score、scope、来源、Retention/召回理由和低分结果。
- [ ] **T17** 记忆详情：L0-L3、来源 Conversation/Task/Run、lineage、版本、使用 Agent。
- [ ] **T18** remember/correct/forget：显式来源、版本化纠正、可审计遗忘、策略门。
- [ ] **T19** MemorySpace 策略：owner × domain × write policy、挂载 Agent、数量和策略收紧。

### Checkpoint 4

- [ ] 记忆可浏览、检索、纠正和遗忘。
- [ ] 所有操作具有 scope、来源和审计证据。
- [ ] scope leakage 门禁为零。

## Phase 5 — Assets and Governance

- [ ] **T20** 统一资产库：Skill/Wiki/CodeGraph/ChatMemory 类型筛选，保留专属入口。
- [ ] **T21** 资产详情与绑定：ACL、Project、Agent、版本和使用关系。
- [ ] **T22** 审批中心：写入、冲突、风险操作队列，显示变更和影响。
- [ ] **T23** 审计与运行回放：actor/对象/动作/时间/Project 筛选，跳转对象与 Run。
- [ ] **T24** 质量评测趋势：评测集、recall@k、MRR、nDCG、scope leakage 和历史回归。
- [ ] **T25** 旧入口收敛：兼容壳、文档、UAT，去除“骨架阶段”等内部文案。

### Checkpoint 5

- [ ] 核心用户流程端到端通过。
- [ ] Web typecheck、lint、build 通过。
- [ ] 键盘、响应式和旧路由回归通过。
- [ ] 产品文档和 UAT 更新完成。


## Code-Scan Gate — Must Precede Related UI Tasks

- [ ] **C1** Agent/Task Project 字段：`agentsApi.create/update`、`tasksApi.BackendTask/create` 暴露 `project_id`；Task 是否允许迁移 Project 单独决策。依赖任务：T7、T9、T12。
- [ ] **C2** Task 查询缓存：`fetchTasks` 透传 `agent_id/project_id/creator_user_id`，缓存键包含全部筛选条件。依赖任务：T7、T12。
- [ ] **C3** ProjectWorkspace read model：新增 caller-aware overview 聚合，返回 viewer、counts、recent、warnings，不泄露未授权计数。依赖任务：T4、T6。
- [ ] **C4** ExecutionBundle V2：定义 assets、versions、policy decisions、source chain、resolvedAt；Run 回放是否持久化 bundle 快照另行决策。依赖任务：T11。
- [ ] **C5** MemorySpace 命令：定义详情、mount/unmount、policy tighten 与影响预览；策略放宽必须单独授权。依赖任务：T19。
- [ ] **C6** 显式记忆命令：定义 remember/correct/forget，携带 actor、source、scope、version 并写审计。依赖任务：T18。
- [ ] **C7** Project Run/审批归属：短期按 Task 关联聚合，评估 `project_id` schema 扩展并记录 ADR。依赖任务：T13、T23。
- [ ] **C8** 评测持久化：定义 EvalSuite、EvalCase、EvalRun 和趋势查询；现有即时 evaluator 只归开发者诊断。依赖任务：T24。

### Additional Acceptance Gates

- [ ] T1 用路由元数据替换静态前缀识别，动态实体页拥有稳定 route id。
- [ ] T2 以 URL 为上下文权威；刷新、前进后退和分享链接可恢复。
- [ ] T4/T6 不在浏览器逐项目或逐实体 fan-out。
- [ ] T11 在 C4 未完成前，将第三层明确标为“有限预览”，不得称为完整本轮配置。
- [ ] T23 的 Project 筛选遵循 C7，禁止通过前端猜测制造错误归属。
- [ ] T24 在 C8 未完成前不展示伪造趋势。
