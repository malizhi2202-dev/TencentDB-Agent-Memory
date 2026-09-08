# MindMemOS 记忆能力与算法评估（可引入清单）

> 结论先行：MindMemOS 的独特价值不在「又一套 RAG/L0-L3」，而在 **①实体-属性-时间轴-图的结构化记忆模型（schema 模式）**、**②离线两阶段 dreaming 巩固（issue 检测 → 动作规划的五类动作）**、**③token-budget 下的搜索结果保留/去冗余选择（MMR+recency 衰减）**、**④技能自演进（经验→skill_candidate→版本化的 SKILL.md）**。这些恰好是 TencentDB 目前 L0-L3 / recall / feedback / dreaming 尚未覆盖的维度。

## 1. 记忆能力清单

MindMemOS 提供两套并存算法：**vanilla**（扁平事实抽取，MemoryItem）与 **schema**（实体中心的结构化图谱，Entity + Property + Edge）。记忆 `mem_type` 七类：`profile`（用户画像）、`fact`（事实）、`experience`（经验）、`episodic`（情景/一篇对话）、`tool_trace`（工具轨迹）、`skill_candidate`（技能候选）、`file_knowledge`（文件知识，规划中）。

- **实体建模（schema 模式核心）**：以「实体」为一等对象，实体挂 `static_property`（稳定属性，如姓名/出生）+ `dynamic_property`（动态属性，如 location_event、position_event，每值带时间戳），实体间建 `Edge`（带关系描述），并在 Neo4j 存 MENTIONS / EXTRACTED_FROM / RELATES_TO 等关系。
- **时间轴记忆（TemporalEntity）**：每实体的每个属性是一条按时间戳排序的 timeline，支持「at_time / in_range」时点回溯与历史查询——这是「事实随时间演化」的一等建模，非简单覆盖。
- **Episodic 情景记忆**：对话被切成 episode（可配 llm/rule 切分、min/max 长度、30 分钟、`split_on_user_speaker`），生成 episode 实体（标题 + 事实摘要 + search_fields），并把对话「客观化」为描述。
- **固化/巩固（dreaming）**：离线两阶段——`relation_detection` 把候选记忆对分类为 conflict / duplicate / near_duplicate / complementary / low_value / ambiguous；`action_planning` 输出 create / update / merge / archive / link 五类数据库安全动作；另有确定性的「精确重复归档」。
- **遗忘/生命周期**：不硬删，用 `status = active | archived | delete` + `validate_from/validate_to`（时效）+ `replacement_memory_id`（被谁取代）+ `parent_ids/root_id`（血缘），检索时可回查 archived 版本 lineage。
- **反思/反馈（feedback）**：explicit（用户给 text + 上下文 + 召回记忆 → action planner 增删改/归并/归档）与 implicit（无 text，LLM 从近期会话轮次探测负面信号 → query rewriter 补充召回 → 规划动作）。
- **强化（reinforcement）**：`reinforcement_count` 计数，重提的记忆被强化（幂等，靠 metadata 去重键防 Kafka 重放）。
- **召回（recall）**：add 时先召回现有记忆作为抽取上下文，用于 dedup/merge/冲突判断（`add_recall`）。
- **技能自演进（skill evolution）**：经验记忆沉淀为 skill_candidate；每次注入 SKILL.md 的 add 轨迹被摘要，攒够 `min_aggregate`（默认 8）条后聚合为 patch、生成新版本。

## 2. 算法相关

- **混合检索**：dense（semantic 向量，Qdrant）+ sparse（BM25/哈希稀疏向量，hash dim 200 万、sha1、k1=1.5、b=0.75、porter 词干、spaCy 词形还原）+ 可选外部 reranker 重排。
- **RRF 融合**：`reciprocal_rank_fusion`（k=60），多路召回结果按倒数排名融合。
- **图扩展召回**：以种子记忆经 Neo4j 拓邻（共享实体/直接记忆关系），分数按 hop 衰减 `graph_decay=0.5`。
- **去重**：Jaccard 阈值 `dedup_threshold=0.6` 的文本相似去重；同 id 多路命中合并取最高分。
- **Token-budget 保留（memory_retention）**：请求级 `token_budget` 约束下，在 `top_k` 内做严格预算打包。混合评分 `priority = 0.5·relevance + 0.25·query_overlap + 0.15·recency − 0.10·cost_ratio`；recency 用指数衰减（半衰期 30 天）。`mixed-v1` 贪心；`mixed-v2` = 先保 top-m relevance 再加 MMR（`mmr_lambda=0.70`）抗冗余。**不合并/改写记忆，只挑选**。
- **Token 估计器（heuristic-v2）**：CJK 按 1.5 字符/token，拉丁长词按 8 字符/token，避免 URL/base64 长串绕过预算。
- **实体权重/融合/收缩**：实体类型级 `search_weight` 乘到检索分数；`entity_fusion` 合并 entity_search 与 property_search 两路结果；`entity_shrink` 控制候选规模。
- **Schema 选择（降本）**：add 时先让 LLM 从全量实体 schema 里挑相关的子集（失败回退全量），减少抽取 prompt 长度。
- **压缩/摘要（vanilla 长对话）**：chunk 软/硬 token 预算 + compaction（保头 4000 + 保尾 4000，中部走「分层 summarize + reduce」map-reduce 式摘要，超长递归切分）。
- **高阶属性（higher-order）**：从多域偏好信号生成「全景式」跨属性推断。
- **Agentic 检索**：多轮循环——sufficiency（是否够）+ 生成下轮查询 / 简单改写 / 时间窗口放宽，跨实体合并去重。

