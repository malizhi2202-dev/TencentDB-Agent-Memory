# 页面/功能对齐审计：`my-tencentDB-Agent-memory` → `TencentDB-Agent-Memory`

- **审计对象**
  - 参照基线（本文称 **早期版 / OLD**）：`/home/malizhi/project/my-tencentDB-Agent-memory`（branch `feat/server_team`，HEAD `906b582`，34 commits）
  - 当前版（本文称 **当前版 / NEW**）：`/home/malizhi/project/TencentDB-Agent-Memory`（branch `dev_mlz`，HEAD `8b9932b`，13 commits）
- **方法**：全部结论由 `find` / `ls` / `diff` / `comm` / `grep` + 两个 Python 提取脚本机械产出，不靠印象。表格内一律给真实路径与行号。
- **判定口径**：`确定丢失` / `疑似丢失` / `已合并改道` / `未确认`。

---

## 0. 一句话结论（先看这里）

> **丢失全部发生在前端页面层，后端一条接口都没少。**

| 层 | 早期版 | 当前版 | 被删 | 说明 |
|---|---|---|---|---|
| 前端页面文件（`MemoryPanel/web/src/`） | 181 | 234 | **82 个路径删除** | 唯一发生删除的地方 |
| MemoryPanel 后端路由（Hono `/api/v1/*`） | 67 | 82 | **0** | NEW 是 OLD 的严格超集，+15 |
| MemoryPanel meta action 白名单 | 55 | 105 | **0** | +50 |
| MemoryCore 路由（`/v2/*`+`/v3/*`） | 173 | 254 | **0** | +81 |
| MemoryCore / MemoryKnowledge / MemoryProxy 文件 | 400 / 77 / 202 | 471 / 3563 / 212 | **0** | 三个子项目零删除 |

机械证据：

```bash
# 后端文件级：三个子项目 «ONLY IN OLD» 全为空
comm -23 old-full-MemoryCore.txt   new-full-MemoryCore.txt   # 空
comm -23 old-full-MemoryKnowledge.txt new-full-MemoryKnowledge.txt  # 空
comm -23 old-full-MemoryProxy.txt  new-full-MemoryProxy.txt  # 空
# MemoryPanel 的 82 个删除全部落在 web/src/pages 与 web/src/components
comm -23 old-full-MemoryPanel.txt new-full-MemoryPanel.txt | grep -v '^web/'
# （无输出）
```

因此本审计的重点是：**早期版 10 个已注册页面中，有哪几个在当前版没有入口了**，以及**当前版还剩什么能用**。

---

## A. 页面 / 路由对账

### A.0 规模对照

| 指标 | 早期版 | 当前版 | 证据 |
|---|---|---|---|
| `pages/` 下顶层目录数 | 11 | 14 | `ls -1d */` |
| `routes/index.tsx` 中 `element: <` 计数 | 11 | 25 | `grep -cE "element: <"` |
| 其中**真实页面**路由 | **10** | **20** | 见 A.1 / A.3 |
| 重定向 / 兜底 | 0 | 5（`/graph`、`/team/members`、`/team/agents`、`*` 等） | `routes/index.tsx:44,55,56,66` |
| 侧栏可见菜单项 | **9**（4 组） | **10**（3 组 + `__hidden__` 8 项） | `constants/menu.tsx` |
| 顶栏「用户」下拉入口 | 0（仅「使用说明」按钮） | **5** | `layouts/GlobalHeader/index.tsx:100-158` |

> 注意：早期版 `route` 里注册了 11 条 `element`，其中 `pages/ResourcePage` 是 **共享壳组件**（`ResourcePage({children})`，被 Wiki/Code/Skills/Memory 复用），不是页面。故真实页面数记 **10**。

### A.1 两版都有（含缩水标注）

| # | 功能 / 页面 | 早期版文件 | 当前版文件 | 早期版路由 | 当前版路由 | 是否缩水 |
|---|---|---|---|---|---|---|
| 1 | 工作台·任务看板 | `pages/WorkbenchPage/index.tsx` | `pages/workbench/WorkbenchPage/index.tsx` | `/` | `/` | **无缩水，有增强**：新增团队×项目×Agent×用户四维 AND 筛选（`TaskWorkbench.tsx:70-101`）；`BoardView`/`TaskDetail`/`useTeamParticipation` 由旧顶层目录 `pages/WorkbenchPage/` 复用（`TaskWorkbench.tsx:34-35`） |
| 2 | Wiki 知识库 | `pages/WikiPage/` | `pages/wiki/WikiPage/` | `/wiki` | `/wiki` | **无缩水**（内容有改动：`KnowledgeGraph.tsx` -w diff 175 行） |
| 3 | Code_Graph 代码源 | `pages/CodePage/` | `pages/code/CodePage/` | `/code` | `/code` | **无缩水，有增强**：新增 `code-analysis-view.tsx`(255)、`code-graph-view.tsx`(247)，由 `code-detail-view.tsx` 装配 |
| 4 | Skill 技能 | `pages/SkillsPage/` | `pages/skills/SkillsPage/` | `/skills` | `/skills` | **无缩水**（`ForkSkillDialog`/`ImportSkillDialog`/`SkillDetailPane` 逐字节相同） |
| 5 | Chat_Memory | `pages/ChatMemoryPage/` | `pages/memory/ChatMemoryPage/` | `/memory` | `/memory` | **轻微缩水**：① 新增 team/project/agent/user 四维筛选（增强）；② **L1 记忆层列表的「刷新」按钮消失**——`useChatMemory` 的 `refreshLayer` 被删除（见 A.2-3） |
| 6 | 成员管理 | `pages/MembersPage/index.tsx` | `pages/team/MembersPage/index.tsx`（**已无引用**） | `/team/members` | `/team/members` → `<Navigate to="/team">` | **已合并改道**，无缩水：落到 `TeamDetailPage` → `TeamManagementPanel section="members"` |
| 7 | Agents 管理 | `pages/AgentsPage/index.tsx` | `pages/team/AgentsPage/index.tsx`（**已无引用**） | `/team/agents` | `/team/agents` → `<Navigate to="/team">` | **已合并改道**，无缩水：同上，`section="agents"` |
| 8 | API Key | `pages/ApiKeysPage/` | `pages/team/ApiKeysPage/` | `/team/api-keys` | `/team/api-keys` | **无缩水**（`ApiKeyPanel.tsx` 忽略空白的 diff 仅 6 行，属重新缩进） |
| 9 | 使用说明 | `pages/GuidePage/` | `pages/GuidePage/` | `/guide` | `/guide` | **无缩水**（`index.tsx`/`MemCommands.tsx`/`memCommandsData.ts`/`style.css` 全部相同） |
| 10 | 资源页共享壳 | `pages/ResourcePage/` | `pages/ResourcePage/` | 非路由 | 非路由 | 保留并增强：新增 `AssetListPanel.tsx`/`AssetMarkdown.tsx`/`AssetPageHeader.tsx` |

