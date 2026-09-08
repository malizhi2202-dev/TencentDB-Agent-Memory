import { describe, it, expect } from "vitest";
import { resolveApprovalLevel, needsApproval, canSelfApprove, authorizeDecision } from "./approval-policy.js";

describe("approval-policy — 审批五档（§6.1）", () => {
  it("服务端解析：声明不能低于基线（更松不可选，回落基线）", () => {
    // 基线 on_demand（rank 2），声明 never（rank 4，更松）→ ok，因为 rank 4 >= 2
    expect(resolveApprovalLevel("never", "on_demand")).toEqual({ ok: true, level: "never" });
    // 基线 on_demand（rank 2），声明 untrusted_command（rank 0，更严）→ 拒绝，回落基线
    expect(resolveApprovalLevel("untrusted_command", "on_demand")).toEqual({ ok: false, level: "on_demand" });
  });

  it("untrusted_command：一切命令都审批", () => {
    expect(needsApproval("untrusted_command", "safe")).toBe("require_approval");
    expect(needsApproval("untrusted_command", "untrusted")).toBe("require_approval");
  });

  it("on_demand（默认）：safe 放行，risky/untrusted 审批", () => {
    expect(needsApproval("on_demand", "safe")).toBe("auto_approve");
    expect(needsApproval("on_demand", "risky")).toBe("require_approval");
    expect(needsApproval("on_demand", "untrusted")).toBe("require_approval");
  });

  it("smart：safe 放行，risky 确认，untrusted 审批", () => {
    expect(needsApproval("smart", "safe")).toBe("auto_approve");
    expect(needsApproval("smart", "risky")).toBe("require_confirmation");
    expect(needsApproval("smart", "untrusted")).toBe("require_approval");
  });

  it("on_failure：safe 命令失败过 → 审批；未失败 → 放行", () => {
    expect(needsApproval("on_failure", "safe")).toBe("auto_approve");
    expect(needsApproval("on_failure", "safe", { failedBefore: true })).toBe("require_approval");
    expect(needsApproval("on_failure", "risky")).toBe("require_approval");
  });

  it("never：一切放行", () => {
    expect(needsApproval("never", "untrusted")).toBe("auto_approve");
  });

  it("模型不能自批：裁决只能来自 API 调用方", () => {
    expect(canSelfApprove("model")).toBe(false);
    expect(canSelfApprove("api_caller")).toBe(true);
    expect(authorizeDecision("model").authorized).toBe(false);
    expect(authorizeDecision("api_caller").authorized).toBe(true);
  });
});