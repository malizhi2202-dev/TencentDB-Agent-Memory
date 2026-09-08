---
name: TencentDB Agent 协作平台
description: 极简工程师工具 —— 单一腾讯蓝品牌色 + 净冷中性 + 高信息密度 + 克制阴影，像 Linear/Vercel 而不是营销落地页。

# 所有颜色用 OKLCH。落地时别名到 tea-component 的 --tea-color-*（见 §0.3 应用策略）。
colors:
  brand: "oklch(0.55 0.19 255)"          # 腾讯蓝（品牌色，覆盖 --tea-color-bg-brand-default）
  brand-deep: "oklch(0.47 0.19 255)"     # hover / active
  bg: "oklch(0.975 0.004 250)"           # 主背景（近白带冷色温，不用纯白）
  surface: "oklch(0.995 0.002 250)"      # 卡片 / 提升表面
  text-primary: "oklch(0.22 0.01 255)"   # 主文字（近黑带蓝灰）
  text-secondary: "oklch(0.45 0.01 255)"
  text-tertiary: "oklch(0.60 0.01 255)"
  border: "oklch(0.90 0.006 255)"        # hairline 1px

typography:
  display:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.5rem, 2.5vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
    italic: false
  headline:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  body-lead:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  supporting:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontWeight: 500
    textTransform: none
    letterSpacing: "0"
  mono:
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"

rounded:
  none: "0"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"

motion:
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-out-quint: "cubic-bezier(0.22, 1, 0.36, 1)"
  duration-fast: "120ms"
  duration-base: "200ms"
  duration-slow: "400ms"

shadow:
  hover-lift: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px -2px rgba(0,0,0,0.08)"
  card-lifted: "0 4px 16px -4px rgba(0,0,0,0.10)"
  accent-glow: "none"    # 极简不用 glow
---

# UI Design: TencentDB Agent 协作平台

## 0. 视觉语汇对齐（brownfield）

### 0.1 观察报告（代码为源）

- **Token 源**：`src/index.css` 的 `:root`（Tailwind 语义色 → `--tea-color-*` 桥接）+ `src/tea-override.css`；无 OKLCH、无独立调性定义。
- **主色**：`--tea-color-bg-brand-default`（腾讯云蓝），用于按钮/高亮/链接；全项目单一品牌色，无第二 hue。
- **中性色**：`--tea-color-bg-primary-default` / `--tea-color-bg-page-default` / `--tea-color-text-primary/secondary`（Tea 默认灰，未显式含 chroma）。
- **hover/focus**：tea-component 内置（品牌色变深 + focus ring），未统一自定义。
- **动效语言**：tea-component 默认过渡，无项目级缓动规范。
- **elevation**：tea 默认阴影，层级不统一。
- **卡片密度/rounded**：tea 默认（小圆角），页面内边距散落于各组件 `.css`（`asset-list-panel.css`、`allocate-dialog.css` 等）。
- **图标库**：`tea-icons-react`（size 16，见 `constants/menu.tsx`）。
- **文案调性**：工程向（菜单「任务看板」「Agents 管理」「Chat_Memory」）。

### 0.2 用户校准结论

- 用户反馈「页面可真怪」→ 根因：Tea 默认皮肤 + 各组件散落内联样式，无统一调性、无集中 tokens。

### 0.3 应用策略（用户拍板：保持现有风格）

- **沿用（核心）**：tea-component 组件体系 + `tea-icons-react` + 腾讯蓝品牌色 + 现有字体栈 + 现有 `--tea-color-*` token —— **视觉保持现状，不重建 tokens、不换字体、不改品牌色**。
- **收敛（唯一视觉动作）**：把散落的内联样式/独立 `.css` 统一收口到现有 `--tea-color-*` token 别名，消除「各页样式不一」，**不引入新色值、不引入 OKLCH 强制迁移**。
- **重设计（本次重点）**：**页面布局 / 信息架构** —— 导航 6 组重组、核心页面区块与栅格重排（见新增 §11 布局重设计），视觉皮肤不动。

## 1. 美学北极星

> **保持现有极简皮肤，重做布局** —— 视觉上延续现有 tea-component + 腾讯蓝 + 中性灰（用户明确「保持现在的风格」），把力气全花在**页面布局与信息架构**上：导航从「知识管理」重组为「Agent 协作平台」六组，核心页面按「左导航 → 主区 + 上下文侧栏」的高信息密度栅格重排。视觉像现在，结构像 Linear。

### v0 确认摸路

