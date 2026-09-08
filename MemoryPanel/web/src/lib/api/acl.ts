/**
 * acl.ts — 权限（ACL）数据面封装。
 *
 * 后端已有 /api/v1/meta/acl/{grant,revoke,list,check}（见 MemoryCore v3-meta-router），
 * 权限项 = read | write | delete | assign | share | use，主体 = user | team_role | agent。
 * 本文件只做前端数据面封装，供「权限管理」界面调用。
 */
import { metaPost, metaListAll } from './base';
import { getPanelSession } from '@/lib/panelSession';

export type AclPermission = 'read' | 'write' | 'delete' | 'assign' | 'share' | 'use';
export type AclSubjectType = 'user' | 'team_role' | 'agent';
export type AclEffect = 'allow' | 'deny';

export interface AclEntity {
  id: string;
  asset_id: string;
  subject_type: AclSubjectType;
  subject_id: string;
  permission: AclPermission;
  effect: AclEffect;
  granted_by: string;
  created_at: string;
  updated_at: string;
}

export interface AclGrantInput {
  asset_id: string;
  subject_type: AclSubjectType;
  subject_id: string;
  permission: AclPermission;
  effect?: AclEffect;
}

export const PERMISSION_OPTIONS: { value: AclPermission; text: string }[] = [
  { value: 'read', text: 'read（读）' },
  { value: 'write', text: 'write（写）' },
  { value: 'delete', text: 'delete（删除）' },
  { value: 'assign', text: 'assign（分配）' },
  { value: 'share', text: 'share（共享）' },
  { value: 'use', text: 'use（使用）' },
];

export const SUBJECT_TYPE_OPTIONS: { value: AclSubjectType; text: string }[] = [
  { value: 'user', text: 'user（用户）' },
  { value: 'team_role', text: 'team_role（团队角色）' },
  { value: 'agent', text: 'agent（Agent）' },
];

export const aclApi = {
  /** 授予权限（granted_by 由当前登录会话的 user_id 提供，与后端 caller 校验对齐）。 */
  grant: (input: AclGrantInput): Promise<AclEntity> => {
    const session = getPanelSession();
    return metaPost<AclEntity>('acl/grant', {
      ...input,
      granted_by: session?.user?.user_id,
    });
  },

  /** 撤销一条授权。 */
  revoke: (id: string): Promise<{ ok: boolean }> => metaPost<{ ok: boolean }>('acl/revoke', { id }),

  /** 列出某个资产上的全部授权（需 asset owner / team admin / system_admin）。 */
  list: (assetId: string): Promise<AclEntity[]> => metaListAll<AclEntity>('acl/list', { asset_id: assetId }),
};
