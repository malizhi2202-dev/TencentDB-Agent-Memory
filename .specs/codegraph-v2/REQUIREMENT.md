# REQUIREMENT: MemoryPanel 全项目评审修复与增强

- **Change ID**: codegraph-v2
- **关联**: `@.specs/codegraph-v2/CHANGE.md`、`@.specs/CONTEXT.md`

---

## 用户故事

- **US-1**：作为开发者，我打开侧边栏时不应看到 7 个代码分析菜单项，而应只有 2 个清晰入口，以便快速定位功能。
- **US-2**：作为安全工程师，我希望 Engine 服务只监听本机回环地址且 CORS 不设为通配符，以便防止未授权远程访问。
- **US-3**：作为开发者，我看到的全站 UI 应使用统一的品牌色（蓝色），而非紫色残留，以便视觉一致。
- **US-4**：作为代码分析者，我查看图谱时应能看到边的方向箭头和节点社区着色，以便理解代码关系和模块边界。
- **US-5**：作为代码分析者，我应能在文件树中看到每个文件的符号数量，以便快速评估文件复杂度。
- **US-6**：作为代码分析者，我的鼠标悬停节点时应看到完整 filePath、行号和连接数，而非仅节点名。
- **US-7**：作为代码分析者，我应能用键盘快捷键（+/-/F/Esc）操作图谱，以便高效导航。
- **US-8**：作为代码分析者，我应能查看工具执行历史，以便复用之前的查询。
- **US-9**：作为任务管理者，我应在工作台看到任务统计（各状态数量），以便了解团队进度。
- **US-10**：作为开发者，图谱容器应随窗口大小自适应，以便在不同屏幕尺寸下正常使用。
- **US-11**：作为开发者，Panel 代理 Engine 请求时应正确透传 URL 查询参数，以便不丢失搜索条件。
- **US-12**：作为管理员，分析任务的 cancelled 标记应在 Panel 重启后保持，以便不丢失取消状态。
- **US-13**：作为开发者，6 个分析子路由（`/analysis/search` 等）应合并为 1 个 `/analysis` 路由，内部用 tab 切换，以便 URL 简洁且不产生伪页面。
- **US-14**：作为开发者，FileTreePanel 的 Filters 应始终可见在顶部，无需切换 tab，以便快速调整过滤条件。
- **US-15**：作为开发者，项目中的 NODE_TYPE_COLORS 不应在三处重复定义，以便保持一致性和可维护性。
- **US-16**：作为安全工程师，Engine 服务不应监听 0.0.0.0（当前 ENGINE_HOST=0.0.0.0），以便仅本机访问。
- **US-17**：作为代码分析者，CodeGraph 页面应能通过 KS 查询调用者/被调用者/影响分析，以便在图中直接分析符号关系。
- **US-18**：作为开发者，CodeGraphPage 的 GraphNode 接口应与 KS API 返回格式一致，以便不丢失 linkCount 和 community 字段。
- **US-19**：作为开发者，从 Code 页的 graph/analyze tab 应能一键跳转到独立的 CodeGraph/CodeAnalysis 页面，以便发现更强大的分析功能。
- **US-20**：作为开发者，项目不应包含零引用的死依赖，以便减小构建产物和安装时间。
- **US-21**：作为开发者，Panel 的 Engine 代理不应包含后端不存在或前端未使用的破碎端点，以便减少维护负担和误导性 API。

## 验收准则（AC）

### AC-1 · 侧边栏代码分析分组精简

- **Given** 用户已登录且侧边栏可见
- **When** 用户查看侧边栏「代码分析」分组
- **Then** 分组内仅显示 2 个菜单项：「代码分析工具」和「代码图谱」
- **验证方式**: 打开页面，目视侧边栏代码分析分组项数 ≤ 2

### AC-2 · 代码分析工具页内分类切换

