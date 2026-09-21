# 决策记录

本文件记录当前设计中已确认的产品决策。`DOMAIN-MODEL.md` 定义对象与授权模型，`PRODUCT-DESIGN.md` 定义由模型推导的体验；本文件说明为何采取这些边界。

| 编号 | 决策 | 状态 | 原因与影响 |
|---|---|---|---|
| D-01 | Team → Project 为 1:N；Project 只能有一个 owning Team | 已确认 | 保持所有权唯一。跨 Team 协作走成员/ACL/只读引用，不给 Project 增加第二个 owning Team。 |
| D-02 | `open` Project 授予 owning Team 成员日常协作入口，不授予资源管理或治理权 | 已确认 | 防止“开放”被误解为对所有资源和策略的完全控制。敏感资源与审批仍单独检查。 |
| D-03 | Team / Project 成员资格与资源 CRUD 分离 | 已确认 | 对 Memory、Wiki、Code、Skill、Template 的 `view/create/update/delete` 由资源角色或 ACL 决定。 |
| D-04 | Agent-Team / Agent-Project 关联授予受约束的 `view/use`，不授予管理权 | 已确认 | Agent 能在关联范围内查看和使用已获准能力，仍受 policy、ACL、credential 和 RunGate 限制。 |
| D-05 | Agent 可为 public-discoverable，且可关联多个 Team / Project | 已确认 | 允许复用 Agent；公开只代表可发现/按策略使用，不代表能修改配置或读取所有上下文。 |
| D-06 | 不提供公共 Memory | 已确认 | Memory 常含上下文、运行痕迹或敏感信息。需要复用时转化为已审核的 Wiki、Skill 或 Template。 |
| D-07 | User、Team、Project 都可拥有独有的 Skill、Wiki、Code、Memory、Template | 已确认 | 每个资源保留唯一 owner 和 scope；跨 scope 通过 ACL、引用、挂载、复制或派生实现。 |
| D-08 | Platform 可维护公共 Wiki、Skill、Template；Code 不复制为公共资源 | 已确认 | 平台公共内容需有发布治理；Code 始终引用 source + revision 并服从原仓库权限。 |
| D-09 | Team 模板是主沉淀层；Project 以锁定版本引用或派生版本消费 | 已确认 | 防止模板升级静默改变 Project、Task 或历史 Run。 |
| D-10 | 接入中心在 Team 聚合，写入必须先经过 Triage | 已确认 | Team 是队列聚合点而不是不明内容的默认 Memory owner。 |
| D-11 | 变更中心跨 scope 聚合，ChangeSet 的归属和审批跟随目标对象 | 已确认 | 聚合提高发现效率但不创建新的所有权层；列表先授权后过滤。 |
| D-12 | Team 默认规则可被 Project 收紧，不能被绕过或放宽 | 已确认 | 保持平台 / Team / Project 的策略继承方向单向收紧。 |
| D-13 | 不设置常规全局 Run、资源库、独立编排工作台 | 已确认 | Run 从 Task / Project 下钻；专业资源独立管理；协作步骤属于 Task 计划和 Run 证据，复用过程属于 ProcedureTemplate。 |
| D-14 | 用户创建可选加入 Team；API Key 仅创建时显示一次 | 已确认 | 用户和 Team 解耦；Key 只保存指纹/哈希等元数据，之后只能撤销/轮换。 |
| D-15 | 公共模型配置为 Platform 管理对象，模型密钥只放 Vault 引用 | 已确认 | Agent 选择获准模型配置，不能复制或回显平台凭据。 |
| D-16 | Agent 基本定义与资源授予分离 | 已确认 | Agent 记录名称、描述、类型、可见性、owner、状态、版本、标签和关联范围；Memory/Wiki/Code/Skill 的 `view/use/write` 必须逐资源授权，public Agent 不公开私有资源。 |
| D-17 | 同时支持外部 Harness Agent 与平台自有治理 Agent | 已确认 | 外部 Agent 通过 Connector 接入、读取上下文并提交候选；平台治理 Agent 负责 Memory L0–L3 整理、根因分析、知识/Skill/Template 提炼、Code Context 分析和质量检查。两者的运行时配置与权限边界必须分开。 |