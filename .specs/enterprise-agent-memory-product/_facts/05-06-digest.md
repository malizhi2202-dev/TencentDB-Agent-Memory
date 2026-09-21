# 议题 5 / 议题 6 事实摘要（供产品设计文档使用）

来源（只读蒸馏，未做推测补全）：

- `.specs/enterprise-agent-memory-platform/05-记忆自动知识化.md`（4967 行，议题 5）
- `.specs/enterprise-agent-memory-platform/06-代码场景和根因分析.md`（3270 行，议题 6）

引用格式：`（05 §第1轮-3）` 表示议题 5 第 1 轮第 3 小节；`（05 §深化10-阶段3）` 表示议题 5「子议题深化10第1轮」的「阶段3」。议题 6 部分沿用源文档写法，`（第 1 轮 §3）`、`（深化5 §阶段3）` 均指 `06-代码场景和根因分析.md` 的对应章节。文档未写明处标注「文档未明确」。

---

## 议题 5：记忆自动知识化

### 5.1 已确认结论清单

**第 1 轮确认：候选、审核、发布与撤回**（05 §第1轮）

1. 总纲：「**记忆自动知识化采用统一的“候选—审核—发布—复核—撤回”流程，将 Wiki、Skill、RCA、Template 和 Code Context 作为不同知识对象治理。自动化可以发现候选、推荐类型、生成草稿、补充来源和标记风险，但不能自行发布、扩大权限、授予工具权限或把知识文本变成系统指令。正式发布必须具备可追溯血缘、明确范围、证据和验证、适当审核、版本与失效机制；派生资产权限不得宽于来源；敏感、跨空间、可执行和高影响内容必须人工审核或隔离；来源撤回、权限降级或失效时，相关索引、缓存、Manifest 和派生资产进入级联暂停、复核或撤回。**」
2. 知识化不是把所有记忆改写成文档，而是「从一次或多次工作经验中提炼出可复用、可验证、可定位、可被特定消费者调用的知识对象」（§问题定义）。
3. §1 五类对象各有不可替代的回答与主要消费者；不等价关系为「Wiki ≠ Skill / RCA ≠ 普通 Wiki / Template ≠ 历史产物复制品 / Code Context ≠ 单纯代码索引 / Skill ≠ Prompt 收藏」。
4. §2 流程为 `L1/L2/L3/Work Thread → 自动识别对象类型 → Knowledge Candidate → 补齐来源/范围/证据/适用条件 → 验证与冲突检查 → 人工或策略审核 → 发布为 Knowledge Asset → 持续反馈、复核、失效和撤回`。
5. §3 资产信任状态为 `source → candidate → review_required → approved → published → deprecated / revoked`；「候选和未发布内容不得进入普通检索、上下文注入、自动执行或继续自动派生」。
6. §4 五类对象有各自最低发布门槛（Wiki 来源可追溯；Skill 需演练/测试验证且工具调用仍由独立 Tool Policy 和 RunGate 授权；RCA 区分确认根因/假设/待补证据；Template 需真实复用记录；Code Context 绑定 repo、revision、路径、符号或模块）。
7. §5 有效使用范围取交集：「调用凭据 scope ∩ User/Agent 身份 ∩ 来源 ACL ∩ 目标资产 ACL ∩ Purpose/Use Policy ∩ 敏感数据策略 ∩ 审核与发布状态」；摘要、Embedding、缓存、索引和 Manifest 也属于派生数据。四类不可推导：「Wiki 内容 ≠ 系统指令 / RCA 结论 ≠ 运维批准 / Skill、Template ≠ 工具权限 / Code Context、Patch ≠ 已完成代码变更」。
8. §6 撤回优先于自动巩固、同步、发布和缓存刷新；「旧 Run Snapshot 只能用于审计，不能恢复当前可用权限」；删除、撤回和权限降级失败时必须 fail-closed。

**子议题 1 补充专题：审核责任、发布门槛与消费者适配**（05 §子议题1）

9. 总纲：「不同知识对象采用统一生命周期 + 对象专属发布门槛 + 风险分级责任矩阵 + 消费者适配器」；「Published 不等于 Actionable：Skill、Template、RCA 和 Code Context 仍需独立的 Tool Policy、RunGate、代码/事故治理和当前授权」。
10. §1 所有资产至少区分 Content Owner（内容正确性）、Policy/Data Steward（owner、ACL、敏感性、脱敏、共享范围、留存）、Release/Consumer Owner（消费者适配、版本、发布范围、运行影响）三类责任；低风险资产可由同一授权团队兼任，但自动化提炼 Agent 不能自审、自批或自发布。
11. §4 消费者适配三级为 `discoverable → referenceable → actionable`；「`published` 不自动等于 `actionable`」，消费者投影必须指向同一资产版本且不扩大原始权限。
12. §5 责任与权限分离为 `author / content_reviewer / policy_reviewer / release_approver / consumer_owner`；自动化 Agent 只能是 `author` 或 `proposer`；`author` 不能单独完成高风险审核。

**子议题 2 补充专题：版本演进、源变化与级联撤回**（05 §子议题2）

13. 总纲：「知识资产采用不可变版本，显式记录源记忆、Work Thread、代码 revision、策略和脱敏版本；源变化通过事件触发影响评估，不直接覆盖历史资产」；低影响可异步传播、中影响暂停并重新审核、高影响必须同步阻断新使用并启动级联撤回/复核。
14. §1 区分内容变化、源内容变化、代码 revision 变化、权限/归属变化、敏感性/脱敏规则变化和消费者投影变化；「不是每次变化都必须重写资产正文，但每次变化都必须触发影响评估」。
15. §3 影响分级为低/中/高三级：低影响（标题、格式或非实质说明）可异步生成新版本；中影响（适用范围、步骤、代码路径或验证条件）暂停受影响候选并重新审核；高影响（权限撤销、敏感暴露、来源撤回、关键前提失效、生产操作失效）同步停止新使用、阻断受影响 Manifest/执行链路并启动级联撤回/复核。
16. §4—§5 传播图覆盖 Knowledge Asset Version、Search Index/Embedding、Cache、Context Manifest、Run Context Snapshot、五类对象和 Consumer-specific projection；高风险路径为 `source revoked → derived assets suspended/revoked → index/cache/Manifest invalidated → new Run blocked or re-resolved → old Snapshot retained only for audit`。
17. §2 明确指出「消费者不兼容不能直接被误判为源知识错误」；§6 旧版本、旧 Manifest 和 Run Snapshot 不被静默改写，「历史保留不是权限绕过通道」。

**第 2 轮确认：知识资产持续复核与消费者状态**（05 §第2轮）

18. 总纲：采用「事件触发为主、风险分级周期复核为辅、使用反馈调整优先级」的持续治理模式；「长期未使用不等于错误，高使用率也不等于正确；反馈先进入复核事件，不能直接改变知识或扩大权限」。
19. §2 复核触发分硬触发（立即暂停或重新评估）、软触发（进入复核队列但不一定立即阻断）、观察信号（仅调整优先级、不单独改变状态）三类。
20. §4 复核结果至少支持 `keep / narrow / revise / suspend / deprecate / revoke / archive`；§5 内容状态与消费者状态分离为 `reference_status / retrieval_status / action_status`，「权限、敏感性和撤回变化优先于普通质量反馈」。
21. §6 反馈链路为 `feedback → classify → impact assessment → review candidate → human or policy decision → new version / narrowed / suspended / revoked`；「一次负反馈不能自动删除稳定知识，一次成功也不能自动将内容提升为团队规范」。

**子议题 3 补充专题：血缘、权限治理与跨空间脱敏接口**（05 §子议题3）

22. 总纲：采用「受信身份与用途上下文 → 来源 ACL/敏感性检查 → 显式脱敏派生 → 带完整血缘的候选资产 → 目标范围与发布审核 → 当前授权消费」的接口模型；目标范围不得扩大；失败时默认拒绝或隔离。
23. §3 权限交集与目标范围：「`target_scope ⊆ effective_scope`」；目标空间管理员不能绕过来源 ACL，目标空间权限变宽不会自动放宽来源权限，User/Agent 私有记忆不得自动派生为 Team、Project 或公共资产，「可读取不等于可派生、可发布或可执行」。
24. §4 脱敏是独立可追踪的派生步骤（分类 → 最小化 → 脱敏 → 脱敏结果检查 → 目标范围检查 → 生成候选 → 审核与发布）；凭证、Token、私钥、密码、连接串默认拒绝进入知识资产；「脱敏完成不等于获得目标空间授权」。
25. §6 「逻辑撤回：立即不可检索、不可注入、不可执行」与「物理删除：按合规和生命周期策略异步清理」必须区分；禁止 `catch → warn → 返回成功`，不得回退到 Team 默认空间、最近 Project、全局检索或旧权限。
26. §7—§8 「失效要快，恢复可迟；阻断看权威状态，传播走事件」；不追求全局 exactly-once，采用「至少一次投递 + 消费端幂等 + 资产版本收敛」，并通过 Outbox 或等价机制避免状态已更新但事件未发布。

**子议题深化 1—15（原则性处理，均「已自动审核通过，阶段性完成」）**

