# 产品设计：由关系模型反推页面

## 1. 产品目标

让用户始终知道四件事：**当前在哪个 scope、对象归谁、我/Agent 能做什么、下一步在哪里完成。**

```text
Platform：公共模型配置、公开 Wiki / Skill / Template 的发布目录
Team：成员、团队共享资源、默认规则、接入聚合、拥有的 Project
Project：具体工作、Task、Agent 使用上下文、项目资源、模板引用、项目接入与变更记录
Task：可验收目标
Run：Task 的一次执行尝试与证据
```

产品不提供“泛化资源库”。所有资源在各自专业页内按 scope 发现：User、Team、Project，以及符合策略的 Platform public。

## 2. 信息架构

### 日常工作

| 页面 | 用户问题 | 主对象 | 关键边界 |
|---|---|---|---|
| Home | 当前待我处理什么、为什么轮到我？ | 待办、阻塞、待分流、待审核 | 不使用“我的 Task”这种归属模糊文案。 |
| Projects | 哪个协作现场正在推进？ | Project | 点击先进入 Project 概览，不能直接跳 Task。 |
| Tasks | 目标和验收是什么？ | Task | Run 只能从 Task / Project 下钻。 |
| Agents | 哪个 Agent 能在哪个范围被使用？ | Agent | 关联授予受限 `view/use`，不授予管理权。 |

### 知识与复用

| 页面 | 资源 scope | 用户问题 |
|---|---|---|
| Memory | User / Team / Project / Agent；**无公共 Memory** | 哪些记忆可用、写到哪里、是否能写？ |
| Wiki | User / Team / Project / Platform public | 事实来自哪里、是否已发布、适用哪个 scope？ |
| Code | User / Team / Project | 对应哪个 source 与 revision、原仓库是否允许？ |
| Skills | User / Team / Project / Platform public | 能否使用、被挂载还是实际执行、是否应派生？ |
| 模板库 | User / Team / Project / Platform public | 该引用锁定哪个版本、要升级还是派生？ |

### 输入、发布与组织

| 页面 | 主对象 | 边界 |
|---|---|---|
| 接入中心 | Team 聚合的 IncomingMemory / Triage | 聚合导入候选；无确定归属不能自动写入 Team Memory。 |
| 变更中心 | 跨 scope 聚合的 ChangeSet / Review | 每条变更跟随 Team、Project、User、资源或 Platform 对象；先授权再聚合。 |
| Team | Team、成员、Team 资源、拥有的 Project | Team 管默认规则和共享协作，不管理 Platform 公共目录。 |
| Users | User、API Key 元数据、Team 关联 | 创建可选加入 Team；Key 只创建时展示一次。 |
| 公共模型配置 | PublicModelConfig | Platform Admin 管理模型及 Vault credential reference。 |

## 3. 层级导航与下钻

```text
Home
├─ Projects → Project workspace
│              ├─ 概览
│              ├─ Tasks → Task → Runs → Run
│              ├─ Agents
│              ├─ 成员与访问
│              ├─ 已引用模板
│              ├─ 知识与接入记录
│              └─ 版本与变更
├─ Tasks → Task detail
├─ Agents → Agent detail
├─ Memory / Wiki / Code / Skills / 模板库
├─ 接入中心 → Triage
├─ 变更中心 → ChangeSet review
├─ Team → Team detail
├─ Users → User / API Key lifecycle
└─ 公共模型配置
```

### Team 内的入口

```text
Team
├─ 概览：成员、Agent、Task 聚合、拥有的 Project
├─ 团队共享资源：Memory / Wiki / Code / Skill / Template
├─ 模板库：维护 Team AgentTemplate / ProcedureTemplate
├─ 接入中心：导入、分流、失败记录
└─ 设置：默认规则、成员与 Project 所有权管理
```

### Project 内的入口

```text
Project
├─ 概览：唯一 owning Team、open / restricted、当前权限
├─ Tasks / Agents / 成员与访问
├─ 已引用模板：来源、固定版本、派生关系
├─ 知识与接入记录：仅本 Project 导入、分流、失败与资源
└─ 版本与变更：仅本 Project 相关 ChangeSet
```

### Agent 内的入口

```text
Agent
├─ 概览：名称、描述、类型、可见性、owner、状态、版本与关联范围
├─ 系统提示词 / 运行参数 / 模型配置引用
├─ 工具 / 技能 / 钩子 / 记忆
├─ 资源授权：Memory、Wiki、Code、Skill 的 view / use / write 范围
├─ 密钥保险柜（引用和状态，不显示秘密）
└─ 定时任务 / 运行证据
```

