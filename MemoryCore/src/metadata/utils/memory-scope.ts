/**
 * 记忆/资产读写对称的 scope 推导（public / user / project 三桶）。
 *
 * scope 是「派生值」，不落库：由 visibility + project_id 推导，写三读三同源，
 * 避免多存一处造成漂移。对应 `.specs/CONTEXT.md` 读写对称 + DESIGN-M1 §3。
 */

import type { AssetVisibility } from "../types.js";

export type MemoryScope = "public" | "user" | "project";

/**
 * 由 (visibility, project_id) 推导三桶 scope。
 *
 * - `project_id` 命中 → `project`（可见域 = project.members，跨 team）
 * - `visibility === "team"` 且未挂 project → `public`（可见域 = 该 team 成员）
 * - 其余（private / restricted / agent / task）→ `user`（owner 兜底，restricted 叠加 ACL）
 */
export function resolveMemoryScope(
  visibility: AssetVisibility,
  projectId: string | null | undefined,
): MemoryScope {
  if (projectId) return "project";
  if (visibility === "team") return "public";
  return "user";
}