# CHANGE: MemoryPanel 全项目评审修复与增强

- **Change ID**: codegraph-v2
- **创建日期**: 2026-08-25
- **路径建议**: 完整（REQUIREMENT → DESIGN → UI-DESIGN → TASK → DEV → TEST → REVIEW）
- **状态**: draft

---

## Why（为什么做）

5 轮深度全项目扫描发现：

**安全**：Engine 实际监听 0.0.0.0（`ENGINE_HOST=0.0.0.0`），CORS 已限制但 bind 暴露所有接口
**导航**：侧边栏 7 个代码分析菜单项实际只有 2 个独立页面；Code 页 graph/analyze tab 与独立页面间零链接
**数据丢失**：GraphNode 接口丢弃 KS 返回的 linkCount/community 字段，导致社区着色等功能无法工作
**可视化**：无边箭头、无社区着色、无右键菜单、无快捷键提示栏、无图例
**视觉**：12 处紫色硬编码、20+ 处硬编码色值、字体大小不一致
**依赖**：3 个死依赖（graphology-communities-louvain、graphology-layout-noverlap、sonner）、moment 已废弃
**构建**：主包 2.7MB，mermaid 1.5MB 未懒加载
**测试**：前端 0 测试文件
**文档**：API 文档 `knowledge-panel-api.md` 被代码引用但不存在
**破碎代理**：Panel 7 个 Engine 代理中 2 个后端不存在（node-types、process-flow）、6 个前端未使用、1 个方法不匹配（search GET→POST）
**KS 端点缺口**：KS 14 个端点中 6 个查询端点（callers/callees/impact/node/status/files）Panel 未代理

## What（做什么）

安全加固 + 导航精简 + 数据接口修正 + 可视化增强 + 品牌色统一 + 依赖清理 + 跨页导航 + 各页面信息补全

## 视觉调性

- **选定**：1 Developer Tool（开发者工具）
- **理由**：TencentDB 内部开发者工具，代码图谱/分析/资产管理，高对比度 + 等宽字体 + 功能优先
- **参考产品**：VS Code, Grafana, Linear
- **明确排除**：Cyberpunk、Glassmorphism、Brutalist

## 影响面

- [x] 影响 `REQUIREMENT.md`
- [x] 影响 `DESIGN.md`（Engine 安全 + engineProxy + cancelled + 路由合并 + 数据接口修正）
- [x] 影响 `UI-DESIGN.md`（视觉规范 + 5 产品对标 + 右键菜单 + 快捷键提示栏）
- [x] 影响现有路由表（6 条分析路由合并为 1 条）
- [x] 影响数据模型（GraphNode 接口扩展、cancelled 标记存储）
- [x] 影响 package.json（3 个死依赖清理、@types 移至 devDependencies）

## 范围排除（这次不做）

- 深色模式（需独立 change）
- Wiki 全文搜索（需后端索引支持）
- analyzeProject LLM 摘要生成（依赖 LLM 服务就绪）
- Skills/ChatMemory 使用统计（需埋点基础设施）
- moment → dayjs 迁移（需独立 change，2 处使用）
- mermaid 懒加载（需独立 change，影响 CodeAnalysisView）

## 验收线（粗粒度）

1. 侧边栏代码分析分组从 7 项减为 2 项
2. Engine 服务仅监听 127.0.0.1
3. 全站无紫色硬编码残留
4. CodeGraph 边有箭头、节点有社区着色、文件树有符号数、有右键菜单
5. Workbench 有任务统计面板
6. CodeAnalysis 有工具使用历史
7. Code 页 graph/analyze tab 顶部有跳转链接
8. GraphNode 接口对齐 KS API 格式（含 linkCount/community）
9. 3 个死依赖从 package.json 移除
10. 破碎 Engine 代理清理（移除 node-types、process-flow、search 代理；processes 代理标记为保留）