**团队管理功能面净变化（`已合并改道` 的定量佐证）**

| 组件 | 早期版 | 当前版 | -w diff |
|---|---|---|---|
| `TeamManagementPanel.tsx` | `components/team/` 388 行 | `pages/team/components/` 427 行 | 88 行 |
| `MemberSection.tsx` | 470 行 | 529 行 | 74 行 |
| `AgentGrid.tsx` | 367 行 | 403 行 | 51 行 |
| `AgentEditDialog.tsx` / `CreateAgentDialog.tsx` | 443 / 415 | 448 / 419 | 18 / 17 行 |
| `shared.tsx` / `useAgentAssets.ts` | 158 / 130 | 213 / 173 | 82 / 44 行 |

且当前版把 `TeamDetailPage` 扩成 **8 个 Tab**（`members / agents / patterns / tools / agentteams / automations / runs / approvals`，`TeamDetailPage.tsx:18`），远超早期版的「成员页 + Agent 页」两个独立页面。

### A.2 只有早期版有（= 丢失）

| # | 项目 | 规模 | 判定 | 证据链 |
|---|---|---|---|---|
| **1** | **「线上调用情况」可观测分析页 `AnalyticsPage`** | **29 个文件**（16 组件 + 6 hooks + 4 utils + 1 css + index） | ✅ **确定丢失**（且**非有意为之**） | ① 目录 `pages/AnalyticsPage/` 在当前版不存在（`comm -23` 命中 29 条）；② 路由未注册：早期版 `routes/index.tsx:30` `{ path: 'analytics', element: <AnalyticsPage /> }`，当前版 `routes/index.tsx` 无 `analytics`；③ 菜单无入口：早期版 `constants/menu.tsx:48` `analytics: {... group: t('menu.group.observability') }`（`PageId` 联合类型里 `'analytics'` 在 `:28`），当前版 `constants/menu.tsx` 的 `PageId` 联合类型已删除 `'analytics'`；④ `ConsoleLayout.tsx` 当前版删掉了 `usePanelAnalyticsEnabled/useAnalyticsChConfigured` 三层可见性判定（早期版 `:148-153`）；⑤ 顶栏无入口（`GlobalHeader/index.tsx` 无 analytics）。**但周边设施全部还在**：`lib/api/analytics.ts`（540 行）与 `services/usePanelCapabilities.ts` **与早期版逐字节相同**（`diff -q` 无输出），`i18n/zh-CN.ts` 中 **151 行 `analytics.*` 文案**全量保留（`grep -c "'analytics\." src/i18n/zh-CN.ts` = 151），后端 `/api/v1/analytics/*` 16 个 action 与 MemoryCore `/v3/analytics/*` 16 条路由均仍在注册。→ **纯粹是页面/入口被抹掉，不是能力被裁。** |
| **2** | **「默认 Agent 模板」管理（仅 system_admin）** | `components/team/DefaultAgentTemplateSection.tsx` + `DefaultAgentTemplateDialog.tsx` | ✅ **确定丢失**（UI 层） | ① 两文件在当前版**全仓库不存在**（`find src -name "DefaultAgentTemplate*"` 无输出）；② 早期版入口在 `TeamManagementPanel.tsx:293` 渲染 `<DefaultAgentTemplateSection>`；③ 后端**仍在**：`MemoryPanel/src/panel/api/meta-actions.ts:61-62` 白名单含 `agent/set-default-template`、`agent/get-default-template`，且 `routes/meta/proxy.ts:186,198` 有专门的参数组装逻辑；④ 前端 API client **仍在**：`lib/api/agents.ts:191,198`（`getDefaultTemplate`/`setDefaultTemplate`）。→ **唯一缺的就是那两块 UI 组件。** |
| **3** | **Chat_Memory L1 层列表的「刷新」按钮** | 1 个 hook 导出 + 1 处 `onRefresh` | ✅ **确定丢失**（用户可感知，程度轻） | 早期版 `pages/ChatMemoryPage/hooks/useChatMemory.ts:589` 定义 `refreshLayer` 并在 `:638` 导出，`ChatMemoryPanel.tsx:76,273` 以 `onRefresh={refreshLayer}` 传给层列表组件；当前版 `grep -rn refreshLayer src` **无任何命中**（hook 与调用点一起删除）。 |
| 4 | `pages/ResourcePage/components/AdminResourceLock.tsx`、`AssetScopeManager.tsx` | 2 文件 | ❌ **不是丢失**（早期版即死代码） | 早期版死模块扫描同样命中这两个文件（无人 import）；仅注释里被提及（`services/permissions.ts:17`、`services/backendStore.ts:312`）。属继承下来的死代码，两版一致。 |
| 5 | `components/team/*` 旧路径（10 文件） | 10 文件 | ➖ **已合并改道**（目录迁移） | 迁移到 `pages/team/components/`（8 个），另 2 个 `DefaultAgentTemplate*` 属上面第 2 项的真删除。 |
| 6 | `lib/asset-common.ts` | 1 文件 | ➖ **已合并改道**（去重内联） | 早期版 `wiki-constants.ts:9-10`、`code-constants.ts:8-9`、`ChatMemoryPage/constants/types.ts:2` 均 re-export 它；当前版把这些类型/`formatShortTime` 直接内联进各自的 `wiki-constants.ts`/`code-constants.ts`/`memory/.../types.ts`，`asset-common.ts` 变成孤儿（0 引用）。 |
| 7 | `components/asset/UserBadge.tsx` 的使用 | 1 组件 | ➖ **已合并改道**（等价替换） | 早期版 `ChatMemoryPanel.tsx:22,203` 与 `SkillsPanel.tsx:42,252` 使用；当前版改用 `pages/ResourcePage/components/AssetListPanel` 导出的 `AssetBadge`/`AssetBadgeYou`，并在 `ChatMemoryPanel.tsx:29-34` 自建 `UploaderBadge`（功能等价，且用 `useUserDisplayName` 显示昵称）。 |

