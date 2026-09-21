# 议题 3 / 议题 4 事实摘要（供产品设计文档使用）

来源（只读蒸馏，未做推测补全）：

- `.specs/enterprise-agent-memory-platform/03-记忆自动归属.md`（1403 行，议题 3）
- `.specs/enterprise-agent-memory-platform/04-记忆按需融合.md`（2966 行，议题 4）

引用格式：`（03 §第1轮-1）` 表示议题 3 第 1 轮第 1 小节；`（04 §深化7-3）` 表示议题 4 子议题深化 7 第 3 小节。文档未写明处标注「文档未明确」。

---

## 议题 3：记忆自动归属

### 3.1 已确认结论清单

**第 1 轮确认：单一规范 owner 与保守归属**（03 §第1轮）

1. 总纲：「**单一规范 owner + 多关系关联 + 证据驱动候选 + 硬约束优先 + 保守默认落点 + 跨边界提升需确认。**」本议题只讨论规范归属与归属关系，不与记忆层级、ACL、执行者、发布状态混谈。
2. §1 归属对象：MemorySpace 分 User/Team/Project/Agent 四类；每条可治理记忆只有一个 `canonical_owner_scope`，可同时关联多个 scope（`related_scopes`、`referenced_resources`、`affected_scopes`）。
3. §2 归属≠权限：属于 Team 不等于所有成员可读，属于 Project 不等于可修改，Agent 产生不等于属于 Agent，被引用不等于归属。归属只表达规范责任与语义边界。
4. §3 归属判断信号：可综合成员显式选择、Connector 验证的绑定、Work Thread/Task/owner 关系、资源引用、内容语义、参与主体与使用范围、经权限校验的显式声明、敏感性与跨边界影响；Harness、当前执行者、发送者/发现者、被引用次数、模型置信度、一次性使用、成员身份与人数**不得单独决定 owner**。
5. §4 候选与裁决：采用「候选 + 规则裁决」而非模型直接写入最终 owner；默认顺序为硬边界优先（显式授权声明 → 已确认 Work Thread/Project/Team → Connector 验证绑定 → 稳定历史关联 → 内容语义推断 → 保守默认落点），并保留 Ownership Decision 审计。
6. §5 默认落点：与明确 Project/repo/服务绑定→Project；跨多 Project 的团队共同规则→Team 候选需确认；个人偏好→User；仅 Agent/Harness 运行方法→Agent；一次性工作过程→先留 L0；无法判断/跨边界/敏感→窄边界、L0 或 `ownership_pending`；多候选竞争→不静默选择。
7. §6 角色区分：Producer（产生证据）、Canonical Owner（对记忆负责）、Participants（参与形成或使用）、Beneficiaries（可能受益）四者分离；Agent 在 Project A 发现故障模式时 Producer 可为 Agent，Canonical Owner 默认 Project A。
8. §7 跨边界提升与迁移：归属变化走版本化提升/迁移流程（Project Memory → Team Promotion Candidate → 影响与权限预检 → 脱敏与冲突检查 → 授权确认 → 新 owner 生效）；须区分 `related_to`/`referenced_by`/`participated_by`/`affected_scope`/`promoted_to`/`transferred_to`。
9. §8 硬约束：凭据密钥隐私、无权发布、跨租户/Team/Project、多竞争 owner、生产与合规高影响、资源与 Work Thread 边界不一致、证据不足等情况不能仅靠模型判断，须不自动扩大 scope 并请求有权主体确认或进入治理/隔离队列。

**第 2 轮确认：MemorySpace 边界、关系与归属转换**（03 §第2轮）

10. 总纲：四类并列 MemorySpace，通过显式关系表达组织/参与/引用/影响/派生；Team 与 Project 可关联但不自动继承 owner 或权限；跨空间复用默认受控引用，长期共享采用经检查的派生条目；只有显式 Transfer 改变规范 owner；空间归档或 Agent 退役不自动删除或转移记忆。
11. §1 非严格树形：不采用 `Team → Project → Memory` 单一树形作为规范模型；Team/Project 间可有 `belongs_to`、`participates_in`、`references`，但不自动意味 owner、读取权或发布权继承。
12. §2 关系分开建模：区分 `owns`、`belongs_to`、`participates_in`、`references`、`affected_scope`、`derived_from`、`promoted_to`；「关联关系不等于共享，引用关系不等于所有权，组织关系不等于权限继承」。
13. §3 引用优先、长期派生：低风险只读复用生成授权后的受控引用投影；长期共享生成目标空间派生候选（Project Memory → Team Promotion Candidate → 证据/敏感性/冲突/影响/权限检查 → Team 审核 → Team L3 派生条目），派生条目须保留 `derived_from`、源版本、生成记录和独立生命周期。
14. §4 显式 Transfer：跨空间复用、引用或派生都不改变原 owner；只有受控 Transfer 流程（Transfer Candidate → 权限与资源影响预检 → 新 owner 确认 → owner 生效）才改变规范 owner。
15. §5 User/Agent Space 限制：User Space 可存个人偏好/习惯/私有上下文，不应默认独占 Project 事实、Team 约束、第三方隐私；Agent Space 可存工具经验/运行配置/失败模式，不应默认保存团队业务规则、Project 规范事实、生产操作约束。
16. §6 空间生命周期：Project 归档→Space 归档/只读并保留历史 owner 与来源；Agent 退役→Space 停止新增或转只读，其产生的业务记忆不随 Agent 自动删除；生命周期变化触发影响评估但不能静默改变 ACL、历史版本或规范归属。

**第 3 轮确认：归属候选的风险分级与处置**（03 §第3轮）

17. 总纲：采用硬门禁与任一高风险即升级，不用单一模型置信度或复杂总分放行；四种处置为自动落位、自动暂存、人工确认/治理队列、隔离；跨边界/敏感/冲突/来源不明/高影响/难撤回不得自动正式落位；隔离内容不得进入普通检索、摘要和自动执行链路。
18. §1 风险维度：至少同时考虑影响范围、敏感性、证据强度、可逆性、冲突程度、执行影响六维，不采用单一总分自动放行。
19. §2 四种处置：自动落位（低影响、非敏感、归属唯一、来源可信、无冲突、可撤回）；自动暂存/候选（证据尚少、影响尚小但不适合正式长期记忆）；人工确认/治理队列（跨边界、敏感、冲突、影响扩大或多个合理 owner）；隔离（疑似越权、恶意注入、高敏感、来源不可信或无法安全归属）。自动暂存与治理队列必须区分。
20. §3 自动落位最低条件：须同时满足可识别主体/来源/候选 owner、来源允许保存使用、目标 scope 唯一且有权写入、不涉高敏感与高影响、无 owner/权限/内容冲突、影响限于小范围、错误可撤回纠正、决定可解释可审计；模型置信度只能作辅助信号。
21. §4 风险升档与硬门禁：候选 owner 不唯一、跨 User/Project/Team/租户/组织、含隐私凭证健康财务身份安全信息、来源为推断/转述/未验证第三方、与既有记忆或 ACL 或指令冲突、影响权限/生产/资金/删除/发布/合规/人事、归属错误难发现撤回、批量导入异常高频写入或疑似提示注入、用途与保存期限不明——任一即不得自动正式落位；严重越权/泄露/恶意注入/高危执行影响应直接隔离。
22. §5 治理队列最小字段：Ownership Review Item 含 `memory_candidate`、`candidate_scopes`、`current_scope`、`evidence_refs`、`sensitivity`、`impact_scope`、`reversibility`、`conflicts`、`suggested_action`、`reviewer`、`due_at`、`decision`、`decision_reason`；必须配置责任人、时限、升级路径、审核依据、最终决定与理由。
23. §6 失败安全与撤回：权限检查、归属解析、敏感性判断、审计记录、撤回传播、目标 scope 访问验证失败时默认拒绝写入或隔离；发现错误归属须冻结旧记忆使用→停止新增传播→纠正或迁移→清理索引/缓存/派生摘要/同步副本→保留审计；撤回、删除和权限降级不能只修改 owner 字段。

**补充专题确认：归属变化的下游传播**（03 §补充专题）

24. 总纲：归属变化采用版本化、事件化、下游重新解析的传播模型；检索/Context Manifest/知识化候选按当前 owner、ACL、用途、敏感性和有效性重新判断；历史版本与 Run Context Snapshot 不可变；跨空间提升优先生成带血缘派生条目；源记忆收窄/撤回/失效时派生内容进入重新评估、暂停或撤回。
25. §1 四类事件：`ownership_pending → confirmed`、`owner_scope → narrowed_scope`、`owner_scope → promoted_scope / derived_scope`、`owner_scope → rejected / isolated / withdrawn` 分别处理，不统一改一个 owner 字段；扩大/提升不能直接扩大检索范围。
26. §2 对检索的影响：必须在召回前按当前请求重新判断（识别当前 User/Agent/Harness/Project/Task → 计算可见可用 MemorySpace → 过滤 owner/关联/敏感性/publication_state → 检索 → 处理版本冲突与有效时间 → 返回带来源与归属解释的结果）；「不能先全库召回再在最后隐藏内容」。
27. §3 对 Context Manifest 的影响：Manifest 须在具体请求边界重新解析；旧 Manifest 与正在运行的 Run Context Snapshot 不因新归属事件被静默改写；权限撤销、敏感暴露、归属撤销和高风险 owner 变化可暂停受影响 Run 并要求重新解析。
28. §4 对历史版本的影响：须区分 `historical_owner`/`current_owner`/`historical_visibility`/`current_visibility`；「历史存在 ≠ 当前可读，曾经可读 ≠ 现在可读，曾经属于 Team ≠ 永久属于 Team」；审计人员可在受控权限下查看历史，普通用户仍走当前 ACL。
29. §5 对知识化候选的影响：归属变化须传播到 L3 与 Wiki、Skill、RCA、Template、Code Context 候选；Project→Team 提升不能直接把 Project 版本发布为 Team Wiki 或 Skill；派生条目与知识化候选应独立记录依赖源版本、是否满足发布条件、源变化、是否需重审、是否已通知使用方。
30. §6 传播与阻断原则：高风险归属变化同步阻断并重新解析；普通变化可异步触发影响评估；传播任务失败时暂停扩大传播；归属变化不反写历史事件 owner、不修改已生成 Snapshot；撤回/删除/权限降级须覆盖主存储、检索索引、缓存、派生摘要、Manifest 和知识化候选。

