/**
 * Feedback Detection（反馈信号检测，P1.2 §4.2 深化）.
 *
 * feedback.ts 只覆盖「信号 → 动作」半环；这里补「检测」半环——从用户消息/
 * 会话文本中识别反馈信号，与 feedbackToAction 合并即完整 Feedback 回路：
 *   用户文本 → detectFeedbackSignal → feedbackToAction → update/archive/...
 *
 * 对标 MindMemOS 的 implicit 信号检测（temperature=0 LLM 从会话负面轮次检测）。
 * 本模块是**规则版**（无 LLM 依赖，确定性、可单测且零成本），LLM detector
 * 可作为更高召回率的可插拔替换（同一信号契约）。
 *
 * 优先级：explicit_forget > correction > contradiction > confirmation > disregard
 * （遗忘/纠正最具体，先匹配；确认/忽略较泛，后匹配，避免「对」误吞「不对」）。
 */

import type { FeedbackSignal, FeedbackSource } from "./feedback.js";

export interface DetectedFeedback {
  signal: FeedbackSignal;
  source: FeedbackSource;
}

const RULES: Array<{ signal: FeedbackSignal; source: FeedbackSource; re: RegExp }> = [
  { signal: "explicit_forget", source: "user_explicit", re: /(忘掉|忘记|删掉|删除这条|别记|不要这个|移除|清除这)/ },
  { signal: "contradiction", source: "user_explicit", re: /(相反|你之前说|矛盾|不是这么回事|你搞错了|你记错了)/ },
  { signal: "correction", source: "user_explicit", re: /(不对|不是这样|错了|应该是|改成|纠正|更正|其实是)/ },
  { signal: "confirmation", source: "user_explicit", re: /(没错|正是|记住这个|就是这样|确认|说得对)/ },
  { signal: "disregard", source: "system_implicit", re: /(不相关|没用|别扯|无关|不需要这个|跟这个没关系|跑题)/ },
];

/**
 * 从文本检测反馈信号（取第一个命中的，按 RULES 顺序 = 优先级）。
 * 无命中返回 null（调用方视为无反馈）。
 */
export function detectFeedbackSignal(text: string): DetectedFeedback | null {
  if (!text) return null;
  for (const r of RULES) {
    r.re.lastIndex = 0;
    if (r.re.test(text)) {
      return { signal: r.signal, source: r.source };
    }
  }
  return null;
}

/** 文本是否含有任何反馈信号。 */
export function hasFeedbackSignal(text: string): boolean {
  return detectFeedbackSignal(text) !== null;
}