27. 深化1 语义分层为 `Knowledge Identity → Common Envelope → Object Payload → Relations → Content Plane → Control Plane → Consumer Projection`；共同 envelope 语义槽位为 `identity / owner / scope / purpose / provenance / version / validity / quality / release / consumer / lineage / revocation`。
28. 深化1 综合挑战结论：「最容易发生的失败不是少一个字段，而是把“结构有效”“内容正确”“已发布”“当前可访问”“可以执行”当成同一件事」，并确立五种互不自动推导的独立判断（结构可解析、来源可追溯、内容已审核、当前可消费、动作获独立授权）。
29. 深化2 采用「候选识别 → 证据评估 → 治理发布 → 消费者行动」四层模型；质量结果保留多维状态与证据（dimension observations、confidence/uncertainty、conflicts、freshness/validity signals、risk flags、recommended disposition），不固化总分。
30. 深化3 统一审核工作流为 `Candidate intake → Pre-check → Object-specific review → Cross-domain/high-risk additional review → Governance decision → Publish/Suspend/Revoke → Consumer adaptation`；「Approved 不是 Published」；预检失败的默认结果是隔离、补证、退回或拒绝，不是「带警告继续」。
31. 深化4 确立四类操作边界（受控引用、派生候选、跨空间发布、owner transfer）与「发布、引用、检索/投影、行动」四分离；跨空间发布**不继承**：`source owner ≠ target owner`、`source ACL ≠ target ACL`、`source approval ≠ target approval`、`source ToolPolicy ≠ target ToolPolicy`、`source RunGate ≠ target RunGate`、`source credentials ≠ target credentials`、`source consumer scope ≠ target consumer scope`。
32. 深化4 脱敏反例约束：「`redacted = authorized` / `redacted = public` / `redacted = safe for every Purpose` / `redacted = semantically equivalent` / `redacted = no longer subject to revocation`」均为禁止的隐式推导。
33. 深化5 建立知识资产与执行的语义接口骨架：`Knowledge Asset Resolution / Consumer Read Decision / Derivation Decision / Action Authorization / RunGate Admission-Continue / Tool Policy Decision / Tool Adapter Invocation / Result Commit Decision`；工具返回 success、HTTP 成功、退出码为零或模型生成完整结果都不能自动触发写入长期记忆、发布 Skill、提交代码或标记 RCA 已验证。
34. 深化6 建立「权威面—派生面—复核面」不变量：权威资产及其 revision、当前 ACL、策略、来源状态、敏感性和撤回状态是唯一当前真相来源；血缘图、Embedding、所有索引、缓存、Manifest、融合与消费者适配器都只是派生投影，不能扩大来源权限。
35. 深化7 四类指标边界为质量指标 / 使用与结果指标 / 治理指标 / 运营指标；质量维度为来源、证据、正确性、适用性、新鲜度、完整性、安全、可执行性、血缘、不确定性/冲突；过期采用多信号模型（时间、来源 revision、环境与依赖、策略与权限、冲突与漂移、反馈、运营/传播信号），「TTL 可以作为运营提醒或缓存控制的一个输入，但不能替代来源状态、revision、权限、Purpose、环境、冲突、反馈和撤回判断」。
36. 深化7 复核结果在 keep/narrow/revise/suspend/revoke 之外增加 `recompute`（重算指标、不篡改历史结果）与 `rollback`（版本回退或实现回退，不能恢复已 `revoked` 的来源、资产或权利）。
37. 深化8 确认 Skill 四对象分离（Skill Asset、Action Proposal、Policy Decision、RunGate）与最小接口包络（SkillRef / ActionProposal / PolicyDecision / RunGate 字段组）；反例约束含 `published_skill ≠ executable_permission`、`skill_text ≠ policy_grant`、`policy_allow ≠ execution_started`、`approval ≠ current_plan_valid`、`successful_run ≠ safe_or_compliant_run`。
38. 深化9 复核采用「对象专属证据 + 风险分层周期 + 硬事件立即触发 + 软信号排队复核 + 消费者状态分离 + 到期保守降级 + 撤回传播和证据闭环」；复核 SLA 采用 TTA/TTR/TTV/TTO/TTP 分层目标；反例约束含 `review_due ≠ invalid`、`unused ≠ incorrect`、`high_usage ≠ verified`、`revoked ≠ external_copy_deleted`、`retrieval_allowed ≠ action_allowed`。
39. 深化10 源变化影响评估采用「权威版本 + 类型化依赖边 + 硬触发器 + 分层闭包 + 消费者状态分离 + 版本化至少一次传播 + 逐节点对账」；反例约束含 `similar_content ≠ dependency`、`edge_not_found ≠ no_impact`、`queue_drained ≠ closure_verified`、`current_version_seen ≠ action_authorized`；「不能从 `impact_pending` 直接进入 `current`」。
40. 深化11 影响等级采用「多轴属性 + 硬触发器 + 组合取最高 + 未知不降级」；传播 SLA 分 `Tblock / Tscope / Tprop / Tverify / Trestore` 五类目标；反例约束含 `small_asset_count ≠ low_impact`、`Tblock_met ≠ closure_complete`、`unknown_scope ≠ low_impact`、`async ≠ ungoverned`。
41. 深化12 索引/Embedding/Cache/Manifest 采用「权威撤回版本 + 入口同步阻断 + 派生版本过滤/失效 + 幂等传播 + 逐消费者确认 + 当前授权重算」；反例约束含 `index_delete_requested ≠ query_blocked`、`cache_expired ≠ permission_revoked`、`manifest_rebuilt ≠ current_authorization_valid`、`queue_empty ≠ external_copy_cleared`。
42. 深化13 多源资产采用「按依赖贡献拆分影响 + 子主张/子范围独立状态 + 冲突显式隔离 + 新版本修正 + 回滚/补偿重新授权」；恢复动作分 `logical_rollback / forward_correction / compensation`；反例约束含 `source_missing ≠ entire_asset_deleted`、`majority_vote ≠ truth_or_authorization`、`compensation_started ≠ side_effect_reversed`、`unknown_source ≠ safe_to_publish`。
43. 深化14 历史审计与合规删除采用「当前授权访问 + 证据最小化 + 保全优先级显式化 + 逻辑撤回与物理删除分离 + 逐副本验证 + unknown 可见」；`legal_hold` 优先阻止相关删除但不自动扩大查看范围；反例约束含 `retain_audit ≠ retain_all_source_data`、`legal_hold ≠ read_permission`、`delete_primary ≠ delete_all_copies`、`unknown_copy ≠ cleared_copy`。
44. 深化15 Code Context、Skill、RCA、Template 采用「显式依赖指纹 + 变化事件触发 + 资产专属验证 + 风险分层环境验证 + 当前权限/策略重检 + 新版本发布门禁」；验证等级为 `V0 dependency_resolution / V1 structural_check / V2 isolated_validation / V3 scenario_validation / V4 production_gate`；反例约束含 `semver_compatible ≠ runtime_compatible`、`isolated_test_passed ≠ production_authorized`、`old_revision ≠ current_code_context`、`same_harness_name ≠ same_capability`。

### 5.2 核心对象与关系

- **五类知识对象边界（05 §第1轮-1）**

| 对象 | 回答的问题 | 主要消费者 |
|---|---|---|
| Wiki | 这是什么？为什么这样？ | 成员、问答 Agent、检索 Agent |
| Skill | 具体应该怎么做？如何处理分支？ | 执行 Agent、自动化 Agent、运维 Agent |
| RCA | 为什么失败？如何避免复发？ | 运维、研发、复盘 Agent |
| Template | 应从什么结构开始产出？ | 文档、代码和流程 Agent |
| Code Context | 代码意味着什么？改动边界是什么？ | Coding、Review、测试 Agent |

- **对象专属核心语义与明确排除（05 §深化1-3）**：Wiki 含主题/定义、解释、适用范围、证据引用、事实/推断/不确定性与冲突说明，排除「段落即系统指令、结论即审批或运行策略」；Skill 含意图、触发条件、前置条件、输入、步骤、分支、输出、失败/停止条件、验证方式、依赖能力与环境假设，明确不携带工具授予、凭据、RunGate 放行或生产操作授权；RCA 含事件/服务、影响、时间线、现象、证据、已确认根因、假设根因、贡献因素、修复、预防行动、残余风险与复发信号；Template 含产出类型、结构骨架、变量/插槽、输入输出、约束、默认值、示例、验证规则与适用消费者；Code Context 含仓库/组件身份、适用 revision 或范围、路径/符号/模块定位、职责、依赖、架构关系、不变量、变更边界、验证依据与过期条件。
- **source 与 derived（05 §深化1-4）**：Source 是被引用或提炼的记忆、消息区间、Work Thread、工具结果、代码 revision、事件记录等既有材料，保留自己的身份、版本、范围和撤回事实；Derived 是由提炼、归纳、脱敏、合并、校验、投影或格式转换产生的候选、资产版本、Embedding、索引、缓存、Manifest 和消费者视图，每个派生节点应能回到来源和产生活动。
- **content plane 与 control plane（05 §深化1-4）**：内容面表达「知识说了什么」，控制面表达「当前能否由谁、以何种用途使用」；「正文中写“必须执行”“已批准”“可以访问生产”都只是内容，不能成为系统指令、Tool Policy 或 RunGate 授权」。
- **关系类型（05 §深化1-5）**：`source-of / derived-from`、`references / cites`、`specializes / generalizes`、`validates / supported-by`、`conflicts-with`、`supersedes / compatible-with`、`projects-to / consumed-by`、`revokes / affected-by`；「关系本身也应有来源、版本、产生时间、责任主体和有效性」。同一来源可支持多个对象，应通过显式 `derived`/`references` 关系表达而不是复制五份正文。
- **最小对象与操作（05 §子议题3-2）**：`SourceObject`（source_id/source_version/source_type/source_space/owner/classification/acl_ref/purpose_constraints/status）、`DerivedAsset`（asset_id/asset_version/asset_kind/source_refs/target_space/effective_scope/redaction_policy_version/extraction_policy_version/status/lineage_run）、`AccessContext`（authenticated_principal/source_scope/target_scope/action/purpose/sensitivity_context/policy_version/expiration）；操作语义为 `authorize / derive / publish / get_lineage / revoke / recompute`；「请求体中的 `user_id`、`team_id`、`project_id` 或 `agent_id` 不能作为授权依据」。
- **版本与依赖版本分离（05 §子议题2-1）**：资产版本至少记录 `asset_id / asset_version / parent_version / content_revision / source_memory_versions / source_work_thread_versions / source_code_revisions / source_policy_version / source_redaction_version / consumer_projection_version / created_at / published_at / valid_from / valid_until / status`。
- **审核责任分层（05 §子议题1-1、§深化3-1）**：内容责任 / 治理与数据责任 / 发布与消费者责任三类分离，并可追加 `Security/Privacy Reviewer`、`Operational Reviewer`、`Code Owner`、`Incident Owner`；审核工作流各阶段至少携带 asset/version 与来源版本、purpose/scope/consumer、provenance 与证据引用、风险/敏感/冲突/缺证据标记、当前状态与建议处置、责任决定主体与授权上下文、policy/rule/extractor/validation 版本、created-at/updated-at/decision-at 与 correlation/idempotency 引用。
- **消费者适配（05 §子议题1-4、§深化4-7）**：消费者投影按 discoverable/referenceable/actionable 三级与 `publication / reference / retrieval-projection / action` 四个独立问题分别判断；「发布只表示在规定范围内完成内容治理；每个消费者仍需适配、当前授权和必要的 Tool Policy/RunGate」。
- **ChangeSet**：两份文档均未出现 `ChangeSet` 作为知识对象或变更对象；议题 6 仅在 revision 定义处提到「变更集」作为 revision 的可能来源（06 §发现深化1-2）。故在议题 5 的对象模型中，「文档未明确」。

### 5.3 状态与枚举

