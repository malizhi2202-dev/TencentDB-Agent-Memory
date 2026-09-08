/**
 * Review Gate（写入审批门控 + RBAC，P2 治理）.
 *
 * 补齐对比文档 §7 的「审批/RBAC」缺失：P0.1 定义了 write_policy（含
 * review_required = 需审批），但 writeMemory 目前一律直接落库——review_required
 * 的「人审」语义没有落地。工程上，review_required 的写入应先进待审批队列，
 * 由授权批准人（owner/admin）裁决后决定 commit / discard。
 *
 * 本模块是纯逻辑（无 IO）：policy + 操作者角色 → 决策（commit/hold/reject），
 * 是审批流的状态机核心。队列与人工审批 UI 由调用方承接。
 *
 * 语义（fail-closed，对标 Agent OS 的「未绑定 → 不可用」而非降级默认）：
 * - automatic         → commit（系统总结，免审）
 * - review_required   → owner/admin 批准 commit；member 及以下 hold（无权，等更高角色）
 * - explicit_only     → 仅 owner commit（用户持久更改，admin 也不该替用户改）
 * - deny              → reject（永不写入）
 */

import type { WritePolicy } from "./memory-domain.js";

export type ReviewerRole = "owner" | "admin" | "member" | "viewer";

export type ReviewDecision = "commit" | "hold" | "reject";

export interface ReviewGateInput {
  policy: WritePolicy;
  role: ReviewerRole;
}

/** 审批门：policy + 角色 → 决策。 */
export function reviewGate(input: ReviewGateInput): ReviewDecision {
  switch (input.policy) {
    case "automatic":
      return "commit";
    case "review_required":
      return input.role === "owner" || input.role === "admin" ? "commit" : "hold";
    case "explicit_only":
      return input.role === "owner" ? "commit" : "hold";
    case "deny":
      return "reject";
    default:
      return "reject";
  }
}

/** 某角色能否批准某策略（供审批 UI 显示按钮/权限）。 */
export function canApprove(policy: WritePolicy, role: ReviewerRole): boolean {
  return reviewGate({ policy, role }) === "commit";
}

/**
 * 角色层级比较：roleA 是否不低于 roleB。
 * owner > admin > member > viewer。
 */
const ROLE_RANK: Record<ReviewerRole, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export function roleAtLeast(roleA: ReviewerRole, roleB: ReviewerRole): boolean {
  return ROLE_RANK[roleA] >= ROLE_RANK[roleB];
}

/**
 * 审批裁决：对一条 hold 的写入，由更高角色行动。
 * - approve → commit
 * - reject（且操作者有资格，即 role 足以批准该 policy）→ discard
 * - 无权 reject（角色不够）→ 保持 hold
 */
export function approveOrReject(
  policy: WritePolicy,
  role: ReviewerRole,
  action: "approve" | "reject",
): ReviewDecision {
  if (!canApprove(policy, role)) return "hold";
  return action === "approve" ? "commit" : "reject";
}