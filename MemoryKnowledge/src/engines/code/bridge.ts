/**
 * CodeGraph Bridge — 封装 @colbymchenry/codegraph 的核心 API。
 *
 * 将 CodeGraph 实例 + ToolHandler 包装为简洁的调用接口，
 * 上层 API 只需调 bridge 方法即可，不直接依赖 codegraph 内部结构。
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "url";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { createLogger } from "../../logger.js";

const log = createLogger("bridge");

let _codegraphModule: any = null;
let _toolsModule: any = null;

/**
 * 解析 ToolHandler 所在的 mcp/tools 模块路径。
 *
 * npm 主包的入口是 npm-sdk.js，它在运行时 require 平台包
 * （如 @colbymchenry/codegraph-linux-x64）的 lib/dist/index.js。
 * mcp/tools.js 在平台包的 lib/dist/mcp/ 下。必须从 npm 主包的路径解析：
 * pnpm 的 strict 隔离不会把主包的 optional dependency 暴露给 KS 根目录。
 */
export function resolveToolsPath(): string {
  const appRequire = createRequire(import.meta.url);
  const platform = `${process.platform}-${process.arch}`;
  const toolsSpecifier = `@colbymchenry/codegraph-${platform}/lib/dist/mcp/tools.js`;
  try {
    const codegraphEntry = appRequire.resolve("@colbymchenry/codegraph");
    const codegraphRequire = createRequire(codegraphEntry);
    return codegraphRequire.resolve(toolsSpecifier);
  } catch {
    throw new Error(
      `codegraph: platform package @colbymchenry/codegraph-${platform} not installed or missing mcp/tools.js. ` +
      `Run: pnpm add @colbymchenry/codegraph`,
    );
  }
}

async function loadModules() {
  if (_codegraphModule) {
    return extractExports();
  }

  const toolsPath = resolveToolsPath();
  log.info("Loading codegraph from npm package");
  _codegraphModule = await import("@colbymchenry/codegraph");
  _toolsModule = await import(pathToFileURL(toolsPath).href);
  log.info("Loaded codegraph from npm package", {
    indexKeys: Object.keys(_codegraphModule),
    toolsKeys: Object.keys(_toolsModule),
  });
  return extractExports();
}

/**
 * CJS 包在 ESM 下 `import()` 会被包成 `{ default: module.exports }`；
 * CJS 模式（tsx）下 `import()` 被转成 `require()`，返回的是展开对象。
 * 这里统一展开，两种模式都能正确取到导出。
 */
function unwrapCjs<T>(mod: T): T {
  const m = mod as unknown as { default?: unknown };
  return m && typeof m === "object" && m.default && typeof m.default === "object"
    ? (m.default as T)
    : mod;
}

function extractExports() {
  const cg = unwrapCjs(_codegraphModule);
  const tools = unwrapCjs(_toolsModule);
  return {
    CodeGraph: cg.CodeGraph,
    ToolHandler: tools.ToolHandler,
    isInitialized: cg.isInitialized,
    getCodeGraphDir: cg.getCodeGraphDir,
  };
}

export interface CodeGraphInstance {
  cg: any;
  handler: any;
  projectRoot: string;
}

/**
 * 打开一个已存在的 codegraph 索引。
 */
export async function openIndex(projectPath: string): Promise<CodeGraphInstance> {
  log.info("openIndex", { projectPath });
  const { CodeGraph, ToolHandler } = await loadModules();
  const cg = await CodeGraph.open(projectPath);
  const stats = cg.getStats();
  log.info("openIndex complete", { projectPath, stats });
  const handler = new ToolHandler(cg);
  // 告诉 ToolHandler 项目根在哪，避免它拿进程 cwd 做 worktree 检测导致误报
  if (typeof handler.setDefaultProjectHint === "function") {
    handler.setDefaultProjectHint(projectPath);
  }
  return { cg, handler, projectRoot: projectPath };
}

/**
 * 对一个项目目录进行全量索引。
 */
export async function indexProject(projectPath: string): Promise<CodeGraphInstance> {
  log.info("indexProject start", { projectPath });
  const { CodeGraph, ToolHandler, isInitialized } = await loadModules();

  const initialized = isInitialized(projectPath);
  log.debug("isInitialized check", { projectPath, initialized });

  let cg: any;
  if (initialized) {
    // 已有索引，打开并重新全量索引
    log.info("Re-indexing existing project");
    cg = await CodeGraph.open(projectPath);
    await cg.indexAll();
  } else {
    // 首次初始化：创建目录结构 + DB + 全量索引
    log.info("First-time init + index");
    cg = await CodeGraph.init(projectPath, { index: true });
  }

  const stats = cg.getStats();
  log.info("indexProject complete", { projectPath, stats });

  const handler = new ToolHandler(cg);
  if (typeof handler.setDefaultProjectHint === "function") {
    handler.setDefaultProjectHint(projectPath);
  }
  log.debug("ToolHandler created", { availableTools: Object.keys(handler.tools || handler._tools || {}) });
  return { cg, handler, projectRoot: projectPath };
}

/**
 * 增量同步（只处理变化的文件）。
 */
export async function syncIndex(instance: CodeGraphInstance): Promise<{ changed: number }> {
  log.info("syncIndex start", { projectRoot: instance.projectRoot });
  const result = await instance.cg.sync();
  const changed = result?.filesChanged ?? 0;
  log.info("syncIndex complete", { changed });
  return { changed };
}

/**
 * 执行 codegraph MCP 工具（复用 ToolHandler 的格式化输出）。
 */
