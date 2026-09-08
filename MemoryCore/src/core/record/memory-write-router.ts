/**
 * Memory Write Router（记忆写入路由，服务端裁决）.
 *
 * P0.1 阶段 C：把「一条记忆写到哪个空间、以什么策略写」从模型/调用方
 * 自由决定，改为服务端按 (domain, source, 隔离) 裁决。
 *
 * 铁律：调用方（模型）只能给出「内容域 domain + 来源 source + 隔离维度」，
 * 不能自选 spaceId / write_policy —— spaceId 由服务端确定性计算，
 * write_policy 由「空间基线 + source 收紧」合并，只能收紧不能放宽。
 *
 * 设计依据：.specs/design-memory-domain-write-model.md §三，对标 Agent OS 的
 * `space_learn`（memory:write）+ 模型不得自批准，以及 MindMemOS 缺失的
 * 「CAS / ownership / 服务端 scope enforcement」。
 */

import { resolveWritePolicy, type MemoryDomain, type WritePolicy } from "./memory-domain.js";
import { makeMemorySpace, type MemorySpace, type SpaceOwnerType } from "./memory-space.js";

/** 写入来源：决定这条记忆是「用户显式」还是「系统总结」，参与策略裁决。 */
export type WriteSource =
  | "user_explicit"      // 用户显式给出（指令/规则/纠正）
  | "agent_insight"      // agent 从工作过程总结出的洞察
  | "file_upload"        // 上传的文件/文档/工件
  | "system_extract"     // 系统自动从对话抽取
  | "feedback_correction"; // 用户对已有记忆的反馈纠正

export interface RouteMemorySpaceInput {
  domain: MemoryDomain;
  source: WriteSource;
  teamId?: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
  projectId?: string;
}

export interface RouteMemorySpaceResult {
  /** 服务端裁决后的空间 ID（调用方不可自选） */
  spaceId: string;
  space: MemorySpace;
  /** 合并空间基线 + source 收紧后的最终写入策略 */
  effectivePolicy: WritePolicy;
  source: WriteSource;
  domain: MemoryDomain;
}

/**
 * 由 domain + source 推导「来源要求的最小策略」（写入策略收紧方向）。
 * - instruction/rule 是持久更改，无论来源都必须 explicit_only（用户显式操作）
 * - feedback_correction 是用户纠正 → explicit_only
 * - user_explicit / file_upload → 至少 review_required
 * - agent_insight / system_extract → automatic（系统总结）
 */
export function sourcePolicyFor(source: WriteSource, domain: MemoryDomain): WritePolicy {
  if (domain === "instruction" || domain === "rule") return "explicit_only";
  if (source === "feedback_correction") return "explicit_only";
  if (source === "user_explicit" || source === "file_upload") return "review_required";
  return "automatic";
}

/**
 * 空间归属（自动区分记忆空间）：按 domain 语义决定这条记忆属于谁。
 * - persona/preference → user（跨 agent 用户画像）
 * - instruction/rule → team（团队规则，缺 team 时 user/agent）
 * - episodic/task/artifact → task（有 taskId 时）或 agent（工作记忆）
 * - semantic/procedural/graph → project > team > agent（共享知识）
 * - raw/archive → agent
 */
export function resolveSpaceOwner(input: RouteMemorySpaceInput): { ownerType: SpaceOwnerType; ownerId: string } {
  const { domain, teamId, userId, agentId, taskId, projectId } = input;
  const agent = agentId ?? "default_agent";

  switch (domain) {
    case "persona":
    case "preference":
      return userId ? { ownerType: "user", ownerId: userId } : { ownerType: "agent", ownerId: agent };

    case "instruction":
    case "rule":
      if (teamId) return { ownerType: "team", ownerId: teamId };
      if (userId) return { ownerType: "user", ownerId: userId };
      return { ownerType: "agent", ownerId: agent };

    case "episodic":
    case "task":
    case "artifact":
      return taskId ? { ownerType: "task", ownerId: taskId } : { ownerType: "agent", ownerId: agent };

    case "semantic":
    case "procedural":
    case "graph":
      if (projectId) return { ownerType: "project", ownerId: projectId };
      if (teamId) return { ownerType: "team", ownerId: teamId };
      return { ownerType: "agent", ownerId: agent };

    case "raw":
    case "archive":
    default:
      return { ownerType: "agent", ownerId: agent };
  }
}

/**
 * 服务端裁决：把一条记忆路由到确定性空间，并解析最终写入策略。
 * 空间基线与 source 收紧合并时只能收紧（resolveWritePolicy 的语义），
 * 保证「系统总结永不能放宽为覆盖持久更改」。
 */
export function routeMemorySpace(input: RouteMemorySpaceInput): RouteMemorySpaceResult {
  const owner = resolveSpaceOwner(input);
  const space = makeMemorySpace(owner.ownerType, owner.ownerId, input.domain);

  const sourcePolicy = sourcePolicyFor(input.source, input.domain);
  const merged = resolveWritePolicy(space.writePolicy, sourcePolicy);
  const effectivePolicy = merged.ok ? merged.policy : space.writePolicy;

  return {
    spaceId: space.spaceId,
    space,
    effectivePolicy,
    source: input.source,
    domain: input.domain,
  };
}