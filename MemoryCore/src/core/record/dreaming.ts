/**
 * Dreaming 离线巩固编排（P1.2 记忆闭环）.
 *
 * 对标 MindMemOS `tool/dreaming/dreaming.py`：定期（离线）盘点现有记忆，
 * 两两检测 7 类关系，据此产生巩固计划（merge/archive/link/keep）。
 * 与「写入时」的 l1-dedup 不同，dreaming 处理的是「记忆与记忆之间」的
 * 事后关系（如多次写入产生重复、低价值、互补但未关联的记忆）。
 *
 * 本模块是**纯编排**（无 IO）：输入现有记忆 + 可选 LLM relation detector，
 * 输出确定性的巩固计划。执行（把 consolidated/archived 落库）由 store 层承接。
 * - 默认用启发式 detector（detectRelationByOverlap 覆盖 duplicate/near_duplicate）
 * - 传入自定义 detector（LLM）即可覆盖 conflict/complementary/ambiguous
 */

import { detectRelationByOverlap, decideLifecycleAction, isLowValue, type DreamingIssueType, type LifecycleAction, type MemoryLifecycleState } from "./memory-lifecycle.js";
import type { WritePolicy } from "./memory-domain.js";

export interface DreamingMemory {
  id: string;
  content: string;
  type: string;
  domain: string;
  writePolicy: WritePolicy;
  priority: number;
}

export interface ConsolidationPlan {
  action: LifecycleAction;
  /** 被巩固（merge 掉 / 归档 / 建边）的记忆 id */
  fromId: string;
  /** merge/link 的目标 id（archive/update/keep 时无） */
  toId?: string;
  newState: MemoryLifecycleState;
  reason: string;
}

export interface DreamingOptions {
  /** 自定义关系 detector（默认启发式；LLM detector 可补 conflict/complementary/ambiguous） */
  detector?: (a: DreamingMemory, b: DreamingMemory) => DreamingIssueType;
  /** 是否对每条记忆独立跑 low_value 检测（默认 true） */
  lowValueScan?: boolean;
}

/**
 * 离线巩固：返回确定性巩固计划（不重复巩固已 merge/archive 的记忆）。
 * 只比较同 domain 的记忆（跨 domain 不合并，语义隔离）。
 */
export function runDreamingConsolidation(memories: DreamingMemory[], opts: DreamingOptions = {}): ConsolidationPlan[] {
  const detector = opts.detector ?? ((a, b) => detectRelationByOverlap(a.content, b.content));
  const lowValueScan = opts.lowValueScan ?? true;
  const plans: ConsolidationPlan[] = [];
  const consumed = new Set<string>(); // 已被 merge/archive 的记忆不再作为源或目标

  // 按 domain 分组（只比较同 domain 的，避免跨空间误合并，也降低 O(n²)）
  const groups = new Map<string, DreamingMemory[]>();
  for (const m of memories) {
    const list = groups.get(m.domain) ?? [];
    list.push(m);
    groups.set(m.domain, list);
  }

  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (consumed.has(a.id)) continue;

      // 独立 low_value 检测（不依赖两两比较）
      if (lowValueScan && isLowValue(a.content, a.priority)) {
        const d = decideLifecycleAction("active", "low_value", { writePolicy: a.writePolicy });
        if (d.action !== "keep") {
          plans.push({ action: d.action, fromId: a.id, newState: d.newState, reason: d.reason });
          consumed.add(a.id);
          continue;
        }
      }

      // 两两检测：启发式 detector 只确定 duplicate/near_duplicate（merge 动作）
      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        if (consumed.has(b.id)) continue;
        const relation = detector(a, b);
        if (relation === "duplicate" || relation === "near_duplicate") {
          const d = decideLifecycleAction("active", relation, {
            writePolicy: a.writePolicy,
            targetWritePolicy: b.writePolicy,
          });
          if (d.action === "merge") {
            plans.push({ action: "merge", fromId: b.id, toId: a.id, newState: d.newState, reason: d.reason });
            consumed.add(b.id); // b 并入 a
          }
        }
      }
    }
  }

  return plans;
}