import { describe, it, expect } from "vitest";
import { resolveExecutionBundle } from "./execution-bundle.js";

describe("execution-bundle — 多对多挂载 + 纯函数编译（P1.1）", () => {
  it("多对多挂载：agent + team + user + project → 12 个空间（单值 team_id 的局限被打破）", () => {
    const bundle = resolveExecutionBundle({
      agentId: "a1",
      teamId: "t1",
      userId: "u1",
      projectId: "p1",
      taskId: "tk1",
      sceneIds: ["scene-b", "scene-a"],
    });
    expect(bundle.mountedSpaces).toHaveLength(12);
    const owners = new Set(bundle.mountedSpaces.map((s) => s.ownerType));
    expect(owners).toEqual(new Set(["agent", "team", "user", "project"]));
  });

  it("纯函数确定性：同一输入 → 同一 bundleId + 同一空间列表", () => {
    const input = { agentId: "a1", teamId: "t1", userId: "u1" };
    const b1 = resolveExecutionBundle(input);
    const b2 = resolveExecutionBundle(input);
    expect(b1.bundleId).toBe(b2.bundleId);
    expect(b1.mountedSpaces).toEqual(b2.mountedSpaces);
  });

  it("bundleId 对每个维度敏感（任一变化 → 不同 id，可检测运行中改动）", () => {
    const base = { agentId: "a1", teamId: "t1", userId: "u1", sceneIds: ["s1"] };
    const id0 = resolveExecutionBundle(base).bundleId;
    expect(resolveExecutionBundle({ ...base, agentId: "a2" }).bundleId).not.toBe(id0);
    expect(resolveExecutionBundle({ ...base, teamId: "t2" }).bundleId).not.toBe(id0);
    expect(resolveExecutionBundle({ ...base, projectId: "p9" }).bundleId).not.toBe(id0);
    expect(resolveExecutionBundle({ ...base, sceneIds: ["s1", "s2"] }).bundleId).not.toBe(id0);
  });

  it("场景排序确定性：sceneIds 无序输入也得到同一 bundleId", () => {
    const a = resolveExecutionBundle({ agentId: "a1", sceneIds: ["b", "a", "c"] });
    const b = resolveExecutionBundle({ agentId: "a1", sceneIds: ["c", "b", "a"] });
    expect(a.sceneIds).toEqual(["a", "b", "c"]);
    expect(a.bundleId).toBe(b.bundleId);
  });

  it("无 team/user/project：只挂 agent 自有 4 空间", () => {
    const bundle = resolveExecutionBundle({ agentId: "a1" });
    expect(bundle.mountedSpaces).toHaveLength(4);
    expect(bundle.mountedSpaces.every((s) => s.ownerType === "agent")).toBe(true);
  });
});