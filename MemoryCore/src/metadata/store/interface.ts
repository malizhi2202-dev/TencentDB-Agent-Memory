/**
 * IMetadataStore — 元数据存储抽象接口。
 *
 * 对应设计文档 §6.1。所有后端实现（SQLite / MongoDB / MySQL 预留）必须满足此契约，
 * 由 metadata-store.contract.ts 中的共用测试套件统一验证，保证后端行为一致。
 *
 * 约定：
 *   - 所有方法可同步或异步，调用方一律 await。
 *   - 复合写入（createTeam + 自动 admin、createTask + linkAgents、setAgentFixedAssets 全量替换）
 *     必须在实现内部保证原子性（SQLite 串行事务 / MongoDB withTransaction）。
 *   - get* 找不到返回 null；delete* 返回 BatchDeleteResult。
 */

import type {
  UserEntity,
  UserKeyEntity,
  TeamEntity,
  TeamMemberEntity,
  TeamMemberView,
  ProjectEntity,
  ProjectMemberEntity,
  ProjectMemberView,
  AgentEntity,
  AgentSpaceEntity,
  TaskEntity,
  TaskAgentEntity,
  ParticipationLogEntity,
  AppendParticipationLogInput,
  ParticipationLogFilter,
  AssetEntity,
  FixedAssetBindingEntity,
  AgentFixedAssetCountRow,
  AclEntity,
  CreateUserInput,
  CreateUserKeyInput,
  CreateTeamInput,
  AddTeamMemberInput,
  CreateProjectInput,
  AddProjectMemberInput,
  CreateAgentInput,
  CreateAgentSpaceInput,
  CreateKnowledgeEntryInput,
  CreateToolSourceInput,
  CreateAgentTeamInput,
  AgentTeamMemberInput,
  CreateAutomationInput,
  CreateRunTraceInput,
  CreateWriteApprovalInput,
  CreateTaskInput,
  CreateAssetInput,
  FixedAssetBindingInput,
  GrantAclInput,
  AgentFilter,
  TaskFilter,
  KnowledgeEntryEntity,
  KnowledgeEntryFilter,
  ToolSourceEntity,
  ToolSourceFilter,
  AgentTeamEntity,
  AgentTeamMemberEntity,
  AgentTeamFilter,
  AutomationEntity,
  AutomationFilter,
  RunTraceEntity,
  RunTraceFilter,
  WriteApprovalEntity,
  WriteApprovalFilter,
  TeamFilter,
  ProjectFilter,
  AssetFilter,
  BatchDeleteResult,
  ListPage,
  PaginationParams,
  InstanceUserListFilter,
  TeamRole,
  ConfigParamEntity,
  UpsertConfigParamInput,
  ListConfigParamsFilter,
  InstanceUpstreamConfigEntity,
  UpsertInstanceUpstreamConfigInput,
  InstanceUpstreamConfigFilter,
  UpstreamConfigType,
} from "../types.js";

export type MaybePromise<T> = T | Promise<T>;

/**
 * 调用方指定 default_key_value / key_value 时，命中 meta_user_keys.key_value UNIQUE 约束。
 * Service 层 catch 后翻译为 MetadataError("duplicate_user_key")；HTTP 层映射为 409。
 * Store 层直接抛此错，独立于业务层 MetadataError（避免存储层反向依赖 service）。
 */
export class DuplicateUserKeyError extends Error {
  constructor(public readonly keyValue: string) {
    super(`user_key already exists: ${keyValue}`);
    this.name = "DuplicateUserKeyError";
  }
}

export interface IMetadataStore {
  /** 初始化存储（建表/建索引/建连接）。幂等。 */
  init(): MaybePromise<void>;
  /** 关闭存储连接。 */
  close(): MaybePromise<void>;

