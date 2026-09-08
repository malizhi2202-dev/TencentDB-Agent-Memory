/**
 * VectorStore: SQLite-based vector storage using sqlite-vec extension.
 *
 * Manages two layers of vector-indexed data in a single SQLite database:
 *
 * **L1 (structured memories):**
 * 1. `l1_records` — relational metadata table (content, type, priority, scene, timestamps)
 * 2. `l1_vec` — vec0 virtual table for cosine similarity search
 *
 * **L0 (raw conversations):**
 * 3. `l0_conversations` — relational metadata table (session_key, role, message text, timestamps)
 * 4. `l0_vec` — vec0 virtual table for cosine similarity search on individual messages
 *
 * Dependencies: Node.js built-in `node:sqlite` (Node 22+) + `sqlite-vec` (from root workspace).
 *
 * Design:
 * - All operations are synchronous (DatabaseSync API).
 * - Writes use manual BEGIN/COMMIT transactions for atomicity (metadata + vector).
 * - vec0 virtual table does NOT support ON CONFLICT, so upsert = delete + insert.
 * - Thread-safe via WAL mode.
 */

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync, StatementSync, SQLInputValue } from "node:sqlite";
import type { MemoryRecord } from "../record/l1-writer.js";
import type { EmbeddingProviderInfo } from "./embedding.js";
import type {
  IMemoryStore,
  StoreCapabilities,
  L0Record,
  L1SearchResult,
  L1FtsResult,
  L0SearchResult,
  L0FtsResult,
  L0QueryRow,
  L1RecordRow,
  L1QueryFilter,
  L0CountFilter,
  L0PaginatedFilter,
  L0PaginatedResult,
  L1CountFilter,
  L1PaginatedFilter,
  L1PaginatedResult,
  IsolationFilter,
  TeamEntity,
  UserEntity,
  AgentEntity,
  TaskEntity,
  KnowledgeEntity,
  KnowledgeType,
  KnowledgeListResult,
  BatchDeleteResult,
  MemoryContentClearFilter,
  MemoryContentClearResult,
  AuditEntry,
  AuditQueryFilter,
} from "./types.js";
import { DEFAULT_ISOLATION_ID, rowMatchesIsolation } from "./types.js";
import { SKILLS_DDL, SKILL_FTS_DDL } from "../skill/skill-store-ddl.js";
import type { Logger } from "../types.js";
import type {
  MemoryPromptListFilter,
  MemoryPromptRecord,
  MemoryPromptSettingListFilter,
  MemoryPromptSettingLogFilter,
  MemoryPromptSettingLogRecord,
  MemoryPromptSettingRecord,
  MemoryPromptTargetType,
} from "../memory-prompt/types.js";
import {
  buildMemoryGenerationRefId,
  type MemoryGenerationLayer,
  type MemoryGenerationRefRecord,
} from "../memory-generation-log/types.js";

export type { L1RecordRow } from "./types.js";

// ============================
// Types
// ============================

export interface VectorSearchResult {
  record_id: string;
  content: string;
  type: string;
  priority: number;
  scene_name: string;
  /** Cosine similarity score (1.0 - cosine_distance) */
  score: number;
  timestamp_str: string;
  timestamp_start: string;
  timestamp_end: string;
  version: number;
  session_key: string;
  session_id: string;
  team_id: string;
  task_id: string;
  user_id: string;
  agent_id: string;
  /** Raw metadata JSON string (e.g., contains activity_start_time / activity_end_time for episodic) */
  metadata_json: string;
}

/** L0 single-message vector search result. */
export interface L0VectorSearchResult {
  record_id: string;
  session_key: string;
  session_id: string;
  team_id: string;
  task_id: string;
  user_id: string;
  agent_id: string;
  role: string;
  message_text: string;
  /** Cosine similarity score (1.0 - cosine_distance) */
  score: number;
  recorded_at: string;
  /** Original message timestamp (epoch ms) */
  timestamp: number;
}

export interface L0RecordRow {
  record_id: string;
  session_key: string;
  session_id: string;
  role: string;
  message_text: string;
  recorded_at: string;
  timestamp: number;
}

const TAG = "[memory-tdai][sqlite]";

/** Persisted metadata about the embedding provider used to generate stored vectors. */
interface EmbeddingMeta {
  provider: string;
  model: string;
  dimensions: number;
}

/** Result of VectorStore.init() — indicates whether a re-embed is needed. */
export interface VectorStoreInitResult {
  /**
   * `true` if the embedding provider/model/dimensions changed since
   * the vectors were last written.  Callers should re-embed all texts
   * (via `reindexAll()`) after receiving this flag.
   */
  needsReindex: boolean;
  /** Human-readable reason (for logging). */
  reason?: string;
}

// Use createRequire to load the experimental node:sqlite module
const require = createRequire(import.meta.url);

function requireNodeSqlite(): typeof import("node:sqlite") {
  return require("node:sqlite") as typeof import("node:sqlite");
}

// ============================
// FTS5 helpers (adapted from openclaw core hybrid.ts)
// ============================

// ── Chinese word segmentation (jieba) ──
// Lazy-loaded singleton: initialised on first call to `buildFtsQuery`.
// If @node-rs/jieba is unavailable, falls back to Unicode-regex splitting.

interface JiebaInstance {
  cutForSearch(text: string, hmm: boolean): string[];
}

let _jieba: JiebaInstance | null | undefined; // undefined = not yet tried

function getJieba(): JiebaInstance | null {
  if (_jieba !== undefined) return _jieba;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Jieba } = require("@node-rs/jieba");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dict } = require("@node-rs/jieba/dict");
    _jieba = Jieba.withDict(dict) as JiebaInstance;
  } catch {
    _jieba = null; // mark as unavailable — won't retry
  }
  return _jieba;
}

