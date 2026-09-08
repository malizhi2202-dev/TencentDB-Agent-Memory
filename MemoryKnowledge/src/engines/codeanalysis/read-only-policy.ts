/**
 * 只读策略规则 — 只读模式下仅允许查询类工具，写工具被拒绝。
 * （融合自原代码分析工具链的只读策略实现，代码级集成）
 */

/** 只读模式下允许的工具 */
export const READ_ONLY_TOOLS = new Set([
  'list_repos',
  'query',
  'context',
  'detect_changes',
  'check',
  'impact',
  'explain',
  'pdg_query',
  'route_map',
  'tool_map',
  'shape_check',
  'api_impact',
  'trace',
]);

const READ_ONLY_ALIASES = new Set(['search', 'explore', 'overview']);

/** 从环境变量解析只读模式（ANALYSIS_READ_ONLY=0|1） */
export function resolveReadOnlyMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ANALYSIS_READ_ONLY?.trim();
  if (value === undefined || value === '' || value === '0') return false;
  if (value === '1') return true;
  throw new Error('ANALYSIS_READ_ONLY must be 0 or 1.');
}

/** 只读模式下校验工具调用：写工具被拒绝 */
export function assertReadOnlyToolCall(
  toolName: string,
  args: Record<string, unknown> | undefined,
  readOnly: boolean,
): void {
  if (!readOnly) return;
  if (!READ_ONLY_TOOLS.has(toolName) && !READ_ONLY_ALIASES.has(toolName)) {
    throw new Error(`Tool "${toolName}" is not available in read-only mode.`);
  }
  if (typeof args?.repo === 'string' && args.repo.trim().startsWith('@')) {
    throw new Error('Group routing is not available in read-only mode.');
  }
  for (const groupOnlyArg of ['crossDepth', 'subgroup']) {
    if (args?.[groupOnlyArg] !== undefined) {
      throw new Error(
        `Parameter "${groupOnlyArg}" is not available in read-only mode.`,
      );
    }
  }
}
