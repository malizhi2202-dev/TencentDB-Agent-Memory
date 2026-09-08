/**
 * Playbook 沉淀（P1.3 资产演进）.
 *
 * 补齐对比文档 §5 的「资产演进」缺失：TencentDB 有 work_task / work_method /
 * work_artifact 三类工作记忆，但它们是「平铺」的，没有「沉淀链」——把反复
 * 执行的任务流程固化为可复用资产（playbook / executable scene）。
 *
 * 对标 Agent OS 的「ExecutableScene / Playbook」：一次任务做完，其
 * 「目标（task）→ 步骤（method）→ 产物（artifact）」被提炼成可复用流程，
 * 下次同类任务直接引用而非重新推理。
 *
 * 本模块是纯逻辑（无 IO）：输入一个任务相关的工作记忆簇，输出确定性的
 * Playbook（步骤序列 + 产物 + 固化置信度 + 可复用判定）。
 *
 * 沉淀链语义：
 *   work_task（做什么） + work_method（怎么做） + work_artifact（做出什么）
 *   → Playbook（可复用流程）。三者齐全才高置信固化；缺产物/步骤则置信度低，
 *   仅作为「草稿」不进入可复用资产（避免把一次性的碎记忆当流程）。
 */

export interface WorkMemory {
  id: string;
  type: "work_task" | "work_method" | "work_artifact";
  content: string;
  taskId?: string;
  priority: number;
}

export interface Playbook {
  id: string;
  /** 从 task 内容提炼的名称 */
  name: string;
  /** 固化步骤（work_method 序列，按 priority 降序 = 越重要越靠前） */
  steps: string[];
  /** 关联产物（work_artifact 内容） */
  artifacts: string[];
  /** 沉淀来源 id 集合 */
  sourceIds: string[];
  /** 固化置信度 0–1（基于 task/method/artifact 完整性） */
  confidence: number;
  /** 是否达到可复用阈值（默认 0.6） */
  reusable: boolean;
}

export interface PlaybookOptions {
  /** 可复用置信度阈值（默认 0.6） */
  reusableThreshold?: number;
  /** 最小步骤数（默认 1） */
  minSteps?: number;
}

export const PLAYBOOK_DEFAULTS = {
  reusableThreshold: 0.6,
  minSteps: 1,
} as const;

/**
 * 从工作记忆簇组装 playbook（沉淀链）。
 *
 * confidence 公式：
 *   +0.35 有 task（目标明确）
 *   +0.35 有 method（有可执行步骤）
 *   +0.30 有 artifact（有产出验证）
 * 三者齐 = 1.0；缺 artifact = 0.70；缺 method（无法复用）→ 0 或低分。
 */
export function assemblePlaybook(
  task: WorkMemory | undefined,
  methods: WorkMemory[],
  artifacts: WorkMemory[],
  opts: PlaybookOptions = {},
): Playbook {
  const threshold = opts.reusableThreshold ?? PLAYBOOK_DEFAULTS.reusableThreshold;
  const minSteps = opts.minSteps ?? PLAYBOOK_DEFAULTS.minSteps;

  const sortedMethods = [...methods].sort((a, b) => b.priority - a.priority);
  const steps = sortedMethods.map((m) => m.content);
  const artifactContents = artifacts.map((a) => a.content);

  const sourceIds = [task, ...methods, ...artifacts]
    .filter((m): m is WorkMemory => !!m)
    .map((m) => m.id);

  // 置信度：task + method + artifact 三者加权
  let confidence = 0;
  if (task) confidence += 0.35;
  if (methods.length > 0) confidence += 0.35;
  if (artifacts.length > 0) confidence += 0.30;

  // 无 task（目标不明）时，method 的复用价值打折
  if (!task) confidence = Math.min(confidence, 0.5);

  const reusable = confidence >= threshold && steps.length >= minSteps;

  const name = task
    ? task.content
    : methods[0]?.content ?? "unnamed-playbook";

  return {
    id: `pb_${sourceIds.join("_").slice(0, 64) || "empty"}`,
    name,
    steps,
    artifacts: artifactContents,
    sourceIds,
    confidence: Math.round(confidence * 100) / 100,
    reusable,
  };
}

/**
 * 沉淀链判定：从一组工作记忆识别「同 task 的方法 + 产物」，供调用方分组后
 * 逐个 assemblePlaybook。返回按 taskId 分组的 key（无 taskId 用 domain 兜底）。
 */
export function groupKeyForWorkMemory(m: WorkMemory): string {
  return m.taskId ?? `taskless:${m.type}`;
}