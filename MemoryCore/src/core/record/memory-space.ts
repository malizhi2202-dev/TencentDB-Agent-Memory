/**
 * Memory Space（记忆空间，一等资源）+ Agent 创建自动挂载.
 *
 * P0.1 阶段 B：把「谁拥有、谁可见哪些记忆」从零散的 teamId/userId/agentId
 * 传递，升级为显式的 MemorySpace 资源 + agent 创建时的自动挂载列表。
 *
 * 一个 MemorySpace = (ownerType, ownerId, domain) 的隔离容器：
 * - owner 决定「属于谁、谁可见」（隔离边界）
 * - domain 决定「主要承载哪个 Brain 域」（内容侧重 + 默认写入策略）
 *
 * 设计依据：.specs/design-memory-domain-write-model.md §三，对标 Agent OS 的
 * memory space（一等资源 + scope 访问）与「agent 创建时挂载空间」语义。
 */

import { createHash } from "node:crypto";
import { defaultPolicyForDomain, type MemoryDomain, type WritePolicy } from "./memory-domain.js";

export type SpaceOwnerType = "user" | "team" | "project" | "agent" | "task";

export interface MemorySpace {
  /** 确定性空间 ID：sp_<sha1(ownerType:ownerId:domain) 前 12 位> */
  spaceId: string;
  ownerType: SpaceOwnerType;
  ownerId: string;
  /** 该空间主要承载的 Brain 域 */
  domain: MemoryDomain;
  /** 空间级策略基线：缺省由 domain 推导，可显式收紧 */
  writePolicy: WritePolicy;
}

/** 确定性 spaceId：同一 (ownerType, ownerId, domain) 永远得到同一 id。 */
export function spaceIdFor(ownerType: SpaceOwnerType, ownerId: string, domain: MemoryDomain): string {
  const raw = `${ownerType}:${ownerId}:${domain}`;
  return `sp_${createHash("sha1").update(raw).digest("hex").slice(0, 12)}`;
}

/** 构造一个记忆空间；writePolicy 缺省由 domain 推导。 */
export function makeMemorySpace(
  ownerType: SpaceOwnerType,
  ownerId: string,
  domain: MemoryDomain,
  writePolicy?: WritePolicy,
): MemorySpace {
  return {
    spaceId: spaceIdFor(ownerType, ownerId, domain),
    ownerType,
    ownerId,
    domain,
    writePolicy: writePolicy ?? defaultPolicyForDomain(domain),
  };
}

/**
 * Agent 创建时自动挂载的记忆空间列表（默认挂载策略）。
 *
 * - agent 自有空间：episodic / semantic / task / artifact（该 agent 私有的工作记忆）
 * - team 共享空间：semantic / instruction / rule / procedural（跨 agent 共享的团队记忆）
 * - user 个人空间：persona / preference（跨 agent 共享的用户画像）
 * - project 空间（可选）：semantic / procedural
 *
 * domain 与写入策略（持久 vs 总结）在这里形成统一视图：
 * instruction/rule 域默认 explicit_only（用户显式持久更改），其余默认 automatic（系统总结）。
 */
export function mountSpacesForAgent(
  agentId: string,
  opts: { teamId?: string; userId?: string; projectId?: string } = {},
): MemorySpace[] {
  const { teamId, userId, projectId } = opts;
  const spaces: MemorySpace[] = [];

  // agent 自有空间（工作记忆）
  spaces.push(
    makeMemorySpace("agent", agentId, "episodic"),
    makeMemorySpace("agent", agentId, "semantic"),
    makeMemorySpace("agent", agentId, "task"),
    makeMemorySpace("agent", agentId, "artifact"),
  );

  // team 共享空间
  if (teamId) {
    spaces.push(
      makeMemorySpace("team", teamId, "semantic"),
      makeMemorySpace("team", teamId, "instruction"),
      makeMemorySpace("team", teamId, "rule"),
      makeMemorySpace("team", teamId, "procedural"),
    );
  }

  // user 个人空间（跨 agent 用户画像）
  if (userId) {
    spaces.push(
      makeMemorySpace("user", userId, "persona"),
      makeMemorySpace("user", userId, "preference"),
    );
  }

  // project 空间（可选）
  if (projectId) {
    spaces.push(
      makeMemorySpace("project", projectId, "semantic"),
      makeMemorySpace("project", projectId, "procedural"),
    );
  }

  return spaces;
}