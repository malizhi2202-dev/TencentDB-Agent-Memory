# V3 增量需求：身份、路由、知识提炼与版本治理

> 2026-09-11 · 增量评审稿 · 基线：[PRODUCT-DESIGN-V3.md](./PRODUCT-DESIGN-V3.md)。
> 本文仅定义新增需求及原型建议，不修改业务代码、迁移、原型文件；不宣称新增能力已接真实 backend。所有接口和字段均为契约草案。

## 1. 目标、边界与事实口径

- 延续 V3 的 Project → Task → Agent → Run → 交付 → 记忆闭环，保留 Asset、MemorySpace、Wiki、Code、Skill 的专业语义及 accessible / mounted / effective 区分。
- 面向多团队成员、知识维护者、Harness 接入者和审核人，解决身份混淆、归属误写、多人版本漂移、经验缺证四类问题；使用频率和收益仍待真实验证。
- 本文细化 V3 的安全与版本边界，不推翻其架构；多团队/多项目是授权关系，不能将 V3 的默认 Team 筛选解释成组织隔离规则。
- 初期只自动处理符合空间策略的低风险去重；共享事实、操作行为、Skill/场景/剧本的变更须人工审核，Agent 判断只作为建议，不得自批。
- 不新增重型 Scene/Flow 执行器；质量输入仅为传入记忆，不强制增加在线探针、实时监控或重新执行工具。
- 原型采用虚构数据、mock 身份和本地演示状态，不是真实认证、授权、调用、审核或发布；不收集、存储、打印真实密码或密钥。
- 成功依据为下文固定验收用例、负例及证据链，而非演示图表中的指标；真实上线后再建立归属准确率、人工修改率、审核耗时等基线。

## 2. R01–R14 需求映射

| 编号 | 精确需求 | 增量交付及边界 | 建议入口 |
|---|---|---|---|
| R01 | 登录、创建用户、密码、API Key 与 Harness 兼容 | 个人凭据/共享服务凭据分型；独立用户身份验证；不继承创建者私权 | `access/login,users,keys` |
| R02 | team/project/user/agent 任意组合筛选 | 四维可独立选或组合；先授权后筛选，跨团队授权不被误拦 | `assets`、`memory` |
| R03 | 代码关系图谱类别 | 文件/符号/依赖/调用/继承实现/执行链路，标注证据与 Git revision | `analysis/graph` |
| R04 | Wiki 显式、向量、知识关系图 | 分开显示链接、相似、实体关系，不把向量邻近当事实 | `wiki/graph` |
| R05 | 传入记忆自动归属写空间 | 依据已验证主体、绑定上下文、写权限和策略；歧义待归类 | `ingestion/import`、`routing/resolve` |
| R06 | 记忆提炼 Wiki、代码知识、Skill | 生成有出处候选；代码片段不是仓库已提交事实 | `ingestion/import`、`changes/queue` |
| R07 | 内置 Agent | 版本化模板：路由建议、提炼、质量诊断、合并建议；无隐含特权 | `templates/agents` |
| R08 | 场景剧本轻量融合与提炼候选 | Scene 定义适用情境，Playbook 定义稳定步骤，装配到现有 Task/Agent | `templates/scenes,playbooks` |
| R09 | Code 场景暂按 Coding Agent 工作流 | 暂定检索、修改候选、测试、评审；原提出者含义待确认，不承诺其他解释 | `templates/scenes`、`analysis` |
| R10 | Harness 自动路由读取 | 绑定 Task/Run/Session，主项目/参考项目/写目标分离 | `routing/resolve,bindings` |
| R11 | 统一合并、人工与 Agent 判断、并发编辑提炼、版本不漂移 | 三方合并、绑定审核、CAS、locked、派生索引与 manifest、Task/Run 快照 | `changes/queue,review`、`snapshots/manifest,upgrade` |
| R12 | 从传入记忆统计 Tool/MCP/Skill 失败率与根因 | 按证据覆盖和去重后的分母展示，缺证为 unknown | `ingestion/quality` |
| R13 | 从传入记忆判断废话步骤、循环、无进展与根因 | 对照任务进展证据，排除分页/轮询/有界重试，区分事实与假设 | `ingestion/quality` |
| R14 | 提炼已验证好的调用样例为经验记忆 | validated_example 与 unverified_proposal 分开；保留验证和来源链 | `ingestion/experience` |

## 3. R01 身份、权限、工作上下文三层独立

