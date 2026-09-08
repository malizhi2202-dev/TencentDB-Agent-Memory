/**
 * model/openai-compatible-adapter.ts — OpenAI 兼容协议的模型适配器。
 *
 * 这是"模型适配层"的具体实现：一个 adapter 实例可拥有多个 provider 路由，
 * 每个路由携带独立的 {baseUrl, apiKey, catalog}。底层复用 Vercel AI SDK 的
 * createOpenAI(compatibility: "compatible")，因此覆盖 DeepSeek / Qwen / GLM /
 * 自建网关等几乎所有 OpenAI-compatible 后端。
 *
 * 额外提供 discoverModels()：探测 OpenAI-compatible 的 GET /v1/models 端点，
 * 返回可被"添加"的模型目录（对应 dsh-llm 的运行时模型发现能力）。
 */

import fsPromises from "node:fs/promises";
import path from "node:path";
import { generateText, tool, stepCountIs, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { report } from "../core/report/reporter.js";
import type { Logger } from "../core/types.js";
import type { LLMUsage } from "../core/report/metric-tracking-runner.js";
import { ModelAdapter } from "./adapter.js";
import type {
  DiscoveredModel,
  ModelCompleteOptions,
  ModelCompleteResult,
  ModelDiscoveryRequest,
  ModelInfo,
  ResolvedModelInfo,
} from "./types.js";

const TAG = "[memory-tdai] [model-adapter]";

/** 工具循环最大迭代轮数，防止死循环。 */
const MAX_TOOL_ITERATIONS = 20;

/** 单个 provider 路由的静态配置。 */
export interface OpenAICompatibleProviderConfig {
  /** provider 路由键（如 "openai" / "deepseek" / "acme-gateway"）。 */
  id: string;
  /** 展示名（缺省回退 id）。 */
  name?: string;
  /** OpenAI-compatible endpoint 基地址（含 /v1）。 */
  baseUrl: string;
  /** API key。 */
  apiKey: string;
  /** 静态模型目录（可选；缺省时仅通过 discoverModels 动态发现）。 */
  models?: ModelInfo[];
  /** 默认最大输出 token。 */
  maxTokens?: number;
  /** 请求超时（ms）。 */
  timeoutMs?: number;
}

// ============================
// telemetry.metadata 组装（与 standalone runner 语义一致）
// ============================

function buildTelemetryMetadata(params: ModelCompleteOptions): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    instanceId: params.instanceId ?? "unknown",
  };
  if (params.traceName) {
    meta.langfuseTraceName = params.traceName;
    meta.langfuseUpdateParent = true;
  }
  if (Array.isArray(params.tags) && params.tags.length > 0) {
    meta.tags = params.tags;
  }
  if (typeof params.sessionId === "string" && params.sessionId.length > 0) {
    meta.sessionId = params.sessionId;
  }
  if (typeof params.userId === "string" && params.userId.length > 0) {
    meta.userId = params.userId;
  }
  return meta;
}

// ============================
// Sandboxed tool helpers
// ============================

function resolveSandboxedPath(workspaceDir: string, relativePath: string): string | null {
  const resolved = path.resolve(workspaceDir, relativePath);
  if (!resolved.startsWith(path.resolve(workspaceDir))) {
    return null;
  }
  return resolved;
}