- **已确认假设**（用户已拍板）：调性 **2 极简**；**保持现有风格**（不改颜色/字体/品牌色）；**重新设计页面布局**（信息架构 + 页面区块）。
- **用户指出偏差**：早期我按「重建视觉 tokens」起草 → 用户纠偏「保持现在的风格」，已把 UI-DESIGN 从「视觉重建」扭转为「布局重设计 + 视觉收敛」。

## 2. 4 个决策问题

- **目的**：给工程师/运维的 Agent 协作平台（协作项目 / team / agent / 记忆空间），核心动作是「管理、配置、看指标」。
- **调性**：**极简（Minimal）**（0.6 推荐默认，待用户确认）
  - **理由**：技术工具 B2B、高频专注使用，Linear/Vercel 的「单色 + 几何字 + 留白」最能容纳复杂的项目/agent/记忆结构而不显乱。
- **约束**：tea-component 体系 + hash router + i18n；性能 LCP ≤ 2.5s；焦点可见。
- **差异化**：把「记忆内核真实算出来的指标（召回/质量/评测）」用等宽字体 + 数据密度呈现——工程师的「记忆仪表盘」，而不是又一套 SaaS 后台。

## 3. 颜色系统

### Primary

- **腾讯蓝** `oklch(0.55 0.19 255)`：用于主按钮、选中态、链接、focus ring。**绝不用于**大块背景填充（保持留白）。

### Neutral

- **bg** `oklch(0.975 0.004 250)`：页面主背景，近白带冷色温（不与纯白卡片混）。
- **surface** `oklch(0.995 0.002 250)`：卡片/面板。
- **text-primary** `oklch(0.22 0.01 255)`：主文字。
- **border** `oklch(0.90 0.006 255)`：hairline 边框（替代重阴影）。

### 命名规则

- **The One Voice Rule**：全项目只有一个 hue（腾讯蓝），语义色（success/warning/destructive）仅用 tea 语义 token，不引入新主色。
- **The Tinted Neutral Rule**：所有中性色 chroma 控制在 ≤ 0.01，避免纯灰。

## 4. 字体系统

- **Display/Headline/Body**：**Inter**（几何无衬线，Linear/Vercel 同款）。**为什么不用衬线**：工程师工具要中性、可扫读，衬线（编辑式）不适合 dashboard。
- **Mono**：**JetBrains Mono**（记忆内容、召回结果、指标、ID、SQL 标识符）。**为什么**：等宽字让「数据」可对齐、可读，是「记忆仪表盘」的关键。

### 层次表

| 角色 | 字体 | 字号 | 字重 | 行高 | 备注 |
|---|---|---|---|---|---|
| Display | Inter | clamp(1.5–2rem) | 600 | 1.2 | 页面大标题 |
| Headline | Inter | 1.125rem | 600 | 1.3 | section 标题 |
| Title | Inter | 0.9375rem | 600 | 1.4 | 卡片标题 |
| Body | Inter | 0.875rem | 400 | 1.6 | 正文 |
| Supporting | Inter | 0.8125rem | 400 | 1.5 | 辅助说明 |
| Mono | JetBrains Mono | 0.8125rem | 400 | 1.5 | 记忆/指标/ID |

## 5. 间距 & 圆角 & 动效

按 frontmatter 落实。**禁止**在 token 之外引入新数值。圆角统一 `sm(4px)/md(6px)/lg(8px)`，不用大圆角（极简）。

## 6. 关键组件规约

### Button (Primary)

- **形状**：rounded `6px`
- **背景**：`brand`，hover 用 `brand-deep`
- **文字**：`surface`（白字），Title 字重 500
- **内边距**：`sm 8px` 垂直 / `md 16px` 水平
- **at rest**：无阴影、无边框
- **hover**：`brand → brand-deep`，120ms ease-out
- **focus**：2px `brand` focus ring（tea 默认 ring 覆盖）

### Button (Secondary)

本项目无 secondary button 填充；次级动作用 inline link（品牌蓝文字）或 ghost（hairline 边框 + 中性文字）表达。

### Input / Field

- **at rest**：`border` hairline 1px + `surface` 背景 + `md 16px` 内边距
- **focus**：`border → brand`，无 backdrop glow
- **error**：tea `destructive` 语义色 + 文字说明（不用图标堆砌）

### Card / Container

- **at rest**：`surface` 平面 + `border` hairline 边框（**不用重阴影**）
- **hover**：仅列表可交互卡片给 `hover-lift` 微阴影
- **嵌套规则**：禁止 card 套 card（层级用 hairline 分隔，不用嵌套阴影）

