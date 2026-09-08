/**
 * Ambient type shim for the OpenClaw host's plugin SDK.
 *
 * `openclaw` is the embedding host application (private, not an npm
 * dependency). In standalone/gateway checkouts the package is absent, so
 * modules that adapt to the host (`adapters/openclaw/host-adapter.ts`,
 * `utils/clean-context-runner.ts`) cannot resolve
 * `import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core"`.
 *
 * This declaration provides the minimal surface those adapters consume:
 *   - `runtime.agent.runEmbeddedPiAgent` — the host's embedded-agent entry
 *     point (LLM call + tool loop). Parameters and result are host-private
 *     and intentionally `any` at this boundary; the standalone
 *     `StandaloneLLMRunner` mirrors the same call shape without the host.
 *   - `logger` — the host logger, structurally compatible with our core
 *     `Logger` (rest-parameter console methods).
 */

declare module "openclaw/plugin-sdk/core" {
  import type { Logger } from "../core/types.js";

  export interface OpenClawPluginApi {
    runtime: {
      agent: {
        /**
         * Host-private embedded agent runner. The rich parameter/result
         * shapes live in the host's own SDK and are opaque here.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEmbeddedPiAgent: (params: any) => Promise<any>;
      };
    };
    logger: Logger;
  }
}