- **Given** 用户点击「代码分析工具」菜单项
- **When** 页面加载后，用户切换分类 tab（搜索/符号/变更/发现/类型/跨仓库）
- **Then** 对应分类的工具列表正确显示，切换时不清空仓库选择
- **验证方式**: 点击各分类 tab，确认工具列表随分类切换

### AC-3 · Engine 仅监听 127.0.0.1

- **Given** Engine 服务已启动
- **When** 执行 `ss -tlnp | grep 8443`
- **Then** 输出显示监听地址为 `127.0.0.1:8443`，非 `0.0.0.0:8443` 或 `*:8443`
- **验证方式**: `ss -tlnp | grep 8443` 输出含 `127.0.0.1`

### AC-4 · Engine CORS 限制

- **Given** Engine 服务已启动
- **When** 从非 Panel 域名（如 `http://evil.com`）发起跨域请求到 Engine
- **Then** 响应不含 `Access-Control-Allow-Origin: *`，浏览器拒绝跨域
- **验证方式**: `curl -H "Origin: http://evil.com" http://127.0.0.1:8443/api/health -v 2>&1 | grep -i "access-control"` 无 `*`

### AC-5 · 全站品牌色统一（蓝色）

- **Given** 用户打开任意页面（Workbench/Wiki/Code/CodeAnalysis/CodeGraph/Skills/Memory/Team）
- **When** 检查所有 CSS 中 `#7c3aed`、`purple`、`#a855f7` 等紫色色值
- **Then** 全站 CSS 和 JS 中无紫色硬编码色值（除 tea-component 默认主题外）
- **验证方式**: `grep -rn '#7c3aed\|#a855f7\|purple' MemoryPanel/web/src/` 输出为空

### AC-6 · CodeGraph 边箭头

- **Given** 用户打开 CodeGraph 页面，选择了一个仓库
- **When** 图谱渲染完成后，用户观察任意一条边
- **Then** 边的目标端显示三角形箭头，方向从 source 指向 target
- **验证方式**: 目视图谱中边有箭头指示

### AC-7 · CodeGraph 社区着色

- **Given** 用户打开 CodeGraph 页面，选择了一个仓库
- **When** 图谱渲染完成后，节点超过 50 个且包含社区数据
- **Then** 同一社区的节点颜色一致，不同社区颜色不同，社区颜色跨度 ≥ 6 种
- **验证方式**: 目视图谱中节点按社区分组着色

### AC-8 · 文件树显示符号数

- **Given** 用户打开 CodeGraph 页面，左侧文件树面板可见
- **When** 用户查看文件树中的任意文件节点
- **Then** 每个文件节点右侧显示该文件包含的符号数量（如 `auth.ts (12)`）
- **验证方式**: 目视文件树节点含括号数字

### AC-9 · 节点 Tooltip 增强

- **Given** 用户打开 CodeGraph 页面，图谱已渲染
- **When** 用户鼠标悬停任意节点
- **Then** Tooltip 显示：节点类型、filePath（完整路径）、行号范围、连接数
- **验证方式**: 悬停节点，目视 Tooltip 含以上信息

### AC-10 · 图谱快捷键

- **Given** 用户打开 CodeGraph 页面，图谱已渲染
- **When** 用户按下 `+` 键
- **Then** 图谱放大一级
- **When** 用户按下 `-` 键
- **Then** 图谱缩小一级
- **When** 用户按下 `F` 键
- **Then** 图谱适应视口
- **When** 用户按下 `Esc` 键
- **Then** 取消当前选中节点
- **验证方式**: 依次按下各键，观察对应效果

### AC-11 · 图谱容器 ResizeObserver 自适应

- **Given** 用户打开 CodeGraph 页面，图谱已渲染
- **When** 用户调整浏览器窗口大小（或拖拽侧边栏改变容器宽度）
- **Then** 图谱自动重绘以适应新容器尺寸，不出现空白或溢出
- **验证方式**: 拖拽浏览器窗口边缘，观察图谱自适应

### AC-12 · 工具执行历史

