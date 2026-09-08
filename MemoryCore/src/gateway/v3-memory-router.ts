/**
 * v3 记忆能力路由（/v3/memory/*，18 纯计算 + 2 依赖端点）。
 *
 * 把三平台比对新增、但此前仍是「孤立库函数」的 core/record/* 模块暴露成 HTTP API：
 * feedback / review / approval / playbook / scene / quality / eval / metrics /
 * dreaming / consolidation / execution-bundle / lifecycle / skill-version / space。
 *
 * 设计（镜像 v3-meta-router 的 bind 模式，但更轻）：
 *   - 仅 POST，前缀 /v3/memory
 *   - 纯计算端点：输入从 body 传，输出 JSON，无 IO 无租户（无 x-tdai-user-key）
 *   - consolidation/execute 依赖 IMemoryStore（读写 L1）；space/list 依赖 MetadataService
 *   - 鉴权由 gateway 层的 Bearer apiKey gate 统一承担（同 /v3/meta、/v2//v3）
 */

import type * as http from "node:http";
import { z, type ZodType } from "zod";
import { successEnvelope, errorEnvelope, resolveRequestId } from "./v2-router.js";
import { formatZodError, type ApiResponseEnvelope } from "./v2-schemas.js";
import type { Logger } from "../core/types.js";
import type { IMemoryStore, IsolationFilter } from "../core/store/types.js";
import type { MetadataService } from "../metadata/service/metadata-service.js";
import { extractInstanceId } from "../metadata/router/instance.js";

// ── 库函数（纯逻辑）──
import { feedbackToAction } from "../core/record/feedback.js";
import { detectFeedbackSignal } from "../core/record/feedback-detection.js";
import { reviewGate, canApprove, approveOrReject } from "../core/record/review-approval.js";
import { resolveApprovalLevel, needsApproval, authorizeDecision } from "../core/record/approval-policy.js";
import { assemblePlaybook } from "../core/record/playbook.js";
import { synthesizePlaybooks } from "../core/record/playbook-synthesis.js";
import { checkSceneReadiness, publishScene, validateForm } from "../core/record/scene-executable.js";
import {
  transitionQuality,
  qualityRecallable,
  qualityWritable,
  isTerminal as qualityIsTerminal,
} from "../core/record/memory-quality.js";
import { evaluateRetrieval, passesThreshold } from "../core/record/retrieval-evaluator.js";
import { aggregateConsolidation } from "../core/record/consolidation-metrics.js";
import { executeConsolidation } from "../core/record/consolidation-executor.js";
import { runDreamingConsolidation } from "../core/record/dreaming.js";
import { resolveExecutionBundle } from "../core/record/execution-bundle.js";
import {
  decideLifecycleAction,
  detectRelationByOverlap,
  isLowValue,
} from "../core/record/memory-lifecycle.js";
import { transitionSkillVersion, isSkillUsable } from "../core/record/skill-version.js";

export const V3_MEMORY_PREFIX = "/v3/memory";
const TAG = "[MEMORY-V3]";

export interface V3MemoryRouterDeps {
  /** consolidation/execute 用（读写 L1）。缺省时该端点返回 503。 */
  getStore?: () => IMemoryStore | undefined | Promise<IMemoryStore | undefined>;
  /** space/list 用（读 meta_agent_spaces）。缺省时该端点返回 503。 */
  getMetadataService?: (instanceId: string) => MetadataService | undefined | Promise<MetadataService | undefined>;
  logger: Logger;
}

type Handler = (body: unknown, requestId: string) => Promise<ApiResponseEnvelope> | ApiResponseEnvelope;

/** schema 校验 + 业务调用 + 成功封装。 */
function bind<S extends ZodType>(schema: S, fn: (data: S["_output"]) => unknown): Handler {
  return async (body, requestId) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorEnvelope(400, formatZodError(parsed.error), requestId);
    const data = await fn(parsed.data as S["_output"]);
    return successEnvelope(data, requestId);
  };
}