| 层 | 权威来源 | 不能由什么代替 |
|---|---|---|
| 身份 | 服务端认证出的用户/服务主体；独立验证的实际用户声明 | 请求 body 的 userId、Key 名称、LLM 猜测、仓库作者 |
| 权限 | 凭据 scope ∩ 当前用户或服务的有效权限 ∩ 资源 ACL；动作策略继续收窄 | 当前团队选择、项目 owner team、模板名称、历史快照 |
| 工作上下文 | 已授权的 Task/Run/Session 绑定及明确项目选择 | 用户最近访问项目、浏览器上一个 Tab、未验证路径 hint |

- 用户可同时属于多个 Team 和 Project；Project 保留主 Team 归属。授权跨团队协作者不必加入项目 owner team，不能强制 `user.team == project.ownerTeam`。
- **个人 Key 分享不能识别真实操作者**：它只能证明有人持有对应凭据，不能证明持有人就是创建者。若被共享，审计不得把 Key owner 当成实际操作人；无独立身份证据则 `actor_unknown`。
- 新增独立 `service` 主体的共享服务凭据，创建者仅是审计上的 `createdBy`，不继承其私有空间、个人资产或所有项目权限。迁移个人共享 Key 时重新显式授权，不复制私权。
- 有实际用户的代理请求必须独立验证用户身份及委托关系；只传 `userId`、邮箱、姓名或自签内容不成立。有效权限取凭据 scope 与该用户权限及 ACL 的交集，仍受服务委托范围限制。
- 未验证实际用户时，只能以服务主体在明确授权的共享范围操作，`verifiedUserId=null`、`actorStatus=actor_unknown`；服务权限不足即拒绝，不借创建者或假定用户身份补权。
- 已授权访问的源内容仍不得自动扩散到更广可见目标；公开化、跨范围复制另验分享/发布权限与来源限制。
- 登录页提供账号/密码与会话失效反馈；用户创建受管理权限和实例开户策略控制，创建用户不自动加入全部项目。注册开放范围待产品评审，不默认开放匿名注册。
- 生产密码只保存合适的不可逆密码哈希，实施登录限流、会话过期及安全重置；Key 生命周期含用途、scope、指纹、到期、轮换、撤销。真实 Key 仅创建时一次展示，日志与审计只留引用/指纹。
- Harness 兼容以现有认证头、请求封装和错误格式的兼容测试为准；独立用户证明、上下文绑定采用可选扩展。旧客户端不能因缺少身份字段自动取得用户权限，要求用户身份的动作返回补充验证提示。
- 身份切换须重验权并隔离缓存；原型只允许虚构账号和不可用占位 Key，不提供真实密码/Key 粘贴测试，也不把角色切换写成“认证成功”。

## 4. R02 四维组合筛选与跨团队协作

- `teamIds / projectIds / userIds / agentIds` 均可空、单选或多选；同维 OR、维间 AND；空值表示该维不限制，不表示公开访问。四维全部为空仍限当前授权集合。
- 四维分别表示关联组织、关联项目、归属用户、关联 Agent；如需按实际操作者筛选，单列 `actor` 条件，不能与 owner 混用。对象通过任一有效关系边匹配，展示命中的关系原因。
- 在 `assets`、`memory` 增强筛选条，保留类型、domain、L0–L3、状态等原筛选；不要把“四个筛选维度”混成 V3 的层级/域/范围/写策略。
- 默认 Team 只是可清除条件；项目下拉在当前授权候选中展示，不以 owner team 强制截断。授权项目与团队筛选不相交时显示真实空命中，允许清除 Team 后继续。
- URL 持久化非敏感筛选与排序；筛选变化重置分页和批量选择，返回列表恢复条件；缓存键包含认证主体、授权版本及全部筛选，不被迟到请求污染。
- 数量、联想、图谱节点及关系均先验权；不以“无权对象数量”泄露其他团队存在性；未知总量显示“—”。

## 5. R03–R04 图谱的类别与证据

| 视图 | 节点与边 | 必须显示的解释 |
|---|---|---|
| Code 结构 | 仓库/目录/文件/模块/符号；包含、定义、导入依赖 | `repoId + commit + path + symbolId`，解析器与索引版本 |
| Code 行为关系 | 函数调用、引用、继承、接口实现、入口到调用链 | 静态解析/推断/动态证据分开；推断链不是已执行 trace |
| Code 扩展类别 | 社区/功能聚类、影响范围；可选数据流 | 类别与解析语言能力声明；无证据时不可画成确定边 |
| Wiki 显式图 | 文档、标题块；作者链接、反向链接、引用 | 原文锚点、方向、链接来源；断链标异常 |
| Wiki 向量图 | 文档/段落；相似度邻接 | embedding 模型/版本、阈值、分数；相似不等于支持或因果 |
| Wiki 知识关系图 | 实体、主题、断言；支持、反驳、依赖等关系 | 抽取来源、证据片段、可信状态、适用范围；推断边显式标注 |

