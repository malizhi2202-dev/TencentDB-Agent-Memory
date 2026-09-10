# Implementation Plan: Agent Memory OS UI V2

## Overview

将 MemoryPanel 从按后端模块平铺的管理面板，渐进重构为围绕 Project、Agent、Task、Asset 和 MemorySpace 关系组织的 Agent 协作工作台。保留现有 Tea Component 视觉体系、API 和旧路由，按垂直切片逐步替换。

## Architecture Decisions

- Project 是默认工作现场，Team 是组织边界，两者不合并。
- Agent、Task 提升为一级工作对象；资产类型降级为统一资产库筛选。
- 全局上下文统一管理 Team、Project、Agent、Task，并进入 URL。
- UI 区分权限候选、固定装配和本轮生效配置。
- 普通用户页面只展示真实业务对象；纯函数试调移至开发者诊断区。
- 旧路由先兼容后收敛，不一次性重写全部页面。

## Task List

### Phase 1: Navigation Foundation

- [ ] Task 1: 定义新路由与导航元数据
- [ ] Task 2: 建立全局上下文选择器
- [ ] Task 3: 建立共享页面与实体组件

### Checkpoint: Navigation Foundation

- [ ] 旧路由均可访问或正确重定向
- [ ] Web typecheck 与 build 通过
- [ ] 320/768/1024/1440px 主布局可用

### Phase 2: Project Workspace

- [ ] Task 4: 重构项目列表与创建抽屉
- [ ] Task 5: 建立项目工作区壳层
- [ ] Task 6: 接入项目成员与关系概览
- [ ] Task 7: 接入项目任务与 Agent 视图
- [ ] Task 8: 接入项目资产与记忆视图

### Checkpoint: Project Workspace

- [ ] Project 核心关系两次点击内可达
- [ ] Project 权限和空态行为正确
- [ ] Project 主流程浏览器验证通过

### Phase 3: Agent and Task Workspaces

- [ ] Task 9: 建立 Agent 一级列表
- [ ] Task 10: 建立 Agent 工作区壳层
- [ ] Task 11: 实现 Agent Loadout 三层视图
- [ ] Task 12: 建立任务列表与详情
- [ ] Task 13: 串联 Task、Agent、Run 与记忆

### Checkpoint: Collaboration Objects

- [ ] Agent/Task 关联导航完整
- [ ] 权限候选、固定装配、本轮生效不混淆
- [ ] 相关 API、组件和浏览器测试通过

### Phase 4: Memory Center

- [ ] Task 14: 建立记忆中心导航和筛选
- [ ] Task 15: 实现 L1 记忆浏览器
- [ ] Task 16: 实现检索试调和召回解释
- [ ] Task 17: 实现记忆详情与来源链
- [ ] Task 18: 实现 remember/correct/forget
- [ ] Task 19: 实现 MemorySpace 策略管理

### Checkpoint: Memory Center

- [ ] 记忆可浏览、检索、纠正和遗忘
- [ ] 所有操作具有 scope、来源和审计证据
- [ ] scope leakage 门禁为零

### Phase 5: Assets and Governance

- [ ] Task 20: 建立统一资产库
- [ ] Task 21: 重构资产详情与绑定关系
- [ ] Task 22: 建立审批中心
- [ ] Task 23: 建立审计与运行回放
- [ ] Task 24: 建立质量评测与趋势页
- [ ] Task 25: 收敛旧模块入口和文档

### Checkpoint: Complete

- [ ] 核心用户流程端到端通过
- [ ] Web typecheck、lint、build 通过
- [ ] 键盘和基础可访问性检查通过
- [ ] 旧路由兼容测试通过
- [ ] 产品文档和 UAT 更新完成

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 一次重写范围过大 | High | 按 Project、Agent、Memory 垂直切片，旧页面保留 |
| 后端关系仍有单值限制 | High | UI 明确显示当前能力，目标多对多使用适配层和阶段性禁用态 |
| 全局上下文造成隐式过滤 | Medium | URL 显式保存，页面顶部展示当前作用域并支持清除 |
| 资产库合并后专业功能被弱化 | Medium | 统一列表，类型详情仍保留 Wiki/CodeGraph/Skill 专属工作台 |
| 权限、绑定、召回再次混淆 | High | 三层固定术语和独立 UI 区块，不复用同一个“绑定”标签 |
| 现有路由和收藏链接失效 | Medium | 保留 redirect 表并加入浏览器回归测试 |

## Open Questions

- Agent ↔ Project 多对多后，是否允许同一 Agent 在不同 Project 使用不同 Prompt 和模型？
- Task 是否需要成为强制上下文，还是允许 Project 级无 Task 会话？
- ChatMemory 是否继续作为独立资产类型，还是仅作为 MemorySpace 的一种展示？
- 普通用户是否可以创建 Team 公共资产，还是必须走审批？


## Code-Scan Amendment: Contract Alignment Gate

以下工作必须在对应 UI 切片前完成，详细证据见 `.specs/agent-memory-os-ui-v2/CODE-SCAN.md`：

- [ ] **C1** 补齐 Agent/Task 的 Project 前端字段
- [ ] **C2** 修复 Task 筛选透传与缓存键
- [ ] **C3** 定义并实现 ProjectWorkspace 聚合契约
- [ ] **C4** 定义 ExecutionBundle V2 契约
- [ ] **C5** 定义 MemorySpace 管理命令
- [ ] **C6** 定义显式记忆操作命令
- [ ] **C7** 定义 Run/审批的 Project 归属策略
- [ ] **C8** 定义持久化评测模型

依赖关系：

- Task 2 依赖 URL 上下文规则，Zustand 仅缓存默认值；
- Task 4/6 依赖 C3，禁止浏览器按项目逐项 fan-out；
- Task 7/9/12 依赖 C1/C2；
- Task 11 的“本轮生效”依赖 C4；
- Task 13/23 依赖 C7；
- Task 18/19 分别依赖 C6/C5；
- Task 24 依赖 C8；未完成前即时 evaluator 只保留在开发者诊断区。

新增风险：

| Risk | Impact | Mitigation |
|---|---|---|
| Project 首屏请求 fan-out | High | Panel 提供 caller-aware 聚合 read model，详情继续分页 |
| 动态详情页被 PageId 页签覆盖 | Medium | 以 routeId + entityId 标识，或取消实体详情多页签 |
| 筛选缓存返回错误页面 | High | Task 缓存键包含全部筛选条件并完整透传 |
| 纯函数能力被误包装为产品功能 | High | feedback/eval/lifecycle 试调只放开发者诊断区 |
| Project 归属靠前端猜测 | High | Run/审批短期经 Task 聚合，长期字段方案先 ADR 后迁移 |

新增待决策问题：

- Agent 从一个 Project 迁移到另一个 Project 是否允许，是否需要审计和影响预览？
- RunTrace/WriteApproval 是否冗余存储 `project_id`，还是永远通过 Task/Agent 解析？
- ExecutionBundle 是仅按需解析，还是每次 Run 都持久化不可变快照？
- MemorySpace 策略只能收紧，还是管理员可以显式放宽并走审批？
