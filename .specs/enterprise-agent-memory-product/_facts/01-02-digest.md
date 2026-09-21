# 议题 1 / 议题 2 事实摘要（蒸馏稿）

来源（只读，未修改）：
- `.specs/enterprise-agent-memory-platform/01-跨 Harness 工作现场连续性.md`（7737 行，标题为“议题 1：跨执行者的工作连续性与现场恢复”）
- `.specs/enterprise-agent-memory-platform/02-记忆自动分层.md`（803 行）

说明：本文只摘录文档中真实存在的内容，未写的一律标注“文档未明确”。来源标注 `§N` 指文档 01 的 `### N.` 主结论编号；`§深化 N` / `§暂缓项深化 N` 指对应小节；`§2-深化 N` 指文档 02 的“子议题深化 N”。术语保留英文原词。

---

## 议题 1：跨 Harness 工作现场连续性

文档状态行：`**状态：已确认（原则层）**`。§一明确“当前已经形成原则层的连续性模型，但尚未形成可直接实施的完整 Schema、策略矩阵、接口协议和交互设计”。

### 1.1 已确认结论清单

主结论（`## 已确认结论` 下 `### N. xxx（已确认）`，原文编号跳过 9）：

1. **核心单位是 Work Thread**（§1）：`Work Thread / 工作线程` 是“一项尚未完成、可由不同人或不同 Agent/Harness 持续推进的工作”；它不是任务类型，也不是 Chat Session、Harness Session、某次 Run 或某个 Checkpoint；平台不按任务类型预先建模。
2. **交接是统一能力**（§2）：成员↔成员、成员↔Agent、Harness↔Harness、同一 Harness 跨会话恢复都属 `Handoff / 交接`；成员和 Harness 都是 `Executor / 执行者` 的不同类型。
3. **交接产物是 Continuation Package**（§3）：面向下一执行者提供“可理解、可验证、可继续推进的工作现场”，不是聊天记录复制，也不是固定 Prompt；应按成员 / 开发 Harness / 运维 Harness / 治理 Agent 分别投影，底层是同一项工作状态。
4. **现场恢复分层**（§4）：L1 语义续办（平台必须保证）/ L2 操作续办（平台与 Connector 共同保证）/ L3 环境续办（取决于 Connector、环境能力和当前授权）；平台不承诺迁移任意 Harness 的私有内部会话、私有推理、登录态、活跃进程或权限。
5. **续办通用信息类别**（§5）：工作身份、当前认知、进度、证据与工件、可恢复环境、治理与安全、交接记录。
6. **Work Thread 采用显式创建 + 自动识别 + 规则转正的混合模式**（§6）：明确创建直接转正；Harness Session/工作事件进入后产生 `Work Thread Candidate`，高置信自动转正，低置信请求确认或进入治理队列，普通短会话只保留为 L0；候选可撤回、可合并。
7. **Work Thread / Task / Execution / Session·Run / Checkpoint 关系**（§7，阶段性结论）：Work Thread 是跨执行者持续存在的工作主体；Task 是可验收目标/子目标；Execution 是一次推进尝试；Session/Run 是外部 Harness 容器、“不是平台的工作真源”；Checkpoint 是时间点快照。平台不把“上一段 Chat”当工作，也不把“某次 Run 成功”当 Work Thread 完成。
8. **单一规范归属，Owner 可为 Project 或 Team**（§8）：采用“单一规范归属（canonical owner）+ 多 Project 参与/关联”；边界为“参与 ≠ 所有、可见 ≠ 可修改、被影响 ≠ 负责、多方审批 ≠ 多重 owner”。
9. **Owner、Active Executor、Participant 与工作状态分别建模**（§10）：分别表达规范归属、当前执行者、参与协作、责任状态、工作状态；“认领不改变 owner”“责任转移必须显式交接”“交接确认不必然改变 canonical owner”。
10. **三组正交状态与动作级权限**（§11）：`work_status` / `responsibility_state` / `recovery_version_state`；权限分别控制 view、claim、evidence.append、checkpoint.create、handoff.request/accept/reject、status.propose/change、owner.transfer、complete/cancel/archive、context.resolve、share/publish。
11. **交接必须经接手者明确确认后才生效**（§12）：接手者可接受、拒绝、退回，超时“仅触发提醒或升级，不自动视为接受或拒绝”；确认只转移执行责任，不自动改变 canonical owner。
12. **Owner 转移采用受控 Transfer，责任与资源权限分离**（§13）：Transfer 流程含权限与资源影响预检、权限差异和不可访问资源报告、新 Owner 明确确认、必要时审批、发布新 owner revision、重新生成 Manifest；“Owner 转移 ≠ 资源权限自动转移”“≠ 历史证据复制”“≠ Team L3 自动升级”；Transfer 需幂等和并发控制。
13. **Continuation Package 采用规范状态与接手者投影**（§14）：由 `Canonical Work State + 原始证据` 经权限过滤与能力适配生成投影；内容区分 `confirmed_fact`/`inference`/`hypothesis`/`decision`/`failed_attempt`/`pending_action`/`constraint`/`unknown`；旧包不可变，包是可重建的派生物、不替代 L0 原始证据。
14. **V1 采用 L1 必须保证、L2 可验证、L3 能力声明与有限重连**（§15）：明确本节的 L1/L2/L3 是**现场恢复等级**，不是议题二的记忆分层；恢复能力按能力拆分记录（semantic_continuation、code_context/artifact_fetch、terminal_reconnect/container_resume、browser_resume、database_reconnect），不设单一“已恢复”字段。
15. **并行工作采用证据追加、提案/分支隔离与显式合并**（§16）：Evidence 只追加不覆盖；假设/方案先作为 Candidate/Proposal；互斥方向用 Branch 或派生 Work Thread 隔离；合并必须显式记录 `merge_id`、来源分支、目标、基线 revision、采纳/拒绝/冲突、验证者、审批者、新 revision。
16. **交接与恢复采用权限交集、按执行者投影和安全降级**（§17）：有效权限为多要素交集（Principal Identity ∩ Work Thread Grant ∩ Relation ∩ Resource ACL ∩ Connector Capability ∩ Credential Scope ∩ Inherited Policy ∩ Action Policy ∩ Delegation）；“A 原来能看 + B 现在能看 ≠ B 自动拥有 A 的全部权限”；凭据类信息不得进入续办包正文，只记录受 ACL 保护的 `credential_ref`。
17. **六层模型：阶段、Checkpoint、Revision、Manifest、Run Snapshot 与续办包**（§18）：`Work Phase` → `Checkpoint` → `Work Thread Revision` → `Context Manifest` → `Run Context Snapshot` → `Continuation Package`；不变量含“Phase 完成 ≠ Work Thread 完成”“Checkpoint ≠ 长期记忆”“Manifest 原子发布”；基于过期 Revision 的写入必须转为 Merge Candidate 或重新生成。
18. **Connector 采用 V1 最小接入协议**（§19）：V1 八项最小能力为 Handshake、Event Append、Idempotency+Cursor、Capability Declaration、Resource Reference、Health/Lease、Probe、Structured Result；“Connector 是适配边界，不是工作真源”“未知 ≠ 成功”“未探测 ≠ 可用”。
19. **现场恢复采用分层验证、任务级判定与接手确认**（§20）：“现场已恢复”不等于续办包已生成、上下文已加载或 Connector 已重连；判定为“平台恢复层结果 + 本次接手任务的最低要求 → 任务级恢复结论”，同一 Work Thread 对不同接手者可得出不同结论；V1 暂不要求统一综合质量分数。
20. **接手确认区分上下文确认与责任确认**（§21）：`Context Acknowledgement` 不转移执行责任，`Handoff Acceptance` 才承担执行责任；被指定、收到通知、打开 Work Thread、查看 Package、启动 Harness 或重连成功都不能单独视为接手确认；“接手 ≠ canonical owner 转移”“超时 / 沉默 ≠ 接受”。
21. **L1 / L2 / L3 采用分层验收与任务级判定**（§22）：L1 是所有安全续办的硬基线；L2、L3 是否必须通过由接手任务、Work Phase、Executor 类型和风险等级决定；缺口分 `blocking_gap`/`non_blocking_gap`/`unknown_gap`；“Connector 提供事实，平台负责任务级判定”。
22. **最低安全下一步采用最小可验证动作**（§23）：定义为“与当前接手任务相关、在当前授权范围内、低副作用、可逆或可控、结果可观察并能写回证据链的最小动作”；准入需同时满足 Relevance / Authorization / Risk / Reversibility / Observability / Evidence Link；默认只能从 R0/R1 选择。
23. **V1 采用恢复质量维度与硬护栏，不设统一总分**（§24）：九个维度（语义完整性、语义准确性、证据覆盖度、新鲜度、版本一致性、权限正确性、能力/环境可用性、缺口透明度、可继续性）；最重要的结果指标是“接手者能否在无需原执行者补充说明的情况下，安全完成最低安全下一步”。
24. **建立不可变的恢复证据链与审计关系**（§25）：链路为 L0 Evidence Reference → Revision → Manifest → Run Snapshot → 接手者专属 Package Projection → Recovery Attempt → Minimum Safe Action → Verification Result → Handoff Acceptance；五类最小审计记录为 `RecoveryAttempt`、`ContextBinding`、`ObjectResult`、`MinimumActionRecord`、`HandoffAcceptanceRecord`。
25. **面向不同角色采用 Canonical Recovery Result 的受控投影**（§26）：由同一规范恢复结果生成 Member / Harness / Governance / Audit·Security 投影；三层信息表达为任务级结论 → 恢复解释 → 证据与审计；“一个规范恢复结果，多种受控投影”。
26. **Work Thread 采用默认连续、边界变化才拆分的关系模型**（§27）：不因复杂度、步骤增加、多人参与、Session 变化或 Harness 切换自动拆分；同一目标新步骤→Task/Work Phase，并行方案→Work Branch，独立 owner/权限/交付物/生命周期→Derived Work Thread，目标或治理边界实质独立→New Work Thread / Split。