- **Given** 用户打开 CodeAnalysis 页面，已执行过至少 1 个工具
- **When** 用户查看页面底部或侧边栏
- **Then** 显示最近执行记录列表（工具名 + 参数 + 时间），点击可回填参数
- **验证方式**: 执行工具后刷新页面，历史记录仍存在

### AC-13 · Workbench 任务统计

- **Given** 用户打开 Workbench 页面，有至少 1 个任务
- **When** 页面加载完成
- **Then** 顶部显示各状态任务计数（如「待办 3 · 进行中 2 · 已完成 5」）
- **验证方式**: 目视顶部统计数字与看板列中任务数一致

### AC-14 · FileTreePanel maxHeight 修复

- **Given** 用户打开 CodeGraph 页面，文件树有很多文件
- **When** 文件数量超过一屏
- **Then** 文件树区域可滚动，不出现内容被截断或溢出
- **验证方式**: 导入超过 50 个文件的仓库，验证文件树可滚动到底部

### AC-15 · engineProxy URL 查询参数透传

- **Given** 前端调用 `knowledgeApi.code.graph(cgId)` 等带查询参数的接口
- **When** 请求到达 Panel 的 engineProxy 路由
- **Then** URL 查询参数（如 `?cg_id=xxx`）被正确读取并拼接到 Engine 请求 URL 中，Engine 返回的结果与直连一致
- **验证方式**: `curl -s "http://127.0.0.1:8123/api/knowledge/code-graph/engine/graph?cg_id=test" | head -c 100` 返回有效 JSON

### AC-16 · cancelled 标记持久化

- **Given** 管理员在 Panel 中取消了一个分析任务（设置 cancelled=true）
- **When** Panel 服务重启后，再次查询该任务
- **Then** cancelled 标记仍为 true，任务不会恢复执行
- **验证方式**: 取消任务 → 重启 Panel → 查询任务状态为 cancelled

### AC-17 · 分析子路由合并为 1 个

- **Given** 路由表定义了 6 个分析子路由（`/analysis/search`、`/analysis/symbol` 等）
- **When** 重构完成后
- **Then** 路由表中仅保留 1 个 `/analysis` 路由，`CodeAnalysisPage` 内部通过 URL search param（`?category=search`）或内部 state 切换分类；旧 6 个路由全部移除；侧边栏 PATH_TO_PAGE 映射同步更新
- **验证方式**: 检查 `routes/index.tsx` 中 `/analysis` 相关路由仅 1 条；访问 `/analysis` 正常显示

### AC-18 · 删除死代码文件（CodeReferencesPanel / StatusBar）

- **Given** CodeReferencesPanel.tsx 和 StatusBar.tsx 仍存在于文件系统中
- **When** 重构完成后
- **Then** 两个文件被删除，且无任何 import 引用它们
- **验证方式**: `find MemoryPanel/web/src -name "CodeReferencesPanel.tsx" -o -name "StatusBar.tsx"` 输出为空；`grep -rn "CodeReferencesPanel\|StatusBar" MemoryPanel/web/src/` 无结果

### AC-19 · FileTreePanel Filters 始终可见

- **Given** 用户打开 CodeGraph 页面，左侧文件树面板可见
- **When** 用户查看面板
- **Then** 顶部始终显示 Filters（节点类型/边类型开关 + 深度过滤），下方为文件树；无需点击 tab 切换
- **验证方式**: 目视面板无 Files/Filters tab 切换，过滤条件始终可见

### AC-20 · NODE_TYPE_COLORS 统一为 constants.ts

- **Given** 项目中 code-graph-view.tsx、code-analysis-view.tsx 各自定义了 NODE_TYPE_COLORS
- **When** 重构完成后
- **Then** 所有 NODE_TYPE_COLORS 统一从 `codegraph/constants.ts` 导出；code-graph-view.tsx 和 code-analysis-view.tsx 中使用 import 引用
- **验证方式**: `grep -rn "const NODE_TYPE_COLORS" MemoryPanel/web/src/` 仅在 constants.ts 中有一处定义