**「确定丢失」净清单 = 3 项**（第 1、2、3 项）。其余是迁移/替换/继承死代码。

### A.3 只有当前版有（新增）

| # | 模块 | 文件 | 路由 | 说明 |
|---|---|---|---|---|
| 1 | **代码分析（壳）** | `pages/codeanalysis/AnalysisShellPage.tsx`(751) | `/analysis` | Git 仓库列表 + 上传 + workspace 探测 + 私有仓库凭据管理（`components/GitCredentialManager.tsx`） |
| 2 | **代码分析（仓库详情）** | `pages/codeanalysis/CodeAnalysisRepoPage.tsx`(116) | `/analysis/:cgId` | 面包屑 + tabs 切「代码分析 / 代码图谱」 |
| 3 | **代码分析工作台（17 个工具，6 分类）** | `pages/codeanalysis/components/AnalysisWorkbench.tsx`(317) + `constants.ts` | 由 #2 承载 | 分析工具经浏览器直连 KS `/v3/tools/call` |
| 4 | **代码图谱** | `pages/codegraph/CodeGraphPage.tsx`(242) + 13 组件 | `/analysis/:cgId?tab=graph`；旧 `/graph` 重定向 | 三栏可拉伸布局（FileTree / GraphCanvas / RightPanel） |
| 5 | **记忆空间** | `pages/memory-space/MemorySpacesPage.tsx`(171) | `/memory-spaces` | Tab「空间列表 / 平台能力」；平台能力面板覆盖 feedback / review / playbook / scene / quality / eval / metrics / dreaming / lifecycle |
| 6 | 记忆空间详情 | `pages/memory-space/MemorySpaceDetailPage.tsx`(36) | `/memory-spaces/:spaceId` | **骨架**（页内自述「骨架阶段，不接真实数据」） |
| 7 | **协作项目** | `pages/projects/index.tsx`(200) | `/projects` | 项目列表 + 新建（visibility 仅 admin 可选 team）+ 下探 |
| 8 | 项目详情 | `pages/projects/ProjectDetailPage.tsx`(221) | `/projects/:id` | 8 Tab：目标/决策/交付物/讨论/规范约定（真实 CRUD，走 `KnowledgeEntryPanel`）+ 记忆空间（骨架）+ 成员 + 资产 |
| 9 | **团队列表** | `pages/team/TeamListPage.tsx`(166) | `/team` | admin 可新建团队 |
| 10 | 团队详情 | `pages/team/TeamDetailPage.tsx`(123) | `/team/:teamId` | **8 Tab**：成员/Agents/工作模式/工具源/AgentTeam/自动化/运行轨迹/写审批 |
| 11 | Agent 详情 | `pages/team/AgentDetailPage.tsx`(64) | `/team/agents/:id` | **骨架**（4 Tab 全为占位文案） |
| 12 | **管理后台** | `pages/admin/{UserManagementPage.tsx(452), ModelConfigPage.tsx(88), PermissionManagementPage.tsx(482), AuditLogPage.tsx(106)}` | `/admin/users`、`/admin/model-config`、`/admin/permissions`、`/admin/audit-log` | 早期版完全没有 |
| 13 | 顶栏用户下拉菜单 | `layouts/GlobalHeader/index.tsx:100-158` | — | 新增 5 个入口：API Key / 用户管理 / 公共模型配置 / 权限管理 / 审计日志 |
| 14 | 粒度权限 hook | `lib/usePermission.ts`（调 `permission/check`） | — | 早期版无 |
| 15 | 新增业务面板组件（7 个） | `components/{KnowledgeEntryPanel, ToolSourcePanel, AgentTeamPanel, AutomationPanel, RunTracePanel, WriteApprovalPanel, MemoryResultView}.tsx` | — | 全部挂在 TeamDetailPage 各 Tab |
| 16 | 新增前端 API 模块（12 个） | `lib/api/{acl, agentTeams, audit, automations, git-credentials, knowledge, memory, model-config, permission, projects, runTraces, toolSources}.ts` | — | 早期版 14 个模块 → 当前版 26 个 |

---

## B. 前端能力盘点（当前版）

### B.1 页面清单 + 主要 API