暂缓项深化（`§暂缓项深化 1–8` 的“本轮确认”）：

27. **拆分/派生判定阈值**（§暂缓项深化 1）：采用“硬门禁 + 决策矩阵 + 候选确认”，不使用单一相似度、时间间隔或失败次数阈值；区分 Continue / Branch / Follow-up / Derived；跨 tenant、Owner、权限、敏感性、责任、独立审计边界变化属硬门禁；自动识别器只生成 `continue_candidate`/`branch_candidate`/`follow_up_candidate`/`derived_candidate`。
28. **Branch / Derived / Follow-up 数据模型**（§暂缓项深化 2）：用 `WorkThreadRelation`、`ContextTransfer`、`LifecycleLink` 三类对象分离建模，不用单一 `parent_id`；ContextTransfer 的继承模式至少区分 `none`/`selected`/`summarized`/`redacted`/`reference_only`。
29. **合并冲突算法**（§暂缓项深化 3）：绑定共同基线做三方比较，不使用最后写入者/最高置信度/最新时间/参与人数/模型投票裁决；区分可合并差异、直接冲突、关系不明；M0 自动合并低风险追加变化，M1 生成 `merge_candidate / needs_review`，M2 阻断并建立 `MergeConflict`；可按 Git `rerere` 思路受控复用历史低风险解决模式。
30. **完成验收模板**（§暂缓项深化 4）：采用“通用验收骨架 + 场景模板 + 组织/行业扩展项”；优先覆盖软件开发、Incident、研究分析、规划决策、知识资产、合规安全、数据处理七类场景；运行成功、产物存在、Harness 宣称完成或 Owner 点击完成都不能单独决定 `completed`。
31. **reopen / follow-up / derive 交互流程**（§暂缓项深化 5）：reopen 纠正原完成/取消判定，follow-up 承接相关新周期（原 Thread 保持终态），derive 用于目标/Owner/权限/用途/敏感性/生命周期/合规责任实质变化；三者都要记录原因和证据、展示影响预览；用户侧统一入口是“继续处理这项工作”。
32. **归档保留与恢复策略**（§暂缓项深化 6）：保留按对象类型、风险、业务生命周期、合规、保留锁定和活动引用关系计算；`archived`/`cold`/`restricted·pending_disposal` 与删除分开建模；访问用途分 view / audit / lineage_reference / follow_up_source / derive_source / restore_work / restore_environment；四类恢复为查询恢复、引用恢复、工作恢复、环境恢复。
33. **终态后的权限矩阵**（§暂缓项深化 7）：终态后权限不自动消失也不自动完整保留，按主体、资源、动作、用途、作用域、敏感性、血缘、风险和策略版本重新计算；禁止普通追加，纠错用追加式 `correction_record`；治理 Agent 只能 detect / explain / propose / open_review / request_revalidation。
34. **自动拆分、自动合并与治理 Agent 介入规则**（§暂缓项深化 8）：M0 低风险可逆证据充分可按预批规则自动处理；M1 只生成候选、预览和待审核项；M2 涉及权限、Owner、敏感性、安全、生产、不可逆、基线不明或高影响冲突时阻断升级；“不把自动识别当作自动转正，不把自动合并当作自动采纳结论，也不把治理 Agent 的建议当作治理 Agent 的执行”。

子议题深化的确认结论（`§子议题深化 N` 的“本轮确认”/“经用户确认的结论”）：

35. **核心对象**（§子议题深化 1）：Work Thread、Work State、Task、Work Phase、Execution、Harness Session/Run、Checkpoint、Revision、Context Manifest、Run Context Snapshot、Continuation Package、Handoff、Evidence、Recovery Attempt、Verification Result 分别建模；“Session/Run 不是工作真源”，`Manifest ≠ Run Context Snapshot`。
36. **交接**（§子议题深化 2）：交接状态为 `handoff_requested → handoff_ready → permission_checked → handoff_pending → receiver_confirmed → responsibility_transferred`；`handoff_pending` 阶段允许有限并发但不允许双重责任不明；自动接管默认只允许标记 orphaned、生成 Handoff Candidate、通知、生成最小恢复 Package 和执行预批低风险止损；Break-Glass 必须绑定 Incident 并事后复核。
37. **归属**（§子议题深化 3）：将一个 `canonical_owner_scope` 与 Owner、Executor、Participant、Producer、Beneficiary、Referenced Scope、Affected Scope 分开建模；“参与 ≠ 所有、执行 ≠ 归属、被影响 ≠ 负责、受益 ≠ Owner、Agent 执行 ≠ Agent 成为 Owner”。
38. **版本**（§子议题深化 4）：采用“规范 Work Thread Revision + 追加事件 + 投影版本 + 实际快照”混合版本模型；强不可变对象含 L0 原始事件、Revision、Run Context Snapshot、已发送 Package、Handoff Acceptance、已执行动作记录、Verification Result、审计记录；Manifest、检索结果、治理建议、草稿 Package 可重算但历史实际投影不得静默改写；版本变化只做局部失效。
39. **拆分**（§子议题深化 5）：采用 `Continue / Branch / Follow-up / Derived` 四分法并保留 New Work Thread / related；默认引用、选定证据、摘要或脱敏转移，不全量继承对话、权限、工具能力、审批和未验证推断；父子状态默认独立，源变化通过 LifecycleLink 传播影响。
40. **合并**（§子议题深化 6）：合并必须绑定明确共同基线或可验证来源关系；采用共同基线上的三方比较；合并生成新的父 Thread Revision，不覆盖分支/Evidence/Snapshot/Package/审计/验证历史；合并后重新计算 Owner、ACL、敏感性、用途、血缘、Manifest、验收、Tool Policy、RunGate 和执行资格；“不能通过多个 M0 动作绕过 M2”。
41. **终态权限**（§子议题深化 7）：采用“角色骨架 + 动态条件授权”；动作分别授权；“当前 ACL 和用途限制优先于历史曾经拥有的权限”；“历史可追溯不等于当前正文可见”。
42. **自动化与治理 Agent**（§子议题深化 8）：自动化分 M0/M1/M2；`Candidate`、`Admission`、`Approval`、`Execution`、`Verification`、`Adoption`、`Reverse`、`Escalate` 分开建模；批量动作必须重算累计风险和传播闭包。
43. **对象、关系与 Schema 边界**（§子议题深化 9）：采用规范对象、追加事件、不可变快照和派生投影的分层模型；`WorkThreadRelation`、`ContextTransfer`、`LifecycleLink` 分开；Schema 版本、业务 Revision、策略版本和存储并发版本分开；“Schema 校验通过不代表动作获准、执行成功、业务结果正确或知识可发布”。
44. **版本、事件与一致性**（§子议题深化 10）：Schema 版本、业务 Revision、策略版本、存储并发版本和执行 Trace 分开；事件支持唯一 ID、幂等键、重复识别、迟到、乱序、隔离、补偿和审计；迟到或乱序事件不得用最后到达原则覆盖当前规范状态。
45. **拆分、派生与关系图**（§子议题深化 11）：采用受约束的类型化有向关系图；禁止自环和关键关系循环；关系可达、上下文可达、血缘可达、权限可达和生命周期影响闭包分开计算；“关系存在不等于内容可见、权限继承、责任转移或可执行资格”。
46. **合并算法与冲突解决**（§子议题深化 12）：语义单元为主、字段和对象为辅、合并后做跨单元约束验证；`MergeCandidate`、`MergeConflict`、`MergePolicy` 分开；N 方合并基于共同基线和全局约束；批量合并先单项准入再做批次组合风险与传播闭包检查。
47. **完成、恢复与生命周期**（§子议题深化 13）：Work、Deliverable、Verification、Acceptance、Risk、Publication、Follow-up、Retention、Recovery 分别建模；由当前 Task、Work Phase、风险、Evidence 和权限计算 `Canonical Work Conclusion` 与 `Canonical Recovery Result`；完成/恢复/撤回/处置 SLA 按风险、阶段、资源和外部依赖配置，不设统一 SLA。
48. **权限、治理与高风险操作**（§子议题深化 14）：采用 RBAC 职责骨架 + ABAC / Purpose / Scope 动态授权 + 独立 Admission / Approval / RunGate；动作级权限含 `view_existence`/`view_metadata`/`view_summary`/`view_detail`/`view_redacted`/`view_original`/`view_evidence`/`view_audit`/`view_lineage`/`retrieve`/`inject_context`/`append_evidence`/`append_correction`/`request_reopen`/`approve_reopen`/`create_follow_up`/`create_derived`/`change_owner`/`change_acl`/`change_policy`/`export`/`share`/`publish`/`revoke_publication`/`delete`/`anonymize`/`execute_tool`/`production_change`；“批量逐项允许 ≠ 批次整体安全”。
49. **Connector、跨 Harness 运行与环境恢复协议**（§子议题深化 15）：Connector Contract V1 统一承担八项能力但不是 Work Thread / Canonical Owner / 最终 ACL / 审批 / 知识发布 / 保留策略真源；L1 由平台保证、L2 由 Connector 协助获取与验证、L3 由 Connector/Environment 按能力支持；跨 Harness 只转移规范状态和受控投影。
50. **Connector Contract V1 Schema、错误码与兼容**（§子议题深化 16，3 轮确认）：双层结构“稳定公共信封 + 操作类型分层 + 版本化 Payload + 能力协商 + 结构化结果/错误”；可用性拆为协议兼容、能力兼容、身份与授权、资源兼容、风险与策略五维，不用单一 `compatible: true/false`；分层缓存 + 主动失效 + TTL 兜底 + 执行前重检 + 单飞重算 + 代次保护；`assessment.valid` ≠ `execution.eligible`。
51. **Connector 可信身份、能力认证、撤销与密钥轮换**（§子议题深化 17）：身份、能力、授权、租约、资源、执行资格分离；身份至少分 Logical / Deployment / Instance / Credential·Key Identity 与 Workload Attestation；企业级默认方向为企业身份或工作负载身份 + 短期凭证或租约 + 注册与能力证明 + 平台授权 + RunGate，长期 API Key 不作默认方案；撤销分凭证、实例、部署、单项能力、组织/租户。
52. **离线补发、缺口、乱序、重放与补偿**（§子议题深化 18，2 轮确认）：采用事件接纳状态机与 `Gap Record + Impact Assessment` 两层模型，Gap Record 不直接等于业务失败；Source / Acceptance / Processing / Projection 四类 Cursor 分离；`message_id` 处理消息级重复、`idempotency_key` 处理业务意图级重复。
53. **L3 环境恢复的幂等、安全与外部副作用边界**（§子议题深化 19）：区分 reconnect / rebuild / restore_original，重连优先于重建、重建优先于原环境恢复；不恢复旧凭据、旧审批、旧 Tool Policy、私有 Prompt、私有推理或私有 Session；未知外部状态不得自动重复提交；`original_restored` 必须有证据支持。
54. **MCP、A2A 与 Connector Contract 映射与版本兼容**（§子议题深化 20）：通过显式 Protocol Adapter 接入；外部协议版本、Adapter 版本、Connector Contract 版本、Payload/Event Schema 版本分开记录；映射结果区分 `mapped`/`mapped_with_loss`/`unsupported`/`requires_platform_follow_up`/`rejected_for_policy`。
55. **Harness Cache 撤回与外部缓存清除验证**（§子议题深化 21）：缓存分层治理；“平台删除不等于外部副本清除”；清除结果区分已清除、部分清除、不支持、不可达、未知和受保留/法律锁定阻断；`unknown` 时至少停止新检索、注入、导出和传播；Connector/Harness 的 `cleared` 只证明其声明范围内的结果。
56. **Trace 采样、脱敏、长期保留与审计闭包**（§子议题深化 22）：Trace Context、Span/Link、Sanitized Telemetry、Audit Record、Business Evidence 和 Event 分开；脱敏尽量在采集边界完成；Audit Record 必须记录 Trace 是否存在、采样/脱敏事实和缺口原因；“Trace 缺失不等于动作未发生”；Trace 默认短于业务审计和规范事件保留期。
57. **Connector 失败重试、降级与人工接管**（§子议题深化 23）：失败按协议/校验/认证/授权/能力/限流/暂时依赖/资源冲突/策略阻断/外部效果未知/部分成功/unknown 分类，不同类别不能共享默认重试；传输重试不等于业务动作重做；重试耗尽、策略变化、Connector 撤销、外部状态未知和风险预算耗尽必须终止、隔离、升级或人工处理，不得永久 pending。
58. **能力不匹配时的替代 Harness 选择与交接候选**（§子议题深化 24）：能力不匹配按不支持/部分支持/暂时不可用/已撤销/未验证/策略阻断/资源不兼容/风险不可接受/身份或租约无效区分；推荐、接受、交接请求、接手确认、责任转移和执行资格严格分离；`unknown` 不得自动视为 eligible。
59. **Connector 监控、SLA、兼容测试与 UI/API**（§子议题深化 25）：健康、就绪、能力、协议兼容、身份/租约、授权、资源可达性、运行结果和验证结果分层；SLA/SLO 绑定 Scope、Operation、窗口、目标、排除项、证据来源、错误预算、降级和升级策略；平台不应无条件承诺外部 Harness 可用性、原环境恢复、外部副作用完成、所有缓存物理清除和 unknown 状态自动消除；健康或 SLA 达标不等于业务完成。

