/**
 * Memory Domain (Brain 域) + Write Policy (写入策略).
 *
 * P0.1 阶段 A：把 L1 的记忆从「type 一维扛内容+生命周期+作用域」升级为
 * 「domain（Brain 域）+ write_policy（持久更改 vs 记忆总结）」的明确分界。
 *
 * 设计依据：.specs/design-memory-domain-write-model.md，对标 Agent OS 的
 * memory_domain（raw/episodic/semantic/...）与「read/write 双 scope」语义，
 * 以及 MindMemOS 的「explicit vs implicit」写入区分。
 *
 * 本模块是纯逻辑（无 IO），全部可单测。
 */

// ============================
// MemoryDomain（Brain 域）
// ============================

export type MemoryDomain =
  | "raw"          // 原始对话/文件（不提炼，短生命周期）
  | "episodic"     // 发生过的事件
  | "semantic"     // 稳定事实
  | "preference"   // 用户偏好（从 persona 拆出）
  | "instruction"  // 用户给的指令
  | "rule"         // 治理规则（用户显式）
  | "procedural"   // 怎么做（work_method）
  | "task"         // 任务上下文（work_task）
  | "artifact"     // 产出物（work_artifact）
  | "persona"      // 人设画像（身份，非偏好）
  | "graph"        // 实体 / 关系边
  | "archive";     // 归档历史（默认不召回）

export const MEMORY_DOMAINS: readonly MemoryDomain[] = [
  "raw",
  "episodic",
  "semantic",
  "preference",
  "instruction",
  "rule",
  "procedural",
  "task",
  "artifact",
  "persona",
  "graph",
  "archive",
];

// ============================
// WritePolicy（写入策略）
// ============================

/**
 * 写入策略四档。
 * - automatic       系统总结可直接写入
 * - review_required 写入前需用户确认（项目决策、重要事实）
 * - explicit_only   只能用户显式操作（instruction/rule/配置/密钥）
 * - deny            永不写入（密码、token）— 只用于写入前拒绝，不落到记录上
 */
export type WritePolicy = "automatic" | "review_required" | "explicit_only" | "deny";

/** 策略强度：数值越高越「持久/需用户操作」，越不可被系统总结覆盖。 */
export const WRITE_POLICY_RANK: Record<WritePolicy, number> = {
  deny: 0,           // 只用于拒绝写入；不参与已写入记录的覆盖比较
  automatic: 1,
  review_required: 2,
  explicit_only: 3,
};

// ============================
// 每域 profile（生命周期 / 默认策略 / 召回权重 / 是否默认召回）
// ============================

export type MemoryDomainLifecycle = "short" | "medium" | "long";

export interface MemoryDomainProfile {
  /** 生命周期（影响清理/归档策略） */
  lifecycle: MemoryDomainLifecycle;
  /** 该域默认写入策略（持久更改 vs 记忆总结的核心分界） */
  defaultPolicy: WritePolicy;
  /** 召回排序乘数（P0.2 Retention 层使用） */
  recallWeight: number;
  /** 是否默认参与召回（archive 默认不召回） */
  defaultRecall: boolean;
}

