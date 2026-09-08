/**
 * Tools Routes — Agent self-discovery HTTP endpoints.
 *
 * Two endpoints for the v7 progressive-exposure pattern:
 *   POST /tools/list — discover available tools for a knowledge resource
 *   POST /tools/call — execute a tool on a knowledge resource
 *
 * Tools are defined per resource type (wiki / code-graph). Management operations
 * (create/delete/ingest/sync) are NOT exposed — only read-only query tools.
 *
 * Routes are defined WITHOUT /v3 prefix — prefix applied at server.ts mount level.
 */

import { Hono } from "hono";

import type { WikiService, CodeGraphService } from "../store/index.js";
import type { CodeGraphInstancePool } from "../module.js";
import type { WikiSourceManager } from "../engines/wiki/index.js";
import { executeTool as executeCodeTool } from "../engines/code/index.js";
import { executeGitNexusTool } from "../engines/gitnexus/bridge.js";
import { wrapOk, wrapError, isValidIdSegment } from "../api-helpers.js";
import { isWikiId, isCodeGraphId } from "../store/ids.js";
import type { LlmConfig } from "../config.js";
import { createLlmClient } from "../engines/wiki/ingest-v2/llm.js";
import type { LlmClient } from "../engines/wiki/ingest-v2/llm.js";
import { executeEngineAnalysisTool } from "../engines/codeanalysis/engine-client.js";

export interface ToolsRouteDeps {
  wikiService: WikiService;
  wikiMgr: WikiSourceManager;
  cgService: CodeGraphService;
  instancePool: CodeGraphInstancePool;
  /** 按服务实例解析 LLM 配置（internal LLM 路由）。 */
  resolveLlm: (serviceId: string) => LlmConfig;
}

// ═══════════════════════════════════════════════════════════════════════
//  Tool Registry — HTTP tool definitions (per resource type)
// ═══════════════════════════════════════════════════════════════════════

interface HttpToolParam {
  type: "string" | "integer" | "boolean" | "array";
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
}

interface HttpToolDef {
  name: string;
  description: string;
  params: Record<string, HttpToolParam>;
}

/** Wiki tools (7) — read-only query tools for LLM agents. */
const WIKI_TOOLS: HttpToolDef[] = [
  {
    name: "get_info",
    description: "获取 wiki 元信息（名称、状态、页面数等）。",
    params: {},
  },
  {
    name: "search",
    description: "BM25 全文搜索 wiki 页面内容。用关键词查找相关文档。",
    params: {
      query: { type: "string", required: true, description: "搜索关键词" },
      limit: { type: "integer", required: false, default: 20, description: "返回结果数上限" },
    },
  },
  {
    name: "list_pages",
    description: "列出所有页面引用（id + title + path）。",
    params: {},
  },
  {
    name: "read_page",
    description: "读取指定页面完整内容。",
    params: {
      refs: { type: "array", required: true, description: "页面引用数组（id 或路径）" },
    },
  },
  {
    name: "get_graph",
    description: "获取知识图谱结构（nodes, edges, communities）。",
    params: {},
  },
  {
    name: "list_raw",
    description: "列出原始上传文件。",
    params: {},
  },
  {
    name: "read_raw",
    description: "读取指定原始文件内容。",
    params: {
      filenames: { type: "array", required: true, description: "文件名数组" },
    },
  },
];