### 1.2 核心对象与关系

对象职责（§子议题深化 1，原文定义）：

- **Work Thread**：跨执行者持续存在的工作主体。
- **Work State**：某个 Revision 下的规范工作状态，不替代原始事件和 Evidence。
- **Task / Work Phase**：Work Thread 内可分配、推进、暂停、取消或验收的目标/阶段。
- **Execution**：某个 Executor 对 Work Thread 或 Task 的一次实际推进尝试。
- **Harness Session / Run**：外部 Harness 的会话或运行容器，不拥有平台工作状态。
- **Checkpoint**：某个时间点的可恢复检查点，不等于 Work Thread 或 Session 复制。
- **Revision**：Work Thread 或重要对象的不可变版本，用于比较、交接、授权、血缘和冲突处理。
- **Context Manifest**：针对当前主体、Harness、Task、用途和权限解析出的允许上下文集合；必须原子发布。
- **Run Context Snapshot**：某次 Run 实际获得的不可变上下文快照，不热更新。
- **Continuation Package**：面向下一 Executor 的续办投影，不是完整聊天记录复制。
- **Handoff**：执行责任或上下文的显式交接过程，不自动改变 canonical Owner。
- **Evidence**：支持、反驳或说明 Work State 的来源材料，追加式保存。
- **Recovery Attempt**：L1/L2/L3 工作现场恢复尝试。
- **Verification Result**：对恢复、事实、交付物、动作或环境状态的独立验证结果。

层级关系（§7）：`Team → Project / 归属与权限边界 → Work Thread`，Work Thread 下挂 Work State、Task、Execution（→ Harness Session / Run）、Checkpoint、Handoff、Continuation Package。§子议题深化 1 补充关系式为 `Work Thread ├── has Work State ├── contains Task / Work Phase ├── has Execution ├── produces Revision ├── creates Checkpoint ├── resolves Context Manifest ├── creates Continuation Package ├── records Handoff ├── references Evidence ├── attempts Recovery └── records Verification Result`，并强调“这些关系不是简单的普通父子层级”。

归属与角色对象（§8、§子议题深化 3）：`Work Thread ├── canonical_owner_scope（Project 或 Team）├── participating_projects ├── referenced_projects └── affected_projects / external_resources`；§子议题深化 3 扩展为 canonical_owner_scope、active_executor、participants、producers、beneficiaries、referenced_scopes、affected_scopes，不压缩为单一 `owner` 或 `assignee`。

交接对象（§子议题深化 2）：`Handoff ├── source_executor ├── target_executor ├── source_revision ├── package_version ├── permission_check ├── receiver_confirmation └── resulting_responsibility`；接手确认至少绑定 `work_thread_id`、`handoff_id`、`work_thread_revision`、`context_manifest_id`、`continuation_package_version`、`run_context_snapshot_id`、权限与能力快照、恢复状态与缺口、最低安全下一步、确认方式和时间（§21）。

关系与转移对象（§暂缓项深化 2）：`WorkThreadRelation`（relation_id、source/target thread 与 version、relation_type、reason、trigger、created_by、created_at、status、audit_refs）、`ContextTransfer`（transfer_id、source/target、selected_refs、excluded_refs、transfer_mode、purpose、sensitivity_before/after、permission_decision、revalidation_required、status）、`LifecycleLink`（source/target thread、source_change_policy、revoke_policy、pause_policy、notify_policy、status）。关系类型含 `branch_of`、`follow_up_of`、`derived_from`、`supersedes`、`related_to`，以及协作类 related_to/blocks/blocked_by/depends_on、结果语义类 causes/caused_by/implements/reviews/duplicates/supersedes、生命周期与血缘类 source_of/references/retracted_from/propagates_to（§子议题深化 11）。

Merge 对象（§子议题深化 12）：`MergeCandidate`（candidate_id、target_thread、base_revision、participant_revisions、merge_policy_version、input_manifest_versions、candidate_changes、conflict_refs、risk_preview、required_verification、status、expires_at）、`MergeConflict`（conflict_id、base/left/right_revision、object_refs、conflict_dimensions、evidence/counter_evidence_refs、risk_level、security/permission/ownership_impact、recommended_action、resolver、status）、`MergePolicy`（policy_id、scope、object_types、allowed_strategies、risk_class、hard_gates、required_evidence/approvals、revalidation_rules、batch_rules、expiry、policy_version）。

