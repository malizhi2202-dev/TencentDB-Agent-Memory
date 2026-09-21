# 产品定位决策：可接入 Harness 的 Memory Platform 与平台自有治理 Agent

## 决策

TencentDB Agent Memory 是一个**可被外部 Agent Harness 接入的企业 Memory Platform**，同时也运行**平台自有 Agent**。两者不是二选一：外部 Harness 贡献工作过程与候选证据；平台自有 Agent 将经过授权的输入整理、分析和治理为可复用的记忆、Wiki、Skill、Template 与 Code Context。

它不试图替代 Codex、Claude Code、DSH 或其他外部 Harness 的执行循环、模型调用、工具编排和本地工作区；但平台自有 Agent 为平台职责而运行，例如根因分析、Memory L0–L3 整理、知识提炼、候选变更生成、代码上下文分析和质量检查。

```text
Codex / Claude Code / DSH / 其他 Harness
      │ 通过 SDK、CLI、MCP、HTTP 或事件适配器
      ▼
TencentDB Agent Memory Platform
      ├─ 身份、Team、Project、授权与审计
      ├─ Memory：scope、写策略、检索、版本、生命周期
      ├─ Wiki：文档、引用、chunk、ACL、发布
      ├─ Code Context：source、revision、仓库指令、检索上下文
      ├─ Skill / Template：受控复用、版本、挂载许可
      ├─ 接入与分流：候选归属、去重、脱敏、Triage
      ├─ 平台自有治理 Agent：L0–L3、根因、提炼、代码分析、质量检查
      └─ 变更与发布：ChangeSet、Review、Publish
```

## 不做什么

- 不实现新的 Agent loop、模型推理 runtime、工具执行器或多 Agent 编排 runtime。
- 不把 Codex / Claude Code / DSH 的任务、会话、Run、工具调用复制成平台的唯一真源。
- 不在平台内要求用户维护外部 Harness 的系统提示词、运行参数、Hooks、工具或 Vault 明文。

## 平台需要管理什么

### 1. Harness Connector

外部 Harness 的接入配置与身份映射，而不是替代其自身配置。

| 字段 | 含义 |
|---|---|
| connector name / type | 例如 Codex、Claude Code、DSH、custom adapter。 |
| connector instance | 接入端实例、环境或安装标识。 |
| authentication subject mapping | 外部调用主体映射到平台 User / Service Principal。 |
| Team / Project binding | 该接入端在哪些 Team / Project scope 内请求上下文。 |
| capabilities | 允许的 `context.read`、`memory.search`、`memory.propose_write`、`wiki.read`、`code.context.read`、`skill.resolve` 等。 |
| policy / audit | scope、频率、来源、版本和审计事件。 |

Connector 只持有平台访问凭据的引用或短期令牌；外部 Harness 自己的 Provider Key、模型设置、Hooks 和本地 Secret 仍由外部 Harness 管理。

### 2. 两类 Agent：外部身份与平台治理 Agent

| 类型 | 归属与职责 | 平台是否管理其运行时配置 |
|---|---|---|
| 外部 Harness Agent | Codex、Claude Code、DSH 等调用方的身份/profile；用于 scope 授权、上下文读取、候选写入与审计。 | 否。Prompt、模型、工具、Hooks、本地工作区和 Secret 仍由外部 Harness 管理。 |
| 平台治理 Agent | 平台所有或 Team / Project 受控启用；执行 Memory L0–L3 整理、根因分析、知识提炼、Skill/Template 候选生成、Code Context 分析、质量检查。 | 是，但仅管理其平台任务所需的 Prompt、模型引用、工具许可、资源 grant、Hooks、调度与 Vault 引用；Vault Secret 仍永不回显。 |

外部 Agent profile 的字段：名称、描述、类型、外部 Harness、owner、可见性、关联 Team / Project、能力范围、版本/环境标识。平台治理 Agent 在此基础上有自己的运行配置和可审计任务定义。

### 3. 平台治理流水线

```text
外部 Harness 的会话 / Run 证据 / 文档 / 代码变更 / 记忆候选
   → 接入与分流（身份、scope、来源、权限、去重、脱敏）
   → 平台治理 Agent
       ├─ L0：原始证据、会话片段、运行日志、导入文档
       ├─ L1：原子事实、实体、偏好、决策、代码符号/变更线索
       ├─ L2：任务 / Project 级摘要、因果链、根因候选、可检索知识
       └─ L3：跨 Task / Project 的已审核 Wiki、Skill、Template、Code Context 模式
   → ChangeSet（base / current / proposed / provenance）
   → 对应 Owner scope 的 Review
   → Publish / Index
```

- L0–L3 是**知识成熟度和治理层级**，不是四个可被任意公开的 MemorySpace；所有层级均继承 User / Team / Project / Agent owner 与 ACL。
- 平台 Agent 的输出一律是候选：它不能把外部 Harness 传入内容直接变成已发布 Wiki、Skill 或 Template，也不能越权写入不明确的目标。
- 根因分析须保留输入证据、关联 Run / Task / Code revision、推理链/置信度和反证；结论在 Review 前只是候选。
- Code 分析产出固定到 `source + revision`；平台不替代外部 Harness 的本地工作区，也不以 latest 回填历史。

### 4. Context Contract

外部 Harness 在运行前向平台请求经过授权过滤的上下文；运行后提交候选 Memory / Wiki / Code / Skill 变更。

```text
resolve_context(subject, project, task?, requested_capabilities)
  → ACL-filtered Memory / Wiki / Code context / Skill references / locked templates

propose_memory_write(subject, target_space, content, provenance)
  → policy check → Triage or ChangeSet

search(subject, scopes, query, filters)
  → ACL-filtered citations and revision identifiers
```

平台返回引用、版本、来源与权限解释；外部 Harness 负责将其装入 prompt、执行工具和保留其自身运行日志。

## UI 调整原则

- 一级入口应包含 **Harness 接入** 与 **平台治理 Agent**，而不是把两者混为同一个“智能体配置”概念。
- **外部 Agent 身份与授权**页展示来源 Harness、关联 scope、可读取/可提议写入的资源能力与审计；不展示外部运行时的系统提示词、模型参数、工具、Hooks、Vault、定时任务。
- **平台治理 Agent**页可展示并管理其任务定义、系统提示词、模型引用、运行参数、工具许可、Skill、Hooks、Memory grant、Vault 引用和调度；其输出必须显示 L0–L3、输入证据、目标 scope、ChangeSet 与 Review 状态。
- Task / Run 是来自外部 Harness 的可选关联和证据索引；平台不执行外部 Run，也不把它作为核心流程。
- 公共模型配置仅服务平台治理 Agent 的托管任务；外部 Harness 的模型配置仍在 Harness 自己一侧管理。

## 验收标准

1. 能为 Codex、Claude Code、DSH 等至少三类外部 Harness 建立 Connector，并映射 Platform Principal 与 Team / Project scope。
2. 外部 Harness 可按授权读取 Memory、Wiki、Code Context、Skill、Template，并获得来源和 revision。
3. 外部 Harness 只能向明确目标提交候选写入；无目标、无写权或多归属输入必须进入 Triage，不能 fallback。
4. 平台能审计哪个外部 Harness、哪个主体、在何 scope、读取/提交了何种资源及使用的 revision。
5. 平台不保存或展示外部 Harness 的模型密钥、Vault Secret、系统提示词、工具配置或完整执行控制面。