- **资产信任状态（05 §第1轮-3）**：`source / candidate / review_required / approved / published / deprecated / revoked`；`candidate` 仅供授权审核者查看，`revoked` 通常由撤回、权限或来源问题触发。
- **发布—复核—撤回状态（05 §子议题2-5）**：`published → review_required → suspended → republished → deprecated → revoked`。
- **当前适用状态（05 §第2轮-1）**：`published → active → review_due → suspended → republished → deprecated → revoked → archive`。
- **生命周期合并写法（05 §深化1-5）**：`candidate → review_required → approved → published/active`，旁路 `suspended → republished`、`deprecated / revoked / archive`。
- **复核结果（05 §第2轮-4；§深化7-6 扩充）**：`keep / narrow / revise / suspend / deprecate / revoke / archive`，扩充 `recompute / rollback`。
- **验证状态（05 §第2轮-3）**：「来源核验、场景验证、多场景验证、持续有效、需要重新验证」，「不能用使用次数替代证据」。
- **影响分级（05 §子议题2-3；§深化11-阶段3）**：低影响 / 中影响 / 高影响；深化11 增加「未知不降级」与组合取最高，未知进入 `overdue / escalated / blocked / unknown`。
- **级联撤回状态（05 §子议题2-5）**：`review_required`（需重新审核但不一定错误）、`suspended`（暂时停止新使用等待评估）、`deprecated`（不再推荐新使用但可保留受控历史引用）、`revoked`（明确停止使用，不得进入普通检索、投影或执行）。
- **消费者状态（05 §第2轮-5；§子议题1-4）**：`reference_status / retrieval_status / action_status`；投影可见性对照表覆盖 Candidate/Review Required、Approved、Published Wiki/RCA/Template/Code Context/Skill、Revoked/Deprecated。
- **复核硬/软/观察触发（05 §第2轮-2）**：硬触发 7 项（来源撤回失效或权限收窄、关键源记忆冲突、代码 revision/API/依赖/运行环境重大变化、Skill 工具权限或 RunGate 或安全策略变化、敏感级别升高或发现未脱敏数据、生产/合规/安全/高影响规则变化、资产导致错误执行或敏感泄露）；软触发 7 项；观察信号 4 项。
- **复核与到期状态机（05 §深化9-阶段3）**：`active → review_due | review_triggered → evidence_pending → verified | narrowed | revised → published_again → suspended | deprecated | revoked | archived`；超时进入 `review_overdue / escalated / blocked`。
- **复核 SLA 目标（05 §深化9-阶段3）**：`TTA / TTR / TTV / TTO / TTP` 分层目标，数字由风险、证据新鲜度、消费者影响、合同和组织责任校准。
- **传播 SLA 目标与状态（05 §深化11-阶段3）**：`Tblock / Tscope / Tprop / Tverify / Trestore`；状态 `impact_classified → *_due → acknowledged / in_progress / partially_propagated → verified | overdue | escalated | blocked | unknown`。
- **影响评估状态（05 §深化10-阶段3）**：`source_changed → impact_pending → impact_scoped → low_async | medium_review | high_blocked | unknown_isolated → consumer_propagation → verified_current | narrowed | revised | revoked → restore_review`。
- **派生失效事件状态（05 §深化12-阶段3）**：`DerivedInvalidation` 事件字段含 event_id/root_revoke_id/authority_version/consumer_type/consumer_id/source_version/required_action/tenant_scope/policy_version/emitted_at/applied_at/acknowledgement/digest，状态为 `pending | applied | stale | failed | unknown | external_unknown`；`applied` 仅表示该消费者完成声明动作，不等于整个影响闭包完成。
- **多源部分失效状态（05 §深化13-阶段3）**：`multi_source_active → source_changed → contribution_recomputed → partially_valid | conflict_pending | unknown_isolated | fully_invalid → narrowed_candidate | revised_candidate | suspended → independent_review → published_new_version | remain_blocked | revoked`；依赖贡献类型为 `required / supporting / optional / conflicting`。
- **恢复动作类型（05 §深化13-阶段3）**：`logical_rollback | forward_correction | compensation`。
- **合规删除例外状态机（05 §深化14-阶段3）**：`retention_requested → scope_classified → hold_check → retain_minimal | restrict_access | redact | delete_eligible → approved → applied_per_copy → verified | partial | failed | unknown → expiry_review → released_or_deleted | renewed_hold | escalated`。
- **验证等级（05 §深化15-阶段3）**：`V0 dependency_resolution / V1 structural_check / V2 isolated_validation / V3 scenario_validation / V4 production_gate`；`V0/V1` 失败时不能继续，`V2/V3` 只证明验证环境。
- **Tool Policy / RunGate / 动作决策取值（05 §深化5-1、§深化8）**：Tool Policy 输出 `allow/deny/approval-needed/sandbox-only`；Policy Decision 返回 `allow/deny/isolate/needs_review`；RunGate 返回 `admit/hold/deny/接管要求`；Result Commit 返回 `commit/deny/hold/rollback/manual-takeover`。
- **危险推导枚举（05 §深化2-4）**：`model_score = quality`、`adoption_rate = correctness`、`published = actionable`、`citation_count = evidence_strength`、`successful_once = generally_valid`、`no_feedback = safe` 均被明确禁止。

### 5.4 角色与权限边界

- **三类治理责任（05 §子议题1-1）**：Content Owner 负责内容正确性、完整性和适用范围；Policy / Data Steward 负责 owner、ACL、敏感性、脱敏、共享范围和留存；Release / Consumer Owner 负责消费者适配、版本、发布范围和运行影响。
- **五类对象最低内容审核责任（05 §子议题1-2）**：Wiki＝领域 Owner 或知识维护者，跨 Team/敏感需 Policy/Data Steward；Skill＝执行领域 Owner，另需 Tool/Run Owner，生产、安全或外部副作用需 Security/Operations；RCA＝Incident Owner + Service/Project Owner，高影响事件需治理或安全审核；Template＝使用领域 Owner，涉及代码、生产或外部输出需对应 Consumer Owner；Code Context＝Repo/Code Owner，跨服务或安全约束需架构/安全审核。「内容产生者可以提交候选，但不因产生内容自动成为唯一审核人」。
- **审核操作角色（05 §子议题1-5）**：`author / content_reviewer / policy_reviewer / release_approver / consumer_owner`；自动化 Agent 只能是 `author` 或 `proposer`，不能自审、自批、自发布。
- **职责边界三分（05 §子议题3-1）**：知识提炼（发现候选、生成草稿和结构）/ 血缘与权限治理（记录来源、判断权限、追踪派生关系）/ 跨空间脱敏与发布（生成受控派生资产、检查目标范围并发布）；「提炼 Agent 不得同时完成内容生成、权限判断、脱敏决定、自审、自批和自发布」。
- **审核者最小数据原则（05 §深化3-5）**：审核者只能按被授权 Purpose 获取完成当前决定所需的数据；「可判断“结构是否完整”不等于可读取全部原文」；目标空间管理员不能仅凭目标权限扩大来源可见范围；申诉、重开和审计访问同样受当前 ACL、Purpose、撤回和删除策略约束。
- **各领域状态维护职责（05 §子议题3-7）**：复核维护「是否通过、是否过期」；血缘维护「来源、依赖完整性和冲突」；按需融合维护「是否具备融合资格、融合结果」；权限治理维护「谁能看、能否派生和使用」；统一状态层只「计算最终可用性」，不直接修改其他领域事实；「不允许提炼 Agent 直接写入“可用”」。
- **跨空间责任边界（05 §深化4-4、§深化4-5）**：来源侧确认来源版本有效、ACL 允许动作、owner/治理责任未撤回、目标范围不超交集；目标侧确认接受数据类别/Purpose/消费者/保留与撤回义务并具备最小数据控制能力；`owner transfer` 是责任与治理归属的受控变更，需区分内容责任、治理/数据责任、发布责任、消费者责任，且不自动转移来源读取权、跨空间发布权、工具权限、凭据或 RunGate 放行。
- **执行侧权限分离（05 §深化5-10）**：人工接管「不是“绕过策略”的后门」，仍需受信主体、明确 Purpose、范围、审批/责任、当前版本、审计和后续结果处理；人工也不能通过知识正文、旧审批或默认管理员身份直接扩大工具权限。

### 5.5 关键规则与不变量

- **权限取交集**：有效权限＝`principal_permission ∩ source_acl ∩ source_space_policy ∩ target_space_policy ∩ purpose_policy ∩ sensitivity_policy ∩ publication_state`，且必须满足 `target_scope ⊆ effective_scope`（05 §子议题3-3）。
- **派生不扩权**：派生资产权限不得宽于来源；目标空间权限变宽不会自动放宽来源权限；目标空间管理员不能绕过来源 ACL；「可读取不等于可派生、可发布或可执行」（05 §第1轮-5、§子议题3-3）。
- **发布 ≠ 可行动**：`published` 不自动等于 `actionable`；发布只改变指定资产版本在指定 scope/Purpose 下的治理状态（05 §子议题1-4、§深化3-7）。
- **知识文本 ≠ 权限**：Wiki 内容、RCA 结论、Skill/Template 内容、Code Context/Patch 均不构成系统指令、运维批准、工具权限或已完成变更（05 §第1轮-5）；跨空间发布即使正文含「已批准」「可以执行」也不改变目标侧控制事实（05 §深化4-4）。
- **不可变版本优先**：已发布版本不原地覆盖；新内容、profile、关键来源或适用范围变化产生新版本或进入复核；旧审核决定、旧事件不得覆盖新状态（05 §深化1-6、§深化3-8）。
- **幂等与收敛**：状态转换、发布、撤回、传播和重试应带可关联的请求/运行/事件标识；采用「至少一次投递 + 消费端幂等 + 资产版本收敛」；迟到或重复事件只能被记录和安全忽略（05 §子议题3-8、§深化3-8）。
- **fail-closed**：身份无法验证、来源 ACL 缺失、目标范围无法证明不扩大、敏感识别/脱敏失败、血缘缺失、审核状态不明、索引/缓存/Manifest 无法失效、撤回传播失败或策略无法解析时，默认拒绝或隔离；「禁止 `catch → warn → 返回成功`」，不得回退到默认 Team/Project、全局检索、旧权限或旧版本（05 §子议题3-6、§深化3-7）。
- **撤回传播闭包**：撤回必须覆盖知识正文、摘要、Embedding、Search Index/Vector Index、Cache/推荐、Context Manifest/消费者投影、待执行链和下游派生资产；「逻辑撤回优先于物理清理」；「无法找到完整血缘、无法确定影响……不得宣称全链路撤回完成」（05 §深化4-8、§子议题3-6）。
- **权威面—派生面不变量**：血缘图、Embedding、索引、缓存、Manifest、融合与消费者投影均为派生面；检索须「先按当前权威权限、Purpose、Scope、敏感和撤回状态过滤，再进行召回，并在返回或使用前最终复核」（05 §深化6-1、§深化6-3、§深化6-状态）。
- **召回与授权解耦**：Embedding 不可逆也不脱离治理；索引不授予读取、派生、执行、下载或跨空间共享权限；缓存不因未过期而继续可用（05 §深化6-2、§深化6-4）。
- **审核不可省略**：预检通过只表示允许进入审核，不代表 `Approved`；审核超时保持 Review 或暂停、不自动批准；拒绝、暂停、撤回、关闭候选和归档语义不同（05 §深化3-2、§深化3-6）。
- **安全不可被抵消**：「不能让安全、权限、敏感、血缘和撤回成为可被其他维度“加分抵消”的普通项」（05 §深化2-阶段4）；任一关键维度缺失、冲突或未知都可使治理结果保持 Review、限缩 scope、仅允许受控参考或暂停（05 §深化2-4）。
- **质量 ≠ 可执行**：质量回答「内容在已知范围内是否可靠」，Actionable 还需当前主体、用途、环境、工具权限、变更边界、停止条件和 RunGate 的独立决定（05 §深化2-阶段4）。
- **复核不因低频降级**：低频高价值资产不因使用少而降级；排序结果只决定复核资源先后，不直接改变资产状态（05 §深化7-5）。
- **到期不等于错误**：周期到期不自动证明失效，但到期资产进入 `review_due`，不得继续获得新的高风险执行资格；恢复必须重新检查当前授权、用途、敏感性、血缘、版本、消费者环境和 RunGate，不自动重放旧使用（05 §深化9-阶段3）。
- **指标不授予权限**：任何指标都不能自动发布、降级、延长有效期、撤回或晋级 Actionable；也不能替代当前权限、Purpose、敏感、撤回和 RunGate（05 §深化7-暂缓、§深化7-状态）。
- **合规与审计边界**：`legal_hold` 只限制删除、不授予读取权；历史审计不能恢复当前权限、不能成为读取已删除内容的通道；保留审计 ≠ 保留全部源数据（05 §深化14-阶段3）。
- **环境兼容不由版本标签证明**：`semver_compatible ≠ runtime_compatible`、`isolated_test_passed ≠ production_authorized`、`no_change_detected ≠ validation_passed`（05 §深化15-阶段3）。

