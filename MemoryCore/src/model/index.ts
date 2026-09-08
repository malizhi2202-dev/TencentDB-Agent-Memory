/**
 * model/index.ts — 模型层 barrel。
 *
 * 三层（模仿 deepseek-harness 的 dsh-llm 抽象，但保持非流式 + AI SDK 底层）：
 *   - ModelAdapter        ：模型适配层（provider 协议适配）
 *   - OpenAICompatibleAdapter：OpenAI-compatible 协议实现（含工具循环 + 模型发现）
 *   - ModelRuntime        ：运行模型（注册表 + 按 provider 路由 + 目录/发现）
 */

export { ModelAdapter } from "./adapter.js";
export {
  OpenAICompatibleAdapter,
  type OpenAICompatibleProviderConfig,
} from "./openai-compatible-adapter.js";
export { ModelRuntime } from "./runtime.js";
export type {
  ModelProviderInfo,
  ModelInfo,
  ResolvedModelInfo,
  DiscoveredModel,
  ModelDiscoveryRequest,
  ModelCompleteOptions,
  ModelCompleteResult,
} from "./types.js";