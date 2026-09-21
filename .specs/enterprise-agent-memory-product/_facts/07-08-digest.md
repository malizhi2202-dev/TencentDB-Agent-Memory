# 议题 7–8 事实摘要（供产品设计文档使用）

来源（只读）：
- `.specs/enterprise-agent-memory-platform/07-企业记忆血缘.md`（1621 行）
- `.specs/enterprise-agent-memory-platform/08-使用反馈驱动的自进化.md`（1358 行）

引用约定：`第N轮` 指文档内"第 N 轮确认"；`深化N` 指该文档"子议题深化N第1轮"。括号内小节号为源文档小节号。
计数口径：`7.1`/`8.1` 每条 = 源文档中一段明确的"已确认/阶段性结论"总述（议题 7 为第 1–3 轮 + 深化 1–7，共 10 条；议题 8 为第 1–3 轮 + 深化 1–5，共 8 条）。更细的能力清单见各节。

---

## 议题 7：企业记忆血缘

### 7.1 已确认结论清单

- **7-C1（第1轮）**：血缘是"围绕不可变对象版本、类型化关系、运行事件和派生状态建立的可追溯体系"。第一版采用结构化血缘引用集合 + 追加式事件 + 可查询的来源/影响视图，"不立即建设完整图数据库"；至少区分事实来源、推理结论、派生资产、消费执行四类关系；血缘不能扩大权限；源撤回/权限收窄/revision 变化/证据失效时"必须优先阻断新的检索和执行，再异步重算"，历史版本和已完成 Run 不被静默改写。
- **7-C2（第2轮）**：采用"Lineage Assertion → 验证与冲突处理 → Current Lineage Relation"三段式；外部系统或模型不得直接写入最终权威关系；声明者、验证者、审批者、消费者、修正者必须分开建模；冲突"不得由最后写入者、单一置信度分数或模型相似度自动裁决"；缺失或不可信时低风险可暂存为不可执行候选、高风险必须隔离或阻断。
- **7-C3（第3轮）**：血缘可见性必须与源内容可见性、知识检索权限、执行权限分离建模，至少区分关系存在性、关系元数据、源内容、影响分析四类能力；任意查询都生成最小必要投影；跨 Project/跨租户/全局影响闭包/血缘导出/撤回影响分析为单独高权限能力；无权节点可隐藏或抽象占位，但不得经名称、数量、路径、错误信息、缓存或 Embedding 侧信道泄露存在性；影响分析只能生成复核/阻断/处置候选。
- **7-C4（深化1）**：可见性采用"RBAC 基线 + ABAC 条件决策"，并把 existence、metadata、summary、content、impact、export、admin 分成不同动作；实际可见范围取多重条件交集；硬拒绝优先，未知或冲突默认拒绝、隔离或最小投影；血缘关系不扩大源内容权限。
- **7-C5（深化2）**：跨租户影响分析采用"最小投影、用途绑定、源/目标双边授权和按风险分级"；T0–T3 为原则性风险层；导出物是带版本/范围/深度/敏感性/脱敏策略/血缘/接收者/有效期/完整性/禁止再分享条件的新受控资产；默认导出关闭；无法证明租户边界、来源 ACL、目标用途、血缘、脱敏或清理状态时默认隔离/阻断。
- **7-C6（深化3）**：血缘查询隐私采用"风险分类 → 最小输出 → 组合预算与限频 → 侧信道验证"分层方案，"而不是对所有查询统一添加噪声"；Q0–Q3 为语义风险层；差分隐私只在邻接关系、贡献上限、epsilon/delta、组合预算、误差和用途明确且通过攻击评估时使用，"DP 不替代 ACL、用途授权、跨租户审批、撤回、缓存隔离或侧信道防护"。
- **7-C7（深化4）**：血缘、关键词、向量、图关系、缓存和 Context Manifest "共享同一版本化 Visibility Context，但保持信号和物理存储分离"；过滤优先于召回，不能先召回全库再由 UI 隐藏；Embedding/Index/Cache 是派生数据；Manifest 是当前授权的一次投影、"不是权限本身"；缺少上下文、血缘或过滤一致性证明时默认隔离/阻断。
- **7-C8（深化5）**：全局影响分析采用"同步预览 + 版本化异步任务 + 安全缓存/检查点"分层模型；结果必须明确 complete/partial/unknown/stale/failed/cancelled，"超时、无权、缺口和未扫描不能伪装成无影响"；checkpoint 只恢复计算位置、不恢复权限；过载不能回退到无过滤全库扫描。
- **7-C9（深化6）**：紧急撤回采用"权威状态先行、同步最小阻断、异步影响闭包、独立处置审批、重新验证恢复、事后复核"两阶段流程；检测信号不等于权威撤回；自动阻断不自动批准删除、生产回滚、长期 ACL 修改、跨租户通知或恢复；无法证明传播/清理/外部副本状态时维持 blocked/unknown；事后审批不追认未经授权的高风险副作用。
- **7-C10（深化7）**：血缘导出文件作为独立 `Export Asset` 治理，正文、元数据、附件、预览和文件名一并受控；按 E0–E3 原则风险分级；加密保护机密性、水印/指纹支持责任追踪、DLP/外发策略识别和阻断传输，三者不能互相替代；撤回/过期先阻断在线访问、下载、链接、密钥发放，外部副本记 unknown；无法证明外发控制、接收者或清理能力时默认不交付高敏结果。

### 7.2 核心对象与关系

- **血缘对象范围（第1轮 §1）**：四组对象——工作来源（User / Harness、Work Thread / Task / Run、Tool Call / Conversation / Evidence）；工程对象（Repository / Revision、File / Symbol / Environment、Test / Trace / Log / Verification）；记忆与知识对象（L0 Evidence、L1 Atomic Memory、L2 Context View、L3 Long-Term Memory、RCA / Wiki / Skill / Template / Code Context）；派生与消费对象（Embedding / Index Entry、Context Manifest / Harness Projection、Action Proposal / Run Plan、Execution Result）。文档明确这些对象"不等价于同一种'来源'"。
- **关系语义（第1轮 §2）**：至少 13 种关系——`captured_from`、`observed_in`、`anchored_to`、`derived_from`、`supports`、`contradicts`、`verified_by`、`applies_to`、`projected_to`、`used_by`、`invalidated_by`、`supersedes`、`revoked_by`。关系不能全部简化为 `source_id`；`derived_from ≠ verified_by`、`used_by ≠ 该 Run 证明资产正确`、`applies_to ≠ 归属`、引用源对象 ≠ 可查看源对象全部内容。
- **血缘记录字段（第1轮 §3）**：`source_object_id`、`source_version`、`target_object_id`、`target_version`、`relation_type`、`created_at`、`created_by`、`derivation_policy_version`、`redaction_policy_version`、`authorization_context`、`valid_time`、`recorded_at`、`status`；代码与 RCA 场景另需 `repository`、`revision / revision_range`、`file / symbol scope`、`environment`、`dependency range`。
- **血缘声明 vs 当前关系（第2轮 §1）**：任何 Connector、Harness、治理 Agent 或人工操作者先提交 `LineageAssertion`（字段含 `assertion_id`、`source/target_object_id / version`、`relation_type`、`asserted_by`、`assertion_source`、`observation_or_declaration`、`evidence_refs`、`captured_at`、`authorization_context`、`policy_version`、`status`），经验证、去重、权限和版本检查后才形成 `CurrentLineageRelation`；原始断言必须保留，当前关系不能取代断言历史。
- **来源闭包 / 影响闭包（第1轮 §4）**：必须同时支持向上追溯与向下影响分析。来源闭包示例：`Skill v3 ← derived_from RCA v2 ← derived_from Evidence Set v5 ← observed_in Run 123 ← produced_by Harness X ← started_by User Y ← anchored_to repo revision R`。影响闭包示例：`Source Evidence revoked → RCA v2 → Skill v3 → Embedding / Index Entry → Context Manifest → Action Proposal → pending Run`。影响闭包用于撤回、权限收窄、revision 变化、证据失效和策略变更后的重新评估。
- **血缘来源类型（第2轮 §2）**：`observed`（运行/连接器/工具直接观察）、`declared`（Owner/Harness/外部系统显式声明）、`derived`（由已确认关系推导）、`inferred`（模型/规则/相似性推断）、`human_confirmed`（经授权人员确认）、`imported`（从外部目录或血缘系统导入）。事实血缘与解释血缘分开处理：`observed_in`、`used_by` 偏事实；`supports`、`applies_to` 可能含解释判断，"不能使用同一可信度语义"。
- **缺失与不可信表达（第2轮 §5）**：血缘缺失 = 没有来源引用、使用版本或派生版本记录；血缘不可信 = 声明者无权、关系与运行记录冲突、revision 不匹配、源已撤回或仅有未经审核的推断。二者必须区分。
- **隐藏节点与抽象占位（第3轮 §5）**：节点存在本身敏感时完全隐藏；用户需理解阻断原因但不能看源对象时返回抽象占位；同一 Project 低敏感源可显示有限元数据；跨 Project、客户、凭据和生产数据默认隐藏源内容。"抽象占位不得泄露原始名称、精确 Project、用户身份、文件路径、客户标识或未经授权的精确影响数量。"
- **投影对象（第3轮 §2）**：`LineageProjection` 含 `visible_nodes`、`visible_relations`、`redacted_nodes`、`withheld_reasons`、`impact_summary`、`current_validity`、`allowed_actions`、`audit_context`；投影是派生数据，必须绑定主体、用途、策略版本和过期条件，"不能把一个主体生成的血缘投影直接复用于另一个主体"。
- **统一过滤对象（深化4 §1/§4）**：`Visibility Context`（不可变、带版本）字段含 `subject / delegated_by`、`purpose / consumer`、`tenant / project / space`、`resource and allowed actions`、`source ACL / target policy`、`sensitivity / redaction policy`、`asset state / revocation state`、`repository / revision / environment`、`requested depth / token budget / expiry`、`policy_version / context_version`。Manifest 记录被选对象、版本、来源、适用范围、过滤结果、脱敏状态、预算、过期时间和策略版本。
- **影响分析产物（第3轮 §6）**：只能生成 `Impact Report`、`Impact Candidate`、`Recommended Review`、`Blocking Recommendation`。
- **归因相关对象**：属议题 8，见 8.2。