- 三种 Wiki 图可切换/叠加但图例与边类型必须保留；默认不混成一个无法解释的“知识图谱”。Obsidian Graph 主要参照显式链接体验，不据此声称它就是向量相似图。
- 图谱提供类别、关系、版本、项目筛选、图例、节点详情、返回来源和表格替代视图；只计算已授权子图，不暴露无权中间节点来解释路径。
- GitNexus 用于代码关系/链路表达参考；GraphRAG 用于抽取、社区等派生产物的数据流参考，不代表本产品已集成对应引擎或具备所有类别。
- 索引缺失、局部解析失败、版本落后分别提示；保留最后一个已发布可用版本，禁止新文本与旧图谱混标成同一 revision。

## 6. R05、R10 传入归属与 Harness 路由流程

1. **进入**：Harness 携带凭据、可选独立用户证明、Task/Run/Session 标识、显式主项目/参考项目/写目标，以及来源仓库/路径 hint。
2. **认证授权**：确定有效主体和 scope；显式项目或写空间无权时直接拒绝，不得 fallback 到个人空间、最近项目或其他“相似”项目。
3. **解析绑定**：依次核对 Run 固定绑定、Task 绑定、Session 绑定及本次显式选择；不一致返回 `context_conflict` 供确认，不以优先级悄悄覆盖已固定 Run。
4. **补足上下文**：没有绑定时，仅在已授权候选中使用明确项目选择、可信映射和仓库/路径 hint。路径、仓库可能多项目复用，只是 hint；LLM 可推荐候选并解释，不授予身份或权限。
5. **处理歧义**：唯一候选且满足已配置确定性规则时可自动绑定；多项目或弱证据须确认。无人可确认则 `needs_classification`，进入最小可见隔离暂存区；无合法暂存区则拒绝，不先写共享知识。
6. **区分三目标**：`primaryProjectId` 是任务主现场，`referenceProjectIds` 是逐一有权的读取来源，`writeTargetSpaceId` 是单次写入目标；引用其他项目不等于可向其写入，也不自动复制来源。
7. **读取**：依据绑定、snapshot、当前授权解析 accessible → mounted/临时来源 → effective，返回实际版本和未生效理由；命中与正文注入仍需各自证据。
8. **归属写入**：按主体、上下文、内容域和空间策略生成归属建议；项目事实、个人偏好、Agent 方法分别匹配合法目标。混合内容可拆分候选，无法安全拆分则人工判断。
9. **提交**：先脱敏、幂等去重、来源登记，再按 `automatic / review_required / explicit_only / deny` 执行或进入候选；自动提炼不能借审批绕过 `explicit_only`。
10. **完成证据**：页面与 Harness 响应同时返回 `bindingId/revision`、归属理由、写入/待审/待归类状态及 source refs。绑定挂在 Task/Run/Session，不更新一个会影响其他任务的“用户最近项目”。

取消确认不产生正式空间写入；超时保留合法暂存和脱敏草稿。幂等重试先查询原操作结果；修改绑定影响未来解析，旧 Run 不被重绑，继续工作须新 attempt。

## 7. R06–R09 提炼产物、内置 Agent 与轻量场景

| 候选产物 | 内容与来源 | 接受边界 |
|---|---|---|
| Wiki | canonical topic、断言、支持/反驳证据、适用环境/版本/时间 | 事实冲突不能靠文字润色消失；共享发布需人工审核 |
| 代码知识 | 结构说明、符号引用、定位线索、snippet、patch_candidate | Git commit 才是仓库版本真源；记忆中的 code 不是已提交/已测试代码 |
| Skill | 稳定 ID、目的、前置条件、步骤、工具依赖、失败处理、验收 | 不因一段成功摘要自动标为已验证技能 |
| Scene / Playbook | 情境、触发、输入输出、约束；稳定步骤、分支、检查点、退出条件 | 作为 Task 模板/Agent 装配引用，不另建重型运行时 |