### Navigation

- **侧边栏**：宽度 232px，分组标题 `supporting` 字号 + `text-tertiary`，选中项 `brand` 文字 + `brand` 6% 淡背景（非实心蓝块），hover 中性淡背景。

### Typography Hierarchy

见 §4 层次表。

## 7. Do's and Don'ts

### Do

- 用 hairline 边框分隔，不用阴影
- 记忆/指标/ID 用 mono 字体
- 品牌蓝只用于「动作 + 选中态」
- 数据密度高时用「表格 + 紧凑间距」

### Don't

- ❌ 不引入第二 hue（渐变、紫色、绿色装饰一律禁止，语义色除外）
- ❌ 不用 emoji 作图标（🚀⚡✨）
- ❌ 不用大圆角 + 弹动动画（玩具调）
- ❌ 不用大面积品牌蓝背景填充（保持留白）
- ❌ 不堆多层阴影做「质感」

## 8. 占位符策略（反伪造）

| 缺的东西 | 本项目有什么？ | 缺时用什么占位 | 禁什么 |
|---|---|---|---|
| 图标 | `tea-icons-react` | 对应语义图标（无则几何 `▢`） | emoji |
| 头像 | 无 | 首字母圆 + 品牌蓝淡背景 | AI 生人脸 |
| 图片 | 无 Image 组件 | aspect-ratio 卡片标 `16:9 image` | stock/AI 图 |
| 数据 | 内核真实接口（未接则空态） | 「暂无数据」空态组件 | 编召回率/指标数 |
| logo | 无品牌 logo | 「TDAI」文字标签 | AI 自绘图形标 |
| KPI/指标 | 内核未接 | 标 `[awaits real metric]` | 编数字 |

## 9. 反 AI-slop 自检结果

- [x] 字体类禁忌：未命中（Inter + JetBrains Mono，非 AI 网红字体）
- [x] 颜色类禁忌：未命中（单一 hue，无紫绿渐变）
- [x] 阴影类禁忌：未命中（hairline 为主，阴影克制）
- [x] 边框类禁忌：未命中（hairline 语义统一）
- [x] 动效类禁忌：未命中（120/200/400ms，无弹动）
- [x] 布局类禁忌：未命中（高信息密度表格化）
- [x] 文案类禁忌：未命中（工程向，无营销腔）
- [x] 组件类禁忌：未命中（无玻璃拟态/渐变卡）

## 10. 触发任务

下一步进入 `3-task`，第一批 UI 任务：

- T-UI-01：`src/theme/tokens.ts` → CSS variables 物化本 frontmatter（别名到 tea token）
- T-UI-02：typography 层次落地 global stylesheet（Inter + JetBrains Mono 引入）
- T-UI-03：导航 6 组结构落地（menu.tsx / routes / ConsoleLayout）
- T-UI-04：Card 组件规约落地（hairline 替代散乱阴影）
- T-UI-05：空态组件 + 占位符策略落地

---

## 11. 页面布局重设计（本次核心 · 用户拍板「重新设计布局 + 保持风格」）

> 视觉皮肤保持现有，以下全部是**结构/布局**改动。所有线框沿用现有 tea 组件，不动颜色字体。

### 11.1 全局布局框架（不变的部分 + 变的部分）

```
┌────────────────────────────────────────────────────────────┐
│ GlobalHeader（保持：品牌 + TeamSwitcher + 用户菜单）         │
├──────────────┬─────────────────────────────────────────────┤
│ Sider（变）   │ TabBar（变：随新 6 组 PageId）               │
│              ├─────────────────────────────────────────────┤
│ 工作台         │ 主内容区（Outlet）                          │
│ 协作项目      │                                              │
│ 团队          │   页面布局见下 —— 统一「左主区 + 右上下文栏」   │
│ 记忆空间      │   高信息密度栅格，不用全宽容器                 │
│ 资产          │                                              │
│ 设置(头部)    │                                              │
└──────────────┴─────────────────────────────────────────────┘
```

- **不变**：GlobalHeader、Sider+LContent 骨架、hash router、tea 视觉。
- **变**：Sider 分组从 4 组 → 6 组；TabBar 承载新 PageId；主区从「全宽单列」改为「左主区 + 右上下文栏」双列栅格。

### 11.2 首页 · 工作台概览（替换当前「任务看板 + 记忆能力面板」的堆叠）

