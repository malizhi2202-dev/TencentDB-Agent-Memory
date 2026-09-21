# 议题 9 / 议题 10 事实摘要（供产品设计文档使用）

来源（只读，未修改）：

- `.specs/enterprise-agent-memory-platform/09-企业级权限与治理.md`（1926 行，状态：已确认，第 1、2、3 轮 + 8 个子议题深化）
- `.specs/enterprise-agent-memory-platform/10-跨空间复用与脱敏.md`（2154 行，状态：已确认，第 1、2、3 轮 + 第 4–21 轮深化）

约定：只摘录文档中真实存在的内容，不推测补全；每条尽量标注来源小节号与行号；文档未写的写"文档未明确"；关键定义句原样引用。

---

## 议题 9：企业级权限与治理

### 9.1 已确认结论清单

以下 11 条为文档中带"本轮确认"或"阶段性结论"标记、且已标注"已确认通过/阶段性完成"的结论（原文为整段加粗引用，此处提炼要点）。

1. **第 1 轮确认（行 13）**：企业级权限治理采用"主体—资源—动作—用途—作用域—条件—风险—当前状态"的授权模型，**授权决策与实际执行分离**；读取、检索、引用、投影、写入、审核、发布、撤回、影响分析、审批和执行必须分别授权；"能读不等于能使用，能使用不等于能写入，能发布不等于能执行"；实际允许范围取十项策略的交集，任一硬门禁失败默认拒绝/隔离/进入审核；Agent、Harness 和 Governance Agent 不能自我授权或代替人类承担高风险审批；权限必须具备生命周期、过期、撤回、暂停和传播机制；break-glass 只能限时、限范围并要求事后复核。
2. **第 2 轮确认（行 272）**：权限继承、委托和策略组合必须分开建模；`member_of`/`owns`/`participates_in`/`acts_for`/`delegates_to` 不自动等价为全部资源权限；继承按动作白名单控制；策略组合采用"硬拒绝优先、下级只能进一步收紧、未知或冲突默认拒绝/隔离/待审核"；委托满足 `delegate_effective_permission ⊆ delegator_effective_permission`，禁止无限再委托；代理操作必须记录原始用户、委托 Agent、执行 Harness、审批者和验证者。
3. **第 3 轮确认（行 419）**：高风险操作采用"Action Proposal → 版本化 Run Plan → 风险分类与影响预览 → 当前授权和策略检查 → 独立审批 → RunGate → 执行 → 执行差异记录 → 验证 → 决策/执行/影响审计 → 事后复核"闭环；审批绑定不可变计划版本，关键变化使原审批自动失效；Break-Glass 不得修改长期 ACL、扩大普通权限、发布新 Skill、扩大跨空间范围或删除审计；紧急撤回采用"同步阻断 + 异步治理"两阶段；审批/执行/影响状态分离，审计不可静默修改；高风险策略或审计系统不可用时默认阻断。
4. **子议题 1（行 720）**：R0–R3 是**按动作实例计算的原则风险层，不是角色固有等级或单一总分**；任一不可逆、生产、客户/凭据、权限、跨租户、敏感、可执行或影响未知属性触发升级；组合动作取最高风险，未知不降级；R0 可按策略自动审计，R1 需明确授权与 ToolPolicy，R2 需独立审批/RunGate/回滚/验证，R3 禁止仅凭策略自动放行。
5. **子议题 2（行 863）**：多级审批采用"风险/动作驱动的角色链 + 资格与独立性检查 + 受限替代 + 当前 RunGate 重检"模型；R0 可自动记录或单级确认，R1 需职责 Owner，R2 需资源/业务 Owner 与独立风险/安全或变更审批，R3 需专门治理/安全/合规与业务责任的独立审批（必要时双人/法定人数）；Named substitute、on-call delegate、quorum fallback 只能在原授权子集内生效；**审批超时不等于批准**；身份/组织/审批系统不可用或责任不明时默认阻断。
6. **子议题 3（行 1025）**：Break-Glass 采用"已验证主体 + 已绑定 Incident + 预定义最小动作 + 限时限域令牌/密钥 + RunGate/ToolPolicy 重检 + 全程审计 + 自动过期/撤销 + 独立事后复核"模型；**认证只证明主体，授权还需检查资源、用途、范围、风险、环境、revision、委托链和 Incident**；应急 Token 不能通过自身文本获得权限；通用 Break-Glass 只允许预定义止损、阻断、隔离、最小恢复和取证；`policy_or_audit_unavailable` 对高风险路径 fail-closed；事后复核"不是把未经授权的动作追认为已授权"。
7. **子议题 4（行 1180）**：审计采用按事件类型、敏感性、用途、保全/合规义务和生命周期分层的追加式证据模型，至少区分 Decision / Execution / Impact / Identity-Policy / Lineage-Retention 五类；凭据、客户数据、完整生产请求体和无关 Trace 不因审计名义复制；不可抵赖依赖可信来源/时间、追加顺序、完整性校验、访问/修改控制、密钥保护和可验证审计链；保留期限多轴决定；过期清理覆盖正文、附件、索引、缓存、备份和派生副本；审计/策略不可用时高风险动作默认阻断。
8. **子议题 5（行 1350）**：权限撤回对运行中 Run 采用"新调用立即阻断 + 当前 Tool Call 逐 Attempt 重检 + 按工具能力和副作用阶段选择安全边界/取消/暂停/补偿/回滚/人工接管 + 外部状态对账 + 新计划重新授权"模型；**取消请求不等于副作用已停止，回滚请求不等于回滚成功**；外部撤销无法确认时标记 `revocation_unknown`；权限恢复不自动重放旧调用；补偿/回滚/人工接管本身都是新的受授权动作。
9. **子议题 6（行 1491）**：跨租户紧急撤回采用"先权威阻断、后影响分级、事实与法律责任分离、最小必要披露、责任人确认、可验证投递、分阶段更新和完整复盘"的通知模型；N0 内部 / N1 跨租户运营 / N2 客户业务 / N3 监管执法数据主体四级分别建模；通知对象、时限和内容由适用法域、客户合同、控制者/处理者责任和事件事实决定，"不能由平台默认推断"；紧急阻断不等待法律意见，通知不替代阻断。
10. **子议题 7（行 1660）**：自动影响闭包采用"权威撤回版本 + 同步最小阻断 + 至少一次版本化传播 + 幂等应用/对账 + 分片优先级遍历 + 显式消费者状态 + 缺口与未知可见 + 闭包验证后分级恢复"模型；每个消费者必须证明已应用所需版本，`stale/pending/failed/unknown` 不得伪装为 `current`；不假设跨外部系统 exactly-once；性能降级只能延迟恢复或扩大隔离，不能降低安全门禁。
11. **子议题 8（行 1846）**：事后治理采用"多闭环状态 + 风险分层目标 + 明确 A/R/C/I 责任 + 独立复核 + 超时升级 + 改进项跟踪"模型；技术遏制/恢复、权限与血缘传播、外部影响/通知、审计、法律/隐私评估和独立复核分别完成并分别取证；SLA 以 TTA/TTC/TTI/TTR/TTP 分解；超时默认 `escalated | blocked | review_overdue`，"不得默认批准、关闭或追认未授权副作用"；复盘促进无责学习，但不消除治理责任。

### 9.2 核心对象与关系

**主体与资源（第 1 轮 §1，行 15–42）**

- 主体至少包括：`User`、`Team`、`Project`、`Agent`、`Harness`、`Governance Agent`、`Service Account`、`Connector`、`External System`。
- 资源至少包括：`MemorySpace`、`Memory / Work Thread / Task / Run`、`Evidence / Knowledge Asset / RCA / Code Context`、`Embedding / Index / Context Manifest`、`Action Proposal / Run Plan / Tool / Environment`、`Audit Record / Policy / Lineage Relation / Feedback Event`。
- 归属、创建者、生产者、参与者、审核者、发布者、消费者、执行者、受益者和事故责任人**分开建模**："不能因为 Agent 产生了记忆就自动成为唯一 Owner"。

**动作分层与动作清单（第 1 轮 §2，行 44–85）**

- 第一版动作：`discover`、`read_metadata`、`read_content`、`retrieve`、`reference`、`project`、`write`、`edit`、`derive`、`review`、`approve`、`publish`、`deprecate`、`revoke`、`archive`、`restore`、`export`、`analyze_impact`、`create_action`、`approve_action`、`execute`、`cancel`、`rollback`、`audit`、`administer`、`delegate`。
- 不等价约束：`read ≠ use`、`use ≠ write`、`write ≠ publish`、`publish ≠ execute`、`execute ≠ approve`。

**授权请求与决策（第 1 轮 §3，行 87–120）**

- `Authorization Request` 字段：`principal / principal_type`、`resource / resource_type`、`action`、`purpose`、`scope`、`sensitivity`、`lineage_state`、`publication_state`、`harness_capability`、`run_context`、`risk_level`、`requested_at`、`policy_version`。
- `Authorization Decision` 字段：`decision`、`obligations`、`required_approvals`、`redactions`、`allowed_scope`、`expiry`、`policy_version`、`audit_level`。"授权输出不能只有布尔值"。

**权限交集与策略组合（第 1 轮 §4 行 122–145；第 2 轮 §3 行 305–324）**

- 实际允许范围 = 主体权限 ∩ 资源 ACL ∩ MemorySpace 策略 ∩ 来源血缘 ACL ∩ Purpose Policy ∩ 敏感性/脱敏策略 ∩ Harness Capability ∩ Tool Policy ∩ RunGate ∩ 当前资产状态。
- 建议决策顺序：租户隔离/安全禁令 → 法规与敏感性限制 → 来源 ACL 与血缘限制 → Organization Policy → Team Policy → Project Policy → Resource ACL → Purpose Policy → Harness Capability → Tool Policy → RunGate → 时间和条件检查。
- "上游硬拒绝不能被下游允许解除；下游可以进一步收紧；`unknown` 不转换成允许"；只有所有必要条件满足才返回 `allow`。