/** Code-Graph tools (10) — read-only query tools for LLM agents. */
const CODE_GRAPH_TOOLS: HttpToolDef[] = [
  {
    name: "get_info",
    description: "获取 code-graph 元信息（仓库名、状态、统计等）。",
    params: {},
  },
  {
    name: "search",
    description:
      "按名称快速搜索符号，只返回位置（不含源码）。想直接拿到源码/理解某块代码，请改用 explore。",
    params: {
      query: { type: "string", required: true, description: "符号名或部分名称（如 \"auth\"、\"signIn\"、\"UserService\"）" },
      kind: {
        type: "string",
        required: false,
        enum: ["function", "method", "class", "interface", "type", "variable", "route", "component"],
        description: "按节点类型过滤。省略则搜索全部类型（不要传 \"any\"/\"symbol\"/\"file\"，这些不是合法值，会导致零结果）。",
      },
      limit: { type: "integer", required: false, default: 10, description: "返回结果数上限" },
    },
  },
  {
    name: "explore",
    description:
      "【首选工具】几乎任何问题都先用它：X 怎么工作、架构、定位 bug、某处在哪。一次调用即按文件分组返回相关符号的完整源码（等价于 Read，返回的文件不要再重复读）。query 可以是自然语言问题，也可以是一组符号/文件名。通常一次就够，无需再 search/get_node/读文件。",
    params: {
      query: {
        type: "string",
        required: true,
        description: "要探索的符号名、文件名或简短代码词（如 \"AuthService loginUser session-manager\"）。可先用 search 找到相关名称。",
      },
      maxFiles: { type: "integer", required: false, default: 12, description: "最多返回源码的文件数（默认 12）" },
    },
  },
  {
    name: "callers",
    description: "列出调用 <symbol> 的函数。想看完整调用流程请用 explore。",
    params: {
      symbol: { type: "string", required: true, description: "要查调用者的函数/方法/类名" },
      limit: { type: "integer", required: false, default: 20, description: "返回结果数上限（默认 20）" },
    },
  },
  {
    name: "callees",
    description: "列出 <symbol> 调用的函数。想看完整调用流程请用 explore。",
    params: {
      symbol: { type: "string", required: true, description: "要查被调用者的函数/方法/类名" },
      limit: { type: "integer", required: false, default: 20, description: "返回结果数上限（默认 20）" },
    },
  },
  {
    name: "impact",
    description: "列出修改 <symbol> 会影响到的符号。重构前先用它评估影响面。",
    params: {
      symbol: { type: "string", required: true, description: "要做影响分析的符号名" },
      depth: { type: "integer", required: false, default: 2, description: "依赖遍历层数（默认 2）" },
    },
  },
  {
    name: "node",
    description:
      "【explore 之后的次选】获取单个符号的完整信息：位置、签名、调用链、以及逐字源码（includeCode=true）。名称有重载/多定义时会一次返回全部匹配定义的完整 body；可用 file/line 精确定位某个重载。需要多个相关符号或完整流程时请用 explore。",
    params: {
      symbol: { type: "string", required: true, description: "要查详情的符号名" },
      includeCode: { type: "boolean", required: false, default: false, description: "是否包含完整源码（默认 false 以节省上下文）" },
      file: { type: "string", required: false, description: "可选：用文件路径/文件名消歧重载（如 \"harness.rs\"）" },
      line: { type: "integer", required: false, description: "可选：用行号消歧到该位置附近的定义" },
    },
  },
  {
    name: "status",
    description: "索引健康检查（文件/节点/边数量）。除非排查问题，一般不需要。",
    params: {},
  },
  {
    name: "files",
    description: "索引到的文件树，含语言与符号数。查看项目结构比 Glob 更快。",
    params: {
      path: { type: "string", required: false, description: "按目录前缀过滤（如 \"src/components\"），不传则返回全部" },
      pattern: { type: "string", required: false, description: "按 glob 模式过滤（如 \"*.tsx\"、\"**/*.test.ts\"）" },
      format: { type: "string", required: false, default: "tree", enum: ["tree", "flat", "grouped"], description: "输出格式：tree（层级，默认）、flat（平铺列表）、grouped（按语言分组）" },
    },
  },
  {
    name: "analysis_ask",
    description:
      "【AI 分析】RAG 式代码问答：用引擎混合检索（BM25 + 语义）拉取与问题相关的代码上下文，交给 LLM 基于上下文直接回答（答案标注 filePath 与行号）。适合「这段逻辑是干什么的 / 为什么这样设计 / 某行为的入口在哪」这类开放问题；要精确符号定位请改用 explore/search。",
    params: {
      question: { type: "string", required: true, description: "用自然语言描述的代码问题" },
      task_context: { type: "string", required: false, description: "任务上下文（补充检索的语义信号）" },
      limit: { type: "integer", required: false, default: 8, description: "检索上下文的符号数上限（1-30）" },
    },
  },
];

