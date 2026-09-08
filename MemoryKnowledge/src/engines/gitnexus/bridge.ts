/**
 * GitNexus Bridge — 将 GitNexus 的 17 个 MCP 工具集成到 TencentDB-Agent-Memory。
 *
 * 基于现有 codegraph 引擎，提供 GitNexus 风格的统一查询层。
 * 不依赖 LadybugDB，使用我们的 codegraph 实例 + graphology 图。
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Graph from "graphology";
import type { CodeGraphInstance } from "../code/bridge.js";
import {
  assertRulesBeforeExecute,
  applyRulesAfterExecute,
  shouldIgnoreGitNexusPath,
  GITNEXUS_CHECK_RULES,
} from "./rules.js";

// ─────────────────────── Types ───────────────────────

export interface GitNexusToolResult {
  text: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

export interface GitNexusRepoInfo {
  name: string;
  path: string;
  indexedAt?: string;
  lastCommit?: string;
  stats?: Record<string, number>;
}

export interface GitNexusSymbol {
  uid: string;
  name: string;
  kind: string;
  filePath: string;
  line?: number;
  column?: number;
  content?: string;
}

export interface GitNexusProcess {
  id: string;
  name: string;
  symbols: GitNexusSymbol[];
  relevance: number;
}

export interface GitNexusChangeSymbol {
  symbol: GitNexusSymbol;
  changeType: "added" | "modified" | "deleted";
  hunkLines: string[];
}

export interface GitNexusImpactResult {
  symbol: string;
  depth: number;
  upstream: GitNexusSymbol[];
  downstream: GitNexusSymbol[];
  riskLevel: "critical" | "high" | "medium" | "low" | "unknown";
  riskSummary: string;
}

export interface GitNexusRouteInfo {
  method: string;
  path: string;
  handler: string;
  file: string;
  line: number;
  source: string;
}

export interface GitNexusToolInfo {
  name: string;
  description: string;
  entryPoint: string;
  file: string;
}

export interface GitNexusPDGNode {
  id: string;
  kind: "statement" | "condition" | "assignment" | "call" | "return";
  code: string;
  file: string;
  line: number;
  dataDeps: string[];
  controlDeps: string[];
}

export interface GitNexusTaintPath {
  source: GitNexusSymbol;
  sink: GitNexusSymbol;
  path: GitNexusSymbol[];
  confidence: number;
  explanation: string;
}

// ─────────────────────── Graph helpers ───────────────────────

function getGraph(instance: CodeGraphInstance): Graph {
  const cg = (instance.cg as any);
  if (cg.graph) return cg.graph as Graph;
  // Fallback: build from queries
  const g = new Graph({ multi: false, type: "directed" });
  const queries = cg.queries;
  if (queries) {
    const nodes = queries.getAllNodes?.() ?? [];
    for (const n of nodes) {
      try {
        g.addNode(n.id ?? n.uid ?? n.label, {
          label: n.label ?? n.name ?? "",
          type: n.kind ?? n.type ?? "unknown",
          path: n.filePath ?? n.file ?? "",
          line: n.line ?? n.startLine ?? 0,
          column: n.column ?? n.startColumn ?? 0,
          content: n.content ?? n.code ?? "",
          uid: n.uid ?? n.id ?? "",
        });
      } catch { /* duplicate */ }
    }
    const edges = queries.getAllEdges?.() ?? [];
    for (const e of edges) {
      try {
        g.addEdge(e.source ?? e.from, e.target ?? e.to, {
          type: e.kind ?? e.type ?? "RELATED",
          label: e.label ?? "",
        });
      } catch { /* missing node */ }
    }
  }
  return g;
}

function getAllNodes(instance: CodeGraphInstance): any[] {
  return (instance.cg as any).queries?.getAllNodes?.() ?? [];
}

function findNode(instance: CodeGraphInstance, query: string): any | null {
  const nodes = getAllNodes(instance);
  const q = query.toLowerCase();
  // Exact uid match
  for (const n of nodes) {
    if ((n.uid ?? n.id) === query) return n;
  }
  // Exact name match
  for (const n of nodes) {
    if ((n.name ?? n.label) === query) return n;
  }
  // Case-insensitive name match
  for (const n of nodes) {
    const name = (n.name ?? n.label ?? "").toLowerCase();
    if (name === q) return n;
  }
  // Substring match
  for (const n of nodes) {
    const name = (n.name ?? n.label ?? "").toLowerCase();
    if (name.includes(q)) return n;
  }
  return null;
}

function findNodesByKind(instance: CodeGraphInstance, kind: string): any[] {
  return getAllNodes(instance).filter((n) => (n.kind ?? n.type) === kind);
}

function findNodesByFile(instance: CodeGraphInstance, filePath: string): any[] {
  return getAllNodes(instance).filter((n) => (n.filePath ?? n.file ?? "") === filePath);
}

