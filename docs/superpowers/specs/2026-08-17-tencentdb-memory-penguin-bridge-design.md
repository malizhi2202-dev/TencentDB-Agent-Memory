# TencentDB Agent Memory ↔ PenguinHarness Memory Bridge Design

Date: 2026-08-17

## Goal

Connect TencentDB Agent Memory to PenguinHarness as a real memory system, not just as a model proxy or a visible marker file.

The target behavior is bidirectional sync between:

- TencentDB Agent Memory, via local MemoryCore/MemoryProxy.
- PenguinHarness native Memory, stored as Markdown topic files under `agent_state/memory/` and shown in the PenguinHarness Memory tab.

The existing MemoryProxy chat injection remains enabled. The new work adds native PenguinHarness visibility and edit/delete synchronization.

## Current State

PenguinHarness native Memory:

- Server routes live at `packages/server/src/http/routes/memory.ts`.
- Service logic lives at `packages/server/src/services/memory-service.ts`.
- UI lives at `packages/web/src/features/agents/memory-tab.tsx`.
- Data is local Markdown under `<PENGUIN_HOME>/<project>/agents/<agent>/agent_state/memory/<scope>/`.
- Topic files use frontmatter fields `name`, `description`, and `updated_at`.
- `MEMORY.md` is an index per scope.

TencentDB Agent Memory:

- MemoryProxy runs at `http://127.0.0.1:8096`.
- MemoryCore runs at `http://127.0.0.1:8420`.
- PenguinHarness default model is routed through `http://127.0.0.1:8096/codebuddy/default`.
- Forced identity currently binds to `default-team`, `default-agent-admin`, and task `PenguinHarness 默认会话`.
- Logs verified that MemoryProxy initializes the session, injects TDAI memory tools, and records L0 conversation memory.

## Chosen Approach: Bidirectional Sync

Add a bridge layer inside PenguinHarness server that treats TencentDB Agent Memory as an external memory provider and syncs it with local Markdown memory.

The Memory tab should still render PenguinHarness native memory groups, but those groups become sync-aware. TencentDB memories can appear as topic files, and topic file changes can be pushed back to TencentDB.

## Components

### 1. Bridge Config

Add an optional PenguinHarness project/agent config section for TencentDB memory sync:

```yaml
memory:
  tencentdb:
    enabled: true
    proxy_base_url: http://127.0.0.1:8096
    core_base_url: http://127.0.0.1:8420
    service_id: default
    team_id: team-6lgd8so6cn
    agent_id: agt-6lgdknfhyc
    task_id: task-60papz9tfh
```

Secrets stay out of files shown to the model. The user key should come from an existing local secret path or environment variable, not from displayed Markdown.

### 2. TencentDB Memory Client

Add a PenguinHarness server-side client, for example `TencentDbMemoryClient`, with methods:

- `listAtomicMemories(ctx)` via `/memory-bridge/v3/atomic/query` or direct Core `/v3/atomic/query`.
- `searchAtomicMemories(ctx, query)` via `/memory-bridge/v3/atomic/search`.
- `searchConversation(ctx, query)` via `/memory-bridge/v3/conversation/search`.
- `upsertMarkdownMemory(ctx, topic)` using the best available Core write API after implementation verification.
- `deleteOrArchiveMemory(ctx, externalId)` using archive/tombstone semantics when hard delete is not stable.

The client should normalize TencentDB records into a provider-neutral shape:

```ts
interface ExternalMemoryTopic {
  externalId: string;
  title: string;
  description: string;
  body: string;
  updatedAt: string;
  source: "tencentdb";
  checksum: string;
}
```

### 3. Local Mirror Files

Mirror TencentDB memories into PenguinHarness native Markdown files under a dedicated user scope prefix:

```text
agent_state/memory/user/tencentdb-<safe-id>.md
```

Each mirrored file gets frontmatter:

```markdown
---
name: <title>
description: <summary>
updated_at: <YYYY-MM-DD>
tencentdb_external_id: <external id>
tencentdb_checksum: <sha256 of normalized remote content>
tencentdb_synced_at: <ISO timestamp>
tencentdb_sync_state: clean | local_modified | remote_modified | conflict | deleted_remote
---
```

PenguinHarness already ignores unknown frontmatter fields, so the Memory tab can show the file without UI breakage.

### 4. Sync Direction

Remote to local:

- Pull TencentDB atomic memories for the configured team/agent/task.
- Convert each memory into a Markdown topic file.
- Update `MEMORY.md` index lines.
- If a local mirrored file was not changed locally and the remote checksum changed, overwrite it.
- If both local and remote changed, mark `tencentdb_sync_state: conflict` and preserve local body.

Local to remote:

- Detect local mirrored files where body/frontmatter changed after the last checksum.
- Push changed content to TencentDB as an upsert/update.
- Refresh external id/checksum after successful push.

Delete:

- If the user deletes a local mirrored file in PenguinHarness, first remove it locally as PenguinHarness already does.
- Record a tombstone in a small bridge state file, for example `agent_state/memory/.tencentdb-sync.json`.
- Do not hard-delete remote memory in v1 unless the TencentDB backend delete/archive API is verified stable.
- A later v2 can expose explicit “delete remotely too” behavior.

### 5. API Changes

Add server endpoints under the existing memory route:

- `POST /api/projects/:projectId/agents/:agentId/memory/tencentdb/sync/pull`
- `POST /api/projects/:projectId/agents/:agentId/memory/tencentdb/sync/push`
- `POST /api/projects/:projectId/agents/:agentId/memory/tencentdb/sync/full`
- `GET /api/projects/:projectId/agents/:agentId/memory/tencentdb/status`

All routes use existing project membership checks.

### 6. UI Changes

Add a compact TencentDB sync strip at the top of the Memory tab:

- Status: connected, disabled, error, last sync time.
- Buttons: Pull, Push, Sync.
- Conflict count when present.

Do not replace the existing Memory tab layout. Mirrored TencentDB memories should appear in the existing User memory list as normal files.

### 7. Conflict Policy

Use checksum-based conflict detection.

- `clean`: local checksum equals last remote checksum.
- `local_modified`: local changed since last sync, remote did not.
- `remote_modified`: remote changed since last sync, local did not.
- `conflict`: both changed.

For v1, conflicts are not auto-merged. The file remains readable and editable. The sync status endpoint reports conflicts so the UI can show a warning.

### 8. Error Handling

- If TencentDB is unreachable, show a non-blocking sync error; local Memory remains usable.
- If one remote item fails to mirror, continue syncing the rest and return per-item errors.
- Never expose user keys or API keys in memory files, UI text, logs, or final answers.
- If remote write/delete APIs are missing or unstable, disable push/delete and report a clear status.

### 9. Testing

Server tests:

- Normalize TencentDB memory records into Markdown topics.
- Parse mirrored frontmatter and compute checksums.
- Pull creates topic files and updates `MEMORY.md`.
- Pull updates clean files when remote changes.
- Local+remote concurrent changes create conflict state.
- Delete creates tombstone and does not hard-delete remote in v1.

Manual verification:

- Start MemoryCore, MemoryProxy, and PenguinHarness.
- Run full sync.
- Confirm Memory tab lists TencentDB-backed entries.
- Edit a mirrored memory through PenguinHarness flow, push, then pull again.
- Confirm MemoryProxy chat injection still works after bridge changes.

## Non-goals For First Implementation

- Do not replace MemoryProxy chat injection.
- Do not make PenguinHarness depend on TencentDB Memory to start.
- Do not hard-delete remote memories until the backend API is verified stable.
- Do not expose secrets in Markdown memory files.