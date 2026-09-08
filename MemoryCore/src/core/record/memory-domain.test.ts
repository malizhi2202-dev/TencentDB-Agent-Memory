import { describe, it, expect } from "vitest";
import {
  MEMORY_DOMAINS,
  MEMORY_DOMAIN_PROFILE,
  defaultDomainForType,
  defaultPolicyForDomain,
  canOverwrite,
  resolveWritePolicy,
  isMemoryDomain,
  isRecallableDomain,
} from "./memory-domain.js";

describe("memory-domain — Brain 域 + 写入策略（P0.1 阶段 A）", () => {
  it("12 域 profile 表完整：每域都有 lifecycle/defaultPolicy/recallWeight/defaultRecall", () => {
    expect(MEMORY_DOMAINS).toHaveLength(12);
    for (const domain of MEMORY_DOMAINS) {
      const p = MEMORY_DOMAIN_PROFILE[domain];
      expect(p, `domain=${domain}`).toBeDefined();
      expect(["short", "medium", "long"]).toContain(p.lifecycle);
      expect(["automatic", "review_required", "explicit_only", "deny"]).toContain(p.defaultPolicy);
      expect(typeof p.recallWeight).toBe("number");
      expect(p.recallWeight).toBeGreaterThan(0);
      expect(typeof p.defaultRecall).toBe("boolean");
    }
  });

  it("archive 默认不召回，其余默认召回", () => {
    expect(MEMORY_DOMAIN_PROFILE.archive.defaultRecall).toBe(false);
    for (const domain of MEMORY_DOMAINS) {
      if (domain !== "archive") {
        expect(MEMORY_DOMAIN_PROFILE[domain].defaultRecall).toBe(true);
      }
    }
  });

  it("type → domain 推导：7 类 MemoryType 映射到正确 Brain 域", () => {
    const cases: Array<[string, string]> = [
      ["persona", "persona"],
      ["episodic", "episodic"],
      ["instruction", "instruction"],
      ["work_fact", "semantic"],
      ["work_task", "task"],
      ["work_method", "procedural"],
      ["work_artifact", "artifact"],
    ];
    for (const [type, expected] of cases) {
      expect(defaultDomainForType(type), `type=${type}`).toBe(expected);
    }
    // 未知 type 兜底 episodic（向后兼容）
    expect(defaultDomainForType("unknown_type")).toBe("episodic");
  });

  it("write_policy 推导：持久更改（instruction/rule）→ explicit_only，其余 → automatic", () => {
    expect(defaultPolicyForDomain("instruction")).toBe("explicit_only");
    expect(defaultPolicyForDomain("rule")).toBe("explicit_only");
    for (const domain of MEMORY_DOMAINS) {
      if (domain !== "instruction" && domain !== "rule") {
        expect(defaultPolicyForDomain(domain), `domain=${domain}`).toBe("automatic");
      }
    }
  });

  it("覆盖守卫：系统总结（automatic）不可覆盖用户显式持久更改（explicit_only）", () => {
    // 铁律方向
    expect(canOverwrite("explicit_only", "automatic")).toBe(false);
    expect(canOverwrite("review_required", "automatic")).toBe(false);
    // 用户显式可覆盖总结
    expect(canOverwrite("automatic", "explicit_only")).toBe(true);
    expect(canOverwrite("automatic", "review_required")).toBe(true);
    // 同级可覆盖
    expect(canOverwrite("automatic", "automatic")).toBe(true);
    expect(canOverwrite("explicit_only", "explicit_only")).toBe(true);
    // deny 永不覆盖、也永不被覆盖
    expect(canOverwrite("deny", "explicit_only")).toBe(false);
    expect(canOverwrite("explicit_only", "deny")).toBe(false);
  });

  it("resolveWritePolicy：只能收紧，不能放宽", () => {
    // 不传 → 用默认
    expect(resolveWritePolicy("automatic")).toEqual({ ok: true, policy: "automatic" });
    // 收紧：automatic → review_required / explicit_only 允许
    expect(resolveWritePolicy("automatic", "review_required")).toEqual({ ok: true, policy: "review_required" });
    expect(resolveWritePolicy("automatic", "explicit_only")).toEqual({ ok: true, policy: "explicit_only" });
    // 放宽：explicit_only → automatic 拒绝
    const loosened = resolveWritePolicy("explicit_only", "automatic");
    expect(loosened.ok).toBe(false);
    // deny 直接拒绝写入
    const denied = resolveWritePolicy("automatic", "deny");
    expect(denied.ok).toBe(false);
  });

  it("isMemoryDomain 校验", () => {
    expect(isMemoryDomain("semantic")).toBe(true);
    expect(isMemoryDomain("not_a_domain")).toBe(false);
    expect(isMemoryDomain(42)).toBe(false);
    expect(isMemoryDomain(undefined)).toBe(false);
  });

  it("isRecallableDomain：archive 默认不召回，其余域召回，未知域向后兼容召回", () => {
    expect(isRecallableDomain("archive")).toBe(false);
    expect(isRecallableDomain("semantic")).toBe(true);
    expect(isRecallableDomain("instruction")).toBe(true);
    expect(isRecallableDomain("unknown_domain")).toBe(true); // 未知域默认召回
    expect(isRecallableDomain("")).toBe(true); // 空域 = 旧数据未设置 → 召回
  });
});