### 7.3 状态与枚举

- **血缘/派生状态（第1轮 §7）**：`active`、`partially_valid`、`needs_review`、`invalidated`、`revoked`、`orphaned`、`redacted`、`blocked`、`archived`。
- **血缘事件（第1轮 §7）**：`LineageCreated`、`LineagePolicyChanged`、`SourceVersionChanged`、`SourcePermissionChanged`、`SourceRevoked`、`DerivedAssetRecomputed`、`ConsumerProjectionInvalidated`、`RunUsageRecorded`。事件"至少一次投递，消费端幂等"；权威状态决定当前是否允许消费，事件负责传播和重建。
- **失效传播顺序（第1轮 §7）**：立即阻断新的 action → 阻断不满足条件的 retrieval → 标记受影响资产 `needs_review / blocked` → 异步重算索引、Embedding、Manifest 和派生资产 → 审核后恢复、收窄、替代或撤回。"失效要快，恢复可以慢。"
- **血缘粒度（第1轮 §6）**：对象级、版本级（必须支持）；证据集级（RCA 与知识化优先支持）；字段级、片段级（高风险高敏感按需支持）；Token 级"不在第一版支持，留待以后讨论"。
- **关系级正交状态（第2轮 §4）**：`provenance_state`、`observation_state`、`authorization_state`、`completeness_state`、`consistency_state`、`review_state`、`freshness_state`、`propagation_state`；不使用单一 `lineage_confidence` 替代硬门禁。
- **冲突处理结果（第2轮 §4）**：`accepted`、`rejected`、`superseded`、`unresolved`。冲突流程：保留所有断言 → 标记冲突类型和影响范围 → 计算当前消费风险 → 高风险阻断 retrieval/action → 请求责任主体补充证据 → 形成裁决状态 → 记录决策、责任人和影响。
- **可见性四类能力（第3轮 §1）**：`lineage_presence`、`lineage_metadata`、`lineage_content`、`impact_analysis`；跨空间与治理操作另行控制：`cross_scope_impact`、`impact_export`、`lineage_revoke`、`lineage_recompute`。"这些能力不能压缩成单一的 `lineage:read`。"
- **动作分层（深化1 §1）**：`existence`、`metadata`、`summary`、`content`、`impact`、`export`、`admin`。
- **跨租户动作分级（深化2 §2）**：T0 当前租户内直接/多跳查询；T1 经双方授权的跨租户关系存在性或粗粒度影响摘要；T2 经审批的脱敏影响闭包/审计报告；T3 原文或高敏导出、跨租户撤回/恢复、可执行或生产相关交付。T0 不得升级为 T1，T1 不自动允许 T2，T2 不自动允许 T3。
- **查询风险分层（深化3 §2）**：Q0 已授权低敏当前范围（精确直接关系）；Q1 受限摘要（分桶/泛化/近似）；Q2 敏感影响或跨边界（审批、预算、审计、限频、专门投影）；Q3 高敏存在性/个体可推断（默认拒绝或统一阻断）。"Q0–Q3 是语义层风险，而非统一数值。"
- **输出机制选择（深化3 §3/§3 结论）**：`exact | bucketed | generalized | DP | abstract | deny`。
- **异步分析模式（深化5 §1）**：`sync_preview`、`async_analysis`、`snapshot_analysis`、`streaming_update`。
- **异步任务状态（深化5 §3）**：`requested → authorized_snapshot → queued → running → partial / paused / awaiting_recheck → completed | failed | cancelled | expired | stale`。
- **缓存三种语义（深化5 §3）**：Exact cache、Redacted aggregate cache、Computation checkpoint；缓存命中必须重新做当前授权检查，"缓存失效优先于提高命中率"。
- **撤回状态维度（深化6 §4）**：`signal`: detected / unverified / confirmed / rejected；`control`: active / blocked / isolated / restored / expired；`propagation`: pending / partial / complete / failed / unknown；`asset`: usable / suspended / revoked / superseded / retained_for_audit；`run`: not_started / gated / paused / running / partially_executed / completed / requires_review；`review`: requested / under_review / approved / rejected / superseded。
- **消费者独立状态（深化6 §3）**：`source / asset / embedding / index / cache / manifest / export / run_projection` 各自取 `blocked | pending_review | invalidated | cleaned | unknown | restored`。
- **自动阻断优先级（深化6 §3）**：P0 已确认凭据泄露/跨租户暴露/进行中的不安全动作；P1 源撤回/权限丢失/严重敏感性或血缘断裂；P2 revision/适用性/验证漂移；P3 低置信信号（建复核或监控候选）。"P0–P3 是原则性优先级，不是数值阈值。"
- **导出风险分级（深化7 §3）**：E0 低敏、当前范围、内部短期摘要；E1 脱敏跨空间/跨租户摘要；E2 敏感影响/审计报告；E3 原文、凭据痕迹、客户/生产数据、可执行或高影响导出（默认禁止，仅专门人工/合规批准的最小必要交付）。
- **导出状态机（深化7 §3）**：`candidate → redaction_review → approval_pending → approved → generated → delivered → access_monitored → expired | revoked | delivery_failed | external_unknown`。`delivered ≠ 已阅读或可再分享`；`revoked ≠ 外部设备已删除`；`external_unknown 不能降级为 cleared`。
- **一致性与失败矩阵（深化4 §3）**：ACL/用途收窄、源撤回/敏感升级、revision/环境变化、过滤服务不可用、Connector 不支持前置过滤、缓存版本不明/跨主体命中，各自有立即动作、后续动作与禁止行为（如"禁止返回旧缓存""禁止先全量召回后 UI 隐藏"）。
- **最小输出层级（深化2 §3）**：T1 关系摘要 / T2 脱敏报告 / T3 高敏交付，各列默认可见内容与不应包含内容；T1/T2 应支持 `partial/unknown/blocked`，"不能把不可见节点当作不存在，也不能用精确零值掩盖未分析范围"。

### 7.4 角色与权限边界

