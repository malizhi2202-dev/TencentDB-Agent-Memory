/**
 * gateway/config.llm.test.ts — 单测 llm 多 provider / 模型目录 yaml 解析。
 *
 * 用临时 yaml + TDAI_GATEWAY_CONFIG 环境变量驱动 loadGatewayConfig，
 * 验证新增的 llm.providers / llm.models 解析与 provider 回填。
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadGatewayConfig } from "./config.js";

// —— 临时 yaml 里只有 llm 相关段 + deployMode，其余走默认 ——
function writeTempYaml(yaml: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tdai-cfg-"));
  const p = path.join(dir, "tdai-gateway.yaml");
  fs.writeFileSync(p, yaml, "utf-8");
  return p;
}

const PROVS_YAML = `
deployMode: standalone
llm:
  baseUrl: "https://api.openai.com/v1"
  apiKey: "sk-top"
  model: "gpt-4o"
  provider: "openai"
  providers:
    - id: deepseek
      name: DeepSeek
      baseUrl: "https://api.deepseek.com/v1"
      apiKey: "sk-d"
      models:
        - id: deepseek-chat
          name: DeepSeek Chat
          description: "通用对话"
        - id: deepseek-reasoner
          name: DeepSeek Reasoner
    - id: qwen
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      apiKey: "sk-q"
      maxTokens: 8192
  models:
    - id: gpt-4o
      name: GPT-4o
`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadGatewayConfig llm.providers / llm.models 解析", () => {
  it("解析 providers 数组（id/name/baseUrl/apiKey/models/maxTokens）", () => {
    const p = writeTempYaml(PROVS_YAML);
    vi.stubEnv("TDAI_GATEWAY_CONFIG", p);
    const cfg = loadGatewayConfig();

    expect(cfg.llm.providers).toHaveLength(2);
    expect(cfg.llm.providers![0]).toMatchObject({
      id: "deepseek",
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-d",
    });
    expect(cfg.llm.providers![0].models).toHaveLength(2);
    expect(cfg.llm.providers![0].models![0]).toMatchObject({
      id: "deepseek-chat",
      name: "DeepSeek Chat",
      provider: "deepseek", // provider 由上层回填
    });
    expect(cfg.llm.providers![1]).toMatchObject({ id: "qwen", maxTokens: 8192 });
  });

  it("解析顶层 models，provider 回填为 llm.provider", () => {
    const p = writeTempYaml(PROVS_YAML);
    vi.stubEnv("TDAI_GATEWAY_CONFIG", p);
    const cfg = loadGatewayConfig();

    expect(cfg.llm.models).toHaveLength(1);
    expect(cfg.llm.models![0]).toMatchObject({ id: "gpt-4o", name: "GPT-4o", provider: "openai" });
  });

  it("无 providers / models 字段时保持单一 provider 兼容（providers 为空 undefined）", () => {
    const p = writeTempYaml(`
llm:
  baseUrl: "https://api.openai.com/v1"
  apiKey: "sk-x"
  model: "gpt-4o"
`);
    vi.stubEnv("TDAI_GATEWAY_CONFIG", p);
    const cfg = loadGatewayConfig();
    expect(cfg.llm.providers).toBeUndefined();
    expect(cfg.llm.models).toBeUndefined();
    expect(cfg.llm.model).toBe("gpt-4o");
  });

  it("id 缺失的 provider 条目被跳过（无 baseUrl 或 id 兜底不成立）", () => {
    // 无 baseUrl 的 provider 应被过滤掉
    const p = writeTempYaml(`
llm:
  baseUrl: "https://api.openai.com/v1"
  apiKey: "sk-x"
  model: "gpt-4o"
  providers:
    - id: missing-url
      apiKey: "sk-m"
    - id: ok
      baseUrl: "https://api.example.com/v1"
      apiKey: "sk-ok"
`);
    vi.stubEnv("TDAI_GATEWAY_CONFIG", p);
    const cfg = loadGatewayConfig();
    expect(cfg.llm.providers).toHaveLength(1);
    expect(cfg.llm.providers![0].id).toBe("ok");
  });
});