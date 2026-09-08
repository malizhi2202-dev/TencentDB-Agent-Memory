/**
 * /api/v1/knowledge/gitnexus/* —— Panel GitNexus 业务路由（stateless）。
 *
 * 透传 HttpKnowledgeClient → KS /v3/gitnexus/*。
 * 17 个 GitNexus 工具端点，统一返回 KS 的 { text, isError } 文本块。
 */
import type { Hono } from 'hono';
import { validatePanelMetaHeaders } from '../../middleware/validate-panel-headers.js';
import { respondControlError } from '../../envelope.js';
import type { PanelDeps } from '../../../panel-deps.js';
import {
  buildCtx,
  readJson,
  str,
  requireKnowledgeRead,
  runKs,
} from './common.js';

export const GITNEXUS_TOOLS = [
  'list_repos',
  'query',
  'cypher',
  'context',
  'detect_changes',
  'check',
  'rename',
  'impact',
  'explain',
  'pdg_query',
  'route_map',
  'tool_map',
  'shape_check',
  'api_impact',
  'group_list',
  'group_sync',
  'trace',
] as const;

export function registerKnowledgeGitNexusRoutes(api: Hono, deps: PanelDeps): void {
  const mw = validatePanelMetaHeaders(deps);

  for (const tool of GITNEXUS_TOOLS) {
    api.post(`/knowledge/gitnexus/${tool}`, mw, async (c) => {
      const ctx = buildCtx(c);
      const body = await readJson(c);
      const cgId = str(body, 'code_graph_id');
      if (!cgId) return respondControlError(c, 400, 'MISSING_CODE_GRAPH_ID');
      const gate = await requireKnowledgeRead(deps, c, ctx, cgId);
      if ('error' in gate) return gate.error;
      const kc = deps.knowledgeClientFactory(ctx.instanceId);
      const { code_graph_id, ...params } = body;
      return runKs(c, () => kc.gitnexusQuery(cgId, tool, params as Record<string, unknown>));
    });
  }
}