/** GitNexus 工具 (17) — 高级代码分析工具，基于 Code-Graph 数据。 */
const GITNEXUS_TOOLS: HttpToolDef[] = [
  { name: "gitnexus_list_repos",     description: "列出已索引的仓库", params: {} },
  { name: "gitnexus_query",          description: "混合 BM25 + 语义搜索代码符号和流程", params: { search_query: { type: "string", required: true, description: "搜索查询词" }, task_context: { type: "string", required: false, description: "任务上下文，用于语义搜索" }, limit: { type: "integer", required: false, default: 5, description: "返回结果数上限" } } },
  { name: "gitnexus_cypher",         description: "类 Cypher 图查询语言（MATCH WHERE RETURN）", params: { query: { type: "string", required: true, description: "Cypher 查询语句" } } },
  { name: "gitnexus_context",        description: "360° 符号上下文：调用者、被调用者、定义", params: { name: { type: "string", required: false, description: "符号名" }, uid: { type: "string", required: false, description: "符号 UID（零歧义查找）" }, include_content: { type: "boolean", required: false, default: false, description: "是否包含完整源码" } } },
  { name: "gitnexus_detect_changes", description: "分析 git 未提交变更的影响范围", params: { scope: { type: "string", required: false, description: "unstaged 或 staged" } } },
  { name: "gitnexus_check",          description: "代码质量检查（TODO/FIXME/console.log/any 类型等）", params: { file: { type: "string", required: false, description: "按文件过滤" }, symbol: { type: "string", required: false, description: "按符号过滤" } } },
  { name: "gitnexus_rename",         description: "图辅助安全重命名（dry_run 预览影响面）", params: { symbol: { type: "string", required: true, description: "要重命名的符号" }, new_name: { type: "string", required: true, description: "新名称" }, dry_run: { type: "boolean", required: false, default: true, description: "试运行模式（默认 true）" } } },
  { name: "gitnexus_impact",         description: "爆炸半径分析：修改一个符号会影响什么", params: { symbol: { type: "string", required: false, description: "符号名" }, uid: { type: "string", required: false, description: "符号 UID" }, depth: { type: "integer", required: false, default: 2, description: "分析深度" } } },
  { name: "gitnexus_explain",        description: "污点分析解释：判断符号是数据源还是数据汇", params: { symbol: { type: "string", required: false, description: "符号名" }, uid: { type: "string", required: false, description: "符号 UID" } } },
  { name: "gitnexus_pdg_query",      description: "程序依赖图（PDG）查询", params: { symbol: { type: "string", required: false, description: "符号名" }, file: { type: "string", required: false, description: "按文件过滤" }, limit: { type: "integer", required: false, default: 50, description: "返回上限" } } },
  { name: "gitnexus_route_map",      description: "API 路由发现：自动扫描项目中的 HTTP 路由定义", params: {} },
  { name: "gitnexus_tool_map",       description: "CLI/工具发现：自动扫描项目中的命令行工具和脚本", params: {} },
  { name: "gitnexus_shape_check",    description: "接口/类型一致性检查", params: { file: { type: "string", required: false, description: "按文件过滤" }, interface: { type: "string", required: false, description: "按接口名过滤" } } },
  { name: "gitnexus_api_impact",     description: "API 变更影响分析：修改某个 API 端点会影响哪些消费者", params: { path: { type: "string", required: false, description: "API 路径" }, method: { type: "string", required: false, description: "HTTP 方法" } } },
  { name: "gitnexus_group_list",     description: "跨仓库组列表", params: {} },
  { name: "gitnexus_group_sync",     description: "跨仓库组同步", params: { groupName: { type: "string", required: false, description: "组名" } } },
  { name: "gitnexus_trace",          description: "执行流追踪：从符号出发追踪上下游调用链", params: { symbol: { type: "string", required: false, description: "符号名" }, uid: { type: "string", required: false, description: "符号 UID" }, direction: { type: "string", required: false, description: "upstream / downstream / both" }, maxDepth: { type: "integer", required: false, default: 5, description: "最大深度" } } },
];

/** Agent read-only whitelist — management ops NOT included. */
const WIKI_TOOL_NAMES = new Set(WIKI_TOOLS.map((t) => t.name));
const CODE_GRAPH_TOOL_NAMES = new Set(CODE_GRAPH_TOOLS.map((t) => t.name));
const GITNEXUS_TOOL_NAMES = new Set(GITNEXUS_TOOLS.map((t) => t.name));