export async function executeTool(
  instance: CodeGraphInstance,
  toolName: string,
  params: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  log.info("executeTool", { toolName, params, projectRoot: instance.projectRoot });

  // 检查 handler 实例状态
  log.debug("handler state", {
    handlerType: typeof instance.handler,
    handlerKeys: Object.keys(instance.handler),
    hasExecute: typeof instance.handler.execute === "function",
  });

  const result = await instance.handler.execute(toolName, params);

  log.debug("executeTool raw result", {
    toolName,
    resultKeys: Object.keys(result || {}),
    contentLength: result?.content?.length,
    content0: result?.content?.[0],
    isError: result?.isError,
  });

  const text = result.content?.[0]?.text ?? "";
  const isError = result.isError ?? false;

  log.info("executeTool response", { toolName, isError, textLength: text.length, textPreview: text.slice(0, 200) });
  return { text, isError };
}

/**
 * 获取索引统计信息。
 */
export function getStats(instance: CodeGraphInstance) {
  const stats = instance.cg.getStats();
  log.debug("getStats", { stats });
  return stats;
}

/**
 * Graph node/edge types for the panel's KnowledgeGraph component.
 * Mirrors the frontend's GraphNode / GraphEdge interfaces.
 */
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  path: string;
  linkCount: number;
  community: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: { id: number; nodeCount: number; topNodes: string[] }[];
}

/**
 * Export the full code graph as nodes + edges + communities suitable for the
 * panel's KnowledgeGraph visualization (graphology + sigma.js).
 *
 * Uses the codegraph QueryBuilder's getAllNodes() + findEdgesBetweenNodes()
 * to pull the complete graph, then maps to the panel's GraphNode/GraphEdge
 * format. Runs Louvain community detection so the frontend can color by
 * community and make large graphs readable.
 */
export function exportGraph(instance: CodeGraphInstance): GraphData {
  const queries = (instance.cg as any).queries;
  if (!queries || typeof queries.getAllNodes !== "function") {
    log.warn("exportGraph: queries not available on codegraph instance");
    return { nodes: [], edges: [], communities: [] };
  }

  const rawNodes: any[] = queries.getAllNodes();
  if (!rawNodes || rawNodes.length === 0) {
    return { nodes: [], edges: [], communities: [] };
  }

  const nodeIds: string[] = rawNodes.map((n: any) => n.id);
  const rawEdges: any[] = queries.findEdgesBetweenNodes(nodeIds) ?? [];

  // Compute link counts: count edges incident to each node
  const linkCounts = new Map<string, number>();
  for (const n of rawNodes) linkCounts.set(n.id, 0);
  for (const e of rawEdges) {
    linkCounts.set(e.source, (linkCounts.get(e.source) ?? 0) + 1);
    linkCounts.set(e.target, (linkCounts.get(e.target) ?? 0) + 1);
  }

  // Louvain community detection — build a temporary graphology graph
  const g = new Graph({ multi: false, type: "undirected" });
  for (const n of rawNodes) {
    g.addNode(n.id, { kind: n.kind, name: n.name });
  }
  for (const e of rawEdges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      if (!g.hasEdge(e.source, e.target)) {
        g.addEdge(e.source, e.target, { weight: 1 });
      }
    }
  }

  let communityMap: Record<string, number> = {};
  let communityCount = 0;
  if (g.order > 0 && g.size > 0) {
    try {
      const result = louvain(g, { nodeCommunityAttribute: "community" });
      communityCount = result.count;
      // Read assigned communities back from graph nodes
      g.forEachNode((node, attrs) => {
        communityMap[node] = (attrs as any).community ?? 0;
      });
    } catch {
      // Louvain may fail on degenerate graphs; fall back to single community
      log.warn("exportGraph: louvain failed, all nodes in community 0");
    }
  }

  // Include all nodes — view-level filtering is done client-side via
  // the 架构/结构/全部 toggle. Isolated nodes are kept so they appear
  // when the user selects "全部".
  const nodes: GraphNode[] = rawNodes.map((n: any) => ({
    id: n.id,
    label: n.name ?? n.id,
    type: n.kind ?? "unknown",
    path: n.filePath ?? "",
    linkCount: linkCounts.get(n.id) ?? 0,
    community: communityMap[n.id] ?? 0,
  }));

  const keepSet = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = rawEdges
    .filter((e: any) => keepSet.has(e.source) && keepSet.has(e.target))
    .map((e: any) => ({
      source: e.source,
      target: e.target,
      type: e.kind || e.type || e.relation || '',
      weight: 1,
    }));

  // Build community summaries (top 5 nodes by link count per community)
  const commNodes = new Map<number, { nodeCount: number; topNodes: { id: string; linkCount: number }[] }>();
  for (const n of nodes) {
    let entry = commNodes.get(n.community);
    if (!entry) {
      entry = { nodeCount: 0, topNodes: [] };
      commNodes.set(n.community, entry);
    }
    entry.nodeCount++;
    entry.topNodes.push({ id: n.id, linkCount: n.linkCount });
  }
  const communities = [...commNodes.entries()]
    .map(([id, entry]) => ({
      id,
      nodeCount: entry.nodeCount,
      topNodes: entry.topNodes
        .sort((a, b) => b.linkCount - a.linkCount)
        .slice(0, 5)
        .map((n) => n.id),
    }))
    .sort((a, b) => b.nodeCount - a.nodeCount);

  log.info("exportGraph", {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    communityCount,
  });
  return { nodes, edges, communities };
}

/**
 * 项目分析结果，用于前端 分析 面板。
 */