| 路由 | 页面入口 | 主要 API 模块 | 关键调用 |
|---|---|---|---|
| `/` | `pages/workbench/WorkbenchPage/index.tsx` | `services`(backendStore)、`lib/api/projects` | `useTasks/useTeams/useAgents/createTask/updateTaskStatus` + `projectsApi.list` |
| `/wiki` | `pages/wiki/WikiPage/index.tsx` | `lib/knowledge-api` | `knowledgeApi.wiki.*`（26 处） |
| `/code` | `pages/code/CodePage/index.tsx` | `lib/knowledge-api` | `knowledgeApi.code.*`（31 处） |
| `/analysis` | `pages/codeanalysis/AnalysisShellPage.tsx` | `lib/knowledge-api`、`lib/api/{agents,projects,users,git-credentials}` | `codeGraph{List,Create,DetectWorkspace}`、`gitCredentialsApi` |
| `/analysis/:cgId` | `pages/codeanalysis/CodeAnalysisRepoPage.tsx` | 同上 + `pages/codegraph` | `knowledgeApi` + KS `/v3/tools/call` |
| `/skills` | `pages/skills/SkillsPage/index.tsx` | `lib/api/skill-api`、`lib/teamApi` | `skillApi.*`、`useSkillsPanel`（542 行） |
| `/memory` | `pages/memory/ChatMemoryPage/index.tsx` | `lib/teamApi`、`lib/api/{projects,users}`、`lib/api/chat-memory` | `useChatMemory`（653 行）、`chatMemoryApi.*` |
| `/memory-spaces` | `pages/memory-space/MemorySpacesPage.tsx` | `lib/api/memory`、`lib/api/projects` | `memoryApi.spaceList` + 平台能力面板（23 个 `memoryApi` 方法） |
| `/memory-spaces/:spaceId` | `pages/memory-space/MemorySpaceDetailPage.tsx` | 无 | **骨架，零 API 调用** |
| `/projects` | `pages/projects/index.tsx` | `lib/api/{projects,teams}` | `projectsApi.*` |
| `/projects/:id` | `pages/projects/ProjectDetailPage.tsx` | `lib/api/{projects,assets}` | `projectMembersApi`、`assetsApi`、`KnowledgeEntryPanel` |
| `/team` | `pages/team/TeamListPage.tsx` | `lib/teamApi`、`stores/backend` | `teamsApi.*`、`refreshTeams` |
| `/team/:teamId` | `pages/team/TeamDetailPage.tsx` | `lib/api/{memory,knowledge,agentTeams,automations,runTraces,toolSources}` | 8 Tab 全量面板 |
| `/team/agents/:id` | `pages/team/AgentDetailPage.tsx` | 无 | **骨架，零 API 调用** |
| `/team/api-keys` | `pages/team/ApiKeysPage/index.tsx` | `lib/teamApi` | `userKeysApi.*` |
| `/admin/users` | `pages/admin/UserManagementPage.tsx` | `lib/api/users` | `usersApi.*` |
| `/admin/model-config` | `pages/admin/ModelConfigPage.tsx` | `lib/api/model-config` | `modelConfigApi.get/set` |
| `/admin/permissions` | `pages/admin/PermissionManagementPage.tsx` | `lib/api/{permission,acl}` | `permissionApi.*`、`aclApi.*` |
| `/admin/audit-log` | `pages/admin/AuditLogPage.tsx` | `lib/api/audit` | `auditApi.list` |
| `/guide` | `pages/GuidePage/index.tsx` | 无 | 静态说明 + `memCommandsData` |

### B.2 公共能力（当前版）

| 类别 | 内容 |
|---|---|
| **stores** | `stores/auth.ts`（zustand，`checkSession/setAuth/logout`）、`stores/backend.ts`（teams/agents/tasks 缓存 + `invalidateBackendCache`） |
| **services（12 个）** | `account-store`、`agent-template-store`、`asset-scope-store`、`backendStore`(最大)、`permissions`、`storage-utils`、`use-skill-detail-cache`、`useCurrentRole`、`usePanelCapabilities`、`user-asset-store`、`user-profile-store`、`index.ts` |
| **API 客户端（26 个模块）** | `lib/api/*` + `lib/knowledge-api.ts`(685) + `lib/teamApi.ts`(聚合再导出) |
| **hooks** | `lib/usePermission.ts`、`lib/useResizable.ts`、`services/useCurrentRole.ts`、`services/usePanelCapabilities.ts` |
| **布局** | `ConsoleLayout`（侧栏 + TabBar 多标签 + 引导回放）、`GlobalHeader`（语言切换/团队切换/用户下拉/使用说明）、`OnboardingGuide`、`TabBar` |
| **共享组件** | `LoginGate`、`MarkdownView`、`MermaidBlock`、`StatusTag`、`OwnerLabel`、`SettingsDialog`、`ParticleWaveBackground`、`RouteGuards`、`components/asset/*`(6)、`components/team/*`(3) |
| **i18n** | `i18n/{zh-CN,en-US}.ts`，`react-i18next` ↔ tea-component locale 同步（`App.tsx:41-46`） |

### B.3 死代码 / 半成品 / 入口缺失（当前版）

**(a) 完全无引用的模块（23 个）** — 方法：解析每个文件的 `@/` 与相对 import 说明符并回解到文件，取差集（脚本口径见文末）。

| 文件 | 行数 | 性质 |
|---|---|---|
| `pages/codegraph/components/{AIChatPanel, CodeInspector, CodeReferencesPanel, NexusChatPanel, ProcessFlowModal, ProcessesPanel, QueryFAB, NodeTypeLegend}.tsx` | 95/55/68/297/80/60/109/38 = **802** | **半成品**：`restore-analysis-features` change 的 F1–F6 只写了组件、没接线（见下） |
| `pages/codeanalysis/CodeAnalysisPage.tsx` | 62 | 旧「左侧 6 个分析入口」壳，被 `AnalysisShellPage` + `CodeAnalysisRepoPage` 取代 |
| `pages/WorkbenchPage/index.tsx` | 32 | 旧页面壳（其 `components/` 与 `hooks/` 仍被 `pages/workbench/` 复用） |
| `pages/team/AgentsPage/index.tsx`、`pages/team/MembersPage/index.tsx` | 19 / 19 | 路由已改为重定向，薄壳成为孤儿 |
| `pages/admin/UserManagementPage/index.tsx` | 488 | **与 `pages/admin/UserManagementPage.tsx`(452) 同名重复**；Vite 解析 `UserManagementPage.tsx` 优先（`routes/index.tsx:24`），目录版永不加载 |
| `pages/workbench/WorkbenchPage/components/MemoryCapabilitiesPanel.tsx` | — | 与 `pages/memory-space/components/MemoryCapabilitiesPanel.tsx` 重复；后者被 `MemorySpacesPage` 使用，前者孤儿 |
| `pages/ResourcePage/components/{AdminResourceLock,AssetScopeManager}.tsx` | — | **两版都死**（非本次回归） |
| `components/ResourceFilterBar/ResourceFilterBar.tsx`、`components/asset/UserBadge.tsx`、`lib/asset-common.ts` | 128/~30/— | 被新组件/内联实现取代后未清理 |
| `layouts/TeamSwitcher/TeamSwitcher.tsx` | 175 | 被 `layouts/GlobalHeader/TeamSwitcher.tsx`(288) 取代 |
| `services/usePanelCapabilities.ts` | — | 早期版唯一的消费者是 `ConsoleLayout` 与 `AnalyticsPage`，两者在当前版都已不引用它 |
| `components/asset/{AssetListPanel,AssetMarkdown,AssetPageHeader}.tsx` | — | 与 `pages/ResourcePage/components/` 下同名版本重复（`AssetPageHeader`/`AssetListPanel` 逐字节相同） |