- 内置 Agent 模板包括归属建议、知识提炼、质量诊断、合并建议；模板具备稳定 ID/revision、输入输出 schema、所需能力、适用范围和风险说明，启用不自动获得工具或空间权限。
- 内置 Agent 的输出是候选/判断和证据引用；人工编辑与 Agent 自动提炼统一进入 ChangeSet。当前维护者可接受、修改、拒绝；拒绝保留原因且不能被下一轮直接重提成新独立证据。
- 场景与剧本轻量融合：从已授权资产选择现有 Scene/Playbook，将目的、步骤、验证点映射到现有 Task plan；有多个相似候选时显示差异，不按名称自动合并。
- 从传入记忆提炼场景/剧本时显示来源覆盖、成功与失败边界、建议复用范围；候选不自动覆盖团队模板，采用后形成固定 revision。
- **R09 待确认**：“Code 场景”暂按 Coding Agent 的了解任务 → 定位代码/依赖 → 方案 → patch candidate → 测试证据 → 人工评审理解。原提出者是否另指代码场景记忆或其他能力仍待确认；不得据暂定解释实现额外业务。
- 未有真实 Git 写入和测试结果时，只展示建议补丁与待验证项；原型不创建假 commit、不执行代码，也不把调用链推断当测试通过。

## 8. R11 统一 ChangeSet、多人并发与人工裁决

统一的是变更协议与审核，不是把所有资产压成纯文本。合并维度依次为：租户/授权边界 → 资产稳定身份 → 适用范围 → base/current/proposed revision → 结构块或字段 → 来源证据 → locked → 索引/快照影响。

| 对象 | 稳定身份和合并粒度 | 必须拦截的冲突 |
|---|---|---|
| Wiki | 租户授权 + canonical topic + 环境/版本/有效时间；块 ID、断言 ID | 同名不同主题、不同适用范围、互斥断言，不可直接揉成一篇 |
| Code 知识 | `repoId + Git commit + path/symbol`；说明/片段/补丁候选 | 不同 commit 的代码事实混写；候选补丁冒充提交；需真实 Git 流程确认 |
| Skill | 稳定 skillId、stepId、前置条件、依赖与验收字段 | 步骤重排与依赖/参数冲突；名称相同不代表同一技能 |
| Scene / Playbook | 稳定 sceneId/playbookId、stepId、分支和引用 | 适用条件冲突、断开的步骤引用、行为扩大 |
| Memory | memoryId、事实键、来源链、适用范围和替代关系 | 不同主体偏好混合、过期事实覆盖新事实、敏感范围扩大 |

1. 编辑器打开时保存 `baseRevision`；多名用户各有草稿，Agent 提炼保存同样的 base 和来源。首期支持并发草稿与冲突 UI，不承诺实时字符级协同或另建 CRDT。
2. 提交 `proposed` 时读取目标 `current`，执行 base/current/proposed 三方合并；保留三栏差异、作者、变更块及理由，不以 last-write-wins 覆盖另一个人的更新。
3. 非重叠文本改动仍做语义校验：事实一致性、依赖完整性、适用边界、ACL、来源、步骤顺序和行为风险。Agent 输出建议、证据和不确定项，不能自动判安全。
4. 人工 `locked` 块/事实禁止自动覆盖，冲突转人工；授权维护者显式解除或修改锁须理由、审计及新审核，不能由提炼器偷偷解锁。
5. 风险评估后，低风险去重仅在策略允许且不改共享事实/行为时自动；其余进入人工审核。编辑审核结果会生成新的 `mergedHash`，旧批准失效。
6. 审核记录绑定 **`mergedHash + headRevision`**，同时记录 reviewer、理由和范围；产出候选的 Agent 不自批。审核的不是过时 proposed，也不是仅审一个 ChangeSet ID。
7. 发布前再次验权，以期望 head revision 执行 CAS；head 已变则 `merge_required`，重新取 current、合并、语义校验并审核，禁止沿用旧批准直接覆盖。
8. 用户在 review 查看 base/current/proposed/merged、冲突与影响，可保存草稿、退回或批准；失败保留草稿与 operationId，刷新不能丢失其他人的已提交版本。

状态草案：`draft → proposed → merging → needs_review → approved → indexing → ready → published`；分支为 `conflicted / rejected / merge_required / index_failed / revoked`。批准与发布结果分开，不能把 approved 渲染为已生效。

## 9. R11 派生索引、原子 manifest 与不漂移快照

