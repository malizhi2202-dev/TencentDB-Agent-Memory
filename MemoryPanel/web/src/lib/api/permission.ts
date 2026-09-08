/**
 * permission.ts — 全局能力权限项（方案B RBAC）数据面封装。
 *
 * 后端 /api/v1/meta/permission/{grant,revoke,list,check}，权限项 = 资源.动作
 * （team.create、user.delete、audit.view …），与 MemoryCore global-permissions.ts 对齐。
 */
import { metaPost, metaListAll } from './base';

export interface PermissionGrantRecord {
  id: string;
  user_id: string;
  permission: string;
  granted_by: string;
  created_at: string;
}

export interface PermissionDef {
  value: string;
  label: string;
}

export interface PermissionGroup {
  group: string;
  items: PermissionDef[];
}

/** 权限项目录（与后端 GLOBAL_PERMISSIONS 对齐，按资源域分组）。 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: '团队',
    items: [
      { value: 'team.create', label: '创建团队' },
      { value: 'team.view', label: '查看团队' },
      { value: 'team.update', label: '编辑团队' },
      { value: 'team.delete', label: '删除团队' },
      { value: 'team_member.add', label: '添加团队成员' },
      { value: 'team_member.remove', label: '移除团队成员' },
    ],
  },
  {
    group: '项目',
    items: [
      { value: 'project.create', label: '创建项目' },
      { value: 'project.view', label: '查看项目' },
      { value: 'project.update', label: '编辑项目' },
      { value: 'project.delete', label: '删除项目' },
      { value: 'project_member.manage', label: '管理项目成员' },
    ],
  },
  {
    group: '用户',
    items: [
      { value: 'user.create', label: '创建用户' },
      { value: 'user.view', label: '查看用户' },
      { value: 'user.delete', label: '删除用户' },
      { value: 'user.set_password', label: '重置用户密码' },
      { value: 'user_key.manage', label: '管理 API 密钥' },
    ],
  },
  {
    group: 'Agent',
    items: [
      { value: 'agent.create', label: '创建 Agent' },
      { value: 'agent.view', label: '查看 Agent' },
      { value: 'agent.update', label: '编辑 Agent' },
      { value: 'agent.delete', label: '删除 Agent' },
      { value: 'agent_fixed_asset.manage', label: '绑定/解绑 Agent 资产' },
    ],
  },
  {
    group: '资产',
    items: [
      { value: 'asset.create', label: '创建资产' },
      { value: 'asset.view', label: '查看资产' },
      { value: 'asset.update', label: '编辑资产' },
      { value: 'asset.delete', label: '删除资产' },
      { value: 'asset.allocate', label: '分配资产给 Agent' },
      { value: 'asset.acl_manage', label: '管理资产授权(ACL)' },
    ],
  },
  {
    group: '任务',
    items: [
      { value: 'task.create', label: '创建任务' },
      { value: 'task.view', label: '查看任务' },
      { value: 'task.update', label: '编辑任务' },
      { value: 'task.delete', label: '删除任务' },
      { value: 'task_agent.manage', label: '管理任务 Agent' },
    ],
  },
  {
    group: '治理',
    items: [
      { value: 'audit.view', label: '查看审计日志' },
      { value: 'permission.grant', label: '授予权限项' },
      { value: 'config.manage', label: '管理全局/用户配置' },
      { value: 'git_credential.manage', label: '管理 Git 凭据' },
    ],
  },
];

/** 扁平化的所有权限项（value -> label）。 */
export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap((g) => g.items);

/** 管理/治理类权限项：默认仅 system_admin，可显式授予普通用户（与后端 ADMIN_ONLY_PERMISSIONS 对齐）。 */
export const ADMIN_ONLY_PERMISSIONS = new Set<string>([
  'team.create',
  'user.create',
  'user.delete',
  'user.set_password',
  'audit.view',
  'permission.grant',
  'config.manage',
]);

/** 默认开启（普通用户协作基础能力）的权限项：无需显式授权，开关不可关闭。 */
export const DEFAULT_ON_PERMISSIONS = new Set<string>(
  ALL_PERMISSIONS.filter((p) => !ADMIN_ONLY_PERMISSIONS.has(p.value)).map((p) => p.value),
);

/** 某权限项是否默认开启（协作基础能力）。 */
export function isDefaultOn(perm: string): boolean {
  return DEFAULT_ON_PERMISSIONS.has(perm);
}

export const permissionApi = {
  /** 列出授权记录（admin 传 user_id 过滤；普通用户只能看到自己的）。 */
  list: (userId?: string): Promise<PermissionGrantRecord[]> =>
    metaListAll<PermissionGrantRecord>('permission/list', userId ? { user_id: userId } : {}),

  /** 授予某个用户一个权限项。 */
  grant: (userId: string, permission: string): Promise<PermissionGrantRecord> =>
    metaPost<PermissionGrantRecord>('permission/grant', { user_id: userId, permission }),

  /** 撤销某个用户的某个权限项。 */
  revoke: (userId: string, permission: string): Promise<{ ok: boolean }> =>
    metaPost<{ ok: boolean }>('permission/revoke', { user_id: userId, permission }),

  /** 当前登录者是否拥有某权限项。 */
  check: (permission: string): Promise<{ allowed: boolean }> =>
    metaPost<{ allowed: boolean }>('permission/check', { permission }),
};
