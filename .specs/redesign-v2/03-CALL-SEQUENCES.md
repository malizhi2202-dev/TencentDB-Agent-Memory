# 核心调用时序详细设计

## 1. Agent 请求、召回与注入

```mermaid
sequenceDiagram
  actor U as User
  participant A as Agent Adapter/Proxy
  participant P as Panel/Core Gateway
  participant S as Scope Resolver
  participant M as Memory Search Pipeline
  participant R as Reranker/Retention
  participant G as Guard/Redaction
  participant L as LLM/Agent Runtime
  participant E as Event Ledger

  U->>A: message + explicit context
  A->>P: request(entryKind, user, workspace signals)
  P->>S: resolve team/project/agent/task
  S-->>P: typed scope + permissions
  P->>M: search(query, scope, domains)
  par Multi recall
    M->>M: vector recall
    M->>M: lexical/BM25 recall
    M->>M: graph/entity expansion
  end
  M->>M: RRF(K=60) + scope/status filter
  M->>R: dedup → rerank → token-budget packing
  R->>G: selected memories + provenance
  G-->>P: redacted injection + explanation
  P->>E: memory.recalled (no raw secret)
  P->>L: prompt + memory/skill/tool sections
  L-->>A: stream response/tool requests
```

硬约束：scope 解析和可见性过滤只有一条生产路径；graph、vector、keyword 的过滤语义一致；低相关结果拒绝注入；原始推理不进账本。

## 2. 对话写入与审批

```mermaid
sequenceDiagram
  participant A as Agent/Proxy
  participant X as Extractor
  participant W as Memory Write Router
  participant P as Policy Gate
  participant Q as Approval Store
  actor H as Human/API Caller
  participant D as Memory DB
  participant E as Audit/Event Ledger

  A->>X: turn/session end + source refs
  X-->>W: candidates(domain, content, confidence)
  W->>W: resolve MemorySpace from typed scope
  W->>P: candidate + writePolicy + actor
  alt automatic
    P-->>W: allow
    W->>D: redact, dedup, versioned write
    D-->>E: memory.written + provenance
  else review_required / explicit_only
    P->>Q: create pending approval
    Q-->>H: approval_required(counts-only)
    H->>Q: claim + decide
    alt approved
      Q->>E: approval.approved
      Q->>D: execute side effect idempotently
      D->>E: memory.written
    else rejected/expired
      Q->>E: approval.rejected/expired
    end
  else deny
    P->>E: memory.denied(reasonCode)
  end
```

## 3. Project 工作区首屏

```mermaid
sequenceDiagram
  actor U as User
  participant W as Web
  participant B as Panel Read Model
  participant C as Core caller-aware APIs
  participant K as Knowledge

  U->>W: open /projects/:id
  W->>B: project-workspace/overview(projectId)
  B->>C: authorize caller/project
  par server-side aggregation
    B->>C: project + members + agents + tasks
    B->>C: assets + spaces + runs + approvals
    B->>K: recent knowledge entries
  end
  C-->>B: visible-only data
  K-->>B: visible-only data or warning
  B-->>W: counts + recent + warnings(partial)
  W-->>U: real summary / partial state
```

不得由浏览器进行 6-N 个接口 fan-out；任何 count 也必须经过权限过滤。

## 4. Task → Run → Deliverable → Memory

```mermaid
sequenceDiagram
  actor U as User
  participant T as Task Service
  participant B as Bundle Resolver
  participant R as Runtime
  participant P as Approval Gate
  participant D as Deliverable Service
  participant M as Memory Command
  participant E as Ledger

  U->>T: start task(expectedVersion)
  T->>T: ready→running
  T->>B: resolve(agent, project, task)
  B-->>T: ExecutionBundleV2
  T->>R: create Run + snapshot
  R->>E: run.accepted/started
  R->>P: risky tool request
  P-->>R: approved/rejected
  alt success
    R->>D: submit deliverable
    D-->>U: review required
    U->>D: approve/reject
    D->>M: synthesize work memory/playbook candidate
    M->>E: memory/playbook candidate event
    T->>T: review→done
  else failure
    R->>E: run.failed(reason)
    T->>T: running→blocked or ready
  end
```

## 5. Skill 渐进披露与演进

```mermaid
sequenceDiagram
  participant R as Bundle Resolver
  participant S as Skill Registry
  participant A as Agent
  participant T as Trace Store
  participant E as Evolution Worker
  actor H as Owner/Reviewer

  R->>S: list accessible + fixed skills
  S-->>R: name + description + version only
  R-->>A: skill index
  A->>S: skill_view(name, version)
  S-->>A: SKILL.md/body after auth
  A->>T: execution result/failure/user feedback
  E->>T: atomically claim bounded trace batch
  E->>E: summarize → patch → candidate version
  E->>S: store draft with lineage/idempotency
  S-->>H: pending review
  H->>S: approve/reject
  S->>T: publish/supersede + event
```

要求：Skill 不新增 callable；完整内容按需加载；claim/consume 原子、有锁、可续扫；失败不丢 trace；单一正文真相源。

## 6. Dreaming 离线巩固

```mermaid
sequenceDiagram
  participant J as Scheduler
  participant M as Memory Store
  participant C as Consolidation Planner
  participant G as Scope Guard
  participant X as Executor
  participant E as Ledger

  J->>M: claim eligible memories(scope, cursor, limit)
  M-->>C: bounded candidates
  C->>C: noise filter + relation detection + grouping
  C->>G: validate cluster.scope ⊆ seed.scope
  G-->>C: allow/deny
  C->>X: deterministic actions(merge/archive/link)
  loop each action
    X->>M: apply idempotently with expectedVersion
    M-->>E: action result + lineage
  end
  X->>J: checkpoint + continuation cursor
```

确定性 archive/关系先行；LLM 无法判断则不操作；任何异常短路且保留 checkpoint；目标侧再次校验写权限。

## 7. 记忆检索评测

```mermaid
sequenceDiagram
  actor O as Operator
  participant UI as Eval UI
  participant ES as Eval Service
  participant M as Memory Search
  participant DB as Eval Store

  O->>UI: choose suite/baseline/candidate
  UI->>ES: start eval run
  loop each case
    ES->>M: run baseline and candidate with same scope
    M-->>ES: ranked results + explanations
    ES->>ES: recall@k, precision@k, MRR, nDCG, leakage
  end
  ES->>DB: persist cases, metrics, config revision
  DB-->>UI: delta + failures + regression verdict
```

scope leakage 必须为 0；算法改动必须在 golden set 建立后进行；配置 revision 和数据集 revision 必须可追溯。

## 8. Analytics/Trace 下钻

```mermaid
sequenceDiagram
  actor U as Admin/Authorized User
  participant W as Analytics UI
  participant P as Panel
  participant A as Analytics Service
  participant C as ClickHouse/Telemetry

  U->>W: open /analytics
  W->>P: capability probe
  P-->>W: enabled + configured + role
  alt available
    W->>P: KPI/trend/member/model query
    P->>A: caller-aware query
    A->>C: aggregate redacted events
    C-->>W: metrics
    U->>W: drill down trace
    W->>P: trace detail(traceId)
    P-->>W: events/gaps/redacted payload
  else unavailable
    W-->>U: denied/feature-disabled/not-configured state
  end
```

Analytics 与 Code Analysis 是不同域：前者是线上调用、成本、成员、模型、trace 的可观测；后者是代码仓库分析。导航和术语不得混用。
