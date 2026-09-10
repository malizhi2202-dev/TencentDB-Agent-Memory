# CONTEXT — 项目共享上下文

> 本文件由 I-intel-scan 自动生成（2026-05-02）。后续 change 在 REQUIREMENT 阶段会向这里追加术语和决策。

---

## 项目概要

TencentDB Agent Memory — 腾讯云数据库团队知识管理系统。核心能力：ChatMemory（对话记忆）、CodeGraph（代码图谱）、Skills（技能管理）、Wiki（知识库）、Workbench（工作台）。系统由 4 个子项目构成：MemoryCore（内核）、MemoryKnowledge（知识引擎）、MemoryPanel（控制面板/Web）、MemoryProxy（代理工具链）。

## 技术栈（团队级默认 / 已锁定）

- **语言/运行时**: TypeScript + Node 22（Panel）/ Node 24（Engine）
- **前端框架**: React 18 + Vite + Tea Component（腾讯云内部组件库）
- **后端框架**: Hono（Panel 路由）、@hono/node-server（Engine）、LadybugDB（图数据库）
- **数据库**: LadybugDB（Cypher 图查询）、SQLite（Session 存储）
- **测试**: 后端有测试、前端无 —— 实测 MemoryKnowledge 190 / MemoryCore 30 / MemoryProxy 3 个测试文件；MemoryPanel/web 无 jest/vitest 配置。（2026-09 复核：原文"未发现测试框架"仅对前端成立）
- **构建/部署**: Vite + Docker（MemoryKnowledge/Dockerfile）
- **栈卡片编号**: 自定义（非标准技术栈组合）

## 域语言（术语表）

| 术语 | 定义 |
|---|---|
| CodeGraph | 代码图谱，基于 LadybugDB 存储的代码实体关系图 |
| LadybugDB | 图数据库，支持 Cypher 查询，用于代码图谱存储 |
| Panel | 控制面板，前端 Web + 后端代理（Hono 路由） |
| Engine | 知识引擎，独立 HTTP 服务（8443 端口），提供代码图谱 REST API |
| KS | Knowledge Service，知识服务（8421 端口），提供工具调用 |
| MemoryProxy | 代理工具链，包含 Node 22/24 运行环境 |
| DSH | DeepSeek Harness，开发环境 |
| GitNexus | 原版代码图谱分析工具，当前 CodeGraph 功能的参考实现 |

## 已锁决策

- `[2026-05-02]` CodeGraph 页面使用 sigma.js v3.0.3 + graphology 渲染图谱，后端 API 通过 Panel 代理转发到 Engine 服务
- `[2026-05-02]` 前端认证通过 Panel session + Hono 中间件，使用 `x-panel-session` header
- `[2026-05-02]` 代码图谱数据限制 500 节点/4000 边，通过 `dataVersion` ref 机制避免过滤时重建 Sigma

## 默认偏好（AI 在缺省时按此决策）

- 命名风格：PascalCase 组件 + camelCase 函数 + kebab-case 文件
- 状态管理：zustand（`src/stores/`）
- import 风格：使用 `@/` alias（如 `@/lib/knowledge-api`）
- 错误处理：try/catch 静默处理（`catch { /* */ }`）
- 测试策略：**前端（MemoryPanel/web）无测试框架无测试文件**；后端已有测试（MemoryKnowledge 190 / MemoryCore 30 / MemoryProxy 3）。原文"无测试框架，无测试文件"仅对前端成立（2026-09 复核更正）
- 提交格式：未标准化

## 既有抽象索引（来自 I-intel-scan · 防 AI 重复实现）

### HTTP 客户端

- **路径**：`MemoryPanel/web/src/lib/api/base.ts:103`
- **入口符号**：`fetch`（原生封装，非 axios）
- **使用方式**：`import { knowledgeApi } from '@/lib/knowledge-api'; await knowledgeApi.getCodeGraph(params)`

### 数据库访问

