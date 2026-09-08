/**
 * /api/v1/knowledge/wiki/team-assets
 * /api/v1/knowledge/code-graph/team-assets
 *
 * 团队池：meta list-accessible（visibility=team）→ KS get 补运营状态。
 */
import type { Hono } from 'hono';
import { validatePanelMetaHeaders } from '../../middleware/validate-panel-headers.js';
import { respondControlError, respondEnvelope } from '../../envelope.js';
import type { PanelDeps } from '../../../panel-deps.js';
import {
  buildCtx,
  readJson,
  str,
  strArray,
  okEnvelope,
  requireTeamMember,
  resolveCallerUserId,
  fetchAllMetaListItems,
  joinKnowledgeAssetsWithKs,
  mergeWithKsOnlyItems,
  isActiveMetaAsset,
  ASSET_TYPE_WIKI,
  ASSET_TYPE_CODE_GRAPH,
  type KnowledgeAssetMetaRaw,
} from './common.js';

function registerTeamAssets(
  api: Hono,
  deps: PanelDeps,
  path: string,
  assetType: typeof ASSET_TYPE_WIKI | typeof ASSET_TYPE_CODE_GRAPH,
): void {
  const mw = validatePanelMetaHeaders(deps);
  api.post(path, mw, async (c) => {
    const ctx = buildCtx(c);
    const body = await readJson(c);
    const teamId = str(body, 'team_id');
    if (!teamId) return respondControlError(c, 400, 'MISSING_TEAM_ID');
    const gate = await requireTeamMember(deps, c, ctx, teamId);
    if ('error' in gate) return gate.error;

    const assets = await fetchAllMetaListItems<KnowledgeAssetMetaRaw>(
      deps,
      ctx,
      'asset/list-accessible',
      {
        user_id: gate.userId,
        team_id: teamId,
        asset_type: assetType,
        action: 'read',
        visibility: 'team',
      },
    );
    const active = assets.filter((a) => isActiveMetaAsset(a.status));
    const joined = await joinKnowledgeAssetsWithKs(deps, ctx, active, assetType);
    // 补充 KS 侧未注册 meta 的资源（创建中/失败的 code-graph 等）
    const items = await mergeWithKsOnlyItems(deps, ctx, teamId, joined, assetType);
    return respondEnvelope(c, okEnvelope(c, { items, total: items.length }));
  });
}

export function registerKnowledgeListRoutes(api: Hono, deps: PanelDeps): void {
  registerTeamAssets(api, deps, '/knowledge/wiki/team-assets', ASSET_TYPE_WIKI);
  registerTeamAssets(api, deps, '/knowledge/code-graph/team-assets', ASSET_TYPE_CODE_GRAPH);
  registerScopedAssets(api, deps, '/knowledge/wiki/list-scope', ASSET_TYPE_WIKI);
  registerScopedAssets(api, deps, '/knowledge/code-graph/list-scope', ASSET_TYPE_CODE_GRAPH);
  registerCombinedAssets(api, deps, '/knowledge/wiki/list-combined', ASSET_TYPE_WIKI);
  registerCombinedAssets(api, deps, '/knowledge/code-graph/list-combined', ASSET_TYPE_CODE_GRAPH);
}

/**
 * 维度查询（project / user）：代码分析 & wiki 资产按「协作轴 / 用户轴」切维度。
 * - project：asset/list-by-project（内核 requireProjectVisible 守卫 caller 可见性，跨 team）
 * - user  ：asset/list-accessible + owner_user_id（内核判定 system_admin 可看任意 owner）
 * agent 维度不在此（走既有 agent-fixed 通道，见前端 knowledgeApi.*.agentFixed）。
 */
function registerScopedAssets(
  api: Hono,
  deps: PanelDeps,
  path: string,
  assetType: typeof ASSET_TYPE_WIKI | typeof ASSET_TYPE_CODE_GRAPH,
): void {
  const mw = validatePanelMetaHeaders(deps);
  api.post(path, mw, async (c) => {
    const ctx = buildCtx(c);
    const body = await readJson(c);
    const projectId = str(body, 'project_id');
    const ownerUserId = str(body, 'owner_user_id');

    let assets: KnowledgeAssetMetaRaw[];
    if (projectId) {
      assets = await fetchAllMetaListItems<KnowledgeAssetMetaRaw>(
        deps,
        ctx,
        'asset/list-by-project',
        { project_id: projectId, asset_type: assetType },
      );
    } else if (ownerUserId) {
      const callerId = await resolveCallerUserId(deps, ctx);
      if (!callerId) return respondControlError(c, 401, 'INVALID_USER_KEY');
      assets = await fetchAllMetaListItems<KnowledgeAssetMetaRaw>(
        deps,
        ctx,
        'asset/list-accessible',
        { user_id: callerId, asset_type: assetType, action: 'read', owner_user_id: ownerUserId },
      );
    } else {
      return respondControlError(c, 400, 'MISSING_SCOPE');
    }

    const active = assets.filter((a) => isActiveMetaAsset(a.status));
    const joined = await joinKnowledgeAssetsWithKs(deps, ctx, active, assetType);
    return respondEnvelope(c, okEnvelope(c, { items: joined, total: joined.length }));
  });
}

/**
 * 组合维度查询（需求 4：团队 × 项目 × Agent × 用户 AND）。
 *
 * body: { team_id?, project_ids?, agent_id?, owner_user_id?, visibility? }
 * 全部转发到内核 asset/list-accessible（该接口已支持这些过滤组合 AND），
 * 语义为「当前用户在『团队 + 项目 + Agent + 用户』四个维度共同约束下可读的资产」。
 * 与 list-scope 的区别：list-scope 是 project / owner 二选一；这里四者可同时生效。
 */
function registerCombinedAssets(
  api: Hono,
  deps: PanelDeps,
  path: string,
  assetType: typeof ASSET_TYPE_WIKI | typeof ASSET_TYPE_CODE_GRAPH,
): void {
  const mw = validatePanelMetaHeaders(deps);
  api.post(path, mw, async (c) => {
    const ctx = buildCtx(c);
    const body = await readJson(c);
    const teamId = str(body, 'team_id');
    const projectIds = strArray(body, 'project_ids');
    const agentId = str(body, 'agent_id');
    const ownerUserId = str(body, 'owner_user_id');
    const visibility = str(body, 'visibility');

    const callerId = await resolveCallerUserId(deps, ctx);
    if (!callerId) return respondControlError(c, 401, 'INVALID_USER_KEY');

    const query: Record<string, unknown> = {
      user_id: callerId,
      asset_type: assetType,
      action: 'read',
    };
    if (teamId) query.team_id = teamId;
    if (projectIds.length > 0) query.project_ids = projectIds;
    if (agentId) query.agent_id = agentId;
    if (ownerUserId) query.owner_user_id = ownerUserId;
    if (visibility) query.visibility = visibility;

    const assets = await fetchAllMetaListItems<KnowledgeAssetMetaRaw>(
      deps,
      ctx,
      'asset/list-accessible',
      query,
    );
    const active = assets.filter((a) => isActiveMetaAsset(a.status));
    const joined = await joinKnowledgeAssetsWithKs(deps, ctx, active, assetType);
    return respondEnvelope(c, okEnvelope(c, { items: joined, total: joined.length }));
  });
}
