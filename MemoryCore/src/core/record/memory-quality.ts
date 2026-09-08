/**
 * Memory Quality State Machine（记忆质量状态机，P1.2 §4.3 深化）.
 *
 * 补齐对比文档 §4.3 的「质量状态机」差距：memory-lifecycle.ts 的 4 态
 * （active/consolidated/archived/dormant）是「巩固生命周期」，这里补 Agent OS /
 * MindMemOS 的「质量追踪」完整 8 态：
 *   candidate → verified → active → stale → disputed → superseded → archived → deleted
 *
 * 语义：
 * - candidate：抽取/生成待验证（未经验证，召回时降权）
 * - verified：已验证（如被采纳/评分通过）
 * - active：活跃参与召回
 * - stale：过期（长时间未命中）
 * - disputed：有争议（冲突待裁决）
 * - superseded：被更新版本取代（不召回，保留 lineage）
 * - archived：归档（不召回，可恢复）
 * - deleted：已删除（终态）
 *
 * 本模块是纯逻辑（无 IO）：状态 + 事件 → 下一状态（含合法性判定），可单测。
 * 与 memory-lifecycle.ts 正交：lifecycle 管「巩固动作」，quality 管「质量追踪」。
 */

export type QualityState =
  | "candidate"
  | "verified"
  | "active"
  | "stale"
  | "disputed"
  | "superseded"
  | "archived"
  | "deleted";

export type QualityEvent =
  | "verify"
  | "activate"
  | "mark_stale"
  | "dispute"
  | "supersede"
  | "archive"
  | "delete"
  | "revalidate";

export interface QualityTransition {
  allowed: boolean;
  next: QualityState;
  reason: string;
}

/** 状态转换表（state → event → next）。 */
const TRANSITIONS: Record<QualityState, Partial<Record<QualityEvent, QualityState>>> = {
  candidate: { verify: "verified", activate: "active", delete: "deleted" },
  verified: { activate: "active", delete: "deleted" },
  active: { mark_stale: "stale", dispute: "disputed", supersede: "superseded", archive: "archived", delete: "deleted" },
  stale: { revalidate: "active", archive: "archived", delete: "deleted" },
  disputed: { revalidate: "active", archive: "archived", delete: "deleted" },
  superseded: { archive: "archived", delete: "deleted" },
  archived: { revalidate: "active", delete: "deleted" },
  deleted: {},
};

/** 终态：无出边。 */
const TERMINAL: ReadonlySet<QualityState> = new Set(["deleted"]);

export function transitionQuality(state: QualityState, event: QualityEvent): QualityTransition {
  const next = TRANSITIONS[state]?.[event];
  if (next === undefined) {
    return { allowed: false, next: state, reason: `transition ${state} --${event}--> is not allowed` };
  }
  return { allowed: true, next, reason: `ok` };
}

/** 该状态是否参与召回（archived/superseded/deleted 不召回）。 */
export function qualityRecallable(state: QualityState): boolean {
  return state !== "archived" && state !== "superseded" && state !== "deleted";
}

/** 该状态是否可写（deleted/superseded 不可写）。 */
export function qualityWritable(state: QualityState): boolean {
  return state !== "deleted" && state !== "superseded";
}

/** 是否终态（不可再转换）。 */
export function isTerminal(state: QualityState): boolean {
  return TERMINAL.has(state);
}

/** 初始质量状态（新记忆出生即 candidate，验证后进 active）。 */
export function initialQuality(): QualityState {
  return "candidate";
}