// ── 共享枚举 schema ──
const writePolicy = z.enum(["automatic", "review_required", "explicit_only", "deny"]);
const reviewerRole = z.enum(["owner", "admin", "member", "viewer"]);
const feedbackSignal = z.enum(["correction", "confirmation", "contradiction", "disregard", "explicit_forget"]);
const approvalLevel = z.enum(["untrusted_command", "on_failure", "on_demand", "smart", "never"]);
const commandRisk = z.enum(["safe", "risky", "untrusted"]);
const qualityState = z.enum(["candidate", "verified", "active", "stale", "disputed", "superseded", "archived", "deleted"]);
const qualityEvent = z.enum(["verify", "activate", "mark_stale", "dispute", "supersede", "archive", "delete", "revalidate"]);
const lifecycleState = z.enum(["active", "consolidated", "archived", "dormant"]);
const lifecycleAction = z.enum(["merge", "archive", "update", "link", "keep"]);
const dreamingIssue = z.enum(["conflict", "duplicate", "near_duplicate", "complementary", "low_value", "ambiguous", "other"]);
const skillStatus = z.enum(["draft", "pending", "published", "evaluating", "superseded", "rolled_back"]);
const skillEvent = z.enum(["submit_review", "approve", "reject", "start_eval", "pass_eval", "fail_eval", "supersede", "rollback"]);

const workMemorySchema = z.object({
  id: z.string(),
  type: z.enum(["work_task", "work_method", "work_artifact"]),
  content: z.string(),
  taskId: z.string().optional(),
  priority: z.number(),
});

const sceneParamSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  default_value: z.string().optional(),
});

const sceneDefSchema = z.object({
  sceneId: z.string(),
  title: z.string(),
  executorAgentId: z.string(),
  toolsWhitelist: z.array(z.string()),
  capabilities: z.array(z.string()),
  constraints: z.array(z.string()),
  persona: z.string(),
  knowledgeRefs: z.array(z.string()),
  formFields: z.array(sceneParamSchema),
});

const consolidationPlanSchema = z.object({
  action: lifecycleAction,
  fromId: z.string(),
  toId: z.string().optional(),
  newState: lifecycleState,
  reason: z.string(),
});

const consolidationRunSchema = z.object({
  plans: z.array(consolidationPlanSchema),
  result: z.object({ executed: z.number(), failed: z.array(z.string()) }),
});

const dreamingMemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  type: z.string(),
  domain: z.string(),
  writePolicy,
  priority: z.number(),
});