export const MEMORY_DOMAIN_PROFILE: Record<MemoryDomain, MemoryDomainProfile> = {
  raw:         { lifecycle: "short",  defaultPolicy: "automatic",     recallWeight: 0.5, defaultRecall: true },
  episodic:    { lifecycle: "medium", defaultPolicy: "automatic",     recallWeight: 0.7, defaultRecall: true },
  semantic:    { lifecycle: "long",   defaultPolicy: "automatic",     recallWeight: 1.0, defaultRecall: true },
  preference:  { lifecycle: "long",   defaultPolicy: "automatic",     recallWeight: 0.9, defaultRecall: true },
  instruction: { lifecycle: "long",   defaultPolicy: "explicit_only", recallWeight: 1.0, defaultRecall: true },
  rule:        { lifecycle: "long",   defaultPolicy: "explicit_only", recallWeight: 1.0, defaultRecall: true },
  procedural:  { lifecycle: "medium", defaultPolicy: "automatic",     recallWeight: 0.8, defaultRecall: true },
  task:        { lifecycle: "short",  defaultPolicy: "automatic",     recallWeight: 0.6, defaultRecall: true },
  artifact:    { lifecycle: "long",   defaultPolicy: "automatic",     recallWeight: 0.7, defaultRecall: true },
  persona:     { lifecycle: "long",   defaultPolicy: "automatic",     recallWeight: 0.9, defaultRecall: true },
  graph:       { lifecycle: "long",   defaultPolicy: "automatic",     recallWeight: 0.6, defaultRecall: true },
  archive:     { lifecycle: "long",   defaultPolicy: "automatic",     recallWeight: 0.3, defaultRecall: false },
};

// ============================
// 推导函数
// ============================

/**
 * 由现有 L1 MemoryType 推导默认 Brain 域。
 * 接收 string（而非 MemoryType 类型）以避免与 l1-writer 产生运行时循环依赖。
 */
export function defaultDomainForType(type: string): MemoryDomain {
  switch (type) {
    case "persona": return "persona";
    case "episodic": return "episodic";
    case "instruction": return "instruction";
    case "work_fact": return "semantic";
    case "work_task": return "task";
    case "work_method": return "procedural";
    case "work_artifact": return "artifact";
    default: return "episodic";
  }
}

/** 由域推导默认写入策略（持久更改 vs 记忆总结的核心分界）。 */
export function defaultPolicyForDomain(domain: MemoryDomain): WritePolicy {
  return MEMORY_DOMAIN_PROFILE[domain].defaultPolicy;
}

export function isMemoryDomain(value: unknown): value is MemoryDomain {
  return typeof value === "string" && (MEMORY_DOMAINS as readonly string[]).includes(value);
}

// ============================
// 覆盖守卫（系统总结不可覆盖持久更改）
// ============================

/**
 * 判断 incoming（新写入）能否覆盖 existing（已存在）的记录。
 *
 * 铁律：系统总结永远不能覆盖用户显式持久更改。
 * - existing=explicit_only, incoming=automatic → false（拒绝）
 * - existing=automatic, incoming=explicit_only → true（用户显式覆盖总结）
 * - 同级可覆盖（更新自己的总结）
 * - deny 不落到已写入记录（写入前即拒绝），此处视作最高屏障
 */
export function canOverwrite(existing: WritePolicy, incoming: WritePolicy): boolean {
  if (existing === "deny" || incoming === "deny") return false;
  return WRITE_POLICY_RANK[incoming] >= WRITE_POLICY_RANK[existing];
}

/**
 * 解析最终写入策略：调用方只能「收紧」（automatic→review_required/explicit_only），
 * 不能「放宽」（explicit_only→automatic）。
 */
export function resolveWritePolicy(
  defaultPolicy: WritePolicy,
  requested?: WritePolicy,
): { ok: true; policy: WritePolicy } | { ok: false; reason: string } {
  if (requested === undefined) return { ok: true, policy: defaultPolicy };
  if (requested === "deny") return { ok: false, reason: "write_policy 'deny' rejects the write outright" };
  if (WRITE_POLICY_RANK[requested] >= WRITE_POLICY_RANK[defaultPolicy]) {
    return { ok: true, policy: requested };
  }
  return {
    ok: false,
    reason: `write_policy cannot be loosened from ${defaultPolicy} to ${requested}`,
  };
}

/** 该域是否默认参与召回（archive 域 defaultRecall=false → 不召回）。 */
export function isRecallableDomain(domain: string): boolean {
  const profile = MEMORY_DOMAIN_PROFILE[domain as MemoryDomain];
  if (!profile) return true; // 未知域默认召回（向后兼容旧数据）
  return profile.defaultRecall;
}