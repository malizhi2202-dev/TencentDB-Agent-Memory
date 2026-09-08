/**
 * Skill Version Lifecycle（skill 版本生命周期，P1.3 §5.3 深化）.
 *
 * 补齐「work_method → Playbook → Skill 沉淀链」的最后一环：Skill 的审核/版本演进。
 * 对比文档 §4.4/§5.3 明确指出 MindMemOS 的 skill evolution 是「算法思路对、
 * 工程落地半成品」——`SkillVersionStatus` 枚举有 published/evaluating/superseded/
 * rolled_back，但「没有完整生命周期转换/发布实现」。
 *
 * 这里做正面落地（学设计、补工程）：
 * - **完整生命周期**：draft → pending(审核) → published → evaluating →
 *   superseded / rolled_back（MindMemOS 缺的「发布实现」在这里补上）
 * - **发布实现**：publish 是明确的版本化终态，approve/reject 有归属人裁决语义
 * - 转换表全枚举，非法转换明确拒绝（避免 MindMemOS 的「状态悬空」）
 *
 * 本模块是纯逻辑（无 IO）：状态 + 事件 → 下一状态，可单测。锁/原子性（mint+consume
 * 非原子、并发 evolve 无锁）属执行层工程，另文处理，不在本纯逻辑模块混入。
 */

export type SkillVersionStatus = "draft" | "pending" | "published" | "evaluating" | "superseded" | "rolled_back";

export type SkillVersionEvent =
  | "submit_review"
  | "approve"
  | "reject"
  | "start_eval"
  | "pass_eval"
  | "fail_eval"
  | "supersede"
  | "rollback";

export interface SkillVersionTransition {
  allowed: boolean;
  next: SkillVersionStatus;
  reason: string;
}

const TRANSITIONS: Record<SkillVersionStatus, Partial<Record<SkillVersionEvent, SkillVersionStatus>>> = {
  draft: { submit_review: "pending" },
  pending: { approve: "published", reject: "draft" },
  published: { start_eval: "evaluating", supersede: "superseded", rollback: "rolled_back" },
  evaluating: { pass_eval: "published", fail_eval: "rolled_back", supersede: "superseded" },
  superseded: {},
  rolled_back: {},
};

export function transitionSkillVersion(status: SkillVersionStatus, event: SkillVersionEvent): SkillVersionTransition {
  const next = TRANSITIONS[status]?.[event];
  if (next === undefined) {
    return { allowed: false, next: status, reason: `transition ${status} --${event}--> is not allowed` };
  }
  return { allowed: true, next, reason: "ok" };
}

/** 该状态是否对外可用（published 才可被调用）。 */
export function isSkillUsable(status: SkillVersionStatus): boolean {
  return status === "published";
}

/** 终态（superseded/rolled_back 不可逆）。 */
export function isSkillTerminal(status: SkillVersionStatus): boolean {
  return status === "superseded" || status === "rolled_back";
}

/** 完整生命周期可达序列（供测试/文档）：draft→pending→published→evaluating→published。 */
export function skillLifecyclePath(): SkillVersionStatus[] {
  return ["draft", "pending", "published", "evaluating", "published"];
}