// ── Route table（纯计算端点，无 IO 无租户）──
const routeTable: Record<string, Handler> = {
  // Feedback
  [`${V3_MEMORY_PREFIX}/feedback/detect`]: bind(z.object({ text: z.string() }), (d) => {
    const det = detectFeedbackSignal(d.text);
    return { detected: det !== null, ...(det ?? {}) };
  }),
  [`${V3_MEMORY_PREFIX}/feedback/decide`]: bind(
    z.object({ signal: feedbackSignal, source: z.enum(["user_explicit", "system_implicit"]), writePolicy }),
    (d) => feedbackToAction(d.signal, d.source, { writePolicy: d.writePolicy }),
  ),

  // Review / Approval
  [`${V3_MEMORY_PREFIX}/review/gate`]: bind(z.object({ policy: writePolicy, role: reviewerRole }), (d) => ({
    decision: reviewGate({ policy: d.policy, role: d.role }),
    canApprove: canApprove(d.policy, d.role),
  })),
  [`${V3_MEMORY_PREFIX}/review/approve-or-reject`]: bind(
    z.object({ policy: writePolicy, role: reviewerRole, action: z.enum(["approve", "reject"]) }),
    (d) => ({ decision: approveOrReject(d.policy, d.role, d.action) }),
  ),
  [`${V3_MEMORY_PREFIX}/approval/resolve-level`]: bind(
    z.object({ declared: approvalLevel, baseline: approvalLevel }),
    (d) => resolveApprovalLevel(d.declared, d.baseline),
  ),
  [`${V3_MEMORY_PREFIX}/approval/needs`]: bind(
    z.object({ level: approvalLevel, risk: commandRisk, failedBefore: z.boolean().optional() }),
    (d) => ({ decision: needsApproval(d.level, d.risk, { failedBefore: d.failedBefore }) }),
  ),
  [`${V3_MEMORY_PREFIX}/approval/authorize-decision`]: bind(
    z.object({ requester: z.enum(["model", "api_caller"]) }),
    (d) => authorizeDecision(d.requester),
  ),

  // Playbook / Scene
  [`${V3_MEMORY_PREFIX}/playbook/assemble`]: bind(
    z.object({
      task: workMemorySchema.optional(),
      methods: z.array(workMemorySchema),
      artifacts: z.array(workMemorySchema),
      reusableThreshold: z.number().optional(),
      minSteps: z.number().optional(),
    }),
    (d) => assemblePlaybook(d.task, d.methods, d.artifacts, { reusableThreshold: d.reusableThreshold, minSteps: d.minSteps }),
  ),
  [`${V3_MEMORY_PREFIX}/playbook/synthesize`]: bind(
    z.object({ memories: z.array(workMemorySchema), reusableThreshold: z.number().optional(), minSteps: z.number().optional() }),
    (d) => synthesizePlaybooks(d.memories, { reusableThreshold: d.reusableThreshold, minSteps: d.minSteps }),
  ),
  [`${V3_MEMORY_PREFIX}/scene/readiness`]: bind(
    z.object({ scene: sceneDefSchema, availableCapabilities: z.array(z.string()) }),
    (d) => checkSceneReadiness(d.scene, new Set(d.availableCapabilities)),
  ),
  [`${V3_MEMORY_PREFIX}/scene/publish`]: bind(
    z.object({ scene: sceneDefSchema, version: z.number(), publishedAt: z.string().optional() }),
    (d) => publishScene(d.scene, d.version, d.publishedAt),
  ),
  [`${V3_MEMORY_PREFIX}/scene/validate`]: bind(
    z.object({ scene: sceneDefSchema, supplied: z.record(z.unknown()) }),
    (d) => validateForm(d.scene, d.supplied),
  ),

  // Quality
  [`${V3_MEMORY_PREFIX}/quality/transition`]: bind(
    z.object({ state: qualityState, event: qualityEvent }),
    (d) => {
      const t = transitionQuality(d.state, d.event);
      return { ...t, recallable: qualityRecallable(t.next), writable: qualityWritable(t.next), terminal: qualityIsTerminal(t.next) };
    },
  ),

  // Retrieval eval
  [`${V3_MEMORY_PREFIX}/eval/retrieval`]: bind(
    z.object({
      items: z.array(z.object({ query: z.string(), relevantIds: z.array(z.string()), retrievedIds: z.array(z.string()) })),
      k: z.number().int().positive(),
      threshold: z.object({ recallAtK: z.number().optional(), mrr: z.number().optional(), ndcgAtK: z.number().optional() }).optional(),
    }),
    (d) => {
      const metrics = evaluateRetrieval(d.items, d.k);
      return d.threshold ? { ...metrics, passed: passesThreshold(metrics, d.threshold) } : metrics;
    },
  ),

  // Consolidation metrics
  [`${V3_MEMORY_PREFIX}/metrics/consolidation`]: bind(
    z.object({ runs: z.array(consolidationRunSchema) }),
    (d) => aggregateConsolidation(d.runs),
  ),

  // Dreaming
  [`${V3_MEMORY_PREFIX}/dreaming/run`]: bind(
    z.object({ memories: z.array(dreamingMemorySchema), lowValueScan: z.boolean().optional() }),
    (d) => ({ plans: runDreamingConsolidation(d.memories, { lowValueScan: d.lowValueScan }) }),
  ),

  // Execution bundle
  [`${V3_MEMORY_PREFIX}/execution-bundle/resolve`]: bind(
    z.object({
      agentId: z.string(),
      teamId: z.string().optional(),
      userId: z.string().optional(),
      projectId: z.string().optional(),
      taskId: z.string().optional(),
      sceneIds: z.array(z.string()).optional(),
    }),
    (d) => resolveExecutionBundle(d),
  ),

  // Lifecycle
  [`${V3_MEMORY_PREFIX}/lifecycle/decide`]: bind(
    z.object({ state: lifecycleState, relation: dreamingIssue, writePolicy, targetWritePolicy: writePolicy.optional() }),
    (d) => decideLifecycleAction(d.state, d.relation, { writePolicy: d.writePolicy, targetWritePolicy: d.targetWritePolicy }),
  ),
  [`${V3_MEMORY_PREFIX}/lifecycle/detect-relation`]: bind(
    z.object({ a: z.string(), b: z.string() }),
    (d) => ({ relation: detectRelationByOverlap(d.a, d.b) }),
  ),
  [`${V3_MEMORY_PREFIX}/lifecycle/is-low-value`]: bind(
    z.object({ content: z.string(), priority: z.number(), minChars: z.number().optional(), maxPriority: z.number().optional() }),
    (d) => ({ lowValue: isLowValue(d.content, d.priority, { minChars: d.minChars, maxPriority: d.maxPriority }) }),
  ),

  // Skill version
  [`${V3_MEMORY_PREFIX}/skill-version/transition`]: bind(
    z.object({ status: skillStatus, event: skillEvent }),
    (d) => {
      const t = transitionSkillVersion(d.status, d.event);
      return { ...t, usable: isSkillUsable(t.next) };
    },
  ),
};

