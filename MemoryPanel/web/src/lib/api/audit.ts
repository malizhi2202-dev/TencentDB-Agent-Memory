/**
 * audit.ts — 审计日志数据面封装（治理收尾）。
 *
 * 后端 /api/v1/meta/audit/list 仅 system_admin 可查，返回 PaginatedResult<AuditLogEntity>。
 */
import { metaPost } from './base';
import type { PaginatedResult } from './types';

export interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
}

export interface AuditLogQuery {
  actor_user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
}

export const auditApi = {
  list: (filter: AuditLogQuery = {}): Promise<PaginatedResult<AuditLogEntry>> =>
    metaPost<PaginatedResult<AuditLogEntry>>('audit/list', { ...filter, limit: 100, offset: 0 }),
};
