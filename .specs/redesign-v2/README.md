# TencentDB Agent Memory 重设计方案 v2

本目录是 2026-09-10 重新扫描后形成的设计真相源。本轮只修改 `.specs` 文档，未修改产品代码。

## 产品设计文档与可交互原型 V3（推荐入口）

- [`product-design-v3.html`](./product-design-v3.html) — 新版独立单文件：产品设计文档与交互原型双模式。浏览器直接打开，无需启动服务或安装依赖。
- [`PRODUCT-DESIGN-V3.md`](./PRODUCT-DESIGN-V3.md) — 详细产品规格：定位、核心概念、布局、模块操作、架构与时序、权限、状态、契约、分期与验收。
- [`PROTOTYPE-V3-VALIDATION.md`](./PROTOTYPE-V3-VALIDATION.md) — 本轮浏览器验收记录、演示边界与未验证项。

新版综合 V1（`../redesign/`）、本目录 V2、当前代码和指定参考文档结构，重新组织工作入口与专业工作台，不覆盖旧版。

**推荐体验：** 打开新版 →「交互原型」→ 项目 → DB-Proxy 可靠性 → 任务 → Run → 生效上下文 → 记忆 → 原始文档。也可进入治理中心，演示审批与审计闭环。

**交互边界：** 页面/子页切换、关联抽屉、筛选分页、角色与状态切换、任务创建、记忆管理、审批等均使用虚构数据。模拟写入仅存于浏览器内存，刷新恢复；策略、模板、邀请、密钥配置只做预览，不执行真实变更。没有后台请求或真实模型调用。

## 保留的旧版原型

[`product-prototype.html`](./product-prototype.html) 保留原有 V2 内容与布局，补修深链、前进后退、子页点击和键盘交互。它与 V3 是两份独立交付，不互相覆盖。

打开方式：直接用浏览器打开任一 HTML 文件。

## V2 方案阅读顺序

1. [`00-MASTER-PLAN.md`](./00-MASTER-PLAN.md) — 产品定位、真实基线、目标架构、分阶段路线；
2. [`01-REFERENCE-ARCHITECTURES.md`](./01-REFERENCE-ARCHITECTURES.md) — intent-os-platform、MindMemOS、蓝图项目的概念/关系/架构/采纳边界；
3. [`02-TARGET-DOMAIN-AND-CONTRACTS.md`](./02-TARGET-DOMAIN-AND-CONTRACTS.md) — 目标实体、API、读模型、命令、状态机；
4. [`03-CALL-SEQUENCES.md`](./03-CALL-SEQUENCES.md) — 核心调用时序；
5. [`04-UI-RESTORATION-AND-REDESIGN.md`](./04-UI-RESTORATION-AND-REDESIGN.md) — 页面恢复、信息架构、页面和 Tea UI 规范；
6. [`05-DELIVERY-BACKLOG-AND-ACCEPTANCE.md`](./05-DELIVERY-BACKLOG-AND-ACCEPTANCE.md) — change 拆分、验收、迁移、回滚、风险。

扫描证据继续保留在：

- [`../refs/intent-os-platform.md`](../refs/intent-os-platform.md)
- [`../refs/mindmemos.md`](../refs/mindmemos.md)
- [`../refs/page-parity-audit.md`](../refs/page-parity-audit.md)

状态口径：`现存-可复用`、`现存-断入口`、`骨架-待契约`、`设计-待实现`、`不采纳`。无实现与验证证据时不得标记“已完成”。
