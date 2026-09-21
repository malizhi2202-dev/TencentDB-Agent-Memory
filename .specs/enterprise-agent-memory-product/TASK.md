# TASK: Enterprise Agent Memory 产品文档与 HTML 原型

- **Change ID**: `enterprise-agent-memory-product`
- **依据**: `REQUIREMENT.md`、`DESIGN.md`、`UI-DESIGN.md`
- **实施边界**: 本 TASK 仅生成和验证设计文档/只读原型，不修改产品实现。

## T-01 · 建立产品文档骨架

- **read_files**: `.specs/enterprise-agent-memory-platform/README.md`、议题 01–10、`code-kit/templates/REQUIREMENT.md`、`DESIGN.md`、`UI-DESIGN.md`
- **write_files**: `CHANGE.md`、`REQUIREMENT.md`、`DESIGN.md`、`CONCEPTS.md`、`ARCHITECTURE.md`、`UI-DESIGN.md`
- **action**: 整理目标、用户故事、AC、范围、架构、状态机和视觉规则。
- **verify**: 文档路径存在；AC 均可追踪；`git diff --check`。
- **done**: 三份设计文档与 CHANGE 互相链接且不冻结未决实现。

## T-02 · 生成离线 HTML 原型

- **read_files**: `REQUIREMENT.md`、`DESIGN.md`、`UI-DESIGN.md`、`.specs/final-v1/PRODUCT-DESIGN.md`（只读参考）
- **write_files**: `product-prototype.html`
- **action**: 使用合成数据实现工作台、Project/Task/Run、Triage、Agent、清理证据、报告和状态视图；提供 hash 路由、主题切换、筛选、详情展开和只读提示。
- **verify**: `node --check`、无外部 URL、关键路由 grep、浏览器人工 UAT。
- **done**: 原型可直接打开，所有 v1 核心路径可操作。

## T-03 · 原型验证记录

- **read_files**: `product-prototype.html`、`REQUIREMENT.md`
- **write_files**: `VALIDATION.md`
- **action**: 记录脚本检查、路由检查、无外部请求、状态覆盖和已知限制。
- **verify**: `git diff --check`；验证记录不虚构真实后端结果。
- **done**: 验证证据与 AC 一一对应。

## T-04 · 按参考模板重绘产品文档与原型（单文件）

- **read_files**: `.specs/enterprise-agent-memory-platform/` 议题 01–10、本目录 `CONCEPTS.md`/`ARCHITECTURE.md`/`DESIGN.md`/`UI-DESIGN.md`/`REQUIREMENT.md`、`.specs/final-v1/`、`.specs/redesign-v3/`（只读）、参考模板 `product-design.html`（只读）
- **write_files**: `PRODUCT-DESIGN.html`（单文件）、`_build/`（`CONTRACT.md` + 片段 + `build.sh` + `check.sh`）、`_facts/`（蒸馏稿）、`VALIDATION.md`
- **action**: 以参考模板的文档骨架（sticky 顶栏 + 目录侧栏 + 长文档 + 内嵌原型壳）重绘：§0 导读 / §1 产品全景 / §2 核心概念 / §3 系统架构 / §4 六条核心时序 / §5 18 个模块操作手册 / §6 13 屏界面原型 / §7 权限矩阵 / §8 术语表 / §9 FAQ / §10 附录。令牌按 `UI-DESIGN.md` 覆盖，暗色为纯黑并支持切换。
- **verify**: `bash _build/build.sh && bash _build/check.sh` 全绿（零外部依赖 / 零 emoji / 零图片 / 锚点无断链 / 内联 JS 语法 / 无占位文本 / 侧栏一致性）；全文档 HTML 标签配平；§5.0 ≡ §7.1 ≡ 原型 p12 三处权限矩阵逐格一致；5 组页签作用域隔离。
- **done**: 单文件离线可打开；三处矩阵无矛盾；侧栏 20 项在桌面端不被裁切。**人工浏览器 UAT 待执行**（见 `VALIDATION.md` §7）。
- **note**: `product-prototype.html`（T-02 产物）保留未删，由本文档取代。

## 依赖顺序

`T-01 → T-02 → T-03 → T-04`

## 不执行

不执行真实 API、数据库、权限裁决、删除、迁移、通知、Provider 对账或生产测试。