**(b) `restore-analysis-features` 半成品（最典型）**

`.specs/restore-analysis-features/CHANGE.md` 明确要求恢复 F1 AI 对话 / F2 Process 分析 / F3 文件内容 / F4 代码引用 / F5 全局搜索 / F6 节点类型统计 六项。现状：

| 需求 | 前端组件 | 是否接线 | 后端接口 |
|---|---|---|---|
| F1 AI 实时分析 | `NexusChatPanel.tsx`(297)、`AIChatPanel.tsx`(95)、`QueryFAB.tsx`(109) | ❌ 0 引用 | ✅ `GET /knowledge/code-graph/engine/chat`（`code-graph-routes.ts:362`） |
| F2 Process 分析 | `ProcessesPanel.tsx`(60)、`ProcessFlowModal.tsx`(80) | ❌ 0 引用 | ✅ `engine/processes:356`、`engine/process-flow:357` |
| F3 文件内容 | `CodeInspector.tsx`(55) | ❌ 0 引用 | ✅ `engine/file:273`、`engine/tree:290` |
| F4 代码引用 | `CodeReferencesPanel.tsx`(68) | ❌ 0 引用 | ➖ 未确认 |
| F5 全局搜索 | `QueryFAB.tsx` | ❌ 0 引用 | ✅ `engine/search:358` |
| F6 节点类型统计 | `NodeTypeLegend.tsx`(38) | ❌ 仅注释提及（`CodeGraphPage.tsx:39,41`） | ✅ `engine/node-types:359` |

`CodeGraphPage.tsx:22-27` 实际只装配 `GraphCanvas / FileTreePanel / CodeGraphHeader / RightPanel / StatusBar / constants` 六项；`RightPanel.tsx` 内部自带一份简易 chat + processes 实现。→ **802 行组件已写好但没挂上路由/页面，属「能修好、没修完」。**

**(c) 重复路由注册（后端缺陷，当前版）**

| 位置 | 问题 |
|---|---|
| `MemoryPanel/src/panel/http/app.ts:38` 与 `:40` | `registerMemoryProxyRoutes(api, deps)` **连续注册两次** |
| `MemoryPanel/src/panel/http/routes/chat-memory.ts:228` 与 `:275` | `POST /chat-memory/list-combined` 注册两次 |
| `MemoryPanel/src/panel/http/routes/knowledge/code-graph-routes.ts:290` 与 `:323` | `GET engine/tree` 注册两次（第二份为死代码） |

**(d) 其他前端缺陷**

- `/admin/users` 是四个后台路由里**唯一没有 `AdminOnlyGuard`** 的（`routes/index.tsx:59` vs `:60-62`），而 `pages/admin/UserManagementPage.tsx` 内部也没有 `useCurrentRole()` 角色判定（grep 无命中）→ 任何登录用户直接敲 URL 都能打开「用户管理」页；后端 `user/list` 是否兜底 **未确认**。其余 3 个后台页走 `AdminOnlyGuard` 会重定向。
- `GlobalHeader/index.tsx:145,157` 的「权限管理」「审计日志」两项是**硬编码中文**，没走 `t()`；而同菜单其余项走 `t('menu.*')`。
- `lib/api/auth.ts:179-190` 的 `environmentBindingsApi`（GET/POST/DELETE `/api/v1/users/me/environment-bindings`）在**两版**都无 UI 调用点，且两版 MemoryPanel / MemoryCore 后端都**没有对应路由** → 属遗留死 client；实际提供方 **未确认**。

---

## C. 后端能力盘点（当前版）

### C.1 MemoryCore（记忆内核）

- 框架：**手写 `node:http`**（`MemoryCore/src/gateway/server.ts:713` `http.createServer`），前缀闸门 + 路径常量表分发（`server.ts:906-1200`、`v2-router.ts:415-468`、`metadata/router/v3-meta-router.ts:94-571`、`gateway/v3-memory-router.ts:139-267`）。
- **173 → 254 条路由，删除 0，新增 81**。

| 功能域 | 早期版 | 当前版 | Δ |
|---|---|---|---|
| L0–L3 数据面（`/v2`+`/v3` conversation/atomic/scenario/core） | 32 | 32 | 0 |
| Meta `/v3/meta/*` | 61 | 113 | **+52** |
| 记忆能力 `/v3/memory/*` | 0 | 26 | **+26** |
| Skills `/v3/skill/*` | 17 | 17 | 0 |
| **Analytics `/v3/analytics/*`** | **16** | **16** | **0（关键：可观测后端完整保留）** |
| Memory-Prompt / Generation-Log | 7 / 2 | 7 / 2 | 0 |
| Knowledge（内核侧） | 5 | 5 | 0 |
| **LLM Runtime `/v3/llm/*`** | 0 | 3 | **+3** |
| Offload / Internal Meta / v2 废弃 entity / v1 legacy | 3 / 3 / 16 / 6 | 同 | 0 |
| **合计** | **173** | **254** | **+81** |

`/v3/memory/*` 26 条全清单（当前版独有）：
`feedback/{detect,decide}`、`review/{gate,approve-or-reject}`、`approval/{resolve-level,needs,authorize-decision}`、`playbook/{assemble,synthesize}`、`scene/{readiness,publish,validate}`、`quality/transition`、`eval/retrieval`、`metrics/consolidation`、`dreaming/run`、`execution-bundle/resolve`、`lifecycle/{decide,detect-relation,is-low-value}`、`skill-version/transition`、`consolidation/execute`、`space/list`、`write-approval/{list,approve,reject}`。

`/v3/meta/*` 新增 52 条：`project/*`(6)、`project-member/*`(4)、`agent-team/*`(5)、`agent-team-member/*`(3)、`automation/*`(5)、`run-trace/*`(5)、`tool-source/*`(5)、`knowledge-entry/*`(5)、`permission/*`(4)、`git-credential/*`(4)、`config/global/*`(2)、`asset/list-by-project`、`audit/list`、`auth/login`、`user/set-password`。