- 文本、结构化事实、Skill/场景/剧本 revision 是版本化内容；向量索引和 graph 是派生索引，必须从同一审核后的合并版本构建并登记内容 hash、模型/解析器版本与构建状态。
- 发布流程：准备不可变合并内容 → 构建 manifest 所需全部派生产物 → 校验 hash、完整性及可访问性 → 复验权限和审核绑定 → CAS 原子切换可见 manifest 指针。
- 任一必需索引未就绪不发布该 manifest；UI 显示部分构建/失败并保留旧 manifest。重试复用合法构建产物并保证幂等，CAS 冲突需重新合并审核。
- **manifest 原子可见不等于 distributed transaction 已完成**。内容库、向量库和图存储采用 staging、不可变引用、重试与补偿/对账；读者只经已发布 manifest 获取对应版本，不能各自读取 latest。
- Task 保存 `planningSnapshotId`，Run 保存 `actualSnapshotId`；后者固定实际解析的 Agent、资产、空间内容 revision、规则/工具描述和注入计划，另存实际召回/注入证据。计划与实际差异需解释，不回写成一致假象。
- Task 创建时固定规划 snapshot；后续发布不自动改变旧任务。Run 应从该规划版本解析；资源不可用时暂停或请求显式升级，不以最新版本替代缺失引用。
- “升级”先展示旧/新版本、权限及行为差异，由有权用户确认，生成新 planning snapshot 修订与新 attempt/Run；旧 attempt、历史报告和原 snapshot 保持原样。
- 内容版本不漂移不代表权限被冻结：撤权实时作用于后续读取、注入与工具执行，并失效权限缓存；历史正文访问也要重验当前权限。
- 已进入模型上下文的历史内容不能撤回。检测相关撤权后暂停受影响 Run，阻止继续使用旧上下文，重建获授权上下文并经新 attempt 继续；不声称“已从模型删除”。
- 被 active snapshots 引用的历史 revision、索引和 manifest 不得 GC；维护引用账本，纳入仍需回放的快照保留策略。GC 仅在无引用且满足保留规则时另行审批，本轮不执行清理。
- 快照详情展示 manifest 状态、引用版本、内容与授权检查时间、计划/实际差异及缺证项；旧 trace 缺快照明确显示 unknown，禁止拿 latest 回填。

## 10. R12–R14 仅基于传入记忆的质量与经验闭环

输入边界：接受 incoming memory 中原始 structured tool records、对话/消息、摘要及附件引用；不要求额外实时监控。导入后记录来源覆盖、截断区间与缺口，摘要无法证明的调用/结果不补造。

| 证据类别 | 可支持的结论 | 不可据此推断 |
|---|---|---|
| 原始结构化记录 | 去重后的 call、明确结果、阶段、参数/结果摘要、时序 | 缺失记录中的调用是否成功；返回 200 不等于任务验收 |
| summary-only | 摘要明确报告的失败/成功描述和候选问题 | 完整调用次数、精确失败率、未提及步骤从未发生 |
| derived / injected memory | 来源追溯、复用情况、候选线索 | 新的独立成功/失败证据；不能循环回灌抬高统计 |

- 去重优先使用 `sourceSystem + sourceSessionId + sourceMessageId` 与其下 `callId`；callId 作用域需声明，不能把不同 session 的同名 call 合并。重复导入同一消息/调用不增加次数；重试的独立 call 保留 attempt 关联。
- 没有稳定 ID 时，以来源定位和规范化 hash 做有限去重并显示不确定性；相似摘要不是同一次调用的确定证明。衍生条目用 lineage 回到原始证据，避免一次运行被多份摘要重复计数。
- 统计按 Tool/MCP server+tool/Skill 稳定 ID、版本、环境、时间窗及授权范围分组；展示 `knownSuccess / knownFailure / unknownOutcome / policyDenied / coverage`，不做无分组全局排名。
- Tool/MCP 可靠性失败率为 `knownFailure / (knownSuccess + knownFailure)`，限有明确调用及终态、属于该可靠性口径的独立尝试；分母为零显示“—”。未知结果数、分母未知的摘要失败报告单列，不并入零或精确比率。
- policy denied 是策略决策，不算工具可靠性故障；认证、参数、上游、超时等须按证据说明责任层，不能把所有业务失败都标成 MCP 故障。请求前被拒与实际执行报错分开。
- Skill 的 **mounted ≠ read ≠ executed ≠ task accepted**。分别统计阶段覆盖，仅在有明确执行/结果关联时计算执行成功率；有任务验收证据才报告 accepted，缺证均为 unknown，不推断为失败或成功。
- R13 检测重复论述、无信息增益步骤、重复动作、状态不变和验收距离未缩小；输出具体 message/call 区间、比较状态、已观测代价与判断依据。“废话”是可复核候选标签，不因字数长直接判错。
- 循环检测排除合法 pagination、进度可见的 polling、契约允许的 bounded retry；超过边界或无进展才提出候选。摘要缺时序时只给疑似，不定性为死循环。
- 根因统一为 `confirmed / hypothesis / missing_evidence`：confirmed 要有直接证据及推理链，hypothesis 列可替代解释和补证建议，missing_evidence 明确缺失记录。相关性不自动变因果。
- R14 从有明确调用输入、环境/版本、输出及验证结果的记录提炼 `validated_example`；仅有摘要赞誉、Agent 自称成功或未执行建议则为 `unverified_proposal`。验证范围仅覆盖观察到的环境与结果，不外推普适成功。
- 经验记忆包含目的、前置条件、脱敏参数、调用步骤、预期/实际结果、验证方法/证据、适用边界、禁用条件和源 ID；提炼本身不重新执行工具，无验证证据不得换标签。
- 推荐“复用样例”先检查当前版本/权限/环境差异；采用进入 ChangeSet，首期共享发布由人工审核。调用样例不得携带密码、Key、生产个人数据或未经授权的跨项目内容。
- 质量面板与 V3 `analytics` 线上用量分开：前者标题注明“来自传入记忆，覆盖非全量”；图表给统计区间、去重规则、分母/unknown、规则版本，演示指标标“虚构”。

