import { describe, it, expect, vi } from "vitest";
import { executeConsolidation, rowToMemoryRecord } from "./consolidation-executor.js";
import { runDreamingConsolidation } from "./dreaming.js";
import type { IMemoryStore, L1RecordRow } from "../store/types.js";

function makeRow(overrides: Partial<L1RecordRow> = {}): L1RecordRow {
  return {
    record_id: "m1",
    content: "数据库连接串在 .env",
    type: "work_fact",
    priority: 50,
    scene_name: "",
    session_key: "sess-1",
    session_id: "sess-1",
    team_id: "team-1",
    task_id: "",
    user_id: "user-a",
    agent_id: "agent-1",
    version: 1,
    timestamp_str: "2025-01-01T00:00:00.000Z",
    timestamp_start: "",
    timestamp_end: "",
    created_time: "2025-01-01T00:00:00.000Z",
    updated_time: "2025-01-01T00:00:00.000Z",
    metadata_json: "{}",
    domain: "semantic",
    write_policy: "automatic",
    space_id: "sp_abc",
    ...overrides,
  };
}

function makeStore(overrides: Partial<IMemoryStore> = {}) {
  return {
    deleteL1: vi.fn(async () => true),
    queryL1Records: vi.fn(async () => []),
    upsertL1: vi.fn(() => true),
    ...overrides,
  } as unknown as IMemoryStore;
}

describe("consolidation-executor — 巩固计划执行（P1.2 接线）", () => {
  it("merge → store.deleteL1(fromId, filter)", async () => {
    const store = makeStore();
    const plans = runDreamingConsolidation([
      { id: "a", content: "数据库连接串在 .env", type: "work_fact", domain: "semantic", writePolicy: "automatic", priority: 50 },
      { id: "b", content: "数据库连接串在 .env", type: "work_fact", domain: "semantic", writePolicy: "automatic", priority: 50 },
    ]);
    const result = await executeConsolidation(store, plans, { teamId: "team-1" });
    expect(result.executed).toBe(1);
    expect(result.failed).toEqual([]);
    expect(store.deleteL1).toHaveBeenCalledWith("b", { teamId: "team-1" });
  });

  it("archive → 改 domain=archive（软归档，不删除）", async () => {
    const row = makeRow({ record_id: "lo", content: "很短", priority: 10 });
    const store = makeStore({ queryL1Records: vi.fn(async () => [row]) });
    const plans = runDreamingConsolidation([
      { id: "lo", content: "很短", type: "work_fact", domain: "semantic", writePolicy: "automatic", priority: 10 },
    ]);
    const result = await executeConsolidation(store, plans);
    expect(result.executed).toBe(1);
    expect(store.deleteL1).not.toHaveBeenCalled();
    const upserted = (store.upsertL1 as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upserted.domain).toBe("archive");
    expect(upserted.id).toBe("lo");
  });

  it("archive 目标不存在 → 记入 failed，不影响其它 plan", async () => {
    const store = makeStore({ queryL1Records: vi.fn(async () => []) });
    const plans = runDreamingConsolidation([
      { id: "missing", content: "很短", type: "work_fact", domain: "semantic", writePolicy: "automatic", priority: 10 },
    ]);
    const result = await executeConsolidation(store, plans);
    expect(result.executed).toBe(0);
    expect(result.failed).toEqual(["missing"]);
  });

  it("rowToMemoryRecord：flat 结构 → MemoryRecord（含 domain/write_policy/space_id）", () => {
    const record = rowToMemoryRecord(makeRow());
    expect(record.id).toBe("m1");
    expect(record.domain).toBe("semantic");
    expect(record.write_policy).toBe("automatic");
    expect(record.spaceId).toBe("sp_abc");
    expect(record.type).toBe("work_fact");
  });

  it("rowToMemoryRecord：metadata_json 损坏 → 空 metadata 不抛", () => {
    const record = rowToMemoryRecord(makeRow({ metadata_json: "{bad json" }));
    expect(record.metadata).toEqual({});
  });
});