**子议题深化 1：数据库 Schema 和关系表**（03 §深化1，自动审核通过）

31. 四类 Space 作为并列规范对象（UserSpace/TeamSpace/ProjectSpace/AgentSpace）；建议采用「Space Object + Immutable Revision + Typed Relation + Membership/Grant Projection + Event」；索引只用于发现候选，不能因关系命中自动授予读取、注入、执行或导出权限。

**子议题深化 2：归属信号权重、置信度与阈值**（03 §深化2，自动审核通过）

32. 采用「规则事实优先、模型信号辅助、风险门禁约束」三层模型（Explicit Facts/Constraints → Signal Aggregation → Calibration/Confidence Band → Contradiction and Scope Check → Auto Candidate or Review）；不使用全局固定权重；自动处理等级 A0（显式选择或规范 Owner 关联，记录事实但仍查权限）/A1（低风险可自动生成候选或受限更新）/A2（跨空间、Owner 变化、敏感高影响或冲突，只生成候选并进入审核）。

**子议题深化 3：归属冲突自动解决算法**（03 §深化3，自动审核通过）

33. 冲突流程为 Detect → Classify → Common Baseline → Evidence/Time/Scope Check → Permission/Lifecycle Check → Candidate Resolution → Verify → New Revision；自动处理等级 M0（重复/格式/明确同义，不改变归属语义）/M1（共同基线明确、低风险可逆、无权限 Scope 冲突）/M2（Owner、跨空间、敏感性、权限、Transfer、生命周期或证据冲突，只生成候选并隔离/审核）；「自动解决不等于自动发布，自动发布不等于自动执行」。

**子议题深化 4：跨 Project/Team 提升的审批、脱敏与权限传播**（03 §深化4，自动审核通过）

34. 区分 reference / promotion_candidate / derived_asset / published_asset / transfer；目标权限不得宽于来源（`target_scope ⊆ source_allowed_scope`、`target_purpose ⊆ source_allowed_purpose`、`target_sensitivity ≤ source_allowed_sensitivity`）；链路为 Source Assessment → Promotion Candidate → Target Acceptance → Purpose/Scope/Sensitivity Check → Redaction → Approval/Admission → Derived Asset + Lineage → Target Consumption Gate → Retraction Propagation；「目标接受不等于发布，发布不等于执行授权」。

**子议题深化 5：归属纠正、回滚、批量迁移与历史引用兼容**（03 §深化5，自动审核通过）

35. 归属变化区分 correction / transfer / rollback / bulk_migration / merge / split / historical_reinterpretation；纠正不能覆盖原归属事实而应追加 `correction_record`；回滚不是删除新版本而是生成指向有效历史版本的新规范 Revision；批量迁移采用 Batch Job + Item Result，不假设全批原子成功，历史引用绑定 `space_revision`、`relation_revision` 和读取时权限决定，不能让回滚恢复旧权限或旧审批。

**子议题深化 6：普通成员归属解释和操作界面**（03 §深化6，自动审核通过）

36. 普通成员需知道归属对象、关系类型、当前状态、判定依据、适用范围、是否可使用、下一步动作；采用「主状态 + 简短解释 + 关系摘要 + 下一步 + 可展开依据」渐进披露；操作边界为纠正归属生成 Correction Candidate、申请转移发起 Transfer Candidate、查看来源重查字段级权限与 Purpose、查看历史绑定历史 Revision 与审计权限、使用/注入/执行走独立消费授权和 RunGate。

**子议题深化 7：Connector 元数据缺失、错误绑定和迟到事件**（03 §深化7，自动审核通过）

37. Connector 处理分 Identity（可识别可去重）/Provenance（来源可验证）/Binding（指向哪个资源与 MemorySpace）/Temporal State（对哪个有效时间版本生效）四个独立判断面，任一面不成立都不能由其他面补齐成正式 Owner；最小安全不变量为：缺失或不可信元数据永不扩大 Scope、错误绑定永不继续扩大传播、迟到事件永不凭到达顺序覆盖较新有效版本、重复/重放永不重复产生不可逆副作用、历史快照永不因当前纠正被静默改写、关键步骤失败默认暂存/收窄/隔离；「Connector 只提供归属证据入口，不自动获得扩大 Scope、授予权限或改变历史事实的能力」。

### 3.2 核心对象与关系

- **MemorySpace 四类**（03 §第1轮-1、§第2轮-1）：User（个人长期偏好、个人工作方式或私有上下文）、Team（团队共享长期认知、协作方式、跨项目经验）、Project（与代码库、业务对象、项目目标或 Work Thread 绑定）、Agent（特定 Agent/Harness 的运行经验、工具使用方式或私有执行上下文）。四类并列，非严格树形。
- **Memory 对象字段**（03 §第1轮-1）：`canonical_owner_scope`（唯一规范归属）、`related_scopes`、`referenced_resources`、`affected_scopes`。
- **归属语义四组对象**（03 §第1轮-6）：Producer / Canonical Owner / Participants / Beneficiaries。
- **关系类型**（03 §第1轮-7、§第2轮-2）：`related_to`、`referenced_by`、`participated_by`、`affected_scope`、`promoted_to`、`transferred_to`；以及 `owns`、`belongs_to`、`participates_in`、`references`、`derived_from`。
- **Ownership Decision**（03 §第1轮-4）：`candidate_scopes`、`selected_scope`、`signal_refs`、`decision_reason`、`policy_version`、`model_or_rule_version`、`confidence`、`decided_at`、`reviewer`/`confirmation`。
- **Ownership Review Item（治理队列）**（03 §第3轮-5）：`memory_candidate`、`candidate_scopes`、`current_scope`、`evidence_refs`、`sensitivity`、`impact_scope`、`reversibility`、`conflicts`、`suggested_action`、`reviewer`、`due_at`、`decision`、`decision_reason`。
- **持久化模型**（03 §深化1）：`MemorySpace`（`space_id`/`space_type`、`canonical_owner_ref`、`lifecycle_state`、`sensitivity`/`retention_ref`、`current_revision`）、`SpaceRevision`（immutable metadata、`parent_revision`、`evidence_refs`、`policy_context`）、`SpaceRelation`（`relation_id`/`relation_type`、`source_space`/`target_space`、`valid_from`/`valid_until`、`status`、`source`/`evidence`、`purpose`/`scope`、`revision`/`audit_ref`）。候选关系含 `member_of`、`participates_in`、`owns`、`references`、`affects`、`derived_from`、`delegates_to`、`transferred_to`。
- **Context Manifest 记录字段**（03 §补充专题-3）：`memory_id`、`source_revision`、`owner_scope`、`inclusion_reason`、`authorization_context`、`policy_version`、`sensitivity_decision`、`redaction_state`。
- **归属信号枚举**（03 §深化2）：`explicit_user_selection`、`work_thread_owner`、`project_or_team_context`、`resource_path_and_revision`、`producer_identity`、`connector_metadata`、`participant_membership`、`recent_activity`、`content_semantics`、`historical_assignment`；输出建议含 `candidate_space`、`signal_breakdown`、`confidence_band`、`calibration_context`、`contradictions`、`freshness`、`scope_and_purpose`、`automation_eligibility`、`recommended_action`。
- **归属冲突类型**（03 §深化3）：`multiple_owner`、`owner_vs_participant`、`space_scope_conflict`、`temporal_conflict`、`source_conflict`、`revision_conflict`、`producer_binding_conflict`、`permission_conflict`、`transfer_conflict`。
- **Promotion Record**（03 §深化4）：来源版本、目标 Space、来源与目标 Scope/Purpose、敏感性、脱敏版本、血缘、审批/准入决定、有效期、撤回能力、消费限制。
- **Connector 元数据异常类型**（03 §深化7）：`missing`、`malformed`、`stale`、`ambiguous`、`contradictory`、`misbound`、`unverified`、`late`、`out_of_order`、`duplicate`、`replay`、`correction`。

### 3.3 状态与枚举

