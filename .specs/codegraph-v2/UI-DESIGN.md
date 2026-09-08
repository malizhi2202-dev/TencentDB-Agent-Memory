# UI-DESIGN: MemoryPanel 全项目评审修复与增强

- **Change ID**: codegraph-v2
- **关联**: `@.specs/codegraph-v2/DESIGN.md`、`@.specs/codegraph-v2/CHANGE.md`

---

## 0. 视觉语汇对齐（Brownfield · 已校准）

### 🔍 观察报告

#### 1. Token 源
- **Tea Component Design Token**：`--tea-color-*` 系列（bg-brand-default / bg-primary-default / text-primary / border-secondary 等）
- **Tailwind 桥接**：`index.css` 中 `:root` 将 Tailwind 语义变量别名到 Tea Token（`--primary: var(--tea-color-bg-brand-default)`）
- **无独立 design token 文件**：所有颜色通过 Tea Token + Tailwind 语义类使用

#### 2. 实际色彩比例
- **主色**：蓝色 `#2563eb`（graph 按钮 active 态、选中节点 badge、focus 按钮）
- **中性**：`#f8f9fa`（图谱背景）、`#fff`（卡片/面板）、`#fafafa`（顶栏）
- **边框**：`#e5e5e5`（`border-gray-200`）、`#d1d5db`（`border-gray-300`）
- **文字**：`#333`（`text-gray-800`）、`#666`（`text-gray-600`）、`#bbb`（placeholder）
- **紫色残留**：`#7c3aed`、`#8b5cf6`、`purple-*`（需替换）

#### 3. 交互反馈语言
- **hover**：`hover:bg-gray-50` / `hover:bg-gray-100`（轻微背景变深），`hover:text-gray-700`（文字变深）
- **active**：`bg-blue-600 text-white`（品牌色反色）
- **transition**：`transition-all`（Tailwind 默认，无自定义缓动）

#### 4. 动效语言
- **缓动**：Tailwind 默认 `cubic-bezier(0.4, 0, 0.2, 1)`（`transition-all`）
- **动画**：`animate-pulse`（布局运行中）、`animate-ping`（布局指示器）、`_cg-slide-up`（浮动面板 0.2s ease-out）
- **sigma 相机**：`animatedZoom({ duration: 200 })`、`animatedReset({ duration: 400/500 })`

#### 5. 结构语言
- **elevation**：仅 2 级（`shadow-sm` / 无 shadow）
- **rounded**：`rounded`（4px）、`rounded-md`（6px）、`rounded-lg`（8px）、`rounded-xl`（12px）、`rounded-full`
- **卡片密度**：稀（padding 12-16px），无渐变
- **布局模式**：Header + 左侧面板 + 中心图谱 三段式

#### 6. 图形与图标
- **图标库**：`lucide-react`（0.469.0）+ `tea-icons-react`（1.0.51）
- **stroke-width**：lucide 默认 2，tea-icons 默认 1.5
- **无插画**，纯功能图标

#### 7. 文案调性
- **工程向**：动词为主（"刷新"、"搜索"、"Focus"）
- **按钮文案**：简短（"Force"、"Tree"、"Circles"、"刷新"）
- **无营销用语**

---

## 1. 美学北极星

### 1.1 四问（来自 CHANGE.md 调性 + 产品分析）

- **目的**：TencentDB 内部开发者工具，代码分析/资产管理/任务看板。核心用户是后端/全栈开发者，核心动作是"查看代码图谱 → 分析依赖 → 管理知识资产"
- **调性**：**1 Developer Tool**（VS Code / Grafana / Linear 风格）—— 功能优先、高对比度、等宽字体、克制配色
- **约束**：Tea Component 主题色不可破坏；Tailwind 语义类沿用；lucide-react + tea-icons-react 图标库
- **差异化**：代码图谱 + 知识管理一体化。三天后用户描述："那个能看代码依赖图的腾讯内部工具"

### 1.2 同类产品对标（5+）

#### 对标维度说明

每产品按 6 维度评分：**图谱可视化 / 代码导航 / 搜索能力 / 分析输出 / 协作集成 / API 开放性**

---

#### 1. GitNexus（原产品 · 本系统 Fork 源）

