/**
 * 代码分析规则入口 — 检查规则表 + 统一规则应用（执行前只读校验 / 执行后输出预算）。
 * 策略实现来自同目录 output-budget.ts / read-only-policy.ts（GitNexus 代码级集成），
 * CheckRule 类型与 gitnexus/rules.ts 共享（同一张检查规则表形状）。
 */
import type { CheckRule } from "../gitnexus/rules.js";
import {
  READ_ONLY_TOOLS,
  resolveReadOnlyMode,
  assertReadOnlyToolCall,
} from "./read-only-policy.js";
import {
  TRUNCATION_MARKER,
  resolveMcpMaxTokens,
  applyMcpMaxTokens,
} from "./output-budget.js";

export const ANALYSIS_CHECK_RULES: CheckRule[] = [
  {
    id: "todo-fixme-hack",
    severity: "info",
    description: "TODO/FIXME/HACK 标记",
    match: (c) => c.includes("TODO") || c.includes("FIXME") || c.includes("HACK"),
  },
  {
    id: "console-log",
    severity: "warn",
    description: "函数内 console.log 调试输出",
    match: (c, kind) => c.includes("console.log") && kind === "function",
  },
  {
    id: "any-type",
    severity: "warn",
    description: "类型/接口中使用 any",
    match: (c, kind) => c.includes("any") && (kind === "type" || kind === "interface"),
  },
  {
    id: "debugger-statement",
    severity: "error",
    description: "debugger 语句",
    match: (c) => c.includes("debugger;") || c.includes("\ndebugger\n"),
  },
  {
    id: "empty-catch",
    severity: "warn",
    description: "空 catch 块（静默吞异常）",
    match: (c) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(c),
  },
  {
    id: "ts-ignore",
    severity: "warn",
    description: "@ts-ignore 抑制类型错误",
    match: (c) => c.includes("@ts-ignore") || c.includes("@ts-nocheck"),
  },
  {
    id: "hardcoded-secret",
    severity: "error",
    description: "疑似硬编码密钥/密码",
    match: (c) => /(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(c),
  },
  {
    id: "nested-callback",
    severity: "info",
    description: "深层嵌套回调（回调地狱信号）",
    match: (c) => (c.match(/=>/g)?.length ?? 0) >= 5,
  },
];

// ─────────────────────── 统一规则应用入口 ───────────────────────

export interface AnalysisRuleContext {
  /** 仓库根目录（用于忽略清单/只读判定） */
  repoPath?: string;
}

/**
 * 执行前的规则校验：只读策略（若 ANALYSIS_READ_ONLY=1，写工具被拒绝）。
 */
export function assertRulesBeforeExecute(toolName: string, params: Record<string, unknown>): void {
  const readOnly = resolveReadOnlyMode();
  if (readOnly) {
    assertReadOnlyToolCall(toolName, params, true);
  }
}

/**
 * 执行后的规则应用：输出预算截断（query/context/impact）。
 */
export function applyRulesAfterExecute(
  toolName: string,
  params: Record<string, unknown>,
  text: string,
): string {
  const maxTokens = resolveMcpMaxTokens(toolName, params);
  return applyMcpMaxTokens(text, maxTokens);
}

export { READ_ONLY_TOOLS, TRUNCATION_MARKER };