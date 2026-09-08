/**
 * Ambient declaration for the OPTIONAL `@context-proxy/cost-guard` submodule
 * (packages/cost-guard, referenced by tsconfig `paths`).
 *
 * The submodule is deliberately absent in open-source checkouts — see
 * docs/design/2026-07-11-cos-submodule-extraction-plan.md §4.2 决策 3 and
 * src/storage/factory.ts::initProxyStorage: the import is a dynamic
 * `await import("@context-proxy/cost-guard")` wrapped in try/catch, and a
 * missing module simply degrades the cos backend (配置 cos 才会走 factory 的
 * cos 分支；本地/离线默认 sqlite/fs/memory 完全不受影响).
 *
 * This file only describes the module surface for typecheck when the
 * submodule directory is not checked out; it does NOT make the module exist
 * at runtime.
 */
declare module "@context-proxy/cost-guard" {
  import type { CosLikeBackend, KernelStsCosOptions } from "./storage/cos-types.js";
  export function openKernelStsCosBackend(opts: KernelStsCosOptions): CosLikeBackend;
}