- **模式**：LadybugDB Cypher 查询（`@ladybugdb/core`）
- **路径**：`MemoryKnowledge/src/engines/codeanalysis-engine/shared/index.ts`
- **示例**：`LocalBackend.callTool('ladybugdb', 'executeCypher', { query })`

### 状态管理

- **库**：zustand
- **路径**：`MemoryPanel/web/src/stores/`
- **示例**：`MemoryPanel/web/src/App.tsx:5` 提到 zustand auth store

### 工具函数（utils / helpers）

| 工具类型 | 路径 | 入口符号 |
|---|---|---|
| 颜色 | `MemoryPanel/web/src/utils/color.ts` | 颜色工具 |
| 存储 | `MemoryPanel/web/src/services/storage-utils.ts` | 存储工具 |
| 错误 | `MemoryPanel/web/src/lib/error-message.ts` | 错误消息映射 |

### 自定义 hooks（前端）

| 类别 | 路径 | 数量 |
|---|---|---|
| 数据 hooks | `MemoryPanel/web/src/pages/*/components/use*.ts` | 10+ |
| resizable | `MemoryPanel/web/src/lib/useResizable.ts` | 1 |

### 错误处理

- **前端**：未发现 ErrorBoundary 组件
- **后端**：`MemoryPanel/src/panel/http/middleware/` 含 request-logger 和 validate-panel-headers
- **通知**：tea-component 的 notification

### 中间件

- `MemoryPanel/src/panel/http/middleware/request-logger.ts`
- `MemoryPanel/src/panel/http/middleware/validate-panel-headers.ts`

### Schema / 迁移

- **工具**：未引入（无 prisma/alembic/knex）
- **建议**：当前 LadybugDB 为 schema-less 图数据库，无需迁移

### 命名约定

- 文件命名：PascalCase 组件（`CodeGraphPage.tsx`）、camelCase 工具（`knowledge-api.ts`）
- 函数命名：camelCase
- 组件命名：PascalCase
- 测试文件：**前端**无测试文件；后端实测 MemoryKnowledge 190 / MemoryCore 30 / MemoryProxy 3（2026-09 复核更正）

### 禁动清单（AI 不许"顺手"碰）

- `MemoryPanel/web/src/App.tsx`（全局入口，认证 + 路由）
- `MemoryPanel/web/src/layouts/ConsoleLayout.tsx`（全局布局）
- `MemoryPanel/src/panel/http/app.ts`（Panel 后端入口）
- `MemoryPanel/web/src/lib/api/base.ts`（HTTP 客户端基类）

### 禁动清单例外（2026-09 复核新增）

`ConsoleLayout.tsx` 在禁动清单内，但**恢复 AnalyticsPage 必须**修改它（恢复 `'/analytics': 'analytics'` 路径映射 + 三层可见性判定 + dep 数组）。这属于**明确目的的必要改动**，不受"不许顺手碰"约束 —— 但仍需在 change 的 DESIGN 中显式声明。

### 2026-09 机械对账结论（早期版 `my-tencentDB-Agent-memory` vs 本仓）

> 完整报告：`.specs/refs/page-parity-audit.md`（383 行，含复现命令）

| 事实 | 数据 |
|---|---|
| **后端零删除** | MemoryCore 路由 173→254（删 0 / 增 81）；MemoryPanel 路由 67→82（删 0）；meta action 白名单 55→105（删 0）；Core/Knowledge/Proxy 文件级删除 0 |
| **丢失全在前端** | 82 个删除路径 **100%** 在 `MemoryPanel/web/src/` |
| **页面是净增** | 早期版 10 个已注册页面 → 当前 20 个真实路由 + 5 重定向（净增 10） |

**确定丢失 3 项**（详见 `.specs/redesign/07-RESTORE.md` 的搬回配方）：

