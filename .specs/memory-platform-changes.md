# Memory Platform 补全工作 — 改动清单（git 核对）

> 本文档记录「TencentDB-Agent-Memory 记忆系统补全」这一交付的实际改动范围。
> 核对方法：`git status` + `git diff --stat` + 逐文件 `git diff` 增量，区分「本交付改的」
> 与「工作区里其他并行/更早的改动」。
> 生成时间：2026-09-02。测试基线：`npx vitest run` = **201 passed / 29 files**。

---

## 0. 一句话结论

本交付做了两件事：

1. **记忆系统补全**：对照 Agent OS + MindMemOS 审计出的 P0/P1/P2 能力缺口，全部落地到
   `MemoryCore/src/core/record/`（21 个实现模块 + 22 个测试），并接进真实写/召回管线。
2. **agent 创建时持久化挂载**：把 `mountSpacesForAgent` 纯函数接进 `createAgent` 流程，
   记忆空间「创建即落库」，跨 SQLite / MongoDB 两个后端。

工作区里另有**模型层重构、GitCredential 服务、recall/profile 隔离、Knowledge/Panel/Proxy/工程根**
等改动，**不是本交付所为**（见第 3 节排除清单）。

全量核对：`git status` 共 57 M + 65 ?? + 3 D（不含 node_modules/.tools）。本交付共改动
**62 个文件**（§1 的 43 新增 + §2 的 6 接线 + 1 测试 + §2.1 的 6 metadata + §2.2 的 6 文档脚本），
其余全部在第 3 节逐批排除，无遗漏。

---

## 1. 本交付改的：新增记忆系统模块

目录 `MemoryCore/src/core/record/`，**21 个实现 + 22 个测试**（全部 untracked 新文件）。

### P0 — 记忆空间 / 写入 / 召回
| 实现 | 测试 | 职责 |
|---|---|---|
| `memory-domain.ts` | `memory-domain.test.ts` | 记忆域定义 + `isRecallableDomain` |
| `memory-space.ts` | `memory-space.test.ts` | `spaceIdFor` / `mountSpacesForAgent` |
| `memory-write-router.ts` | `memory-write-router.test.ts` | 按 domain/write_policy 路由写入 |
| `retention.ts` | `retention.test.ts` | token 预算 + MMR + recency + priority 召回选材 |

### P1 — 关系 / 闭环 / 资产
| 实现 | 测试 | 职责 |
|---|---|---|
| `execution-bundle.ts` | `execution-bundle.test.ts` | 执行包 |
| `memory-lifecycle.ts` | `memory-lifecycle.test.ts` | 记忆生命周期 |
| `dreaming.ts` | `dreaming.test.ts` | 离线巩固（关系检测 + action planning） |
| `consolidation-executor.ts` | `consolidation-executor.test.ts` | 巩固执行器 |
| `feedback.ts` | `feedback.test.ts` | 记忆对错回流通道 |
| `feedback-detection.ts` | `feedback-detection.test.ts` | 反馈检测 |
| `memory-quality.ts` | `memory-quality.test.ts` | 记忆质量评分 |
| `playbook.ts` | `playbook.test.ts` | 剧本 |
| `playbook-synthesis.ts` | `playbook-synthesis.test.ts` | 剧本合成 |
| `scene-executable.ts` | `scene-executable.test.ts` | 可执行场景（与 L2 分离） |
| `skill-version.ts` | `skill-version.test.ts` | 技能版本化 |

### P2 — 治理 / 监控 / 评测
| 实现 | 测试 | 职责 |
|---|---|---|
| `redaction.ts` | `redaction.test.ts` | 写前脱敏 |
| `guardrail.ts` | `guardrail.test.ts` | 召回护栏 |
| `review-approval.ts` | `review-approval.test.ts` | 审查审批 |
| `approval-policy.ts` | `approval-policy.test.ts` | 审批策略 |
| `retrieval-evaluator.ts` | `retrieval-evaluator.test.ts` | 召回评测 |
| `consolidation-metrics.ts` | `consolidation-metrics.test.ts` | 巩固指标 |

另有 `l1-writer-domain.test.ts`（写入域回归）。

---

## 2. 本交付改的：接线（现有文件修改，含 diff 增量行数）

