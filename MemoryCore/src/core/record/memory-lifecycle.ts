/**
 * Memory Lifecycle（记忆生命周期状态机 + Dreaming 关系检测，P1.2 记忆闭环）.
 *
 * 补齐对比文档 §6 的「记忆闭环」缺失：TencentDB 现有 l1-dedup 只在「写入时」
 * 做 duplicate→merge/update，缺：
 * 1. 7 类关系检测（conflict/duplicate/near_duplicate/complementary/low_value/ambiguous/other）
 * 2. 生命周期状态机（active/consolidated/archived/dormant）
 * 3. 离线巩固（现有 dedup 是写入时，dreaming 是离线盘点现有记忆之间的关系统）
 *
 * 对标 MindMemOS `components/dreaming/relation_detection.py` 的 7 类 issue +
 * consolidation 动作（merge/archive/update/link），以及 P0.1 的 write_policy
 * 「持久更改 vs 记忆总结」守卫（捍卫：系统巩固不得覆盖用户显式持久更改）。
 *
 * 本模块分两层：
 * - 状态机（decideLifecycleAction）：纯函数，关系 + 状态 + 策略 → 动作 + 新状态
 * - 关系检测（detectRelation）：纯函数启发式覆盖 duplicate/near_duplicate/low_value，
 *   conflict/complementary/ambiguous 需语义理解，留给 LLM detector（2-stage，同 MindMemOS）
 */

import { canOverwrite, type WritePolicy } from "./memory-domain.js";

export type MemoryLifecycleState = "active" | "consolidated" | "archived" | "dormant";

export type DreamingIssueType =
  | "conflict"
  | "duplicate"
  | "near_duplicate"
  | "complementary"
  | "low_value"
  | "ambiguous"
  | "other";

/** 巩固动作（对标 MindMemOS consolidation actions）。 */
export type LifecycleAction = "merge" | "archive" | "update" | "link" | "keep";

export interface LifecycleDecision {
  action: LifecycleAction;
  newState: MemoryLifecycleState;
  reason: string;
}

export interface LifecycleContext {
  /** 当前记录的写入策略（持久 vs 总结守卫） */
  writePolicy: WritePolicy;
  /** 被巩固目标记录的写入策略（merge/link 时用于守卫） */
  targetWritePolicy?: WritePolicy;
}

/**
 * 状态机：由关系 + 当前状态 + 写入策略，推导巩固动作与新状态。
 *
 * 铁律（与 P0.1 守卫一致）：关系检测产出的 merge/archive 是「系统巩固」，
 * 其动作语义按 system（automatic 级别）算，永远不能覆盖 explicit_only（用户
 * 显式持久更改）。若关系指向「合并掉一条持久更改」，守卫强制降级为 keep。
 */
export function decideLifecycleAction(
  state: MemoryLifecycleState,
  relation: DreamingIssueType,
  ctx: LifecycleContext = { writePolicy: "automatic" },
): LifecycleDecision {
  const currentPolicy = ctx.writePolicy;

  switch (relation) {
    case "duplicate":
    case "near_duplicate": {
      // 合并去重：当前记录会被并入 target（或反之）。若当前是显式持久更改，
      // 系统巩固不得合并它；同理 target 是持久更改时也不得被当前合并覆盖。
      const currentIsPersistent = currentPolicy === "explicit_only";
      const targetIsPersistent = ctx.targetWritePolicy === "explicit_only";
      if (currentIsPersistent || targetIsPersistent) {
        return {
          action: "keep",
          newState: state,
          reason: `duplicate consolidation blocked: cannot merge explicit_only persistent change (current=${currentPolicy}, target=${ctx.targetWritePolicy ?? "?"})`,
        };
      }
      return mergeDecision(state);
    }
    case "conflict":
      // 冲突：不自动合并/删除，标记待人工/LLM 裁决
      return { action: "update", newState: state, reason: "conflict requires arbitration — keep both, mark for review" };
    case "low_value":
      // 低价值 → 归档（但持久更改不可归档）
      if (currentPolicy === "explicit_only") {
        return { action: "keep", newState: state, reason: "cannot archive explicit_only persistent change" };
      }
      return { action: "archive", newState: "archived", reason: "low-value memory archived" };
    case "complementary":
      // 互补 → 建边不合并
      return { action: "link", newState: state, reason: "complementary memories linked (no merge)" };
    case "ambiguous":
    case "other":
    default:
      return { action: "keep", newState: state, reason: `relation=${relation} — no action` };
  }
}

function mergeDecision(_state: MemoryLifecycleState): LifecycleDecision {
  return { action: "merge", newState: "consolidated", reason: "duplicate/near-duplicate merged into consolidated" };
}

/**
 * 启发式关系检测（纯函数，不用 LLM）。
 * - duplicate：Jaccard ≥ 0.9
 * - near_duplicate：Jaccard ≥ 0.6
 * - 否则 none（conflict/complementary/ambiguous 需 LLM，留待 detector）
 */
export function detectRelationByOverlap(a: string, b: string): DreamingIssueType {
  const j = tokenJaccardLocal(a, b);
  if (j >= 0.9) return "duplicate";
  if (j >= 0.6) return "near_duplicate";
  return "other";
}

/** 低价值启发式：内容过短 且 priority 低于阈值。 */
export function isLowValue(content: string, priority: number, opts: { minChars?: number; maxPriority?: number } = {}): boolean {
  const minChars = opts.minChars ?? 8;
  const maxPriority = opts.maxPriority ?? 20;
  return content.trim().length < minChars && priority < maxPriority;
}

/** 默认生命周期状态（新记忆出生即 active）。 */
export function initialState(): MemoryLifecycleState {
  return "active";
}

// ============================
// 内部：Jaccard（不依赖 retention.ts 避免耦合，保留独立可测实现）
// ============================

function tokenizeLocal(text: string): Set<string> {
  const lower = text.toLowerCase();
  const cjk = lower.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? [];
  const words = lower.match(/[a-z0-9_]+/g) ?? [];
  return new Set([...cjk, ...words]);
}

function tokenJaccardLocal(a: string, b: string): number {
  const sa = tokenizeLocal(a);
  const sb = tokenizeLocal(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** 关系检测守卫：合并动作是否被写策略允许（对外暴露，供 LLM detector 复用）。 */
export function canConsolidate(relation: DreamingIssueType, ctx: LifecycleContext): boolean {
  return decideLifecycleAction("active", relation, ctx).action !== "keep";
}