**继承白名单（第 2 轮 §2，行 292–303）**

- 每个权限关系至少区分 `inheritable_actions`、`non_inheritable_actions`、`approval_required_actions`、`delegable_actions`。
- Team 成员或 Project Owner 可按范围继承低风险读取、引用或管理动作；`publish`、`revoke`、`export`、`execute`、`approve_action`、生产变更、敏感数据访问和跨空间动作**不自动继承**。

**受限委托与代理责任链（第 2 轮 §4–5，行 326–378）**

- `Delegation` 字段：`delegator`、`delegate`、`resource_scope`、`allowed_actions`、`purpose`、`conditions`、`start_at`、`expires_at`、`max_risk`、`allow_subdelegation`、`revocable`、`approval_refs`、`audit_refs`。
- 约束：`delegate_effective_permission ⊆ delegator_effective_permission`；委托动作 ⊆ 委托者已拥有动作 ∩ Agent/Harness Capability ∩ Tool Policy ∩ RunGate。默认禁止无限委托和自动再委托。
- 代理责任链必须记录：`initiated_by_user`、`delegated_to_agent`、`executed_by_harness`、`approved_by`、`verified_by`；"不能只记录 `actor = Agent`"。

**审批绑定不可变计划版本（第 3 轮 §2，行 436–475）**

- 审批必须绑定：`proposal_id / version`、`run_plan_id / version`、`resource_scope`、`target_revision`、`environment`、`tool_call_set`、`purpose`、`risk_level`、`preconditions`、`verification_plan`、`rollback_plan`、`expires_at`。
- 使审批失效的变化：目标资源变化、revision 变化、工具参数变化、影响范围扩大、环境变化、风险升级、权限变化、来源撤回、回滚方案变化；失效后 `RunGate = blocked` → 重新生成 Plan → 重新审批。
- 审批生命周期（子议题 2 §阶段3，行 865–879）：`requested → eligibility_resolved → approval_plan_versioned → pending_level_1 … pending_level_n → approved | rejected | expired | escalated | blocked → RunGate_recheck → executed | cancelled → verification → post_review`；每个审批节点绑定 `proposal/run_plan version`、`resource_scope`、`purpose`、`risk`、`required_role`、`approver`、`delegator`、`substitute_reason`、`valid_from/to`、`decision`、`evidence_refs`。

**RunGate 独立复核（第 3 轮 §3，行 477–494）**

- 执行前重新验证：当前主体和委托链、当前资源和作用域、当前用途、当前环境与 revision、当前资产和血缘状态、当前权限和敏感性、当前策略版本、审批状态和有效期、风险等级、前置条件。
- "RunGate 不由 Knowledge Asset、Agent 或普通业务代码直接绕过。高风险策略或审计系统不可用时默认阻断。"

**Break-Glass 对象（第 3 轮 §4 行 496–534；子议题 3 §阶段1，行 958–972）**

- 至少绑定：`incident_id`、`requester / verified principal / organization`、`reason / declared emergency`、`resource_scope / allowed_actions / max_risk`、`purpose / environment / target revision`、`start_at / expires_at / max_duration`、`approver_or_emergency_authority`、`credential/token reference and policy version`、`post_review_required / notification targets`。
- "没有 Incident、主体或范围不能通过'紧急'字样补齐。"
- 密钥/令牌属性：短期、限受众、资源绑定、尽可能不可导出、一次性/防重放、可轮换/撤销、安全签发与存储、使用与失败审计、自动过期与 kill switch；禁止写入日志/Trace/Manifest 或通过聊天传递。

**三类（五类）审计与执行前后验证（第 3 轮 §6–7，行 563–578；子议题 4 §1，行 1123–1133）**

- 决策审计：请求主体、用途、资源、策略版本、授权结果、理由、审批和义务。
- 执行审计：计划、实际 Tool Call、计划外差异、结果、验证、回滚和残余风险。
- 影响审计：受影响资产、Run、Manifest、Project、阻断、撤回和传播状态。
- 子议题 4 扩展为五类：`Decision Audit`、`Execution Audit`、`Impact Audit`、`Identity/Policy`、`Lineage/Retention`。
- 审计事件最小包络（行 1184–1193）：`event_id / event_type / occurred_at / received_at`、`principal / delegation / authenticator_ref`、`purpose / resource_scope / tenant/project/space`、`policy_version / decision / reason`、`plan/proposal/run/trace/lineage refs`、`sensitivity / redaction / retention_class / legal_hold`、`previous_event_digest / event_digest / signature_or_integrity_ref`、`storage/copy status / access status / expiry / deletion status`。
- 执行前检查权限、计划版本、目标资源、来源状态、环境、revision、审批有效期、风险和前置条件；执行后检查实际 Tool Call 是否与计划一致、实际影响范围、结果、验证、残余风险和是否需要回滚。

**权限对象与生命周期（第 1 轮 §8，行 207–249）**

- 权限对象字段：`grant_id`、`subject`、`resource`、`action`、`purpose`、`scope`、`conditions`、`issued_at`、`expires_at`、`policy_version`、`approver`、`revocation`。
- 撤回/过期/收窄传播链：阻断新 retrieval / action → 重新解析 Context Manifest → 暂停或重新授权 pending Run → 失效相关 Projection / Index / Embedding → 重新评估派生资产 → 保留历史 Run 审计。"历史 Run 不被静默改写"。

**Tool Capability Profile（子议题 5 §2，行 1288–1303）**

- 每个工具/Connector 应声明：`read_only or write`、`reversible / compensatable / irreversible`、`idempotency support`、`cancel/stop support and deadline`、`transaction boundary`、`partial side-effect visibility`、`credential lease behavior`、`result certainty / reconciliation method`。
- "缺少能力声明不能自动选择安全取消或回滚；高风险工具默认进入人工/受控接管。"

**跨租户通知最小记录（子议题 6 §阶段3，行 1516–1527）**

`incident_id / correlation_id`、`source_tenant / target_tenant / affected_scope`、`fact_state / data_category / time_window`、`containment_state / lineage_and_derivative_refs`、`controller_processor_role_status`、`legal_jurisdictions / contract_refs / legal_hold`、`notification_class / recipient_role / approved_by`、`message_version / disclosure_scope / channel`、`sent_at / delivery_state / retry_count`、`next_update_at / escalation_owner / audit_refs`。

**闭包证明最小包络（子议题 7 §阶段3，行 1688–1697）**

`closure_id / root_event / authority_version`、`partition / tenant_scope / traversal_policy`、`expected_consumers / discovered_consumers`、`last_applied_event / high_watermark / gap_refs`、`consumer_state / acknowledgement / digest`、`retry_count / dead_letter_ref / reconciliation_ref`、`coverage / unknown_scope / started_at / completed_at`、`restore_decision / approver / audit_refs`。

**复核记录与责任矩阵（子议题 8 §阶段3，行 1800–1816、1865–1877）**

- A/R/C/I 定义：`A — accountable`（对决策/风险接受/法定动作负责）、`R — responsible`（执行、调查、验证或补救）、`C — consulted`（安全、隐私、业务、法律和架构意见）、`I — informed`（按最小必要范围接收状态和结果）。
- 复核记录最小包络：`review_id / incident_id / root_event / run_refs`、`risk_level / trigger / scope / tenants / data_categories`、`timeline / planned_vs_actual / authorization_refs`、`containment / closure / notification / legal_hold states`、`A_R_C_I roles / conflicts / escalations / deadlines`、`evidence_refs / gaps / unknown_scope / findings`、`remediation / residual_risk / risk_acceptor`、`action_items / owners / due_targets / verification`、`independent_reviewer / decision / version / audit_refs`。

### 9.3 状态与枚举

