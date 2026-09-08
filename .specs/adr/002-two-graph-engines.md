# ADR-002：两个图谱引擎不合并

- **日期**: 2026-08-25
- **状态**: accepted
- **关联**: codegraph-v2

## Context

项目中有两个图谱渲染引擎：
1. **KnowledgeGraph**（`@react-sigma/core`）— Wiki 图谱 + Code 图谱 tab，轻量预览（~200 节点）
2. **GraphCanvas**（原生 `sigma` + `graphology`）— CodeGraph 页面，重型交互（~5000 节点）

两者使用不同的库和 API，但功能有重叠。

## Decision

保持两个引擎独立，不合并。理由：
1. 使用场景不同：KnowledgeGraph 是 React 声明式、适合快速集成；GraphCanvas 是命令式、适合精细控制
2. 强行统一成本高：需重写一方的渲染逻辑，收益低
3. 两者可独立升级，互不影响

## Consequences

- **正面**：各引擎可按自身场景优化；升级互不影响
- **负面**：sigma.js 升级需同时验证两套代码；团队需理解两套 API
- **风险**：如果未来功能趋同，维护成本会增加