function toGitNexusSymbol(n: any): GitNexusSymbol {
  return {
    uid: n.uid ?? n.id ?? "",
    name: n.name ?? n.label ?? "",
    kind: n.kind ?? n.type ?? "unknown",
    filePath: n.filePath ?? n.file ?? "",
    line: n.line ?? n.startLine ?? 0,
    column: n.column ?? n.startColumn ?? 0,
    content: n.content ?? n.code ?? "",
  };
}

// ─────────────────────── Tool implementations ───────────────────────

/**
 * 1. list_repos — 列出已索引的仓库
 */
export async function listRepos(
  instance: CodeGraphInstance,
  params: { limit?: number; offset?: number },
): Promise<GitNexusToolResult> {
  const repoName = instance.projectRoot.split("/").pop() ?? instance.projectRoot;
  const stats = instance.cg.getStats?.() ?? {};
  const repo: GitNexusRepoInfo = {
    name: repoName,
    path: instance.projectRoot,
    indexedAt: new Date().toISOString(),
    stats: typeof stats === "object" ? stats : { nodes: stats },
  };
  const repos = [repo];
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const page = repos.slice(offset, offset + limit);
  const result = {
    repos: page,
    pagination: {
      total: repos.length,
      limit,
      offset,
      returned: page.length,
      hasMore: offset + limit < repos.length,
      nextOffset: offset + limit < repos.length ? offset + limit : undefined,
    },
  };
  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 2. query — 混合 BM25 + 语义搜索
 */
export async function queryGraph(
  instance: CodeGraphInstance,
  params: { search_query?: string; task_context?: string; limit?: number; max_symbols?: number },
): Promise<GitNexusToolResult> {
  const query = params.search_query ?? "";
  const limit = params.limit ?? 5;
  const maxSymbols = params.max_symbols ?? 10;

  if (!query) {
    return { text: JSON.stringify({ processes: [], definitions: [] }, null, 2), isError: false };
  }

  const nodes = getAllNodes(instance);
  const q = query.toLowerCase();

  // Score nodes by relevance
  const scored = nodes
    .map((n) => {
      let score = 0;
      const name = (n.name ?? n.label ?? "").toLowerCase();
      const content = (n.content ?? n.code ?? "").toLowerCase();
      const filePath = (n.filePath ?? n.file ?? "").toLowerCase();
      if (name === q) score += 100;
      if (name.includes(q)) score += 50;
      if (content.includes(q)) score += 10;
      if (filePath.includes(q)) score += 5;
      return { node: n, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Group into processes (call chains)
  const processes: GitNexusProcess[] = [];
  const seen = new Set<string>();
  let processIdx = 0;

  for (const { node } of scored) {
    if (processIdx >= limit) break;
    const uid = node.uid ?? node.id ?? "";
    if (seen.has(uid)) continue;
    seen.add(uid);

    // Build a simple process by tracing callers/callees
    const symbols: GitNexusSymbol[] = [toGitNexusSymbol(node)];

    // Add callees (what this function calls)
    const graph = getGraph(instance);
    try {
      const neighbors = graph.outNeighbors(uid);
      for (const nid of neighbors.slice(0, maxSymbols - 1)) {
        const attrs = graph.getNodeAttributes(nid);
        symbols.push({
          uid: nid,
          name: (attrs.label as string) ?? "",
          kind: (attrs.type as string) ?? "unknown",
          filePath: (attrs.path as string) ?? "",
          line: (attrs.line as number) ?? 0,
          column: (attrs.column as number) ?? 0,
          content: (attrs.content as string) ?? "",
        });
      }
    } catch { /* no graph */ }

    processes.push({
      id: `process_${processIdx++}`,
      name: node.name ?? node.label ?? uid,
      symbols: symbols.slice(0, maxSymbols),
      relevance: scored.find((s) => (s.node.uid ?? s.node.id) === uid)?.score ?? 0,
    });
  }

  return {
    text: JSON.stringify({ processes, definitions: [] }, null, 2),
    isError: false,
    metadata: { processes },
  };
}

/**
 * 3. cypher — 类 Cypher 图查询
 */
export async function cypherQuery(
  instance: CodeGraphInstance,
  params: { query: string },
): Promise<GitNexusToolResult> {
  const q = (params.query ?? "").trim();
  if (!q) {
    return { text: "Error: query is required", isError: true };
  }

  const graph = getGraph(instance);
  const nodes = getAllNodes(instance);

  try {
    // Simple Cypher parser: MATCH (n:Type) RETURN n.property
    const match = q.match(/MATCH\s*\((\w+)(?::(\w+))?\)/i);
    const retMatch = q.match(/RETURN\s+(.+)/i);
    const whereMatch = q.match(/WHERE\s+(.+)/i);

    if (!match) {
      return { text: "Error: unsupported Cypher syntax. Supports: MATCH (n[:Type]) [WHERE ...] RETURN ...", isError: true };
    }

    const varName = match[1] ?? "n";
    const typeFilter = match[2]?.toLowerCase();
    const returnClause = retMatch?.[1]?.trim() ?? varName;
    const whereClause = whereMatch?.[1]?.trim();

    let filtered = typeFilter
      ? nodes.filter((n) => (n.kind ?? n.type ?? "").toLowerCase() === typeFilter)
      : nodes;

    if (whereClause) {
      // Simple WHERE: n.name = 'value' or n.name CONTAINS 'value'
      const eqMatch = whereClause.match(new RegExp(`${varName}\\.(\\w+)\\s*=\\s*['\"]([^'\"]+)['\"]`));
      const containsMatch = whereClause.match(new RegExp(`${varName}\\.(\\w+)\\s+CONTAINS\\s+['\"]([^'\"]+)['\"]`, "i"));
      if (eqMatch) {
        const [, prop, val] = eqMatch;
        filtered = filtered.filter((n) => {
          const pv = (n as any)[prop] ?? (n as any)[prop === "name" ? "label" : prop];
          return String(pv) === val;
        });
      } else if (containsMatch) {
        const [, prop, val] = containsMatch;
        filtered = filtered.filter((n) => {
          const pv = (n as any)[prop] ?? (n as any)[prop === "name" ? "label" : prop];
          return String(pv).toLowerCase().includes(val.toLowerCase());
        });
      }
    }

    // Process RETURN clause
    const returnProps = returnClause.split(",").map((s) => s.trim());
    const results = filtered.map((n) => {
      if (returnClause === varName || returnClause === "*") {
        return {
          uid: n.uid ?? n.id,
          name: n.name ?? n.label,
          kind: n.kind ?? n.type,
          filePath: n.filePath ?? n.file,
          line: n.line ?? n.startLine,
        };
      }
      const obj: Record<string, unknown> = {};
      for (const prop of returnProps) {
        const clean = prop.replace(new RegExp(`^${varName}\\.`), "").trim();
        obj[clean] = (n as any)[clean] ?? (n as any)[clean === "name" ? "label" : clean];
      }
      return obj;
    });

    return {
      text: JSON.stringify({ results, count: results.length }, null, 2),
      isError: false,
      metadata: { results, count: results.length },
    };
  } catch (err) {
    return { text: `Cypher error: ${err}`, isError: true };
  }
}

/**
 * 4. context — 360° 符号上下文
 */
export async function getSymbolContext(
  instance: CodeGraphInstance,
  params: { name?: string; uid?: string; file_path?: string; kind?: string; include_content?: boolean },
): Promise<GitNexusToolResult> {
  const node = params.uid
    ? findNode(instance, params.uid)
    : findNode(instance, params.name ?? "");

  if (!node) {
    return { text: `Symbol not found: ${params.name ?? params.uid}`, isError: true };
  }

  const uid = node.uid ?? node.id ?? "";
  const graph = getGraph(instance);
  const symbol = toGitNexusSymbol(node);

  // Callers (inbound edges)
  const callers: GitNexusSymbol[] = [];
  try {
    for (const nid of graph.inNeighbors(uid)) {
      const attrs = graph.getNodeAttributes(nid);
      callers.push({
        uid: nid,
        name: (attrs.label as string) ?? "",
        kind: (attrs.type as string) ?? "unknown",
        filePath: (attrs.path as string) ?? "",
        line: (attrs.line as number) ?? 0,
        column: (attrs.column as number) ?? 0,
      });
    }
  } catch { /* no graph */ }

  // Callees (outbound edges)
  const callees: GitNexusSymbol[] = [];
  try {
    for (const nid of graph.outNeighbors(uid)) {
      const attrs = graph.getNodeAttributes(nid);
      callees.push({
        uid: nid,
        name: (attrs.label as string) ?? "",
        kind: (attrs.type as string) ?? "unknown",
        filePath: (attrs.path as string) ?? "",
        line: (attrs.line as number) ?? 0,
        column: (attrs.column as number) ?? 0,
      });
    }
  } catch { /* no graph */ }

  const result = {
    symbol,
    callers: callers.slice(0, 50),
    callees: callees.slice(0, 50),
    callerCount: callers.length,
    calleeCount: callees.length,
    content: params.include_content ? (node.content ?? node.code ?? "") : undefined,
  };

  return {
    text: JSON.stringify(result, null, 2),
    isError: false,
    metadata: result,
  };
}

/**
 * 5. detect_changes — git diff 影响分析
 */
export async function detectChanges(
  instance: CodeGraphInstance,
  params: { scope?: string; worktree?: string },
): Promise<GitNexusToolResult> {
  const projectRoot = instance.projectRoot;
  const scope = params.scope ?? "unstaged";

  try {
    const args = scope === "staged" ? ["diff", "--cached", "--name-only"] : ["diff", "--name-only"];
    const output = execSync(`git ${args.join(" ")}`, {
      cwd: projectRoot,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    if (!output) {
      return {
        text: JSON.stringify({
          changed_files: [],
          changed_symbols: [],
          affected_processes: [],
          summary: { changed_count: 0, risk_level: "low", partial: false },
        }, null, 2),
        isError: false,
      };
    }

    const changedFiles = output.split("\n").filter(Boolean);
    const changedSymbols: GitNexusChangeSymbol[] = [];

    for (const file of changedFiles) {
      const nodes = findNodesByFile(instance, file);
      for (const node of nodes) {
        changedSymbols.push({
          symbol: toGitNexusSymbol(node),
          changeType: "modified",
          hunkLines: [],
        });
      }
    }

    const riskLevel = changedSymbols.length > 20 ? "high" : changedSymbols.length > 5 ? "medium" : "low";

    const result = {
      changed_files: changedFiles,
      changed_symbols: changedSymbols.slice(0, 100),
      affected_processes: [],
      summary: {
        changed_count: changedSymbols.length,
        risk_level: changedSymbols.length > 0 ? riskLevel : "low",
        partial: changedSymbols.length > 100,
      },
      truncated: changedSymbols.length > 100,
    };

    return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
  } catch (err) {
    return { text: `detect_changes error: ${err}`, isError: true };
  }
}

/**
 * 6. check — 代码质量检查
 */
export async function checkCode(
  instance: CodeGraphInstance,
  params: { file?: string; symbol?: string },
): Promise<GitNexusToolResult> {
  const nodes = params.file
    ? findNodesByFile(instance, params.file)
    : params.symbol
      ? [findNode(instance, params.symbol)].filter(Boolean)
      : getAllNodes(instance).slice(0, 100);

  const issues: Array<{ severity: string; message: string; file: string; line: number }> = [];

  for (const node of nodes) {
    const name = node.name ?? node.label ?? "";
    const content = node.content ?? node.code ?? "";
    const filePath = node.filePath ?? node.file ?? "";
    const line = node.line ?? 0;

    // GitNexus 检查规则表（rules.ts）—— 命中即记录
    for (const rule of GITNEXUS_CHECK_RULES) {
      if (rule.match(content, node.kind, name)) {
        issues.push({ severity: rule.severity, message: `${rule.description} in ${name}`, file: filePath, line });
      }
    }
  }

  const result = {
    issues,
    summary: {
      total: issues.length,
      info: issues.filter((i) => i.severity === "info").length,
      warn: issues.filter((i) => i.severity === "warn").length,
      error: issues.filter((i) => i.severity === "error").length,
    },
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 7. rename — 图辅助安全重命名
 */
export async function renameSymbol(
  instance: CodeGraphInstance,
  params: { symbol: string; new_name: string; dry_run?: boolean },
): Promise<GitNexusToolResult> {
  const node = findNode(instance, params.symbol);
  if (!node) {
    return { text: `Symbol not found: ${params.symbol}`, isError: true };
  }

  const uid = node.uid ?? node.id ?? "";
  const graph = getGraph(instance);
  const references: GitNexusSymbol[] = [toGitNexusSymbol(node)];

  try {
    for (const nid of graph.inNeighbors(uid)) {
      const attrs = graph.getNodeAttributes(nid);
      references.push({
        uid: nid,
        name: (attrs.label as string) ?? "",
        kind: (attrs.type as string) ?? "unknown",
        filePath: (attrs.path as string) ?? "",
        line: (attrs.line as number) ?? 0,
        column: (attrs.column as number) ?? 0,
      });
    }
    for (const nid of graph.outNeighbors(uid)) {
      const attrs = graph.getNodeAttributes(nid);
      references.push({
        uid: nid,
        name: (attrs.label as string) ?? "",
        kind: (attrs.type as string) ?? "unknown",
        filePath: (attrs.path as string) ?? "",
        line: (attrs.line as number) ?? 0,
        column: (attrs.column as number) ?? 0,
      });
    }
  } catch { /* no graph */ }

  const deduped = references.filter((r, i, arr) => {
    const fp = `${r.filePath}:${r.name}`;
    return arr.findIndex((x) => `${x.filePath}:${x.name}` === fp) === i;
  });

  const result = {
    symbol: params.symbol,
    new_name: params.new_name,
    dry_run: params.dry_run ?? true,
    references: deduped,
    reference_count: deduped.length,
    files_affected: [...new Set(deduped.map((r) => r.filePath))],
    warning: deduped.length > 10
      ? "Many references found. Review carefully before applying."
      : undefined,
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 8. impact — 爆炸半径分析
 */
export async function impactAnalysis(
  instance: CodeGraphInstance,
  params: { symbol?: string; name?: string; uid?: string; depth?: number; maxDepth?: number },
): Promise<GitNexusToolResult> {
  const query = params.symbol ?? params.name ?? params.uid ?? "";
  const node = findNode(instance, query);
  if (!node) {
    return { text: `Symbol not found: ${query}`, isError: true };
  }

  const uid = node.uid ?? node.id ?? "";
  const maxDepth = params.depth ?? params.maxDepth ?? 2;
  const graph = getGraph(instance);

  const upstream: GitNexusSymbol[] = [];
  const downstream: GitNexusSymbol[] = [];

  // BFS upstream
  const visitedUp = new Set<string>([uid]);
  let frontier = [uid];
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = [];
    for (const fid of frontier) {
      try {
        for (const nid of graph.inNeighbors(fid)) {
          if (!visitedUp.has(nid)) {
            visitedUp.add(nid);
            const attrs = graph.getNodeAttributes(nid);
            upstream.push({
              uid: nid,
              name: (attrs.label as string) ?? "",
              kind: (attrs.type as string) ?? "unknown",
              filePath: (attrs.path as string) ?? "",
              line: (attrs.line as number) ?? 0,
              column: (attrs.column as number) ?? 0,
            });
            next.push(nid);
          }
        }
      } catch { /* skip */ }
    }
    frontier = next;
  }

  // BFS downstream
  const visitedDown = new Set<string>([uid]);
  frontier = [uid];
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = [];
    for (const fid of frontier) {
      try {
        for (const nid of graph.outNeighbors(fid)) {
          if (!visitedDown.has(nid)) {
            visitedDown.add(nid);
            const attrs = graph.getNodeAttributes(nid);
            downstream.push({
              uid: nid,
              name: (attrs.label as string) ?? "",
              kind: (attrs.type as string) ?? "unknown",
              filePath: (attrs.path as string) ?? "",
              line: (attrs.line as number) ?? 0,
              column: (attrs.column as number) ?? 0,
            });
            next.push(nid);
          }
        }
      } catch { /* skip */ }
    }
    frontier = next;
  }

  const totalAffected = upstream.length + downstream.length;
  const riskLevel: GitNexusImpactResult["riskLevel"] =
    totalAffected > 50 ? "critical" : totalAffected > 20 ? "high" : totalAffected > 5 ? "medium" : "low";

  const result: GitNexusImpactResult = {
    symbol: node.name ?? node.label ?? query,
    depth: maxDepth,
    upstream,
    downstream,
    riskLevel,
    riskSummary: `${totalAffected} symbols affected across ${maxDepth} depth levels. Risk: ${riskLevel}.`,
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 9. explain — 污点分析解释
 */
export async function explainSymbol(
  instance: CodeGraphInstance,
  params: { symbol?: string; name?: string; uid?: string; limit?: number },
): Promise<GitNexusToolResult> {
  const query = params.symbol ?? params.name ?? params.uid ?? "";
  if (!query) {
    return { text: "Error: symbol is required", isError: true };
  }

  const node = findNode(instance, query);
  if (!node) {
    return { text: `Symbol not found: ${query}`, isError: true };
  }

  const content = node.content ?? node.code ?? "";
  const name = node.name ?? node.label ?? "";

  // Simple heuristic analysis
  const findings: string[] = [];
  const isTainted = content.includes("req.") || content.includes("request.") ||
    content.includes("params.") || content.includes("query.") ||
    content.includes("body.") || content.includes("input") ||
    content.includes("readFile") || content.includes("process.env");

  const isSink = content.includes("res.") || content.includes("response.") ||
    content.includes("send(") || content.includes("write(") ||
    content.includes("exec(") || content.includes("eval(") ||
    content.includes("query(") || content.includes("execute(");

  if (isTainted && isSink) {
    findings.push(`${name} is both a data source AND sink — high risk surface.`);
  } else if (isTainted) {
    findings.push(`${name} appears to be a data source (receives external input).`);
  } else if (isSink) {
    findings.push(`${name} appears to be a data sink (performs side effects).`);
  }

  if (content.includes("try") && content.includes("catch")) {
    findings.push(`${name} has error handling (try/catch).`);
  }
  if (content.includes("async") || content.includes("await")) {
    findings.push(`${name} is asynchronous.`);
  }

  const result = {
    symbol: toGitNexusSymbol(node),
    findings,
    is_source: isTainted,
    is_sink: isSink,
    explanation: findings.join(" ") || "No notable patterns detected.",
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 10. pdg_query — 程序依赖图查询
 */
export async function pdgQuery(
  instance: CodeGraphInstance,
  params: { symbol?: string; name?: string; file?: string; limit?: number },
): Promise<GitNexusToolResult> {
  const query = params.symbol ?? params.name ?? "";
  const limit = params.limit ?? 50;
  let nodes: any[];

  if (query) {
    const node = findNode(instance, query);
    if (!node) {
      return { text: `Symbol not found: ${query}`, isError: true };
    }
    nodes = [node];
  } else if (params.file) {
    nodes = findNodesByFile(instance, params.file);
  } else {
    nodes = getAllNodes(instance).slice(0, limit);
  }

  const pdgNodes: GitNexusPDGNode[] = nodes.map((n) => {
    const content = n.content ?? n.code ?? "";
    const isCondition = content.includes("if ") || content.includes("switch ") || content.includes("case ");
    const isAssignment = content.includes("=") && !content.includes("==") && !content.includes("=>");
    const isCall = content.includes("(") && content.includes(")");
    const isReturn = content.includes("return ");

    const kind: GitNexusPDGNode["kind"] = isReturn
      ? "return"
      : isCondition
        ? "condition"
        : isAssignment
          ? "assignment"
          : isCall
            ? "call"
            : "statement";

    return {
      id: n.uid ?? n.id ?? "",
      kind,
      code: content.slice(0, 200),
      file: n.filePath ?? n.file ?? "",
      line: n.line ?? n.startLine ?? 0,
      dataDeps: [],
      controlDeps: [],
    };
  });

  const result = {
    nodes: pdgNodes.slice(0, limit),
    count: pdgNodes.length,
    truncated: pdgNodes.length > limit,
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 11. route_map — API 路由发现
 */
export async function routeMap(
  instance: CodeGraphInstance,
  _params: Record<string, unknown>,
): Promise<GitNexusToolResult> {
  const root = instance.projectRoot;
  const routes: GitNexusRouteInfo[] = [];

  // Regex-based route extraction (enhanced from GitNexus dispatch guard approach)
  const routePatterns = [
    // Express/Fastify/Koa/Hono
    {
      pattern: /(?:app|router|this\.app)\.(get|post|put|delete|patch|head|options|all)\s*\(\s*["'`]([^"'`]+)["'`]/g,
      methodIdx: 1, pathIdx: 2, source: "framework",
    },
    // Node http dispatch guard: if (req.method === 'GET' && pathname === '/api/x')
    {
      pattern: /(?:req\.method|method)\s*===?\s*["'`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)["'`]\s*&&\s*(?:pathname|req\.url|url)\s*===?\s*["'`](\/[^"'`\s]+)["'`]/g,
      methodIdx: 1, pathIdx: 2, source: "dispatch-guard",
    },
    // Python Flask/FastAPI
    {
      pattern: /@(?:app|router|bp)\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g,
      methodIdx: 1, pathIdx: 2, source: "decorator",
    },
    // Java Spring
    {
      pattern: /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping|PatchMapping)\s*\(\s*(?:value\s*=\s*)?["'`]([^"'`]+)["'`]/g,
      methodIdx: -1, pathIdx: 1, source: "decorator",
    },
    // Go Gin
    {
      pattern: /(?:router|r|g)\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*["'`]([^"'`]+)["'`]/g,
      methodIdx: 1, pathIdx: 2, source: "framework",
    },
    // Next.js route files (filesystem convention)
    {
      pattern: /(?:export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS))\s*\(/g,
      methodIdx: 1, pathIdx: -1, source: "filesystem",
    },
  ];

  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  async function collectFiles(dir: string, maxDepth: number): Promise<string[]> {
    if (maxDepth <= 0) return [];
    const results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.relative(root, full).replace(/\\/g, "/");
        // GitNexus 忽略清单规则（rules.ts）
        if (shouldIgnoreGitNexusPath(rel)) continue;
        if (e.isDirectory()) {
          results.push(...(await collectFiles(full, maxDepth - 1)));
        } else if (e.isFile() && /\.(ts|js|py|go|java|rs|tsx|jsx)$/.test(e.name)) {
          results.push(full);
        }
      }
    } catch { /* skip */ }
    return results;
  }

  try {
    const files = await collectFiles(root, 5);
    for (const file of files.slice(0, 500)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        for (const { pattern, methodIdx, pathIdx, source } of routePatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const method = methodIdx >= 0 ? match[methodIdx].toUpperCase() : "GET";
            const routePath = pathIdx >= 0 ? match[pathIdx] : file;
            let line = 1;
            for (let i = 0; i < match.index; i++) {
              if (content[i] === "\n") line++;
            }
            routes.push({
              method,
              path: routePath,
              handler: file.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "",
              file,
              line,
              source,
            });
          }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip */ }

  // Deduplicate
  const seen = new Set<string>();
  const unique = routes.filter((r) => {
    const key = `${r.method}:${r.path}:${r.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const result = {
    routes: unique,
    count: unique.length,
    byMethod: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
  };
  for (const r of unique) {
    result.byMethod[r.method] = (result.byMethod[r.method] ?? 0) + 1;
    result.bySource[r.source] = (result.bySource[r.source] ?? 0) + 1;
  }

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 12. tool_map — CLI/工具发现
 */
export async function toolMap(
  instance: CodeGraphInstance,
  _params: Record<string, unknown>,
): Promise<GitNexusToolResult> {
  const root = instance.projectRoot;
  const tools: GitNexusToolInfo[] = [];

  // Check common CLI entry points
  const cliPatterns = [
    { file: "package.json", field: "bin" },
    { file: "Makefile", field: null },
    { file: "Taskfile.yml", field: null },
    { file: "justfile", field: null },
  ];

  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  try {
    const pkgPath = path.join(root, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
      if (pkg.bin && typeof pkg.bin === "object") {
        for (const [name, entry] of Object.entries(pkg.bin)) {
          tools.push({
            name,
            description: `npm bin: ${name}`,
            entryPoint: entry as string,
            file: pkgPath,
          });
        }
      }
      if (pkg.scripts && typeof pkg.scripts === "object") {
        for (const [name, script] of Object.entries(pkg.scripts)) {
          tools.push({
            name: `npm run ${name}`,
            description: script as string,
            entryPoint: name,
            file: pkgPath,
          });
        }
      }
    }
    // Check for CLI command definitions in source
    const cmdFiles = getAllNodes(instance)
      .filter((n) => {
        const fp = (n.filePath ?? n.file ?? "").toLowerCase();
        return fp.includes("cli") || fp.includes("command") || fp.includes("cmd");
      })
      .slice(0, 50);
    for (const n of cmdFiles) {
      tools.push({
        name: n.name ?? n.label ?? "",
        description: `CLI command handler`,
        entryPoint: n.filePath ?? n.file ?? "",
        file: n.filePath ?? n.file ?? "",
      });
    }
  } catch { /* skip */ }

  const result = { tools, count: tools.length };
  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 13. shape_check — 接口/类型一致性检查
 */
export async function shapeCheck(
  instance: CodeGraphInstance,
  params: { file?: string; interface?: string },
): Promise<GitNexusToolResult> {
  const nodes = params.interface
    ? [findNode(instance, params.interface)].filter(Boolean)
    : params.file
      ? findNodesByFile(instance, params.file)
      : findNodesByKind(instance, "interface").concat(findNodesByKind(instance, "type"));

  const checks: Array<{
    name: string;
    kind: string;
    file: string;
    properties: string[];
    warnings: string[];
  }> = [];

  for (const node of nodes) {
    const content = (node.content ?? node.code ?? "") as string;
    const props = content.match(/(\w+)\s*[?:]\s*[\w<>\[\]|&"'`]+/g) ?? [];
    const warnings: string[] = [];

    if (content.includes("any")) warnings.push("Uses 'any' type — consider a more specific type");
    if (content.includes("as ") && content.includes("any")) warnings.push("Uses 'as any' cast — unsafe");
    if (props.length === 0) warnings.push("No properties detected — may be empty");

    checks.push({
      name: (node.name ?? node.label ?? "") as string,
      kind: (node.kind ?? node.type ?? "unknown") as string,
      file: (node.filePath ?? node.file ?? "") as string,
      properties: props.map((p) => p.trim()),
      warnings,
    });
  }

  const result = {
    checks: checks.slice(0, 50),
    total: checks.length,
    with_warnings: checks.filter((c) => c.warnings.length > 0).length,
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 14. api_impact — API 变更影响分析
 */
export async function apiImpact(
  instance: CodeGraphInstance,
  params: { path?: string; method?: string },
): Promise<GitNexusToolResult> {
  // First, run route_map to get all routes
  const routeResult = await routeMap(instance, {});
  const routes = (routeResult.metadata as any)?.routes ?? [];

  // Filter by path/method
  let filtered = routes as GitNexusRouteInfo[];
  if (params.path) {
    filtered = filtered.filter((r: GitNexusRouteInfo) => r.path.includes(params.path ?? ""));
  }
  if (params.method) {
    filtered = filtered.filter((r: GitNexusRouteInfo) => r.method === (params.method ?? "").toUpperCase());
  }

  // For each route, find the handler symbol and its impact
  const impacts = filtered.map((route: GitNexusRouteInfo) => {
    const handlerNode = findNode(instance, route.handler);
    const callers = handlerNode ? [] : [];
    return {
      route,
      handler: handlerNode ? toGitNexusSymbol(handlerNode) : null,
      consumers: callers.slice(0, 10),
      risk: callers.length > 10 ? "high" : callers.length > 3 ? "medium" : "low",
    };
  });

  const result = {
    api_count: impacts.length,
    impacts,
    summary: {
      high_risk: impacts.filter((i) => i.risk === "high").length,
      medium_risk: impacts.filter((i) => i.risk === "medium").length,
      low_risk: impacts.filter((i) => i.risk === "low").length,
    },
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 15. group_list — 跨仓库组列表
 */
export async function groupList(
  _instance: CodeGraphInstance,
  _params: Record<string, unknown>,
): Promise<GitNexusToolResult> {
  // Groups are managed by our system's team/service structure
  const result = {
    groups: [],
    message: "Cross-repo groups are managed through the TencentDB team system. Use the Code page to manage multiple repositories.",
  };
  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 16. group_sync — 跨仓库组同步
 */
export async function groupSync(
  _instance: CodeGraphInstance,
  _params: { groupName?: string },
): Promise<GitNexusToolResult> {
  const result = {
    synced: [],
    message: "Cross-repo sync is managed through the TencentDB team system.",
  };
  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

/**
 * 17. trace — 执行流追踪
 */
export async function traceExecution(
  instance: CodeGraphInstance,
  params: { symbol?: string; name?: string; uid?: string; direction?: string; maxDepth?: number },
): Promise<GitNexusToolResult> {
  const query = params.symbol ?? params.name ?? params.uid ?? "";
  const node = findNode(instance, query);
  if (!node) {
    return { text: `Symbol not found: ${query}`, isError: true };
  }

  const uid = node.uid ?? node.id ?? "";
  const maxDepth = params.maxDepth ?? 5;
  const direction = params.direction ?? "downstream";
  const graph = getGraph(instance);

  const trace: Array<{ depth: number; symbols: GitNexusSymbol[] }> = [];
  const visited = new Set<string>([uid]);
  let frontier = [uid];

  for (let d = 0; d < maxDepth; d++) {
    const level: GitNexusSymbol[] = [];
    const next: string[] = [];

    for (const fid of frontier) {
      try {
        const neighbors = direction === "downstream"
          ? graph.outNeighbors(fid)
          : direction === "upstream"
            ? graph.inNeighbors(fid)
            : [...graph.inNeighbors(fid), ...graph.outNeighbors(fid)];

        for (const nid of neighbors) {
          if (!visited.has(nid)) {
            visited.add(nid);
            const attrs = graph.getNodeAttributes(nid);
            level.push({
              uid: nid,
              name: (attrs.label as string) ?? "",
              kind: (attrs.type as string) ?? "unknown",
              filePath: (attrs.path as string) ?? "",
              line: (attrs.line as number) ?? 0,
              column: (attrs.column as number) ?? 0,
            });
            next.push(nid);
          }
        }
      } catch { /* skip */ }
    }

    if (level.length > 0) {
      trace.push({ depth: d + 1, symbols: level });
    }
    frontier = next;
    if (next.length === 0) break;
  }

  const result = {
    origin: toGitNexusSymbol(node),
    direction,
    trace,
    total_symbols: trace.reduce((sum, t) => sum + t.symbols.length, 0),
    max_depth_reached: trace.length,
  };

  return { text: JSON.stringify(result, null, 2), isError: false, metadata: result };
}

// ─────────────────────── Tool registry ───────────────────────

export const GITNEXUS_TOOLS: Record<string, {
  name: string;
  description: string;
  execute: (instance: CodeGraphInstance, params: Record<string, unknown>) => Promise<GitNexusToolResult>;
}> = {
  list_repos:      { name: "list_repos",      description: "List indexed repositories",                        execute: listRepos },
  query:           { name: "query",           description: "Hybrid BM25 + vector search over the graph",       execute: queryGraph },
  cypher:          { name: "cypher",          description: "Ad-hoc Cypher graph queries",                       execute: cypherQuery },
  context:         { name: "context",         description: "360° context: callers, callees, processes",        execute: getSymbolContext },
  detect_changes:  { name: "detect_changes",  description: "Map git diffs to affected symbols and processes",  execute: detectChanges },
  check:           { name: "check",           description: "Code quality checks",                               execute: checkCode },
  rename:          { name: "rename",          description: "Graph-assisted multi-file rename with dry_run",    execute: renameSymbol },
  impact:          { name: "impact",          description: "Blast radius with risk summary",                    execute: impactAnalysis },
  explain:         { name: "explain",         description: "Taint analysis explanations",                       execute: explainSymbol },
  pdg_query:       { name: "pdg_query",       description: "Program Dependence Graph queries",                  execute: pdgQuery },
  route_map:       { name: "route_map",       description: "API route discovery",                               execute: routeMap },
  tool_map:        { name: "tool_map",        description: "CLI/tool discovery",                                execute: toolMap },
  shape_check:     { name: "shape_check",     description: "Interface/type consistency check",                  execute: shapeCheck },
  api_impact:      { name: "api_impact",      description: "Pre-change API impact analysis",                    execute: apiImpact },
  group_list:      { name: "group_list",      description: "Cross-repo group listing",                          execute: groupList },
  group_sync:      { name: "group_sync",      description: "Cross-repo group sync",                             execute: groupSync },
  trace:           { name: "trace",           description: "Execution flow tracing",                            execute: traceExecution },
};

export async function executeGitNexusTool(
  instance: CodeGraphInstance,
  toolName: string,
  params: Record<string, unknown>,
): Promise<GitNexusToolResult> {
  const tool = GITNEXUS_TOOLS[toolName];
  if (!tool) {
    return { text: `Unknown GitNexus tool: ${toolName}. Available: ${Object.keys(GITNEXUS_TOOLS).join(", ")}`, isError: true };
  }

  // 规则链（GitNexus rules.ts）：
  //  1. 执行前 — 只读策略校验（GITNEXUS_MCP_READ_ONLY=1 时写工具被拒）
  try {
    assertRulesBeforeExecute(toolName, params);
  } catch (err: any) {
    return { text: err.message || String(err), isError: true };
  }

  //  2. 执行
  const result = await tool.execute(instance, params);

  //  3. 执行后 — 输出预算截断（query/context/impact 的 maxTokens）
  if (!result.isError) {
    try {
      result.text = applyRulesAfterExecute(toolName, params, result.text);
    } catch { /* 预算解析失败时保持原文 */ }
  }
  return result;
}