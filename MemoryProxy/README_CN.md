# MemoryProxy

MemoryProxy 是一个**透明的 LLM 请求代理**：把编码 Agent（Claude Code / CodeBuddy 等）原本直连大模型的请求，改为先经过它中转。它在转发前后自动完成会话初始化、记忆注入、对话回流等动作，让 Agent **无需改动一行代码**就能用上 [MemoryCore](../MemoryCore/README_CN.md) 提供的团队记忆、Skill 和 Knowledge。

对客户端和上游模型来说，它是“透明”的——不改变任何协议，原样转发 OpenAI `/v1/chat/completions` 和 Anthropic `/v1/messages`，只是在中转的这一进一出里，顺手做了这些事：**会话初始化、上下文注入、对话回流、鉴权与用量上报**。

> 一句话分工：MemoryProxy 管“接入与转发”，MemoryCore 管“记忆的存储与处理”。Proxy 自身不落记忆数据，所有 Memory / Skill / Knowledge 读写都经 MemoryCore Gateway（默认 `:8420`）完成。整体产品定位见仓库根 [README_CN.md](../README_CN.md)。

## 它在整个体系里的位置

```text
编码 Agent (Claude Code / CodeBuddy / ...)
        │  OpenAI / Anthropic 协议（不改动）
        ▼
   MemoryProxy :8096        ← 本项目（LLM 请求代理）
        │  会话初始化 / 注入 / 回流 / 鉴权 / 上报
        ├─────────────► 上游 LLM（TokenHub / OpenAI-compatible）
        │
        └─ HTTP API ─► MemoryCore Gateway :8420
                        ├─ Memory  L0 / L1 / L2 / L3
                        ├─ Skill   检索 / 归档 / 抽取
                        └─ Meta    Team / Agent / Task / Knowledge
```

## 核心能力

- **会话初始化**：首次对话时拦截请求，通过交互式表单引导用户选择 team → agent → task，完成后把 agent/task 上下文注入 system prompt。支持从请求头（`x-team-id` / `x-agent-id` / `x-task-id`）自动预选。
- **上下文注入**：把 Skill、Knowledge、Memory L2/L3 等按需注入 system prompt；L0/L1 通过只读工具接口暴露给模型主动查询，避免破坏上游 KV cache。
- **对话回流（提取）**：每轮真人对话结束时，把对话切片同步发到 MemoryCore `/v3/skill/conversation/add`（Skill 归档）并写入 L0 短期记忆，供 core 侧后台抽取。
- **鉴权与身份**：调用 MemoryCore `POST /v3/meta/auth/verify` 校验 `x-tdai-user-key`，解析出 `user_id` 作为全链路用户标识；`spaceId`（memory 实例 id）从 `/proxy/<spaceId>/...` 路径自动提取。
- **系统用户短路透传**：内部服务账号（如 memory / wiki 内部调用）命中后跳过 session init 和注入，只做透明转发 + 计费。
- **Skill Bridge / Memory Bridge**：反向代理 MemoryCore 的 skill / memory HTTP 工具，转发时注入 `serviceToken`，避免凭据出现在 LLM 可见的 prompt 中。
- **统一存储抽象（ProxyStorage）**：会话初始化状态、注入缓存与 Skill 状态（`inj:*` / `sk:*` / `vpin:*`）支持 Redis、COS（kernel-sts）、SQLite、FS、Memory 五种后端，多节点部署首选 COS。
- **Input TPM / QPM 限流**：按 `spaceId × 最终模型` 在 Redis 上做 60 秒滑动窗口限流，可通过 `/v3/admin/rate-limits` 动态调整。
- **可观测与用量上报**：Opik trace、Langfuse（一个 trace = 一个 turn）、ClickHouse（按 turn 记录 token 明细）三路互相独立，任一失败不影响业务。
- **Credit 计费上报**：每次上游响应完成后按定价表计算 CreditDelta 上报到计费服务；仅识别路径带 `/proxy/<spaceId>/` 的请求。
- **多节点部署**：结合外部 gateway 与 COS 后端支持多实例水平扩展；`/skill-bridge` 与 `/memory-bridge` 前缀由 gateway 原样透传到 proxy 实例。

## 请求处理流程

一次带 `spaceId` 的主模型调用大致经过以下阶段：

```text
POST /proxy/<spaceId>/v1/chat/completions | /v1/messages
   │
   ├─ 1. auth ─────── 校验 x-tdai-user-key，解析出 user_id
   ├─ 2. systemUser ─ 命中内部账号则短路透传
   ├─ 3. sessionInit ─ 首次对话弹表单：team → agent → task
   ├─ 4. injection ── system prompt 注入 skill / knowledge / memory
   ├─ 5. rateLimit ── spaceId × 最终模型 TPM/QPM 限流
   ├─ 6. forward ──── 转发到上游 LLM
   ├─ 7. extract ──── 一轮结束后异步回流 conversation + L0
   └─ 8. report ───── ClickHouse / Langfuse / Opik / Credit 上报
```