### 5.6 界面/交互线索

- 消费者界面必须同时展示来源/目标空间、当前用途、允许动作、版本、状态、限制和不确定性；文案应明确「脱敏降低部分披露风险但不扩大授权」「目标接受不等于来源授权」「Published 不等于 Actionable」，「不能用一个绿色安全标记替代这些差异」（05 §深化4-阶段4）。
- 界面和消费者投影必须显示「可参考/可生成建议/待审批/当前 Run 不满足/某工具调用被拒绝」等实际状态，并明确工具、凭据、目标、范围和副作用限制；「不要用一个“可信”“已发布”或“运行中”标签覆盖七个独立判断」（05 §深化5-阶段4）。
- 状态应按消费者任务展示「当前能做什么、不能做什么、依据和不确定性是什么」，而不是只露出内部名词；「已发布仅表示在范围内可见/可参考」「可行动仍需独立授权」（05 §深化2-阶段4）。
- 对象类型、适用范围、不确定性、版本和「仅参考/可生成建议/仍需独立授权」必须在消费者投影中可见；「统一 envelope 不能隐藏对象语义」（05 §深化1-阶段4）。
- 不要求把内部全部元数据暴露给用户，但系统必须保留并在需要时给出可理解的来源、版本、限制、过期/撤回和不确定性说明；「简洁的界面不能通过隐藏控制事实来换取“答案看起来稳定”」，高影响消费者还需要可审计的详细投影（05 §深化6-阶段4）。
- 多状态可用 UI 表达：UI 可展示「可用子范围/缺失证据/下一门槛」，底层保留逐主张审计（05 §深化13-阶段4）。
- 审核侧线索：审核包不应复制不必要的原文，可用受控引用、摘要、脱敏证据和按 Purpose 生成的最小视图完成决定（05 §深化3-1）；复核队列需要可解释的排序维度（风险、影响、漂移、冲突、反馈、低频高价值、即将过期、治理/传播缺口、公平/覆盖风险）（05 §深化7-5）。
- 明确暂缓的界面产物：审核表单、字段、证据模板与签名格式（05 §深化3-暂缓）；指标/指标的 dashboard 信息架构（05 §深化7-暂缓）；`reference/retrieval/action` 的消费者协议（05 §第2轮-暂缓、§深化9-暂缓）。具体界面原型、页面结构、组件、线框图、控件与交互流程：**文档未明确**。

### 5.7 仍暂缓未定的内容

- **对象与存储（05 §深化1-暂缓）**：五类对象的最终字段名、类型、必填性、嵌套和数据库表/集合设计；最终 JSON Schema、OpenAPI、事件和存储协议；具体数据库、对象存储、图存储、搜索/Embedding、缓存和 Registry 品牌选型。
- **识别与质量（05 §深化2-暂缓）**：五类对象的最终分类模型、规则、特征、提示词和模型供应商；质量维度的最终公式、权重、聚合方式、数值阈值和最小证据量；各对象固定发布门槛、自动批准范围和例外规则；训练/评估数据集、标注指南、评测样本量和统计置信方法。
- **审核工作流（05 §深化3-暂缓）**：最终企业角色矩阵、职责人数、替代/代理关系和组织授权；审批引擎、队列编排、状态机实现和升级算法；各审核阶段的 API、事件格式、Schema、表/集合和存储实现；每类对象的最终审核表单、固定字段、证据模板和签名格式；自动预检/补证/发布/批准的最终范围与阈值；审核超时、重试、升级、撤回传播和物理清理的 SLA；申诉、重开和历史审计的最终权限、保留和合规删除规则。
- **跨空间与脱敏（05 §深化4-暂缓）**：最终来源/目标审批矩阵、角色人数、代理和例外关系；授权交集的最终策略语言、关系模型、PDP/PEP 接口和决策缓存；脱敏、匿名化、伪名化、泛化、删除、随机化或差分隐私的具体算法；敏感字段目录、字段 Schema、标签词汇和数据分类分级；残余/组合重识别的数值阈值、攻击模型与语义保真指标；四类操作的最终 API、事件格式、幂等键、状态机；owner transfer 的最终法律/组织责任、代理、争议、继任和回滚规则。
- **血缘、索引与一致性（05 §子议题3-暂缓、§深化6-暂缓、§深化10-暂缓、§深化12-暂缓）**：完整血缘图 Schema、事件模型和一致性实现（属议题 7）；Embedding 具体模型/维度/切分/重嵌入规则；倒排/向量/代码/关系索引引擎与字段映射；缓存键、分层、TTL、租约与容量策略；Manifest 与投影的最终格式与发布协议；传播事件 API、Topic 拓扑、CloudEvents 扩展字段；outbox/relay 事务边界与跨库一致性；版本比较、generation 分配、乱序冲突合并与缺口修复算法；完整依赖边目录与阈值；物理删除、备份清理、审计保留和外部 Provider 清理。
- **执行接口（05 §深化5-暂缓、§深化8-暂缓）**：知识资产/Consumer Read/Derive/Action Authorization/RunGate/Tool Policy/Invocation/Result Commit 的最终 API、Schema、错误码、状态枚举与幂等键；Tool Policy 最终策略语言、规则优先级、冲突合并、PDP/PEP 拓扑；RunGate 最终状态机、审批编排、角色矩阵与例外流程；完整工具目录、凭据类型、参数白名单与副作用清单；沙箱、dry-run、资源隔离、凭据注入与秘密处理实现；Result Commit 提交模型、事务边界与回滚/补偿算法；R0–R3 数值阈值、预授权目录和审批替代。
- **复核与指标（05 §第2轮-暂缓、§深化7-暂缓、§深化9-暂缓）**：各对象具体复核周期、阈值和 SLA；复核队列完整优先级、责任人和升级流程；verification 证据的采集、标注和自动化检查实现；四类指标的最终公式、权重、采样框、样本量、置信方法与偏差修正算法；指标 Schema、事件 API、指标仓库与 dashboard 信息架构；低频高价值资产的保留与主动复核算法。
- **源变化与多源部分失效（05 §子议题2-暂缓、§深化11-暂缓、§深化13-暂缓）**：低/中/高影响的精确规则、具体数字 SLA 和传播窗口；影响分数、blast radius 和置信度算法；多源依赖贡献权重、子主张拆分和冲突裁决算法；数据库/消息/部署/外部 API 的补偿和回滚协议；跨租户、法律保全、删除和审计冲突处理。
- **合规、审计与自动验证（05 §深化14-暂缓、§深化15-暂缓）**：各法域、合同和数据类别的最终删除/保留期限；审计正文最小化、字段脱敏和加密实现；删除证明、不可抵赖和长期证据验证格式；Code Context、Skill 等资产的完整依赖指纹和兼容算法；CI/CD、沙箱、回放和生产镜像验证实现；工具能力、权限、凭据租约和回滚能力探测；多版本兼容、迁移和消费者适配策略；自动验证的测试集、覆盖率和误报/漏报阈值。
- **继承性边界（05 §议题5-阶段性结论、§深化1-状态）**：权限、敏感、跨空间派生、撤回、删除和审计保留的完整规则继承议题 9/10 及议题 4；知识资产不能自动成为系统指令、Tool Policy 或 RunGate 授权。主议题 5 状态为「已确认（阶段性）」，深化 1—15 均「阶段性完成」，其产出性质为「语义边界、协议语义、工作流骨架与治理原则」，不是最终数据库 Schema、API、策略语言、SLA 或生产实现。

---
## 议题 6：代码场景和根因分析

> 文档状态：第 1、2、3、4 轮确认已完成，15 个「子议题深化N第1轮」均为「阶段性完成」并通过自动审核（深化1–深化15 §状态）。所述结论仍是阶段性方案，"暂缓事项留待以后讨论，不代表所有实现细节已经固化"（第 4 轮 / 议题 6 当前阶段结论）。

### 6.1 已确认结论清单

