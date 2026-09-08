import { describe, it, expect } from "vitest";
import {
  spaceIdFor,
  makeMemorySpace,
  mountSpacesForAgent,
  type MemorySpace,
} from "./memory-space.js";

describe("memory-space — 一等资源 + Agent 创建自动挂载（P0.1 阶段 B）", () => {
  it("spaceIdFor 确定性：同一 (ownerType, ownerId, domain) 永远同一 id，不同输入不同 id", () => {
    const a1 = spaceIdFor("team", "t1", "semantic");
    const a2 = spaceIdFor("team", "t1", "semantic");
    expect(a1).toBe(a2);
    expect(a1.startsWith("sp_")).toBe(true);

    // 任一维度不同 → id 不同
    expect(spaceIdFor("team", "t2", "semantic")).not.toBe(a1);
    expect(spaceIdFor("agent", "t1", "semantic")).not.toBe(a1);
    expect(spaceIdFor("team", "t1", "rule")).not.toBe(a1);
  });

  it("makeMemorySpace：writePolicy 缺省由 domain 推导（instruction/rule → explicit_only）", () => {
    const instr = makeMemorySpace("team", "t1", "instruction");
    expect(instr.writePolicy).toBe("explicit_only");
    expect(instr.domain).toBe("instruction");

    const sem = makeMemorySpace("team", "t1", "semantic");
    expect(sem.writePolicy).toBe("automatic");

    // 可显式收紧（automatic → review_required）
    const tightened = makeMemorySpace("team", "t1", "semantic", "review_required");
    expect(tightened.writePolicy).toBe("review_required");
  });

  it("mountSpacesForAgent：完整挂载（agent + team + user + project）", () => {
    const spaces = mountSpacesForAgent("a1", { teamId: "t1", userId: "u1", projectId: "p1" });

    const byOwner = (owner: string) => spaces.filter((s) => s.ownerType === owner);
    // agent 自有 4 域 + team 4 域 + user 2 域 + project 2 域 = 12
    expect(spaces).toHaveLength(12);
    expect(byOwner("agent")).toHaveLength(4);
    expect(byOwner("team")).toHaveLength(4);
    expect(byOwner("user")).toHaveLength(2);
    expect(byOwner("project")).toHaveLength(2);

    // agent 自有空间承载 episodic/semantic/task/artifact
    const agentDomains = byOwner("agent").map((s) => s.domain).sort();
    expect(agentDomains).toEqual(["artifact", "episodic", "semantic", "task"]);

    // team 空间承载 semantic/instruction/rule/procedural（含持久更改域）
    const teamDomains = byOwner("team").map((s) => s.domain).sort();
    expect(teamDomains).toEqual(["instruction", "procedural", "rule", "semantic"]);
  });

  it("mountSpacesForAgent：无 team/user/project 时只挂 agent 自有 4 域", () => {
    const spaces = mountSpacesForAgent("a1");
    expect(spaces).toHaveLength(4);
    expect(spaces.every((s) => s.ownerType === "agent" && s.ownerId === "a1")).toBe(true);
  });

  it("挂载列表 spaceId 全局唯一（同一 agent 下不出现重复空间）", () => {
    const spaces = mountSpacesForAgent("a1", { teamId: "t1", userId: "u1", projectId: "p1" });
    const ids = new Set(spaces.map((s) => s.spaceId));
    expect(ids.size).toBe(spaces.length);
  });

  it("instruction/rule 空间默认 explicit_only，其余默认 automatic（持久 vs 总结分界贯穿空间层）", () => {
    const spaces = mountSpacesForAgent("a1", { teamId: "t1", userId: "u1" });
    const explicitDomains = spaces.filter((s) => s.writePolicy === "explicit_only").map((s) => s.domain).sort();
    expect(explicitDomains).toEqual(["instruction", "rule"]);
  });
});