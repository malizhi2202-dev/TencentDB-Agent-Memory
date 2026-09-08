/**
 * model/types.ts — 模型层公共类型（模仿 deepseek-harness 的 dsh-llm 抽象）。
 *
 * 三层职责：
 *   - 添加模型：model catalog（ModelInfo / DiscoveredModel）+ 运行时发现（discoverModels）
 *   - 模型适配层：ModelAdapter（provider 协议适配）
 *   - 运行模型：ModelRuntime（注册表 + 按 provider/model 路由）
 *
 * 与 dsh-llm 的差异：这里保持非流式（complete → string），底层复用 Vercel AI SDK，
 * 只为记忆抽取（L1/L2/L3/skill）服务，不引入 StreamChunk / SSE 协议。
 */

import type { LLMRunParams } from "../core/types.js";
import type { LLMUsage } from "../core/report/metric-tracking-runner.js";

/** 一个已注册 provider 路由的展示元数据。 */
export interface ModelProviderInfo {
  /** provider 路由键（如 "openai" / "deepseek" / "acme-gateway"）。 */
  id: string;
  /** 人类可读名称，用于选择器与诊断。 */
  name: string;
  /** 该 provider 的 endpoint 基地址（有则展示，便于诊断）。 */
  baseUrl?: string;
  /** 该 provider 是否已激活（已注册 adapter 路由）。 */
  active: boolean;
}

/** 一条模型目录项。 */
export interface ModelInfo {
  /** 所属 provider 路由键。 */
  provider: string;
  /** 模型 id（provider endpoint 接受的原文）。 */
  id: string;
  /** 展示名（缺省回退 id）。 */
  name: string;
  /** 可读的模型能力/备注。 */
  description?: string;
}

/** 精确解析一个模型后得到的元数据。 */
export interface ResolvedModelInfo extends ModelInfo {
  /** 上下文窗口（token），已知则填。 */
  contextWindow?: number;
  /** 默认最大输出 token，已知则填。 */
  maxTokens?: number;
}

/** 一次端点探测（discovery）返回的待采纳模型。 */
export interface DiscoveredModel {
  /** endpoint 接受的模型 id。 */
  id: string;
  /** endpoint 提供的展示名（可选）。 */
  name?: string;
  /** 上下文窗口（token），披露则填。 */
  contextWindow?: number;
  /** 最大输出 token，披露则填。 */
  maxTokens?: number;
}

/** 模型发现（discovery）请求：直接携带端点，不要求已注册。 */
export interface ModelDiscoveryRequest {
  /** 要探测的 endpoint 基地址（OpenAI-compatible，如 https://api.deepseek.com/v1）。 */
  baseURL: string;
  /** 探测用的 API key（可选，部分端点免鉴权）。 */
  apiKey?: string;
  /** 取消信号。 */
  signal?: AbortSignal;
}

/**
 * 一次模型执行的入参 —— 在 LLMRunParams 之上补充 provider/model 路由字段。
 * adapter 的 complete() 吸收此结构，保留 tool-call loop + telemetry 语义。
 */
export interface ModelCompleteOptions extends LLMRunParams {
  /** provider 路由键。 */
  provider: string;
  /** 模型 id。 */
  model: string;
}

/** adapter.complete() 的结果：文本 + 可选 token usage（供上层回填）。 */
export interface ModelCompleteResult {
  text: string;
  usage?: LLMUsage;
}