Connector 对象（§19、§子议题深化 15）：Connector 是外部 Harness 与 Memory Platform 的适配边界，八个 V1 操作；Handshake 至少绑定 `protocol_version`、`connector_id/version`、`harness_id/version`、`instance_id`、`principal_identity`、`tenant/workspace_scope`、`capability_profile`、`credential_reference`；Resource Reference 记录 resource_type/id/locator、source_system、revision、content_hash、observed_at、expires_at、access_requirements、sensitivity、current_status；Health/Lease 记录 connector_health、instance_health、lease_id、lease_expires_at、last_seen_at、revoked_at。

审计对象（§25）：`RecoveryAttempt`、`ContextBinding`、`ObjectResult`、`MinimumActionRecord`、`HandoffAcceptanceRecord`。

文档未明确：最终数据库表与字段 Schema、不可变存储实现、事件协议、对象 API、查询索引，均列为暂缓（§子议题深化 1 / 3、§25）。

### 1.3 状态与枚举

三组正交状态（§11）：

- `work_status`：`candidate → active → paused / blocked → active`，另有 `completed`、`cancelled`、`archived`；“paused 不等于 blocked；completed 不等于 archived；cancelled 不等于删除”。
- `responsibility_state`：`unassigned → claimed → accepted`，`└→ handoff_pending → accepted / rejected / returned`，`orphaned → reassigned / handoff_pending`。
- `recovery_version_state`（字段非枚举）：当前 Context Manifest 与 Continuation Package 版本、最近 Checkpoint / Run Context Snapshot、L1/L2/L3 可用性、是否过期/需重新解析/存在冲突或恢复缺口。

恢复分层（§4、§15、§22）：`L1 语义续办`、`L2 操作续办`、`L3 环境续办`；能力维度 `semantic_continuation: platform-guaranteed`、`code_context / artifact_fetch: connector-supported`、`terminal_reconnect / container_resume: environment-dependent`、`browser_resume: connector-dependent or unsupported`、`database_reconnect: permission-dependent`。

恢复结果枚举（§15 / §19 / §20 / §22）：`not_attempted`、`restored`、`restored_with_gaps`、`partially_restored`、`not_restored`、`blocked`、`expired`、`permission_denied`、`unavailable`、`unsupported`。缺口类型（§22）：`blocking_gap`、`non_blocking_gap`、`unknown_gap`。

恢复质量维度证据状态（§24）：`verified`、`partially_verified`、`not_verified`、`unknown`、`not_applicable`。

Handoff 生命周期（§12、§子议题深化 2）：普通低风险为 `handoff_requested → handoff_pending → handoff_accepted`；复杂或高风险为 `handoff_requested → handoff_ready → permission_checked → handoff_pending → handoff_accepted`；§子议题深化 2 采用 `handoff_requested → handoff_ready → permission_checked → handoff_pending → receiver_confirmed → responsibility_transferred`。异常与结果值：`handoff_rejected`、`handoff_returned`、`handoff_expired`、`handoff_withdrawn`、`handoff_failed`、`handoff_accepted`、`handoff_accepted_with_gaps`、`handoff_blocked`、`handoff_unknown`。接手者可动作：`accept`、`reject`、`return_for_completion`、`request_more_context`、`request_permission`、`request_owner_escalation`。

接手确认结果（§21）：`acknowledged`、`accepted`、`accepted_with_gaps`、`returned`、`rejected`、`expired`、`invalidated`。

内容访问与投影结果（§17、§25、§子议题深化 2）：`allowed`、`redacted`、`denied`、`unknown`；§子议题深化 2 另加 `stale`、`revalidation_required`。权限类别（§17）：Work Thread / Context View、Evidence Read、Tool Execute、Production Change、Approval、Owner Transfer、Knowledge Publish。

动作级权限枚举（§11、§子议题深化 7、§子议题深化 14）：view、claim、evidence.append、checkpoint.create、handoff.request/accept/reject、status.propose/change、owner.transfer、complete/cancel/archive、context.resolve、share/publish；终态后动作含 view_summary、view_detail、view_evidence、view_audit、view_lineage、append_correction、create_checkpoint、request_reopen、approve_reopen、create_follow_up、create_derived、restore_work、restore_environment、export、share、publish、revoke、delete、change_owner、change_retention_policy。

最低安全下一步（§23）：风险分级 `R0 无副作用观察`、`R1 低风险、可逆验证`、`R2 可能影响资源或执行环境`、`R3 生产、高影响、不可逆或跨边界操作`；声明字段 `required_capabilities`、`required_evidence`、`minimum_safe_action`、`verification_target`、`risk_class`；替代路径 `original_resume`、`reconnect`、`refetch`、`rebuild`、`manual_fallback`。

自动化分级（§暂缓项深化 3 / 8、§子议题深化 8）：`M0 自动合并/自动处理`、`M1 merge_candidate / needs_review`、`M2 blocked / human handling`。M1 人工解决选项含 `adopt_a`、`adopt_b`、`adopt_both_with_conditions`、`create_new_resolution`、`keep_both_as_hypotheses`、`keep_as_reference`、`reject`、`escalate_to_m2`（§暂缓项深化 3）。

关系与派生状态（§暂缓项深化 2、§子议题深化 11）：Branch `proposed / active / paused / selected / merged / rejected / abandoned / superseded / archived`；Follow-up 触发类型 `post_completion_review`、`new_incident`、`new_requirement`、`monitoring_regression`、`customer_follow_up`、`scheduled_revalidation`、`owner_requested`；Derived 需 `source_scope`、`target_scope`、`target_owner`、`target_purpose`、`permission_boundary`、`sensitivity_state`、`lineage_refs`；合并结果标记 `adopted`、`rejected`、`superseded`、`kept_as_reference`、`disputed`；MergeConflict 状态 `open / under_review / needs_more_evidence / resolved / rejected / superseded / cancelled`，§子议题深化 12 另加 `coexist`、`conditional`、`blocked`。

版本与失效（§子议题深化 4）：`manifest_stale`、`handoff_revalidation_required`、`verification_expired`、`approval_invalidated`、`action_blocked`、`resource_reference_stale`；时间字段 `occurred_at`、`observed_at`、`generated_at`、`executed_at`、`verified_at`、`accepted_at`、`expired_at`、`invalidated_at`、`corrected_at`（§25）。

保留与恢复（§暂缓项深化 6）：保留状态 `online`、`archived`、`cold`、`restricted / pending_disposal`；保留锁定原因 `legal_hold`、`active_incident`、`open_audit`、`unresolved_dispute`、`security_investigation`、`regulatory_review`、`active_lineage_dependency`；提前处置触发 `privacy_request`、`secret_exposure`、`invalid_consent`、`policy_violation`、`source_retraction`、`unlawful_retention`；保留策略类型 `required_until_event`、`required_while_referenced`、`business_retention`、`minimum_retention`、`disposable`、`indefinite_by_policy`；恢复结果 `restored_for_view`、`restored_for_reference`、`restored_for_work`、`environment_reconnected`、`restore_blocked`、`restore_partial`、`restore_unknown`。

Connector 相关枚举（§子议题深化 16–25，摘要）：能力结果区分支持/带约束支持/暂时不可用/部分支持/不支持/未验证/已撤销/未知；策略结果区分允许、带义务允许、先 Probe、需要审批、仅只读、需要交接、延期、拒绝、未知；认证结果含 `identity_verified`、`credential_valid`、`credential_expiring`、`credential_revoked`、`instance_unrecognized`、`audience_mismatch`、`attestation_missing`、`attestation_stale`、`trust_unknown`；事件接纳状态机 `created → signed_or_authenticated → submitted → received → deduplicated → accepted → ordered_or_quarantined → processed → projected → reconciled`；离线补发投影 `full_replay` / `metadata_only_replay` / `redacted_replay` / `reference_only` / `manual_export` / `unrecoverable_with_evidence`；恢复动作结果 `reconnected` / `rebuilt` / `original_restored` / `partially_restored` / `restored_but_unverified` / `blocked` / `failed` / `unknown`；映射结果 `mapped` / `mapped_with_loss` / `unsupported` / `requires_platform_follow_up` / `rejected_for_policy`；外部清除结果 `requested` / `accepted` / `in_progress` / `cleared` / `cleared_with_evidence` / `partially_cleared` / `not_supported` / `unreachable` / `unknown` / `blocked_by_retention_or_legal_hold`；失败分类 `protocol_error`、`validation_error`、`authentication_error`、`authorization_error`、`capability_error`、`rate_limited`、`transient_dependency_error`、`connector_unavailable`、`resource_conflict`、`policy_blocked`、`external_effect_unknown`、`partial_result`、`unknown`；监控 UI 聚合状态 `healthy`、`partially_available`、`needs_probe`、`degraded`、`blocked`、`revoked`、`stale`、`unknown`。

### 1.4 角色与权限边界