| 文件 | 增量 | 改动内容 |
|---|---|---|
| `MemoryCore/src/core/hooks/auto-recall.ts` | +127 | Retention / 护栏 / archive 排除 / 确定性 tie-break（+ 新增 `auto-recall.test.ts`） |
| `MemoryCore/src/core/record/l1-writer.ts` | +65 | domain / write_policy / space_id 落库 + 写前脱敏 |
| `MemoryCore/src/core/record/l1-extractor.ts` | +26 | 写入点接 `routeMemorySpace` |
| `MemoryCore/src/core/store/sqlite.ts` | +30 | `l1_records` 加 `domain/write_policy/space_id` 列 |
| `MemoryCore/src/core/store/types.ts` | +6 | `L1RecordRow` 加对应字段 |
| `MemoryCore/src/config.ts` | +9 | `RecallConfig` 加 tokenBudget / retention 参数 |

## 2.1 本交付改的：agent 创建时持久化挂载（metadata 层）

| 文件 | 增量 | 改动内容 |
|---|---|---|
| `MemoryCore/src/metadata/types.ts` | +32 | `AgentSpaceEntity` + `CreateAgentSpaceInput` |
| `MemoryCore/src/metadata/store/interface.ts` | +15 | `createAgentSpaces` / `getAgentSpaces` / `deleteAgentSpaces` |
| `MemoryCore/src/metadata/store/sqlite-adapter.ts` | +81 | `meta_agent_spaces` 表（`UNIQUE(agent_id,space_id)`）+ 3 方法 + 级联删除 |
| `MemoryCore/src/metadata/store/mongodb-adapter.ts` | +54 | 3 方法（`$setOnInsert` upsert）+ 级联删除 |
| `MemoryCore/src/metadata/service/metadata-service.ts` | +102 | `createAgent` 接线 `mountDefaultSpaces` + `getMountedSpaces` |
| `MemoryCore/src/metadata/service/metadata-service.test.ts` | +4 | 追加挂载测试：落库 / 确定性 / 幂等 / project 挂载 |

## 2.2 本交付改的：文档 + 脚本

| 文件 | 行数 | 说明 |
|---|---|---|
| `.specs/memory-platform-comparison-v2.md` | 298 | 三平台对比 |
| `.specs/memory-platform-backlog.md` | 177 | 改进路线图（P0/P1/P2 基线） |
| `.specs/design-memory-domain-write-model.md` | 114 | 域写入模型设计 |
| `.specs/memory-platform-implementation.md` | 60 | 实施证据清单 |
| `.specs/CONTEXT.md`（修改） | +28 | 追加 Memory Platform Backlog 索引 + 域语言术语表 + P0–P3 优先级 |
| `MemoryCore/scripts/start-gateway.sh` | — | 内核 gateway 启动脚本 |

---

## 3. 排除清单：工作区里但**不是本交付**的改动

> 这些文件在 `git status` 里同样显示改动，但 `git diff` 增量表明它们是其他/更早的工作，
> 本交付未触碰、也不应误记为本次成果。

| 批次 | 文件 | 证据（diff 增量内容） |
|---|---|---|
| 模型层重构（multi-provider + `/v3/llm/*`） | `MemoryCore/src/adapters/standalone/llm-runner.ts`（-421，大改）、`gateway/config.ts`（+60 providers 路由）、`gateway/server.ts`（model 部分）、`gateway/config.llm.test.ts`（新增）、`model/` 目录、`MemoryCore/package.json`（node≥22.19 / ts^6.0.3） | `OpenAICompatibleAdapter` / `ModelRuntime` / `buildProvidersFromConfig` |
| GitCredential 服务 | `metadata/router/v3-meta-router.ts`（+29）、`v3-meta-schemas.ts`（+18）、`metadata/utils/id-generator.ts`（+1 `gitCredential:"gitc"`）、`metadata/service/git-credential-service.ts`（新增） | `gitCredentialCreateSchema` / `GitCredentialService` |
| recall / profile 隔离（prior work） | `core/tdai-core.ts`（+11 `handleBeforeRecall` isolation）、`gateway/types.ts`（+2 `team_id/agent_id`）、`core/profile/profile-sync.ts`（+18 member 级 user 维度隔离）、`core/profile/profile-sync.test.ts`（新增） | `IsolationFilter` / `isolation?.userId` |
| chat_memory 资产测试 | `metadata/utils/chat-memory-asset.test.ts`（新增） | 非本交付测试 |
| Knowledge / Panel / Proxy / 工程根 | `MemoryKnowledge/**`（含 `data/`、`package.json`、13 src）、`MemoryPanel/**`（含 `package-lock.json` 删除、6 src、14 web）、`MemoryProxy/package.json`、`MemoryProxy/.tools/node22`（删除）、根 `package.json`、`pnpm-workspace.yaml`、`dsh-rate-limit-retry/`、`scripts/`、`sdk/memory-core` | 非 MemoryCore 记忆内核范畴 |