不设置日常全局 Run、资源库或独立编排工作台。协作顺序和条件属于 Task 执行计划，实际证据属于 Run；可复用过程在模板库中作为 `ProcedureTemplate` 维护。

## 4. 关键行为和权限体验

### 4.1 Team 与 Project

- 创建 Team 的 User 成为 Team Owner。
- Team Owner 可以添加/移除成员、管理 Team scope 资源与默认规则、创建/关联 Project、转移 Project 所有权、归档或申请永久删除 Project。
- Project 必须有一个 owning Team。因此 UI 不提供“移除 Project”的无效操作，而提供“转移 Team”“归档”“永久删除”三个边界清晰的动作。
- Team Owner 或 Project Admin 可以管理 Project 成员；成员的资源 CRUD 仍要资源角色/ACL 明确授予。
- `open` Project 对 owning Team 成员显示“日常协作入口已授予”；不显示为“可管理全部资源”。

### 4.2 资源与模板

- User、Team、Project 的资源在对应 scope 下创建，显示 owner、scope、来源、版本、ACL、挂载/引用状态。
- Memory 不提供 public scope；跨 scope 内容必须在 Triage 中确认目标，不能自动写入。
- 平台公开 Wiki / Skill / Template 显示发布者、版本、适用条件和 fork / derive 入口；使用者不能直接编辑原版。
- Project 引用 Template 时必须选择版本；界面显示“已锁定版本”。升级或派生产生预览与 ChangeSet，而非静默同步。

### 4.3 接入与变更

```text
Import → 授权/去重/脱敏 → Triage → Team or Project target → ChangeSet → Review → Publish
```

- 接入中心显示候选 target、理由、置信度、写权限和失败原因；低置信度/无写权限/跨 Project 输入进入待分流。
- Project 的知识页仅显示其自身记录，并能跳到相应 Triage 或 ChangeSet。
- 变更中心用 scope、目标类型、审核状态过滤，但过滤前必须先执行授权；拒绝状态不能泄露其他 scope 的对象信息。
- ChangeSet 的审核范围跟随目标：Team Template → Team；Project 资源 → Project；系统策略 / 公共模型配置 → Platform Admin。
- RunGate 只在高风险 Run 中出现，不能进入内容变更队列。

### 4.4 Agent、User 与模型

- Agent 可 public-discoverable，也可仅限 User / Team / Project scope；公开不是无限制运行或数据访问。
- Agent 的基础字段为名称、描述、类型、可见性、owner、状态、版本、标签与 Team / Project 关联范围；创建/编辑这组字段仅限 Agent Admin。
- Agent 关联多个 Team / Project 时，每个关联分别解释 `view/use` 能力及其 Policy、ACL、RunGate 限制。
- Agent 对 Memory、Wiki、Code、Skill 的 `view / use / write` 需要逐资源 grant：Memory 写入受 MemorySpace write policy 控制；Wiki / Code / Skill 写入创建候选并进入 ChangeSet。public Agent 绝不使私有资源公开。
- Agent 配置页可由 Agent Admin 编辑；普通使用者只可按授权运行/查看，不可修改关联、策略、成员或配置。
- Vault 页面只有 secret reference、scope、轮换/撤销状态；绝不展示 Key 内容。
- User 创建页提供可选 Team 选择；创建成功页只显示一次 API Key，并要求安全复制。之后只提供撤销/轮换，不回显。
- 公共模型配置页只向 Platform Admin 提供管理动作；Agent 显示引用的已允许模型，不显示提供方凭据。

## 5. 状态与安全反馈

每个列表和详情都必须区分 `loading`、`empty`、`filtered-empty`、`partial`、`denied`、`error`、`offline`、`stale`、`success`。

- 无权限、对象不存在、未配置、确实为空不能共用“暂无数据”。
- unknown 不显示为 0；`Run succeeded` 不显示为 `Task accepted`；`approved` 不显示为 `published`。
- API Key、Vault secret、外部凭据只显示受控元数据，不能在成功提示、日志、错误或审计界面回显。
- 拒绝信息不能泄露私有对象的名称、数量或路径。

## 6. 可验证的原型路径

1. `Projects → Project overview → Tasks → Task → Runs → Run`：Project 不直接跳 Task，Run 不在主导航。
2. `Team → 模板库 / 接入中心`：Template 显示固定版本；接入内容不因归属不明而写入 Team。
3. `Project → 已引用模板 / 知识与接入记录 / 版本与变更`：只显示当前 Project 的关系和记录。
4. `Agents → Agent`：关联显示 `view/use`，并与 Vault、ACL、Policy、RunGate 的边界分离。
5. `Users → Create`：可选加入 Team，API Key 仅在创建完成状态展示一次。
6. `公共模型配置`：显示 Platform owner 与凭据引用，不显示密钥。
