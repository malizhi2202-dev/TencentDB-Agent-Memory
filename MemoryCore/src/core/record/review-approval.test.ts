import { describe, it, expect } from "vitest";
import { reviewGate, canApprove, roleAtLeast, approveOrReject } from "./review-approval.js";

describe("review-approval — 写入审批门控 + RBAC（P2 治理）", () => {
  it("automatic → commit（系统总结免审）", () => {
    expect(reviewGate({ policy: "automatic", role: "viewer" })).toBe("commit");
  });

  it("review_required → owner/admin 批准，member/viewer hold", () => {
    expect(reviewGate({ policy: "review_required", role: "owner" })).toBe("commit");
    expect(reviewGate({ policy: "review_required", role: "admin" })).toBe("commit");
    expect(reviewGate({ policy: "review_required", role: "member" })).toBe("hold");
    expect(reviewGate({ policy: "review_required", role: "viewer" })).toBe("hold");
  });

  it("explicit_only → 仅 owner commit（admin 也不替用户改持久更改）", () => {
    expect(reviewGate({ policy: "explicit_only", role: "owner" })).toBe("commit");
    expect(reviewGate({ policy: "explicit_only", role: "admin" })).toBe("hold");
  });

  it("deny → 永不写入（reject）", () => {
    expect(reviewGate({ policy: "deny", role: "owner" })).toBe("reject");
  });

  it("canApprove：角色是否有权批准该策略", () => {
    expect(canApprove("review_required", "admin")).toBe(true);
    expect(canApprove("review_required", "member")).toBe(false);
    expect(canApprove("explicit_only", "admin")).toBe(false);
    expect(canApprove("explicit_only", "owner")).toBe(true);
  });

  it("roleAtLeast：角色层级 owner>admin>member>viewer", () => {
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("owner", "owner")).toBe(true);
  });

  it("approveOrReject：有权才可 approve/reject，无权保持 hold", () => {
    expect(approveOrReject("review_required", "admin", "approve")).toBe("commit");
    expect(approveOrReject("review_required", "member", "approve")).toBe("hold");
    expect(approveOrReject("review_required", "admin", "reject")).toBe("reject");
    expect(approveOrReject("explicit_only", "admin", "approve")).toBe("hold"); // admin 无权approve explicit_only
  });
});