// ═══════════════════════════════════════════════════════════════════════
//  Route Factory
// ═══════════════════════════════════════════════════════════════════════

export function createToolsRoutes(deps: ToolsRouteDeps): Hono {
  const app = new Hono();
  const { wikiService, wikiMgr, cgService, instancePool, resolveLlm } = deps;

  // ── POST /tools/list ──

  app.post("/list", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const serviceId = c.req.header("x-tdai-service-id");
    if (!isValidIdSegment(serviceId)) {
      return c.json(wrapError(400, "x-tdai-service-id header is required"), 400);
    }
    const knowledgeId = body.knowledge_id;
    if (typeof knowledgeId !== "string" || !knowledgeId) {
      return c.json(wrapError(400, "knowledge_id is required"), 400);
    }

    let type: "wiki" | "code-graph";
    let tools: HttpToolDef[];
    let name: string;
    let summary: string | null;
    let status: string;

    if (isWikiId(knowledgeId)) {
      type = "wiki";
      tools = WIKI_TOOLS;
      const row = wikiService.getById(serviceId, knowledgeId);
      if (!row) return c.json(wrapError(404, "knowledge resource not found"), 404);
      name = row.name;
      summary = row.summary ?? null;
      status = row.status;
    } else if (isCodeGraphId(knowledgeId)) {
      type = "code-graph";
      tools = [...CODE_GRAPH_TOOLS, ...GITNEXUS_TOOLS];
      const row = cgService.getById(serviceId, knowledgeId);
      if (!row) return c.json(wrapError(404, "knowledge resource not found"), 404);
      name = row.repo_name || row.repo_url;
      summary = row.summary ?? null;
      status = row.status;
    } else {
      return c.json(wrapError(400, `invalid knowledge_id format: ${knowledgeId}`), 400);
    }

    return c.json(wrapOk({
      knowledge_id: knowledgeId,
      type,
      name,
      summary,
      status,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        params: t.params,
      })),
    }));
  });

  // ── POST /tools/call ──

  app.post("/call", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const serviceId = c.req.header("x-tdai-service-id");
    if (!isValidIdSegment(serviceId)) {
      return c.json(wrapError(400, "x-tdai-service-id header is required"), 400);
    }
    const knowledgeId = body.knowledge_id;
    if (typeof knowledgeId !== "string" || !knowledgeId) {
      return c.json(wrapError(400, "knowledge_id is required"), 400);
    }
    const toolName = body.tool_name;
    if (typeof toolName !== "string" || !toolName) {
      return c.json(wrapError(400, "tool_name is required"), 400);
    }
    const params = body.params;
    if (!params || typeof params !== "object") {
      return c.json(wrapError(400, "params is required (object)"), 400);
    }

    const toolParams = params as Record<string, unknown>;

    if (isWikiId(knowledgeId)) {
      // Whitelist check
      if (!WIKI_TOOL_NAMES.has(toolName)) {
        return c.json(wrapError(403, `unknown tool: '${toolName}' for wiki resource '${knowledgeId}'. Use tools/list to discover available tools.`), 403);
      }

      const row = wikiService.getById(serviceId, knowledgeId);
      if (!row) return c.json(wrapError(404, "wiki not found"), 404);

      return executeWikiTool(serviceId, toolName, row, toolParams, wikiService, wikiMgr);
    }

    if (isCodeGraphId(knowledgeId)) {
      // Whitelist check — allow both code-graph and gitnexus tools
      if (!CODE_GRAPH_TOOL_NAMES.has(toolName) && !GITNEXUS_TOOL_NAMES.has(toolName)) {
        return c.json(wrapError(403, `unknown tool: '${toolName}' for code-graph resource '${knowledgeId}'. Use tools/list to discover available tools.`), 403);
      }

      const row = cgService.getById(serviceId, knowledgeId);
      if (!row) return c.json(wrapError(404, "code graph not found"), 404);

      return executeCodeGraphTool(serviceId, toolName, row, toolParams, cgService, instancePool, resolveLlm);
    }

    return c.json(wrapError(400, `invalid knowledge_id format: ${knowledgeId}`), 400);
  });

  return app;
}

