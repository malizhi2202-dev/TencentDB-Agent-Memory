import type { MetaEnvelope } from '../envelope.js';
import type { MetaCallContext } from '../types.js';

/**
 * 内核 /v3/memory/* 记忆能力透明代理端口。
 * 与 SkillKernelPort 同形，转发到 /v3/memory/{action}。
 */
export interface MemoryKernelPort {
  invoke(action: string, body: Record<string, unknown>, ctx: MetaCallContext): Promise<MetaEnvelope>;
}