---

## 4. 测试基线

- 全量：`npx vitest run` → **201 passed / 29 files**
- 本交付新增测试：record 22 个 + `auto-recall.test.ts` + `metadata-service.test.ts`（+4 挂载）
- 注意：29 个测试文件里含他人新增的 `profile-sync.test.ts`、`gateway/config.llm.test.ts`、
  `metadata/utils/chat-memory-asset.test.ts`，不计入本交付。

---

## 附录 A：上一部署基线（HEAD = `e425f61 部署memory`，2026-08-28）

> `git status`/`git diff` 只覆盖「工作区 vs HEAD」的未提交改动。HEAD 本身是一个名为
> 「部署memory」的提交，**它已经把一批 MemoryCore 改动 commit 进去了**（`git status` 看不到，
> 但属于「实际代码改动」）。为补全全貌，本节单独列出这批基线，并明确它**不是本次补全**所为。

**性质**：caller 鉴权（`requireCallerId`）+ public/user/project 三桶 scope（`memory-scope.ts`）+
config-param 配置参数 + knowledge 集成 + standalone 部署。与「本次补全」（record 模块 + agent 挂载）
是两批不同的工作。

| 文件 | 增量 | 性质 |
|---|---|---|
| `metadata/service/metadata-service.ts` | +376 | caller 鉴权 + config-param |
| `metadata/store/sqlite-adapter.ts` | +329 | multi-key user model + config-param 表 |
| `metadata/types.ts` | +97 | 实体类型扩充 |
| `metadata/router/v3-meta-schemas.ts` | +86 | schema |
| `metadata/service/config-param-service.ts` | +79 | 配置参数服务（新增） |
| `metadata/store/mongodb-adapter.ts` | +76 | 同上（mongo） |
| `metadata/router/v3-meta-router.ts` | +57 | 路由 + caller 鉴权 |
| `metadata/store/interface.ts` | +26 | 接口 |
| `metadata/utils/memory-scope.ts` | +26 | 三桶 scope 推导（新增） |
| `metadata/config/metadata_config_params.json` | +24 | 配置参数默认值 |
| `core/store/sqlite.ts` | +14 | store 微调 |
| `core/store/tcvdb.ts` | +7 | tcvdb 微调 |
| `core/store/types.ts` | +4 | 类型微调 |
| `metadata/router/entity-ref-validator.ts` | +3 | 实体引用校验 |
| `gateway/knowledge-handlers.ts` | +2 | knowledge 集成 |
| `gateway/knowledge-schemas.ts` | +2 | knowledge 集成 |
| `metadata/utils/id-generator.ts` | +1 | 前缀（configParam 等） |
| `start-standalone.sh` | +36 | 部署脚本（新增） |
| `tdai-gateway.standalone.yaml` | +29 | standalone 配置 |

**叠加关系**：上表 19 个文件里，有 8 个与本次补全**同文件叠加**（`metadata-service.ts`、
`sqlite-adapter.ts`、`types.ts`、`interface.ts`、`mongodb-adapter.ts`、`id-generator.ts`、
`store/types.ts`、`store/sqlite.ts`）——本次在「部署memory」基线之上又加了 agent 挂载等
（增量见 §2/§2.1），两者互不冲突、可叠加核对。

**结论**：本次补全的实际代码改动 = 附录 A（基线，非本次）之上的 §1–§2 共 62 个文件。至此，
「已提交基线」与「未提交补全」两层的 MemoryCore 实际改动都已完整收录，无遗漏。

---

## 附录 B：实际代码全貌（直接 `ls`/`wc -l` + 读源码，非 git 元数据）

