/**
 * 输出预算规则 — 对 query/context/impact 的返回结果做 maxTokens 截断。
 * （融合自原代码分析工具链的输出预算实现，代码级集成）
 */

const BUDGETED_TOOLS = new Set(['query', 'context', 'impact']);

export const TOKEN_ESTIMATE_BYTES = 4;
export const TRUNCATION_MARKER = '\n…';

function parsePositiveInteger(value: unknown, source: string): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`${source} must be a positive integer.`);
}

export function resolveMcpMaxTokens(
  toolName: string,
  args: Record<string, unknown> | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  if (!BUDGETED_TOOLS.has(toolName)) return undefined;
  if (args?.maxTokens !== undefined) return parsePositiveInteger(args.maxTokens, 'maxTokens');

  const configured = env.ANALYSIS_DEFAULT_MAX_TOKENS;
  if (configured === undefined || configured.trim() === '') return undefined;
  return parsePositiveInteger(configured, 'ANALYSIS_DEFAULT_MAX_TOKENS');
}

function utf8Prefix(text: string, maxBytes: number): string {
  let bytes = 0;
  const codePoints: string[] = [];
  for (const codePoint of text) {
    const codePointBytes = Buffer.byteLength(codePoint, 'utf8');
    if (bytes + codePointBytes > maxBytes) break;
    codePoints.push(codePoint);
    bytes += codePointBytes;
  }
  return codePoints.join('');
}

export function applyMcpMaxTokens(text: string, maxTokens: number | undefined): string {
  if (maxTokens === undefined) return text;

  const textBytes = Buffer.byteLength(text, 'utf8');
  if (maxTokens >= Math.ceil(textBytes / TOKEN_ESTIMATE_BYTES)) return text;

  const maxBytes = maxTokens * TOKEN_ESTIMATE_BYTES;
  const markerBytes = Buffer.byteLength(TRUNCATION_MARKER, 'utf8');
  return utf8Prefix(text, Math.max(0, maxBytes - markerBytes)) + TRUNCATION_MARKER;
}
