# DESIGN: MemoryPanel UI 重构 —— Agent 协作平台

- **Change ID**: agent-collab-ui-redesign
- **关联**: `@.specs/agent-collab-ui-redesign/REQUIREMENT.md`、`@.specs/CONTEXT.md`
- **作者**: AI（Architect 角色）+ 人工 review

---

## 0. 技术栈选定

> 本次是 brownfield UI 重构，**沿用既有栈**，不换栈（变栈视为开新 CHANGE）。

- **选定**：沿用既有栈
- **前端**：React 18 + Vite + TypeScript + tea-component + react-router（createHashRouter）+ zustand + react-i18next
- **后端**：Hono（Panel 代理层），本次 UI 骨架阶段新增前端类型 + 预留 API 契约，不改后端实现
- **数据库**：不动（LadybugDB / SQLite，见 CONTEXT.md）
- **关键依赖**：tea-component / tea-icons-react / react-router-dom / zustand
- **理由**：现有栈已稳定（CONTEXT.md 锁定），UI 重构只需「信息架构 + 视觉 + 页面骨架」，无需换栈引入迁移风险。
- **明确排除**：不引入 Tailwind（与 tea-component 主题体系冲突）、不引入新路由库（沿用 hash router 保证静态部署 + 旧链接兼容）。

---

## 0.5 既有架构对齐（brownfield · 必填）

### 0.5.1 本次触碰的既有模块（grep 实测）

```
触碰模块（需改）：
- src/routes/index.tsx（路由表，加新页面骨架）
- src/constants/menu.tsx（PageId / PageMeta / 分组 / 图标 —— 信息架构核心）
- src/layouts/ConsoleLayout.tsx（导航渲染 / PATH_TO_PAGE / legacyHashToPath）
- src/layouts/TabBar/index.tsx（标签页，随 PageId 变化）
- src/i18n/zh-CN.ts + en-US.ts（菜单/文案）
- src/index.css / src/tea-override.css（样式收敛落地处）
- src/pages/workbench/WorkbenchPage.tsx（工作台概览 → 双列栅格）
- src/pages/team/AgentsPage.tsx（Agent 详情 → 4 Tab 配置面）
- src/pages/projects/（项目列表 → 详情 7 Tab）
- src/pages/memory/ChatMemoryPage.tsx（记忆空间关联入口）

新增模块：
- src/pages/memory-space/（新：记忆空间独立模块）
- src/theme/layout.css（新：三段式 + 双列栅格布局 utility，视觉仍别名 tea token）

禁动清单（本次不碰）：
- MemoryPanel/src/panel/http/app.ts（后端入口）
- MemoryPanel/web/src/lib/api/base.ts（HTTP 客户端基类）
- MemoryPanel/web/src/App.tsx（全局入口；仅若必须才动，且需显式说明）
```

> ⚠️ 注：CONTEXT.md 禁动清单原含 `ConsoleLayout.tsx`。本次 UI 重构的**核心就是导航**，必须改它 —— 在 DESIGN §1 D1 记录「解禁 ConsoleLayout + routes + menu」，属本次 change 的合法触碰，不是「顺手」改动。

### 0.5.2 既有抽象沿用对照表

| 本次需要 | 既有有没有？路径 | 决定 |
|---|---|---|
| 菜单元数据 | `src/constants/menu.tsx`（PageId/PageMeta/group/order/icon） | 沿用并扩展（加新 PageId + 分组） |
| 路由 | `src/routes/index.tsx`（createHashRouter） | 沿用，加子路由 |
| 布局 | `src/layouts/ConsoleLayout.tsx`（Layout+Sider+TabBar） | 沿用，改导航分组渲染 |
| 状态 | zustand `src/stores/` | 沿用 |
| i18n | react-i18next `src/i18n/` | 沿用，补新菜单 key |
| HTTP 客户端 | `src/lib/api/`（fetch 封装 + memory.ts 等） | 沿用，新模块预留 api 契约 |
| design tokens | 无集中定义（散落内联样式） | **新建** `src/theme/tokens.ts`（理由：本次调性统一的前提） |

### 0.5.3 沿用模式 vs 引入新模式

- 菜单/路由：**沿用** PageId + PATH_TO_PAGE 双向映射 + GROUP_ORDER_KEYS 分组排序模式
- 视觉：**引入新模式** → 集中 design tokens（CSS variables），理由：当前内联样式散乱，正是「页面可真怪」的根因之一
- 页面骨架：**沿用** tea-component（Tabs/Card/Table/Form），空态统一封装

---

## 1. 决策清单

| # | 决策 | 备选 | 选择理由 | 取舍代价 |
|---|---|---|---|---|
| D1 | 导航分组：4 组 → 6 组（工作台/协作项目/团队/记忆空间/资产/设置） | 保持 4 组 / 按功能平铺 | 新需求以「协作项目/团队/Agent/记忆空间」为核心，知识资产降级 | 存量用户需适应新分组；解禁 ConsoleLayout/routes/menu |
| D2 | 记忆空间独立成模块（`/memory-spaces`），Chat_Memory 保留为「空间内容查看」入口 | 并入 Chat_Memory | 空间是「一等资源」（owner×Brain 域），管理面独立 | 需要新页面 + 路由 |
| D3 | Agent 详情扩展为多 Tab（基础/执行环境/绑定/API） | 单页长表单 | 字段多（可见性/环境/MCP/API/skill/知识库），分 Tab 更清晰 | 多一层导航 |
| D4 | 项目详情扩展为多 Tab（任务/交付物/决策/OKR/规约/工作空间/记忆空间） | 单页 | 对应「协作项目 9 项」 | 页面更复杂 |
| D5 | 样式收敛：散落内联样式统一别名到现有 `--tea-color-*` token（**不新建视觉 tokens、不换色不换字**） | CSS-in-JS / 直接内联 | 保持现有风格（用户拍板）+ 消除「各页样式不一」 | 需一次性收敛现有散乱样式（可渐进） |
| D6 | 页面骨架 + 空态先行，数据后接 | 一次性全接数据 | 后端/算法 change 未就绪，先交付结构 | 短期出现「点了没数据」的空态页 |

