# 当前设计交付：组织、工作、资源与治理

> **当前唯一入口**：`PLATFORM-POSITIONING.md`、`DOMAIN-MODEL.md`、`PRODUCT-DESIGN.md`、`DECISIONS.md`、`product-prototype.html`。本目录是当前收敛设计；`.specs` 中其他目录仅保留为历史参考，不作为当前产品入口。
>
> **定位优先级**：先阅读 `PLATFORM-POSITIONING.md`。TencentDB Agent Memory 是供 Codex、Claude Code、DSH 等外部 Harness 接入的 Memory Platform，不是新的 Agent Harness 或编排运行时。

## 1. 一句话模型

```text
Platform 管理公共配置与发布目录
Team 管理成员、团队共享资源、默认规则，并拥有 Project
Project 管理具体工作、项目资源与使用上下文
Task 是可验收目标；Run 是该目标的一次执行尝试
```

## 2. 最终对象关系

```text
User ── TeamMember ── Team ── owns (1:N) ── Project ── contains ── Task ── has ── Run
                                  │                    │
                                  │                    └── Project scope resources
                                  └── Team scope resources

Agent ── AgentTeam / AgentProject ── Team / Project
       └── 在关联范围内 view / use 已获准能力；不管理关联、策略、成员或配置
```

- 每个 Project 有且只有一个 owning Team；Project 不能同时加入多个 Team。
- Team 可以创建和关联多个 Project；Project 转移 Team 是受控的所有权迁移，而不是“解除 Team 关联”。
- `open` Project 向 owning Team 成员授予日常项目协作入口；敏感资源 CRUD、治理审批、策略、成员、关联和删除仍须独立检查。
- `restricted` Project 只依据 ProjectMember / ACL 的显式授权开放。

## 3. 资源归属与公共范围

每个资源有唯一 owner；`visibility`、ACL、引用和挂载只决定可发现、查看或使用范围，**不改变 owner，也不自动授予编辑、删除、发布或权限管理权。**

| 资源 | User / Team / Project 独有版本 | 平台公共版本 | 使用规则 |
|---|---|---|---|
| Memory | 支持；Agent 也可拥有专属 Memory | **不支持** | 跨范围复用必须经分诊、脱敏、审核，发布为受控 Wiki、Skill 或 Template。 |
| Wiki | 支持 | 支持，owner 为 Platform | 平台版只读或按策略使用；Team/Project/User 版默认 scope 内可见。 |
| Code | 支持，记录 source + revision | 不复制为公共 Code | 通过源仓库权限和固定 revision 共享。 |
| Skill | 支持 | 支持，owner 为 Platform | 公共 Skill 可发现/使用；定制时复制或派生到目标 scope。 |
| Template | 支持 | 支持，owner 为 Platform | 引用固定版本；可显式复制/派生，绝不默认持续同步。 |

没有“泛化资源库”或 Asset 真源。Memory、Wiki、Code、Skills、Templates 均是独立的专业页面与数据模型。

## 4. 权限模型

```text
Effective permission = credential scope
                     ∩ scope membership / binding grant
                     ∩ resource ACL
                     ∩ Team / Project policy
                     ∩ action policy
                     ∩ delegation / RunGate（如适用）
```

| 层级 | 管理范围 | 典型权限 |
|---|---|---|
| Platform | 用户、公共模型、公开 Wiki/Skill/Template 目录、系统策略、审计 | Platform Admin |
| Team | Team 成员、Team 资源、默认规则、拥有的 Project | Team Owner / Team Member + resource grant |
| Project | Task、Project 成员、Project 资源、Agent 使用上下文、模板引用 | Team Owner / Project Admin / Project Member + resource grant |
| Resource | 单个 Memory、Wiki、Code、Skill、Template | view / create / update / delete / publish 等显式操作 |
| Agent binding | Agent-Team / Agent-Project 关联范围 | view / use 已获准能力；不含关联、策略、成员或配置变更 |

Team 或 Project 成员身份不等于资源 CRUD。成员只有被分配相应的 Resource Permission 后，才能对 Memory、Wiki、Code、Skill、Template 执行 `view / create / update / delete`。Project 可在 Team 默认规则上进一步收紧，永远不得放宽或绕过 Platform / Team 上级限制。

## 5. 各对象的职责

### Team

Team 是组织和共享协作层。可查看本 Team 的 Agent、Task 聚合、成员、拥有的 Project 与 Team scope 资源。

- 创建者成为 Team Owner。
- Team Owner 可添加/移除成员、管理 Team 资源和默认规则、创建/关联 Project、发起 Project 转移、归档或申请永久删除 Project。
- “从 Team 移除 Project”不是有效操作：Project 必须始终有一个 owning Team。
- 其他成员按被授予的资源权限操作 Team scope 的 Memory、Wiki、Code、Skill、Template。

### Project

Project 是具体协作与使用上下文，且仅属于一个 Team。可查看自己的 Task、Agent、成员、资源、已引用模板、接入记录和版本/变更。