### AC-21 · EDGE_COLORS 紫色值替换为蓝色

- **Given** constants.ts 中 EDGE_COLORS.CALLS 为 `#7c3aed`，HAS_METHOD 为 `#8b5cf6`
- **When** 重构完成后
- **Then** 所有 EDGE_COLORS 值均为非紫色系（蓝色/青色/灰色系）
- **验证方式**: `grep '#7c3aed\|#8b5cf6\|#a855f7\|#9333ea' MemoryPanel/web/src/pages/codegraph/constants.ts` 输出为空

### AC-22 · Engine 实际监听 127.0.0.1（非 0.0.0.0）

- **Given** Engine 进程已启动（当前 `ENGINE_HOST=0.0.0.0`）
- **When** 检查进程监听地址
- **Then** `ss -tlnp | grep 8443` 显示 `127.0.0.1:8443`，非 `0.0.0.0:8443`
- **验证方式**: `ss -tlnp | grep 8443` 输出含 `127.0.0.1`；`cat /proc/$(pgrep -f service.ts)/environ | tr '\0' '\n' | grep ENGINE_HOST` 输出 `ENGINE_HOST=127.0.0.1` 或无此变量

### AC-23 · Engine NODE_COLORS 紫色值替换

- **Given** Engine `service.ts` 中 NODE_COLORS.Function 为 `#7c3aed`，Method 为 `#8b5cf6`
- **When** 重构完成后
- **Then** 所有 NODE_COLORS 值均为非紫色系
- **验证方式**: `grep '#7c3aed\|#8b5cf6' MemoryKnowledge/src/engines/codeanalysis-engine/service.ts` 输出为空

### AC-24 · Code 页 graph/analyze tab 一键跳转

- **Given** 用户在 Code 页详情中切换到 graph 或 analyze tab
- **When** 用户查看 tab 内容顶部
- **Then** 显示「打开完整图谱 →」或「打开完整分析 →」链接，点击后跳转到 `/graph` 或 `/analysis` 页面，并自动选中当前仓库
- **验证方式**: Code 页 graph tab 顶部有链接，点击后跳转到 CodeGraph 页面且仓库已选中

### AC-25 · 死依赖清理

- **Given** package.json 中 dependencies 包含 `graphology-communities-louvain`、`graphology-layout-noverlap`、`sonner`
- **When** 重构完成后
- **Then** 三个包从 dependencies 中移除；`@types/react-syntax-highlighter` 移至 devDependencies；`npm ls` 无警告
- **验证方式**: `grep -c 'graphology-communities-louvain\|graphology-layout-noverlap\|sonner' package.json` 输出 0

### AC-26 · 破碎 Engine 代理清理

- **Given** Panel `code-graph-routes.ts` 中 7 个 Engine 代理端点
- **When** 清理完成后
- **Then** 仅保留 `/api/file` 和 `/api/graph` 代理（前端使用+未来预留）；移除 `/api/node-types`（Engine 不存在）、`/api/process-flow`（Engine 不存在）、`/api/search`（方法不匹配且前端未使用）、`/api/processes`（前端未使用）、`/api/chat`（前端未使用）
- **验证方式**: `grep "engineProxy\|engine/" code-graph-routes.ts` 仅返回 file 和 graph 代理

---

## 范围切分

### v1（本次必做）

