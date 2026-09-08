# TencentDB Memory Penguin Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build bidirectional sync between TencentDB Agent Memory and PenguinHarness native Markdown Memory so TencentDB memories appear in the PenguinHarness Memory tab and edited mirrored topics can be pushed back.

**Architecture:** Add a sync layer to PenguinHarness server. It mirrors TencentDB L1 atomic memories into `agent_state/memory/user/tencentdb-*.md`, tracks checksums/tombstones in `agent_state/memory/.tencentdb-sync.json`, exposes sync/status routes under the existing Memory API, and adds a compact sync control strip to the Memory tab. Existing MemoryProxy chat injection stays unchanged.

**Tech Stack:** TypeScript, Hono, React 19, Vite, Vitest, PenguinHarness `@prismshadow/penguin-core` memory path helpers, TencentDB MemoryCore `/v3/atomic/*` and `/v3/conversation/add` APIs.

## Global Constraints

- Implementation target is `/home/malizhi/project/penguin-harness`; this plan is stored in `/home/malizhi/project/TencentDB-Agent-Memory` for project tracking.
- Do not expose user keys, API keys, or secrets in Markdown memory files, UI text, logs, or final answers.
- Do not replace MemoryProxy chat injection; it remains the runtime injection path.
- Do not make PenguinHarness fail to start when TencentDB Agent Memory is unreachable.
- Do not hard-delete remote memories by default; local deletes create tombstones and remote delete is explicit future behavior.
- Use existing PenguinHarness patterns in `packages/server/src/services/memory-service.ts`, `packages/server/src/http/routes/memory.ts`, and `packages/web/src/features/agents/memory-tab.tsx`.
- Run tests with Node 24 via `/home/malizhi/project/penguin-harness/.tools/node24/bin` in `PATH`.

---

## File Structure

Create these focused server files in `/home/malizhi/project/penguin-harness/packages/server/src/services/`:

- `tencentdb-memory-types.ts`: shared sync DTOs, local state types, and exported constants.
- `tencentdb-memory-markdown.ts`: pure Markdown/frontmatter/checksum/filename/index helpers.
- `tencentdb-memory-client.ts`: HTTP client for TencentDB MemoryCore/MemoryProxy APIs.
- `tencentdb-memory-sync-service.ts`: orchestration that pulls, pushes, computes status, writes local mirror files, and tracks tombstones.

Modify these server files:

- `packages/server/src/api/types.ts`: add sync status/result DTOs exported to the web package.
- `packages/server/src/app.ts`: construct `TencentDbMemorySyncService` and add it to `AppDeps`.
- `packages/server/src/http/routes/memory.ts`: add `GET /tencentdb/status`, `POST /tencentdb/sync/pull`, `POST /tencentdb/sync/push`, and `POST /tencentdb/sync/full`.
- `packages/server/test/memory-tencentdb-sync.test.ts`: integration tests with a fake `fetch` client.

Modify these web files:

- `packages/web/src/api/endpoints.ts`: add typed endpoint helpers.
- `packages/web/src/features/agents/memory-tab.tsx`: render a small sync strip and reload local memory after sync.
- `packages/web/src/lib/strings-en.ts`: add UI copy.

No new runtime npm dependency is required.

---

### Task 1: Pure Markdown Mirror Helpers

**Files:**
- Create: `/home/malizhi/project/penguin-harness/packages/server/src/services/tencentdb-memory-types.ts`
- Create: `/home/malizhi/project/penguin-harness/packages/server/src/services/tencentdb-memory-markdown.ts`
- Test: `/home/malizhi/project/penguin-harness/packages/server/test/memory-tencentdb-sync.test.ts`

**Interfaces:**
- Produces:
  - `TENCENTDB_SYNC_STATE_FILE = ".tencentdb-sync.json"`
  - `TENCENTDB_MIRROR_PREFIX = "tencentdb-"`
  - `type TencentDbSyncState = "clean" | "local_modified" | "remote_modified" | "conflict" | "deleted_remote"`
  - `interface ExternalMemoryTopic { externalId: string; title: string; description: string; body: string; updatedAt: string; checksum: string }`
  - `function normalizeTopic(input: Omit<ExternalMemoryTopic, "checksum">): ExternalMemoryTopic`
  - `function mirrorFileName(externalId: string): string`
  - `function renderMirrorMarkdown(topic: ExternalMemoryTopic, syncedAt: string, syncState?: TencentDbSyncState): string`
  - `function parseMirrorMarkdown(content: string, fileName: string): ParsedMirrorMemory | null`
  - `function updateMemoryIndex(index: string, fileName: string, title: string, description: string): string`
