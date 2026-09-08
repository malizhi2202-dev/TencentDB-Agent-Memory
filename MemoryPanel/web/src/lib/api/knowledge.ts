/**
 * api/knowledge.ts — KnowledgeEntry（项目级五类 + 团队级工作模式）。
 * 走 meta/knowledge-entry/* 透明代理。
 */
import { metaPost, metaListAll, getCurrentUser } from './base';
import type { KnowledgeEntry, KnowledgeKind } from './types';

export interface CreateKnowledgeInput {
  scope: 'team' | 'project';
  scopeId: string;
  kind: KnowledgeKind;
  title: string;
  content?: string;
  status?: string;
  source: 'memory' | 'external' | 'hybrid';
}

export const knowledgeApi = {
  list: (scope: 'team' | 'project', scopeId: string, kind?: KnowledgeKind) =>
    metaListAll<KnowledgeEntry>('knowledge-entry/list', {
      scope,
      scope_id: scopeId,
      kind,
    }),

  get: (entryId: string) => metaPost<KnowledgeEntry>('knowledge-entry/get', { entry_id: entryId }),

  create: async (data: CreateKnowledgeInput) => {
    const me = await getCurrentUser();
    return metaPost<KnowledgeEntry>('knowledge-entry/create', {
      scope: data.scope,
      scope_id: data.scopeId,
      kind: data.kind,
      title: data.title,
      content: data.content,
      status: data.status,
      source: data.source,
      owner_user_id: me.user_id,
    });
  },

  update: (entryId: string, data: Partial<{ title: string; content: string; status: string; source: 'memory' | 'external' | 'hybrid'; kind: KnowledgeKind }>) =>
    metaPost<KnowledgeEntry>('knowledge-entry/update', { entry_id: entryId, ...data }),

  delete: (entryIds: string[]) =>
    metaPost<{ deleted: number; missing: string[] }>('knowledge-entry/delete', { entry_ids: entryIds }),
};
