/**
 * Guardrail（召回内容注入防护，P2 治理）.
 *
 * 补齐对比文档 §7 的「护栏」缺失：L1 记忆内容会经 recall 回注进模型上下文。
 * 若记忆在写入时被恶意构造（prompt injection），回注即等于把攻击载荷送进模型。
 * 脱敏（redaction.ts）挡住泄密，护栏挡住「注入」——在召回注入前检测记忆
 * 内容里的指令劫持模式，按 severity 分级处置（high 拒绝 / medium 警告）。
 *
 * 本模块是纯逻辑（无 IO）：输入记忆内容，输出「是否注入 + 严重度 + 命中模式」，
 * 配合 McLean 的 lenient/standard/strict 三档策略使用。
 */

export type InjectionSeverity = "high" | "medium" | "none";

export interface InjectionCheck {
  isInjection: boolean;
  severity: InjectionSeverity;
  /** 命中的模式标签（用于审计/监控） */
  matched: string[];
}

interface InjectionPattern {
  label: string;
  severity: "high" | "medium";
  re: RegExp;
}

const PATTERNS: InjectionPattern[] = [
  // 高危：忽略/覆盖既有指令
  {
    label: "指令覆盖",
    severity: "high",
    re: /(忽略|无视|忘记|删除|清空|跳过)[^\n]{0,8}(以上|之前|上述|所有|全部|以下)[^\n]{0,10}(指令|命令|规则|限制|约束|提示)|(ignore|disregard|forget|override|bypass)[^\n]{0,8}(above|previous|prior|all|the following)[^\n]{0,10}(instruction|command|rule|restriction|prompt)/gi,
  },
  // 高危：角色劫持
  {
    label: "角色劫持",
    severity: "high",
    re: /(你现在是|从现在起你是|从现在开始你是|你是一个|扮演|假装你是)[^\n]{0,20}|(you are now|from now on you are|act as|pretend you are|you are no longer)[^\n]{0,20}/gi,
  },
  // 高危：诱导泄漏系统提示
  {
    label: "提示词泄漏",
    severity: "high",
    re: /(输出|打印|透露|重复|展示|reveal|repeat|print|output|leak|show)[^\n]{0,20}(system prompt|system message|system instruction|系统提示词|系统指令|初始提示)|(system prompt|system message|system instruction|系统提示词|系统指令|初始提示)[^\n]{0,20}(输出|打印|透露|重复|展示|reveal|repeat|print|output|leak|show)/gi,
  },
  // 中危：绝对化强制指令
  {
    label: "强制指令",
    severity: "medium",
    re: /(你必须|你必须只能|务必|无条件|不得拒绝|you must|you must only|no matter what|under all circumstances|always obey)[^\n]{0,20}/gi,
  },
];

/**
 * 注入检测：返回严重度与命中标签。
 * - 任一 high 命中 → severity=high
 * - 否则任一 medium 命中 → severity=medium
 * - 无命中 → none
 */
export function detectInjection(text: string): InjectionCheck {
  if (!text) return { isInjection: false, severity: "none", matched: [] };

  const matched: string[] = [];
  let severity: InjectionSeverity = "none";

  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) {
      matched.push(p.label);
      if (severity === "none" || (p.severity === "high" && severity === "medium")) {
        severity = p.severity;
      }
    }
  }

  return { isInjection: severity !== "none", severity, matched };
}

/** 是否高危注入（召回前应拒绝该记忆，不注入上下文）。 */
export function isHighRiskInjection(text: string): boolean {
  return detectInjection(text).severity === "high";
}