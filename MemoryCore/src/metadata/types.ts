/**
 * Metadata module — Entity types & shared contracts.
 *
 * 对应设计文档 08-metadata-migration-and-permission-design.md §2 / §6。
 *
 * 这是从 team-memory-control 搬迁到记忆内核的元数据实体类型定义。
 * 与 core/store 中已有的简化 entity_* 类型不同，这里是完整的业务模型
 * （含 user_key / password / visibility / acl 等）。
 */

import type { GlobalPermission } from "./global-permissions.js";

// ============================
// 枚举与字面量类型
// ============================

export type UserStatus = "active" | "inactive" | "invited";
export type UserType = "normal" | "system_admin";
export type TeamStatus = "active" | "archived";
export type TeamRole = "admin" | "member" | "reviewer";
export type MemberStatus = "active" | "removed";
export type AgentStatus = "active" | "inactive";
export type TaskStatus = "running" | "completed";
export type TaskSourceType = "manual" | "tapd" | "github" | "other";

export type AssetType = "skill" | "llm_wiki" | "code_graph" | "chat_memory";
export type AssetVisibility = "private" | "team" | "restricted" | "agent" | "task";
export type AssetStatus =
  | "draft"
  | "candidate"
  | "approved"
  | "deprecated"
  | "archived"
  | "failed";

export type InjectionMode = "direct" | "summary" | "tool" | "reference";

/** 权限动作（6 类）。 */
export type Permission =
  | "read"
  | "write"
  | "delete"
  | "assign"
  | "share"
  | "use";

/** ACL 授权主体类型。 */
export type AclSubjectType = "user" | "team_role" | "agent";

/** ACL 效果（一期仅 allow，deny 预留）。 */
export type AclEffect = "allow" | "deny";

// ============================
// 实体类型
// ============================

export type UserKeyStatus = "active" | "revoked";