## 3. 插件 / skill 机制

- **插件（plugins/）**：均为「CLI 薄封装」。dsh 插件在 `agent/pre-step` 首步召回并注入 `<relevant-memories>`（`source.kind==="plugin"` 标记防止回存），在 `turn/end(reason=completed)` 收集该轮 user/assistant/tool 消息回 `mindmemos memory add`。OpenClaw 插件同理（需要 `allowConversationAccess`）。
- **skill（skills/ 仓库侧与 SDK 侧）**：仓库里 `skills/mindmemos-cli/SKILL.md` 是「教会 agent 装 CLI + 用命令」的说明性 skill，`references/` 放各 host 集成文档。
- **SDK 技能治理（git-like 版本库）**：`content_hash`（SHA-256，等价 tree）→ `version_id`（由 project+hash+parent 确定性推导，等价 commit）→ `cloud_skill_id`（lineage 分组，等价 repo）→ `version_label`（display tag）。生命周期 `observed→draft→evaluating→published→superseded|rolled_back`。支持 register/list/evolve/push/pull/update/rollback/history/diff/unregister。
- **技能追踪闭环**：插件从工具调用里探测 SKILL.md 的 read/write/edit（edit 需用 read 基准重建全量内容再算 hash），产出 `skill_context`（name/content_hash/base_version_id/usage=injected|modified），随 `/v1/memory/add` 落 trace；未注册内容先进 pending 集合，注册后批量 rebind。trace 摘要 → 攒够阈值 → patch proposal（有分数走监督 prompt，无则走非监督）→ 新版本。

## 4. 可引入清单（TencentDB 尚缺、理由）

1. **实体-属性-时间轴结构化记忆（schema 模式）**：TencentDB L0-L3 是按作用域/生命周期分层，缺「实体 + 属性时间线 + 实体间关系」这一语义化建模。引入可显著提升 PersonaMem 类的「画像追踪/重访/建议」能力，并为知识图谱类 L3 提供底座。
2. **时间轴实体（TemporalEntity，时点回溯）**：「事实随时间演化」目前靠覆盖写，缺历史版本与时间点查询。适合数据库运维类场景（实例状态、配置变更史）。
3. **混合检索 + RRF + rerank + 图扩展**：若 TencentDB recall 偏纯向量，可补齐 sparse/BM25 + RRF 融合 + 图邻跳转（decay），提升专有名词（ID、文件名、SQL 标识符）召回精度。
4. **Token-budget 保留（MMR + recency 衰减 + 成本项）**：把「返回多少记忆塞进 LLM 上下文」变成显式预算优化，去冗余（MMR）并压制过长/过旧项——这是 TencentDB recall 输出层可直接补的确定性算法。
5. **两阶段 dreaming + 五类动作 + 冲突/重复分类**：TencentDB 已有 dreaming，但 MindMemOS 的「issue 检测(分类) → 聚焦动作规划」两跳解耦、以及 create/update/merge/archive/link 显式动作税、精确重复的确定性归档更可操作、可审计。
6. **implicit feedback（无显式文本的信号探测 + query rewrite）**：TencentDB feedback 若以显式为主，可补「从会话轮次自动探测负面信号」的 LLM 隐式反馈闭环。
7. **技能自演进 + git-like 版本库**：把「经验→skill_candidate→版本化 SKILL.md→轨迹回灌再演进」引入，TencentDB 的「能力/工具经验」从单纯记忆升级为可执行、可版本、可发布的资产（对数据库运维 agent 的价值尤其高）。
8. **记忆类型分类（profile/fact/experience/episodic/tool_trace/skill_candidate）+ 状态机 + reinforcement_count**：给 L0-L3 之外的「语义类型」维度，强化计数可做遗忘/重要度排序的输入。
9. **血缘/溯源（parent_ids/root_id/derived_from/archived lineage 回查）**：记忆的「由谁衍生、取代谁」链路，支撑审计、回滚、可解释性，TencentDB 记忆图谱若缺此维度值得补。
10. **Schema 选择与 episode 客观化（降本/压缩）**：query-time 挑 schema 子集、长对话 compaction（保头尾+中部 map-reduce 摘要）均为成熟可复用的成本控制手法。

（评估基于：README/README_ZH、docs/*/、src/mindmemos/ 组件与配置、src/mindmemos_sdk/、skills/、plugins/ 的源代码与文档。技术细节以 `typing/memory.py`、`config/algo/*` 与 components/ 下 dreaming、feedback、searcher、extractor/schema、memory_modeling/schema 为准。）