  // ── User ──
  createUser(input: CreateUserInput): MaybePromise<UserEntity>;
  getUserById(userId: string): MaybePromise<UserEntity | null>;
  getUserByKey(userKey: string): MaybePromise<UserEntity | null>;
  getUserByEmail(email: string): MaybePromise<UserEntity | null>;
  getUserByExternalId(authProvider: string, externalId: string): MaybePromise<UserEntity | null>;
  getUserByUsername(authProvider: string, username: string): MaybePromise<UserEntity | null>;
  updateUser(userId: string, patch: Partial<UserEntity>): MaybePromise<UserEntity | null>;
  deleteUsers(userIds: string[]): MaybePromise<BatchDeleteResult>;
  listUsersByTeam(
    teamId: string,
    pagination?: PaginationParams | null,
    filter?: InstanceUserListFilter,
  ): MaybePromise<ListPage<UserEntity>>;
  listUsers(
    pagination?: PaginationParams | null,
    filter?: InstanceUserListFilter,
  ): MaybePromise<ListPage<UserEntity>>;
  countUsers(): MaybePromise<number>;
  countSystemAdmins(): MaybePromise<number>;
  countTeams(): MaybePromise<number>;

  // ── UserKey（多 API 密钥）──
  createUserKey(input: CreateUserKeyInput): MaybePromise<UserKeyEntity>;
  getUserKeyById(keyId: string): MaybePromise<UserKeyEntity | null>;
  listUserKeys(userId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<UserKeyEntity>>;
  countActiveUserKeys(userId: string): MaybePromise<number>;
  revokeUserKey(keyId: string, options?: { promoteNextDefault?: boolean }): MaybePromise<UserKeyEntity | null>;
  updateUserKey(keyId: string, patch: Partial<Pick<UserKeyEntity, "name" | "expires_at" | "is_default" | "metadata_json">>): MaybePromise<UserKeyEntity | null>;
  touchUserKeyUsage(keyId: string): MaybePromise<void>;
  revokeAllUserKeysForUser(userId: string): MaybePromise<void>;
  getDefaultUserKey(userId: string): MaybePromise<UserKeyEntity | null>;

  // ── Team ──（createTeam 自动把 owner 加为 admin 成员）
  createTeam(input: CreateTeamInput): MaybePromise<TeamEntity>;
  getTeamById(teamId: string): MaybePromise<TeamEntity | null>;
  updateTeam(teamId: string, patch: Partial<TeamEntity>): MaybePromise<TeamEntity | null>;
  deleteTeams(teamIds: string[]): MaybePromise<BatchDeleteResult>;
  listTeamsByUser(userId: string, pagination?: PaginationParams | null, filter?: TeamFilter): MaybePromise<ListPage<TeamEntity>>;
  listTeams(filter?: TeamFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<TeamEntity>>;
  listTeams(filter?: TeamFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<TeamEntity>>;

  // ── TeamMember ──
  addTeamMember(input: AddTeamMemberInput): MaybePromise<TeamMemberEntity>;
  removeTeamMember(teamId: string, userId: string): MaybePromise<void>;
  listTeamMembers(teamId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<TeamMemberEntity>>;
  getTeamMember(teamId: string, userId: string): MaybePromise<TeamMemberEntity | null>;
  listTeamMembersWithProfile(
    teamId: string,
    pagination?: PaginationParams | null,
  ): MaybePromise<ListPage<TeamMemberView>>;
  getTeamMemberWithProfile(teamId: string, userId: string): MaybePromise<TeamMemberView | null>;

  // ── Project ──（createProject 自动把 owner 加为 manager 成员）
  createProject(input: CreateProjectInput): MaybePromise<ProjectEntity>;
  getProjectById(projectId: string): MaybePromise<ProjectEntity | null>;
  updateProject(projectId: string, patch: Partial<ProjectEntity>): MaybePromise<ProjectEntity | null>;
  deleteProjects(projectIds: string[]): MaybePromise<BatchDeleteResult>;
  listProjects(filter?: ProjectFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<ProjectEntity>>;

  // ── ProjectMember ──
  addProjectMember(input: AddProjectMemberInput): MaybePromise<ProjectMemberEntity>;
  removeProjectMember(projectId: string, userId: string): MaybePromise<void>;
  listProjectMembers(projectId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<ProjectMemberEntity>>;
  getProjectMember(projectId: string, userId: string): MaybePromise<ProjectMemberEntity | null>;
  listProjectMembersWithProfile(
    projectId: string,
    pagination?: PaginationParams | null,
  ): MaybePromise<ListPage<ProjectMemberView>>;
  getProjectMemberWithProfile(projectId: string, userId: string): MaybePromise<ProjectMemberView | null>;

  // ── Agent ──
  createAgent(input: CreateAgentInput): MaybePromise<AgentEntity>;
  getAgentById(agentId: string): MaybePromise<AgentEntity | null>;
  updateAgent(agentId: string, patch: Partial<AgentEntity>): MaybePromise<AgentEntity | null>;
  deleteAgents(agentIds: string[]): MaybePromise<BatchDeleteResult>;
  listAgentsByTeam(teamId: string, pagination?: PaginationParams | null, filter?: AgentFilter): MaybePromise<ListPage<AgentEntity>>;
  listAgentsByOwner(userId: string, pagination?: PaginationParams | null, filter?: AgentFilter): MaybePromise<ListPage<AgentEntity>>;

  // ── AgentSpace（agent ↔ memory space 多对多挂载，创建 agent 时默认挂载）──
  /** 批量落库挂载空间（(agent_id, space_id) 幂等 upsert）。 */
  createAgentSpaces(spaces: CreateAgentSpaceInput[]): MaybePromise<void>;
  getAgentSpaces(agentId: string): MaybePromise<AgentSpaceEntity[]>;
  /** 批量拉取多个 agent 的挂载空间（按 agent_id 过滤，供组合筛选聚合）。 */
  listAgentSpacesByAgentIds(agentIds: string[]): MaybePromise<AgentSpaceEntity[]>;
  deleteAgentSpaces(agentId: string): MaybePromise<void>;

  // ── AgentSpace（agent ↔ memory space 多对多挂载，创建 agent 时默认挂载）──
  /** 批量落库挂载空间（(agent_id, space_id) 幂等 upsert）。 */
  createAgentSpaces(spaces: CreateAgentSpaceInput[]): MaybePromise<void>;
  getAgentSpaces(agentId: string): MaybePromise<AgentSpaceEntity[]>;
  /** 批量拉取多个 agent 的挂载空间（按 agent_id 过滤，供组合筛选聚合）。 */
  listAgentSpacesByAgentIds(agentIds: string[]): MaybePromise<AgentSpaceEntity[]>;
  deleteAgentSpaces(agentId: string): MaybePromise<void>;

  // ── KnowledgeEntry（项目级五类 + 团队级工作模式，通用结构体）──
  createKnowledgeEntry(input: CreateKnowledgeEntryInput): MaybePromise<KnowledgeEntryEntity>;
  getKnowledgeEntry(entryId: string): MaybePromise<KnowledgeEntryEntity | null>;
  updateKnowledgeEntry(entryId: string, patch: Partial<KnowledgeEntryEntity>): MaybePromise<KnowledgeEntryEntity | null>;
  deleteKnowledgeEntries(entryIds: string[]): MaybePromise<BatchDeleteResult>;
  listKnowledgeEntries(
    filter: KnowledgeEntryFilter,
    pagination?: PaginationParams | null,
  ): MaybePromise<ListPage<KnowledgeEntryEntity>>;

  // ── ToolSource（能力资产类：MCP Server / REST API）──
  createToolSource(input: CreateToolSourceInput): MaybePromise<ToolSourceEntity>;
  getToolSource(toolId: string): MaybePromise<ToolSourceEntity | null>;
  updateToolSource(toolId: string, patch: Partial<ToolSourceEntity>): MaybePromise<ToolSourceEntity | null>;
  deleteToolSources(toolIds: string[]): MaybePromise<BatchDeleteResult>;
  listToolSources(filter: ToolSourceFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<ToolSourceEntity>>;

  // ── AgentTeam（多 Agent 编排）──
  createAgentTeam(input: CreateAgentTeamInput): MaybePromise<AgentTeamEntity>;
  getAgentTeam(agentTeamId: string): MaybePromise<AgentTeamEntity | null>;
  updateAgentTeam(agentTeamId: string, patch: Partial<AgentTeamEntity>): MaybePromise<AgentTeamEntity | null>;
  deleteAgentTeams(agentTeamIds: string[]): MaybePromise<BatchDeleteResult>;
  listAgentTeams(filter: AgentTeamFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<AgentTeamEntity>>;
  addAgentTeamMember(input: AgentTeamMemberInput): MaybePromise<AgentTeamMemberEntity>;
  removeAgentTeamMember(agentTeamId: string, agentId: string): MaybePromise<void>;
  listAgentTeamMembers(agentTeamId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<AgentTeamMemberEntity>>;

  // ── Automation（自动化编排）──
  createAutomation(input: CreateAutomationInput): MaybePromise<AutomationEntity>;
  getAutomation(automationId: string): MaybePromise<AutomationEntity | null>;
  updateAutomation(automationId: string, patch: Partial<AutomationEntity>): MaybePromise<AutomationEntity | null>;
  deleteAutomations(automationIds: string[]): MaybePromise<BatchDeleteResult>;
  listAutomations(filter: AutomationFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<AutomationEntity>>;

  // ── RunTrace（会话回放）──
  createRunTrace(input: CreateRunTraceInput): MaybePromise<RunTraceEntity>;
  getRunTrace(runId: string): MaybePromise<RunTraceEntity | null>;
  updateRunTrace(runId: string, patch: Partial<RunTraceEntity>): MaybePromise<RunTraceEntity | null>;
  deleteRunTraces(runIds: string[]): MaybePromise<BatchDeleteResult>;
  listRunTraces(filter: RunTraceFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<RunTraceEntity>>;

  // ── WriteApproval（记忆写入审批）──
  createWriteApproval(input: CreateWriteApprovalInput): MaybePromise<WriteApprovalEntity>;
  getWriteApproval(approvalId: string): MaybePromise<WriteApprovalEntity | null>;
  updateWriteApproval(approvalId: string, patch: Partial<WriteApprovalEntity>): MaybePromise<WriteApprovalEntity | null>;
  deleteWriteApprovals(approvalIds: string[]): MaybePromise<BatchDeleteResult>;
  listWriteApprovals(filter: WriteApprovalFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<WriteApprovalEntity>>;

  // ── KnowledgeEntry（项目级五类 + 团队级工作模式，通用结构体）──
  createKnowledgeEntry(input: CreateKnowledgeEntryInput): MaybePromise<KnowledgeEntryEntity>;
  getKnowledgeEntry(entryId: string): MaybePromise<KnowledgeEntryEntity | null>;
  updateKnowledgeEntry(entryId: string, patch: Partial<KnowledgeEntryEntity>): MaybePromise<KnowledgeEntryEntity | null>;
  deleteKnowledgeEntries(entryIds: string[]): MaybePromise<BatchDeleteResult>;
  listKnowledgeEntries(
    filter: KnowledgeEntryFilter,
    pagination?: PaginationParams | null,
  ): MaybePromise<ListPage<KnowledgeEntryEntity>>;

  // ── ToolSource（能力资产类：MCP Server / REST API）──
  createToolSource(input: CreateToolSourceInput): MaybePromise<ToolSourceEntity>;
  getToolSource(toolId: string): MaybePromise<ToolSourceEntity | null>;
  updateToolSource(toolId: string, patch: Partial<ToolSourceEntity>): MaybePromise<ToolSourceEntity | null>;
  deleteToolSources(toolIds: string[]): MaybePromise<BatchDeleteResult>;
  listToolSources(filter: ToolSourceFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<ToolSourceEntity>>;

  // ── AgentTeam（多 Agent 编排）──
  createAgentTeam(input: CreateAgentTeamInput): MaybePromise<AgentTeamEntity>;
  getAgentTeam(agentTeamId: string): MaybePromise<AgentTeamEntity | null>;
  updateAgentTeam(agentTeamId: string, patch: Partial<AgentTeamEntity>): MaybePromise<AgentTeamEntity | null>;
  deleteAgentTeams(agentTeamIds: string[]): MaybePromise<BatchDeleteResult>;
  listAgentTeams(filter: AgentTeamFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<AgentTeamEntity>>;
  addAgentTeamMember(input: AgentTeamMemberInput): MaybePromise<AgentTeamMemberEntity>;
  removeAgentTeamMember(agentTeamId: string, agentId: string): MaybePromise<void>;
  listAgentTeamMembers(agentTeamId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<AgentTeamMemberEntity>>;

  // ── Automation（自动化编排）──
  createAutomation(input: CreateAutomationInput): MaybePromise<AutomationEntity>;
  getAutomation(automationId: string): MaybePromise<AutomationEntity | null>;
  updateAutomation(automationId: string, patch: Partial<AutomationEntity>): MaybePromise<AutomationEntity | null>;
  deleteAutomations(automationIds: string[]): MaybePromise<BatchDeleteResult>;
  listAutomations(filter: AutomationFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<AutomationEntity>>;

  // ── RunTrace（会话回放）──
  createRunTrace(input: CreateRunTraceInput): MaybePromise<RunTraceEntity>;
  getRunTrace(runId: string): MaybePromise<RunTraceEntity | null>;
  updateRunTrace(runId: string, patch: Partial<RunTraceEntity>): MaybePromise<RunTraceEntity | null>;
  deleteRunTraces(runIds: string[]): MaybePromise<BatchDeleteResult>;
  listRunTraces(filter: RunTraceFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<RunTraceEntity>>;

  // ── Task ──（createTask 可同时 linkAgents）
  createTask(input: CreateTaskInput): MaybePromise<TaskEntity>;
  getTaskById(taskId: string): MaybePromise<TaskEntity | null>;
  updateTask(taskId: string, patch: Partial<TaskEntity>): MaybePromise<TaskEntity | null>;
  deleteTasks(taskIds: string[]): MaybePromise<BatchDeleteResult>;
  listTasksByTeam(teamId: string, pagination?: PaginationParams | null, filter?: TaskFilter): MaybePromise<ListPage<TaskEntity>>;
  listTasks(filter: TaskFilter, pagination?: PaginationParams | null): MaybePromise<ListPage<TaskEntity>>;

  // ── TaskAgent ──
  linkTaskAgent(taskId: string, agentId: string, roleInTask?: string): MaybePromise<TaskAgentEntity>;
  unlinkTaskAgent(taskId: string, agentId: string): MaybePromise<void>;
  listTaskAgents(taskId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<TaskAgentEntity>>;

  // ── ParticipationLog ──
  appendParticipationLog(input: AppendParticipationLogInput): MaybePromise<ParticipationLogEntity>;
  listParticipationLogs(
    filter: ParticipationLogFilter,
    pagination?: PaginationParams | null,
  ): MaybePromise<ListPage<ParticipationLogEntity>>;

  // ── Asset ──（仅主表；详情表留在 control 面板）
  createAsset(input: CreateAssetInput): MaybePromise<AssetEntity>;
  getAssetById(assetId: string): MaybePromise<AssetEntity | null>;
  updateAsset(assetId: string, patch: Partial<AssetEntity>): MaybePromise<AssetEntity | null>;
  deleteAssets(assetIds: string[]): MaybePromise<BatchDeleteResult>;
  listAssetsByTeam(teamId: string, pagination?: PaginationParams | null, filter?: AssetFilter): MaybePromise<ListPage<AssetEntity>>;
  listAssetsByProject(projectId: string, pagination?: PaginationParams | null, filter?: AssetFilter): MaybePromise<ListPage<AssetEntity>>;
  listAssetsByOwner(ownerUserId: string, pagination?: PaginationParams | null, filter?: AssetFilter): MaybePromise<ListPage<AssetEntity>>;
  touchAssetUsage(assetId: string): MaybePromise<void>;

  // ── AgentFixedAsset ──（setAgentFixedAssets 全量替换）
  setAgentFixedAssets(agentId: string, bindings: FixedAssetBindingInput[]): MaybePromise<void>;
  /**
   * 追加一条 agent 绑定，**保留**该 agent 已有的其他绑定；(agent_id, asset_id)
   * 已存在时视作 no-op（幂等）。
   *
   * 场景：写入 memory 时自动登记 chat_memory 资产并绑定到 agent，且必须与
   * skill / wiki / code_graph 等其他资产的现有绑定共存 —— setAgentFixedAssets
   * 是全量替换会覆盖那些绑定，因此需要一个 append 语义的操作。
   */
  addAgentFixedAsset(agentId: string, binding: FixedAssetBindingInput): MaybePromise<void>;
  listAgentFixedAssets(
    agentId: string,
    pagination?: PaginationParams | null,
    /**
     * 可选过滤：仅返回 asset 类型在列表中的绑定。空/省略 = 不过滤。
     * store 内部 JOIN meta_assets 做 SQL 层过滤，避免"分页在前、类型过滤在后"截断。
     */
    filter?: { assetTypes?: readonly string[] },
  ): MaybePromise<ListPage<FixedAssetBindingEntity>>;
  getAgentFixedAsset(agentId: string, assetId: string): MaybePromise<FixedAssetBindingEntity | null>;
  /**
   * 按 agent_id + asset_type 聚合 COUNT(DISTINCT asset_id)。
   * 不补全缺失 agent / 缺失 type（由 Service 层补零）。
   */
  summarizeAgentFixedAssetsByAgents(
    agentIds: string[],
    options?: { assetId?: string },
  ): MaybePromise<AgentFixedAssetCountRow[]>;

  // ── ACL ──
  grantAcl(input: GrantAclInput): MaybePromise<AclEntity>;
  getAclById(id: string): MaybePromise<AclEntity | null>;
  revokeAcl(id: string): MaybePromise<void>;
  listAclByAsset(assetId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<AclEntity>>;
  listAclBySubject(subjectType: string, subjectId: string, pagination?: PaginationParams | null): MaybePromise<ListPage<AclEntity>>;

  // ── ConfigParam ──
  getConfigParam(
    scope: "global" | "user",
    userId: string | null,
    module: string,
    paramName: string,
  ): MaybePromise<ConfigParamEntity | null>;
  upsertConfigParam(input: UpsertConfigParamInput): MaybePromise<ConfigParamEntity>;
  listConfigParams(filter: ListConfigParamsFilter): MaybePromise<ConfigParamEntity[]>;

  // ── InstanceUpstreamConfig ──
  getInstanceUpstreamConfig(
    agentSource: string,
    type: UpstreamConfigType,
  ): MaybePromise<InstanceUpstreamConfigEntity | null>;
  upsertInstanceUpstreamConfig(
    input: UpsertInstanceUpstreamConfigInput,
  ): MaybePromise<InstanceUpstreamConfigEntity>;
  listInstanceUpstreamConfigs(
    filter?: InstanceUpstreamConfigFilter,
  ): MaybePromise<InstanceUpstreamConfigEntity[]>;
  deleteInstanceUpstreamConfig(
    agentSource: string,
    type: UpstreamConfigType,
  ): MaybePromise<boolean>;
}

/** 后端类型。 */
export type MetadataBackend = "sqlite" | "mongodb" | "mysql";

export type { TeamRole };