| 维度 | 评分 | GitNexus 能力 | 本系统当前 |
|---|---|---|---|
| 图谱可视化 | ★★★★☆ | 力导向图 + 节点类型过滤 + 边类型过滤 + 社区检测 + 右键菜单 + 图例面板 + 节点详情侧边栏 + Chat 面板 | 无右键菜单、无图例面板、Chat 已删除、社区着色前端丢失 |
| 代码导航 | ★★★☆☆ | 节点点击→代码面板（行号+语法高亮） | 节点点击→浮动代码面板（无行号） |
| 搜索能力 | ★★★★☆ | FTS + 语义搜索 + Cypher 查询 + Grep 搜索 | 仅 KS search（FTS 转发） |
| 分析输出 | ★★★★☆ | 热点分析 + 架构分析 + 聚类检测 + 流程提取 + 向量嵌入 + SSE 进度 | 热点分析输出存在但展示不完整、聚类/流程/嵌入未暴露 |
| 协作集成 | ★★★☆☆ | MCP 协议 + SSE 实时推送 | MCP 端点存在但未在 Panel 暴露 |
| API 开放性 | ★★★★★ | 20+ REST 端点 + MCP + SSE | Panel 仅代理 7 个 Engine 端点（2 个破碎） |

**GitNexus 有但本系统丢失**：
1. ❌ 节点右键菜单（查看调用者/被调用者/影响分析/复制路径）
2. ❌ 图例面板（始终可见的颜色-类型映射）
3. ❌ Chat 面板（AI 对话，已删除但合理）
4. ❌ Cypher 查询能力（`/api/query` 未代理）
5. ❌ Grep 代码搜索（`/api/grep` 未代理）
6. ❌ 聚类检测可视化（`/api/clusters` 未代理）
7. ❌ 流程提取（`/api/processes` 代理了但前端未使用，`/api/process-flow` 破碎）
8. ❌ 向量嵌入 + 语义搜索（`/api/embed/*` 未代理）
9. ❌ MCP 协议接入（`/api/mcp` 未代理）
10. ❌ 分析任务 SSE 进度推送（`/api/analyze/:jobId/progress` 未代理）

---

#### 2. Sourcegraph

| 维度 | 评分 | Sourcegraph 能力 | 本系统缺失 |
|---|---|---|---|
| 图谱可视化 | ★★★☆☆ | 无图谱，侧边栏文件树+符号面板 | 无符号大纲（点击文件展开内部符号列表） |
| 代码导航 | ★★★★★ | 跳转到定义、查找引用、hover 弹窗、面包屑导航、行号 | 无跳转到定义、无查找引用、无面包屑、无行号 |
| 搜索能力 | ★★★★★ | 正则搜索、符号搜索、跨仓库搜索、搜索结果高亮、搜索历史 | 无正则搜索、无搜索结果高亮、无搜索历史 |
| 分析输出 | ★★★★☆ | Code Insights（趋势仪表盘）、Batch Changes（批量修改） | 无趋势分析、无批量操作 |
| 协作集成 | ★★★★☆ | 浏览器扩展、IDE 插件、GitHub/GitLab 集成 | 无浏览器扩展、无 IDE 插件 |
| API 开放性 | ★★★★☆ | GraphQL API + 批量操作 API | 无 GraphQL、无批量操作 API |

**Sourcegraph 值得借鉴**：
1. 🟡 符号大纲（Sidebar file tree + symbol outline）
2. 🟡 搜索结果高亮
3. 🟡 搜索历史（localStorage）
4. 🟢 面包屑导航（文件路径层级）
5. 🟢 快捷键提示栏（底部状态栏显示所有快捷键）

---

#### 3. Sourcetrail

| 维度 | 评分 | Sourcetrail 能力 | 本系统缺失 |
|---|---|---|---|
| 图谱可视化 | ★★★★★ | 交互式图谱 + 节点折叠/展开 + 调用层级 + 继承图 + 多图对比 + 历史导航（前进/后退） | 无节点折叠/展开、无调用层级、无继承图、无多图对比、无历史导航 |
| 代码导航 | ★★★★☆ | 双向导航（调用者↔被调用者）、图-代码联动 | 无双向导航、无联动高亮 |
| 搜索能力 | ★★★☆☆ | 符号搜索、全文搜索 | 无符号搜索 |
| 分析输出 | ★★★★★ | 依赖分析、调用链分析、影响分析、架构违例检测 | 无调用链分析、无影响分析、无架构违例 |
| 协作集成 | ★★☆☆☆ | 单机工具，无协作 | N/A |
| API 开放性 | ★★☆☆☆ | 无 API | N/A |

