import { describe, it, expect } from "vitest";
import { transitionQuality, qualityRecallable, qualityWritable, isTerminal, initialQuality } from "./memory-quality.js";

describe("memory-quality — 质量状态机 8 态（§4.3）", () => {
  it("候选链路：candidate → verified → active", () => {
    expect(transitionQuality("candidate", "verify")).toMatchObject({ allowed: true, next: "verified" });
    expect(transitionQuality("verified", "activate")).toMatchObject({ allowed: true, next: "active" });
  });

  it("candidate 可直接 activate（容错），或 delete", () => {
    expect(transitionQuality("candidate", "activate").next).toBe("active");
    expect(transitionQuality("candidate", "delete").next).toBe("deleted");
  });

  it("active 出边：mark_stale / dispute / supersede / archive / delete", () => {
    expect(transitionQuality("active", "mark_stale").next).toBe("stale");
    expect(transitionQuality("active", "dispute").next).toBe("disputed");
    expect(transitionQuality("active", "supersede").next).toBe("superseded");
    expect(transitionQuality("active", "archive").next).toBe("archived");
  });

  it("stale/disputed 可 revalidate 回 active，也可 archive/delete", () => {
    expect(transitionQuality("stale", "revalidate").next).toBe("active");
    expect(transitionQuality("disputed", "revalidate").next).toBe("active");
    expect(transitionQuality("stale", "archive").next).toBe("archived");
  });

  it("archived 可 revalidate 恢复，或 delete 终态", () => {
    expect(transitionQuality("archived", "revalidate").next).toBe("active");
    expect(transitionQuality("archived", "delete").next).toBe("deleted");
  });

  it("非法转换被拒绝（返回原状态 + allowed=false）", () => {
    const r = transitionQuality("deleted", "activate");
    expect(r.allowed).toBe(false);
    expect(r.next).toBe("deleted");

    const r2 = transitionQuality("verified", "archive"); // verified 不能直接 archive
    expect(r2.allowed).toBe(false);
  });

  it("qualityRecallable：archived/superseded/deleted 不召回，其余召回", () => {
    expect(qualityRecallable("active")).toBe(true);
    expect(qualityRecallable("candidate")).toBe(true);
    expect(qualityRecallable("archived")).toBe(false);
    expect(qualityRecallable("superseded")).toBe(false);
    expect(qualityRecallable("deleted")).toBe(false);
  });

  it("qualityWritable：deleted/superseded 不可写", () => {
    expect(qualityWritable("active")).toBe(true);
    expect(qualityWritable("deleted")).toBe(false);
    expect(qualityWritable("superseded")).toBe(false);
  });

  it("isTerminal：deleted 是终态；initialQuality = candidate", () => {
    expect(isTerminal("deleted")).toBe(true);
    expect(isTerminal("archived")).toBe(false);
    expect(initialQuality()).toBe("candidate");
  });
});