## 记忆层与注入策略

MemoryProxy 对齐 MemoryCore 的四层记忆结构，按“注入 + 工具化”两种方式接入 prompt：

| 层级 | 作用 | 接入方式 |
| --- | --- | --- |
| L0 | 短期对话记忆 | 每轮对话由 proxy 主动写回 MemoryCore |
| L1 | 会话级关键记忆 | 通过 `<tdai_memory_tools>` 工具让模型按需召回 |
| L2 | Agent Profile | 直接注入 system prompt |
| L3 | Team / Global 记忆 | 直接注入 system prompt |

Skill 与 Knowledge 沿用同样的思路：

- `<cloud_skills>` —— 从 MemoryCore RAG 检索到的相关 Skill 摘要
- `<skill_tools>` —— 告诉模型如何通过 curl 调用 Skill 的说明块（读写权限由 `skillRuntime.allowLlmWrite` 控制）
- `<knowledge_tools>` —— 团队知识资源（Wiki / CodeGraph）两步自发现工具
- `<session_context>` —— session init 完成后每轮追加的 agent/task 信息

## 环境要求

- Node.js `v22.x`（启动时强校验；推荐 `>= 22.16.0`）
- npm 或 pnpm
- 一个已运行的 **MemoryCore Gateway**（默认 `:8420`），提供 Auth / Skill / Meta / Memory API
- Redis（默认承载会话/注入/Skill 状态；启用 `storage.enabled=true` 后可切换到其他后端）
- 一个 OpenAI-compatible 上游 LLM API（TokenHub 或其他）

## 快速开始

### 1. 安装依赖

```bash
cd MemoryProxy
npm install
```

### 2. 创建配置

基于示例配置创建自己的 `config.yaml`：

```bash
cp config.example.yaml config.yaml
# 按需修改 upstream / auth / tdai / skill / storage 等段
```

至少需要确认这几项：

- `upstream.url` / `upstream.apiKey` —— 上游 LLM 地址与凭据
- `auth.url` / `tdai.endpoint` / `skill.endpoint` —— 指向你的 MemoryCore Gateway（默认 `http://127.0.0.1:8420`）

> **本地无 Redis 快速跑通**：示例配置默认 `redis.enabled: true`，本机没起 Redis 时会持续刷 `ECONNREFUSED 127.0.0.1:6379`。纯本地开发建议改为 `redis.enabled: false` + `storage.enabled: true`（`storage.backend: sqlite`），会话/注入/Skill 状态改走本地 SQLite，启动即干净。

### 3. 启动服务

```bash
npm run start:config
# 等价于：
node --import tsx/esm src/index.ts --config config.yaml
```

### 4. 健康检查

```bash
curl http://127.0.0.1:8096/health
```

返回示例（`storage.effective` 是存储后端的观测锚点）：

```json
{
  "status": "ok",
  "version": "0.2.0",
  "upstream": "https://tokenhub.example.com/v1",
  "storage": { "enabled": false, "requested": "sqlite", "effective": "sqlite", "degraded": false }
}
```

## 启动方式

```bash
# 直接启动（使用内置默认值，不推荐生产）
npm start

# 指定配置文件
npm run start:config

# CLI 参数覆盖（优先级最高）
node --import tsx/esm src/index.ts --port 9000 --upstream https://other.api/v1

# 开发模式（文件变更自动重启）
npm run dev:config
```

### 后台管理脚本 `proxy.sh`

固定使用 `./config.yaml`，自动查找 `node` 路径（兼容 nvm / fnm），日志按日期写入 `logs/YYYY-MM-DD.log`。

```bash
./proxy.sh start          # 后台启动
./proxy.sh stop           # 停止
./proxy.sh restart        # 重启
./proxy.sh status         # 查看运行状态（含 /health 输出）
./proxy.sh log            # tail 今日日志

./proxy.sh daemon         # 守护进程模式（崩溃自动拉起）
./proxy.sh daemon-stop
./proxy.sh daemon-status
```

## 客户端配置

把编码 Agent 的上游地址指向本代理，其余字段（`apiKey`、`model` 等）保持不变。请求路径推荐带上 `spaceId`（memory 实例 id），proxy 会自动提取用于鉴权、注入与计费。

OpenAI 兼容客户端：

```json
{
  "apiKey": "sk-mem-xxx",
  "url": "http://localhost:8096/proxy/<spaceId>/v1/chat/completions"
}
```

Anthropic Messages 客户端：