- **Canonical Owner**（§8、§11）：负责整体目标、默认状态、生命周期、交接、版本发布、冲突升级和最终关闭；不得绕过其他资源自身的 ACL、审批和高风险操作策略。
- **Active Executor**：当前实际推进工作的成员、Agent 或 Harness，可随执行变化；认领只改变 active executor，不改变 canonical owner（§10）。
- **Participant Project / Team**：在授权范围内查看上下文、添加证据、执行 Task、提出结论、参与交接和审批；不自动拥有整体目标修改权、所有权转移权或关闭权（§8、§11）。
- **Referenced / Affected Project**：作为引用对象、资源提供方或受影响方进入工作关系；“不因被引用或受影响而获得 Work Thread 访问或修改权”（§8）。
- **Previous Executor**（§暂缓项深化 7）：默认只保留授权范围内的历史可见性，不因曾执行过就拥有恢复或导出权。
- **Target Owner**：可确认 Follow-up 或 Derived，但不因此获得源 Thread 全部内容（§暂缓项深化 7）。
- **Auditor**：可以审计授权范围内的事件，不自动读取正文（§暂缓项深化 7）。
- **Governance Agent**（§11、§17、§暂缓项深化 7、§子议题深化 8）：可以 detect、explain、propose、open_review、request_revalidation、检查权限、发现审批过期、生成差异报告和知识候选；默认不能 reopen、change_owner、export、publish、delete、grant_permission，也不能代表接手者确认责任、解密秘密或绕过审批。
- **Retention Worker**（§暂缓项深化 7、§子议题深化 14）：只能按已批准策略执行保留、降级或处置，不得自行改变策略或绕过 Legal Hold。
- **Break-Glass 主体**（§子议题深化 2、§子议题深化 14）：权限最小、临时、到期失效，必须绑定 Incident、原因、Scope、允许与禁止动作、开始/失效时间、审批或双人复核和事后复核；不改变长期 Owner、ACL、审批角色或 Tool Policy。
- **Project / Team Admin、Security / Compliance Reviewer、Derived Consumer、System Retention Worker**（§暂缓项深化 7 主体清单）：文档列出主体边界，但“完整角色矩阵、委托与接管协议、Break-Glass、导出格式、删除工作流”列为暂缓。
- **授权模型**（§子议题深化 14）：`Effective Permission = Identity ∩ Role / Grant ∩ Resource ACL ∩ Action ∩ Purpose ∩ Scope ∩ Sensitivity ∩ Lineage ∩ Current Policy ∩ Approval / Delegation ∩ Retention Lock ∩ Capability`；Role 表达 `canonical_owner`、`participant`、`executor`、`auditor`、`security_reviewer`、`compliance_reviewer`、`governance_agent`、`retention_worker`、`break_glass_operator` 等职责骨架。
- **交接后默认只授予最小权限**（§子议题深化 2）：查看授权上下文、追加允许范围内的 Evidence、执行已授权 Task、创建 Checkpoint、请求状态变更、发起后续 Handoff；“不会自动授予 Owner 转移、跨 Project 共享、原文导出、知识发布、生产写入、旧审批对应的执行权限或旧 Harness 的工具能力”。
- **有效权限采用交集**（§17）：`Effective Access = Principal Identity ∩ Work Thread Grant ∩ Owner / Participant Relation ∩ Resource ACL ∩ Connector Capability ∩ Credential Scope ∩ Inherited Policy ∩ Action Policy ∩ Delegation`。

### 1.5 关键规则与不变量

- **交接确认**（§12、§21）：“发送通知 ≠ 已交接、被指定 ≠ 已接手、查看续办包 ≠ 已接受责任、确认接手 ≠ 成为 canonical owner、Harness 切换 ≠ 人员责任转移”；确认前原执行者责任不静默解除、新执行者不承担当前责任、canonical owner 继续承担治理责任。Harness 切换但人员责任不变时记录为 `executor_runtime_changed`，不创建正式 Handoff。
- **责任与资源权限分离**（§13）：“Owner 转移 = 责任版本变化 + 权限重新评估 + 上下文重新解析”；可见资源为多要素交集；数据库凭据、外部系统登录态和生产权限绝不因转移自动复制；L1/L2 可按新授权重新解析，Team L3 不随 Work Thread 自动转移。
- **投影规则**（§14、§17、§26）：续办包必须经接手者身份、资源 ACL、敏感数据策略和当前凭据能力过滤，“不能因‘交接’绕过授权”；所有角色投影来自同一规范恢复结果与证据链，“投影差异不能改变事实和安全边界”“权限投影不能泄露无权资源”。
- **凭据与脱敏**（§17）：凭据、Token、Cookie、私钥、登录态和秘密不得进入 Continuation Package 正文，只能记录 `credential_ref`、capability、scope 和重新连接方式；内容访问结果分 allowed / redacted / denied，且“不得通过错误信息反向泄露敏感内容”。
- **安全降级路径**（§17）：完整恢复 → 语义恢复 + 操作材料部分恢复 → 语义恢复 + 脱敏摘要 → 仅工作元数据 → 拒绝访问。
- **六层模型不变量**（§18）：“Phase 完成 ≠ Work Thread 完成、Checkpoint ≠ 长期记忆、Checkpoint ≠ Run Context Snapshot、Run Snapshot 不被静默改写、旧 Revision 不被覆盖、Manifest 原子发布、Continuation Package 可重建、历史版本仍受当前 ACL”；每次重要写入应带 `base_revision`。
- **并行与合并**（§16）：“Evidence 只追加，不覆盖、主状态不接受无版本写入、旧 revision 写入不能静默覆盖新版、分支不能自动改变 owner、分支不能绕过 ACL、冲突不能由最后写入者解决、未验证分支不能自动升级为 Team L3、高风险操作必须互斥并审批”。
- **拆分原则**（§27、§暂缓项深化 1）：硬门禁含 tenant 边界变化、Project/Team canonical owner 变化、权限或敏感性边界变化、责任需独立承担、验收标准完全不同、生命周期需独立关闭、合规要求独立审计、父 Thread 已完成/取消/归档；目标语义、资源范围、revision、参与人、工具能力、时间间隔等仅作候选信号。
- **继承规则**（§暂缓项深化 2）：默认不继承全部对话、原始日志、凭据、Prompt、旧 Run、旧审批、源空间权限、源工具能力和未验证推断；继承矩阵标注 Owner 在 Branch 可继承但可变、Follow-up 需重新确认、Derived 必须明确目标 Owner；审批一律不继承。
- **合并与冲突**（§暂缓项深化 3）：基线无法确认时直接进入 M2 阻断；识别结果分可合并差异、直接冲突、关系不明；对象级默认策略含“Permission / ACL 任一侧更严格时默认取更严格结果”“Owner 必须唯一；冲突时阻断”“Constraint 只能合并或收窄，不能自动放宽”“Action / Run Plan 不直接合并为可执行计划”；`merge_revision = new revision, parents = [left_revision, right_revision], base = base_revision`，原分支版本保留。
- **完成判定**（§暂缓项深化 4）：正交完成状态含 `work_status`、`deliverable_status`、`verification_status`、`acceptance_status`、`risk_status`、`publication_status`、`follow_up_status`；可表达“主要目标已完成但仍有例外、残余风险或后续动作”；“最后一次 Run 成功”“Harness 返回完成”“存在代码 diff”“没有新的消息”“Owner 点击完成”均不能单独决定 completed。
- **归档与恢复**（§暂缓项深化 6）：“历史可见 ≠ 工作可以继续、环境重连成功 ≠ 权限有效、历史证据存在 ≠ 当前结论仍有效”；归档后默认禁止直接追加原 Thread、禁止恢复旧 Run/审批/工具权限、恢复环境“只能重新连接或重建”；“到期自动删除”不能作为唯一保留策略。
- **终态与批量**（§暂缓项深化 7、§子议题深化 14）：终态后权限按当前 ACL 重新计算；权限收窄立即阻断未来访问但不静默改写历史；批量导出/发布/删除/权限变更需逐项准入 → 批次组合风险 → 敏感性与重识别 → Scope 扩张 → 血缘传播闭包 → 保留锁定 → 外部消费者影响 → Approval / RunGate → Execute → Verify；任一对象命中 M2 时整批不得静默继续。
- **统一不变量集**（§二）：`Work Thread ≠ Chat Session / Harness Session / Run / Checkpoint`、`参与 ≠ 所有`、`认领 ≠ 责任转移`、`责任转移 ≠ Owner 转移`、`换 Harness ≠ 自动获得权限`、`复杂 ≠ 必须拆分`、`合并 ≠ 最后写入覆盖`、`完成 ≠ 验证完成`、`完成 ≠ 发布或可执行`、`归档 ≠ 删除`、`历史可见 ≠ 当前可执行`、`自动识别 ≠ 自动转正`、`治理 Agent 建议 ≠ 治理 Agent 执行`。
- **其他高频边界**：“L1 不可用 → 不得宣称可安全续办”“L2 缺失 → 必须指导重新获取或明确降级”“L3 不可用 → 可重建但不能伪装已恢复”“重建 ≠ 原环境恢复”“executed ≠ verified”“unknown ≠ 成功”“超时 / 沉默 ≠ 接受”“审批不自动继承”（§15、§17、§21、§23）。

### 1.6 界面/交互线索

