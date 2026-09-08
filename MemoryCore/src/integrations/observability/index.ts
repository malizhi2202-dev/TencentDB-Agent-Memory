/**
 * Private-submodule stub for `src/integrations/observability/index.ts`.
 *
 * The real implementation lives in the private `integrations/` submodule and is
 * NOT part of this repository. It wires the internal observability stack
 * (智研 + ClickHouse) behind the `IObservabilityBackend` abstraction for
 * `deployMode=service` deployments.
 *
 * This stub exists so that type-checking passes in checkouts without the
 * private submodule. Runtime semantics are identical to "module missing":
 * `loadInternalBackend()` in `src/core/report/factory.ts` wraps the dynamic
 * import in try/catch and falls back to the console/noop backend, so this
 * module's factory throwing on call preserves the existing fallback path.
 */

import type {
  IObservabilityBackend,
  ObservabilityConfig,
} from "../../core/report/types.js";

const NOT_AVAILABLE =
  "integrations/observability is a private submodule and is not available in this build; " +
  "the observability factory falls back to the console backend";

/**
 * Always-throwing placeholder factory. Signature matches the private
 * submodule's export consumed by `loadInternalBackend()`.
 */
export async function createInternalObservabilityBackend(
  _config: ObservabilityConfig,
): Promise<IObservabilityBackend> {
  throw new Error(NOT_AVAILABLE);
}
