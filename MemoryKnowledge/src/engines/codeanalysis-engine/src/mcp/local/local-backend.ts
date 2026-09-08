/**
 * Local Backend (Multi-Repo)
 *
 * Provides tool implementations using local .gitnexus/ indexes.
 * Supports multiple indexed repositories via a global registry.
 * LadybugDB connections are opened lazily per repo on first query.
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import {
  initLbug,
  executeQuery,
  executeParameterized,
  closeLbug,
  isLbugReady,
  statDbIdentity,
  dbIdentityChanged,
} from '../../core/lbug/pool-adapter.js';
import { queryClassBeanMetadata } from './bean-metadata.js';
import { querySpringAopMetadata } from './aop-metadata.js';
import { isValidQueryParams } from '../../core/lbug/query-params.js';
import { toDisplayLine } from './line-display.js';
import { LBUG_ID_PROBE_BATCH_SIZE, LBUG_QUERY_BATCH_SIZE } from '../../core/lbug/query-batch.js';
import { chunk, mapConcurrent } from '../../lib/utils.js';
import { pathSuffixOf } from './path-predicate.js';
import { toOneBasedLine } from '../../core/ingestion/utils/line-base.js';
import { isWalCorruptionError, WAL_RECOVERY_SUGGESTION } from '../../core/lbug/lbug-config.js';
// Embedding imports are lazy (dynamic import) to avoid loading onnxruntime-node
// at MCP server startup — crashes on unsupported Node ABI versions (#89)
// git utilities available if needed
// import { isGitRepo, getCurrentCommit, getGitRoot } from '../../storage/git.js';
import {
  parseDiffHunks,
  coalesceHunksByPath,
  hunksOverlapRange,
  getCanonicalRepoRoot,
  getGitRoot,
  type FileDiff,
} from '../../storage/git.js';
import { realpathSync } from 'fs';
import {
  listRegisteredRepos,
  cleanupOldKuzuFiles,
  canonicalizePath,
  getStoragePaths,
  loadMeta,
  RegistryAmbiguousTargetError,
  type RegistryEntry,
  type BranchSummary,
} from '../../storage/repo-manager.js';
import {
  GroupService,
  type GroupToolPort,
  type GroupSymbolResolution,
  type GroupPdgFlowResult,
  type GroupPdgFlowHop,
} from '../../core/group/service.js';
import { resolveAtGroupMemberRepoPath } from '../../core/group/resolve-at-member.js';

(Showing lines 1-60 of 8771. Use offset=61 to continue.)




























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































  private async withToolStaleness(repo: RepoHandle, result: unknown): Promise<unknown> {
    if (!canCarryStaleness(result)) return result;
    // Defensive: `checkStalenessAsync` self-catches today, but a rejection here
    // must never fail the tool — degrade to no-staleness. Paired with the
    // evict-on-reject in `stalenessForTool`, a transient failure also can't
    // poison the TTL cache entry (#2655 review F1).
    const staleness = await this.stalenessForTool(repo).catch(() => undefined);
    return attachToolStaleness(result, staleness);
  }

  /**
   * #2655: commits-behind freshness for the hot read tools, deduped per index.
   * Returns a shared in-flight promise so concurrent tool calls spawn at most
   * one `git rev-list` per index per TTL window; the resolved value is cached
   * for TOOL_STALENESS_TTL_MS. Keyed by lbugPath so flat and branch handles
   * (same repoPath, different lastCommit) don't share an entry. Non-blocking by
   * construction: `checkStalenessAsync` swallows git failures to
   * `{ isStale: false }`, so a git error never fails the tool — it just omits
   * the `staleness` field.
   */
  private stalenessForTool(repo: RepoHandle): Promise<StalenessInfo> {
    const now = Date.now();
    const cached = this.toolStalenessCache.get(repo.lbugPath);
    if (cached && now - cached.at < LocalBackend.TOOL_STALENESS_TTL_MS) {
      return cached.value;
    }
    // Evict the entry if the check rejects so a transient failure isn't served
    // (as a permanently-rejecting promise) for the rest of the TTL window; the
    // next call then re-runs. A resolving promise is never evicted, so happy-path
    // dedup is untouched (#2655 review F1). `Promise.resolve` wraps the call so a
    // non-thenable return can't throw at this boundary — a no-op for the real
    // async `checkStalenessAsync`, robust defense-in-depth otherwise.
    const entry: { at: number; value: Promise<StalenessInfo> } = {
      at: now,
      // Only evict if THIS entry is still current — a later call may have
      // installed a fresh (resolving) entry for the same key before a slow
      // rejection lands, and that newer entry must not be dropped.
      value: Promise.resolve(checkStalenessAsync(repo.repoPath, repo.lastCommit)).catch((err) => {
        if (this.toolStalenessCache.get(repo.lbugPath) === entry) {
          this.toolStalenessCache.delete(repo.lbugPath);
        }
        throw err;
      }),
    };
    this.toolStalenessCache.set(repo.lbugPath, entry);
    return entry.value;
  }

  async callTool(method: string, params: any): Promise<any> {
    if (method === 'list_repos') {

(Showing lines 2299-2348 of 8771. Use offset=2349 to continue.)
      // the limit/offset args that this dispatch previously discarded.
      return this.listReposPage(params);
    }

    if (method.startsWith('group_')) {
      return this.handleGroupTool(method, params || {});
    }

    const normalized = normalizeToolParams(method, params);
    if ('error' in normalized) return { error: normalized.error };
    const p = normalized.params;

    // #2175: Claude Code drops a tool-call argument named exactly "query", so the
    // query/cypher tools advertise "search_query"/"statement" while still accepting the
    // legacy "query" key for backward compat. The alias is resolved with `?? ` (new name
    // wins) at every consumer site rather than by mutating params here, so precedence is
    // uniform and there is no hidden mutation: query()/cypher() read it directly, the
    // legacy "search" alias routes through query(), and the cross-repo group-forward
    // resolves it self-contained in callToolAtGroupRepo. This is permanent compatibility
    // — third-party MCP clients may legitimately send "query", so the alias is not slated
    // for removal even if Claude Code's argument handling later changes.
    if (
      (method === 'impact' || method === 'query' || method === 'context' || method === 'trace') &&
      typeof p.repo === 'string' &&
      p.repo.startsWith('@')
    ) {
      return this.callToolAtGroupRepo(method, p);
    }

    // Resolve repo from optional param (re-reads registry on miss). An optional
    // `branch` param scopes the resolved handle to that branch's index (#2106).
    const repo = await this.resolveRepo(
      p.repo as string | undefined,
      p.branch as string | undefined,
    );

    switch (method) {
      case 'query':
        return this.withToolStaleness(repo, await this.query(repo, p));
      case 'cypher': {
        const raw = await this.cypher(repo, p);
        return this.withToolStaleness(repo, this.formatCypherAsMarkdown(raw));
      }
      case 'context':
        return this.withToolStaleness(repo, await this.context(repo, p));
      case 'explain':
        return this.explain(repo, p);
      case 'pdg_query':
        return this.pdgQuery(repo, p);
      case 'impact':
        return this.withToolStaleness(repo, await this.impact(repo, p as unknown as ImpactParams));
      case 'detect_changes':
        return this.detectChanges(repo, p);
      case 'check':
        return this.check(repo, p);
      case 'rename':
        return this.rename(repo, p as unknown as Parameters<LocalBackend['rename']>[1]);
      // Legacy aliases for backwards compatibility
      case 'search':
        return this.query(repo, p);
      case 'explore':
        return this.context(repo, {
          name: typeof p.name === 'string' ? p.name : undefined,
          ...p,
        });
      case 'overview':
        return this.overview(repo, p);
      case 'route_map':
        return this.routeMap(repo, p);
      case 'shape_check':
        return this.shapeCheck(repo, p);
      case 'tool_map':
        return this.toolMap(repo, p);
      case 'api_impact':
        return this.apiImpact(repo, p);
      case 'trace':
        return this.trace(repo, p);
      default:
        throw new Error(`Unknown tool: ${method}`);
    }
  }

  // ─── Tool Implementations ────────────────────────────────────────

  /** Check repository graph invariants that are suitable for CI gating. */
  private async check(repo: RepoHandle, params?: { cycles?: boolean }): Promise<any> {
    if (params?.cycles === false) {
      return { error: 'No checks selected. Set "cycles" to true.' };
    }
    await this.ensureInitialized(repo);
    const rowLimit = 100_001;
    // determinism: probe — overflow guard, not a window. The one-past cap is compared for exact equality below
    // and the whole result is REPLACED by an error, so a truncated page never reaches a caller.
    const rows = await executeParameterized(
      repo.lbugPath,
      // A cycle here means "these modules cannot be initialized in any order".
      // Only edges that force initialization count, so four kinds are excluded:
      // Swift implicit module visibility and markdown links (never code
      // dependencies at all); imports reachable only through `import()` or a
      // function body, which are deferred by construction — deferring is the
      // standard idiom for BREAKING an init cycle, so counting it reports the
      // fix as the bug; and imports reachable only through TypeScript
      // `import type`, which `tsc` erases outright, so no module load exists
      // to order. `imports-to-edges.ts` tags the last two with
      // DEFERRED_IMPORT_REASON_SUFFIX / TYPE_ONLY_IMPORT_REASON_SUFFIX.
      `MATCH (source:File)-[r:CodeRelation]->(target:File)
       WHERE r.type = 'IMPORTS'
         AND (r.reason IS NULL OR (
           r.reason <> 'swift-scope: implicit module visibility'
           AND r.reason <> 'markdown-link'
           AND NOT r.reason ENDS WITH '${DEFERRED_IMPORT_REASON_SUFFIX}'
           AND NOT r.reason ENDS WITH '${TYPE_ONLY_IMPORT_REASON_SUFFIX}'
         ))
       RETURN source.filePath AS source, target.filePath AS target
       LIMIT ${rowLimit}`,
      {},

(Showing lines 2347-2466 of 8771. Use offset=2467 to continue.)
      return {
        error: `Import graph exceeds the ${rowLimit - 1} edge safety limit.`,
        truncated: true,
      };
    }
    // The cycle cap is passed EXPLICITLY rather than taken as the enumerator's
    // default, because its reason lives here and not there. The enumerator's
    // work budget is a property of the algorithm — output sensitivity, retained

(Showing lines 2347-2476 of 8771. Use offset=2477 to continue.)






























































  private async query(
    repo: RepoHandle,
    params: {
      query?: string;
      search_query?: string;
      task_context?: string;
      goal?: string;
      limit?: number;
      max_symbols?: number;
      include_content?: boolean;
    },
  ): Promise<any> {
    // #2175: each consumer resolves the search_query/query alias itself (there is no
    // chokepoint mutation in callTool). This also serves the GroupService port, which
    // reaches query() carrying only the legacy `query` key.
    const rawQuery = resolveAliasString(params.search_query, params.query);
    if (!rawQuery?.trim()) {
      return { error: 'search_query (or legacy query) parameter is required and cannot be empty.' };
    }

    await this.ensureInitialized(repo);

    const processLimit = params.limit || 5;
    const maxSymbolsPerProcess = params.max_symbols || 10;
    const includeContent = params.include_content ?? false;
    const searchQuery = rawQuery.trim();

    // Per-phase timing instrumentation (#553). Records wall time for each
    // observable sub-step of the search pipeline so production latency can
    // be aggregated offline for Pareto analysis and bottleneck detection.
    // Overhead is <0.1 ms per phase; the timer is passive and never alters
    // query behaviour.
    const timer = new PhaseTimer();
    const wallStart = performance.now();

    // Step 1: Run hybrid search to get matching symbols. BM25 and vector
    // search run concurrently via Promise.all — use `timer.time()` for
    // each so both get independent wall-time records without fighting
    // over a single `current` phase slot.
    const searchLimit = processLimit * maxSymbolsPerProcess; // fetch enough raw results
    const [bm25SearchResult, semanticResults] = await Promise.all([
      timer.time('bm25', this.bm25Search(repo, searchQuery, searchLimit)),
      timer.time('vector', this.semanticSearch(repo, searchQuery, searchLimit)),
    ]);

    // Guard against undefined results (#1489) — when FTS is entirely
    // unavailable the search helper may return an unexpected shape.
    const bm25Results = bm25SearchResult?.results ?? [];
    const ftsUsed = bm25SearchResult?.ftsUsed ?? false;
    // #2767: log every non-benign per-table FTS query error server-side,
    // regardless of whether OTHER tables succeeded — previously a real error
    // on N-1 of N tables while one succeeded left zero diagnostic trail.
    const ftsQueryErrors = bm25SearchResult?.nonBenignErrors;
    if (ftsQueryErrors) {
      // tri-review NEW-5: these strings are already classified non-benign by
      // classifyFtsQueryError — do NOT route them through logQueryError,
      // whose own broader, unanchored isBenignMissingTableError regex (any
      // "does not exist" substring, anywhere) could disagree and silently
      // demote an already-flagged real error to debug, undercutting the
      // severity signal this classification exists to preserve.
      for (const err of ftsQueryErrors) {
        logger.warn({ context: 'query:fts-search', err }, 'code-analysis query failed (degraded)');
      }
    }

    // Merge via reciprocal rank fusion
    timer.start('merge');
    const scoreMap = new Map<string, { score: number; data: any }>();

    for (let i = 0; i < bm25Results.length; i++) {
      const result = bm25Results[i];
      const key = result.nodeId || result.filePath;
      const rrfScore = 1 / (60 + i);
      const existing = scoreMap.get(key);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(key, { score: rrfScore, data: result });
      }
    }

    const safeSemanticResults = semanticResults ?? [];
    for (let i = 0; i < safeSemanticResults.length; i++) {
      const result = safeSemanticResults[i];
      const key = result.nodeId || result.filePath;
      const rrfScore = 1 / (60 + i);
      const existing = scoreMap.get(key);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(key, { score: rrfScore, data: result });
      }
    }

    // Tiebreak on the key (#2787). `rrfScore` is `1 / (60 + i)` off the ARRAY
    // POSITION of each hit, so equal scores are routine, and `Array.sort` is
    // stable — ties would otherwise be resolved by Map insertion order, which
    // is DB row order. The expansion queries feeding `bm25Results` are ordered
    // now, so this is belt-and-braces; it also stops a future unordered query
    // upstream from silently reintroducing the drift at the `slice` boundary.
    const merged = Array.from(scoreMap.entries())
      .sort((a, b) => b[1].score - a[1].score || compareCodeUnits(a[0], b[0]))
      .slice(0, searchLimit);
    timer.stop(); // merge

    // Step 2: For each match with a nodeId, trace to process(es)
    timer.start('symbol_lookup');
    const processMap = new Map<
      string,
      {
        id: string;
        label: string;
        heuristicLabel: string;
        processType: string;
        stepCount: number;
        totalScore: number;
        cohesionBoost: number;
        symbols: any[];
      }
    >();
    const definitions: any[] = []; // standalone symbols not in any process

    // Batch-fetch process participation, cohesion, and (optionally) content for
    // ALL matched symbols in 2-3 graph queries instead of 2-3 *per symbol*. The
    // previous per-symbol loop issued up to 3N sequential pool round-trips
    // (searchLimit symbols × {STEP_IN_PROCESS, MEMBER_OF, content}); on a warm
    // repo the IPC + query-setup overhead of those round-trips dominated query
    // latency. Collapsing to `WHERE n.id IN $nodeIds` preserves identical output
    // (the aggregation loop below is unchanged) while cutting the round-trips.
    // Array params bind through the pool exactly as bm25Search's
    // `WHERE n.id IN $nodeIds` already does. (Ported from gitnexus-enterprise
    // PR #222 — N+1 → 2-3 batched queries.)
    const nodeIds = merged.map(([, m]) => m.data?.nodeId).filter((id): id is string => !!id);

    const processRowsByNode = new Map<string, any[]>();
    const cohesionByNode = new Map<string, { cohesion: number; module?: string }>();
    const contentByNode = new Map<string, string>();
    // Set when a batched enrichment query throws a REAL failure (timeout, lock,
    // native fault) — NOT the benign "no Process/Community table" case, which is
    // a normal config (a repo analyzed without processes/communities) and must
    // not raise a `partial` flag callers would learn to ignore. See
    // isBenignMissingTableError + the response build below.
    let enrichmentDegraded = false;

    // Chunked so a large result set never builds an unbounded `IN` parameter.
    // The default batch is processLimit*maxSymbolsPerProcess (≤ one chunk); the
    // chunking is for robustness.
    for (const ids of chunk(nodeIds, LBUG_QUERY_BATCH_SIZE)) {
      // Processes each symbol participates in. `n.id AS nodeId` is prepended as
      // column 0 so rows from many symbols can be re-associated to their symbol.
      try {
        const rows = await executeParameterized(
          repo.lbugPath,
          `
          MATCH (n)-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
          WHERE n.id IN $nodeIds
          RETURN n.id AS nodeId, p.id AS pid, p.label AS label, p.heuristicLabel AS heuristicLabel, p.processType AS processType, p.stepCount AS stepCount, r.step AS step
          ORDER BY nodeId, pid, step
        `,
          { nodeIds: ids },
        );
        for (const row of rows) {
          const nid = row.nodeId ?? row[0];
          let list = processRowsByNode.get(nid);
          if (!list) processRowsByNode.set(nid, (list = []));
          list.push(row);
        }
      } catch (e) {
        logQueryError('query:process-lookup', e);
        if (!isBenignMissingTableError(e)) enrichmentDegraded = true;
      }

      // Cluster membership + cohesion. Keep the FIRST community row per node to
      // mirror the prior per-symbol `LIMIT 1` (each symbol keeps ITS community,
      // not one community for the whole batch).
      //
      // "First" only means something once the rows are ordered (#2787): a node
      // can hold several MEMBER_OF edges, and the winner set `cohesion`, which
      // feeds cohesionBoost -> priority -> the processes `slice` below. ORDER BY
      // c.id makes the pick the lowest community id, every run.
      try {
        const rows = await executeParameterized(
          repo.lbugPath,
          `
          MATCH (n)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community)
          WHERE n.id IN $nodeIds
          RETU

[... tool result middle pruned ...]

const pType = row.processType ?? row[4];
          const stepCount = row.stepCount ?? row[5];
          const step = row.step ?? row[6];

          if (!processMap.has(pid)) {
            processMap.set(pid, {
              id: pid,
              label,
              heuristicLabel: hLabel,
              processType: pType,
              stepCount,
              totalScore: 0,
              cohesionBoost: 0,
              symbols: [],
            });
          }

          const proc = processMap.get(pid)!;
          proc.totalScore += item.score;
          proc.cohesionBoost = Math.max(proc.cohesionBoost, cohesion);
          proc.symbols.push({
            ...symbolEntry,
            process_id: pid,
            step_index: step,
          });
        }
      }
    }


(Showing lines 2661-2840 of 8771. Use offset=2841 to continue.)
        } catch (e) {
          logQueryError('query:content-fetch', e);
          if (!isBenignMissingTableError(e)) enrichmentDegraded = true;
        }
      }
    }

    // Aggregation is unchanged from the per-symbol version — it now reads the
    // pre-fetched maps instead of issuing a query per symbol. Iterating `merged`
    // in the same (sorted) order preserves processMap insertion order, the
    // definitions order, and the item.score association exactly.
    for (const [_, item] of merged) {
      const sym = item.data;
      if (!sym.nodeId) {
        // File-level results go to definitions
        definitions.push({
          name: sym.name,
          type: sym.type || 'File',
          filePath: sym.filePath,
        });
        continue;
      }

      const processRows = processRowsByNode.get(sym.nodeId) ?? [];
      const coh = cohesionByNode.get(sym.nodeId);
      const cohesion = coh?.cohesion ?? 0;
      const module = coh?.module;
      const content = includeContent ? contentByNode.get(sym.nodeId) : undefined;

      const symbolEntry = {
        id: sym.nodeId,
        name: sym.name,
        type: sym.type,
        filePath: sym.filePath,
        startLine: toDisplayLine(sym.startLine),
        endLine: toDisplayLine(sym.endLine),
        ...(module ? { module } : {}),
        ...(includeContent && content ? { content } : {}),
      };

      if (processRows.length === 0) {
        // Symbol not in any process — goes to definitions
        definitions.push(symbolEntry);
      } else {
        // Add to each process it belongs to
        for (const row of processRows) {
          // Positional fallbacks shift +1 because `n.id AS nodeId` is column 0.
          const pid = row.pid ?? row[1];
          const label = row.label ?? row[2];
          const hLabel = row.heuristicLabel ?? row[3];
          const pType = row.processType ?? row[4];
          const stepCount = row.stepCount ?? row[5];
          const step = row.step ?? row[6];

          if (!processMap.has(pid)) {
            processMap.set(pid, {
              id: pid,
              label,
              heuristicLabel: hLabel,
              processType: pType,
              stepCount,
              totalScore: 0,
              cohesionBoost: 0,
              symbols: [],
            });
          }

          const proc = processMap.get(pid)!;
          proc.totalScore += item.score;
          proc.cohesionBoost = Math.max(proc.cohesionBoost, cohesion);
          proc.symbols.push({
            ...symbolEntry,
            process_id: pid,
            step_index: step,
          });
        }
      }
    }

    timer.stop(); // symbol_lookup

    // Step 3: Rank processes by aggregate score + internal cohesion boost
    timer.start('ranking');
    const rankedProcesses = Array.from(processMap.values())
      .map((p) => ({
        ...p,
        priority: p.totalScore + p.cohesionBoost * 0.1, // cohesion as subtle ranking signal
      }))
      .sort((a, b) => b.priority - a.priority || compareCodeUnits(a.id, b.id))
      .slice(0, processLimit);
    timer.stop(); // ranking

    // Step 4: Build response
    timer.start('formatting');
    const processes = rankedProcesses.map((p) => ({
      id: p.id,
      summary: p.heuristicLabel || p.label,
      priority: Math.round(p.priority * 1000) / 1000,
      symbol_count: p.symbols.length,
      process_type: p.processType,
      step_count: p.stepCount,
    }));

    const processSymbols = rankedProcesses.flatMap((p) =>
      p.symbols.slice(0, maxSymbolsPerProcess).map((s) => ({
        ...s,
        // remove internal fields
      })),
    );

    // Deduplicate process_symbols by id
    const seen = new Set<string>();
    const dedupedSymbols = processSymbols.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    timer.stop(); // formatting

    // End-to-end wall time — deliberately a separate mark so callers can
    // compare sum(phases) vs wall to see how much Promise.all concurrency
    // saved. Must come before summary() so it's included.
    timer.mark('wall', performance.now() - wallStart);
    const timing = timer.summary();
    logQueryTiming(searchQuery, timing);

    // Compose a single `warning` from all degraded conditions (FTS-missing
    // and/or a real enrichment failure) so neither overwrites the other, and
    // flag `partial` when enrichment was lost. Both are omitted on the clean
    // path, leaving the success-path response shape byte-identical.
    const warnings: string[] = [];
    if (!ftsUsed) {
      // #2767: attach what THIS session resolved (repo/branch/indexed-at) so a
      // CLI/MCP mismatch is visible in the warning itself rather than requiring
      // a separate debugging round-trip. tri-review NEW-3: `indexedAt` reads
      // from `lastObservedPoolState` (kept current by ensureInitialized's
      // staleness check, including a same-call reinit) rather than the `repo`
      // handle resolved before that check ran — a warm backend that just
      // reopened against a newer on-disk index must not warn with stale
      // metadata. No extra I/O: the map is already maintained per-request.
      const warningContext = {
        repoName: repo.name,
        branch: repo.branch,
        indexedAt: this.lastObservedPoolState.get(repo.lbugPath)?.indexedAt ?? repo.indexedAt,
      };
      // tri-review NEW-1: every table failing for a REAL error (timeout,
      // connection reset) is not a missing-index condition — `ftsDegradedWarning`'s
      // "run --repair-fts" headline won't fix it. Route to a dedicated message
      // instead of burying the real cause as a trailing suffix on bad advice.
      warnings.push(
        ftsQueryErrors
          ? ftsQueryFailedWarning({ ...warningContext, lastErrorRedacted: ftsQueryErrors[0] })
          : ftsDegradedWarning(warningContext),
      );
    } else if (ftsQueryErrors) {
      // #2767: at least one FTS table succeeded (ftsUsed=true) but another
      // hit a real, non-benign error — results may be silently mi

[... tool result middle pruned ...]

}' — sub-phrase CJK search results ` +
            'may be incomplete. Set GITNEXUS_FTS_CJK_SEGMENTATION to the same value for both the ' +
            '`analyze` process and this server, then run `code-analysis analyze --force` to rebuild under ' +
            "the agreed mode (do not assume the live server's mode is the one to keep — re-analyzing " +
            'under the wrong mode can strip an already-working bigram-segmented index back to `none`).',
        );
      }
    } catch (err) {
      // loadMeta() itself never throws (it returns null on any read/parse
      // failure) — the actual throw source here is getSearchFTSCjkSegmentation()
      // on an invalid env value, same root cause as the catch above. This is
      // a separate, independently-guarded diagnostic though, so it gets its
      // own log context rather than sharing 'query:cjk-warning'.

(Showing lines 2840-2999 of 8771. Use offset=3000 to continue.)
        cjkMode === 'bigram' &&
        searchQuery.length > MAX_CJK_SEGMENTATION_QUERY_LENGTH &&
        containsSegmentableCjkRun(searchQuery)
      ) {
        // #2339: bigram mode is enabled, but the query exceeds the length
        // cap that guards segmentCjkSpans's per-character allocation cost —
        // applyCjkSegmentationIfEnabled silently skips segmentation above
        // this length, so an over-cap CJK query returns zero results for
        // text that IS indexed and present verbatim, with no other signal.
        warnings.push(
          `Query exceeds the ${MAX_CJK_SEGMENTATION_QUERY_LENGTH}-character CJK segmentation cap — ` +
            'sub-phrase matches are skipped for this query even though GITNEXUS_FTS_CJK_SEGMENTATION=bigram is enabled. Shorten the query to search within the cap.',
        );
      }
    } catch (err) {
      // Best-effort diagnostic only — never fail the query over it.
      logQueryError('query:cjk-warning', err);
    }
    // #2339: the checks above only compare the QUERY's own content against
    // the live process's mode — they can't detect "server mode is 'bigram'
    // but the on-disk index was actually built under 'none'/legacy" (env var
    // changed without a full --force re-analyze, or a plain/--repair-fts
    // analyze ran instead). That mismatch affects every CJK query against
    // this repo, not just one whose own text happens to contain CJK, so it's
    // a separate, unconditional check — not folded into the branches above.
    //
    // Hoisted out of the try below so the vector-width check after it reads the
    // same meta instead of paying a second read per query, and so an invalid
    // GITNEXUS_FTS_CJK_SEGMENTATION (the only thing that actually throws in
    // there) cannot take an unrelated diagnostic down with it. Needs no guard
    // of its own: loadMeta() returns null on any read/parse failure.
    const meta = await loadMeta(path.dirname(repo.lbugPath));
    try {
      // meta.json is on-disk state inside the analyzed repo, read via a
      // schema-less JSON.parse — not trusted input. Validate before
      // interpolating it into agent-visible tool output (#2339): an
      // unrecognized value is itself evidence of a corrupt/foreign index,
      // reported generically rather than echoed verbatim.
      const persistedMode = meta?.cjkSegmentation;
      if (meta && persistedMode !== undefined && !isSupportedCjkSegmentationMode(persistedMode)) {
        warnings.push(
          "This repo's index metadata has an unrecognized CJK segmentation mode stamp — the index " +
            'may be corrupt or from an incompatible code-analysis version. Run `code-analysis analyze --force` to rebuild it.',
        );
      } else if (
        meta &&
        cjkSegmentationModeMismatch(meta.cjkSegmentation, getSearchFTSCjkSegmentation())
      ) {
        warnings.push(
          `Index was built with CJK segmentation mode '${meta.cjkSegmentation ?? 'none'}', but this ` +
            `server is resolving '${getSearchFTSCjkSegmentation()}' — sub-phrase CJK search results ` +
            'may be incomplete. Set GITNEXUS_FTS_CJK_SEGMENTATION to the same value for both the ' +
            '`analyze` process and this server, then run `code-analysis analyze --force` to rebuild under ' +
            "the agreed mode (do not assume the live server's mode is the one to keep — re-analyzing " +
            'under the wrong mode can strip an already-working bigram-segmented index back to `none`).',
        );
      }
    } catch (err) {
      // loadMeta() itself never throws (it returns null on any read/parse
      // failure) — the actual throw source here is getSearchFTSCjkSegmentation()
      // on an invalid env value, same root cause as the catch above. This is
      // a separate, independently-guarded diagnostic though, so it gets its
      // own log context rather than sharing 'query:cjk-warning'.
      logQueryError('query:cjk-mode-drift', err);
    }
    // #2798: the query-side half of the vector-column width guard. `analyze`
    // compares `RepoMeta.embeddingDims` against its own live width and forces a
    // full rebuild; a SERVING process cannot rebuild anything, so it says so
    // instead. `CodeEmbedding.embedding` is `FLOAT[N]` fixed at build time, and
    // when this process embeds at a different N the vector CALL fails its CAST
    // and the exact-scan fallback scores a query vector against stored vectors
    // of another length — wrong or empty semantic hits whose only trace was a
    // once-per-process server log the agent driving this tool never sees.
    //
    // Warn, never refuse: BM25 results are still good, and the hybrid answer
    // minus its semantic lane beats no answer at all. Same shape as the CJK
    // drift check above — composed into `warnings`, recomputed per query rather
    // than latched, and carrying the fix rather than just the symptom.
    //
    // Gated on a width this call actually embedded at (see
    // `lastQueryEmbeddingDims`) so the tools that never embed — every other
    // method on this backend — and every index analyzed without `--embeddings`
    // stay quiet. ABSENT `embeddingDims` is NOT a mismatch: that is
    // `embeddingDimsMismatch`'s own rule, reused rather than restated so the
    // two sides of the guard cannot drift apart.
    const queryEmbeddingDims = this.lastQueryEmbeddingDims.get(repo.lbugPath);
    if (
      queryEmbeddingDims !== undefined &&
      meta &&
      embeddingDimsMismatch(meta.embeddingDims, queryEmbeddingDims)
    ) {
      // Only NAME a recorded width that could be one — meta.json is untrusted,
      // schema-less on-disk state, so a value that is not a positive integer is
      // reported generically rather than echoed into agent-visible output (the
      // reason the CJK stamp above is validated, and what run-analyze does with
      // the same field).
      const recordedDims: unknown = meta.embeddingDims;
      const built =
        typeof recordedDims === 'number' && Number.isInteger(recordedDims) && recordedDims > 0
          ? `FLOAT[${recordedDims}]`
          : 'an unrecognized width';
      warnings.push(
        `Index's vector column was built at ${built}, but this server embeds queries at ` +
          `FLOAT[${queryEmbeddingDims}] — semantic search results may be wrong or missing (the ` +
          'width is fixed when the index is built, and no incremental run revisits it). Re-run ' +
          '`code-analysis analyze --force` with the embedding configuration this server uses, or pin ' +
          'both sides to one width with GITNEXUS_EMBEDDING_DIMS (or `analyze --embedding-dims`). ' +
          'Keyword results are unaffected.',
      );
    }
    if (enrichmentDegraded) {
      warnings.push(
        'Symbol enrichment partially failed — some process/cohesion/content data may be missing from these results (see server logs).',
      );
    }
    // #2767: a partial FTS failure (some tables ok, one or more real errors)
    // is as much a "results may be incomplete" signal as enrichmentDegraded —
    // flag it the same way rather than only via the warning string.
    const ftsPartial = ftsUsed && !!ftsQueryErrors;

    return {
      processes,
      process_symbols: dedupedSymbols,
      definitions: definitions.slice(0, 20), // cap standalone definitions
      timing,
      ...(warnings.length > 0 && { warning: warnings.join(' ') }),
      ...((enrichmentDegraded || ftsPartial) && { partial: true }),
    };
  }

  /**
   * BM25 keyword search helper - uses LadybugDB FTS for always-fresh results
   */
  private async bm25Search(
    repo: RepoHandle,
    query: string,
    limit: number,
  ): Promise<{ results: any[]; ftsUsed: boolean; nonBenignErrors?: string[] }> {
    let searchFTSFromLbug;
    try {
      ({ searchFTSFromLbug } = await import('../../core/search/bm25-index.js'));
    } catch (err: any) {
      // Module import can fail in sandboxed MCP contexts (#1489)
      logger.warn(
        { err: err?.message },
        'GitNexus: bm25-index.js import failed — falling back to semantic-only',
      );
      return { results: [], ftsUsed: false };
    }
    let ftsResponse;
    try {
      ftsResponse = await searchFTSFromLbug(query, limit, repo.lbugPath);
    } catch (err: any) {

(Showing lines 3000-3089 of 8771. Use offset=3090 to continue.)