import { describe, it, expect } from "vitest";
import {
  routeMemorySpace,
  resolveSpaceOwner,
  sourcePolicyFor,
  type WriteSource,
} from "./memory-write-router.js";

describe("memory-write-router — 服务端裁决路由（P0.1 阶段 C）", () => {
  it("路由：persona/preference → user 空间（跨 agent 用户画像）", () => {
    const r = routeMemorySpace({ domain: "preference", source: "system_extract", userId: "u1", agentId: "a1" });
    expect(r.space.ownerType).toBe("user");
    expect(r.space.ownerId).toBe("u1");
  });

  it("路由：instruction/rule → team 空间（团队持久更改）", () => {
    const r = routeMemorySpace({ domain: "rule", source: "user_explicit", teamId: "t1", userId: "u1" });
    expect(r.space.ownerType).toBe("team");
    expect(r.space.ownerId).toBe("t1");
  });

  it("路由：episodic/task/artifact → task（有 taskId）或 agent（工作记忆）", () => {
    const withTask = routeMemorySpace({ domain: "task", source: "system_extract", taskId: "tk1", agentId: "a1" });
    expect(withTask.space.ownerType).toBe("task");
    expect(withTask.space.ownerId).toBe("tk1");

    const noTask = routeMemorySpace({ domain: "episodic", source: "system_extract", agentId: "a1" });
    expect(noTask.space.ownerType).toBe("agent");
    expect(noTask.space.ownerId).toBe("a1");
  });

  it("路由：semantic/procedural → project > team > agent（共享知识）", () => {
    const p = routeMemorySpace({ domain: "procedural", source: "agent_insight", projectId: "p1", teamId: "t1", agentId: "a1" });
    expect(p.space.ownerType).toBe("project");

    const t = routeMemorySpace({ domain: "semantic", source: "agent_insight", teamId: "t1", agentId: "a1" });
    expect(t.space.ownerType).toBe("team");

    const a = routeMemorySpace({ domain: "semantic", source: "agent_insight", agentId: "a1" });
    expect(a.space.ownerType).toBe("agent");
  });

  it("effectivePolicy：持久更改域（instruction/rule）恒 explicit_only，无论来源", () => {
    const sources: WriteSource[] = ["user_explicit", "agent_insight", "file_upload", "system_extract", "feedback_correction"];
    for (const source of sources) {
      const r = routeMemorySpace({ domain: "rule", source, teamId: "t1" });
      expect(r.effectivePolicy, `source=${source}`).toBe("explicit_only");
    }
  });

  it("effectivePolicy：feedback_correction（用户纠正）→ explicit_only", () => {
    const r = routeMemorySpace({ domain: "semantic", source: "feedback_correction", teamId: "t1" });
    expect(r.effectivePolicy).toBe("explicit_only");
  });

  it("effectivePolicy：user_explicit / file_upload → 至少 review_required", () => {
    expect(routeMemorySpace({ domain: "semantic", source: "user_explicit", teamId: "t1" }).effectivePolicy).toBe("review_required");
    expect(routeMemorySpace({ domain: "procedural", source: "file_upload", teamId: "t1" }).effectivePolicy).toBe("review_required");
  });

  it("effectivePolicy：agent_insight / system_extract → automatic（系统总结）", () => {
    expect(routeMemorySpace({ domain: "semantic", source: "agent_insight", teamId: "t1" }).effectivePolicy).toBe("automatic");
    expect(routeMemorySpace({ domain: "episodic", source: "system_extract", agentId: "a1" }).effectivePolicy).toBe("automatic");
  });

  it("空间基线收紧不被 source 放宽（合并只收紧不放松）", () => {
    // 空间显式收紧到 review_required 后，system_extract 不能把它放宽回 automatic
    // 通过 makeMemorySpace 的 writePolicy 参数收紧在 route 内部用 makeMemorySpace(默认)，
    // 这里验证 sourcePolicyFor 对 system_extract 返回 automatic，且与 explicit 基线合并后仍 explicit。
    const r = routeMemorySpace({ domain: "instruction", source: "system_extract", teamId: "t1" });
    expect(r.effectivePolicy).toBe("explicit_only");
  });

  it("spaceId 由服务端确定性计算（相同输入同 id，调用方不可自选）", () => {
    const a = routeMemorySpace({ domain: "semantic", source: "agent_insight", teamId: "t1" });
    const b = routeMemorySpace({ domain: "semantic", source: "agent_insight", teamId: "t1" });
    expect(a.spaceId).toBe(b.spaceId);
    expect(a.spaceId.startsWith("sp_")).toBe(true);
  });

  it("resolveSpaceOwner：无任何隔离维度时兜底到 default_agent", () => {
    const owner = resolveSpaceOwner({ domain: "semantic", source: "system_extract" });
    expect(owner).toEqual({ ownerType: "agent", ownerId: "default_agent" });
  });

  it("sourcePolicyFor：domain 优先于 source（持久更改域不受 source 影响）", () => {
    expect(sourcePolicyFor("system_extract", "instruction")).toBe("explicit_only");
    expect(sourcePolicyFor("system_extract", "semantic")).toBe("automatic");
  });
});