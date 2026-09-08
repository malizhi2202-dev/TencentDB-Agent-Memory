# ADR-001：统一颜色定义源为 constants.ts

- **日期**: 2026-08-25
- **状态**: accepted
- **关联**: codegraph-v2

## Context

项目中 NODE_COLORS 在 3 处重复定义：
1. `codegraph/constants.ts` — CodeGraph 页面使用
2. `code/CodePage/components/code-graph-view.tsx` — Code 页面图谱 tab 使用
3. `code/CodePage/components/code-analysis-view.tsx` — Code 页面分析 tab 使用

Engine `service.ts` 有自己独立的 NODE_COLORS（紫色系）。

全站存在紫色硬编码残留（`#7c3aed`、`#8b5cf6`、`purple-*` 等），品牌色不统一。

## Decision

1. 所有颜色定义统一到 `codegraph/constants.ts`，导出 `NODE_COLORS` 和 `EDGE_COLORS`
2. 组件内通过 import 引用，禁止重复定义
3. Engine `service.ts` 的 NODE_COLORS 同步替换为蓝色系
4. 全站紫色硬编码替换为品牌蓝 `#2563eb`

## Consequences

- **正面**：后续新增颜色只需改 constants.ts 一处；品牌色统一
- **负面**：Engine 需单独修改（独立进程）；跨进程颜色同步需手动维护
- **风险**：如果 constants.ts 的 NODE_COLORS key 与 Engine 返回的 type 不一致，需映射