**Sourcetrail 值得借鉴**：
1. 🔴 节点右键菜单（查看调用者/被调用者/影响分析）**← 最高优先级**
2. 🔴 图例始终可见（颜色-类型-数量映射）**← 最高优先级**
3. 🟡 历史导航（图谱操作前进/后退）
4. 🟡 子图展开/折叠（双击节点展开邻居）
5. 🟡 多级调用链（callers → callers of callers）
6. 🟢 架构违例检测（分层架构中跨层依赖告警）

---

#### 4. GitHub Code Navigation

| 维度 | 评分 | GitHub 能力 | 本系统缺失 |
|---|---|---|---|
| 图谱可视化 | ★★☆☆☆ | 依赖图（仅仓库级依赖关系） | 无 |
| 代码导航 | ★★★★★ | 跳转到定义、查找引用、符号面板、hover 弹窗（含文档注释）、行号、代码折叠 | 无跳转定义、无 hover 文档、无代码折叠 |
| 搜索能力 | ★★★★☆ | 代码搜索、路径搜索、符号搜索、正则 | 无路径搜索、无正则 |
| 分析输出 | ★★★☆☆ | 依赖图、贡献者图 | 无贡献者分析 |
| 协作集成 | ★★★★★ | PR 代码审查、Code Owners、Branch Protection | 无 CR 集成 |
| API 开放性 | ★★★★☆ | REST + GraphQL API | 无 |

**GitHub 值得借鉴**：
1. 🔴 代码面板行号显示
2. 🟡 hover 弹窗显示符号文档注释
3. 🟡 代码折叠
4. 🟡 路径搜索（搜索文件路径而非文件内容）
5. 🟢 贡献者图（文件/模块的最近修改者）

---

#### 5. CodeSee

| 维度 | 评分 | CodeSee 能力 | 本系统缺失 |
|---|---|---|---|
| 图谱可视化 | ★★★★★ | 代码地图（自动生成服务/模块依赖图）、Review Maps（PR 变更影响图）、Service Maps（微服务拓扑） | 无服务地图、无 Review Maps、无变更影响图 |
| 代码导航 | ★★★★☆ | 地图-代码双向联动、点击节点跳转代码 | 无联动高亮 |
| 搜索能力 | ★★★☆☆ | 节点搜索、路径搜索 | 无路径搜索 |
| 分析输出 | ★★★★☆ | 变更影响分析、循环依赖检测、架构漂移检测 | 无循环依赖检测、无架构漂移检测 |
| 协作集成 | ★★★★★ | PR 集成、Slack 通知、CodeTour 集成 | 无 PR 集成 |
| API 开放性 | ★★★☆☆ | REST API | 无 |

**CodeSee 值得借鉴**：
1. 🟡 服务地图（模块级依赖拓扑，而非文件级）— 对应 Engine 的 `/api/clusters`
2. 🟡 循环依赖检测（用 graphology 在图中检测环）
3. 🟡 架构漂移检测（对比新旧图谱差异）
4. 🟢 PR 变更影响图（diff 两个图谱版本）

---

#### 6. Grafana（仪表盘参考）

| 维度 | 评分 | Grafana 能力 | 本系统缺失 |
|---|---|---|---|
| 图谱可视化 | ★★☆☆☆ | Node Graph 面板（有限节点图） | N/A |
| 仪表盘 | ★★★★★ | 面板拖拽排列、时间范围选择器、变量筛选器、面板全屏、告警规则 | Workbench 无时间范围筛选、无面板拖拽、无全屏 |
| 数据面板 | ★★★★★ | 30+ 数据源、自定义查询、变量模板 | Workbench 无自定义面板 |
| 分析输出 | ★★★★☆ | 趋势图、热力图、统计面板 | Workbench 无统计图表 |
| 协作集成 | ★★★★☆ | 团队共享仪表盘、告警通知 | 无通知 |
| API 开放性 | ★★★★★ | HTTP API + Provisioning | 无 |