- **归属候选与裁决状态**：`ownership_pending`（归属未定，保留较窄边界/L0）（03 §第1轮-5、§第3轮-6）；`confirmed`（进入目标空间正常治理，保留 L0 来源与确认记录）（03 §补充专题-1）。
- **归属变化四类事件**（03 §补充专题-1）：`ownership_pending → confirmed`；`owner_scope → narrowed_scope`；`owner_scope → promoted_scope / derived_scope`；`owner_scope → rejected / isolated / withdrawn`。
- **风险维度六项**（03 §第3轮-1）：影响范围、敏感性、证据强度、可逆性、冲突程度、执行影响。敏感性取值示例：普通偏好、内部信息、个人隐私、凭证、合规数据；影响范围示例：当前会话、单个 User、Project、Team、跨组织、跨租户。
- **四种处置结果**（03 §第3轮-2）：自动落位、自动暂存/候选、人工确认/治理队列、隔离。
- **自动处理等级 A0/A1/A2**（03 §深化2-阶段3）。
- **冲突处理等级 M0/M1/M2**（03 §深化3-阶段3）。
- **批量迁移状态**（03 §深化5）：`planned`、`validated`、`approved`、`running`、`partially_succeeded`、`paused`、`rolled_back_candidate`、`completed`、`failed`、`unknown`。
- **归属变化动作枚举**（03 §深化5）：`correction`、`transfer`、`rollback`、`bulk_migration`、`merge`、`split`、`historical_reinterpretation`。
- **跨空间提升五类形态**（03 §深化4）：`reference`、`promotion_candidate`、`derived_asset`、`published_asset`、`transfer`。
- **Connector 阶段性状态语义**（03 §深化7）：`received` → `verified`/`unverified` → `binding_pending`/`bound`/`binding_conflict` → `current`/`late`/`out_of_order`/`duplicate`/`replay` → `candidate`/`applied`/`corrected`/`withdrawn`/`isolated`；文档强调这些是治理语义而非最终枚举，一个事件可同时具备多个维度。
- **归属动作能力枚举**（03 §补充专题-2）：`discover`、`read`、`use`、`manage`、`audit`。
- **空间生命周期状态**：`lifecycle_state`（03 §深化1）、Project Space `archived`/只读、Agent Space 停止新增/转只读（03 §第2轮-6）；具体枚举值文档未明确。

### 3.4 角色与权限边界

- **归属与权限分离**（03 §第1轮-2）：「发现、读取、使用、修改、审核和发布仍由 ACL、策略和数据治理分别决定」。
- **四类主体角色**（03 §第1轮-6）：Producer、Canonical Owner、Participants、Beneficiaries 语义如上 3.2；Producer 身份不得单独决定 owner。
- **五动作权限边界**（03 §补充专题-2）：`discover`（能否知道记忆存在）、`read`（能否读取内容）、`use`（能否用于召回/总结/生成 Prompt）、`manage`（能否确认/修改/撤回/迁移）、`audit`（能否查看来源和历史）。
- **审计读取**（03 §补充专题-4）：审计人员可在受控权限下查看历史；普通用户仍须经过当前 ACL、用途、敏感性和数据治理判断。
- **治理队列责任人**（03 §第3轮-5）：须有 `reviewer`、`due_at`、升级路径与最终决定；不能成为无期限暂存区。
- **确认与审批主体**（03 §第1轮-8、§深化4）：跨边界/敏感/冲突场景须「请求有权主体确认」；提升须「来源 Owner/授权主体同意」「目标接受」；最终审批角色、委托和风险矩阵明确暂缓（03 §深化4 暂缓项）。
- **关系查询最小权限**（03 §深化1 阶段4 安全/隐私）：关系本身可能泄露组织结构和资源存在性，关系查询、导出和跨空间传播需要最小权限。
- **界面侧权限**（03 §深化6）：无权用户不能通过归属解释推断隐藏 Space、Owner、资源存在性或敏感关系；须支持统一的「不可用或无权访问」表达；状态展示不自动授予权限；使用/注入/执行走独立消费授权和 RunGate。
- **空间限制**（03 §第2轮-5）：User Space 不应默认独占 Project 事实、Team 约束、第三方隐私；Agent Space 不应默认保存团队业务规则、Project 规范事实、生产操作约束。
- **关系图≠权限图**（03 §深化1 阶段4 产品/UX）：用户应看到「所属、参与、引用、影响和派生」区别。
- **管理员/审核者等具体角色命名与权限矩阵**：文档未明确（列为暂缓项）。

### 3.5 关键规则与不变量

- **归属≠权限**（03 §第1轮-2）：四条不等式原文——属于 Team ≠ 所有 Team 成员都可以读取；属于 Project ≠ Project 内所有主体都可以修改；由 Agent 产生 ≠ 记忆属于 Agent；被某 Project 引用 ≠ 记忆归属于该 Project。
- **单一规范 owner**（03 §第1轮-1）：每条可治理记忆只有一个 `canonical_owner_scope`。
- **不自动继承**（03 §第2轮-1）：`belongs_to`/`participates_in`/`references` 不自动意味着 owner、读取权或发布权继承。
- **保守默认落点**（03 §第1轮-5）：「宁可暂时留在较窄的原始边界，也不自动扩大为 Team 或跨 Project 共享」；归属判断失败不能导致 L0 原始证据丢失，但不得据此向上晋升。
- **硬边界优先于分数排序**（03 §第1轮-4）：判断顺序为显式授权声明 → 已确认 Work Thread/Project/Team → Connector 验证绑定 → 稳定历史关联 → 内容语义推断 → 保守默认落点。
- **只有显式 Transfer 改变 owner**（03 §第2轮-4）：引用与派生都不改变原 owner。
- **派生条目独立生命周期**（03 §第2轮-3）：须保留 `derived_from`、源版本、生成记录；源记忆撤回/过期/权限变化时目标派生条目须重新评估，不得静默继续作为有效知识。
- **目标权限不得宽于来源**（03 §深化4）：三条包含式约束见 3.1 第 34 条。
- **下游传播**（03 §补充专题-6）：归属变化不反写历史事件 owner、不修改已生成 Snapshot；撤回/删除/权限降级须覆盖主存储、检索索引、缓存、派生摘要、Manifest 和知识化候选；传播失败时暂停扩大传播。
- **失败安全**（03 §第3轮-6）：权限检查、归属解析、敏感性判断、审计记录、撤回传播、目标 scope 访问验证失败时默认拒绝写入或隔离。
- **隔离内容不可用**（03 §第3轮-6）：不得进入普通检索、摘要、Context Manifest、自动执行或默认训练链路；撤回、删除和权限降级不能只修改 owner 字段。
- **不可逆约束**（03 §补充专题-4）：历史存在 ≠ 当前可读；曾经可读 ≠ 现在可读；曾经属于 Team ≠ 永久属于 Team。
- **Connector 六条最小安全不变量**（03 §深化7）：见 3.1 第 37 条。
- **回滚不恢复旧权限**（03 §深化5）：不能让回滚恢复旧权限或旧审批；回滚生成指向有效历史版本的新规范 Revision。
- **无「容错解析」猜 Scope**（03 §深化7）：任何机制都不支持「缺 metadata 就猜 Scope」或「最后到达即为真」。

### 3.6 界面/交互线索

- **普通成员主视图**（03 §深化6）：首先回答归属对象、关系类型、当前状态、判定依据、适用范围、是否可以使用、下一步动作；主视图须分开展示 `canonical_owner`、`participant`、`producer`、`referenced_scope`、`affected_scope`、`derived_from`、`candidate_owner`。
- **渐进披露结构**（03 §深化6）：第一层=状态、能否使用、下一步；第二层=关系类型、适用 Scope、更新时间、阻断原因；第三层=经授权的来源、Revision、证据和历史。不能把关系图、置信度分数或数据库字段直接暴露成用户任务。
- **Member Projection 建议字段**（03 §深化6）：`primary_ownership_status`、`owner_display_or_hidden`、`relationship_summary`、`why_this_relation`、`scope_and_validity`、`can_use`、`next_action`、`last_verified_at`、`expandable_evidence`。
- **用户可见状态聚合**（03 §深化6）：归属于我 / 归属于团队或项目 / 我参与但不拥有 / 仅作为引用或影响范围 / 来源不明或待确认 / 存在争议 / 已转移 / 已失效或已撤回 / 不可用或无权访问。
- **可访问性**（03 §深化6 阶段2、阶段3）：状态颜色不得作为唯一语义；异步刷新、错误和权限阻断需有文本和辅助技术语义（参考 WCAG 2.2 Status Messages）。
- **操作入口**（03 §深化6）：纠正归属、申请转移、查看来源、查看历史、使用/注入/执行五类动作分别处理。
- **专家团意见**（03 §深化6 阶段4）：支持「归属于谁 + 为什么 + 我能做什么」三段结构；不建议用户直接阅读关系图和模型分数；加载、过期、更新中、部分成功、unknown、离线状态需可见，解释数据不可用时显示受限状态而非伪造确定归属。
- **冲突/批量迁移界面线索**（03 §深化3 阶段4、§深化5 阶段4）：冲突界面应展示候选、差异、依据、影响和下一步，不用「已自动解决」掩盖范围变化；批量迁移需要预览、影响范围、成功/失败/未知分项和恢复入口，纠正应展示历史链而非覆盖原记录。
- **具体 UI、组件、视觉规范、多语言、归属解释 API**：文档未明确（列为暂缓项）。

### 3.7 仍暂缓未定的内容

