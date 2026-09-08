/**
 * api/toolSources.ts — ToolSource（能力资产类：MCP Server / REST API）。
 * 走 meta/tool-source/* 透明代理。
 */
import { metaPost, metaListAll, getCurrentUser } from './base';
import type { ToolSource } from './types';

export interface CreateToolSourceInput {
  kind: 'mcp' | 'rest';
  teamId: string;
  name: string;
  description?: string;
  endpointUrl?: string;
  transport?: string;
  status?: string;
  source: 'memory' | 'external' | 'hybrid';
  authConfigJson?: string;
}

export const toolSourcesApi = {
  list: (teamId: string, kind?: 'mcp' | 'rest') =>
    metaListAll<ToolSource>('tool-source/list', { team_id: teamId, kind }),

  get: (toolId: string) => metaPost<ToolSource>('tool-source/get', { tool_id: toolId }),

  create: async (data: CreateToolSourceInput) => {
    const me = await getCurrentUser();
    return metaPost<ToolSource>('tool-source/create', {
      kind: data.kind,
      team_id: data.teamId,
      name: data.name,
      description: data.description,
      endpoint_url: data.endpointUrl,
      transport: data.transport,
      status: data.status,
      source: data.source,
      auth_config_json: data.authConfigJson,
      owner_user_id: me.user_id,
    });
  },

  update: (toolId: string, data: Partial<{ name: string; description: string; endpoint_url: string; transport: string; status: string }>) =>
    metaPost<ToolSource>('tool-source/update', { tool_id: toolId, ...data }),

  delete: (toolIds: string[]) =>
    metaPost<{ deleted: number; missing: string[] }>('tool-source/delete', { tool_ids: toolIds }),
};