export interface ProjectAnalysis {
  language: string;
  languageVersion?: string;
  webFramework?: { name: string; details: string };
  databases: { name: string; type: string; details: string }[];
  components: { name: string; category: string; details: string }[];
  apis: { method: string; path: string; description: string; requestBody?: string; responseBody?: string }[];
  architectureDiagram: string;
  summary: string;
  logs?: { format: string; location: string };
  fileStats: { total: number; byExtension: Record<string, number> };
  codeMetrics?: {
    totalLines: number;
    testFiles: number;
    functionCount: number;
    classCount: number;
    largestFiles: { path: string; lines: number }[];
  };
  dependencies?: {
    name: string;
    version: string;
    type: "production" | "dev" | "peer" | "optional";
    category: string;
  }[];
  /** 图谱实体类型统计 */
  nodeTypes?: Record<string, number>;
  /** 图谱关系总数 */
  edgeCount?: number;
  /** 热点文件（按实体数排序，复杂度最高的文件） */
  hotspots?: { path: string; entityCount: number; kindBreakdown: Record<string, number> }[];
  /** 高耦合文件（按跨文件边数排序） */
  coupling?: { path: string; fanIn: number; fanOut: number; totalEdges: number }[];
}

// ─── 已知框架/数据库/组件 模式匹配 ───

interface KnownPattern {
  name: string;
  category: "framework" | "database" | "cache" | "mq" | "tracing" | "resilience" | "llm" | "other";
  patterns: string[];
}

const KNOWN_PATTERNS: KnownPattern[] = [
  // Web frameworks
  { name: "Express", category: "framework", patterns: ["express"] },
  { name: "Fastify", category: "framework", patterns: ["fastify"] },
  { name: "Hono", category: "framework", patterns: ["hono"] },
  { name: "Koa", category: "framework", patterns: ["koa"] },
  { name: "NestJS", category: "framework", patterns: ["@nestjs/core", "@nestjs/common"] },
  { name: "Next.js", category: "framework", patterns: ["next", "next/server"] },
  { name: "Nuxt", category: "framework", patterns: ["nuxt", "@nuxt"] },
  { name: "SvelteKit", category: "framework", patterns: ["@sveltejs/kit", "svelte"] },
  { name: "Remix", category: "framework", patterns: ["@remix-run", "remix"] },
  { name: "Astro", category: "framework", patterns: ["astro"] },
  { name: "Spring Boot", category: "framework", patterns: ["org.springframework.boot", "springframework"] },
  { name: "Django", category: "framework", patterns: ["django"] },
  { name: "Flask", category: "framework", patterns: ["flask"] },
  { name: "FastAPI", category: "framework", patterns: ["fastapi"] },
  { name: "Gin", category: "framework", patterns: ["github.com/gin-gonic/gin"] },
  { name: "Fiber", category: "framework", patterns: ["github.com/gofiber/fiber"] },
  { name: "Actix", category: "framework", patterns: ["actix-web", "actix_web"] },
  { name: "Rocket", category: "framework", patterns: ["rocket"] },
  // Databases
  { name: "SQLite", category: "database", patterns: ["sqlite", "better-sqlite3", "sqlite3"] },
  { name: "PostgreSQL", category: "database", patterns: ["pg", "postgres", "postgresql", "@vercel/postgres"] },
  { name: "MySQL", category: "database", patterns: ["mysql", "mysql2"] },
  { name: "MongoDB", category: "database", patterns: ["mongodb", "mongoose", "mongod"] },
  { name: "TCVDB", category: "database", patterns: ["tcvdb", "tencent-cloud-vdb", "@tencentdb-agent"] },
  { name: "Elasticsearch", category: "database", patterns: ["elasticsearch", "@elastic/elasticsearch"] },
  { name: "ClickHouse", category: "database", patterns: ["clickhouse", "@clickhouse/client"] },
  { name: "Neo4j", category: "database", patterns: ["neo4j", "neo4j-driver"] },
  { name: "Supabase", category: "database", patterns: ["@supabase/supabase-js", "supabase"] },
  // Caches
  { name: "Redis", category: "cache", patterns: ["redis", "ioredis", "@upstash/redis"] },
  { name: "Memcached", category: "cache", patterns: ["memcached", "memcache"] },
  // Message queues
  { name: "Kafka", category: "mq", patterns: ["kafkajs", "kafka", "@nestjs/microservices"] },
  { name: "RabbitMQ", category: "mq", patterns: ["amqplib", "amqp", "rabbitmq"] },
  { name: "NATS", category: "mq", patterns: ["nats", "nats.ws"] },
  // Observability
  { name: "OpenTelemetry", category: "tracing", patterns: ["@opentelemetry", "opentelemetry"] },
  { name: "Jaeger", category: "tracing", patterns: ["jaeger", "jaeger-client"] },
  { name: "Sentry", category: "tracing", patterns: ["@sentry", "sentry"] },
  { name: "Winston", category: "other", patterns: ["winston"] },
  { name: "Pino", category: "other", patterns: ["pino"] },
  { name: "Log4j", category: "other", patterns: ["log4j", "log4js"] },
  // Resilience
  { name: "Hystrix", category: "resilience", patterns: ["hystrix", "hystrixjs", "brakes"] },
  { name: "Resilience4j", category: "resilience", patterns: ["resilience4j", "io.github.resilience4j"] },
  { name: "Polly", category: "resilience", patterns: ["polly", "Polly"] },
  // LLM / AI
  { name: "OpenAI SDK", category: "llm", patterns: ["openai", "@ai-sdk/openai", "ai"] },
  { name: "LangChain", category: "llm", patterns: ["langchain", "@langchain"] },
  { name: "Anthropic SDK", category: "llm", patterns: ["@anthropic-ai/sdk", "anthropic"] },
  // ORM / DB tools
  { name: "Prisma", category: "other", patterns: ["@prisma/client", "prisma"] },
  { name: "Drizzle", category: "other", patterns: ["drizzle-orm", "drizzle-kit"] },
  { name: "TypeORM", category: "other", patterns: ["typeorm"] },
  { name: "Sequelize", category: "other", patterns: ["sequelize"] },
  { name: "Knex", category: "other", patterns: ["knex"] },
  // Validation
  { name: "Zod", category: "other", patterns: ["zod"] },
  { name: "Yup", category: "other", patterns: ["yup"] },
  { name: "Joi", category: "other", patterns: ["joi", "@hapi/joi"] },
  // NLP / Text
  { name: "Jieba", category: "other", patterns: ["jieba", "@node-rs/jieba"] },
  // Testing frameworks
  { name: "Jest", category: "other", patterns: ["jest", "@jest/globals"] },
  { name: "Vitest", category: "other", patterns: ["vitest"] },
  { name: "Mocha", category: "other", patterns: ["mocha"] },
  { name: "Pytest", category: "other", patterns: ["pytest"] },
  { name: "JUnit", category: "other", patterns: ["junit"] },
  // Build tools
  { name: "Webpack", category: "other", patterns: ["webpack"] },
  { name: "Vite", category: "other", patterns: ["vite"] },
  { name: "esbuild", category: "other", patterns: ["esbuild"] },
  { name: "SWC", category: "other", patterns: ["@swc/core", "swc"] },
  // Container / DevOps
  { name: "Docker", category: "other", patterns: ["docker", "dockerode", "docker-compose"] },
  { name: "Kubernetes", category: "other", patterns: ["kubernetes", "@kubernetes/client-node", "k8s"] },
  // GraphQL
  { name: "Apollo", category: "other", patterns: ["@apollo/server", "apollo-server", "@apollo/client"] },
  { name: "GraphQL", category: "other", patterns: ["graphql", "graphql-yoga", "type-graphql"] },
  // gRPC
  { name: "gRPC", category: "other", patterns: ["@grpc/grpc-js", "grpc", "grpcio"] },
];

