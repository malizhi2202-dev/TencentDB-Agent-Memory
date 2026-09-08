/**
 * 公共默认 LLM 配置的进程内 TTL 缓存 + fail-open 读取。
 *
 * 语义（三层优先级）：
 *   1. Agent 显式 llm.model（metadata_json.ui.llm.model）→ 用它
 *   2. 否则公共默认（内核 llm_default.model）→ 用它（若配置了）
 *   3. 否则沿用客户端请求模型（旧行为）
 *
 * 缓存 30s：配置由管理面板通过 config/global/set 修改，30 秒内生效；
 * 读取失败（内核 5xx / 网络 / 未注册模块）一律 fail-open 返回 null，绝不阻断转发。
 */

import type { MetadataClient } from "./meta/client.js";

export interface LlmDefaultConfig {
  model: string;
  provider: string;
  protocol: string;
}

const TTL_MS = 30_000;
let cache: { value: LlmDefaultConfig | null; expireAt: number } | null = null;

export async function getLlmDefaultModel(client: MetadataClient): Promise<string | undefined> {
  const now = Date.now();
  if (cache && now < cache.expireAt) {
    return cache.value?.model?.trim() || undefined;
  }
  try {
    const value = await client.getGlobalLlmDefault();
    cache = { value, expireAt: now + TTL_MS };
    return value.model?.trim() || undefined;
  } catch {
    // fail-open：读取失败视为「未配置」，不覆盖客户端模型。
    cache = { value: null, expireAt: now + TTL_MS };
    return undefined;
  }
}

/** 测试钩子：清空缓存。 */
export function clearLlmDefaultCache(): void {
  cache = null;
}