- **风险分级 R0–R3（第 3 轮 §1 行 425–434；子议题 1 §阶段3 行 720）**：`R0 只读、可逆、低影响`；`R1 受限工作区变更`；`R2 受控资源变更`；`R3 高影响或不可逆操作`。判定输出还可以是 `review/blocked`（"任何源 ACL、用途、敏感性、范围、revision、环境、回滚或影响闭包未知时，最低为 `review/blocked`，不得默认 R0"）。
- **权限状态（第 1 轮 §8，行 226–236）**：`requested`、`approved`、`active`、`suspended`、`expired`、`revoked`、`denied`。
- **授权决策（第 1 轮 §3，行 112）**：`allow | deny | isolate | needs_review`。
- **审批状态（第 3 轮 §6，行 570）**：`requested / under_review / approved / rejected / expired / revoked / superseded`。
- **执行状态（第 3 轮 §6，行 571）**：`queued / gated / running / partially_executed / succeeded / failed / rolled_back / cancelled / blocked`。
- **审批生命周期附加取值（子议题 2，行 872–876）**：`eligibility_resolved`、`approval_plan_versioned`、`pending_level_1 … pending_level_n`、`escalated`、`RunGate_recheck`、`verification`、`post_review`。
- **Break-Glass 失败状态（子议题 3 §阶段3，行 1044–1056）**：`identity_unverified`、`incident_unverified`、`scope_ambiguous`、`credential_service_unavailable`、`policy_or_audit_unavailable`、`expired`、`revoked`、`actual_action_mismatch`、`post_review_pending`。"这些状态都不能自动降级为允许；`policy_or_audit_unavailable` 对高风险路径是 fail-closed。"
- **审计生命周期（子议题 4 §阶段3，行 1200–1205）**：`captured → integrity_checked → retained → accessed/audited → hold_or_due → deletion_pending → deleted | retain_minimal | failed | unknown`。"`deleted` 只表示声明范围和方法的删除验证通过"；备份、第三方副本或加密擦除无法证明时保留 `unknown/external_unknown`。
- **Tool Call / Attempt 状态（子议题 5 §阶段1，行 1277–1284）**：`queued / approval_pending`、`started / streaming`、`side_effect_committed`、`completed / failed / timed_out`、`cancel_requested / cancel_acknowledged`、`unknown_outcome / compensation_pending`；撤回时另有 `revocation_unknown`（行 1337）。
- **Tool Call 处置矩阵（子议题 5 §阶段3，行 1354–1362）**：未开始/排队→阻断并失效计划/审批；等待审批→撤销 pending、重新评估；只读在途→可停止或安全边界完成；可逆写入→取消/回滚/补偿（能力已验证）；不可逆副作用已提交→停止后续调用、对账；结果未知→冻结重复动作、外部对账；部分执行→盘点实际影响、局部补偿。
- **跨租户通知事实/法律枚举（子议题 6 §阶段1，行 1463–1470）**：`technical_fact_state: confirmed | probable | unknown | disproved`；`impact_scope: tenant / asset / consumer / time window`；`data_category: none | internal | personal | customer | credential | production`；`containment_state: blocked | partially_blocked | failed | unknown`；`legal_assessment: pending | not_applicable | applicable | disputed`；`notification_decision: notify | defer_with_reason | not_required_with_reason | escalate`。
- **通知状态机（子议题 6 §阶段3，行 1495–1510）**：`incident_detected → containment_started → authoritative_blocked | containment_failed | containment_unknown → impact_scoped → responsibility_mapped → legal_assessment_pending → N0/N1_notified → N2/N3_required | not_required_with_reason | deferred_with_escalation → notification_drafted → approved_for_recipient → dispatched → delivered | rejected | unknown → follow_up_due → closed_after_review`。
- **消费者传播状态（子议题 7 §阶段1，行 1628–1639）**：`active_version / required_source_version`、`last_applied_event / high_watermark`、`state: current | stale | pending | blocked | failed | unknown`、`proof: digest / acknowledgement / reconciliation_ref`。
- **传播状态机与失败分支（子议题 7 §阶段3，行 1664–1682）**：`revoke_committed → deny_path_active → impact_event_enqueued → traversing → consumer_update_pending → applied_and_verified → closure_verified → restore_review → restored | restricted | remains_blocked`；失败分支 `missing_event | out_of_order | duplicate | lease_expired | consumer_unavailable | version_conflict | dead_letter | reconciliation_failed | external_unknown`。
- **复核状态机（子议题 8 §阶段3，行 1850–1861）**：`review_triggered → owner_assigned → evidence_preserved → containment_and_scope_reviewed → responsibility_and_conflict_checked → impact_and_legal_assessment → independent_findings → remediation_and_residual_risk_decision → action_items_tracked → accepted_and_closed | escalated | overdue | reopened`。
- **冲突与未知状态处理表（第 2 轮 §6，行 382–393）**：明确硬拒绝与允许冲突→拒绝；上级禁止、下级允许→拒绝；资源 ACL 禁止、Project 允许→拒绝；来源 ACL 缺失→隔离；目的不明→拒绝；授权过期→拒绝；撤回状态不明→阻断；允许范围和委托范围冲突→取交集；高风险审批主体不明→待审核或拒绝；策略版本不一致→使用当前权威策略重新判断。"不能由最后写入策略、Owner 级别、模型置信度、历史成功率或关系数量自动解决硬冲突。"
- **事后复核 SLA 目标（子议题 8 §阶段1，行 1786–1792）**：`TTA`（确认/指派 Owner）、`TTC`（遏制/维持安全阻断）、`TTI`（影响与通知义务评估）、`TTR`（恢复/收窄/替代/补救）、`TTP`（完成独立事后复核）；"具体目标时长由真实 SLO、合同、法定时限和风险成本校准，不能在产品层伪造统一数字"。

### 9.4 角色与权限边界

- **主体职责边界表（第 1 轮 §5，行 149–159）**：User（读取被授权内容、提交反馈、发起请求｜不可绕过 Project/Team/安全策略）；Team Owner（管理 Team 范围资产、审核团队知识｜不可修改其他 Team 或全局策略）；Project Owner（管理 Project 范围资产、批准 Project 变化｜不可自动扩大跨 Project 权限）；Agent（按授权读取、生成候选、执行被允许动作｜不可自我授权、自审自批、修改 ACL）；Harness（使用被投影上下文、调用允许工具｜不可代替用户授予权限）；Governance Agent（检测、分类、生成候选、传播状态｜不可代替人类批准高风险变化）；Security/Privacy（审核敏感、跨边界和高风险事项｜不可无业务范围地任意修改内容）；Auditor（查看授权范围内审计记录｜不可修改业务资产或批准执行）；Platform Admin（管理平台配置和基础设施｜默认不可读取所有业务内容或代替业务 Owner）。
- **Harness / Agent 边界（第 1 轮 §6，行 161–174）**："Harness Capability 仅代表外部执行能力，不代表当前授权"；`当前主体权限 ∩ Harness Capability ∩ Project/Resource Policy ∩ Purpose Policy ∩ Tool Policy ∩ RunGate`。Agent 不能把记忆文本当作权限，不能通过自然语言改变 ACL，不能批准自己的高风险 Action Proposal，不能将候选直接变为 Published 或 Actionable。
- **关系/权限/能力三分（第 2 轮 §1，行 274–290）**：关系 `member_of / owns / participates_in / acts_for / delegates_to / references / affects`；权限 `can_read / can_retrieve / can_reference / can_project / can_write / can_review / can_publish / can_revoke / can_execute`；能力 `harness_can_read / harness_can_write_workspace / harness_can_modify_repository / harness_can_run_tests / harness_can_access_database / harness_can_deploy`；反例 `member_of Team ≠ can_read_all_team_memory`、`acts_for User ≠ can_execute_all_user_actions`、`harness_can_deploy ≠ current_run_can_deploy`。
- **高风险职责分离（第 1 轮 §7 行 196–205；第 3 轮 §1 行 423）**：至少区分 `proposer`、`approver`、`executor`、`verifier`；"默认禁止同一主体同时提议并审批、审批并执行或执行并完成最终验证"。高风险触发条件：不可逆、生产环境、客户数据、权限或身份变更、凭据使用、跨租户或跨 Project、数据库写入、部署或发布、安全策略修改、敏感资产恢复、可执行 Skill 发布、大范围知识撤回或高影响 RCA 关闭。
- **审批资格与替代（子议题 2 §阶段1，行 818–846）**：审批者资格检查主体身份与保证、动作/资源的角色权限、用途与范围、风险上限、与 proposer/executor 的独立性、当前有效性与委托链、利益冲突状态、必要的培训或认证。四类替代：`Named substitute`、`On-call delegate`、`Break-Glass approver`、`Quorum fallback`；"任何 fallback 都不能把 R3 降成 R1、把双人要求变成自批，也不能批准比委托者更广的范围"。
- **替代矩阵（子议题 2 §阶段3，行 883–889）**：R0 审批人短暂不可达→记录或按预授权替代；R1 Owner 假期→指定同职责代理；R2 变更审批缺席→轮值合资格审批或升级；R3 高影响/不可逆→专门治理或法定代理；Incident Break-Glass→最小止损审批。
- **事后复核责任链（子议题 8 §阶段1，行 1809–1818）**：权威阻断（A=Incident/权限责任人）、影响分析（A=事件责任人或目标 Owner）、复原/收窄/替代（A=资源/业务 Owner）、法律/通知决定（A=法务/隐私责任人）、独立事后复核（A=独立 Review Owner）、改进项关闭（A=改进责任 Owner）；"`A` 不能仅由 Agent 或执行者自动承担"。
- **Break-Glass 职责（子议题 3 §阶段1，行 978）**：Break-Glass 审批者、执行者和验证者仍应分离；同一主体只能在明确预授权的最小止损模型中兼任部分角色，并强制事后独立复核。

### 9.5 关键规则与不变量

