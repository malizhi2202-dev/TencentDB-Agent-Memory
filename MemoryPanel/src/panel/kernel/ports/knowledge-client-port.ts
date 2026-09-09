/**
 * Knowledge RPC 端口 — Wiki（15 端点）+ Code-Graph（13 端点）。
 *
 * 对齐 docs/knowledge/knowledge-api.yaml（07/08/11 定稿）。管控对
 * wiki/code-graph 不持久化；UI 触发的操作通过该端口直连 core。
 *
 * 寻址规则（与 yaml 严格一致）：
 *  - create / list / *write / *rm 携带 IdFields（team_id 必传，user_id 可选）；
 *  - get / ingest / delete / *ls / *read / graph / search 及全部 code-graph
 *    查询端点仅以资产 id（wiki_id / code_graph_id）寻址，不再传
 *    team/agent/user/task ID（归属由内核侧通过复合键解析）。
 */

// ── Wiki ──

export interface WikiDetail {
  wiki_id: string;
  team_id: string;
  name: string;
  service_url: string | null;
  summary: string | null;
  status: 'draft' | 'pending' | 'processing' | 'ready' | 'failed';
  internal_status?: string | null;
  sync_error: string | null;
  version: string;
  owner_user_id: string | null;
  page_count: number | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WikiListResult {
  items: WikiDetail[];
  total: number;
}

export interface WikiIngestResult {
  wiki_id: string;
  status: string;
}

/** raw 素材文件项（来自 `raw/sources/` 文件系统 stat）。 */
export interface RawFileEntry {
  filename: string;
  size: number;
  uploaded_at: string;
}

/** processed page 项（来自 `wiki/` 下 ingest 生成的页面）。 */
export interface PageEntry {
  id: string;
  title: string;
  type: string;
  path: string;
  locked?: boolean;
}

export interface WikiRawReadItem {
  filename: string;
  content?: string;
  not_found?: boolean;
}

export interface WikiRawWriteFile {
  filename: string;
  content: string;
}

export interface WikiRawWriteItem {
  filename: string;
  size: number;
}

export interface WikiRawRmResult {
  deleted_files: string[];
  deleted_pages: string[];
  rewritten_pages: number;
}

export interface WikiPageReadItem {
  ref: string;
  content?: string;
  not_found?: boolean;
}

export interface WikiPageWriteItem {
  ref: string;
  content: string;
}

export interface WikiPageWriteResultItem {
  ref: string;
  locked_injected?: boolean;
}

export interface WikiPageRmResult {
  deleted_pages: string[];
  rewritten_files: number;
}

export interface WikiGraphData {
  nodes: any[];
  edges: any[];
  communities?: any[];
}

export interface WikiSearchResult {
  results: Array<{ path: string; title: string; snippet: string; score: number; type: string }>;
  count: number;
}

export interface BatchDeleteResult {
  deleted_ids: string[];
  failed: Array<{ id: string; reason: string }>;
}

// ── Code-Graph ──

export interface CodeGraphDetail {
  code_graph_id: string;
  team_id: string;
  repo_name: string;
  repo_url: string;
  branch: string;
  commit_hash: string | null;
  service_url: string | null;
  summary: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  sync_error: string | null;
  version: string;
  owner_user_id: string | null;
  stats: { files: number; nodes: number; edges: number } | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodeGraphListResult {
  items: CodeGraphDetail[];
  total: number;
}

export interface CodeGraphSyncResult {
  code_graph_id: string;
  status: string;
}

export interface CodeGraphToolResult {
  text: string;
  isError: boolean;
}

export interface CodeGraphData {
  nodes: any[];
  edges: any[];
  communities?: any[];
}

export interface CodeGraphAnalysis {
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
  /** 热点文件 */
  hotspots?: { path: string; entityCount: number; kindBreakdown: Record<string, number> }[];
  /** 高耦合文件 */
  coupling?: { path: string; fanIn: number; fanOut: number; totalEdges: number }[];
}

// ── Port ──

export interface KnowledgeClientPort {
  // Wiki — 资产层（create/list 带 IdFields；get/ingest/delete 仅资产 id 寻址）
  wikiCreate(teamId: string, name: string, userId?: string): Promise<WikiDetail>;
  wikiGet(wikiId: string): Promise<WikiDetail>;
  wikiIngest(wikiId: string): Promise<WikiIngestResult>;
  wikiDelete(wikiIds: string[]): Promise<BatchDeleteResult>;
  wikiList(teamId: string, opts?: { status?: string; limit?: number; offset?: number }): Promise<WikiListResult>;
  wikiUpdateMeta(wikiId: string, patch: { name?: string; summary?: string | null }): Promise<WikiDetail>;

