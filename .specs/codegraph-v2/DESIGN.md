# DESIGN: MemoryPanel 全项目评审修复与增强

- **Change ID**: codegraph-v2
- **关联**: `@.specs/codegraph-v2/REQUIREMENT.md`、`@.specs/codegraph-v2/CHANGE.md`、`@.specs/CONTEXT.md`

---

## 0. 技术栈选定

沿用 CONTEXT.md 已锁定技术栈，无新增依赖：

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React 18 + Vite + Tea Component + Tailwind | 沿用 |
| 图谱 | sigma.js v3.0.3 + graphology + ForceAtlas2 + @sigma/edge-curve | 沿用 |
| 状态 | zustand | 沿用 |
| 后端 | Hono (Panel) + Node 22 | 沿用 |
| Engine | Node 24 + Express (原 GitNexus fork) | 沿用 |
| 图数据库 | LadybugDB | 沿用 |
| 存储 | localStorage (工具历史) | 沿用 |

**新增依赖**：无。所有功能用现有技术栈实现。

---

## 0.5 既有架构对齐

### 0.5.1 触碰模块清单

**会修改**：
- `MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx` — GraphNode/GraphEdge 接口修正，数据映射补全
- `MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx` — 边箭头、社区着色、快捷键、ResizeObserver、Tooltip、紫色替换
- `MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx` — Filters 重构（去掉 tab 切换）、紫色替换、maxHeight 修复
- `MemoryPanel/web/src/pages/codegraph/components/CodeGraphHeader.tsx` — 无（已完成）
- `MemoryPanel/web/src/pages/codegraph/constants.ts` — EDGE_COLORS 紫色替换、NODE_TYPE_COLORS 统一
- `MemoryPanel/web/src/pages/codegraph/codegraph.css` — 无（已完成）
- `MemoryPanel/web/src/routes/index.tsx` — 6 分析路由合并为 1
- `MemoryPanel/web/src/constants/menu.tsx` — 侧边栏 7→2 菜单项
- `MemoryPanel/web/src/pages/codeanalysis/CodeAnalysisPage.tsx` — 内部 tab 切换替代路由切换
- `MemoryPanel/web/src/pages/workbench/WorkbenchPage/components/TaskWorkbench.tsx` — 任务统计面板
- `MemoryPanel/web/src/pages/code/CodePage/components/code-graph-view.tsx` — NODE_TYPE_COLORS 引用 constants.ts
- `MemoryPanel/web/src/pages/code/CodePage/components/code-analysis-view.tsx` — NODE_TYPE_COLORS 引用 constants.ts
- `MemoryPanel/web/src/lib/knowledge-api.ts` — 无（GraphNode 接口已正确定义）
- `MemoryPanel/src/panel/http/routes/knowledge/code-graph-routes.ts` — engineProxy 参数透传
- `MemoryPanel/src/panel/http/routes/task.ts` — 无（已完善）
- `MemoryKnowledge/src/engines/codeanalysis-engine/service.ts` — NODE_COLORS 紫色替换、ENGINE_HOST 默认 127.0.0.1

**会删除**：
- `MemoryPanel/web/src/pages/codegraph/components/CodeReferencesPanel.tsx` — 死代码
- `MemoryPanel/web/src/pages/codegraph/components/StatusBar.tsx` — 死代码

**不应触碰**：
- `MemoryPanel/src/panel/http/routes/chat-memory.ts` — 无关
- `MemoryPanel/src/panel/http/routes/knowledge/wiki-routes.ts` — 无关
- `MemoryKnowledge/src/routes/wiki.ts` — 无关
- `MemoryCore/*` — 无关

### 0.5.2 沿用 vs 引入

| 本次需要 | 既有有没有？ | 决定 |
|---|---|---|
| 图数据格式 | `knowledge-api.ts` GraphNode/GraphEdge 接口 | **沿用**，修正 CodeGraphPage 本地接口对齐 |
| 图谱渲染 | sigma.js + graphology (GraphCanvas) | **沿用**，增加边箭头/社区着色 |
| 节点颜色 | `constants.ts` NODE_COLORS | **沿用**，统一为单一来源 |
| 工具执行 | `knowledgeApi.codeAnalysis.call()` | **沿用** |
| 历史存储 | localStorage | **沿用**，新增工具执行历史 |
| 快捷键 | 无 | **新增**，键盘事件绑定到现有 zoomIn/zoomOut |
| ResizeObserver | 无 | **新增**，sigma 实例 resize |
| 社区着色 | graphology-louvain (KS 侧已计算) | **沿用** KS 返回的 community 字段 |
| 边箭头 | @sigma/edge-curve (已安装) | **沿用**，启用箭头渲染 |
| 路由 | react-router createHashRouter | **沿用**，合并路由条目 |

### 0.5.3 模式决策