1. 代码场景采用"事件日志 + 当前场景快照 + 结构化证据 + 可选 RCA 摘要"的组合，第一版不追求完整图数据库（第 1 轮 · 本轮确认；第 1 轮 §2）。
2. 三类对象边界分离：Code Context 绑定 repo/revision 的代码事实，RCA 区分症状/证据/假设/已确认根因/促成因素/修复/验证，Work Thread 负责跨执行者的工作过程与恢复；三者通过代码锚点、证据和事件关联，但"不合并为一个 Memory"（第 1 轮 §1）。
3. 自动化可提取命令、日志、diff、测试、失败路径和候选根因，但不能把推断当确定结论；最终根因、关闭状态、高风险修复和长期知识发布需要人工或受控审核（第 1 轮 · 本轮确认；第 1 轮 §7）。高风险操作不能由 Agent 代表用户批准，自动提炼器也不得重新执行工具来证明自己的结论（第 1 轮 §7）。
4. 事实与推断必须分开：工具输出是 `observed fact`，"可能是缓存问题"是 `hypothesis`，经复现或独立验证后才能形成确认依据（第 1 轮 §3）。
5. `repo + revision` 是 Code Context、RCA、Patch 和测试结果的共同硬锚点；缺少 repo 或 revision 时不得发布为稳定 Code Context、确定性 RCA、可执行 Patch 或 Skill（第 1 轮 §3）。
6. 失败路径是一等数据，恢复视图应明确已排除路径，避免下一执行者重复排查（第 1 轮 §4）。
7. 必须允许多个根因、促成因素、修复和验证结果，不强行压缩为单一根因；"已修改代码"不等于"问题已解决"（第 1 轮 §5）。
8. Patch candidate、写操作建议、tool call suggestion、runbook step、RCA recommendation 默认是不可执行的声明性产物，不自动产生 Git/配置/数据库/部署/工具调用或审批权限（第 1 轮 §8）；代码场景、RCA 和 Patch Candidate 也不直接成为可执行对象，需行动时必须针对当前用户、Harness、Project、任务、代码版本、环境和权限重新生成 Action Proposal 与 Run Plan，经风险分类、影响预览、Tool Policy、RunGate 和明确授权才能执行（第 4 轮）。
9. 代码/日志/生产信息进入场景前应分类、脱敏和最小化；身份、租户、Project、来源 ACL、血缘、revision 或验证信息缺失时默认拒绝或隔离（第 1 轮 §9）。
10. 血缘采用结构化引用集合和不可变 revision 锚点，通过 `references`、`derived_from`、`applies_to`、`verified_by`、`invalidated_by` 等关系关联，第一版不建设完整图数据库（第 2 轮）。
11. 复用规则分档：同 revision 可精确复用；祖先/后代 revision 只能作为需复核候选；分支、rebase 或关系不明时不得默认复用；不同 repo 或 Project 必须重新检查代码结构、依赖、环境、业务边界、ACL 和 RCA 条件（第 2 轮 §2）。
12. 跨 Project 禁止复制源代码全文、内部路径、原始日志、客户数据、生产拓扑、私有工具参数、未脱敏 Patch 及 Project 内部人员/权限信息，只允许生成抽象化、脱敏的派生经验（第 2 轮 §3）。
13. 有效复用权限取六者交集：当前主体权限 ∩ 来源 Project ACL ∩ 目标 Project/Team 策略 ∩ Purpose/Use Policy ∩ 敏感数据策略 ∩ 资产发布状态（第 2 轮 §4）。
14. 源证据撤回沿血缘级联：RCA/Patch Candidate 重新评估 → Knowledge Asset 暂停或撤回 → Code Context/Index/Embedding 失效 → Context Manifest 重解析 → 受影响 Run 阻断或重新授权（第 2 轮 §4；深化7 §撤回和失效传播）。
15. RCA 采用"证据追加、结论版本化、可重新打开"的持续治理模式，旧版本保持不可变、不直接覆盖；事实层、假设/根因层、修复/预防行动层和适用性层可分别演进（第 3 轮 §1）。同一 RCA 对不同消费者可有不同状态，`reference/retrieval/action` 状态分离：根因有争议时时间线仍可作事实参考但不能驱动修复（第 3 轮 §5）。
16. 根因候选至少区分 `hypothesis`、`confirmed_root_cause`、`contributing_factor`、`disproved_hypothesis`、`missing_evidence`（第 3 轮 §2）。
17. 必须保持三条不变量："修复有效 ≠ 根因完整 / 未复现 ≠ 问题不存在 / 测试通过 ≠ 生产风险消失"（第 3 轮 §2）。
18. 复发事件不自动合并为原 RCA，也不自动创建完全孤立的新 RCA，而是生成关联候选后由人工或受控审核判断（第 3 轮 §3）。
19. Scenario—WorkThread—Task—Run—Attempt 为分层模型；Scenario 不是 Task/Run，Run 成功不是场景解决，Task 完成不是知识发布，旧 Snapshot 不等于当前授权（深化1 §阶段3；深化8 §阶段3）。
20. 知识权限、执行权限和工具权限三面分离；`ToolPolicy` 与 `RunGate` 是两个独立门禁，两者独立检查：没有 RunGate 不能运行，有 RunGate 但超出 ToolPolicy 仍不能运行（深化1 §9、§阶段4）。
21. 统一采集采用"共同关联 Envelope + 信号专属 Payload + 平台事件账本"三层结构；统一关联不代表统一存储，Trace 不是完整事实，指标不是逐事件证据，Tool Span 不是授权或成功证明（深化4 §阶段3；深化11 §阶段3）。
22. 场景关闭是独立、范围化、可重新打开的 Decision，不由 RCA 确认、Run 成功、测试通过、告警消失、修复完成或知识发布单独触发；影响等级（I0–I3）与动作风险等级（R0–R3）分离（深化5 §阶段性结论；深化12 §阶段3）。
23. 敏感数据治理采用多轴分类和用途绑定而非单一敏感标签；凭据/密钥默认禁止持久化原文、回显、Embedding、RCA 派生和跨空间传播，发现即阻断并撤销/轮换（深化6 §阶段性结论；深化13 §阶段3）。
24. Code Context、RCA、Patch Candidate 经对象专属审核后才形成 Knowledge Asset；发布、reference、retrieval、injection、action eligibility 和 execution 分离，Patch Candidate 默认 `action_status=blocked`（深化7 §阶段3、§4；深化14 §阶段3）。
25. 场景质量采用"结果验收而非 Run 成功 + RCA 结论质量分层 + 根因/症状复发区分 + 安全/证据覆盖旁路指标"的指标体系；任何指标都不能自动授予权限、确认 RCA、关闭场景或退休知识资产（深化15 §阶段3）。

### 6.2 核心对象与关系

**三类对象边界（第 1 轮 §1）**
- Code Context：回答"当前代码是什么、问题涉及哪里、修改边界是什么"，含 repo、branch、commit、worktree、文件、目录、符号、模块、调用关系、配置、依赖、API、Schema、测试和运行时版本；必须绑定明确 revision，"不应混入未经确认的根因结论"。
- RCA：回答"为什么发生、哪些证据支持判断、修复是否有效"，含症状、影响、触发条件、证据、候选假设、排除过程、根因、促成因素、修复、预防行动、验证结果和残余风险；"RCA 不能把相关性、时间先后或模型判断直接当成根因"。
- Work Thread：回答"谁为了完成什么工作，经过了哪些尝试，目前进行到哪里"，是工作过程主体，可关联多个 Code Context 和 RCA，但不等于最终知识资产。

**Code Scenario 结构（第 1 轮 §2）**：`Identity`（scenario_id/title、intent/user_request、status、owner/participants）→ `Code Anchor`（repository/branch、revision/commit、dirty_state、environment、dependency/runtime versions）→ `Scope`（files/symbols/modules、tests、related APIs/schemas）→ `Evidence`（tool calls/command outputs、logs/stack traces、diffs、user statements）→ `Paths`（attempted/successful/failed paths、abandoned hypotheses）→ `RCA`（symptoms/hypotheses、confirmed root cause、contributing factors/confidence）→ `Change`（proposed fix/applied diff、reverted/superseded changes）→ `Verification`（tests/commands/results、residual risks、acceptance status）→ `Resume`（current state/blockers、next recommended action、required human decisions）。
- Evidence 字段（第 1 轮 §3）：type（command | log | code | diff | test | user_statement）、content/reference、source_tool、timestamp、repo/revision、scope、supports/contradicts hypothesis、confidence、sensitivity。
- Attempt 结构（第 1 轮 §4）：goal、action、input_context、result、status、evidence_refs、next_decision。

**分层对象与关系（深化1 §1–§4、§8；深化8 §阶段1）**：对象为 Code Scenario、Work Thread、Task、Work Phase、Execution、Run、Attempt、Harness Session、Checkpoint、Revision、Context Manifest、Environment Snapshot、Artifact、Decision、RCA、Evidence、Change/Patch Candidate、Verification Result、Knowledge Asset、Consumer Projection。
- 关系骨架：`Scenario organizes → WorkThread decomposes_into → Task/Work Phase attempted_by → Execution materialized_as → Run emits → Attempt/Evidence`；另有 `resumes_from → Checkpoint`、`uses → Context Manifest/Environment Snapshot`、`admitted_by → RunGate`、`bounded_by → ToolPolicy`、`verified_by`、`invalidated_by / superseded_by`、`derived_from → Scenario/RCA/Evidence`（深化1 §4）。
- 建议基数：`Scenario 1──< WorkThread 1──< Task 1──< Run 1──< Attempt──< Evidence`，同时 `Scenario ──< CodeContext/RCA/Change/Verification`，`Task/Run ──references──> Scenario/CodeContext/RCA`（深化8 §阶段1；精确基数与嵌套规则暂缓）。
- 血缘节点（第 2 轮 §1）：Code Repository/Revision、File/Symbol/Module、Work Thread、Tool Call/Run、Observation/Evidence、RCA、Change/Patch Candidate、Verification Result、Knowledge Asset、Consumer Projection；关系本身应记录来源、创建时间、策略版本和当前状态。

**RCA 与证据演进（第 1 轮 §5；第 3 轮 §1–§2；深化3 §阶段3）**：完整闭环为 症状 → 证据 → 假设 → 验证动作 → 结果 → 根因结论 → 修复 → 回归验证 → 剩余风险。新验证/复发/使用反馈先形成结构化复核事件，不直接覆盖 RCA：已发布 RCA v1 → 新证据/复发事件 → 自动生成 RCA v2 候选 → 差异与证据审查 → 人工/受控审核 → 发布 RCA v2。适用性至少记录 repository、revision_range、file/symbol scope、runtime/environment、dependency range、trigger conditions、exclusions。解释节点分层为 observation、symptom、correlation、association、causal hypothesis、confirmed root cause、contributing factor、trigger、condition（深化3 §1），深化10 另用 symptom/trigger/root_cause/contributing/latent_condition/mitigation/fix/verification。

**Patch 候选（第 1 轮 §8；深化7 §1；深化14 §阶段1）**：Patch Candidate 是"声明性修复建议、diff 引用或变更意图"，必须关联代码锚点、原因、前置条件、风险、验证和回滚，不是 Git 写操作或可执行命令；不携带凭据、工具授予、生产批准或 RunGate 放行。知识化链为 Source Observation/Evidence → Code Scenario/RCA → Patch Candidate → Knowledge Candidate → reviewed Knowledge Asset → consumer projection（reference/retrieval）→ Action Proposal/Run Plan（重新绑定当前上下文）→ independently authorized execution。

**复发事件（第 3 轮 §3）**：复发事件 → 比较错误签名、代码范围、环境、触发条件和时间 → 生成关联候选 → 判断同一根因/同一模式新根因/修复不完整/新版本回归/表面相似 → 人工或受控审核；关系语义为 `reproduces / recurs / regresses / related_to / contradicts / supersedes`，"错误签名相似只能产生候选关联，不能自动证明相同根因"。

**修复、预防行动与观察期（第 3 轮 §4；深化10 §阶段1）**：修复 → 测试与回归 → 原问题复现验证 → 发布或上线 → 指标观察 → 检查是否复发 → 预防行动完成 → 标记持续有效。`root_cause_confirmed` 不等于修复完成；`resolved` 需要修复和验证达到接受标准；`monitored` 表示进入观察期；复发或新证据可使 RCA `reopened`。生产和高影响问题应在修复后继续观察，"具体期限留待以后讨论"。