```json
{
  "apiKey": "sk-mem-xxx",
  "url": "http://localhost:8096/proxy/<spaceId>/v1/messages"
}
```

## 主要 HTTP 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/proxy/<spaceId>/v1/chat/completions` | OpenAI 兼容主模型调用（带 memory 实例 id） |
| `POST` | `/proxy/<spaceId>/v1/messages` | Anthropic Messages 主模型调用 |
| `POST` | `/v1/messages` | Anthropic Messages API（无 spaceId 兜底） |
| `POST` | `/*` | OpenAI 兼容聊天接口（catch-all） |
| `ALL`  | `/skill-bridge/**` | 反向代理 MemoryCore skill HTTP 工具 |
| `ALL`  | `/memory-bridge/**` | 反向代理 MemoryCore memory HTTP 工具 |
| `POST` | `/v3/instance/proxy-destroy` | 运维口：实例销毁时清 COS 缓存 |
| `GET/PUT/DELETE` | `/v3/admin/rate-limits` | 查询 / 修改实例 × 模型 TPM/QPM |
| `GET`  | `/health` | 运行时健康检查（含 `storage.effective`） |
| `GET`  | `/whoami` | API Key → keyId（纯文本，便于 curl） |

## 配置说明

完整带注释的示例见 [`config.example.yaml`](./config.example.yaml)。配置优先级：**CLI 参数 > YAML 配置文件 > 内置默认值**。

各配置段速览：

| 段 | 作用 |
| --- | --- |
| `server` | 监听 host / port、上游转发超时 |
| `upstream` | 默认上游 URL 与全局 `apiKey`（非空则替换转发请求鉴权） |
| `log` | 日志目录、级别、后端与轮转策略 |
| `redis` | 会话 / 注入 / Skill 状态默认后端；不启用 `storage.enabled` 时使用 |
| `storage` | 统一存储抽象（`cos` / `sqlite` / `fs` / `memory`），多节点部署首选 `cos` |
| `auth` | `x-tdai-user-key` → `user_id` 校验（调用 MemoryCore `/v3/meta/auth/verify`） |
| `admin` | 运维端点（如 `/v3/instance/proxy-destroy`）的 shared secret |
| `systemUsers` | 内部服务账号，命中后短路透传 |
| `injection` | 上下文注入总开关与 injector 列表（`skill` / `knowledge` / `tdai-memory`） |
| `extraction` | 对话回流总开关（skill 归档 + L0 写入） |
| `sessionInit` | 会话初始化表单流程、header 自动预选策略 |
| `tdai` | MemoryCore 连接与 L0/L1/L2/L3 开关 |
| `skill` | MemoryCore 数据面配置（Skill RAG、Skill 归档、Meta） |
| `knowledge` | 独立的 knowledge gateway（可与 skill 不同） |
| `skillRuntime` | 是否允许主模型写 Skill（默认只读） |
| `rateLimit` | Memory 实例 × 实际模型的 Input TPM / QPM 限流 |
| `clickhouse` | 按 turn 的用量上报（计费数据源） |
| `creditReport` / `creditPricing` | Credit 计费上报与定价表 |
| `upstream.agents` | 按 agent name 覆盖上游 URL + apiKey（如 `claude-code` 单独走 CCR） |

> `injection`、`extraction`、`sessionInit`、`tdai`、`skill`、`knowledge`、`skillRuntime` 是与“记忆”直接相关的配置段，接入时优先关注它们。

### 常用环境变量

```bash
TDAI_MEMORY_SYSTEM_USER_ID   # memory 内部服务账号 user_id
TDAI_MEMORY_SYSTEM_USER_KEY  # memory 内部服务账号 apiKey（仅供运维查看）
TDAI_PROXY_ADMIN_API_KEY     # 运维端点鉴权 shared secret
PROXY_DB_PATH                # sqlite 后端 db 路径（storage.sqlite.dbPath 未配时使用）
```

## 存储后端选型

`storage.enabled=true` 后所有会话/注入/Skill 状态（`inj:*` / `sk:*` / `vpin:*`）走 ProxyStorage：

| 后端 | 适用场景 | 说明 |
| --- | --- | --- |
| `cos` | 生产多实例部署 | 跨节点共享；仅支持 kernel-sts（每 spaceId 一份临时凭证） |
| `sqlite` | 单实例本地开发 / CI | 内置 sweeper 定时清 `ttl/` 桶；`nottl/` 桶永久保留 |
| `fs` | 离线 / docker 兜底 | 无 sweeper，交给外部 tmpwatch |
| `memory` | 兜底 / 测试 | 进程重启即清 |