- 四类 MemorySpace 的具体数据库 Schema、关系表和索引（03 §第1轮暂缓、§第2轮暂缓、§深化1 暂缓）；完整 Space/Relation 字段与约束、关系类型全集、继承矩阵、查询语法、分片索引迁移参数、Transfer/Membership/Grant 最终 API 与审计事件。
- 归属信号的精确权重、置信度公式和自动裁决阈值（03 §第1轮暂缓、§第3轮暂缓、§深化2 暂缓）；不同 Space 类型的模型与特征；归属错误的批量回滚、申诉和运营 SLA。
- 归属冲突的完整自动解决算法（03 §第1轮暂缓、§深化3 暂缓）：冲突检测匹配与候选排序算法、M0/M1/M2 精确门槛与人工审核 SLA、批量冲突重算回滚补偿、冲突解释与审核工作台。
- 跨 Project/Team 提升的完整审批、脱敏和权限传播协议（03 §第1轮暂缓、§深化4 暂缓）：最终审批角色/委托/风险矩阵、脱敏算法与残余风险评估与字段目录、派生资产完整血缘与跨空间事务、目标接受与消费与撤回 API/SLA。
- 归属纠正、回滚、批量迁移和历史引用兼容机制（03 §第1轮暂缓、§深化5 暂缓）：最终 API、批量并发暂停重试与部分失败事务、历史引用兼容与审计读取矩阵、迁移预览与治理工作台。
- 普通成员归属解释和操作界面的具体设计（03 §第1轮暂缓、§深化6 暂缓）：主卡/关系详情/纠正转移流程 UI、归属解释 API 与字段级脱敏与多语言、关系图与批量操作与审计工作台。
- Connector 元数据缺失、错误绑定和迟到事件的完整处理规则（03 §第1轮暂缓、§深化7 暂缓）：事件信封/元数据字段/绑定对象/API Schema、去重键与版本号与水位算法与重排窗口、身份认证与来源证明与跨租户绑定协议、错误绑定自动检测与纠正优先级与批量重算、迟到事件缓存重试死信恢复参数、修正撤回对索引缓存 Manifest 摘要与派生资产的传播协议、不可验证来源的保留期限与合规删除例外、Connector 能力差异兼容矩阵与迁移计划。
- 其余暂缓（03 §第2轮暂缓、§补充专题暂缓）：Team/Project 组织关系完整继承矩阵；派生条目同步/冲突/源撤回/版本传播算法；Transfer 审批级别、权限差异报告与回滚细节；User/Agent 私有空间发现读取使用与审计策略；空间归档解散与 Agent 退役后的保留期限与删除策略；不同空间关系对检索和 Context Manifest 的具体影响；检索/Manifest/知识化候选的具体传播协议与一致性保证；归属变化同步异步判定阈值与 SLA；历史版本审计读取与合规删除例外；跨空间派生条目完整血缘同步与冲突模型；Manifest 完整召回排序裁剪缓存策略；Wiki/Skill/RCA/Template/Code Context 具体撤回与复核流程。

---

## 议题 4：记忆按需融合

### 4.1 已确认结论清单

**第 1 轮确认：权限先行的检索、融合与投影**（04 §第1轮）

1. 总纲：「**权限先过滤的分层混合检索 + 轻量、带来源的融合 + 面向 Harness/Task 的最小上下文投影 + 上下文预算**」；Harness 安全规则具有否决权，相关性和模型置信度不能替代授权；隔离、待审核、失效和敏感内容不得进入普通检索或自动上下文；跨空间复用必须重新执行授权、用途、敏感性和血缘检查；权限、归属、敏感分类或过滤失败时默认拒绝或隔离。
2. §1 三层分离：检索只回答「哪些内容可能相关」；融合处理重复、冲突、有效时间和适用范围但不能凭空生成无来源新事实；投影把允许使用的结果转换为当前 Harness 可理解的最小上下文，不等于修改记忆库。
3. §2 上下文维度：至少解析 User / Agent / Harness / Team / Project / Task / Code Context / Purpose；相关性优先顺序为 Harness 安全规则 > Task/Code 局部事实 > Project 约束 > Team 规范 > User 偏好 > 历史经验，该顺序只影响相关性和投影优先级，不影响权限。
4. §3 主流程九步：解析请求 → 建立允许访问和使用的 scope 集合 → 在授权范围内检索（关键词+向量+代码邻近+关系关联）→ 按 Task/Code、Project、Team、User 和历史经验重排 → 轻量融合 → 生成带来源的融合结果 → 按 Harness 能力、用途和预算投影 → 输出前泄露检查 → 记录审计；核心边界「权限和用途决定『能不能使用』，相关性决定『值不值得优先使用』」。
5. §4 默认注入策略：Harness 安全规则必须遵守但不能被普通记忆覆盖；当前 Task 决策与验收标准高优先注入；当前 Code/Project 约束相关时注入；Team 稳定规范任务相关时注入；User 表达偏好低成本注入；历史经验按需召回；原始 L0 对话默认不直接注入；敏感事实仅在明确授权且用途匹配时使用；disputed/invalidated/isolated 内容默认不进入普通上下文。
6. §5 融合规则：融合结果须表达「默认规则 + 明确例外」（示例：项目默认使用 PostgreSQL；本任务明确例外使用 SQLite），并保留来源、owner scope、适用范围、有效时间、冲突关系、是否为例外、当前可使用状态；不能压缩成无来源单一结论。
7. §6 最小充分上下文：按用途分为必需约束、当前事实、任务决策、相关经验、可展开引用；默认不提供完整原始对话、无关团队画像、未授权 Project 内容、隔离与待审核内容、无法验证的推断、完整敏感字段、仅因语义相似而召回的长篇历史；L2/L3 聚合记忆在投影中仍须保留来源与适用范围，不能因是摘要而降低 ACL。
8. §7 检索过滤与跨边界保护：权限、用途、租户、scope、敏感性和 publication_state 必须在候选召回前参与过滤，「不能先全库召回再隐藏结果」；User/Agent 私有记忆不得因相关性自动进入 Team/Project 上下文；Project 记忆不得因多人参与自动进入 Team 上下文；派生、摘要、embedding、融合和 Prompt 注入都视为数据流动。
9. §8 上下文预算：应限制单次记忆条数、每类 token 预算、单条最大长度、跨空间记忆数量、低置信度记忆比例、原始证据展开深度（具体数值留待以后讨论）；超预算不能随机截断，降级顺序为保留 Harness 安全规则 → 保留 Task/Code 局部约束 → 保留 Project 必要事实 → 压缩重复内容 → 次要内容变为可展开引用 → 必要时提示上下文不足并允许继续检索；预算不等于隐私授权。
10. §9 Harness 安全边界与失败安全：Harness 安全规则最高否决权；召回内容视为不可信数据，记忆文本不能授权工具调用、改变系统策略或扩大权限；隔离/待审核/失效/高敏感内容不得进入普通检索、摘要、Context Manifest 或自动执行链路；权限、归属、敏感分类、审计或过滤失败时默认 fail-closed；记忆删除、撤回和权限降级优先于自动融合、巩固和知识化派生。
11. §10 审计与可解释性：每次召回/融合/投影至少能回答谁在什么 Harness/Task/Purpose 下请求、哪些 scope 被允许或拒绝、哪些候选被纳入排除或降级、为什么纳入某条记忆、使用了哪个记忆版本与 Manifest 与策略版本、最终注入了哪些内容、是否经过脱敏或字段级裁剪；审计优先记录 `memory_id`、scope、purpose、decision、policy version。

**子议题 1 补充专题确认：冲突表达与 Harness 投影**（04 §补充1）

12. 总纲：融合不采用「单条记忆胜出」，而采用带来源的结构化融合视图，区分 constraint、fact、exception、suggestion、dispute；明确例外必须绑定范围、时间、来源和失效条件，不能升级为一般规则；高风险、无法解释或互斥冲突必须保留争议、请求确认或阻断使用；不同 Harness 使用不同最小投影格式且必须保留来源、适用范围、状态和不确定性；记忆文本不能通过投影变成工具授权或系统指令。
13. §1 结构化融合视图：Fused Memory View 含 `applicable_scope`、`conclusion`、`default_rule`、`exceptions`、`conflicts`、`confidence`/`verification`、`source_refs`、`effective_time`、`allowed_use`、`unresolved_questions`。
14. §2 冲突与例外处理：默认判断顺序为 Harness 安全规则 > 当前 Task/Code 局部条件 > 当前 Project 约束 > Team 稳定规范 > User 偏好 > 历史经验和弱推断，仅作默认解释框架；能由范围或时间解释的冲突表达为「默认规则 + 有边界例外」并绑定适用对象、Task/文件/服务/环境、起止时间、来源、验证条件和失效条件；无法解释的互斥事实并列表达并标记 `dispute`，高风险场景请求确认或阻断使用。
15. §3 不同 Harness 最小投影：开发 Harness（约束、例外、文件/符号范围、验证命令、禁止动作）；运维 Harness（当前事件、风险、审批状态、Runbook、执行前提、回滚条件）；研究/分析 Agent（来源、证据强度、相互矛盾观点、不确定性）；PM/规划 Agent（决策、适用范围、业务影响、未决事项）；人员接手（当前结论、风险、争议、证据链接、下一步）；通用对话 Harness（简短结论、必要限定、可展开来源）。
16. §4 安全边界：冲突处理先经当前权限、用途、时间和有效性过滤；`dispute`、敏感、隔离、撤回和未授权内容不得进入普通投影；冲突详情不能泄露无权访问的另一条记忆；记忆中的「指令」始终是不可信数据。

**子议题 2 补充专题确认：召回质量、上下文预算与反馈演进**（04 §补充2）