- Consumes: PenguinHarness memory service can already list topic files with unknown frontmatter.

- [ ] **Step 1: Write failing helper tests**

Append a new `describe("tencentdb memory mirror helpers", ...)` block to `packages/server/test/memory-tencentdb-sync.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  mirrorFileName,
  normalizeTopic,
  parseMirrorMarkdown,
  renderMirrorMarkdown,
  updateMemoryIndex,
} from "../src/services/tencentdb-memory-markdown.js";

it("renders and parses TencentDB mirrored Markdown with stable checksum metadata", () => {
  const topic = normalizeTopic({
    externalId: "mem/abc 123",
    title: "Deployment preference",
    description: "User prefers local smoke tests before UI claims.",
    body: "Run smoke tests before saying the UI is ready.",
    updatedAt: "2026-08-17T10:00:00.000Z",
  });
  const markdown = renderMirrorMarkdown(topic, "2026-08-17T10:01:00.000Z");
  expect(markdown).toContain("tencentdb_external_id: mem/abc 123");
  expect(markdown).toContain("tencentdb_sync_state: clean");

  const parsed = parseMirrorMarkdown(markdown, mirrorFileName(topic.externalId));
  expect(parsed).toMatchObject({
    externalId: "mem/abc 123",
    title: "Deployment preference",
    description: "User prefers local smoke tests before UI claims.",
    syncState: "clean",
  });
  expect(parsed?.currentChecksum).toBe(topic.checksum);
});

it("updates MEMORY.md idempotently for TencentDB mirror files", () => {
  const once = updateMemoryIndex("", "tencentdb-mem-abc.md", "Deployment preference", "Smoke first");
  const twice = updateMemoryIndex(once, "tencentdb-mem-abc.md", "Deployment preference", "Smoke first");
  expect(twice).toBe(once);
  expect(twice).toBe("- [Deployment preference](tencentdb-mem-abc.md) — Smoke first\n");
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
cd /home/malizhi/project/penguin-harness
PATH=/home/malizhi/project/penguin-harness/.tools/node24/bin:$PATH pnpm --filter @prismshadow/penguin-server test -- memory-tencentdb-sync.test.ts
```

Expected: FAIL because `tencentdb-memory-markdown.js` does not exist.

- [ ] **Step 3: Implement types**

Create `packages/server/src/services/tencentdb-memory-types.ts`:

```ts
export const TENCENTDB_SYNC_STATE_FILE = ".tencentdb-sync.json";
export const TENCENTDB_MIRROR_PREFIX = "tencentdb-";

export type TencentDbSyncState =
  | "clean"
  | "local_modified"
  | "remote_modified"
  | "conflict"
  | "deleted_remote";

export interface ExternalMemoryTopic {
  externalId: string;
  title: string;
  description: string;
  body: string;
  updatedAt: string;
  checksum: string;
}

export interface ParsedMirrorMemory {
  fileName: string;
  externalId: string;
  title: string;
  description: string;
  updatedAt?: string;
  syncedAt?: string;
  storedChecksum?: string;
  currentChecksum: string;
  syncState: TencentDbSyncState;
  body: string;
}

export interface TencentDbSyncTombstone {
  externalId: string;
  fileName: string;
  deletedAt: string;
}

export interface TencentDbSyncStore {
  lastPullAt?: string;
  lastPushAt?: string;
  tombstones: TencentDbSyncTombstone[];
}
```

- [ ] **Step 4: Implement Markdown helpers**

Create `packages/server/src/services/tencentdb-memory-markdown.ts`:

```ts
import { createHash } from "node:crypto";
import {
  type ExternalMemoryTopic,
  type ParsedMirrorMemory,
  TENCENTDB_MIRROR_PREFIX,
  type TencentDbSyncState,
} from "./tencentdb-memory-types.js";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function scalar(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function bodyChecksum(input: { title: string; description: string; body: string; updatedAt: string }): string {
  return sha256(JSON.stringify({
    title: input.title,
    description: input.description,
    body: input.body,
    updatedAt: input.updatedAt,
  }));
}

export function normalizeTopic(input: Omit<ExternalMemoryTopic, "checksum">): ExternalMemoryTopic {
  const topic = {
    externalId: input.externalId.trim(),
    title: input.title.trim() || input.externalId.trim(),
    description: input.description.trim(),
    body: input.body.trim(),
    updatedAt: input.updatedAt,
  };
  return { ...topic, checksum: bodyChecksum(topic) };
}

export function mirrorFileName(externalId: string): string {
  const digest = sha256(externalId).slice(0, 16);
  const base = externalId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${TENCENTDB_MIRROR_PREFIX}${base || "memory"}-${digest}.md`;
}