- **数据访问**：**沿用** `knowledgeApi.code.graph()` → Panel → KS 路径
- **错误处理**：**沿用** 既有 try/catch + setError 模式
- **组件组织**：**沿用** pages/codegraph/components/ 目录结构
- **CSS 命名**：**沿用** `_cg-*` BEM 风格前缀
- **颜色管理**：**引入新模式** — 统一 constants.ts 为单一颜色定义源，消除 NODE_TYPE_COLORS 三处重复

---

## 1. 技术决策

### D-1：GraphNode 接口修正 — 对齐 KS API 格式

- **决策**：CodeGraphPage 的 `GraphNode` 接口扩展 `linkCount`、`community`、`lineStart`、`lineEnd` 字段，与 KS `exportGraph` 返回格式对齐
- **备选**：保持现有简化接口，另建映射层
- **选择理由**：当前接口丢弃了 KS 返回的 `linkCount` 和 `community`，导致社区着色和 Tooltip 无法工作。直接对齐避免多余映射层
- **取舍代价**：需修改 GraphCanvas 中所有引用 `GraphNode` 的地方（约 10 处）

### D-2：GraphEdge 接口修正 — 对齐 KS API 格式

- **决策**：CodeGraphPage 的 `GraphEdge` 接口保留 `source`、`target`、`type`、`color`，新增 `weight`。type 和 color 从 `node-types` API 获取
- **备选**：完全对齐 KS 格式（仅 source/target/weight）
- **选择理由**：前端需要 type 用于过滤、color 用于渲染。KS 不返回这些字段，需从 `node-types` API 补充
- **取舍代价**：需额外调用 `node-types` API 获取边类型颜色映射

### D-3：边箭头 — 使用 EdgeArrowProgram

- **决策**：在 sigma.js 配置中启用 `EdgeArrowProgram`，在目标端渲染三角形箭头
- **备选**：使用 Canvas 自定义渲染器
- **选择理由**：`@sigma/edge-curve` 已安装，EdgeArrowProgram 是内置方案，无需额外依赖
- **取舍代价**：箭头在有大量边时可能影响性能，需设置 `minEdgeSize` 阈值

### D-4：社区着色 — 使用 KS 返回的 community 字段

- **决策**：节点颜色按 `community` 字段分配，使用 12 色调色板。社区数 ≤ 6 时用离散色，> 6 时用 HSL 色相轮换
- **备选**：前端重新计算 Louvain
- **选择理由**：KS 已在 `exportGraph` 中计算 Louvain 社区，前端直接用 `n.community` 即可。前端重算是重复计算
- **取舍代价**：依赖 KS 返回的 community 数据质量，社区数可能为 0（无社区数据时所有节点同色）

### D-5：快捷键 — 键盘事件绑定

- **决策**：在 GraphCanvas 容器上绑定 `keydown` 事件，`+`/`=` 放大、`-` 缩小、`F` 适应视口、`Escape` 取消选中
- **备选**：使用第三方快捷键库（如 react-hotkeys）
- **选择理由**：只有 4 个快捷键，用原生事件更简单，不引入新依赖
- **取舍代价**：需处理输入框焦点时不拦截（`event.target` 为 INPUT/TEXTAREA 时跳过）

### D-6：ResizeObserver — 图谱容器自适应

- **决策**：在 GraphCanvas 的 `useEffect` 中用 `ResizeObserver` 监听容器尺寸变化，触发 `sigma.refresh()`
- **备选**：使用 window resize 事件
- **选择理由**：ResizeObserver 更精确——只响应容器尺寸变化而非窗口变化，且自动处理侧边栏拖拽场景
- **取舍代价**：需在 cleanup 中 disconnect observer

### D-7：路由合并 — 6 条分析路由 → 1 条

- **决策**：`routes/index.tsx` 中删除 5 条 `/analysis/*` 路由，保留 1 条 `/analysis`。`CodeAnalysisPage` 内部用 `useSearchParams` 读取 `?category=` 参数
- **备选**：保留路由但侧边栏合并
- **选择理由**：6 个路由是伪页面，全部渲染同一组件。URL 参数更 RESTful，且简化路由表
- **取舍代价**：旧书签 URL（如 `/analysis/search`）会 404，需在 ConsoleLayout 的 legacy hash 映射中添加重定向

### D-8：FileTreePanel Filters 重构

- **决策**：去掉 Files/Filters tab 切换，Filters 始终渲染在面板顶部（节点类型/边类型开关 + 深度过滤），文件树在下方。面板宽度 280px
- **备选**：保持 tab 切换，调整默认 tab
- **选择理由**：深度评审发现用户在调节过滤条件时需要频繁切换 tab，始终可见减少操作步数
- **取舍代价**：面板高度有限时文件树可视区域变小，需确保 Filters 区域紧凑（≤ 120px）

