import { describe, it, expect } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleV3MemoryRoute, V3_MEMORY_PREFIX } from "./v3-memory-router.js";
import type { IMemoryStore, IsolationFilter } from "../core/store/types.js";
import type { MetadataService } from "../metadata/service/metadata-service.js";

type Sent = { status: number; body: { code: number; data?: unknown; message?: string } };

function call(
  pathname: string,
  body: unknown,
  deps: {
    getStore?: () => IMemoryStore | undefined;
    getMetadataService?: (id: string) => MetadataService | undefined;
  } = {},
): Promise<{ handled: boolean; sent: Sent; body: unknown }> {
  return new Promise((resolve) => {
    let sent: Sent = { status: 0, body: { code: -1 } };
    const req = {
      headers: { "x-request-id": "req-1", "x-tdai-service-id": "inst-1" },
    } as unknown as IncomingMessage;
    const res = {} as ServerResponse;
    const parseJsonBody = async () => body;
    const sendJson = (_r: ServerResponse, status: number, b: { code: number; data?: unknown; message?: string }) => {
      sent = { status, body: b };
      resolve({ handled: true, sent, body: b.data });
    };
    void handleV3MemoryRoute(
      req,
      res,
      pathname,
      "POST",
      parseJsonBody,
      sendJson,
      {
        getStore: deps.getStore,
        getMetadataService: deps.getMetadataService,
        logger: console,
      },
    ).then((handled) => {
      if (!handled) resolve({ handled, sent, body: undefined });
    });
  });
}

function okData(path: string, body: unknown, deps?: Parameters<typeof call>[2]) {
  return call(path, body, deps);
}

const P = V3_MEMORY_PREFIX;

describe("v3-memory-router 纯计算端点", () => {
  it("feedback/detect：识别中文纠正信号", async () => {
    const { sent, body } = await okData(`${P}/feedback/detect`, { text: "不对，应该是 8080 端口" });
    expect(sent.status).toBe(200);
    expect(body).toMatchObject({ detected: true, signal: "correction", source: "user_explicit" });
  });

  it("feedback/detect：无信号 → detected=false", async () => {
    const { body } = await okData(`${P}/feedback/detect`, { text: "今天天气不错" });
    expect(body).toMatchObject({ detected: false });
  });

  it("feedback/decide：correction + explicit_only → update", async () => {
    const { body } = await okData(`${P}/feedback/decide`, { signal: "correction", source: "user_explicit", writePolicy: "explicit_only" });
    expect(body).toMatchObject({ action: "update" });
  });

  it("feedback/decide：disregard + explicit_only → keep（持久守卫）", async () => {
    const { body } = await okData(`${P}/feedback/decide`, { signal: "disregard", source: "system_implicit", writePolicy: "explicit_only" });
    expect(body).toMatchObject({ action: "keep" });
  });

  it("review/gate：review_required + member → hold", async () => {
    const { body } = await okData(`${P}/review/gate`, { policy: "review_required", role: "member" });
    expect(body).toMatchObject({ decision: "hold", canApprove: false });
  });

  it("review/approve-or-reject：owner approve explicit_only → commit", async () => {
    const { body } = await okData(`${P}/review/approve-or-reject`, { policy: "explicit_only", role: "owner", action: "approve" });
    expect(body).toMatchObject({ decision: "commit" });
  });

  it("approval/needs：smart + risky → require_confirmation", async () => {
    const { body } = await okData(`${P}/approval/needs`, { level: "smart", risk: "risky" });
    expect(body).toMatchObject({ decision: "require_confirmation" });
  });

  it("approval/authorize-decision：model 不能自批", async () => {
    const { body } = await okData(`${P}/approval/authorize-decision`, { requester: "model" });
    expect(body).toMatchObject({ authorized: false });
  });

  it("playbook/synthesize：完整 task+method+artifact → reusable", async () => {
    const { body } = await okData(`${P}/playbook/synthesize`, {
      memories: [
        { id: "t1", type: "work_task", content: "部署服务", taskId: "T", priority: 10 },
        { id: "m1", type: "work_method", content: "步骤一", taskId: "T", priority: 5 },
        { id: "a1", type: "work_artifact", content: "构建产物", taskId: "T", priority: 1 },
      ],
    });
    expect(body).toMatchObject({ skippedNoSteps: 0 });
    const playbooks = (body as { playbooks: unknown[] }).playbooks;
    expect(playbooks.length).toBe(1);
    expect(playbooks[0]).toMatchObject({ reusable: true, confidence: 1 });
  });

  it("scene/readiness：缺能力 → runnable=false + 原因", async () => {
    const scene = { sceneId: "s1", title: "x", executorAgentId: "a", toolsWhitelist: ["tool1"], capabilities: ["cap_missing"], constraints: [], persona: "", knowledgeRefs: [], formFields: [] };
    const { body } = await okData(`${P}/scene/readiness`, { scene, availableCapabilities: ["cap_ok"] });
    expect(body).toMatchObject({ runnable: false });
    expect((body as { missing: unknown[] }).missing.length).toBe(1);
  });

  it("scene/publish：发布生成版本快照", async () => {
    const scene = { sceneId: "s1", title: "x", executorAgentId: "a", toolsWhitelist: ["t"], capabilities: [], constraints: [], persona: "", knowledgeRefs: [], formFields: [] };
    const { body } = await okData(`${P}/scene/publish`, { scene, version: 3 });
    expect(body).toMatchObject({ version: 3, sceneId: "s1" });
    expect(typeof (body as { manifestJson: string }).manifestJson).toBe("string");
  });

  it("quality/transition：active + archive → archived；active + verify → 非法", async () => {
    const ok = await okData(`${P}/quality/transition`, { state: "active", event: "archive" });
    expect(ok.body).toMatchObject({ allowed: true, next: "archived", recallable: false });

    const bad = await okData(`${P}/quality/transition`, { state: "active", event: "verify" });
    expect(bad.body).toMatchObject({ allowed: false, next: "active" });
  });

  it("eval/retrieval：单条命中 → recall=1 且通过阈值", async () => {
    const { body } = await okData(`${P}/eval/retrieval`, {
      items: [{ query: "q", relevantIds: ["m1", "m2"], retrievedIds: ["m1", "other"] }],
      k: 2,
      threshold: { recallAtK: 0.5 },
    });
    expect(body).toMatchObject({ itemCount: 1, passed: true });
  });

  it("metrics/consolidation：聚合失败率", async () => {
    const { body } = await okData(`${P}/metrics/consolidation`, {
      runs: [
        { plans: [{ action: "merge", fromId: "b", toId: "a", newState: "consolidated", reason: "dup" }], result: { executed: 1, failed: [] } },
        { plans: [{ action: "archive", fromId: "c", newState: "archived", reason: "low" }], result: { executed: 0, failed: ["c"] } },
      ],
    });
    expect(body).toMatchObject({ totalRuns: 2, totalPlans: 2, totalExecuted: 1, totalFailed: 1, failureRate: 0.5 });
  });

  it("dreaming/run：同 domain 重复记忆 → merge 计划", async () => {
    const { body } = await okData(`${P}/dreaming/run`, {
      memories: [
        { id: "a", content: "数据库连接地址是同一个内容重复", type: "semantic", domain: "semantic", writePolicy: "automatic", priority: 50 },
        { id: "b", content: "数据库连接地址是同一个内容重复", type: "semantic", domain: "semantic", writePolicy: "automatic", priority: 50 },
      ],
    });
    expect((body as { plans: unknown[] }).plans.length).toBe(1);
  });

  it("execution-bundle/resolve：确定性 bundleId", async () => {
    const a = await okData(`${P}/execution-bundle/resolve`, { agentId: "ag", teamId: "tm", userId: "u", projectId: "p" });
    const b = await okData(`${P}/execution-bundle/resolve`, { agentId: "ag", teamId: "tm", userId: "u", projectId: "p" });
    expect(a.body).toMatchObject({ agentId: "ag" });
    expect((a.body as { bundleId: string }).bundleId).toBe((b.body as { bundleId: string }).bundleId);
  });

  it("lifecycle/decide：duplicate + explicit_only → keep（持久守卫）", async () => {
    const { body } = await okData(`${P}/lifecycle/decide`, { state: "active", relation: "duplicate", writePolicy: "explicit_only" });
    expect(body).toMatchObject({ action: "keep" });
  });

  it("skill-version/transition：draft + submit_review → pending", async () => {
    const { body } = await okData(`${P}/skill-version/transition`, { status: "draft", event: "submit_review" });
    expect(body).toMatchObject({ allowed: true, next: "pending", usable: false });
  });

  it("schema 校验失败 → 400", async () => {
    const { sent } = await okData(`${P}/quality/transition`, { state: "bad_state", event: "verify" });
    expect(sent.status).toBe(400);
    expect(sent.body.code).toBe(400);
  });

  it("未知路径 → 未处理", async () => {
    const r = await okData(`${P}/nope`, {});
    expect(r.handled).toBe(false);
  });
});