export function renderMirrorMarkdown(
  topic: ExternalMemoryTopic,
  syncedAt: string,
  syncState: TencentDbSyncState = "clean",
): string {
  const date = topic.updatedAt.slice(0, 10);
  return [
    "---",
    `name: ${scalar(topic.title)}`,
    `description: ${scalar(topic.description)}`,
    `updated_at: ${date}`,
    `tencentdb_external_id: ${scalar(topic.externalId)}`,
    `tencentdb_checksum: ${topic.checksum}`,
    `tencentdb_synced_at: ${syncedAt}`,
    `tencentdb_sync_state: ${syncState}`,
    "---",
    "",
    topic.body,
    "",
  ].join("\n");
}

export function parseMirrorMarkdown(content: string, fileName: string): ParsedMirrorMemory | null {
  const match = /^\ufeff?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (!match) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const externalId = fields.tencentdb_external_id;
  if (!externalId) return null;
  const body = match[2]!.trim();
  const title = fields.name || fileName;
  const description = fields.description ?? "";
  const updatedAt = fields.updated_at;
  return {
    fileName,
    externalId,
    title,
    description,
    ...(updatedAt ? { updatedAt } : {}),
    syncedAt: fields.tencentdb_synced_at,
    storedChecksum: fields.tencentdb_checksum,
    currentChecksum: bodyChecksum({ title, description, body, updatedAt: updatedAt ?? "" }),
    syncState: (fields.tencentdb_sync_state as TencentDbSyncState | undefined) ?? "clean",
    body,
  };
}

