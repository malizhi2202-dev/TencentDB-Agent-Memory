import type { Hono } from 'hono';
import { isAllowedMemoryAction } from '../../../api/memory-actions.js';
import type { PanelDeps } from '../../../panel-deps.js';
import { validatePanelMetaHeaders } from '../../middleware/validate-panel-headers.js';
import { respondControlError, respondEnvelope } from '../../envelope.js';
import type { MetaCallContext } from '../../../kernel/types.js';

/**
 * 从请求路径解析 memory action（可能带二级路径 feedback/detect 等）。
 */
function readAction(path: string): string {
  const marker = '/memory/';
  const idx = path.indexOf(marker);
  if (idx < 0) return '';
  return path.slice(idx + marker.length);
}

/**
 * 注册记忆能力透明代理：POST /api/v1/memory/{action} → 内核 POST /v3/memory/{action}。
 *
 * 复用 validatePanelMetaHeaders：面板统一登录态（带 X-Tdai-User-Key + Service-Id）；
 * 纯计算端点内核不读 user_key，space/list 用 service-id 定位元数据库。
 */
export function registerMemoryProxyRoutes(api: Hono, deps: PanelDeps): void {
  api.post('/memory/*', validatePanelMetaHeaders(deps), async (c) => {
    const action = readAction(c.req.path);
    if (!action || !isAllowedMemoryAction(action)) {
      return respondControlError(c, 404, 'UNKNOWN_MEMORY_ACTION');
    }

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const panelMeta = c.get('panelMeta');
    const ctx: MetaCallContext = {
      instanceId: panelMeta.instanceId,
      gatewayEndpoint: panelMeta.gatewayEndpoint,
      gatewayApiKey: panelMeta.gatewayApiKey,
      userKey: panelMeta.userKey,
      reqId: c.get('reqId'),
    };

    const envelope = await deps.memoryKernel.invoke(action, body, ctx);
    return respondEnvelope(c, envelope);
  });
}