## 2. 信息架构图

```
新导航（6 组）：

1. 工作台（workbench）
   └─ 概览（聚合任务 / 记忆 / 协作动态）      ← 原 workbench_board 升级

2. 协作项目（projects）
   └─ 项目列表 → 项目详情：
        ├─ 任务拆解
        ├─ 交付物（review 门）
        ├─ 决策（DecisionRecord）
        ├─ OKR（objectives/key_results）
        ├─ 规约心智（mindset）
        ├─ 工作空间（workspace_mode）
        └─ 挂载记忆空间（agent_memory_spaces）

3. 团队（team）
   ├─ 成员管理（team_members）
   ├─ Agents 管理（team_agents）→ Agent 详情：
   │     ├─ 基础（名称/描述/类型/角色）
   │     ├─ 执行环境（network_policy/approval_mode）
   │     ├─ 绑定（skill/知识库/MCP）
   │     └─ API（surface.tool + surface.api）
   ├─ 工具权限 / 运行基线（新，渐进授信）

4. 记忆空间（memory-spaces）                 ← 新独立模块
   ├─ 空间列表（按 owner 维度过滤）
   └─ 空间详情（内容 + Brain 域 + 质量指标）

5. 资产（assets）
   ├─ Wiki 知识库（wiki）
   ├─ 代码 / CodeGraph / 代码分析（code/analysis）
   └─ Skill 技能（skills）
   └─ Chat_Memory（memory，保留为空间内容查看）

6. 设置（settings，头部下拉）
   ├─ API Keys / 用户管理 / 模型配置
```

## 3. 路由表（新旧映射）

| 旧路由 | 新路由 | 说明 |
|---|---|---|
| `/` | `/` | 工作台概览 |
| `/projects` | `/projects` + `/projects/:id` | 项目列表 + 详情 tabs |
| `/team/agents` | `/team/agents` + `/team/agents/:id` | Agent 列表 + 详情 tabs |
| `/memory` | `/memory`（保留） | Chat_Memory 内容查看 |
| — | `/memory-spaces` + `/memory-spaces/:spaceId` | 记忆空间（新） |
| `/wiki` `/code` `/skills` `/analysis` | 不变 | 归入「资产」组 |
| `/graph` → `/analysis` | 保留兼容重定向 | 旧链接 |

## 4. 关键状态机

- 导航 activePage：沿用现有 `PageId` 状态机（PATH_TO_PAGE ↔ PAGE_TO_PATH），新增 PageId 加入映射即可。
- 无新业务状态机（骨架阶段）。

## 5. 风险

| # | 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|---|
| R1 | 大改导航，存量用户迷路 | 学习成本、投诉 | 高 | 保留旧路由重定向 + 引导提示；分组标题用 i18n 明确 |
| R2 | 页面骨架「点了没数据」 | 观感空洞、被误判为未完成 | 高 | 统一空态组件 + 明确「骨架阶段」标注 |
| R3 | tea-component 主题与自定义 tokens 冲突 | 视觉不统一 | 中 | tokens 以 tea 的 CSS var 为基底覆盖，不全盘替换 |
| R4 | 长期债务：骨架先行、数据后接导致重复返工 | 后续接数据时重写 | 中 | 前端类型/API 契约先定义好，接数据时只填实现 |
| R5 | 解禁 ConsoleLayout 引发回归 | 旧功能（TabBar/引导/角色过滤）破坏 | 中 | 逐项 UAT-6 + 保留 legacyHashToPath |

## 6. 不在范围

- 后端数据模型迁移（协作项目/决策/OKR/交付物/agent 配置字段）—— 后续 change
- 算法实现（A1–A21 召回/评测/dreaming）—— 后续 change
- Playbook 沉淀链接线（断点①）—— 后续 change

---

## 9. 架构沉淀建议（供 A-evolve · 软约束）

### 9.2 新增/改变的项目级技术决策

| 决策 | 取值 | 影响范围 | 推翻代价 |
|---|---|---|---|
| design tokens 集中化 | CSS variables + `src/theme/tokens.ts` | 全局视觉 | 低（渐进迁移） |
| 导航分组模型 | 6 组（工作台/协作项目/团队/记忆空间/资产/设置） | 全局导航 | 中（需同步 menu/routes/TabBar/i18n） |

### 9.5 禁动清单变化

- 解禁：`ConsoleLayout.tsx`、`routes/index.tsx`、`constants/menu.tsx`（本 change 合法触碰，D1 已批准）
- 新增禁动：`src/theme/tokens.ts`（tokens 定义完成后，组件不得绕过 tokens 直接写内联颜色）

---

> 本文件不包含完整代码实现。函数签名、伪代码、接口定义可以；函数体不行。