/**
 * Common Chinese stop-words that add noise to FTS5 queries.
 * Kept small on purpose — only high-frequency function words.
 */
const ZH_STOP_WORDS = new Set([
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
  "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
  "没有", "看", "好", "自己", "这", "他", "她", "它", "们", "那",
  "吗", "吧", "呢", "啊", "呀", "哦", "嗯",
]);

/**
 * Build an FTS5 MATCH query from raw text.
 *
 * When `@node-rs/jieba` is available, uses jieba's search-engine mode
 * (`cutForSearch`) for accurate Chinese word segmentation, producing
 * much better recall than the previous regex-only approach.
 *
 * Falls back to Unicode-regex splitting (`/[\p{L}\p{N}_]+/gu`) if
 * jieba is not installed.
 *
 * Tokens are OR-joined as quoted FTS5 phrase terms so that a document
 * matching *any* token is returned.  BM25 naturally ranks documents that
 * match more tokens higher, so precision is preserved while recall is
 * significantly improved — especially for longer queries and when running
 * in FTS-only fallback mode (no embedding available).
 *
 * Example (with jieba):
 *   "用户喜欢编程和TypeScript" → '"用户" OR "喜欢" OR "编程" OR "TypeScript"'
 * Example (fallback):
 *   "旅行计划 API" → '"旅行计划" OR "API"'
 */
