      // Full scan with optional filter

      const docs = await this._queryAllDocs(
        this.l1Collection,
        filterExpr,
        L1_OUTPUT_FIELDS,
        undefined, // no limit — fetch all matching
        [{ fieldName: "updated_time_ms", direction: "asc" }],
      );

      return docs.map((doc) => ({
        record_id: String(doc.id ?? ""),
        content: String(doc.text ?? ""),
        type: String(doc.type ?? ""),
        priority: Number(doc.priority ?? 0),
        scene_name: String(doc.scene_name ?? ""),
        session_key: String(doc.session_key ?? ""),
        session_id: String(doc.session_id ?? ""),
        task_id: String(doc.task_id ?? ""),
        team_id: String(doc.team_id ?? ""),
        user_id: String(doc.user_id ?? ""),
        agent_id: String(doc.agent_id ?? ""),
        version: Number(doc.version ?? 0),
        timestamp_str: String(doc.timestamp_str ?? ""),
        timestamp_start: String(doc.timestamp_start ?? ""),
        timestamp_end: String(doc.timestamp_end ?? ""),
        created_time: epochMsToIso(Number(doc.created_time_ms ?? 0)),
        updated_time: epochMsToIso(Number(doc.updated_time_ms ?? 0)),
        metadata_json: String(doc.metadata_json ?? "{}"),
      }));
    } catch (err) {
      this.logger?.warn(`${TAG} [L1-query] FAILED: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  async getAllL1Texts(): Promise<Array<{ record_id: string; content: string; updated_time: string }>> {
    try {
      await this._ensureInit();
      if (this.degraded) return [];

      const docs = await this._queryAllDocs(
        this.l1Collection,
        undefined,
        ["id", "text", "updated_time_ms"],
      );

      return docs.map((doc) => ({
        record_id: String(doc.id ?? ""),
        content: String(doc.text ?? ""),
        updated_time: epochMsToIso(Number(doc.updated_time_ms ?? 0)),
      }));
    } catch (err) {
      this.logger?.warn(`${TAG} [L1-getAllTexts] FAILED: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ── L1 Search Operations ─────────────────────────────────

  async searchL1Vector(_queryEmbedding: Float32Array, topK?: number, queryText?: string, filter?: IsolationFilter): Promise<L1SearchResult[]> {
    // TCVDB uses server-side embedding — delegate to hybrid search with text
    if (queryText) {
      return this.searchL1HybridAsync({ queryText, topK, filter });
    }
    // No queryText and TCVDB can't use client embeddings directly via embeddingItems
    // Return empty — callers should pass queryText for TCVDB
    return [];
  }

  async searchL1Fts(ftsQuery: string, limit?: number, filter?: IsolationFilter): Promise<L1FtsResult[]> {
    // TCVDB has no pure FTS — use hybrid search with sparse-only path
    // The ftsQuery is raw text, use it as queryText for hybrid
    if (!ftsQuery) return [];
    const results = await this.searchL1HybridAsync({ queryText: ftsQuery, topK: limit, filter });
    // L1SearchResult and L1FtsResult have identical shapes
    return results;
  }

  async searchL1Hybrid(params: {
    query?: string;
    queryEmbedding?: Float32Array;
    sparseVector?: SparseVector;
    topK?: number;
    filter?: IsolationFilter;
  }): Promise<L1SearchResult[]> {
    const queryText = params.query;
    if (!queryText) return [];
    return this.searchL1HybridAsync({ queryText, topK: params.topK, filter: params.filter });
  }

  /**
   * Async L1 hybrid search — the real implementation.
   * Call this directly from async contexts (hooks, tools).
   */
  async searchL1HybridAsync(params: {
    queryText: string;
    topK?: number;
    filter?: IsolationFilter;
  }): Promise<L1SearchResult[]> {
    const { queryText, topK = 10, filter } = params;
    if (!queryText) return [];

    try {
      await this._ensureInit();
      if (this.degraded) return [];

      const filterExpr = joinFilter(buildIsolationConditions(filter));

      // Build search params
      const searchParams: Record<string, unknown> = {
        limit: topK,
        outputFields: L1_OUTPUT_FIELDS,
      };
      if (filterExpr) searchParams.filter = filterExpr;

      const sparse = this.bm25Encoder?.encodeQueries([queryText]) ?? [];
      const sparseVec = sparse.length > 0 && sparse[0].length > 0 ? sparse[0] : undefined;

      if (!this.embeddingEnabled) {
        if (!sparseVec) return [];
        searchParams.ann = [{ fieldName: "vector", data: [[1]], limit: topK }];
        searchParams.match = [{
          fieldName: "sparse_vector",
          data: [sparseVec],
          limit: topK,
        }];
        searchParams.rerank = { method: "rrf", k: 60 };
        const resp = await this.client.hybridSearch(this.l1Collection, searchParams);
        return this._parseL1SearchResults(resp.documents);
      }

      // ann: use embedding field name "text" for server-side embedding
      // (per SDK: AnnSearch(field_name="text", data='query string'))
      const ann = [{
        fieldName: "text",
        data: [queryText], // embeddingItems — server-side embedding
        limit: topK,
      }];

      if (sparseVec) {
        // Full hybrid: dense + sparse + RRF
        searchParams.ann = ann;
        searchParams.match = [{
          fieldName: "sparse_vector",
          data: [sparseVec], // hybridSearch wraps single sparse vector in array
          limit: topK,
        }];
        searchParams.rerank = { method: "rrf", k: 60 };

        const resp = await this.client.hybridSearch(this.l1Collection, searchParams);
        return this._parseL1SearchResults(resp.documents);
      }

      // Dense-only fallback (BM25 unavailable) — use /document/search with embeddingItems
      const denseSearch: Record<string, unknown> = {
        embeddingItems: [queryText],
        limit: topK,
        retrieveVector: false,
        outputFields: L1_OUTPUT_FIELDS,
      };
      if (filterExpr) denseSearch.filter = filterExpr;
      const resp = await this.client.search(this.l1Collection, denseSearch);
      return this._parseL1SearchResults(resp.documents);
    } catch (err) {
      this.logger?.warn(`${TAG} [L1-hybridSearch] FAILED: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ── L0 Write Operations ──────────────────────────────────

  async upsertL0(record: L0Record, _embedding?: Float32Array): Promise<boolean> {
    try {
      await this._upsertL0Async(record);
      return true;
    } catch (err) {
      this.logger?.warn(`${TAG} [L0-upsert] FAILED id=${record.id}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  private async _upsertL0Async(record: L0Record): Promise<void> {
    await this._ensureInit();
    if (this.degraded) return;

    const doc: Record<string, unknown> = {
      id: record.id,
      message_text: record.messageText,
      team_id: record.teamId ?? "",
      user_id: record.userId || DEFAULT_ISOLATION_ID,
      agent_id: record.agentId || DEFAULT_ISOLATION_ID,
      session_key: record.sessionKey,
      session_id: record.sessionId || DEFAULT_ISOLATION_ID,
      task_id: record.taskId ?? "",
      role: record.role,
      recorded_at_ms: isoToEpochMs(record.recordedAt),
      timestamp: record.timestamp,
    };
    if (!this.embeddingEnabled) doc.vector = [1];

    if (this.bm25Encoder) {
      const sparse = this.bm25Encoder.encodeTexts([record.messageText]);
      if (sparse.length > 0 && sparse[0].length > 0) {
        doc.sparse_vector = sparse[0];
      }
    }

    await this.client.upsert(this.l0Collection, [doc]);
  }

  /**
   * Batch upsert multiple L0 records in a single API call.
   * Used by migration scripts to reduce request count.
   */
  async upsertL0Batch(records: L0Record[]): Promise<number> {
    if (records.length === 0) return 0;
    try {
      await this._ensureInit();
      if (this.degraded) return 0;

(Showing lines 900-1119 of 2506. Use offset=1120 to continue.)