- **血缘可见性 ≠ 源内容 ACL（第3轮 §3）**：有效可见性至少取"主体对目标对象的权限 ∩ 主体对源对象元数据的权限 ∩ 主体对关系本身的权限 ∩ Purpose Policy ∩ 敏感性/脱敏策略 ∩ 跨空间策略"；源内容读取还须满足源对象 Content ACL。推论：能看 Skill 不一定能看 RCA 原文；能看 RCA 标题不一定能看日志；能看资产不可重新验证不一定能看撤回源内容；能查看当前 Project 影响不一定能查看其他 Project 名称。
- **有效消费检查（第1轮 §5）**：`当前主体权限 ∩ 来源对象 ACL ∩ 目标空间策略 ∩ 用途策略 ∩ 敏感性与脱敏策略 ∩ 资产发布状态 ∩ 当前有效性`。"血缘不得成为绕过 ACL 的反向索引"；摘要、Embedding、缓存、Context Manifest 和 Skill 都不能因为更抽象就自动脱离来源治理。
- **最小必要投影输入（第3轮 §2）**：`principal`、`purpose`、`tenant / organization`、`MemorySpace`、`target object`、`risk level`、`sensitivity`、`requested depth`。
- **影响分析范围参数（第3轮 §4）**：`scope`（User/Team/Project/Organization）、`depth`（直接下游/多跳下游/完整闭包）、`object_types`（Memory/Knowledge/Index/Manifest/Run）、`time_range`（当前有效/历史版本/全历史）、`purpose`（调试/事故处理/安全/合规/重算）、`export`（禁止/脱敏导出/审批后导出）。
- **影响分析默认策略（第3轮 §4）**：普通用户限于当前 Project 和直接关系；Project Owner 可查看当前 Project 多跳影响；Security/Privacy 在授权范围内查看跨边界影响；企业治理/审计可查看全局闭包但仍受内容 ACL 过滤；跨租户完整闭包默认禁止。
- **RBAC 角色基线（深化1 §2）**：普通成员、Project Owner、Source Owner、Knowledge/Asset Owner、Reviewer、Security/Privacy、Operations/Incident、Auditor、Governance Admin、Service/Connector。"角色不能单独放行访问"；组织成员关系、资源 Owner、参与过 Run、创建过资产和 Agent 身份"不能自动等价于全部血缘读取权"。
- **ABAC 决策交集（深化1 §2）**：`current_subject ∩ role/action grant ∩ resource ACL ∩ source ACL and lineage ∩ purpose ∩ tenant/project/space scope ∩ sensitivity/redaction policy ∩ asset publication/current state ∩ environment and time condition ∩ break-glass / approval condition`。
- **ABAC 属性（深化1 §3）**：`subject`（identity, roles, clearance, project/team, delegated_by）、`resource`（object_type, object_id, source_space, target_space, sensitivity）、`relation`（relation_type, source_version, target_version, direction, depth）、`purpose`（observe | diagnose | verify | audit | impact | export | administer）、`scope`、`state`（published | candidate | suspended | revoked | restricted）、`condition`（time, incident, approval, policy_version, break_glass）。未声明用途/深度/范围/目标对象时"默认使用最小投影而不是推断最大权限"；`audit` 不自动解锁原始凭据或客户数据。
- **原则级策略矩阵（深化1 §3）**：8 行主体/用途（Project member/observe、Project owner/diagnose、Source/Asset owner/verify、Security/Privacy/audit、Operations/Incident/diagnose、Auditor/audit、Governance admin/administer、Service/Connector）× 5 列能力（existence、metadata/summary、content、impact、export/admin）。矩阵是最低原则；任一 `source_acl`、敏感性、用途、目标范围或撤回状态无法证明时"结果不得升级"。
- **查询审计字段（第3轮 §7）**：`query_id`、`principal`、`purpose`、`target_object`、`requested_scope`、`requested_depth`、`visible_scope`、`redacted_scope`、`result_count_bucket`、`decision`、`policy_version`、`timestamp`、`exported`、`follow_up_action`。
- **侧信道防护（第3轮 §7 / 深化1 §3 / 深化3 §5）**：限制对象枚举、查询深度、频率、导出和错误差异；隐藏节点不得通过名称、数量、响应时间、缓存、搜索排序、Embedding 或错误信息泄露。不存在、无权、被隐藏对象"应尽量使用一致响应"；`result_count` 只在策略允许时返回分桶/近似值；影响分析失败或血缘不完整时返回 `unknown/partial`，"不能返回'无影响'"。不要求机械统一延迟，"不以'加随机延迟'宣称解决侧信道"。
- **影响分析与处置分离（第3轮 §6 / 深化2 §5）**：不能直接授予删除、修改 ACL、跨空间导出、终止 Run、自动发布或自动恢复权限。紧急安全场景可 `Source revoked → 立即阻断新 retrieval / action → 记录临时阻断事件 → 异步完成影响确认和正式处置`。
- **跨租户双边责任（深化2 §3）**：源侧确认对象可被发现/派生、来源 ACL 允许指定目的、revision/血缘/敏感性完整、无禁止外发内容；目标侧确认接收用途、目标 Owner、消费者范围、保存期、再分享策略和撤回能力。"中介平台不能用自己的存储权限替代双方授权"；没有明确目标 Owner 的跨租户结果只能作为隔离候选。
- **导出物字段（深化2 §4 / 深化7 §1）**：`export_id/version`、`source/target tenant/project/space`、`requester/delegator/approver/recipient`、`purpose / allowed_actions`、`scope / depth / object and relation types`、`source versions / lineage refs / redaction policy`、`sensitivity / classification`、`created_at / expires_at / revoked_at`、`integrity digest / key reference / watermark reference`、`reshare policy / download and access events`。
- **导出三类控制目标（深化7 §2）**：加密保护未授权读取（依赖密钥、身份和生命周期）；水印/指纹帮助追踪来源、接收者和泄露路径（"不能阻止复制或授权"）；DLP/外发策略在生成、下载、分享和接收边界识别/阻断违规传输（"不能取代内容加密和来源 ACL"）。"加密失败不能用水印补偿"。
- **查询预算（深化3 §4）**：每个主体、用途、租户、资源范围、时间窗口和策略版本都应有可审计的查询预算/限频上下文；不能只按单次请求评估，需考虑同一数据集多次计数、不同过滤器、边界查询、错误重试、分页、排序和导出组合。"预算状态本身也不能泄露精确剩余量。"

### 7.5 关键规则与不变量

