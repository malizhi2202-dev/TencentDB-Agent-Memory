import { describe, it, expect } from "vitest";
import {
  decideLifecycleAction,
  detectRelationByOverlap,
  isLowValue,
  initialState,
  canConsolidate,
} from "./memory-lifecycle.js";

describe("memory-lifecycle — 记忆闭环状态机 + 关系检测（P1.2）", () => {
  it("duplicate/near_duplicate → merge → consolidated", () => {
    const d1 = decideLifecycleAction("active", "duplicate");
    expect(d1.action).toBe("merge");
    expect(d1.newState).toBe("consolidated");

    const d2 = decideLifecycleAction("active", "near_duplicate");
    expect(d2.action).toBe("merge");
    expect(d2.newState).toBe("consolidated");
  });

  it("守卫：current 或 target 是 explicit_only → 合并被阻止（keep）", () => {
    const d1 = decideLifecycleAction("active", "duplicate", { writePolicy: "explicit_only" });
    expect(d1.action).toBe("keep");
    expect(d1.newState).toBe("active"); // 状态不变

    const d2 = decideLifecycleAction("active", "near_duplicate", {
      writePolicy: "automatic",
      targetWritePolicy: "explicit_only",
    });
    expect(d2.action).toBe("keep");
  });

  it("conflict → update（保留两条待裁决，不自动合并/删除）", () => {
    const d = decideLifecycleAction("active", "conflict");
    expect(d.action).toBe("update");
    expect(d.newState).toBe("active");
  });

  it("low_value → archive → archived；但 explicit_only 不可归档", () => {
    const d1 = decideLifecycleAction("active", "low_value");
    expect(d1.action).toBe("archive");
    expect(d1.newState).toBe("archived");

    const d2 = decideLifecycleAction("active", "low_value", { writePolicy: "explicit_only" });
    expect(d2.action).toBe("keep");
    expect(d2.newState).toBe("active");
  });

  it("complementary → link（建边不合并）；ambiguous/other → keep", () => {
    expect(decideLifecycleAction("active", "complementary").action).toBe("link");
    expect(decideLifecycleAction("active", "ambiguous").action).toBe("keep");
    expect(decideLifecycleAction("active", "other").action).toBe("keep");
  });

  it("detectRelationByOverlap：Jaccard ≥0.9 duplicate，≥0.6 near_duplicate", () => {
    expect(detectRelationByOverlap("数据库连接串在 .env", "数据库连接串在 .env")).toBe("duplicate");
    expect(detectRelationByOverlap("数据库连接串在 .env", "数据库连接串在 .env 文件")).toBe("near_duplicate");
    expect(detectRelationByOverlap("数据库连接", "部署脚本用 CI 流水线")).toBe("other");
  });

  it("isLowValue：过短且低 priority 才判定低价值", () => {
    expect(isLowValue("很短", 10)).toBe(true); // 2 字 + priority 10
    expect(isLowValue("这是一段足够长的记忆内容描述", 10)).toBe(false);
    expect(isLowValue("很短", 50)).toBe(false); // priority 高不动
  });

  it("canConsolidate 守卫：explicit_only 不可被 duplicate 合并", () => {
    expect(canConsolidate("duplicate", { writePolicy: "automatic" })).toBe(true);
    expect(canConsolidate("duplicate", { writePolicy: "explicit_only" })).toBe(false);
    expect(canConsolidate("low_value", { writePolicy: "automatic" })).toBe(true);
    expect(canConsolidate("low_value", { writePolicy: "explicit_only" })).toBe(false);
  });

  it("initialState：新记忆出生即 active", () => {
    expect(initialState()).toBe("active");
  });
});