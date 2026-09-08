# PenguinHarness ↔ TencentDB Agent Memory 深度打通执行计划（事项 1–8）

> 前置上下文：桥接已具备 ①L1 镜像双向 sync（方案3 分工：L1 走 penguin 镜像、L2/L3 走 proxy 注入）
> ②身份头透传（方案 B trustIdentityHeaders）③memory 挂 → proxy 降级、proxy 挂 → 供应商直连
> ④会话创建 auto-pull。本计划补齐记忆回写、多项目身份、Skill 沉淀、历史导入、删除语义。
>
> 目标仓库：
> - penguin-harness：`/home/malizhi/project/penguin-harness`（Node 24，`PATH=…/.tools/node24/bin:$PATH`）
> - TDAI：`/home/malizhi/project/TencentDB-Agent-Memory`（MemoryProxy Node 22，`…/.tools/node22/bin`）

## 依赖与建议执行顺序

```
事项1 记忆双向回写 ─┐
事项2 会话级身份   ─┼→ 事项5 删除语义 → 事项3 Skill 沉淀 → 事项4 Trace 批量导入
                    │   （1/5 同域：client 扩展）
```
理由：1、2 无相互依赖，可并行；5 复用 1 的 client 扩展；3、4 相对独立且更贴近"资产化"愿景，
放中后段。每事项独立可验收、可独立发布。

---

## 事项 1：penguin 原生记忆 → 推回 TDAI（记忆真正双向流动）

**目标**：penguin 自己写的原生 markdown 记忆（`memory/user/*.md` 非镜像主题）也能 push 进 TDAI，
成为团队记忆资产。兑现 TDAI README"经验沉淀、流动"承诺。

**现状落点**（已核实）：
- `packages/server/src/services/tencentdb-memory-sync-service.ts`：
  - `mirrorEntries()` 只收 `tencentdb-*.md`（`TENCENTDB_MIRROR_PREFIX` 过滤）→ 原生文件不在 push 范围。
  - `push()` 已有"无 externalId → `addConversationMemory(body)` + `recordPushedLocal` 去重"分支
    （面向镜像命名空间内的本地新增），可复用该机制。
- `tencentdb-memory-client.ts`：`addConversationMemory(content)` → `POST /v3/conversation/add`
  `{session_id, messages:[{role:"user", content, timestamp}]}`。

**任务**：
- [ ] 1.1 新增 `nativeEntries(dir)`：列出 user scope 下 `*.md` 且非 `tencentdb-*` 且非 `MEMORY.md`
      的文件（`parseMirrorMarkdown` 返回 null 即视为原生文件，复用现有 `MirrorEntry` 结构）。
- [ ] 1.2 `push()` 增加原生文件遍历：`localBody(content)` 提取正文 → `addConversationMemory` →
      `recordPushedLocal`（checksum 去重，避免同文件重复提交）。
- [ ] 1.3 开关：`TENCENTDB_MEMORY_PUSH_NATIVE`（默认 `1`）；`0` 时仅推镜像文件（行为不变）。
- [ ] 1.4 测试（`packages/server/test/memory-tencentdb-sync.test.ts` 追加）：
      本地新建 `my-note.md` → push → 断言 gateway 收到 `conversation/add`（fake fetch 校验 payload）；
      重复 push 不重复提交（checksum 生效）。
- [ ] 1.5 联调：真实 push → 网关 `conversation/query` 可见该条；等 L1 pipeline 提炼。

**验收**：penguin Memory 页新建原生主题 → 点 push → TDAI 侧对话可查 → 后续 auto-pull 不回写冲突
（原生文件与镜像文件命名空间天然隔离，无 externalId 不参与 pull 覆盖）。

---

## 事项 2：会话级身份映射（per-project TDAI 身份）

**目标**：不同 penguin 项目各自绑定自己的 TDAI `team/agent/task/user`，记忆隔离、互不串味。

**现状落点**（已核实）：
- 身份是进程级 env：`TENCENTDB_MEMORY_TEAM_ID/AGENT_ID/TASK_ID/USER_ID/USER_KEY`。
- `packages/core/src/agent.ts`（~L676）`memoryHeaders` 直接读 `process.env`，所有项目同一身份。
- `tencentdb-memory-sync-service.ts` 构造器同样从 `process.env` 固化 `clientConfig`（单例）。
- 方案 B 头机制（`x-team-id` 等）已支持任意身份，只缺"每个项目配自己的"入口。