**文档漂移（重要）**：`MemoryCore/v3-api-memorycore-doc.md` 两版 **md5 完全相同**（`2856fbc104455e061e8b7025c50464b3`，39878 bytes），文档自称 108 个接口，而当前版源码实现 254 条 → **104 条已实现但未文档化**（`/v3/analytics/*` 16、`/v3/llm/*` 3、`/v3/memory/*` 26、meta 58、`/v2/offload/*` 3、`instance-upstream/*` 4 …）。**文档不能作为能力变更证据。**

### C.2 MemoryPanel（控制台 / 代理层）

- 框架：**Hono** + `@hono/node-server`，前缀 `/api/v1`（`MemoryPanel/src/panel/http/app.ts:19,51`）。
- **67 → 82 条路由，删除 0，新增 15**；meta action 白名单 **55 → 105，删除 0，新增 50**。

当前版路由分组：

| 分组 | 条数 | 源文件 |
|---|---|---|
| 认证 / 会话（`/auth/*`、`/meta/instances`、`/health`） | 16 | `routes/auth.ts`、`routes/meta/instances.ts` |
| Meta 元数据透明代理 `/api/v1/meta/*`（白名单 105 action） | 1 条通配 | `routes/meta/proxy.ts:149` |
| Skill 数据面代理 `/api/v1/skill/*`（15 action） | 1 条通配 | `routes/skill/proxy.ts:27` |
| **Analytics 查询代理 `/api/v1/analytics/*`（16 action）** | 1 条通配（GET/POST） | **`routes/analytics/proxy.ts:65-66`** |
| 记忆能力代理 `/api/v1/memory/*`（26 action） | 1 条通配 | `routes/memory/proxy.ts:25` |
| Chat-Memory 业务路由（16 条） | 16 | `routes/chat-memory.ts` |
| Task 聚合 / Agent 概览 / Agent 生命周期 | 3 | `routes/task.ts:85`、`routes/agent-overview.ts:159`、`routes/agent-lifecycle.ts:90` |
| Knowledge（wiki 14 + code-graph 11 + engine 8 + gitnexus 通配 + allocate/callback/list） | ~40 | `routes/knowledge/*` |
| 静态 SPA 回退 | 1 | `http/app.ts:76` |

**能力域覆盖（当前版）**：analytics ✅ / assets ✅ / teams·members·agents·API keys ✅ / skills ✅ / knowledge·wiki ✅ / code sources·code graph ✅（含 `graph`、`analyze`、`detect-workspace`、`engine/*`8、`gitnexus/*`17、仓库 auth 凭据）/ chat memory ✅ / tasks·workbench ✅ / **projects ✅（当前版独有）** / **memory spaces ✅（仅 `space/list` 只读）** / users·model config ✅ / **permissions ✅、audit ✅** / **run-trace·automation·git-credential·tool-source·knowledge-entry·agent-team ✅** / acl ✅。

- `panel-api-doc.md` 两版 **逐字节相同**，均未记录 `/analytics/*`、`/memory/*`、`list-scope`、`list-combined`、`code-graph/{graph,analyze,detect-workspace,engine/*}`、`gitnexus/*` → 文档同样滞后。

### C.3 后端已实现但前端没有入口（「可用但没暴露」）

| # | 能力 | 后端证据 | 前端现状 | 严重度 |
|---|---|---|---|---|
| **1** | **可观测分析全链路（16 个 analytics action）** | `routes/analytics/proxy.ts:65-66`；MemoryCore `analytics-router.ts:78-93`（16 条） | `lib/api/analytics.ts`(540) 与 `services/usePanelCapabilities.ts` 完好，**页面/路由/菜单全部消失**；`grep -rn analytics src` 只剩 i18n 与这两个模块 | 🔴 高（整页功能） |
| **2** | **默认 Agent 模板配置** | `meta-actions.ts:61-62` 白名单 + `routes/meta/proxy.ts:186,198` 专门逻辑 | `lib/api/agents.ts:191,198` client 在，UI 组件被删，**0 调用点** | 🟠 中 |
| **3** | **代码图谱引擎 8 条只读 + GitNexus 17 工具** | `code-graph-routes.ts:273,290,323,355,356,357,358,359,362`；`gitnexus-routes.ts:43` | 8 个组件（802 行）已写好但 **0 引用**，未接入 `CodeGraphPage` | 🟠 中 |
| **4** | **记忆能力 4 条无 UI** | `approval/resolve-level`、`approval/authorize-decision`（`memory-actions.ts`）；`execution-bundle/resolve`、`review/approve-or-reject` | 前 2 条连 `memoryApi` 方法都没有；后 2 条有方法但 0 个 UI 调用点 | 🟡 低 |
| **5** | **LLM 模型发现（3 条）** | `server.ts:1415,1421,1427`（`GET /v3/llm/providers`、`GET /v3/llm/models`、`POST /v3/llm/models/discover`） | 前端**无任何 client 模块**（`grep -rn '/v3/llm' web/src` 无命中）；`ModelConfigPage` 只配 `module=llm_default` 的静态字段 | 🟡 低 |
| 6 | 其它无前端入口的当前版独有后端 | `/v2/offload/*`(3)、`/v3/meta/instance-upstream/*`(4)、`/v3/internal/meta/*`(3)、`user/set-password` | 无 client | ⚪ 极低（运维/内部面） |

### C.4 前端有入口但后端没实现（「假 UI」）