**Grafana 值得借鉴**：
1. 🟡 Workbench 顶部统计条（待办/进行中/已完成/阻塞数量）
2. 🟡 Workbench 面板全屏模式
3. 🟢 时间范围筛选器（最近 7 天/30 天/自定义）

---

### 1.3 对标后补全建议（按优先级排序）

| 优先级 | 功能 | 对标来源 | 涉及页面 | 预计工时 |
|---|---|---|---|---|
| 🔴 P0 | 节点右键菜单（查看调用者/被调用者/影响分析） | Sourcetrail / GitNexus | GraphCanvas | 2h |
| 🔴 P0 | 图例始终可见（颜色-类型-数量映射） | Sourcetrail / GitNexus | FileTreePanel | 1h |
| 🔴 P0 | 代码面板行号显示 | GitHub / GitNexus | 浮动代码面板 | 0.5h |
| 🔴 P0 | 破碎 Engine 代理清理 | 内部审计 | code-graph-routes.ts | 0.5h |
| 🟡 P1 | 快捷键提示栏（底部状态栏） | Sourcegraph / Sourcetrail | GraphCanvas | 1h |
| 🟡 P1 | 文件树符号大纲 | Sourcegraph | FileTreePanel | 2h |
| 🟡 P1 | 历史导航（图谱操作前进/后退） | Sourcetrail | GraphCanvas | 2h |
| 🟡 P1 | 子图展开/折叠（双击节点） | Sourcetrail | GraphCanvas | 2h |
| 🟡 P1 | 面包屑导航（文件路径层级） | GitHub / Sourcegraph | 浮动代码面板 | 1h |
| 🟢 P2 | 命令面板（Cmd+K 快速搜索） | Linear / VS Code | CodeGraphPage | 3h |
| 🟢 P2 | 搜索结果高亮 | Sourcegraph | CodeGraphPage | 1h |
| 🟢 P2 | 循环依赖检测 | CodeSee | GraphCanvas | 2h |
| 🟢 P2 | 服务地图（模块级聚类） | CodeSee / Engine clusters | CodeGraphPage | 3h |
| 🟢 P2 | Workbench 统计条 | Grafana / Linear | WorkbenchPage | 1h |

---

### 1.4 专家团讨论结论

**领域专家**：「GitNexus 有 10 项能力在本系统中丢失，其中 Cypher 查询、Grep 搜索、MCP 接入是差异化杀手功能。Sourcegraph 的符号大纲和 Sourcetrail 的右键菜单是最实用的开发者体验提升。」

**架构师**：「破碎代理是技术债务的典型表现。6 个 Engine 代理前端未使用，说明原始架构设计意图与当前实现脱节。建议：保留 `/api/file` 代理（唯一使用）和 `/api/graph` 代理（未来可能使用），删除其余 5 个破碎代理。」

**产品经理**：「从实际需求出发，P0 的 4 项（右键菜单、图例、行号、代理清理）是 v1 必须做的。P1 的 5 项（快捷键提示、符号大纲、历史导航、子图展开、面包屑）是差异化体验。P2 的 6 项放到 v2 或独立 change。」

**研发负责人**：「P0 4 项总工时约 4h，P1 5 项约 8h，P2 6 项约 12h。v1 总共 12h 前端 + 2h 后端。可行。」

---

## 2. 美学维度决策

### 2.1 字体

- **Display/Heading**：`system-ui, -apple-system, sans-serif`（Tailwind 默认，Tea Component 对齐）
- **Body**：`system-ui, -apple-system, sans-serif`
- **Mono**：`'SF Mono', 'Fira Code', Consolas, monospace`（代码面板 + 图谱节点标签）
- **理由**：Tea Component 使用系统字体栈，保持一致性。开发者工具不需要品牌字体。

### 2.2 颜色（OKLCH）

