/**
 * api/memory.ts — 记忆能力 API 客户端（/api/v1/memory/* → 内核 /v3/memory/*）。
 *
 * 覆盖三平台比对新增的记忆能力：反馈 / 审批 / 剧本 / 可执行场景 / 质量 /
 * 召回评测 / 巩固指标 / 离线巩固 / 执行包 / 生命周期 / 技能版本 / 记忆空间。
 */
import { getPanelSession } from '../panelSession';
import { request, ApiError } from './base';
import type { MetaEnvelope } from './types';

const MEMORY_PREFIX = '/api/v1/memory';

async function memoryCall<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const session = getPanelSession();
  if (!session) throw new ApiError(401, 'Unauthorized', 'no active panel session');
  const envelope = await request<MetaEnvelope<T>>(
    'POST',
    `${MEMORY_PREFIX}/${action}`,
    body,
    {
      'X-Tdai-Service-Id': session.instanceId,
      'X-Tdai-User-Key': session.userKey,
    },
  );
  if (envelope.code !== 0) {
    throw new ApiError(200, envelope.message, '', {
      code: envelope.code,
      requestId: envelope.request_id,
      rawMessage: envelope.message,
    });
  }
  return envelope.data as T;
}

// ── 类型 ──

export type WritePolicy = 'automatic' | 'review_required' | 'explicit_only' | 'deny';
export type ReviewerRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface FeedbackDetect {
  detected: boolean;
  signal?: 'correction' | 'confirmation' | 'contradiction' | 'disregard' | 'explicit_forget';
  source?: 'user_explicit' | 'system_implicit';
}

export interface FeedbackDecision {
  action: 'update' | 'archive' | 'reinforce' | 'downgrade' | 'keep';
  reason: string;
}

export interface ReviewGate { decision: 'commit' | 'hold' | 'reject'; canApprove: boolean }

export interface SceneParam { name: string; type: string; required: boolean; default_value?: string }
export interface SceneDefinition {
  sceneId: string;
  title: string;
  executorAgentId: string;
  toolsWhitelist: string[];
  capabilities: string[];
  constraints: string[];
  persona: string;
  knowledgeRefs: string[];
  formFields: SceneParam[];
}
export interface SceneReadiness { runnable: boolean; missing: Array<{ capability: string; reasonCode: string }> }
export interface SceneRelease { version: number; sceneId: string; manifest: SceneDefinition; manifestJson: string; publishedAt: string }

export interface WorkMemory { id: string; type: 'work_task' | 'work_method' | 'work_artifact'; content: string; taskId?: string; priority: number }
export interface Playbook {
  id: string;
  name: string;
  steps: string[];
  artifacts: string[];
  sourceIds: string[];
  confidence: number;
  reusable: boolean;
}

export interface QualityTransition {
  allowed: boolean;
  next: string;
  reason: string;
  recallable: boolean;
  writable: boolean;
  terminal: boolean;
}

export interface EvalItem { query: string; relevantIds: string[]; retrievedIds: string[] }
export interface EvalMetrics {
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  ndcgAtK: number;
  k: number;
  itemCount: number;
  passed?: boolean;
}

export interface ConsolidationMetrics {
  totalRuns: number;
  totalPlans: number;
  totalExecuted: number;
  totalFailed: number;
  failureRate: number;
  byAction: Record<string, number>;
  byActionPlans: Record<string, number>;
}

export interface DreamingMemory { id: string; content: string; type: string; domain: string; writePolicy: WritePolicy; priority: number }
export interface ConsolidationPlan { action: 'merge' | 'archive' | 'update' | 'link' | 'keep'; fromId: string; toId?: string; newState: string; reason: string }
export interface ConsolidationResult { executed: number; failed: string[] }

export interface ExecutionBundle {
  agentId: string;
  mountedSpaces: Array<{ ownerType: string; ownerId: string; domain: string; writePolicy: string; spaceId: string }>;
  sceneIds: string[];
  bundleId: string;
}

export interface LifecycleDecision { action: 'merge' | 'archive' | 'update' | 'link' | 'keep'; newState: string; reason: string }

export interface AgentSpace {
  id: string;
  agent_id: string;
  space_id: string;
  owner_type: string;
  owner_id: string;
  domain: string;
  write_policy: string;
  source: 'default_mount' | 'explicit';
  created_at: string;
}