- **权限不因血缘扩大**：血缘存在 ≠ 可访问；能访问源对象 ≠ 可访问全部派生对象；血缘不得成为绕过 ACL 的反向索引（第1轮 §5）。
- **三段式权威**：断言 ≠ 当前关系；原始断言必须保留，当前关系不能取代断言历史（第2轮 §1）。
- **冲突不得自动裁决**："不得使用最后写入者、最高置信度、模型相似度或 Owner 级别单独裁决关系"（第2轮 §4）。
- **fail-closed 处置（第2轮 §5）**：低风险 + 血缘缺失 → 可暂存为不可执行候选；高风险 + 血缘缺失 → 隔离或阻断；低风险 + 推断关系 → 可作为候选、不进入执行链；高风险 + 关系冲突 → 阻断相关 retrieval/action 并进入治理队列；权限或来源不可信 → 默认拒绝；传播尚未完成 → "以权威状态为准，不因事件延迟恢复已撤回消费"。
- **失效快、恢复慢**：历史版本和已完成 Run 不被静默改写，但保留 `used_version`、`source_version_at_time`、`current_status` 和必要的事后失效标记（第1轮 §7）。
- **能力不可压缩**：四类可见性能力 + 跨空间/治理操作不能压缩为单一 `lineage:read`（第3轮 §1）；existence/metadata/summary/content/impact/export/admin 各自独立（深化1 §1）。
- **硬拒绝优先**：未知或冲突默认拒绝、隔离或最小投影；缺少主体、用途、ACL、敏感性、血缘或当前策略时 fail-closed（深化1 成功标准/阶段3）。
- **过滤优先于召回**：安全顺序为 authenticate → resolve Visibility Context → policy/ACL/sensitivity/revocation filter → candidate search → applicability and revision filter → ranking/fusion → redaction and budget projection → Context Manifest。"不能先召回全库再让应用层隐藏结果"；过滤后候选数量、分数、排序和错误也不能泄露被过滤对象（深化4 §2）。
- **派生数据继承治理**：Embedding、倒排索引、图索引、近邻缓存、查询缓存和 rerank 特征都可能泄露源信息或保留撤回内容；每个派生对象需 source refs、策略版本、可见范围、模型/索引版本、生成时间、失效状态和删除/重算能力（深化4 §3）。
- **Manifest 不是权限**：旧 Manifest 只作历史审计，不得继续用于新的检索、注入或行动；Harness/Agent 取得 Manifest 后不能通过自然语言扩大范围或将其内容当作工具授权（深化4 §4）。
- **缓存隔离**：缓存键至少绑定主体/委托链、用途、tenant/Project/Space、过滤上下文版本、策略/敏感版本、revision/environment、查询形态和过期时间；"无法证明不同主体/用途不会共享缓存时，禁用共享缓存"；"清理失败不能返回旧内容"（深化4 §5）。
- **超时/缺口不得伪装**：`completed` 表示本次声明范围在某个版本快照下完成计算，"不表示永久没有影响、源内容当前可见或可以执行处置"；部分结果必须区分"尚未扫描""无权查看""源缺失""任务失败""确实没有下游"（深化5 §1/§4/§3 结论）。
- **异步任务不沿用永久授权**：必须保存请求版本而非永久授权，并在开始、每个敏感分区、分页/续跑和交付前重新检查当前权限、源撤回、策略、目标范围和接收者（深化5 §2）。
- **两阶段撤回边界**：Phase A 只执行已预授权、可逆或最小止损动作；Phase B 的删除、恢复、跨租户通知、生产变更、长期 ACL 修改、知识替代和责任/风险接受必须走对应审批（深化6 §2）。
- **自动阻断不越级**：对已运行副作用动作只能按工具幂等/停止能力和既定 RunGate 策略暂停、取消或标记 `containment_pending`，"不能盲目杀进程、回滚数据库或伪造成功"（深化6 §3）。
- **撤回优先于恢复**："撤回优先级高于普通恢复和缓存刷新；恢复事件不能因为到达较晚而自动解除已生效阻断"（深化6 §5）。
- **传播完成不等于外部清理**：`propagation=complete` 只说明声明范围的控制传播完成，"不能证明外部离线副本不存在"（深化6 §4）。
- **导出物不是裸文件**：即使下载成功，接收者也不能据此获得源内容、检索、发布或执行权；"导出失败、校验失败、接收者无法认证或撤回传播不明时不得降级为裸文件交付"（深化2 §4/§3 协议）。
- **审批绑定与失效**：审批绑定导出版本、内容范围、接收者、用途、密钥策略、有效期和允许动作；内容、范围、接收者、目的、策略或敏感性变化使批准失效（深化7 §4）。
- **平台外发能力边界**：平台可控制生成、下载、访问、分享链接、密钥发放、撤回通知和在线副本；对已下载到个人设备、截图、复制文本、邮件转发、备份、打印和第三方系统副本，可能只能记录 unknown/待接收方处置，"不能声称已物理清除"（深化7 §5）。
- **文档反例约束（择要）**：`role=admin ≠ read all content`、`can see edge ≠ can read source`、`hidden node ≠ zero impact`、`empty result ≠ no impact`、`lineage reference ≠ ACL inheritance`、`historical cache ≠ current authorization`（深化1）；`platform admin ≠ tenant owner`、`export success ≠ recipient may reshare`、`partial result ≠ no impact`（深化2）；`noise added ≠ query is authorized`、`single query safe ≠ composition safe`（深化3）；`trace context ≠ authorization`、`UI-hidden ≠ access-controlled`、`manifest exists ≠ current permission`（深化4）；`queue accepted ≠ analysis completed`、`checkpoint ≠ permission snapshot`（深化5）；`signal detected ≠ authorized revoke`、`post-approval ≠ prior authorization`（深化6）；`encrypted ≠ authorized`、`watermarked ≠ confidential`、`link expiry ≠ downloaded copy deleted`（深化7）。
- **第一版不建设/不实现（第1轮 §8）**：完整图数据库、自动因果裁决、Token 级溯源、无人工确认的高风险影响处置。
- **自动化可做与不可做（各深化"自动审核与推进"）**：可校验主体/角色/用途/资源/关系/深度/ACL/敏感/策略版本、生成最小投影与缺口标记、缓存失效任务、审计记录、影响分析候选、分桶结果、进度/缺口状态、标记 stale/partial；不能自动扩大范围、推断不存在影响、把管理员或审计角色升级为全内容读取、绕过跨租户审批、导出血缘、恢复已撤回节点、把 partial 变 complete、用旧授权交付、把分析结果变成撤回/执行授权。

### 7.6 界面/交互线索

- 文档明确的是"展示什么、不展示什么"，**未给出线框图、页面结构或组件级交互**。
- 隐藏节点处理（第3轮 §5）：用户需要理解阻断原因但不能看源对象时返回抽象占位；抽象占位不得泄露原始名称、精确 Project、用户身份、文件路径、客户标识或未经授权的精确影响数量。
- 产品视角要求（深化1 阶段4）："UI 可展示授权范围内的抽象占位和缺口状态，不用隐藏复杂性换取越权。"
- 产品视角要求（深化4 阶段4）："UI 可隐藏协议细节，但必须展示范围、缺口、过期和 partial 状态。"
- 撤回体验（深化6 阶段4）："展示阻断原因类别、范围、时间、缺口和下一门槛，不暴露受限源细节。"
- 长任务体验（深化5 阶段4）："进度、缺口、取消和重新提交可见；不把截断或超时报告标作 complete。"
- 查询隐私体验（深化3 阶段4）："面向用户展示风险级别、精度/不确定性和用途，不暴露可用于攻击的内部参数"；不得向普通消费者暴露精确预算或内部噪声参数（深化3 §3 结论）。
- 跨租户体验（深化2 阶段4）："提供分级请求和清晰缺口，隐藏实现复杂度但不隐藏租户边界、用途和可见性限制。"
- 导出体验（深化7 阶段4）："对低风险提供平台内预览和分级简化；高风险以安全和可审计为先。"

### 7.7 仍暂缓未定的内容

- **原始三条暂缓表（第3轮末）**：血缘可见性权限的完整 RBAC/ABAC 策略矩阵；跨租户影响分析和导出协议；血缘查询的精确差分隐私、数量隐藏和侧信道防护参数；血缘可见性与搜索、Embedding、Context Manifest 的统一过滤协议；全局影响分析的性能、缓存和异步任务模型；紧急撤回、自动阻断与事后审批的完整流程；血缘导出文件的水印、加密和外发控制（均注明"留待以后讨论"）。
- **深化1 暂缓**：企业最终 RBAC 角色目录、ABAC 属性词典和策略语言；跨租户影响分析、导出和 Break-Glass 审批；差分隐私/数量隐藏/侧信道防护参数；Search/Embedding/Manifest 的统一过滤和缓存一致性实现；大规模影响闭包的性能、异步任务和失败恢复；水印、加密和外发控制的技术实现。
- **深化2 暂缓**：租户目录、跨租户身份联合和双边审批的最终实现；T0–T3 完整动作目录、阈值、SLA 和法律例外；差分隐私、数量隐藏、侧信道和重识别评估参数；导出包的加密、密钥、DRM、水印、DLP 和技术性 no-reshare；大规模跨租户影响闭包、缓存、异步和失败恢复；撤回/删除对已交付导出物、备份和离线副本的完整处置。
- **深化3 暂缓**：各数据集的邻接定义、epsilon/delta、贡献上限和组合预算；噪声机制、图查询 DP、成员推断和重识别评测；统一最小计数阈值、错误/延迟/响应填充和缓存隔离实现；跨租户应急预算、Break-Glass 和审计流程；全局查询历史、预算一致性和多副本传播；DP 结果与导出、Embedding、Index、Manifest 的组合传播。
- **深化4 暂缓**：Visibility Context 的最终 Schema、策略 DSL 和 Connector 映射；向量/全文/图索引的前置过滤实现与性能优化；Embedding/Cache/Manifest 的一致性、清理和重算协议；跨租户过滤、DP 与组合查询协议；过滤缺口对召回质量、泄露率和任务成功率的完整指标；物理删除、备份和离线索引清理。
- **深化5 暂缓**：同步/异步切换阈值、SLA、配额和优先级算法；全局影响分析的存储、队列、图计算和分页协议；缓存一致性、Checkpoint 加密和跨副本恢复；任务取消、死信、人工接管和重试补偿细则；部分结果的用户界面、告警和消费者适配；跨租户长任务、预算和离线导出治理。
- **深化6 暂缓**：P0–P3 触发目录、置信阈值和自动阻断范围；已运行 Run 的逐工具暂停/取消/回滚策略；跨租户通知、法律义务和接收方撤回流程；Embedding/Index/Cache/Manifest 的传播一致性和清理证明；事后复核 SLA、责任矩阵、证据保留和风险接受；外部导出、备份、离线副本的技术撤回和加密擦除。
- **深化7 暂缓**：E0–E3 完整内容目录、阈值和法务例外；加密算法、密钥服务、轮换/吊销和终端密钥交付实现；水印/指纹格式、抗移除、误归因和取证规则；DLP、DRM、CASB 和外发通道集成；下载、备份、离线副本和接收方撤回/删除的技术协议；导出体验、性能、审计保留和运营 SLA。
- **总体状态（第3轮末"后续独立讨论点"）**：议题 7 当前列出的独立讨论点已完成；"血缘 Schema、事件协议、跨租户边界、权限矩阵和运营指标等暂缓事项留待以后讨论，不视为所有实现细节已经固化。"
- **文档未明确**：血缘图的具体可视化形态、节点/边在 UI 上的层级与展开规则、告警通道与通知模板。

---