```
┌──────────────────────────────────────────────────────────┐
│ 概览栏：问候 + [新建项目] [新建 Agent] [导入知识] 快捷入口    │
├───────────────────────────────┬──────────────────────────┤
│ 左主区（约 2/3）                │ 右上下文栏（约 1/3）        │
│ ┌ 我的任务（列表/看板切换）┐    │ ┌ 最近协作动态 feed        │
│ └───────────────────┘    │    │ └──────────────────────┘ │
│ ┌ 最近项目（卡片横向）──────┐    │ ┌ 记忆空间健康（统计条）    │
│ └───────────────────┘    │    │ └──────────────────────┘ │
│ ┌ 最近 Agent 活动（时间线）┐    │ ┌ 待处理决策 / 审批         │
│ └───────────────────┘    │    │ └──────────────────────┘ │
└──────────────────────────────┴──────────────────────────┘
```

- 「记忆能力面板」**吸收进右上下文栏的「记忆空间健康」**，不再作为孤立的 5-tab 面板盖在页顶。

### 11.3 协作项目详情（替换当前扁平 projects 列表）

```
┌──────────────────────────────────────────────────────────┐
│ 项目头部：名称 | 状态 | 成员 chip | 挂载记忆空间 chip | 抓手  │
├──────────────────────────────────────────────────────────┤
│ TabBar：任务拆解 | 交付物 | 决策 | OKR | 规约心智 | 工作空间 | 记忆空间 │
├──────────────────────────────────────────────────────────┤
│ 当前 tab 内容区（三态：列表 / 看板 / 表格）                  │
│  - 任务拆解：任务列表 + 步骤（scene_steps）                  │
│  - 交付物：列表 + review 门状态                             │
│  - 决策：DecisionRecord（context+proposal+outcome）         │
│  - OKR：目标 + 关键结果                                     │
│  - 规约心智：mindset 文档                                   │
│  - 记忆空间：挂载的空间 chip（owner×Brain 域）               │
└──────────────────────────────────────────────────────────┘
```

### 11.4 Agent 详情（替换当前单页字段列表）

```
┌──────────────────────────────────────────────────────────┐
│ Agent 头部：名称 | 类型/角色 | 可见性 | 状态 | 描述            │
├───────────────┬──────────────────────────────────────────┤
│ 左 tab（竖排） │ 配置区（当前 tab）                         │
│ 基础           │ 基础：名称/描述/类型/角色/角色设定(persona)    │
│ 执行环境      │ 执行环境：network_policy | approval_mode      │
│ 绑定           │ 绑定：skill / 知识库 / MCP 绑定列表          │
│ API           │ API：surface.tool + surface.api 双通道开关    │
└───────────────┴──────────────────────────────────────────┘
```

### 11.5 记忆空间（新独立模块）

```
┌──────────────────────────────────────────────────────────┐
│ 过滤栏：owner 维度（team / project / agent / user）下拉      │
├────────────────────────┬─────────────────────────────────┤
│ 左：空间列表            │ 右：空间详情                        │
│ - sp_xxx · agent ·     │ 头部：Brain 域 chip + 写入策略       │
│   episodic             │ 内容：L0-L3 记忆块（mono 展示）      │
│ - sp_yyy · team ·      │ 质量：召回 / 冲突 / 低价值指标        │
│   semantic             │ 挂载：被哪些 agent 引用              │
└────────────────────────┴─────────────────────────────────┘
```

### 11.6 布局原则（本次统一执行）

- **双列栅格优先**：列表/详情类页面默认「左主区 + 右上下文栏」，避免全宽堆叠。
- **头部 + TabBar + 内容区**：详情类页面统一「头部（身份 + 关键 chip）→ TabBar（子能力）→ 内容区」三段，替代当前散落的卡片堆。
- **上下文栏收敛杂项**：把「统计、动态、审批、健康」这类辅助信息收进右侧 context 栏，主区只放核心工作流。
- **信息密度**：记忆/召回/指标/ID 一律 mono 字体 + 表格，走「工程师仪表盘」而非「营销卡片」。

### 11.7 布局重设计后，视觉自检（保持风格的验收）

- [ ] 颜色/字体/品牌色与现有 tea 一致（未引入新 hue、未换字体）
- [ ] 散落内联样式已收口到 `--tea-color-*` 别名
- [ ] 新页面遵循「三段式」「双列栅格」，不再是旧式全宽堆叠
- [ ] 旧路由兼容重定向不回归