describe("v3-memory-router 依赖端点", () => {
  it("consolidation/execute：execute merge plans 且无 store → 503", async () => {
    const { sent } = await okData(`${P}/consolidation/execute`, { plans: [] });
    expect(sent.status).toBe(503);
  });

  it("consolidation/execute：有 store 时执行 merge", async () => {
    const deleted: string[] = [];
    const store = {
      deleteL1: async (id: string, _f?: IsolationFilter) => { deleted.push(id); return true; },
      queryL1Records: async () => [],
      upsertL1: async () => true,
    } as unknown as IMemoryStore;
    const { sent, body } = await okData(
      `${P}/consolidation/execute`,
      { plans: [{ action: "merge", fromId: "b", toId: "a", newState: "consolidated", reason: "dup" }] },
      { getStore: () => store },
    );
    expect(sent.status).toBe(200);
    expect(body).toMatchObject({ executed: 1, failed: [] });
    expect(deleted).toEqual(["b"]);
  });

  it("space/list：无 metadataService → 503", async () => {
    const { sent } = await okData(`${P}/space/list`, { agentId: "a" });
    expect(sent.status).toBe(503);
  });

  it("space/list：返回挂载空间", async () => {
    const spaces = [{ id: "s1", agent_id: "a", space_id: "sp", owner_type: "team", owner_id: "t", domain: "rule", write_policy: "automatic", source: "default_mount", created_at: "2026-01-01" }];
    const svc = { getMountedSpaces: async () => spaces } as unknown as MetadataService;
    const { sent, body } = await okData(`${P}/space/list`, { agentId: "a" }, { getMetadataService: () => svc });
    expect(sent.status).toBe(200);
    expect(body).toEqual(spaces);
  });
});