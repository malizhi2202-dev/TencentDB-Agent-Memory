/**
 * Retrieval Evaluator（召回评测基准，P2 评测）.
 *
 * 补齐对比文档 §8 的「评测」缺失：TencentDB 有 metric-tracking（召回耗时/命中数），
 * 但没有「检索质量」评测——召回结果与 ground truth 的 recall/precision/MRR/NDCG。
 * MindMemOS 与 Agent OS 都有 retrieval 评测基准（query + 相关记忆 → 指标）。
 *
 * 本模块是纯逻辑（无 IO）：输入评测条目（query + 相关 id + 检索结果），
 * 输出标准 IR 指标。评测集与召回执行由调用方提供，这里只做「算分」——
 * 确定性、可单测、可接入 CI 作回归门槛。
 */

export interface EvalItem {
  query: string;
  /** ground truth：该 query 的相关记忆 id */
  relevantIds: string[];
  /** 检索结果（按 rank 降序，index 0 = rank 1） */
  retrievedIds: string[];
}

export interface EvalMetrics {
  /** top-k 召回率：命中相关 / 总相关 */
  recallAtK: number;
  /** top-k 精确率：命中相关 / k */
  precisionAtK: number;
  /** 平均倒数排名（首个相关结果的倒数 rank 均值） */
  mrr: number;
  /** nDCG@k（二值相关） */
  ndcgAtK: number;
  k: number;
  /** 评测条目数 */
  itemCount: number;
}

/** 单个 item 的 top-k 指标（供诊断）。 */
export interface ItemMetrics {
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
  dcg: number;
  idcg: number;
}

function itemMetrics(item: EvalItem, k: number): ItemMetrics {
  const relevant = new Set(item.relevantIds);
  const topK = item.retrievedIds.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  const totalRelevant = relevant.size;

  const recallAtK = totalRelevant > 0 ? hits / totalRelevant : 0;
  const precisionAtK = topK.length > 0 ? hits / topK.length : 0;

  // MRR：第一个相关结果的位置（rank 从 1 起）
  let reciprocalRank = 0;
  const firstHit = topK.findIndex((id) => relevant.has(id));
  if (firstHit >= 0) reciprocalRank = 1 / (firstHit + 1);

  // DCG@k（二值相关：命中=1，未命中=0），标准 log2 折损
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    if (relevant.has(topK[i])) {
      dcg += 1 / Math.log2(i + 2); // rank i+1 → log2(i+2)
    }
  }
  // IDCG@k：理想排序（所有相关排最前）
  const idealHits = Math.min(totalRelevant, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return { recallAtK, precisionAtK, reciprocalRank, dcg, idcg };
}

/**
 * 聚合评测：返回 recall@k / precision@k / MRR / nDCG@k 均值。
 */
export function evaluateRetrieval(items: EvalItem[], k: number): EvalMetrics {
  if (items.length === 0) {
    return { recallAtK: 0, precisionAtK: 0, mrr: 0, ndcgAtK: 0, k, itemCount: 0 };
  }

  const metrics = items.map((item) => itemMetrics(item, k));
  const sum = (fn: (m: ItemMetrics) => number) => metrics.reduce((acc, m) => acc + fn(m), 0);

  const recallAtK = sum((m) => m.recallAtK) / items.length;
  const precisionAtK = sum((m) => m.precisionAtK) / items.length;
  const mrr = sum((m) => m.reciprocalRank) / items.length;
  // nDCG：dcg/idcg 均值（idcg=0 时该 item 贡献 0）
  const ndcgAtK =
    metrics.reduce((acc, m) => acc + (m.idcg > 0 ? m.dcg / m.idcg : 0), 0) / items.length;

  return { recallAtK, precisionAtK, mrr, ndcgAtK, k, itemCount: items.length };
}

/** 达标判定：给定阈值（供 CI 回归门槛）。 */
export function passesThreshold(metrics: EvalMetrics, threshold: Partial<Pick<EvalMetrics, "recallAtK" | "mrr" | "ndcgAtK">>): boolean {
  if (threshold.recallAtK !== undefined && metrics.recallAtK < threshold.recallAtK) return false;
  if (threshold.mrr !== undefined && metrics.mrr < threshold.mrr) return false;
  if (threshold.ndcgAtK !== undefined && metrics.ndcgAtK < threshold.ndcgAtK) return false;
  return true;
}