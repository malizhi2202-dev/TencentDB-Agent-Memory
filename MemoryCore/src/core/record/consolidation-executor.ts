/**
 * Consolidation Executor（巩固计划执行层，P1.2 接线）.
 *
 * 把 dreaming.ts 的纯编排计划真正执行到 store：
 * - merge  → 删除被合并的冗余记忆（保留 toId，语义同 l1-dedup 的 merge 收尾）
 * - archive → 把记忆 domain 改为 archive（软归档：defaultRecall=false，不删除，
 *   保留可恢复 + 可检索，语义同 MindMemOS 的 soft-archive）
 * - link / update / keep → 不在此层处理（link 需关系边存储、update 需 LLM 合并文本，
 *   由调用方承接；本层只负责「无歧义、可安全自动执行」的 merge/archive）
 *
 * 执行层对每个 plan 做 try/catch 隔离：单条失败不影响其它 plan，并返回失败 id 列表，
 * 供调用方观测巩固的健康度（对 P2 监控的 consolidation 指标）。
 */

import type { IMemoryStore, IsolationFilter, L1RecordRow } from "../store/types.js";
import type { MemoryRecord } from "./l1-writer.js";
import type { ConsolidationPlan } from "./dreaming.js";

export interface ConsolidationResult {
  executed: number;
  failed: string[];
}

/** L1RecordRow（store flat 结构）→ MemoryRecord（l1-writer 结构）。 */
export function rowToMemoryRecord(row: L1RecordRow): MemoryRecord {
  let metadata: MemoryRecord["metadata"] = {};
  try {
    if (row.metadata_json) metadata = JSON.parse(row.metadata_json);
  } catch {
    metadata = {};
  }
  return {
    id: row.record_id,
    content: row.content,
    type: row.type as MemoryRecord["type"],
    priority: row.priority,
    scene_name: row.scene_name,
    source_message_ids: [],
    metadata,
    timestamps: [row.timestamp_str, row.timestamp_start, row.timestamp_end].filter(Boolean),
    createdAt: row.created_time,
    updatedAt: row.updated_time,
    version: row.version,
    sessionKey: row.session_key,
    sessionId: row.session_id,
    taskId: row.task_id || undefined,
    domain: (row.domain || undefined) as MemoryRecord["domain"],
    write_policy: (row.write_policy || undefined) as MemoryRecord["write_policy"],
    spaceId: row.space_id || undefined,
  } as MemoryRecord;
}

/**
 * 执行巩固计划（merge/archive）。单条失败隔离并收集。
 */
export async function executeConsolidation(
  store: IMemoryStore,
  plans: ConsolidationPlan[],
  filter?: IsolationFilter,
): Promise<ConsolidationResult> {
  const failed: string[] = [];
  let executed = 0;

  for (const plan of plans) {
    try {
      if (plan.action === "merge") {
        await store.deleteL1(plan.fromId, filter);
        executed++;
      } else if (plan.action === "archive") {
        const rows = await store.queryL1Records({ recordIds: [plan.fromId] });
        const row = rows.find((r) => r.record_id === plan.fromId);
        if (!row) {
          failed.push(plan.fromId);
          continue;
        }
        const record = rowToMemoryRecord(row);
        record.domain = "archive";
        record.write_policy = record.write_policy ?? "automatic";
        record.updatedAt = new Date().toISOString();
        await store.upsertL1(record, undefined);
        executed++;
      }
      // link/update/keep 不在此层自动执行
    } catch {
      failed.push(plan.fromId);
    }
  }

  return { executed, failed };
}