# TASK: MemoryPanel UI 重构 —— Agent 协作平台

- **Change ID**: agent-collab-ui-redesign
- **关联**: `@.specs/agent-collab-ui-redesign/REQUIREMENT.md`、`@.specs/agent-collab-ui-redesign/DESIGN.md`

---

## 波次划分

```
Wave 1 (parallel): T01[P]                                 （menu 信息架构地基）
Wave 2 (parallel): T02[P], T03[P], T04[P]                 （depends on T01）
Wave 3 (parallel): T05[P], T06[P], T07[P], T08[P], T09[P] （depends on T02/T03/T04）
```

> 同 wave 可并行；跨 wave 必须顺序。Wave 3 的 5 个任务分属不同文件，互不冲突。

---

## 任务清单

```xml
<task id="T01" parallel="true" status="done">
  <name>导航信息架构落地：menu.tsx 4 组 → 6 组 + 新 PageId</name>
  <read_files>
    src/constants/menu.tsx
    src/routes/index.tsx
    src/layouts/ConsoleLayout.tsx
  </read_files>
  <write_files>
    src/constants/menu.tsx
  </write_files>
  <action>
    沿用现有 PageId/PageMeta/group/order/icon 模式（见 DESIGN §0.5.2）。
    新增 PageId：memory_spaces、project_detail、agent_detail；
    分组从 4 组改为 6 组（workbench/projects/team/memory-spaces/assets/settings），
    GROUP_ORDER_KEYS 同步；ITEM_ICON 为新 PageId 补 tea-icons-react 图标。
    保持视觉：不引入新色值，图标沿用现有 tea 图标风格。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-1：menu.tsx 能编译，6 组 PageMeta + 新 PageId 就绪</done>
  <depends_on></depends_on>
  <auto>true</auto>
  <!-- 专家团投票：4/4 🤖 自动化 -->
</task>

<task id="T02" parallel="true" status="done">
  <name>路由表扩展：新路由 + 兼容重定向保留</name>
  <read_files>
    src/routes/index.tsx
    src/constants/menu.tsx
  </read_files>
  <write_files>
    src/routes/index.tsx
    src/pages/memory-space/MemorySpacesPage.tsx
    src/pages/memory-space/MemorySpaceDetailPage.tsx
    src/pages/projects/ProjectDetailPage.tsx
    src/pages/team/AgentDetailPage.tsx
  </write_files>
  <action>
    沿用 createHashRouter（DESIGN §0 锁定，不换路由库）。
    新增：/memory-spaces、/memory-spaces/:spaceId、/projects/:id、/team/agents/:id；
    保留 /graph → /analysis 兼容重定向；旧路由全部保留。
    新页面先挂最小占位骨架组件（空态「骨架阶段」），T06/T07/T08 再充实具体内容，不接真实数据。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-1：新路由可导航、旧路由不回归</done>
  <depends_on>T01</depends_on>
  <auto>true</auto>
</task>

<task id="T03" parallel="true" status="done">
  <name>ConsoleLayout + TabBar：PATH_TO_PAGE 映射 + 6 组渲染</name>
  <read_files>
    src/layouts/ConsoleLayout.tsx
    src/layouts/TabBar/index.tsx
    src/constants/menu.tsx
  </read_files>
  <write_files>
    src/layouts/ConsoleLayout.tsx
    src/layouts/TabBar/index.tsx
  </write_files>
  <action>
    沿用 PageId ↔ PATH_TO_PAGE 双向映射 + GROUP_ORDER_KEYS 分组排序模式。
    PATH_TO_PAGE 补新 PageId 映射；侧边栏按 6 组渲染；
    TabBar 承载新 PageId 标签；保留 legacyHashToPath 兼容逻辑（DESIGN §0.5.1 标注，非「顺手」删）。
    解禁 ConsoleLayout 已由 DESIGN §1 D1 批准。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-1：6 组导航渲染 + TabBar 高亮正常</done>
  <depends_on>T01</depends_on>
  <auto>true</auto>
</task>

<task id="T04" parallel="true" status="done">
  <name>i18n 新菜单文案（zh-CN + en-US）</name>
  <read_files>
    src/i18n/zh-CN.ts
    src/i18n/en-US.ts
  </read_files>
  <write_files>
    src/i18n/zh-CN.ts
    src/i18n/en-US.ts
  </write_files>
  <action>
    沿用 react-i18next 扁平 key 模式。补齐新分组 label/desc 与
    新 PageId（memory_spaces/project_detail/agent_detail）的中英文案；
    分组标题：工作台/协作项目/团队/记忆空间/资产/设置。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-1：新菜单中英文案齐、无缺 key</done>
  <depends_on>T01</depends_on>
  <auto>true</auto>
</task>

<task id="T05" parallel="true" status="pending">
  <name>工作台概览页：双列栅格重设计（左主区 + 右上下文栏）</name>
  <read_files>
    src/pages/workbench/WorkbenchPage.tsx
    src/components/MemoryCapabilitiesPanel.tsx
    src/constants/menu.tsx
  </read_files>
  <write_files>
    src/pages/workbench/WorkbenchPage.tsx
  </write_files>
  <action>
    按 UI-DESIGN §11.2 线框：左主区（约 2/3：我的任务 + 最近项目 + 最近 Agent 活动）
    + 右上下文栏（约 1/3：最近协作动态 + 记忆空间健康 + 待处理决策/审批）。
    把现有 MemoryCapabilitiesPanel 吸收进右栏「记忆空间健康」区，不再作为孤立的 5-tab 面板盖在页顶。
    视觉保持 tea + 腾讯蓝，不换色不换字。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-2：工作台从「堆叠」变「双列栅格」，能力面板收进右栏</done>
  <depends_on>T03</depends_on>
  <auto>true</auto>
</task>

<task id="T06" parallel="true" status="pending">
  <name>协作项目详情：7 Tab 骨架（任务/交付物/决策/OKR/规约/工作空间/记忆空间）</name>
  <read_files>
    src/pages/projects/*
    src/constants/menu.tsx
  </read_files>
  <write_files>
    src/pages/projects/*
  </write_files>
  <action>
    按 UI-DESIGN §11.3 线框：项目头部（名称/状态/成员 chip/挂载记忆空间 chip）
    + TabBar 7 个 tab（任务拆解/交付物/决策/OKR/规约心智/工作空间/记忆空间）
    + 内容区三态（列表/看板/表格）。
    骨架 + 统一空态组件，不接真实数据（见 CHANGE 范围排除）。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-3：项目详情 7 Tab 骨架可切换、有空态</done>
  <depends_on>T02</depends_on>
  <auto>true</auto>
</task>

<task id="T07" parallel="true" status="pending">
  <name>Agent 详情：4 Tab 配置面骨架（基础/执行环境/绑定/API）</name>
  <read_files>
    src/pages/team/AgentsPage.tsx
  </read_files>
  <write_files>
    src/pages/team/AgentsPage.tsx
  </write_files>
  <action>
    按 UI-DESIGN §11.4 线框：Agent 头部（名称/类型角色/可见性/状态）
    + 左侧竖排 4 Tab（基础：名称描述类型角色 person；执行环境：network_policy/approval_mode；
    绑定：skill/知识库/MCP；API：surface.tool + surface.api 双通道）。
    骨架 + 空态，字段先用前端类型占位，不接后端（见 CHANGE 范围排除）。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-4：Agent 详情 4 Tab 配置区骨架就绪</done>
  <depends_on>T02</depends_on>
  <auto>true</auto>
</task>

<task id="T08" parallel="true" status="pending">
  <name>记忆空间独立模块：列表 + 详情骨架（新）</name>
  <read_files>
    src/pages/memory/ChatMemoryPage.tsx
    src/constants/menu.tsx
  </read_files>
  <write_files>
    src/pages/memory-space/*
  </write_files>
  <action>
    按 UI-DESIGN §11.5 线框：顶部 owner 维度过滤（team/project/agent/user）
    + 左空间列表（spaceId/owner/Brain 域）+ 右空间详情（Brain 域 chip + 写入策略
    + L0-L3 记忆块 mono 展示 + 质量指标占位 [awaits real metric]）。
    骨架 + 空态，不接真实数据。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>AC-5：记忆空间列表 + 详情骨架可导航、有空态</done>
  <depends_on>T02</depends_on>
  <auto>true</auto>
</task>

<task id="T09" parallel="true" status="pending">
  <name>样式收敛：散落内联样式收口 + 三段式/双列栅格 layout utility</name>
  <read_files>
    src/index.css
    src/tea-override.css
    src/constants/menu.tsx
  </read_files>
  <write_files>
    src/index.css
    src/tea-override.css
    src/theme/layout.css
  </write_files>
  <action>
    按 UI-DESIGN §0.3：保持现有风格，只做「收敛」——
    散落的内联样式统一别名到现有 --tea-color-* token（不新建视觉 tokens、不换色不换字）。
    新增 src/theme/layout.css：三段式（头部→TabBar→内容区）+ 双列栅格（左主区 + 右上下文栏）utility。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npm run build</verify>
  <done>AC-2：构建通过，视觉保持 + 布局 utility 就绪</done>
  <depends_on>T03</depends_on>
  <auto>true</auto>
</task>

<task id="T-FIX-01" parallel="false" status="done">
  <name>移动 TeamSwitcher 出 GlobalHeader 目录（REVIEW R6 命名扭曲）</name>
  <read_files>
    src/layouts/GlobalHeader/TeamSwitcher.tsx
    src/layouts/GlobalHeader/team-switcher.css
    src/layouts/ConsoleLayout.tsx
  </read_files>
  <write_files>
    src/layouts/TeamSwitcher/TeamSwitcher.tsx
    src/layouts/TeamSwitcher/team-switcher.css
    src/layouts/ConsoleLayout.tsx
  </write_files>
  <action>
    TeamSwitcher 职责已从「全局顶栏」改为「侧边栏团队分组标题」，但文件仍寄居 GlobalHeader 目录。
    移动到 src/layouts/TeamSwitcher/，同步更新 ConsoleLayout 的 import 路径。
  </action>
  <verify>cd MemoryPanel/web &amp;&amp; npx tsc --noEmit</verify>
  <done>文件已移动，import 已更新，tsc/build 通过</done>
  <auto>true</auto>
</task>
```