| 项 | 性质 |
|---|---|
| 🔴 **`AnalyticsPage`「线上调用情况」整页**（29 文件、2 Tab） | **误删**：目录/路由/菜单全无，但 `lib/api/analytics.ts`(540 行)、`services/usePanelCapabilities.ts`、i18n `analytics.*` **151 行**、后端 `/api/v1/analytics/*`(16) + `/v3/analytics/*`(16) **全部保留**；`.specs/agent-collab-ui-redesign/CHANGE.md` 从未提及删除 |
| 🟠 默认 Agent 模板管理 UI（2 组件） | 误删：后端 `agent/{get,set}-default-template` 与前端 client 都在，仅 UI 缺失 |
| 🟡 Chat_Memory L1 列表「刷新」按钮 | `refreshLayer` 连带删除（全仓 0 命中） |

**其它实测缺陷**（2026-09）：① `/admin/users` 是 4 个后台路由里唯一没套 `AdminOnlyGuard` 的；② 重复路由注册 3 处（`app.ts`、`chat-memory.ts`、`code-graph-routes.ts`）；③ 23 个死模块（含被同名 `.tsx` 遮蔽的 `admin/UserManagementPage/index.tsx` 488 行）；④ i18n 真缺键 24 个。

### 文档可信度警告（2026-09 复核）

- `MemoryCore/v3-api-memorycore-doc.md` 与 `MemoryPanel/panel-api-doc.md` 的 md5 与早期版**逐字节相同**，但实现已增到 **254 条路由**（文档自称 108 条）→ **104 条已实现未文档化**。
- **结论：这两份 API 文档不能作为能力变更的证据**；判断能力有无一律以源码为准。
- `.specs` 内所有「✅ 已落地」标记**须附证据**（改动前先复核），对照机制见 `.specs/redesign/05-TECH-PLAN.md` 的 `check-claims` 门禁。

### 技术债（来自 M-health 2026-08-25）

| 项 | 严重度 | 描述 |
|---|---|---|
| 双路径数据获取 | 🔴 | 前端用 `authFetch` 绕过 KS 权限，应改用 `knowledgeApi.code.graph()` |
| Chat 双 bug | 🔴 | localStorage key 错误 + SSE 缓冲代理 |
| 死代码 | 🔴 | CodeInspector.tsx / NodeTypeLegend.tsx / ~180 行 CSS 未使用 |
| 重复定义 | 🔴 | NODE_COLORS 两处定义不一致，guessLang 重复 |
| 多标签过设计 | 🟡 | CodeReferencesPanel 多标签无实际使用场景 |
| 快捷键虚假 | 🟡 | Help Modal 声称 + / - / F / Esc 但未实现 |

---

## intel-scan 元数据

- **last_intel_scan**: 2026-05-02
- **scanner**: `prompts/I-intel-scan.md`
- **下次重扫建议**: 架构重构 / 框架升级 / 新增模块 / > 90 天

---

## codegraph-v2 域语言追加（2026-08-25）

### 术语表

| 术语 | 定义 |
|---|---|
| **社区着色** | 用 Louvain 算法检测图社区，同一社区节点用同色系渲染，不同社区用不同色，帮助识别模块边界 |
| **边箭头** | 有向边尾端渲染三角形箭头，指示 source→target 方向 |
| **浮动代码面板** | CodeGraph 页面右下角绝对定位的代码预览面板，点击节点后弹出，含节点类型 badge + 文件名 + 源码 |
| **三段式布局** | Header + 左侧 Filters(280px) + 中心图谱，去掉右面板和底栏的布局 |
| **工具执行历史** | CodeAnalysis 页面 localStorage 持久化的最近执行记录（工具名 + 参数 + 时间戳），支持回填 |
| **品牌色** | 项目统一使用蓝色系（#2563eb 主色），替代之前的紫色（#7c3aed） |
| **KnowledgeGraph** | Wiki/Code 共用的图谱组件，基于 @react-sigma/core，用于轻量级图谱预览（~200 节点） |
| **GraphCanvas** | CodeGraph 页面专用的图谱组件，基于原生 sigma + graphology，用于重型交互分析（~5000 节点） |

### 已锁决策