export interface WriteApproval {
  approval_id: string;
  team_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  session_id?: string | null;
  write_policy: string;
  risk?: string | null;
  plans_json: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_by_user_id?: string | null;
  decision_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WriteApprovalDecision {
  status: 'approved' | 'rejected' | 'pending_approval' | 'denied';
  approval_id?: string;
  write_policy?: string;
  executed?: number;
  failed?: string[];
}

// ── API ──

export const memoryApi = {
  // Feedback
  feedbackDetect: (text: string) => memoryCall<FeedbackDetect>('feedback/detect', { text }),
  feedbackDecide: (signal: FeedbackDetect['signal'], source: FeedbackDetect['source'], writePolicy: WritePolicy) =>
    memoryCall<FeedbackDecision>('feedback/decide', { signal, source, writePolicy }),

  // Review / Approval
  reviewGate: (policy: WritePolicy, role: ReviewerRole) => memoryCall<ReviewGate>('review/gate', { policy, role }),
  reviewApproveOrReject: (policy: WritePolicy, role: ReviewerRole, action: 'approve' | 'reject') =>
    memoryCall<{ decision: string }>('review/approve-or-reject', { policy, role, action }),
  approvalNeeds: (level: string, risk: 'safe' | 'risky' | 'untrusted', failedBefore?: boolean) =>
    memoryCall<{ decision: string }>('approval/needs', { level, risk, failedBefore }),

  // Playbook / Scene
  playbookAssemble: (task: WorkMemory | undefined, methods: WorkMemory[], artifacts: WorkMemory[]) =>
    memoryCall<Playbook>('playbook/assemble', { task, methods, artifacts }),
  playbookSynthesize: (memories: WorkMemory[]) =>
    memoryCall<{ playbooks: Playbook[]; skippedNoSteps: number }>('playbook/synthesize', { memories }),
  sceneReadiness: (scene: SceneDefinition, availableCapabilities: string[]) =>
    memoryCall<SceneReadiness>('scene/readiness', { scene, availableCapabilities }),
  scenePublish: (scene: SceneDefinition, version: number) =>
    memoryCall<SceneRelease>('scene/publish', { scene, version }),
  sceneValidate: (scene: SceneDefinition, supplied: Record<string, unknown>) =>
    memoryCall<{ ok: boolean; missing: string[] }>('scene/validate', { scene, supplied }),

  // Quality
  qualityTransition: (state: string, event: string) =>
    memoryCall<QualityTransition>('quality/transition', { state, event }),

  // Retrieval eval
  evalRetrieval: (items: EvalItem[], k: number) =>
    memoryCall<EvalMetrics>('eval/retrieval', { items, k }),

  // Consolidation metrics
  metricsConsolidation: (runs: Array<{ plans: ConsolidationPlan[]; result: ConsolidationResult }>) =>
    memoryCall<ConsolidationMetrics>('metrics/consolidation', { runs }),

  // Dreaming
  dreamingRun: (memories: DreamingMemory[], lowValueScan?: boolean) =>
    memoryCall<{ plans: ConsolidationPlan[] }>('dreaming/run', { memories, lowValueScan }),

  // Consolidation execute
  consolidationExecute: (plans: ConsolidationPlan[], filter?: { teamId?: string; agentId?: string; taskId?: string; sessionId?: string }) =>
    memoryCall<ConsolidationResult | WriteApprovalDecision>('consolidation/execute', { plans, filter }),

  // Write approval（治理人机闭环）
  writeApprovalList: (teamId: string, status?: 'pending' | 'approved' | 'rejected') =>
    memoryCall<{ items: WriteApproval[]; total?: number }>('write-approval/list', { team_id: teamId, status }),
  writeApprovalApprove: (approvalId: string) =>
    memoryCall<WriteApprovalDecision>('write-approval/approve', { approval_id: approvalId }),
  writeApprovalReject: (approvalId: string, note?: string) =>
    memoryCall<{ status: string; approval_id: string }>('write-approval/reject', { approval_id: approvalId, note }),

  // Execution bundle
  executionBundleResolve: (input: { agentId: string; teamId?: string; userId?: string; projectId?: string; taskId?: string; sceneIds?: string[] }) =>
    memoryCall<ExecutionBundle>('execution-bundle/resolve', input),

  // Lifecycle
  lifecycleDecide: (state: string, relation: string, writePolicy: WritePolicy, targetWritePolicy?: WritePolicy) =>
    memoryCall<LifecycleDecision>('lifecycle/decide', { state, relation, writePolicy, targetWritePolicy }),
  lifecycleDetectRelation: (a: string, b: string) =>
    memoryCall<{ relation: string }>('lifecycle/detect-relation', { a, b }),
  lifecycleIsLowValue: (content: string, priority: number) =>
    memoryCall<{ lowValue: boolean }>('lifecycle/is-low-value', { content, priority }),

  // Skill version
  skillVersionTransition: (status: string, event: string) =>
    memoryCall<{ allowed: boolean; next: string; reason: string; usable: boolean }>('skill-version/transition', { status, event }),

  // Memory space（团队 × 项目 × Agent × 用户 AND 组合筛选；agentId 单值兼容旧调用）
  spaceList: (filters?: { agentId?: string; teamId?: string; projectId?: string; ownerUserId?: string }) =>
    memoryCall<AgentSpace[]>('space/list', {
      agentId: filters?.agentId,
      teamId: filters?.teamId,
      projectId: filters?.projectId,
      ownerUserId: filters?.ownerUserId,
    }),
};