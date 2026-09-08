/**
 * Private-submodule stub for `src/integrations/cos/cos-backend.ts`.
 *
 * The real implementation lives in the private `integrations/` submodule and is
 * NOT part of this repository. It provides Tencent Cloud COS connectivity for
 * `deployMode=service` deployments.
 *
 * This stub exists so that type-checking passes in checkouts without the
 * private submodule. Runtime semantics are identical to "module missing":
 * every constructor/method throws, and all call sites in the gateway wrap
 * these calls in try/catch with a standalone-mode fallback (see
 * `initSharedCosClient()` and `resolveFileOthersForInstance()` in
 * `src/gateway/server.ts`, and `createStorageBackend()` in
 * `src/core/storage/factory.ts`).
 *
 * Standalone deployments never reach this module: COS paths are only
 * activated when a Shark-backed InstanceConfigProvider supplies COS
 * credentials, which standalone mode does not have.
 */

import type {
  ICredentialProvider,
  IStorageBackend,
  ListObjectsOptions,
  ListResult,
  PutObjectOptions,
  StorageLogger,
  StorageObject,
} from "../../core/storage/types.js";

const NOT_AVAILABLE =
  "integrations/cos/cos-backend is a private submodule and is not available in this build; " +
  "use deployMode=standalone (local storage) or provide a build that includes the submodule";

/** Options accepted by {@link SharedCosClient}. */
export interface SharedCosClientOptions {
  credentialProvider: ICredentialProvider;
  logger?: StorageLogger;
  cosEndpointDomain?: string;
}

/**
 * Process-wide shared COS client (connection + credential cache).
 * Only one instance should exist per gateway process.
 */
export class SharedCosClient {
  constructor(_options: SharedCosClientOptions) {
    throw new Error(NOT_AVAILABLE);
  }

  /** Get (or lazily create) the underlying COS SDK client. */
  async getClient(): Promise<unknown> {
    throw new Error(NOT_AVAILABLE);
  }

  /** Ensure generation-log lifecycle rule with the given retention (days). */
  async ensureGenerationLogRetention(_retentionDays: number): Promise<void> {
    throw new Error(NOT_AVAILABLE);
  }
}

/** Options for {@link CosStorageBackend} (per-instance, lightweight). */
export interface CosStorageBackendOptions {
  /** Shared client mode (per-instance prefix on top of a SharedCosClient). */
  sharedClient?: SharedCosClient;
  /** Standalone-credential mode (own client from a credential provider). */
  credentialProvider?: ICredentialProvider;
  /** Key prefix for all objects managed by this backend. */
  prefix?: string;
  logger?: StorageLogger;
}

/**
 * Tencent Cloud COS implementation of {@link IStorageBackend}.
 * Uses Append Object API for `appendObject` (server-side atomic).
 */
export class CosStorageBackend implements IStorageBackend {
  readonly type = "cos" as const;

  constructor(_options: CosStorageBackendOptions) {
    throw new Error(NOT_AVAILABLE);
  }

  async putObject(_key: string, _content: string | Buffer, _opts?: PutObjectOptions): Promise<void> {
    throw new Error(NOT_AVAILABLE);
  }

  async appendObject(_key: string, _content: string | Buffer): Promise<void> {
    throw new Error(NOT_AVAILABLE);
  }

  async getObject(_key: string): Promise<StorageObject | null> {
    throw new Error(NOT_AVAILABLE);
  }

  async exists(_key: string): Promise<boolean> {
    throw new Error(NOT_AVAILABLE);
  }

  async listObjects(_prefix: string, _opts?: ListObjectsOptions): Promise<ListResult> {
    throw new Error(NOT_AVAILABLE);
  }

  async deleteObject(_key: string): Promise<void> {
    throw new Error(NOT_AVAILABLE);
  }

  async deleteByPrefix(_prefix: string): Promise<number> {
    throw new Error(NOT_AVAILABLE);
  }
}
