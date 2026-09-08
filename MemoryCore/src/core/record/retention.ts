/**
 * Recall Retention Layer（召回保留层，P0.2）.
 *
 * 在「召回候选」与「注入上下文」之间加一层：混合分数 + MMR 去冗余 +
 * token 预算约束下的选择。补齐 TencentDB 现有 RRF 排序的三大缺口：
 * 1. 无 recency（时间衰减）—— 只用 rank，不看时间
 * 2. 无 MMR 去冗余 —— 高相关但重复的记忆会挤占预算
 * 3. 无 token 成本感知 —— applyRecallBudget 只看字符数，不看 token
 *
 * 公式与参数对标 MindMemOS `components/searcher/memory_retention.py`：
 *   priority = 0.50*relevance + 0.25*query_overlap + 0.15*recency − 0.10*cost_ratio
 *   recency  = exp(−ln2 · age_days / 30)
 *   MMR      = λ·priority − (1−λ)·max_jaccard,  λ=0.70
 *   top_m_guarantee=5, max_candidates=100, token 估算 CJK ≈ 1 token/1.5 chars
 *
 * 本模块是纯逻辑（无 IO），全部可单测。
 */

export interface RetentionCandidate {
  id: string;
  /** 记忆内容（用于 Jaccard 去冗余） */
  content: string;
  /** 归一化相关性（RRF / cosine，0–1） */
  relevance: number;
  /** 查询重叠分数（query 与 content 的 token 重叠，0–1） */
  queryOverlap: number;
  /** 时新度（1=最新，0=极旧），exp(−ln2·age/30d) */
  recency: number;
  /** 成本比（tokens / budget，越高越贵，0–1+） */
  costRatio: number;
  /** content 的估算 token 数 */
  tokens: number;
}

export interface RetentionConfig {
  /** 总 token 预算（超出则停止选择） */
  tokenBudget: number;
  /** 强制保留的 top-priority 数（MMR 前的 relevrance 保底），默认 5 */
  topM?: number;
  /** MMR 权重 λ，默认 0.70 */
  lambda?: number;
  /** 候选上限，默认 100 */
  maxCandidates?: number;
}

export const RETENTION_DEFAULTS = {
  topM: 5,
  lambda: 0.70,
  maxCandidates: 100,
  halfLifeDays: 30,
} as const;

// ============================
// 基础公式
// ============================

/** 混合优先级分数（MindMemOS priority 公式）。 */
export function retentionPriority(c: RetentionCandidate): number {
  return 0.50 * c.relevance + 0.25 * c.queryOverlap + 0.15 * c.recency - 0.10 * c.costRatio;
}

/** 时新度衰减：exp(−ln2 · age_days / halfLifeDays)。30 天半衰期。 */
export function recencyDecay(ageDays: number, halfLifeDays: number = RETENTION_DEFAULTS.halfLifeDays): number {
  return Math.exp(-Math.LN2 * ageDays / halfLifeDays);
}

