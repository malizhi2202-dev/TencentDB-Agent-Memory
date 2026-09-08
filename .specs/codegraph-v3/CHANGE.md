# CHANGE: CodeGraph V3 — UI 重构 + 功能对齐 GitNexus

- **Change ID**: codegraph-v3
- **上一版**: codegraph-v2 (已完成)，restore-analysis-features (已完成)
- **对标**: GitNexus 原版 RightPanel + FileTreePanel + GraphCanvas 三栏布局

## 用户要求

1. 画布边框可拉伸（拖拽调整面板大小）
2. 完整文件树浏览 + 点击文件触发 AI 分析和 Process 分析
3. 代码面板可关闭
4. AI 实时分析 + Process 流程图可视化（对齐 GitNexus RightPanel）
5. 重新设计 UI
6. 画布区域可拉伸

## 目标布局（对标 GitNexus）

```
┌─────────────────────────────────────────────────┐
│ Header (repo selector, search, stats)           │
├──────────┬───────────────────────┬──────────────┤
│ FileTree │    GraphCanvas        │  RightPanel  │
│ (可拉伸) │    (可拉伸)           │  (可拉伸)    │
│          │                       │  ┌─Chat────┐ │
│  files/  │    nodes + edges      │  │ AI分析  │ │
│  dirs/   │    zoom/pan/drag      │  ├─Process─┤ │
│          │                       │  │ 流程图  │ │
│          │                       │  └─────────┘ │
├──────────┴───────────────────────┴──────────────┤
│ StatusBar (stats + shortcuts)                   │
└─────────────────────────────────────────────────┘
```

## 验收标准

1. 三栏可拖拽拉伸（FileTree | GraphCanvas | RightPanel）
2. 文件树点击文件 → 右侧 Chat 自动分析 + 代码面板展示
3. 代码面板可关闭（✕ 按钮生效）
4. RightPanel 双 Tab：Chat（AI 分析）+ Processes（流程列表+流程图）
5. UI 风格统一：蓝色 #2563eb，Developer Tool 调性
6. 所有功能端到端可用