## 11. 原型新增页面与操作建议

以下是建议 route keys/Tab，不是已实现页面清单；后续主交付方须验证实际视图数量与深链，不在本文沿用或修改 V3 已记录的数量。

| route key | Tabs | 目的与主要操作 | 为什么单列 |
|---|---|---|---|
| `access` | `login / users / keys` | 虚构登录、用户及关系查看、个人/服务 Key scope 预览、独立身份状态 | 分清“凭据可用”和“知道谁在操作” |
| `routing` | `resolve / bindings` | 输入模拟上下文 → 看授权候选/理由 → 确认主/参考项目与写目标 → 查看绑定 | 防止按最近项目误路由，解释歧义与拒绝 |
| `ingestion` | `import / quality / experience` | 导入虚构记忆 → 看去重/归属 → 质量证据 → 提炼候选 | 将输入、判断与可发布经验串成可追溯链 |
| `changes` | `queue / review` | 按风险筛选 → 四版本差异 → locked/语义冲突 → 人工判断 → 模拟 CAS 冲突 | 审核不只是一个批准按钮 |
| `snapshots` | `manifest / upgrade` | 看派生构建状态与引用 → 比较 Task/Run snapshot → 预览升级新 attempt | 解释发布何时可见、旧任务为何不变化 |
| `templates` | `agents / scenes / playbooks` | 查看版本/权限依赖 → 引用/派生候选 → 进入变更审核 | 轻量复用，不与现有 Agent 管理/编排重复造运行时 |
| 增强 `assets / memory` | 保留原 Tabs | 四维任意组合筛选、归属解释、来源/版本链接 | 延续现有入口 |
| 增强 `wiki / analysis` | `graph` | Wiki 三类关系切换；Code 类别过滤及 commit 锚点 | 不新增重复的 CodeGraph 一级目录 |

- 与现有 `settings/keys,members`、`governance/approvals`、`agent/versions` 互链同一模拟对象，避免双份相互矛盾的状态；旧入口保留。
- 建议演示链：共享 Key 未验用户 → 服务共享范围 → 多项目待确认 → 导入/提炼 → 人工与 Agent 并发冲突 → 审核 → 索引失败/重试 → manifest 发布 → 旧 Task 不变 → 显式升级。
- 全页标注“mock 演示，不连接后端”；敏感输入采用不可用样例/选项，不存真实密钥。说明演示状态是否仅内存、刷新是否重置，重置仅影响本原型。
- 统一覆盖 loading、empty、partial、error、denied、offline、stale、success；网络/契约不可用不能显示成功，冲突保留草稿，拒绝文案不泄露私有对象。
- 图表提供列表替代；Tab/筛选/审核可键盘访问，冲突定位移动焦点，错误用文字与 aria-live；继承 V3 320/768/1024/1440px 及明暗主题约束。

## 12. 字段与操作契约草案

命名为领域操作，不声明正式新增 URL。沿用 V3 兼容 adapter、分页和错误模型；凭据秘密仅通过认证通道，禁止进入业务 body、URL、日志或审计。

