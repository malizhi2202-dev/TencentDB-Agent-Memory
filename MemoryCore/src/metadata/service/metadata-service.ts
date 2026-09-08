/**
 * MetadataService — 元数据业务编排层。
 *
 * 对应设计文档 §2 / §7 / §10。在 IMetadataStore 之上叠加业务约束：
 *   - createAgent/createTask/createAsset 校验 team 存在
 *   - createTask linkAgents 校验 agent 同 team
 *   - setAgentFixedAssets 用 canBindAsset 校验 visibility
 *   - listAgentFixedAssetsWithDetail 聚合 agent + 详情 +（可选）visibility 过滤 + touchUsage
 *   - checkAssetPermission 懒加载 ACL（角色默认覆盖时不查表）
 *   - user_key 生成/刷新
 *
 * 不感知具体后端（SQLite / MongoDB），保证存储可切换。
 */

import { DuplicateUserKeyError, type IMetadataStore } from "../store/interface.js";
import {
  checkPermission,
  canBindAsset,
  roleDefaultCovers,
  OWNER_ACTIONS,
  ADMIN_ACTIONS,
  MEMBER_ACTIONS,
  type PermCheckResult,
  type PermCheckLogger,
} from "./permission-checker.js";
import { isGlobalPermission, NORMAL_DEFAULT, SYSTEM_ADMIN_DEFAULT, type GlobalPermission } from "../global-permissions.js";
import {
  maskUserKey, maskKeyValue, isUserKeyExpired, DEFAULT_MAX_ACTIVE_USER_KEYS,
} from "../utils/user-key.js";
import {
  lookupMemorySystemUser,
  isMemorySystemUserKey,
  toMemorySystemVerifyUser,
  type MemorySystemUserConfig,
} from "../system-user.js";
import { resolveUserId } from "./resolve-user-id.js";
import type { V3AuthContext } from "../router/auth.js";
import { DEFAULT_INSTANCE_ID, DEFAULT_AUTH_PROVIDER } from "../constants.js";
import {
  canViewUser,
  canManageUsers,
  filterVisibleUsers,
  isSystemAdminUser,
  toPublicUser,
} from "./user-visibility.js";
import type {
  UserEntity,
  UserPublic,
  UserKeyEntity,
  UserKeyPublic,
  UserKeyCreated,
  TeamEntity,
  TeamMemberEntity,
  TeamMemberView,
  ProjectEntity,
  ProjectMemberEntity,
  ProjectMemberView,
  AgentEntity,
  AgentSpaceEntity,
  AgentSpaceFilter,
  KnowledgeEntryEntity,
  KnowledgeEntryFilter,
  CreateKnowledgeEntryInput,
  ToolSourceEntity,
  ToolSourceFilter,
  CreateToolSourceInput,
  AgentTeamEntity,
  AgentTeamMemberEntity,
  AgentTeamFilter,
  CreateAgentTeamInput,
  AgentTeamMemberInput,
  AutomationEntity,
  AutomationFilter,
  CreateAutomationInput,
  RunTraceEntity,
  RunTraceFilter,
  CreateRunTraceInput,
  WriteApprovalEntity,
  WriteApprovalFilter,
  CreateWriteApprovalInput,
  TaskEntity,
  TaskAgentEntity,
  ParticipationLogEntity,
  AppendParticipationLogInput,
  ParticipationLogFilter,
  AssetEntity,
  FixedAssetBindingEntity,
  AgentFixedAssetSummary,
  AgentFixedAssetSummaryResult,
  FixedAssetTypeCounts,
  SummarizeAgentFixedAssetsParams,
  AclEntity,
  CreateUserInput,
  InitAdminInput,
  InitAdminResult,
  CreateUserApiResult,
  CreateTeamInput,
  AddTeamMemberInput,
  CreateProjectInput,
  AddProjectMemberInput,
  CreateAgentInput,
  CreateAgentSpaceInput,
  CreateTaskInput,
  CreateAssetInput,
  FixedAssetBindingInput,
  GrantAclInput,
  AgentFilter,
  TaskFilter,
  AssetFilter,
  ProjectFilter,
  ProjectVisibility,
  BatchDeleteResult,
  AssetType,
  AssetVisibility,
  AssetStatus,
  InjectionMode,
  Permission,
  AclSubjectType,
  UserType,
  PaginatedResult,
  PaginationParams,
  InstanceUserListFilter,
  UserListFilter,
  InstanceUpstreamConfigEntity,
  UpsertInstanceUpstreamConfigInput,
  InstanceUpstreamConfigFilter,
  UpstreamConfigType,
  AuditLogEntity,
  AuditLogFilter,
  UserPermissionEntity,
  GrantPermissionInput,
  PermissionFilter,
} from "../types.js";
import { formatListResult, paginateArray, resolvePagination, wrapPaginated, DEFAULT_PAGINATION } from "../pagination.js";
import { generateId, ID_PREFIX } from "../utils/id-generator.js";
import { buildChatMemoryAssetId, resolveChatMemoryAgentId } from "../utils/chat-memory-asset.js";
import { hashPassword, verifyPasswordHash, type PasswordHashConfig } from "../utils/crypto.js";
import { mountSpacesForAgent } from "../../core/record/memory-space.js";

// ── 默认 Agent / Team 常量 ──

const DEFAULT_TEAM_NAME = "default-team";
const DEFAULT_TEAM_DESCRIPTION = "系统初始化时自动创建的默认团队，用于存放默认助手";

const DEFAULT_AGENT_NAME = "default-agent";
const DEFAULT_AGENT_DESCRIPTION = "默认助手，可处理通用开发任务与日常协作。";

// prompt 拼接格式与前端手动创建 Agent 完全一致：
// [card.rolePrompt, card.rulesPrompt].filter(Boolean).join('\n\n')
const DEFAULT_AGENT_ROLE_PROMPT = "";
const DEFAULT_AGENT_RULES_PROMPT = "";
const DEFAULT_AGENT_PROMPT = [DEFAULT_AGENT_ROLE_PROMPT, DEFAULT_AGENT_RULES_PROMPT]
  .filter(Boolean)
  .join("\n\n");

// metadata_json 存储拆分后的 role_prompt / rules_prompt，
// 与前端 writeAgentUiMeta / readAgentUiMeta 的 "ui" namespace 格式一致，
// 保证 Agent 详情页「角色定位 prompt」和「规则固定 prompt」分开显示。
const DEFAULT_AGENT_METADATA_JSON = JSON.stringify({
  ui: {
    role_prompt: DEFAULT_AGENT_ROLE_PROMPT,
    rules_prompt: DEFAULT_AGENT_RULES_PROMPT,
  },
});

/** 业务校验错误，带可映射到 HTTP 状态的 code。 */
export class MetadataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MetadataError";
  }
}

/**
 * 清空某个 (team, agent) 的 chat_memory 内容（L0/L1/L2/L3 + 向量 + 文件）。
 *
 * 由 gateway 装配处实现并注入（见 MetadataService.setChatMemoryContentCleaner），
 * 因为内容存放在 IMemoryStore / StorageAdapter，不在 metadata store 里。
 */
export type ChatMemoryContentCleaner = (params: {
  teamId: string;
  agentId: string;
}) => Promise<void>;

/** Detect unique constraint violation (SQLite UNIQUE or MongoDB E11000) on a specific column. */
function isUniqueViolation(err: unknown, column?: string): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (/UNIQUE constraint failed/.test(msg)) {
    return column ? msg.includes(column) : true;
  }
  if ((err as any).code === 11000) {
    if (!column) return true;
    const kp = (err as any).keyPattern;
    return kp ? column in kp : msg.includes(column);
  }
  return false;
}

export interface AgentBasicData {
  agent_id: string;
  team_id: string;
  owner_user_id: string;
  prompt: string | null;
  visibility: AssetVisibility;
  status: string;
}

export interface AgentAssetView {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  description: string | null;
  status: AssetStatus;
  visibility: AssetVisibility;
  injection_mode: InjectionMode;
  priority: number;
  created_at: string;
}

export interface ListWithDetailParams {
  agent_id: string;
  apply_visibility_filter?: boolean;
  touch_usage?: boolean;
  limit?: number;
  offset?: number;
  /** 可选类型过滤：只返回列表中匹配的 asset_type；省略 / 空数组 = 不过滤。 */
  asset_types?: Array<"skill" | "llm_wiki" | "code_graph" | "chat_memory">;
}

export interface AgentFixedAssetDetailResult {
  agent: AgentBasicData;
  items: AgentAssetView[];
  total: number;
  limit: number;
  offset: number;
}

export interface CheckPermissionParams {
  user_id?: string;
  user_key?: string;
  asset_id: string;
  action: Permission;
  agent_id?: string;
}

export interface ListAccessibleAssetsParams {
  user_id?: string;
  user_key?: string;
  team_id?: string;
  action?: Permission;
  asset_type?: AssetType;
  agent_id?: string;
  /**
   * 可选的 visibility 白名单，用于在权限判定后再做二次过滤。
   * 例：`["team"]` = 只返回团队可见的（管控页"团队资产"tab 用）；
   * 不传 = 返回所有可访问的（含自己的 private）。
   * 目的：让前端从 HTTP 响应上就拿不到不需要的数据（安全 + 减小载荷）。
   */
  visibility?: AssetEntity["visibility"] | AssetEntity["visibility"][];
  /**
   * 协作轴：额外并入这些 project 里「U 是 member 的」资产（跨 team）。
   * 不传 = 只按 team 维度取（公共 ∪ 私有 ∪ ACL），与旧行为一致。
   */
  project_ids?: string[];
  /**
   * 用户维度：二次过滤，只返回 owner_user_id 等于该值的资产（在「可访问」范围内切片）。
   * 管控页「我的资产」tab / admin 按用户维度切换用。
   */
  owner_user_id?: string;
  limit?: number;
  offset?: number;
}

const FILTERED_STATUSES: AssetStatus[] = ["archived", "deprecated", "failed"];

export interface MetadataQuotaLimits {
  maxUsersPerInstance: number;
  maxTeamsPerInstance: number;
}

export const DEFAULT_METADATA_QUOTA_LIMITS: MetadataQuotaLimits = {
  maxUsersPerInstance: 500,
  maxTeamsPerInstance: 100,
};

export class MetadataService {
  private readonly quota: MetadataQuotaLimits;
  private readonly memorySystemUser?: MemorySystemUserConfig;
  private _configParams?: import("./config-param-service.js").IConfigParamService;

  /**
   * 进程内 LRU 缓存：已确认（在 store 里存在的） chat_memory 资产 id 集合。
   *
   * 命中即可跳过 getAssetById + createAsset + addAgentFixedAsset 三次 DB 往返。
   * 未命中就走完整 ensure 流程，成功后写入缓存。跨进程/多 pod 时各自维护自己
   * 的 LRU —— 一致性由 store 主键约束保证。
   *
   * 用 Map 的插入序 + 达到上限时淘汰最老项。达不到严格 LRU（不做 touch），
   * 但对于这个"只写一次、后续都命中"的场景足够：一旦确认存在，条目要么持续
   * 命中要么被更新的 team+agent 挤走再重新走一遍 DB —— 冷淘汰的代价只是一次
   * 数据库查询。maxSize 由 CHAT_MEMORY_ENSURE_CACHE_SIZE 控制。
   */
  private readonly ensuredChatMemoryAssets = new Map<string, true>();
  private static readonly CHAT_MEMORY_ENSURE_CACHE_SIZE = 4096;

  /**
   * skill 资产登记的进程内 LRU：key = skill_id（即 asset_id）。
   * 语义与 ensuredChatMemoryAssets 一致，短路 ensureSkillAsset 的重复 create+bind。
   */
  private readonly ensuredSkillAssets = new Map<string, true>();
  private static readonly SKILL_ENSURE_CACHE_SIZE = 4096;

  /** 由 gateway 注入的 chat_memory 内容清理器；未注入时归档只删资产不清内容。 */
  private _chatMemoryContentCleaner?: ChatMemoryContentCleaner;

  constructor(
    private readonly store: IMetadataStore,
    private readonly instanceId: string = DEFAULT_INSTANCE_ID,
    private readonly logger: PermCheckLogger = { debug: () => {} },
    quotaLimits?: Partial<MetadataQuotaLimits>,
    memorySystemUser?: MemorySystemUserConfig,
  ) {
    this.quota = { ...DEFAULT_METADATA_QUOTA_LIMITS, ...quotaLimits };
    this.memorySystemUser = memorySystemUser;
  }

  get scopedInstanceId(): string {
    return this.instanceId;
  }

  get configParams(): import("./config-param-service.js").IConfigParamService {
    if (!this._configParams) {
      throw new Error("ConfigParamService not initialized. Call setConfigParamService() after store.init().");
    }
    return this._configParams;
  }

  setConfigParamService(svc: import("./config-param-service.js").IConfigParamService): void {
    this._configParams = svc;
  }

  private _gitCredentials?: import("./git-credential-service.js").GitCredentialService;

  private _passwordHashConfig?: PasswordHashConfig;

  /** 密码哈希配置（懒加载）：pepper 可选，未配置时用空 pepper（scrypt+随机盐仍不可逆）。 */
  private passwordHashConfig(): PasswordHashConfig {
    if (!this._passwordHashConfig) {
      let pepper = Buffer.alloc(0);
      try {
        const b64 = process.env.TDAI_PASSWORD_PEPPER?.trim();
        if (b64) pepper = Buffer.from(b64, "base64");
      } catch {
        // 忽略非法 pepper，回退空 pepper
      }
      this._passwordHashConfig = { pepper, scryptN: 16384, scryptR: 8, scryptP: 1, keylen: 32 };
    }
    return this._passwordHashConfig;
  }

  get gitCredentials(): import("./git-credential-service.js").GitCredentialService {
    if (!this._gitCredentials) {
      throw new Error("GitCredentialService not initialized. Call setGitCredentialService() after store.init().");
    }
    return this._gitCredentials;
  }

  setGitCredentialService(svc: import("./git-credential-service.js").GitCredentialService): void {
    this._gitCredentials = svc;
  }

  /**
   * 注入「chat_memory 内容清理器」。
   *
   * 为什么用可选钩子而不是直接依赖 store：metadata 层只持有 IMetadataStore
   * （元数据），拿不到 IMemoryStore / StorageAdapter（L0–L3 内容）。归档
   * Agent 时要顺带删掉它的记忆内容，就需要由gateway 装配处把清理能力注入
   * 进来 —— 与 setConfigParamService 同一模式，保持依赖方向不反转。
   *
   * 未注入时 archiveAgent 退化为原行为（只删资产，不清内容），因此
   * 单测/ 迁移脚本等不装配该钩子的场景不受影响。
   */
  setChatMemoryContentCleaner(cleaner: ChatMemoryContentCleaner): void {
    this._chatMemoryContentCleaner = cleaner;
  }

  /** memory 静态 key 仅用于 auth/verify body，不可作 Header 鉴权。 */
  isConfiguredMemorySystemUserKey(userKey: string): boolean {
    return isMemorySystemUserKey(userKey, this.memorySystemUser);
  }

  private pag(input: { limit?: number; offset?: number }): PaginationParams {
    return resolvePagination(input);
  }