Key 布局统一为 `proxy_cache/{ttl|nottl}/{spaceId}/{userId}/{agentSource}/{sessionId}/...`；`ttl/` 只放热缓存（可重建），`nottl/` 放 binding 等必须持久化的业务态。

降级链：`cos → sqlite → fs → memory`。任一后端 init 失败自动降级，`/health` 端点会暴露 `storage.effective` 作为观测锚点。

## Docker

镜像用 tsx 直接运行 TypeScript，以 `tini` 作 PID 1、非 root 用户运行，内置 `/health` 的 `HEALTHCHECK`。多阶段构建需启用 BuildKit。

在 `MemoryProxy/` 目录构建：

```bash
DOCKER_BUILDKIT=1 docker build -t memory-proxy:local .
```

启动容器（配置文件通过挂载 `/data/config.yaml` 提供；sqlite 存储持久化到 `/data/tdai-memory-proxy`）：

```bash
docker run --rm \
  -p 8096:8096 \
  -v "$PWD/config.yaml:/data/config.yaml:ro" \
  -v tdai-proxy-data:/data/tdai-memory-proxy \
  -e TDAI_PROXY_ADMIN_API_KEY="replace-with-a-strong-random-token" \
  memory-proxy:local
```

- 配置文件默认路径 `/data/config.yaml`，可在 `docker run` 末尾追加 `--config /other/path.yaml` 覆盖。
- 通过环境变量或 Secret Manager 注入凭证，不要把 API Key / STS 凭证写入镜像和配置仓库。
- 健康检查：`docker inspect --format '{{.State.Health.Status}}' <container>`。

## 目录结构

```text
MemoryProxy/
  src/
    index.ts / server.ts              入口与 HTTP 路由
    handler.ts / anthropicHandler.ts  OpenAI / Anthropic 请求处理器
    auth.ts / identity.ts             用户身份与鉴权
    systemUser.ts / systemUserPassthrough.ts  内部账号短路透传
    session/                          会话初始化：表单流程、状态存储、Claude Code / CodeBuddy 适配
    injection/                        注入 pipeline：skill / knowledge / tdai-memory 等 injector
    skill/                            Skill Bridge、conversation/add 归档触发、版本 pin
    memory/                           Memory Bridge 反向代理
    knowledge/ / meta/                MemoryCore knowledge / metadata 客户端
    tdai/                             Memory L0/L1/L2/L3 客户端、pending write 队列
    storage/                          ProxyStorage 抽象（cos / sqlite / fs / memory）
    db/                               会话 / 注入 / Skill 状态持久化 Repo
    rate-limit/                       Input TPM / QPM 限流
    routes/                           管理端点（admin-auth / instance-destroy / rate-limits）
    clickhouse.ts / langfuse.ts / opik.ts  三路可观测上报
    credit-reporter.ts / pricing.ts   Credit 计费上报与定价
    report/ / logger.ts               结构化日志系统与 JSONL 用量日志
  gateway/                            可选负载均衡网关（keyId 一致性 hash）
  docs/                               架构、设计文档与 e2e runbook
  scripts/                            冒烟、迁移、维护脚本
  config.example.yaml                 带注释的完整配置示例
  Dockerfile                          MemoryProxy 镜像
  proxy.sh                            后台启动 / 守护脚本
  package.json
```

## 运行测试

```bash
npm test              # vitest run（默认单元 + 集成）
npm run test:watch
```

`__tests__/` 分布在各子模块下：`session/__tests__`（会话流程）、`skill/__tests__`（归档触发、版本 pin）、`storage/__tests__`（各后端契约）、`db/__tests__`（Repo 一致性）等。`docs/` 还提供多份端到端 runbook（`e2e-runbook.md` / `e2e-full-coverage-runbook.md` 等），用于在真实 MemoryCore + Redis + Storage 后端上验证记忆链路。

## PenguinHarness 集成

