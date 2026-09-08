import { describe, it, expect } from "vitest";
import {
  retentionPriority,
  recencyDecay,
  estimateTokens,
  tokenJaccard,
  queryOverlapScore,
  selectRetention,
  type RetentionCandidate,
} from "./retention.js";

function cand(
  id: string,
  content: string,
  relevance: number,
  tokens = 10,
  extra: Partial<RetentionCandidate> = {},
): RetentionCandidate {
  return { id, content, relevance, queryOverlap: 0.5, recency: 0.8, costRatio: 0.1, tokens, ...extra };
}

describe("retention — 召回保留层（P0.2）", () => {
  it("retentionPriority：0.50*relevance + 0.25*overlap + 0.15*recency − 0.10*cost", () => {
    const c = { id: "x", content: "", relevance: 1, queryOverlap: 1, recency: 1, costRatio: 0, tokens: 0 };
    expect(retentionPriority(c)).toBeCloseTo(0.90, 6);

    const zero = { ...c, relevance: 0, queryOverlap: 0, recency: 0, costRatio: 1 };
    expect(retentionPriority(zero)).toBeCloseTo(-0.10, 6);

    const mid = { ...c, relevance: 0.8, queryOverlap: 0.4, recency: 0.5, costRatio: 0.2 };
    // 0.50*0.8 + 0.25*0.4 + 0.15*0.5 - 0.10*0.2 = 0.40 + 0.10 + 0.075 - 0.02 = 0.555
    expect(retentionPriority(mid)).toBeCloseTo(0.555, 6);
  });

  it("recencyDecay：30 天半衰期（age=0→1, age=30→0.5, age=60→0.25）", () => {
    expect(recencyDecay(0)).toBeCloseTo(1, 6);
    expect(recencyDecay(30)).toBeCloseTo(0.5, 6);
    expect(recencyDecay(60)).toBeCloseTo(0.25, 6);
    // 自定义半衰期
    expect(recencyDecay(10, 10)).toBeCloseTo(0.5, 6);
  });

  it("estimateTokens：CJK ≈ 1 token/1.5 chars；非 CJK 每词 max(1, ceil(chars/8))", () => {
    expect(estimateTokens("你好")).toBe(2); // ceil(2/1.5)=2
    expect(estimateTokens("你好世界")).toBe(3); // ceil(4/1.5)=3
    expect(estimateTokens("hello world")).toBe(2); // 2 词 × 1
    expect(estimateTokens("supercalifragilistic")).toBe(3); // ceil(22/8)=3
    expect(estimateTokens("")).toBe(1); // 下限 1
  });

  it("queryOverlapScore / tokenJaccard：重叠度计算", () => {
    expect(queryOverlapScore("数据库 连接", "数据库连接串在 .env")).toBeGreaterThan(0);
    expect(queryOverlapScore("完全不相关", "数据库连接")).toBe(0);
    expect(queryOverlapScore("", "内容")).toBe(0);

    const jac = tokenJaccard("数据库连接在 .env", "数据库连接在 .env 文件里");
    expect(jac).toBeGreaterThan(0.5);
    expect(tokenJaccard("数据库", "部署脚本")).toBe(0);
  });

  it("selectRetention：topM 保底（priority 最高的 topM 强制保留）", () => {
    const candidates = [
      cand("a", "低相关性 A", 0.2),
      cand("b", "高相关性 B", 0.9),
      cand("c", "中相关性 C", 0.5),
      cand("d", "次高 D", 0.85),
    ];
    const { selected } = selectRetention(candidates, { tokenBudget: 1000, topM: 2 });
    const ids = selected.map((c) => c.id);
    // topM=2 → priority 最高的 b(0.9) 和 d(0.85) 强制保留
    expect(ids).toContain("b");
    expect(ids).toContain("d");
  });

  it("selectRetention：token 预算约束（预算只够 N 个就只选 N 个）", () => {
    const candidates = [
      cand("a", "内容 A 比较长", 0.9, 50),
      cand("b", "内容 B", 0.8, 50),
      cand("c", "内容 C", 0.7, 50),
      cand("d", "内容 D", 0.6, 50),
    ];
    const { selected, totalTokens } = selectRetention(candidates, { tokenBudget: 120, topM: 1 });
    expect(selected.length).toBe(2); // 50+50 <= 120，第三个 50 会超 150>120
    expect(totalTokens).toBe(100);
  });

  it("selectRetention：MMR 去冗余（高相关但重复的内容不被同时选中）", () => {
    const candidates = [
      cand("A", "数据库连接串在 .env", 0.9),
      cand("B", "数据库连接串在 .env 文件里", 0.85), // 与 A 高 Jaccard
      cand("C", "部署脚本用 CI 流水线", 0.5),        // 与 A 无重叠（diverse）
    ];
    const { selected } = selectRetention(candidates, { tokenBudget: 25, topM: 1 });
    const ids = selected.map((c) => c.id);
    // topM=1 强制保留 A；MMR 在 B（重复）与 C（diverse）间选 C
    expect(ids).toContain("A");
    expect(ids).toContain("C");
    expect(ids).not.toContain("B");
  });

  it("selectRetention：空预算 / 空候选返回空", () => {
    expect(selectRetention([], { tokenBudget: 100 }).selected).toEqual([]);
    expect(selectRetention([cand("a", "x", 0.9)], { tokenBudget: 0 }).selected).toEqual([]);
  });
});