- **D-001**：品牌色统一为蓝色（#2563eb），全站紫色硬编码替换。Tea 组件主题色不受影响。
- **D-002**：两个图谱引擎（KnowledgeGraph / GraphCanvas）不合并。前者用于轻量预览，后者用于重型交互，定位不同。
- **D-003**：Code 页面保留 graph tab 和 analyze tab。两者与独立 CodeGraph/CodeAnalysis 页面定位互补，不删除。
- **D-004**：工具执行历史用 localStorage 持久化，无需后端。上限 50 条，LRU 淘汰。
- **D-005**：Engine 服务仅监听 127.0.0.1，CORS 限制为 Panel 域名。Panel 通过 localhost 代理访问 Engine。

### 默认行为

- 图谱社区着色在节点 > 50 时自动启用，≤ 50 时按节点类型着色
- 工具执行历史在页面刷新后保留，但清除浏览器数据后丢失
- 快捷键在 CodeGraph 页面焦点时生效，输入框聚焦时不拦截

---

## 记忆隔离与权限模型（2026-08-26）

> 背景：memory 需接入多种 harness（自研 / claude-code / codex / dsh / 通用），
> 规模约十几个 team、二十几人、几十个项目。本文定义「归属 + 隔离 + 视图」的域模型。

### 术语表（新增）

| 术语 | 定义 |
|---|---|
| **资产(asset)** | 系统管理的 **6 类实体**：`wiki`、`code-graph`、`skill`、`chat_memory`、`agent`、`代码分析`。全部受 team/user/project 三轴隔离 + 读写 scope 约束 |
| **team** | 团队：多人协作的归属容器，成员多对多，6 类资产 + project 挂在 team 下 |
| **project** | 项目：team 下的一等实体，是隔离边界，捆绑 6 类资产 + task |
| **user** | 一人一身份，`user_key` 认证（`x-tdai-user-key`） |
| **harness** | 接入框架（claude-code/codex/dsh/自研/通用），`agentSource`，纯传输层，不参与归属判定 |
| **公共(public)** | `visibility=team`，全团队成员可见 |
| **私有(private)** | `visibility=private`，仅 owner 可见 |
| **restricted** | 指定人可见（ACL：`grant user` / `team_role` / `agent`） |

> 6 类资产 → 系统实体映射：wiki → `entity_knowledge(type=wiki)`；code-graph → `entity_knowledge(type=code-graph, repo_url)`；skill → `skill`；chat_memory → 会话记忆；agent → `meta_agents`；代码分析 → codeanalysis 引擎产物/结果。

### 四层隔离模型

| 层 | 叫什么 | 规则 |
|---|---|---|
| **L1 团队公共层** | 团队资产 | 6 类资产中设为团队公共的（如 skill / chat_memory / code-graph / wiki 资料），全团队成员可见（visibility=team） |
| **L2 权限准入层** | 我能看到啥 | 登录后只显示自己有权访问的：team、agent、资产管理、code、代码分析、项目 |
| **L3 创建物开关层** | 我建的归谁看 | 用户创建的资产默认私有，可显式设为公共（或 restricted） |
| **L4 视图筛选层** | 怎么看 | 同套资产可按「用户维度」或「项目维度」切着看 |

> L4 两个维度：用户维度（资产管理 / 代码分析 / agents管理）、项目维度（资产管理 / 代码分析 / agent管理）。
> 数据侧要求：每个资产同时标注 `owner_user` 与 `project`，两个键都可筛。

### 锚定与隔离规则

- **认人**：`user_key` → user（自动，可靠）。
- **认项目**：多信号（显式声明 / git remote / workspace 路径 glob / 手动选）→ project，命中写回记忆。
  - workspace 粒度太粗（可含多项目）、git 非必须（有资料型项目），故 project 是最终锚，git/path 只是键。
- **隔离真相源**：project 的 `visibility`（private/team/restricted）+ `members`，在写/读/注入三处同源执行。
- **三条铁律**：默认私有、共享显式；一份记忆只挂一个 project（跨项目共享用 restricted+grant，不复制）；注入永远白名单（只注入当前 user 有权读的 project 的记忆）。

