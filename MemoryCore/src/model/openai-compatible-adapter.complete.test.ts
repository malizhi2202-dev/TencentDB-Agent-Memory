/**
 * model/openai-compatible-adapter.complete.test.ts — 单测 complete() 执行语义。
 *
 * mock Vercel AI SDK 的 generateText（不联网），验证：
 *   - 纯文本（enableTools=false）不注入 tools
 *   - enableTools=true 注入 sandbox tools（read/write/edit）
 *   - caller tools 覆盖默认
 *   - usage 回填 + telemetry 传递
 *   - 未注册 provider 抛错
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateText } from "ai";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

const mockedGenerateText = vi.mocked(generateText);

function makeAdapter() {
  return new OpenAICompatibleAdapter([
    { id: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-x", maxTokens: 128 },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OpenAICompatibleAdapter.complete", () => {
  it("纯文本：不注入 tools，返回文本 + usage", async () => {
    mockedGenerateText.mockResolvedValue({
      text: "  回答  ",
      steps: [],
      usage: { promptTokens: 5, completionTokens: 3 },
    } as never);

    const adapter = makeAdapter();
    const res = await adapter.complete({
      provider: "openai",
      model: "gpt-4o",
      prompt: "hi",
      taskId: "t1",
      enableTools: false,
    });

    expect(res.text).toBe("回答"); // trim
    expect(res.usage).toEqual({ promptTokens: 5, completionTokens: 3, totalTokens: 8 });

    const arg = mockedGenerateText.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.prompt).toBe("hi");
    expect(arg.maxOutputTokens).toBe(128); // provider maxTokens
    expect(arg).not.toHaveProperty("tools");
    expect(arg).toHaveProperty("experimental_telemetry");
    expect((arg.experimental_telemetry as Record<string, unknown>).functionId).toBe("t1");
  });

  it("enableTools=true：注入 sandbox tools（read/write/edit）", async () => {
    mockedGenerateText.mockResolvedValue({ text: "", steps: [], usage: undefined } as never);

    const adapter = makeAdapter();
    await adapter.complete({
      provider: "openai",
      model: "m",
      prompt: "do something",
      taskId: "t2",
      enableTools: true,
      workspaceDir: "/tmp/ws",
    });

    const arg = mockedGenerateText.mock.calls[0][0] as Record<string, unknown>;
    const tools = arg.tools as Record<string, unknown> | undefined;
    expect(tools).toBeDefined();
    expect(Object.keys(tools!)).toEqual(["read", "write", "edit"]);
    expect(arg).toHaveProperty("stopWhen");
  });

  it("caller tools 覆盖默认 sandbox tools", async () => {
    mockedGenerateText.mockResolvedValue({ text: "", steps: [], usage: undefined } as never);

    const adapter = makeAdapter();
    const custom = { custom_tool: { description: "x" } };
    await adapter.complete({
      provider: "openai",
      model: "m",
      prompt: "p",
      taskId: "t3",
      enableTools: true,
      tools: custom,
    });

    const arg = mockedGenerateText.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.tools).toBe(custom);
  });

  it("telemetry metadata 传递 traceName/tags/sessionId/userId", async () => {
    mockedGenerateText.mockResolvedValue({ text: "", steps: [], usage: undefined } as never);

    const adapter = makeAdapter();
    await adapter.complete({
      provider: "openai",
      model: "m",
      prompt: "p",
      taskId: "t4",
      traceName: "memory.l1-extract",
      tags: ["team:1", "agent:2"],
      sessionId: "s1",
      userId: "u1",
      instanceId: "iid",
    });

    const arg = mockedGenerateText.mock.calls[0][0] as Record<string, unknown>;
    const meta = (arg.experimental_telemetry as { metadata: Record<string, unknown> }).metadata;
    expect(meta.instanceId).toBe("iid");
    expect(meta.langfuseTraceName).toBe("memory.l1-extract");
    expect(meta.tags).toEqual(["team:1", "agent:2"]);
    expect(meta.sessionId).toBe("s1");
    expect(meta.userId).toBe("u1");
  });

  it("未注册 provider 抛错", async () => {
    const adapter = makeAdapter();
    await expect(
      adapter.complete({ provider: "nope", model: "m", prompt: "p", taskId: "t" }),
    ).rejects.toThrow(/未注册 provider 路由 "nope"/);
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });
});