  private async allAclRecords(assetId: string): Promise<AclEntity[]> {
    const out: AclEntity[] = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const page = await this.store.listAclByAsset(assetId, { limit, offset });
      out.push(...page.items);
      if (offset + page.items.length >= page.total) break;
      offset += limit;
    }
    return out;
  }

  /** internal：按实例分页列出用户（含 system_admin，不脱敏）。 */
  async listUsersByInstance(
    instanceId: string,
    pagination: PaginationParams,
    filter?: InstanceUserListFilter,
  ): Promise<PaginatedResult<UserEntity>> {
    void instanceId;
    const page = await this.store.listUsers(pagination, filter);
    return formatListResult(page, pagination);
  }

  /** 校验用户存在，否则抛 not_found。 */
  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.getUserById(userId);
    if (!user) throw new MetadataError("user_not_found", `user not found: ${userId}`);
    return user;
  }

  get rawStore(): IMetadataStore {
    return this.store;
  }

  private async assertUserQuota(): Promise<void> {
    const count = await this.store.countUsers();
    const limit = this._configParams
      ? await this._configParams.getEffectiveInt("quota", "max_users_per_instance")
      : this.quota.maxUsersPerInstance;
    if (count >= limit) {
      throw new MetadataError(
        "user_limit_exceeded",
        `user limit ${limit} reached for instance ${this.instanceId} (current: ${count})`,
      );
    }
  }

  private async assertTeamQuota(): Promise<void> {
    const count = await this.store.countTeams();
    const limit = this._configParams
      ? await this._configParams.getEffectiveInt("quota", "max_teams_per_instance")
      : this.quota.maxTeamsPerInstance;
    if (count >= limit) {
      throw new MetadataError(
        "team_limit_exceeded",
        `team limit ${limit} reached for instance ${this.instanceId} (current: ${count})`,
      );
    }
  }

  // ============================================================
  // User（含 user_key 生成/刷新）
  // ============================================================
  async initAdminUser(input: InitAdminInput): Promise<InitAdminResult> {
    if ((await this.store.countUsers()) > 0) {
      throw new MetadataError("already_initialized", "system already has users; init-admin requires empty database");
    }
    if ((await this.store.countSystemAdmins()) > 0) {
      throw new MetadataError("already_initialized", "system_admin already exists");
    }

    // 核心操作：创建 admin 用户
    const created = await this.createUserWithType(
      { username: input.username, default_key_value: input.user_key },
      "system_admin",
    );

    // 辅助操作：自动创建默认 Team 和 Agent（失败不阻塞核心流程）
    try {
      const team = await this.createTeam({
        name: DEFAULT_TEAM_NAME,
        description: DEFAULT_TEAM_DESCRIPTION,
        owner_user_id: created.user_id,
      });

      try {
        await this.createAgent({
          agent_id: created.user_id, // 个人 Agent：agent_id 直接用 user_id
          team_id: team.team_id,
          owner_user_id: created.user_id,
          name: input.username,
          description: DEFAULT_AGENT_DESCRIPTION,
          prompt: DEFAULT_AGENT_PROMPT,
          metadata_json: DEFAULT_AGENT_METADATA_JSON,
          visibility: "team",
          status: "active",
        });
      } catch (err) {
        console.warn(
          `[init-admin] 默认 Agent 创建失败，已跳过 (user=${created.user_id})`,
          err instanceof Error ? err.message : err,
        );
      }
    } catch (err) {
      console.warn(
        `[init-admin] 默认 Team 创建失败，已跳过 (user=${created.user_id})`,
        err instanceof Error ? err.message : err,
      );
    }

    return { user_id: created.user_id, user_key: created.default_user_key };
  }

  async createNormalUser(input: CreateUserInput): Promise<CreateUserApiResult> {
    return this.createUserWithType(input, "normal");
  }

  /**
   * 仅供 /v3/meta/user/create-with-key 使用：允许 system_admin 在建号时显式指定 user_key。
   *
   * 两层去重：
   *   1. 前置 getUserByKey：正常路径快速失败，不进事务
   *   2. store 层 UNIQUE 约束（DuplicateUserKeyError）：TOCTOU / 并发兜底
   *
   * router 层需先调 assertPermission(ctx, "user.create") 做鉴权。
   */
  async createNormalUserWithKey(input: {
    username: string;
    user_key: string;
    /** 外部认证建号时传（如 WOA 工号），用于下次登录判断是否初次。 */
    external_id?: string;
    /** 外部认证体系标识（如 woa）；与 external_id 同域，缺省回落 local。 */
    auth_provider?: string;
    display_name?: string;
    email?: string;
  }): Promise<CreateUserApiResult> {
    const existing = await this.store.getUserByKey(input.user_key);
    if (existing) {
      throw new MetadataError("duplicate_user_key", "user_key already exists");
    }
    try {
      return await this.createUserWithType(
        {
          username: input.username,
          default_key_value: input.user_key,
          external_id: input.external_id,
          auth_provider: input.auth_provider,
          display_name: input.display_name,
          email: input.email,
        },
        "normal",
      );
    } catch (err) {
      if (err instanceof DuplicateUserKeyError) {
        throw new MetadataError("duplicate_user_key", "user_key already exists");
      }
      throw err;
    }
  }

  /** 未传 auth_provider / external_id 时补默认值（local / user_id）。 */
  private resolveCreateUserInput(
    input: CreateUserInput,
  ): CreateUserInput & { auth_provider: string; external_id: string } {
    // 显式带 external_id = 外部认证建号：即使调用方省略 auth_provider，也要落
    // 到外部域，与 find-by-external 的读取同域。
    // 否则会"写进 local 域、按外部域查"，下次登录被误判为初次。
    const externalId = input.external_id?.trim();
    const authProvider = input.auth_provider?.trim() || DEFAULT_AUTH_PROVIDER;
    if (externalId) {
      return { ...input, auth_provider: authProvider, external_id: externalId };
    }
    const userId = input.user_id ?? generateId(ID_PREFIX.user);
    return { ...input, auth_provider: authProvider, user_id: userId, external_id: userId };
  }

  private async createUserWithType(input: CreateUserInput, userType: UserType): Promise<CreateUserApiResult> {
    const resolved = this.resolveCreateUserInput(input);
    await this.assertUserQuota();
    const user = await this.store.createUser({
      ...resolved,
      password: input.password ? hashPassword(input.password, this.passwordHashConfig()) : null,
      user_type: userType,
    });
    const defaultKey = await this.store.getDefaultUserKey(user.user_id);
    if (!defaultKey) {
      throw new MetadataError("internal_error", "default user key not created");
    }
    return {
      user_id: user.user_id,
      user_type: user.user_type,
      created_at: user.created_at,
      default_user_key: defaultKey.key_value,
    };
  }

  async getUserForCaller(userId: string, ctx: V3AuthContext): Promise<UserPublic> {
    const user = await this.getUserById(userId);
    if (!user || !canViewUser(user, ctx)) {
      throw new MetadataError("user_not_found", `user not found: ${userId}`);
    }
    return toPublicUser(user, ctx);
  }

  async getUserById(userId: string): Promise<UserEntity | null> {
    return this.store.getUserById(userId);
  }

  async getUserByKey(userKey: string): Promise<UserEntity | null> {
    return this.store.getUserByKey(userKey);
  }

  async getUserByExternalId(authProvider: string, externalId: string): Promise<UserEntity | null> {
    return this.store.getUserByExternalId(authProvider, externalId);
  }

  /**
   * 外部认证（如 WOA）登录后判断是否初次：按 (auth_provider, external_id) 反查 user。
   *
   * 复用 core 既有的 meta_users.external_id 字段（origin 引入，原为太湖 OAuth2 的
   * sub/工号而设，语义与本需求一致），不新建关联表。
   *
   * 注意：未绑定外部身份的账号，其 external_id 由 resolveCreateUserInput 兜底填
   * user_id（`usr-xxx`），与工号格式不同，因此不会误命中。
   */
  async findUserByExternalId(
    externalId: string,
    authProvider?: string,
  ): Promise<UserEntity | null> {
    const provider = authProvider?.trim() || DEFAULT_AUTH_PROVIDER;
    return this.store.getUserByExternalId(provider, externalId);
  }

  /**
   * 把外部认证唯一标识绑定到**已有**账号（存量账号接入外部认证）。
   *
   * 只写 external_id，**不改 auth_provider**——存量账号原本用 user_key 登录，
   * 绑定后仍可用原 user_key 登录，外部认证只是新增一种入口。
   *
   * 冲突：该 external_id 已绑到**另一个** user 时抛错，避免一个外部身份对应多个账号。
   * 幂等：重复绑定同一个 external_id 到同一 user 直接返回。
   */
  async bindExternalIdToUser(
    userId: string,
    externalId: string,
    authProvider?: string,
    displayName?: string,
  ): Promise<UserEntity> {
    const provider = authProvider?.trim() || DEFAULT_AUTH_PROVIDER;
    // 先确认目标账号存在，避免把外部身份绑到不存在的 user 上。
    const user = await this.requireUser(userId);

    const existing = await this.store.getUserByExternalId(provider, externalId);
    if (existing && existing.user_id !== userId) {
      throw new MetadataError(
        "external_id_already_bound",
        `external_id is already bound to another user: ${existing.user_id}`,
      );
    }

    // 绑定前先摘掉"未绑定占位 external_id"（= user_id）可能带来的误撞：
    // 目标账号若正持有占位值，而待绑的 external_id 恰好等于它（极端场景），
    // 上面的 existing 判定会被自己命中而提前返回，故统一走一次写入。
    const patch: Partial<UserEntity> = {
      external_id: externalId,
      auth_provider: provider,
    };
    // 展示名只在"有值且目标账号当前为空"时补写：
    // 不覆盖人工改过的名字，也不把 IdP 的空值写进去把已有名字抹掉。
    const incomingName = displayName?.trim();
    if (incomingName && !user.display_name) patch.display_name = incomingName;

    if (existing && existing.user_id === userId && !patch.display_name) return user;

    const updated = await this.store.updateUser(userId, patch);
    if (!updated) throw new MetadataError("user_not_found", `user not found: ${userId}`);
    return updated;
  }

  async deleteUsersForCaller(userIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    if (!(await this.hasPermission(ctx, "user.delete"))) {
      throw new MetadataError("permission_denied", "user management requires user.delete");
    }
    let deletingSystemAdmins = 0;
    for (const id of userIds) {
      const u = await this.getUserById(id);
      if (u && isSystemAdminUser(u)) deletingSystemAdmins++;
    }
    const totalAdmins = await this.store.countSystemAdmins();
    if (totalAdmins > 0 && totalAdmins - deletingSystemAdmins < 1) {
      throw new MetadataError("last_system_admin", "cannot delete the last system_admin user");
    }
    return this.deleteUsers(userIds);
  }

  async deleteUsers(userIds: string[]): Promise<BatchDeleteResult> {
    return this.store.deleteUsers(userIds);
  }

  async listUsersForCaller(
    input: { team_id?: string } & UserListFilter,
    ctx: V3AuthContext,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<UserPublic>> {
    const filtersPresent = !!(input.user_ids?.length || input.username);
    const storeFilter = this.buildUserListStoreFilter(input);

    if (!input.team_id) {
      if (!ctx.isSystemAdmin) {
        throw new MetadataError("missing_team_id", "team_id is required for non-system-admin callers");
      }
      const page = await this.store.listUsers(pagination, storeFilter);
      const items = filterVisibleUsers(page.items, ctx);
      return formatListResult({ items, total: page.total }, pagination);
    }

    const teamId = input.team_id;

    if (ctx.isSystemAdmin) {
      const page = await this.store.listUsersByTeam(teamId, pagination, storeFilter);
      const items = filterVisibleUsers(page.items, ctx);
      return formatListResult({ items, total: page.total }, pagination);
    }

    if (!ctx.userId) {
      throw new MetadataError("permission_denied", "authentication required");
    }

    const member = await this.store.getTeamMember(teamId, ctx.userId);
    if (!member || member.status !== "active") {
      throw new MetadataError("permission_denied", "not a team member");
    }

    const isTeamAdmin = member.role === "admin";
    if (isTeamAdmin) {
      const page = await this.store.listUsersByTeam(teamId, pagination, storeFilter);
      const items = filterVisibleUsers(page.items, ctx, { allowTeamPeers: true });
      return formatListResult({ items, total: page.total }, pagination);
    }

    if (filtersPresent) {
      throw new MetadataError("filter_not_allowed", "filters are not allowed for normal team members");
    }

    const self = await this.store.getUserById(ctx.userId);
    if (!self) {
      throw new MetadataError("user_not_found", `user not found: ${ctx.userId}`);
    }
    const visible = filterVisibleUsers([self], ctx);
    if (pagination.offset > 0) {
      return wrapPaginated([], 1, pagination);
    }
    return wrapPaginated(visible, 1, pagination);
  }

  private buildUserListStoreFilter(input: UserListFilter): InstanceUserListFilter | undefined {
    const filter: InstanceUserListFilter = {};
    if (input.user_ids?.length) filter.user_ids = input.user_ids;
    if (input.username) filter.username = input.username;
    return Object.keys(filter).length ? filter : undefined;
  }

  /** @deprecated 使用 listUsersForCaller */
  async listUsersByTeamForCaller(
    teamId: string,
    ctx: V3AuthContext,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<UserPublic>> {
    return this.listUsersForCaller({ team_id: teamId }, ctx, pagination);
  }

  async listUsersByTeam(teamId: string, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<UserEntity>> {
    const page = await this.store.listUsersByTeam(teamId, pagination);
    return formatListResult(page, pagination);
  }

  /** 断言调用方拥有某全局能力权限项（方案B RBAC）。 */
  async assertPermission(ctx: V3AuthContext, perm: GlobalPermission): Promise<void> {
    if (!(await this.hasPermission(ctx, perm))) {
      throw new MetadataError("permission_denied", `requires permission ${perm}`);
    }
  }

  /** 断言调用方可管理用户（system_admin）。 */
  assertCanManageUsers(ctx: V3AuthContext): void {
    if (!canManageUsers(ctx)) {
      throw new MetadataError("permission_denied", "user management requires system admin");
    }
  }

  /** 是否拥有某全局能力权限项（预置角色默认 ∪ 显式授权）。 */
  async hasPermission(ctx: V3AuthContext, perm: GlobalPermission): Promise<boolean> {
    if (ctx.isSystemAdmin) return true; // system_admin 默认全能力
    const userId = ctx.userId;
    if (!userId) return false;
    if (NORMAL_DEFAULT.has(perm)) return true; // 协作基础能力默认开放
    const granted = await this.store.getPermissionByUserAndPerm(userId, perm);
    return !!granted;
  }

  canManageUserScope(userId: string, ctx: V3AuthContext): boolean {
    return ctx.isAdmin || ctx.isSystemAdmin || ctx.userId === userId;
  }

  assertUserScope(userId: string, callerUserId?: string, isAdmin = false, isSystemAdmin = false): void {
    if (isAdmin || isSystemAdmin || userId === callerUserId) return;
    throw new MetadataError("permission_denied", "cannot access another user's keys");
  }

  assertCallerIsOwner(targetUserId: string, callerId: string): void {
    if (targetUserId !== callerId) {
      throw new MetadataError("permission_denied", "user_id does not match caller");
    }
  }

  async verifyAuthForCaller(userKey: string, ctx: V3AuthContext): Promise<{ valid: boolean; user: UserPublic | null }> {
    const user = await this.verifyAuth(userKey);
    if (!user) return { valid: false, user: null };
    const visibilityCtx: V3AuthContext = ctx.userId
      ? ctx
      : {
          token: userKey,
          userId: user.user_id,
          isAdmin: false,
          isSystemAdmin: user.user_type === "system_admin",
        };
    if (!canViewUser(user, visibilityCtx)) {
      return { valid: true, user: null };
    }
    if (this.memorySystemUser && user.user_id === this.memorySystemUser.userId) {
      return {
        valid: true,
        user: {
          user_id: user.user_id,
          user_type: user.user_type,
          username: user.username,
          created_at: user.created_at,
        },
      };
    }
    return { valid: true, user: toPublicUser(user, visibilityCtx) };
  }

  /** 校验 user_key 并返回对应用户（无效返回 null）。 */
  async verifyAuth(userKey: string): Promise<UserEntity | null> {
    if (!userKey) return null;
    const configured = lookupMemorySystemUser(userKey, this.instanceId, this.memorySystemUser);
    if (configured) return configured;
    return this.store.getUserByKey(userKey);
  }


  /**
   * 用户名+密码登录。校验 username + password → 返回 user 与其 default user_key。
   * 前端用返回的 user_key 继续走 Header 双凭证鉴权（与现有 auth/verify 一致）。
   * 用户名不存在 / 未设密码 / 密码不符均返回 null（对外统一「用户名或密码错误」）。
   */
  async loginWithPassword(
    username: string,
    password: string,
  ): Promise<{ user: UserPublic; default_key_value: string } | null> {
    const user = await this.store.getUserByUsername(DEFAULT_AUTH_PROVIDER, username);
    if (!user || !user.password) return null;
    if (!verifyPasswordHash(password, user.password, this.passwordHashConfig())) return null;
    const defaultKey = await this.store.getDefaultUserKey(user.user_id);
    if (!defaultKey) return null;
    const ctx: V3AuthContext = {
      token: defaultKey.key_value,
      userId: user.user_id,
      isAdmin: false,
      isSystemAdmin: user.user_type === "system_admin",
    };
    return { user: toPublicUser(user, ctx), default_key_value: defaultKey.key_value };
  }

  /** admin 或本人设置/重置密码（scrypt 哈希后落库）。 */
  async setUserPasswordForCaller(userId: string, password: string, ctx: V3AuthContext): Promise<void> {
    const self = ctx.userId === userId;
    if (!self && !(await this.hasPermission(ctx, "user.set_password"))) {
      throw new MetadataError("permission_denied", "requires user.set_password");
    }
    const user = await this.store.getUserById(userId);
    if (!user) throw new MetadataError("user_not_found", `user not found: ${userId}`);
    await this.store.updateUser(userId, { password: hashPassword(password, this.passwordHashConfig()) });
  }

  toPublicUserKey(entity: UserKeyEntity): UserKeyPublic {
    return {
      key_id: entity.key_id,
      user_id: entity.user_id,
      key_prefix: maskUserKey(entity.key_value),
      name: entity.name ?? null,
      status: entity.status,
      is_default: entity.is_default,
      last_used_at: entity.last_used_at ?? null,
      expires_at: entity.expires_at ?? null,
      created_at: entity.created_at,
      revoked_at: entity.revoked_at ?? null,
    };
  }

  async createUserKey(
    userId: string,
    input: { name?: string | null; expires_at?: string | null },
  ): Promise<UserKeyCreated> {
    await this.requireUser(userId);

    const active = await this.store.countActiveUserKeys(userId);
    if (active >= this.maxActiveUserKeys) {
      throw new MetadataError("key_limit_exceeded", `active user key limit ${this.maxActiveUserKeys} reached`);
    }

    const entity = await this.store.createUserKey({
      user_id: userId,
      name: input.name,
      expires_at: input.expires_at,
      is_default: false,
    });
    return { ...this.toPublicUserKey(entity), key_value: entity.key_value };
  }

  async listUserKeys(userId: string, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<UserKeyPublic>> {
    await this.requireUser(userId);
    const page = await this.store.listUserKeys(userId, pagination);
    const items = page.items.map((k) => this.toPublicUserKey(k));
    return formatListResult({ items, total: page.total }, pagination);
  }

  async getUserKey(keyId: string): Promise<UserKeyPublic> {
    const entity = await this.store.getUserKeyById(keyId);
    if (!entity) throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    return this.toPublicUserKey(entity);
  }

  /** 校验调用方有权访问该 key（本人、system_admin 或 bootstrap），返回脱敏详情。 */
  async getUserKeyForCaller(
    keyId: string,
    callerUserId?: string,
    isAdmin = false,
    isSystemAdmin = false,
  ): Promise<UserKeyPublic> {
    const entity = await this.store.getUserKeyById(keyId);
    if (!entity) throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    const owner = await this.getUserById(entity.user_id);
    if (!owner) {
      throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    }
    if (!isAdmin && !isSystemAdmin && entity.user_id !== callerUserId) {
      throw new MetadataError("permission_denied", "cannot access another user's key");
    }
    if (isSystemAdminUser(owner) && !isAdmin && callerUserId !== owner.user_id) {
      throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    }
    return this.toPublicUserKey(entity);
  }

  async revokeUserKey(keyId: string): Promise<void> {
    const entity = await this.store.getUserKeyById(keyId);
    if (!entity) throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    if (!(await this.getUserById(entity.user_id))) {
      throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    }

    const active = await this.store.countActiveUserKeys(entity.user_id);
    if (active <= 1) {
      throw new MetadataError("last_key_cannot_revoke", "cannot revoke the last active user key");
    }

    console.info(
      `[META] revokeUserKey: user_id=${entity.user_id} key_id=${entity.key_id} key_prefix=${maskUserKey(entity.key_value)}`,
    );
    await this.store.revokeUserKey(keyId, { promoteNextDefault: true });
  }

  async updateUserKey(
    keyId: string,
    patch: { name?: string | null; expires_at?: string | null },
  ): Promise<UserKeyPublic> {
    const existing = await this.store.getUserKeyById(keyId);
    if (!existing) throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    if (!(await this.getUserById(existing.user_id))) {
      throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    }

    const updated = await this.store.updateUserKey(keyId, patch);
    if (!updated) throw new MetadataError("user_key_not_found", `user key not found: ${keyId}`);
    return this.toPublicUserKey(updated);
  }

  private get maxActiveUserKeys(): number {
    const fromEnv = Number(process.env.TDAI_USER_KEY_MAX_ACTIVE);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_ACTIVE_USER_KEYS;
  }

  // ============================================================
  // Team
  // ============================================================
  async createTeam(input: CreateTeamInput): Promise<TeamEntity> {
    await this.assertTeamQuota();
    return this.store.createTeam(input);
  }

  async getTeamById(teamId: string): Promise<TeamEntity | null> {
    return this.store.getTeamById(teamId);
  }

  async updateTeam(teamId: string, patch: Partial<TeamEntity>): Promise<TeamEntity> {
    if (!(await this.getTeamById(teamId))) throw new MetadataError("team_not_found", `team not found: ${teamId}`);
    const updated = await this.store.updateTeam(teamId, patch);
    if (!updated) throw new MetadataError("team_not_found", `team not found: ${teamId}`);
    return updated;
  }

  async deleteTeams(teamIds: string[]): Promise<BatchDeleteResult> {
    return this.store.deleteTeams(teamIds);
  }

  async listTeamsByUser(userId: string, pagination: PaginationParams = DEFAULT_PAGINATION, filter?: { name?: string }): Promise<PaginatedResult<TeamEntity>> {
    const page = await this.store.listTeamsByUser(userId, pagination, filter);
    const items = page.items;
    return formatListResult({ items, total: page.total }, pagination);
  }


  /** admin 看全部团队（普通用户仍走 listTeamsByUser）。 */
  async listTeams(filter?: { name?: string }, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<TeamEntity>> {
    const page = await this.store.listTeams(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // TeamMember
  // ============================================================
  async addTeamMember(input: AddTeamMemberInput): Promise<TeamMemberEntity> {
    const team = await this.getTeamById(input.team_id);
    if (!team) throw new MetadataError("team_not_found", `team not found: ${input.team_id}`);
    const reqRole = input.role ?? "member";
    // owner 由 createTeam 固定为 admin；禁止经 add upsert 降级，否则会出现
    // 「仍是 owner 但 role≠admin」——面板当 admin、team-member/add 却 403。
    if (input.user_id === team.owner_user_id && reqRole !== "admin") {
      throw new MetadataError("permission_denied", "cannot demote team owner");
    }
    const existing = await this.store.getTeamMember(input.team_id, input.user_id);
    if (existing?.status === "active" && existing.role === reqRole) {
      throw new MetadataError(
        "member_already_exists",
        `member already exists: ${input.team_id}/${input.user_id}`,
      );
    }

    // 核心操作：将用户加入 Team
    const result = await this.store.addTeamMember({ ...input, role: reqRole });

    return result;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await this.store.removeTeamMember(teamId, userId);
  }

  async listTeamMembers(teamId: string, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<TeamMemberEntity>> {
    const page = await this.store.listTeamMembers(teamId, pagination);
    return formatListResult(page, pagination);
  }

  async getTeamMember(teamId: string, userId: string): Promise<TeamMemberEntity | null> {
    return this.store.getTeamMember(teamId, userId);
  }

  // ============================================================
  // Agent（校验 team 存在）
  // ============================================================
  async createAgent(input: CreateAgentInput): Promise<AgentEntity> {
    await this.assertTeamExists(input.team_id);
    const agent = await this.store.createAgent(input);
    // 建 agent 时自动挂载记忆空间（默认策略落库，供召回侧空间隔离使用）。
    // 幂等 + 失败非致命：同上，空间挂载是"更早准备好"，缺了也不阻塞建 agent。
    try {
      await this.mountDefaultSpaces(agent);
    } catch (err) {
      console.warn(
        `[META] createAgent: mountDefaultSpaces failed (agent=${agent.agent_id} team=${agent.team_id}): ` +
        (err instanceof Error ? err.message : String(err)),
      );
    }
    // 建 agent 的同一事务边界外，立即 mint 该 agent 的 chat_memory 资产 +
    // 绑定到 fixed_assets。avoids Bug 2：首次对话触发时 asset 还不存在 →
    // profile-memory-injector 首个 session prewarm 走 fallback 到 tools-only、
    // 且 session_init 缓存策略下当 session 内永远读不到 L3。
    //
    // 幂等：ensureChatMemoryAsset 内部对已存在 asset / 已存在 binding 走 no-op。
    // 失败非致命：agent 已建成功，chat_memory 只是"更早准备好"，
    // 即便这里失败，/conversation/add 那条链路依然会重试 ensure，故此处仅 log warn。
    try {
      await this.ensureChatMemoryAsset({
        team_id: agent.team_id,
        agent_id: agent.agent_id,
      });
    } catch (err) {
      // 这里没有专用 warn logger（service 层只有 PermCheckLogger.debug），
      // 用 console.warn 与 v2-router.handleConversationAdd 里同类 catch 保持一致。
      console.warn(
        `[META] createAgent: ensureChatMemoryAsset failed (agent=${agent.agent_id} team=${agent.team_id}): ` +
        (err instanceof Error ? err.message : String(err)),
      );
    }
    return agent;
  }

  /**
   * 按 mountSpacesForAgent 默认策略持久化 agent 挂载的记忆空间。
   * (agent_id, space_id) 幂等 upsert，重复调用无副作用。
   */
  async mountDefaultSpaces(agent: AgentEntity): Promise<void> {
    const spaces = mountSpacesForAgent(agent.agent_id, {
      teamId: agent.team_id,
      userId: agent.owner_user_id,
      projectId: agent.project_id ?? undefined,
    });
    const inputs: CreateAgentSpaceInput[] = spaces.map((s) => ({
      agent_id: agent.agent_id,
      space_id: s.spaceId,
      owner_type: s.ownerType,
      owner_id: s.ownerId,
      domain: s.domain,
      write_policy: s.writePolicy,
      source: "default_mount",
    }));
    await this.store.createAgentSpaces(inputs);
  }

  /** 查询 agent 已持久化挂载的记忆空间。 */
  async getMountedSpaces(agentId: string): Promise<AgentSpaceEntity[]> {
    return this.store.getAgentSpaces(agentId);
  }


  /**
   * 记忆空间组合筛选（需求 4：团队 × 项目 × Agent × 用户 AND）。
   * team/project/user 通过 agent 的字段过滤（listAgentsByTeam 的 AgentFilter），
   * agent 则精确到 space.agent_id。四者可同时生效。
   */
  async listAgentSpaces(params: AgentSpaceFilter): Promise<AgentSpaceEntity[]> {
    const agentFilter: AgentFilter = {};
    if (params.owner_user_id) agentFilter.owner_user_id = params.owner_user_id;
    if (params.project_id !== undefined) agentFilter.project_id = params.project_id;

    let agentIds: string[];
    if (params.team_id) {
      const { items } = await this.store.listAgentsByTeam(
        params.team_id,
        { limit: 1000, offset: 0 },
        agentFilter,
      );
      agentIds = items.map((a) => a.agent_id);
    } else {
      // 未指定团队：无法确定可见 agent 集合，返回空（前端始终带 team 维度）。
      agentIds = [];
    }

    if (params.agent_id) {
      if (!agentIds.includes(params.agent_id)) return [];
      return this.store.getAgentSpaces(params.agent_id);
    }
    return this.store.listAgentSpacesByAgentIds(agentIds);
  }

  async getAgentById(agentId: string): Promise<AgentEntity | null> {
    return this.store.getAgentById(agentId);
  }

  async updateAgent(agentId: string, patch: Partial<AgentEntity>): Promise<AgentEntity> {
    if (!(await this.getAgentById(agentId))) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    const updated = await this.store.updateAgent(agentId, patch);
    if (!updated) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    return updated;
  }

  async deleteAgents(agentIds: string[]): Promise<BatchDeleteResult> {
    return this.store.deleteAgents(agentIds);
  }

  async listAgentsByTeam(
    teamId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
    filter?: AgentFilter,
  ): Promise<PaginatedResult<AgentEntity>> {
    const page = await this.store.listAgentsByTeam(teamId, pagination, filter);
    const items = page.items;
    return formatListResult({ items, total: page.total }, pagination);
  }

  async listAgentsByOwner(
    userId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
    filter?: AgentFilter,
  ): Promise<PaginatedResult<AgentEntity>> {
    const page = await this.store.listAgentsByOwner(userId, pagination, filter);
    const items = page.items;
    return formatListResult({ items, total: page.total }, pagination);
  }

  /**
   * 归档（软关闭）agent。
   *
   * 顺序很关键 —— **先清内容，再删资产**：
   *   1. status → inactive
   *   2.清空该 agent 的 chat_memory 内容（L0/L1/L2/L3 + 向量 + 文件）
   *   3. 删除自身 chat_memory 资产记录（并级联清掉其它 agent 的借入绑定）
   *
   * 若把顺序颠倒（先删资产再清内容），资产记录一没，就再也无法从
   * asset_id 定位到 (team, agent)，内容会变成**永久不可达的孤儿数据**
   * 留在库里 —— 这正是本次修复的问题。
   *
   * 内容清理失败时**中止归档**并向上抛：宁可让调用方重试，也不要留下
   * "资产已删、内容还在"的不一致状态。未注入 cleaner 时（单测 / 迁移
   * 脚本）跳过第 2 步，退化为原行为。
   */
  async archiveAgent(agentId: string): Promise<AgentEntity> {
    const existing = await this.getAgentById(agentId);
    if (!existing) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    const archived = await this.updateAgent(agentId, { status: "inactive" });

    if (this._chatMemoryContentCleaner) {
      await this._chatMemoryContentCleaner({
        teamId: existing.team_id,
        agentId: existing.agent_id,
      });
    }

    const selfMemoryAssetId = buildChatMemoryAssetId(existing.team_id, existing.agent_id);
    await this.store.deleteAssets([selfMemoryAssetId]);
    return archived;
  }

  // ============================================================
  // Task（校验 team 存在 + linked agents 同 team）
  // ============================================================
  async createTask(input: CreateTaskInput): Promise<TaskEntity> {
    await this.assertTeamExists(input.team_id);
    for (const link of input.linked_agents ?? []) {
      const agent = await this.getAgentById(link.agent_id);
      if (!agent) {
        throw new MetadataError("agent_not_found", `agent not found: ${link.agent_id}`);
      }
      if (agent.team_id !== input.team_id) {
        throw new MetadataError(
          "agent_team_mismatch",
          `agent ${link.agent_id} not in team ${input.team_id}`,
        );
      }
    }
    return this.store.createTask(input);
  }

  async getTaskById(taskId: string): Promise<TaskEntity | null> {
    return this.store.getTaskById(taskId);
  }

  async updateTask(taskId: string, patch: Partial<TaskEntity>): Promise<TaskEntity> {
    if (!(await this.getTaskById(taskId))) throw new MetadataError("task_not_found", `task not found: ${taskId}`);
    const updated = await this.store.updateTask(taskId, patch);
    if (!updated) throw new MetadataError("task_not_found", `task not found: ${taskId}`);
    return updated;
  }

  async deleteTasks(taskIds: string[]): Promise<BatchDeleteResult> {
    return this.store.deleteTasks(taskIds);
  }

  async listTasksByTeam(
    teamId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
    filter?: TaskFilter,
  ): Promise<PaginatedResult<TaskEntity>> {
    const page = await this.store.listTasksByTeam(teamId, pagination, filter);
    const items = page.items;
    return formatListResult({ items, total: page.total }, pagination);
  }

  async listTasks(filter: TaskFilter, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<TaskEntity>> {
    const page = await this.store.listTasks(filter, pagination);
    const items = page.items;
    return formatListResult({ items, total: page.total }, pagination);
  }

  /** 归档（软关闭）task：status → completed。 */
  async archiveTask(taskId: string): Promise<TaskEntity> {
    return this.updateTask(taskId, { status: "completed" });
  }

  // ============================================================
  // TaskAgent
  // ============================================================
  async linkTaskAgent(taskId: string, agentId: string, roleInTask?: string): Promise<TaskAgentEntity> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new MetadataError("task_not_found", `task not found: ${taskId}`);
    const agent = await this.getAgentById(agentId);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    if (agent.team_id !== task.team_id) {
      throw new MetadataError("agent_team_mismatch", `agent ${agentId} not in team ${task.team_id}`);
    }
    return this.store.linkTaskAgent(taskId, agentId, roleInTask);
  }

  async unlinkTaskAgent(taskId: string, agentId: string): Promise<void> {
    if (!(await this.getTaskById(taskId))) throw new MetadataError("task_not_found", `task not found: ${taskId}`);
    await this.store.unlinkTaskAgent(taskId, agentId);
  }

  async listTaskAgents(taskId: string, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<TaskAgentEntity>> {
    const page = await this.store.listTaskAgents(taskId, pagination);
    return formatListResult(page, pagination);
  }

  // ============================================================
  // ParticipationLog
  // ============================================================
  async appendParticipationLog(input: AppendParticipationLogInput): Promise<ParticipationLogEntity> {
    await this.assertParticipationContext(input.team_id, input.task_id, input.agent_id, input.user_id);
    return this.store.appendParticipationLog(input);
  }

  async listParticipationLogs(
    filter: ParticipationLogFilter,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<ParticipationLogEntity>> {
    const page = await this.store.listParticipationLogs(filter, pagination);
    return formatListResult(page, pagination);
  }

  private async assertParticipationContext(
    teamId: string,
    taskId: string,
    agentId: string,
    userId: string,
  ): Promise<void> {
    await this.assertTeamExists(teamId);
    const task = await this.getTaskById(taskId);
    if (!task) throw new MetadataError("task_not_found", `task not found: ${taskId}`);
    if (task.team_id !== teamId) {
      throw new MetadataError("permission_denied", `task ${taskId} not in team ${teamId}`);
    }
    const agent = await this.getAgentById(agentId);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    // if (agent.team_id !== teamId) {
    //   throw new MetadataError("agent_team_mismatch", `agent ${agentId} not in team ${teamId}`);
    // }
    const member = await this.getTeamMember(teamId, userId);
    if (!member || member.status !== "active") {
      throw new MetadataError("member_not_found", `member not found: ${teamId}/${userId}`);
    }
    // const links = await this.store.listTaskAgents(taskId, { limit: 1000, offset: 0 });
    // if (!links.items.some((l) => l.agent_id === agentId)) {
    //   throw new MetadataError("task_agent_not_linked", `task ${taskId} not linked to agent ${agentId}`);
    // }
  }

  // ============================================================
  // Asset（仅主表）
  // ============================================================
  async createAsset(input: CreateAssetInput): Promise<AssetEntity> {
    await this.assertTeamExists(input.team_id);
    const asset = await this.store.createAsset(input);
    await this.seedDefaultAssetAcls(asset);
    return asset;
  }

  /**
   * 资产默认 ACL：创建资产时把「owner 全权 + team 角色默认」显式落库（幂等）。
   * 与 permission-checker 的 owner 短路 / ADMIN_ACTIONS / MEMBER_ACTIONS 保持一致，
   * 让「资产 ACL」页默认就有可见的授权记录，而不是空 0。
   * granted_by 固定为 "system"，区别于人工授权（granted_by=调用者 user_id）。
   */
  private async seedDefaultAssetAcls(asset: AssetEntity): Promise<void> {
    const defaults: Array<{ subjectType: AclSubjectType; subjectId: string; permissions: Permission[] }> = [
      { subjectType: "user", subjectId: asset.owner_user_id, permissions: OWNER_ACTIONS },
      { subjectType: "team_role", subjectId: "admin", permissions: ADMIN_ACTIONS },
      { subjectType: "team_role", subjectId: "member", permissions: MEMBER_ACTIONS },
      { subjectType: "team_role", subjectId: "reviewer", permissions: MEMBER_ACTIONS },
    ];
    for (const d of defaults) {
      for (const permission of d.permissions) {
        try {
          await this.store.grantAcl({
            asset_id: asset.asset_id,
            subject_type: d.subjectType,
            subject_id: d.subjectId,
            permission,
            effect: "allow",
            granted_by: "system",
          });
        } catch {
          this.logger.debug(`[META] seed default ACL failed: ${asset.asset_id} ${d.subjectType}:${d.subjectId} ${permission}`);
        }
      }
    }
  }

  async getAssetById(assetId: string): Promise<AssetEntity | null> {
    return this.store.getAssetById(assetId);
  }

  async updateAsset(assetId: string, patch: Partial<AssetEntity>): Promise<AssetEntity> {
    if (!(await this.getAssetById(assetId))) throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
    const updated = await this.store.updateAsset(assetId, patch);
    if (!updated) throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
    return updated;
  }

  async deleteAssets(assetIds: string[]): Promise<BatchDeleteResult> {
    const result = await this.store.deleteAssets(assetIds);
    // 清 ensure 缓存，避免删后短路径误判「仍存在」
    for (const id of result.deleted_ids) {
      this.ensuredSkillAssets.delete(id);
      this.ensuredChatMemoryAssets.delete(id);
    }
    return result;
  }

  async listAssetsByTeam(
    teamId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
    filter?: AssetFilter,
  ): Promise<PaginatedResult<AssetEntity>> {
    const page = await this.store.listAssetsByTeam(teamId, pagination, filter);
    const items = page.items;
    return formatListResult({ items, total: page.total }, pagination);
  }

  async touchAssetUsage(assetId: string): Promise<void> {
    if (!(await this.getAssetById(assetId))) throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
    await this.store.touchAssetUsage(assetId);
  }

  async listAgentFixedAssets(
    agentId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<FixedAssetBindingEntity>> {
    const page = await this.store.listAgentFixedAssets(agentId, pagination);
    return formatListResult(page, pagination);
  }

  /**
   * 多 agent 固定资产分配汇总。缺失 agent / type 补 0；items 顺序与请求 agent_ids 一致。
   * 可选 asset_id：只统计绑定了该资产的行（用于 bound_agent_count）。
   */
  async summarizeAgentFixedAssetsByAgents(
    params: SummarizeAgentFixedAssetsParams,
  ): Promise<AgentFixedAssetSummaryResult> {
    const agentIds = [...new Set(params.agent_ids.filter((id) => id.length > 0))];
    if (agentIds.length === 0) {
      return { items: [], total: 0 };
    }

    const emptyCounts = (): FixedAssetTypeCounts => ({
      skill: 0,
      code_graph: 0,
      llm_wiki: 0,
      chat_memory: 0,
    });

    const rows = await this.store.summarizeAgentFixedAssetsByAgents(agentIds, {
      assetId: params.asset_id,
    });

    const byAgent = new Map<string, FixedAssetTypeCounts>();
    const totals = new Map<string, number>();
    for (const id of agentIds) {
      byAgent.set(id, emptyCounts());
      totals.set(id, 0);
    }
    for (const row of rows) {
      const counts = byAgent.get(row.agent_id);
      if (!counts) continue;
      if (row.asset_type in counts) {
        counts[row.asset_type] = row.cnt;
      }
      totals.set(row.agent_id, (totals.get(row.agent_id) ?? 0) + row.cnt);
    }

    const items: AgentFixedAssetSummary[] = agentIds.map((agent_id) => ({
      agent_id,
      counts: byAgent.get(agent_id) ?? emptyCounts(),
      total: totals.get(agent_id) ?? 0,
    }));

    return { items, total: items.length };
  }

  // ============================================================
  // AgentFixedAsset（canBindAsset 校验 + 详情聚合）
  // ============================================================
  async setAgentFixedAssets(agentId: string, bindings: FixedAssetBindingInput[]): Promise<void> {
    const agent = await this.getAgentById(agentId);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);

    for (const b of bindings) {
      const asset = await this.getAssetById(b.asset_id);
      if (!asset) {
        throw new MetadataError("asset_not_found", `asset not found: ${b.asset_id}`);
      }
      if (!canBindAsset(agent, asset)) {
        throw new MetadataError(
          "asset_not_bindable",
          `asset ${b.asset_id} (visibility=${asset.visibility}) cannot bind to agent ${agentId}`,
        );
      }
    }
    await this.store.setAgentFixedAssets(agentId, bindings);
  }

  /**
   * 追加一条 agent 绑定（保留已有绑定）。用于自动登记 chat_memory 资产等
   * 增量场景；不同于 setAgentFixedAssets 的全量替换。
   *
   * 校验：agent / asset 必须都在当前 instance；canBindAsset 必须通过。
   * 幂等：store 层靠 (agent_id, asset_id) unique 约束，重复调用无副作用。
   */
  async addAgentFixedAsset(agentId: string, b: FixedAssetBindingInput): Promise<void> {
    const agent = await this.getAgentById(agentId);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    const asset = await this.getAssetById(b.asset_id);
    if (!asset) throw new MetadataError("asset_not_found", `asset not found: ${b.asset_id}`);
    if (!canBindAsset(agent, asset)) {
      throw new MetadataError(
        "asset_not_bindable",
        `asset ${b.asset_id} (visibility=${asset.visibility}) cannot bind to agent ${agentId}`,
      );
    }
    await this.store.addAgentFixedAsset(agentId, b);
  }

  /**
   * 幂等确保 (team, agent) 对应的 chat_memory 资产存在并已绑定到 agent。
   *
   * 首次调用时会同步完成三件事（严格顺序）：
   *   1. createAsset({asset_type:'chat_memory', visibility:'private',
   *      owner_user_id: agent.owner_user_id})
   *   2. store.addAgentFixedAsset(agent, {asset_id, injection_mode:'summary'})
   *   3. 写入进程内 LRU 缓存，后续同 (team, agent) 请求直接短路
   *
   * 幂等保证：
   *   - asset_id = chat_memory-{team}-{agent} 是稳定确定的
   *   - meta_assets.asset_id 是主键 → 并发 create 撞冲突后回读
   *   - meta_agent_fixed_assets (agent_id, asset_id) 是 unique → 重复
   *     addAgentFixedAsset 由 store 层吸收为 no-op
   *
   * 失败策略：本方法**会抛错**（agent_not_found / team_mismatch / DB 故障）。
   * 调用方（v2-router 里 handleConversationAdd）负责 catch + 只打 warn，
   * 不阻塞主流程 conversation 写入。
   */
  async ensureChatMemoryAsset(params: {
    team_id: string;
    agent_id: string;
  }): Promise<AssetEntity> {
    const agentId = params.agent_id;
    const assetId = buildChatMemoryAssetId(params.team_id, agentId);

    // 1. 缓存短路：已确认存在直接返回轻量占位（如果调用方需要实体，才回 store）
    //    实践中调用方并不消费返回值（fire-and-forget），命中缓存时不再查 store。
    if (this.ensuredChatMemoryAssets.has(assetId)) {
      const cached = await this.getAssetById(assetId);
      if (cached) return cached;
      // 缓存脏了（被外部删除）—— 清掉重来
      this.ensuredChatMemoryAssets.delete(assetId);
    }

    // 2. 拿 agent，取 owner + team 用于 create + canBindAsset
    //    先拉 agent 是为了在任何路径下都能校验 team_mismatch，同时后续 bind
    //    要用到 owner_user_id 作 created_by。
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new MetadataError(
        "agent_not_found",
        `cannot ensure chat_memory asset: agent ${agentId} not found`,
      );
    }
    // 个人 agent（agent_id === owner_user_id，即 agent 代表用户本人）允许跨 team
    // 建 chat_memory 资产 —— 一个人一个全局 agent，记忆按 team 维度区分；
    // 普通 team 级 agent（随机 agt-xxx）仍强校验 team 归属。
    const isPersonalAgent = agent.agent_id === agent.owner_user_id;
    if (!isPersonalAgent && agent.team_id !== params.team_id) {
      throw new MetadataError(
        "team_mismatch",
        `cannot ensure chat_memory asset: agent ${agentId} belongs to team ` +
        `${agent.team_id}, not ${params.team_id}`,
      );
    }

    // 3. 拿或建 asset：先看是否已在 store（冷启动 / 其他 pod 已建），否则新建。
    //    createAsset 遇主键冲突 = 并发 race，回读兜底。
    let asset = await this.getAssetById(assetId);
    if (!asset) {
      try {
        asset = await this.createAsset({
          asset_id: assetId,
          team_id: params.team_id,
          asset_type: "chat_memory",
          name: `Memory of ${agent.name}`,
          owner_user_id: agent.owner_user_id,
          source_type: "auto",
          visibility: "private",
          status: "active",
        });
      } catch (err) {
        const raced = await this.getAssetById(assetId);
        if (raced) {
          asset = raced;
        } else {
          throw err;
        }
      }
    }

    // 4. 无论 asset 是新建还是已存在，都要**幂等**补一次绑定。
    //    上一次可能只完成 create、bind 阶段失败；bind 有 UNIQUE 约束，重复
    //    调用无副作用。这里直接调 store 跳过 addAgentFixedAsset 的重复校验
    //    —— 我们上面已经查过 agent / asset。
    await this.store.addAgentFixedAsset(agentId, {
      asset_id: assetId,
      asset_type: "chat_memory",
      injection_mode: "summary",
      priority: 50,
      created_by: agent.owner_user_id,
    });

    this.rememberEnsuredChatMemoryAsset(assetId);
    return asset;
  }

  /** LRU-ish 记录：达到上限时淘汰最早写入的条目。 */
  private rememberEnsuredChatMemoryAsset(assetId: string): void {
    if (this.ensuredChatMemoryAssets.has(assetId)) return;
    if (this.ensuredChatMemoryAssets.size >= MetadataService.CHAT_MEMORY_ENSURE_CACHE_SIZE) {
      const oldest = this.ensuredChatMemoryAssets.keys().next().value;
      if (oldest !== undefined) this.ensuredChatMemoryAssets.delete(oldest);
    }
    this.ensuredChatMemoryAssets.set(assetId, true);
  }

  //  ============================================================
  //  Skill Asset — 同款 ensure 模式
  //  ============================================================

  /**
   * 登记 skill 资产并绑定到 agent。与 ensureChatMemoryAsset 同款 5 步结构：
   *
   *   1. LRU 短路（key = skill_id，即 asset_id）
   *   2. 查 agent 取 owner + 校验 team
   *   3. 幂等 createAsset（asset_id = skill_id）
   *   4. 幂等 addAgentFixedAsset（injection_mode = reference）
   *   5. 记入 LRU
   *
   * 幂等保证：
   *   - asset_id 即为外部 skill_id（core 层生成 skl-xxxx），稳定唯一
   *   - meta_assets.asset_id 主键 → 并发 create 冲突时回读
   *   - meta_agent_fixed_assets (agent_id, asset_id) UNIQUE → bind 幂等
   *
   * 失败策略：
   *   - v1 创建路径（onSkillCreated context）：抛出异常以中断 create，
   *     避免 "skill 落库但前端看不到" 的不可自愈状态
   *   - 读时自愈路径（onSkillAccessed context）：由调用方 try/catch，
   *     不影响 skill 返回
   */
  async ensureSkillAsset(params: {
    skill_id: string;
    team_id: string;
    agent_id: string;
    name: string;
  }): Promise<AssetEntity> {
    const assetId = params.skill_id; // skill_id === asset_id（约定）

    // 1. LRU 短路
    if (this.ensuredSkillAssets.has(assetId)) {
      const cached = await this.getAssetById(assetId);
      if (cached) return cached;
      this.ensuredSkillAssets.delete(assetId);
    }

    // 2. 拿 agent 取 owner + 校验 team
    const agent = await this.getAgentById(params.agent_id);
    if (!agent) {
      throw new MetadataError(
        "agent_not_found",
        `cannot ensure skill asset: agent ${params.agent_id} not found`,
      );
    }
    if (agent.team_id !== params.team_id) {
      throw new MetadataError(
        "team_mismatch",
        `cannot ensure skill asset: agent ${params.agent_id} belongs to team ` +
        `${agent.team_id}, not ${params.team_id}`,
      );
    }

    // 3. 幂等 createAsset
    //
    // 默认 visibility = "private"（2026-07 变更）：
    //   - 新建的 skill 默认只有 owner 和 team admin 能看到（严格私密）。
    //   - 想让 team 内所有人可读 → 用户显式在管控页切成"共享"（asset/update visibility=team）。
    //   - 想让特定 user/agent 可读 → 用 acl/grant + visibility=restricted。
    //
    // 为什么不是 "team"：Skill 内容常包含内部知识、脚本、凭证注释等，
    // "默认对整个 team 可见"对隐私敏感场景（例如个人调试用的 skill）不够安全。
    // 私密 → 主动共享的心智更符合直觉。
    let asset = await this.getAssetById(assetId);
    if (!asset) {
      try {
        asset = await this.createAsset({
          asset_id: assetId,
          team_id: params.team_id,
          asset_type: "skill",
          name: params.name,
          owner_user_id: agent.owner_user_id,
          source_type: "extracted",
          visibility: "private",
          status: "active",
        });
      } catch (err) {
        const raced = await this.getAssetById(assetId);
        if (raced) {
          asset = raced;
        } else {
          throw err;
        }
      }
    }

    // 4. 幂等 addAgentFixedAsset
    await this.store.addAgentFixedAsset(params.agent_id, {
      asset_id: assetId,
      asset_type: "skill",
      injection_mode: "reference",
      priority: 50,
      created_by: agent.owner_user_id,
    });

    this.rememberEnsuredSkillAsset(assetId);
    return asset;
  }

  /** LRU-ish 记录：达到上限时淘汰最早写入的条目。 */
  private rememberEnsuredSkillAsset(assetId: string): void {
    if (this.ensuredSkillAssets.has(assetId)) return;
    if (this.ensuredSkillAssets.size >= MetadataService.SKILL_ENSURE_CACHE_SIZE) {
      const oldest = this.ensuredSkillAssets.keys().next().value;
      if (oldest !== undefined) this.ensuredSkillAssets.delete(oldest);
    }
    this.ensuredSkillAssets.set(assetId, true);
  }

  async listAgentFixedAssetsWithDetail(
    params: ListWithDetailParams,
  ): Promise<AgentFixedAssetDetailResult> {
    const agent = await this.getAgentById(params.agent_id);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${params.agent_id}`);

    const pagination = this.pag(params);
    const assetTypes = params.asset_types && params.asset_types.length > 0
      ? params.asset_types
      : undefined;
    const bindingPage = await this.store.listAgentFixedAssets(params.agent_id, pagination, { assetTypes });
    const items: AgentAssetView[] = [];

    for (const b of bindingPage.items) {
      const asset = await this.getAssetById(b.asset_id);
      if (!asset) continue;

      if (FILTERED_STATUSES.includes(asset.status)) continue;

      if (params.apply_visibility_filter && !canBindAsset(agent, asset)) continue;

      if (params.touch_usage) {
        await this.store.touchAssetUsage(asset.asset_id);
      }

      items.push({
        asset_id: asset.asset_id,
        asset_type: asset.asset_type,
        name: asset.name,
        description: asset.description ?? null,
        status: asset.status,
        visibility: asset.visibility,
        injection_mode: b.injection_mode,
        priority: b.priority,
        created_at: asset.created_at,
      });
    }

    return {
      agent: {
        agent_id: agent.agent_id,
        team_id: agent.team_id,
        owner_user_id: agent.owner_user_id,
        prompt: agent.prompt ?? null,
        visibility: agent.visibility,
        status: agent.status,
      },
      items,
      total: bindingPage.total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  // ============================================================
  // ACL
  // ============================================================
  async grantAcl(input: GrantAclInput): Promise<AclEntity> {
    const asset = await this.getAssetById(input.asset_id);
    if (!asset) throw new MetadataError("asset_not_found", `asset not found: ${input.asset_id}`);
    return this.store.grantAcl(input);
  }

  async revokeAcl(id: string): Promise<void> {
    await this.store.revokeAcl(id);
  }

  async listAclByAsset(assetId: string, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<AclEntity>> {
    const page = await this.store.listAclByAsset(assetId, pagination);
    return formatListResult(page, pagination);
  }

  // ============================================================
  // 权限判定（懒加载 ACL）
  // ============================================================
  async checkAssetPermission(params: CheckPermissionParams): Promise<PermCheckResult> {
    const userId = await resolveUserId(this, params);
    const asset = await this.getAssetById(params.asset_id);
    if (!asset || asset.status === "archived") {
      return { allowed: false, reason: "asset_not_available" };
    }

    // owner 短路，无需查成员/ACL
    if (asset.owner_user_id === userId) {
      return { allowed: true, reason: "owner" };
    }

    const membership = await this.store.getTeamMember(asset.team_id, userId);

    // 先用空 ACL 跑一遍：命中角色默认即放行，无需查表
    const action = params.action;
    const fast = checkPermission({
      user: { user_id: userId },
      asset,
      membership,
      action,
      aclRecords: [],
      agentId: params.agent_id,
      logger: this.logger,
    });
    if (fast.allowed) return fast;

    // 只有「通过了前置门但角色默认未覆盖」(no_permission) 才需懒加载 ACL 重判
    if (fast.reason !== "no_permission") return fast;
    if (membership && roleDefaultCovers(membership.role, action)) return fast;

    const aclRecords = await this.allAclRecords(params.asset_id);
    return checkPermission({
      user: { user_id: userId },
      asset,
      membership,
      action,
      aclRecords,
      agentId: params.agent_id,
      logger: this.logger,
    });
  }

  /** 按用户过滤其有权限访问的资产列表（权限聚合后 offset 分页）。 */
  async listAccessibleAssets(params: ListAccessibleAssetsParams): Promise<PaginatedResult<AssetEntity>> {
    const userId = await resolveUserId(this, params);
    const action = params.action ?? "read";
    const pagination = this.pag(params);

    // admin 用户维度切换：system_admin + owner_user_id → 直接查该 owner 的全部资产（含 private），
    // 绕过 team 循环 + checkPermission（admin 看任意用户资产的能力）。
    if (params.owner_user_id) {
      const caller = await this.getUserById(userId);
      if (caller && isSystemAdminUser(caller)) {
        const page = await this.store.listAssetsByOwner(
          params.owner_user_id,
          pagination,
          { asset_type: params.asset_type },
        );
        return formatListResult(page, pagination);
      }
    }

    // visibility 白名单（服务端过滤，避免前端拿到不该看到的数据）
    const visFilter: Set<AssetEntity["visibility"]> | null = params.visibility
      ? new Set(Array.isArray(params.visibility) ? params.visibility : [params.visibility])
      : null;

    let teamIds: string[];
    if (params.team_id) {
      const member = await this.store.getTeamMember(params.team_id, userId);
      if (!member || member.status !== "active") {
        return paginateArray([], pagination);
      }
      teamIds = [params.team_id];
    } else {
      const allTeams: TeamEntity[] = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const page = await this.store.listTeamsByUser(userId, { limit, offset });
        allTeams.push(...page.items);
        if (offset + page.items.length >= page.total) break;
        offset += limit;
      }
      teamIds = allTeams.map((t) => t.team_id);
    }

    const result: AssetEntity[] = [];
    const seen = new Set<string>();

    for (const teamId of teamIds) {
      let offset = 0;
      const limit = 100;
      while (true) {
        const page = await this.store.listAssetsByTeam(
          teamId,
          { limit, offset },
          { asset_type: params.asset_type },
        );
        for (const asset of page.items) {
          if (seen.has(asset.asset_id)) continue;
          // 团队维度：挂到 project 的资产由下面的 project 循环单独按 project.members 判定，这里跳过
          if (asset.project_id) continue;
          if (FILTERED_STATUSES.includes(asset.status)) continue;
          // visibility 白名单过滤（在权限判定前先剔除，节省 checkAssetPermission 开销）
          if (visFilter && !visFilter.has(asset.visibility)) continue;
          const perm = await this.checkAssetPermission({
            user_id: userId,
            asset_id: asset.asset_id,
            action,
            agent_id: params.agent_id,
          });
          if (perm.allowed) {
            seen.add(asset.asset_id);
            result.push(asset);
          }
        }
        if (offset + page.items.length >= page.total) break;
        offset += limit;
      }
    }

    // 协作轴：并入「U 是 member 的 project」资产（跨 team）。
    if (params.project_ids && params.project_ids.length > 0) {
      for (const projectId of params.project_ids) {
        if (!(await this.isProjectMember(projectId, userId))) continue; // 白名单：非 member 跳过
        let offset = 0;
        const limit = 100;
        while (true) {
          const page = await this.store.listAssetsByProject(
            projectId,
            { limit, offset },
            { asset_type: params.asset_type },
          );
          for (const asset of page.items) {
            if (seen.has(asset.asset_id)) continue;
            if (FILTERED_STATUSES.includes(asset.status)) continue;
            if (visFilter && !visFilter.has(asset.visibility)) continue;
            // project-scoped 读：owner 全可见；private 仅 owner；其余由 project.members 可见
            if (asset.owner_user_id === userId) {
              seen.add(asset.asset_id);
              result.push(asset);
              continue;
            }
            if (asset.visibility === "private") continue;
            seen.add(asset.asset_id);
            result.push(asset);
          }
          if (offset + page.items.length >= page.total) break;
          offset += limit;
        }
      }
    }

    // 用户维度二次过滤（在「可访问」结果集内按 owner 切片）。
    const ownerFilter = params.owner_user_id ?? null;
    const filtered = ownerFilter ? result.filter((a) => a.owner_user_id === ownerFilter) : result;

    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return paginateArray(filtered, pagination);
  }

  /** 判断 user 是否为 project 成员（含 owner / manager / 普通 member）。 */
  private async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const project = await this.store.getProjectById(projectId);
    if (!project) return false;
    if (project.owner_user_id === userId) return true;
    const member = await this.store.getProjectMember(projectId, userId);
    return !!member;
  }


  /**
   * recordRunAuto — 内部自动落库（无鉴权）。
   * 供 pipeline（L1/L2/L3 提取）与内核记忆写入（consolidation）自动记录一次真实运行，
   * 使「运行回放」反映真实活动而非手动登记。owner_user_id 固定为 system。
   */
  async recordRunAuto(input: {
    team_id: string;
    agent_id?: string | null;
    task_id?: string | null;
    kind?: RunTraceEntity["kind"];
    title: string;
    status?: string | null;
    input_summary?: string | null;
    output_summary?: string | null;
    trace_json?: string;
  }): Promise<RunTraceEntity> {
    return this.store.createRunTrace({
      team_id: input.team_id,
      agent_id: input.agent_id ?? null,
      task_id: input.task_id ?? null,
      kind: input.kind ?? "run",
      title: input.title,
      status: input.status ?? null,
      input_summary: input.input_summary ?? null,
      output_summary: input.output_summary ?? null,
      trace_json: input.trace_json ?? "[]",
      source: "memory",
      owner_user_id: "system",
      meta_json: "{}",
    });
  }


  // ============================================================
  // WriteApproval（记忆写入审批，内部免鉴权）
  // ============================================================
  async createWriteApproval(input: CreateWriteApprovalInput): Promise<WriteApprovalEntity> {
    return this.store.createWriteApproval(input);
  }

  async getWriteApproval(approvalId: string): Promise<WriteApprovalEntity | null> {
    return this.store.getWriteApproval(approvalId);
  }

  async updateWriteApproval(approvalId: string, patch: Partial<WriteApprovalEntity>): Promise<WriteApprovalEntity | null> {
    return this.store.updateWriteApproval(approvalId, patch);
  }

  async listWriteApprovals(filter: WriteApprovalFilter, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<WriteApprovalEntity>> {
    const page = await this.store.listWriteApprovals(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // KnowledgeEntry（项目级五类 + 团队级工作模式）
  // ============================================================
  async createKnowledgeEntryForCaller(input: CreateKnowledgeEntryInput, ctx: V3AuthContext): Promise<KnowledgeEntryEntity> {
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    if (input.scope === "team") {
      await this.assertTeamExists(input.scope_id);
      await this.requireActiveTeamMember(ctx, input.scope_id);
    } else {
      await this.requireProjectVisible(ctx, input.scope_id);
    }
    return this.store.createKnowledgeEntry(input);
  }

  async getKnowledgeEntryForCaller(entryId: string, ctx: V3AuthContext): Promise<KnowledgeEntryEntity> {
    const entry = await this.store.getKnowledgeEntry(entryId);
    if (!entry) throw new MetadataError("knowledge_not_found", `knowledge entry not found: ${entryId}`);
    await this.requireKnowledgeScopeVisible({ scope: entry.scope, scope_id: entry.scope_id }, ctx);
    return entry;
  }

  async updateKnowledgeEntryForCaller(
    entryId: string,
    patch: Partial<KnowledgeEntryEntity>,
    ctx: V3AuthContext,
  ): Promise<KnowledgeEntryEntity> {
    const entry = await this.store.getKnowledgeEntry(entryId);
    if (!entry) throw new MetadataError("knowledge_not_found", `knowledge entry not found: ${entryId}`);
    this.assertCallerIsResourceOwner(ctx, entry.owner_user_id);
    const updated = await this.store.updateKnowledgeEntry(entryId, patch);
    if (!updated) throw new MetadataError("knowledge_not_found", `knowledge entry not found: ${entryId}`);
    return updated;
  }

  async deleteKnowledgeEntriesForCaller(entryIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    for (const entryId of entryIds) {
      const entry = await this.store.getKnowledgeEntry(entryId);
      if (!entry) continue;
      this.assertCallerIsResourceOwner(ctx, entry.owner_user_id);
    }
    return this.store.deleteKnowledgeEntries(entryIds);
  }

  async listKnowledgeEntriesForCaller(
    filter: KnowledgeEntryFilter,
    ctx: V3AuthContext,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<KnowledgeEntryEntity>> {
    await this.requireKnowledgeScopeVisible(filter, ctx);
    const page = await this.store.listKnowledgeEntries(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  private async requireKnowledgeScopeVisible(filter: KnowledgeEntryFilter, ctx: V3AuthContext): Promise<void> {
    if (ctx.isSystemAdmin) return;
    if (filter.scope === "team" && filter.scope_id) {
      await this.requireActiveTeamMember(ctx, filter.scope_id);
      return;
    }
    if (filter.scope === "project" && filter.scope_id) {
      await this.requireProjectVisible(ctx, filter.scope_id);
      return;
    }
    // 无明确作用域过滤时要求登录即可（list 仅返回各作用域内可见数据由 store 过滤，此处兜底）。
    this.requireCallerId(ctx);
  }

  // ============================================================
  // ToolSource（MCP Server / REST API）
  // ============================================================
  async createToolSourceForCaller(input: CreateToolSourceInput, ctx: V3AuthContext): Promise<ToolSourceEntity> {
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    return this.store.createToolSource(input);
  }

  async getToolSourceForCaller(toolId: string, ctx: V3AuthContext): Promise<ToolSourceEntity> {
    const tool = await this.store.getToolSource(toolId);
    if (!tool) throw new MetadataError("tool_not_found", `tool source not found: ${toolId}`);
    await this.requireActiveTeamMember(ctx, tool.team_id);
    return tool;
  }

  async updateToolSourceForCaller(toolId: string, patch: Partial<ToolSourceEntity>, ctx: V3AuthContext): Promise<ToolSourceEntity> {
    const tool = await this.store.getToolSource(toolId);
    if (!tool) throw new MetadataError("tool_not_found", `tool source not found: ${toolId}`);
    this.assertCallerIsResourceOwner(ctx, tool.owner_user_id);
    const updated = await this.store.updateToolSource(toolId, patch);
    if (!updated) throw new MetadataError("tool_not_found", `tool source not found: ${toolId}`);
    return updated;
  }

  async deleteToolSourcesForCaller(toolIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    for (const toolId of toolIds) {
      const tool = await this.store.getToolSource(toolId);
      if (!tool) continue;
      this.assertCallerIsResourceOwner(ctx, tool.owner_user_id);
    }
    return this.store.deleteToolSources(toolIds);
  }

  async listToolSourcesForCaller(filter: ToolSourceFilter, ctx: V3AuthContext, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<ToolSourceEntity>> {
    if (filter.team_id) {
      await this.requireActiveTeamMember(ctx, filter.team_id);
    } else {
      this.requireCallerId(ctx);
    }
    const page = await this.store.listToolSources(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // AgentTeam（多 Agent 编排）
  // ============================================================
  async createAgentTeamForCaller(input: CreateAgentTeamInput, ctx: V3AuthContext): Promise<AgentTeamEntity> {
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    for (const link of input.linked_agents ?? []) {
      const agent = await this.store.getAgentById(link.agent_id);
      if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${link.agent_id}`);
      if (agent.team_id !== input.team_id) {
        throw new MetadataError("agent_team_mismatch", `agent ${link.agent_id} does not belong to team ${input.team_id}`);
      }
    }
    return this.store.createAgentTeam(input);
  }

  async getAgentTeamForCaller(agentTeamId: string, ctx: V3AuthContext): Promise<AgentTeamEntity> {
    const t = await this.store.getAgentTeam(agentTeamId);
    if (!t) throw new MetadataError("agent_team_not_found", `agent team not found: ${agentTeamId}`);
    await this.requireActiveTeamMember(ctx, t.team_id);
    return t;
  }

  async updateAgentTeamForCaller(agentTeamId: string, patch: Partial<AgentTeamEntity>, ctx: V3AuthContext): Promise<AgentTeamEntity> {
    const t = await this.store.getAgentTeam(agentTeamId);
    if (!t) throw new MetadataError("agent_team_not_found", `agent team not found: ${agentTeamId}`);
    this.assertCallerIsResourceOwner(ctx, t.owner_user_id);
    const updated = await this.store.updateAgentTeam(agentTeamId, patch);
    if (!updated) throw new MetadataError("agent_team_not_found", `agent team not found: ${agentTeamId}`);
    return updated;
  }

  async deleteAgentTeamsForCaller(agentTeamIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    for (const agentTeamId of agentTeamIds) {
      const t = await this.store.getAgentTeam(agentTeamId);
      if (!t) continue;
      this.assertCallerIsResourceOwner(ctx, t.owner_user_id);
    }
    return this.store.deleteAgentTeams(agentTeamIds);
  }

  async listAgentTeamsForCaller(filter: AgentTeamFilter, ctx: V3AuthContext, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<AgentTeamEntity>> {
    if (filter.team_id) {
      await this.requireActiveTeamMember(ctx, filter.team_id);
    } else {
      this.requireCallerId(ctx);
    }
    const page = await this.store.listAgentTeams(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  async addAgentTeamMemberForCaller(input: AgentTeamMemberInput, ctx: V3AuthContext): Promise<AgentTeamMemberEntity> {
    const t = await this.store.getAgentTeam(input.agent_team_id);
    if (!t) throw new MetadataError("agent_team_not_found", `agent team not found: ${input.agent_team_id}`);
    this.assertCallerIsResourceOwner(ctx, t.owner_user_id);
    await this.requireActiveTeamMember(ctx, t.team_id);
    const agent = await this.store.getAgentById(input.agent_id);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${input.agent_id}`);
    if (agent.team_id !== t.team_id) {
      throw new MetadataError("agent_team_mismatch", `agent ${input.agent_id} does not belong to team ${t.team_id}`);
    }
    return this.store.addAgentTeamMember(input);
  }

  async removeAgentTeamMemberForCaller(agentTeamId: string, agentId: string, ctx: V3AuthContext): Promise<void> {
    const t = await this.store.getAgentTeam(agentTeamId);
    if (!t) throw new MetadataError("agent_team_not_found", `agent team not found: ${agentTeamId}`);
    this.assertCallerIsResourceOwner(ctx, t.owner_user_id);
    await this.store.removeAgentTeamMember(agentTeamId, agentId);
  }

  async listAgentTeamMembersForCaller(agentTeamId: string, ctx: V3AuthContext, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<AgentTeamMemberEntity>> {
    const t = await this.store.getAgentTeam(agentTeamId);
    if (!t) throw new MetadataError("agent_team_not_found", `agent team not found: ${agentTeamId}`);
    await this.requireActiveTeamMember(ctx, t.team_id);
    const page = await this.store.listAgentTeamMembers(agentTeamId, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // Automation（自动化编排）
  // ============================================================
  async createAutomationForCaller(input: CreateAutomationInput, ctx: V3AuthContext): Promise<AutomationEntity> {
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    return this.store.createAutomation(input);
  }

  async getAutomationForCaller(automationId: string, ctx: V3AuthContext): Promise<AutomationEntity> {
    const a = await this.store.getAutomation(automationId);
    if (!a) throw new MetadataError("automation_not_found", `automation not found: ${automationId}`);
    await this.requireActiveTeamMember(ctx, a.team_id);
    return a;
  }

  async updateAutomationForCaller(automationId: string, patch: Partial<AutomationEntity>, ctx: V3AuthContext): Promise<AutomationEntity> {
    const a = await this.store.getAutomation(automationId);
    if (!a) throw new MetadataError("automation_not_found", `automation not found: ${automationId}`);
    this.assertCallerIsResourceOwner(ctx, a.owner_user_id);
    const updated = await this.store.updateAutomation(automationId, patch);
    if (!updated) throw new MetadataError("automation_not_found", `automation not found: ${automationId}`);
    return updated;
  }

  async deleteAutomationsForCaller(automationIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    for (const automationId of automationIds) {
      const a = await this.store.getAutomation(automationId);
      if (!a) continue;
      this.assertCallerIsResourceOwner(ctx, a.owner_user_id);
    }
    return this.store.deleteAutomations(automationIds);
  }

  async listAutomationsForCaller(filter: AutomationFilter, ctx: V3AuthContext, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<AutomationEntity>> {
    if (filter.team_id) {
      await this.requireActiveTeamMember(ctx, filter.team_id);
    } else {
      this.requireCallerId(ctx);
    }
    const page = await this.store.listAutomations(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // RunTrace（会话回放）
  // ============================================================
  async createRunTraceForCaller(input: CreateRunTraceInput, ctx: V3AuthContext): Promise<RunTraceEntity> {
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    return this.store.createRunTrace(input);
  }

  async getRunTraceForCaller(runId: string, ctx: V3AuthContext): Promise<RunTraceEntity> {
    const r = await this.store.getRunTrace(runId);
    if (!r) throw new MetadataError("run_not_found", `run trace not found: ${runId}`);
    await this.requireActiveTeamMember(ctx, r.team_id);
    return r;
  }

  async updateRunTraceForCaller(runId: string, patch: Partial<RunTraceEntity>, ctx: V3AuthContext): Promise<RunTraceEntity> {
    const r = await this.store.getRunTrace(runId);
    if (!r) throw new MetadataError("run_not_found", `run trace not found: ${runId}`);
    this.assertCallerIsResourceOwner(ctx, r.owner_user_id);
    const updated = await this.store.updateRunTrace(runId, patch);
    if (!updated) throw new MetadataError("run_not_found", `run trace not found: ${runId}`);
    return updated;
  }

  async deleteRunTracesForCaller(runIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    for (const runId of runIds) {
      const r = await this.store.getRunTrace(runId);
      if (!r) continue;
      this.assertCallerIsResourceOwner(ctx, r.owner_user_id);
    }
    return this.store.deleteRunTraces(runIds);
  }

  async listRunTracesForCaller(filter: RunTraceFilter, ctx: V3AuthContext, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<RunTraceEntity>> {
    if (filter.team_id) {
      await this.requireActiveTeamMember(ctx, filter.team_id);
    } else {
      this.requireCallerId(ctx);
    }
    const page = await this.store.listRunTraces(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // Helpers
  // ============================================================
  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.store.getTeamById(teamId);
    if (!team) throw new MetadataError("team_not_found", `team not found: ${teamId}`);
  }

  private requireCallerId(ctx: V3AuthContext): string {
    if (!ctx.userId) {
      throw new MetadataError("permission_denied", "authentication required");
    }
    return ctx.userId;
  }

  private assertCallerIsResourceOwner(ctx: V3AuthContext, ownerUserId: string): void {
    if (ctx.isSystemAdmin) return; // system admin can operate on any resource
    const callerId = this.requireCallerId(ctx);
    if (callerId !== ownerUserId) {
      throw new MetadataError("permission_denied", "caller is not resource owner");
    }
  }


  /**
   * R2 增（资产）：非 system_admin 建资产默认 `private`；显式 `visibility=team`（建公共）需 system_admin。
   * 返回派生后的 visibility（system_admin 未传时维持 store 默认 team）。
   */
  private resolveCreateVisibility(
    ctx: V3AuthContext,
    visibility: AssetVisibility | undefined,
  ): AssetVisibility {
    if (ctx.isSystemAdmin) return visibility ?? "team";
    if (visibility === "team") {
      throw new MetadataError(
        "permission_denied",
        "creating team-public assets requires system admin",
      );
    }
    return visibility ?? "private";
  }

  /** R2 增（project）：非 system_admin 显式建 team 公共 project 需 system_admin（默认已是 private）。 */
  private assertCanCreateProjectVisibility(ctx: V3AuthContext, visibility: ProjectVisibility | undefined): void {
    if (!ctx.isSystemAdmin && visibility === "team") {
      throw new MetadataError("permission_denied", "creating team-public project requires system admin");
    }
  }

  private async requireActiveTeamMember(ctx: V3AuthContext, teamId: string): Promise<TeamMemberEntity> {
    const callerId = this.requireCallerId(ctx);
    const member = await this.store.getTeamMember(teamId, callerId);
    if (!member || member.status !== "active") {
      throw new MetadataError("permission_denied", "not a team member");
    }
    return member;
  }

  private async assertCallerIsTeamAdmin(ctx: V3AuthContext, teamId: string): Promise<void> {
    if (ctx.isSystemAdmin) return; // system admin 视同任意 team admin（跨 team 成员管理）
    const member = await this.requireActiveTeamMember(ctx, teamId);
    if (member.role !== "admin") {
      throw new MetadataError("permission_denied", "caller is not team admin");
    }
  }

  private async assertCallerIsTeamOwnerOrAdmin(ctx: V3AuthContext, teamId: string): Promise<TeamEntity> {
    const callerId = this.requireCallerId(ctx);
    const team = await this.getTeamById(teamId);
    if (!team) throw new MetadataError("team_not_found", `team not found: ${teamId}`);
    if (ctx.isSystemAdmin) return team;
    if (team.owner_user_id === callerId) return team;
    await this.assertCallerIsTeamAdmin(ctx, teamId);
    return team;
  }

  private async assertCallerIsAgentOwner(ctx: V3AuthContext, agentId: string): Promise<AgentEntity> {
    const agent = await this.getAgentById(agentId);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    this.assertCallerIsResourceOwner(ctx, agent.owner_user_id);
    return agent;
  }

  /**
   * agent 固定资产写操作的权限：owner 本人，或该 agent 所属团队的 team admin。
   * 用于冷启动「admin 代新用户挂载默认 Agent 资产」等场景（参照 asset 的
   * assertCallerIsAssetOwnerOrTeamAdmin 先例，放通 team admin）。
   */
  private async assertCallerIsAgentOwnerOrTeamAdmin(ctx: V3AuthContext, agentId: string): Promise<AgentEntity> {
    const agent = await this.getAgentById(agentId);
    if (!agent) throw new MetadataError("agent_not_found", `agent not found: ${agentId}`);
    const callerId = this.requireCallerId(ctx);
    if (agent.owner_user_id === callerId) return agent;
    await this.assertCallerIsTeamAdmin(ctx, agent.team_id);
    return agent;
  }

  private async assertCallerIsTaskCreator(ctx: V3AuthContext, taskId: string): Promise<TaskEntity> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new MetadataError("task_not_found", `task not found: ${taskId}`);
    this.assertCallerIsResourceOwner(ctx, task.creator_user_id);
    return task;
  }

  private async assertCallerIsAssetOwner(ctx: V3AuthContext, assetId: string): Promise<AssetEntity> {
    const asset = await this.getAssetById(assetId);
    if (!asset) throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
    this.assertCallerIsResourceOwner(ctx, asset.owner_user_id);
    return asset;
  }

  private async assertCallerIsAssetOwnerOrTeamAdmin(ctx: V3AuthContext, assetId: string): Promise<AssetEntity> {
    const asset = await this.getAssetById(assetId);
    if (!asset) throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
    const callerId = this.requireCallerId(ctx);
    if (asset.owner_user_id === callerId) return asset;
    await this.assertCallerIsTeamAdmin(ctx, asset.team_id);
    return asset;
  }


  /** 判断 caller 是否为 project 的 owner/manager（R4 删：project.manager 可删 project 资产）。 */
  private async isCallerProjectManager(ctx: V3AuthContext, projectId: string | null | undefined): Promise<boolean> {
    if (!projectId) return false;
    const callerId = this.requireCallerId(ctx);
    const project = await this.store.getProjectById(projectId);
    if (!project) return false;
    return project.owner_user_id === callerId || project.manager_user_id === callerId;
  }

  /** 赋权可：caller 是否持有该 asset 的显式 user ACL（write/delete 等）。 */
  private async hasUserAclGrant(assetId: string, userId: string, action: Permission): Promise<boolean> {
    const records = await this.allAclRecords(assetId);
    return records.some(
      (a) => a.permission === action && a.effect === "allow" && a.subject_type === "user" && a.subject_id === userId,
    );
  }

  /** R3 改：owner 或 system_admin 或（赋权可）user ACL write。 */
  private async assertCallerCanUpdateAsset(ctx: V3AuthContext, asset: AssetEntity): Promise<void> {
    if (ctx.isSystemAdmin) return;
    const callerId = this.requireCallerId(ctx);
    if (asset.owner_user_id === callerId) return;
    if (await this.hasUserAclGrant(asset.asset_id, callerId, "write")) return;
    throw new MetadataError("permission_denied", "caller is not asset owner nor granted write access");
  }

  /** R4 删除：owner 或 system_admin 或 project.manager 或（赋权可）user ACL delete。 */
  private async assertCallerCanDeleteAsset(ctx: V3AuthContext, asset: AssetEntity): Promise<void> {
    if (ctx.isSystemAdmin) return;
    const callerId = this.requireCallerId(ctx);
    if (asset.owner_user_id === callerId) return;
    if (await this.isCallerProjectManager(ctx, asset.project_id)) return;
    if (await this.hasUserAclGrant(asset.asset_id, callerId, "delete")) return;
    throw new MetadataError("permission_denied", "caller is not asset owner, project manager, nor granted delete");
  }

  /** R4 删除（agent 同规则）。 */
  private async assertCallerCanDeleteAgent(ctx: V3AuthContext, agent: AgentEntity): Promise<void> {
    if (ctx.isSystemAdmin) return;
    const callerId = this.requireCallerId(ctx);
    if (agent.owner_user_id === callerId) return;
    if (await this.isCallerProjectManager(ctx, agent.project_id)) return;
    throw new MetadataError("permission_denied", "caller is not agent owner or project manager");
  }


  /** 列出某 project 下的资产（协作轴聚合视图）。caller 须 project 可见。 */
  async listAssetsByProjectForCaller(
    projectId: string,
    ctx: V3AuthContext,
    pagination: PaginationParams,
    filter?: AssetFilter,
  ): Promise<PaginatedResult<AssetEntity>> {
    await this.requireProjectVisible(ctx, projectId);
    const page = await this.store.listAssetsByProject(projectId, pagination, filter);
    return formatListResult(page, pagination);
  }


  // ============================================================
  // Project（协作轴，跨 team）
  // ============================================================
  async getProjectById(projectId: string): Promise<ProjectEntity | null> {
    return this.store.getProjectById(projectId);
  }

  private async assertCallerIsProjectOwnerOrManager(ctx: V3AuthContext, projectId: string): Promise<ProjectEntity> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new MetadataError("project_not_found", `project not found: ${projectId}`);
    const callerId = this.requireCallerId(ctx);
    if (project.owner_user_id === callerId || project.manager_user_id === callerId) return project;
    if (ctx.isSystemAdmin) return project;
    throw new MetadataError("permission_denied", "caller is not project owner/manager");
  }

  private async requireProjectVisible(ctx: V3AuthContext, projectId: string): Promise<ProjectEntity> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new MetadataError("project_not_found", `project not found: ${projectId}`);
    const callerId = this.requireCallerId(ctx);
    if (ctx.isSystemAdmin) return project;
    if (project.owner_user_id === callerId) return project;
    const member = await this.store.getProjectMember(projectId, callerId);
    if (member) return project;
    if (project.visibility === "team") {
      const tm = await this.store.getTeamMember(project.team_id, callerId);
      if (tm && tm.status === "active") return project;
    }
    throw new MetadataError("permission_denied", "caller cannot view project");
  }

  async createProjectForCaller(input: CreateProjectInput, ctx: V3AuthContext): Promise<ProjectEntity> {
    await this.assertTeamExists(input.team_id);
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    await this.assertPermission(ctx, "project.create");
    this.assertCanCreateProjectVisibility(ctx, input.visibility);
    return this.store.createProject(input);
  }

  async getProjectForCaller(projectId: string, ctx: V3AuthContext): Promise<ProjectEntity> {
    return this.requireProjectVisible(ctx, projectId);
  }

  async listProjectsForCaller(
    filter: ProjectFilter | undefined,
    ctx: V3AuthContext,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<ProjectEntity>> {
    const callerId = this.requireCallerId(ctx);
    if (ctx.isSystemAdmin) {
      const page = await this.store.listProjects(filter, pagination);
      return formatListResult(page, pagination);
    }
    // 普通用户：我 member 的 project（含 owner，因为 create 会把 owner 加为 manager 成员）
    // ∪ 我所属 team 的 team 公共 project。
    const seen = new Map<string, ProjectEntity>();
    const memberPage = await this.store.listProjects({ member_user_id: callerId }, null);
    for (const p of memberPage.items) seen.set(p.project_id, p);
    const teamsPage = await this.store.listTeamsByUser(callerId, null);
    const teamIds = teamsPage.items.map((t) => t.team_id);
    if (teamIds.length > 0) {
      const publicPage = await this.store.listProjects({ visibility: "team" }, null);
      for (const p of publicPage.items) {
        if (teamIds.includes(p.team_id)) seen.set(p.project_id, p);
      }
    }
    let items = Array.from(seen.values());
    if (filter?.team_id) items = items.filter((p) => p.team_id === filter.team_id);
    if (filter?.owner_user_id) items = items.filter((p) => p.owner_user_id === filter.owner_user_id);
    if (filter?.visibility) items = items.filter((p) => p.visibility === filter.visibility);
    if (filter?.name) items = items.filter((p) => p.name === filter.name);
    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return paginateArray(items, pagination);
  }

  async updateProjectForCaller(
    projectId: string,
    patch: Partial<ProjectEntity>,
    ctx: V3AuthContext,
  ): Promise<ProjectEntity> {
    await this.assertCallerIsProjectOwnerOrManager(ctx, projectId);
    await this.assertPermission(ctx, "project.update");
    const updated = await this.store.updateProject(projectId, patch);
    if (!updated) throw new MetadataError("project_not_found", `project not found: ${projectId}`);
    return updated;
  }

  async deleteProjectsForCaller(projectIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    await this.assertPermission(ctx, "project.delete");
    for (const projectId of projectIds) {
      await this.assertCallerIsProjectOwnerOrManager(ctx, projectId);
    }
    return this.store.deleteProjects(projectIds);
  }

  async addProjectMemberForCaller(input: AddProjectMemberInput, ctx: V3AuthContext): Promise<ProjectMemberEntity> {
    await this.assertCallerIsProjectOwnerOrManager(ctx, input.project_id);
    await this.assertPermission(ctx, "project_member.manage");
    return this.store.addProjectMember({ ...input, granted_by: this.requireCallerId(ctx) });
  }

  async removeProjectMemberForCaller(projectId: string, userId: string, ctx: V3AuthContext): Promise<void> {
    await this.assertPermission(ctx, "project_member.manage");
    const project = await this.assertCallerIsProjectOwnerOrManager(ctx, projectId);
    if (userId === project.owner_user_id) {
      throw new MetadataError("permission_denied", "cannot remove project owner");
    }
    return this.store.removeProjectMember(projectId, userId);
  }

  async setProjectManagerForCaller(projectId: string, userId: string, ctx: V3AuthContext): Promise<ProjectEntity> {
    const project = await this.assertCallerIsProjectOwnerOrManager(ctx, projectId);
    await this.assertPermission(ctx, "project_member.manage");
    const callerId = this.requireCallerId(ctx);
    if (project.owner_user_id !== callerId && !ctx.isSystemAdmin) {
      throw new MetadataError("permission_denied", "only project owner can set manager");
    }
    await this.store.addProjectMember({ project_id: projectId, user_id: userId, role: "manager", granted_by: callerId });
    const updated = await this.store.updateProject(projectId, { manager_user_id: userId });
    if (!updated) throw new MetadataError("project_not_found", `project not found: ${projectId}`);
    return updated;
  }

  async listProjectMembersForCaller(
    projectId: string,
    ctx: V3AuthContext,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<ProjectMemberView>> {
    await this.requireProjectVisible(ctx, projectId);
    const page = await this.store.listProjectMembersWithProfile(projectId, pagination);
    return formatListResult(page, pagination);
  }

  async getProjectMemberForCaller(
    projectId: string,
    userId: string,
    ctx: V3AuthContext,
  ): Promise<ProjectMemberView> {
    await this.requireProjectVisible(ctx, projectId);
    const member = await this.store.getProjectMemberWithProfile(projectId, userId);
    if (!member) throw new MetadataError("member_not_found", `member not found: ${projectId}/${userId}`);
    return member;
  }

  // ============================================================
  // Caller-scoped mutations（L-12 / L-14）
  // ============================================================
  async createTeamForCaller(input: CreateTeamInput, ctx: V3AuthContext): Promise<TeamEntity> {
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    await this.assertPermission(ctx, "team.create");
    return this.createTeam(input);
  }

  async updateTeamForCaller(
    teamId: string,
    patch: Partial<TeamEntity>,
    ctx: V3AuthContext,
  ): Promise<TeamEntity> {
    await this.assertCallerIsTeamOwnerOrAdmin(ctx, teamId);
    await this.assertPermission(ctx, "team.update");
    return this.updateTeam(teamId, patch);
  }

  async deleteTeamsForCaller(teamIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    await this.assertPermission(ctx, "team.delete");
    for (const teamId of teamIds) {
      await this.assertCallerIsTeamOwnerOrAdmin(ctx, teamId);
    }
    return this.deleteTeams(teamIds);
  }

  async addTeamMemberForCaller(input: AddTeamMemberInput, ctx: V3AuthContext): Promise<TeamMemberEntity> {
    await this.assertCallerIsTeamAdmin(ctx, input.team_id);
    await this.assertPermission(ctx, "team_member.add");
    const callerId = this.requireCallerId(ctx);
    // 「添加成员」不应用来改自己的角色；选自己 + role=member 会把 admin 降级。
    if (input.user_id === callerId) {
      throw new MetadataError("permission_denied", "cannot add yourself as a team member");
    }
    return this.addTeamMember(input);
  }

  async removeTeamMemberForCaller(teamId: string, userId: string, ctx: V3AuthContext): Promise<void> {
    await this.assertCallerIsTeamAdmin(ctx, teamId);
    await this.assertPermission(ctx, "team_member.remove");
    const team = await this.getTeamById(teamId);
    if (!team) throw new MetadataError("team_not_found", `team not found: ${teamId}`);
    if (userId === team.owner_user_id) {
      throw new MetadataError("permission_denied", "cannot remove team owner");
    }
    return this.removeTeamMember(teamId, userId);
  }

  async listTeamMembersForCaller(
    teamId: string,
    ctx: V3AuthContext,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<TeamMemberView>> {
    if (!ctx.isSystemAdmin) await this.requireActiveTeamMember(ctx, teamId);
    const page = await this.store.listTeamMembersWithProfile(teamId, pagination);
    return formatListResult(page, pagination);
  }

  async getTeamMemberForCaller(
    teamId: string,
    userId: string,
    ctx: V3AuthContext,
  ): Promise<TeamMemberView> {
    await this.requireActiveTeamMember(ctx, teamId);
    const member = await this.store.getTeamMemberWithProfile(teamId, userId);
    if (!member) {
      throw new MetadataError("member_not_found", `member not found: ${teamId}/${userId}`);
    }
    return member;
  }

  async createAgentForCaller(input: CreateAgentInput, ctx: V3AuthContext): Promise<AgentEntity> {
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    // owner 本人，或该 team 的 team admin（admin 代新用户创建默认 Agent）
    const callerId = this.requireCallerId(ctx);
    if (input.owner_user_id !== callerId) {
      await this.assertCallerIsTeamAdmin(ctx, input.team_id);
    }
    return this.createAgent(input);
  }

  async updateAgentForCaller(
    agentId: string,
    patch: Partial<AgentEntity>,
    ctx: V3AuthContext,
  ): Promise<AgentEntity> {
    await this.assertCallerIsAgentOwner(ctx, agentId);
    await this.assertPermission(ctx, "agent.update");
    return this.updateAgent(agentId, patch);
  }

  async deleteAgentsForCaller(agentIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    await this.assertPermission(ctx, "agent.delete");
    for (const agentId of agentIds) {
      const agent = await this.getAgentById(agentId);
      if (!agent) continue; // 与 store 层幂等成功对齐
      await this.assertCallerCanDeleteAgent(ctx, agent);
    }
    return this.deleteAgents(agentIds);
  }

  async archiveAgentForCaller(agentId: string, ctx: V3AuthContext): Promise<AgentEntity> {
    await this.assertCallerIsAgentOwner(ctx, agentId);
    await this.assertPermission(ctx, "agent.delete");
    return this.archiveAgent(agentId);
  }

  async createTaskForCaller(input: CreateTaskInput, ctx: V3AuthContext): Promise<TaskEntity> {
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    this.assertCallerIsResourceOwner(ctx, input.creator_user_id);
    await this.assertPermission(ctx, "task.create");
    return this.createTask(input);
  }

  async updateTaskForCaller(
    taskId: string,
    patch: Partial<TaskEntity>,
    ctx: V3AuthContext,
  ): Promise<TaskEntity> {
    await this.assertCallerIsTaskCreator(ctx, taskId);
    await this.assertPermission(ctx, "task.update");
    return this.updateTask(taskId, patch);
  }

  async deleteTasksForCaller(taskIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    await this.assertPermission(ctx, "task.delete");
    for (const taskId of taskIds) {
      await this.assertCallerIsTaskCreator(ctx, taskId);
    }
    return this.deleteTasks(taskIds);
  }

  async archiveTaskForCaller(taskId: string, ctx: V3AuthContext): Promise<TaskEntity> {
    await this.assertCallerIsTaskCreator(ctx, taskId);
    await this.assertPermission(ctx, "task.delete");
    return this.archiveTask(taskId);
  }

  async linkTaskAgentForCaller(
    taskId: string,
    agentId: string,
    roleInTask: string | undefined,
    ctx: V3AuthContext,
  ): Promise<TaskAgentEntity> {
    await this.assertCallerIsTaskCreator(ctx, taskId);
    return this.linkTaskAgent(taskId, agentId, roleInTask);
  }

  async unlinkTaskAgentForCaller(taskId: string, agentId: string, ctx: V3AuthContext): Promise<void> {
    await this.assertCallerIsTaskCreator(ctx, taskId);
    return this.unlinkTaskAgent(taskId, agentId);
  }

  async appendParticipationLogForCaller(
    input: AppendParticipationLogInput,
    ctx: V3AuthContext,
  ): Promise<ParticipationLogEntity> {
    await this.requireActiveTeamMember(ctx, input.team_id);
    const callerId = this.requireCallerId(ctx);
    if (input.user_id !== callerId) {
      await this.assertCallerIsTeamAdmin(ctx, input.team_id);
    }
    return this.appendParticipationLog(input);
  }

  async listParticipationLogsForCaller(
    filter: ParticipationLogFilter,
    ctx: V3AuthContext,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<ParticipationLogEntity>> {
    await this.requireActiveTeamMember(ctx, filter.team_id);
    return this.listParticipationLogs(filter, pagination);
  }

  async createAssetForCaller(input: CreateAssetInput, ctx: V3AuthContext): Promise<AssetEntity> {
    await this.assertTeamExists(input.team_id);
    await this.requireActiveTeamMember(ctx, input.team_id);
    this.assertCallerIsResourceOwner(ctx, input.owner_user_id);
    const visibility = this.resolveCreateVisibility(ctx, input.visibility);
    return this.createAsset({ ...input, visibility });
  }

  async updateAssetForCaller(
    assetId: string,
    patch: Partial<AssetEntity>,
    ctx: V3AuthContext,
  ): Promise<AssetEntity> {
    const asset = await this.getAssetById(assetId);
    if (!asset) throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
    await this.assertCallerCanUpdateAsset(ctx, asset);
    return this.updateAsset(assetId, patch);
  }

  async deleteAssetsForCaller(assetIds: string[], ctx: V3AuthContext): Promise<BatchDeleteResult> {
    // 已不存在的 id 跳过校验（与 store 层幂等成功对齐）；仍存在的须为 owner 或 project.manager。
    for (const assetId of assetIds) {
      const existing = await this.getAssetById(assetId);
      if (!existing) continue;
      await this.assertCallerCanDeleteAsset(ctx, existing);
    }
    return this.deleteAssets(assetIds);
  }

  async touchAssetUsageForCaller(assetId: string, ctx: V3AuthContext): Promise<void> {
    await this.assertCallerIsAssetOwner(ctx, assetId);
    return this.touchAssetUsage(assetId);
  }

  /**
   * 为 `/v3/chat-memory/clear` 做整批前置解析：把 asset_id 映射到 (team, agent)。
   *
   * 语义（与需求「任一 memory_id 不合法时，整批拒绝」对齐）：
   *   - 每个 id 必须存在且 asset_type === "chat_memory"；
   *   - 必须能在该资产的 team 下定位到对应 agent；
   *   - 任一条不满足直接抛 MetadataError，整批不执行。
   *
   * **不做用户级 Owner 校验**：内核数据面的信任模型是 Bearer +
   * x-tdai-service-id 即管理员级凭据（与 L0–L3 删除接口一致）。
   * "仅资产 Owner 可操作"由面板后端在转发前完成。
   *
   * 只做校验与读取，**不修改任何资产字段** —— 清空只删内容不动资产。
   */
  async resolveChatMemoryTargets(
    assetIds: string[],
  ): Promise<Array<{ asset_id: string; team_id: string; agent_id: string }>> {
    const targets: Array<{ asset_id: string; team_id: string; agent_id: string }> = [];
    // 同一 team 的 agent 列表在批量场景里会被反复用到，按 team 缓存一次。
    const agentIdsByTeam = new Map<string, string[]>();

    for (const assetId of assetIds) {
      const asset = await this.getAssetById(assetId);
      if (!asset) {
        throw new MetadataError("asset_not_found", `asset not found: ${assetId}`);
      }
      if (asset.asset_type !== "chat_memory") {
        throw new MetadataError(
          "asset_type_mismatch",
          `asset ${assetId} is not a chat_memory asset (got ${asset.asset_type})`,
        );
      }

      let agentIds = agentIdsByTeam.get(asset.team_id);
      if (!agentIds) {
        agentIds = await this.listAllAgentIdsByTeam(asset.team_id);
        agentIdsByTeam.set(asset.team_id, agentIds);
      }

      const agentId = resolveChatMemoryAgentId(assetId, asset.team_id, agentIds);
      if (!agentId) {
        throw new MetadataError(
          "agent_not_found",
          `cannot resolve owning agent for chat_memory asset ${assetId} in team ${asset.team_id}`,
        );
      }
      targets.push({ asset_id: assetId, team_id: asset.team_id, agent_id: agentId });
    }
    return targets;
  }

  /**
   * 拉取一个 team 下全部 agent_id（分页遍历，单页上限 100）。
   * 加硬上限防御异常大team 把内存打满。
   */
  private async listAllAgentIdsByTeam(teamId: string): Promise<string[]> {
    const PAGE = 100;
    const MAX_AGENTS = 10_000;
    const ids: string[] = [];
    for (let offset = 0; offset < MAX_AGENTS; offset += PAGE) {
      const page = await this.store.listAgentsByTeam(teamId, { limit: PAGE, offset });
      for (const agent of page.items) ids.push(agent.agent_id);
      if (page.items.length < PAGE) break;
    }
    return ids;
  }

  async setAgentFixedAssetsForCaller(
    agentId: string,
    bindings: FixedAssetBindingInput[],
    ctx: V3AuthContext,
  ): Promise<void> {
    await this.assertCallerIsAgentOwnerOrTeamAdmin(ctx, agentId);
    return this.setAgentFixedAssets(agentId, bindings);
  }

  async grantAclForCaller(input: GrantAclInput, ctx: V3AuthContext): Promise<AclEntity> {
    await this.assertCallerIsAssetOwner(ctx, input.asset_id);
    const callerId = this.requireCallerId(ctx);
    if (input.granted_by !== callerId) {
      throw new MetadataError("permission_denied", "granted_by must match caller");
    }
    return this.grantAcl(input);
  }

  async revokeAclForCaller(id: string, ctx: V3AuthContext): Promise<void> {
    const acl = await this.store.getAclById(id);
    if (!acl) throw new MetadataError("acl_not_found", `acl not found: ${id}`);
    await this.assertCallerIsAssetOwner(ctx, acl.asset_id);
    return this.revokeAcl(id);
  }

  async listAclByAssetForCaller(
    assetId: string,
    ctx: V3AuthContext,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AclEntity>> {
    await this.assertCallerIsAssetOwnerOrTeamAdmin(ctx, assetId);
    return this.listAclByAsset(assetId, pagination);
  }

  // ── InstanceUpstreamConfig ──────────────────────────────────────────────

  /**
   * 查询单条实例上游配置。
   * type=conversation 且不存在时自动插入一条 mode=official 的默认行。
   */
  async getInstanceUpstreamConfig(
    agentSource: string,
    type: UpstreamConfigType,
  ): Promise<Record<string, unknown>> {
    let entity = await this.store.getInstanceUpstreamConfig(agentSource, type);
    if (!entity && type === "conversation") {
      entity = await this.store.upsertInstanceUpstreamConfig({
        agent_source: agentSource,
        type: "conversation",
        mode: "official",
      });
    }
    if (!entity) {
      return {
        agent_source: agentSource,
        type,
        mode: "official",
        base_url: "",
        api_key_masked: "",
        model_id: "",
        description: "",
        updated_at: null,
      };
    }
    return this.toPublicInstanceUpstreamConfig(entity);
  }

  /**
   * 写入/覆盖实例上游配置。
   * 校验：
   *   - mode != official → base_url 必填
   *   - mode == custom_unified → api_key 必填
   *   - type == extraction → mode 不允许 custom_passthrough
   */
  async setInstanceUpstreamConfig(
    input: UpsertInstanceUpstreamConfigInput,
  ): Promise<Record<string, unknown>> {
    const mode = input.mode;
    const type = input.type ?? "conversation";
    if (type === "extraction" && mode === "custom_passthrough") {
      throw new MetadataError(
        "invalid_input",
        "extraction type does not support custom_passthrough mode",
      );
    }
    if (mode !== "official" && !input.base_url?.trim()) {
      throw new MetadataError(
        "invalid_input",
        "base_url is required when mode is custom_unified or custom_passthrough",
      );
    }
    if (mode === "custom_unified" && !input.api_key?.trim()) {
      throw new MetadataError(
        "invalid_input",
        "api_key is required when mode is custom_unified",
      );
    }
    const entity = await this.store.upsertInstanceUpstreamConfig(input);
    return this.toPublicInstanceUpstreamConfig(entity);
  }

  /** 全量列出实例上游配置（脱敏）。 */
  async listInstanceUpstreamConfigs(
    filter?: InstanceUpstreamConfigFilter,
  ): Promise<{ items: Record<string, unknown>[] }> {
    const entities = await this.store.listInstanceUpstreamConfigs(filter);
    return { items: entities.map((e) => this.toPublicInstanceUpstreamConfig(e)) };
  }

  /** 全量列出实例上游配置（内部，不脱敏）。 */
  async listInstanceUpstreamConfigsInternal(
    filter?: InstanceUpstreamConfigFilter,
  ): Promise<{ items: InstanceUpstreamConfigEntity[] }> {
    const entities = await this.store.listInstanceUpstreamConfigs(filter);
    return { items: entities };
  }

  /**
   * 重置实例上游配置。
   * conversation: 重置为 official（保留行）；extraction: 删除行。
   */
  async resetInstanceUpstreamConfig(
    agentSource: string,
    type: UpstreamConfigType,
  ): Promise<{ reset: boolean }> {
    if (type === "conversation") {
      await this.store.upsertInstanceUpstreamConfig({
        agent_source: agentSource,
        type: "conversation",
        mode: "official",
        base_url: "",
        api_key: "",
        model_id: "",
        description: "",
      });
      return { reset: true };
    }
    const deleted = await this.store.deleteInstanceUpstreamConfig(agentSource, type);
    return { reset: deleted };
  }

  /** api_key 脱敏输出。 */
  private toPublicInstanceUpstreamConfig(
    entity: InstanceUpstreamConfigEntity,
  ): Record<string, unknown> {
    return {
      agent_source: entity.agent_source,
      type: entity.type,
      mode: entity.mode,
      base_url: entity.base_url,
      api_key_masked: entity.api_key ? maskKeyValue(entity.api_key) : "",
      model_id: entity.model_id,
      description: entity.description,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  // ============================================================
  // AuditLog
  // ============================================================
  /** 写一条审计日志（best-effort：失败不阻断主操作）。 */
  recordAuditLog(input: {
    actor_user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    detail?: Record<string, unknown> | string;
  }): void {
    try {
      const detail = typeof input.detail === "string" ? input.detail : JSON.stringify(input.detail ?? {});
      void this.store.createAuditLog({
        actor_user_id: input.actor_user_id,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        detail,
      });
    } catch {
      // 审计失败不阻断主操作
    }
  }

  /** admin 查询审计日志（调用方需自行做 admin 校验）。 */
  async listAuditLogs(filter?: AuditLogFilter, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<AuditLogEntity>> {
    const page = await this.store.listAuditLogs(filter, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  // ============================================================
  // 全局能力权限项（方案B RBAC）
  // ============================================================
  /** 授予权限项（调用方需 permission.grant）。 */
  async grantPermissionForCaller(input: GrantPermissionInput, ctx: V3AuthContext): Promise<UserPermissionEntity> {
    if (!(await this.hasPermission(ctx, "permission.grant"))) {
      throw new MetadataError("permission_denied", "grant permission requires permission.grant");
    }
    if (!isGlobalPermission(input.permission)) {
      throw new MetadataError("invalid_argument", `unknown permission: ${String(input.permission)}`);
    }
    const record = await this.store.grantPermission({
      user_id: input.user_id,
      permission: input.permission,
      granted_by: input.granted_by ?? ctx.userId ?? "system",
    });
    this.recordAuditLog({
      actor_user_id: ctx.userId ?? "",
      action: "permission/grant",
      entity_type: "user",
      entity_id: input.user_id,
      detail: { permission: input.permission },
    });
    return record;
  }

  /** 撤销权限项（调用方需 permission.grant）。 */
  async revokePermissionForCaller(userId: string, permission: string, ctx: V3AuthContext): Promise<boolean> {
    if (!(await this.hasPermission(ctx, "permission.grant"))) {
      throw new MetadataError("permission_denied", "revoke permission requires permission.grant");
    }
    const ok = await this.store.revokePermission(userId, permission);
    if (ok) {
      this.recordAuditLog({
        actor_user_id: ctx.userId ?? "",
        action: "permission/revoke",
        entity_type: "user",
        entity_id: userId,
        detail: { permission },
      });
    }
    return ok;
  }

  /** 查询权限项：admin 全量，普通用户只能看自己的。 */
  async listPermissionsForCaller(filter: PermissionFilter | undefined, ctx: V3AuthContext, pagination: PaginationParams = DEFAULT_PAGINATION): Promise<PaginatedResult<UserPermissionEntity>> {
    if (ctx.isSystemAdmin) {
      const page = await this.store.listUserPermissions(filter, pagination);
      return formatListResult({ items: page.items, total: page.total }, pagination);
    }
    const userId = ctx.userId;
    if (!userId) return formatListResult({ items: [], total: 0 }, pagination);
    const page = await this.store.listUserPermissions({ ...filter, user_id: userId }, pagination);
    return formatListResult({ items: page.items, total: page.total }, pagination);
  }

  /** 某用户的有效权限集合（含预置默认），供前端展示。 */
  async resolveEffectivePermissions(userId: string): Promise<GlobalPermission[]> {
    const user = await this.store.getUserById(userId);
    const isAdmin = user?.user_type === "system_admin";
    const base = isAdmin ? SYSTEM_ADMIN_DEFAULT : NORMAL_DEFAULT;
    const granted = await this.store.listUserPermissions({ user_id: userId }, null);
    const set = new Set<GlobalPermission>(base);
    for (const g of granted.items) set.add(g.permission);
    return Array.from(set).sort();
  }
}
