/**
 * GitCredentialService — git 仓库私有凭据业务逻辑层。
 *
 * 持久化复用 meta_config_params 表（scope='user'，module='git_credential'），
 * 凭据与 owner_user_id 强绑定（owner 隔离）：
 *   - param_name = credential_id（gitc-xxx）
 *   - param_value = JSON(auth_type, host, username, secret, passphrase)
 *   - description = 别名 name
 *
 * 凭据仅 owner 本人可见/可用 —— password / token / SSH 私钥是用户私有秘密，
 * system_admin 也不得读取他人凭据（与 config_params 的 user scope 语义一致）。
 *
 * 当前 secret 明文落地（先跑通功能）；后续可在此处叠加加密（换 store 写入前的
 * 编码点即可，不影响调用方）。
 */

import type { IMetadataStore } from "../store/interface.js";
import type { ConfigParamEntity } from "../types.js";
import { generateId, ID_PREFIX } from "../utils/id-generator.js";

export const GIT_CREDENTIAL_MODULE = "git_credential";

export type GitCredentialAuthType = "password" | "token" | "ssh";

export interface GitCredentialInput {
  name: string;
  auth_type: GitCredentialAuthType;
  host?: string | null;
  username?: string | null;
  /** password 值 / token 值 / SSH 私钥内容。 */
  secret: string;
  /** SSH 私钥口令（可选）。 */
  passphrase?: string | null;
}

export interface GitCredentialRecord {
  credential_id: string;
  owner_user_id: string;
  name: string;
  auth_type: GitCredentialAuthType;
  host: string | null;
  username: string | null;
  secret: string;
  passphrase: string | null;
  created_at: string;
  updated_at: string;
}

/** 列表项：脱敏，不含 secret / passphrase。 */
export interface GitCredentialListItem {
  credential_id: string;
  name: string;
  auth_type: GitCredentialAuthType;
  host: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
}

interface GitCredentialSecretPayload {
  auth_type: GitCredentialAuthType;
  host: string | null;
  username: string | null;
  secret: string;
  passphrase: string | null;
}

export class GitCredentialService {
  constructor(private readonly store: IMetadataStore) {}

  async create(ownerUserId: string, input: GitCredentialInput): Promise<GitCredentialRecord> {
    const credentialId = generateId(ID_PREFIX.gitCredential);
    const payload: GitCredentialSecretPayload = {
      auth_type: input.auth_type,
      host: input.host?.trim() ? input.host.trim() : null,
      username: input.username?.trim() ? input.username.trim() : null,
      secret: input.secret,
      passphrase: input.passphrase ?? null,
    };
    const entity = await this.store.upsertConfigParam({
      scope: "user",
      user_id: ownerUserId,
      module: GIT_CREDENTIAL_MODULE,
      param_name: credentialId,
      param_value: JSON.stringify(payload),
      description: input.name.trim() || credentialId,
    });
    return this.toRecord(entity, ownerUserId);
  }

  async list(ownerUserId: string): Promise<GitCredentialListItem[]> {
    const entities = await this.store.listConfigParams({
      scope: "user",
      module: GIT_CREDENTIAL_MODULE,
      userId: ownerUserId,
    });
    return entities.map((e) => this.toListItem(e));
  }

  async get(ownerUserId: string, credentialId: string): Promise<GitCredentialRecord | null> {
    const entity = await this.store.getConfigParam(
      "user",
      ownerUserId,
      GIT_CREDENTIAL_MODULE,
      credentialId,
    );
    if (!entity) return null;
    return this.toRecord(entity, ownerUserId);
  }

  async deleteCredential(ownerUserId: string, credentialId: string): Promise<boolean> {
    return this.store.deleteConfigParam("user", ownerUserId, GIT_CREDENTIAL_MODULE, credentialId);
  }

  private toListItem(e: ConfigParamEntity): GitCredentialListItem {
    const payload = this.parsePayload(e.param_value);
    return {
      credential_id: e.param_name,
      name: e.description,
      auth_type: payload.auth_type,
      host: payload.host,
      username: payload.username,
      created_at: e.created_at,
      updated_at: e.updated_at,
    };
  }

  private toRecord(e: ConfigParamEntity, ownerUserId: string): GitCredentialRecord {
    const payload = this.parsePayload(e.param_value);
    return {
      credential_id: e.param_name,
      owner_user_id: ownerUserId,
      name: e.description,
      auth_type: payload.auth_type,
      host: payload.host,
      username: payload.username,
      secret: payload.secret,
      passphrase: payload.passphrase,
      created_at: e.created_at,
      updated_at: e.updated_at,
    };
  }

  private parsePayload(raw: string): GitCredentialSecretPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { auth_type: "password", host: null, username: null, secret: "", passphrase: null };
    }
    const p = (parsed ?? {}) as Record<string, unknown>;
    const authType: GitCredentialAuthType =
      p.auth_type === "password" || p.auth_type === "token" || p.auth_type === "ssh"
        ? p.auth_type
        : "password";
    return {
      auth_type: authType,
      host: typeof p.host === "string" && p.host ? p.host : null,
      username: typeof p.username === "string" && p.username ? p.username : null,
      secret: typeof p.secret === "string" ? p.secret : "",
      passphrase: typeof p.passphrase === "string" && p.passphrase ? p.passphrase : null,
    };
  }
}