- **接手者投影五类视图**（§14）：Member View（交接摘要、风险、待办和关键证据）、Development Harness View（目标、约束、代码上下文、revision/diff、命令结果和下一步操作）、Operations Harness View（事件、指标、日志、系统对象、Runbook、审批和禁令）、Governance Agent View（来源、置信度、冲突、过期情况和知识候选）、Security / Approver View（影响范围、敏感数据、权限变化和审批状态）。
- **团队成员投影三层渐进披露**（§26）：第一层任务级结论，明确表达“可以继续”“可以继续但存在缺口”“补充后可以继续”“当前不能安全继续”“等待权限/审批/人工输入”“尚未尝试恢复”；第二层恢复解释，展示 L1/L2/L3 状态、关键资源、阻断/非阻断缺口、unknown、最低安全下一步、验证时间和重新确认要求；第三层证据与审计。要求“不能只用颜色或单一‘成功/失败’表达”，结论必须同时说明影响、缺口和下一步。
- **Harness 投影结构化字段**（§26）：提供 `can_continue`、阻断性、所需层级、层级结果、缺口、可用/拒绝资源、最低安全下一步、允许/禁止动作、版本绑定、验证有效期和是否需要重新确认；“自然语言仅作补充”。
- **统一入口与影响预览**（§暂缓项深化 5）：用户侧统一入口可以是“继续处理这项工作”，平台再推荐 `Continue / Branch / Reopen / Follow-up / Derived`；推荐必须说明为什么推荐、是否创建新 Thread、哪些上下文会继承或脱敏、哪些权限与能力不会继承、谁需要确认或审批、是否影响原 Thread 或派生资产；“推荐不等于执行。高风险操作显示‘提交审核’而不是‘立即创建’”。
- **归属向导**（§子议题深化 3 / 阶段 4）：“用户通常只知道工作属于哪个项目；应通过归属向导生成候选和解释，不要求一次填写所有内部关系”；前台关系展示和归属向导列为暂缓。
- **拆分与合并的 UX 线索**（§子议题深化 5 / 11 / 12 专家团）：用业务语言和判断问题引导；预览新 Thread、父状态、继承内容、权限变化、审批和源变化传播；运维视图显示活动 Branch、Derived、Follow-up；合并需要“合并工作台、批量审核、差异解释和 API”（均列为暂缓）；自动候选提供确认、拒绝、纠正和影响预览。
- **版本失效的用户表达**（§子议题深化 4 / 阶段 4）：“前台不应暴露大量孤立技术版本号，应解释当前工作版本、接手快照、运行快照和重新确认原因”；用任务语言说明是权限变化、代码变化还是证据撤回导致哪一项需要重新确认，并区分信息更新、重新确认、操作阻断和审计查看。
- **Connector 相关用户状态聚合**（文档 01 专家团建议，多为建议而非确认结论）：能力认证 UI 建议聚合为“已认证、能力未验证、需要重新授权、已撤销、受限运行、需要接管”；同步状态建议聚合为“同步中、部分同步、存在缺口、已隔离、需要补发、存在冲突、外部结果未知、需要人工处理”；缺口展示建议“缺了什么、影响什么、建议怎么做”；L3 恢复建议区分“已重连、已重建、部分恢复、待验证、需要审批、外部结果未知”；协议映射建议展示“已映射、部分映射、需平台确认、能力不足、被策略阻断”；缓存撤回建议展示“已停止传播、平台已撤回、外部清除中、部分清除、无法确认、受法律保留阻断”；Trace 建议展示“Trace 完整、部分采样、已脱敏、存在缺口、受保留锁定”，不强迫阅读底层 Span；重试建议展示“重试中、等待依赖、已降级、需要接管、外部结果未知、已终止”；替代 Harness 建议展示候选缺口、推荐理由、约束、风险、接手状态和下一步，“不要只给一个‘最佳 Harness’”；Connector 监控建议用少量状态聚合并提供“依据、有效期、下一步”，不把内部指标堆进主界面。
- **UI 安全边界**：UI 只展示经过授权的聚合状态，不应向无权用户暴露资源存在性、凭据、私有 Prompt 或内部堆栈（§子议题深化 25 相关段落）。
- 文档明确暂缓：文案、页面布局与交互细节、通知渠道与模板、国际化、无障碍细节、具体 UI/API（§26、§暂缓项深化 5、§子议题深化 5 等）。

### 1.7 仍暂缓未定的内容

议题级未决事项（§三，均注明“留待以后讨论”）：Continue/Branch/Follow-up/Derived 的数值阈值和行业差异；三类关系对象的最终 Schema；Branch 多层嵌套、循环关系和完整合并实现；字段级冲突算法、实时一致性和合并运行参数；完成验收的具体场景字段、行业模板和证据等级；Reopen/Follow-up/Derived 的最终 UI、API 和通知协议；归档具体保留期限、冷存储和恢复失败 SLA；删除、匿名化、撤回和派生资产影响治理流程；终态后的完整角色权限矩阵、委托、接管和 Break-Glass；导出、删除、发布和高风险恢复的最终审批协议；自动化规则引擎、治理 Agent 触发条件、回滚和防绕过实现；Connector 能力差异、环境恢复和跨 Harness 运行协议；具体数据库 Schema、API、事件存储、索引、保留实现和 UI。

各深化项另列的暂缓要点：拆分/派生的数值阈值、自动识别模型和训练数据、Branch 自动合并裁决算法（§暂缓项深化 1）；三类关系对象的最终 Schema、多层 Branch 与循环禁止规则、LifecycleLink 实时传播协议、UI/API 细节（§暂缓项深化 2、§子议题深化 11）；字段级合并实现、多层嵌套、实时一致性、运行参数、合并工作台与 API（§暂缓项深化 3、§子议题深化 12）；行业模板字段、证据等级数值、审批矩阵（§暂缓项深化 4）；三种操作的最终 UI/API、通知模板、撤回 SLA（§暂缓项深化 5）；具体保留天数、冷存储技术、删除/匿名化工作流、恢复失败 SLA（§暂缓项深化 6）；完整角色矩阵、委托与接管协议、Break-Glass、导出格式、删除工作流（§暂缓项深化 7）；自动准入规则、数值阈值、异常回滚（§暂缓项深化 8）；WorkThreadRevision 等最终 Schema、版本号方案、事件重放与迟到事件协议、多对象原子提交、版本压缩与冷存储、失效 SLA、Trace 绑定协议、用户版版本展示交互（§子议题深化 4）；Role/Grant/Policy Decision/Obligation/Approval/Delegation 最终 Schema、RBAC 与 ABAC 冲突时的优先级、脱敏后内容能否检索/注入、Harness Cache 撤回无法确认时的责任、Owner 失效临时治理的最大权限与时限、批量操作规则（§子议题深化 14）。Connector 侧 10 个子议题均声明“不表示实现 Schema、阈值、算法、运营 SLA、UI/API 已经固化”，文件末尾“Connector 暂缓清单阶段性完成说明”仅表示当前讨论批次完成（§子议题深化 16–25）。

文档未明确：数值阈值、评分公式、错误码编号表、SLA 参数、最终 Schema 等，文档均以“留待以后讨论”或“本轮不固化”表述，未给出具体取值。

---

## 议题 2：记忆自动分层

来源：`.specs/enterprise-agent-memory-platform/02-记忆自动分层.md`（803 行，6 个子议题深化，1–5 状态为“已完成（第 1 轮，自动审核通过）”，6 为“第 1 轮（自动执行中）”但“自动审核与推进”记明已通过）。

**重要口径校正（文档真实内容）**：该文件**没有**展开 L0/L1/L2/L3 四层完整定义，也未使用“L0 对话”“L3 事实”这类表述。文件中的分层口径为：L1 = “原子记忆”（讨论其最小持久化边界）、L2 = “可恢复场景边界”、L3 = “长期记忆演进规则”；L0 仅在第 1 轮阶段性结论里提及仓库 README 的“现有 L0–L3 定义”。

### 2.1 已确认结论清单

