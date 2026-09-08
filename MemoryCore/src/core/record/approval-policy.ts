/**
 * Approval Policy（审批五档，P2 治理 §6.1 深化）.
 *
 * 补齐对比文档 §6.1 的「审批五档」差距：review-approval.ts 覆盖了「写入审批」
 * （write_policy → commit/hold/reject），这里补 Agent OS 的「工具命令审批五档」
 * + 服务端解析 + 「模型不能自批」铁律。
 *
 * 五档（严格度降序）：
 *   untrusted_command（不可信命令审批，最严）/ on_failure（失败后审批）/
 *   on_demand（按需审批，默认）/ smart（智能：安全自动放行、风险确认）/
 *   never（永不审批，最松）
 *
 * 关键语义（对标 Agent OS「声明与强制分离」）：
 * - 档位**服务端解析**：客户端声明的档位受执行者授权基线约束，低于下限（更松）不可选
 * - **模型无法批准自己的调用**：裁决只来自 API 调用方，请求者 ≠ 裁决者
 */

export type ApprovalLevel = "untrusted_command" | "on_failure" | "on_demand" | "smart" | "never";

export type CommandRisk = "safe" | "risky" | "untrusted";

export type ApprovalDecision = "auto_approve" | "require_confirmation" | "require_approval";

/** 严格度：rank 越大越松。 */
const LEVEL_RANK: Record<ApprovalLevel, number> = {
  untrusted_command: 0,
  on_failure: 1,
  on_demand: 2,
  smart: 3,
  never: 4,
};

/**
 * 服务端解析：声明的档位不能比授权基线更松（rank 必须 >= baseline rank）。
 * 客户端声明低于下限（更松）→ 拒绝，回落到基线。
 */
export function resolveApprovalLevel(declared: ApprovalLevel, baseline: ApprovalLevel): { ok: boolean; level: ApprovalLevel } {
  if (LEVEL_RANK[declared] >= LEVEL_RANK[baseline]) {
    return { ok: true, level: declared };
  }
  return { ok: false, level: baseline };
}

/**
 * 某档位下，一条命令是否需要审批。
 * - untrusted_command：一切命令都审批（最严）
 * - on_failure：safe 命令放行（除非之前失败过→审批），risky/untrusted 审批
 * - on_demand（默认）：safe 放行，risky/untrusted 审批
 * - smart：safe 放行，risky 确认（非审批），untrusted 审批
 * - never：一切放行
 */
export function needsApproval(level: ApprovalLevel, risk: CommandRisk, opts: { failedBefore?: boolean } = {}): ApprovalDecision {
  switch (level) {
    case "untrusted_command":
      return "require_approval";
    case "on_failure":
      if (risk === "safe" && !opts.failedBefore) return "auto_approve";
      return "require_approval";
    case "on_demand":
      return risk === "safe" ? "auto_approve" : "require_approval";
    case "smart":
      if (risk === "safe") return "auto_approve";
      if (risk === "risky") return "require_confirmation";
      return "require_approval";
    case "never":
      return "auto_approve";
    default:
      return "require_approval";
  }
}

/** 模型（agent）能否批准自己的调用：永远不能。裁决只来自 API 调用方。 */
export function canSelfApprove(requester: "model" | "api_caller"): boolean {
  return requester !== "model";
}

/** 审批裁决方必须是 API 调用方（非 model），否则拒绝裁决。 */
export function authorizeDecision(requester: "model" | "api_caller"): { authorized: boolean; reason: string } {
  if (requester === "model") {
    return { authorized: false, reason: "model cannot approve its own call — decision must come from the API caller" };
  }
  return { authorized: true, reason: "ok" };
}