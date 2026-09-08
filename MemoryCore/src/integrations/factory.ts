/**
 * Private-submodule stub for `src/integrations/factory.ts`.
 *
 * The real implementation lives in the private `integrations/` submodule and
 * is NOT part of this repository. It wires deployment-specific adapter
 * dependencies (config source backed by Shark, quota reporter) for
 * `deployMode=service` deployments.
 *
 * This stub exists so that type-checking passes in checkouts without the
 * private submodule. `createAdapterDeps()` always throws; the gateway call
 * site catches this and either fails fast (service mode, which genuinely
 * needs the submodule) or falls back to inline LocalConfigSource +
 * NoopQuotaReporter (standalone mode). See `src/gateway/server.ts`.
 */

import type { IConfigSource, IQuotaReporter } from "../core/abstractions/types.js";
import type { StorageLogger } from "../core/storage/types.js";

const NOT_AVAILABLE =
  "integrations/factory is a private submodule and is not available in this build; " +
  "use deployMode=standalone or provide a build that includes the submodule";

/** Options accepted by {@link createAdapterDeps}. */
export interface CreateAdapterDepsOptions {
  deployMode: string;
  sharkBaseUrl?: string;
  logger?: StorageLogger;
}

/** Adapter dependencies returned by {@link createAdapterDeps}. */
export interface AdapterDeps {
  configSource: IConfigSource;
  quotaReporter: IQuotaReporter;
}

/**
 * Build deployment-specific adapter dependencies.
 * @throws Always — private submodule not present in this build.
 */
export async function createAdapterDeps(_options: CreateAdapterDepsOptions): Promise<AdapterDeps> {
  throw new Error(NOT_AVAILABLE);
}
