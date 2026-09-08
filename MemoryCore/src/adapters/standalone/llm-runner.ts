/**
 * StandaloneLLMRunner — 模型层的兼容壳（原 powered by Vercel AI SDK）。
 *
 * 底层调用已迁移到 model/ 包：OpenAICompatibleAdapter（协议适配 + 工具循环 + 模型发现）
 * 与 ModelRuntime（provider 路由）。本文件保留 LLMRunner 接口与工厂，向后兼容：
 *   - enableTools=false：纯文本输出（L1 抽取 / L1 去重）
 *   - enableTools=true ：自动工具循环 + 本地文件操作（L2 场景 / L3 人设）
 *
 * 多 provider：StandaloneLLMConfig.providers 可声明多条 provider 路由（各自 baseUrl/
 * apiKey/catalog），工厂的 modelRef="provider/model" 会路由到对应 provider。
 */

import type {
  LLMRunner,
  LLMRunParams,
  LLMRunnerFactory,
  LLMRunnerCreateOptions,
  Logger,
} from "../../core/types.js";
import type { LLMUsage } from "../../core/report/metric-tracking-runner.js";
import {
  ModelRuntime,
  OpenAICompatibleAdapter,
  type OpenAICompatibleProviderConfig,
  type ModelInfo,
} from "../../model/index.js";

const TAG = "[memory-tdai] [standalone-runner]";

// ============================
// Configuration
// ============================

export interface StandaloneLLMConfig {
  /** OpenAI-compatible API base URL (e.g. "https://api.openai.com/v1"). */
  baseUrl: string;
  /** API key for authentication. */
  apiKey: string;
  /** Default model name (e.g. "gpt-4o"). */
  model: string;
  /** Default max output tokens. */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 120_000). */
  timeoutMs?: number;
  /**
   * 默认 provider 路由键（向后兼容）：
   *   - "openai": 直连通用 OpenAI 兼容服务（默认）
   *   - "proxy" : 走 context_proxy（baseUrl 已被 resolver 改写 + sk-mem apiKey）
   */
  provider?: "openai" | "proxy";
  /** provider=proxy 时的可选配置。 */
  proxy?: {
    /** 是否用 memory systemUser.userKey 作为 Authorization（默认 true）。 */
    useMemorySystemUserKey?: boolean;
  };
  /**
   * 多 provider 路由（"添加模型"的静态目录来源，可选）。
   * 非空时取代顶层 baseUrl/apiKey/model 的单一 provider 语义。
   */
  providers?: OpenAICompatibleProviderConfig[];
  /** 顶层的静态模型目录（可选，供 /v3/llm/models 展示）。 */
  models?: ModelInfo[];
}

/**
 * 从 StandaloneLLMConfig 推导出 adapter 用的 provider 路由列表 + 默认 provider 键。
 * 向后兼容：未声明 providers 时，用顶层 baseUrl/apiKey/model 合成单一路由。
 */
export function buildProvidersFromConfig(config: StandaloneLLMConfig): {
  providers: OpenAICompatibleProviderConfig[];
  defaultProvider: string;
} {  if (config.providers && config.providers.length > 0) {
    const ids = new Set(config.providers.map((p) => p.id));
    const defaultProvider =
      config.provider && ids.has(config.provider) ? config.provider : config.providers[0].id;
    return { providers: config.providers, defaultProvider };
  }

  const id = config.provider ?? "openai";
  return {
    providers: [
      {
        id,
        name: id,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        models: config.models,
        maxTokens: config.maxTokens,
        timeoutMs: config.timeoutMs,
      },
    ],
    defaultProvider: id,
  };
}

// ============================
// StandaloneLLMRunner
// ============================

export class StandaloneLLMRunner implements LLMRunner {
  private runtime: ModelRuntime;
  private defaultProvider: string;
  private model: string;
  private enableTools: boolean;
  private logger?: Logger;

  /**
   * Side-channel: 最近一次 run() 调用的 token usage。
   * 由 MetricTrackingRunner 装饰器读取，用于精确上报 credit。
   * 不改变 LLMRunner 接口签名。
   */
  lastUsage?: LLMUsage;

  constructor(opts: {
    config: StandaloneLLMConfig;
    model?: string;
    provider?: string;
    enableTools?: boolean;
    logger?: Logger;
  }) {
    this.logger = opts.logger;
    const { providers, defaultProvider } = buildProvidersFromConfig(opts.config);
    const adapter = new OpenAICompatibleAdapter(providers, opts.logger);
    this.runtime = new ModelRuntime();
    this.runtime.registerAdapter(providers.map((p) => p.id), adapter);
    this.defaultProvider = opts.provider ?? defaultProvider;
    this.model = opts.model ?? opts.config.model;
    this.enableTools = opts.enableTools ?? false;
  }

  async run(params: LLMRunParams): Promise<string> {
    const effectiveEnableTools = params.enableTools ?? this.enableTools;

    this.logger?.debug?.(
      `${TAG} run() start: taskId=${params.taskId}, provider=${this.defaultProvider}, ` +
      `model=${this.model}, tools=${effectiveEnableTools}, timeout=${params.timeoutMs ?? 120_000}ms`,
    );

    const result = await this.runtime.complete({
      ...params,
      provider: this.defaultProvider,
      model: this.model,
      enableTools: effectiveEnableTools,
    });

    this.lastUsage = result.usage;
    return result.text;
  }
}

// ============================
// StandaloneLLMRunnerFactory
// ============================

export interface StandaloneLLMRunnerFactoryOptions {
  /** LLM API configuration. */
  config: StandaloneLLMConfig;
  /** Logger instance. */
  logger?: Logger;
}

/**
 * Factory that creates StandaloneLLMRunner instances.
 *
 * Used by the Gateway and Hermes host adapters. `modelRef` supports
 * "provider/model" routing — the provider part selects a route declared in
 * config.providers (or the single synthesized route), the model part is the id.
 */
export class StandaloneLLMRunnerFactory implements LLMRunnerFactory {
  private config: StandaloneLLMConfig;
  private logger?: Logger;

  constructor(opts: StandaloneLLMRunnerFactoryOptions) {
    this.config = opts.config;
    this.logger = opts.logger;
  }

  createRunner(opts?: LLMRunnerCreateOptions): LLMRunner {
    const enableTools = opts?.enableTools ?? false;
    const modelRef = opts?.modelRef;

    // 解析 "provider/model"：provider 选择路由，model 部分为模型 id。
    let provider: string | undefined;
    let model = this.config.model;
    if (modelRef) {
      const slashIdx = modelRef.indexOf("/");
      if (slashIdx > 0) {
        provider = modelRef.slice(0, slashIdx);
        model = modelRef.slice(slashIdx + 1);
      } else {
        model = modelRef;
      }
    }

    this.logger?.debug?.(
      `${TAG} Creating StandaloneLLMRunner: provider=${provider ?? "(default)"}, ` +
      `model=${model}, tools=${enableTools}`,
    );

    return new StandaloneLLMRunner({
      config: this.config,
      model,
      provider,
      enableTools,
      logger: this.logger,
    });
  }
}