/**
 * Redaction（记忆内容敏感信息脱敏，P2 治理）.
 *
 * 补齐对比文档 §7 的「治理」缺失：TencentDB 现有脱敏只在 api-trace 层
 * （请求/响应日志），**记忆内容**（写入 L1 的 content）没有脱敏——密码、密钥、
 * PII 会原样沉淀进记忆并随 recall 回注模型，构成泄密 + 注入双重风险。
 *
 * 对标 MindMemOS 的脱敏（涉密信息写入前清场）：本模块是纯逻辑（无 IO），
 * 在 l1-writer 写入前对 content 做规则脱敏。脱敏类别：
 * - 邮箱 / 手机号 / 身份证（PII）
 * - API key（OpenAI/AWS/Google/GitHub 常见前缀）/ JWT（凭据）
 * - 密码赋值（password/secret/token=...）
 *
 * 返回 findings 供监控（P2）统计「每次写入拦了多少敏感信息」，可观测、可审计。
 */

export type SensitiveKind = "email" | "phone" | "id_card" | "api_key" | "jwt" | "password";

export interface RedactionFinding {
  kind: SensitiveKind;
  /** 检出值（截断到 32 字符，避免 findings 本身泄漏） */
  sample: string;
  index: number;
}

export interface RedactionResult {
  redacted: string;
  findings: RedactionFinding[];
  count: number;
  changed: boolean;
}

interface Pattern {
  kind: SensitiveKind;
  re: RegExp;
  /** 生成替换文本（可用正则捕获组保留 key 等上下文） */
  redact: (m: RegExpExecArray) => string;
}

const PATTERNS: Pattern[] = [
  // 顺序敏感：先凭据（长 token）再 PII，避免截断影响后续匹配
  { kind: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, redact: () => "<JWT>" },
  {
    kind: "api_key",
    re: /\b(sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    redact: () => "<API_KEY>",
  },
  { kind: "password", re: /\b(password|passwd|pwd|secret|token|密码|口令|密钥)\s*[:=]\s*["']?[^\s"'`,;]{6,}["']?/gi, redact: (m) => `${m[1]}=<REDACTED>` },
  { kind: "id_card", re: /(?<!\d)\d{17}[\dXx](?!\d)/g, redact: () => "<ID_CARD>" },
  { kind: "phone", re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, redact: () => "<PHONE>" },
  { kind: "email", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, redact: () => "<EMAIL>" },
];

/** 对文本做敏感信息脱敏。 */
export function redactSensitive(text: string): RedactionResult {
  if (!text) return { redacted: text, findings: [], count: 0, changed: false };

  const findings: RedactionFinding[] = [];

  // 分阶段替换：先用「掩码 token」占位，避免密码正则的 $1 替换与其它模式冲突
  let working = text;
  for (const p of PATTERNS) {
    let m: RegExpExecArray | null;
    p.re.lastIndex = 0;
    while ((m = p.re.exec(working)) !== null) {
      findings.push({ kind: p.kind, sample: m[0].slice(0, 32), index: m.index });
      const replacement = p.redact(m);
      working = working.slice(0, m.index) + replacement + working.slice(m.index + m[0].length);
      p.re.lastIndex = m.index + replacement.length;
    }
  }

  return {
    redacted: working,
    findings,
    count: findings.length,
    changed: findings.length > 0,
  };
}

/** 是否需要脱敏（无 IO 的快速判定，供写入前短路）。 */
export function hasSensitive(text: string): boolean {
  if (!text) return false;
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) return true;
  }
  return false;
}