## 议题 8：使用反馈驱动的自进化

### 8.1 已确认结论清单

- **8-C1（第1轮）**：自进化采用"反馈事件 → 证据分类与归因 → 进化候选 → 验证 → 人工或受控审核 → 新版本发布 → 灰度观察与回滚"闭环；"任务成功或失败不能直接证明记忆、知识或 Skill 正确或错误"；反馈必须绑定资产版本、Context Manifest、User/Harness、Task、Work Thread、Run、repo/revision、环境和用途，并区分记忆错误、召回/排序/融合/投影错误、执行错误、环境错误、验证错误和治理错误；各类反馈以追加证据保留、不能直接覆盖资产；反馈可影响相关性、排序、召回资格、适用范围候选、过期标记、投影策略和复核优先级，不能自动改变 ACL、canonical owner、敏感性、跨空间范围、安全规则、Tool Policy、RunGate、审批角色或生产权限；高影响/安全/合规/权限/敏感反馈必须立即阻断相关 action 并进入人工或受控审核；质量指标分三层，安全与权限指标是"不可被业务成功率抵消的硬护栏"。
- **8-C2（第2轮）**：归因必须沿"授权与过滤 → 检索 → 排序 → 融合 → 投影 → Harness 理解 → 执行 → 验证 → 业务结果"阶段 Trace 展开，并将 Feedback Event、原始 Trace、Attribution Candidate、Evaluation Result 和资产变更分开建模；"任务成功或失败不能直接归因于最后使用的记忆、Skill 或 RCA"；归因必须保留支持证据、反证、多重原因、已排除原因和未知状态；权限、安全、敏感性、血缘和版本匹配检查优先于相关性归因；`confirmed` 必须经人工或受控审核，"不能由模型或自动归因器自我确认"；第一版"优先实现可审计、可重放、可回滚的阶段归因链，不追求自动因果裁决"。
- **8-C3（第3轮）**：资产和变化的自动化程度"必须由资产风险、变化风险、影响范围、证据强度和可逆性共同决定，而不能由反馈数量、采纳率或单一质量分数决定"；低风险可自动（降权、收窄候选、标记过期、暂停 action、小范围灰度），内容实质变化/适用范围/检索资格/消费者状态变化进入受控审核，ACL/敏感性/跨空间/生产/安全/合规/可执行 Skill/资产恢复/高影响退休必须人工或专门治理审核；退休采用 `active → deprecating → restricted → archived` 可逆软退休，"不能根据'未使用'直接删除"；自动发布必须通过来源、血缘、版本、权限、敏感性、固定评测、回滚、灰度范围和反馈异常保护门；防投毒采用身份、独立性、证据和异常四重检查；可疑反馈保留原始事件、隔离并排除在自动发布和退休统计之外，"但不得静默删除"；"采纳率不等于正确性、安全性或可扩大权限"。
- **8-C4（深化1）**：采用"风险分层 + 硬门禁 + 可比证据 + 多指标观察 + 可逆动作"门槛体系，"不采用单一总分或固定普适数字"；L0/L1 低风险可按策略自动发布或灰度，L2 进入受控审核，L3 禁止自动发布、退休和恢复；灰度必须绑定版本、策略、消费者、Harness、任务、repo/revision、环境、分桶、对照、观察窗口和停止条件；缺少基线、样本、独立性、覆盖、评测或反馈异常未解时返回 `hold/needs_review/blocked`；"软证据不能抵消硬门失败"。
- **8-C5（深化2）**：投毒治理采用"身份可信度 + 样本独立性 + 真实证据 + 内容安全 + 时序/行为异常 + 资产影响"多维检测，"不使用单一异常分数或多数票直接裁决"；可疑反馈进 `suspicious/poisoning_candidate` 隔离视图，不进入高风险自动发布、退休或训练统计，正常反馈保持可见；检测结果必须版本化、可解释、可复核并允许误报纠正；只有受控审核才能确认无效或采取主体/资产处置；不确定时默认 `hold/needs_review/blocked`，"而不是自动惩罚或自动采纳"。
- **8-C6（深化3）**：跨组织独立性采用"组织/主体区分 + 运行链区分 + 共享输入/依赖检查 + 独立验证"的证据状态，`I0 unknown / I1 administratively distinct / I2 operationally distinct / I3 evidentially independent / I4 replicated independent` 只表示针对特定 claim/asset/version 的证据强度；I0/I1 不进入高风险自动发布/退休的独立证据，I2 低权重补充，I3/I4 才可按批准统计口径贡献较强独立证据；跨组织判断尽量只交换授权的证明/摘要、资产版本和共享依赖指标；共因产生的是影响复制证据，"不自动等于独立根因验证"；无法判断时标记 unknown，"不自动合并、不自动判定串谋、不自动处罚主体"。
- **8-C7（深化4）**：自动资产退休采用"消费状态、审计/保留状态、存储副本状态"三条生命周期分离；自动化最多在低风险、范围已知、血缘完整、无法律保全/未决申诉/高风险消费者、替代或保留理由明确且可恢复时标记 `deprecating`/`restricted`，不因低使用、低采纳或新版本存在直接删除；`revoked` 立即阻断检索、注入、行动和再派生，`archived` 只表示受控历史保留、不授予检索权，`erased` 必须绑定删除范围、方法、验证和例外；来源删除义务与法律/审计保全冲突时保留最小、隔离、不可检索/不可行动的证据，并由法务/隐私/安全责任人决定；无法证明副本清理或外部删除时标记 `unknown/failed/external_unknown`。
- **8-C8（深化5）**：多维灰度采用"问题驱动分层 + 稳定随机化单位 + 版本化对照 + 渐进扩大 + 硬护栏停止"，"不把所有因素做笛卡尔积，也不预设统一统计阈值"；同一 Task/Run/Session 默认保持稳定分桶；样本不足、组合稀疏、共享依赖或跨组干扰时标记 `insufficient_evidence/contaminated`，不强行推广；质量、消费、任务、运维和安全指标分层观察，安全/权限/血缘违规、泄露、注入、回撤失败和关键回归"优先停止、收缩或回滚，不能被平均业务成功率抵消"。

### 8.2 核心对象与关系

