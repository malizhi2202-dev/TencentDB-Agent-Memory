# ADR-003：工具执行历史存储于 localStorage

- **日期**: 2026-08-25
- **状态**: accepted
- **关联**: codegraph-v2

## Context

CodeAnalysis 页面需要工具执行历史，但无后端存储支持。历史记录需要持久化（页面刷新后保留），支持回填参数。

## Decision

工具执行历史存储于 `localStorage`：
- Key：`tdai-codeanalysis-history`
- 格式：`{ tool, cgId, params, timestamp }[]`
- 上限：50 条，LRU 淘汰
- 回填：点击历史记录 → 回填 tool + params

## Consequences

- **正面**：零后端依赖；实现简单
- **负面**：清除浏览器数据后历史丢失；不同设备不共享；敏感参数（如 token）不脱敏
- **风险**：localStorage 有 5MB 限制，50 条记录不会触及