| # | 入口 | 前端证据 | 后端证据 | 判定 |
|---|---|---|---|---|
| 1 | **记忆空间详情页** `/memory-spaces/:spaceId` | `MemorySpaceDetailPage.tsx:2-6` 自述「骨架阶段为空态，不接真实数据」；全文 **0 个 API 调用**，只有一个 `StatusTip status="empty"` | 记忆空间后端**只有 `space/list` 只读**（`memory-actions.ts:31`），**无 `space/get`**，无 mount/策略更新 | ⚠️ **假 UI（骨架）**，可点进去但永远空 |
| 2 | **Agent 详情页** `/team/agents/:id` | `AgentDetailPage.tsx:2-6`「骨架阶段：字段用前端类型占位，不接后端」；4 个 Tab 全渲染 `TAB_PLACEHOLDER` 文案 | `agent/get` 后端存在但页面**未调用** | ⚠️ **假 UI（骨架）** |
| 3 | **项目详情「记忆空间」Tab** | `ProjectDetailPage.tsx:2-8` 自述「记忆空间（骨架，待接项目级空间）」 | 同上，无项目级空间接口 | ⚠️ **假 UI（骨架）** |
| 4 | `environmentBindingsApi`（`/api/v1/users/me/environment-bindings`） | `lib/api/auth.ts:179-190` 定义完整 | 两版 MemoryPanel / MemoryCore 后端**都无 `/users` 路由** | ⚠️ **假 client**（两版都有；**0 UI 调用点**，实际提供方 **未确认**） |
| 5 | `memoryApi.executionBundleResolve` / `reviewApproveOrReject` | `lib/api/memory.ts` 有方法 | 后端 `/v3/memory/execution-bundle/resolve`、`review/approve-or-reject` **存在** | ⚪ 不是假 UI，是**无调用点的 client 方法** |

> 说明：**没有发现「后端彻底不存在、前端却在正常发请求」的活动假 UI**（除第 4 项那个无人调用的 client）。三个骨架页（1–3）是有意占位的空态，`.specs/agent-collab-ui-redesign/CHANGE.md` 的「范围排除」明确写了「本次交付页面骨架 + 样式，真实数据打通按后续 change 逐个接」，且要求「用空态/占位处理，避免点了没数据」。

---

## D. 结论

### D.1 丢失清单（按严重程度）

| 排序 | 项目 | 判定 | 用户可感知？ | 严重度 | 性质 |
|---|---|---|---|---|---|
| 1 | **「线上调用情况」可观测分析页（29 文件、2 Tab、KPI/成员/模型/trace/成本/drill-down）** | **确定丢失** | ✅ 强烈可感知：管理员少了一个完整功能页，菜单「数据分析」整组消失 | 🔴 **高** | **非有意为之**：`.specs/agent-collab-ui-redesign/CHANGE.md` 从未提及删除 analytics，且 i18n / API client / 能力探测 hook / 后端 16+16 条接口**全部原样保留** → 是导航重构时的误删 |
| 2 | **默认 Agent 模板管理（admin）** | **确定丢失** | ✅ 可感知：管理员无法再配置新 Agent 的默认模板 | 🟠 中 | 非有意为之（UI 组件被删，后端与 client 都在） |
| 3 | **Chat_Memory L1 层列表「刷新」按钮** | **确定丢失** | ✅ 轻微可感知 | 🟡 低 | 重构时连带删除 `refreshLayer` |
| 4 | `pages/team/{AgentsPage,MembersPage}` 薄壳页面 | 已合并改道 | ❌ 不可感知 | ⚪ — | 有意合并：`/team/members`、`/team/agents` 重定向到 `/team`，功能并入 TeamDetailPage 8 Tab |
| 5 | `components/team/*` 路径 | 已合并改道 | ❌ | ⚪ — | 迁移到 `pages/team/components/` |
| 6 | `lib/asset-common.ts`、`components/asset/UserBadge.tsx` | 已合并改道 | ❌ | ⚪ — | 内联去重 / 等价替换 |
| 7 | `AdminResourceLock.tsx`、`AssetScopeManager.tsx` | ❌ 非丢失 | ❌ | ⚪ — | 早期版即无人引用的死代码 |
| 8 | **两个仓库的关系（「谁更早」）** | **未确认** | — | — | 两仓 **无共享 git 历史**（`merge-base` 失败），且早期版 tip 提交时间（2026-09-10）**晚于**当前版 tip（2026-09-09）；`meta-actions.ts` 自 `v2.0.0-beta.1` 起未变。**「OLD 是更早版本」这一点在 git 层面无法证实**，但「OLD 的后端能力集合是 NEW 的严格子集」这一机械事实已确认。若需严格的版本先后对齐，应以共同祖先 commit 重新比对 |

### D.2 当前可用能力总表

| 层 | 可用能力 | 规模 |
|---|---|---|
| **前端页面** | 工作台任务看板、Wiki、Code_Graph、代码分析（壳+详情+17 工具）、代码图谱、Skill、Chat_Memory（L0–L3）、记忆空间（列表+平台能力）、协作项目（列表+详情 8 Tab）、团队（列表+详情 8 Tab）、API Key、管理后台 4 页、使用说明 | **20 个真实路由** + 5 重定向 |
| **前端公共能力** | 26 个 API 客户端模块、2 个 zustand store、12 个 services、权限 hook、i18n（zh/en）、TabBar 多标签、登录门、引导 | — |
| **MemoryCore** | L0–L3 数据面(32)、Meta(113)、记忆能力(26)、Skill(17)、**Analytics(16)**、LLM Runtime(3)、Offload(3)、Knowledge(5)、Memory-Prompt(7)、Generation-Log(2)、Internal Meta(3)、legacy(6)、Health(1) | **254 条路由** |
| **MemoryPanel** | 认证(16)、meta 代理(105 action)、skill 代理(15)、**analytics 代理(16)**、memory 代理(26)、chat-memory(16)、task/agent-overview/agent-lifecycle(3)、knowledge ~40 | **82 条路由** |
| **MemoryKnowledge** | 文件数 77 → 3563（大幅扩充） | 零删除 |
| **MemoryProxy** | 文件数 202 → 212 | 零删除 |

### D.3 修复建议

**应当搬回来（优先级从高到低）**

1. **恢复 `AnalyticsPage`（🔴 最高）** — 这是唯一"用户能直接感知的整页功能缺失"。成本极低：29 个文件可从早期版整目录拷回 `MemoryPanel/web/src/pages/analytics/`，然后
   - `routes/index.tsx` 注册 `{ path: 'analytics', element: <AnalyticsPage /> }`；
   - `constants/menu.tsx` 加回 `'analytics'` 到 `PageId` 并恢复 `observability` 分组；
   - `ConsoleLayout.tsx` 恢复 `usePanelAnalyticsEnabled` / `useAnalyticsChConfigured` 三层可见性判定（这样也让目前孤儿的 `services/usePanelCapabilities.ts` 重新有用）。
   后端零改动（`/api/v1/analytics/*` 与 `/v3/analytics/*` 都在）。
   > 若要"少搬代码"，替代方案是**明确宣告该功能下线**，同时删除 `lib/api/analytics.ts`、`services/usePanelCapabilities.ts`、`i18n` 的 151 行 `analytics.*` 文案，以及后端 analytics 代理与内核 16 条路由——但当前证据（文档未提、周边全留）指向"误删"，建议搬回。

