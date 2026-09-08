import { describe, it, expect } from "vitest";
import {
  buildChatMemoryAssetId,
  resolveChatMemoryAgentId,
  CHAT_MEMORY_ASSET_PREFIX,
} from "./chat-memory-asset.js";

describe("chat-memory-asset ID 生成", () => {
  it("agent 锚点：chat_memory-{team}-{agent}", () => {
    expect(buildChatMemoryAssetId("team-1", "agt-2")).toBe("chat_memory-team-1-agt-2");
  });

  it("个人 agent（agent_id = user_id）同样拼出稳定锚点", () => {
    expect(buildChatMemoryAssetId("team-1", "usr-42")).toBe("chat_memory-team-1-usr-42");
  });

  it("team/agent 含 - 也稳定且不串号", () => {
    const id = buildChatMemoryAssetId("team-a-b", "usr-c-d");
    expect(id).toBe("chat_memory-team-a-b-usr-c-d");
    expect(id.startsWith(CHAT_MEMORY_ASSET_PREFIX)).toBe(true);
  });

  it("resolveChatMemoryAgentId 用正向拼接比对命中 agent_id", () => {
    const assetId = buildChatMemoryAssetId("team-1", "usr-42");
    expect(resolveChatMemoryAgentId(assetId, "team-1", ["usr-7", "usr-42"])).toBe("usr-42");
    expect(resolveChatMemoryAgentId(assetId, "team-1", ["usr-7", "usr-8"])).toBeUndefined();
    // team 不一致时不得命中（权威 team_id 优先）
    expect(resolveChatMemoryAgentId(assetId, "team-2", ["usr-42"])).toBeUndefined();
  });
});