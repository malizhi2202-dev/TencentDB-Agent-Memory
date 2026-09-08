import { describe, it, expect } from "vitest";
import { aggregateConsolidation, emptyConsolidationMetrics } from "./consolidation-metrics.js";
import type { ConsolidationPlan } from "./dreaming.js";

function plan(action: ConsolidationPlan["action"], fromId: string): ConsolidationPlan {
  return { action, fromId, newState: "consolidated", reason: "test" };
}

describe("consolidation-metrics — 巩固健康度监控（P2 监控）", () => {
  it("聚合：plans 计数 + executed/failed + failureRate", () => {
    const metrics = aggregateConsolidation([
      {
        plans: [plan("merge", "b"), plan("archive", "lo")],
        result: { executed: 2, failed: [] },
      },
      {
        plans: [plan("merge", "d")],
        result: { executed: 0, failed: ["d"] },
      },
    ]);
    expect(metrics.totalRuns).toBe(2);
    expect(metrics.totalPlans).toBe(3);
    expect(metrics.totalExecuted).toBe(2);
    expect(metrics.totalFailed).toBe(1);
    expect(metrics.failureRate).toBeCloseTo(1 / 3);
  });

  it("byAction 按计划动作分布", () => {
    const metrics = aggregateConsolidation([
      {
        plans: [plan("merge", "a"), plan("merge", "b"), plan("archive", "c")],
        result: { executed: 3, failed: [] },
      },
    ]);
    expect(metrics.byAction.merge).toBe(2);
    expect(metrics.byAction.archive).toBe(1);
    expect(metrics.byAction.link).toBe(0);
  });

  it("空运行 → 空指标", () => {
    const m = aggregateConsolidation([]);
    expect(m.totalRuns).toBe(0);
    expect(m.failureRate).toBe(0);
  });

  it("空指标初始态", () => {
    const m = emptyConsolidationMetrics();
    expect(m.totalPlans).toBe(0);
    expect(m.byAction.merge).toBe(0);
    expect(m.byAction.keep).toBe(0);
  });
});