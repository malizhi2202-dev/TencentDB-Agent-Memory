/**
 * Consolidation Metrics（巩固健康度监控，P2 监控）.
 *
 * 补齐对比文档 §8 的「监控」缺失：TencentDB 的 metric-tracking 覆盖了写入/召回
 * 的耗时与命中数，但没有「巩固（dreaming/consolidation）」健康度——每次离线
 * 巩固执行了多少 plan、失败多少、按动作分布如何。工程上需要观测「记忆闭环
 * 到底成没成」，否则一致性问题只能在用户侧暴露。
 *
 * 本模块是纯逻辑（无 IO）：输入多次 consolidate 的运行结果（plan 列表 +
 * ConsolidationResult），聚合成健康度指标，供 metric 后端上报（console/OTLP/
 * ClickHouse 等现有 channel）。
 */

import type { ConsolidationPlan } from "./dreaming.js";
import type { ConsolidationResult } from "./consolidation-executor.js";
import type { LifecycleAction } from "./memory-lifecycle.js";

export interface ConsolidationRun {
  plans: ConsolidationPlan[];
  result: ConsolidationResult;
}

export interface ConsolidationMetrics {
  totalRuns: number;
  totalPlans: number;
  totalExecuted: number;
  totalFailed: number;
  /** failed / executed+failed（执行不成的占比） */
  failureRate: number;
  /** 按动作分布（merge/archive/link/...） */
  byAction: Record<LifecycleAction, number>;
  byActionPlans: Record<LifecycleAction, number>;
}

const EMPTY_BY_ACTION: Record<LifecycleAction, number> = {
  merge: 0,
  archive: 0,
  update: 0,
  link: 0,
  keep: 0,
};

/** 聚合多次巩固运行 → 健康度指标。 */
export function aggregateConsolidation(runs: ConsolidationRun[]): ConsolidationMetrics {
  const byAction: Record<LifecycleAction, number> = { merge: 0, archive: 0, update: 0, link: 0, keep: 0 };
  const byActionPlans: Record<LifecycleAction, number> = { merge: 0, archive: 0, update: 0, link: 0, keep: 0 };

  let totalPlans = 0;
  let totalExecuted = 0;
  let totalFailed = 0;

  for (const run of runs) {
    totalPlans += run.plans.length;
    totalExecuted += run.result.executed;
    totalFailed += run.result.failed.length;

    for (const plan of run.plans) {
      byActionPlans[plan.action] = (byActionPlans[plan.action] ?? 0) + 1;
    }
    // 已执行的动作 = plans 减去失败的（失败按 plan.fromId 对照）
    // 简化：按 plan.action 计数已成功执行（成功数 = plans.length - failed.length）
    // 精确到动作级别需要执行结果带 action，这里按 plan 归属近似统计。
  }

  // 失败的 plan 从 byActionPlans 里扣除（按 action 均摊不精确，这里按 fromId 无法区分 action，
  // 因此 byAction 用「计划动作」统计，失败率单独给整体值，够监控用）。
  Object.assign(byAction, byActionPlans);

  const attempted = totalExecuted + totalFailed;
  const failureRate = attempted > 0 ? totalFailed / attempted : 0;

  return {
    totalRuns: runs.length,
    totalPlans,
    totalExecuted,
    totalFailed,
    failureRate: Math.round(failureRate * 1000) / 1000,
    byAction,
    byActionPlans,
  };
}

/** 空指标（初始态）。 */
export function emptyConsolidationMetrics(): ConsolidationMetrics {
  return {
    totalRuns: 0,
    totalPlans: 0,
    totalExecuted: 0,
    totalFailed: 0,
    failureRate: 0,
    byAction: { ...EMPTY_BY_ACTION },
    byActionPlans: { ...EMPTY_BY_ACTION },
  };
}