- 侧边栏代码分析分组从 7 项合并为 2 项
- Engine 改监听 127.0.0.1 + CORS 限制
- 全站紫色硬编码色值替换为蓝色
- CodeGraph 边加箭头
- CodeGraph 社区着色
- 文件树显示符号数
- 节点 Tooltip 增强（filePath/行号/连接数）
- 图谱快捷键（+/-/F/Esc）
- 图谱容器 ResizeObserver 自适应
- FileTreePanel maxHeight 修复
- Workbench 任务统计面板
- CodeAnalysis 工具执行历史
- engineProxy URL 查询参数透传（`c.req.query()` 替代硬编码）
- cancelled 标记持久化（先删行再置标记）
- 6 个分析子路由合并为 1 个 `/analysis` 路由
- 删除死代码文件：CodeReferencesPanel.tsx、StatusBar.tsx
- FileTreePanel Filters 始终可见（去掉 Files/Filters tab 切换，宽度 280px）
- NODE_TYPE_COLORS 统一到 constants.ts（消除 code-graph-view / code-analysis-view / KnowledgeGraph 三处重复）
- EDGE_COLORS 紫色值替换为蓝色（CALLS #7c3aed → 蓝色，HAS_METHOD #8b5cf6 → 蓝色）
- Engine 监听地址从 0.0.0.0 改为 127.0.0.1（当前 ENGINE_HOST=0.0.0.0）
- Engine NODE_COLORS 紫色值替换（Function #7c3aed → 蓝色，Method #8b5cf6 → 蓝色）
- 补充缺失的 i18n key（en-US 有 `API Key Management`，zh-CN 缺失）
- Code 页 graph/analyze tab 顶部加「打开完整图谱/分析 →」跳转链接
- 死依赖清理：移除 `graphology-communities-louvain`、`graphology-layout-noverlap`、`sonner`；`@types/react-syntax-highlighter` 移至 devDependencies
- 破碎 Engine 代理清理：移除 node-types/process-flow/search/processes/chat 代理，仅保留 file+graph

### v2（下一轮考虑，不本次）

- 深色模式
- Wiki 全文搜索（前端）
- CodeGraph 图谱容器拖拽调整大小
- Wiki KnowledgeGraph 节点点击预览
- Skills/ChatMemory 使用统计
- Code 页面列表页显示仓库大小/索引时间
- CodeAnalysis 工具使用说明和示例查询
- analyzeProject 用 LLM 生成摘要（依赖 LLM 服务就绪）
- Engine 监听地址/端口改为 Panel 配置项（当前硬编码 127.0.0.1:8443）
- 全局无障碍（aria/role）补充（当前 124 组件仅 27 个 aria 属性）
- CodeGraph 页面对接 KS callers/callees/impact 查询端点（在节点右键菜单中增加"查看调用者/被调用者/影响分析"）
- 前端测试覆盖（当前 0 测试文件，124 组件 34K 行代码无测试）
- API 文档补齐（`docs/api/knowledge-panel-api.md` 被代码引用但不存在）

### out（永远不做）

- Code 页面删除 graph tab 和 analyze tab（两者定位不同，属性互补）
- 统一两个图谱引擎为一个（技术栈不同，强行统一收益低）
- 移动端适配（定位为桌面端开发者工具）

---

## 非功能性需求

- **性能**: 图谱社区着色计算不阻塞渲染（Web Worker 或 requestIdleCallback）；图谱 5000 节点时首帧 ≤ 3s
- **可访问性**: 快捷键支持；Tooltip 对键盘焦点也触发
- **安全**: Engine 仅监听 127.0.0.1；CORS 限制为 Panel 域名；敏感信息不暴露于前端
- **兼容性**: Chrome 90+, Firefox 90+, Edge 90+（开发者工具，无需 IE/Safari 支持）
- **可观测性**: 无新增埋点需求

## 依赖与假设

- Engine 服务配置文件位于 `MemoryCore/service.ts`，可修改监听地址
- LadybugDB 和 Engine 部署在同一台机器上，改 127.0.0.1 不影响内部调用
- 前端构建工具为 Vite，CSS 变量可全局替换
- 社区着色依赖 LadybugDB 返回的 community 字段（已在 GraphData 中定义）
- 工具执行历史存储于 localStorage，无需后端支持
- Tea Component 主题色为 `--tea-color-bg-brand-default`，品牌色替换不破坏 Tea 组件
- cancelled 标记存储于 LadybugDB，Panel 通过 KS 接口读写分析任务状态
- engineProxy 当前使用硬编码 URL 拼接，需改为 `c.req.query()` 动态读取