- **反馈分类（第1轮 §1）**：`memory_error`、`retrieval_error`、`ranking_error`、`fusion_error`、`projection_error`、`instruction_error`、`execution_error`、`environment_error`、`verification_error`、`governance_error`、`user_preference`。"任务结果是结果信号，不是对单条记忆的直接裁决。"
- **反馈类型（第1轮 §2）**：显式人工反馈（正确、错误、有帮助、无关、过期、范围过宽/过窄、步骤不可执行、敏感或权限问题）；行为反馈（采纳、修改、删除、跳过、重新检索、切换 Harness、撤回工具调用）；工程验证（测试、构建、静态检查、Patch 应用、回滚、原问题复现、回归和生产观察）；长期有效性（重复误召回、revision 变化、依赖变化、规则变化、长期未使用和被新版本替代）。"行为反馈是弱信号，不能单独裁决正确性。"
- **反馈上下文绑定（第1轮 §3）**：`feedback_id`、`feedback_type`、`asset_id / asset_version`、`memory_id / memory_version`、`context_manifest_id / version`、`user / agent / harness`、`task / work_thread / run`、`repository / revision`、`environment`、`purpose`、`retrieval_position`、`projection_version`、`action_status`、`verification_results`、`feedback_author`、`recorded_at`、`sensitivity`。同一资产在不同 Project、revision、环境、Harness 或用途下可能结果不同，"不能将反馈无条件全局化"。
- **反馈事件与资产版本分离（第1轮 §4）**：`Asset v1 → Feedback Event → Evaluation / Review Candidate → Asset v2 Candidate → 验证与审核 → Asset v2`；反馈不能直接覆盖、删除或改写资产；正面、负面、验证、回归、过期、撤回和权限反馈都以追加证据保留。
- **归因阶段与证据链（第2轮 §1）**：阶段为 `authorization → retrieval → ranking → fusion → projection → harness_interpretation → execution → verification → business_outcome`；每阶段记录 `stage`、`input_refs`、`output_refs`、`asset_versions`、`policy_version`、`model_or_rule_version`、`status`、`duration`、`error`、`actor`、`timestamp`。完整评估链路：`Feedback Event → Context Manifest → Retrieval Trace → Candidate Assets → Fusion Result → Harness Projection → Tool Calls / Run → Verification → Final Outcome`。缺少关键环节时结论必须降级为 `unknown`、`insufficient_evidence` 或 `multiple_possible_causes`，"不能用最终失败结果填补缺失证据"。
- **归因候选与评估结果（第2轮 §2）**：候选类型 `primary_cause`、`contributing_factor`、`correlated_event`、`ruled_out`、`unknown`；候选字段 `candidate_id`、`cause_type`、`stage`、`status`、`evidence_refs`、`counter_evidence_refs`、`scope`、`impact`、`confidence_state`、`review_state`；评估结果字段 `evaluation_id`、`feedback_id`、`primary_cause_candidates`、`contributing_factors`、`ruled_out_candidates`、`unknowns`、`affected_asset_versions`、`affected_consumers`、`recommended_action`、`review_requirement`、`created_at`、`created_by`。
- **进化候选字段（第1轮 §7）**：`candidate_id`、`base_asset_version`、`feedback_refs`、`evidence_refs`、`proposed_change`、`scope_change`、`policy_version`、`model_or_rule_version`、`risk_level`、`expected_effect`、`validation_plan`、`rollback_version`、`review_state`。
- **资产风险分级（第3轮 §1）**：自动化程度同时考虑 `asset_type`、`change_type`、`risk_level`、`scope_change`、`consumer_state`、`evidence_strength`、`blast_radius`、`reversibility`。低风险变化：非敏感表达优化、排序调整、低风险投影调整、明确过期的参考条目降权；中风险：收窄 Project/revision 适用范围、暂停普通检索、修改摘要或改变消费者召回资格；高风险：RCA 根因改变、可执行 Skill、生产/权限/合规/客户数据影响、跨 Project/Team 扩展、敏感性变化和资产恢复。
- **风险层级（深化1 §3）**：L0 低风险参考（非敏感、只读、无范围扩大、可回滚）；L1 受限知识/投影（影响有限、固定评测和受控消费者）；L2 高影响解释或默认检索资格（生产/跨服务/重要任务）；L3 可执行、权限、敏感、跨空间、客户/生产或不可逆。"变化本身可能把 L0 升级为 L2/L3。"
- **反馈可信度绑定（深化2 §2）**：`feedback_id / asset_version / consumer`、`principal / delegation / harness / organization`、`session / work_thread / task / run / trace`、`context_manifest / repo / revision / environment`、`claim / label / outcome / evidence_refs`、`timestamp / source_channel / duplicate_group`、`identity_state / independence_state / evidence_state`、`content_safety_state / anomaly_state / adjudication_state`。"把反馈视为一条待评估 Evidence，而不是可信标签。"
- **投毒攻击面目录（深化2 §1）**：`identity spoofing`、`feedback flooding`、`collusion`、`independence gaming`、`selective reporting`、`context injection`、`version confusion`、`outcome fabrication`、`strategic retirement`、`training contamination`。
- **最小化共享信号（深化3 §3）**：`organization_scope_token`、`independence_group commitment`、`asset/version and claim hash`、`source/event class`、`execution/environment class`、`shared_dependency indicators`、`verification result summary`、`privacy-preserving aggregate`。
- **灰度绑定字段（第3轮 §4 / 深化5 §1）**：`asset_version`、`policy_version`、`model_or_rule_version`、`consumer`、`harness`、`team / project / tenant scope`、`task_type / use_case`、`repository / revision`、`environment`、`rollout_bucket`（含 `control version`）、`observation window / stop conditions`。

### 8.3 状态与枚举

- **自进化动作分层（第1轮 §5）**：低风险可自动或按策略——汇总重复反馈、标记明显过期、降低排序、生成复核候选、追加测试/Trace/验证结果、提醒责任人、生成版本差异；中风险需受控审核——收窄适用范围、暂停普通检索、修改投影模板、生成新的知识草稿、标记需要复核；高风险必须人工或受控审核——生产、安全、合规、权限、敏感性、根因、可执行 Skill、跨空间扩展、资产恢复或撤回。
- **归因动作分层（第2轮 §5）**：自动/按策略——记录归因候选、追加 Trace 和验证、降低排序、生成复核任务、暂停某个 action、生成测试或验证提醒；受控流程——收窄某个 Project 或 revision 的适用范围、暂停某个 Harness 的 retrieval、重新生成知识草稿、生成 RCA 复核版本、撤回某个派生投影；必须人工或受控审核——确认根因、认定资产错误、全局撤回、修改权限或敏感性、恢复高风险资产、发布可执行 Skill、接受生产或合规残余风险。
- **归因候选状态（第2轮 §2）**：`candidate`、`supported`、`partially_supported`、`contradicted`、`ruled_out`、`unknown`、`confirmed`。
- **反馈可影响维度（第1轮 §6）**：`relevance`、`ranking`、`retrieval eligibility`、`scope candidate`、`expiry candidate`、`projection template`、`validation reminder`、`review priority`。
- **反馈不可自动影响维度（第1轮 §6）**：`ACL`、`canonical_owner_scope`、`sensitivity class`、`cross-space boundary`、`security rule`、`tool permission`、`RunGate policy`、`approval role`、`production access`。
- **局部退化处置（第1轮 §7）**：只降低某 Harness 的 retrieval、只阻断 action、只收窄某 Project 的适用范围、只暂停某个 revision、只撤回某个敏感投影、只暂停某个派生 Embedding。
- **自动发布保护门（第3轮 §3）**：来源完整、血缘完整、版本一致、无权限扩大、无敏感性扩大、无跨空间扩大、无未解决高风险冲突、固定评测通过、回滚可用、灰度范围受限、反馈没有异常集中。任一不满足即 `hold`、`needs_review` 或 `blocked`，"不能仅降低分数后继续发布"。
- **低风险自动处理前置条件（第3轮 §2）**：非敏感、无权限扩大、无跨空间扩大、无高风险冲突、来源和血缘完整、变化可逆、影响范围受限、有基本验证、反馈来源无异常。
- **资产状态与软退休生命周期（第3轮 §5）**：状态 `unused`、`low_adoption`、`superseded`、`expired`、`invalidated`、`revoked`、`archived`；生命周期 `active → deprecating → restricted → archived`。自动化最多标到 `deprecating` 或 `restricted`；进入 `archived` 前需退休原因、证据、影响分析、替代资产或保留理由、回滚版本、责任人、观察窗口和审计记录。"'未使用'不等于'无价值'，不能直接触发删除。"
- **反馈防投毒四重门（第3轮 §6）**：身份门（主体真实且有权反馈）、独立性门（不是同一 Work Thread / Agent / Run 的重复样本）、证据门（绑定真实使用、版本、Trace、验证或结果）、异常门（短时刷量、集中反馈、结果不一致和注入内容）。
- **反馈可信度保留字段（第3轮 §6）**：`feedback_author`、`principal_type`、`harness`、`organization / team`、`session / work_thread`、`source_event`、`independence_group`、`authorization_state`、`evidence_strength`、`duplicate_group`、`anomaly_state`。
- **异常类型与处置（深化2 §3）**：`normal`（可进入相应统计）、`low_confidence`（降权或等待更多独立证据）、`suspicious`（原始保留、排除自动决策统计、进入复核）、`poisoning_candidate`（绑定资产风险、阻止高风险自动变化）、`confirmed_invalid`（记录裁决、不抹除原始事件）、`abuse_incident`（进入安全/权限/组织治理流程）。
- **独立性分层（深化3 §2）**：`I0 unknown`、`I1 administratively distinct`、`I2 operationally distinct`、`I3 evidentially independent`、`I4 replicated independent`。"层级是证据状态，不是对组织或个人的信用等级。"
- **聚合单位（深化3 §3 结论）**：`raw_feedback_count`、`unique_principal_count`、`unique_organization_count`、`independence_group_count`、`replication_group_count`、`verified_outcome_count`、`unknown_independence_count`；这些计数不应全部对所有消费者可见，跨组织结果按用途返回分桶/聚合摘要。
- **退休五种含义（深化4 §1）**：`restricted`（不进入默认检索/注入，但仍可受控引用）、`suspended`（因风险/验证/权限状态暂时不可用）、`revoked`（权威撤回，阻断新的消费和派生）、`archived`（按保留策略保存历史版本和审计）、`erased`（按授权/合规流程完成逻辑或物理清除）。
- **三条生命周期（深化4 §2）**：消费生命周期 `active → restricted/suspended → revoked/archived`；审计/证据生命周期（保留、冻结、到期、移交、受控销毁）；存储副本生命周期（正文、摘要、Embedding、Index、Cache、Manifest、导出、备份、日志、灾备副本）。
- **保留/删除冲突优先级（深化4 §4）**：`legal/security hold or mandatory audit retention > source revocation / privacy erasure obligation > active operational retention > product convenience/cache retention`；但"优先级不能机械解决法律冲突"，需保留最小、受限、不可用于检索/行动的审计事实或摘要，并由法务/隐私/安全责任人决定。
- **派生资产处置标记（深化4 §5）**：每项标记 `to_block / to_recompute / to_delete / retain_minimal / external_unknown`，"而不是只修改主表状态"。
- **退休状态组（深化4 §3 结论）**：`content_status`: active | deprecating | restricted | suspended | revoked | archived | erased；`retention_status`: normal | hold | retain_minimal | due | deletion_pending | deleted | unknown；`copy_status`: current | blocked | invalidated | cleaned | external_unknown | failed。
- **决策门槛矩阵与判定顺序（深化1 §3）**：四类决策分别有自动允许最低条件与必须阻断/审核情况——自动发布、灰度扩大、软退休、恢复。判定伪代码顺序：硬门失败/安全未知/权限未知 → `blocked`；`risk_level >= L3` → `human_or_governance_review`；无可比基线/反馈异常/缺回滚 → `hold`；发布且 ≤L1 且评测通过且灰度受限 → `auto_allowed_by_policy`；灰度扩大且对照稳定且停止条件清晰 → `controlled_expand`；退休且可逆软状态且影响已复核 → `deprecate_or_restrict`；否则 `needs_review`。"硬拒绝必须先于软指标比较。"
- **灰度指标层次（深化5 §5）**：`quality`（recall/precision/correction/groundedness）、`consumption`（retrieval/use/skip/override/adoption）、`outcome`（task verification/success/failure/rework）、`operations`（latency/error/cost/rollback）、`safety`（leakage/injection/permission/revocation/policy violation）。
- **灰度生命周期（深化5 §3 结论）**：`design question and estimand → select unit/strata/control/treatment → verify eligibility, ACL, sensitivity and rollback → assign stable bucket → small canary → monitor layered metrics and hard guardrails → continue | shrink | pause | rollback → compare within declared scope → controlled expansion or review → close experiment and retain provenance`。
- **三层指标（第1轮 §8）**：记忆/知识质量（事实正确率、来源完整率、适用范围准确率、过期识别率、冲突发现率）；消费质量（召回准确率、无关召回率、排序质量、融合错误率、投影完整率、敏感误召回率）；任务结果（测试通过率、构建通过率、Patch 成功应用率、回滚率、复发率、生产异常率、人工纠正率）。
- **硬门与软证据（深化1 §1）**：hard gates——source/lineage/ACL/sensitivity/revocation valid、no permission or scope expansion、no unresolved high-risk conflict、fixed evaluation and rollback available、feedback identity/independence checks pass；soft evidence——quality delta / regression rate、adoption and correction rate、task outcome / verification result、recency / coverage / environment diversity、rollout stability / incident signal。"软证据不能抵消硬门失败；高采纳率不能抵消权限、血缘或安全未知。"
- **可疑反馈统计隔离流程（第3轮 §7）**：异常反馈 → 保留原始事件 → 标记 `suspicious` → 不进入自动发布或退休统计 → 进入治理队列 → 允许人工复核。"可疑反馈不能被静默删除；正常反馈也不能因出现异常样本而被静默忽略。"