export function buildFtsQuery(raw: string): string | null {
  const jieba = getJieba();

  let tokens: string[];
  if (jieba) {
    // jieba cutForSearch: splits long words further for better recall
    // e.g. "北京烤鸭" → ["北京", "烤鸭", "北京烤鸭"]
    tokens = jieba
      .cutForSearch(raw, true)
      .map((t) => t.trim())
      .filter((t) => {
        if (!t) return false;
        // Remove pure whitespace / punctuation tokens
        if (!/[\p{L}\p{N}]/u.test(t)) return false;
        // Remove common Chinese stop-words to reduce noise
        if (ZH_STOP_WORDS.has(t)) return false;
        return true;
      });
    // Deduplicate (cutForSearch may produce duplicates for sub-words)
    tokens = [...new Set(tokens)];
  } else {
    // Fallback: simple Unicode regex split
    tokens =
      raw
        .match(/[\p{L}\p{N}_]+/gu)
        ?.map((t) => t.trim())
        .filter(Boolean) ?? [];
  }

  if (tokens.length === 0) return null;
  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`);
  return quoted.join(" OR ");
}

/**
 * Tokenize text for FTS5 indexing (write-side).
 *
 * Uses jieba `cutForSearch()` (search-engine mode) to segment Chinese text,
 * then joins tokens with spaces. The resulting string is stored in the FTS5
 * `content` column so that `unicode61` tokenizer can split it into meaningful
 * words — including both full words and their sub-words.
 *
 * Using `cutForSearch` (instead of `cut`) ensures that the index contains
 * the same sub-word tokens that `buildFtsQuery()` produces on the query side.
 * For example, "人工智能" is indexed as "人工 智能 人工智能", so queries for
 * either the full term or sub-words will match.
 *
 * Falls back to the original text if jieba is unavailable.
 *
 * Example (with jieba):
 *   "用户五月去日本旅行" → "用户 五月 去 日本 旅行"
 *   "人工智能的分支"     → "人工 智能 人工智能 的 分支"
 * Example (fallback):
 *   "用户五月去日本旅行" → "用户五月去日本旅行" (unchanged)
 */
export function tokenizeForFts(raw: string): string {
  const jieba = getJieba();
  if (!jieba) return raw;

  // Use `cutForSearch` (search-engine mode) for indexing — it produces both
  // full words AND their sub-word components. This ensures that query-side
  // tokens (also produced by `cutForSearch` in `buildFtsQuery`) will always
  // find a match in the index.
  const tokens = jieba.cutForSearch(raw, true);

  // Join with spaces so `unicode61` tokenizer can split them.
  // Punctuation tokens are kept — unicode61 treats them as separators anyway.
  return tokens.join(" ");
}

/**
 * Reset jieba state so next call to `buildFtsQuery` re-initialises.
 * Exported for testing only.
 * @internal
 */
export function _resetJiebaForTest(): void {
  _jieba = undefined;
}

/**
 * Override jieba instance (or set to `null` to force fallback).
 * Exported for testing only.
 * @internal
 */
export function _setJiebaForTest(instance: JiebaInstance | null): void {
  _jieba = instance;
}

/**
 * Convert a BM25 rank (negative = more relevant) to a 0–1 score.
 * Mirrors the formula in openclaw core `hybrid.ts`.
 */
export function bm25RankToScore(rank: number): number {
  if (!Number.isFinite(rank)) return 1 / (1 + 999);
  if (rank < 0) {
    const relevance = -rank;
    return relevance / (1 + relevance);
  }
  return 1 / (1 + rank);
}

/** FTS5 search result for L1 records. */
export interface FtsSearchResult {
  record_id: string;
  content: string;
  type: string;
  priority: number;
  scene_name: string;
  /** BM25-derived score (0–1, higher is better) */
  score: number;
  timestamp_str: string;
  timestamp_start: string;
  timestamp_end: string;
  version: number;
  session_key: string;
  session_id: string;
  team_id: string;
  task_id: string;
  user_id: string;
  agent_id: string;
  metadata_json: string;
}

/** FTS5 search result for L0 records. */
export interface L0FtsSearchResult {
  record_id: string;
  session_key: string;
  session_id: string;
  team_id: string;
  task_id: string;
  user_id: string;
  agent_id: string;
  role: string;
  message_text: string;
  /** BM25-derived score (0–1, higher is better) */
  score: number;
  recorded_at: string;
  timestamp: number;
}

// ============================
// VectorStore class
// ============================

export class VectorStore implements IMemoryStore {
  private db: DatabaseSync;
  private readonly dimensions: number;
  private readonly logger?: Logger;

  /** @see IMemoryStore.supportsDeferredEmbedding */
  readonly supportsDeferredEmbedding = true;

  /**
   * When `true`, the store is in a degraded state (e.g. sqlite-vec failed to
   * load, or init() encountered an unrecoverable error).  All public methods
   * become safe no-ops so the plugin never blocks the main OpenClaw flow.
   */
  private degraded = false;

  /** Tracks whether close() has been called to prevent double-close errors. */
  private closed = false;

  /**
   * `true` when vec0 virtual tables (l1_vec / l0_vec) have been created and
   * their prepared statements are ready.  When `dimensions === 0` (i.e.
   * provider="none"), vec0 tables are deferred and this stays `false`.
   */
  private vecTablesReady = false;

  // Prepared statements — L1 (initialized in init())
  private stmtUpsertMeta!: StatementSync;
  private stmtDeleteVec?: StatementSync;   // optional — only set when vecTablesReady
  private stmtInsertVec?: StatementSync;   // optional — only set when vecTablesReady
  private stmtDeleteMeta!: StatementSync;
  private stmtGetMeta!: StatementSync;
  private stmtSearchVec?: StatementSync;   // optional — only set when vecTablesReady
  private stmtQueryBySessionId!: StatementSync;
  private stmtQueryBySessionIdSince!: StatementSync;
  private stmtQueryBySessionKey!: StatementSync;
  private stmtQueryBySessionKeySince!: StatementSync;
  private stmtQueryAll!: StatementSync;
  private stmtQueryAllSince!: StatementSync;

  // Prepared statements — L0 (initialized in init())
  private stmtL0UpsertMeta!: StatementSync;
  private stmtL0DeleteVec?: StatementSync;   // optional — only set when vecTablesReady
  private stmtL0InsertVec?: StatementSync;   // optional — only set when vecTablesReady
  private stmtL0DeleteMeta!: StatementSync;
  private stmtL0GetMeta!: StatementSync;
  private stmtL0SearchVec?: StatementSync;   // optional — only set when vecTablesReady
  /** L0 query for L1 runner: all messages for a session key */
  private stmtL0QueryAll!: StatementSync;
  /** L0 query for L1 runner: messages after a timestamp cursor */
  private stmtL0QueryAfter!: StatementSync;
  /** L1 cursor-based pagination for migration (by PK) */
  private stmtL1QueryMigrationCursor!: StatementSync;
  /** L0 cursor-based pagination for migration (by PK) */
  private stmtL0QueryMigrationCursor!: StatementSync;

  // FTS5 tables availability flag (created best-effort — may be false if fts5 is not compiled in)
  private ftsAvailable = false;

  // Prepared statements — FTS5 L1 (initialized in init())
  private stmtL1FtsInsert!: StatementSync;
  private stmtL1FtsDelete!: StatementSync;
  private stmtL1FtsSearch!: StatementSync;

  // Prepared statements — FTS5 L0 (initialized in init())
  private stmtL0FtsInsert!: StatementSync;
  private stmtL0FtsDelete!: StatementSync;
  private stmtL0FtsSearch!: StatementSync;

  /**
   * Create a VectorStore instance.
   *
   * Note: After construction, you MUST call `init()` to load the sqlite-vec
   * extension and create the schema.
   */
  constructor(dbPath: string, dimensions: number, logger?: Logger) {
    this.dimensions = dimensions;
    this.logger = logger;

    // Ensure parent directory exists (for non-default instance paths)
    const dbDir = path.dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Open database with extension support enabled
    const { DatabaseSync: DbSync } = requireNodeSqlite();
    this.db = new DbSync(dbPath, { allowExtension: true });

    // Set busy timeout so concurrent processes retry instead of failing with SQLITE_BUSY
    this.db.exec("PRAGMA busy_timeout = 5000");

    // Enable WAL mode for better concurrent read performance
    this.db.exec("PRAGMA journal_mode = WAL");

    // Cap page cache at 64 MB
    this.db.exec("PRAGMA cache_size = -65536");

    // Cap memory-mapped I/O at 128 MB to bound RSS growth
    this.db.exec("PRAGMA mmap_size = 134217728");

    // Auto-checkpoint WAL every 1000 pages (~4 MB) to keep WAL file compact
    this.db.exec("PRAGMA wal_autocheckpoint = 1000");
  }

  /**
   * Expose the underlying `DatabaseSync` handle for tightly-coupled co-tenants
   * that need to live in the SAME SQLite connection (skill_meta / skill_fts /
   * skill_vec live alongside l1_records — see SKILL_ENGINEERING_DESIGN §13.3).
   *
   * Intentional escape hatch: do NOT use this for unrelated stores. Sharing
   * the connection is what gives us one sqlite-vec load + one WAL session +
   * cross-table transactions; opening a second connection on `vectors.db`
   * would defeat all three.
   */
  getRawDb(): DatabaseSync {
    return this.db;
  }

  /** Embedding dimension this store was opened with (0 when provider="none"). */
  getEmbeddingDimensions(): number {
    return this.dimensions;
  }

  /**
   * Whether the store is in degraded mode (e.g. sqlite-vec failed to load).
   * When degraded, all write/search operations become safe no-ops.
   */
  isDegraded(): boolean {
    return this.degraded;
  }


  /**
   * Load sqlite-vec extension and initialize database schema.
   * Must be called once after construction.
   *
   * @param providerInfo  Current embedding provider info. When provided,
   *   the store compares it against the persisted metadata. If the provider,
   *   model, or dimensions changed, the vector tables are dropped and
   *   re-created with the new dimensions, and `needsReindex: true` is returned
   *   so the caller can schedule a full re-embed.
   */
  init(providerInfo?: EmbeddingProviderInfo): VectorStoreInitResult {
    // Load sqlite-vec extension only when vector tables are needed.
    // dimensions=0 is a supported metadata/FTS-only mode and must not degrade
    // just because sqlite-vec is unavailable in the local test/runtime build.
    if (this.dimensions > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqliteVec = require("sqlite-vec");
        this.db.enableLoadExtension(true);
        sqliteVec.load(this.db);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger?.error(
          `${TAG} Failed to load sqlite-vec extension: ${message}. ` +
          `VectorStore entering degraded mode — all operations will be no-ops.`,
        );
        this.degraded = true;
        return { needsReindex: false, reason: `sqlite-vec load failed: ${message}` };
      }
    }

    // ── Schema creation & prepared statements ──────────────────────────────
    // Wrapped in try-catch: if anything fails during schema init (e.g. the DB
    // is corrupted, disk full, etc.), we degrade gracefully instead of crashing.
    try {
      return this.initSchema(providerInfo);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error(
        `${TAG} Schema initialization failed: ${message}. ` +
        `VectorStore entering degraded mode.`,
      );
      this.degraded = true;
      return { needsReindex: false, reason: `schema init failed: ${message}` };
    }
  }

  /**
   * Internal schema initialization — separated from init() so we can
   * catch errors at the top level and degrade gracefully.
   */
  private initSchema(providerInfo?: EmbeddingProviderInfo): VectorStoreInitResult {
    // Tracks which provider/model/dimensions were used to generate vectors.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Detect whether re-index is needed
    let needsReindex = false;
    let reindexReason: string | undefined;

    const savedMeta = this.readEmbeddingMeta();

    if (providerInfo) {
      if (savedMeta) {
        const providerChanged = savedMeta.provider !== providerInfo.provider;
        const modelChanged = savedMeta.model !== providerInfo.model;
        const dimsChanged = savedMeta.dimensions !== this.dimensions;

        if (providerChanged || modelChanged || dimsChanged) {
          const reasons: string[] = [];
          if (providerChanged) reasons.push(`provider: ${savedMeta.provider} → ${providerInfo.provider}`);
          if (modelChanged) reasons.push(`model: ${savedMeta.model} → ${providerInfo.model}`);
          if (dimsChanged) reasons.push(`dimensions: ${savedMeta.dimensions} → ${this.dimensions}`);
          reindexReason = reasons.join(", ");

          this.logger?.info(
            `${TAG} Embedding config changed (${reindexReason}). ` +
            `Dropping vector tables for rebuild...`,
          );

          // Drop and re-create vector tables with new dimensions
          this.dropVectorTables();
          needsReindex = true;
        }
      } else {
        // No saved meta — first run or legacy DB without meta table.
        // Two cases require dropping vector tables:
        // 1. Existing data created without meta tracking (legacy DB) — need re-embed
        // 2. vec0 tables exist with wrong dimensions (e.g. previously created with
        //    provider="none" placeholder 768D, now switching to a real provider
        //    with different dimensions) — must rebuild even if data tables are empty
        const l1Count = this.tableRowCount("l1_records");
        const l0Count = this.tableRowCount("l0_conversations");
        const existingVecDims = this.getVecTableDimensions();

        if (l1Count > 0 || l0Count > 0) {
          this.logger?.info(
            `${TAG} No embedding_meta found but existing data exists ` +
            `(L1=${l1Count}, L0=${l0Count}). Dropping vector tables for safety...`,
          );
          this.dropVectorTables();
          needsReindex = true;
          reindexReason = "legacy DB without embedding_meta — cannot verify vector compatibility";
        } else if (existingVecDims !== null && existingVecDims !== this.dimensions) {
          // vec0 tables exist (from a previous provider="none" placeholder or
          // different config) but with mismatched dimensions.  Drop them so they
          // get re-created with the correct dimensions below.
          this.logger?.info(
            `${TAG} vec0 table dimension mismatch (existing=${existingVecDims}, ` +
            `required=${this.dimensions}). Dropping vector tables for rebuild...`,
          );
          this.dropVectorTables();
          // No needsReindex — there's no data to re-embed
        }
      }
    }

    // ── L1 schema ──────────────────────────────────

    // Metadata table
    // NOTE: user_id / agent_id added for three-dim tenancy isolation
    //       (see docs/l0l3-tenant-isolation-design.md).
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS l1_records (
        record_id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT DEFAULT '',
        priority INTEGER DEFAULT 50,
        scene_name TEXT DEFAULT '',
        session_key TEXT DEFAULT '',
        session_id TEXT DEFAULT 'default',
        team_id TEXT DEFAULT 'default',
        task_id TEXT DEFAULT '',
        user_id TEXT NOT NULL DEFAULT 'default',
        agent_id TEXT NOT NULL DEFAULT 'default',
        version INTEGER NOT NULL DEFAULT 0,
        timestamp_str TEXT DEFAULT '',
        timestamp_start TEXT DEFAULT '',
        timestamp_end TEXT DEFAULT '',
        created_time TEXT DEFAULT '',
        updated_time TEXT DEFAULT '',
        metadata_json TEXT DEFAULT '{}'
      )
    `);

    // Online migration: pre-isolation DBs lack user_id/agent_id columns. ALTER ADD is
    // idempotent-safe: a try/catch around each statement is the SQLite-3 standard idiom.
    try { this.db.exec("ALTER TABLE l1_records ADD COLUMN team_id TEXT DEFAULT 'default'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l1_records ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l1_records ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'default'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l1_records ADD COLUMN task_id TEXT DEFAULT ''"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l1_records ADD COLUMN version INTEGER NOT NULL DEFAULT 0"); } catch { /* exists */ }
    this.db.prepare("UPDATE l1_records SET team_id = ? WHERE team_id = '' OR team_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.prepare("UPDATE l1_records SET user_id = ? WHERE user_id = '' OR user_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.prepare("UPDATE l1_records SET agent_id = ? WHERE agent_id = '' OR agent_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.prepare("UPDATE l1_records SET session_id = ? WHERE session_id = '' OR session_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.exec("UPDATE l1_records SET version = 0 WHERE version IS NULL OR version < 0");

    // Indexes for common queries
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_type ON l1_records(type)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_session_key ON l1_records(session_key)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_session_id ON l1_records(session_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_scene ON l1_records(scene_name)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_ts_start ON l1_records(timestamp_start)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_ts_end ON l1_records(timestamp_end)");
    // Composite index: session_id exact match + updated_time range scan (for incremental L2 queries)
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_session_updated ON l1_records(session_id, updated_time)");
    // Composite index: session_key exact match + updated_time range scan (for pipeline cursor queries)
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_sessionkey_updated ON l1_records(session_key, updated_time)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_task_updated ON l1_records(task_id, updated_time)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_team_agent_updated ON l1_records(team_id, agent_id, updated_time)");
    // Isolation indexes (three-dim tenancy)
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_user_agent_session ON l1_records(user_id, agent_id, session_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_user_updated  ON l1_records(user_id, updated_time)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l1_agent_updated ON l1_records(agent_id, updated_time)");

    // Vector virtual table (cosine distance) — only created when dimensions > 0.
    // When provider="none", dimensions=0 and vec0 tables are deferred until a
    // real embedding provider is configured.
    if (this.dimensions > 0) {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS l1_vec USING vec0(
          record_id TEXT PRIMARY KEY,
          embedding float[${this.dimensions}] distance_metric=cosine,
          updated_time TEXT DEFAULT ''
        )
      `);
    }

    // Prepare statements for reuse
    // NOTE: user_id / agent_id appended at the end of the column list so that
    // existing positional bindings in this file remain in the same relative
    // order; new bindings always come last. See upsertL1() for the call-site.
    this.stmtUpsertMeta = this.db.prepare(`
      INSERT INTO l1_records (
        record_id, content, type, priority, scene_name, session_key, session_id,
        team_id, task_id, version, timestamp_str, timestamp_start, timestamp_end,
        created_time, updated_time, metadata_json,
        user_id, agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id) DO UPDATE SET
        content=excluded.content,
        type=excluded.type,
        priority=excluded.priority,
        scene_name=excluded.scene_name,
        team_id=excluded.team_id,
        task_id=excluded.task_id,
        version=excluded.version,
        timestamp_str=excluded.timestamp_str,
        timestamp_start=excluded.timestamp_start,
        timestamp_end=excluded.timestamp_end,
        updated_time=excluded.updated_time,
        metadata_json=excluded.metadata_json,
        user_id=excluded.user_id,
        agent_id=excluded.agent_id
    `);

    if (this.dimensions > 0) {
      this.stmtDeleteVec = this.db.prepare("DELETE FROM l1_vec WHERE record_id = ?");
      this.stmtInsertVec = this.db.prepare("INSERT INTO l1_vec (record_id, embedding, updated_time) VALUES (?, ?, ?)");
    }
    this.stmtDeleteMeta = this.db.prepare("DELETE FROM l1_records WHERE record_id = ?");

    this.stmtGetMeta = this.db.prepare(`
      SELECT content, type, priority, scene_name, session_key, session_id, team_id, task_id, user_id, agent_id,
             version, timestamp_str, timestamp_start, timestamp_end, metadata_json
      FROM l1_records WHERE record_id = ?
    `);

    if (this.dimensions > 0) {
      this.stmtSearchVec = this.db.prepare(`
        SELECT record_id, distance
        FROM l1_vec
        WHERE embedding MATCH ?
          AND k = ?
        ORDER BY distance
      `);
    }

    // ── L0 schema ──────────────────────────────────

    // L0 metadata table: stores individual messages for vector search.
    // NOTE: user_id / agent_id added for three-dim tenancy isolation
    //       (see docs/l0l3-tenant-isolation-design.md).
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS l0_conversations (
        record_id TEXT PRIMARY KEY,
        session_key TEXT NOT NULL,
        session_id TEXT DEFAULT 'default',
        team_id TEXT DEFAULT 'default',
        task_id TEXT DEFAULT '',
        user_id TEXT NOT NULL DEFAULT 'default',
        agent_id TEXT NOT NULL DEFAULT 'default',
        role TEXT NOT NULL DEFAULT '',
        message_text TEXT NOT NULL,
        recorded_at TEXT DEFAULT '',
        timestamp INTEGER DEFAULT 0
      )
    `);

    // Online migrations: each ADD COLUMN is wrapped in try/catch so re-running
    // init() on an already-migrated DB is a no-op.
    try {
      this.db.exec("ALTER TABLE l0_conversations ADD COLUMN timestamp INTEGER DEFAULT 0");
      this.logger?.debug?.(`${TAG} Migrated l0_conversations: added timestamp column`);
    } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l0_conversations ADD COLUMN team_id TEXT DEFAULT 'default'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l0_conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l0_conversations ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'default'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE l0_conversations ADD COLUMN task_id TEXT DEFAULT ''"); } catch { /* exists */ }
    this.db.prepare("UPDATE l0_conversations SET team_id = ? WHERE team_id = '' OR team_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.prepare("UPDATE l0_conversations SET user_id = ? WHERE user_id = '' OR user_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.prepare("UPDATE l0_conversations SET agent_id = ? WHERE agent_id = '' OR agent_id IS NULL").run(DEFAULT_ISOLATION_ID);
    this.db.prepare("UPDATE l0_conversations SET session_id = ? WHERE session_id = '' OR session_id IS NULL").run(DEFAULT_ISOLATION_ID);

    // Skill schema belongs to the same vectors.db. Initialize its base tables
    // with the SQLite store so a freshly installed in-process OpenClaw plugin
    // has a complete database even when SkillCore is not otherwise activated.
    // SkillCore may call the same idempotent DDL later and initialize skill_vec.
    try {
      this.db.exec(SKILLS_DDL);
      this.db.exec(SKILL_FTS_DDL);
    } catch (err) {
      this.logger?.warn(
        `${TAG} Skill base schema init failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Indexes for L0 queries
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_session ON l0_conversations(session_key)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_session_id ON l0_conversations(session_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_task ON l0_conversations(task_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_team_agent ON l0_conversations(team_id, agent_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_recorded ON l0_conversations(recorded_at)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_timestamp ON l0_conversations(timestamp)");
    // Isolation indexes (three-dim tenancy)
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_user_agent_session ON l0_conversations(user_id, agent_id, session_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_user_recorded  ON l0_conversations(user_id, recorded_at)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_l0_agent_recorded ON l0_conversations(agent_id, recorded_at)");

    // L0 vector virtual table (cosine distance, same dimensions as L1) — deferred when dimensions=0
    if (this.dimensions > 0) {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS l0_vec USING vec0(
          record_id TEXT PRIMARY KEY,
          embedding float[${this.dimensions}] distance_metric=cosine,
          recorded_at TEXT DEFAULT ''
        )
      `);
    }

    // L0 prepared statements
    // user_id / agent_id appended at the end of the bind list (see upsertL0()).
    this.stmtL0UpsertMeta = this.db.prepare(`
      INSERT INTO l0_conversations (
        record_id, session_key, session_id, team_id, task_id, role, message_text, recorded_at, timestamp,
        user_id, agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id) DO UPDATE SET
        message_text=excluded.message_text,
        recorded_at=excluded.recorded_at,
        timestamp=excluded.timestamp,
        team_id=excluded.team_id,
        task_id=excluded.task_id,
        user_id=excluded.user_id,
        agent_id=excluded.agent_id
    `);

    if (this.dimensions > 0) {
      this.stmtL0DeleteVec = this.db.prepare("DELETE FROM l0_vec WHERE record_id = ?");
      this.stmtL0InsertVec = this.db.prepare("INSERT INTO l0_vec (record_id, embedding, recorded_at) VALUES (?, ?, ?)");
    }
    this.stmtL0DeleteMeta = this.db.prepare("DELETE FROM l0_conversations WHERE record_id = ?");

    this.stmtL0GetMeta = this.db.prepare(`
      SELECT session_key, session_id, team_id, task_id, user_id, agent_id, role, message_text, recorded_at, timestamp
      FROM l0_conversations WHERE record_id = ?
    `);

    if (this.dimensions > 0) {
      this.stmtL0SearchVec = this.db.prepare(`
        SELECT record_id, distance
        FROM l0_vec
        WHERE embedding MATCH ?
          AND k = ?
        ORDER BY distance
      `);
    }

    // L0 query statements for L1 runner (oldest-first + LIMIT to bound memory).
    //
    // Why ASC: the L1 runner advances `last_l1_cursor` to max(recorded_at) of
    // the batch it just consumed. If we returned newest-first under a backlog,
    // the cursor would jump to the latest record and silently skip the older
    // ones. Returning the oldest `LIMIT` rows above the cursor is the only way
    // to guarantee progress without data loss when there is a backlog.
    //
    // Sort/filter by recorded_at (write time) instead of timestamp (conversation
    // time) because L1 cursor uses recorded_at semantics. ISO 8601 string
    // comparison preserves time order.
    this.stmtL0QueryAll = this.db.prepare(`
      SELECT record_id, session_key, session_id, team_id, task_id, user_id, agent_id, role, message_text, recorded_at, timestamp
      FROM l0_conversations
      WHERE session_key = ?
      ORDER BY recorded_at ASC
      LIMIT ?
    `);

    this.stmtL0QueryAfter = this.db.prepare(`
      SELECT record_id, session_key, session_id, team_id, task_id, user_id, agent_id, role, message_text, recorded_at, timestamp
      FROM l0_conversations
      WHERE session_key = ? AND recorded_at > ?
      ORDER BY recorded_at ASC
      LIMIT ?
    `);

    this.stmtL0QueryMigrationCursor = this.db.prepare(`
      SELECT record_id, session_key, session_id, role, message_text, recorded_at, timestamp
      FROM l0_conversations
      WHERE record_id > ?
      ORDER BY record_id ASC
      LIMIT ?
    `);

    // ── Entity metadata tables (Team / User / Agent / Task) ───────────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_teams (
        team_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        owner_user_id TEXT NOT NULL,
        user_ids_json TEXT NOT NULL DEFAULT '[]',
        agent_ids_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_users (
        user_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        job_description TEXT DEFAULT '',
        team_ids_json TEXT NOT NULL DEFAULT '[]',
        task_ids_json TEXT NOT NULL DEFAULT '[]',
        owned_agent_ids_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_agents (
        agent_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        prompt TEXT DEFAULT '',
        owner_user_id TEXT DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'team',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_tasks (
        task_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        creator_user_id TEXT NOT NULL,
        title TEXT DEFAULT '',
        description TEXT DEFAULT '',
        source_type TEXT NOT NULL DEFAULT 'manual',
        source_url TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        auto_assign_floating_assets INTEGER NOT NULL DEFAULT 0,
        risk_level TEXT NOT NULL DEFAULT 'low',
        agent_ids_json TEXT NOT NULL DEFAULT '[]',
        user_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_knowledge (
        knowledge_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        service_url TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT,
        team_id TEXT NOT NULL,
        agent_id TEXT NOT NULL DEFAULT '',
        user_id TEXT,
        repo_url TEXT,
        branch TEXT,
        project_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    // 在线迁移：老库补 agent_id 列（预留 binding 维度，绑定权威在 meta_assets）
    try { this.db.exec("ALTER TABLE entity_knowledge ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE entity_knowledge ADD COLUMN project_id TEXT"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE entity_teams ADD COLUMN user_ids_json TEXT NOT NULL DEFAULT '[]'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE entity_teams ADD COLUMN agent_ids_json TEXT NOT NULL DEFAULT '[]'"); } catch { /* exists */ }
    try { this.db.exec("ALTER TABLE entity_tasks ADD COLUMN user_ids_json TEXT NOT NULL DEFAULT '[]'"); } catch { /* exists */ }
    this.db.exec("DROP INDEX IF EXISTS idx_entity_teams_name");
    this.db.exec("DROP INDEX IF EXISTS idx_entity_agents_team_name");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_teams_name ON entity_teams(name)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_users_status ON entity_users(status)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_agents_team_name ON entity_agents(team_id, name)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_agents_team_status ON entity_agents(team_id, status)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_tasks_team_status ON entity_tasks(team_id, status)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_knowledge_team ON entity_knowledge(team_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_entity_knowledge_team_type ON entity_knowledge(team_id, type)");

    // ── Memory Audit (修改审计) ──
    // 设计要点（per user 决策）：
    //   - 原始 L0/L1/L2/L3 表完全不动，本表只追加事件
    //   - 不存历史 content / 旧值，只记"什么时间、由谁、改了哪条"
    //   - team/agent/user/task 来自外部请求 IdFields（不是 record 原值）
    //   - L0 不参与（不可变流水）；L1/L2/L3 update + delete 各记一条
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_audit (
        audit_id      TEXT PRIMARY KEY,
        record_id     TEXT NOT NULL,
        layer         TEXT NOT NULL CHECK (layer IN ('L1','L2','L3')),
        action        TEXT NOT NULL CHECK (action IN ('update','delete')),
        team_id       TEXT,
        agent_id      TEXT,
        user_id       TEXT,
        task_id       TEXT,
        version       INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        request_id    TEXT
      )
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_memory_audit_record    ON memory_audit(record_id, updated_at_ms)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_memory_audit_isolation ON memory_audit(team_id, agent_id, user_id, task_id)");

    // ── Custom Memory Prompt ──
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_prompts (
        memory_prompt_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layer TEXT NOT NULL CHECK (layer IN ('l1','l2','l3')),
        prompt TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','deleting')),
        created_by TEXT,
        updated_by TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_prompts_layer_updated
        ON memory_prompts(layer, updated_at_ms);
      CREATE INDEX IF NOT EXISTS idx_memory_prompts_status
        ON memory_prompts(status);

      CREATE TABLE IF NOT EXISTS memory_prompt_settings (
        setting_id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL CHECK (target_type IN ('instance','team','agent')),
        team_id TEXT,
        agent_id TEXT,
        layer TEXT NOT NULL CHECK (layer IN ('l1','l2','l3')),
        memory_prompt_id TEXT NOT NULL,
        updated_by TEXT,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_prompt_settings_prompt
        ON memory_prompt_settings(memory_prompt_id);
      CREATE INDEX IF NOT EXISTS idx_memory_prompt_settings_target
        ON memory_prompt_settings(team_id, agent_id, layer);

      CREATE TABLE IF NOT EXISTS memory_prompt_setting_logs (
        setting_log_id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL CHECK (target_type IN ('instance','team','agent')),
        team_id TEXT,
        agent_id TEXT,
        layer TEXT NOT NULL CHECK (layer IN ('l1','l2','l3')),
        action TEXT NOT NULL CHECK (action IN ('apply','replace','clear')),
        reason TEXT NOT NULL CHECK (reason IN ('explicit','prompt_deleted')),
        before_memory_prompt_id TEXT,
        after_memory_prompt_id TEXT,
        operator_id TEXT,
        operated_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_prompt_logs_prompt_before
        ON memory_prompt_setting_logs(before_memory_prompt_id, operated_at_ms);
      CREATE INDEX IF NOT EXISTS idx_memory_prompt_logs_prompt_after
        ON memory_prompt_setting_logs(after_memory_prompt_id, operated_at_ms);
      CREATE INDEX IF NOT EXISTS idx_memory_prompt_logs_target
        ON memory_prompt_setting_logs(team_id, agent_id, operated_at_ms);

      CREATE TABLE IF NOT EXISTS memory_generation_refs (
        generation_ref_id TEXT PRIMARY KEY,
        layer TEXT NOT NULL CHECK (layer IN ('l1','l2','l3')),
        memory_id TEXT NOT NULL,
        generation_id TEXT NOT NULL,
        generation_log_id TEXT NOT NULL,
        generation_log_key TEXT NOT NULL,
        memory_prompt_id TEXT NOT NULL,
        memory_prompt_version INTEGER NOT NULL,
        memory_prompt_source TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_generation_refs_memory
        ON memory_generation_refs(layer, memory_id);
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_memory_audit_time      ON memory_audit(updated_at_ms)");

    // ── FTS5 tables (best-effort — gracefully degrade if fts5 is not compiled in) ──
    // Schema v2: `content` column stores jieba-segmented text (for indexing),
    // `content_original` (UNINDEXED) stores the raw text (for display).
    // If old v1 tables exist (no content_original column), drop + recreate.
    try {
      // ── Migrate old FTS5 tables (v1 → v2) ──
      // v1 tables stored raw text in the `content` column. v2 stores segmented
      // text in `content` and raw text in `content_original` / `message_text_original`.
      // FTS5 virtual tables don't support ALTER TABLE ADD COLUMN, so we must
      // drop and recreate. The data will be repopulated by `rebuildFtsIndex()`.
      const needsFtsRebuild = this.migrateFtsTablesIfNeeded();

      // L1 FTS5 virtual table (v2 schema + isolation columns).
      // user_id / agent_id added as UNINDEXED so they're carried alongside
      // every FTS hit without affecting BM25 ranking.
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS l1_fts USING fts5(
          content,
          content_original UNINDEXED,
          record_id UNINDEXED,
          type UNINDEXED,
          priority UNINDEXED,
          scene_name UNINDEXED,
          session_key UNINDEXED,
          session_id UNINDEXED,
          team_id UNINDEXED,
          task_id UNINDEXED,
          user_id UNINDEXED,
          agent_id UNINDEXED,
          version UNINDEXED,
          timestamp_str UNINDEXED,
          timestamp_start UNINDEXED,
          timestamp_end UNINDEXED,
          metadata_json UNINDEXED
        )
      `);

      // L0 FTS5 virtual table (v2 schema + isolation columns).
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS l0_fts USING fts5(
          message_text,
          message_text_original UNINDEXED,
          record_id UNINDEXED,
          session_key UNINDEXED,
          session_id UNINDEXED,
          team_id UNINDEXED,
          task_id UNINDEXED,
          user_id UNINDEXED,
          agent_id UNINDEXED,
          role UNINDEXED,
          recorded_at UNINDEXED,
          timestamp UNINDEXED
        )
      `);

      // L1 FTS prepared statements
      this.stmtL1FtsInsert = this.db.prepare(`
        INSERT INTO l1_fts (content, content_original, record_id, type, priority, scene_name,
          session_key, session_id, team_id, task_id, user_id, agent_id, version,
          timestamp_str, timestamp_start, timestamp_end, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.stmtL1FtsDelete = this.db.prepare("DELETE FROM l1_fts WHERE record_id = ?");

      this.stmtL1FtsSearch = this.db.prepare(`
        SELECT record_id, content_original AS content, type, priority, scene_name,
               session_key, session_id, team_id, task_id, user_id, agent_id, version,
               timestamp_str, timestamp_start, timestamp_end,
               metadata_json,
               bm25(l1_fts) AS rank
        FROM l1_fts
        WHERE l1_fts MATCH ?
        ORDER BY rank ASC
        LIMIT ?
      `);

      // L0 FTS prepared statements
      this.stmtL0FtsInsert = this.db.prepare(`
        INSERT INTO l0_fts (message_text, message_text_original, record_id,
          session_key, session_id, team_id, task_id, user_id, agent_id, role, recorded_at, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.stmtL0FtsDelete = this.db.prepare("DELETE FROM l0_fts WHERE record_id = ?");

      this.stmtL0FtsSearch = this.db.prepare(`
        SELECT record_id, message_text_original AS message_text,
               session_key, session_id, team_id, task_id, user_id, agent_id, role, recorded_at, timestamp,
               bm25(l0_fts) AS rank
        FROM l0_fts
        WHERE l0_fts MATCH ?
        ORDER BY rank ASC
        LIMIT ?
      `);

      this.ftsAvailable = true;
      this.logger?.debug?.(`${TAG} FTS5 tables initialized (l1_fts, l0_fts) [schema v2 — jieba segmented]`);

      // Rebuild FTS index if migrated from v1 or tables were freshly created
      if (needsFtsRebuild) {
        this.rebuildFtsIndex();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ftsAvailable = false;
      this.logger?.warn(
        `${TAG} FTS5 tables NOT available (fts5 may not be compiled in): ${message}. ` +
        `FTS-based keyword search will be unavailable; recall will use in-memory scoring if needed.`,
      );
    }

    // Save current embedding meta (write after schema is ready)
    if (providerInfo) {
      this.writeEmbeddingMeta({
        provider: providerInfo.provider,
        model: providerInfo.model,
        dimensions: this.dimensions,
      });
    }

    // Mark vec0 tables as ready only when they were actually created
    this.vecTablesReady = this.dimensions > 0;
    // L1 query statements (for l1-reader)
    // user_id / agent_id surfaced in every L1 read so callers (router /
    // candidate-pool / l1-reader) can enforce isolation downstream.
    const l1QueryCols = `record_id, content, type, priority, scene_name, session_key, session_id,
      team_id, task_id, user_id, agent_id, version,
      timestamp_str, timestamp_start, timestamp_end,
      created_time, updated_time, metadata_json`;

    this.stmtQueryBySessionId = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      WHERE session_id = ?
      ORDER BY updated_time ASC
    `);

    this.stmtQueryBySessionIdSince = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      WHERE session_id = ? AND updated_time > ?
      ORDER BY updated_time ASC
    `);

    this.stmtQueryBySessionKey = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      WHERE session_key = ?
      ORDER BY updated_time ASC
    `);

    this.stmtQueryBySessionKeySince = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      WHERE session_key = ? AND updated_time > ?
      ORDER BY updated_time ASC
    `);

    this.stmtQueryAll = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      ORDER BY updated_time ASC
    `);

    this.stmtQueryAllSince = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      WHERE updated_time > ?
      ORDER BY updated_time ASC
    `);

    this.stmtL1QueryMigrationCursor = this.db.prepare(`
      SELECT ${l1QueryCols} FROM l1_records
      WHERE record_id > ?
      ORDER BY record_id ASC
      LIMIT ?
    `);

    this.logger?.debug?.(`${TAG} Initialized (dimensions=${this.dimensions})`);

    return { needsReindex, reason: reindexReason };
  }

  // ── Embedding meta helpers ──────────────────────────────


(Output capped. Showing lines 1-1253. Use offset=1254 to continue.)