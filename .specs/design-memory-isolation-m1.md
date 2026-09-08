# M1 落地 DESIGN — project 一等实体 + 资产 scope 织入

> 上承 `.specs/CONTEXT.md`「记忆隔离与权限模型」。范围：只做数据地基（project 实体 + 资产挂 project + scope 推导 + gateway 路由），不碰 RBAC 强制(M2)、proxy 读写对称(M3)、前端双维度(M4)、自研 adapter(M5)——那些是后续里程碑，本设计只给它们留好接缝。

## 0. 目标与不目标

**做**：
- 新增 `meta_projects` + `meta_project_members` 两张表。
- 给 6 类资产中的 4 类核心存储加可空 `project_id` 列（零回归：null=未挂项目，走原逻辑）。
- 定义 `scope` 推导规则（public / user / project 三桶，不额外存字段，由已有字段推导）。
- gateway 新增 `/v3/meta/project/*` 路由最小闭环。

**不做**（M2+）：
- RBAC 统一强制、删除权收敛、proxy 注入三块并集、前端 project 页/双维度、取数锚定注册表。

## 1. Schema（SQLite 增量迁移）

```sql
CREATE TABLE IF NOT EXISTS meta_projects (
  project_id       TEXT PRIMARY KEY,
  team_id          TEXT NOT NULL,                    -- 主归属 team（组织用）；members 可跨 team
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  owner_user_id    TEXT NOT NULL,                    -- 创建者（默认 manager）
  manager_user_id  TEXT,                             -- 项目管理者；null = 仅 owner
  visibility       TEXT NOT NULL DEFAULT 'private',  -- private | team | restricted（复用 AssetVisibility 前 3 档）
  default_agent_id TEXT,
  repo_url         TEXT,                             -- 主 git remote（锚定键）
  git_repo_urls    TEXT NOT NULL DEFAULT '[]',       -- JSON: 多 repo（跨 repo 项目）
  path_globs       TEXT NOT NULL DEFAULT '[]',       -- JSON: workspace 路径 glob（无 git 资料型项目）
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta_project_members (
  project_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',        -- member | manager
  granted_by  TEXT,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON meta_project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team ON meta_projects(team_id);
```

## 2. 资产织入（只加列，零回归）

> ✅ 已落地（M1b）。`project_id` 落在「鉴权权威层」+「知识内容层」，未重复落 scope（scope 是派生值）。

| 资产类型 | 存储表 | 新增列 | 状态 |
|---|---|---|---|
| agent | `meta_agents` | `project_id TEXT`（可空） | ✅ |
| code-graph | `entity_knowledge`(type=code-graph) | `project_id TEXT`（可空） | ✅ |
| wiki | `entity_knowledge`(type=wiki) | `project_id TEXT`（可空） | ✅ |
| skill | `meta_assets`(asset_type=skill) | `project_id TEXT`（可空） | ✅（鉴权层就绪，M2 再配 RBAC） |
| chat_memory | `meta_assets`(asset_type=chat_memory) | `project_id TEXT`（可空） | ✅（列就绪，M3 读写对称时才真正写） |
| 代码分析 | 分析引擎产物 | 借 code-graph 的 project_id（同一 repo） | ✅ |

> 落点说明：wiki/code-graph 的鉴权在 `entity_knowledge`（team_id/user_id 语义，经 `/v3/knowledge/*` 直连 core store），故列落在内容表；agent/skill/chat_memory 的鉴权在 metadata 模块（`meta_agents`/`meta_assets`），故列落在鉴权表。`meta_assets.source_ref` 已指向 `entity_knowledge.knowledge_id`，两者经 source_ref 关联，不需要双表重复存 project_id。

> 原则：现有数据 `project_id = NULL` → 完全走旧逻辑（私有/团队/ACL），**不加 scope 字段**，scope 是「派生值」。

## 3. scope 推导（public / user / project 三桶，不落库）

```
scope = 'public'   ⇔ visibility = 'team'      AND project_id IS NULL
scope = 'user'     ⇔ visibility = 'private'   AND project_id IS NULL
scope = 'project'  ⇔ project_id IS NOT NULL   （可见域 = project.members，具体再按 visibility 细分）
```