### team 与 project 是正交的两轴（非父子层级）

- **team = 归属轴**：一个人属于哪几个虚拟团队（多对多），决定 L1 公共池范围。
- **project = 协作轴**：哪些人一起拼一个项目（多对多，成员可跨虚拟团队），决定项目可见域。

`team.members ≠ project.members`，两集合独立维护：

```
user ──属于──▶ team（归属，多对多）   ──▶ 公共池 L1
user ──参与──▶ project（协作，多对多）──▶ 6 类资产（wiki/code-graph/skill/chat_memory/agent/代码分析）
```

- **读**：`公共(我的 team) ∪ 私有(本人) ∪ 项目(我是 member 的 project，可跨 team)`。
- **写**：落 creator + project（独立成员集），scope 标清。
- **删**：project.manager（项目管理者）或资产的 creator。

### 对标同类产品

- 文件系统派（Claude Code / Cursor / Continue）：repo=边界，提交=共享、local=个人 → 借鉴「二态共享/私有」。
- 身份派（Mem0 / Zep / Letta / LangMem）：user/agent/session 或命名空间为键 → 借鉴「身份键永远兜底」与「agent=记忆沙箱」。
- 结论：市面无产品同时覆盖 team × project × user × harness 四轴；本模型取两者并集。

### 读写对称（任何 harness 的统一契约）

**读（获取 / 注入上下文）**：任一 harness 的会话，注入的可见资产 = 三块并集（覆盖 6 类资产）：

```
fetch(user U, project P, team T) =
    公共资产：visibility=team, team_id=T        （L1 团队公共）
  ∪ 用户资产：visibility=private, owner_user=U  （用户维度）
  ∪ 项目资产：project_id=P 且 U 有读权限        （项目维度）
```

**写（资产落库）**：6 类资产每条必须带 scope 标签，写进正确桶：

| scope | 标签 |
|---|---|
| 公共 | `visibility=team` + `team_id` |
| 用户私有 | `visibility=private` + `owner_user` |
| 项目 | `project_id` + 对应 `visibility` |

**写时 scope 判定**（自动 + 可显式覆盖）：

- 会话绑定了 project → 默认写项目维度
- 会话未绑 project（纯聊天）→ 默认写用户维度
- 内容显式声明共享/公共 → 写团队维度

> 现状缺口：proxy 的读写链路（injection / memory ops）目前只有 session 级 `team_id`/`user_id`，
> 无每条记忆的 `scope` 字段。读写对称需新增 `scope` + `project_id` 落地。

### 权限方案（规则式 RBAC）

四种 authority（不搞复杂角色表）：

`system_admin（全局）` > `owner/manager（对象创建者/项目管理者）` > `editor（被授予增/改）` > `viewer（默认读）`

| 规则 | 内容 |
|---|---|
| **R1 读** | 由可见性决定：`private`→owner；`team`→team 成员；`restricted`→ACL 命中者；project 资产 → project.members |
| **R2 增** | 建自己的资产人人可（默认 private）；建公共/团队级 → 需 `system_admin` 或被授予 |
| **R3 改** | owner/creator 全权；团队公共 → 仅 `system_admin`（或被授予）；他人/共享资产 → 被授予才可 |
| **R4 删** | 仅 owner/creator 或 project.manager 或 `system_admin`；团队公共 → 仅 `system_admin`；删除权不随 editor 授予（除非显式 grant delete） |
| **R5 授权** | owner / project.manager / `system_admin` 才可 grant/revoke |

不可下放特例：**用户管理 + 改公共模型** 仅 `system_admin`；**apikey / harness 客户端** 每人只管理自己的。

维度切换：`system_admin` 全维度（team/project/用户）；普通用户仅「自己所属 project」+「自己用户维度」。

**删除细分**：只有「该资产/项目/code 的管理者（owner 或 project.manager）」能删；**涉及与他人共有的资产，同样只有管理者能删**；其余人最多增/改/查（且需被授予）。删除权不随 editor 授予，除非显式 grant delete。