/**
 * 分析项目架构：语言、框架、数据库、组件、API、架构图。
 */
export async function analyzeProject(instance: CodeGraphInstance): Promise<ProjectAnalysis> {
  const projectRoot = instance.projectRoot;
  const queries = (instance.cg as any).queries;

  // 1. 收集所有节点的文件路径和类型
  const rawNodes: any[] = queries?.getAllNodes?.() ?? [];
  const fileSet = new Set<string>();
  const extCount: Record<string, number> = {};
  const nodeTypes: Record<string, number> = {};

  for (const n of rawNodes) {
    const kind = (n.kind ?? "unknown") as string;
    nodeTypes[kind] = (nodeTypes[kind] ?? 0) + 1;

    const fp = (n.filePath ?? "") as string;
    if (fp && !fileSet.has(fp)) {
      fileSet.add(fp);
      const ext = fp.includes(".") ? fp.slice(fp.lastIndexOf(".")) : "";
      if (ext) extCount[ext] = (extCount[ext] ?? 0) + 1;
    }
  }

  // 2. 检测语言
  const extensions = Object.keys(extCount);
  const langMap: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript (React)",
    ".js": "JavaScript", ".jsx": "JavaScript (React)",
    ".mjs": "JavaScript (ESM)", ".cjs": "JavaScript (CJS)",
    ".py": "Python", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift",
    ".rb": "Ruby", ".php": "PHP", ".cs": "C#",
    ".c": "C", ".cpp": "C++", ".h": "C/C++ Header",
    ".vue": "Vue.js", ".svelte": "Svelte",
    ".sql": "SQL", ".yaml": "YAML", ".yml": "YAML",
    ".json": "JSON", ".md": "Markdown",
  };
  const detectedLangs = extensions
    .map((e) => ({ ext: e, name: langMap[e] ?? e, count: extCount[e] }))
    .filter((x) => x.name)
    .sort((a, b) => b.count - a.count);
  const language = detectedLangs.length > 0
    ? detectedLangs.map((x) => x.name).join(" / ")
    : "Unknown";

  // 3. 检测框架/数据库/组件 (import 节点)
  const importNodes = rawNodes.filter((n: any) => n.kind === "import");
  const detected: Map<string, KnownPattern> = new Map();
  for (const imp of importNodes) {
    const target = (imp.name ?? imp.label ?? "").toString();
    for (const kp of KNOWN_PATTERNS) {
      for (const pat of kp.patterns) {
        if (target.includes(pat)) {
          if (!detected.has(kp.name)) detected.set(kp.name, kp);
        }
      }
    }
  }

  // 分类
  const framework = [...detected.values()].find((d) => d.category === "framework");
  const databases = [...detected.values()].filter((d) => d.category === "database");
  const components = [...detected.values()].filter((d) => !["framework", "database"].includes(d.category));

  // 4. 提取 API 端点 — 从 gateway/server.ts 文件读取
  const apis: ProjectAnalysis["apis"] = [];
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // 递归收集所有源文件
    async function collectFiles(dir: string, maxDepth: number): Promise<string[]> {
      if (maxDepth <= 0) return [];
      const results: string[] = [];
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
            results.push(...(await collectFiles(full, maxDepth - 1)));
          } else if (e.isFile() && /\.(ts|js|py|go|java|rs)$/.test(e.name)) {
            results.push(full);
          }
        }
      } catch { /* skip */ }
      return results;
    }

    const srcFiles = await collectFiles(projectRoot, 5);
    const routePatterns = [
      // Express/Fastify/Koa/Hono 风格: app.get('/path', ...)
      { pattern: /(?:app|router|this\.app)\.(get|post|put|delete|patch|head|options|all)\s*\(\s*["'`]([^"'`]+)["'`]/g, methodIdx: 1, pathIdx: 2 },
      // Node http 原生路由: switch case "POST /path":
      { pattern: /case\s+["'`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/[^"'`\s]+)["'`]/g, methodIdx: 1, pathIdx: 2 },
      // Node http 原生路由: pathname === "/health" / url.pathname === "/recall"
      { pattern: /(?:pathname|url\.pathname|req\.url)\s*===?\s*["'`](\/[^"'`\s]+)["'`]/g, methodIdx: 0, pathIdx: 1 },
      // Python Flask/FastAPI: @app.get('/path')
      { pattern: /@(?:app|router|bp)\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g, methodIdx: 1, pathIdx: 2 },
      // Java Spring: @GetMapping("/path")
      { pattern: /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping|PatchMapping)\s*\(\s*(?:value\s*=\s*)?["'`]([^"'`]+)["'`]/g, methodIdx: -1, pathIdx: 1 },
      // Go Gin: router.GET("/path", ...)
      { pattern: /\.(?:GET|POST|PUT|DELETE|PATCH|HEAD)\s*\(\s*["'`]([^"'`]+)["'`]/g, methodIdx: -2, pathIdx: 1 },
      // NestJS: @Get('/path'), @Controller('/prefix')
      { pattern: /@(?:Get|Post|Put|Delete|Patch|All)\s*\(\s*["'`]([^"'`]*)["'`]\)/g, methodIdx: -1, pathIdx: 1 },
      // Next.js API routes: export async function GET, export const POST = ...
      { pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD)/g, methodIdx: 1, pathIdx: 0 },
      // React Router / Remix: path="/api/..."
      { pattern: /path\s*=\s*["'`](\/[^"'`]+)["'`]/g, methodIdx: 0, pathIdx: 1 },
    ];

    const seenPaths = new Set<string>();
    for (const file of srcFiles) {
      if (apis.length >= 100) break;
      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");

        // Next.js App Router: derive path from file location
        // e.g. src/app/api/users/route.ts → /api/users
        const nextRouteMatch = file.match(/\/app\/((?:api\/)?.+)\/route\.(ts|js|tsx|jsx)$/);
        const nextRoutePrefix = nextRouteMatch ? "/" + nextRouteMatch[1].replace(/\/route$/, "") : null;

        // NestJS: extract @Controller('/prefix') for route prefix
        const controllerMatch = content.match(/@Controller\s*\(\s*["'`]([^"'`]*)["'`]\)/);
        const controllerPrefix = controllerMatch ? controllerMatch[1] : "";

        for (const { pattern, methodIdx, pathIdx } of routePatterns) {
          pattern.lastIndex = 0;
          for (const line of lines) {
            // 跳过注释行
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(line)) !== null) {
              let method = "GET";
              let urlPath = "";

              if (methodIdx === -1) {
                // Java Spring: @GetMapping → GET, NestJS: @Get → GET
                const annotation = match[0];
                method = annotation.replace(/^@/, "").replace(/Mapping\b.*$/, "").toUpperCase();
                urlPath = match[pathIdx] ?? "";
              } else if (methodIdx === -2) {
                // Go Gin: .GET( → GET
                const call = match[0];
                method = call.replace(/^\./, "").replace(/\(.*$/, "");
                urlPath = match[pathIdx] ?? "";
              } else if (methodIdx === 0) {
                // pathname === pattern: infer method from context
                // or Next.js: export async function GET → use file path
                urlPath = match[pathIdx] ?? "";
                if (nextRoutePrefix && !urlPath) {
                  urlPath = nextRoutePrefix;
                }
                method = "GET"; // default for pathname matching
              } else {
                method = (match[methodIdx] ?? "GET").toUpperCase();
                urlPath = match[pathIdx] ?? "";
              }

              if (!urlPath || urlPath.length > 200) continue;
              // NestJS: prepend controller prefix if URL is relative
              if (controllerPrefix && urlPath && !urlPath.startsWith("/")) {
                urlPath = controllerPrefix + "/" + urlPath;
              } else if (controllerPrefix && !urlPath) {
                urlPath = controllerPrefix;
              }
              const key = `${method}:${urlPath}`;
              if (seenPaths.has(key)) continue;
              seenPaths.add(key);
              apis.push({ method, path: urlPath, description: "" });
            }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* fs not available */ }

  // 5. 依赖提取 (从 package.json / requirements.txt / go.mod 等)
  interface Dependency {
    name: string;
    version: string;
    type: "production" | "dev" | "peer" | "optional";
    category: string;
  }
  const dependencies: Dependency[] = [];
  try {
    const { promises: fs } = await import("node:fs");
    const { join } = await import("node:path");

    // package.json (Node.js)
    const pkgPath = join(projectRoot, "package.json");
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const addDeps = (deps: Record<string, string> | undefined, type: Dependency["type"]) => {
        if (!deps) return;
        for (const [name, version] of Object.entries(deps)) {
          if (dependencies.length >= 200) break;
          const cat = categoriseDependency(name);
          dependencies.push({ name, version: typeof version === "string" ? version : "unknown", type, category: cat });
        }
      };
      addDeps(pkg.dependencies, "production");
      addDeps(pkg.devDependencies, "dev");
      addDeps(pkg.peerDependencies, "peer");
      addDeps(pkg.optionalDependencies, "optional");
    } catch { /* no package.json */ }

    // requirements.txt (Python)
    const reqPath = join(projectRoot, "requirements.txt");
    try {
      const raw = await fs.readFile(reqPath, "utf-8");
      for (const line of raw.split("\n")) {
        if (dependencies.length >= 200) break;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
        const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*([><=!~].*)?$/);
        if (match) {
          const name = match[1];
          const version = (match[2] || "").trim();
          const cat = categoriseDependency(name);
          dependencies.push({ name, version: version || "latest", type: "production", category: cat });
        }
      }
    } catch { /* no requirements.txt */ }

    // go.mod
    const goModPath = join(projectRoot, "go.mod");
    try {
      const raw = await fs.readFile(goModPath, "utf-8");
      for (const line of raw.split("\n")) {
        if (dependencies.length >= 200) break;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("module") || trimmed.startsWith("go") || trimmed.startsWith("//")) continue;
        const match = trimmed.match(/^([^\s]+)\s+(v[\d.]+[-+\w]*)/);
        if (match) {
          const name = match[1];
          const cat = categoriseDependency(name);
          dependencies.push({ name, version: match[2], type: "production", category: cat });
        }
      }
    } catch { /* no go.mod */ }

    // Cargo.toml (Rust)
    const cargoPath = join(projectRoot, "Cargo.toml");
    try {
      const raw = await fs.readFile(cargoPath, "utf-8");
      let section = "";
      for (const line of raw.split("\n")) {
        if (dependencies.length >= 200) break;
        const trimmed = line.trim();
        if (trimmed.startsWith("[")) { section = trimmed.replace(/[\[\]]/g, ""); continue; }
        if (section !== "dependencies" && section !== "dev-dependencies" && section !== "build-dependencies") continue;
        const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{.*?\})/);
        if (match) {
          const name = match[1];
          const version = match[2] || match[3] || "unknown";
          const cat = categoriseDependency(name);
          const type = section === "dependencies" ? "production" : "dev";
          dependencies.push({ name, version, type, category: cat });
        }
      }
    } catch { /* no Cargo.toml */ }
  } catch { /* fs not available */ }

  // 6. 生成架构图 (Mermaid) — 使用真实边
  const topDir = projectRoot.split("/").pop() || "project";
  const nodeIds = rawNodes.map((n: any) => n.id);
  const rawEdges: any[] = queries?.findEdgesBetweenNodes?.(nodeIds) ?? [];
  const mermaid = generateMermaidDiagram(rawNodes, rawEdges, topDir, nodeTypes);

  // 6. 代码质量指标
  let totalLines = 0;
  let testFileCount = 0;
  const fileLineCounts: { path: string; lines: number }[] = [];
  const testPatterns = /\.(test|spec|__tests__)\./;

  try {
    const { promises: fs } = await import("node:fs");
    const { join } = await import("node:path");
    const srcFiles = [...fileSet].filter((f) => /\.(ts|tsx|js|jsx|py|go|java|rs|rb|php|cs|swift|kt)$/.test(f));
    for (const fp of srcFiles) {
      try {
        const fullPath = join(projectRoot, fp);
        const content = await fs.readFile(fullPath, "utf-8");
        const lines = content.split("\n").length;
        totalLines += lines;
        fileLineCounts.push({ path: fp, lines });
        if (testPatterns.test(fp)) testFileCount++;
      } catch { /* skip */ }
    }
  } catch { /* fs not available */ }

  const largestFiles = fileLineCounts
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  const codeMetrics = totalLines > 0 ? {
    totalLines,
    testFiles: testFileCount,
    functionCount: (nodeTypes.function ?? 0) + (nodeTypes.method ?? 0),
    classCount: (nodeTypes.class ?? 0) + (nodeTypes.interface ?? 0),
    largestFiles,
  } : undefined;

  // 8. 热点文件分析：按文件内实体数排序（复杂度热力图）
  const fileEntityCounts = new Map<string, { count: number; kinds: Record<string, number> }>();
  for (const n of rawNodes) {
    const fp = (n.filePath ?? "") as string;
    if (!fp) continue;
    let entry = fileEntityCounts.get(fp);
    if (!entry) { entry = { count: 0, kinds: {} }; fileEntityCounts.set(fp, entry); }
    entry.count++;
    const kind = (n.kind ?? "unknown") as string;
    entry.kinds[kind] = (entry.kinds[kind] ?? 0) + 1;
  }
  const hotspots = [...fileEntityCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([path, v]) => ({ path, entityCount: v.count, kindBreakdown: v.kinds }));

  // 9. 耦合分析：按文件统计跨文件边数
  // 先建立 node → file 映射
  const nodeFileMap = new Map<string, string>();
  for (const n of rawNodes) {
    const fp = (n.filePath ?? "") as string;
    if (fp) nodeFileMap.set(n.id as string, fp);
  }
  const fileFanIn = new Map<string, number>();
  const fileFanOut = new Map<string, number>();
  const crossFileEdges = new Set<string>();
  for (const e of rawEdges as any[]) {
    const srcFile = nodeFileMap.get(e.source);
    const tgtFile = nodeFileMap.get(e.target);
    if (!srcFile || !tgtFile || srcFile === tgtFile) continue;
    const key = `${srcFile}|||${tgtFile}`;
    if (crossFileEdges.has(key)) continue;
    crossFileEdges.add(key);
    fileFanOut.set(srcFile, (fileFanOut.get(srcFile) ?? 0) + 1);
    fileFanIn.set(tgtFile, (fileFanIn.get(tgtFile) ?? 0) + 1);
  }
  const allCoupledFiles = new Set([...fileFanIn.keys(), ...fileFanOut.keys()]);
  const coupling = [...allCoupledFiles]
    .map((f) => {
      const fi = fileFanIn.get(f) ?? 0;
      const fo = fileFanOut.get(f) ?? 0;
      return { path: f, fanIn: fi, fanOut: fo, totalEdges: fi + fo };
    })
    .sort((a, b) => b.totalEdges - a.totalEdges)
    .slice(0, 10);

  // 7. 生成摘要
  const summary = buildSummary(language, framework, databases, components, apis, nodeTypes, fileSet.size, codeMetrics);

  return {
    language,
    webFramework: framework ? { name: framework.name, details: framework.patterns[0] } : undefined,
    databases: databases.map((d) => ({ name: d.name, type: d.category, details: d.patterns[0] })),
    components: components.map((c) => ({ name: c.name, category: c.category, details: c.patterns[0] })),
    apis,
    architectureDiagram: mermaid,
    summary,
    fileStats: { total: fileSet.size, byExtension: extCount },
    codeMetrics,
    dependencies,
    nodeTypes,
    edgeCount: rawEdges.length,
    hotspots,
    coupling,
  };
}

function generateMermaidDiagram(
  rawNodes: any[],
  rawEdges: any[],
  projectName: string,
  _nodeTypes: Record<string, number>,
): string {
  // 按 linkCount 排序，取 top 节点（排除 import/变量/常量/属性）
  const nodeMap = new Map<string, any>();
  for (const n of rawNodes) nodeMap.set(n.id, n);

  // 计算 linkCount
  const linkCounts = new Map<string, number>();
  for (const e of rawEdges) {
    linkCounts.set(e.source, (linkCounts.get(e.source) ?? 0) + 1);
    linkCounts.set(e.target, (linkCounts.get(e.target) ?? 0) + 1);
  }

  const sorted = [...rawNodes]
    .filter((n: any) => n.kind !== "import" && n.kind !== "variable" && n.kind !== "property" && n.kind !== "constant")
    .map((n: any) => ({ ...n, linkCount: linkCounts.get(n.id) ?? 0 }))
    .sort((a: any, b: any) => b.linkCount - a.linkCount)
    .slice(0, 40);

  const topIds = new Set(sorted.map((n: any) => n.id));

  // 构建边：仅保留 top 节点之间的边，去重
  const edgeSet = new Set<string>();
  const topEdges: { source: string; target: string }[] = [];
  for (const e of rawEdges) {
    if (topIds.has(e.source) && topIds.has(e.target)) {
      const key = [e.source, e.target].sort().join("|");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        topEdges.push({ source: e.source, target: e.target });
      }
    }
  }

  const lines: string[] = ["graph TD"];
  lines.push(`  subgraph "${projectName}"`);

  // 按 kind 分组
  const groups: Record<string, any[]> = {};
  for (const n of sorted) {
    const kind = (n.kind ?? "unknown") as string;
    if (!groups[kind]) groups[kind] = [];
    groups[kind].push(n);
  }

  const kindColors: Record<string, string> = {
    class: "#e06c75", interface: "#61afef", function: "#98c379",
    method: "#d19a66", file: "#c678dd", type_alias: "#56b6c2",
  };

  const isLong = (s: string) => s.length > 20;

  for (const [kind, items] of Object.entries(groups)) {
    const color = kindColors[kind] ?? "#abb2bf";
    const shape = kind === "function" || kind === "method" ? "round" : "square";
    const shortKind = kind.length > 10 ? kind.slice(0, 8) + ".." : kind;
    const sgId = `sg_${shortKind.replace(/\s/g, "_")}`;
    lines.push(`  subgraph ${sgId} ["${shortKind} (${items.length})"]`);
    lines.push(`  style ${sgId} fill:${color}20,stroke:${color},stroke-width:1px`);
    for (const item of items) {
      const id = sanitizeMermaidId((item.id ?? item.name ?? "?").toString());
      const label = sanitizeMermaidLabel((item.name ?? item.id ?? "?").toString());
      if (shape === "round") {
        lines.push(`    ${id}(${isLong(label) ? '"' + label.slice(0, 30) + '"' : '"' + label + '"'})`);
      } else {
        lines.push(`    ${id}${isLong(label) ? '["' + label.slice(0, 30) + '"]' : '["' + label + '"]'}`);
      }
    }
    lines.push("  end");
  }

  lines.push("  end");

  // 添加真实边（最多 50 条）
  const edgeLines: string[] = [];
  for (const e of topEdges.slice(0, 50)) {
    const srcId = sanitizeMermaidId(e.source);
    const tgtId = sanitizeMermaidId(e.target);
    if (srcId !== tgtId && topIds.has(e.source) && topIds.has(e.target)) {
      edgeLines.push(`  ${srcId} --> ${tgtId}`);
    }
  }

  // 样式
  for (const [kind, color] of Object.entries(kindColors)) {
    lines.push(`  classDef k_${kind} fill:${color},stroke:#fff,stroke-width:1px,color:#fff`);
  }

  return lines.join("\n") + "\n" + edgeLines.join("\n");
}

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "").slice(0, 50) || "node";
}

function sanitizeMermaidLabel(label: string): string {
  return label.replace(/["\\]/g, "").slice(0, 60);
}

/** 将依赖包名映射到分类 */
function categoriseDependency(name: string): string {
  const lower = name.toLowerCase();
  // Web框架
  if (/^(express|fastify|hono|koa|@nestjs|next|nuxt|sveltekit|@remix|astro|svelte|vue|react|angular|solid|lit|htmx|alpinejs)$/.test(lower)) return "framework";
  // 数据库
  if (/^(mysql2|pg|postgres|mongodb|mongoose|prisma|drizzle|typeorm|sequelize|knex|better-sqlite3|sqlite3|redis|ioredis|@supabase|@planetscale|@upstash|@neondatabase|clickhouse|@clickhouse|neo4j|arangojs|dgraph-js)$/.test(lower)) return "database";
  // 消息队列
  if (/^(kafkajs|amqplib|amqp|rhea|@azure\/service-bus|nats|@aws-sdk\/client-sqs|bullmq|bull|@nestjs\/bull|@nestjs\/microservices)$/.test(lower)) return "mq";
  // LLM
  if (/^(openai|@anthropic|langchain|@langchain|@mastra|@ai-sdk|ollama|@huggingface|transformers|@google\/generative-ai|cohere-ai|replicate|@pinecone-database|chromadb|weaviate|qdrant|milvus|@qdrant|@llamaindex|@xenova|@mistralai)$/.test(lower)) return "llm";
  // 测试
  if (/^(jest|vitest|mocha|chai|jasmine|@playwright|puppeteer|@testing-library|@cypress|cypress|supertest|pytest|unittest|@vitest|storybook|@storybook|@jest)$/.test(lower)) return "testing";
  // 构建/工具
  if (/^(webpack|vite|esbuild|swc|@swc|parcel|rollup|turbo|@babel|babel|typescript|eslint|prettier|tsx|ts-node|tsup|@types|@rollup|@vitejs|@esbuild)$/.test(lower)) return "build";
  // 监控/日志
  if (/^(winston|pino|@opentelemetry|@sentry|bunyan|morgan|@logtail|dd-trace|@newrelic|@datadog|signalfx|@jaeger|jaeger)$/.test(lower)) return "monitoring";
  // 验证
  if (/^(zod|yup|joi|class-validator|ajv|@sinclair|valibot|@hookform|formik|validator)$/.test(lower)) return "validation";
  // 工具库
  if (/^(lodash|ramda|date-fns|moment|dayjs|rxjs|axios|@tanstack|immer|zod|clsx|nanoid|uuid|@faker|faker|dotenv|cross-env|commander|yargs|chalk|ora|inquirer|enquirer|glob|rimraf|minimatch|semver|debug|@changesets|changesets)$/.test(lower)) return "utility";
  // CSS
  if (/^(tailwindcss|@tailwindcss|postcss|autoprefixer|sass|less|stylus|@emotion|styled-components|@stitches|@vanilla-extract|@pandacss|@unocss|unocss)$/.test(lower)) return "styling";
  // DevOps
  if (/^(docker|@docker|@google-cloud|@aws-sdk|@azure|serverless|@serverless|aws-cdk|@pulumi|pulumi|terraform|cdk8s|@cdktf|k8s|@kubernetes)$/.test(lower)) return "devops";
  // GraphQL
  if (/^(graphql|@apollo|@graphql|apollo|@graphql-codegen|graphql-tag|@urql|relay-runtime)$/.test(lower)) return "graphql";
  return "other";
}

function buildSummary(
  language: string,
  framework: KnownPattern | undefined,
  databases: KnownPattern[],
  components: KnownPattern[],
  apis: ProjectAnalysis["apis"],
  nodeTypes: Record<string, number>,
  fileCount: number,
  codeMetrics?: ProjectAnalysis["codeMetrics"],
): string {
  const parts: string[] = [];

  parts.push(`## 项目概览\n`);
  parts.push(`- **语言**: ${language}`);
  parts.push(`- **文件数**: ${fileCount}`);
  parts.push(`- **代码实体数**: ${Object.values(nodeTypes).reduce((a, b) => a + b, 0)}`);

  if (codeMetrics) {
    parts.push(`- **总代码行数**: ${codeMetrics.totalLines.toLocaleString()}`);
    parts.push(`- **测试文件数**: ${codeMetrics.testFiles}`);
    parts.push(`- **函数/方法数**: ${codeMetrics.functionCount}`);
    parts.push(`- **类/接口数**: ${codeMetrics.classCount}`);
  }

  if (framework) {
    parts.push(`- **Web 框架**: ${framework.name}`);
  }

  if (databases.length > 0) {
    parts.push(`- **数据库**: ${databases.map((d) => d.name).join(", ")}`);
  }

  if (components.length > 0) {
    parts.push(`\n### 组件`);
    const byCat = new Map<string, string[]>();
    for (const c of components) {
      if (!byCat.has(c.category)) byCat.set(c.category, []);
      byCat.get(c.category)!.push(c.name);
    }
    for (const [cat, names] of byCat) {
      parts.push(`- **${cat}**: ${names.join(", ")}`);
    }
  }

  if (apis.length > 0) {
    parts.push(`\n### API 端点 (${apis.length})`);
    for (const api of apis.slice(0, 20)) {
      parts.push(`- \`${api.method} ${api.path}\``);
    }
    if (apis.length > 20) parts.push(`- ... 共 ${apis.length} 个端点`);
  }

  parts.push(`\n### 代码实体分布`);
  const sorted = Object.entries(nodeTypes).sort((a, b) => b[1] - a[1]);
  for (const [kind, count] of sorted.slice(0, 10)) {
    parts.push(`- ${kind}: ${count}`);
  }

  if (codeMetrics && codeMetrics.largestFiles.length > 0) {
    parts.push(`\n### 最大文件 (Top 5)`);
    for (const f of codeMetrics.largestFiles) {
      parts.push(`- \`${f.path}\` (${f.lines} 行)`);
    }
  }

  return parts.join("\n");
}

export function closeIndex(instance: CodeGraphInstance): void {
  log.info("closeIndex", { projectRoot: instance.projectRoot });
  try {
    instance.cg.close?.();
  } catch {
    // best-effort
  }
}
