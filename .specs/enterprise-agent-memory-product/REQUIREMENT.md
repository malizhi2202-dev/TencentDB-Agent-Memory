# REQUIREMENT: Enterprise Agent Memory 产品工作台

- **Change ID**: `enterprise-agent-memory-product`
- **关联**: `@.specs/enterprise-agent-memory-product/CHANGE.md`、`@.specs/enterprise-agent-memory-product/DESIGN.md`

---

## 用户故事

- **US-1**：作为 Project/Team 用户，我想沿着 Project → Task → Run 查看工作上下文、来源 revision、证据和当前权限，以便继续工作而不是猜测。
- **US-2**：作为 Memory/Knowledge Owner，我想查看候选记忆的归属、血缘、Purpose、敏感级别和目标 scope，以便在发布前分流、脱敏和审核。
- **US-3**：作为治理人员，我想查看撤回、清理、备份、Provider 和外部副本的已知/未知状态，以便不把请求误报为已完成。
- **US-4**：作为 Agent Admin，我想查看 Agent 的 `view/use/write` 授权、Tool Policy、RunGate、Vault 引用和运行证据，而不暴露秘密。
- **US-5**：作为审计/法务协作者，我想生成按内部、客户、Provider 和监管受众分层的事实报告，以便保留最小披露和版本证据。

## 验收准则（AC）

### AC-1 · 工作现场连续性

- **Given** 用户进入 Project 工作台
- **When** 打开 Task、Run 或 Context 详情
- **Then** 页面显示当前 scope、source/revision、Task 目标、Run 状态、证据完整性和权限边界；Run 不作为常规顶层资源出现。
- **验证方式**: `UAT-01`、原型 `#/project/p-db/overview` → `#/task/t-104/run/r-83`

### AC-2 · 记忆与知识分流

- **Given** 存在低置信度或跨 Project 的导入候选
- **When** 用户打开 Triage
- **Then** 页面显示候选归属、理由、置信度、Purpose、敏感性、来源血缘和可选目标；未经确认不得自动写入 Team Memory。
- **验证方式**: `UAT-02`、原型 `#/ingestion/triage`

### AC-3 · 权限与执行门禁

- **Given** Agent 具有关联 scope
- **When** 查看 Agent 详情或准备执行 Action
- **Then** 页面分别显示 `view/use/write`、资源 ACL、Purpose、Tool Policy、RunGate 和阻断原因；关联不自动授予管理权或执行权。
- **验证方式**: `UAT-03`、原型 `#/agent/a-retriever`

### AC-4 · 清理与外部副本证据

- **Given** 某副本已请求撤回但 Provider/备份状态未知
- **When** 用户查看清理详情
- **Then** 页面区分 `requested`、`blocked`、`executed`、`verified`、`retained`、`unknown`，显示范围、证据时间和责任边界，不显示“全量已清理”。
- **验证方式**: `UAT-04`、原型 `#/governance/cleanup`

### AC-5 · 报告与通知版本

- **Given** 事实报告有多个受众或发生修订
- **When** 用户打开报告中心
- **Then** 页面显示事实快照、接收者投影、版本、有效期、投递状态、未知字段和 `supersedes/revokes` 关系；模板不能绕过字段投影。
- **验证方式**: `UAT-05`、原型 `#/reports`

### AC-6 · 敏感信息保护

- **Given** 页面显示 API Key、Vault 或 Provider 信息
- **When** 用户浏览、复制或查看错误
- **Then** 只显示引用、指纹、scope、轮换/撤销状态，不回显秘密；拒绝信息不得泄露无权对象名称或数量。
- **验证方式**: `UAT-06`

### AC-7 · 状态完整性

- **Given** 数据加载、为空、无权限、部分、离线、过期、错误或成功
- **When** 用户访问任一列表/详情
- **Then** 页面使用可区分的状态，不将 unknown 当作 0、不将 Run success 当作 Task accepted、不将 approved 当作 published。
- **验证方式**: `UAT-07`

### AC-8 · 原型可访问性与离线运行

- **Given** 用户直接打开 HTML 原型
- **When** 使用键盘、窄屏或暗色主题浏览
- **Then** 原型无外部请求，支持 hash 深链、焦点可见、Esc 关闭、响应式单列、暗色主题和无横向溢出。
- **验证方式**: `UAT-08`、`node --check`、浏览器人工检查

---

## 范围切分

### v1（本次必做）

- 产品需求、架构设计、UI Design、任务拆分和验收记录；
- 可离线打开的 HTML 信息架构/交互原型；
- Home、Project、Task/Run、Memory/Triage、Agent/权限、清理证据、报告/通知等核心视图；
- loading、empty、partial、denied、error、offline、stale、success 和 unknown 语义；
- 原型使用合成数据并明确只读。

### v2（下一轮考虑，不本次）

- 真实 API、数据库和事件/血缘存储；
- 真实 RBAC/ABAC、RunGate、Provider 对账和通知渠道；
- 端到端低敏样本验证、浏览器自动化回归和真实部署；
- Copy Inventory 最终 Schema、状态机、SLA 和合同/法域适配。

### out（永远不做）

- 在原型中执行真实删除、终端擦除、迁移、外部通知或生产 Run；
- 暴露凭据、API Key 明文、Vault Secret 或跨租户私有数据；
- 创建与历史 v2/v3 设计并行的第二套产品信息架构；
- 把阶段性方案宣称为最终法律、合规或工程实现结论。

## 非功能性需求

- **性能**: 原型为本地静态文件；无网络依赖。
- **可访问性**: 键盘可操作、focus-visible、语义按钮/链接、颜色不作为唯一状态表达；目标 WCAG 2.1 AA。
- **安全**: 合成数据；禁止秘密回显；跨 scope 信息最小投影；高风险动作默认阻断。
- **兼容性**: 现代 Chromium/Firefox/Safari；窄屏单列，支持直接 hash 深链。
- **可观测性**: 原型不发送埋点；真实实现需记录状态、证据、投递和审计事件。

## 依赖与假设

- 权威产品语义来自 `.specs/enterprise-agent-memory-platform/`；历史 `.specs/final-v1` 仅作为当前既有对象关系和原型交互参考，不修改。
- code-kit 默认 UI 语言使用中文，视觉采用单一蓝色、纯黑暗色、1px 边框、系统字体和无外部依赖。
- 真实实现必须在 Schema、责任矩阵、法务和部署拓扑确认后另开实现 change。

---

> AC 是 TEST 阶段派生用例的唯一来源，禁止在 TEST 阶段引入新 AC。