> git 只给「相对 HEAD 的增量」，会隐藏两类「实际代码」：
> ① 项目既有、本次未改的文件（git status 不显示）；② 我改的「既有大文件」的主体（git 只显示增量行数）。
> 本节补上这两类，还原真实代码图景。

### B.1 `record/` 实际 47 个文件 = 4 个既有 + 43 个本次新增

| 文件 | 行数 | 归属 |
|---|---|---|
| `l1-dedup.ts` | 408 | **项目既有**（L1 去重，本次**未改**，git status 不显示 → 此前清单漏掉） |
| `l1-reader.ts` | 247 | **项目既有**（L1 读取，本次**未改**，git status 不显示 → 此前清单漏掉） |
| `l1-extractor.ts` | 764 | 项目既有（L1 抽取，本次 +26 接线） |
| `l1-writer.ts` | 421 | 项目既有（L1 写入，本次 +65 接线） |
| 21 实现 + 22 测试 | — | 本次新增（见 §1） |

> 之前用 `git status` 数「45 个」是错的：那只是「相对 HEAD 变化的文件」。
> 实际 `record/` 有 **47 个**，其中 `l1-dedup.ts`、`l1-reader.ts` 是 clone 自带、我从未改动。

### B.2 本次改动的 11 个「既有文件」：实际行数 vs 我的增量

| 文件 | 实际行数 | 我的增量 |
|---|---|---|
| `core/store/sqlite.ts` | 3855 | +30 |
| `metadata/service/metadata-service.ts` | 2374 | +102 |
| `metadata/store/sqlite-adapter.ts` | 2214 | +81 |
| `metadata/store/mongodb-adapter.ts` | 1484 | +54 |
| `core/hooks/auto-recall.ts` | 1092 | +127 |
| `core/record/l1-extractor.ts` | 764 | +26 |
| `config.ts` | 755 | +9 |
| `core/store/types.ts` | 728 | +6 |
| `metadata/types.ts` | 668 | +32 |
| `metadata/store/interface.ts` | 244 | +15 |
| `core/record/l1-writer.ts` | 421 | +65 |

合计 11 文件 ≈ **15599 行既有代码**，本次增量约 **+547 行**。即本次「补全」是在这些
既有大文件上做的局部接线，而非从零写这些文件。

### B.3 `core/` 是庞大的既有记忆系统（本次补全的宿主）

本次补全只是这个既有系统上的增量，宿主本身（clone 自带、非本次改动）包括但不限于：

- `conversation/l0-recorder.ts`(607)、`hooks/auto-capture.ts`(347)、`hooks/recall-errors.ts`(112)
- `persona/`(persona-generator 304 / persona-trigger 136)、`prompts/`(l1-dedup 236 / l1-extraction 417 / scene-extraction 572 / persona 329)
- `scene/`(scene-extractor 604)、`seed/`(seed-runtime 421)、`state/`、`storage/`
- `store/`(sqlite 3855 / tcvdb 2506 / embedding 653 / isolation 171 / tcvdb-skill-store 871)
- `skill/`(skill-core 776 / skill-extractor 587 / skill-store 733 / agent-task-queue 776 … 20+ 文件)
- `report/`(otel-sdk-init 409 / otlp-backend 695 / clickhouse 809 / langfuse … 20+ 文件，三平面可观测)
- `tdai-core.ts`(1221)、`tools/`(conversation-search 318 / memory-search 344 / read-cos 160)、`types.ts`(333)

**结论**：所谓「记忆系统补全」的**真实代码位置**，是建立在这个既有 L0/L1/L2/L3 + skill +
observability 系统之上的一批增量——新增 43 个 `record/` 模块 + 在 11 个既有大文件里接进
domain/space/write_policy/脱敏/retention/guardrail/archive 排除/agent 挂载等。

---

## 附录 C：全项目实际代码核对（MemoryCore 之外 + 目录级统计）

### C.1 `MemoryCore/src` 目录级实际代码量 + 改动分布

