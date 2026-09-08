import { describe, expect, it } from "vitest";
import { renderTdaiMemoryToolsBlock } from "../injection/injectors/tdai-tools-injector.js";

const BASE = "http://127.0.0.1:8096";

describe("renderTdaiMemoryToolsBlock", () => {
  const full = renderTdaiMemoryToolsBlock(BASE, "s1", "default");
  const mirror = renderTdaiMemoryToolsBlock(BASE, "s1", "default", { mirrorManaged: true });

  it("full guide includes L1 tools (search/query), L0 and L2 tools", () => {
    expect(full).toContain("tdai_memory_search");
    expect(full).toContain("tdai_atomic_query");
    expect(full).toContain("tdai_conversation_search");
    expect(full).toContain("tdai_conversation_query");
    expect(full).toContain("tdai_scenario_ls");
    expect(full).toContain("tdai_read_scene");
  });

  it("full guide keeps the anti-local-MEMORY.md directive", () => {
    expect(full).toContain("不要只查本地 MEMORY.md");
  });

  it("mirror guide drops L1 tools and the anti-local directive", () => {
    expect(mirror).not.toContain("tdai_memory_search");
    expect(mirror).not.toContain("tdai_atomic_query");
    expect(mirror).not.toContain("不要只查本地 MEMORY.md");
  });

  it("mirror guide keeps L0/L2 tools (the parts the mirror does not cover)", () => {
    expect(mirror).toContain("tdai_conversation_search");
    expect(mirror).toContain("tdai_conversation_query");
    expect(mirror).toContain("tdai_scenario_ls");
    expect(mirror).toContain("tdai_read_scene");
  });

  it("mirror guide explains L1 is mirrored locally", () => {
    expect(mirror).toContain("已镜像进本地 MEMORY.md 索引");
  });

  it("mirror guide caps only conversation_search; full guide caps search+atomic", () => {
    expect(mirror).toContain("conversation_search **合计 ≤ 3 次**");
    expect(mirror).not.toContain("atomic_search + conversation_search **合计 ≤ 3 次**");
    expect(full).toContain("atomic_search + conversation_search **合计 ≤ 3 次**");
  });
});
