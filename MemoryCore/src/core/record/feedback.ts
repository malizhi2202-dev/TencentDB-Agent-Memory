/**
 * Feedback（记忆反馈信号 → 动作，P1.2 记忆闭环）.
 *
 * 补齐对比文档 §6 的 Feedback 缺失：TencentDB 现有 pipeline 是「单向抽取」
 * （L0→L1→L2→L3），没有「反馈回路」——用户的纠正/确认/遗忘、召回被忽略
 * 等信号不会回流修正记忆。
 *
 * 对标 MindMemOS `components/tool_exec/feedback_executor.py`：
 * - 显式信号（用户纠正/遗忘/确认）→ update/archive/reinforce
 * - 隐式信号（召回被忽略/矛盾）→ downgrade/冲突标记
 * - 与 P0.1 持久守卫一致：系统隐式信号（downgrade）不能覆盖 explicit_only
 *   （用户显式持久更改），只有用户显式信号（correction/forget）可改它。
 *
 * 本模块是纯逻辑（无 IO）：信号 + 来源 + 策略 → 动作。信号「检测」由
 * 调用方（LLM 或规则）承担，检测后本模块负责「该不该执行、怎么执行」。
 */

import type { WritePolicy } from "./memory-domain.js";

export type FeedbackSignal = "correction" | "confirmation" | "contradiction" | "disregard" | "explicit_forget";

export type FeedbackSource = "user_explicit" | "system_implicit";

export type FeedbackAction = "update" | "archive" | "reinforce" | "downgrade" | "keep";

export interface FeedbackDecision {
  action: FeedbackAction;
  reason: string;
}

export interface FeedbackContext {
  writePolicy: WritePolicy;
}

/** 用户显式信号（可作用于 explicit_only 持久更改）。 */
const USER_EXPLICIT_SIGNALS: ReadonlySet<FeedbackSignal> = new Set(["correction", "confirmation", "contradiction", "explicit_forget"]);

/**
 * 反馈信号 → 动作（含持久守卫）。
 *
 * 铁律：隐式系统信号（contradiction 降权、disregard 降权）不得覆盖
 * explicit_only（用户显式持久更改）；只有用户显式信号可改它。
 */
export function feedbackToAction(
  signal: FeedbackSignal,
  source: FeedbackSource,
  ctx: FeedbackContext,
): FeedbackDecision {
  const isPersistent = ctx.writePolicy === "explicit_only";
  const isUserExplicit = source === "user_explicit" && USER_EXPLICIT_SIGNALS.has(signal);

  switch (signal) {
    case "correction":
      // 用户纠正 → 更新内容（用户显式，可改持久更改）
      return { action: "update", reason: "user correction updates the memory content" };
    case "confirmation":
      // 用户确认采纳 → 强化（升权/提置信度）
      return { action: "reinforce", reason: "user confirmation reinforces the memory" };
    case "contradiction":
      // 矛盾 → 需要裁决。用户显式矛盾可触发 update（修正）；隐式矛盾只能 keep（待裁决）
      if (isUserExplicit) {
        return { action: "update", reason: "user contradicted the memory — correct it" };
      }
      return { action: "keep", reason: "implicit contradiction — mark for arbitration, no auto change" };
    case "disregard":
      // 召回被忽略 → 降权。系统隐式，不可作用于持久更改
      if (isPersistent) {
        return { action: "keep", reason: "cannot downgrade explicit_only persistent change on implicit disregard" };
      }
      return { action: "downgrade", reason: "recalled memory disregarded — downgrade relevance" };
    case "explicit_forget":
      // 用户显式遗忘 → 归档（用户显式，可归档持久更改）
      return { action: "archive", reason: "user explicitly forgot the memory — archive" };
    default:
      return { action: "keep", reason: `unknown signal=${signal}` };
  }
}

/** 反馈信号是否属于「用户显式」（可覆盖持久更改）。 */
export function isUserExplicitSignal(signal: FeedbackSignal): boolean {
  return USER_EXPLICIT_SIGNALS.has(signal);
}