### D-9：engineProxy 参数透传

- **决策**：`code-graph-routes.ts` 的 `engineProxy` 函数改用 `c.req.query()` 读取查询参数，拼接到 Engine URL
- **备选**：保持当前 `new URL(c.req.url).searchParams` 方式
- **选择理由**：当前实现已正确拼接 query string（line 239），但 `c.req.query()` 是 Hono 推荐方式，类型安全
- **取舍代价**：无，当前实现已正确

### D-10：Engine 监听地址

- **决策**：Engine `service.ts` 默认 `ENGINE_HOST=127.0.0.1`（已默认），部署环境移除 `ENGINE_HOST=0.0.0.0` 环境变量
- **备选**：加 auth token 保护
- **选择理由**：Engine 已有 CORS 限制（localhost + private LAN），改 127.0.0.1 是最小改动。加 auth token 需改 Panel 代理层传 token
- **取舍代价**：需修改部署脚本/环境变量，确保 Panel 和 KS 通过 localhost 访问 Engine

---

## 2. 数据流 / 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │CodeGraph  │  │CodeAnalys│  │Workbench │  │  Wiki    │            │
│  │  Page     │  │  Page    │  │  Page    │  │  Page    │            │
│  └────┬──────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │             │              │                  │
│  ┌────▼──────────────▼─────────────▼──────────────▼─────┐           │
│  │              knowledge-api.ts (统一客户端)             │           │
│  │  code.graph() │ codeAnalysis.call() │ task.list()    │           │
│  └──────┬──────────────┬───────────────┬────────────────┘           │
└─────────┼──────────────┼───────────────┼────────────────────────────┘
          │              │               │
    POST  │         POST │          POST │
    /api/v1/knowledge    │ /api/v1/task  │
    /code-graph/graph    │               │
          │              │               │