17. 总纲：采用「质量—预算—结果」三层指标和版本化策略闭环，先保证权限隔离、关键记忆召回、冲突和新鲜度正确，再优化上下文预算、延迟与成本；反馈必须区分记忆错误、召回错误、排序错误、融合错误、投影错误、任务执行错误和权限/治理错误；反馈只能影响相关性、纠正候选、过期标记和投影策略，不能自动改变 ACL、跨空间范围、敏感边界、工具权限或安全规则；敏感信息误召回、跨边界泄露和高风险错误作为不可被业务指标抵消的硬性护栏。
18. §1 三层指标：召回质量（有效记忆命中率、无关召回率、关键记忆漏召率、召回冲突率、新鲜度命中率、用户纠正率）；上下文与系统（记忆 token 占比、预算超限截断与降级率、记忆重复率、召回过滤重排融合延迟、每请求 token 与单位成功任务成本、缓存命中超时重试率）；任务结果与安全（任务成功率、首次解决率、重复提问率与人工接管率、因记忆导致的错误执行或回滚率、敏感信息误召回率、跨边界泄露率）。
19. §2 调优顺序与策略闭环：权限与隔离正确 → 关键记忆不漏召 → 冲突与新鲜度正确 → 上下文预算可控 → 延迟与成本优化 → 反馈驱动策略演进；召回策略、记忆内容和权限策略分开演进；第一阶段先建立固定评测集和完整 Trace，再进行小流量、分桶和可回滚实验，不直接用未经验证的在线自学习改变全局策略。
20. §3 反馈分类与作用边界：反馈可影响相关性排序、记忆纠正候选、过期或低价值标记、投影形式、后续是否主动展示；不能自动改变跨 User/Team/Project/租户的 ACL、敏感数据访问边界、记忆公开范围、工具权限和安全策略、默认训练范围、已撤回内容的恢复。
21. §4 上下文预算与降级：固定预算（Harness 安全规则）、优先预算（Task/Code/Project 关键上下文）、按需预算（Team/User 相关记忆）、扩展预算（历史经验和可展开引用）；超预算六步同 4.1 第 9 条；不能随机截断，不能让历史经验挤掉当前任务约束，也不能用扩大 token 预算解决权限或敏感性问题。
22. §5 评估、灰度与回滚：固定评测集 → 离线比较 → 小流量灰度 → 观察质量/成本/延迟/安全 → 达到门槛后扩大范围 → 保留策略版本和快速回滚；上线或扩大流量必须同时满足关键任务成功率不下降、无关召回率与冲突率与敏感误召回率不恶化、P95/P99 延迟与单位成本在预算内、用户纠正率与重复提问率不升高；任一安全硬指标超限立即停止灰度；策略回滚不能修改历史 Run Snapshot、Manifest 或审计记录。

**子议题深化 3：四类检索通道实现与索引选型**（04 §深化3，自动审核通过）

23. 采用「权威边界 + 四通道派生索引 + 统一安全编排」，分四层 Authority Layer（记忆内容、授权/用途决定、敏感性、版本、有效状态、血缘事实）/ Index Layer / Recall Orchestrator / Fusion-Projection；关键词、向量、代码邻近、关系血缘是互补通道，索引只用于加速候选发现，不能授予权限；「先召回、后隐藏」不合格；任一通道或过滤环节失败时不退化为全局不受控召回，默认收窄或拒绝。

**子议题深化 4：统一检索排序、融合算法和冲突裁决公式**（04 §深化4，自动审核通过）

24. 采用「先资格、后排序、再融合、按风险裁决」：Authorization/Purpose/Sensitivity/Validity Gate → Candidate Ranking → Evidence-aware Fusion → Conflict Decision → Projection/Execution Boundary；区分 `Eligibility`（可使用资格）与 `Utility`（候选内优先级），`Eligibility = false` 不能通过 `Utility` 变成可用；采用多维候选记录而非固化单一总分；去重与证据计数以来源/血缘为准，多通道命中不当作多份独立证据。

**子议题深化 5：不同 Harness 的完整上下文投影模板**（04 §深化5，自动审核通过）

25. 采用「能力配置 + 用途策略 + 风险预算 + 最小投影」（Capability Envelope / Purpose Projection Policy / Risk/Budget Guard / Evidence-bearing Projection）；采用两次授权复核和一次能力复核（Authority Check 1 → Capability Check → Projection → Authority Check 2），第二次复核不能省略；采用「直接内容、引用化、状态化、阻断」四级输出（Direct/Cited/Conditional/Blocked）；用保真约束而非固定字段保护上下文含义。

**子议题深化 6：每层、每类记忆的 token/条数预算**（04 §深化6，自动审核通过）

26. 预算不是权限；采用「授权候选内的多维预算包络」（Eligibility Gate → Capacity Envelope → Allocation View → Representation Choice → Deterministic Degradation → Audit View）；分配维度为 Harness × Task/Purpose × Risk × Memory Layer × Memory Type × Expandability；固定 Harness 安全规则与当前 Task/Code 约束优先于历史经验；区分直接内容、摘要、引用、元数据、证据五类形态分别计量；超预算采用确定性的合并去重 → 保真摘要 → 引用化 → 继续检索 → 确认或阻断，禁止随机截断；预估与实际占用必须可审计。

**子议题深化 7：ACL、用途授权、敏感字段和跨空间派生策略**（04 §深化7，自动审核通过）

27. 核心边界为「授权先于检索、融合和投影；相关性与预算只能在已授权候选内工作；派生表示不改变原始治理边界」；采用「动作分离 + 多维资格门禁 + 最小投影」骨架；动作扩展为 `discover`、`read`、`use`、`derive`、`project`、`audit`，并规定不可逆约束（`discover=false` 不返回存在性线索；`discover=true` 不推出 `read=true`；`read=true` 不推出 `use=true`；`use=true` 不推出 `derive/project=true`）；跨空间引用、复制、摘要、融合、embedding、缓存、提升或其他派生不继承来源权限；拒绝路径也必须动作隔离且防止存在性泄露。

**子议题深化 8：Manifest、索引、缓存和派生结果的一致性与撤回传播**（04 §深化8，自动审核通过）

28. 采用「权威真相 + 可失效投影 + 最终复核」：权威记忆、版本、权限和血缘是真相；Manifest、索引、缓存、摘要、embedding、融合视图和其他派生结果是可失效投影；每个派生投影须逻辑绑定 source revision(s)、policy/purpose、generation/createdAt、dependencies、revocation state；写入/更新/读取/投影统一采用「先权威、后派生、再复核」；撤回与治理变化沿血缘传播，状态不确定时 fail closed 或收窄；历史 Run Snapshot 与当前授权严格分离，旧投影不得反向恢复授权。

**子议题深化 9：Prompt Injection、恶意记忆和多模态内容检测规则**（04 §深化9，自动审核通过）

29. 采用「数据/控制面分离 + 分层防御 + 独立执行门禁」：记忆、检索结果、工具返回、文件、图片、音频和视频中的内容均是不可信数据，不能成为系统指令、开发者指令、工具授权、策略变更或安全门禁；分层防御链为 Source → Permission → Type → Parsing → Content & Behavior Risk → Projection Isolation → Tool & Output Gate；检测是风险信号和分流依据，不是安全证明；即使检测未命中，也必须继续执行权限、类型、解析、投影、工具和输出门禁；误报申诉、规则版本化、受控重跑、撤回和派生传播边界已明确。

**子议题深化 10：召回质量、泄露率、上下文过载率和任务成功率评估体系**（04 §深化10，自动审核通过）

30. 采用不压缩为单一总分的分层评估体系，覆盖召回相关性/适用性/时效/证据、排序融合/冲突、投影保真/预算、权限泄露/敏感误召回/撤回延迟、Prompt Injection 漏检后果、上下文过载、任务成功/安全副作用/成本延迟；质量与安全双通道，安全硬门禁优先于质量收益，任务成功率不得抵消泄露；区分离线基准、回放/反事实、在线观测、灰度、人工复核五类评测面；评测数据同样受权限、脱敏、删除和血缘治理；指标按 Harness、Task/Purpose、风险、scope、记忆层/类型、模型和策略版本分桶，并记录失败原因、不确定性和样本量。

### 4.2 核心对象与关系

