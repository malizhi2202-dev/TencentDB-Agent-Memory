# TASK: MemoryPanel 全项目评审修复与增强

- **Change ID**: codegraph-v2
- **关联**: `@.specs/codegraph-v2/REQUIREMENT.md`、`@.specs/codegraph-v2/DESIGN.md`、`@.specs/codegraph-v2/UI-DESIGN.md`

---

## 波次划分

```
Wave 1 (parallel): T01[P], T02[P], T03[P], T04[P], T05[P], T06[P]
Wave 2 (parallel): T07[P], T08[P], T09[P], T10[P]     (depends on T01, T04, T05)
Wave 3 (parallel): T11[P], T12[P], T13[P], T14[P]     (depends on T07, T08)
Wave 4 (parallel): T15[P], T16[P], T17[P]             (depends on T12, T13, T14)
Wave 5 (parallel): T18[P], T19[P]                     (depends on T06)
```

---

## 任务清单

```xml
<task id="T01" parallel="true" status="pending">
  <name>死依赖清理</name>
  <read_files>
    MemoryPanel/web/package.json
    MemoryPanel/web/src/**/*.ts
    MemoryPanel/web/src/**/*.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/package.json
  </write_files>
  <action>
    从 dependencies 移除 graphology-communities-louvain、graphology-layout-noverlap、sonner。
    将 @types/react-syntax-highlighter 从 dependencies 移至 devDependencies。
    确认全站无 import 引用这三个包（grep 验证）。
  </action>
  <verify>grep -c 'graphology-communities-louvain\|graphology-layout-noverlap\|sonner' MemoryPanel/web/package.json && echo "PASS: 0 dead deps"</verify>
  <done>AC-25: 三个死依赖已移除，@types 已移至 devDependencies</done>
  <depends_on></depends_on>
  <auto>true</auto>
</task>

<task id="T02" parallel="true" status="pending">
  <name>Engine 监听地址改为 127.0.0.1</name>
  <read_files>
    MemoryKnowledge/src/engines/codeanalysis-engine/service.ts
    MemoryKnowledge/src/engines/codeanalysis-engine/src/server/api.ts
  </read_files>
  <write_files>
    MemoryKnowledge/src/engines/codeanalysis-engine/service.ts
  </write_files>
  <action>
    修改 service.ts 中 ENGINE_HOST 默认值，确保仅监听 127.0.0.1。
    同时将 NODE_COLORS 中的紫色替换为蓝色系（见 D-001 ADR）。
    决策参考 DESIGN.md D-10。
  </action>
  <verify>grep -c '0.0.0.0\|#7c3aed\|#8b5cf6' MemoryKnowledge/src/engines/codeanalysis-engine/service.ts && echo "PASS: no 0.0.0.0 or purple"</verify>
  <done>AC-2: Engine 仅监听 127.0.0.1，NODE_COLORS 无紫色</done>
  <depends_on></depends_on>
  <auto>true</auto>
</task>

<task id="T03" parallel="true" status="pending">
  <name>破碎 Engine 代理清理</name>
  <read_files>
    MemoryPanel/src/panel/http/routes/knowledge/code-graph-routes.ts
  </read_files>
  <write_files>
    MemoryPanel/src/panel/http/routes/knowledge/code-graph-routes.ts
  </write_files>
  <action>
    移除 5 个破碎代理：node-types（Engine 不存在）、process-flow（Engine 不存在）、
    search（GET vs POST 方法不匹配）、processes（前端未使用）、chat（前端未使用）。
    仅保留 /api/file（前端使用）和 /api/graph（未来预留）代理。
    决策参考 DESIGN.md D-9。
  </action>
  <verify>grep "engineProxy\|engine/" MemoryPanel/src/panel/http/routes/knowledge/code-graph-routes.ts | grep -v "file\|graph" && echo "FAIL: extra proxies" || echo "PASS: only file+graph"</verify>
  <done>AC-26: 破碎代理已清理，仅保留 file 和 graph 代理</done>
  <depends_on></depends_on>
  <auto>true</auto>
</task>

<task id="T04" parallel="true" status="pending">
  <name>统一颜色常量 + 全域紫色替换</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/constants.ts
    MemoryPanel/web/src/pages/code/CodePage/components/code-graph-view.tsx
    MemoryPanel/web/src/pages/code/CodePage/components/code-analysis-view.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/constants.ts
    MemoryPanel/web/src/pages/code/CodePage/components/code-graph-view.tsx
    MemoryPanel/web/src/pages/code/CodePage/components/code-analysis-view.tsx
  </write_files>
  <action>
    1. 将 EDGE_COLORS.CALLS 从 #7c3aed 改为蓝色 #2563eb；HAS_METHOD 从 #8b5cf6 改为蓝色 #2563eb
    2. code-graph-view.tsx 中 NODE_TYPE_COLORS 改为 import constants.ts 的 NODE_COLORS
    3. code-analysis-view.tsx 中 NODE_TYPE_COLORS 改为 import constants.ts 的 NODE_COLORS
    决策参考 ADR-001。
  </action>
  <verify>grep -c "NODE_TYPE_COLORS\|NODE_COLORS" MemoryPanel/web/src/pages/code/CodePage/components/code-graph-view.tsx MemoryPanel/web/src/pages/code/CodePage/components/code-analysis-view.tsx | grep -v "import"</verify>
  <done>AC-4: 全站仅 constants.ts 定义颜色，EDGE_COLORS 无紫色</done>
  <depends_on></depends_on>
  <auto>true</auto>
</task>

<task id="T05" parallel="true" status="pending">
  <name>删除死代码文件</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/CodeReferencesPanel.tsx
    MemoryPanel/web/src/pages/codegraph/components/StatusBar.tsx
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/CodeReferencesPanel.tsx
    MemoryPanel/web/src/pages/codegraph/components/StatusBar.tsx
  </write_files>
  <action>
    删除 CodeReferencesPanel.tsx 和 StatusBar.tsx 两个死文件。
    确认 CodeGraphPage.tsx 中未 import 这两个文件（grep 验证）。
  </action>
  <verify>ls MemoryPanel/web/src/pages/codegraph/components/CodeReferencesPanel.tsx MemoryPanel/web/src/pages/codegraph/components/StatusBar.tsx 2>&1 | grep "No such file" | wc -l | grep "2"</verify>
  <done>AC-18: 死代码文件已删除</done>
  <depends_on></depends_on>
  <auto>true</auto>
</task>

<task id="T06" parallel="true" status="pending">
  <name>侧边栏精简 + 路由合并</name>
  <read_files>
    MemoryPanel/web/src/routes/index.tsx
    MemoryPanel/web/src/constants/menu.tsx
    MemoryPanel/web/src/pages/codeanalysis/CodeAnalysisPage.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/src/routes/index.tsx
    MemoryPanel/web/src/constants/menu.tsx
    MemoryPanel/web/src/pages/codeanalysis/CodeAnalysisPage.tsx
  </write_files>
  <action>
    1. routes/index.tsx: 删除 5 条 /analysis/* 子路由，保留 1 条 /analysis
    2. menu.tsx: 代码分析分组从 7 项减为 2 项（代码图谱 + 代码分析工具）
    3. CodeAnalysisPage.tsx: 内部用 useSearchParams 读取 ?category= 参数替代路由切换
    决策参考 DESIGN.md D-7。
  </action>
  <verify>grep -c "/analysis/" MemoryPanel/web/src/routes/index.tsx && echo "has sub-routes" || echo "PASS: merged"</verify>
  <done>AC-1: 侧边栏代码分析从 7 项减为 2 项</done>
  <depends_on></depends_on>
  <auto>true</auto>
</task>

<task id="T07" parallel="true" status="pending">
  <name>GraphNode 接口修正（对齐 KS API）</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
    MemoryPanel/web/src/lib/knowledge-api.ts
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
  </write_files>
  <action>
    扩展 CodeGraphPage.tsx 中 GraphNode 接口，新增 linkCount、community、lineStart、lineEnd 字段。
    修改 graphData.nodes.map() 映射逻辑，保留 KS 返回的 linkCount 和 community 字段。
    决策参考 DESIGN.md D-1。
  </action>
  <verify>grep "linkCount\|community" MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx | head -3</verify>
  <done>AC-7: GraphNode 接口含 linkCount 和 community</done>
  <depends_on>T01, T04, T05</depends_on>
  <auto>true</auto>
</task>

<task id="T08" parallel="true" status="pending">
  <name>GraphEdge 接口修正（对齐 KS API）</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
    MemoryPanel/web/src/pages/codegraph/constants.ts
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
  </write_files>
  <action>
    扩展 GraphEdge 接口，新增 weight 字段。
    修改 graphData.edges.map() 映射逻辑，保留 KS 返回的 weight 字段。
    边颜色从 constants.ts EDGE_COLORS 按 type 映射，不再硬编码 #64748b。
    决策参考 DESIGN.md D-2。
  </action>
  <verify>grep "weight" MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx | head -2</verify>
  <done>AC-10: GraphEdge 接口含 weight，边颜色按 type 映射</done>
  <depends_on>T01, T04, T05</depends_on>
  <auto>true</auto>
</task>

<task id="T09" parallel="true" status="pending">
  <name>代码面板行号显示</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
    MemoryPanel/web/src/pages/codegraph/codegraph.css
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
    MemoryPanel/web/src/pages/codegraph/codegraph.css
  </write_files>
  <action>
    在浮动代码面板的代码内容渲染中添加行号列。
    使用 CSS counter 或 CSS ::before 伪元素实现行号（每行前显示行号，颜色 #999）。
    行号区域宽度 40px，右对齐，不可选中（user-select: none）。
  </action>
  <verify>grep "line-number\|行号\|counter-reset\|counter-increment" MemoryPanel/web/src/pages/codegraph/codegraph.css</verify>
  <done>AC-20: 浮动代码面板有行号显示</done>
  <depends_on>T01, T05</depends_on>
  <auto>true</auto>
</task>

<task id="T10" parallel="true" status="pending">
  <name>FileTreePanel Filters 重构 + 紫色替换</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx
    MemoryPanel/web/src/pages/codegraph/codegraph.css
    MemoryPanel/web/src/pages/codegraph/constants.ts
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx
    MemoryPanel/web/src/pages/codegraph/codegraph.css
  </write_files>
  <action>
    1. 去掉 Files/Filters tab 切换，Filters 始终渲染在面板顶部
    2. 面板宽度从 240px 扩展为 280px
    3. 替换 5 处紫色硬编码（bg-purple-100 → bg-blue-50, text-purple-700 → text-blue-700,
       bg-purple-500 → bg-blue-500, bg-purple-600 → bg-blue-600, bg-purple-50 → bg-blue-50,
       border-purple-500 → border-blue-500, focus:border-purple-400 → focus:border-blue-400）
    4. 文件树节点显示符号数 badge（如 `(12)`）
    决策参考 DESIGN.md D-8, UI-DESIGN.md § 1.5。
  </action>
  <verify>grep "purple" MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx && echo "FAIL: purple" || echo "PASS: no purple"</verify>
  <done>AC-5: FileTreePanel 无紫色，Filters 始终可见，面板 280px</done>
  <depends_on>T01, T04, T05</depends_on>
  <auto>true</auto>
</task>

<task id="T11" parallel="true" status="pending">
  <name>边箭头渲染</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
    MemoryPanel/web/src/pages/codegraph/constants.ts
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
  </write_files>
  <action>
    在 GraphCanvas 的 sigma 配置中启用 EdgeArrowProgram，在目标端渲染三角形箭头。
    使用 @sigma/edge-curve 的 EdgeCurvedArrowProgram（已安装在 package.json）。
    设置 minEdgeSize 阈值（节点数 > 500 时隐藏箭头以保持性能）。
    决策参考 DESIGN.md D-3。
  </action>
  <verify>grep "EdgeArrow\|EdgeCurvedArrow\|arrow" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx</verify>
  <done>AC-6: 边有方向箭头</done>
  <depends_on>T07, T08</depends_on>
  <auto>true</auto>
</task>

<task id="T12" parallel="true" status="pending">
  <name>社区着色渲染</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
    MemoryPanel/web/src/pages/codegraph/constants.ts
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
    MemoryPanel/web/src/pages/codegraph/constants.ts
  </write_files>
  <action>
    1. 在 constants.ts 中添加 COMMUNITY_COLORS（12 色 HSL 色相轮换）
    2. 在 GraphCanvas 的节点渲染中，当 communityCount > 1 时，按 n.community 分配颜色
    3. 添加社区着色视图模式按钮（与 Force/Tree/Circles 并列）
    4. 节点 Tooltip 显示 community 编号和 linkCount
    决策参考 DESIGN.md D-4, UI-DESIGN.md Design Tokens。
  </action>
  <verify>
    # 验证 1: constants.ts 有 12 色 COMMUNITY_COLORS
    grep -cP '"community-\d+"' MemoryPanel/web/src/pages/codegraph/constants.ts | grep -q "12" || exit 1
    # 验证 2: GraphCanvas 导入 COMMUNITY_COLORS
    grep -q "COMMUNITY_COLORS" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    # 验证 3: 社区视图模式按钮存在
    grep -q "community\|Community" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    # 验证 4: Tooltip 显示 linkCount
    grep -q "linkCount" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    echo "PASS: community coloring verified"
  </verify>
  <done>AC-7: 节点按社区着色，Tooltip 显示 linkCount，12 色调色板</done>
  <depends_on>T07, T08</depends_on>
  <auto>false</auto>
</task>

<task id="T13" parallel="true" status="pending">
  <name>节点右键菜单</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
  </write_files>
  <action>
    在 GraphCanvas 中监听 sigma 节点的 contextmenu 事件（右键）。
    渲染绝对定位的右键菜单 div，包含以下菜单项：
    - 查看调用者（callers）
    - 查看被调用者（callees）
    - 影响分析（impact）
    - 复制节点路径（复制到剪贴板）
    - 聚焦节点（focus + zoom）
    菜单项点击后通过回调通知 CodeGraphPage 触发对应操作。
    菜单样式参考 UI-DESIGN.md § 5 右键菜单规约。
    决策参考 DESIGN.md § 1.2 对标 Sourcetrail。
  </action>
  <verify>
    # 验证 1: contextmenu 事件监听
    grep -q "contextmenu" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    # 验证 2: 5 个菜单项都存在
    grep -q "callers\|调用者" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    grep -q "callees\|被调用者" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    grep -q "impact\|影响分析\|影响" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    grep -q "clipboard\|复制\|copy" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    grep -q "focus\|聚焦\|zoom.*node" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    # 验证 3: 菜单容器样式（绝对定位 + z-50 + shadow）
    grep -q "absolute\|fixed" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    grep -q "z-50\|z-\[50\]" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx || exit 1
    echo "PASS: context menu verified"
  </verify>
  <done>AC-12: 节点右键菜单含 5 个菜单项，样式正确</done>
  <depends_on>T07, T08</depends_on>
  <auto>false</auto>
</task>

<task id="T14" parallel="true" status="pending">
  <name>快捷键提示栏 + 键盘快捷键</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx
  </write_files>
  <action>
    1. 在 GraphCanvas 容器上绑定 keydown 事件：
       - + / = ：放大（zoomIn）
       - - ：缩小（zoomOut）
       - F ：适应视口（resetZoom）
       - Escape ：取消选中
    2. 输入框（INPUT/TEXTAREA）焦点时不拦截
    3. 在 GraphCanvas 底部渲染快捷键提示栏（绝对定位，高 24px，半透明背景）：
       [+/- Zoom] [F Fit] [Esc Deselect] [R Click→Context Menu]
    4. 替换紫色残留：layout 按钮 border-purple-400 → border-blue-400, bg-purple-600 → bg-blue-600
    决策参考 DESIGN.md D-5, UI-DESIGN.md § 5 快捷键提示栏。
  </action>
  <verify>grep "keydown\|onKeyDown\|快捷键\|shortcut\|Shortcut" MemoryPanel/web/src/pages/codegraph/components/GraphCanvas.tsx</verify>
  <done>AC-13: 快捷键可用，提示栏可见，GraphCanvas 无紫色</done>
  <depends_on>T07, T08</depends_on>
  <auto>true</auto>
</task>

<task id="T15" parallel="true" status="pending">
  <name>图例始终可见 + 文件树符号大纲</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx
    MemoryPanel/web/src/pages/codegraph/constants.ts
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx
  </write_files>
  <action>
    1. Filters 区域顶部添加图例：节点类型颜色点 + 类型名 + 数量（如 ● Class 45）
    2. 边类型颜色点 + 类型名（如 ● CALLS）
    3. 文件树节点点击展开符号列表（如果 KS 返回 files 数据含符号数）
    4. 图例数据从 constants.ts NODE_COLORS 和 EDGE_COLORS 读取
    决策参考 UI-DESIGN.md § 1.2 对标 Sourcetrail。
  </action>
  <verify>grep "legend\|图例\|Legend\|symbol.*count\|符号" MemoryPanel/web/src/pages/codegraph/components/FileTreePanel.tsx</verify>
  <done>AC-19: 图例始终可见，文件树有符号数</done>
  <depends_on>T12, T13, T14</depends_on>
  <auto>true</auto>
</task>

<task id="T16" parallel="true" status="pending">
  <name>浮动代码面板紫色替换 + 高亮信息增强</name>
  <read_files>
    MemoryPanel/web/src/pages/codegraph/CodeGraphPage.tsx
    MemoryPanel/web/src/pages/codegraph/codegraph.css
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codegraph/codegraph.css
  </write_files>
  <action>
    检查 codegraph.css 中所有紫色残留，替换为品牌蓝 #2563eb。
    浮动代码面板底部添加节点信息条：文件路径 + 类型 + 连接数（linkCount）。
    决策参考 UI-DESIGN.md § 5 Do's/Don'ts。
  </action>
  <verify>grep "#7c3aed\|#8b5cf6\|#a855f7\|purple" MemoryPanel/web/src/pages/codegraph/codegraph.css && echo "FAIL: purple" || echo "PASS: no purple"</verify>
  <done>AC-5: codegraph.css 无紫色，浮动面板有节点信息</done>
  <depends_on>T12, T13, T14</depends_on>
  <auto>true</auto>
</task>

<task id="T17" parallel="true" status="pending">
  <name>Code 页 graph/analyze 跳转链接</name>
  <read_files>
    MemoryPanel/web/src/pages/code/CodePage/components/code-detail-view.tsx
    MemoryPanel/web/src/pages/code/CodePage/components/code-graph-view.tsx
    MemoryPanel/web/src/pages/code/CodePage/components/code-analysis-view.tsx
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/code/CodePage/components/code-detail-view.tsx
  </write_files>
  <action>
    在 Code 页的 graph tab 和 analyze tab 内容顶部各添加一行链接：
    「打开完整图谱 →」跳转到 /graph?repo=当前repo
    「打开完整分析 →」跳转到 /analysis?category=当前category
    链接样式：text-blue-600 text-xs hover:underline
    决策参考 UI-DESIGN.md § 8 跨页导航。
  </action>
  <verify>grep "打开完整图谱\|打开完整分析\|openGraph\|openAnalysis" MemoryPanel/web/src/pages/code/CodePage/components/code-detail-view.tsx</verify>
  <done>AC-24: Code 页 graph/analyze tab 有跳转链接</done>
  <depends_on>T06</depends_on>
  <auto>true</auto>
</task>

<task id="T18" parallel="true" status="pending">
  <name>Workbench 任务统计面板</name>
  <read_files>
    MemoryPanel/web/src/pages/workbench/WorkbenchPage/components/TaskWorkbench.tsx
    MemoryPanel/web/src/pages/workbench/WorkbenchPage/components/task-workbench.css
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/workbench/WorkbenchPage/components/TaskWorkbench.tsx
    MemoryPanel/web/src/pages/workbench/WorkbenchPage/components/task-workbench.css
  </write_files>
  <action>
    在 Workbench 页面顶部添加任务统计条：
    显示 4 个统计方块：待办（蓝色）、进行中（橙色）、已完成（绿色）、阻塞（红色）。
    每个方块显示数量 + 标签。数据从 task.list() API 聚合。
    样式参考 UI-DESIGN.md v0 草稿 Workbench 布局。
  </action>
  <verify>grep "统计\|stats\|Stats\|统计条\|taskCount\|taskStats" MemoryPanel/web/src/pages/workbench/WorkbenchPage/components/TaskWorkbench.tsx</verify>
  <done>AC-14: Workbench 有任务统计面板</done>
  <depends_on>T06</depends_on>
  <auto>true</auto>
</task>

<task id="T19" parallel="true" status="pending">
  <name>CodeAnalysis 工具执行历史</name>
  <read_files>
    MemoryPanel/web/src/pages/codeanalysis/CodeAnalysisPage.tsx
    MemoryPanel/web/src/pages/codeanalysis/components/analysis-workbench.css
  </read_files>
  <write_files>
    MemoryPanel/web/src/pages/codeanalysis/CodeAnalysisPage.tsx
    MemoryPanel/web/src/pages/codeanalysis/components/analysis-workbench.css
  </write_files>
  <action>
    在 CodeAnalysis 页面右侧或底部添加工具执行历史列表。
    历史存储于 localStorage（key: tdai-codeanalysis-history），上限 50 条，LRU 淘汰。
    每条记录显示：工具名、时间戳、参数摘要。点击回填 tool + params。
    决策参考 ADR-003。
  </action>
  <verify>grep "tdai-codeanalysis-history\|toolHistory\|工具历史\|执行历史\|history" MemoryPanel/web/src/pages/codeanalysis/CodeAnalysisPage.tsx</verify>
  <done>AC-16: CodeAnalysis 有工具执行历史</done>
  <depends_on>T06</depends_on>
  <auto>true</auto>
</task>
```

---

## 状态字段说明

- `status="pending"` — 未开始
- `status="in_progress"` — 进行中
- `status="done"` — 已完成
- `status="blocked"` — 阻塞

---

## 阻塞日志

| 任务 | 阻塞原因 | 待人工决策项 | 时间 |
|---|---|---|---|
|  |  |  |  |

---

## 工时估算

| Wave | 任务数 | 预估工时 |
|---|---|---|
| Wave 1 | 6 [P] | 2h（并行） |
| Wave 2 | 4 [P] | 2h（并行） |
| Wave 3 | 4 [P] | 2h（并行） |
| Wave 4 | 3 [P] | 1.5h（并行） |
| Wave 5 | 2 [P] | 1h（并行） |
| **总计** | **19** | **8.5h（实际并行约 4h）** |