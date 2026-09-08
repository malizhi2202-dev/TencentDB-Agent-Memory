/**
 * Trusted identity headers (方案 B).
 *
 * When `sessionInit.trustIdentityHeaders.enabled` is true the proxy adopts the
 * identity carried by the client request headers DIRECTLY, without kernel
 * validation. This is the per-request equivalent of `debugForceIdentity` — it
 * lets each caller (e.g. a per-project penguin-harness server) pin its own
 * team/agent/task by sending `x-team-id` / `x-agent-id` / `x-task-id`.
 *
 * Security: this is an explicit opt-in for trusted internal clients only. It
 * bypasses the tenant-scope validation that `headerAutoSelect` performs
 * (kernel /v3/meta/* availability, team membership, …). Never enable it on a
 * public-facing endpoint.
 */
import type { SessionInitConfig } from "../types.js";

/** Identity values adopted directly from request headers. */
export interface TrustedIdentity {
  team_id: string;
  agent_id: string;
  task_id?: string;
}

/**
 * Extract a trusted identity from the (lowercased) request headers.
 * Returns undefined when the feature is disabled or team/agent headers are
 * missing/empty — callers then keep their original flow untouched.
 */
export function resolveTrustedIdentity(
  cfg: SessionInitConfig | undefined,
  lcHeaders: Record<string, string>,
): TrustedIdentity | undefined {
  if (!cfg?.trustIdentityHeaders?.enabled) return undefined;
  const t = cfg.trustIdentityHeaders;
  const h = (name?: string) => (name ? (lcHeaders[name.toLowerCase()] ?? "").trim() : "");
  const teamId = h(t.teamHeader);
  const agentId = h(t.agentHeader);
  if (!teamId || !agentId) return undefined;
  const taskId = h(t.taskHeader);
  return { team_id: teamId, agent_id: agentId, task_id: taskId || undefined };
}

/**
 * Resolve the trusted identity and, when present, return a per-request
 * SessionInitConfig that forces it through the existing debugForceIdentity
 * bypass (shared by codebuddy/claude-code/workbuddy/codex state machines).
 *
 * Also disables `headerAutoSelect` for this request — a trusted identity is
 * already final, and running the kernel-validating preset on top of it would
 * only mismatch in standalone/offline deployments.
 */
export function buildSessionInitWithTrustedIdentity(
  cfg: SessionInitConfig,
  lcHeaders: Record<string, string>,
): { cfg: SessionInitConfig; trusted: TrustedIdentity | undefined } {
  const trusted = resolveTrustedIdentity(cfg, lcHeaders);
  if (!trusted) return { cfg, trusted };
  return {
    trusted,
    cfg: {
      ...cfg,
      debugForceIdentity: trusted,
      headerAutoSelect: cfg.headerAutoSelect
        ? { ...cfg.headerAutoSelect, enabled: false }
        : cfg.headerAutoSelect,
    },
  };
}