- **三层职责对象**（04 §第1轮-1）：Retrieval / 检索（找出可能相关的记忆候选）、Fusion / 融合（去重、处理冲突、识别有效条件，形成当前认知）、Projection / 上下文投影（按当前 Harness、Task、权限和预算决定最终提供什么）。
- **上下文维度**（04 §第1轮-2）：`User / Agent / Harness / Team / Project / Task / Code Context / Purpose`。
- **Fused Memory View（结构化融合视图）**（04 §补充1-1）：`applicable_scope`、`conclusion`、`default_rule`、`exceptions`、`conflicts`、`confidence`/`verification`、`source_refs`、`effective_time`、`allowed_use`、`unresolved_questions`。
- **投影类型五分类**（04 §补充1-1）：`constraint`（必须遵守的工作约束）、`fact`（当前可参考事实）、`exception`（有边界的例外）、`suggestion`（建议或经验）、`dispute`（未解决冲突）。
- **Context Manifest**（03 §补充专题-3 给出记录字段；04 §深化8 给出投影绑定语义）：`memory_id`、`source_revision`、`owner_scope`、`inclusion_reason`、`authorization_context`、`policy_version`、`sensitivity_decision`、`redaction_state`；04 §深化8 强调 Manifest 须绑定 source revision、policy/purpose、generation/createdAt、依赖、撤回状态，并禁止「Manifest 存在或标记 ready 就是当前授权」。
- **四通道检索**（04 §深化3-1、-2）：关键词/Lexical（精确词、短语、标识符、错误码、路径）、向量/Semantic（概念、意图、主题、语义相似）、代码邻近/Code Proximity（文件、符号、定义引用、调用导入继承、测试与局部结构）、关系/血缘/Relation & Lineage（来源、派生、版本、依赖、影响、关联资产与跨层关系）。
- **四层实现架构**（04 §深化3-阶段3）：Authority Layer → Index Layer → Recall Orchestrator → Fusion / Projection。
- **候选排序资料包**（04 §深化4-阶段3）：`candidate` 含 `retrieval_signals`（channel/query intent/match reasons、channel-local rank or score）、`applicability`（task/code/harness/purpose scope、effective time and version fit）、`provenance`（source/owner/scope/lineage、authority and verification state）、`risk_and_conflict`（risk class/disclosure risk、conflict groups and unresolved uncertainty）、`policy_context`（eligibility decision、retrieval/ranking/fusion/projection policy versions）。
- **冲突类型**（04 §深化4-阶段1）：scope conflict、version conflict、temporal conflict、rule/exception、verification conflict、semantic conflict、provenance conflict。
- **投影逻辑输入与分层**（04 §深化5-阶段1）：Request Context、Harness Capability Profile、Memory Decision View、Risk & Budget Context → Projection Decision（直接内容/结构化约束/引用/脱敏摘要/待确认/阻断）；投影层次为 Safety/hard boundary、Task facts/current state、Decisions/exceptions、Evidence/citations、Uncertainty/blocked state；共同不变量为 source、scope、version、applicability、validity、uncertainty、blocking_reason。
- **四部分投影模板抽象**（04 §深化5-阶段3）：Capability Envelope、Purpose Projection Policy、Risk/Budget Guard、Evidence-bearing Projection。
- **预算包络对象**（04 §深化6-阶段3）：Eligibility Gate、Capacity Envelope、Allocation View、Representation Choice（Direct/Summary/Citation/Metadata/Evidence）、Deterministic Degradation、Audit View；预算维度为 Harness capability、Task/Purpose、Risk、Memory layer、Memory type、Context occupancy、Model/runtime；核算项含 estimated input tokens、reserved capacity、actual input tokens、memory direct/summary/citation/metadata/evidence usage、actual output/tool usage、degradation trace。
- **授权上下文八维度**（04 §深化7-2）：主体（principal）、scope、purpose、敏感性、来源权限、owner、related、derived。
- **六动作授权对象**（04 §深化7-1、§深化7-阶段3）：`discover`、`read`、`use`、`derive`、`project`、`audit`。
- **三类数据职责**（04 §深化8-1）：Authority（记忆内容、当前版本、权限/用途决定、敏感性、有效状态、血缘事实）、Projection（Manifest、倒排/向量/代码/关系索引、缓存、摘要、embedding、融合视图和投影结果）、Run History（历史 Run Snapshot、当时的输入、决定、策略版本和审计证据）。
- **派生结果最小可验证绑定**（04 §深化8-2）：`source revision(s)`、`policy / purpose used for derivation`、`generation / createdAt`、`direct and transitive dependencies`、`current / known revocation state`、`representation kind and producer context`、`recomputation / quarantine eligibility`。
- **投影专项对象边界表**（04 §深化8-7）：Manifest、关键词/向量/代码/关系索引、缓存、摘要/embedding、融合视图、下游投影/工具结果六类，各列出可承担职责、必须绑定/复核的逻辑事实、禁止推断。
- **风险族十类**（04 §深化9-3）：Prompt Injection、越权请求、秘密外传、数据投毒、恶意链接/附件、跨模态隐藏指令、对抗样本、编码/混淆、间接注入、重复/跨轮传播。
- **分层防御链七层**（04 §深化9-4）：Source → Permission → Type → Parsing → Content & Behavior Risk → Projection Isolation → Tool & Output Gate。
- **投影隔离三通道**（04 §深化9-8）：Trusted control plane、Untrusted data plane、Risk metadata。
- **评估树五层**（04 §深化10-阶段3）：Retrieval quality（relevance/applicability/freshness-validity/evidence-provenance sufficiency）、Ranking & fusion、Projection & budget、Security & governance、Task outcome。

### 4.3 状态与枚举

- **融合冲突最小状态**（04 §深化4-阶段3）：`usable`（已通过门禁且无阻断性冲突）、`conditional`（仅在明确 scope、时间、例外或验证条件下使用）、`dispute`（互斥主张尚未解决）、`needs_confirm`（需具备权限的主体或受控流程确认）、`blocked`（当前用途/风险不允许或状态无法证明安全）、`stale/revoked`（过期、撤回或版本不可用）。文档强调「状态不是排名的别名」。
- **投影四级输出**（04 §深化5-阶段3）：`Direct`、`Cited`、`Conditional`、`Blocked`；文档说明这不是新的权限模型也不是最终状态机。
- **预算降级序列**（04 §第1轮-8、§补充2-4、§深化6-阶段3）：保留 Harness 安全规则 → 保留 Task/Code 局部约束 → 保留 Project 必要事实 → 合并/压缩重复内容 → 次要内容引用化 → 继续检索 → 必要时提示上下文不足/请求确认/阻断。
- **三层指标**（04 §补充2-1）：召回质量、上下文与系统、任务结果与安全（具体指标见 4.1 第 18 条）。
- **调优顺序六步**（04 §补充2-2）：权限与隔离正确 → 关键记忆不漏召 → 冲突与新鲜度正确 → 上下文预算可控 → 延迟与成本优化 → 反馈驱动策略演进。
- **反馈分类七类**（04 §补充2-3）：记忆错误、召回错误、排序错误、融合错误、投影错误、任务执行错误、权限/治理错误。
- **资格与效用两分决定**（04 §深化4-阶段1）：`Eligibility`（是否满足授权、用途、敏感性、有效性和状态门禁）、`Utility`（可使用候选中哪些更适合当前任务和上下文预算）。
- **预算内容形态五类**（04 §深化6-阶段3）：`Direct`、`Summary`、`Citation`、`Metadata`、`Evidence`；预算分层为保护层与可变层。
- **不可信内容处置状态**（04 §深化9-阶段3）：`untrusted`、`risk-signaled`、`uncertain`、`quarantined`、`cited/narrowed`、`needs_review/confirmation`、`blocked/revoked`；文档强调 `not_detected`、`low risk`、`source trusted`、`user confirmed`、`model high confidence` 都不能单独转换为 `safe` 或 `authorized`。
- **能力不匹配情形枚举**（04 §深化5-阶段1）：能力不支持结构化/引用/脱敏；能力可处理但当前主体或用途无权；能力和授权均满足但预算不足；敏感性未知、撤回/过期或版本无法确认；存在未解决冲突；投影前后复核不一致。
- **五类评测面**（04 §深化10-阶段3）：离线基准、回放/反事实、在线观测、灰度、人工复核。
- **安全门禁与质量证据双通道**（04 §深化10-阶段3）：`Safety gate`（隔离、阻断、暂停灰度、回滚或进入事件处置）与 `Quality / efficiency evidence`（仅在安全门禁通过的候选中选择或继续校准）。
- **评估报告四视图**（04 §深化10-阶段3）：质量视图、安全视图、任务视图、回归视图。

### 4.4 角色与权限边界

- **动作分离**（04 §深化7-1）：`discover`、`read`、`use`、`derive`、`project`、`audit` 分别独立拒绝、独立审计；`derive` 与 `project` 不是 `read` 结果的自动后处理，而是对新动作、新受众、新表示和可能新 scope 的单独判断；`audit` 不能因「只是元数据」而默认公开。
- **动作间不可逆约束**（04 §深化7-1）：`discover=false` 时不返回对象是否存在、候选数量、排名、分数差、错误差异、关系路径；`discover=true` 不推出 `read=true`；`read=true` 不推出 `use=true`；`use=true` 不推出 `derive/project=true`；对象可用于业务动作不推出其完整审计可见性。
- **八维度职责划分**（04 §深化7-2）：principal（人/Agent/Harness/服务身份及代表谁执行；Agent 身份不自动等于其背后用户或 owner 的全部权限）、scope、purpose、敏感性、来源权限（不能由平台内部关系、缓存命中或历史授权替代）、owner（不是每次访问的自动批准者）、related（相关不等于授权）、derived（派生物不是新的无主数据）。
- **资格与效用完全分离**（04 §深化7-阶段3）：`Eligibility = action + principal + source/target scope + purpose + sensitivity + source permission + validity/revocation + owner/related/derived lineage constraints`；`Utility = relevance + task fit + freshness + evidence quality + budget`；只有 Eligibility 通过的候选才可进入排序、预算、融合或模型选择。
- **Harness Capability Profile ≠ 授权**（04 §深化5-阶段1）：Harness 声称支持工具、结构化输出或长上下文，不代表当前主体可访问任何工具、字段或 scope；授权通过也不代表该 Harness 具备安全展示或执行该内容的能力。
- **能力声明与授权与格式分离**（04 §深化5-阶段4 架构）：能力配置视为适配器输入，授权视为独立门禁，投影视为可替换表示层。
- **解释与审计的最小披露受众分层**（04 §深化9-阶段3）：普通用户/Harness 只能看到内容被收窄/引用/隔离/需确认/阻断及下一步；有权操作者可看风险族、来源/载体、解析范围、行为后果、处置决定和规则/策略版本；安全/审计主体可看受控来源引用、变换链、规则版本、决定、传播影响、重跑/撤回状态和证据位置，但都不能因审计扩大普通读取权限。
- **预算与相关性不改变权限**（04 §深化6、§深化7）：预算只在已授权候选内做删减和表示选择；相关性高、来源权威、跨通道多次命中、成本更低或任务收益更大均不能把资格失败变成资格通过。
- **反馈不改变治理**（04 §补充2-3）：反馈不能自动改变跨 User/Team/Project/租户的 ACL、敏感数据访问边界、记忆公开范围、工具权限和安全策略、默认训练范围、已撤回内容的恢复。
- **检测系统的权限约束**（04 §深化9-5）：检测系统本身不应读取无权原文来「帮忙判断」；允许看到一条内容不代表允许把它用于安全分类、训练、记忆巩固、工具调用或导出。
- **具体角色命名、RBAC/ABAC 矩阵、PDP/PEP 边界**：文档未明确（均列为暂缓项）。

