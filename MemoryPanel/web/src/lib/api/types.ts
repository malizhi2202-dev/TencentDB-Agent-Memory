/**
 * api/types.ts — 跨模块共享的类型定义。
 *
 * 只放被 2 个以上 API 模块引用的类型；单一模块专属类型就近放在对应模块文件里。
 */

/** meta / control 信封格式 */
export interface MetaEnvelope<T> {
  code: number;
  message: string;
  request_id: string;
  data: T | null;
}

/** 内核分页响应（task/list、agent/list 等） */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * auth/verify、user/get、user/list 均会返回的公共用户结构。
 * `user_type === 'system_admin'` 是判断"当前登录用户是不是 admin"的唯一权威字段。
 */
export interface PublicUser {
  user_id: string;
  auth_provider: string;
  external_id: string;
  username: string;
  display_name?: string;
  email?: string;
  status: 'active' | 'inactive' | 'invited';
  created_at: string;
  updated_at: string;
  /**
   * 全局用户类型（auth/verify、user/get、user/list 均会返回），
   * 'system_admin' = 全局唯一的 admin 身份，与 team 无关；其余（如 'user'）都是普通用户。
   * 这是判断"当前登录用户是不是 admin"的唯一权威字段——不要再用 username === 'admin' 兜底猜。
   */
  user_type?: 'system_admin' | 'user' | string;
}

export interface Team {
  team_id: string;
  name: string;
  description?: string;
  owner_user_id: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'reviewer';
  joined_at: string;
  status: 'active' | 'removed';
  /** team-member/list · get 响应附带（读时 JOIN） */
  username?: string;
}

/** project（协作轴，与 team 正交；members 可跨 team）。 */
export interface Project {
  project_id: string;
  team_id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  manager_user_id?: string | null;
  visibility: 'private' | 'team' | 'restricted';
  default_agent_id?: string | null;
  repo_url?: string | null;
  git_repo_urls?: string;
  path_globs?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: 'member' | 'manager';
  granted_by?: string | null;
  created_at: string;
  username?: string;
}

/** project（协作轴，与 team 正交；members 可跨 team）。 */
export interface Project {
  project_id: string;
  team_id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  manager_user_id?: string | null;
  visibility: 'private' | 'team' | 'restricted';
  default_agent_id?: string | null;
  repo_url?: string | null;
  git_repo_urls?: string;
  path_globs?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: 'member' | 'manager';
  granted_by?: string | null;
  created_at: string;
  username?: string;
}

/** 项目级五类 + 团队级工作模式 共用的知识条目。 */
export type KnowledgeKind =
  | 'objective' | 'decision' | 'deliverable' | 'discussion'
  | 'convention' | 'methodology' | 'mindset';

export interface KnowledgeEntry {
  entry_id: string;
  scope: 'team' | 'project';
  scope_id: string;
  kind: KnowledgeKind;
  title: string;
  content?: string | null;
  status?: string | null;
  source: 'memory' | 'external' | 'hybrid';
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

/** 能力资产类工具：MCP Server / REST API。 */
export interface ToolSource {
  tool_id: string;
  kind: 'mcp' | 'rest';
  team_id: string;
  name: string;
  description?: string | null;
  endpoint_url?: string | null;
  transport?: string | null;
  auth_config_json: string;
  status?: string | null;
  source: 'memory' | 'external' | 'hybrid';
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

/** 能力资产类工具：MCP Server / REST API。 */
export interface ToolSource {
  tool_id: string;
  kind: 'mcp' | 'rest';
  team_id: string;
  name: string;
  description?: string | null;
  endpoint_url?: string | null;
  transport?: string | null;
  auth_config_json: string;
  status?: string | null;
  source: 'memory' | 'external' | 'hybrid';
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

/** 运行载体类：Agent Team（多 Agent 编排）。 */
export interface AgentTeam {
  agent_team_id: string;
  team_id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  status?: string | null;
  source: 'memory' | 'external' | 'hybrid';
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface AgentTeamMember {
  id: string;
  agent_team_id: string;
  agent_id: string;
  role?: string | null;
  created_at: string;
}

/** 运行载体类：Automation 自动化。 */
export interface Automation {
  automation_id: string;
  team_id: string;
  name: string;
  description?: string | null;
  trigger_type: 'cron' | 'webhook' | 'manual' | 'event';
  trigger_config_json: string;
  action_type: 'run_agent' | 'run_task' | 'notify';
  action_config_json: string;
  target_id?: string | null;
  status?: string | null;
  source: 'memory' | 'external' | 'hybrid';
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

/** 运行载体类：Automation 自动化。 */
export interface Automation {
  automation_id: string;
  team_id: string;
  name: string;
  description?: string | null;
  trigger_type: 'cron' | 'webhook' | 'manual' | 'event';
  trigger_config_json: string;
  action_type: 'run_agent' | 'run_task' | 'notify';
  action_config_json: string;
  target_id?: string | null;
  status?: string | null;
  source: 'memory' | 'external' | 'hybrid';
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

/** 可回看运行类：Run / Trace 会话回放。 */
export interface RunTrace {
  run_id: string;
  team_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  kind: 'run' | 'trace';
  title: string;
  status?: string | null;
  input_summary?: string | null;
  output_summary?: string | null;
  trace_json: string;
  source: 'memory' | 'external' | 'hybrid';
  owner_user_id: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  agent_id: string;
  team_id: string;
  owner_user_id: string;
  name: string;
  description?: string;
  prompt?: string;
  visibility: 'private' | 'task' | 'agent' | 'team' | 'restricted';
  status: 'active' | 'inactive';
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export type AssetType = 'skill' | 'llm_wiki' | 'code_graph' | 'chat_memory';
export type AssetStatus = 'draft' | 'candidate' | 'approved' | 'deprecated' | 'archived';

export interface Asset {
  asset_id: string;
  team_id: string;
  project_id?: string | null;
  asset_type: AssetType;
  name: string;
  description?: string;
  owner_user_id: string;
  source_type: 'uploaded' | 'url' | 'extracted' | 'synced';
  source_ref?: string;
  version: number;
  visibility: 'private' | 'task' | 'agent' | 'team' | 'restricted';
  status: AssetStatus;
  confidence?: number;
  expires_at?: string;
  last_used_at?: string;
  usage_count: number;
  content_ref?: string;
  created_at: string;
  updated_at: string;
  metadata_json: string;
}

export interface AgentAssetView {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  description?: string;
  status: AssetStatus;
  visibility: string;
  injection_mode: 'direct' | 'summary' | 'tool' | 'reference';
  priority: number;
  created_at: string;
}

export interface FixedAssetBinding {
  asset_id: string;
  asset_type: AssetType;
  injection_mode?: 'direct' | 'summary' | 'tool' | 'reference';
  priority?: number;
}
