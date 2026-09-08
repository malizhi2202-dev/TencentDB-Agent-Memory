/**
 * 全局能力权限项（方案B 全量 RBAC）。
 *
 * 与「资产级 ACL」（read/write/delete/assign/share/use，permission-checker.ts）不同，
 * 这里定义的是「全局操作能力」：某个用户有没有资格执行某类操作（能否创建团队、
 * 能否建号、能否看审计日志…）。
 *
 * 判定模型：
 *   hasPermission(ctx, perm) = (预置角色默认 ∪ 显式 user_permissions 授权) 包含 perm
 *   → 再叠加 handler 内的「资源归属断言」（assertCallerIsResourceOwner / TeamAdmin）。
 *
 * 预置角色默认：
 *   - system_admin：全部权限项。
 *   - normal：协作基础能力（不含跨用户/治理类能力）。
 */

export const GLOBAL_PERMISSIONS = [
  // 团队
  "team.create",
  "team.view",
  "team.update",
  "team.delete",
  "team_member.add",
  "team_member.remove",
  // 项目
  "project.create",
  "project.view",
  "project.update",
  "project.delete",
  "project_member.manage",
  // 用户
  "user.create",
  "user.view",
  "user.delete",
  "user.set_password",
  "user_key.manage",
  // Agent
  "agent.create",
  "agent.view",
  "agent.update",
  "agent.delete",
  "agent_fixed_asset.manage",
  // 资产
  "asset.create",
  "asset.view",
  "asset.update",
  "asset.delete",
  "asset.allocate",
  "asset.acl_manage",
  // 任务
  "task.create",
  "task.view",
  "task.update",
  "task.delete",
  "task_agent.manage",
  // 治理
  "audit.view",
  "permission.grant",
  "config.manage",
  "git_credential.manage",
] as const;

export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number];

/** 管理/治理类权限项：默认仅 system_admin，可显式授予普通用户。 */
export const ADMIN_ONLY_PERMISSIONS: readonly GlobalPermission[] = [
  "team.create",
  "user.create",
  "user.delete",
  "user.set_password",
  "audit.view",
  "permission.grant",
  "config.manage",
] as const;

/** system_admin 预置默认：全部权限项。 */
export const SYSTEM_ADMIN_DEFAULT: ReadonlySet<GlobalPermission> = new Set(GLOBAL_PERMISSIONS);

/** normal 预置默认：协作基础能力（去重管理/治理类）。 */
export const NORMAL_DEFAULT: ReadonlySet<GlobalPermission> = new Set(
  GLOBAL_PERMISSIONS.filter((p) => !(ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(p)),
);

/** 权限项 → 中文显示名（供前端权限管理页）。 */
export const PERMISSION_LABELS: Record<GlobalPermission, string> = {
  "team.create": "创建团队",
  "team.view": "查看团队",
  "team.update": "编辑团队",
  "team.delete": "删除团队",
  "team_member.add": "添加团队成员",
  "team_member.remove": "移除团队成员",
  "project.create": "创建项目",
  "project.view": "查看项目",
  "project.update": "编辑项目",
  "project.delete": "删除项目",
  "project_member.manage": "管理项目成员",
  "user.create": "创建用户",
  "user.view": "查看用户",
  "user.delete": "删除用户",
  "user.set_password": "重置用户密码",
  "user_key.manage": "管理 API 密钥",
  "agent.create": "创建 Agent",
  "agent.view": "查看 Agent",
  "agent.update": "编辑 Agent",
  "agent.delete": "删除 Agent",
  "agent_fixed_asset.manage": "绑定/解绑 Agent 资产",
  "asset.create": "创建资产",
  "asset.view": "查看资产",
  "asset.update": "编辑资产",
  "asset.delete": "删除资产",
  "asset.allocate": "分配资产给 Agent",
  "asset.acl_manage": "管理资产授权(ACL)",
  "task.create": "创建任务",
  "task.view": "查看任务",
  "task.update": "编辑任务",
  "task.delete": "删除任务",
  "task_agent.manage": "管理任务 Agent",
  "audit.view": "查看审计日志",
  "permission.grant": "授予权限项",
  "config.manage": "管理全局/用户配置",
  "git_credential.manage": "管理 Git 凭据",
};

export function isGlobalPermission(v: string): v is GlobalPermission {
  return (GLOBAL_PERMISSIONS as readonly string[]).includes(v);
}