现有 schema 已具备 `user_type` / `team_role` / `owner_user_id` / `visibility` / `ACL`；缺的是 R2/R3/R4 统一强制 + project 的 members/manager 落地。

**实施状态（M2 / M2b / M3a / M3b）**：
- ✅ R1 读：可见性决定（`permission-checker.checkPermission` + `listAccessibleAssets`）。**M3a**：`listAccessibleAssets` 支持 `project_ids` 并入「U 是 member 的 project」资产（跨 team），团队循环跳过 `project_id` 资产；`AssetFilter.project_id` + store `listAssetsByProject`（sqlite/mongo）。
- ✅ R2 增：`create{Agent,Asset}` 非 `system_admin` 默认 `private`、显式 `visibility=team` 拒；`createTeam` / 建 team 公共 project 需 `system_admin`（`resolveCreateVisibility` / `assertCanCreateProjectVisibility` / `createTeamForCaller`）。
- ✅ R3 改：`update{Agent,Task,Project}` 走 owner/creator（或 `system_admin`）；`updateAsset` 走 owner / system_admin / **user ACL write（赋权可）**（`assertCallerCanUpdateAsset`）。**owner 全权（已与用户确认）**：公共资产 owner 与 admin 都能改。
- ✅ R4 删：`delete{Agent,Asset,Project}` 走 owner；project.manager 删 `project_id` 资产已落地（**M2b**：`isCallerProjectManager` + `assertCallerCanDelete{Asset,Agent}` → owner / project.manager / system_admin / **user ACL delete（赋权可）**）。
- ✅ R5 授权：`grant/revoke ACL` 走 owner（或 `system_admin`）；**editor 授权（user ACL write）已接入 asset update，user ACL delete 已接入 asset delete**。
- ✅ **M3b**：MemoryProxy 多信号 project 锚定 —— `MemoryProxy/src/session/project-anchor.ts`（`resolveProjectAnchor`：显式声明 > git remote > 路径 glob > member 兜底，纯函数，12 测试全绿）+ `meta/client.ts` `listProjects` / `listAccessibleAssets(project_ids)` + skill-bridge 白名单并入 project 维度。
- ✅ **M4 关键默认值**：`agents.ts` / `assets.ts` / panel `knowledge/common.ts` 创建默认 `'team'`→`'private'`；`meta-actions.ts` 登记 11 条 project action。
- ✅ **M4 前端**：project 页（新建/列表/成员/资产聚合）+ 菜单路由 i18n + visibility 选择器按「建公共=admin」gating。
- ✅ **代码分析资产 project_id（6 类资产补漏）**：MemoryKnowledge `knowledge_code_graph` / `knowledge_wiki` 表 + Drizzle schema + `addColumnIfMissing` 迁移 + store（create/list/count/map）+ service（`CreateCodeGraphParams`/`CreateWikiParams`）+ routes（`/create`/`/list` 接受 `project_id`）+ `api-helpers`（`CodeGraphDetail`/`WikiDetail` 输出 `project_id`）。代码分析借用 code-graph 资产，随 code-graph 一起挂 project 维度。
- ✅ **用户维度（owner 轴，含 admin 切换）**：`ListAccessibleAssetsParams.owner_user_id` + `assetListAccessibleSchema.owner_user_id` + `listAccessibleAssets` 二次切片 + proxy `ListAccessibleAssetsInput.owner_user_id`；前端 SkillsPanel 新增「我的资产」（mine）tab（`listAccessible(owner_user_id=me)`）。**admin 用户维度切换**：`system_admin + owner_user_id` 直接走 `store.listAssetsByOwner`（含 private），前端 mine tab 对 admin 显式用户选择器。
- ✅ **project 资产聚合视图**：`listAssetsByProjectForCaller`（`requireProjectVisible` 守卫）+ `asset/list-by-project` schema/路由 + 前端 `assetsApi.listByProject` + project 页资产区块。
- ✅ **system_admin 跨 team 成员管理**：`assertCallerIsTeamAdmin` / `assertCallerIsTeamOwnerOrAdmin` / `listTeamMembersForCaller` short-circuit `system_admin`（全局 admin 视同任意 team admin，可给任意 team 加/删成员）。
- ✅ **harness 客户端 self-only 核验**：apikey = `user-key/*` 已 `assertUserScope`（self-only）；「harness 客户端」在 MemoryPanel 前端无用户可见资产形态（是 proxy 的协议适配层，非用户资产），故无额外实现对象。
- ✅ **界面 4 维度切换器（团队 / 项目 / Agent / 用户）**：资产页（Skill `skills.scope.*`、Wiki `wiki.scope.*`、Code `code.scope.*`、ChatMemory `memory.scope.*`）与代码分析页（`analysis.scope.*`）统一为 `'team' | 'project' | 'agent' | 'user'` 四档 Segment + 次级选择器；agent 维度走 `agent-fixed` 绑定、project 维度走 `asset/list-by-project` / `*ByProject`、user 维度走 `owner_user_id`（普通用户=自己，admin 可切任意用户）。panel 后端新增通用 `POST /knowledge/{wiki|code-graph}/list-scope` + `POST /chat-memory/list-scope`。
- 📄 **M5 契约**：自研 harness 上报 3 个 header（见下）→ proxy 消费锚定信号；proxy 侧已消费，harness 侧由用户自研。