**场景合并与派生（深化2 §阶段1、§6；深化9 §阶段1）**：合并首先是关系判断或生成派生场景，不是静默把两个 Scenario/RCA/Task/Run/Knowledge 合成一个对象，也不是修改 Git 历史。派生合并方向为 Source Scenario A/B → 关系断言与 common base/patch/mapping 证据 → candidate merged view 或 review package → accepted decision → Derived Scenario M；M 不继承来源的关闭结论、ACL、执行权或工具权。深化9 列出 same_scenario / related_scenario / derived_scenario / duplicate_candidate / unrelated 五类关系。

**知识资产与撤回（深化7 §1–§4；深化14 §阶段3）**：资产状态为 candidate → review → published → suspended/revoked/superseded；消费者状态为 reference（blocked/allowed）、retrieval（blocked/allowed）、injection（blocked/allowed）、action（blocked/eligible）、execution（never implied；requires new RunGate）。最小派生记录含 asset_id/asset_type/asset_version、scenario_refs、evidence_refs、source_revision_refs、transformation/redaction_policy、applies_to/does_not_apply_to、validation_refs、owner/reviewers、publication_state、reference_status/retrieval_status/action_status、invalidated_by/downstream_refs/external_unknown/audit_refs。

**统一采集对象（深化4 §1、§阶段3；深化11 §阶段1、§阶段3）**：Tool Call、Log/Observation、Metric、Trace/Span、Event ledger（平台不可变控制事件，如 run_started、tool_denied、evidence_received、redaction_applied、gap_detected）分别保留语义；最小共同关联上下文含 event_id、signal_type、source_connector、observed_at、received_at、tenant/project/space、scenario_id、thread_id、execution_id、run_id、trace_id、span_id、parent_span_id、repository、revision、environment_ref、actor_ref、attempt、sequence_or_cursor、schema_version、sensitivity、redaction_status、integrity_status、idempotency_key。分层为 Ingestion Envelope → Signal Payload → Normalization/Validation → Event Ledger + Signal Store → Evidence View/Run Timeline/Metrics View → RCA/Knowledge candidate（derived, gated）。

### 6.3 状态与枚举

- Code Scenario 生命周期：第 1 轮 §6 主链 `new → exploring → diagnosing → fix_pending → verifying → resolved`；旁路 `blocked / paused / needs_human_confirmation / abandoned / reopened`。深化5 §最小状态分离 `open / diagnosing / fix_pending / verifying / resolved / monitored / reopened / blocked`。深化8 §生命周期与一致性 `draft → active → resolved | abandoned | reopened`。每次状态转移记录 `from`、`to`、`reason`、`evidence_refs`、`actor`、`timestamp`（第 1 轮 §6）。
- Work Thread：`open → handed_off → active → paused | closed`（深化8）。Task：`ready → assigned → running → blocked | succeeded | failed | cancelled`（深化8）；深化1 §3 记为 提议、就绪、进行、阻塞、完成、取消、重开。Work Phase：进入、暂停、完成、回退、跳过、重开（深化1 §3）。Execution：计划、开始、暂停、失败、结束、重试、放弃（深化1 §3）。
- Run：`queued → gated → running → paused | succeeded | failed | cancelled | unknown`（深化8）。Attempt：`planned → started → committed | failed | unknown | compensated`（深化8）。Harness Session：创建、活跃、挂起、恢复、结束、过期（深化1 §3）。Checkpoint：创建、验证、消费、supersede、失效（深化1 §3）。Revision / Context Manifest / Environment Snapshot / Artifact / Decision 各有生命周期关注点（深化1 §3），全量状态集合明确暂缓（深化1 §明确暂缓事项）。
- RCA 生命周期：`draft → evidence_gathering → hypothesis → root_cause_confirmed → fix_in_progress → verification_pending → resolved → monitored → reopened → superseded / revoked / archived`（第 3 轮 §4）；深化5 简化记为 `hypothesis / confirmed / reopened / superseded / revoked`。
- RCA 根因候选态：`hypothesis / confirmed_root_cause / contributing_factor / disproved_hypothesis / missing_evidence`（第 3 轮 §2）；第 1 轮 §5 最早记为 `confirmed / hypothesis / missing_evidence`；深化3 §阶段3 Decision 层另有 `trigger / disproved / unresolved`；深化10 §阶段3 根因状态为 `confirmed / plausible / rejected / unknown`。
- RCA 消费者状态：`reference_status / retrieval_status / action_status`（第 3 轮 §5）。
- 验证结果 → RCA 处理（第 3 轮 §2 表）：成功复现原问题→增强对应假设但不单独证明根因；未能复现→降低假设可信度并记录环境与输入条件；排除某假设→标记 `disproved`；修复后问题消失→支持修复有效但不单独证明根因完整；修复后仍复现→暂停"已解决"；只在特定环境有效→收窄适用范围；产生新回归→建立新的证据和关联场景；验证环境与生产不一致→只能标记部分验证。验证类型至少区分静态检查、单元测试、集成测试、回归测试、原问题复现、监控/线上观察和人工验收（第 1 轮 §5）。
- 分离状态集（深化5 §最小状态分离）：Fix `proposed / authorized / applied / rolled_back`；Verification `pending / partial / passed / failed / expired`；Change `proposed / approved / gated / running / partially_executed / succeeded / failed / rolled_back / cancelled`；Knowledge `candidate / reviewed / published / suspended / revoked`。
- 场景关闭状态（深化12 §阶段1）：`contained / resolved / monitored / closed / reopened`。
- 等级枚举：影响 `I0`（无用户/业务影响或仅内部实验）、`I1`（受限范围、可快速恢复）、`I2`（多用户/重要服务受影响）、`I3`（广泛、关键业务、合规/安全或重大数据影响）（深化5 §2）。动作风险 `R0`（只读/低风险/可逆）、`R1`（受限工作区或低影响可逆修改）、`R2`（受控资源、生产配置或有限数据库变更）、`R3`（不可逆、广泛生产、权限/凭据/客户数据/跨租户变更）（深化5 §2）。严重等级 `S0 informational / no material impact`、`S1 bounded development impact`、`S2 customer, shared service or material delivery impact`、`S3 production, security, privacy, credential, cross-tenant, irreversible or unknown high-impact event`（深化12 §阶段1）。
- 场景关系状态（深化9 §场景关系状态）：`candidate → related | derived | handoff_continuation → merge_pending → conflict_pending | merged_verified | kept_separate → rebase_revalidation → reusable | narrowed | invalidated`。关系判定结果：`candidate / review / isolate / accepted relation`（深化2 §4）。
- 合并/历史关系词：`merge / rebase / cherry_pick / squash / split / duplicate / related / derived`（深化2 §3）。四类"相同"：`same_problem / similar_text / same_change / same_run`（深化2 §1）。复发关系：`reproduces / recurs / regresses / related_to / contradicts / supersedes`（第 3 轮 §3）。
- 冲突类别（深化2 §5）：`identity_conflict / history_conflict / mapping_conflict / content_conflict / semantic_conflict / environment_conflict / evidence_conflict / permission_conflict / status_conflict`。
- 因果边关系：`causes / enables / precedes / correlates_with / exacerbates / mitigates / verified_by / contradicts`（深化10 §阶段1）；深化3 §1 的解释角色为 observation、symptom、correlation、association、causal hypothesis、confirmed root cause、contributing factor、trigger、condition。
- Tool Call 状态：`requested → policy_checked → approval_pending/approved/denied → started → completed/failed/cancelled/timed_out`（深化4 §4）。采集状态：`captured → classified → redacted → ingested → correlated → retained | expired`，旁路 `delayed / sampled / rejected / failed / lost / unknown / quarantined`（深化11 §阶段3）；信号完整性语义为 `complete/partial/sampled/gapped/late/duplicate/rejected/isolated`（深化4 §3）。
- 数据分类轴（深化6 §1）：`content_class`（credential | pii | customer_data | production_data | source_code | internal_topology | operational_log | trace_context | metric | rca_derived | embedding | audit）、`sensitivity`（public | internal | restricted | confidential | highly_restricted）、`purpose`（observe | diagnose | verify | audit | derive | retrieve | action）、`environment`（dev | test | staging | production | unknown）、`lifecycle`（transient | retained | published | suspended | revoked）、`reidentification_risk`（unknown | low | reviewed | high）。深化13 §验证状态：`classification: unknown|classified|disputed`；`secret_scan: unknown|passed|failed`；`sensitive_scan: pending|passed|failed|needs_review`；`reidentification: unknown|passed|failed|needs_review`；`semantic_fidelity: unknown|passed|degraded|failed`；`propagation: pending|verified|partial|external_unknown`。
- 指标族（深化15 §阶段1）：Recovery（recovery_attempt_rate、recovery_completion_rate、acceptance_verified_rate、time_to_resume/time_to_resolve、rollback_or_compensation_success、residual_unknown_rate）；RCA quality（candidate_to_confirm_rate、confirmed_root_cause_precision、false_confirmation_rate、missed_root_cause_rate、evidence_sufficiency_rate、reopen_after_confirmation_rate）；Repeat failure（recurrence_rate_after_fix、duplicate_attempt_rate、same_root_cause_recurrence、same_symptom_different_cause_rate、retry_amplification_rate、unresolved_repeat_rate）；Safety and data quality（unauthorized_action_rate、sensitive_leakage_rate、stale_context_use_rate、missing_evidence_rate、sampling/coverage rate、unknown_external_state rate）。指标状态：`proposed → instrumented → quality_checked → reported → reviewed → action_tracked`，本身也可 `stale/disputed/invalidated`（深化15 §指标状态和用途）。
- 自动裁决边界枚举（深化10 §自动裁决边界）：`auto_safe`（normalize / correlate / deduplicate / rank / detect_conflict / propose_test / mark_stale / link_evidence）；`review_required`（confirm_root_cause / accept_residual_risk / close_high_impact_incident / publish_RCA / authorize_production_fix / resolve contradictory evidence）。

### 6.4 角色与权限边界

