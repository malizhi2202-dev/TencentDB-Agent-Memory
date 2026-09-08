/**
 * 内核 /v3/memory/* 记忆能力 action 白名单（23 条）。
 *
 * 记忆能力端点是「无 IO / 纯计算」为主（feedback/审批/剧本/质量/评测/指标/状态机），
 * 外加两个依赖端点（consolidation/execute 读写 L1、space/list 读挂载空间）。
 * 无租户写入语义，但统一走 validatePanelMetaHeaders 复用面板登录态。
 */
export const MEMORY_ACTIONS = [
  'feedback/detect',
  'feedback/decide',
  'review/gate',
  'review/approve-or-reject',
  'approval/resolve-level',
  'approval/needs',
  'approval/authorize-decision',
  'playbook/assemble',
  'playbook/synthesize',
  'scene/readiness',
  'scene/publish',
  'scene/validate',
  'quality/transition',
  'eval/retrieval',
  'metrics/consolidation',
  'dreaming/run',
  'consolidation/execute',
  'execution-bundle/resolve',
  'lifecycle/decide',
  'lifecycle/detect-relation',
  'lifecycle/is-low-value',
  'skill-version/transition',
  'space/list',
  'write-approval/list',
  'write-approval/approve',
  'write-approval/reject',
] as const;

export type MemoryAction = (typeof MEMORY_ACTIONS)[number];

export const ALLOWED_MEMORY_ACTIONS = new Set<string>(MEMORY_ACTIONS);

export function isAllowedMemoryAction(action: string): boolean {
  return ALLOWED_MEMORY_ACTIONS.has(action);
}