**方案**：`.project_config.toml` 新增可选 `[tencentdb_memory]` 段
（`team_id/agent_id/task_id/user_id/user_key`）；优先级 **project 配置 > env**。

**任务**：
- [ ] 2.1 core `state/project-config.ts`：`ProjectConfig` 增加 `tencentdb_memory?: {...}` 类型 +
      `parseDefaultChat` 同款宽松解析（字段缺失/非法 → 丢弃该字段，不阻断加载）。
- [ ] 2.2 `agent.ts`：`memoryHeaders` 改为"session 的 projectConfig.tencentdb_memory 优先，缺失回退
      process.env"；`TENCENTDB_MEMORY_ENABLED` 语义不变（总开关）。
- [ ] 2.3 sync service：`clientConfig` 从单例 env 改为按 `(projectId)` 解析——构造时保留 env 默认，
      新增 `clientFor(projectId)`：读该 project 的 toml 身份覆盖 env；`unavailableReason()` 同步调整。
- [ ] 2.4 （可选）Panel/项目设置 UI 增加身份配置表单（server DTO + web 页），低优先级，先支持手改 toml。
- [ ] 2.5 测试：两个项目分别配不同 team_id → 断言 sync client 与 memoryHeaders 各自命中。

**验收**：`tencentdb_agent_memory` 与另一项目配不同 TDAI team/agent 后，各自 pull/push/注入互不影响。

**风险**：身份配置属敏感信息（user_key 进 toml，同 api_key 一样 mode 0600）；`memoryHeaders` 构建在
Session 创建时，中途改身份要等新 Session（与现有模型 credential 语义一致）。

---

## 事项 3：penguin 自进化 Skill → TDAI 资产库

**目标**：penguin 优化出的满意 Skill 版本沉淀为 TDAI Skill 资产（版本/资源/团队配装/ACL），
实现"penguin 负责进化、TDAI 负责沉淀分发"。

**现状落点**（已核实）：
- penguin skill 存储：`agent_state/skills/<name>/SKILL.md`（+资源文件）；自进化闭环产出新版本。
- TDAI 写接口：`POST /v3/skill/create`、`POST /v3/skill/update`（`gateway/skill-handlers.ts` L1140）；
  proxy 的 skill-bridge 已能把 TDAI skill 注入 penguin 对话（只读方向已通）。

**方案**：新增发布路径——读取 penguin SKILL.md（frontmatter + 正文）→ 映射为 TDAI skill 资产
（name/description/content/version），身份走方案 B 头。

**任务**：
- [ ] 3.1 确认 TDAI `skill/create` 精确 payload（字段名/owner/visibility 默认值）与返回结构
      （读 `skill-handlers.ts` handleCreate + 相关类型）。
- [ ] 3.2 penguin 新增 `SkillPublishService`（`packages/server/src/services/`）：
      读 `agent_state/skills/<name>/SKILL.md`（frontmatter: name/description/version）→
      组装 TDAI payload → POST（带 x-team-id 等身份头）→ 返回 TDAI skill_id。
- [ ] 3.3 触发点：①CLI `penguin skill publish --name <skill> --to tdai`；②（可选）优化流程完成事件
      hook；③（可选）web Skill 页"发布到 TDAI"按钮。
- [ ] 3.4 版本语义：SKILL.md 版本变化 → 复用 `skill/update`（upsert 语义），同名不重复建。
- [ ] 3.5 测试：mock fetch 断言 payload；联调后 TDAI Panel（8123）资产列表可见该 Skill。

**验收**：penguin 里 agent 优化出的 skill 一键发布 → TDAI Panel 可见、可配装给其他 agent。

**风险**：两套 skill 字段映射（TDAI 有 resources/manifest/ACL，penguin 更轻）；默认 visibility 建议
`private`（与 TDAI "分享是显式动作"一致）。

---

## 事项 4：历史 Trace 批量导入 TDAI（冷启动读档）

**目标**：把 penguin 已完成会话（Trace）批量喂给 TDAI `/v3/conversation/add`，让 TDAI 从存量
对话提炼 L1/L2/L3 与 Skill，兑现 TDAI README"导入对话 Session → 自动提取记忆"。