| 对象/操作 | 最小字段或输入输出 | 服务端不变量 |
|---|---|---|
| Credential / Principal | `credentialId,type,scope,servicePrincipalId,createdBy,fingerprint,expiresAt`；`verifiedUserId,actorStatus,delegationRef` | 实际主体由认证得出；服务不继承 createdBy 权限 |
| AuthorizedContext | `tenantId,principalId,teamMemberships,projectMemberships,permissionsRevision` | 多团队/多项目；scope ∩ 主体权限 ∩ ACL，不用 ownerTeam 代替权限 |
| ListFilter | `teamIds[],projectIds[],userIds[],agentIds[],cursor,sort` → `items,total?,asOf` | 先授权后 AND/OR 筛选，稳定分页和隔离缓存 |
| Resolve / Bind | `taskId?,runId?,sessionId?,explicitContext?,hints?` → `bindingId,revision,status,reasons,authorizedCandidates` | 无权显式目标拒绝；冲突不静默覆盖；候选不泄露越权对象 |
| Binding | `primaryProjectId,referenceProjectIds[],writeTargetSpaceId,source,confirmedBy?,boundTo` | 主项目/读取范围/写目标分别验证；Run 固定绑定 |
| IncomingMemory | `ingestId,sourceSystem,sourceSessionId,sourceMessageId,callId?,sourceRefs[],contentHash,evidenceKind,lineage,coverage` | 脱敏、幂等、来源追踪；summary-only 不补造 calls |
| Ingest result | `classificationStatus,targetSpaceId?,policyDecision,dedupResult,candidateIds[],operationId` | 正式写入、待审、暂存、拒绝分开返回 |
| ChangeSet | `id,targetStableId,applicability,baseRevision,currentRevision,proposedHash,mergedHash,lockedPaths,sourceRefs,risk,status` | 三方合并，非重叠仍验语义，locked 不被自动覆盖 |
| Review / Publish | `changeSetId,mergedHash,headRevision,decision,reason,idempotencyKey` → `reviewId,operationId,status` | reviewer 来自认证；审核绑定 hash+head，CAS 冲突重新合并审核 |
| Manifest | `manifestId,contentRefs[],vectorIndexRefs[],graphRefs[],dependencyHashes,buildStatus,revision` | 必需项全部 ready 后原子可见；各存储 latest 不作为读取入口 |
| Snapshot / Upgrade | `planningSnapshotId,actualSnapshotId,manifestId,bindingRevision,assetRevisions,policyRefs,sourceChain`；`expectedTaskRevision,targetManifestId,reason` | 升级生成新快照修订与 attempt，旧内容不改；当前权限实时检查 |
| QualityReport | `window,grouping,knownSuccess,knownFailure,unknownOutcome,policyDenied,denominatorStatus,coverage,dedupRuleVersion,rootCauseStatus,evidenceRefs` | 分母未知单列；派生/注入内容不作为新独立证据 |
| Experience | `experienceId,status,goal,preconditions,environment,versions,redactedCall,expectedResult,observedResult,validationRefs,limitations,lineage` | validated_example 必须有验证证据，否则 unverified_proposal |

读写响应保留 `requestId`、warnings、状态和时间；变更带幂等键及期望 revision。领域错误草案：`identity_required / access_denied / context_conflict / needs_classification / merge_required / semantic_conflict / index_not_ready / snapshot_unavailable / permission_revoked / evidence_insufficient`；HTTP 映射沿用 V3，私有对象拒绝保持不可枚举。

## 13. 失败场景与可观察验收

本表是未来实现/原型走查用例，不是已执行测试记录。原型只验可见演示行为，正式实现另验真实权限、持久化和并发。

| 编号 | Given / When | Then：必须可观察的结果 |
|---|---|---|
| R01 | 共享个人 Key；或服务 Key 仅传创建者/userId | 不宣称识别真实操作者；服务只进共享授权范围，`actor_unknown`；独立身份验证成功后才允许用户代理范围 |
| R02 | 用户跨两团队获项目授权，分别组合四维筛选并清除 Team | 返回授权交集；不要求加入 owner team；无权名称/计数不出现；清除可恢复跨团队结果 |
| R03 | 选择两个 commit 查看调用/依赖关系 | 每张图标对应 revision；推断与实测区分；缺索引不伪造节点或回填 latest |
| R04 | 同两篇 Wiki 有显式链接与高向量相似 | 展示两种不同边及证据；相似度不自动生成事实关系；知识图可追原文 |
| R05 | 导入含个人偏好和项目事实；无明确写目标 | 建议分别归属，逐一验权；歧义暂存或拒绝，不泄露到共享空间；重复导入不重复写入 |
| R06 | 从摘要提炼 Wiki、代码片段与 Skill | 生成来源可追候选；代码标 snippet/patch_candidate，无假 commit；缺测试证据标待验证 |
| R07 | 启用内置合并 Agent 但无目标写权限 | 可见授权范围内的建议，不发布/提权/自批；模板 revision 可查 |
| R08 | 两个相似剧本步骤不同并发生并发修改 | 以稳定 ID 展示结构差异并审核，不按名称覆盖；采用后仍走现有 Task/Agent |
| R09 | 打开 Code 场景模板 | 明确“暂按 Coding Agent 工作流，原意待确认”；不展示其他解释已实现 |
| R10 | 两个 Session 属不同项目；显式无权项目；仓库映射多项目 | 不受最近项目影响；显式越权拒绝无 fallback；歧义要求确认，LLM 无权授予项目 |
| R11 | 人工与提炼器并发，涉及 locked、非重叠语义冲突、审核后 head 前移 | locked 不自动改；语义冲突待审；hash/head 失效后 CAS 拒绝，保留草稿并重新合并审核 |
| R11 | 图索引未就绪，随后发布新 manifest；旧 Task 再运行 | 未就绪不切可见版本；旧 Task 保持规划快照；显式升级新 attempt；引用中的历史 revision 不 GC |
| R11 | Run 已注入内容后被撤权 | 立即阻止后续授权动作并暂停受影响 Run，告知不可撤回已注入内容；重建授权上下文，不以快照绕过撤权 |
| R12 | 导入重复 calls、summary-only、policy denied、仅 mounted Skill | calls 去重；未知分母单列，denied 不计可靠性故障；Skill 执行/验收为 unknown；根因保留证据等级 |
| R13 | 分页、轮询、有界重试与真正重复无进展记录混合 | 合法控制流程不误报循环；候选定位区间和进展依据，缺时序只标疑似，不编根因 |
| R14 | 导入验证通过的调用与未经执行的建议，再回灌提炼记忆 | 分别为 validated_example/unverified_proposal；回灌不增加独立证据计数；共享发布需审核 |