---

## 状态字段说明

- `status="pending"` — 未开始
- `status="in_progress"` — 进行中（同时只允许一个非 [P] 任务为此状态）
- `status="done"` — 已完成（verify 通过）
- `status="blocked"` — 阻塞（必须在文件末尾「阻塞日志」记录）

---

## 🛡️ 专家团门禁 · Task 门（R9/R13）

### 议题 1 · 任务拆分质量

> TASK.md 拆分：9 任务、3 波次，按「文件冲突」切（垂直切片），粒度 2~10 分钟可完成，依赖无环。

### 议题 2 · 逐 Task 自动化策略

```
🗳️ Task 门: TASK.md 是否通过？

   🟫 工程效能专家: ✅ 波次划分合理（Wave1 地基 → Wave2 导航 → Wave3 页面并行），并行度已最大化
   🟦 架构师: ✅ 覆盖 DESIGN D1~D6 全部决策点；write_files 均在 0.5.1 边界内，禁动清单零触碰
   🟩 研发负责人: ✅ task 边界清晰、write_files 准确、9 任务工时合理（均纯前端骨架）
   🔴 资深测试工程师: ✅ verify 均为可机判命令（tsc --noEmit / npm run build），done 对应 AC 子项可判定

   自动化策略汇总：T01🤖 T02🤖 T03🤖 T04🤖 T05🤖 T06🤖 T07🤖 T08🤖 T09🤖
   结果: 4/4 → 全票通过 ✅ 自动进入 4-dev，按波次逐个执行（均 🤖 自动化，无 schema/安全/破坏性变更）
```

---

## 阻塞日志

| 任务 | 阻塞原因 | 待人工决策项 | 时间 |
|---|---|---|---|
|  |  |  |  |

---

## Fix 任务（来自 REVIEW / INTEGRATION）

> 此区域由 review/integration 阶段自动追加，编号 `T-FIX-XX`。