**现状落点**（已核实）：
- penguin trace：`packages/core/src/trace/writer.ts` 按行 O_APPEND 写 OmniMessage 记录
  （`session_meta`、完整 `model_msg`、`event_msg`；streaming partial 不落盘）；目录
  `agent_state/traces/YYYY-MM-DD/`。
- TDAI 入口：`POST /v3/conversation/add` `{session_id, messages:[{role, content, timestamp}]}`。

**方案**：导入工具——读 trace → 还原 user/assistant 文本序列 → 按 TDAI 会话分批提交。

**任务**：
- [ ] 4.1 trace 读取器：解析 trace 记录，还原每会话的消息序列（user text + assistant text；
      工具调用/结果默认折叠为 event 摘要或跳过——先只导纯对话，后续可扩展）。
- [ ] 4.2 转换层：OmniMessage → TDAI message（role/content/timestamp）；会话映射：
      penguin session_id → TDAI session_id（前缀 `penguin:` 防撞）。
- [ ] 4.3 导入服务/CLI：`penguin import-tdai --project <id> --agent <id> [--since <iso>] [--dry-run]`；
      进度与去重：`.tencentdb-sync.json`（或独立 `.tdai-import.json`）记录已导入 session 与消息数。
- [ ] 4.4 限速/错误处理：分批（如每会话 50 条）、失败重试一次、失败会话记录不中断。
- [ ] 4.5 测试 + 联调：造少量 trace → 导入 → 网关 `conversation/query` 可见 → 观察 L1 提炼产出。

**验收**：存量会话一次导入后，TDAI 侧出现对应 L0 对话，pipeline 提炼出 L1（与 auto-pull 的镜像
联动：下次 pull 即可在 penguin Memory 页看到这些记忆）。

**风险**：trace 消息还原完整性（打断/工具消息）；导入量大时的 TDAI 侧写入压力（batch 节流）。

---

## 事项 5：删除语义完善（本地删除 → 同步清远端）

**目标**：penguin Memory 页删除记忆时，显式同步删除 TDAI 原子记忆，避免"本地删了远端还在"。

**现状落点**（已核实）：
- 本地删镜像文件 → `store.tombstones` 记 externalId，push 跳过，**远端不删**（计划的保守默认）。
- TDAI 写接口：`POST /v3/atomic/delete` 已存在（`gateway/v2-router.ts` L419 `handleAtomicDelete`）。
- `tencentdb-memory-client.ts` 尚无 deleteAtomic 方法。

**方案**：删除动作三态——本地删（tombstone）→ push 时对"已确认删除"条目调 `atomic/delete` →
成功后再清 tombstone（失败保留，防复活冲突）。UI 提供"删除并同步远端"入口。

**任务**：
- [ ] 5.1 client 新增 `deleteAtomic(externalId)`（POST `/v3/atomic/delete`，带 external_id）。
- [ ] 5.2 确认 externalId ↔ atomic id 对应关系（mirror 的 `tencentdb_external_id` 是否即网关
      atomic id；不一致则查 `/v3/atomic/query` 按 id 定位）。
- [ ] 5.3 push() 增加删除通道：遍历 tombstones → `deleteAtomic` → 成功移除 tombstone、失败保留
      并计 errors；开关 `TENCENTDB_MEMORY_DELETE_REMOTE`（默认 `1`，`0` 回退纯 tombstone）。
- [ ] 5.4 UI（可选，低优先级）：memory 页删除按钮加"同步删除远端"选项（先支持 CLI/API 触发）。
- [ ] 5.5 测试：删本地镜像 → push → 断言 gateway 收到 atomic/delete（fake fetch）；网关返回失败时
      tombstone 保留、重试幂等。

**验收**：本地删除并 push 后，网关 `atomic/query` 无该条；TDAI 侧不再复活。

**风险**：误删一次性生效 → 删除前确认（UI 层二次确认）；远端删除是显式动作，与 TDAI
"分享是显式动作"的哲学一致。

---

## 事项 7：实时镜像同步（L1 新鲜度）

**目标**：方案 3 下 L1 靠镜像（tencentdb-*.md），会话创建时的 auto-pull 拉的是"上一次"聊天的
L1。本次聊天产生的新 L1 要等下次开会话才进镜像。加 Task 启动时 auto-pull 缩短这个窗口。