- 必须人工确认或受控审核的事项（第 1 轮 §7）：最终根因；业务影响和严重等级；修复是否符合预期；是否允许修改代码、配置、数据库或生产环境；是否可以关闭场景；是否为同一问题或新场景；敏感数据是否可持久化；是否提炼为长期 RCA、Code Context 或 Skill；未验证风险是否可接受。
- 可自动执行（第 1 轮 §7；第 3 轮 §6）：自动提取 repo/branch/commit/worktree、文件/符号、工具调用、命令、退出码、日志、堆栈、diff、测试/构建结果、依赖版本、候选受影响文件、失败尝试和候选根因；自动追加日志、指标、Trace、测试和 revision，关联复发候选，比较版本，统计复发，标记环境变化、生成修订候选和提醒行动项。深化1 §自动审核与推进 另定状态推进三分："自动可推进的机械性记录 / 需要人工/受控审核的语义判断 / 必须阻断的安全/血缘缺失"。
- 三种权限面分离（深化1 §9）：知识权限（读取、检索、引用、导出、发布、共享、撤回 Knowledge Asset 或 RCA/Artifact 投影）；执行权限（提出、批准、启动、暂停、恢复、重试、取消某个 Action/Execution/Run，以及接受风险或变更结果）；工具权限（调用某类工具、访问资源、使用参数/网络/文件/生产能力的能力边界）。"知识可读/可引用也不会自动获得执行或工具权限"。
- `ToolPolicy` 是能力和约束声明（工具类型、资源范围、参数限制、网络/文件/环境约束、禁止事项、审计要求），不是某一次执行的批准；`RunGate` 是针对当前主体、当前 Run、当前 Context Manifest、当前风险和当前授权的准入/持续控制，不得放宽 ToolPolicy。RunGate 还需重新核验当前身份、Project/租户、资源 ACL、敏感策略、Revision/Environment 适用性、幂等/副作用风险、人工确认和撤回状态（深化1 §9）。
- 职责分离要求（深化5 §成功标准）：proposer、approver、executor、verifier、incident owner 的职责"不能由同一主体无条件兼任"；R0/R1 可按明确策略简化，R2/R3 和高影响关闭不得因组织规模自动取消职责分离（深化5 §阶段4）。
- 分场景角色集（深化12 §阶段3）：S0/S1 可在预授权和审计下轻量关闭（S1 需任务 Owner、基本验证、回滚/停止）；S2 需业务/服务 Owner、技术负责人和独立验证，涉及共享服务或客户影响时增加沟通/风险审查；S3 必须 Incident Commander、业务/资源 Owner、Security/Privacy/变更责任和独立 verifier 按组织规则审批，"不能仅凭 Agent、RCA 模型或事后成功自动关闭"。
- 对象级角色分开记录（深化8 §阶段3）：Scenario Owner、Task Assignee、Run Executor、Evidence Producer 和 RCA Reviewer 分开；Run Snapshot 不能继承全部线程权限。
- 脱敏与知识治理中的角色约束（深化6 §成功标准、§自动审核；深化13 §自动审核）：验证者不能由生成者单独兼任；凭据疑似真实、生产/客户数据原文访问、跨租户/跨 Project、漏洞和内部拓扑发布、组合重识别不明、语义保真争议、脱敏失败、法律/合同限制和高影响执行必须人工或受控审核。
- Break-Glass 边界（深化5 §5；深化12 §阶段4）：仅可用于已绑定 Incident 的最小止损或恢复，必须限主体、动作、资源、时间和最大风险，记录理由、审批/应急权限、实际差异并强制事后复核；不得修改长期 ACL、扩大跨空间共享、发布新可执行知识、删除审计或跳过验证。
- 自动化禁止项（深化2 §自动审核与推进；深化3 §2；深化5 §自动审核；深化7 §自动审核；深化12 §自动审核）：不能自动裁决语义等价/同一工程问题/最终根因/合并关闭/权限继承/高风险执行，不能自动把 `causal hypothesis` 升级为高影响 `confirmed root cause`，不能自动批准生产/权限/凭据/跨租户变更或接受残余风险。

### 6.5 关键规则与不变量

- **revision 边界**：`repo + revision` 是共同硬锚点（第 1 轮 §3）。Branch 是可移动的命名引用，"不能替代稳定 Revision；rebase、force-push 或分支切换可能改变其指向"（深化1 §2）；worktree 是工作目录视图，不能单独作为代码版本身份。同一 Scenario 可关联 repo A @ revision a1/branch feature-x/environment test 等多组锚点，但每个 Evidence、Artifact、RCA 判断和 Verification 都要说明其实际适用的 repo/revision/environment 范围（深化1 §7）。rebase 或 force-push 后旧 revision 仍是历史事实，新 revision 需重新建立比较和验证关系（深化1 §7；深化2 §2）。相同 hash 不等于同一场景；branch 名不是身份（深化2 §反例约束）。
- **失败路径与恢复**：保留命令失败、测试失败、假设被证伪、工具不可用、权限不足、环境不一致、修改引入回归以及用户拒绝/取消等类型（第 1 轮 §4）。暂停恢复语义为 `active work → pause event + Checkpoint + blocker/required decision → later resume request → re-check current identity, ACL, Revision, Environment, Context Manifest, ToolPolicy and RunGate → continue as new Execution/Run or explicitly resume the logical attempt`（深化1 §6）。"恢复不能盲目重放历史工具调用，尤其不能重放有副作用的写操作"；无副作用读取可在策略允许时重建上下文，有副作用或环境变化时默认新建/重新门禁的 Run。父对象关闭不能覆盖子对象的 `unknown`、未完成副作用或未验证结果；Run 状态未知时不能自动重试，须先冻结重复副作用并对账（深化8 §阶段3、§阶段4）。
- **RCA 证据演进与版本化**：事实、假设/根因、修复/预防行动、适用性四层可分别演进但每次变化必须保留来源、版本和变化原因（第 3 轮 §1）。每个候选关联支持证据、反证、验证动作、验证结果、适用环境和当前置信状态（第 3 轮 §2）。使用反馈先形成结构化复核事件（关联 RCA 版本和消费者 → 判断影响 → 追加证据或生成新版本 → 人工/受控审核 → 保留、收窄、暂停、替代或撤回），反馈至少区分根因错误、适用范围过宽/过窄、修复无效、预防措施无效、步骤不可执行、证据不足、表达不清和权限/敏感问题（第 3 轮 §5）。证据分层为事实观察、机制证据、比较/干预证据、反证与排除、解释产物，解释产物属于 `derived`，不能冒充 `source`（深化3 §5）。时间先后、相关性/association、模型分数、多数票、单次修复成功、告警消失、测试通过、Trace 父子顺序均不等于因果或场景已解决（深化3 §阶段4；深化10 §阶段4）。
- **跨 revision / 跨 Project 复用规则**：同 revision 高相关候选仍需检查资产状态和当前权限；祖先/后代 revision 必须检查相关文件、符号、diff、API、依赖和测试并标记需当前版本复核，"不得自动视为当前事实或已验证 Patch"；分支、rebase 或关系未知"只能作为低置信历史参考，不进入默认 Code Context，不形成确定性 RCA，不允许 Patch 自动应用"（第 2 轮 §2）。代码未触及相关范围可继续作为候选；相关文件、依赖、接口或运行条件变化时必须复核或暂停默认使用；来源撤回、权限变化或证据失效时立即阻断。跨 Project 候选需明确来源 Project、适用/不适用条件、抽象化程度、脱敏策略、验证状态和目标消费者，且"抽象化不等于扩大权限"（第 2 轮 §3）。无法证明来源和影响范围时不得继续跨 Project 复用，应隔离并等待人工处理（第 2 轮 §4）。Scenario 关系成立不自动合并 RCA、完成 Task、合并 Run、发布 Knowledge 或扩大权限（深化2 §6）。
- **source / derived 分层与不可变**：分为 observed source、declared source、curated source、derived、mixed；"Derived 不应覆盖 source"，抽取器不能把模型推断写回成 observed fact（深化1 §5）。采用"不可变事件 + 版本化对象 + 可重建当前视图"：事件只追加，对象变化产生新版本，当前视图是派生投影，重复投递不得产生重复副作用，append-only 不等于永不撤回（深化1 §10）。历史快照只证明过去发生过什么，"不授予当前访问权、发布权、执行权或工具权"（深化1 §阶段3、§10）。
- **知识发布与执行授权分离**：知识发布不等于执行授权；已发布资产不等于可行动（深化7 §阶段3；深化5 §反例约束）。任何 Action Proposal/Run Plan 必须针对当前主体、Harness、Project、Task、revision、环境、Tool Policy 和 RunGate 重新生成（深化7 §阶段3）。
- **撤回与失效传播**：源撤回/权限收窄/revision 漂移/验证失败 → 权威控制事件 → 阻断新 retrieval、injection、action 和 pending 高风险 Run → 枚举 RCA、Code Context、Patch、Knowledge、Embedding、Index、Cache、Manifest、Harness projection 及排队 Action 后代 → 按证据暂停/重算/收窄/撤回 → 通知 owner 与消费者 → 重新审核后方可恢复；"无法证明影响闭包、缓存失效或权限状态时，保持阻断，不以'暂时没检索到'作为清理完成证明"（深化7 §撤回和失效传播；深化14 §下游撤回传播）。
- **生产变更与关闭不变量**：生产变更必须绑定不可变/版本化 Run Plan，路径为 Action Proposal → versioned Run Plan → scope/impact/risk preview → current identity, ACL, ToolPolicy and precondition check → independent approval → RunGate → execution with actual-diff capture → verification/rollback or stop → decision/execution/impact audit → post-change review（深化5 §4）。"计划、环境、revision、参数、风险或权限变化时原批准自动失效"（深化5 §成功标准、§4）。`contained`、`resolved`、`monitored`、`closed` 和 `reopened` 独立记录；`resolved ≠ closed`、`contained ≠ no_residual_risk`、`closed ≠ all_actions_complete`（深化12 §阶段3、§阶段4）。
- **敏感数据硬门**：凭据发现后的处理顺序为 停止传播 → 最小化隔离 → 通过安全通道轮换/撤销（若已获授权）→ 影响范围分析 → 清除未授权投影/缓存 → 审计和复核（深化6 §2）；"扫描器误报不能自动把普通业务值公开，扫描失败也不能标记为安全"。任一硬失败或必要状态 unknown 时消费状态至少为 `isolated/blocked/needs_review`，"不能用总体评分抵消秘密泄露或权限失败"（深化13 §验证状态）。反例：masked ≠ safe for every purpose、hashed ≠ anonymous、embedding ≠ non-sensitive、internal ≠ universally readable、scan passed ≠ no secret exists（深化6 §阶段4；深化13 §阶段4）。
- **指标不授予权限**：指标必须记录 numerator/denominator、窗口、采样/漏失、分层、数据来源、版本、置信区间或不确定性、owner 和决策用途；分母必须排除或单独标记取消、无权访问、证据不足、环境不可用和观察期未完成样本；"任何指标都不能自动授予权限、降低风险、确认 RCA、关闭场景或退休知识资产"（深化15 §阶段3）。
- **采信与门禁不变量（反例约束汇总）**：`Run succeeded ≠ Scenario resolved`、`Task completed ≠ Knowledge published`、`Branch name matches ≠ Revision is identical`、`Historical authorization ≠ Current authorization`、`RCA confidence ≠ Tool execution permission`、`Trace correlation ≠ Complete causal proof`、`Artifact exists ≠ Artifact is trusted or publishable`、`Checkpoint exists ≠ Checkpoint can restore old rights`（深化1 §阶段4）；`trace_id ≠ actor identity`、`span exists ≠ tool approved`、`metric aggregate ≠ every underlying event`、`sampled ≠ absent`、`accepted ≠ durably stored`、`received order ≠ source order`（深化4 §阶段4；深化11 §阶段4）；`correlation ≠ causation`、`last_change ≠ root_cause`、`incident_contained ≠ RCA_closed`（深化10 §阶段4）。