MemoryProxy 是 [PenguinHarness](https://github.com/.../penguin-harness)（自进化编码 Agent 框架）的主要集成入口。集成后，PenguinHarness 将 TencentDB Agent Memory 作为其持久化记忆后端，覆盖**记忆双向同步、多项目身份、Skill 沉淀、历史导入、知识访问**。

### 架构

```text
PenguinHarness (7368)                 TencentDB Agent Memory
  ├─ L1 镜像 (tencentdb-*.md) ───┐   MemoryCore Gateway (8420)
  │   (方案 3: L1 走 penguin)    │     ├─ L0–L3 记忆流水线
  │                              │     ├─ Skill 管理
  ├─ L2/L3 注入 ─────────────────┼──► MemoryProxy (8096)
  │   (经 proxy)                 │       ├─ injection: skill,knowledge,tdai-memory
  │                              │       ├─ auth verify → gateway
  ├─ Skill 发布 ─────────────────┤       └─ write-back: conversation/add
  │                              │
  ├─ Trace 导入 ─────────────────┤     MemoryKnowledge (8421)
  │                              │       ├─ Wiki / CodeGraph 工具
  └─ Knowledge 工具 ─────────────┘       └─ tools/list → tools/call
                                 MemoryPanel (8123)
                                   ├─ 资产管理
                                   └─ 知识资源创建
```

### 集成事项总览

| 事项 | 说明 | 状态 |
|------|------|------|
| 1. 记忆双向回写 | penguin 原生记忆 push 到 TDAI | ✅ |
| 2. 会话级身份 | 每项目独立 TDAI team/agent/user | ✅ |
| 3. Skill 沉淀 | penguin skill → TDAI 资产库 | ✅ |
| 4. Trace 批量导入 | 历史会话导入 TDAI 冷启动 | ✅ |
| 5. 删除语义 | 本地删除同步远端 atomic/delete | ✅ |
| 6. Knowledge 知识库 | Wiki/CodeGraph 通过 proxy 注入 | ✅ 基础设施就绪 |
| 7. 镜像即时同步 | Task 启动时 auto-pull L1 | ✅ |
| 8. 用户管理 | penguin 用户 ↔ TDAI ACL | 🛑 阻塞（网关缺 API） |

### 启动所有服务

```bash
# 1. 启动 MemoryCore Gateway（Node 22）
cd MemoryCore
export PATH="../MemoryProxy/.tools/node22/bin:$PATH"
export TDAI_LLM_API_KEY="sk-your-llm-key"
export TDAI_LLM_BASE_URL="https://api.deepseek.com/v1"
export TDAI_LLM_MODEL="deepseek-chat"
node --import tsx src/gateway/server.ts > /tmp/tdai-gateway.log 2>&1 &

# 2. 启动 MemoryProxy（Node 22）
cd MemoryProxy
export PATH=".tools/node22/bin:$PATH"
pnpm dev > /tmp/proxy-dev.log 2>&1 &

# 3. 启动 MemoryKnowledge（Node 22）
cd MemoryKnowledge
export PATH="../MemoryProxy/.tools/node22/bin:$PATH"
pnpm dev > /tmp/knowledge-dev.log 2>&1 &

# 4. 启动 MemoryPanel（Node 22）
cd MemoryPanel
export PATH="../MemoryProxy/.tools/node22/bin:$PATH"
pnpm dev > /tmp/panel-dev.log 2>&1 &

# 5. 启动 PenguinHarness（Node 24）
cd penguin-harness
export PATH=".tools/node24/bin:$PATH"
TENCENTDB_MEMORY_ENABLED=1 \
TENCENTDB_MEMORY_CORE_URL="http://127.0.0.1:8420/v1" \
TENCENTDB_MEMORY_PROXY_URL="http://127.0.0.1:8096" \
TENCENTDB_MEMORY_TEAM_ID="team-xxx" \
TENCENTDB_MEMORY_AGENT_ID="agent-xxx" \
TENCENTDB_MEMORY_TASK_ID="task-xxx" \
TENCENTDB_MEMORY_USER_ID="user-xxx" \
TENCENTDB_MEMORY_USER_KEY="sk-user-key" \
TENCENTDB_MEMORY_AUTO_PULL=1 \
TENCENTDB_MEMORY_PUSH_NATIVE=1 \
TENCENTDB_MEMORY_DELETE_REMOTE=1 \
pnpm dev > /tmp/penguin-dev.log 2>&1 &
```

### 验证命令

启动后逐项验证：

```bash
# ── 所有服务健康检查 ──
for port in 8420 8096 8421 8123 7368; do
  echo "port $port: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/health)"
done
# 预期: 8420=200, 8096=200, 8421=200, 8123=200, 7368=302

# ── 事项 1: 记忆双向回写 ──
# Push 原生记忆（通过 penguin memory sync push）
curl -s -X POST http://127.0.0.1:7368/api/tencentdb/sync/push \
  -H "Cookie: session=<valid-session>"

# ── 事项 2: 会话级身份 ──
# 在 .project_config.toml 中配置:
#   [tencentdb_memory]
#   team_id = "team-xxx"
#   agent_id = "agent-xxx"
# 验证: 不同项目各自请求携带不同身份头

# ── 事项 3: Skill 管理 ──
# 查看 TDAI 侧已有 Skill
curl -s -X POST http://127.0.0.1:8420/v3/skill/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-mem-admin-key-xxx" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"team_id":"team-xxx"}' | python3 -m json.tool

# ── 事项 4: 会话/对话查询 ──
curl -s -X POST http://127.0.0.1:8420/v3/conversation/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-mem-admin-key-xxx" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"team_id":"team-xxx","limit":3}' | python3 -m json.tool

# ── 事项 5: 删除语义 ──
# 删除镜像文件后 push → 网关 atomic/delete 被调用
# 开关: TENCENTDB_MEMORY_DELETE_REMOTE=1

# ── 事项 6: Knowledge 知识库 ──
# 查看知识资源列表
curl -s -X POST http://127.0.0.1:8420/v3/knowledge/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-mem-admin-key-xxx" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"team_id":"team-xxx"}' | python3 -m json.tool
# 预期: items=[], total=0（无资源时优雅降级，不注入空块）

# 查看 tools/list（需要 knowledge_id）
curl -s -X POST http://127.0.0.1:8421/v3/tools/list \
  -H "Content-Type: application/json" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"knowledge_ids":[]}' | python3 -m json.tool
# 预期: 400, "knowledge_id is required"

# ── 事项 7: 镜像即时同步 ──
# 确认 auto-pull 代码已加载
grep "auto-pull on task start" penguin-harness/packages/server/src/http/routes/sessions.ts
# 预期: 2 occurrences（goal 模式 + 普通 task 各一处）

# 确认环境变量已设置
ps aux | grep penguin | grep -o "TENCENTDB_MEMORY_AUTO_PULL=[^ ]*"
# 预期: TENCENTDB_MEMORY_AUTO_PULL=1

# ── Proxy 注入管线验证 ──
grep "injection" /tmp/proxy-dev.log | grep "skill,knowledge,tdai-memory"
# 预期: injection: skill,knowledge,tdai-memory
```

### 配置参考

#### MemoryProxy config.yaml（关键段）

```yaml
# 注入管线：必须包含 knowledge 才能启用知识工具注入
injection:
  injectors: ["skill", "knowledge", "tdai-memory"]

# TDAI Gateway 连接
tdai:
  endpoint: "http://127.0.0.1:8420"

# Knowledge 独立服务
knowledge:
  enabled: true
  serviceId: "memory-proxy"
  endpoint: "http://127.0.0.1:8421"
```

#### PenguinHarness 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TENCENTDB_MEMORY_ENABLED` | 总开关 | `0` |
| `TENCENTDB_MEMORY_CORE_URL` | TDAI Gateway 地址 | — |
| `TENCENTDB_MEMORY_PROXY_URL` | MemoryProxy 地址 | — |
| `TENCENTDB_MEMORY_TEAM_ID` | 团队 ID | — |
| `TENCENTDB_MEMORY_AGENT_ID` | Agent ID | — |
| `TENCENTDB_MEMORY_TASK_ID` | Task ID | — |
| `TENCENTDB_MEMORY_USER_ID` | 用户 ID | — |
| `TENCENTDB_MEMORY_USER_KEY` | 用户密钥 | — |
| `TENCENTDB_MEMORY_AUTO_PULL` | 自动拉取镜像 (1=开启) | `1` |
| `TENCENTDB_MEMORY_PUSH_NATIVE` | 推送原生记忆 (1=开启) | `1` |
| `TENCENTDB_MEMORY_DELETE_REMOTE` | 删除同步远端 (1=开启) | `1` |

各项也可在 `.project_config.toml` 的 `[tencentdb_memory]` 段中按项目配置，优先级高于环境变量。

### 已知限制

- **事项 6**：Knowledge 完整链路需要 Panel 侧创建知识资源（Wiki/CodeGraph）并完成 LLM 抽取，当前 gateway 返回 0 items，注入器优雅降级为不注入。
- **事项 8**：TDAI 网关 `/v3/internal/meta/` 仅提供 `user/init-admin` 和 `user/list-by-instance`，不支持通用用户 CRUD，penguin 用户管理暂无法同步到 TDAI ACL。需在网关侧扩展接口或 penguin 侧维护独立映射表。

## PenguinHarness 集成

MemoryProxy 是 [PenguinHarness](https://github.com/.../penguin-harness)（自进化编码 Agent 框架）的主要集成入口。集成后，PenguinHarness 将 TencentDB Agent Memory 作为其持久化记忆后端，覆盖**记忆双向同步、多项目身份、Skill 沉淀、历史导入、知识访问**。

### 架构

```text
PenguinHarness (7368)                 TencentDB Agent Memory
  ├─ L1 镜像 (tencentdb-*.md) ───┐   MemoryCore Gateway (8420)
  │   (方案 3: L1 走 penguin)    │     ├─ L0–L3 记忆流水线
  │                              │     ├─ Skill 管理
  ├─ L2/L3 注入 ─────────────────┼──► MemoryProxy (8096)
  │   (经 proxy)                 │       ├─ injection: skill,knowledge,tdai-memory
  │                              │       ├─ auth verify → gateway
  ├─ Skill 发布 ─────────────────┤       └─ write-back: conversation/add
  │                              │
  ├─ Trace 导入 ─────────────────┤     MemoryKnowledge (8421)
  │                              │       ├─ Wiki / CodeGraph 工具
  └─ Knowledge 工具 ─────────────┘       └─ tools/list → tools/call
                                 MemoryPanel (8123)
                                   ├─ 资产管理
                                   └─ 知识资源创建
```

### 集成事项总览

| 事项 | 说明 | 状态 |
|------|------|------|
| 1. 记忆双向回写 | penguin 原生记忆 push 到 TDAI | ✅ |
| 2. 会话级身份 | 每项目独立 TDAI team/agent/user | ✅ |
| 3. Skill 沉淀 | penguin skill → TDAI 资产库 | ✅ |
| 4. Trace 批量导入 | 历史会话导入 TDAI 冷启动 | ✅ |
| 5. 删除语义 | 本地删除同步远端 atomic/delete | ✅ |
| 6. Knowledge 知识库 | Wiki/CodeGraph 通过 proxy 注入 | ✅ 基础设施就绪 |
| 7. 镜像即时同步 | Task 启动时 auto-pull L1 | ✅ |
| 8. 用户管理 | penguin 用户 ↔ TDAI ACL | 🛑 阻塞（网关缺 API） |

### 启动所有服务

```bash
# 1. 启动 MemoryCore Gateway（Node 22）
cd MemoryCore
export PATH="../MemoryProxy/.tools/node22/bin:$PATH"
export TDAI_LLM_API_KEY="sk-your-llm-key"
export TDAI_LLM_BASE_URL="https://api.deepseek.com/v1"
export TDAI_LLM_MODEL="deepseek-chat"
node --import tsx src/gateway/server.ts > /tmp/tdai-gateway.log 2>&1 &

# 2. 启动 MemoryProxy（Node 22）
cd MemoryProxy
export PATH=".tools/node22/bin:$PATH"
pnpm dev > /tmp/proxy-dev.log 2>&1 &

# 3. 启动 MemoryKnowledge（Node 22）
cd MemoryKnowledge
export PATH="../MemoryProxy/.tools/node22/bin:$PATH"
pnpm dev > /tmp/knowledge-dev.log 2>&1 &

# 4. 启动 MemoryPanel（Node 22）
cd MemoryPanel
export PATH="../MemoryProxy/.tools/node22/bin:$PATH"
pnpm dev > /tmp/panel-dev.log 2>&1 &

# 5. 启动 PenguinHarness（Node 24）
cd penguin-harness
export PATH=".tools/node24/bin:$PATH"
TENCENTDB_MEMORY_ENABLED=1 \
TENCENTDB_MEMORY_CORE_URL="http://127.0.0.1:8420/v1" \
TENCENTDB_MEMORY_PROXY_URL="http://127.0.0.1:8096" \
TENCENTDB_MEMORY_TEAM_ID="team-xxx" \
TENCENTDB_MEMORY_AGENT_ID="agent-xxx" \
TENCENTDB_MEMORY_TASK_ID="task-xxx" \
TENCENTDB_MEMORY_USER_ID="user-xxx" \
TENCENTDB_MEMORY_USER_KEY="sk-user-key" \
TENCENTDB_MEMORY_AUTO_PULL=1 \
TENCENTDB_MEMORY_PUSH_NATIVE=1 \
TENCENTDB_MEMORY_DELETE_REMOTE=1 \
pnpm dev > /tmp/penguin-dev.log 2>&1 &
```

### 验证命令

启动后逐项验证：

```bash
# ── 所有服务健康检查 ──
for port in 8420 8096 8421 8123 7368; do
  echo "port $port: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/health)"
done
# 预期: 8420=200, 8096=200, 8421=200, 8123=200, 7368=302

# ── 事项 1: 记忆双向回写 ──
# Push 原生记忆（通过 penguin memory sync push）
curl -s -X POST http://127.0.0.1:7368/api/tencentdb/sync/push \
  -H "Cookie: session=<valid-session>"

# ── 事项 2: 会话级身份 ──
# 在 .project_config.toml 中配置:
#   [tencentdb_memory]
#   team_id = "team-xxx"
#   agent_id = "agent-xxx"
# 验证: 不同项目各自请求携带不同身份头

# ── 事项 3: Skill 管理 ──
# 查看 TDAI 侧已有 Skill
curl -s -X POST http://127.0.0.1:8420/v3/skill/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-mem-admin-key-xxx" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"team_id":"team-xxx"}' | python3 -m json.tool

# ── 事项 4: 会话/对话查询 ──
curl -s -X POST http://127.0.0.1:8420/v3/conversation/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-mem-admin-key-xxx" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"team_id":"team-xxx","limit":3}' | python3 -m json.tool

# ── 事项 5: 删除语义 ──
# 删除镜像文件后 push → 网关 atomic/delete 被调用
# 开关: TENCENTDB_MEMORY_DELETE_REMOTE=1

# ── 事项 6: Knowledge 知识库 ──
# 查看知识资源列表
curl -s -X POST http://127.0.0.1:8420/v3/knowledge/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-mem-admin-key-xxx" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"team_id":"team-xxx"}' | python3 -m json.tool
# 预期: items=[], total=0（无资源时优雅降级，不注入空块）

# 查看 tools/list（需要 knowledge_id）
curl -s -X POST http://127.0.0.1:8421/v3/tools/list \
  -H "Content-Type: application/json" \
  -H "x-tdai-service-id: memory-proxy" \
  -d '{"knowledge_ids":[]}' | python3 -m json.tool
# 预期: 400, "knowledge_id is required"

# ── 事项 7: 镜像即时同步 ──
# 确认 auto-pull 代码已加载
grep "auto-pull on task start" penguin-harness/packages/server/src/http/routes/sessions.ts
# 预期: 2 occurrences（goal 模式 + 普通 task 各一处）

# 确认环境变量已设置
ps aux | grep penguin | grep -o "TENCENTDB_MEMORY_AUTO_PULL=[^ ]*"
# 预期: TENCENTDB_MEMORY_AUTO_PULL=1

# ── Proxy 注入管线验证 ──
grep "injection" /tmp/proxy-dev.log | grep "skill,knowledge,tdai-memory"
# 预期: injection: skill,knowledge,tdai-memory
```

### 配置参考

#### MemoryProxy config.yaml（关键段）

```yaml
# 注入管线：必须包含 knowledge 才能启用知识工具注入
injection:
  injectors: ["skill", "knowledge", "tdai-memory"]

# TDAI Gateway 连接
tdai:
  endpoint: "http://127.0.0.1:8420"

# Knowledge 独立服务
knowledge:
  enabled: true
  serviceId: "memory-proxy"
  endpoint: "http://127.0.0.1:8421"
```

#### PenguinHarness 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TENCENTDB_MEMORY_ENABLED` | 总开关 | `0` |
| `TENCENTDB_MEMORY_CORE_URL` | TDAI Gateway 地址 | — |
| `TENCENTDB_MEMORY_PROXY_URL` | MemoryProxy 地址 | — |
| `TENCENTDB_MEMORY_TEAM_ID` | 团队 ID | — |
| `TENCENTDB_MEMORY_AGENT_ID` | Agent ID | — |
| `TENCENTDB_MEMORY_TASK_ID` | Task ID | — |
| `TENCENTDB_MEMORY_USER_ID` | 用户 ID | — |
| `TENCENTDB_MEMORY_USER_KEY` | 用户密钥 | — |
| `TENCENTDB_MEMORY_AUTO_PULL` | 自动拉取镜像 (1=开启) | `1` |
| `TENCENTDB_MEMORY_PUSH_NATIVE` | 推送原生记忆 (1=开启) | `1` |
| `TENCENTDB_MEMORY_DELETE_REMOTE` | 删除同步远端 (1=开启) | `1` |

各项也可在 `.project_config.toml` 的 `[tencentdb_memory]` 段中按项目配置，优先级高于环境变量。

### 已知限制

- **事项 6**：Knowledge 完整链路需要 Panel 侧创建知识资源（Wiki/CodeGraph）并完成 LLM 抽取，当前 gateway 返回 0 items，注入器优雅降级为不注入。
- **事项 8**：TDAI 网关 `/v3/internal/meta/` 仅提供 `user/init-admin` 和 `user/list-by-instance`，不支持通用用户 CRUD，penguin 用户管理暂无法同步到 TDAI ACL。需在网关侧扩展接口或 penguin 侧维护独立映射表。

## 安全与发布注意事项

- 非回环地址监听或多节点部署时，必须启用 `auth.enabled=true`，并通过 env 注入 `TDAI_PROXY_ADMIN_API_KEY` 保护运维口。
- 所有 Secret 通过环境变量或 Secret Manager 注入；不要把真实 `apiKey` / `serviceToken` / STS 凭证 / 计费 URL 提交进配置仓库。
- 部署到多节点时必须使用 `storage.backend=cos` 并显式配置 `injection.externalGatewayUrl`，否则每个实例各自缓存会导致上游 KV cache miss。
- 不要提交生成数据、本地数据库、日志或环境变量文件（`logs/`、`*.db`、`.env`、`dump.rdb`、`session*.json`、`*.pid` 等）。

## License

MIT