1. 议题 2 被判定为“已完成当前阶段的分层语义、L1 状态模型、L2 可恢复场景边界和 L3 长期记忆演进规则讨论，并形成阶段性确认”；后续架构、权限治理、按需融合和知识化被明确排除在本议题之外（§2-深化 1 / 阶段性结论）。
2. L1 存储结构确认为四段式：“Canonical Memory Object + Append-only Events + Immutable Snapshot + Derived Projections”（§2-深化 1 / 阶段 1）。
3. Schema 设计在 4 个候选中确认采用“规范元数据 + 版本内容 JSON + 独立事件/证据表”（§2-深化 1 / 阶段 1）。
4. 索引只用于定位候选：“必须在返回、注入、导出或决策前重新执行当前权限、Purpose、敏感性、撤回和有效性检查”（§2-深化 1 / 阶段 1）。
5. 真源关系确认：规范对象与版本为真源，事件用于追加审计和重建，Snapshot / Projection / Index 为“绑定 Revision 的派生物”；具体数据库选型与 Schema 细节留待后续架构阶段（§2-深化 1 / 阶段 4）。
6. 状态判定“不应由单一置信度决定”，至少区分 observed、inferred、human_confirmed、current、stale、disputed、retracted、invalidated、unknown（§2-深化 2 / 阶段 1）。
7. 状态判定拆成两段：“状态评估”与“状态转换”分开，链路为 Evidence Assessment → State Candidate → Policy / Risk Gate → Automatic Transition or Review Queue（§2-深化 2 / 阶段 1）。
8. 低影响、可逆、证据充分的状态可自动推进；涉及安全、权限、生产、隐私、跨 Project、可执行知识或高影响结论时，“自动模型只能生成候选或隔离，不能自动发布”（§2-深化 2 / 阶段 1）。
9. 判定模型为多信号分层模型：Evidence Quality + Freshness + Repetition / Cross-context Stability + Contradiction / Counterexample + Human Confirmation + Adoption Feedback + Impact / Risk → State Assessment（§2-深化 2 / 阶段 3）。
10. “不建议把数值阈值直接写成全局常数”；阈值按状态类型、风险级别、Scope、数据分布和模型校准结果配置并保留策略版本；状态变化应采用迟滞/防抖（§2-深化 2 / 阶段 3）。
11. 冲突识别覆盖 8 类：value_conflict、scope_conflict、temporal_conflict、source_conflict、revision_conflict、permission_conflict、lifecycle_conflict、causal_conflict（§2-深化 3 / 阶段 1）。
12. 冲突识别对象分层为 field / semantic_unit / memory_item / related_memory_set / projection / policy_context，专家团建议“采用语义单元为主、字段和对象为辅助”（§2-深化 3 / 阶段 1、阶段 4）。
13. 明确禁止单独裁决：不能用“最新时间”“最高置信度”“多数投票”“模型信心”单独裁决高影响冲突（§2-深化 3 / 阶段 1）。
14. 自动裁决条件为低影响、规则明确、证据充分、差异可逆、无高风险副作用；否则只生成候选或进入治理队列。冲突解决“必须追加新 Revision/Decision，不覆盖分支和原始证据”（§2-深化 3 / 阶段 1）。
15. 自动处理分级为 M0（格式、重复、明显同义且无语义差异，可自动规范化）/ M1（低风险、规则明确、证据充分、可回退，可自动生成并验证新 Revision）/ M2（事实、权限、Scope、敏感性、生产、安全、合规、跨空间或外部副作用冲突，只生成候选并要求审核/隔离）（§2-深化 3 / 阶段 3）。
16. 撤回/删除触发原因：source_retraction、permission_revocation、retention_expiry、privacy_request、legal_hold_change、security_incident、correction_or_invalidated_evidence（§2-深化 4 / 阶段 1）。
17. 处置动作必须区分 10 类：stop_distribution、revoke_access、invalidate_reference、remove_from_index、redact、anonymize、delete、quarantine、expire、verify_external_clearance（§2-深化 4 / 阶段 1）。
18. 撤回协议为 9 步：Request → Impact and Lineage Assessment → Stop New Distribution → Access Revocation → Redact / Anonymize / Delete / Quarantine → Invalidate Index / Cache / Projection → External Clearance → Verification → Closed or Closed with Unknowns（§2-深化 4 / 阶段 3）。
19. 传播任务必须绑定 request_id、source_revision、lineage_snapshot、policy_revision、purpose、scope、sensitivity、retention_snapshot、legal_hold_snapshot、idempotency_key（§2-深化 4 / 阶段 3）。
20. “建议将平台真源处置和派生传播分开”：主对象处置事实由平台记录，派生系统分别回报接受、执行、部分成功、不可达、未知和验证证据；“派生资产权限不得宽于来源；索引命中不能恢复已撤回对象”（§2-深化 4 / 阶段 3）。
21. 撤回自动处理边界：低风险、明确范围、无法律保留、幂等且可验证的索引/缓存失效可自动；涉及主体隐私、跨空间、敏感内容、外部副本、法律保留或高影响删除时，自动生成治理候选并隔离/审核（§2-深化 4 / 阶段 3）。
22. 普通成员主状态为“主状态 + 简短原因 + 影响范围 + 下一步 + 有效期/更新时间 + 可展开依据”；不应直接暴露完整状态组合、内部模型分数、权限图、全部事件或敏感证据（§2-深化 5 / 阶段 1）。
23. “主状态与动作必须分离”：查看、纠正、申请确认、查看来源、请求新版本、发起恢复、提交治理申请“不应由状态颜色隐式授权”，所有动作仍走独立授权和 RunGate（§2-深化 5 / 阶段 1、阶段 4）。
24. 不同角色需不同投影：Member 看能否继续和下一步；Owner 看责任和影响；Approver 看风险、依据和门禁；Operator 看运行/失败；Auditor 看版本、证据、决定和访问记录（§2-深化 5 / 阶段 1）。
25. 主状态计算“不能泄露无权对象存在性”；对无权主体可返回统一的“不可用或无权访问”投影，不展示敏感原因（§2-深化 5 / 阶段 3）。
26. 渐进披露为三层：第一层状态/能否继续/下一步；第二层更新时间、适用范围、缺口和阻断原因；第三层来源、证据、版本差异、治理决定和访问审计（§2-深化 5 / 阶段 3）。
27. 概率置信度可帮助表达证据支持强度、状态判定不确定性、冲突风险、来源可信度、时效衰减、模型校准误差；但不能替代来源引用、人工确认、权限判断、政策决定、验证结果、业务责任（§2-深化 6 / 阶段 1）。
28. 确认结论为“采用轻量分层，不建设通用概率/事件溯源平台”，方案为 Evidence References + Qualitative Bands + Optional Calibrated Score by Memory Type + Append-only Domain Events where needed + Immutable Snapshots / Derived Projections（§2-深化 6 / 阶段 3）。
29. 概率只作为决策输入之一，输出必须绑定 model_version、calibration_version、training_or_validation_window、applicable_memory_type、scope、evidence_refs、confidence_band、uncertainty_reason、expiry（§2-深化 6 / 阶段 3）。
30. 事件溯源只用于已有明确事件边界的领域对象；“当前规范对象、权限和生命周期仍是平台真源”；状态重建和投影重算不能重新触发原始外部副作用（§2-深化 6 / 阶段 3）。

### 2.2 核心对象与字段

- 需持久化对象（§2-深化 1 / 阶段 1）：L1 Memory Item、L1 Version / Revision、Evidence Reference、Memory Event、Immutable Snapshot、Derived Projection、Index Entry、Policy / Retention Reference。
- Canonical Memory Object：当前规范状态、归属、敏感性、生命周期和当前版本引用；Version / Revision：不可变内容和状态版本；Evidence Reference：来源、观察时间、置信度、生成者和证据定位；Memory Event：创建、修正、确认、争议、撤回、失效和归属变化等追加事实；Snapshot：用于恢复和查询优化的不可变状态快照；Projection：面向检索、统计或 UI 的派生视图；Index Entry：关键词、结构化过滤、向量或关系查询的索引投影（§2-深化 1 / 阶段 1）。
- 最小存储边界（§2-深化 1 / 阶段 3）：`L1Memory = identity / ownership / scope metadata + current_revision_ref + lifecycle / sensitivity / retention metadata + created_at / updated_at`；`L1Revision = immutable semantic content + parent_revision + evidence_refs + schema_version + content_integrity`；`MemoryEvent = event identity and causality + actor / producer + source and policy context + revision transition + payload reference`；Snapshot / Projection / Index “derived from a canonical revision or event position”。
- 事件最小字段集（§2-深化 1 / 阶段 1）：event_id、memory_id、memory_revision、aggregate_type、aggregate_id、event_type、occurred_at、recorded_at、actor / producer、source_reference、idempotency_key、causation_id、correlation_id、schema_version、policy_context、payload_reference。事件 Payload 是否内嵌、引用、加密或脱敏本轮不固化。
- 索引候选（§2-深化 1 / 阶段 1）：identity / scope、state / lifecycle、owner / subject、sensitivity / purpose、source / revision、time / retention、keyword、vector（optional）、relation / evidence。
- 状态评估输出字段（§2-深化 2 / 阶段 3）：state_candidate、confidence_band、evidence_summary、model_version、input_window、expiry、contradictions、recommended_action、review_required。
- 冲突输出字段（§2-深化 3 / 阶段 3）：conflict_id、conflict_type、affected_units、common_baseline、candidate_resolutions、evidence_comparison、policy_context、risk_level、automation_eligibility、chosen_action、verification_result。
- Member Projection 字段（§2-深化 5 / 阶段 3）：primary_status、can_use / can_continue、concise_reason、impact_scope、next_action、last_verified_at / valid_until、expandable_evidence_and_history。
- 事件溯源设计边界：事件 Payload 最小化，敏感内容引用或脱敏；事件历史与当前状态分离（§2-深化 6 / 阶段 3、阶段 2）。

### 2.3 状态与枚举

- 状态判定枚举（§2-深化 2 / 阶段 1）：observed、inferred、human_confirmed、current、stale、disputed、retracted、invalidated、unknown。
- 自动判定降级取值：过期、冲突、来源撤回或证据不足 → 降为 `unknown`、`stale` 或 `disputed`；自动模型不可用或输入缺失 → “不默认通过，进入 `unknown`”（§2-深化 2 / 阶段 3）。
- 冲突处理候选 8 项（§2-深化 3 / 阶段 1）：auto_merge、append_correction、narrow_scope、mark_disputed、supersede、quarantine、request_human_review、reject；自动处理分级 M0 / M1 / M2（§2-深化 3 / 阶段 3）。
- 撤回候选状态 13 项（§2-深化 4 / 阶段 1）：requested、assessed、blocked_by_hold、propagating、partially_propagated、access_revoked、content_redacted、index_invalidated、cache_cleared、verified、unknown、closed_with_risk。
- 普通成员候选主状态 10 项（§2-深化 5 / 阶段 1）：当前有效、待确认、已更新、存在争议、已失效、已撤回、部分可用、暂时不可用、无权访问、未知。
- 概率相关概念区分（§2-深化 6 / 阶段 1）：model_score、calibrated_probability、confidence_band、evidence_quality、policy_risk、human_confirmation；“必须允许 `unknown`、`not_applicable` 和 `insufficient_evidence`，不能强行转换成精确百分比”。
- 具体数值阈值：**文档未明确**——“本轮不固化具体阈值、模型权重和线上校准参数”（§2-深化 2 / 自动审核与推进）。置信度分级的具体区间边界同样**文档未明确**，仅出现 confidence_band 等定性概念。