  // Wiki — raw 文件层（ls/read 仅资产 id；write/rm 带 IdFields）
  wikiRawLs(wikiId: string): Promise<{ items: RawFileEntry[] }>;
  wikiRawRead(wikiId: string, filenames: string[]): Promise<{ items: WikiRawReadItem[] }>;
  wikiRawWrite(teamId: string, wikiId: string, files: WikiRawWriteFile[], userId?: string): Promise<{ items: WikiRawWriteItem[] }>;
  wikiRawRm(teamId: string, wikiId: string, filenames: string[], userId?: string): Promise<WikiRawRmResult>;

  // Wiki — page 文件层（ls/read 仅资产 id；write/rm 带 IdFields）
  wikiPageLs(wikiId: string): Promise<{ items: PageEntry[] }>;
  wikiPageRead(wikiId: string, refs: string[]): Promise<{ items: WikiPageReadItem[] }>;
  wikiPageWrite(teamId: string, wikiId: string, pages: WikiPageWriteItem[], userId?: string): Promise<{ items: WikiPageWriteResultItem[] }>;
  wikiPageRm(teamId: string, wikiId: string, refs: string[], userId?: string): Promise<WikiPageRmResult>;

  // Wiki — 派生视图（仅资产 id 寻址）
  wikiGraph(wikiId: string): Promise<WikiGraphData>;
  wikiSearch(wikiId: string, query: string, limit?: number, graph?: { hop?: number; decay?: number; minScore?: number }): Promise<WikiSearchResult>;

  // Code-Graph（create/list 带 IdFields；get/sync/delete/查询 仅资产 id 寻址）
  codeGraphCreate(
    teamId: string,
    repoUrl: string,
    branch?: string,
    userId?: string,
    repoName?: string,
    auth?: { kind: 'password' | 'token' | 'ssh'; username?: string | null; secret: string; passphrase?: string | null },
  ): Promise<CodeGraphDetail>;
  codeGraphList(teamId: string, opts?: { status?: string; limit?: number; offset?: number }): Promise<CodeGraphListResult>;
  codeGraphGet(codeGraphId: string): Promise<CodeGraphDetail>;
  codeGraphSync(codeGraphId: string): Promise<CodeGraphSyncResult>;
  codeGraphDelete(codeGraphIds: string[]): Promise<BatchDeleteResult>;
  codeGraphUpdateMeta(codeGraphId: string, patch: { repo_name?: string; summary?: string | null }): Promise<CodeGraphDetail>;
  codeGraphQuery(codeGraphId: string, tool: string, params: Record<string, unknown>): Promise<CodeGraphToolResult>;
  codeGraphGraph(codeGraphId: string): Promise<CodeGraphData>;
  codeGraphAnalyze(codeGraphId: string): Promise<CodeGraphAnalysis>;
  /** KS 统一工具通道（analysis_* / gitnexus_* 前缀），供面板 AI 代理路由直调。 */
  executeTool(knowledgeId: string, toolName: string, params: Record<string, unknown>): Promise<unknown>;
  gitnexusQuery(codeGraphId: string, tool: string, params: Record<string, unknown>): Promise<unknown>;
}