- Team Owner 或 Project Admin 管理 Project 成员、Project scope 资源权限与 Agent 使用上下文。
- Project 成员的资源 CRUD 必须由显式资源权限授予。
- `open` 只授予 owning Team 成员的日常协作入口，不能绕过资源 ACL、变更审核、RunGate、成员/策略/关联管理或删除保护。

### Agent

Agent 是可版本化执行配置，可以是 private、Team-visible、Project-visible 或 public-discoverable；它可关联多个 Team 和多个 Project。

- 关联授予 Agent 在对应 scope 内**查看与使用**已获准的模型、工具、技能、记忆和上下文。
- 关联不授予 Agent 修改 Team、Project、成员、关系、策略或自身配置的权力。
- Agent 的详情页包括：概览、系统提示词、运行参数、工具、技能、钩子、记忆、密钥保险柜、定时任务，以及关联范围和运行证据。
- Vault 只显示密钥引用、scope、轮换/撤销状态；永不回显密钥明文。

### User 与公共模型配置

- 用户可独立创建，创建时可选加入 Team，也可之后再加入一个或多个 Team。
- 用户管理以列表提供创建、查看、编辑、禁用、Team 关联、Key 撤销/轮换等管理动作。
- 创建 API Key 时仅展示一次；系统仅保存哈希/指纹、scope、期限、最后使用时间和撤销状态。离开创建结果后不能回显旧 Key，只能重新生成。
- 公共模型配置是 Platform 管理对象：Provider、Model、Endpoint/region、Vault credential reference、默认运行参数、可用 Team/Project、配额和健康状态。模型密钥不复制到 Agent；Agent 只选择被允许的模型配置。

## 6. 模板、接入与变更

### 模板库：Team 为主，Project 消费

```text
Platform Template ──可发现/按策略使用──┐
Team Template ──────锁定版本引用───────┼── Project referenced template
Project Template ───项目专用/派生───────┘
User Template ──────个人复用
```

- Team 沉淀 AgentTemplate 和 ProcedureTemplate；Project 显示其已引用模板及锁定版本。
- Project 可从 Team / Platform / User Template 显式复制或派生为项目版本。
- 模板更新不自动改变 Project、Task 或已有 Run；升级必须是显式变更。
- “编排”不是独立一级工作台：Task 的协作顺序和条件属于执行计划，实际证据属于 Run；可复用过程模板属于 `ProcedureTemplate`。

### 接入中心：Team 聚合，Triage 决定归属

```text
导入文档 / Memory 候选 / Run 记录
  → Team 接入中心
  → 授权、去重、脱敏、候选归属
  → Triage
  → 明确写入 Team 或 Project 的 MemorySpace
```

- Team 是接入聚合入口，不是不明内容的默认写入位置。
- 内容归属不明、混合多个 Project、缺少写权限或低置信度时进入待分流队列；由有权限的人确认、拆分、暂存或拒绝。
- Project 只查看自己的导入、分流、失败记录与最终归属，不承担跨 Team 队列。

### 变更中心：跨层级聚合，变更跟随目标对象

```text
全局变更中心（仅汇总有权查看/审核的项）
├─ Team Template / Team 资源变更 → Team scope 审核
├─ Project 知识 / Project 资源变更 → Project scope 审核
├─ User 私有资源变更 → User scope 审核
└─ 系统策略 / 公共模型配置 → Platform Admin 审核
```

ChangeSet 的 owner 与审核范围始终跟随被修改对象；聚合列表先授权再过滤，不泄露其他 scope 的对象名称、数量或路径。RunGate 仅处理高风险运行副作用，绝不与内容 ChangeSet 混为一谈。

## 7. 信息架构

```text
日常工作：主页 / Projects / Tasks / Agents
知识与复用：Memory / Wiki / Code / Skills / 模板库
输入与发布：接入中心 / 变更中心
组织与平台：Team / Users / 公共模型配置 / Settings

Project：概览 / Tasks / Agents / 成员与访问 / 已引用模板 / 知识与接入记录 / 版本与变更
Task：概览 / 计划 / Runs / 交付物 / Context
Agent：概览 / System Prompt / Runtime / Tools / Skills / Hooks / Memory / Vault / Schedules / 关联范围
```

常规用户没有全局 Run 导航；Run 仅从 Task 或所属 Project 下钻。跨 Project Run Explorer 只属于有权限的 Admin / Observability。

## 8. 不变量

- `TeamMember ≠ ProjectMember`；成员关系也不等于资源 CRUD。
- `AgentTeam / AgentProject ≠` 关系、成员、策略或配置管理权；它们授予受限制的 `view / use`。
- `createdBy ≠ owner ≠ actor`；Key owner 不等于实际操作者。
- `accessible ≠ mounted ≠ effective`。
- `Run succeeded ≠ Task accepted`；`approved ≠ published`。
- 显式无权写目标必须拒绝，不能 fallback 到个人、最近 Project 或 Team Memory。
- 历史 Snapshot 保存事实，不能绕过当前撤权。

## 9. 原型边界

`product-prototype.html` 是使用样例数据的离线只读交互原型。它用于验证对象层级、路由和权限语义；不执行真实写入、授权裁决、审批、密钥创建或 Agent Run。