**方案**：在 `POST /:sessionId/tasks`（goal 和普通 task 两个返回点）各加 fire-and-forget pull。
与 session-create 的 auto-pull 共用 `TENCENTDB_MEMORY_AUTO_PULL` 开关。失败静默 — 不阻断
任务创建。

**实现**（`packages/server/src/http/routes/sessions.ts`）：
- [x] 7.1 goal 模式 task 启动 → `void pull(...)` before 202。
- [x] 7.2 普通 task 启动 → `void pull(...)` before 202。
- [x] 7.3 回归：server 627/627 通过。

**验收**：Task 启动后，TDAI 侧最新 L1 在下一次用户消息前已进入本地镜像。窗口从"整个会话生命周期"
缩短到"单次 pipeline 提取延迟"（IDC 内 < 5s）。

**局限**：仍然受 TDAI pipeline 异步提取延迟（everyNConversations + idle 超时）约束——镜像
只能拉到已提取的 L1，不能拉到"刚聊完还没提取的"。这是 TDAI 侧 pipeline 的固有限制，penguin
侧无法绕过。

---

## 事项 6：Wiki/CodeGraph 知识库访问（Knowledge service）

**目标**：penguin 用户可通过 proxy 注入的 `<knowledge_tools>` prompt block 访问团队的
Wiki 和 CodeGraph 知识资产。

**实现**：
- [x] 6.1 MemoryKnowledge 服务启动（8421），`pnpm install` + `.env` 就绪。
- [x] 6.2 Proxy 知识注入器启用：`config.yaml` 中 `knowledge.enabled: true`、`injectors` 加入 `"knowledge"`。
- [x] 6.3 验证：proxy 启动日志确认 `injection: skill,knowledge,tdai-memory`。
- [ ] 6.4 知识资源注册：需 Panel（8123）创建 wiki/code-graph → 推 llm_binding → KG 注册到 gateway。
- [ ] 6.5 LLM 配置：Knowledge 服务 wiki ingest 需要 LLM（`LLM_MODE=proxy` 依赖 Panel 推送 knowledge-service key）。
- [ ] 6.6 端到端验证：chat → proxy 注入 knowledge_tools 块 → 模型调用 tools/list → tools/call。

**当前状态**：Knowledge 服务已可运行，proxy 注入管线已开启。因 gateway 无知识资源
（`/v3/knowledge/list` 返回 0 items），注入器静默生成 0 个 knowledge 块（按设计优雅降级）。
完整链路需要 Panel 侧创建知识资源并完成 LLM 抽取。

---

## 事项 8：团队/用户管理集成（penguin 用户 ↔ TDAI ACL）

**目标**：penguin 的团队/用户管理操作同步到 TDAI 网关，实现统一 ACL。

**状态**：🛑 **阻塞** — TDAI 网关无用户管理 API。

- `POST /v3/user/create` → 404（网关无此路由）
- `POST /v3/user/query` → 404（网关无此路由）

TDAI 网关的 v3 元数据 API 位于 `/v3/meta/*` 路径下，用户管理接口为 `/v3/meta/user/create`
等，但这些接口需要 `x-tdai-user-key` 头进行用户身份鉴权（Layer 3），penguin 作为服务端
无法持有用户密钥。运维接口 `/v3/internal/meta/*` 仅提供 `user/init-admin` 和
`user/list-by-instance`，不支持通用 CRUD。

**后续方向**：
1. 在 TDAI 网关 `/v3/internal/meta/` 下扩展用户 CRUD 接口，供 penguin 通过 Bearer 令牌调用。
2. 或者在 penguin 侧维护独立的用户映射表，通过现有 `x-tdai-user-id` 等头透传身份。

---

## 验证环境与通用约束

- 环境：MemoryCore `8420`、MemoryProxy `8096`（Node22）、Panel `8123`、penguin `7365/7368`（Node24）。
- 每个事项改动后：`pnpm --filter @prismshadow/penguin-server exec tsc --noEmit`（或 MemoryProxy
  `npx tsc --noEmit`，忽略仓库原有 2 处无关错误）+ 相关单测 + 重启对应服务。
- 不破坏现有约束：TDAI 不可达时 penguin 照常工作；身份/密钥不进 markdown 与日志；写操作保持显式。
- 每个事项独立提交（penguin-harness 与 TDAI 各自 commit），可独立回滚。
