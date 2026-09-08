/**
 * model/runtime.ts — 运行模型：adapter 注册表 + 按 provider 路由的调用入口。
 *
 * 模仿 dsh-llm 的 LlmRuntime：registerAdapter 把 provider 路由挂到注册表，
 * complete() 依 provider 键路由到对应 adapter，listProviders()/listModels() 聚合
 * 目录，discoverModels() 暴露"添加模型"的运行时发现。
 */

import { ModelAdapter } from "./adapter.js";
import type {
  DiscoveredModel,
  ModelCompleteOptions,
  ModelCompleteResult,
  ModelDiscoveryRequest,
  ModelInfo,
  ModelProviderInfo,
  ResolvedModelInfo,
} from "./types.js";

export class ModelRuntime {
  /** provider 路由键 → adapter。 */
  private readonly routes = new Map<string, ModelAdapter>();

  /**
   * 注册一个 adapter 的一条或多条 provider 路由。
   * @param providers - 该 adapter 拥有的 provider 键。
   * @param adapter - 协议适配器。
   */
  registerAdapter(providers: readonly string[], adapter: ModelAdapter): void {
    for (const provider of providers) {
      if (this.routes.has(provider)) {
        throw new Error(`model runtime: provider 路由 "${provider}" 已注册`);
      }
      this.routes.set(provider, adapter);
    }
  }

  /** 是否有 provider。 */
  hasProvider(provider: string): boolean {
    return this.routes.has(provider);
  }

  /** 列出所有已注册 provider 的展示元数据（注册顺序）。 */
  listProviders(): ModelProviderInfo[] {
    return [...this.routes.keys()].map((provider) => {
      const adapter = this.routes.get(provider)!;
      const info = adapter.providerInfo(provider);
      return { ...info, id: provider, active: true };
    });
  }

  /** 聚合所有已注册 provider 的模型目录。 */
  async listModels(): Promise<ModelInfo[]> {
    const out: ModelInfo[] = [];
    for (const provider of this.routes.keys()) {
      const adapter = this.routes.get(provider)!;
      for (const model of await adapter.listModels(provider)) {
        out.push({ ...model, provider });
      }
    }
    return out;
  }

  /** 精确解析某个模型的元数据。 */
  async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<ResolvedModelInfo> {
    const adapter = this.routes.get(provider);
    if (!adapter) {
      return { provider, id: model, name: model };
    }
    return adapter.resolveModel(provider, model, signal);
  }

  /**
   * 探测一个 endpoint 通告的模型列表（运行模型路由发现）。
   * 委托给第一个支持 discoverModels 的 adapter；无则为空。
   */
  async discoverModels(req: ModelDiscoveryRequest): Promise<DiscoveredModel[]> {
    for (const adapter of this.routes.values()) {
      const models = await adapter.discoverModels(req);
      if (models.length > 0) return models;
    }
    return [];
  }

  /**
   * 执行一次模型调用，按 provider 键路由到对应 adapter。
   * @throws 目标 provider 未注册时抛出。
   */
  async complete(options: ModelCompleteOptions): Promise<ModelCompleteResult> {
    const adapter = this.routes.get(options.provider);
    if (!adapter) {
      throw new Error(
        `model runtime: 未注册 provider 路由 "${options.provider}"（已知：${[...this.routes.keys()].join(", ") || "无"}）`,
      );
    }
    return adapter.complete(options);
  }
}