| 目录 | 文件数 | 总行数 | 修改(M) | 新增(??) | 归属 |
|---|---|---|---|---|---|
| `core` | 163 | 41712 | 7 | 45 | 记忆内核：**本交付主体**（record 43 新增 + 5 接线）|
| `gateway` | 22 | 14599 | 3 | 1 | 别人（模型层 + recall 隔离） |
| `metadata` | 35 | 11714 | 8 | 3 | **我 6**（agent 挂载）+ 别人 5（GitCredential） |
| `offload` | 34 | 10438 | 0 | 0 | 既有未改 |
| `utils` | 18 | 6354 | 0 | 0 | 既有未改 |
| `offload_server` | 21 | 4904 | 0 | 0 | 既有未改 |
| `services` | 3 | 1222 | 0 | 0 | 既有未改 |
| `offload-client` | 6 | 1163 | 0 | 0 | 既有未改 |
| `model` | 7 | 987 | 0 | 7 | 别人（模型层，整目录新增） |
| `adapters` | 9 | 814 | 1 | 0 | 别人（llm-runner） |
| `api-trace` | 8 | 469 | 0 | 0 | 既有未改 |
| `cli` | 2 | 341 | 0 | 0 | 既有未改 |

（`config.ts` 在 `src/` 根，+9 接线，属本交付；另 `scripts/start-gateway.sh` 本交付新增。）

### C.2 `MemoryKnowledge`（别人，code-graph / knowledge）约 15 文件 + data 运行时

`codeanalysis-engine/src/server/api.ts`(2107)、`git-clone.ts`(769)、`store/sqlite-store.ts`(668)、
`store/code-graph-service.ts`(425)、`routes/code-graph.ts`(435)、`module.ts`(298)、`store/types.ts`(254)、
`source-fetcher/git-fetcher.ts`(213)、`git-clone.ts`、`db/client.ts`(183)、`db/schema.ts`(157)…
以及 `data/default/.../wiki-tf52n92q/index.db`(+db-shm/db-wal) 运行时数据。

### C.3 `MemoryPanel`（别人，code-graph / knowledge / git-credentials UI）约 19 文件

`panel/http/routes/chat-memory.ts`(2118)、`web/src/i18n/{zh-CN,en-US}.ts`(1499/1536)、
`web/src/pages/codeanalysis/AnalysisShellPage.tsx`(740)、`web/src/lib/knowledge-api.ts`(713)、
`team/components/{MemberSection,TeamManagementPanel}.tsx`(530/415)、
`routes/knowledge/code-graph-routes.ts`(342)、`kernel/adapters/http-knowledge-client.ts`(208)、
`kernel/ports/knowledge-client-port.ts`(238)、`workspace-detect.ts`(122)、
`GitCredentialManager.tsx`(203)、`api/git-credentials.ts`(57)…

### C.4 `MemoryProxy`（别人）2 文件

`src/index.ts`(171)、`package.json`(46)。

### C.5 工程根（别人，monorepo 化）

根 `package.json`、`pnpm-workspace.yaml`（新 → untracked）、`scripts/`（新）、
`dsh-rate-limit-retry/package.json`、`sdk/memory-core/typescript/package.json`。

### C.6 全项目归属汇总

| 归属 | 文件数（约） | 位置 |
|---|---|---|
| **本交付（我）** | **62** | `MemoryCore` 57（record 43 + 接线 6 + 测试 2 + metadata 6 + 脚本 1）+ `.specs` 5 文档 |
| 非本交付（别人/更早） | **≈ 70+** | MemoryCore 21（模型层 model 7 + GitCredential 4 + recall/profile 隔离 3 + gateway 3 + 其它 4）+ Knowledge 15 + Panel 19 + Proxy 2 + 工程根 6 |

> 结论：整个 workspace 的实际代码改动，我这份「记忆系统补全」占 MemoryCore 侧 57 个文件，
> 其余 MemoryKnowledge/Panel/Proxy 与 model/、GitCredential、隔离、monorepo 化等都是
> **项目里并行/更早的其他工作**，与本交付无重叠。

---

## 附录 D：全模块核对（含既有未改模块，逐目录扫到底）

> 前面几节聚焦「改动文件」。本节把**每个模块的既有未改部分也扫一遍**，
> 逐目录核对「文件数 / 行数 / 改动数」，证明全项目所有模块（并非只有改动的）都已覆盖，无遗漏。
> 数据源：`find` + `wc -l` + `git status --porcelain`，由 `scripts/audit-changes.sh` 同源生成。

### D.1 `MemoryCore/src/core/` 二级目录（19 个，记忆内核全貌）

