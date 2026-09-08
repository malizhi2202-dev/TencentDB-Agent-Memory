# REQUIREMENT: MemoryPanel UI 重构 —— Agent 协作平台

- **Change ID**: agent-collab-ui-redesign
- **关联**: `@.specs/agent-collab-ui-redesign/CHANGE.md`、`@.specs/CONTEXT.md`、`@.specs/intent-os-mindmemos-adoption.md`

---

## 用户故事

- **US-1**：作为团队用户，我想侧边栏以「协作项目」为一等入口进入项目，以便在项目内看到任务拆解、交付物、决策、OKR、规约、工作空间、挂载记忆空间，而不是现在只有一个扁平的 `projects` 列表。
- **US-2**：作为管理员，我想在 Agent 详情里配置**可见性（private/team/public）、执行环境（network_policy/approval_mode）、MCP 绑定、是否提供 API**，以便控制 agent 的暴露范围与执行能力。
- **US-3**：作为用户，我想有独立的「记忆空间」入口，以便查看某个 team/project/agent 挂载了哪些空间、每个空间承载哪个 Brain 域，而不是只在 Chat_Memory 里看内容。
- **US-4**：作为用户，我想在界面上看到记忆的「质量 / 召回评测 / 指标」入口，以便量化记忆内核的准确率，而不是只看到「召回了多少条」。
- **US-5**：作为用户，我想界面**保持现有的视觉风格**（tea + 腾讯蓝），但页面布局按协作平台重新组织、散落的内联样式收敛统一，以便摆脱「页面可真怪」的乱感而不损失熟悉感。

## 验收准则（AC）

### AC-1 · 导航信息架构重构

- **Given** 已登录进入面板
- **When** 查看侧边栏
- **Then** 侧边栏以「协作项目 / 团队 / Agent / 记忆空间」四大块为核心组织；知识资产（Wiki / Code / CodeGraph / Skill）作为「资产」降级分组；旧路由（`/wiki` `/code` `/skills` `/memory` 等）仍可通过兼容重定向访问
- **验证方式**: 手动 UAT-1（点侧边栏逐项导航）

### AC-2 · 视觉保持 + 布局重设计

- **Given** 现有视觉风格（tea-component + 腾讯蓝）保持不变
- **When** 查看任意重设计后的页面
- **Then** 颜色/字体/品牌色与现状一致（未引入新 hue、未换字体）；但页面布局按「三段式（头部→TabBar→内容区）+ 双列栅格（左主区 + 右上下文栏）」重排，散落内联样式收口到 `--tea-color-*` 别名
- **验证方式**: 手动 UAT-2（对比新旧视觉一致性 + 布局结构）；`tsc --noEmit` 通过

### AC-3 · 协作项目页面骨架

- **Given** 进入「协作项目」模块
- **When** 打开一个项目
- **Then** 项目详情页具备「任务拆解 / 交付物 / 决策 / OKR / 规约心智 / 工作空间 / 挂载记忆空间」的标签页骨架（占位 + 空态，不要求真实数据）
- **验证方式**: 手动 UAT-3

### AC-4 · Agent 配置面骨架

- **Given** 进入某个 Agent 详情
- **When** 查看配置区
- **Then** 能看到「可见性 / 执行环境 / MCP 绑定 / 是否提供 API / 绑定 skill 与知识库」的配置区骨架
- **验证方式**: 手动 UAT-4

### AC-5 · 记忆空间独立入口

- **Given** 进入「记忆空间」模块
- **When** 查看列表
- **Then** 能按 owner（team/project/agent/user）查看空间及其 Brain 域；能进入单个空间查看内容
- **验证方式**: 手动 UAT-5

### AC-6 · 旧功能不回归

- **Given** 现有页面（Wiki/Code/CodeGraph/Skill/Chat_Memory/代码分析/成员/API Keys）
- **When** 通过新导航或旧路由访问
- **Then** 页面仍能打开、原有功能不丢
- **验证方式**: 手动 UAT-6 + `npm run build` 通过

---

## 范围切分

### v1（本次必做）

- 信息架构重构（导航 + 路由 + 兼容重定向）
- 选定调性的 design tokens + 全局视觉套用
- 协作项目 / Agent 配置 / 记忆空间 / 算法评估 的页面骨架 + 空态
- 旧页面在新信息架构下的归类与保留

### v2（下一轮考虑，不本次）

- 各页面骨架接真实数据（依赖后端数据模型 change）
- 记忆质量 / 召回评测 / 指标的真实数值展示（依赖算法 change）
- 协作项目 → 记忆空间的真实写入路由（依赖断点④ change）

### out（永远不做）

- 本次不动 `MemoryCore` 内核、不做数据库迁移、不实现算法（A1–A21 召回/评测/dreaming 改进）

---

## 非功能性需求

- **性能**: 首屏 LCP ≤ 2.5s（骨架 + 空态，无重数据）
- **可访问性**: 焦点可见、`prefers-reduced-motion` 支持（沿现有 tea-component 能力）
- **安全**: 无新增敏感面（新页面沿用现有 session/RBAC 门禁）
- **兼容性**: Chrome/Edge 最新两个大版本（与现有面板一致）
- **可观测性**: 无新增埋点要求

## 依赖与假设

- 依赖现有：React 18 + Vite + tea-component + react-router(hash) + zustand + i18n（沿用，见 CONTEXT.md）
- 假设：视觉调性由用户 0.6 选定（当前待选，推荐 2 极简）
- 假设：新实体（协作项目/决策/OKR/交付物/agent 配置字段）的 UI 类型先在前端定义，后端字段对齐留待后续 change

---

> AC 是 TEST 阶段派生用例的唯一来源，禁止在 TEST 阶段引入新 AC。