// ═══════════════════════════════════════════════════════════════════════
//  Wiki tool execution
// ═══════════════════════════════════════════════════════════════════════

async function executeWikiTool(
  serviceId: string,
  toolName: string,
  row: { wiki_id: string; team_id: string; status: string; name: string },
  params: Record<string, unknown>,
  wikiService: WikiService,
  wikiMgr: WikiSourceManager,
): Promise<Response> {
  const { wiki_id, team_id } = row;

  switch (toolName) {
    case "get_info": {
      const detail = wikiService.get(serviceId, team_id, wiki_id);
      if (!detail) return Response.json(wrapError(404, "wiki not found"), { status: 404 });
      return Response.json(wrapOk(detail));
    }
    case "search": {
      const query = params.query;
      if (typeof query !== "string" || !query) {
        return Response.json(wrapError(400, "query is required"), { status: 400 });
      }
      if (row.status !== "ready") {
        return Response.json(wrapOk({ results: [], links: [], count: 0 }));
      }
      const limit = typeof params.limit === "number" ? params.limit : 20;
      const response = wikiMgr.search(wiki_id, query, limit);
      return Response.json(wrapOk(response));
    }
    case "list_pages": {
      if (row.status !== "ready") {
        return Response.json(wrapOk({ items: [] }));
      }
      const items = wikiService.pageLs(serviceId, team_id, wiki_id);
      if (items === null) return Response.json(wrapError(404, "wiki not found"), { status: 404 });
      return Response.json(wrapOk({ items }));
    }
    case "read_page": {
      const refs = params.refs;
      if (!Array.isArray(refs) || refs.length === 0) {
        return Response.json(wrapError(400, "refs is required (non-empty array)"), { status: 400 });
      }
      if (row.status !== "ready") {
        return Response.json(wrapOk({ items: [] }));
      }
      const result = wikiService.pageReadMany(serviceId, team_id, wiki_id, refs as string[]);
      return Response.json(wrapOk({ items: result }));
    }
    case "get_graph": {
      if (row.status !== "ready") {
        return Response.json(wrapOk({ nodes: [], edges: [], communities: [] }));
      }
      const graphData = wikiMgr.graph(wiki_id);
      return Response.json(wrapOk(graphData));
    }
    case "list_raw": {
      const items = wikiService.rawLs(serviceId, team_id, wiki_id);
      if (items === null) return Response.json(wrapError(404, "wiki not found"), { status: 404 });
      return Response.json(wrapOk({ items }));
    }
    case "read_raw": {
      const filenames = params.filenames;
      if (!Array.isArray(filenames) || filenames.length === 0) {
        return Response.json(wrapError(400, "filenames is required (non-empty array)"), { status: 400 });
      }
      const result = wikiService.rawReadMany(serviceId, team_id, wiki_id, filenames as string[]);
      return Response.json(wrapOk({ items: result }));
    }
    default:
      return Response.json(wrapError(403, `unknown tool: ${toolName}`), { status: 403 });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Code-Graph tool execution
// ═══════════════════════════════════════════════════════════════════════

// Reuse the query specs from code-graph routes

/**
 * 对外暴露的 codegraph 查询工具名（不含 get_info，get_info 在调用方特殊处理）。
 * 单一真相源：tools.ts 的 CODE_GRAPH_TOOLS、code-graph.ts 的路由注册、
 * toCodeGraphToolName 的校验列表，全部从这里来。
 */
export const CODEGRAPH_QUERY_TOOL_NAMES: readonly string[] = [
  "search", "explore", "callers", "callees", "impact", "node", "status", "files",
];

/**
 * 把对外暴露的工具名映射为 executeTool 接受的内部工具名。
 * 对外统一用短名（node / status / files），内部统一加 codegraph_ 前缀。
 */
export function toCodeGraphToolName(externalName: string): string | undefined {
  return CODEGRAPH_QUERY_TOOL_NAMES.includes(externalName) ? `codegraph_${externalName}` : undefined;
}

async function executeCodeGraphTool(
  serviceId: string,
  toolName: string,
  row: { code_graph_id: string; team_id: string; status: string },
  params: Record<string, unknown>,
  cgService: CodeGraphService,
  instancePool: CodeGraphInstancePool,
  resolveLlm: (serviceId: string) => LlmConfig,
): Promise<Response> {
  const { code_graph_id, team_id } = row;

  // get_info is a simple metadata return
  if (toolName === "get_info") {
    const detail = cgService.get(serviceId, team_id, code_graph_id);
    if (!detail) return Response.json(wrapError(404, "code graph not found"), { status: 404 });
    return Response.json(wrapOk(detail));
  }

  // All other tools require synced status
  if (row.status !== "ready") {
    return Response.json(wrapOk({ text: "", isError: false }));
  }

  // analysis_ask：RAG 问答走独立链路（图谱检索 + LLM），无需加载 code-graph 实例
  if (toolName === "analysis_ask") {
    return executeAnalysisAsk(serviceId, team_id, code_graph_id, params, cgService, resolveLlm);
  }

  // Load instance
  let instance = instancePool.get(code_graph_id);
  if (!instance && instancePool.loadIfMissing) {
    const dir = cgService.dirFor(serviceId, team_id, code_graph_id);
    instance = await instancePool.loadIfMissing(code_graph_id, dir);
  }
  if (!instance) {
    return Response.json(wrapError(503, "code graph instance not loaded"), { status: 503 });
  }

  // Route to GitNexus or code-graph executor
  if (toolName.startsWith("gitnexus_")) {
    const gitnexusToolName = toolName.slice("gitnexus_".length);
    const result = await executeGitNexusTool(instance, gitnexusToolName, params);
    return Response.json(wrapOk(result), { status: result.isError ? 500 : 200 });
  }

  // Map tool name to internal codegraph action
  const cgToolName = toCodeGraphToolName(toolName);
  if (!cgToolName) {
    return Response.json(wrapError(403, `unknown tool: ${toolName}`), { status: 403 });
  }

  // Build toolParams — map HTTP params to code-graph executeTool params
  const toolParams: Record<string, unknown> = { code_graph_id };
  for (const [k, v] of Object.entries(params)) {
    toolParams[k] = v;
  }

  const result = await executeCodeTool(instance, cgToolName, toolParams);
  return Response.json(wrapOk(result), { status: result.isError ? 500 : 200 });
}

// ═══════════════════════════════════════════════════════════════════════
//  AI 分析 (analysis_ask)
// ═══════════════════════════════════════════════════════════════════════

/**
 * analysis_ask：RAG 式代码问答。
 *
 *   1. 用引擎 `query` 工具（BM25 + 语义混合检索）拉取与问题相关的代码符号/流程；
 *   2. 将检索上下文交给 LLM（复用 wiki ingest 的 binding-aware 配置链：
 *      resolveLlm → createLlmClient，协议 openai/anthropic 自动选择）；
 *   3. 返回 { text, isError }（text 为 LLM 答案）。
 *
 * 这一步**不**转发给 engine（engine 没有 `ask` 工具）——LLM 调用在 KS 侧完成。
 */
async function executeAnalysisAsk(
  serviceId: string,
  teamId: string,
  codeGraphId: string,
  params: Record<string, unknown>,
  cgService: CodeGraphService,
  resolveLlm: (serviceId: string) => LlmConfig,
): Promise<Response> {
  const question = typeof params.question === "string" ? params.question.trim() : "";
  if (!question) {
    return Response.json(wrapError(400, "question is required"), { status: 400 });
  }

  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.min(30, Math.floor(params.limit)))
    : 8;

  const dir = cgService.dirFor(serviceId, teamId, codeGraphId);

  // Step 1 — retrieve code context from the engine index.
  const queryParams: Record<string, unknown> = {
    search_query: question,
    limit,
    include_content: true,
  };
  if (typeof params.task_context === "string" && params.task_context.trim()) {
    queryParams.task_context = params.task_context;
  }
  const search = await executeEngineAnalysisTool(dir, "query", queryParams);
  const contextText = search.isError
    ? `[代码上下文检索失败] ${safeStringify(search.content)}`
    : formatAnalysisContext(search.content);

  // Step 2 — resolve LLM client (binding-aware; throws when unconfigured).
  let client: LlmClient;
  try {
    client = createLlmClient(resolveLlm(serviceId));
  } catch (err) {
    return Response.json(wrapError(503, `LLM 未配置：${err instanceof Error ? err.message : String(err)}`), { status: 503 });
  }

  // Step 3 — answer with the LLM.
  const system = [
    "你是 TencentDB-Agent-Memory 的代码分析助手（AI 分析）。",
    "你会收到一段来自代码知识图谱的检索上下文（BM25 + 向量混合检索的结果），请严格基于该上下文回答用户关于代码的问题。",
    "要求：",
    "1. 只依据提供的上下文回答；若上下文不足以回答，请明确说明「代码图谱中未找到足够信息」，不要编造。",
    "2. 使用中文回答；引用代码符号时标注 filePath 与行号（如 startLine-endLine）。",
    "3. 简明扼要、条理清晰，直接回答用户问题。",
  ].join("\n");

  try {
    const answer = await client.chat({
      system,
      prompt: `用户问题：${question}\n\n相关代码上下文：\n${contextText}`,
      label: "analysis_ask",
    });
    return Response.json(wrapOk({ text: answer, isError: false }), { status: 200 });
  } catch (err) {
    return Response.json(wrapError(500, `AI 分析失败：${err instanceof Error ? err.message : String(err)}`), { status: 500 });
  }
}

/** 把引擎 `query` 的结构化结果压成紧凑、LLM 友好的一段文本。 */
function formatAnalysisContext(content: unknown): string {
  if (content == null) return "(空上下文)";
  if (typeof content === "string") return content.slice(0, 24_000);
  if (typeof content !== "object") return String(content).slice(0, 24_000);

  const c = content as Record<string, unknown>;
  const parts: string[] = [];

  const processes = Array.isArray(c.processes) ? c.processes : [];
  if (processes.length > 0) {
    parts.push("### 相关流程 (processes)");
    for (const p of processes.slice(0, 10)) {
      const o = p as Record<string, unknown>;
      const bits = [
        String(o.id ?? ""),
        String(o.summary ?? ""),
        o.process_type != null ? `类型=${String(o.process_type)}` : "",
        o.step_count != null ? `步骤数=${String(o.step_count)}` : "",
        o.symbol_count != null ? `符号数=${String(o.symbol_count)}` : "",
      ].filter(Boolean);
      parts.push(`- ${bits.join(" | ")}`);
    }
  }

  const symbols = Array.isArray(c.process_symbols) ? c.process_symbols : [];
  if (symbols.length > 0) {
    parts.push("### 相关符号 (symbols)");
    for (const s of symbols.slice(0, 30)) {
      const o = s as Record<string, unknown>;
      const loc = `${String(o.filePath ?? "")}${o.startLine != null ? `:${String(o.startLine)}-${String(o.endLine ?? "")}` : ""}`;
      const meta = [
        String(o.name ?? ""),
        `[${String(o.type ?? "symbol")}]`,
        loc,
        o.module ? `模块=${String(o.module)}` : "",
        o.step_index != null ? `step=${String(o.step_index)}` : "",
      ].filter(Boolean);
      parts.push(`- ${meta.join(" ")}`);
      const body = typeof o.content === "string" ? o.content.trim() : "";
      if (body) {
        parts.push("  ```\n" + body.slice(0, 2500).replace(/\n/g, "\n  ") + "\n  ```");
      }
    }
  }

  const definitions = Array.isArray(c.definitions) ? c.definitions : [];
  if (definitions.length > 0) {
    parts.push("### 定义 (definitions)");
    for (const d of definitions.slice(0, 20)) {
      const o = d as Record<string, unknown>;
      const body = typeof o.content === "string" ? `\n  ${o.content.slice(0, 2000).replace(/\n/g, "\n  ")}` : "";
      parts.push(`- ${String(o.name ?? "")} [${String(o.type ?? "symbol")}] ${String(o.filePath ?? "")}${body}`);
    }
  }

  if (typeof c.warning === "string" && c.warning) {
    parts.push(`### 检索警告\n${c.warning}`);
  }
  if (c.partial) {
    parts.push("(检索结果可能不完整 partial=true)");
  }

  return parts.length > 0 ? parts.join("\n\n") : "(检索无结果)";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