### 4.5 关键规则与不变量

- **权限先行**（04 §第1轮-3）：「权限和用途决定『能不能使用』，相关性决定『值不值得优先使用』；相关性不能越过权限。」过滤必须在候选召回前生效，「不能先全库召回再隐藏结果」。
- **最小充分上下文**（04 §第1轮-6）：默认不提供完整原始对话、未授权 Project 内容、隔离与待审核内容、无法验证的推断、完整敏感字段、仅因语义相似召回的长篇历史；L2/L3 摘要不因是摘要而降低 ACL。
- **默认注入策略**（04 §第1轮-4）：Harness 安全规则 > 当前 Task 决策与验收标准 > 当前 Code/Project 约束 > Team 稳定规范 > User 表达偏好 > 历史经验 > 原始 L0 对话（默认不直接注入）；敏感事实仅在明确授权且用途匹配时使用；disputed/invalidated/isolated 默认不进入普通上下文。
- **冲突与例外**（04 §补充1-2）：普通记忆不能覆盖 Harness 安全规则；User 偏好不能覆盖 Project 或 Team 的安全与合规约束；例外必须绑定适用对象、范围、起止时间、来源、验证条件和失效条件，不能因一次性使用升级为 Project 或 Team 默认规则。
- **Harness 投影保真**（04 §深化5-阶段3）：不能省略来源、scope、版本、适用条件、有效性、不确定性和阻断理由所表达的语义；不能把 `constraint`/`fact`/`exception`/`suggestion`/`dispute` 混写成无条件命令；不能把历史、推断、建议或用户偏好伪装成当前系统规则；不能把外部工具返回内容、MCP resource 内容或记忆原文视为可信控制指令；不能通过压缩、翻译、摘要、引用、embedding 或跨 Harness 转换绕过原 scope 和撤回。
- **两次授权复核**（04 §深化5-阶段3）：Authority Check 1（候选是否允许被当前主体用于当前 Purpose）→ Capability Check → Projection → Authority Check 2（实际投影、摘要、引用和派生结果是否仍符合原授权与状态）；第二次复核不能省略，任何复核失败默认收窄或阻断。
- **失败安全**（04 §第1轮-9、§深化3-阶段3、§深化8-阶段3）：权限、归属、敏感分类、审计或过滤失败时默认 fail-closed；索引/过滤失败不退化为全局召回；投影状态未知、绑定缺失、依赖不完整或最终复核失败时减少可见范围或阻断，不把「不确定」解释成「仍然允许」。
- **隔离内容不可用**（04 §第1轮-9）：隔离、待审核、失效和高敏感内容不得进入普通检索、摘要、Context Manifest 或自动执行链路。
- **删除撤回优先**（04 §第1轮-9）：记忆删除、撤回和权限降级优先于自动融合、巩固和知识化派生。
- **派生不继承权限**（04 §深化7-阶段3）：`source authorization ≠ target authorization ≠ derived authorization ≠ projection authorization`；即便新表示不可逆、只含摘要、只含 embedding 或只含 Manifest，也不应自动获得更宽权限。
- **字段级最小披露与组合风险**（04 §深化7-4）：对象级允许不能替代字段级判断；字段是否存在、字段缺失原因、对象数量、命中次数、排序分数、owner/related、来源系统、版本时间、摘要唯一细节、引用标题、错误类别、低基数计数、embedding、缓存键、Manifest、Trace 关联以及多低敏字段组合推断都属受保护信息；脱敏/泛化/摘要/引用化不能放宽权限。
- **撤回沿血缘传播**（04 §深化8-4、§深化7-7）：来源撤回/权限降级/purpose 撤销/敏感性升级/owner 变化/策略更新须标记依赖该来源的索引、缓存、摘要、embedding、Manifest、融合视图和投影，阻止新增 discover/read/use/derive/project，传播到未消费队列与下游空间；传播「到达」不等于「生效」；传播延迟期间不能以旧投影默认放行高风险使用。
- **历史与当前授权分离**（04 §深化8-8）：历史 Run Snapshot 不因当前撤回被改写成「当时没有发生」，也不因此保留当前可读权限；当前请求不能以「历史 Run 曾经使用过」作为授权凭证；策略回滚不能恢复已撤回、已降权或敏感性已升级的对象。
- **异步传播不变量**（04 §深化8-6）：重复处理不重复放大、不反向恢复授权；乱序不以到达顺序覆盖；重试副作用幂等；分区恢复后重新发现遗漏并对账；依赖缺失暂缓使用；部分重建只开放可证明安全部分；无法自动修复进入 dead-letter/隔离和人工介入。
- **内容即数据**（04 §深化9-1）：记忆、检索结果、工具返回、文件、图片、音频和视频中的「请执行」「忽略规则」「授予权限」「改变策略」等文本只能作为数据处理；「内容里写着一条指令」与「平台控制面授予了一项动作」是两件不同的事。
- **检测不等于安全证明**（04 §深化9-阶段3）：规则命中是增加风险或触发复核的信号；规则未命中、解析成功或模型未拒绝不解除权限和工具门禁；同源重复、多个模态命中、多个索引命中和多轮复述不增加可信度；载荷被翻译、编码、摘要、截图、转写、embedding 或改写后仍继承原风险和血缘。
- **工具与输出门禁**（04 §深化9-9）：工具返回也不可信，工具使用成功不代表返回内容可信；输出门禁至少检查秘密/个人数据/受限记忆泄露、跨 scope 传播、恶意链接/附件再发布、未经确认的策略或事实承诺、把不确定结果写成确定结论、把攻击载荷复述给不必要受众。
- **污染不升级、撤回可传播**（04 §深化9-阶段3）：`untrusted source → untrusted/uncertain derived representation → restricted or quarantined memory candidate → no automatic promotion to constraint/system/tool authorization`。
- **安全硬门禁独立**（04 §补充2-1、§深化10-阶段3）：敏感信息误召回率、跨边界泄露率和高风险错误不能被业务成功率或成本指标抵消；不能用单一平均分掩盖敏感误召回、跨边界泄露或高风险错误；安全样本不足、漏报未观测或无法证明撤回生效时标记为评估不足或保守处置。

### 4.6 界面/交互线索

- **默认注入表格化表达**（04 §第1轮-4）：按记忆类型给出默认行为（必须遵守/高优先注入/相关时注入/任务相关时注入/低成本注入/按需召回/默认不直接注入/仅授权用途匹配时使用/默认不进入普通上下文）——可直接作为产品行为矩阵来源。
- **融合结果表达**（04 §第1轮-5、§补充1-2）：应能表达「项目默认使用 PostgreSQL；本任务明确例外使用 SQLite」，并附带例外范围（Task-123 / test-only）、例外期限、来源。
- **投影分层语义**（04 §深化5-阶段1）：Safety/hard boundary、Task facts/current state、Decisions/exceptions、Evidence/citations、Uncertainty/blocked state 五层，不应混成一段指令。
- **按 Harness 的投影重点矩阵**（04 §深化5-阶段1 表）：开发、运维、研究/分析、PM/规划、人员接手、通用对话六类，各列「可优先投影的内容层」「应特别保留的边界」「默认降级方向」。
- **降级与阻断的用户表达**（04 §深化5-阶段1、§深化6-阶段4 产品/UX）：能力不支持→选择更窄的已支持表示或阻断；无权→拒绝使用，不以改写/摘要/工具结果绕过；预算不足→按优先级收窄、次要内容引用化；敏感性未知/撤回过期/版本不明→只保留最小阻断状态；存在未解决冲突→低风险有限呈现争议与来源、高风险确认或阻断。阻断理由应足以帮助有权调用者采取下一步，但不暴露无权对象名称、内容、数量、冲突细节或敏感标签。
- **四通道的用户表达**（04 §深化3-阶段4 产品/UX）：对用户展示「为什么相关、来自哪个可授权通道、是否需要展开」，而不是数据库或模型术语；通道失败时显示有限、可行动的降级状态，不伪造「没有结果」。
- **单一冠军的问题**（04 §深化4-阶段4 产品/UX）：低风险场景给出简洁结论，同时让来源、适用范围和不确定性可展开；需要确认或阻断时说明下一步，不展示难以行动的内部分数。
- **投影质量解释**（04 §深化5-阶段4 产品/UX）：把「为什么看到这条、适用于哪里、能否展开、为什么被收窄/阻断」作为可解释体验；低风险对话可简洁，高风险执行必须显式显示条件和待确认状态。
- **预算的用户表达**（04 §深化6-阶段4 产品/UX）：以「已提供的最小充分内容、可展开引用、需要确认或无法安全提供」解释降级，不展示复杂配额和内部 token 细节；预算不足不能伪装成「没有这条记忆」。
- **安全解释分层表**（04 §深化9-阶段3）：按普通用户/Harness、有权操作者、安全/审计主体三档规定可说明内容与不应暴露内容；不要把「检测未命中」展示成「已证明安全」。
- **评估报告四视图**（04 §深化10-阶段3）：质量视图、安全视图、任务视图、回归视图——面向工程、治理和产品的展示语义。
- **具体 UI、模板文案、字段顺序、展示交互、控制台设计**：文档未明确（列为暂缓项）。

