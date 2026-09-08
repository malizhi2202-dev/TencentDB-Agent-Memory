import type { KernelHttpPort } from '../ports/kernel-http-port.js';
import type { MemoryKernelPort } from '../ports/memory-kernel-port.js';
import { toKernelCredentials, type MetaCallContext } from '../types.js';

/**
 * 基于 fetch 的记忆能力适配器：POST /v3/memory/{action}。
 *
 * 凭证与 meta/skill 共用同一套（instance + api_key + user_key）。
 * 纯计算端点不读 user_key；space/list 用 instanceId（x-tdai-service-id）定位元数据。
 */
export class FetchMemoryKernelAdapter implements MemoryKernelPort {
  constructor(
    private readonly http: KernelHttpPort,
    private readonly timeoutMs: number,
  ) {}

  invoke(action: string, body: Record<string, unknown>, ctx: MetaCallContext) {
    const cred = toKernelCredentials(ctx, { timeoutMs: this.timeoutMs });
    return this.http.postEnvelope(`/v3/memory/${action}`, body, cred);
  }
}