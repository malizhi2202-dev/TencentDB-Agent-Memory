import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VectorStore } from "../store/sqlite.js";
import { writeMemory, type ExtractedMemory, type DedupDecision, type MemoryType } from "./l1-writer.js";

function makeMemory(type: MemoryType, content: string): ExtractedMemory {
  return { content, type, priority: 50, source_message_ids: [], metadata: {}, scene_name: "" };
}

function makeDecision(record_id: string, action: DedupDecision["action"], target_ids: string[] = []): DedupDecision {
  return { record_id, action, target_ids };
}

describe("l1-writer — domain/write_policy 持久化 + 覆盖守卫（P0.1 阶段 A2）", () => {
  let store: VectorStore;
  let baseDir: string;

  beforeEach(async () => {
    store = new VectorStore(":memory:", 0);
    store.init();
    baseDir = await mkdtemp(join(tmpdir(), "l1-writer-domain-"));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("写入时推导 domain + write_policy，并持久化到 store（queryL1Records 可读回）", async () => {
    const rec = await writeMemory({
      memory: makeMemory("work_fact", "PostgreSQL 连接串在 .env 里"),
      decision: makeDecision("m_fact_1", "store"),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });
    expect(rec).not.toBeNull();
    expect(rec!.domain).toBe("semantic"); // work_fact → semantic
    expect(rec!.write_policy).toBe("automatic");

    const rows = store.queryL1Records({ recordIds: ["m_fact_1"] });
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("semantic");
    expect(rows[0].write_policy).toBe("automatic");
  });

  it("instruction 推导为 explicit_only（用户显式持久更改）", async () => {
    const rec = await writeMemory({
      memory: makeMemory("instruction", "所有 SQL 必须走 prepared statement"),
      decision: makeDecision("m_instr_1", "store"),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });
    expect(rec!.domain).toBe("instruction");
    expect(rec!.write_policy).toBe("explicit_only");
  });

  it("守卫：系统总结（automatic）不可覆盖用户显式持久更改（explicit_only）", async () => {
    // 1. 先写一条 instruction（explicit_only）
    await writeMemory({
      memory: makeMemory("instruction", "生产库只读，禁止写"),
      decision: makeDecision("m_instr_1", "store"),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });

    // 2. 尝试用 work_fact 总结（automatic）覆盖它 → 应被守卫拒绝
    const overwrite = await writeMemory({
      memory: makeMemory("work_fact", "生产库可以写"),
      decision: makeDecision("m_fact_1", "update", ["m_instr_1"]),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });
    expect(overwrite).toBeNull();
  });

  it("守卫：用户显式（explicit_only）可覆盖系统总结（automatic）", async () => {
    await writeMemory({
      memory: makeMemory("work_fact", "部署脚本用 deploy.sh"),
      decision: makeDecision("m_fact_1", "store"),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });

    const overwrite = await writeMemory({
      memory: makeMemory("instruction", "部署必须走 CI 流水线，禁止手动 deploy.sh"),
      decision: makeDecision("m_instr_1", "update", ["m_fact_1"]),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });
    expect(overwrite).not.toBeNull();
    expect(overwrite!.write_policy).toBe("explicit_only");
  });

  it("recordIds 过滤修复：queryL1Records 精确返回指定记录（不再忽略 recordIds）", async () => {
    await writeMemory({
      memory: makeMemory("work_fact", "记录 A"),
      decision: makeDecision("m_a", "store"),
      baseDir,
      sessionKey: "s",
      vectorStore: store,
    });
    await writeMemory({
      memory: makeMemory("work_fact", "记录 B"),
      decision: makeDecision("m_b", "store"),
      baseDir,
      sessionKey: "s",
      vectorStore: store,
    });

    const rows = store.queryL1Records({ recordIds: ["m_a"] });
    expect(rows).toHaveLength(1);
    expect(rows[0].record_id).toBe("m_a");
  });

  it("spaceId 落库：writeMemory 传入 spaceId 后 queryL1Records 读回 space_id", async () => {
    const rec = await writeMemory({
      memory: makeMemory("instruction", "所有改动必须评审"),
      decision: makeDecision("m_instr_1", "store"),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
      spaceId: "sp_team_t1_rule",
    });
    expect(rec).not.toBeNull();
    expect(rec!.spaceId).toBe("sp_team_t1_rule");

    const rows = store.queryL1Records({ recordIds: ["m_instr_1"] });
    expect(rows).toHaveLength(1);
    expect(rows[0].space_id).toBe("sp_team_t1_rule");
  });

  it("脱敏接线（P2）：写入前 content 脱敏，敏感信息不落库", async () => {
    const rec = await writeMemory({
      memory: makeMemory("work_fact", "生产库密码 password=mySecret123 和邮箱 admin@corp.com"),
      decision: makeDecision("m_redact_1", "store"),
      baseDir,
      sessionKey: "sess-1",
      vectorStore: store,
    });
    expect(rec).not.toBeNull();
    expect(rec!.content).not.toContain("mySecret123");
    expect(rec!.content).not.toContain("admin@corp.com");
    expect(rec!.content).toContain("password=<REDACTED>");
    expect(rec!.content).toContain("<EMAIL>");

    const rows = store.queryL1Records({ recordIds: ["m_redact_1"] });
    expect(rows[0].content).not.toContain("mySecret123");
  });
});