2. **恢复「默认 Agent 模板」UI（🟠 中）** — 拷回 `DefaultAgentTemplateSection.tsx` + `DefaultAgentTemplateDialog.tsx`（适配新路径 `pages/team/components/`），并在 `TeamManagementPanel` 的 AgentGrid 上方按 `isAdmin` 渲染。后端与 client 均无需改动。

3. **恢复 Chat_Memory 层列表刷新（🟡 低）** — 把 `refreshLayer`（早期版 `useChatMemory.ts:589`）搬回并重新以 `onRefresh` 传入。

**应当完成（已写一半）**

4. **接线 `restore-analysis-features` 的 8 个孤儿组件（802 行）** — 后端 `engine/*` 8 条 + `gitnexus/*` 17 工具全部就绪。建议在 `CodeGraphPage` 装配 `NexusChatPanel`（F1）、`ProcessesPanel`+`ProcessFlowModal`（F2）、`CodeInspector`（F3）、`CodeReferencesPanel`（F4）、`QueryFAB`（F5）、`NodeTypeLegend`（F6）；若确实不做，应删除组件与 `.specs/restore-analysis-features/` 避免误导。

**小修（低成本高收益）**

5. `routes/index.tsx:59` 给 `/admin/users` 补 `AdminOnlyGuard`（与另外 3 个后台路由对齐）。
6. 修重复注册：`http/app.ts:38/40`、`chat-memory.ts:228/275`、`code-graph-routes.ts:290/323`。
7. 清理 23 个死模块中的重复副本（`pages/admin/UserManagementPage/index.tsx`、`components/asset/{AssetListPanel,AssetMarkdown,AssetPageHeader}`、`layouts/TeamSwitcher/`、`pages/workbench/.../MemoryCapabilitiesPanel.tsx`）。
8. `GlobalHeader/index.tsx:145,157` 的硬编码中文改走 `t()`。
9. 更新 `MemoryCore/v3-api-memorycore-doc.md`（108 → 254）与 `MemoryPanel/panel-api-doc.md`（补 analytics/memory/code-graph engine/gitnexus），修正 `meta-actions.ts:2`（写"55 条"实为 105）与 `memory-actions.ts:2`（写"23 条"实为 26）的注释。

**有意为之，无需回滚**

10. `/team/members`、`/team/agents` → `/team` 的重定向与 TeamDetailPage 8 Tab 合并（功能净增）。
11. `/graph` → `/analysis` 的重定向与 CodePage/CodeGraph/代码分析的三方重组（功能净增，`code-analysis-view`/`code-graph-view` 为新增）。
12. 三个骨架页（记忆空间详情、Agent 详情、项目记忆空间 Tab）：符合 `.specs/agent-collab-ui-redesign/CHANGE.md` 的「先出骨架、空态占位」决策，**建议保留**，但应在 UI 上更明确标注"未接入"，避免被当成 bug。

---

## 附录

### 附 1 复现命令

```bash
O=/home/malizhi/project/my-tencentDB-Agent-memory
N=/home/malizhi/project/TencentDB-Agent-Memory

# 1) 页面/文件级对账
(cd $O/MemoryPanel/web/src && find . -type f | sed 's|^\./||' | sort) > /tmp/old-web.txt
(cd $N/MemoryPanel/web/src && find . -type f | sed 's|^\./||' | sort) > /tmp/new-web.txt
comm -23 /tmp/old-web.txt /tmp/new-web.txt   # 82 条，全部在 web/src

# 2) 后端删除量（三个子项目应为空）
for s in MemoryCore MemoryKnowledge MemoryProxy MemoryPanel; do
  (cd $O/$s && find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sort) > /tmp/o-$s.txt
  (cd $N/$s && find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sort) > /tmp/n-$s.txt
  echo "$s only-in-OLD: $(comm -23 /tmp/o-$s.txt /tmp/n-$s.txt | wc -l)"
done

# 3) 路由/入口是否还在
grep -n "analytics" $N/MemoryPanel/web/src/routes/index.tsx $N/MemoryPanel/web/src/constants/menu.tsx
grep -rn "refreshLayer\|DefaultAgentTemplate" $N/MemoryPanel/web/src

# 4) 后端是否仍暴露
grep -n "analytics" $N/MemoryPanel/src/panel/http/app.ts
grep -n "default-template" $N/MemoryPanel/src/panel/api/meta-actions.ts

# 5) 忽略空白的真实改动量
diff -w -B $O/.../file $N/.../file | grep -c '^[<>]'
```

### 附 2 未确认项（明确不猜）

| 项 | 状态 |
|---|---|
| 两仓版本先后（OLD 是否真的"更早"） | **未确认**：无共享 git 历史，`merge-base` 失败；OLD tip 提交时间反而更晚。能力集合上的严格子集关系已确认 |
| `/api/v1/users/me/environment-bindings` 的实际提供方 | **未确认**：两版 MemoryPanel / MemoryCore / MemoryKnowledge / MemoryProxy 均无实现；前端也无调用点 |
| 早期版是否存在 `skill fork` 语义接口 | **未确认**：两版 `skill-actions.ts` 均无 `fork` 关键字（`ForkSkillDialog` 走的是其它端点组合） |
| 早期版是否曾拥有 project / automation / run-trace 后端后被删 | **未确认**：本机 OLD 仓库为公开 34 提交历史，`meta-actions.ts` 自 `v2.0.0-beta.1` 起未变动，**未见删除痕迹**；更早的内部版本无法从本机判定 |
| 后端 `user/list` 是否对 `/admin/users` 的无守卫访问兜底 | **未确认**（未实测运行时权限） |
| `engine/*` 路由把 Panel 宿主机文件系统暴露给已登录用户的鉴权充分性 | **未确认**（代码有 `path.resolve`+`startsWith` 越权校验，`code-graph-routes.ts:295-297`，但仅校验面板登录态） |
