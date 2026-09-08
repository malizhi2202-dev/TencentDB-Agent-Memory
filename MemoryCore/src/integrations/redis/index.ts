/**
 * Private-submodule stub for `src/integrations/redis/index.ts`.
 *
 * The real implementation lives in the private `integrations/` submodule and is
 * NOT part of this repository. It provides Redis-backed state (pipeline
 * buffers, session state, timers, task queue, locks) for `deployMode=service`
 * multi-node deployments.
 *
 * This stub exists so that type-checking passes in checkouts without the
 * private submodule. Runtime semantics: `createStateBackend()` in
 * `src/core/state/index.ts` dynamically imports this module only when
 * `state_backend=redis` is configured; constructing the backend here throws
 * with the same guidance as the module-missing path — use
 * `state_backend=local` (default) in standalone mode.
 */

import type {
  CaptureAtomicParams,
  CaptureAtomicResult,
  IStateBackend,
  PipelineSessionState,
  TaskPayload,
  TimerEntry,
} from "../../core/state/types.js";

const NOT_AVAILABLE =
  "integrations/redis is a private submodule and is not available in this build; " +
  "use state_backend=local (standalone default) or provide a build that includes the submodule";

/** Options accepted by {@link RedisStateBackend}. */
export interface RedisStateBackendOptions {
  /** Pre-connected ioredis client (single node or cluster). */
  client: unknown;
  /** Key prefix for all Redis keys (namespacing per instance/deployment). */
  keyPrefix?: string;
  /** Redis Stream consumer group name for the task queue. */
  consumerGroup?: string;
}

/**
 * Always-throwing placeholder. The real backend (private submodule) implements
 * the full {@link IStateBackend} contract over Redis hashes / sorted sets /
 * streams; every method here throws because this build cannot reach Redis
 * state features.
 */
export class RedisStateBackend implements IStateBackend {
  constructor(_opts: RedisStateBackendOptions) {
    throw new Error(NOT_AVAILABLE);
  }

  // ═══ Buffer ═══
  appendBuffer(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  drainBuffer(): Promise<string[]> { throw new Error(NOT_AVAILABLE); }
  getBufferLength(): Promise<number> { throw new Error(NOT_AVAILABLE); }

  // ═══ Session State ═══
  getSessionState(): Promise<PipelineSessionState | null> { throw new Error(NOT_AVAILABLE); }
  updateSessionState(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  deleteSessionState(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  listActiveSessions(): Promise<string[]> { throw new Error(NOT_AVAILABLE); }

  // ═══ Timer ═══
  setTimer(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  setTimerIfEarlier(): Promise<boolean> { throw new Error(NOT_AVAILABLE); }
  removeTimer(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  getExpiredTimers(): Promise<TimerEntry[]> { throw new Error(NOT_AVAILABLE); }

  // ═══ Task Queue ═══
  enqueueTask(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  consumeTask(): Promise<TaskPayload | null> { throw new Error(NOT_AVAILABLE); }
  ackTask(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  getQueueDepth(): Promise<{ high: number; low: number }> { throw new Error(NOT_AVAILABLE); }

  // ═══ Lock ═══
  acquireLock(): Promise<boolean> { throw new Error(NOT_AVAILABLE); }
  renewLock(): Promise<boolean> { throw new Error(NOT_AVAILABLE); }
  releaseLock(): Promise<void> { throw new Error(NOT_AVAILABLE); }

  // ═══ Atomic Capture ═══
  captureAtomic(_params: CaptureAtomicParams): Promise<CaptureAtomicResult> { throw new Error(NOT_AVAILABLE); }

  // ═══ Lifecycle（IStateBackend 可选钩子；构造即抛，这里仅为类型完备）═══
  async initialize(): Promise<void> { throw new Error(NOT_AVAILABLE); }
  async purgeInstance(_instanceId: string): Promise<{ sessions: number; timers: number; buffers: number }> {
    throw new Error(NOT_AVAILABLE);
  }
}