### 4.7 仍暂缓未定的内容

- 关键词、向量、代码邻近和关系/血缘检索的具体实现与索引选型（04 §第1轮暂缓、§深化3 暂缓）：具体数据库/引擎与部署拓扑与迁移方案、最终字段 Schema 与分区分片主键去重存储、分析器与向量模型与解析器覆盖与遍历表达、多通道固定权重阈值候选数与停止条件、容量与更新频率与重建窗口与延迟成本 SLA、授权用途敏感性过滤完整策略与跨空间派生协议、撤回迟到失效与重建事件协议与缓存失效传播与回填运维、四通道质量与泄露与时效与重建正确性评测集与阈值与灰度流程。
- 统一检索排序、融合算法和冲突裁决公式（04 §第1轮暂缓、§深化4 暂缓）：具体公式/归一化/权重/特征交互/冲突裁决计算、RRF 与学习排序与规则排序与分层排序最终选型、各维度阈值与候选数与窗口与停止条件与降级级别、来源权威性与验证状态与风险与独立证据的统一量化口径与标注规范、去重键与事实主张抽取与同源派生识别与冲突分组算法 Schema、`dispute`/确认/阻断/恢复/人工裁决完整状态机与授权角色与事件协议、解释与审计与策略版本与 Run Snapshot 最终字段留存脱敏与访问协议、离线评测集与标注指南与归因方法与灰度门槛与回滚触发器与 SLA、不同 Harness 与任务与风险等级的最终排序/融合/投影策略与兼容协议。
- 不同 Harness 的完整上下文投影模板（04 §第1轮暂缓、§深化5 暂缓）：最终模板/固定文案/字段顺序/展示交互、最终 Connector Contract 与字段 Schema 与版本兼容与错误码协议、各 Harness 具体能力矩阵、每类 Harness/Task/风险/内容类型的 token 条数延迟成本预算、直接内容与摘要与引用与脱敏与结构化输出的压缩算法与优先级公式、投影前后授权复核完整策略与字段级 ACL 与 Purpose 目录与跨空间派生规则、`direct`/`cited`/`conditional`/`blocked` 最终状态机与确认角色与事件协议与撤回传播、Harness 间投影迁移与缓存与版本回放与 Run Snapshot 与 Manifest 一致性协议、投影质量与语义保真与泄露率与任务收益与成本与失败安全评测集与阈值与灰度回滚流程、具体 MCP 或 OpenAI Responses API 或其他 Harness 接入实现与兼容清单。
- 每层、每类记忆的具体 token/条数预算（04 §第1轮暂缓、§深化6 暂缓）：各层各类型各 Harness 各 Task/Purpose 各风险级别的具体数值、保护层与可变层配额关系与借用回收规则与最终预算算法、五类形态固定压缩比例与优先级公式与最小语义单元、token 计数器与 tokenizer 与预估误差模型与 usage 采集与成本换算最终实现、跨层跨类型配额公平性与优先级与借用抢占与分步检索与阻断状态机、敏感内容摘要脱敏与引用标题计数与元数据最小披露字段级规则、不同模型窗口路由与压缩模型与缓存策略与成本函数与延迟目标与 SLA、预算 Trace/Manifest/Run Snapshot/usage/审计记录最终字段与采样与留存与删除传播、预算策略离线评测集与阈值与灰度门槛与回滚触发器与自动调参。
- ACL、用途授权、敏感字段和跨空间派生的完整策略（04 §第1轮暂缓、§深化7 暂缓）：最终 RBAC/ABAC/关系授权混合矩阵与角色属性命名与继承规则、六动作最终权限集合与组合逻辑与默认拒绝例外与状态机、最终策略语言与 PDP/PEP 服务边界与 API 与缓存一致性与决策延迟、敏感性分类表与字段 Schema 与字段片段标签与组合推断模型与最小披露阈值、脱敏泛化摘要引用化与 embedding 安全具体算法与不可逆性标准与质量阈值、owner/related/derived/来源权限/血缘最终数据模型与字段 Schema、跨 tenant/space 审批角色与转授权与同意记录与 purpose 绑定与导出训练规则、撤回降权策略更新传播最终事件协议、无权结果等价响应最终错误码与时序与分页与计数与缓存与观测实现、审计主体与审计字段与留存删除脱敏与取证权限与跨空间审计可见性、不同风险 Purpose Harness 目标 scope 的策略测试集与泄露指标与灰度门槛与回滚触发器与 SLA。
- Manifest、索引、缓存和派生结果的一致性与撤回传播协议（04 §第1轮暂缓、§深化8 暂缓）：各投影最终字段 Schema 与对象模型与版本命名、撤回与降权与敏感性变化与冲突与迟到传播最终事件 Schema 与事件类型与顺序与兼容规则、消息总线队列 watch 轮询 CDC Outbox 最终选型与部署拓扑、版本比较与因果关系与幂等键与去重与乱序处理与重试退避与对账补偿具体算法、dead-letter 与隔离与人工介入与重放回填重建最终状态机与角色与审批与恢复操作、缓存键与分区与共享范围与失效策略 TTL 预热回源与跨 Harness 复用规则、各类索引更新频率与重建窗口与分区分片与物理删除与软失效与查询降级实现、派生摘要与 embedding 与融合视图与脱敏结果重算算法与模型版本与质量阈值与敏感性判定、写入与派生更新事务边界与提交语义与跨系统一致性模型与可用性延迟 SLA、写入状态与投影状态与撤回状态与外部错误最终 API 与错误码与分页计数与用户展示协议、历史 Run Snapshot 与 Manifest 与审计记录与派生结果留存删除脱敏取证及跨空间访问规则、传播完成度与新鲜度与撤回延迟与重建正确性与恢复时间与成本与告警阈值与灰度回滚目标。
- Prompt Injection、恶意记忆和多模态内容的完整检测规则（04 §第1轮暂缓、§深化9 暂缓）：最终分类标签与规则语言与完整检测清单、具体分类器与模型与 embedding/OCR/ASR/视频分析组件与组合方式与模型路由、各风险族分数阈值置信区间阻断等级候选窗口与人工确认条件、编码混淆隐写零宽字符对抗样本低质量媒体背景音视频采样嵌套附件完整解析覆盖与检测算法、各层最终服务边界与字段 Schema 与事件协议与 API、不可信内容与控制面之间的最终隔离载体与序列化格式、解析失败与未知类型与冲突风险与低置信 OCR/ASR 与模态覆盖不足与检测器不可用时的最终状态机与错误码与用户展示、记忆候选与摘要与 embedding 与索引与缓存与 Manifest 与工具结果与跨空间投影的污染判定与血缘闭包与重跑与撤回事件协议、误报申诉与人工复核与例外放行与规则版本与离线重跑与灰度回滚保留删除的最终角色审批与操作流程、安全解释与审计与攻击样本取证与敏感原件访问与最小披露最终字段留存与访问规则、多模态跨语言跨轮跨空间工具链与漏检后果评测集指标阈值红队方法与告警 SLA。
- 召回质量、泄露率、上下文过载率和任务成功率的完整评估体系（04 §第1轮暂缓、§补充2 暂缓、§深化10 暂缓）：各层指标最终公式与聚合方式与加权关系与总分仪表盘口径、各指标最终阈值与置信区间方法与最小样本量、企业专属评测集与攻击泄露样本与反事实构造集与标注指南与评测集拆分与污染检查与采样率、标注协议与裁决角色、泄露率与敏感误召回与撤回延迟与注入漏检后果与安全副作用最终分类严重度门禁条件与告警规则、在线观测与 Trace 与 Run Snapshot 与回放反事实与人工复核与灰度最终采集字段保留期采样访问角色与平台 API、分桶层级与小样本处理规则、回归基线与灰度门槛与自动暂停回滚触发器与人工升级与 SLA、评估数据与标签与原文载荷与 embedding 与摘要与索引与报表的血缘闭包与删除撤回传播协议、与质量收益成本延迟和用户满意度相关的最终取舍决策与产品展示。
- 其他（04 §第1轮暂缓、§补充1 暂缓、§补充2 暂缓）：不同记忆类型的完整冲突裁决算法和优先级矩阵、各 Harness 完整投影 Schema 与模板与兼容协议、冲突摘要与来源隐藏与脱敏展示详细规则、dispute 对检索 Manifest 和自动执行的精确状态转换、例外自动发现期限计算与失效检测算法、各指标口径与标注规范与目标阈值、统一离线评测集与反事实样本与线上归因方法、召回重排融合投影策略的具体模型与参数、各 Harness 与任务类型的具体预算降级与继续检索协议、反馈数据脱敏留存训练集准入与删除传播协议、A/B 实验与灰度审批与策略回滚完整运营流程、召回 Trace 完整 Schema 与采样率与审计存储策略。