- **主色**：`oklch(0.55 0.22 255)` ≈ `#2563eb`（品牌蓝）
- **主色 hover**：`oklch(0.48 0.22 255)` ≈ `#1d4ed8`
- **主色 light**：`oklch(0.95 0.03 255)` ≈ `#eff6ff`（`bg-blue-50`）
- **中性背景**：`oklch(0.98 0.01 260)` ≈ `#f8f9fa`（页面）/ `oklch(1 0 0)` ≈ `#fff`（卡片）
- **中性文字**：`oklch(0.25 0.01 260)` ≈ `#333`（primary）/ `oklch(0.45 0.01 260)` ≈ `#666`（secondary）
- **边框**：`oklch(0.88 0.01 260)` ≈ `#e5e5e5`
- **社区着色**（12 色）：HSL 色相均匀分布（0°, 30°, 60°, ..., 330°），饱和度 60%，亮度 55%

### 2.3 动效

- **缓动**：`cubic-bezier(0.16, 1, 0.3, 1)`（spring-like，比默认 ease-out 更有弹性）
- **时长档位**：`150ms`（微交互 hover/click）、`200ms`（小面板进出）、`400ms`（相机动画）、`500ms`（页面切换）
- **图谱**：sigma 相机动画保持 `200ms`（zoom）/ `400ms`（reset）

### 2.4 空间

- **间距 scale**：`4, 8, 12, 16, 20, 24, 32, 48`（px）
- **圆角**：`4px`（按钮/输入框）、`8px`（卡片/面板）、`12px`（浮动面板）、`full`（badge/tag）
- **面板宽度**：FileTreePanel `280px`（从 240px 扩展）

### 2.5 质感

- **背景**：纯色（`#f8f9fa` 页面 / `#fff` 卡片），无渐变/噪点
- **阴影**：仅 `shadow-sm`（浮动面板/下拉菜单），无多层阴影
- **边框**：`1px solid #e5e5e5`（面板/卡片分隔），`0px`（无边框时用背景色差区分）

---

## 3. v0 草稿确认

### 📌 关键页面布局

#### CodeGraph 页面（三段式 + 右键菜单）

```
┌──────────────────────────────────────────────────────────────────┐
│ [Repo ▼]  1,234 nodes · 5,678 edges | TS 45% | auth.service.ts │ [Help] [刷新] │
├──────────┬───────────────────────────────────────┬───────────────┤
│          │                                       │               │
│ Filters  │                                       │               │
│ ──────── │                                       │               │
│ [✓]File  │                                       │               │
│ [✓]Class │                                       │               │
│ [✓]Func  │         Sigma Graph Canvas            │               │
│ [ ]Var   │                                       │               │
│ ──────── │                                       │  ┌─────────┐  │
│ Edges:   │                                       │  │ Floating │  │
│ [✓]CALLS │                                       │  │  Code    │  │
│ [✓]IMPORT│                                       │  │  Panel   │  │
│ ──────── │                                       │  │  (行号)  │  │
│ Depth:   │                                       │  └─────────┘  │
│ [1][2][3]│                                       │               │
│ ──────── │                                       │  [+][-][⊡]   │
│ 🔍______ │                                       │  [⊙][▶]      │
│          │                                       │               │
│ src/     │                                       │               │
│  auth/   │                                       │               │
│   svc.ts │ 右键菜单:                             │               │
│   (12)   │  → 查看调用者                          │  Layout: ●   │
│  api/    │  → 查看被调用者                        │               │
│   rts.ts │  → 影响分析                            │               │
│   (8)    │  → 复制路径                            │               │
│          │  → 聚焦节点                            │               │
├──────────┴───────────────────────────────────────┴───────────────┤
│  [+/- Zoom] [F Fit] [Esc Deselect] [R Click→Context Menu]        │
└──────────────────────────────────────────────────────────────────┘
```

#### 侧边栏（合并后）

```
┌─ 侧边栏 ─────────────┐
│ 📊 工作台             │
│ ───────────────────  │
│ 👥 组织与权限         │
│   成员               │
│   Agent              │
│ ───────────────────  │
│ 📦 资产管理           │
│   Wiki               │
│   Code               │
│   Skills             │
│   对话记忆            │
│ ───────────────────  │
│ 🔬 代码分析           │
│   代码分析工具  ← 合并 │
│   代码图谱            │
└──────────────────────┘
```