| 目录 | 文件 | 行数 | 改动 | 归属 |
|---|---|---|---|---|
| `store` | 12 | 10044 | 2 | 我接线 +2（sqlite/types） |
| `skill` | 30 | 8116 | 0 | 既有未改 |
| `report` | 24 | 5267 | 0 | 既有未改（observability） |
| `record` | 47 | 5445 | 45 | **本交付主体**（43 新增 + 2 接线） |
| `hooks` | 4 | 1796 | 2 | 我 auto-recall + 别人 profile 无关 |
| `prompts` | 4 | 1554 | 0 | 既有未改 |
| `storage` | 6 | 1252 | 0 | 既有未改 |
| `scene` | 5 | 1087 | 0 | 既有未改 |
| `seed` | 3 | 1053 | 0 | 既有未改 |
| `tools` | 3 | 822 | 0 | 既有未改 |
| `state` | 4 | 663 | 0 | 既有未改 |
| `conversation` | 1 | 607 | 0 | 既有未改 |
| `profile` | 2 | 560 | 2 | 别人（profile 隔离） |
| `persona` | 2 | 440 | 0 | 既有未改 |
| `quota` | 4 | 325 | 0 | 既有未改 |
| `memory-generation-log` | 3 | 306 | 0 | 既有未改 |
| `memory-prompt` | 3 | 285 | 0 | 既有未改 |
| `abstractions` | 2 | 108 | 0 | 既有未改 |

（另有 `core/tdai-core.ts`(1221)、`config.ts`(755)、`index.ts`、`types.ts` 等散文件在 core 根。）

### D.2 `MemoryKnowledge/src` 目录核对

| 目录 | 文件 | 行数 | 改动 | 归属 |
|---|---|---|---|---|
| `engines` | 900+ | 278153 | 4 | 别人（`codeanalysis-engine` vendored 含 node_modules/vendor ≈1011 files，真实源码较少） |
| `routes` | 6 | 1774 | 1 | 别人 |
| `store` | 10 | 3307 | 3 | 别人 |
| `mcp` | 3 | 401 | 0 | 既有未改 |
| `db` | 2 | 340 | 2 | 别人 |
| `source-fetcher` | 4 | 321 | 2 | 别人 |
| `middleware` | 2 | 95 | 0 | 既有未改 |

### D.3 `MemoryPanel` 目录核对

| 目录 | 文件 | 行数 | 改动 | 归属 |
|---|---|---|---|---|
| `src/panel` | 47 | 7569 | 6 | 别人 |
| `web/src/pages` | 82 | 18883 | 6 | 别人 |
| `web/src/lib` | 21 | 3454 | 2 | 别人 |
| `web/src/i18n` | 3 | 3081 | 2 | 别人 |
| `web/src/layouts` | 6 | 1328 | 0 | 既有未改 |
| `web/src/services` | 11 | 1422 | 0 | 既有未改 |
| `web/src/components` | 5 | 764 | 0 | 既有未改 |
| `web/src/stores` | 2 | 507 | 0 | 既有未改 |
| `web/src/constants` | 1 | 115 | 0 | 既有未改 |
| `web/src/routes` | 1 | 53 | 0 | 既有未改 |
| `web/src/utils` | 1 | 21 | 0 | 既有未改 |

### D.4 核对结论

全项目按「一级目录 → 二级目录 → 改动明细」三层扫到底后：

- **本交付（我）真正的改动面**：`MemoryCore` 侧 57 个文件 —— 集中在 `core/record`（43 新增）+
  `core/hooks/auto-recall` + `core/record/l1-{writer,extractor}` + `core/store/{sqlite,types}` +
  `config.ts` + `metadata`（agent 挂载 6）+ `scripts/start-gateway.sh`。
- **其余所有模块**（`offload`/`offload_server`/`utils`/`services`/`offload-client`/`api-trace`/`cli`、
  `core/{skill,report,scene,seed,prompts,storage,persona,quota,conversation,state,tools,...}`、
  `Knowledge/{mcp,middleware,...}`、`Panel/web/{layouts,services,components,stores,...}`）均为
  「既有未改」或「别人改」——已逐目录核实，无本交付遗漏、无重叠。

至此，全项目（MemoryCore + Knowledge + Panel + Proxy + 工程根）的所有模块核对完毕。
