import { describe, it, expect } from "vitest";
import { runDreamingConsolidation, type DreamingMemory } from "./dreaming.js";

function mem(partial: Partial<DreamingMemory> & { id: string; content: string }): DreamingMemory {
  return { type: "work_fact", domain: "semantic", writePolicy: "automatic", priority: 50, ...partial };
}

describe("dreaming — 离线巩固编排（P1.2）", () => {
  it("duplicate 两条 → 1 条 merge（后者并入前者）", () => {
    const plans = runDreamingConsolidation([
      mem({ id: "a", content: "数据库连接串在 .env" }),
      mem({ id: "b", content: "数据库连接串在 .env" }),
    ]);
    expect(plans).toHaveLength(1);
    expect(plans[0].action).toBe("merge");
    expect(plans[0].fromId).toBe("b");
    expect(plans[0].toId).toBe("a");
    expect(plans[0].newState).toBe("consolidated");
  });

  it("守卫：explicit_only 参与 duplicate → 不 merge", () => {
    const plans = runDreamingConsolidation([
      mem({ id: "a", content: "数据库连接串在 .env", writePolicy: "explicit_only" }),
      mem({ id: "b", content: "数据库连接串在 .env" }),
    ]);
    expect(plans).toHaveLength(0);
  });

  it("low_value → archive；explicit_only 低价值不归档", () => {
    const arch = runDreamingConsolidation([
      mem({ id: "a", content: "很短", priority: 10 }),
    ]);
    expect(arch).toHaveLength(1);
    expect(arch[0].action).toBe("archive");

    const keep = runDreamingConsolidation([
      mem({ id: "a", content: "很短", priority: 10, writePolicy: "explicit_only" }),
    ]);
    expect(keep).toHaveLength(0);
  });

  it("跨 domain 不比较（semantic vs instruction 不 merge）", () => {
    const plans = runDreamingConsolidation([
      mem({ id: "a", content: "数据库连接串", domain: "semantic" }),
      mem({ id: "b", content: "数据库连接串", domain: "instruction" }),
    ]);
    expect(plans).toHaveLength(0);
  });

  it("3 条重复链 → 2 条 merge（b→a, c→a，不重复巩固）", () => {
    const plans = runDreamingConsolidation([
      mem({ id: "a", content: "数据库连接串在 .env" }),
      mem({ id: "b", content: "数据库连接串在 .env" }),
      mem({ id: "c", content: "数据库连接串在 .env" }),
    ]);
    expect(plans).toHaveLength(2);
    expect(new Set(plans.map((p) => p.fromId))).toEqual(new Set(["b", "c"]));
    expect(plans.every((p) => p.toId === "a")).toBe(true);
  });

  it("无重复、非低价值 → 空计划", () => {
    const plans = runDreamingConsolidation([
      mem({ id: "a", content: "数据库连接配置信息说明" }),
      mem({ id: "b", content: "部署脚本使用说明文档" }),
    ]);
    expect(plans).toHaveLength(0);
  });
});