#### Workbench 页面（加统计）

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 待办 3 · 🔄 进行中 2 · ✅ 已完成 5 · ⚠️ 阻塞 1              │
├──────────────────────────────────────────────────────────────────┤
│  Todo          │  In Progress    │  Done           │  Blocked    │
│  ┌──────────┐  │  ┌──────────┐   │  ┌──────────┐   │  ┌──────┐  │
│  │ Task 1   │  │  │ Task 4   │   │  │ Task 7   │   │  │Tsk 10│  │
│  │ 🔴 high  │  │  │ 🟡 med   │   │  │ 🟢 low   │   │  │⚠️    │  │
│  └──────────┘  │  └──────────┘   │  └──────────┘   │  └──────┘  │
│  ┌──────────┐  │  ┌──────────┐   │  ┌──────────┐   │            │
│  │ Task 2   │  │  │ Task 5   │   │  │ Task 8   │   │            │
│  └──────────┘  │  └──────────┘   │  └──────────┘   │            │
│  ┌──────────┐  │                 │  ┌──────────┐   │            │
│  │ Task 3   │  │                 │  │ Task 9   │   │            │
│  └──────────┘  │                 │  └──────────┘   │            │
└──────────────────────────────────────────────────────────────────┘
```

### 正在假设的东西

- 假设 Filters 始终可见在顶部，FileTreePanel 宽度 280px 足够
- 假设右键菜单用浏览器原生 contextmenu 事件 + 绝对定位 div 实现
- 假设快捷键提示栏用底部固定状态栏（高 24px，半透明）
- 假设文件树符号大纲用展开/折叠箭头（`▸`/`▾`），点击文件展开内部符号列表
- 假设社区着色用 12 色调色板，HSL 色相均匀分布

---

## 4. Design Tokens

```css
:root {
  /* 品牌色（覆盖 Tea Token 的语义别名） */
  --brand: oklch(0.55 0.22 255);        /* #2563eb */
  --brand-hover: oklch(0.48 0.22 255);  /* #1d4ed8 */
  --brand-light: oklch(0.95 0.03 255);  /* #eff6ff */

  /* 图谱节点色（按类型） */
  --cg-node-class: oklch(0.55 0.22 255);      /* 蓝 */
  --cg-node-interface: oklch(0.55 0.15 170);  /* 青 */
  --cg-node-function: oklch(0.55 0.18 70);    /* 橙 */
  --cg-node-method: oklch(0.50 0.18 70);      /* 深橙 */
  --cg-node-file: oklch(0.45 0.08 160);       /* 灰绿 */
  --cg-node-variable: oklch(0.55 0.15 90);    /* 黄 */
  --cg-node-constant: oklch(0.50 0.15 25);    /* 红 */
  --cg-node-property: oklch(0.50 0.15 230);   /* 靛蓝 */
  --cg-node-import: oklch(0.50 0.12 200);     /* 天蓝 */
  --cg-node-typealias: oklch(0.50 0.15 280);  /* 紫（已替换为靛蓝） */

  /* 图谱边色（按类型） */
  --cg-edge-contains: oklch(0.45 0.03 260);   /* 灰 */
  --cg-edge-defines: oklch(0.45 0.12 190);    /* 青 */
  --cg-edge-calls: oklch(0.50 0.18 255);      /* 蓝（替换紫色） */
  --cg-edge-imports: oklch(0.50 0.15 90);     /* 黄 */
  --cg-edge-accesses: oklch(0.40 0.03 260);   /* 深灰 */
  --cg-edge-memberof: oklch(0.45 0.15 270);   /* 靛蓝 */
  --cg-edge-hasproperty: oklch(0.40 0.05 260);/* 灰 */
  --cg-edge-hasmethod: oklch(0.45 0.15 255);  /* 蓝（替换紫色） */
  --cg-edge-uses: oklch(0.50 0.18 70);        /* 橙 */
  --cg-edge-stepinprocess: oklch(0.48 0.15 160);/* 绿 */

  /* 社区着色（12 色 HSL 色相轮换） */
  --cg-community-0: hsl(0, 60%, 55%);
  --cg-community-1: hsl(30, 60%, 55%);
  --cg-community-2: hsl(60, 60%, 55%);
  --cg-community-3: hsl(120, 60%, 55%);
  --cg-community-4: hsl(180, 60%, 55%);
  --cg-community-5: hsl(210, 60%, 55%);
  --cg-community-6: hsl(240, 60%, 55%);
  --cg-community-7: hsl(270, 60%, 55%);
  --cg-community-8: hsl(300, 60%, 55%);
  --cg-community-9: hsl(330, 60%, 55%);
  --cg-community-10: hsl(15, 60%, 55%);
  --cg-community-11: hsl(75, 60%, 55%);

  /* 间距 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;
  --space-4xl: 48px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* 动效 */
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 400ms;
  --duration-page: 500ms;
}
```

---

## 5. 关键组件规约

### Button
- **Primary**：`bg-blue-600 text-white rounded-md px-3 py-1.5 text-sm hover:bg-blue-700 transition-all duration-fast`
- **Secondary**：`border border-gray-200 bg-white text-gray-500 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50`
- **Icon-only**：`h-8 w-8 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50`

### Input
- **Search**：`rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 w-full`

### Card / Panel
- **面板**：`bg-white border border-gray-200 rounded-lg`（无 hover 变化）
- **浮动面板**：`bg-white border border-gray-200 rounded-xl shadow-sm`（有阴影）

### Navigation
- **侧边栏**：Tea Component `Menu` 组件，由 `ConsoleLayout` 渲染
- **顶栏**：`bg-fafafa border-b border-gray-200`，高度 48px

### Typography
- **Display**：N/A（开发者工具无大标题）
- **Heading**：`text-sm font-semibold text-gray-800`
- **Body**：`text-sm text-gray-600`
- **Code**：`font-mono text-xs text-gray-700`
- **Label**：`text-xs text-gray-500`
- **Micro**：`text-[11px] text-gray-400`

### 右键菜单
- **容器**：`absolute z-50 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[160px]`
- **菜单项**：`px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer`
- **分隔线**：`h-px bg-gray-100 my-1`
- **快捷键提示**：`text-gray-400 ml-auto`

### 快捷键提示栏
- **容器**：`absolute bottom-0 left-0 right-0 h-6 bg-white/80 border-t border-gray-200 flex items-center px-2 gap-3 text-[11px] text-gray-400`
- **快捷键标签**：`font-mono bg-gray-100 rounded px-1`

---

## 6. Do's and Don'ts

### 本项目调性：Developer Tool

| ✅ Do | ❌ Don't |
|---|---|
| 用等宽字体展示代码/路径 | 用 emoji 装饰功能按钮 |
| 用高对比度文字（`#333` on `#fff`） | 用低对比度灰色文字（`#ccc`） |
| 用品牌蓝 `#2563eb` 作强调色 | 用紫色/渐变/霓虹色 |
| 用 `shadow-sm` 做浮动面板 | 用 `shadow-xl` / 多层阴影 |
| 快捷键提示始终可见 | 隐藏快捷键依赖用户记忆 |
| 图例始终可见 | 图例藏在 tab 切换后 |
| 右键菜单提供上下文操作 | 右键无反应或仅浏览器默认菜单 |
| 文件树显示符号数 | 文件树仅显示文件名 |
| 代码面板显示行号 | 代码面板无行号 |