- 默认拒绝与 fail-closed：无明确授权、作用域不明、用途不明、来源 ACL 缺失、敏感性未知、审批主体不明或撤回状态不明时，**不使用模型置信度、历史成功率、同 Project 关系或 Harness 能力绕过门禁**（第 1 轮 §4，行 145）。高风险策略或审计系统不可用默认阻断（第 3 轮 §3，行 494）。
- 授权/执行分离与动作不等价：`read ≠ use`、`use ≠ write`、`write ≠ publish`、`publish ≠ execute`、`execute ≠ approve`（第 1 轮 §2）。
- 不静默改写历史：历史 Run 保留原授权上下文与审计，不被静默改写（第 1 轮 §8 行 249；第 3 轮 §5 行 561；第 2 轮 §5 行 378）。
- 委托子集与禁止无限再委托（第 2 轮 §4，行 345–364）。
- 硬拒绝优先、下游只能收紧（第 2 轮 §3，行 324）。
- 反例约束（子议题 1，行 753–762）：`role=owner ≠ low-risk action`、`read-only ≠ low-risk data`、`small tool call ≠ small blast radius`、`approval exists ≠ current plan valid`、`masked export ≠ no cross-tenant risk`、`break-glass ≠ ordinary authorization`、`successful execution ≠ safe/approved action`、`unknown impact ≠ R0`。
- 反例约束（子议题 2，行 904–913）：`more approvers ≠ independent approval`、`role membership ≠ current approval authority`、`federated identity ≠ action authorization`、`absence/timeout ≠ consent`、`substitute ≠ full original privilege`、`on-call ≠ unlimited delegation`、`break-glass approver ≠ permanent approver`、`prior approval ≠ current plan validity`。
- 反例约束（子议题 3，行 1071–1080）：`incident declared ≠ emergency authority proven`、`identity authenticated ≠ action authorized`、`break-glass token ≠ permanent privilege`、`KMS unavailable ≠ use default secret`、`short-lived ≠ harmless`、`post-review ≠ prior approval`、`emergency operator ≠ free cross-tenant access`、`emergency success ≠ safe/fully authorized`。
- 反例约束（子议题 4，行 1221–1228）：`hash ≠ author proof`、`signature ≠ content truth`、`WORM ≠ correct collection`、`encrypted ≠ least privilege`、`retained ≠ retrievable`、`expired ≠ all copies deleted`、`log received ≠ durably stored`、`append-only ≠ immutable external world`。
- 反例约束（子议题 5，行 1377–1386）：`cancel requested ≠ side effect stopped`、`permission revoked ≠ external token erased`、`run paused ≠ all tools paused`、`rollback requested ≠ rollback succeeded`、`partial execution ≠ complete success`、`unknown result ≠ safe to retry`、`old approval ≠ current authorization`、`compensation ≠ free/no-risk action`。
- 反例约束（子议题 6，行 1542–1551）：`containment complete ≠ notification complete`、`sent ≠ delivered`、`no evidence found ≠ no impact`、`platform operator ≠ legal controller by default`、`one jurisdiction deadline ≠ global deadline`、`cross-tenant incident ≠ disclose all tenant details`、`legal review pending ≠ delay containment`、`notification failure ≠ notification satisfied`。
- 反例约束（子议题 7，行 1714–1722）：`queue empty ≠ closure complete`、`at-least-once ≠ duplicate-safe by itself`、`cache invalidated ≠ index invalidated`、`local success ≠ global success`、`version observed ≠ content fully reconciled`、`retry timeout ≠ safe to restore`、`unknown consumer ≠ unaffected consumer`。
- 反例约束（子议题 8，行 1892–1901）：`service_recovered ≠ governance_closed`、`postmortem_completed ≠ unauthorized_action_approved`、`no_blame ≠ no accountability`、`SLA elapsed ≠ obligation satisfied`、`owner assigned ≠ work verified`、`notification sent ≠ impact closed`、`queue drained ≠ all evidence reconciled`、`risk accepted ≠ risk removed`。
- 自动化能力边界：自动化可做属性解析、硬触发器匹配、组合风险计算、影响预览、阻断、RunGate/ToolPolicy 核对、审计记录；**不能**自动把 R2/R3 降级、选择法律/组织阈值、批准生产/权限/凭据/跨租户/不可逆动作（子议题 1，行 766）；不能自动改变法务保留、删除高敏原文、在审计不可用时放行高风险动作（子议题 4，行 1233）；不能自动认定法定责任或把发送当作送达（子议题 6，行 1555）；不能让执行者自审、把超时当完成、追认未授权动作（子议题 8，行 1905）。
- 失效与升级条件（子议题 1 §阶段3，行 738）：资源、参数、revision、环境、主体/委托、用途、敏感性、范围、风险、回滚方案、来源/血缘状态或实际影响发生关键变化时，审批/RunGate 自动失效并重新分类；执行中发现计划外差异、影响扩大、权限撤回、审计不可用或安全异常时立即暂停/阻断并进入事后治理。

### 9.6 界面/交互线索

- "UI 展示动作风险、阻断原因和下一门槛；底层保留可审计细分"（子议题 1 §阶段4，行 748）。
- "展示逐 Tool Call 状态、实际影响、缺口和下一门槛，不把 Run 简化成单一成功"（子议题 5 §阶段4，行 1372）。
- "展示根事件、受影响范围、当前门禁、缺口、责任人和下一次重试，不虚构完成"（子议题 7 §阶段4，行 1709）。
- "展示各闭环状态、未决缺口、残余风险、下一动作和责任人，不用单一'已完成'"（子议题 8 §阶段4，行 1886）。
- "消费者按当前权限获得最小投影"；内部包络可含更丰富字段（子议题 4 §阶段3，行 1195）。
- 通知内容的最小必要字段：事件标识、发生/发现时间、受影响租户或服务范围、已确认与未知事实、阻断和缓解状态、对方需要采取的动作、下一次更新承诺、联系人和安全传输方式（子议题 6 §阶段1，行 1457）。
- 通知失败时"继续阻断和保存证据，升级到备用责任人/法务/合规"（子议题 6 §阶段1，行 1478）。
- 影响闭包降级时"向操作者显示覆盖率、缺口和预计下一步"（子议题 7 §阶段1，行 1647）。

### 9.7 仍暂缓未定的内容

第 1 轮暂缓表（行 598–609）：R0–R3 的完整操作分类目录和阈值；多级审批、审批替代和组织假期代理；Break-Glass 的完整身份、密钥和技术实现；审计记录的保留期限、加密和不可抵赖格式；权限撤回对已运行 Run 的逐工具处置策略；紧急撤回的跨租户通知和法律合规流程；自动影响闭包的性能和一致性协议；事后复核的完整 SLA、升级和责任矩阵。（这 8 项后续各自以"子议题深化 N"推进，但每轮仍留下新的暂缓项。）

各子议题深化后**仍然暂缓**的内容：

- 子议题 1（行 774–780）：各企业资源/动作的最终分类目录、数值阈值和例外；多级审批/替代/值班代理/跨组织责任；R3 Break-Glass 身份、密钥、自动止损和事后复核实现；风险评分、blast radius 和影响估计算法；各工具/Connector 的能力、幂等和回滚映射。
- 子议题 2（行 925–931）：企业最终审批级别、法定人数、角色和替代目录；身份联合、代理 token、委托和撤回的技术实现；审批 SLA、值班轮换、升级和假期日历集成；R3/Break-Glass 的应急审批和事后复核细则；跨组织/跨租户双边审批与通知。
- 子议题 3（行 1092–1098）：企业 IAM/联邦、设备/工作负载证明和应急身份实现；KMS/HSM、密钥轮换、短期 Token 和防重放实现；KMS/IAM/审计故障下的本地止损能力；不同工具的暂停/取消/回滚和凭据隔离；应急责任、法务通知、事后 SLA 和违规处置。
- 子议题 4（行 1241–1247）：各事件/行业/租户的具体保留期限和合规表；签名、时间戳、WORM、不可抵赖格式和验证服务实现；审计加密、字段级密钥、轮换/撤销和历史验证实现；备份、灾备、离线和第三方副本清理协议；审计故障下本地缓冲、补传、容量和恢复 SLA。
- 子议题 5（行 1398–1404）：各工具 Capability Profile、取消/回滚/补偿协议和幂等语义；数据库、消息、部署、外部 API 的逐类处置矩阵；旧 Token/租约撤销在外部系统的传播与 SLA；运行中 Run 的人工接管、责任和事故升级；结果未知的自动对账、补偿和恢复实现。
- 子议题 6（行 1563–1570）：各法域、客户合同和数据类别的最终通知时限/模板；跨租户责任矩阵、联系人目录和备用渠道；监管、执法和数据主体通知的具体审批与签署；多语言通知、跨境传输和翻译保真流程；通知送达证明、不可抵赖和长期保留实现；影响未知时的分阶段披露和客户补偿规则。
- 子议题 7（行 1734–1741）：事件总线、图存储、索引和缓存的具体技术选型；各租户/风险等级的延迟、吞吐、并发和重试阈值；血缘图分片、增量闭包和热点治理算法；外部系统版本/确认接口和跨组织撤回协议；exactly-once、事务跨系统协调和灾备恢复实现；闭包证据长期保留、审计成本和运营 SLA。
- 子议题 8（行 1913–1920）：各风险等级和租户的具体 SLA 数字、服务目标和违约处理；企业最终 A/R/C/I 角色、值班表和升级链；法定通知、保全、调查和客户补偿的最终责任；复核证据的长期保留、访问和删除规则；改进项预算、跨团队交付和关闭验收制度；复核平台、计时器、升级和通知集成实现。
- 议题级（行 613）："完整策略矩阵、组织继承细节、跨租户身份、审批 SLA 和具体实现协议等暂缓事项留待以后讨论，不视为所有实现细节已经固化。"
- 文档未明确：产品界面形态（页面、组件、导航结构）、面向终端用户的措辞规范、以及以上暂缓项的默认取值。

---

## 议题 10：跨空间复用与脱敏

### 10.1 已确认结论清单

#### 基础三轮确认（第 1–3 轮）

1. **第 1 轮确认（行 13）**：跨空间复用采用"受控引用或受控派生，而非原文复制"的模型；跨空间操作至少区分 `reference`、`project`、`derive`、`promote`、`export`、`share`、`replicate`、`aggregate`，并按风险分为 S0–S3；派生资产是"具有独立版本、Owner、用途、目标范围、`applies_to`/`does_not_apply_to`、敏感性、血缘、发布状态和消费者状态的独立对象"；权限取九项交集，目标范围不得扩大；脱敏采用"识别—处理—验证"三阶段；"目标接收不等于发布，发布不等于可检索，发布也不等于可执行"；"跨空间可执行 Skill 默认不得自动形成"。
2. **第 2 轮确认（行 226）**：跨空间派生和发布采用 **Source Owner + Target Owner 的双边责任模型**，分离 Derivation Operator、Privacy/Security Reviewer、Publication Owner、Consumer Owner 和 Revoke Authority；"跨空间资产没有明确 Target Owner 时只能保留候选，不得正式发布；源 Owner 不能替代目标 Owner，目标 Owner 不能解除源 ACL，Security/Privacy 的阻断优先于业务允许"；撤回与物理删除分离；恢复必须重新验证当前授权、脱敏、适用性和责任。
3. **第 3 轮确认（行 382）**："脱敏结果不能由单一 `sanitized = true` 表示"，至少分别验证显式秘密、敏感数据、组合重识别、语义保真和执行安全；"生成脱敏结果的 Agent 不能独立完成最终验证或批准"；组合重识别必须考虑目标空间已有资产、Context Manifest、Embedding、Index、Cache、Run History、时间窗口和同一事件/客户关联；跨空间资产默认 `referenceable` 或受限 `retrievable`，`action_status` 默认 `blocked`。

#### 十八个阶段性讨论节点（第 4–21 轮）

