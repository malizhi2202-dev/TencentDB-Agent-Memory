/**
 * git-credentials.ts — 私有 git 仓库凭据 API 客户端。
 *
 * 通过面板 meta 透明代理转发到内核 /v3/meta/git-credential/*：
 *   list   → 脱敏列表（不含 secret/passphrase）
 *   get    → 完整凭据（含 secret/passphrase，仅 owner 可取）
 *   create → 新建（owner 私有）
 *   delete → 删除
 *
 * 契约对齐 MemoryCore git-credential-service：auth_type ∈ password|token|ssh，
 * password 需要 username，token 可选 username，ssh 的 secret 为私钥内容。
 */

import { metaPost } from './base';

export type GitCredentialAuthType = 'password' | 'token' | 'ssh';

/** 列表项（脱敏：不含 secret/passphrase）。 */
export interface GitCredentialListItem {
  credential_id: string;
  name: string;
  auth_type: GitCredentialAuthType;
  host: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
}

/** 完整凭据（仅 owner 可 get）。 */
export interface GitCredentialFull extends GitCredentialListItem {
  owner_user_id: string;
  secret: string;
  passphrase: string | null;
}

export interface GitCredentialCreateInput {
  name: string;
  auth_type: GitCredentialAuthType;
  host?: string;
  username?: string;
  secret: string;
  passphrase?: string;
}

export const gitCredentialsApi = {
  list: () =>
    metaPost<{ items: GitCredentialListItem[]; total: number }>('git-credential/list', {}),

  get: (credential_id: string) =>
    metaPost<GitCredentialFull>('git-credential/get', { credential_id }),

  create: (input: GitCredentialCreateInput) =>
    metaPost<GitCredentialFull>('git-credential/create', { ...input }),

  remove: (credential_id: string) =>
    metaPost<{ deleted: boolean }>('git-credential/delete', { credential_id }),
};