### 明确禁止（来自 ui-anti-patterns.md + 本项目）

1. **禁止紫色**：`#7c3aed`、`#8b5cf6`、`#a855f7`、`purple-*` 等一律替换为蓝色系
2. **禁止 emoji 图标**：功能按钮用 lucide-react 图标，不用 emoji 凑
3. **禁止渐变背景**：保持纯色背景，开发者工具不需要装饰性渐变
4. **禁止玻璃态**：`backdrop-blur`、半透明面板不符合 Developer Tool 调性
5. **禁止过度圆角**：卡片/面板 `rounded-lg`（8px）上限，不用 `rounded-2xl`（16px）

---

## 7. 占位符策略

| 缺的东西 | 正确做法 | 禁止做法 |
|---|---|---|
| 图标 | lucide-react 图标（已有） | emoji 凑 |
| 社区颜色 | HSL 色相轮换 12 色 | 随机颜色 |
| 空状态 | `StatusTip status="empty"` + 文案 | 空白页面 |
| 加载态 | `StatusTip status="loading"` | 空白闪烁 |
| 错误态 | `setError(err.message)` 红色文字 | 静默失败 |

---

## 8. 界面重设计建议（融合/删除/新增）

### 融合

| 融合项 | 当前 | 建议 |
|---|---|---|
| Code 页 graph tab + CodeGraph 页 | 两个独立入口，功能重叠 | **保留双入口**，但 Code 页 graph tab 顶部加"打开完整图谱 →"链接跳转到 CodeGraph 页 |
| Code 页 analyze tab + CodeAnalysis 页 | 两个独立入口，功能重叠 | **保留双入口**，同理加"打开完整分析 →"链接 |
| FileTreePanel Filters + 图例 | Filters 藏在 tab 后 | **融合**：Filters 始终可见，同时作为图例（颜色点 + 类型名） |