### 8.4 角色与权限边界

- **反馈不得触碰的权限面（第1轮 §6 / 第3轮 §8 / 深化2 §3 结论）**：反馈不能改变 ACL、安全规则、工具权限和跨空间边界；`feedback_count`、`adoption_rate`、`success_rate` 和 `anomaly_score` "都不能单独改变 ACL、敏感性、Owner、跨空间范围、Tool Policy 或 RunGate"。
- **必须人工或受控审核的动作（第1轮 §5 / 第2轮 §5 / 第3轮 §2）**：确认根因、认定资产错误、全局撤回、修改权限或敏感性、恢复高风险资产、发布可执行 Skill、接受生产或合规残余风险；ACL、敏感性、跨空间、生产、安全、合规、可执行 Skill、资产恢复、高影响退休和不可逆变更。
- **L3 禁止自动（深化1 §3 结论）**：涉及 ACL、敏感性、跨空间、生产、安全、合规、客户数据、可执行 Skill、权限/消费者状态扩大或不可逆影响的 L3 变化，"禁止自动发布、退休和恢复"。
- **跨组织隐私边界（深化3 成功标准/§3 结论）**：支持跨组织隐私最小化、不可见关系和受控聚合；平台只应获得判断独立性所需最小属性，"不能为了'查串谋'建立跨组织无边界的行为画像"；"组织证明或独立性 token 不能反向成为跨租户内容读取权"。
- **检测系统的自我约束（深化2 成功标准/§4 结论）**：检测系统自身不扩大权限、不暴露敏感行为、不把相关性当作恶意证明；"不能自动认定主体恶意、删除反馈、改变权限、发布 L2/L3 资产、退休高影响资产、将可疑样本加入训练或绕过申诉/审计"；反馈检测器"不能自动公开攻击者身份、跨组织行为或敏感证据"。
- **隐私约束（深化2 阶段4）**：行为异常检测需最小化、用途绑定和访问控制，"输出统计/风险状态，不默认暴露个人行为细节"。
- **主体处置边界（深化2 阶段4 / 深化3 成功标准）**：确认投毒后不在本轮自动封禁主体，需身份、组织、安全和申诉流程；独立性未知时"不自动计为独立，也不自动判定串谋"。
- **保留对象的访问控制（深化4 成功标准/§3 结论）**：保留对象仍受当前 ACL、用途、敏感和最小必要访问控制；任何 `archived`/`retain_minimal` 对象的 `reference/retrieval/action` 默认分别为受限/阻断；审计读取也按当前主体、用途、敏感和最小必要原则授权。
- **法律与合规决策权（深化4 §4 / 阶段4）**："平台不能自行解释法律义务"；"平台只执行已授权决策，法务/隐私/安全责任人处理冲突"。
- **反馈正文按不可信输入处理（深化2 §3 结论）**："反馈正文先按不可信输入处理；不把其中的指令、链接、秘密或'批准'文本当作治理命令"；"先做内容安全、来源、授权和训练准入检查，默认不进入训练"。
- **统计口径与独立性（深化3 §3 结论 / 深化2 关键规则）**：同一主体的多个 Harness、同一 Run 的多个 Trace、自动重试和同一 Work Thread 的重复提交需要分组，"不能机械计为独立样本"；"同一 Work Thread 内多次反馈不能简单等价于多个独立验证"。
- **灰度隐私边界（深化5 §3 结论）**：分桶键应使用经授权的稳定伪名/哈希，不向普通消费者暴露原始身份或完整桶映射；"分桶结果不向普通消费者暴露他人所属桶、组织分布或精确小样本统计"。

### 8.5 关键规则与不变量