function createSandboxedTools(workspaceDir: string, logger?: Logger) {
  return {
    read: tool({
      description: "Read the contents of a file at the given relative path.",
      inputSchema: jsonSchema<{ path: string }>({
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path to read." },
        },
        required: ["path"],
      }),
      execute: (async (args: { path: string }) => {
        const resolved = resolveSandboxedPath(workspaceDir, args.path);
        if (!resolved) return JSON.stringify({ error: `Path "${args.path}" escapes workspace boundary.` });
        try {
          const content = await fsPromises.readFile(resolved, "utf-8");
          logger?.debug?.(`${TAG} read: "${args.path}" → ${content.length} chars`);
          return content;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger?.warn?.(`${TAG} read failed: ${msg}`);
          return JSON.stringify({ error: msg });
        }
      }) as any,
    }),
    write: tool({
      description: "Write content to a file at the given relative path. Creates or overwrites.",
      inputSchema: jsonSchema<{ path: string; content: string }>({
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path to write." },
          content: { type: "string", description: "Content to write." },
        },
        required: ["path", "content"],
      }),
      execute: (async (args: { path: string; content: string }) => {
        const resolved = resolveSandboxedPath(workspaceDir, args.path);
        if (!resolved) return JSON.stringify({ error: `Path "${args.path}" escapes workspace boundary.` });
        try {
          await fsPromises.mkdir(path.dirname(resolved), { recursive: true });
          await fsPromises.writeFile(resolved, args.content, "utf-8");
          logger?.debug?.(`${TAG} write: "${args.path}" → ${args.content.length} chars`);
          return JSON.stringify({ success: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger?.warn?.(`${TAG} write failed: ${msg}`);
          return JSON.stringify({ error: msg });
        }
      }) as any,
    }),
    edit: tool({
      description: "Apply one or more text replacements to a file. Each edit replaces an exact substring.",
      inputSchema: jsonSchema<{ path: string; edits: Array<{ oldText: string; newText: string }> }>({
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path." },
          edits: {
            type: "array",
            description: "Array of replacements to apply sequentially.",
            items: {
              type: "object",
              properties: {
                oldText: { type: "string", description: "Exact string to find." },
                newText: { type: "string", description: "Replacement string." },
              },
              required: ["oldText", "newText"],
            },
          },
        },
        required: ["path", "edits"],
      }),
      execute: (async (args: { path: string; edits: Array<{ oldText: string; newText: string }> }) => {
        const resolved = resolveSandboxedPath(workspaceDir, args.path);
        if (!resolved) return JSON.stringify({ error: `Path "${args.path}" escapes workspace boundary.` });
        if (!args.edits || args.edits.length === 0) return JSON.stringify({ error: "edits array cannot be empty." });
        try {
          let content = await fsPromises.readFile(resolved, "utf-8");
          for (const edit of args.edits) {
            if (!edit.oldText) return JSON.stringify({ error: "oldText cannot be empty." });
            if (!content.includes(edit.oldText)) {
              return JSON.stringify({ error: `oldText not found in file "${args.path}": ${edit.oldText.slice(0, 80)}` });
            }
            content = content.replace(edit.oldText, edit.newText);
          }
          await fsPromises.writeFile(resolved, content, "utf-8");
          logger?.debug?.(`${TAG} edit: "${args.path}" → ${args.edits.length} replacement(s)`);
          return JSON.stringify({ success: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger?.warn?.(`${TAG} edit failed: ${msg}`);
          return JSON.stringify({ error: msg });
        }
      }) as any,
    }),
  };
}

// ============================
// OpenAICompatibleAdapter
// ============================

export class OpenAICompatibleAdapter extends ModelAdapter {
  private readonly providers: ReadonlyMap<string, OpenAICompatibleProviderConfig>;
  private readonly logger?: Logger;

  constructor(providers: OpenAICompatibleProviderConfig[], logger?: Logger) {
    super();
    this.providers = new Map(providers.map((p) => [p.id, p]));
    this.logger = logger;
  }

  /** 本 adapter 拥有的全部 provider 路由（供 runtime 聚合）。 */
  ownedProviders(): string[] {
    return [...this.providers.keys()];
  }

  override providerInfo(provider: string) {
    const cfg = this.providers.get(provider);
    return {
      id: provider,
      name: cfg?.name ?? provider,
      baseUrl: cfg?.baseUrl,
      active: true,
    };
  }

  override async listModels(provider: string): Promise<readonly ModelInfo[]> {
    const cfg = this.providers.get(provider);
    if (!cfg?.models) return [];
    return cfg.models.map((m) => ({ ...m, provider }));
  }

  override async resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<ResolvedModelInfo> {
    const cfg = this.providers.get(provider);
    const cataloged = cfg?.models?.find((m) => m.id === model);
    if (cataloged) {
      return { provider, id: model, name: cataloged.name, description: cataloged.description };
    }
    return { provider, id: model, name: model };
  }

  /**
   * 探测一个 OpenAI-compatible endpoint 的模型列表（GET {baseURL}/models）。
   * 对应"添加模型"的运行时发现能力：输入 draft 端点，返回可采纳的模型候选。
   */
  async discoverModels(req: ModelDiscoveryRequest): Promise<DiscoveredModel[]> {
    const { baseURL, apiKey } = req;
    const normalized = baseURL.replace(/\/+$/, "");
    const url = `${normalized}/models`;

    const headers: Record<string, string> = { accept: "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const res = await fetch(url, { method: "GET", headers, signal: req.signal });
    if (!res.ok) {
      throw new Error(`discoverModels ${url} → HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const rows = Array.isArray(body?.data) ? body.data : [];
    return rows
      .filter((r) => typeof r?.id === "string" && r.id.length > 0)
      .map((r) => ({
        id: r.id as string,
        name: typeof r.name === "string" ? r.name : undefined,
        ...(typeof r.contextWindow === "number" ? { contextWindow: r.contextWindow } : {}),
        ...(typeof r.maxTokens === "number" ? { maxTokens: r.maxTokens } : {}),
      }));
  }

  /**
   * 执行一次模型调用 —— 完整复刻 standalone runner 的语义：
   * tool-call loop（sandbox / storage / caller tools）+ telemetry + credit 上报 + usage。
   */
  override async complete(options: ModelCompleteOptions): Promise<ModelCompleteResult> {
    const cfg = this.providers.get(options.provider);
    if (!cfg) {
      throw new Error(`model adapter: 未注册 provider 路由 "${options.provider}"`);
    }

    const runStartMs = Date.now();
    const timeoutMs = options.timeoutMs ?? cfg.timeoutMs ?? 120_000;
    const maxTokens = options.maxTokens ?? cfg.maxTokens ?? 4096;
    const workspaceDir = options.workspaceDir ?? process.cwd();

    const callerProvidedTools = options.tools && Object.keys(options.tools).length > 0;
    const effectiveEnableTools = options.enableTools ?? false;
    const maxIterations = options.maxIterations ?? MAX_TOOL_ITERATIONS;

    this.logger?.debug?.(
      `${TAG} complete() start: provider=${options.provider}, model=${options.model}, ` +
      `tools=${effectiveEnableTools}${callerProvidedTools ? "(caller)" : ""}, timeout=${timeoutMs}ms`,
    );

    const provider = createOpenAI({
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
      compatibility: "compatible",
    });

    let tools: Record<string, unknown> | undefined;
    if (callerProvidedTools && effectiveEnableTools) {
      tools = options.tools;
    } else if (effectiveEnableTools && options.storage) {
      const { createStorageTools } = await import("../adapters/standalone/storage-tools.js");
      tools = createStorageTools(options.storage, options.storagePrefix ?? "", this.logger);
    } else if (effectiveEnableTools) {
      tools = createSandboxedTools(workspaceDir, this.logger);
    } else {
      tools = undefined;
    }

    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combinedSignal = options.abortSignal
        ? AbortSignal.any([timeoutSignal, options.abortSignal])
        : timeoutSignal;

      const result = await generateText({
        model: provider.chat(options.model),
        system: options.systemPrompt,
        prompt: options.prompt,
        ...(tools && Object.keys(tools).length > 0
          ? { tools, stopWhen: stepCountIs(maxIterations) }
          : {}),
        maxOutputTokens: maxTokens,
        abortSignal: combinedSignal,
        experimental_telemetry: {
          isEnabled: true,
          functionId: options.taskId,
          metadata: buildTelemetryMetadata(options),
        },
      });

      const text = (result.text ?? "").trim();
      const totalMs = Date.now() - runStartMs;

      const usage: LLMUsage | undefined = result.usage
        ? {
            promptTokens: result.usage.promptTokens ?? 0,
            completionTokens: result.usage.completionTokens ?? 0,
            totalTokens: (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0),
          }
        : undefined;

      this.logger?.debug?.(
        `${TAG} complete() done: ${totalMs}ms, steps=${result.steps.length}, output=${text.length} chars`,
      );

      for (const step of result.steps) {
        const calls = step.toolCalls ?? [];
        const textLen = step.text?.length ?? 0;
        if (calls.length > 0) {
          const callSummary = calls.map((tc) =>
            `${tc.toolName}(${JSON.stringify(tc.input).slice(0, 120)})`,
          ).join(", ");
          this.logger?.debug?.(`${TAG} step[${step.stepNumber}] toolCalls: ${callSummary}`);
        }
        if (textLen > 0) {
          this.logger?.debug?.(
            `${TAG} step[${step.stepNumber}] text: ${textLen} chars, finishReason=${step.finishReason}`,
          );
        }
      }

      if (options.instanceId) {
        report("llm_call", {
          taskId: options.taskId,
          provider: options.provider,
          model: options.model,
          inputLength: options.prompt.length,
          outputLength: text.length,
          totalDurationMs: totalMs,
          success: true,
          error: null,
        });
      }

      return { text, usage };
    } catch (err) {
      const totalMs = Date.now() - runStartMs;
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger?.error?.(`${TAG} complete() failed after ${totalMs}ms: ${errMsg}`);

      if (options.instanceId) {
        report("llm_call", {
          taskId: options.taskId,
          provider: options.provider,
          model: options.model,
          inputLength: options.prompt.length,
          outputLength: 0,
          totalDurationMs: totalMs,
          success: false,
          error: errMsg,
        });
      }

      throw err;
    }
  }
}