export const V3_MEMORY_ROUTES = Object.keys(routeTable);

// ── 写入审批门：按「挂载空间最严格写入策略」决策 ──
const WRITE_GATE_RANK: Record<string, number> = { automatic: 0, review_required: 1, explicit_only: 2, deny: 3 };

function strictestWritePolicy(spaces: Array<{ write_policy: string }>): string {
  let strictest = "automatic";
  let rank = -1;
  for (const s of spaces) {
    const r = WRITE_GATE_RANK[s.write_policy] ?? 0;
    if (r > rank) {
      rank = r;
      strictest = s.write_policy;
    }
  }
  return strictest;
}

function decideWriteGate(policy: string): "execute" | "pending" | "deny" {
  if (policy === "deny") return "deny";
  if (policy === "review_required" || policy === "explicit_only") return "pending";
  return "execute";
}

/**
 * 分发 /v3/memory/*。命中返回 true；非本前缀或非 POST 返回 false。
 */
export async function handleV3MemoryRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parseJsonBody: <T>(req: http.IncomingMessage) => Promise<T>,
  sendJson: (res: http.ServerResponse, status: number, body: unknown) => void,
  deps: V3MemoryRouterDeps,
): Promise<boolean> {
  if (!pathname.startsWith(V3_MEMORY_PREFIX) || method !== "POST") return false;

  const requestId = resolveRequestId(req.headers as Record<string, string | string[] | undefined>);

  try {
    const body = await parseJsonBody(req);

    // 依赖端点：consolidation/execute（store）、space/list（metadata service）
    if (pathname === `${V3_MEMORY_PREFIX}/consolidation/execute`) {
      const parsed = consolidationExecuteSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, errorEnvelope(400, formatZodError(parsed.error), requestId));
        return true;
      }
      const store = deps.getStore ? await Promise.resolve(deps.getStore()) : undefined;
      if (!store) {
        sendJson(res, 503, errorEnvelope(503, "memory store not available", requestId));
        return true;
      }

      // 写入审批门：仅当同时提供 teamId + agentId 时，按挂载空间最严格写入策略决定
      // execute（automatic）| pending（review_required / explicit_only）| deny。
      const gateTeamId = parsed.data.filter?.teamId;
      const gateAgentId = parsed.data.filter?.agentId;
      if (gateTeamId && gateAgentId && deps.getMetadataService) {
        try {
          let gateInstanceId: string;
          try {
            gateInstanceId = extractInstanceId(req.headers);
          } catch {
            gateInstanceId = "default";
          }
          const gateSvc = await Promise.resolve(deps.getMetadataService(gateInstanceId));
          if (gateSvc) {
            const spaces = await gateSvc.getMountedSpaces(gateAgentId);
            const policy = strictestWritePolicy(spaces);
            const decision = decideWriteGate(policy);
            if (decision === "deny") {
              sendJson(res, 200, successEnvelope({ status: "denied", write_policy: policy }, requestId));
              return true;
            }
            if (decision === "pending") {
              const approval = await gateSvc.createWriteApproval({
                team_id: gateTeamId,
                agent_id: gateAgentId,
                task_id: parsed.data.filter?.taskId ?? null,
                session_id: parsed.data.filter?.sessionId ?? null,
                write_policy: policy,
                risk: null,
                plans_json: JSON.stringify(parsed.data.plans),
                status: "pending",
              });
              sendJson(res, 200, successEnvelope({ status: "pending_approval", approval_id: approval.approval_id, write_policy: policy }, requestId));
              return true;
            }
          }
        } catch (gateErr) {
          deps.logger.warn?.(`${TAG} write gate resolve failed, executing directly: ${gateErr instanceof Error ? gateErr.message : String(gateErr)}`);
        }
      }

      const result = await executeConsolidation(store, parsed.data.plans, parsed.data.filter as IsolationFilter | undefined);

      // 自动落库 RunTrace（真实运行回放）：仅在提供 teamId 时记录，失败不阻断主流程。
      const teamId = parsed.data.filter?.teamId;
      if (teamId && deps.getMetadataService) {
        try {
          let instanceId: string;
          try {
            instanceId = extractInstanceId(req.headers);
          } catch {
            instanceId = "default";
          }
          const svc = await Promise.resolve(deps.getMetadataService(instanceId));
          if (svc && typeof svc.recordRunAuto === "function") {
            const failedCount = (result.failed ?? []).length;
            await svc.recordRunAuto({
              team_id: teamId,
              agent_id: parsed.data.filter?.agentId ?? null,
              task_id: parsed.data.filter?.taskId ?? null,
              kind: "run",
              title: "记忆巩固 consolidation/execute",
              status: failedCount ? "failed" : "completed",
              input_summary: `${parsed.data.plans.length} 条巩固计划`,
              output_summary: `executed=${result.executed} failed=${failedCount}`,
              trace_json: JSON.stringify(result),
            });
          }
        } catch (recErr) {
          deps.logger.error?.(`${TAG} run-trace auto-record failed: ${recErr instanceof Error ? recErr.message : String(recErr)}`);
        }
      }

      sendJson(res, 200, successEnvelope(result, requestId));
      return true;
    }

    if (pathname === `${V3_MEMORY_PREFIX}/space/list`) {
      const parsed = spaceListSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, errorEnvelope(400, formatZodError(parsed.error), requestId));
        return true;
      }
      let instanceId: string;
      try {
        instanceId = extractInstanceId(req.headers);
      } catch {
        sendJson(res, 400, errorEnvelope(400, "missing_instance_id", requestId));
        return true;
      }
      const svc = deps.getMetadataService ? await Promise.resolve(deps.getMetadataService(instanceId)) : undefined;
      if (!svc) {
        sendJson(res, 503, errorEnvelope(503, "MetadataService not available", requestId));
        return true;
      }
      const { agentId, teamId, projectId, ownerUserId } = parsed.data;
      let spaces;
      if (agentId && !teamId && projectId === undefined && !ownerUserId) {
        // 兼容旧调用：仅按 agent 拉挂载空间
        spaces = await svc.getMountedSpaces(agentId);
      } else {
        spaces = await svc.listAgentSpaces({
          agent_id: agentId,
          team_id: teamId,
          project_id: projectId,
          owner_user_id: ownerUserId,
        });
      }
      sendJson(res, 200, successEnvelope(spaces, requestId));
      return true;
    }

    // ── 写入审批（人机闭环）：list / approve / reject ──
    if (pathname === `${V3_MEMORY_PREFIX}/write-approval/list`) {
      const parsed = writeApprovalListSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, errorEnvelope(400, formatZodError(parsed.error), requestId));
        return true;
      }
      let instanceId: string;
      try {
        instanceId = extractInstanceId(req.headers);
      } catch {
        sendJson(res, 400, errorEnvelope(400, "missing_instance_id", requestId));
        return true;
      }
      const svc = deps.getMetadataService ? await Promise.resolve(deps.getMetadataService(instanceId)) : undefined;
      if (!svc) {
        sendJson(res, 503, errorEnvelope(503, "MetadataService not available", requestId));
        return true;
      }
      const page = await svc.listWriteApprovals({
        team_id: parsed.data.team_id,
        agent_id: parsed.data.agent_id,
        status: parsed.data.status,
      });
      sendJson(res, 200, successEnvelope(page, requestId));
      return true;
    }

    if (pathname === `${V3_MEMORY_PREFIX}/write-approval/approve`) {
      const parsed = writeApprovalApproveSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, errorEnvelope(400, formatZodError(parsed.error), requestId));
        return true;
      }
      let instanceId: string;
      try {
        instanceId = extractInstanceId(req.headers);
      } catch {
        sendJson(res, 400, errorEnvelope(400, "missing_instance_id", requestId));
        return true;
      }
      const svc = deps.getMetadataService ? await Promise.resolve(deps.getMetadataService(instanceId)) : undefined;
      if (!svc) {
        sendJson(res, 503, errorEnvelope(503, "MetadataService not available", requestId));
        return true;
      }
      const approval = await svc.getWriteApproval(parsed.data.approval_id);
      if (!approval) {
        sendJson(res, 404, errorEnvelope(404, "approval_not_found", requestId));
        return true;
      }
      if (approval.status !== "pending") {
        sendJson(res, 409, errorEnvelope(409, "approval_already_decided", requestId));
        return true;
      }
      const store = deps.getStore ? await Promise.resolve(deps.getStore()) : undefined;
      if (!store) {
        sendJson(res, 503, errorEnvelope(503, "memory store not available", requestId));
        return true;
      }
      const plans = JSON.parse(approval.plans_json || "[]");
      const result = await executeConsolidation(store, plans, {
        teamId: approval.team_id,
        agentId: approval.agent_id ?? undefined,
        taskId: approval.task_id ?? undefined,
      } as IsolationFilter);
      await svc.updateWriteApproval(approval.approval_id, { status: "approved", decided_by_user_id: "system", decision_note: "approved" });
      sendJson(res, 200, successEnvelope({ status: "approved", approval_id: approval.approval_id, ...result }, requestId));
      return true;
    }

    if (pathname === `${V3_MEMORY_PREFIX}/write-approval/reject`) {
      const parsed = writeApprovalRejectSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, errorEnvelope(400, formatZodError(parsed.error), requestId));
        return true;
      }
      let instanceId: string;
      try {
        instanceId = extractInstanceId(req.headers);
      } catch {
        sendJson(res, 400, errorEnvelope(400, "missing_instance_id", requestId));
        return true;
      }
      const svc = deps.getMetadataService ? await Promise.resolve(deps.getMetadataService(instanceId)) : undefined;
      if (!svc) {
        sendJson(res, 503, errorEnvelope(503, "MetadataService not available", requestId));
        return true;
      }
      const approval = await svc.getWriteApproval(parsed.data.approval_id);
      if (!approval) {
        sendJson(res, 404, errorEnvelope(404, "approval_not_found", requestId));
        return true;
      }
      if (approval.status !== "pending") {
        sendJson(res, 409, errorEnvelope(409, "approval_already_decided", requestId));
        return true;
      }
      await svc.updateWriteApproval(approval.approval_id, { status: "rejected", decided_by_user_id: "system", decision_note: parsed.data.note ?? "rejected" });
      sendJson(res, 200, successEnvelope({ status: "rejected", approval_id: approval.approval_id }, requestId));
      return true;
    }

    // 纯计算端点
    const handler = routeTable[pathname];
    if (!handler) return false;

    const envelope = await handler(body, requestId);
    const httpStatus = envelope.code === 0 ? 200 : envelope.code;
    sendJson(res, httpStatus, envelope);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    deps.logger.error?.(`${TAG} [${pathname}] unexpected: ${msg}`);
    sendJson(res, 500, errorEnvelope(500, "internal_error", requestId));
    return true;
  }
}

// ── 依赖端点 schema（路由函数内联使用）──
const writeApprovalApproveSchema = z.object({ approval_id: z.string().min(1) });
const writeApprovalRejectSchema = z.object({ approval_id: z.string().min(1), note: z.string().optional() });
const writeApprovalListSchema = z.object({
  team_id: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  agent_id: z.string().optional(),
});

const consolidationExecuteSchema = z.object({
  plans: z.array(consolidationPlanSchema),
  filter: z
    .object({
      teamId: z.string().optional(),
      agentId: z.string().optional(),
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      taskId: z.string().optional(),
      sessionKey: z.string().optional(),
    })
    .optional(),
});

const spaceListSchema = z.object({
  agentId: z.string().optional(),
  teamId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  ownerUserId: z.string().optional(),
});