- **硬门先行（第2轮 §3 / 深化1 §1）**：归因顺序为权限/安全/敏感性检查 → 阶段 Trace 完整性检查 → 定位最早异常阶段 → 生成多原因候选 → 追加支持和反证 → 判断影响范围 → 形成评估结果 → 人工或受控审核；"权限、安全、血缘和 revision 检查优先于相关性归因"；"最早异常是排查入口，不自动等于唯一根因"。
- **任务结果不是资产裁决**："任务成功或失败不能直接证明记忆、知识或 Skill 正确或错误"（第1轮总确认）；"任务成功或失败不能直接归因于最后使用的记忆、Skill 或 RCA"（第2轮总确认）。
- **自动化边界（第1轮 §5 / 第3轮 §2 / 各深化"自动审核与推进"）**：默认优先使用降权、收窄、暂停和灰度等局部可逆动作，"不自动删除或执行不可逆全局变化"；不能自动选择高风险阈值、绕过硬门、发布 L2/L3、改变 ACL/敏感/跨空间、恢复高风险资产、物理删除历史或把单一指标当批准。
- **反馈可影响 / 不可影响维度**：见 8.3（第1轮 §6）。
- **三层指标与硬护栏（第1轮 §8）**："安全、隐私、权限和敏感误用指标是硬护栏，不与业务成功率平均"；"安全、权限、血缘和高风险失败是硬停止条件，不能被平均任务成功率抵消"（深化5 §5）。
- **正向与负向反馈对称（深化2 §4）**："只统计正面反馈会被刷采纳，只统计负面反馈会被恶意压低"；应把反馈与真实使用、验证、回滚、人工纠正、任务结果和复发事件交叉核对；"没有实际证据的意见可以作为低权重主观反馈，但不能伪装成验证结果"。
- **反馈是追加证据（第1轮 §4）**：反馈不能直接覆盖、删除或改写资产；正负、验证、回归、过期、撤回和权限反馈都以追加证据保留；历史版本保持不可变（第1轮 §7）。
- **版本对照要求（第2轮 §6）**：候选变化应使用固定评测任务、固定上下文、固定资产版本、固定 revision/环境和固定预期结果进行前后对照，并结合回归测试、灰度和人工抽样；至少比较误召回是否减少、漏召回是否增加、投影完整性是否改善、执行风险是否增加、其他 Project 或 Harness 是否受到副作用影响。
- **数据质量最低要求（深化1 §4）**：任何数值比较都需要固定对照（资产版本、模型/规则版本、Context Manifest、Harness/consumer、Task 类型、repo/revision、环境、时间窗口、采样/覆盖和预期标签）；缺少可比基线、线上与离线口径冲突、反馈独立性不足或样本被异常投毒时，结果只能 `insufficient_evidence`。
- **四类决策不共用阈值（深化1 §2）**：自动发布、灰度扩大、软退休、恢复四类决策的阈值应分开；"同一资产可以满足灰度扩大但不满足自动发布，也可以因 source revoke 直接暂停而不等待质量统计"。
- **恢复必须重检（第3轮 §5 / 深化1 §3 结论）**：历史版本不可变，恢复必须重新检查当前权限、血缘、敏感性和适用范围；恢复前需当前权限/血缘/敏感/适用性重检、固定验证通过和小范围灰度。
- **退休可逆、不可直接删除**："自动化最多将低风险资产标记为 `deprecating` 或 `restricted`"；"'长期未使用''采纳率低''出现更高版本'只能触发候选，不能单独触发删除"（深化4 §3）。
- **退休/删除必须做影响闭包（深化4 §5）**：退休/删除请求必须生成影响闭包，覆盖知识正文、版本、摘要、Embedding、Index、Cache、Manifest、Harness Projection、Feedback Statistics、导出文件、备份、日志和训练候选，"而不是只修改主表状态"。
- **删除结果可验证（深化4 成功标准）**："删除/清除结果可验证，无法证明时标记 unknown/failed，不宣称完成。"
- **反馈源变化触发重评估（深化2 §3 结论）**："反馈源撤回或权限收窄时，相关统计、模型/规则版本、训练候选和发布决策都要重新评估"；独立性结论本身也有版本和有效期（深化3 §3 结论）。
- **灰度稳定性与污染（深化5 §3 结论）**：同一 Task/Run/Session 默认保持稳定分桶，避免跨版本污染；变更关键上下文（权限、revision、环境、策略、消费者）时创建新实验或重新分桶；共享缓存、模型、工具或供应商造成的跨桶影响要记录并降低结论强度；"灰度结果只支持特定范围/版本决策，不自动推广为普遍结论"。
- **灰度硬停止（深化5 §3 结论）**：灰度期间发生撤回、敏感升级、策略变化或高风险反馈时立即暂停相关桶并重新检查。
- **文档反例约束（择要）**：`high adoption ≠ correct/safe`、`single score ≠ release approval`、`low usage ≠ useless`、`soft retired ≠ deleted`、`historical success ≠ current applicability`（深化1）；`many feedbacks ≠ independent evidence`、`negative burst ≠ confirmed poisoning`、`anomaly score ≠ malicious identity`、`quarantined ≠ deleted`、`not anomalous ≠ safe to publish`（深化2）；`different organization ≠ independent cause`、`unique organization ≠ no collusion`、`organization token ≠ content access`、`unknown independence ≠ malicious`（深化3）；`low usage ≠ safe to delete`、`archived ≠ retrievable`、`revoked ≠ every copy erased`、`delete requested ≠ delete authorized`（深化4）；`traffic percentage ≠ comparable experiment`、`no significant difference ≠ equivalent`、`average success ≠ no subgroup harm`、`experiment complete ≠ universal conclusion`（深化5）。
- **第一版能力边界（第1轮 §9）**：优先实现 Feedback Event、上下文绑定、反馈分类与归因、正负证据追加、复核候选生成、低风险降权/收窄候选、高风险立即阻断、进化候选验证计划、版本化发布/灰度/回滚、三层指标、硬护栏、反馈血缘和审计；第一版"不自动修改 ACL、扩大跨空间范围、提高工具权限、确认根因、发布高风险 Skill，也不根据单一采纳率或任务失败删除资产"。
- **第二版（第2轮 §7）与第三轮（第3轮 §8）第一版优先能力**：阶段 Trace、Attribution Candidate Set、支持证据与反证、多原因和未知状态、评估结果与推荐动作、归因审核状态、固定评测集、版本前后对比、关联资产/RCA/知识血缘；以及资产和变化风险分类、自动化矩阵、可逆降权/收窄/暂停/灰度、软退休状态、自动发布保护门、多维灰度分桶、反馈四重检测、可疑反馈隔离、审计/回滚/责任人。

### 8.6 界面/交互线索

- 文档同样以"展示什么、不展示什么"为主，**未给出线框图或组件级交互设计**。
- 独立性展示（深化3 阶段4）："UI 展示'独立性未知/已验证'等解释和影响，不暴露不必要组织关系。"
- 退休状态展示（深化4 阶段4）："UI 分离内容状态与消费者状态，明确不可检索/不可行动和恢复门槛"；避免用户看到 `archived` 误以为还能用。
- 删除结果展示（深化4 阶段4）：记录方法、范围、目标副本、验证和未覆盖的 `external_unknown`，"不能只显示成功"。
- 门槛未定时的用户可见性（深化1 阶段4）："频繁 hold 会不会阻碍进化？"——"低风险使用可逆降权/小灰度，补足证据；高风险宁可延迟也不自动越级"，即 `hold/needs_review/blocked` 需对用户可解释。

### 8.7 仍暂缓未定的内容

- **第3轮暂缓表**：自动发布、退休和灰度的具体阈值；反馈投毒检测的完整模型和规则；跨组织协同反馈的独立性判定；自动资产退休的完整合规保留策略；多维灰度的分桶算法和统计方案；反馈内容的反注入和恶意指令检测；高风险资产的自动恢复条件；反馈贡献度与激励机制（均注明"留待以后讨论"）。
- **深化1 暂缓**：各资产/变化的具体数值阈值、置信区间和最小样本；反馈投毒检测模型、异常分数和独立性算法；灰度分桶、实验设计、停止条件和统计显著性；自动退休的合规保留、替代资产和恢复 SLA；高风险恢复、跨组织反馈和生产消费者的审批矩阵；训练/自演化准入与反馈反注入的技术实现。
- **深化2 暂缓**：投毒检测模型、异常分数、阈值和误报/漏报 SLA；跨组织主体独立性、串谋和责任归因规则；反馈内容的反注入、秘密检测和训练准入实现；确认投毒后的主体封禁、资产处置和法律流程；大规模统计隔离、重算、预算和历史版本传播；反馈贡献度、激励和反刷量产品机制。
- **深化3 暂缓**：I0–I4 的具体判定算法、权重和阈值；组织/身份联合、证明 token 和隐私计算实现；串谋检测、跨组织责任归因和申诉流程；跨组织聚合、差分隐私和结果导出；高风险发布、退休、训练准入的独立证据矩阵。
- **深化4 暂缓**：各类资产、租户和行业的具体保留期限与删除义务；法律保全、申诉、审计和隐私删除冲突的责任矩阵；物理擦除、加密擦除、备份/灾备和第三方副本清理实现；派生 Embedding/Index/Cache/训练候选的重算与删除验证；自动退休的 SLA、通知、恢复和客户沟通。
- **深化5 暂缓**：分桶键、哈希/伪名、实验单位和多因素设计的最终算法；最小样本、显著性、置信区间、序贯检验和停止阈值；共享缓存/模型/工具干扰的测量与校正；跨租户/跨组织灰度、隐私聚合和小样本保护；高风险资产灰度审批、RunGate、回滚和生产观察 SLA。
- **总体状态（第3轮末"后续独立讨论点"）**：议题 8 当前列出的独立讨论点已完成；"反馈协议、自动化阈值、实验平台、训练准入、权限治理和跨空间迁移等暂缓事项留待以后讨论，不视为所有实现细节已经固化。"
- **文档未明确**：反馈采集的界面入口与交互形态、`hold/needs_review/blocked` 的用户通知渠道、灰度实验的运营看板设计。

---

## 计数汇总

| 文档 | 已确认结论条数（7.1/8.1 条目） | 行数（源） |
|---|---:|---:|
| 议题 7：企业记忆血缘 | 10（第1–3轮 + 深化1–7） | 1621 |
| 议题 8：使用反馈驱动的自进化 | 8（第1–3轮 + 深化1–5） | 1358 |
| 合计 | 18 | 2979 |
