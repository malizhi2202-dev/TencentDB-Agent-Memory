/**
 * GitNexus Routes — 17 GitNexus 工具端点（Hono）。
 *
 * 所有查询端点需要 code_graph_id，复用 CodeGraphInstancePool。
 * 端点挂载在 /v3/gitnexus/* 下（server.ts 统一加前缀）。
 */
import { Hono } from "hono";
import type { CodeGraphInstancePool } from "../module.js";
import type { CodeGraphService } from "../store/index.js";
import { executeGitNexusTool } from "../engines/gitnexus/bridge.js";
import { isValidIdSegment, wrapOk, wrapError } from "../api-helpers.js";

export interface GitNexusRouteDeps {
  cgService: CodeGraphService;
  instancePool: CodeGraphInstancePool;
}

/** 所有 17 个 GitNexus 工具名 */
export const GITNEXUS_TOOL_NAMES = [
  "list_repos",
  "query",
  "cypher",
  "context",
  "detect_changes",
  "check",
  "rename",
  "impact",
  "explain",
  "pdg_query",
  "route_map",
  "tool_map",
  "shape_check",
  "api_impact",
  "group_list",
  "group_sync",
  "trace",
] as const;

export function createGitNexusRoutes(deps: GitNexusRouteDeps) {
  const app = new Hono();
  const { cgService, instancePool } = deps;

  // 为每个 GitNexus 工具注册 POST 端点
  for (const toolName of GITNEXUS_TOOL_NAMES) {
    app.post(`/${toolName}`, async (c) => {
      const body = await c.req.json<Record<string, unknown>>();

      const serviceId = c.req.header("x-tdai-service-id");
      if (!isValidIdSegment(serviceId)) return c.json(wrapError(400, "x-tdai-service-id header is required"), 400);
      const cgId = body.code_graph_id;
      if (!isValidIdSegment(cgId)) return c.json(wrapError(400, "code_graph_id is required"), 400);

      const row = cgService.getById(serviceId, cgId);
      if (!row) return c.json(wrapError(404, "code graph not found"), 404);

      if (row.status !== "ready") {
        return c.json(wrapOk({ text: "", isError: false }));
      }

      let instance = instancePool.get(cgId);
      if (!instance && instancePool.loadIfMissing) {
        const dir = cgService.dirFor(serviceId, row.team_id, cgId);
        instance = await instancePool.loadIfMissing(cgId, dir);
      }
      if (!instance) {
        return c.json(wrapError(503, "code graph instance not loaded"), 503);
      }

      // 去掉 code_graph_id 后把剩余参数传给工具
      const { code_graph_id, ...params } = body;
      const result = await executeGitNexusTool(instance, toolName, params as Record<string, unknown>);
      return c.json(wrapOk(result), result.isError ? 500 : 200);
    });
  }

  return app;
}