### 删除

| 删除项 | 理由 |
|---|---|
| CodeReferencesPanel.tsx | 已替换为浮动代码面板 |
| StatusBar.tsx | 信息已合并到 CodeGraphHeader |
| 6 个分析子路由 | 合并为 1 个 `/analysis` 路由 |

### 新增

| 新增项 | 对标产品 | 优先级 |
|---|---|---|
| 节点右键菜单 | Sourcetrail / GitNexus | 🔴 v1 |
| 快捷键提示栏 | Sourcegraph / Linear | 🟡 v1 |
| 代码面板行号 | GitHub Code Nav | 🔴 v1 |
| 文件树符号大纲 | Sourcegraph | 🟡 v1 |
| 图例始终可见 | Sourcetrail | 🔴 v1（融合到 Filters） |
| 面包屑导航 | GitHub Code Nav | 🟡 v2 |
| 历史导航（前进/后退） | Sourcetrail | 🟡 v2 |
| 命令面板（Cmd+K） | Linear | 🟢 v2 |

### 列架子功能（有入口但无实际数据或体验差）

| 功能 | 当前状态 | 建议 |
|---|---|---|
| Wiki KnowledgeGraph 节点点击 | 有图，但点击节点无内容预览 | 补全节点点击→侧边栏显示 page 摘要 |
| CodeAnalysis 6 个分类 | 有 6 个 tab 但切换时无差异化引导 | 补全工具使用说明 + 示例查询 |
| 图谱快捷键 | Help Modal 声称有但未实现 | 实现快捷键 + 快捷键提示栏 |
| 社区着色 | KS 已计算 community 但前端丢弃 | 补全 GraphNode 接口 + 渲染 |
| 文件树符号数 | 数据存在但前端未展示 | 补全 FileTreePanel 渲染 |
| **Code 页 graph tab → CodeGraph 页** | **无任何链接，用户可能永远发现不了独立图谱页** | **加"打开完整图谱 →"链接** |
| **Code 页 analyze tab → CodeAnalysis 页** | **同上，无链接** | **加"打开完整分析 →"链接** |

### 深度审计新增发现（2026-08-25 第 5 轮）

| 类别 | 问题 | 位置 | 影响 |
|---|---|---|---|
| **跨页导航** | Code 页 graph tab 和 CodeGraph 页面之间无任何链接 | `code-detail-view.tsx` | 用户可能永远不知道有独立图谱页 |
| **跨页导航** | Code 页 analyze tab 和 CodeAnalysis 页面之间无链接 | `code-detail-view.tsx` | 同上 |
| **硬编码色值** | 12 处 `#9096a3`、8 处 `#64748b`、`#475569`、`#d54941`、`#e37318` 散布在 TSX 中 | 多个组件 | 无法统一主题切换 |
| **字体大小不一致** | `fontSize: 11`、`12`、`13` 用 inline style 而非 Tailwind `text-xs`/`text-sm` | 多个组件 | 维护困难，无法全局调整 |
| **CSS 命名不一致** | Team 页面 CSS 用 `_memory-*` 前缀而非 `_team-*` | `team-management-panel.css` | 命名混淆 |
| **CSS 无紫色** | 所有 CSS 文件已清理，紫色仅在 TSX 内联 Tailwind 类中 | 12 处 TSX | 已在 AC-5 覆盖 |
| **无响应式** | 除 `codegraph.css` 外无任何页面有 `@media` 查询 | 全站 CSS | 不支持小屏/平板 |
| **Chat Memory 最完善** | 130+ CSS 类含骨架屏/聊天气泡/分层详情/时间筛选 | `chat-memory-panel.css` | 其他页面可参考此质量标准 |