### 2.4 角色与权限边界

- Member：只应看到“能否继续和下一步”的投影；不应看到完整状态组合、内部模型分数、权限图、全部事件或敏感证据；不能通过状态差异推断敏感对象存在性（§2-深化 5）。
- Owner：需要看“责任和影响”的投影；Approver：需要看“风险、依据和门禁”的投影；Operator：需要看“运行/失败”的投影；Auditor：需要看“版本、证据、决定和访问记录”的投影（§2-深化 5 / 阶段 1）。
- 治理 Agent / 系统自动模型：高影响、安全、权限、隐私、生产和跨空间场景下“只能生成候选或隔离，不能自动发布”；M2 冲突“只生成候选并要求审核/隔离”（§2-深化 2 / 阶段 1、§2-深化 3 / 阶段 3）。
- 派生系统：需分别回报接受、执行、部分成功、不可达、未知和验证证据；派生资产权限不得宽于来源（§2-深化 4 / 阶段 3）。
- 通用约束：索引命中不能直接授权读取、注入或执行；事件重放不能绕过当前权限、撤回和策略；所有动作走独立授权和 RunGate（§2-深化 1 / 阶段 3、§2-深化 5 / 阶段 4）。
- 审核者/治理队列：高影响状态的审核队列、委托和升级协议属暂缓项，具体角色细则**文档未明确**（§2-深化 2 / 本轮明确暂缓事项及原因）。

### 2.5 关键规则与不变量

- 原文不变量句式（§2-深化 1 / 阶段 3）：“Index ≠ Canonical Truth”“Projection ≠ Source Object”“Snapshot ≠ Mutable Current State”“Event Append ≠ Business Authorization”“Schema Valid ≠ Content Valid”“History Replay ≠ Current Permission”。
- 原文不变量句式（§2-深化 3 / 阶段 3）：“自动解决 ≠ 自动发布”“自动发布 ≠ 自动执行”“候选建议 ≠ 规范结论”。
- 一致性 6 条原则（§2-深化 1 / 阶段 3）：规范对象、当前 Revision、追加事件和 Outbox/事件发布需明确原子边界；Snapshot、Projection、Index 可最终一致但必须绑定来源 Revision、事件位置、生成状态和生成时间；索引命中不能直接授权读取、注入或执行；迟到、重复、乱序和未知事件必须隔离、幂等或生成校正候选；“事件和版本不可静默覆盖，纠正采用追加式记录”；处置、撤回和权限收窄必须使受影响投影进入失效/重算路径。
- 查询边界 6 步（§2-深化 1 / 阶段 3）：Index Candidate Retrieval → Canonical Revision Fetch → Current Validity Check → Permission / Purpose / Sensitivity Check → Evidence and Conflict Check → Consumer Projection；“不能因为结构化索引、向量索引或缓存命中就跳过规范状态和权限校验”。
- 判定与门禁：模型分数“不自动等于业务置信度”；“不允许模型分数直接授予发布、注入或执行权限”；高风险内容 fail-closed（§2-深化 2 / 阶段 2、阶段 4）。
- 冲突规则：“规则变化后可重算但不能覆盖历史决定”；冲突重算幂等、版本绑定、队列限流和失败隔离（§2-深化 3 / 阶段 4）。
- 撤回/删除规则：删除请求需幂等、可重试、可隔离和审计；“unknown 时阻断新的检索、注入、发布、导出和执行，不将未知伪装成已删除”；“撤回优先级高于普通缓存命中”；“法律保留必须阻断不适当删除并记录依据”；不宣称不可控外部副本已经物理清除（§2-深化 4）。
- 界面规则：“状态展示不授予动作权限”；“异步刷新不应打断正在编辑的内容”；状态不能只依赖颜色、图标或动画（§2-深化 5 / 阶段 3、阶段 4）。
- 概率/事件规则：高风险、安全、权限、生产、跨空间和可执行知识“不得由概率分数直接通过”；“事件历史缺口或 Schema 不兼容时进入 unknown/隔离，而不是假设重建成功”（§2-深化 6 / 阶段 3）。

### 2.6 界面/交互线索

- 普通成员需要先知道 5 件事：当前是什么状态、我能否使用、为什么是这个状态、下一步是什么、何时需要重新确认（§2-深化 5 / 阶段 1）。
- 展示结构：主状态 + 简短原因 + 影响范围 + 下一步 + 有效期/更新时间 + 可展开依据（§2-深化 5 / 阶段 1）。
- 状态卡语义（§2-深化 5 / 阶段 3）：当前有效 = 在当前 Scope、Purpose 和有效期内可使用；待确认 = 事实或权限尚不足，下一步为确认、Probe 或审批；已更新 = 已有新版本，需要查看差异或重新确认；存在争议 = 不同证据或主体结论冲突，不自动作为高置信使用；已失效/已撤回 = 不可作为当前有效记忆使用；部分可用 = 仅部分 Scope、字段或场景可用；未知 = “系统无法安全判断，不等于成功或失败”。
- 撤回场景界面文案要求：展示“访问已撤销、停止传播、平台已处置、索引失效中、外部清除未知、受法律保留阻断”，“不要只显示已删除”（§2-深化 4 / 阶段 4）。
- 冲突场景界面要求：用户需要看到“冲突是什么、影响什么、依据是什么、自动处理为何可行或为何需审核”；“不能只显示‘冲突已解决’”（§2-深化 3 / 阶段 4）。
- 判定依据展示：用户需要看到判定依据、有效期、冲突和下一步，“不应只看到一个置信度百分比”（§2-深化 2 / 阶段 4）。
- 概率展示：普通用户应看到“依据充分/有限/存在争议/尚未确认”，而不是虚假的精确百分比；专家用户可查看校准和版本依据（§2-深化 6 / 阶段 4）。
- 完整状态覆盖要求：加载、刷新、部分成功、超时、离线、unknown 和过期等状态都要有；“不能把请求超时显示为已失败或已删除”（§2-深化 5 / 阶段 4）。
- 可访问性：状态变化应能被辅助技术感知；文本、语义角色、键盘操作、辅助技术状态通知和错误解释必须同时存在（§2-深化 5 / 阶段 2、阶段 3）。
- 状态文案“面向任务，不直接暴露数据库、模型或策略术语”；UI 使用受控 Projection，不直接拼接原始事件和未授权证据（§2-深化 5 / 阶段 4）。

### 2.7 仍暂缓未定的内容

- 子议题 1（§2-深化 1）：具体数据库/消息系统选型（需规模、成本、可用性和运维约束）；完整 L1 表/对象字段 Schema（依赖统一 API、权限、血缘和生命周期对象）；分片、索引参数、向量库和查询性能（需真实数据分布、查询负载和 SLA 校准）；事件 Payload 编码、错误码和兼容窗口（依赖统一事件 Contract 和 Connector/API 设计）；快照、投影、索引重建和跨服务事务实现（依赖事件存储、Outbox、血缘和保留实现）。
- 子议题 2（§2-深化 2）：各状态具体数值阈值、模型权重和置信区间（需真实样本、反馈和风险校准）；漂移、校准和回放评估的生产指标；高影响状态的审核队列、委托和升级协议（依赖企业权限、治理和运营设计）；不同 Memory 类型的特征与模型实现。
- 子议题 3（§2-深化 3）：冲突识别算法、语义相似度和阈值；M0/M1/M2 的具体判定规则；大规模冲突重算、队列和幂等实现；冲突审核工作台和 API。
- 子议题 4（§2-深化 4）：撤回/删除事件 Schema、错误码和事务边界；血缘传播闭包和派生资产定位算法（依赖议题 7、索引架构和数据规模）；legal hold、隐私请求和 retention 冲突裁决；外部 Harness/缓存清除与验证 SLA；删除、匿名化、加密擦除和备份处置实现。
- 子议题 5（§2-深化 5）：主状态具体视觉稿、组件和交互细节；状态与动作 API 的完整契约；多语言、无障碍和通知策略的完整实现；复杂状态组合、差异视图和审计工作台。
- 子议题 6（§2-深化 6）：各记忆类型的概率模型、校准数据和阈值；通用事件溯源平台建设、查询语言和基础设施选型（“当前会引入过度复杂度，待规模和跨域需求明确后讨论”）；事件敏感内容加密、匿名化、长期保留和撤回实现；概率分数与自动发布、注入、执行的完整门禁。
- 第 1 轮自动审核另建议保留“具体数据库选型、完整字段 Schema、分片/索引参数、事件 Payload 编码和生产 SLA”作为后续暂缓内容（§2-深化 1 / 自动审核与推进）。
- 文档未明确：L0 层的定义、字段、阈值、状态与界面；L3 的字段级设计；“L3 事实”这一表述在本文件中不存在。