### harness 取数决策（scope 由三元组决定，与 harness 无关）

```
1. user    ← user_key 认证，恒已知
2. project ← 多信号注册表（显式声明 > git remote > 路径 glob > 手动选）
3. team    ← P 所属 team；没 P 用 user 的 team
4. 意图    ← agent 点名某 project/repo（工具参数 / x-project-id 头）覆盖默认

fetch = 公共(T) ∪ 私有(U) ∪ (project(P) 若解析出且 U 有权读)
```

- 会话绑 project P → 取三块；纯聊天未绑 → 只取公共+私有；显式要某 project X → 临时加，先验读权限（白名单兜底）。

### 权限方案（规则式 RBAC）

四种 authority（不搞复杂角色表）：

`system_admin（全局）` > `owner（对象创建者/管理者）` > `editor（被授予增/改）` > `viewer（默认读）`

| 规则 | 内容 |
|---|---|
| **R1 读** | 由可见性决定：`private`→owner；`team`→team 成员；`restricted`→ACL 命中者 |
| **R2 增** | 建自己的资产人人可（默认 private）；建公共/团队级 → 需 `system_admin` 或被授予 |
| **R3 改** | owner 全权；团队公共 → 仅 `system_admin`（或被授予）；他人资产 → 被授予才可 |
| **R4 删** | 仅 owner 或 `system_admin`；团队公共 → 仅 `system_admin`；删除权不随 editor 授予（除非显式 grant delete） |
| **R5 授权** | owner 或 `system_admin` 才可 grant/revoke |

不可下放特例：**用户管理 + 改公共模型** 仅 `system_admin`；**apikey / harness 客户端** 每人只管理自己的。

维度切换：`system_admin` 全维度（team/project/用户）；普通用户仅「自己所属 project」+「自己用户维度」。

现有 schema 已具备 `user_type` / `team_role` / `owner_user_id` / `visibility` / `ACL`；缺的是 R2/R3/R4 统一强制 + project 的 owner 角色落地。

### harness 取数决策（scope 由三元组决定，与 harness 无关）

```
1. user    ← user_key 认证，恒已知
2. project ← 多信号注册表（显式声明 > git remote > 路径 glob > 手动选）
3. team    ← P 所属 team；没 P 用 user 的 team
4. 意图    ← agent 点名某 project/repo（工具参数 / x-project-id 头）覆盖默认

fetch = 公共(T) ∪ 私有(U) ∪ (project(P) 若解析出且 U 有权读)
```

- 会话绑 project P → 取三块；纯聊天未绑 → 只取公共+私有；显式要某 project X → 临时加，先验读权限（白名单兜底）。