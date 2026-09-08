/**
 * Execution Bundle（执行包编译，P1.1 关系灵活化）.
 *
 * 补齐对比文档 §1 的「关系不灵活」：TencentDB 现有 `AgentEntity.team_id`
 * 是单值外键（一对多），资产主要绑 Agent，无「定义运行分离」的统一编译。
 *
 * resolveExecutionBundle 是**纯函数边界**（对标 Agent OS
 * `team_execution_compiler.rs`）：
 * - 不读库、不做后端选择、不掌握审批/终态权威
 * - 从「已授权输入」（agent 的 team/user/project/task/scene 关系）确定性推导
 *   「执行上下文」= 挂载空间（多对多）+ 场景 + 确定性 bundleId
 * - 同一份输入 → 同一 bundleId，支撑「一次运行从头到尾同一份配置」的快照校验
 *
 * 多对多语义：一个 agent 挂载多个空间（agent 自有 + team 共享 + user 画像 +
 * project 知识），解决单值 `team_id` 无法表达「一个 agent 跨多个团队/项目」的局限。
 */

import { createHash } from "node:crypto";
import { mountSpacesForAgent, type MemorySpace } from "./memory-space.js";

export interface ExecutionBundleInput {
  agentId: string;
  teamId?: string;
  userId?: string;
  projectId?: string;
  taskId?: string;
  sceneIds?: string[];
}

export interface ExecutionBundle {
  agentId: string;
  /** 挂载空间（多对多）：agent 自有 + team + user + project 的域空间 */
  mountedSpaces: MemorySpace[];
  /** 相关场景（排序后确定性） */
  sceneIds: string[];
  teamId?: string;
  userId?: string;
  projectId?: string;
  taskId?: string;
  /** 确定性 bundle id：同一份输入 → 同一 id（定义运行分离的校验锚点） */
  bundleId: string;
}

/** 纯函数：从已授权输入编译执行包。 */
export function resolveExecutionBundle(input: ExecutionBundleInput): ExecutionBundle {
  const { agentId, teamId, userId, projectId, taskId } = input;
  const mountedSpaces = mountSpacesForAgent(agentId, { teamId, userId, projectId });
  const sceneIds = [...(input.sceneIds ?? [])].sort();

  const bundleId = computeBundleId({ agentId, teamId, userId, projectId, taskId, sceneIds, mountedSpaces });

  return {
    agentId,
    mountedSpaces,
    sceneIds,
    teamId,
    userId,
    projectId,
    taskId,
    bundleId,
  };
}

/**
 * 确定性 bundleId：对「身份 + 关系 + 场景 + 挂载空间（含每空间策略）」做
 * 规范化序列化后取 sha1。任何维度变化都会得到不同 id，从而可检测
 * 「运行中配置被改动」。
 */
function computeBundleId(parts: {
  agentId: string;
  teamId?: string;
  userId?: string;
  projectId?: string;
  taskId?: string;
  sceneIds: string[];
  mountedSpaces: MemorySpace[];
}): string {
  const canonical = JSON.stringify({
    agentId: parts.agentId,
    teamId: parts.teamId ?? null,
    userId: parts.userId ?? null,
    projectId: parts.projectId ?? null,
    taskId: parts.taskId ?? null,
    sceneIds: parts.sceneIds,
    spaces: parts.mountedSpaces
      .map((s) => `${s.ownerType}:${s.ownerId}:${s.domain}:${s.writePolicy}`)
      .sort(),
  });
  return `bundle_${createHash("sha1").update(canonical).digest("hex").slice(0, 12)}`;
}