4. **第 4 轮（行 581）—脱敏与重识别的算法、阈值与证明**：不采用全局"脱敏通过分数"或脱离用途的重识别阈值；建立"风险证据与发布契约"，对显式秘密、敏感数据、组合重识别、语义保真、执行安全**分别评估**；评估绑定源/目标空间、Purpose、消费者、可见上下文闭包、外部辅助资料、攻击者能力、时间窗口和处理策略版本；"假名化、遮盖、哈希、加密、合成和 DLP 命中均不单独构成匿名或安全证明"；未知/证据不足/硬失败/变化未复核时默认 `isolate / block / needs_review`。
5. **第 5 轮（行 676）—Embedding 空间隐私**："Embedding 及其 Index、Cache、Manifest、导出和备份不默认等于已脱敏或低敏感数据"；建立模型/向量库无关的 Embedding 隐私风险证据与发布契约，分别记录反演、成员资格、属性推断、跨索引关联、缓存/导出暴露、访问控制和语义保真状态；扰动、加密、降维、量化、DP 或向量库控制只能在明确用途和实测证据下作为候选；"认证、哈希、抽象表示或单一分数不能替代隐私评估"。
6. **第 6 轮（行 762）—差分隐私、匿名化和形式化保证**："平台不建立全局'已匿名'结论，也不把差分隐私作为平台级总开关"；DP 仅作为明确统计用途下的候选形式化机制；匿名化/去标识化是绑定场景、接收者、辅助资料和攻击模型的风险判断；假名化是仍需受控治理的可识别数据处理；产品不得把 `epsilon`、DP 通过、哈希、伪名、受控访问或单一风险分数展示成"整个资产/平台已匿名"；按用途分流而非统一算法。
7. **第 7 轮（行 869）—跨空间 Tool Policy 与 RunGate**：执行采用"知识可用性 → Action Proposal → 当前准入 → 受约束 Run → 效果验证"分层模型；"Tool Policy 描述能力与硬约束，RunGate 作一次性及持续准入判断，不能放宽 Tool Policy"；"发布或检索不授予执行权"；只有身份、源/目标 ACL、用途、目标范围、脱敏/血缘、revision/environment、前置条件、Tool Policy、审批、幂等/回滚和验证计划全部满足才生成受控 Action Proposal；新动作或有副作用动作必须重算 RunGate；概念层包括 Action Proposal（默认不可执行）、Tool Policy（能力声明不是当前批准）、RunGate（必要时每个 Tool Call/Attempt 前重检）、Approval（"不得执行者自批"）、Run Plan/Execution、Verification/External Effect。
8. **第 8 轮（行 983）—组合重识别的全量图分析与查询限制**：采用"版本化 Visibility Context → 前置权限/用途/敏感/撤回过滤 → Q0–Q3 风险分类 → 最小投影/抑制/抽象/异步/阻断 → 深度、范围、限频和组合查询治理 → 结果完整性与侧信道复核"模型；"全量闭包只作为受控内部分析任务，不作为普通用户的全量关系图"；Q0 授权低敏直接关系、Q1 分桶/区间/泛化摘要、Q2 敏感或跨边界查询需审批/预算/审计/专门投影、Q3 高敏存在性或个体推断默认拒绝或统一阻断。
9. **第 9 轮（行 1084）—历史缓存/备份/离线导出/第三方副本的统一清理证明**：采用"Copy Inventory → 传播阻断 → 清理计划与责任绑定 → 分层执行 → 独立验证 → 证据化声明"模型；清理状态按副本和证据分别表达（`not_scoped`、`planned`、`requested`、`blocked`、`executed`、`verified`、`partial`、`unknown`、`retained`、`expired` 等**作为候选状态但不冻结最终枚举**）；"法律保全/法定或合同保留是受责任人约束的例外，不等于可继续服务或对外披露"；无法证明的副本默认不纳入"已全量清理"声明。
10. **第 10 轮（行 1185）—Copy Inventory 的 Schema、覆盖率与一致性**：采用"逻辑副本身份 + 来源/版本 + 控制与责任边界 + 用途/分类 + 生命周期状态 + 发现观测 + 处置任务 + 验证证据 + 覆盖盲区"的版本化语义契约；"Inventory 快照是清理证明的范围基线；每个观测、处置和验证都保留自己的时间/版本和来源"；"覆盖率以分层分母、扫描窗口、证据等级和盲区报告，不以单一百分比代表全量"；冲突、过期、未接入、权限不足、恢复竞态和第三方不一致默认保守升级。
11. **第 11 轮（行 1287）—删除/擦除算法、验证等级、抽样率与清理 SLA**：采用"风险/副本分类 → 必要处置能力 → 证据等级 → 分层验证 → 分阶段 SLA → 失败/超时升级"模型；"E0–E4 仅作为阶段性证据语言：不得跨副本继承，不得把访问阻断或逻辑删除冒充擦除，不得把抽样/Provider 回执自动升级为全量证明"；"SLA 拆分为阻断、执行、验证和最终处置窗口；超时保持阻断并转为未知/过期/升级"；"不可变保留、法律保全和密钥生命周期是独立门禁"。
12. **第 12 轮（行 1384）—备份/灾备/恢复介质、不可变保留与法律保全**：采用"服务阻断轨道 + 备份生命周期轨道 + 法律保全轨道 + 恢复重建轨道"四轨契约；"不可变保留只能由专门授权流程改变，普通删除不能绕过；保全或外部状态未知时报告 `retained`/`unknown`，不报告全量清理"；"保留不等于可继续检索或执行"。
13. **第 13 轮（行 1457–1476）—第三方 Provider/再处理者的证明、合同、审计权与违约处置**：责任链为"平台/客户责任主体 → 主 Provider → 再处理者 → 存储/备份/日志/支持服务"，"不同责任不能被'Provider 已删除'一句话合并"；"合同和认证可支持治理，但不自动证明本次副本状态"；审计手段含标准化证据包、独立报告/认证、抽样或全量对账、远程查询、日志/工单、事件响应审计、专项第三方评估、现场审计，按风险/影响/不一致/事件提高强度；供应商拒绝或证据不足时"应收窄交付、停止高敏复用/再导出、标记 `unknown`、启动合同补救或转责任人"；"平台不能自行宣布法律违约或对外作监管结论"。
14. **第 14 轮（行 1535–1564）—离线导出、下载、再分享与终端副本**："不承诺对未纳管终端或外部接收者实现全量发现/强制删除"；导出链覆盖导出计划、生成版本、预览/临时文件、传输、下载令牌、浏览器/客户端缓存、终端文件系统、同步盘、邮件/聊天附件、打印/截图、再分享链接、协作空间、外部接收者和再处理者；"未知终端不能当作没有副本"；"密码学保护、动态水印、DLP、MDM、DRM 和终端擦除各自解决不同问题，不能互相替代"；非受管/外部用 `requested`、`not_confirmed`、`external_unknown` 且"禁止升级为 verified"。
15. **第 15 轮（行 1636–1653）—恢复/重建后的自动清理闭包、幂等与并发**：恢复场景（备份恢复、灾备切换、索引/Embedding 重建、Cache 回填、Manifest 重生成、Provider 重试、跨区域复制、迁移导入、恢复演练）"都可能重新生成已撤回或已清理内容，不能继承旧证明而不重检"；清理任务六步为"范围快照、传播闸门、处置动作、验证、对账、关闭"，每步绑定 `source_revision`、inventory snapshot、policy version、purpose、scope、idempotency key、attempt、deadline、stop condition 和证据引用；"旧任务不能覆盖新 revision 状态"；"未知结果不得自动重试不可逆动作"。
16. **第 16 轮（行 1713–1744）—跨空间清理报告的发布、客户通知与监管声明**：报告围绕"一个版本化事件/清理快照"；受众分为平台操作人员、客户/数据主体、供应商、监管/执法；"内部全量血缘、其他租户信息、秘密、凭据和不必要的第三方数据不能因'透明'被外发"；"报告发布不是删除授权，客户通知不是监管结论，监管声明也不能反向替平台证明所有副本已清理"；新证据/回执/恢复/范围变化生成新版本并标记旧版本过期修订；"失败不等于送达"。
17. **第 17 轮（行 1809–1823）—报告 Schema、模板与字段级投影**：报告分**不可变事实内核与受众投影**；事实内核含事件/请求 ID、源/目标空间、资产/revision、inventory snapshot、时间线、动作、证据、范围、未知、保留、责任链和版本；字段分类五类：必须披露、条件披露、仅内部、禁止外发、由法务批准；"`verified_scope` 不等于全局 verified；`unknown`、`retained`、`not_scoped` 和 `external_copy` 必须保持语义，不得在模板渲染时被省略"；"字段披露、脱敏、未知和禁止外发规则在渲染前执行，不能靠模板文字补救"。
18. **第 18 轮（行 1872–1893）—通知/监管评估的触发、时钟、审批与责任**：触发候选 9 项（高敏副本未知、跨租户外泄、外部 Provider 违约、撤回失败、恢复后重新出现、凭据/访问泄露、不可逆传播、通知投递失败、影响范围扩大）；"触发事件只启动评估，不自动等于法定数据泄露或必须通知"；事件时钟 11 节点（发现、确认、遏制、范围初判、责任人接管、法务评估、客户决定、监管决定、通知发送、后续更新、关闭复核）；"平台记录时间线和剩余窗口，但不自动把某个示例小时数当作法定期限"；"执行者不能自批高影响外发"；"'无法判断是否需通知'本身是需要升级的状态"。
19. **第 19 轮（行 1948–1967）—多渠道投递、签收、重试、撤回与版本控制**：投递生命周期 11 节点（报告版本生成、批准、排队、发送尝试、渠道接受、传输完成、接收端确认、阅读/下载、撤回请求、撤回执行、修订发布）；"渠道接受不等于人已接收，接收不等于已阅读，阅读不等于已理解或已采取行动"；渠道 6 类（平台内通知、受控链接、邮件、Webhook/API、工单系统、供应商门户），"高敏报告默认优先平台内受控交付"；"一个报告通过多个渠道投递时要有共享 delivery intent 和各渠道独立 attempt，不能把一个渠道成功冒充全局送达"；"新事实不能静默改写已发送报告"。
20. **第 20 轮（行 2022–2039）—跨租户、跨境与数据主体通知**："一个租户的通知不能泄露其他租户名称、数量、关系、资产、攻击路径或副本存在性"；跨境需记录发送方/接收方区域、传输依据、渠道、数据类别、加密和最小必要范围；"法律状态词、未知/保留/局部验证、时间、范围和行动要求必须保持语义等价；机器翻译输出需要人工/责任人复核"；"假名化、分桶、泛化、抑制、删除和加密的目的不同，不能把'隐藏名称'误称为匿名化"；契约顺序为"接收者/用途/法域识别 → 最小事实投影 → 字段级脱敏/抑制 → 语义保持的翻译与审校 → 传输/接收者门禁 → 版本化发布和审计"。
21. **第 21 轮（行 2092–2109）—外部未知、供应商违约与恢复后新影响**："不自动认定供应商法律违约"；触发 9 类（外部副本无法确认、Provider 回执与 Inventory 冲突、再处理者未披露、删除/撤回失败、备份恢复带回已撤回内容、灾备切换产生新投影、证据过期、审计拒绝、客户投诉）；"'未知'本身不等于泄露，但在高风险场景应作为暴露可能性处理"；五条并行轨道（立即阻断/收窄、副本与影响范围调查、Provider/客户/法务责任评估、版本化事实报告和必要通知、补救与验证复盘）；"报告不能替代阻断，合同补救不能替代安全处置，恢复后的新副本不能继承旧的'已清理'标签"；"外部未知不被伪造为已清除，也不自动定性为供应商违约"。

