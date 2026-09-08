import { describe, it, expect } from "vitest";
import { evaluateRetrieval, passesThreshold, type EvalItem } from "./retrieval-evaluator.js";

describe("retrieval-evaluator — 召回评测指标（P2 评测）", () => {
  it("完美检索 → recall/precision/MRR/NDCG 全 1", () => {
    const items: EvalItem[] = [
      { query: "q1", relevantIds: ["a", "b", "c"], retrievedIds: ["a", "b", "c", "d", "e"] },
    ];
    const m = evaluateRetrieval(items, 5);
    expect(m.recallAtK).toBe(1);
    expect(m.precisionAtK).toBe(3 / 5);
    expect(m.mrr).toBe(1); // 首个相关在 rank 1
    expect(m.ndcgAtK).toBeCloseTo(1);
  });

  it("首个相关在 rank 2 → MRR = 0.5", () => {
    const items: EvalItem[] = [
      { query: "q1", relevantIds: ["a"], retrievedIds: ["x", "a", "y"] },
    ];
    const m = evaluateRetrieval(items, 3);
    expect(m.mrr).toBe(0.5);
  });

  it("完全未命中 → recall/precision/MRR 全 0", () => {
    const items: EvalItem[] = [
      { query: "q1", relevantIds: ["a"], retrievedIds: ["x", "y", "z"] },
    ];
    const m = evaluateRetrieval(items, 3);
    expect(m.recallAtK).toBe(0);
    expect(m.precisionAtK).toBe(0);
    expect(m.mrr).toBe(0);
  });

  it("多条目聚合取均值", () => {
    const items: EvalItem[] = [
      { query: "q1", relevantIds: ["a"], retrievedIds: ["a"] },   // 完美
      { query: "q2", relevantIds: ["b"], retrievedIds: ["x"] },   // 全空
    ];
    const m = evaluateRetrieval(items, 1);
    expect(m.recallAtK).toBe(0.5);
    expect(m.mrr).toBe(0.5);
    expect(m.itemCount).toBe(2);
  });

  it("NDCG 惩罚靠后的命中：rank1 命中 > rank2 命中", () => {
    const early: EvalItem[] = [{ query: "q", relevantIds: ["a"], retrievedIds: ["a", "x"] }];
    const late: EvalItem[] = [{ query: "q", relevantIds: ["a"], retrievedIds: ["x", "a"] }];
    expect(evaluateRetrieval(early, 2).ndcgAtK).toBeGreaterThan(evaluateRetrieval(late, 2).ndcgAtK);
  });

  it("空评测集 → 全 0 安全返回", () => {
    const m = evaluateRetrieval([], 5);
    expect(m.recallAtK).toBe(0);
    expect(m.itemCount).toBe(0);
  });

  it("passesThreshold：CI 回归门槛", () => {
    const good = { recallAtK: 0.8, mrr: 0.7, ndcgAtK: 0.6, precisionAtK: 0.5, k: 5, itemCount: 1 };
    expect(passesThreshold(good, { recallAtK: 0.5, mrr: 0.5 })).toBe(true);
    expect(passesThreshold(good, { recallAtK: 0.9 })).toBe(false);
  });
});