- 读侧 `fetch = public(U 所属 team) ∪ user(U) ∪ project(U 是 member)` 由此三桶直接拼。
- 写侧只决定三件事：`visibility` + `owner_user_id` + `project_id`，scope 自动派生，避免多存一处造成漂移。

## 4. gateway 路由契约（`/v3/meta/project/*`）

沿用现有 `bind(schema, handler)` + `s.assertCanManageXxx` 模式。字段命名对齐现有 `camelCase` + `x-tdai-service-id` + `x-tdai-user-key`。

| action | 权限 | 入参 | 出参 |
|---|---|---|---|
| `project/create` | 登录用户 | `{name, team_id, visibility?, repo_url?, git_repo_urls?, path_globs?}` | `{project}` |
| `project/list` | 登录用户 | `{team_id?, owner_user_id?, member_user_id?, limit?, offset?}` | `{items, total}` 只返回「我 owner / 我 member / team 公共」 |
| `project/get` | 可见者 | `{project_id}` | `{project, members}` |
| `project/update` | owner/manager/system_admin | `{project_id, name?, description?, visibility?, default_agent_id?, repo_url?, git_repo_urls?, path_globs?}` | `{project}` |
| `project/delete` | owner/manager/system_admin | `{project_id}` | `{ok}` |
| `project/grant-member` | owner/manager | `{project_id, user_id, role?}` | `{ok}` |
| `project/remove-member` | owner/manager | `{project_id, user_id}` | `{ok}` |
| `project/set-manager` | owner | `{project_id, user_id}` | `{ok}` |

**可见性约束（M1 即加，避免返工）**：
- `visibility=team`：任何 team 成员可见（团队协作项目）。
- `visibility=private`：仅 owner + members（显式拉入的人）。
- `visibility=restricted`：仅 members。
- 创建默认 `private`（铁律：默认私有、共享显式）。
- `visibility=team`（公共项目）需 system_admin 或 owner 显式发起；普通用户不可把项目设成「团队公共」。

## 5. 与现有 visibility / ACL 的关系

- project 复用 `AssetVisibility` 前 3 档（private/team/restricted），`agent`/`task` 两档不用于 project。
- `meta_project_members` ≈ 一组 ACL，是 project 级资产的可见域；挂 `project_id` 的资产默认继承它，不再单独逐条 ACL。
- 未挂 project 的资产（project_id=null）维持原 visibility/ACL 语义不变。

## 6. 回织 R1/R2/R3 的接缝（本设计只留好，M2-M5 实施）

- **R1 代码分析**：`entity_knowledge(type=code-graph)` 加 `project_id` 后，`analysis_ask` 检索结果按「project 可见域 + user 所属 team 公共」过滤（M2/M3 实施）。
- **R2 agent·llm**：agent 加 `project_id` 后，`metadata_json.ui.llm` 随 agent 的可见域生效：private=本人生效、project=project.members 生效、team=全队（M2 实施）。
- **R3 公共模型**：现状 `llm_default` 全局一份不动；project 落地后，若需 per-team/per-project 默认，把 `llm_default` 的 `scope` 从 global 扩到 team/project（ConfigParam 已支持 scope，M2 后按需）。

## 7. 迁移与回归

- 纯增量：两张新表（`meta_projects`/`meta_project_members`）+ 3 张资产表各加 1 列可空 `project_id`（`meta_agents`/`meta_assets`/`entity_knowledge`），不删不改旧字段。
- 现有数据 `project_id=null` → 行为与今天完全一致（零回归）。
- 迁移用现有 SQLite rawStore 的迁移入口（追加 DDL + `pragma_table_info` 探测式 ALTER），不引入新工具。

## 8. 验收（M1 完成判据）

- [x] `project/create → grant-member → get` 往返正确，cross-team 成员（T2 的 D 加入 T1 的 project）可查。（M1a 已实现：create 自动把 owner 加为 manager member）
- [ ] 资产挂 `project_id` 后，`project/list` 能按 member/owner/team 正确过滤。（M1a 已实现 list 过滤）
- [ ] scope 推导函数单测：6 类资产 × 3 桶 × 有无 project_id 的组合全部正确。（`resolveMemoryScope` 已落地，仓库暂无 vitest 用例目录，单测待补）
- [ ] 现有未挂 project 的资产读写行为与改动前一致（回归）。