### 10.2 核心对象与关系

**派生资产与统一派生声明（第 1 轮 §4，行 62–85）**

- 字段：`source_object_id / version`、`source_scope`、`target_scope`、`derivation_type`、`purpose`、`redaction_policy_version`、`abstraction_policy_version`、`sensitivity_before`、`sensitivity_after`、`lineage_refs`、`allowed_consumers`、`applies_to`、`does_not_apply_to`、`review_state`、`publication_state`、`reference_status`、`retrieval_status`、`action_status`。
- 适用范围字段（第 1 轮 §7，行 174–183）：`applies_to`、`does_not_apply_to`、`required_conditions`、`known_exceptions`、`source_revision_range`、`environment`、`dependency_range`、`verification_state`；"派生资产是具有独立版本、状态和限制的对象，不是源资产副本"。

**Transformation Report（源—派生差异，第 3 轮 §2 行 411–427；第 4 轮 行 587）**

`retained_elements`、`removed_elements`、`generalized_elements`、`replaced_elements`、`added_constraints`、`lost_uncertainties`、`changed_scope`、`removed_execution_semantics`、`source_refs`、`policy_versions`、`validation_results`；"报告自身也执行权限、敏感性、用途和版本检查"。

**Copy Inventory（第 9 轮 §1 行 1066–1068；第 10 轮 §阶段3 行 1189–1195）**

- 每对象至少记录来源、版本、Owner/责任方、位置/边界、用途、敏感性、访问状态、保留依据、最近确认时间和证据引用。
- 副本类别：源资产及 revision、热缓存、检索索引、Embedding、Context Manifest、工作目录/临时文件、离线导出、下载和再分享文件、快照、备份、灾备/异地副本、恢复介质、日志/审计投影、第三方 Provider 处理副本及再处理者。
- 概念字段六组（"不是最终 Schema"）：`copy_identity/source_revision/derivation`；`boundary/owner/controller/provider/recipient`；`purpose/classification/retention_hold`；`lifecycle/access/disposition`；`observation/coverage/freshness`；`conflict/recovery/revision`；`proof_snapshot/claim_scope`。
- 一致性要素：来源 revision、inventory snapshot、provider observation、deletion task、verification evidence 各自带时间/版本。
- "Inventory 快照是清理证明的范围基线"；"Inventory 按主体/Purpose 最小投影；内部全量不等于普通用户可见"。

**证据等级 E0–E4（第 11 轮 §阶段1，行 1263–1267）**

- `E0` 未确认（范围/能力/对象身份不足，默认不可声明完成）；`E1` 传播/访问已阻断（新检索、投影、下载和执行被阻断，但内容可能仍存在）；`E2` 逻辑处置已执行（可控系统完成删除、失效、密钥/链接撤销或到期动作，留有回执）；`E3` 范围内验证（独立清单、版本检查、抽样/全量扫描、恢复验证或等价证据确认指定范围）；`E4` 受控介质/责任方证明（对适用介质或第三方取得满足责任边界的证明，仍须标明覆盖范围、限制和时间点）。
- 副本分类：在线可控对象、版本化存储、缓存/索引/Embedding、备份/灾备、离线导出、第三方副本、不可变/法律保全介质。动作集合：阻断、删除、失效、重建、密钥处置、介质清理、第三方请求、到期清理或仅能记录未知。

**四轨契约（第 12 轮 §阶段3，行 1366–1369）**

- 服务轨道：立即阻断检索、投影、导出和执行，不因备份仍存在而继续可用。
- 生命周期轨道：按业务/合规保留计划自然到期，或有授权时处置。
- 保全轨道：法律保全/法定留存冻结指定范围和版本，必须有责任人、依据、范围和解除条件。
- 恢复轨道：恢复前检查撤回/保全状态，恢复后生成新 inventory、重新执行传播阻断和验证。

**Export Asset（第 14 轮，行 1551、1568）**

字段：源 revision、脱敏/血缘状态、目的、接收者、允许动作、有效期、风险、审批、撤回方式、证据要求、范围、责任人、撤回状态。终端类别：受管/非受管/外部接收者。控制手段：密码学保护、动态水印、DLP、MDM、DRM、远程擦除、密钥撤销、应用失效、设备隔离。

**Provider 责任图与证明包（第 13 轮，行 1457–1459）**

- 责任链："平台/客户责任主体 → 主 Provider → 再处理者 → 存储/备份/日志/支持服务"，每层标明数据类别/用途/区域/访问/保留/删除能力。
- 证明层：能力与流程声明、针对范围的请求、收到/接受时间、执行回执、对象/版本清单、验证方法和结果、异常/未知、再处理者覆盖、证据有效期；"合同和认证可支持治理，但不自动证明本次副本状态"。
- 证明绑定：Copy Inventory 快照、来源 revision、目标副本/范围、时间、Provider 签发主体、签名/完整性引用、验证等级和排除项。
- 内部全量证据与外部摘要分离。

**跨空间查询模型对象（第 8 轮，行 987–992）**

`Visibility Context`（主体/委托链、Purpose、源/目标空间、动作、敏感性、ACL/策略、撤回状态、revision/environment、有效期、策略版本）、`Risk Graph Closure`、`Query Risk Q0–Q3`、`Output Integrity`、`Query Controls`、`Emergency Boundary`。

**跨空间执行对象（第 7 轮，行 873–880）**

`Action Proposal`（目标、来源资产、建议动作、参数摘要、影响预览、前置条件、预期效果、不适用范围）、`Tool Policy`、`RunGate`、`Approval`、`Run Plan/Execution`（一次性执行资格、幂等键、资源版本、停止条件、补偿/回滚策略、审计引用）、`Verification/External Effect`。最小权限交集：`当前主体权限 ∩ 源 ACL/策略 ∩ 目标 ACL/策略 ∩ Purpose Policy ∩ 敏感/脱敏状态 ∩ 血缘/发布状态 ∩ 当前 Harness/Connector 能力 ∩ Tool Policy ∩ 当前 RunGate/Approval`。

**报告事实内核与受众投影（第 17 轮，行 1809–1811）**

- 事实内核：事件/请求 ID、源/目标空间、资产/revision、inventory snapshot、时间线、动作、证据、范围、未知、保留、责任链和版本。
- 元数据：生成者、生成时间、依据版本、证据新鲜度、有效期、修订号、撤回状态、接收者、允许用途。
- 字段分类五类：必须披露、条件披露、仅内部、禁止外发、由法务批准。

**Delivery Intent / Attempt / Receipt / Revision（第 19 轮，行 1950、1967）**

每次投递绑定报告快照、接收者、Purpose、渠道、有效期和允许动作；"一个报告通过多个渠道投递时要有共享 delivery intent 和各渠道独立 attempt"；保留 `supersedes`/`revokes` 关系、旧版本有效性、接收者、用途和证据。

**通知触发、时钟与责任矩阵（第 18 轮，行 1876–1880）**

- 触发候选 9 项（见 10.1 第 18 条）。
- 事件时钟 11 节点：发现、确认、遏制、范围初判、责任人接管、法务评估、客户决定、监管决定、通知发送、后续更新、关闭复核。
- 责任矩阵 10 项角色：发现/值班、技术遏制、数据/资产 Owner、客户责任主体、隐私/法务、供应商管理、通信、监管联络、审批、事后复核。

### 10.3 状态与枚举

