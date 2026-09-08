/**
 * model/adapter.ts — 模型适配层抽象（模仿 dsh-llm 的 LlmAdapter）。
 *
 * 一个 ModelAdapter 拥有一个或多个 provider 路由；registerAdapter 时把它挂到
 * ModelRuntime。唯一必须实现的是 complete()；listModels / resolveModel /
 * providerInfo 有默认实现（未实现 = 空目录、可接受未列出的模型 id）。
 */

import type {
  DiscoveredModel,
  ModelCompleteOptions,
  ModelCompleteResult,
  ModelDiscoveryRequest,
  ModelInfo,
  ModelProviderInfo,
  ResolvedModelInfo,
} from "./types.js";

export abstract class ModelAdapter {
  /**
   * 描述本 adapter 拥有的一个 provider 路由的展示元数据。
   * @param provider - 注册时传入的 provider 键。
   */
  providerInfo(provider: string): ModelProviderInfo {
    return { id: provider, name: provider, active: true };
  }

  /**
   * 列出本 adapter 当前能为某个 provider 通告的模型目录。
   * 结果仅作建议：adapter 可接受未列出的模型，消费方不得因缺失而拒绝请求。
   */
  listModels(_provider: string): Promise<readonly ModelInfo[]> {
    return Promise.resolve([]);
  }

  /**
   * 精确解析一个模型的全部元数据。独立于建议目录，不校验请求路由。
   */
  resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<ResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model });
  }

  /**
   * 探测一个 endpoint 通告的模型列表（"添加模型"的运行时发现能力）。
   * 缺省不支持 —— 具体协议适配器（如 OpenAICompatibleAdapter）可覆盖。
   */
  discoverModels(_req: ModelDiscoveryRequest): Promise<DiscoveredModel[]> {
    return Promise.resolve([]);
  }

  /**
   * 执行一次模型调用。唯一必须实现的方法。
   * @param options - 完整入参（含 provider/model 路由 + prompt + tools + telemetry）。
   * @returns 文本输出 + 可选 token usage。
   */
  abstract complete(options: ModelCompleteOptions): Promise<ModelCompleteResult>;
}