/** 两段文本的 token 集合 Jaccard 相似度（0–1）。 */
export function tokenJaccard(a: string, b: string): number {
  const sa = tokenize(a);
  const sb = tokenize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/**
 * 估算 token 数（对标 MindMemOS estimate_tokens）：
 * - CJK 字符约 1 token / 1.5 chars
 * - 非 CJK 每词 max(1, ceil(chars/8))
 * - 长 URL/hash 不会被算成单 token
 */
export function estimateTokens(text: string): number {
  const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  let cjkCount = 0;
  let nonCjkTokens = 0;
  let word = "";

  const flushWord = () => {
    if (word.length > 0) {
      nonCjkTokens += Math.max(1, Math.ceil(word.length / 8));
      word = "";
    }
  };

  for (const ch of text) {
    if (CJK_RE.test(ch)) {
      flushWord();
      cjkCount++;
    } else if (/\s/.test(ch)) {
      flushWord();
    } else {
      word += ch;
    }
  }
  flushWord();

  const total = nonCjkTokens + Math.ceil(cjkCount / 1.5);
  return Math.max(1, Math.round(total));
}

// ============================
// Token 化（用于 Jaccard / query overlap）
// ============================

function tokenize(text: string): Set<string> {
  const lower = text.toLowerCase();
  const cjk = lower.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? [];
  // 非 CJK 词（字母/数字/下划线），按标点切分
  const words = lower.match(/[a-z0-9_]+/g) ?? [];
  return new Set([...cjk, ...words]);
}

/** 查询重叠分数：query 与 content 的 token 重叠占比（0–1）。 */
export function queryOverlapScore(query: string, content: string): number {
  const q = tokenize(query);
  if (q.size === 0) return 0;
  const c = tokenize(content);
  let hit = 0;
  for (const t of q) if (c.has(t)) hit++;
  return hit / q.size;
}

// ============================
// Retention 选择（mixed-v2：priority 保底 + MMR）
// ============================

export interface RetentionSelection {
  selected: RetentionCandidate[];
  /** 选中项的总 token 数 */
  totalTokens: number;
  /** 因预算用尽未能保留的候选数 */
  dropped: number;
}

/**
 * 从候选中按「priority 保底 + MMR 去冗余 + token 预算」选择最终注入项。
 *
 * 流程（对标 MindMemOS mixed-v2）：
 * 1. 按 priority 排序，截断 max_candidates
 * 2. 强制保留 topM（priority 最高者，保证相关性不被 MMR 全部稀释）
 * 3. 其余按 MMR 贪心挑选，直到 token 预算用完
 * 4. 恢复候选在输入中的相对顺序（确定性、可读）
 */
export function selectRetention(candidates: RetentionCandidate[], config: RetentionConfig): RetentionSelection {
  const { tokenBudget } = config;
  const topM = config.topM ?? RETENTION_DEFAULTS.topM;
  const lambda = config.lambda ?? RETENTION_DEFAULTS.lambda;
  const maxCandidates = config.maxCandidates ?? RETENTION_DEFAULTS.maxCandidates;

  if (tokenBudget <= 0 || candidates.length === 0) {
    return { selected: [], totalTokens: 0, dropped: candidates.length };
  }

  // 1. 按 priority 排序 + 截断
  const ranked = candidates
    .map((c) => ({ c, priority: retentionPriority(c) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxCandidates);

  // 2. 强制保留 topM（按 priority），并累计 token
  const selected: RetentionCandidate[] = [];
  let usedTokens = 0;
  const selectedIds = new Set<string>();

  const forceKeep = ranked.slice(0, topM);
  for (const item of forceKeep) {
    if (usedTokens + item.c.tokens > tokenBudget) break;
    selected.push(item.c);
    selectedIds.add(item.c.id);
    usedTokens += item.c.tokens;
  }

  // 3. MMR 贪心选择剩余（去冗余 + 预算）
  const remaining = ranked.slice(topM).map((item) => item.c);

  let remainPool = remaining;
  while (remainPool.length > 0) {
    // 预算检查：若最小 token 候选都放不下，停止
    const minTokens = Math.min(...remainPool.map((c) => c.tokens));
    if (usedTokens + minTokens > tokenBudget) break;

    let best: RetentionCandidate | null = null;
    let bestScore = -Infinity;

    for (const c of remainPool) {
      // max Jaccard against selected（去冗余）
      let maxJac = 0;
      for (const s of selected) {
        const j = tokenJaccard(c.content, s.content);
        if (j > maxJac) maxJac = j;
      }
      const mmr = lambda * retentionPriority(c) - (1 - lambda) * maxJac;
      if (mmr > bestScore) {
        bestScore = mmr;
        best = c;
      }
    }

    if (!best) break;
    if (usedTokens + best.tokens > tokenBudget) {
      // 当前 best 放不下，从候选池移除并继续找更小的（实际所有候选 token 都 >= best？否）
      // 简化：break；更精确的做法是移除 best 后继续，但 best 是 MMR 最高者，
      // 若它放不下，说明预算确实紧张。这里选择移除 best 继续尝试更小者。
      remainPool = remainPool.filter((c) => c.id !== best!.id);
      continue;
    }
    selected.push(best);
    selectedIds.add(best.id);
    usedTokens += best.tokens;
    remainPool = remainPool.filter((c) => c.id !== best.id);
  }

  // 4. 恢复输入相对顺序（稳定、可读）
  const order = new Map(candidates.map((c, i) => [c.id, i]));
  const ordered = selected.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { selected: ordered, totalTokens: usedTokens, dropped: candidates.length - ordered.length };
}