- **跨空间操作类型（第 1 轮 §1，行 19–28）**：`reference`、`project`、`derive`、`promote`、`export`、`share`、`replicate`、`aggregate`。
- **S0–S3 风险分级（第 1 轮 §3，行 46–58）**：`S0 受控引用`、`S1 脱敏派生候选`、`S2 目标空间发布资产`、`S3 跨空间可执行资产`（"默认不自动形成"）。
- **发布状态机（第 2 轮 §3，行 274–289）**：`draft → source_review → redaction_pending → redaction_verified → target_intake → target_review → security_review → approved → published → restricted → suspended → revoked → superseded → archived`；消费者状态独立记录 `reference_status`、`retrieval_status`、`action_status`。
- **撤回触发枚举（第 2 轮 §4，行 305–317）**：`source_revoked`、`source_permission_changed`、`source_revision_invalidated`、`redaction_failure`、`reidentification_risk`、`target_policy_changed`、`consumer_misuse`、`security_incident`、`owner_request`、`superseded`、`verification_failure`。
- **五类验证状态字段（第 3 轮 §1，行 388–405）**：`explicit_secret_state`、`sensitive_data_state`、`reidentification_state`、`semantic_fidelity_state`、`execution_safety_state`；每项取值 `unknown / pending / passed / failed / partially_passed / needs_review`；"高风险消费要求所有必要状态通过或经明确人工接受，不能由单一总分抵消某个硬失败"。
- **分级验证 L0–L3（第 3 轮 §3，行 432–443）**：`L0 规则扫描`、`L1 结构与血缘检查`、`L2 组合重识别检查`、`L3 人工或受控审核`。
- **跨空间默认消费者状态（第 3 轮 §5，行 468–470）**：`reference_status = available`、`retrieval_status = restricted`、`action_status = blocked`。
- **Embedding 隐私分面状态（第 5 轮，行 678）**：`embedding_inversion_state`、`membership_inference_state`、`attribute_inference_state`、`cross_index_linkage_state`、`cache_export_state`、`access_control_state`、`semantic_fidelity_state`；取值沿用 `unknown / pending / passed / failed / partially_passed / needs_review`。
- **跨空间执行相关状态（第 7 轮，行 858、886）**：`action_status = blocked`；`unknown`、`revalidation_required`、`revocation_unknown` 不得视为成功；候选执行路径（只读引用、受限检索、Action Proposal、人工审批后的单次 Run、预授权低风险幂等 Run、受控 Break-Glass、完全禁止的高风险跨租户动作）；UI 聚合态"可参考/可检索/待审批/可执行/已阻断"。
- **查询风险分级 Q0–Q3（第 8 轮，行 989）**：`Q0` 授权低敏直接关系；`Q1` 分桶/区间/泛化摘要；`Q2` 敏感或跨边界查询需审批、预算、审计和专门投影；`Q3` 高敏存在性或个体推断默认拒绝/统一阻断。
- **完整性状态（第 8 轮，行 944、990）**：`complete/partial/unknown/stale/failed/cancelled`。
- **副本处置状态（第 9 轮，行 1084）**：`not_scoped`、`planned`、`requested`、`blocked`、`executed`、`verified`、`partial`、`unknown`、`retained`、`expired`（**候选状态，文档明确"不冻结最终枚举"**）。
- **Claim Boundary 分类（第 9 轮，行 1092）**："在线可控范围已验证"、"备份待生命周期到期"、"第三方已回执但未独立验证"、"离线/外部副本未知"、"依法保留"。
- **证据等级与处置语义（第 11 轮，行 1263–1294）**：`E0`–`E4`（见 10.2）；候选语义 `access_blocked`、`logical_disposed`、`crypto_disposed`、`media_disposed`、`verified_scope`、`retained`、`unknown`（"最终枚举留待实现验证"）；超时进入 `stale`、`unknown`、`blocked` 或升级状态。
- **备份/保全状态（第 12 轮，行 1384、1389）**：`service_blocked` 与 `retained`（可同时存在）；报告取值 `retained`/`unknown`。
- **Inventory 冲突状态（第 10 轮，行 1172）**：`unknown`/`stale`/`conflict`；冲突与处置项取值"重复/别名、版本冲突、未知、失败、部分、保留、阻断、升级责任人和下一动作"。
- **终端副本状态（第 14 轮，行 1571）**：`requested`、`not_confirmed`、`external_unknown`；风险等级 `E0–E3`（行 1557，引用议题 7 既有 E0–E3 治理）。
- **报告事实/决策状态（第 16 轮，行 1719、1729）**：事实状态"阻断/请求/执行/验证/部分/未知/保留"，成功标准表述为"已阻断、已请求、已执行、已验证、仍保留、未知"；决策状态"不通知、内部通知、客户通知、监管评估、监管通知、更新或撤回"。
- **报告字段状态（第 17 轮，行 1811、1834）**：`verified_scope`、全局 verified、`unknown`、`retained`、`not_scoped`、`external_copy`；版本关系 `supersedes`/`revoked`。
- **投递生命周期状态（第 19 轮，行 1948）**：报告版本生成 → 批准 → 排队 → 发送尝试 → 渠道接受 → 传输完成 → 接收端确认 → 阅读/下载 → 撤回请求 → 撤回执行 → 修订发布；"渠道接受、传输完成、接收、阅读和业务确认分别记录"。
- **第三方/违约触发与未知（第 13 轮 行 1461；第 21 轮 行 2092、2103）**：`unknown`；`revocation_unknown`（引用议题 9）；触发 9 类、五条轨道、补救候选 10 项。
- 文档未明确：以上多数枚举被明确标注为"候选/阶段性语言"，文档**未**给出最终统一状态码集合与数值阈值。

### 10.4 角色与权限边界

- **双 Owner 与责任链（第 2 轮 §1，行 230–258）**：`source_owner`（负责源内容、源授权、源敏感性和源撤回）、`derivation_operator`（执行脱敏和派生，"不自动拥有发布权"）、`privacy / security_reviewer`、`target_owner`（负责目标空间接收、适用性和消费者范围）、`publication_owner`（批准正式发布）、`consumer_owner`、`revoke_authority`、`auditor`。"源 Owner 不能单方面决定目标空间发布；目标 Owner 不能解除源 ACL 或获得源空间管理权。"
- **四侧审核（第 2 轮 §2，行 260–268）**：源侧、脱敏侧、目标侧、发布侧各自的确认清单（内容真实与允许派生 / 敏感识别处理与血缘完整 / 目标确实需要与消费者明确 / 版本固定与撤回替代路径存在）。
- **责任冲突处理（第 2 轮 §5，行 337–356）**：源 Owner 允许、目标 Owner 拒绝→不发布；目标 Owner 允许、源 ACL 不允许→阻断；业务 Owner 允许、Security/Privacy 拒绝→阻断；源资产有效、目标资产已撤回→目标侧停止消费；目标空间无 Owner→只能保留候选；源 Owner 无法确认→不进入正式派生；脱敏验证缺失或血缘缺失→隔离；发布后源权限收窄→立即阻断并重新评估；恢复请求缺少当前授权→拒绝。
- **Provider 三档责任边界（第 9 轮 §阶段1，行 1070）**：平台可直接控制须提供执行与验证证据；只能发起请求须记录请求、合同/能力声明、Provider 回执、证明范围和时间；完全无法确认须标记 `unknown`；"平台生成的报告不能把自述回执升级为独立验证"。
- **查询侧角色与攻击者（第 8 轮，行 967、992、1001）**：攻击者至少区分普通授权消费者、好奇的内部成员、跨空间运营者、被盗用的 Agent/Harness、恶意内部人员、外部导出持有人、协同攻击者；全量闭包仅受控内部使用；"影响分析只能生成摘要、候选阻断、复核任务或通知，不能直接授权删除、改 ACL、终止 Run、恢复资产或执行工具"。
- **报告字段与受众权限（第 17 轮，行 1831–1835）**："先生成授权投影，再渲染格式；禁止模板自行决定权限"；"元数据同样分级，按主体/Purpose 过滤和审计"；"最终报送遵循具体法域和责任人批准"。
- **通知责任（第 18 轮，行 1880）**："执行者不能自批高影响外发；无人接管、角色冲突、跨租户责任不明或事实不足时先阻断并升级。"
- **投递门禁（第 19 轮，行 1950、1969）**："高敏报告默认优先平台内受控交付；外部渠道需接收者绑定、有效期、加密、审计和最小投影"；"版本修订触发当前状态重检和必要重新审批"。
- **脱敏与翻译分层（第 20 轮，行 2026、2048–2051）**：租户管理员看本租户范围摘要，数据主体只看与其相关的必要事实，Provider 只看处置所需对象/版本，监管/法务看经批准的事实和未知；"先做授权投影和字段过滤，再渲染/翻译；禁止事后文本清洗作为唯一门禁"；"平台提供事实和候选投影，法务/责任人决定适用规则和是否发送"。
- **补救授权（第 21 轮，行 2096、2111）**："不可逆或外部动作需独立批准"；"客户/监管通知由责任人批准"；"不能以 Provider 自述作为全量证明"。
- **保全与不可变保留（第 12 轮，行 1371、1392）**："系统不应自动解释法律文本，也不应允许普通运维直接解除保全"；"解除保全、缩短不可变保留、提前删除或恢复高敏内容均是独立高风险动作，不由清理请求自动批准"。

### 10.5 关键规则与不变量