export interface UserEntity {
  user_id: string;
  /** scrypt+pepper 哈希后的密码（`$scrypt$...`），可空。 */
  password?: string | null;
  auth_provider: string;
  external_id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  raw_profile_json: string;
  status: UserStatus;
  user_type: UserType;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export interface TeamEntity {
  team_id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export interface TeamMemberEntity {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  status: MemberStatus;
}

/** team-member/list · get 响应：成员关系 + 读时 JOIN 的 username（不落库）。 */
export interface TeamMemberView extends TeamMemberEntity {
  username: string;
}

// ============================
// Project（协作轴，跨 team）
// ============================

/** 项目可见性：复用 AssetVisibility 前 3 档（private/team/restricted）。 */
export type ProjectVisibility = "private" | "team" | "restricted";

/** 项目成员角色。 */
export type ProjectMemberRole = "member" | "manager";

export interface ProjectEntity {
  project_id: string;
  /** 主归属 team（组织用）；project.members 可跨 team。 */
  team_id: string;
  name: string;
  description?: string | null;
  /** 创建者（默认 manager）。 */
  owner_user_id: string;
  /** 项目管理者；null = 仅 owner。 */
  manager_user_id?: string | null;
  visibility: ProjectVisibility;
  default_agent_id?: string | null;
  /** 主 git remote（锚定键）。 */
  repo_url?: string | null;
  /** JSON 数组：多 repo（跨 repo 项目）。 */
  git_repo_urls: string;
  /** JSON 数组：workspace 路径 glob（无 git 资料型项目）。 */
  path_globs: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberEntity {
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  granted_by?: string | null;
  created_at: string;
}

/** project-member/list · get 响应：成员关系 + 读时 JOIN 的 username（不落库）。 */
export interface ProjectMemberView extends ProjectMemberEntity {
  username: string;
}

// ============================
// Project（协作轴，跨 team）
// ============================

export interface AgentEntity {
  agent_id: string;
  team_id: string;
  owner_user_id: string;
  /** 可空：挂到某 project（协作轴）；null = 团队/个人级 agent。 */
  project_id?: string | null;
  name: string;
  description?: string | null;
  prompt?: string | null;
  visibility: AssetVisibility;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

/**
 * Agent 挂载的记忆空间（持久化记录，agent ↔ space 多对多）。
 *
 * 对应对比差距 §2「Agent 创建时挂载记忆空间（而非事后绑）」：agent 创建时按
 * `mountSpacesForAgent` 默认策略落库，`space_id` 是确定性 id（sp_<sha1 前 12>）。
 * `source` 区分「默认挂载」与「显式挂载/卸载后保留」。
 */
export interface AgentSpaceEntity {
  id: string;
  agent_id: string;
  /** 确定性空间 id：`spaceIdFor(ownerType, ownerId, domain)`。 */
  space_id: string;
  owner_type: string;
  owner_id: string;
  domain: string;
  write_policy: string;
  source: "default_mount" | "explicit";
  created_at: string;
}

/**
 * 记忆空间列表组合筛选（需求 4：团队 × 项目 × Agent × 用户 AND）。
 * 语义：空间跟随其挂载的 agent —— team/project/user 都取 agent 的字段，
 * agent 取 space.agent_id。四者可同时生效。
 */
export interface AgentSpaceFilter {
  /** 挂载目标 agent（space.agent_id）。 */
  agent_id?: string;
  /** agent 所属团队（meta_agents.team_id）。 */
  team_id?: string;
  /** agent 的 project_id（meta_agents.project_id）。 */
  project_id?: string | null;
  /** agent 的 owner（meta_agents.owner_user_id）。 */
  owner_user_id?: string;
}

/** 知识条目作用域：team=团队级（工作模式/组织知识）；project=项目级协作知识。 */
export type KnowledgeScope = "team" | "project";

/** 来源标注（对应 🧠 记忆总结 / 🌐 外部传入 / 🧬 融合）。 */
export type KnowledgeSource = "memory" | "external" | "hybrid";

/** 知识条目类型。convention 在 team 作用域表示组织规范、在 project 作用域表示项目约定。 */
export type KnowledgeKind =
  | "objective"    // 项目级：目标
  | "decision"     // 项目级：决策
  | "deliverable"  // 项目级：交付物
  | "discussion"   // 项目级：讨论
  | "convention"   // 项目级规范 / 团队级工作模式规范
  | "methodology"  // 团队级工作模式：方法论
  | "mindset";     // 团队级工作模式：心智

export interface KnowledgeEntryEntity {
  entry_id: string;
  scope: KnowledgeScope;
  /** team_id 或 project_id。 */
  scope_id: string;
  kind: KnowledgeKind;
  title: string;
  content: string | null;
  status: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeEntryInput {
  entry_id?: string;
  scope: KnowledgeScope;
  scope_id: string;
  kind: KnowledgeKind;
  title: string;
  content?: string | null;
  status?: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json?: string;
}

export interface KnowledgeEntryFilter {
  scope?: KnowledgeScope;
  scope_id?: string;
  kind?: KnowledgeKind;
  source?: KnowledgeSource;
  status?: string;
}

/** 能力资产类工具：MCP Server / REST API。 */
export type ToolSourceKind = "mcp" | "rest";

export interface ToolSourceEntity {
  tool_id: string;
  kind: ToolSourceKind;
  team_id: string;
  name: string;
  description: string | null;
  endpoint_url: string | null;
  transport: string | null;
  auth_config_json: string;
  status: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateToolSourceInput {
  tool_id?: string;
  kind: ToolSourceKind;
  team_id: string;
  name: string;
  description?: string | null;
  endpoint_url?: string | null;
  transport?: string | null;
  auth_config_json?: string;
  status?: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json?: string;
}

export interface ToolSourceFilter {
  team_id?: string;
  kind?: ToolSourceKind;
  source?: KnowledgeSource;
  status?: string;
}

/** 运行载体类：Agent Team（多 Agent 编排）。 */
export interface AgentTeamEntity {
  agent_team_id: string;
  team_id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  status: string | null;
  source: KnowledgeSource;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface AgentTeamMemberEntity {
  id: string;
  agent_team_id: string;
  agent_id: string;
  role: string | null;
  created_at: string;
}

export interface CreateAgentTeamInput {
  agent_team_id?: string;
  team_id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  status?: string | null;
  source: KnowledgeSource;
  meta_json?: string;
  linked_agents?: { agent_id: string; role?: string | null }[];
}

export interface AgentTeamFilter {
  team_id?: string;
  source?: KnowledgeSource;
  status?: string;
}

export interface AgentTeamMemberInput {
  agent_team_id: string;
  agent_id: string;
  role?: string | null;
}

/** 运行载体类：Automation 自动化（定时/触发编排）。 */
export type AutomationTriggerType = "cron" | "webhook" | "manual" | "event";
export type AutomationActionType = "run_agent" | "run_task" | "notify";

export interface AutomationEntity {
  automation_id: string;
  team_id: string;
  name: string;
  description: string | null;
  trigger_type: AutomationTriggerType;
  trigger_config_json: string;
  action_type: AutomationActionType;
  action_config_json: string;
  target_id: string | null;
  status: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationInput {
  automation_id?: string;
  team_id: string;
  name: string;
  description?: string | null;
  trigger_type: AutomationTriggerType;
  trigger_config_json?: string;
  action_type: AutomationActionType;
  action_config_json?: string;
  target_id?: string | null;
  status?: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json?: string;
}

export interface AutomationFilter {
  team_id?: string;
  trigger_type?: AutomationTriggerType;
  action_type?: AutomationActionType;
  status?: string;
}

/** 可回看运行类：Run / Trace 会话回放。 */
export type RunTraceKind = "run" | "trace";

export interface RunTraceEntity {
  run_id: string;
  team_id: string;
  agent_id: string | null;
  task_id: string | null;
  kind: RunTraceKind;
  title: string;
  status: string | null;
  input_summary: string | null;
  output_summary: string | null;
  trace_json: string;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRunTraceInput {
  run_id?: string;
  team_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  kind: RunTraceKind;
  title: string;
  status?: string | null;
  input_summary?: string | null;
  output_summary?: string | null;
  trace_json?: string;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json?: string;
}

export interface RunTraceFilter {
  team_id?: string;
  agent_id?: string;
  kind?: RunTraceKind;
  status?: string;
}

/** 记忆写入审批（治理人机闭环）：pending → approved/rejected。 */
export type WriteApprovalStatus = "pending" | "approved" | "rejected";

export interface WriteApprovalEntity {
  approval_id: string;
  team_id: string;
  agent_id: string | null;
  task_id: string | null;
  session_id: string | null;
  write_policy: string;
  risk: string | null;
  /** 待执行的 consolidation plans（JSON 字符串）。 */
  plans_json: string;
  status: WriteApprovalStatus;
  decided_by_user_id: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWriteApprovalInput {
  approval_id?: string;
  team_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  session_id?: string | null;
  write_policy: string;
  risk?: string | null;
  plans_json: string;
  status?: WriteApprovalStatus;
}

export interface WriteApprovalFilter {
  team_id?: string;
  agent_id?: string;
  status?: WriteApprovalStatus;
}
  scope: KnowledgeScope;
  /** team_id 或 project_id。 */
  scope_id: string;
  kind: KnowledgeKind;
  title: string;
  content: string | null;
  status: string | null;
  source: KnowledgeSource;
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface TaskEntity {
  task_id: string;
  team_id: string;
  creator_user_id: string;
  title: string;
  description?: string | null;
  source_type: TaskSourceType;
  source_url?: string | null;
  status: TaskStatus;
  auto_assign_floating_assets: boolean;
  risk_level?: string | null;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export interface TaskAgentEntity {
  id: string;
  task_id: string;
  agent_id: string;
  role_in_task?: string | null;
  status: MemberStatus;
  created_at: string;
}

/** Task/Agent 参与事件日志（append-only）。 */
export interface ParticipationLogEntity {
  id: string;
  team_id: string;
  task_id: string;
  agent_id: string;
  user_id: string;
  source: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface AppendParticipationLogInput {
  team_id: string;
  task_id: string;
  agent_id: string;
  user_id: string;
  created_at?: string;
  source?: string;
  metadata_json?: string;
}

export interface ParticipationLogFilter {
  team_id: string;
  task_id?: string;
  agent_id?: string;
  user_id?: string;
  created_after?: string;
  created_before?: string;
  /** 是否按 user_id 去重；默认 false。 */
  dedupe?: boolean;
}

export interface AssetEntity {
  asset_id: string;
  team_id: string;
  asset_type: AssetType;
  name: string;
  description?: string | null;
  owner_user_id: string;
  /** 可空：挂到某 project（协作轴）；null = 团队/个人级资产。 */
  project_id?: string | null;
  source_type: string;
  source_ref?: string | null;
  version: number;
  visibility: AssetVisibility;
  status: AssetStatus;
  confidence?: number | null;
  expires_at?: string | null;
  last_used_at?: string | null;
  usage_count: number;
  content_ref?: string | null;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export interface FixedAssetBindingEntity {
  id: string;
  agent_id: string;
  asset_id: string;
  asset_type: AssetType;
  injection_mode: InjectionMode;
  priority: number;
  created_by: string;
  created_at: string;
}

/** 按 asset_type 聚合的固定资产绑定计数（distinct asset_id）。 */
export interface FixedAssetTypeCounts {
  skill: number;
  code_graph: number;
  llm_wiki: number;
  chat_memory: number;
}

/** 单个 agent 的固定资产分配汇总。 */
export interface AgentFixedAssetSummary {
  agent_id: string;
  counts: FixedAssetTypeCounts;
  /** 该 agent 匹配到的 binding 总行数（非去重）。 */
  total: number;
}

/** summary-by-agents 响应。 */
export interface AgentFixedAssetSummaryResult {
  items: AgentFixedAssetSummary[];
  total: number;
}

/** Store/Service：按多 agent 分组统计固定资产绑定。 */
export interface SummarizeAgentFixedAssetsParams {
  agent_ids: string[];
  /** 可选：只统计绑定了该 asset 的行；用于 bound_agent_count。 */
  asset_id?: string;
}

/** Store 层原始聚合行（未补零）。 */
export interface AgentFixedAssetCountRow {
  agent_id: string;
  asset_type: AssetType;
  cnt: number;
}

/** 用户 API 密钥行（存储层，含完整 key_value）。 */
export interface UserKeyEntity {
  key_id: string;
  user_id: string;
  key_value: string;
  name?: string | null;
  status: UserKeyStatus;
  is_default: boolean;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
  metadata_json: string;
}

/** API 脱敏结构（list / get）。 */
export interface UserKeyPublic {
  key_id: string;
  user_id: string;
  key_prefix: string;
  name?: string | null;
  status: UserKeyStatus;
  is_default: boolean;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

/** create 响应：仅此一次返回完整 key_value。 */
export interface UserKeyCreated extends UserKeyPublic {
  key_value: string;
}

export interface AclEntity {
  id: string;
  asset_id: string;
  subject_type: AclSubjectType;
  subject_id: string;
  permission: Permission;
  effect: AclEffect;
  granted_by: string;
  created_at: string;
  updated_at: string;
}

/** 审计日志条目（治理收尾：所有写操作留痕）。 */
export interface AuditLogEntity {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
}

/** 审计日志列表过滤。 */
export interface AuditLogFilter {
  actor_user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
}

/** 用户显式授予的全局能力权限项（方案B RBAC）。 */
export interface UserPermissionEntity {
  id: string;
  user_id: string;
  permission: GlobalPermission;
  granted_by: string;
  created_at: string;
}

/** 授予/撤销全局权限项的输入。 */
export interface GrantPermissionInput {
  user_id: string;
  permission: GlobalPermission;
  granted_by?: string;
}

/** 权限项列表过滤。 */
export interface PermissionFilter {
  user_id?: string;
}

// ============================
// 输入类型（创建/更新）
// ============================

export interface UserPublic {
  user_id: string;
  user_type: UserType;
  username: string;
  created_at: string;
}

/** 公开 user/list 可选过滤（internal list-by-instance 另含 status / user_type）。 */
export interface UserListFilter {
  user_ids?: string[];
  /** 精确匹配用户名（用于查重等场景）。 */
  username?: string;
}

/** user/create 响应：不含 username（见 08 §CreateUserResult）。 */
export interface CreateUserApiResult {
  user_id: string;
  user_type: UserType;
  created_at: string;
  default_user_key: string;
}

export interface InitAdminInput {
  username: string;
  user_key?: string;
}

export interface InitAdminResult {
  user_id: string;
  user_key: string;
}

export interface CreateUserInput {
  user_id?: string;
  /** 内部：init-admin 可指定默认 user_key。 */
  default_key_value?: string;
  /** 存储层默认 `local`（API 不暴露）。 */
  auth_provider?: string;
  /** 存储层默认 `user_id`（API 不暴露）。 */
  external_id?: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  raw_profile_json?: string;
  status?: UserStatus;
  metadata_json?: string;
  /** 仅存储层内部使用；API create 固定 normal，init-admin 固定 system_admin。 */
  user_type?: UserType;
  /** v3.1：新用户恒 NULL；仅 store 层写入。 */
  password?: string | null;
}

export interface CreateUserKeyInput {
  user_id: string;
  key_value?: string;
  name?: string | null;
  expires_at?: string | null;
  is_default?: boolean;
  metadata_json?: string;
}

export interface CreateTeamInput {
  team_id?: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  status?: TeamStatus;
  metadata_json?: string;
}

export interface AddTeamMemberInput {
  id?: string;
  team_id: string;
  user_id: string;
  role?: TeamRole;
  status?: MemberStatus;
  /** 是否自动创建个人 Agent（agent_id = user_id）；默认 true（创建），显式传 false 才跳过 */
  create_default_agent?: boolean;
}

export interface CreateProjectInput {
  project_id?: string;
  team_id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  visibility?: ProjectVisibility;
  default_agent_id?: string | null;
  repo_url?: string | null;
  git_repo_urls?: string[];
  path_globs?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  manager_user_id?: string | null;
  visibility?: ProjectVisibility;
  default_agent_id?: string | null;
  repo_url?: string | null;
  git_repo_urls?: string[];
  path_globs?: string[];
}

export interface AddProjectMemberInput {
  project_id: string;
  user_id: string;
  role?: ProjectMemberRole;
  granted_by?: string;
}

export interface CreateAgentInput {
  agent_id?: string;
  team_id: string;
  owner_user_id: string;
  project_id?: string | null;
  name: string;
  description?: string | null;
  prompt?: string | null;
  visibility?: AssetVisibility;
  status?: AgentStatus;
  metadata_json?: string;
}

export interface CreateAgentSpaceInput {
  agent_id: string;
  space_id: string;
  owner_type: string;
  owner_id: string;
  domain: string;
  write_policy: string;
  source?: "default_mount" | "explicit";
}

export interface CreateTaskInput {
  task_id?: string;
  team_id: string;
  creator_user_id: string;
  title: string;
  description?: string | null;
  source_type?: TaskSourceType;
  source_url?: string | null;
  status?: TaskStatus;
  auto_assign_floating_assets?: boolean;
  risk_level?: string | null;
  project_id?: string | null;
  metadata_json?: string;
  /** 创建 task 时可同时关联的 agent。 */
  linked_agents?: Array<{ agent_id: string; role_in_task?: string }>;
}

export interface CreateAssetInput {
  /** 由调用方（外部资产系统）提供，元数据模块仅记录与鉴权，不生成 asset_id。 */
  asset_id: string;
  team_id: string;
  asset_type: AssetType;
  name: string;
  description?: string | null;
  owner_user_id: string;
  project_id?: string | null;
  source_type: string;
  source_ref?: string | null;
  visibility?: AssetVisibility;
  status?: AssetStatus;
  confidence?: number | null;
  expires_at?: string | null;
  content_ref?: string | null;
  metadata_json?: string;
}

export interface FixedAssetBindingInput {
  asset_id: string;
  asset_type: AssetType;
  injection_mode?: InjectionMode;
  priority?: number;
  created_by: string;
}

export interface GrantAclInput {
  id?: string;
  asset_id: string;
  subject_type: AclSubjectType;
  subject_id: string;
  permission: Permission;
  effect?: AclEffect;
  granted_by: string;
}

// ============================
// 过滤器类型
// ============================

export interface AgentFilter {
  status?: AgentStatus;
  /**
   * 组合过滤：与 team_id 一起使用时表示"团队内某用户 owner 的 agent"。
   * 单独使用 owner_user_id 时走 listAgentsByOwner，无需该字段。
   */
  owner_user_id?: string;
  /** 精确匹配 agent 名称（用于查重等场景）。 */
  name?: string;
  /**
   * 协作轴过滤：精确匹配 project_id；`null` 表示只取未挂 project 的（团队/个人级 agent）。
   */
  project_id?: string | null;
}

export interface TaskFilter {
  status?: TaskStatus;
  creator_user_id?: string;
  /** 精确匹配 task 标题（用于查重等场景）。 */
  title?: string;
  /** 关联 agent 过滤：只取绑定了该 agent 的 task（JOIN meta_task_agents）。 */
  agent_id?: string;
  /** 协作轴过滤：精确匹配 project_id；`null` 表示只取未挂 project 的 task。 */
  project_id?: string | null;
}

/** team/list 可选过滤（用于查重等场景）。 */
export interface TeamFilter {
  /** 精确匹配 team 名称。 */
  name?: string;
}

/** project/list 可选过滤。 */
export interface ProjectFilter {
  team_id?: string;
  owner_user_id?: string;
  /** 收窄到「该 user 是 member 的 project」。 */
  member_user_id?: string;
  visibility?: ProjectVisibility;
  /** 精确匹配 project 名称。 */
  name?: string;
}

export interface AssetFilter {
  asset_type?: AssetType;
  status?: AssetStatus;
  owner_user_id?: string;
  visibility?: AssetVisibility;
  /** 精确匹配 project_id；`null` 表示只取未挂 project 的（团队级）资产。 */
  project_id?: string | null;
}

// ============================
// 通用结果类型
// ============================

/** list 接口分页入参（可选；未传时服务端默认 limit=20、offset=0）。 */
export interface PaginationInput {
  limit?: number;
  offset?: number;
}

/** 解析后的分页参数（limit/offset 均有确定值）。 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/** list 接口分页响应信封。 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Store 层 list 查询结果（内部分页切片 + 总数）。 */
export interface ListPage<T> {
  items: T[];
  total: number;
}

/** internal list-by-instance 可选过滤（扩展 UserListFilter）。 */
export interface InstanceUserListFilter extends UserListFilter {
  status?: UserStatus;
  user_type?: UserType;
}

export interface BatchDeleteResult {
  deleted_ids: string[];
  failed: Array<{ id: string; reason: string }>;
}

// ============================
// ConfigParam 类型
// ============================

export type ConfigParamScope = "global" | "user";

export interface ConfigParamEntity {
  id: number;
  scope: ConfigParamScope;
  user_id: string | null;
  module: string;
  param_name: string;
  param_value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertConfigParamInput {
  scope: ConfigParamScope;
  user_id?: string | null;
  module: string;
  param_name: string;
  param_value: string;
  description: string;
}

export interface ListConfigParamsFilter {
  scope?: ConfigParamScope;
  module: string;
  userId?: string;
  paramNames?: string[];
}

// ============================
// InstanceUpstreamConfig 类型
// ============================

/** 配置类型：conversation（用户对话模型）或 extraction（记忆/Skill 抽取模型）。 */
export type UpstreamConfigType = "conversation" | "extraction";

/** 转发模式：official（官方主模型）、custom_unified（自定义+统一Key）、custom_passthrough（自定义+用户自带Key）。 */
export type UpstreamConfigMode = "official" | "custom_unified" | "custom_passthrough";

/** 实例上游配置行（存储层实体）。 */
export interface InstanceUpstreamConfigEntity {
  id: number;
  /** Agent 标识。当前阶段固定 "default"，预留 per-agent 扩展。 */
  agent_source: string;
  /** 配置类型。 */
  type: UpstreamConfigType;
  /** 转发模式。extraction 不支持 custom_passthrough。 */
  mode: UpstreamConfigMode;
  /** 自定义 LLM 上游 URL。official 模式下为空串。 */
  base_url: string;
  /** API Key（明文存储）。仅 custom_unified 模式有意义。 */
  api_key: string;
  /** 可选：强制覆盖请求中的 model_id；空串 = 透传。 */
  model_id: string;
  /** 管理备注。 */
  description: string;
  created_at: string;
  updated_at: string;
}

/** 写入/更新输入。 */
export interface UpsertInstanceUpstreamConfigInput {
  agent_source?: string;
  type?: UpstreamConfigType;
  mode: UpstreamConfigMode;
  base_url?: string;
  api_key?: string;
  model_id?: string;
  description?: string;
}

/** 查询过滤。 */
export interface InstanceUpstreamConfigFilter {
  agent_source?: string;
  type?: UpstreamConfigType;
}
