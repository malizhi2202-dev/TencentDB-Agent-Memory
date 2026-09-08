/**
 * Playbook Synthesis（沉淀检测编排，P1.3 资产演进）.
 *
 * 对标 Agent OS 的「ExecutableScene 沉淀」：从平铺的工作记忆（work_task /
 * work_method / work_artifact）中，识别「同一任务簇」，把可复用流程固化为
 * playbook。与 dreaming 的离线巩固类似，这是「事后沉淀」而非写入时。
 *
 * 本模块是纯编排（无 IO）：输入工作记忆列表 → 按 taskId 分组 → 每组组装
 * playbook → 只输出 reusable 的（有步骤、置信度达标）。
 */

import { assemblePlaybook, groupKeyForWorkMemory, type Playbook, type PlaybookOptions, type WorkMemory } from "./playbook.js";

export interface SynthesisResult {
  playbooks: Playbook[];
  /** 因缺 method（无步骤，不可复用）被跳过的任务簇数 */
  skippedNoSteps: number;
}

/**
 * 沉淀检测：把工作记忆簇固化为可复用 playbook。
 * - 只处理有 work_method 的簇（无步骤 = 无流程，不可沉淀为 playbook）
 * - 无 taskId 的工作记忆按 type 兜底分组（taskless:work_method 等同型合并）
 */
export function synthesizePlaybooks(memories: WorkMemory[], opts: PlaybookOptions = {}): SynthesisResult {
  const groups = new Map<string, WorkMemory[]>();
  for (const m of memories) {
    const key = groupKeyForWorkMemory(m);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  const playbooks: Playbook[] = [];
  let skippedNoSteps = 0;

  for (const group of groups.values()) {
    const task = group.find((m) => m.type === "work_task");
    const methods = group.filter((m) => m.type === "work_method");
    const artifacts = group.filter((m) => m.type === "work_artifact");

    if (methods.length === 0) {
      skippedNoSteps++;
      continue;
    }

    const pb = assemblePlaybook(task, methods, artifacts, opts);
    if (pb.reusable) {
      playbooks.push(pb);
    }
  }

  return { playbooks, skippedNoSteps };
}