- **外部未知不伪造为已清除**：第 9 轮"未发现、不可访问或未接入的副本不能被默认为不存在"（行 1058）、"第三方证据不足时默认 `unknown`/`blocked` 或收窄交付，不伪造全量删除证明"（行 1061）；第 21 轮"外部未知不被伪造为已清除，也不自动定性为供应商违约"（行 2109）；第 14 轮"无法确认终端处置时，不声称'所有副本已删除'"（行 1551）。
- **fail-closed 默认值**：第 4/5 轮"未知、证据不足、硬失败或变化未复核时默认 `isolate / block / needs_review`"（行 581、676）；第 7 轮"策略服务、身份服务、血缘服务、Connector 或撤回状态未知时不得错误 fail-open"（行 852）；第 11 轮"超时保持阻断"（行 1287）。
- **最小披露 / 最小投影**：第 16 轮"内部全量血缘、其他租户信息、秘密、凭据和不必要的第三方数据不能因'透明'被外发"（行 1727）；第 20 轮"一个租户的通知不能泄露其他租户名称、数量、关系、资产、攻击路径或副本存在性"（行 2022）。
- **投影先于渲染**：第 17 轮"字段披露、脱敏、未知和禁止外发规则在渲染前执行，不能靠模板文字补救"（行 1823）；第 20 轮"先做授权投影和字段过滤，再渲染/翻译；禁止事后文本清洗作为唯一门禁"（行 2048）。
- **发布/接收/检索/执行四级分离**：第 1 轮"目标接收不等于发布，发布不等于可检索，发布也不等于可执行"；第 2 轮"发布不等于可检索，可检索不等于可执行"（行 226）；第 7 轮"发布或检索不授予执行权"（行 869）。
- **阻断先于证明、阻断不冒充删除**：第 9 轮"阻断完成不冒充删除完成"（行 1089）；第 11 轮"阻断先于证明，证明不能授予新的执行或外发权限"（行 1281）；第 21 轮"报告不能替代阻断，合同补救不能替代安全处置"（行 2094）。
- **证据等级不跨副本继承**：第 11 轮"在线 E3 不会自动使备份、离线导出或第三方副本达到 E3"（行 1269）；第 10 轮"新 revision 不继承旧清理证明"（行 1194）；第 15 轮"不能继承旧证明而不重检"（行 1636）、"旧证明和旧幂等键不得覆盖新状态"（行 1672）。
- **抽样不等于全量证明**：第 11 轮"任何抽样结果都不得被表述为数学意义上的全量证明，除非证据模型明确支持该结论"（行 1271）。
- **超时不是成功**：第 11 轮"超时不是成功"（行 1273）；第 18 轮"超时不等成功"（行 1904）；第 19 轮"撤回、删除和高影响声明不能因超时盲目重复"（行 1952）。
- **不可见不等于不存在**：第 8 轮"对外不能把'看不到'解释成'没有'"（行 952）；第 10 轮"未观察不等于不存在"（行 1193）。
- **送达语义分层**：第 19 轮"渠道接受不等于人已接收，接收不等于已阅读"，"不能把一个渠道成功冒充全局送达"（行 1948、1950）；第 16 轮"失败不等于送达"（行 1751）；第 18 轮"投递不等于送达"（行 1911）。
- **保留不恢复服务**：第 12 轮"保留不等于可继续检索或执行"、"保留不恢复服务访问"、"保全不绕过当前权限"、"恢复触发新 inventory 与清理闭包"、"到期仍需执行和验证"（行 1354、1418）。
- **阻断/删除/撤回的副本语义**：第 9 轮"旧证明不自动覆盖新 revision 或新位置"、"恢复演练前后必须重新运行清理闭包"、禁止"已删除/已匿名/已清除"全局标签（行 1093、1094）。
- **版本不被静默改写**：第 16 轮"旧报告不静默覆盖"（行 1752）；第 19 轮"新事实不能静默改写已发送报告"（行 1954）；第 17 轮"旧版本不会被静默覆盖"（行 1841）。
- **测试/文档边界**：第 14 轮"测试不得触发真实外部删除"（行 1575）；第 15 轮"测试不执行真实外部删除或生产恢复"（行 1664）；第 16 轮"测试不得向真实客户、监管或外部系统发送通知"（行 1755）；第 13 轮"测试参数不成为产品默认值"（行 1487）；第 10 轮"数字覆盖率和一致性参数仅作为实验输入"（行 1197）。
- **自动审核能力边界（各轮"自动审核与推进"）**：自动化可做评估、生成候选投影、阻断、记录证据、调度与对账；**不能**自动把 `unknown` 当成功、自动批准高影响外发、把渠道接受当送达、扩大租户披露、接受不可验证的清除结论、宣布法律违约或生成全球合规声明。

### 10.6 界面/交互线索

- 第 6 轮（行 774）："分开显示可引用、可检索、可派生、可执行和证据状态，不提供笼统'已匿名'标签"。
- 第 7 轮（行 886）：UI 可聚合为"可参考/可检索/待审批/可执行/已阻断"，但保留依据、阻断原因和下一门槛。
- 第 8 轮（行 1000）：用候选/摘要/受限影响/拒绝分层，展示范围、精度、不确定性和下一门槛。
- 第 9 轮（行 1102）：提供分层摘要和明确范围/时间点；未知、保留和验证失败显著区别。
- 第 10 轮（行 1203）：对外按风险分层摘要，展开显示分母、盲区、时间点和责任；不隐藏未知。
- 第 11 轮（行 1304）：展示"当前可见性/传播状态 + 证据等级 + 范围 + 下一更新时间"，避免单一完成徽章。
- 第 12 轮（行 1401）：明确区分服务可见性、备份保留和法律保全，展示范围、原因和复核时间。
- 第 13 轮（行 1493）：用户想看到供应商"合规/已删除"标识时，展示证明层级、范围、时间和限制。
- 第 14 轮（行 1581）：低敏短期受限导出可简化流程；高敏和外部接收者显示风险、有效期和下一门槛。
- 第 15 轮（行 1670）：低风险已验证范围可收窄恢复；高风险未知保持阻断并展示原因/下一门槛。
- 第 16 轮（行 1761）：提供分层摘要并显式范围、时间、未知和下一步。
- 第 17 轮（行 1831）：共享事实内核，投影与模板分离。
- 第 18 轮（行 1901）：分开显示触发、评估、决定、批准、投递和送达状态。
- 第 19 轮（行 1975）：分开展示发送、接收、阅读和行动确认。
- 第 20 轮（行 2047）：受众明确的标题、版本、范围、语言和"未知/下一步"摘要。
- 第 21 轮（行 2117）：按风险、范围和证据收窄；"高敏未知硬阻断、低风险可提供明确限制的摘要"。
- 文档未明确：页面/组件划分、导航结构、文案规范与默认空状态。

### 10.7 仍暂缓未定的内容

第 3 轮暂缓表（行 523–534）列出 8 项触发后续深化：脱敏和重识别风险的完整算法、阈值与证明；Embedding 空间的隐私泄露评估与专门防护；差分隐私、匿名化和形式化隐私保证；跨空间执行的完整 Tool Policy 和 RunGate 协议；组合重识别的全量图分析和跨空间查询限制算法；派生资产在历史缓存、备份和离线导出中的清理策略；跨空间执行失败的自动补偿和回滚；语义保真度的统一自动评测集。

各轮深化后**仍然暂缓**的核心内容（按主题归并，括号为轮次）：

- **算法、阈值与形式化保证**：统一脱敏算法/全局重识别分数与通过阈值；统一 `epsilon`、`delta`、隐私预算、查询预算和组合上限；k-anonymity 或等价标准；Embedding 反演/成员资格/属性推断/跨索引关联的完整算法与阈值；统一匿名化标准；语义保真与隐私损失的统一优化函数（第 4、5、6、8 轮）。
- **Schema / 协议 / 接口**：Copy Inventory 最终字段、主键、索引、Schema/API 与迁移；Tool Policy 与 RunGate 的最终 Schema、策略语言、PDP/PEP 接口与事件协议；事实内核/投影/字段分类最终 Schema/API；Delivery Intent/Attempt/Receipt/Revision 最终 Schema；报告格式、签名、加密、语言、版本与撤回实现（第 7、10、17、19 轮）。
- **覆盖、抽样与 SLA 数字**：各类副本的覆盖率分母、证据等级、扫描频率与一致性 SLA；抽样率、全量条件和统计置信规则；阻断/执行/验证/到期/第三方响应 SLA；具体通知时限与时钟/延期规则；各风险等级与租户的 SLA（第 10、11、18、21 轮；文档多处明确"不在产品层伪造统一数字"）。
- **保留、保全与删除冲突**：备份/灾备/归档各层最终保留期限、到期规则与清理顺序；不可变保留、Legal Hold、删除请求与密钥销毁的最终接口/状态机；保全解除、提前删除、争议升级与例外审批矩阵（第 12 轮）。
- **Provider 与外部责任**：Provider 责任图最终 Schema/目录与变更同步协议；证明包最终格式、签名/完整性、证据等级与互认标准；常规/专项/事件审计触发条件、替代证据与抽样规则；合同删除/保留/位置/再处理/审计/通知/赔偿条款；证据不足/违约/失联/迁移替代的最终升级矩阵（第 13、21 轮）。
- **终端与外部副本**：Export Asset/下载分享事件/终端副本最终 Schema；全量终端发现、设备指纹、内容检测、再分享关联算法；远程擦除/密钥撤销/DRM/水印/DLP 最终能力与验证标准；非受管设备、打印截图、外部接收者的合同处置；设备离线/失联/员工离职/客户终止/事件保全处置矩阵（第 14 轮）。
- **恢复与并发**：恢复/重建/清理最终状态机、事件协议与持久化 Schema；幂等键/重试/补偿/回滚/并发冲突精确算法；恢复前后全量闭包扫描、优先级、覆盖率与 SLA；分区/乱序/重复/延迟/跨区域事件一致性协议；高风险恢复、自动关闭、人工接管与 Break-Glass 最终门禁（第 15 轮）。
- **通知、投递与跨域**：触发条件、影响分级、通知评估阈值与自动升级规则；监管/客户/数据主体时间窗、时钟与延期规则；值班/Owner/隐私法务/供应商/通信/监管联络最终责任矩阵；高影响通知审批、代理、Break-Glass 与无人接管处置；多渠道并发、修订、撤回与外部下载未知的 SLA/升级矩阵；跨租户/跨境/数据主体最终字段投影、脱敏与权限 Schema、翻译与语义等价验证、跨境传输依据与区域路由；跨租户通知误发、翻译错误、传输失败与版本撤回的处置矩阵（第 18、19、20 轮）。
- 议题级（行 538）："完整数据分类、脱敏算法、重识别模型、跨空间执行协议、阈值和运营 SLA 等暂缓事项留待以后讨论，不视为所有实现细节已经固化。"
- 文档未明确：以上暂缓项的默认取值、以及跨空间复用能力的专属界面形态。

---

## 统计

- 已确认结论条数：**议题 9 共 11 条**（第 1/2/3 轮 + 8 个子议题深化各 1 条）；**议题 10 共 21 条**（第 1/2/3 轮 3 条 + 第 4–21 轮 18 个阶段性讨论节点各 1 条）；**合计 32 条**。
- 来源：议题 9 行 1–1926；议题 10 行 1–2154。源文件未做任何修改。
