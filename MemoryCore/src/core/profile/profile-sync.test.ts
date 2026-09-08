import { describe, it, expect } from "vitest";
import {
  buildProfileIsolationScope,
  parseProfileIsolationScope,
  DEFAULT_PROFILE_SCOPE,
} from "./profile-sync.js";

describe("buildProfileIsolationScope（agent 级 vs member 级）", () => {
  it("agent 级：有 agentId → team+agent 粒度（不变）", () => {
    expect(buildProfileIsolationScope({ teamId: "team-1", agentId: "agt-2" })).toBe(
      "team:team-1|agent:agt-2",
    );
    // 带 userId 也不影响 team+agent 粒度
    expect(
      buildProfileIsolationScope({ teamId: "team-1", userId: "usr-x", agentId: "agt-2" }),
    ).toBe("team:team-1|agent:agt-2");
  });

  it("agent 级缺 teamId 时回落到 userId 顶替 team 维度（旧兼容行为）", () => {
    expect(buildProfileIsolationScope({ userId: "usr-x", agentId: "agt-2" })).toBe(
      "team:usr-x|agent:agt-2",
    );
  });

  it("member 级：无 agentId → user+default 粒度，每个 member 独立", () => {
    expect(buildProfileIsolationScope({ teamId: "team-1", userId: "usr-a" })).toBe(
      "user:usr-a|agent:default",
    );
    expect(buildProfileIsolationScope({ teamId: "team-1", userId: "usr-b" })).toBe(
      "user:usr-b|agent:default",
    );
  });

  it("member 级 scope 彼此不串（修复前都会落到 agent:default）", () => {
    const a = buildProfileIsolationScope({ teamId: "team-1", userId: "usr-a" });
    const b = buildProfileIsolationScope({ teamId: "team-1", userId: "usr-b" });
    expect(a).not.toBe(b);
    expect(a).toContain("usr-a");
    expect(b).toContain("usr-b");
  });

  it("空 ctx → 全局 scope", () => {
    expect(buildProfileIsolationScope(undefined)).toBe(DEFAULT_PROFILE_SCOPE);
  });
});

describe("parseProfileIsolationScope 反向解析", () => {
  it("解析 team scope", () => {
    expect(parseProfileIsolationScope("team:team-1|agent:agt-2")).toEqual({
      teamId: "team-1",
      agentId: "agt-2",
    });
  });

  it("解析 user scope（member 级）", () => {
    expect(parseProfileIsolationScope("user:usr-a|agent:default")).toEqual({
      userId: "usr-a",
      agentId: "default",
    });
  });
});