┌─────────▼──────────────▼───────────────▼────────────────────────────┐
│                        MemoryPanel (:8123)                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ code-graph-route │  │  task routes     │  │  wiki routes     │   │
│  │  • graph (C9)    │  │  • list-with-    │  │  • graph         │   │
│  │  • engineProxy   │  │    agents        │  │  • search        │   │
│  │  • search/explore│  │                  │  │                  │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │                     │                     │
     POST   │               POST  │               POST  │
     /v3/code-graph/*       /v3/meta/*         /v3/wiki/*
            │                     │                     │
┌───────────▼─────────────────────▼─────────────────────▼─────────────┐
│                     MemoryKnowledge (:8421)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ code-graph route │  │   tools route    │  │   wiki route     │   │
│  │  • graph → KS    │  │  • /v3/tools/    │  │  • graph         │   │
│  │  • search/explore│  │    call          │  │  • search        │   │
│  │  • callers/      │  │  (analysis_*)    │  │  • page/ls       │   │
│  │    callees/impact│  │                  │  │                  │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                     │              │
│  ┌────────▼─────────────────────▼─────────────────────▼─────────┐   │
│  │                   LadybugDB (图数据库)                        │   │
│  │  • code_graph 表 → nodes/edges/communities                   │   │
│  │  • llm_wiki 表 → 页面/索引/图谱                               │   │
│  │  • meta_asset 表 → 资产注册/权限                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
            │
     HTTP   │  (Engine Proxy)
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                  CodeAnalysis Engine (:8443)                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  /api/graph      │  │  /api/file       │  │  /api/search     │   │
│  │  /api/query      │  │  /api/processes  │  │  /api/chat       │   │
│  │  /api/node-types  │  │  /api/mcp        │  │  /health         │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│  Security: bind 127.0.0.1, CORS = localhost + private LAN           │
└─────────────────────────────────────────────────────────────────────┘
```

**数据流关键变更**：
1. CodeGraphPage 的 GraphNode 接口从"Engine 格式"改为"KS 格式"，补全 linkCount/community
2. 社区着色数据流：KS exportGraph → knowledgeApi.code.graph() → CodeGraphPage → GraphCanvas
3. 工具历史数据流：CodeAnalysisPage → localStorage ← → 页面渲染

---

## 3. ADR

### ADR-001：统一颜色定义源为 constants.ts

- **Context**：NODE_COLORS 在 3 处重复定义（constants.ts、code-graph-view.tsx、code-analysis-view.tsx），EDGE_COLORS 仅定义在 constants.ts。Engine service.ts 有自己独立的 NODE_COLORS。全站存在紫色硬编码残留。
- **Decision**：所有颜色定义统一到 `codegraph/constants.ts`，导出 `NODE_COLORS` 和 `EDGE_COLORS`。Engine service.ts 的 NODE_COLORS 同步替换为蓝色系。全站紫色硬编码替换为品牌蓝 `#2563eb`。
- **Consequences**：code-graph-view.tsx 和 code-analysis-view.tsx 需 import constants.ts。Engine 需单独修改（独立进程）。后续新增颜色只需改 constants.ts 一处。

### ADR-002：两个图谱引擎不合并

- **Context**：Wiki/Code 用 `@react-sigma/core`（KnowledgeGraph），CodeGraph 用原生 `sigma` + `graphology`（GraphCanvas）。两者定位不同。
- **Decision**：保持两个引擎独立。KnowledgeGraph 用于轻量预览（~200 节点），GraphCanvas 用于重型交互（~5000 节点）。
- **Consequences**：sigma.js 升级需同时验证两套代码。团队需理解两套 API。

### ADR-003：工具执行历史存储于 localStorage

- **Context**：CodeAnalysis 需要工具执行历史，但无后端存储支持。
- **Decision**：工具执行历史存储于 `localStorage`，key 为 `tdai-codeanalysis-history`，上限 50 条，LRU 淘汰。格式：`{ tool, cgId, params, timestamp }[]`。
- **Consequences**：清除浏览器数据后历史丢失。不同设备不共享。敏感参数（如 token）不脱敏（v2 改进）。

---

## 4. 风险

### R1 · 实现风险：GraphNode 接口变更影响面大

- **影响**：GraphCanvas 中约 10 处引用 `GraphNode` 的地方需修改
- **缓解**：先改接口，再逐文件修复 TS 编译错误。TypeScript 编译器会标出所有不兼容处

### R2 · 上线风险：路由合并后旧 URL 404

- **影响**：用户书签中的 `/analysis/search` 等 URL 失效
- **缓解**：在 ConsoleLayout 的 `legacyHashToPath()` 中添加旧路由到新路由的映射

### R3 · 上线风险：Engine 监听地址变更影响 KS 连接

- **影响**：Engine 改为 127.0.0.1 后，如果 KS 通过非 localhost 地址访问 Engine 会失败
- **缓解**：KS 通过 `engine-client.ts` 中的 `ENGINE_URL` 环境变量访问 Engine，默认 `127.0.0.1:8443`，无需修改

### R4 · 长期债务：社区着色依赖 KS Louvain 质量

- **影响**：如果 KS 的 Louvain 计算结果不理想（社区数 0 或 1），前端无法改善
- **缓解**：前端在社区数 ≤ 1 时回退到按节点类型着色（现有逻辑）。v2 考虑前端独立计算 Louvain

### R5 · 长期债务：Engine 无认证机制

- **影响**：Engine 改为 127.0.0.1 后仅本机可访问，但同机其他进程仍可无认证调用
- **缓解**：当前 Panel/KS 代理层已有认证（validatePanelMetaHeaders），Engine 仅接受来自 Panel 的请求。v2 考虑加 Engine 认证 token

---

## 5. 不在范围内

- Engine 加认证 token（v2）
- 深色模式（v2）
- Wiki 全文搜索前端（v2）
- CodeGraph 图谱容器拖拽调整大小（v2）
- Skills/ChatMemory 使用统计（v2）
- 前端测试覆盖（v2）
- API 文档补齐（v2）
- 全局无障碍（aria/role）补充（v2）
- CodeGraph 页面对接 KS callers/callees/impact 端点（v2）

---

## 9. 架构沉淀建议

### 9.1 新增可复用抽象

| 抽象 | 文件 | 复用场景 |
|---|---|---|
| 统一颜色常量 | `codegraph/constants.ts` | 所有代码图谱相关组件（code-graph-view、code-analysis-view、GraphCanvas） |
| 工具执行历史 Hook | `useToolHistory.ts`（新建） | 任何需要记录用户操作历史的页面 |

### 9.2 项目级技术决策

- **D-001**：品牌色统一为 `#2563eb`（蓝色），全站禁用紫色硬编码
- **D-002**：所有颜色定义收口到 `constants.ts`，禁止组件内定义 NODE_COLORS
- **D-003**：Engine 仅监听 127.0.0.1，CORS 限制为 localhost + private LAN

### 9.3 跨模块契约

- `GraphNode` 接口：`{ id, label, type, path, linkCount, community, lineStart?, lineEnd? }`（与 KS exportGraph 对齐）
- `GraphEdge` 接口：`{ source, target, type, color, weight }`（type/color 来自 node-types API，weight 来自 KS）

### 9.4 依赖变动

无新增依赖。所有功能用现有技术栈实现。

### 9.5 禁动清单

- 禁止在组件内定义新的 NODE_COLORS / NODE_TYPE_COLORS 常量（统一用 `constants.ts`）
- 禁止在 CSS 中使用 `#7c3aed`、`#8b5cf6`、`#a855f7` 等紫色色值（统一用品牌蓝 `#2563eb`）
- 禁止新增分析子路由（`/analysis/xxx`），统一用 `/analysis?category=xxx`