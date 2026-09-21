# CHANGELOG

| 日期 | change-id | 摘要 | LESSONS |
|---|---|---|---|
| 2026-09-03 | agent-collab-ui-redesign | MemoryPanel UI 重构：导航 6 组信息架构 + 协作项目 7 Tab / Agent 4 Tab / 记忆空间骨架 + 工作台双列栅格 + 团队切换重设计（分组标题=当前团队）| L-001, L-002 |
| 2026-09-10 | health-sweep-2026-09（纯文档，零代码） | 全前端入口层健康巡检 + 与早期版机械对账：**后端零删除**、分析页整页误删、2 个骨架页、3 处重复注册、24 个 i18n 缺键、23 个死模块。产出：`health/2026-09-10-HEALTH.md`、`redesign/`（方案包 9 份）、`refs/`（外部扫描 3 份）。**同步更正**：`CONTEXT.md`（测试陈述）、`intent-os-mindmemos-adoption.md`（A3 公式被推翻）、`memory-platform-backlog.md`（+B11–B14、+C11–C15）、`design-memory-isolation-m1.md`（测试目录陈述）| L-003 ~ L-008 |
| 2026-09-21 | enterprise-agent-memory-product（纯文档，零代码） | 按参考模板 `product-design.html` 重绘产品文档与原型：单文件 `PRODUCT-DESIGN.html`（444KB / 4,353 行，零外部依赖，§0–§10 十一章 + 13 屏界面原型 + 纯黑暗色主题）。以 `_build/CONTRACT.md` 为唯一对齐契约，5 个子 agent 并行产出片段后由 `build.sh` 装配、`check.sh` 自检。**过程中修复 3 处缺陷**：原型侧栏在模板固定 560/640px + `overflow:hidden` 下被裁掉约 6 项（阻断级）、§7.1 自行多出「资源库」行并与 §5.0 行序矛盾、侧栏 `href` 跨原型不统一。**未裁决** 4 类来源冲突（Team↔Project 基数、记忆分层 L0/L3、ChangeSet 定位、两套风险分级映射），均标 `待确认`。人工浏览器 UAT 待执行。`product-prototype.html` 保留未删 | — |