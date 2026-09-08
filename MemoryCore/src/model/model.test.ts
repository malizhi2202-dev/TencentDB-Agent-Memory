/**
 * model/model.test.ts — 模型层单测（不依赖真实 LLM / 网络）。
 *
 * 覆盖三块：
 *   1. buildProvidersFromConfig —— 配置推导（向后兼容 + 多 provider 路由）
 *   2. ModelAdapter 抽象默认实现
 *   3. ModelRuntime —— 注册表 / 路由 / 目录 / 发现
 *   4. OpenAICompatibleAdapter.discoverModels —— mock fetch 网络探测
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { ModelRuntime } from "./runtime.js";
import { ModelAdapter } from "./adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";
import { buildProvidersFromConfig } from "../adapters/standalone/llm-runner.js";
import type { ModelCompleteOptions, ModelCompleteResult } from "./types.js";

// —— 最小可用的具体 adapter（只实现 complete，其余走抽象默认）——
class RecordingAdapter extends ModelAdapter {
  calls: ModelCompleteOptions[] = [];
  override async complete(options: ModelCompleteOptions): Promise<ModelCompleteResult> {
    this.calls.push(options);
    return { text: `echo:${options.prompt}`, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildProvidersFromConfig", () => {
  it("无 providers 时合成单一路由（默认 provider=openai）", () => {
    const { providers, defaultProvider } = buildProvidersFromConfig({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-x",
      model: "gpt-4o",
    });
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ id: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-x" });
    expect(defaultProvider).toBe("openai");
  });

  it("provider=proxy 时单一路由键为 proxy（向后兼容）", () => {
    const { providers, defaultProvider } = buildProvidersFromConfig({
      baseUrl: "http://127.0.0.1:8096/proxy/iid/v1",
      apiKey: "sk-mem-x",
      model: "m",
      provider: "proxy",
    });
    expect(providers[0].id).toBe("proxy");
    expect(defaultProvider).toBe("proxy");
  });

  it("声明 providers 时保留顺序，defaultProvider 优先匹配 config.provider", () => {
    const { providers, defaultProvider } = buildProvidersFromConfig({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-x",
      model: "gpt-4o",
      provider: "qwen",
      providers: [
        { id: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-d" },
        { id: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "sk-q" },
      ],
    });
    expect(providers.map((p) => p.id)).toEqual(["deepseek", "qwen"]);
    expect(defaultProvider).toBe("qwen");
  });

  it("config.provider 不在 providers 里时回退第一个", () => {
    const { defaultProvider } = buildProvidersFromConfig({
      baseUrl: "x",
      apiKey: "y",
      model: "m",
      providers: [
        { id: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-d" },
        { id: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "sk-q" },
      ],
    });
    expect(defaultProvider).toBe("deepseek");
  });
});

describe("ModelAdapter 抽象默认实现", () => {
  it("providerInfo / listModels / resolveModel / discoverModels 默认行为", async () => {
    const adapter = new RecordingAdapter();
    expect(adapter.providerInfo("p")).toEqual({ id: "p", name: "p", active: true });
    await expect(adapter.listModels("p")).resolves.toEqual([]);
    await expect(adapter.resolveModel("p", "m")).resolves.toEqual({ provider: "p", id: "m", name: "m" });
    await expect(adapter.discoverModels({ baseURL: "https://x/v1" })).resolves.toEqual([]);
  });
});

describe("ModelRuntime", () => {
  it("registerAdapter + listProviders 聚合", () => {
    const runtime = new ModelRuntime();
    runtime.registerAdapter(["a", "b"], new RecordingAdapter());
    const providers = runtime.listProviders();
    expect(providers.map((p) => p.id)).toEqual(["a", "b"]);
    expect(providers.every((p) => p.active)).toBe(true);
  });

  it("重复注册同一 provider 抛错", () => {
    const runtime = new ModelRuntime();
    runtime.registerAdapter(["a"], new RecordingAdapter());
    expect(() => runtime.registerAdapter(["a"], new RecordingAdapter())).toThrow(/已注册/);
  });

  it("listModels 聚合所有 provider 的目录", async () => {
    const runtime = new ModelRuntime();
    runtime.registerAdapter(
      ["deepseek", "qwen"],
      new OpenAICompatibleAdapter([
        { id: "deepseek", baseUrl: "u1", apiKey: "k1", models: [{ provider: "", id: "deepseek-chat", name: "DeepSeek Chat" }] },
        { id: "qwen", baseUrl: "u2", apiKey: "k2", models: [{ provider: "", id: "qwen-plus", name: "Qwen Plus" }] },
      ]),
    );
    const models = await runtime.listModels();
    expect(models.map((m) => `${m.provider}/${m.id}`)).toEqual(["deepseek/deepseek-chat", "qwen/qwen-plus"]);
  });

  it("resolveModel 命中目录返回 name，未命中回退 id", async () => {
    const runtime = new ModelRuntime();
    runtime.registerAdapter(
      ["openai"],
      new OpenAICompatibleAdapter([
        { id: "openai", baseUrl: "u", apiKey: "k", models: [{ provider: "", id: "gpt-4o", name: "GPT-4o" }] },
      ]),
    );
    await expect(runtime.resolveModel("openai", "gpt-4o")).resolves.toMatchObject({ id: "gpt-4o", name: "GPT-4o" });
    await expect(runtime.resolveModel("openai", "unknown")).resolves.toMatchObject({ id: "unknown", name: "unknown" });
    // 未注册 provider 也安全回退（不校验路由）
    await expect(runtime.resolveModel("nope", "m")).resolves.toMatchObject({ provider: "nope", id: "m", name: "m" });
  });

  it("complete 按 provider 路由到对应 adapter", async () => {
    const runtime = new ModelRuntime();
    const adapter = new RecordingAdapter();
    runtime.registerAdapter(["a"], adapter);
    const res = await runtime.complete({
      provider: "a",
      model: "m",
      prompt: "hello",
      taskId: "t",
    });
    expect(res.text).toBe("echo:hello");
    expect(res.usage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0].provider).toBe("a");
  });

  it("complete 未注册 provider 抛错且提示已知路由", async () => {
    const runtime = new ModelRuntime();
    runtime.registerAdapter(["a"], new RecordingAdapter());
    await expect(
      runtime.complete({ provider: "missing", model: "m", prompt: "x", taskId: "t" }),
    ).rejects.toThrow(/未注册 provider 路由 "missing".*已知.*a/s);
  });

  it("discoverModels 委托给支持发现的 adapter", async () => {
    const runtime = new ModelRuntime();
    runtime.registerAdapter(["a"], new OpenAICompatibleAdapter([{ id: "a", baseUrl: "https://x/v1", apiKey: "k" }]));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m1", name: "M1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const models = await runtime.discoverModels({ baseURL: "https://x/v1", apiKey: "k" });
    expect(models).toEqual([{ id: "m1", name: "M1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://x/v1/models",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ authorization: "Bearer k" }) }),
    );
  });
});

describe("OpenAICompatibleAdapter.discoverModels", () => {
  it("成功探测返回模型列表并携带 Authorization", async () => {
    const adapter = new OpenAICompatibleAdapter([{ id: "a", baseUrl: "https://x/v1", apiKey: "k" }]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m1" }, { id: "m2", name: "M2" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const models = await adapter.discoverModels({ baseURL: "https://x/v1/", apiKey: "k" });
    expect(models).toEqual([{ id: "m1", name: undefined }, { id: "m2", name: "M2" }]);
    // baseURL 尾斜杠被去掉
    expect(fetchMock).toHaveBeenCalledWith("https://x/v1/models", expect.anything());
  });

  it("无 apiKey 时不带 Authorization 头", async () => {
    const adapter = new OpenAICompatibleAdapter([{ id: "a", baseUrl: "https://x/v1", apiKey: "k" }]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await adapter.discoverModels({ baseURL: "https://x/v1" });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string> | undefined;
    expect(headers?.authorization).toBeUndefined();
  });

  it("endpoint 非 2xx 时抛错", async () => {
    const adapter = new OpenAICompatibleAdapter([{ id: "a", baseUrl: "https://x/v1", apiKey: "k" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(adapter.discoverModels({ baseURL: "https://x/v1" })).rejects.toThrow(/HTTP 401/);
  });

  it("响应无 data 字段时返回空数组", async () => {
    const adapter = new OpenAICompatibleAdapter([{ id: "a", baseUrl: "https://x/v1", apiKey: "k" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(adapter.discoverModels({ baseURL: "https://x/v1" })).resolves.toEqual([]);
  });
});