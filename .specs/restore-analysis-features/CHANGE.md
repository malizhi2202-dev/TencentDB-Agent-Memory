# CHANGE: 恢复 AI 分析 / Process 分析 / 文件展示 / 代码展示

- **Change ID**: restore-analysis-features
- **来源**: codegraph-v2 4-dev 阶段移除了 5 个破碎代理和功能入口，用户要求恢复
- **对标**: GitNexus 原版功能

## 现状

codegraph-v2 在清理死代码时：
1. 移除了 `code-graph-routes.ts` 中 5 个代理（processes / process-flow / search / chat / node-types）
2. 删除了 `CodeReferencesPanel.tsx` 和 `StatusBar.tsx`
3. 侧边栏 7→2 合并了分析入口

这些代理中：
- `/api/file` Engine 404 — Engine 未实现文件读取（需修复）
- `/api/chat` Engine 404 — Engine 未实现 AI 对话（需新增）
- `/api/processes` Engine 500 — 损伤（需修复）
- `/api/process-flow` Engine 400 — 缺参数（可用）
- `/api/search` Engine 500 — 损伤（需修复）
- `/api/node-types` Engine 500 — 损伤（需修复）

## 目标

恢复以下 6 个功能，对标 GitNexus 原版，保持当前 UI 风格（蓝色 #2563eb，Developer Tool 调性）：

### F1. AI 实时分析（Chat）
- 引擎侧：新增 `/api/chat` 端点，接入 LLM 进行代码问答
- 前端侧：CodeGraph 页面右下角 AI 对话浮窗（参考 GitNexus QueryFAB）

### F2. Process 实时分析
- 引擎侧：修复 `/api/processes` 和 `/api/process-flow`
- 前端侧：Process 面板（参考 GitNexus ProcessesPanel + ProcessFlowModal）

### F3. 文件内容展示
- 引擎侧：修复 `/api/file` 端点
- 前端侧：CodeGraph 节点点击后展示文件内容（已有浮动面板，需修复文件读取）

### F4. 代码引用展示
- 前端侧：节点引用面板（参考 GitNexus CodeReferencesPanel）

### F5. 全局搜索
- 引擎侧：修复 `/api/search`
- 前端侧：搜索入口

### F6. 节点类型统计
- 引擎侧：修复 `/api/node-types`
- 前端侧：类型统计展示

## 验收标准

1. AI 对话浮窗可用，能对代码进行问答
2. Process 列表和流程图可用
3. 点击节点可查看文件内容和代码引用
4. 全局搜索可用
5. 节点类型统计正确
6. 所有功能 UI 风格统一（蓝色调，Developer Tool 调性）