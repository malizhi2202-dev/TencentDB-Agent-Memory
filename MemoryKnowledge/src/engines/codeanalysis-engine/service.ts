/**
 * Code-analysis engine HTTP service (thin wrapper around the original
 * GitNexus `LocalBackend`). Runs as a standalone process under the
 * glibc-2.34 Node 24 runtime (see engine-service.sh) and is called by the
 * KnowledgeServer tools channel (/v3/tools/call `analysis_*`).
 *
 * API:
 *   GET  /health              -> { ok: true, engine, version, repos }
 *   POST /call                -> { tool, params } -> LocalBackend.callTool result
 *   POST /call/batch          -> { calls: [{ tool, params }] } -> array of results
 *   GET  /api/graph?repo=X    -> { nodes: [...], edges: [...] }
 *   GET  /api/file?repo=X&path=Y -> { content: string }
 *   GET  /api/processes?repo=X   -> { processes: [...] }
 *   GET  /api/node-types?repo=X  -> { nodeTypes: [...], edgeTypes: [...] }
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { LocalBackend } from './src/mcp/local/local-backend.js';
import { checkLbugNative } from './src/core/lbug/native-check.js';

const PORT = Number(process.env.ENGINE_PORT ?? 8443);
const HOST = process.env.ENGINE_HOST ?? '127.0.0.1';

// ─── Node type color palette (matches original GitNexus) ───

const NODE_COLORS: Record<string, string> = {
  Function:   '#2563eb',
  Method:     '#3b82f6',
  Class:      '#ec4899',
  Interface:  '#f43f5e',
  TypeAlias:  '#f97316',
  Const:      '#eab308',
  Variable:   '#eab308',
  Property:   '#06b6d4',
  File:       '#6b7280',
  Folder:     '#4b5563',
  Process:    '#10b981',
  Community:  '#6366f1',
  Section:    '#3b82f6',
  Route:      '#ef4444',
};

const EDGE_COLORS: Record<string, string> = {
  CALLS:                '#2563eb',
  DEFINES:              '#06b6d4',
  ACCESSES:             '#f59e0b',
  HAS_PROPERTY:         '#06b6d4',
  HAS_METHOD:           '#3b82f6',
  MEMBER_OF:            '#ec4899',
  CONTAINS:             '#6b7280',
  USES:                 '#f97316',
  IMPORTS:              '#eab308',
  IMPLEMENTS:           '#f43f5e',
  METHOD_IMPLEMENTS:    '#f43f5e',
  STEP_IN_PROCESS:      '#10b981',
  ENTRY_POINT_OF:       '#ef4444',
  HANDLES_ROUTE:        '#ef4444',
};

function resolveRepo(params: Record<string, unknown>): string {
  const repo = params.repo;
  if (typeof repo === 'string' && repo.length > 0) return repo;
  return '';
}

async function main(): Promise<void> {
  const lbug = checkLbugNative();
  if (!lbug.ok) {
    console.error('[engine-service] LadybugDB native check failed:', lbug.message);
    process.exit(1);
  }

  const backend = new LocalBackend();
  await backend.init();
  console.error(`[engine-service] LocalBackend initialized with ${backend.repos?.size ?? 0} repos`);

  const send = (res: http.ServerResponse, status: number, body: unknown): void => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(payload);
  };

  const sendError = (res: http.ServerResponse, status: number, message: string): void => {
    send(res, status, { error: message });
  };

  const readBody = (req: http.IncomingMessage): Promise<string> =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => resolve(raw));
    });

  // ─── Cypher helper ───

  async function cypherQuery(repo: string, query: string): Promise<unknown> {
    const result = await backend.callTool('cypher', { repo, query });
    return (result as { result?: unknown })?.result ?? result;
  }

  // Helper: extract node type from id
    function nodeTypeFromId(id: string): string {
      if (id.includes(':')) return id.split(':')[0];
      if (id.startsWith('comm_')) return 'Community';
      if (id.startsWith('proc_')) return 'Process';
      return 'Unknown';
    }

  function parseMarkdownTable(md: string): Record<string, unknown>[] {
    const lines = md.split('\n').filter(l => l.startsWith('|'));
    if (lines.length < 2) return [];
    const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
    const rows: Record<string, unknown>[] = [];
    for (let i = 2; i < lines.length; i++) {
      // Don't filter empty cells — they're valid values
      const rawCells = lines[i].split('|');
      // Remove leading/trailing empty strings from split (first and last element)
      const cells = rawCells.slice(1, -1).map(c => c.trim());
      // Pad or truncate to match headers
      while (cells.length < headers.length) cells.push('');
      const row: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        let val: unknown = cells[j] ?? '';
        try { val = JSON.parse(cells[j]); } catch { /* keep string */ }
        row[headers[j]] = val;
      }
      rows.push(row);
    }
    return rows;
  }

  async function readRepoFile(repo: string, filePath: string): Promise<string> {
    // Sanitize — prevent path traversal
    const normalized = path.normalize(filePath).replace(/^(\.\.[\\/])+/, '');
    const resolved = path.join(repo, normalized);
    if (!resolved.startsWith(path.resolve(repo))) {
      throw new Error('path traversal blocked');
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    // ─── Health ───

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true, engine: 'codeanalysis', version: '1.6.9', repos: backend.repos?.size ?? 0 });
      return;
    }

    // ─── Tool call ───

    if (req.method === 'POST' && (url.pathname === '/call' || url.pathname === '/call/batch')) {
      const raw = await readBody(req);
      try {
        const body = JSON.parse(raw || '{}');
        if (url.pathname === '/call/batch') {
          const calls = Array.isArray(body.calls) ? body.calls : [];
          const results = [];
          for (const c of calls) {
            try { results.push(await backend.callTool(String(c.tool), c.params ?? {})); }
            catch (err) { results.push({ error: (err as Error).message }); }
          }
          send(res, 200, { results });
        } else {
          const result = await backend.callTool(String(body.tool), body.params ?? {});
          send(res, 200, { result });
        }
      } catch (err) {
        send(res, 400, { error: (err as Error).message });
      }
      return;
    }

    // ─── /api/graph — nodes + edges ───

    if (req.method === 'GET' && url.pathname === '/api/graph') {
      try {
        const repo = url.searchParams.get('repo') || '';
        const limit = Math.min(Number(url.searchParams.get('limit') || '1000'), 10000);
        if (!repo) { sendError(res, 400, 'repo parameter required'); return; }

        // Fetch nodes — LadybugDB Cypher doesn't support labels(n), extract type from id prefix
        const nodeResult = await cypherQuery(repo,
          `MATCH (n) RETURN n.id AS id, n.name AS name, n.filePath AS filePath LIMIT ${limit}`);
        const nodeMd = typeof (nodeResult as { markdown?: string })?.markdown === 'string'
          ? (nodeResult as { markdown: string }).markdown : '';
        const nodeRows = parseMarkdownTable(nodeMd);

        const nodes = nodeRows.map(r => {
          const id = String(r.id ?? '');
          const label = nodeTypeFromId(id);
          return {
            id,
            label,
            name: String(r.name ?? ''),
            filePath: String(r.filePath ?? ''),
            color: NODE_COLORS[label] ?? '#6b7280',
          };
        });

        // Fetch edges
        const edgeResult = await cypherQuery(repo,
          `MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, r.type AS type LIMIT ${limit * 8}`);
        const edgeMd = typeof (edgeResult as { markdown?: string })?.markdown === 'string'
          ? (edgeResult as { markdown: string }).markdown : '';
        const edgeRows = parseMarkdownTable(edgeMd);

        const edges = edgeRows.map(r => ({
          source: String(r.source ?? ''),
          target: String(r.target ?? ''),
          type: String(r.type ?? ''),
          color: EDGE_COLORS[String(r.type ?? '')] ?? '#4b5563',
        }));

        send(res, 200, { nodes, edges });
      } catch (err) {
        sendError(res, 500, (err as Error).message);
      }
      return;
    }

    // ─── /api/node-types — node and edge type summary ───

    if (req.method === 'GET' && url.pathname === '/api/node-types') {
      try {
        const repo = url.searchParams.get('repo') || '';
        if (!repo) { sendError(res, 400, 'repo parameter required'); return; }

        const nodeTypeResult = await cypherQuery(repo,
          'MATCH (n) RETURN n.id AS id LIMIT 5058');
        const nodeMd2 = typeof (nodeTypeResult as { markdown?: string })?.markdown === 'string'
          ? (nodeTypeResult as { markdown: string }).markdown : '';
        const allNodeRows = parseMarkdownTable(nodeMd2);

        // Count node types from id prefix
        const typeCounts = new Map<string, number>();
        for (const r of allNodeRows) {
          const id = String(r.id ?? '');
          const label = nodeTypeFromId(id);
          typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
        }
        const nodeTypes = Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count, color: NODE_COLORS[type] ?? '#6b7280' }));

        const edgeTypeResult = await cypherQuery(repo,
          'MATCH ()-[r]->() RETURN DISTINCT r.type AS type, count(r) AS cnt ORDER BY cnt DESC');
        const edgeMd = typeof (edgeTypeResult as { markdown?: string })?.markdown === 'string'
          ? (edgeTypeResult as { markdown: string }).markdown : '';
        const edgeTypes = parseMarkdownTable(edgeMd).map(r => ({
          type: String(r.type ?? ''),
          count: Number(r.cnt ?? 0),
          color: EDGE_COLORS[String(r.type ?? '')] ?? '#4b5563',
        }));

        send(res, 200, { nodeTypes, edgeTypes, nodeColors: NODE_COLORS, edgeColors: EDGE_COLORS });
      } catch (err) {
        sendError(res, 500, (err as Error).message);
      }
      return;
    }

    // ─── /api/file — read source file ───

    if (req.method === 'GET' && url.pathname === '/api/file') {
      try {
        const repo = url.searchParams.get('repo') || '';
        const filePath = url.searchParams.get('path') || '';
        if (!repo || !filePath) { sendError(res, 400, 'repo and path parameters required'); return; }

        const fullPath = path.join(repo, filePath);
        // Security: ensure path is within repo
        const resolved = path.resolve(fullPath);
        if (!resolved.startsWith(path.resolve(repo))) {
          sendError(res, 403, 'path traversal denied');
          return;
        }

        if (!fs.existsSync(resolved)) {
          sendError(res, 404, `file not found: ${filePath}`);
          return;
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        send(res, 200, { content, path: filePath });
      } catch (err) {
        sendError(res, 500, (err as Error).message);
      }
      return;
    }

    // ─── /api/processes — list processes/flows ───

    if (req.method === 'GET' && url.pathname === '/api/processes') {
      try {
        const repo = url.searchParams.get('repo') || '';
        const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 200);
        if (!repo) { sendError(res, 400, 'repo parameter required'); return; }

        const result = await cypherQuery(repo,
          `MATCH (n) WHERE n.id CONTAINS 'proc_' RETURN n.id AS id, n.name AS name, n.processType AS processType, n.stepCount AS stepCount LIMIT ${limit}`);
        const md = typeof (result as { markdown?: string })?.markdown === 'string'
          ? (result as { markdown: string }).markdown : '';
        const processes = parseMarkdownTable(md);

        send(res, 200, { processes });
      } catch (err) {
        sendError(res, 500, (err as Error).message);
      }
      return;
    }

    // ─── /api/process-flow — get process steps + edges ───

    if (req.method === 'GET' && url.pathname === '/api/process-flow') {
      try {
        const repo = url.searchParams.get('repo') || '';
        const pid = url.searchParams.get('pid') || '';
        if (!repo || !pid) { sendError(res, 400, 'repo and pid required'); return; }

        const safePid = pid.replace(/'/g, "''");
        const stepsResult = await cypherQuery(repo,
          `MATCH (s)-[r]->(p:Process {id: '${safePid}'}) WHERE r.type = 'STEP_IN_PROCESS' RETURN s.id AS id, s.name AS name, s.filePath AS filePath, r.step AS step ORDER BY r.step`);
        const stepsMd = typeof (stepsResult as { markdown?: string })?.markdown === 'string'
          ? (stepsResult as { markdown: string }).markdown : '';
        const steps = parseMarkdownTable(stepsMd);

        // Get CALLS edges between these steps
        const stepIds = steps.map((s: any) => `'${String(s.id).replace(/'/g, "''")}'`).join(',');
        let flowEdges: any[] = [];
        if (stepIds) {
          const edgesResult = await cypherQuery(repo,
            `MATCH (a)-[r]->(b) WHERE r.type = 'CALLS' AND a.id IN [${stepIds}] AND b.id IN [${stepIds}] RETURN a.id AS source, b.id AS target, r.type AS type`);
          const edgesMd = typeof (edgesResult as { markdown?: string })?.markdown === 'string'
            ? (edgesResult as { markdown: string }).markdown : '';
          flowEdges = parseMarkdownTable(edgesMd);
        }

        send(res, 200, { steps, edges: flowEdges });
      } catch (err) {
        sendError(res, 500, (err as Error).message);
      }
      return;
    }

    // ─── /api/search — search nodes by name ───

    if (req.method === 'GET' && url.pathname === '/api/search') {
      try {
        const repo = url.searchParams.get('repo') || '';
        const q = url.searchParams.get('q') || '';
        if (!repo || !q) { sendError(res, 400, 'repo and q required'); return; }

        const safeQ = q.replace(/'/g, "''");
        const result = await cypherQuery(repo,
          `MATCH (n) WHERE n.name CONTAINS '${safeQ}' RETURN n.id AS id, n.name AS name, n.filePath AS filePath LIMIT 50`);
        const md = typeof (result as { markdown?: string })?.markdown === 'string'
          ? (result as { markdown: string }).markdown : '';
        const results = parseMarkdownTable(md).map((r: any) => ({
          id: String(r.id ?? ''),
          label: nodeTypeFromId(String(r.id ?? '')),
          name: String(r.name ?? ''),
          filePath: String(r.filePath ?? ''),
          color: NODE_COLORS[nodeTypeFromId(String(r.id ?? ''))] ?? '#6b7280',
        }));

        send(res, 200, { results });
      } catch (err) {
        sendError(res, 500, (err as Error).message);
      }
      return;
    }

    // ─── /api/chat — streaming LLM agent ───
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await readBody(req);
        const { messages, repo } = JSON.parse(body);
        if (!messages || !repo) { send(res, 400, { error: 'missing messages or repo' }); return; }

        const llmApiKey = process.env.LLM_API_KEY || '';
        const llmBaseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
        const llmModel = process.env.LLM_MODEL || 'gpt-4o-mini';

        if (!llmApiKey) {
          send(res, 400, { error: 'LLM_API_KEY not configured. Set LLM_API_KEY env var.' });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const tools = [
          { type: 'function', function: { name: 'cypher_query', description: 'Run a Cypher query against the code knowledge graph', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Cypher query' } }, required: ['query'] } } },
          { type: 'function', function: { name: 'read_file', description: 'Read a file from the repository', parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path relative to repo root' } }, required: ['path'] } } },
          { type: 'function', function: { name: 'search_code', description: 'Search for code patterns', parameters: { type: 'object', properties: { pattern: { type: 'string', description: 'Search pattern' } }, required: ['pattern'] } } },
        ];

        const systemMsg = `You are Nexus, a code analysis assistant with access to a knowledge graph of repo "${repo}". Use tools to answer. Always cite file paths and symbols. Keep responses concise.`;
        const llmMessages: any[] = [{ role: 'system', content: systemMsg }, ...messages];

        let finishReason = '';

        for (let turn = 0; turn < 10 && finishReason !== 'stop'; turn++) {
          const llmRes = await fetch(`${llmBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmApiKey}` },
            body: JSON.stringify({ model: llmModel, messages: llmMessages, tools, tool_choice: 'auto', stream: false, max_tokens: 4096 }),
          });
          const data: any = await llmRes.json();
          const choice = data.choices?.[0];
          if (!choice) { finishReason = 'error'; break; }
          finishReason = choice.finish_reason || 'stop';
          const msg = choice.message;

          if (msg.content) {
            res.write(`data: ${JSON.stringify({ type: 'content', content: msg.content })}\n\n`);
          }

          if (msg.tool_calls?.length) {
            llmMessages.push(msg);
            for (const tc of msg.tool_calls) {
              const fn = tc.function;
              res.write(`data: ${JSON.stringify({ type: 'tool_start', tool: fn.name, args: fn.arguments })}\n\n`);
              let toolResult = '';
              try {
                const params = JSON.parse(fn.arguments);
                if (fn.name === 'cypher_query') {
                  toolResult = JSON.stringify((await cypherQuery(repo, params.query)).slice(0, 30));
                } else if (fn.name === 'read_file') {
                  toolResult = (await readRepoFile(repo, params.path)).slice(0, 4000);
                } else if (fn.name === 'search_code') {
                  toolResult = JSON.stringify(await cypherQuery(repo, `MATCH (n) WHERE n.name CONTAINS "${params.pattern}" OR n.filePath CONTAINS "${params.pattern}" RETURN n.name, n.filePath, n.id LIMIT 20`));
                }
              } catch (e: any) { toolResult = `Error: ${e.message}`; }
              res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: fn.name, result: toolResult.slice(0, 200) })}\n\n`);
              llmMessages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
            }
          } else {
            llmMessages.push(msg);
          }
          if (finishReason === 'stop') break;
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      } catch (err: any) {
        if (!res.headersSent) send(res, 500, { error: err.message });
        else { res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`); res.end(); }
      }
      return;
    }

    send(res, 404, { error: 'not found' });
  });

  server.listen(PORT, HOST, () => {
    console.error(`[engine-service] listening on http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[engine-service] fatal:', err);
  process.exit(1);
});