安全与恢复补充：过期登录/Key 返回失效态而非空列表；服务暂不可用保留非敏感草稿；发布超时先查幂等 operation；审阅权撤销令待发布操作失效；旧 snapshot 引用丢失时暂停并显示缺项，不补造历史。

## 14. 增量发布分期与待确认项

| 阶段 | 最小可独立交付增量 | 放行门槛 |
|---|---|---|
| S0 设计/原型 | 本文；后续新增六组 route keys，增强四维筛选及两类专业图谱入口 | R01–R14 映射与演示链走查；持续 mock 提示；不改业务代码，不宣称 backend 已接入 |
| S1 身份与确定性路由 | 个人/服务凭据、独立用户验证、多团队授权、Task/Run/Session 绑定、归属隔离暂存 | Harness 新旧客户端兼容、交叉授权/拒绝无 fallback/缓存隔离负例通过 |
| S2 版本与审核底座 | ChangeSet 三方合并、locked、语义审核、CAS、manifest、Task/Run snapshots | 两人+Agent 并发与索引失败恢复、撤权暂停、active 引用保护验证通过 |
| S3 输入与证据闭环 | incoming memory 去重/覆盖、R12/R13 质量、R14 样例、人工审核提炼 | 固定结构化/摘要/未知/回灌样本集口径一致；不依赖额外实时监控 |
| S4 有界提炼与复用 | 内置 Agent、Wiki 三图、Code 类别、Skill/Scene/Playbook 候选 | 来源/版本/权限可追；低风险去重自动，其余共享事实/行为仍人工审核；R09 扩展先确认 |

- 各阶段按 capability 与授权项目灰度，先 shadow read/人工检查；只做增量关系与 revision，不删除旧列、旧路由或历史数据。回滚关闭新入口/发布开关，保留新证据；不能让持有新 snapshot 的运行悄悄回退旧契约。
- 服务依赖未就绪时显示“待接入”，S0 页面不构成 S1–S4 放行证据。自动化程度后续按固定评测和误合并风险再评审，不默认为“最终全自动”。
- 待确认：R09 原提出者的 Code 场景含义；独立用户证明/委托在 Harness 中的具体承载方式；实例开放注册策略；canonical topic 维护责任、适用时间规则、快照保留期和解析语言能力。
- 上述未决项阻止对应实现承诺，不阻止本增量文档落地；不自行猜测其答案或变更 V3 基线。

## 15. 官方参考与采纳限制

- [GitNexus](https://github.com/abhigyanpatwari/GitNexus)：参考代码关系探索、执行链路与社区表达；不将参考能力写成本产品已有实现。
- [Obsidian Graph](https://help.obsidian.md/plugins/graph)：参考基于显式链接的图视图、过滤和局部关系探索；与 embedding 向量相似图区分。
- [GraphRAG 默认数据流](https://microsoft.github.io/graphrag/index/default_dataflow/)：参考抽取、关系/社区及派生索引流程；生成关系仍需出处和可信状态，不天然等于事实。
- [Git merge](https://git-scm.com/docs/git-merge)：参考三方合并与冲突处理概念；文本自动合并不证明语义正确，也不代替 ACL、审核、CAS 或跨存储发布协议。

参考链接沿用讨论给出的材料；本文未新增网络核验。本文完成仅代表增量需求已写入，原型集成与业务实现须各自提供实际验证记录。