export function updateMemoryIndex(index: string, fileName: string, title: string, description: string): string {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = `- [${title}](${fileName}) — ${description}`.trimEnd();
  const lines = index.split("\n").filter((existing) => existing.trim().length > 0 && !new RegExp(`\\]\\(<?(?:\\./)?${escaped}>?`).test(existing));
  lines.push(line);
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 5: Run helper tests to verify they pass**

Run the same test command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
cd /home/malizhi/project/penguin-harness
git add packages/server/src/services/tencentdb-memory-types.ts packages/server/src/services/tencentdb-memory-markdown.ts packages/server/test/memory-tencentdb-sync.test.ts
git commit -m "feat(memory): add TencentDB mirror markdown helpers"
```

---

### Task 2: TencentDB Memory Client

**Files:**
- Create: `/home/malizhi/project/penguin-harness/packages/server/src/services/tencentdb-memory-client.ts`
- Modify: `/home/malizhi/project/penguin-harness/packages/server/test/memory-tencentdb-sync.test.ts`

**Interfaces:**
- Consumes: `ExternalMemoryTopic`, `normalizeTopic` from Task 1.
- Produces:
  - `interface TencentDbMemoryClientConfig { coreBaseUrl: string; serviceId: string; userKey?: string; teamId: string; userId: string; agentId: string; taskId?: string; sessionId: string }`
  - `class TencentDbMemoryClient { queryAtomic(limit?: number): Promise<ExternalMemoryTopic[]>; updateAtomic(id: string, content: string, background?: string): Promise<void>; addConversationMemory(content: string): Promise<void>; health(): Promise<boolean> }`

- [ ] **Step 1: Write failing client tests with fake fetch**

Add tests:

```ts
import { TencentDbMemoryClient } from "../src/services/tencentdb-memory-client.js";

it("normalizes atomic query results from TencentDB Core", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({
      code: 0,
      data: {
        items: [{
          id: "atom-1",
          content: "Remember to smoke test UI before claiming it works.",
          background: "verification",
          updated_at: "2026-08-17T10:00:00.000Z",
        }],
        total: 1,
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new TencentDbMemoryClient({
    coreBaseUrl: "http://127.0.0.1:8420",
    serviceId: "default",
    userKey: "test-user-key",
    teamId: "team-1",
    userId: "usr-1",
    agentId: "agent-1",
    taskId: "task-1",
    sessionId: "penguin-sync",
  }, fetchImpl);
  const topics = await client.queryAtomic(5);
  expect(calls[0]?.url).toBe("http://127.0.0.1:8420/v3/atomic/query");
  expect(calls[0]?.body).toMatchObject({ team_id: "team-1", user_id: "usr-1", agent_id: "agent-1", task_id: "task-1", limit: 5 });
  expect(topics[0]).toMatchObject({
    externalId: "atom-1",
    title: "verification",
    body: "Remember to smoke test UI before claiming it works.",
  });
});

it("pushes existing mirrored memories with atomic/update and new local topics with conversation/add", async () => {
  const paths: string[] = [];
  const fetchImpl: typeof fetch = async (url) => {
    paths.push(new URL(String(url)).pathname);
    return new Response(JSON.stringify({ code: 0, data: { id: "ok", version: "v2", updated_at: "2026-08-17T10:02:00.000Z" } }), { status: 200 });
  };
  const client = new TencentDbMemoryClient({
    coreBaseUrl: "http://core.local",
    serviceId: "default",
    userKey: "test-user-key",
    teamId: "team-1",
    userId: "usr-1",
    agentId: "agent-1",
    sessionId: "penguin-sync",
  }, fetchImpl);
  await client.updateAtomic("atom-1", "new body", "title");
  await client.addConversationMemory("new local memory body");
  expect(paths).toEqual(["/v3/atomic/update", "/v3/conversation/add"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the Task 1 test command. Expected: FAIL because `TencentDbMemoryClient` does not exist.

- [ ] **Step 3: Implement client**

Create `packages/server/src/services/tencentdb-memory-client.ts`:

```ts
import { normalizeTopic } from "./tencentdb-memory-markdown.js";
import type { ExternalMemoryTopic } from "./tencentdb-memory-types.js";

export interface TencentDbMemoryClientConfig {
  coreBaseUrl: string;
  serviceId: string;
  userKey?: string;
  teamId: string;
  userId: string;
  agentId: string;
  taskId?: string;
  sessionId: string;
}

interface Envelope<T> { code: number; message?: string; data?: T }

export class TencentDbMemoryClient {
  constructor(private readonly cfg: TencentDbMemoryClientConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(`${this.cfg.coreBaseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tdai-service-id": this.cfg.serviceId,
        ...(this.cfg.userKey ? { "x-tdai-user-key": this.cfg.userKey } : {}),
      },
      body: JSON.stringify({
        team_id: this.cfg.teamId,
        user_id: this.cfg.userId,
        agent_id: this.cfg.agentId,
        ...(this.cfg.taskId ? { task_id: this.cfg.taskId } : {}),
        ...body,
      }),
    });
    if (!res.ok) throw new Error(`TencentDB Memory request failed: ${res.status}`);
    const env = (await res.json()) as Envelope<T>;
    if (env.code !== 0) throw new Error(env.message || `TencentDB Memory error code ${env.code}`);
    return env.data as T;
  }

  async health(): Promise<boolean> {
    try {
      await this.queryAtomic(1);
      return true;
    } catch {
      return false;
    }
  }

  async queryAtomic(limit = 100): Promise<ExternalMemoryTopic[]> {
    const data = await this.post<{ items: Array<{ id: string; content: string; background?: string; updated_at?: string; created_at?: string }> }>("/v3/atomic/query", { limit, offset: 0 });
    return (data.items ?? []).map((item) => normalizeTopic({
      externalId: item.id,
      title: item.background || item.id,
      description: item.content.slice(0, 140),
      body: item.content,
      updatedAt: item.updated_at || item.created_at || new Date(0).toISOString(),
    }));
  }

  async updateAtomic(id: string, content: string, background?: string): Promise<void> {
    await this.post("/v3/atomic/update", { id, content, ...(background ? { background } : {}) });
  }

  async addConversationMemory(content: string): Promise<void> {
    await this.post("/v3/conversation/add", {
      session_id: this.cfg.sessionId,
      messages: [{ role: "user", content, timestamp: new Date().toISOString() }],
    });
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run the Task 1 test command. Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
cd /home/malizhi/project/penguin-harness
git add packages/server/src/services/tencentdb-memory-client.ts packages/server/test/memory-tencentdb-sync.test.ts
git commit -m "feat(memory): add TencentDB memory client"
```

---

### Task 3: Sync Service And Server Routes

**Files:**
- Create: `/home/malizhi/project/penguin-harness/packages/server/src/services/tencentdb-memory-sync-service.ts`
- Modify: `/home/malizhi/project/penguin-harness/packages/server/src/api/types.ts`
- Modify: `/home/malizhi/project/penguin-harness/packages/server/src/app.ts`
- Modify: `/home/malizhi/project/penguin-harness/packages/server/src/http/routes/memory.ts`
- Modify: `/home/malizhi/project/penguin-harness/packages/server/test/memory-tencentdb-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers and Task 2 client.
- Produces:
  - `interface TencentDbMemoryStatusResponse { enabled: boolean; connected: boolean; lastPullAt?: string; lastPushAt?: string; localMirrorCount: number; conflictCount: number; tombstoneCount: number; error?: string }`
  - `interface TencentDbMemorySyncResponse { status: TencentDbMemoryStatusResponse; pulled: number; pushed: number; conflicted: number; errors: string[] }`
  - `class TencentDbMemorySyncService { status(projectId, agentId): Promise<...>; pull(projectId, agentId): Promise<...>; push(projectId, agentId): Promise<...>; full(projectId, agentId): Promise<...> }`

- [ ] **Step 1: Write failing route tests**

Add tests using `createTestApp({ tencentDbMemoryFetch: fakeFetch })` after adding this override in Task implementation:

```ts
it("pulls TencentDB atomic memories into the user Memory scope", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    code: 0,
    data: { items: [{ id: "atom-1", content: "Always refresh the page after restarting PenguinHarness.", background: "PenguinHarness ops", updated_at: "2026-08-17T10:00:00.000Z" }], total: 1 },
  }), { status: 200 });
  t = await createTestApp({ tencentDbMemoryFetch: fetchImpl });
  const a = await provisionUser(t.app, "owner_a");
  owner = apiClient(t.app, a.cookie);
  const created = (await (await owner.post("/api/projects", { projectId: "owner_a-memory", name: "memory project" })).json()) as ProjectCreateResponse;
  projectId = created.project.projectId;
  memoryPath = `/api/projects/${projectId}/agents/default_agent/memory`;

  const res = await owner.post(`${memoryPath}/tencentdb/sync/pull`, {});
  expect(res.status).toBe(200);
  const list = (await (await owner.get(`${memoryPath}/scopes/user/files`)).json()) as MemoryFilesResponse;
  expect(list.files.some((f) => f.name.startsWith("tencentdb-"))).toBe(true);
  expect(list.files[0]?.title).toBe("PenguinHarness ops");
});

it("reports conflicts instead of overwriting locally edited mirrored memory", async () => {
  let queryCount = 0;
  const fetchImpl: typeof fetch = async () => {
    queryCount += 1;
    const content = queryCount === 1 ? "Initial remote body." : "Changed remote body.";
    return new Response(JSON.stringify({
      code: 0,
      data: { items: [{ id: "atom-1", content, background: "Conflict topic", updated_at: `2026-08-17T10:0${queryCount}:00.000Z` }], total: 1 },
    }), { status: 200 });
  };
  t = await createTestApp({ tencentDbMemoryFetch: fetchImpl });
  const a = await provisionUser(t.app, "owner_conflict");
  owner = apiClient(t.app, a.cookie);
  const created = (await (await owner.post("/api/projects", { projectId: "owner_conflict-memory", name: "memory project" })).json()) as ProjectCreateResponse;
  projectId = created.project.projectId;
  memoryPath = `/api/projects/${projectId}/agents/default_agent/memory`;

  await owner.post(`${memoryPath}/tencentdb/sync/pull`, {});
  const list = (await (await owner.get(`${memoryPath}/scopes/user/files`)).json()) as MemoryFilesResponse;
  const mirror = list.files.find((f) => f.name.startsWith("tencentdb-"));
  expect(mirror).toBeTruthy();

  await owner.put(`${memoryPath}/scopes/user/files/${mirror!.name}`, {
    content: mirror!.content.replace("Initial remote body.", "Locally edited body."),
  });
  const res = await owner.post(`${memoryPath}/tencentdb/sync/pull`, {});
  const body = (await res.json()) as TencentDbMemorySyncResponse;
  expect(body.conflicted).toBe(1);

  const read = (await (await owner.get(`${memoryPath}/scopes/user/files/${mirror!.name}`)).json()) as MemoryFileResponse;
  expect(read.file.content).toContain("tencentdb_sync_state: conflict");
});
```

Use the same fake fetch with two sequential `atomic/query` responses in the conflict test.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /home/malizhi/project/penguin-harness
PATH=/home/malizhi/project/penguin-harness/.tools/node24/bin:$PATH pnpm --filter @prismshadow/penguin-server test -- memory-tencentdb-sync.test.ts
```

Expected: FAIL because routes and test override do not exist.

- [ ] **Step 3: Add API types**

Append to `packages/server/src/api/types.ts` near Memory DTOs:

```ts
export interface TencentDbMemoryStatusResponse {
  enabled: boolean;
  connected: boolean;
  lastPullAt?: string;
  lastPushAt?: string;
  localMirrorCount: number;
  conflictCount: number;
  tombstoneCount: number;
  error?: string;
}

export interface TencentDbMemorySyncResponse {
  status: TencentDbMemoryStatusResponse;
  pulled: number;
  pushed: number;
  conflicted: number;
  errors: string[];
}
```

- [ ] **Step 4: Add dependency injection hook**

Modify `packages/server/src/app.ts`:

```ts
import { TencentDbMemorySyncService } from "./services/tencentdb-memory-sync-service.js";

export interface BuildDepsOverrides {
  // existing fields...
  tencentDbMemoryFetch?: typeof fetch;
}

export interface AppDeps {
  // existing fields...
  tencentDbMemorySync: TencentDbMemorySyncService;
}

const tencentDbMemorySync = new TencentDbMemorySyncService(config.root, agentConfigService, overrides.tencentDbMemoryFetch ?? fetch);
```

Add `tencentDbMemorySync` into the returned deps object.

- [ ] **Step 5: Implement sync service**

Create `packages/server/src/services/tencentdb-memory-sync-service.ts` with these concrete behaviors:

- Read config from environment first:
  - `TENCENTDB_MEMORY_ENABLED=1` explicitly enables sync.
  - When `TENCENTDB_MEMORY_ENABLED` is unset, sync is enabled only if `TENCENTDB_MEMORY_CORE_URL` is explicitly set.
  - `TENCENTDB_MEMORY_ENABLED=0` explicitly disables sync.
  - `TENCENTDB_MEMORY_CORE_URL`, default `http://127.0.0.1:8420`.
  - `TENCENTDB_MEMORY_SERVICE_ID`, default `default`.
  - `TENCENTDB_MEMORY_USER_KEY`, optional.
  - `TENCENTDB_MEMORY_TEAM_ID`, `TENCENTDB_MEMORY_AGENT_ID`, `TENCENTDB_MEMORY_TASK_ID`, required for sync enabled.
  - `TENCENTDB_MEMORY_USER_ID`, default `usr-6lgda58plp` for current local dev, but allow override.
- Use `memoryScopeDir(root, projectId, agentId, USER_SCOPE_KEY)` for mirror files.
- Store sync state at `path.join(memoryDir(root, projectId, agentId), TENCENTDB_SYNC_STATE_FILE)`.
- `pull()` calls `client.queryAtomic(100)`, writes mirror files, updates `MEMORY.md`, and updates `lastPullAt`.
- `push()` parses local `tencentdb-*.md` files:
  - if `externalId` exists and `currentChecksum !== storedChecksum`, call `client.updateAtomic(externalId, body, title)`.
  - if no `externalId`, call `client.addConversationMemory(body)` and leave the file as local-only until a future pull links it.
  - update `lastPushAt`.
- `status()` counts mirror files and files whose parsed `syncState === "conflict"`.

- [ ] **Step 6: Add routes**

Modify `packages/server/src/http/routes/memory.ts` before `return app;`:

```ts
app.get("/tencentdb/status", async (c) => {
  const { projectId, agentId } = scope(c);
  return c.json(await deps.tencentDbMemorySync.status(projectId, agentId));
});

app.post("/tencentdb/sync/pull", async (c) => {
  const { projectId, agentId } = scope(c);
  return c.json(await deps.tencentDbMemorySync.pull(projectId, agentId));
});

app.post("/tencentdb/sync/push", async (c) => {
  const { projectId, agentId } = scope(c);
  return c.json(await deps.tencentDbMemorySync.push(projectId, agentId));
});

app.post("/tencentdb/sync/full", async (c) => {
  const { projectId, agentId } = scope(c);
  return c.json(await deps.tencentDbMemorySync.full(projectId, agentId));
});
```

- [ ] **Step 7: Run route tests**

Run the Task 3 test command. Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
cd /home/malizhi/project/penguin-harness
git add packages/server/src/app.ts packages/server/src/api/types.ts packages/server/src/http/routes/memory.ts packages/server/src/services/tencentdb-memory-sync-service.ts packages/server/test/memory-tencentdb-sync.test.ts
git commit -m "feat(memory): sync TencentDB memories into native memory"
```

---

### Task 4: Web API Helpers And Memory Tab Sync Strip

**Files:**
- Modify: `/home/malizhi/project/penguin-harness/packages/web/src/api/endpoints.ts`
- Modify: `/home/malizhi/project/penguin-harness/packages/web/src/features/agents/memory-tab.tsx`
- Modify: `/home/malizhi/project/penguin-harness/packages/web/src/lib/strings-en.ts`

**Interfaces:**
- Consumes: `TencentDbMemoryStatusResponse`, `TencentDbMemorySyncResponse` exported by server package from Task 3.
- Produces:
  - `getTencentDbMemoryStatus(projectId, agentId)`
  - `pullTencentDbMemory(projectId, agentId)`
  - `pushTencentDbMemory(projectId, agentId)`
  - `syncTencentDbMemory(projectId, agentId)`

- [ ] **Step 1: Add endpoint helpers**

In `packages/web/src/api/endpoints.ts`, extend the memory section:

```ts
export const getTencentDbMemoryStatus = (projectId: string, agentId: string) =>
  apiFetch<TencentDbMemoryStatusResponse>(`${memoryBase(projectId, agentId)}/tencentdb/status`);

export const pullTencentDbMemory = (projectId: string, agentId: string) =>
  apiFetch<TencentDbMemorySyncResponse>(`${memoryBase(projectId, agentId)}/tencentdb/sync/pull`, { method: "POST", body: {} });

export const pushTencentDbMemory = (projectId: string, agentId: string) =>
  apiFetch<TencentDbMemorySyncResponse>(`${memoryBase(projectId, agentId)}/tencentdb/sync/push`, { method: "POST", body: {} });

export const syncTencentDbMemory = (projectId: string, agentId: string) =>
  apiFetch<TencentDbMemorySyncResponse>(`${memoryBase(projectId, agentId)}/tencentdb/sync/full`, { method: "POST", body: {} });
```

Also import the two DTO types from `@prismshadow/penguin-server/api`.

- [ ] **Step 2: Add strings**

In `strings-en.ts`, add under `memory`:

```ts
tencentdb: {
  title: "TencentDB Agent Memory",
  connected: "Connected",
  disconnected: "Unavailable",
  disabled: "Disabled",
  pull: "Pull",
  push: "Push",
  sync: "Sync",
  lastPull: (value: string): string => `Last pull ${value}`,
  counts: (mirrors: number, conflicts: number): string => `${mirrors} mirrored · ${conflicts} conflicts`,
  syncDone: (pulled: number, pushed: number, conflicted: number): string => `Synced: ${pulled} pulled, ${pushed} pushed, ${conflicted} conflicts`,
}
```

- [ ] **Step 3: Render sync strip**

In `memory-tab.tsx`:

- Add state:

```ts
const [tdbStatus, setTdbStatus] = useState<TencentDbMemoryStatusResponse | null>(null);
const [tdbBusy, setTdbBusy] = useState<"pull" | "push" | "sync" | null>(null);
```

- In `load()`, call `api.getTencentDbMemoryStatus(projectId, agentId)` in parallel with overview/config and set status. If it fails, set `{ enabled: false, connected: false, localMirrorCount: 0, conflictCount: 0, tombstoneCount: 0, error: apiErrorText(e) }` without blocking local Memory.

- Add action handler:

```ts
const runTdbSync = async (kind: "pull" | "push" | "sync") => {
  if (!projectId) return;
  setTdbBusy(kind);
  try {
    const res = kind === "pull"
      ? await api.pullTencentDbMemory(projectId, agentId)
      : kind === "push"
        ? await api.pushTencentDbMemory(projectId, agentId)
        : await api.syncTencentDbMemory(projectId, agentId);
    setTdbStatus(res.status);
    toastSuccess(S.memory.tencentdb.syncDone(res.pulled, res.pushed, res.conflicted));
    await load();
  } catch (e) {
    toastError(apiErrorText(e));
  } finally {
    setTdbBusy(null);
  }
};
```

- Render a compact un-nested strip above the existing Memory description:

```tsx
{tdbStatus && (
  <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-950/50">
    <span className="font-medium text-gray-800 dark:text-gray-100">{S.memory.tencentdb.title}</span>
    <span className={tdbStatus.connected ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
      {tdbStatus.enabled ? (tdbStatus.connected ? S.memory.tencentdb.connected : S.memory.tencentdb.disconnected) : S.memory.tencentdb.disabled}
    </span>
    <span className="text-gray-500 dark:text-gray-400">{S.memory.tencentdb.counts(tdbStatus.localMirrorCount, tdbStatus.conflictCount)}</span>
    <Button size="sm" variant="secondary" disabled={!!tdbBusy} onClick={() => void runTdbSync("pull")}>{S.memory.tencentdb.pull}</Button>
    <Button size="sm" variant="secondary" disabled={!!tdbBusy} onClick={() => void runTdbSync("push")}>{S.memory.tencentdb.push}</Button>
    <Button size="sm" disabled={!!tdbBusy} onClick={() => void runTdbSync("sync")}>{S.memory.tencentdb.sync}</Button>
  </div>
)}
```

- [ ] **Step 4: Typecheck web**

Run:

```bash
cd /home/malizhi/project/penguin-harness
PATH=/home/malizhi/project/penguin-harness/.tools/node24/bin:$PATH pnpm --filter @prismshadow/penguin-web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
cd /home/malizhi/project/penguin-harness
git add packages/web/src/api/endpoints.ts packages/web/src/features/agents/memory-tab.tsx packages/web/src/lib/strings-en.ts
git commit -m "feat(memory): add TencentDB sync controls"
```

---

### Task 5: Live Local Wiring And Verification

**Files:**
- Modify: `/home/malizhi/project/penguin-harness/.env.local` or the active dev launch environment if this repo uses one.
- No code file changes unless Task 3 reveals config must be read from `.project_config.toml` instead of env.

**Interfaces:**
- Consumes: routes and UI from Tasks 3-4.
- Produces: running local PenguinHarness whose Memory tab can sync with TencentDB Agent Memory.

- [ ] **Step 1: Configure local env**

Set these for PenguinHarness server startup:

```bash
export TENCENTDB_MEMORY_ENABLED=1
export TENCENTDB_MEMORY_CORE_URL=http://127.0.0.1:8420
export TENCENTDB_MEMORY_SERVICE_ID=default
export TENCENTDB_MEMORY_TEAM_ID=team-6lgd8so6cn
export TENCENTDB_MEMORY_AGENT_ID=agt-6lgdknfhyc
export TENCENTDB_MEMORY_TASK_ID=task-60papz9tfh
export TENCENTDB_MEMORY_USER_ID=usr-6lgda58plp
export TENCENTDB_MEMORY_USER_KEY=<read from local secret file, never print>
```

Use the already-created local admin key file as the source for `TENCENTDB_MEMORY_USER_KEY` without echoing it to terminal output.

- [ ] **Step 2: Run server tests**

```bash
cd /home/malizhi/project/penguin-harness
PATH=/home/malizhi/project/penguin-harness/.tools/node24/bin:$PATH pnpm --filter @prismshadow/penguin-server test -- memory.test.ts memory-tencentdb-sync.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run server and web typechecks**

```bash
cd /home/malizhi/project/penguin-harness
PATH=/home/malizhi/project/penguin-harness/.tools/node24/bin:$PATH pnpm --filter @prismshadow/penguin-server typecheck
PATH=/home/malizhi/project/penguin-harness/.tools/node24/bin:$PATH pnpm --filter @prismshadow/penguin-web typecheck
```

Expected: both PASS.

- [ ] **Step 4: Restart local services**

Restart PenguinHarness dev server with the env from Step 1. Keep existing MemoryCore (`8420`) and MemoryProxy (`8096`) running.

- [ ] **Step 5: Manual API verification**

With an authenticated PenguinHarness browser session, click Memory tab buttons or call the routes through the web UI. File-level evidence after Pull:

```bash
find /home/malizhi/.penguin/dev-data/default_project/agents/default_agent/agent_state/memory/user -maxdepth 1 -type f -name 'tencentdb-*.md' -print
```

Expected: at least one `tencentdb-*.md` mirror file when TencentDB has L1 memories for the configured identity.

- [ ] **Step 6: Verify MemoryProxy chat injection still works**

Send a chat in PenguinHarness using the default custom model. Then inspect MemoryProxy logs for:

```text
injection.pipeline.done ... errorCount=0
tdai-recorder:write-l0
```

Expected: both lines appear for the request.

- [ ] **Step 7: Commit local wiring if code/config files changed**

Only commit tracked code/config changes. Do not commit secrets or `.env.local` if it contains a user key.

```bash
cd /home/malizhi/project/penguin-harness
git status --short
git add <tracked non-secret files>
git commit -m "chore(memory): wire local TencentDB sync config"
```

---

## Self-Review

Spec coverage:

- Bidirectional sync: covered by Task 3 `pull`, `push`, and `full`.
- Native Memory visibility: covered by Task 1 mirror Markdown and Task 3 pull.
- Memory tab UI: covered by Task 4.
- Conflict policy: covered by Task 3 conflict route tests and sync service behavior.
- Tombstone/no hard delete: covered by Task 3 sync service and Task 5 verification.
- Existing MemoryProxy injection unchanged: covered by Task 5 Step 6.

Placeholder scan:

- No unfinished placeholder markers are intentionally left in implementation steps.
- The only angle placeholder is `<read from local secret file, never print>`, which is an operational instruction to avoid exposing a real secret, not a missing design detail.

Type consistency:

- DTO names match between Task 3 and Task 4.
- Helper names produced by Task 1 are consumed by Tasks 2-3.
- Route paths in Task 3 match endpoint helpers in Task 4.