### 6.6 界面/交互线索

- 简化视图原则：UI 可提供 Scenario/Thread/Task 的简化视图，但底层仍需保留 Run、Evidence、Revision、权限和血缘，"不以简化界面牺牲可审计边界"（深化1 §阶段4）。
- 重复/合并入口：UI 可隐藏复杂度并展示候选、依据、冲突和下一步，但底层必须保留 source/derived、review/isolate 和不可变历史，"不能用便捷操作绕过审核"（深化2 §阶段4）；默认展示高置信连续交接，相关/派生/冲突候选按需展开并解释原因（深化9 §阶段4）。
- RCA 展示：界面可给出主假设、并行解释、未知和下一步，并明确"确认根因"与"问题已解决"的差异（深化3 §阶段4）；默认展示 症状→关键证据→当前结论，展开候选、冲突、未知和验证门槛（深化10 §阶段4）。
- 时间线/查询展示：UI 可排序不等于事实重排（深化4 §阶段3）；时间线必须是带完整性状态的派生视图，缺失时显示 partial/unknown，不补造顺序（深化4 §阶段4）；查询结果必须区分"没有信号"和"无权查看/未采集/被采样/未知"（深化11 §阶段3）；只有一条可读 Run 时间线时也必须显示 partial、sampled、gapped、redacted 和 unknown 状态，并能下钻到授权证据（深化4 §阶段4）。
- 关闭与状态展示：UI 可给出"当前主状态 + 缺口 + 下一门槛"，底层保持状态分离，"避免一键关闭制造错误确定性"（深化5 §阶段4）；UI 展示影响/证据/观察/未决行动的分层状态，不使用单一成功标记（深化12 §阶段4）。
- 知识/资产展示：UI 可汇总展示但必须显示证据、适用范围、状态和"不可直接执行"边界（深化7 §阶段4）；展示"事实/分析/候选修改"和各自可参考、可检索、可行动状态，不用一个可信标签覆盖（深化14 §阶段4）；默认展示当前 Task/Run 和阻断原因，按需展开 Thread/Scenario 关系（深化8 §阶段4）。
- 矩阵与审批入口（文档真实给出）：关闭与变更矩阵（原则级，列"场景 / 影响·风险示例 / 最低路径 / 自动化边界"，含只读取证 I0/R0、工作区可逆修复 I0–I1/R1、受控生产配置或有限数据库变更 I1–I2/R2、广泛生产与权限/凭据/客户数据/跨租户/不可逆变更 I2–I3/R3、高影响场景关闭或安全/合规事件、Break-Glass 止损）（深化5 §关闭与变更矩阵）；严重等级原则矩阵（S0–S3，"典型影响 / 最低门禁 / 关闭/升级"）（深化12 §原则矩阵）；最小处理矩阵（"类型 / 默认处理 / 可保留的最小证据 / 禁止·高风险内容"）（深化6 §最小处理矩阵）；数据类别与默认处理矩阵（深化13 §数据类别与默认处理矩阵）；审批链为 scenario/RCA evidence → severity classification → impact and risk preview → proposed fix/production change → current authorization and Tool Policy → independent approval → RunGate → execute → verify/observe → residual risk acceptance → close or reopen（深化12 §审批链）。
- 关闭证据最小包络（可作为表单字段线索）：scenario_id/incident_id/rca_version、severity/impact_scope/tenants/data_categories、timeline/containment/change_refs/approvals、actual_vs_planned/verification/observation_window、residual_risk/risk_acceptor/open_actions/owners、audit_refs/notifications/reopened_conditions、closed_by/closed_at/decision_version（深化12 §关闭证据最小包络）；关闭请求还需列出 Scenario/Incident 身份、问题和影响范围、repository/revision、环境和时间窗口、触发条件、关联 RCA 版本、修复/缓解引用、验证清单与结果、未验证路径、残余风险、观察/复发计划、回滚或重新打开条件、请求者和审核依据（深化5 §3）。
- 具体界面原型、页面结构、组件、线框图、表单控件、状态徽标与交互流程：文档未明确。

### 6.7 仍暂缓未定的内容

- 第 1 轮暂缓表（第 1 轮 §本轮明确暂缓事项）：场景与 Work Thread/Task/Run 的完整 Schema 和关系；跨 repo/跨 revision 的场景合并、分支和 rebase 处理；RCA 多根因的完整因果图和自动裁决算法；工具调用、日志、指标和 Trace 的统一采集协议；场景关闭、严重等级和生产变更的完整审批矩阵；代码、日志、生产数据和凭据的完整分类脱敏规则；Code Context、RCA、Patch 候选知识化和下游撤回；场景恢复成功率、RCA 误判率和重复失败率的完整指标体系——均记为"已完成原则性处理；具体 Schema/算法/字段/阈值/实现仍暂缓"。
- 第 2 轮暂缓表：完整血缘图 Schema、跨 revision 关系算法和一致性协议（属议题 7）；跨 Project 抽象化和脱敏的具体算法；RCA 对代码变更影响的自动判定与复现机制；代码/日志/生产数据和工具参数的完整分类目录；归属变化对跨 Project 复用、索引和 Manifest 的完整传播协议；跨 Project 候选的审核角色、SLA 和撤回流程。
- 第 3 轮暂缓表：不同事故等级的观察期、复核周期和 SLA；复发事件的错误签名、相似度和自动关联算法；RCA 根因因果图和多源证据裁决模型；验证结果与任务成功率的统一评估口径；reference/retrieval/action 的具体消费者协议；RCA 撤回、删除、权限传播和历史审计例外；使用反馈的脱敏、采样、训练准入和归因规则。
- 第 4 轮暂缓表：Patch Candidate 到 Action Proposal 的完整 Schema；RunGate 的具体状态机和审批矩阵；各 Harness 的执行能力声明协议；自动判断 Patch 风险和影响范围的算法；Knowledge Asset、Action Proposal 和 Run Plan 的完整血缘图；不同知识类型的发布门槛和审核责任；执行反馈如何驱动 Skill/RCA 自动收窄或退休；生产变更、数据库操作和凭据使用的专门审批。
- 深化级暂缓要点（各 §明确暂缓事项及原因）：所有对象最终字段 Schema/JSON Schema/API/数据库模型、事件类型与传输协议、完整状态枚举与关闭阈值、Task/Phase/Execution/Run 精确基数、Checkpoint 可移植性/加密/保留期、RunGate 审批角色与风险评分、ToolPolicy 能力目录与沙箱、三权限统一策略语言、provenance ontology 与撤回传播一致性、事件保留与物理删除（深化1）；场景关系图与合并算法、Git provider 统一 API、common base/历史重写算法、patch 相似度与语义等价阈值、冲突自动解决、monorepo/submodule/依赖解析器、ACL 继承与跨 Project 复用矩阵、自动审核性能与误合并率（深化2）；因果图 Schema、因果发现与自动裁决算法、置信度与必要/充分条件阈值、具体因果模型/LLM/统计方法、领域词典与标注规范、生产修复实验准入与观察期 SLA（深化3）；Envelope/Payload 字段 Schema、采集传输与补发幂等实现、采样率与保留 SLA、完整脱敏算法与密钥管理、指标命名与告警阈值、多信号统一查询与回放 UI、Trace/Metric/Log 融合因果算法、Tool Call/RunGate/ToolPolicy/Audit 最终接口（深化4）；I0–I3/R0–R3 完整操作目录与数值阈值、多级与替代审批、Break-Glass 身份与密钥与自动止损编排、场景关闭 API/状态机/Schema/UI、观察期与重开触发器、残余风险接受与法务合规签署（深化5）；完整数据分类目录与字段词典、Secret/PII/重识别检测算法与阈值、脱敏/令牌化/加密擦除实现、生产排障原文访问与跨租户例外、Embedding/Index/Cache 反演与撤回传播、保留期与物理删除、脱敏后 RCA/Skill/Knowledge 发布与执行矩阵（深化6）；Code Context/RCA/Patch/Knowledge 最终 Schema/API/存储、对象专属质量评分与发布阈值、Patch 风险分析与自动适用性、Embedding/Index/Cache/Manifest 撤回一致性、跨空间发布矩阵、物理删除与已运行 Run 逐工具处置（深化7）；最终数据库 Schema/索引/事件模型/查询 API、Task/Run 聚合状态与并发取消语义、场景合并规则、授权与审计存储格式、恢复补偿幂等协议（深化8）；跨 repo/revision 相似度与合并算法、分支/rebase 变更映射与冲突解决实现、RCA/Knowledge 随 revision 自动重验证、跨 Project/tenant 权限与复用协议、图索引去重与成本控制（深化9）；完整因果推断与反事实算法、多源证据权重阈值与自动裁决规则、统一采集协议、RCA 图存储查询可视化、生产修复与残余风险和法务责任矩阵（深化10）；Connector/Harness 统一采集字段与认证重试协议、存储查询采样成本实现、Tool Call 参数脱敏与凭据处理、跨服务上下文传播完整性、丢失延迟补发与对账协议（深化11）；企业最终 S0–S3 目录与阈值与法定人数、关闭观察期升级与行动项 SLA、具体 RunGate、Incident/工单/发布/审计系统集成、跨租户通知与残余风险接受流程（深化12）；企业最终数据分类目录与法域映射、DLP/扫描/脱敏/伪名化/重识别算法、凭据托管撤销轮换与 HSM/KMS、生产取证与跨租户外发审批、备份与外部副本清理验证（深化13）；Code Context/RCA/Patch 最终 Schema 与评分与发布阈值、Patch 语义验证沙箱 CI/CD 回滚执行接口、自动撤回与权限传播与外部副本清理、跨 Project 派生与目标 Owner 审批、知识质量与误判与复发指标（深化14）；各场景/严重等级/Harness 的具体阈值与 SLO 与样本量、RCA 真值标注与置信区间实现、多源观测与跨租户统计、指标驱动发布退休灰度告警自动化、复发检测与根因聚类与重试放大算法（深化15）。
- 明确"文档未明确"的空白：观察期的具体期限（第 3 轮 §4 明确"具体期限留待以后讨论"）；各类暂缓项的具体数值、字段名、API 路径、数据库表、序列化格式与状态阈值（深化1 §8 明确"不要在本轮决定字段名称、必填性、嵌套形式、序列化格式、API 路径、数据库表、事件主题、状态枚举或状态阈值"）；界面原型与表单实现细节（见 6.6 末条）；日志/凭据/生产数据分类的完整目录与例外流程。
