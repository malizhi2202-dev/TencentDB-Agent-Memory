# 产品文档与原型验证记录

验证对象：`.specs/enterprise-agent-memory-product/PRODUCT-DESIGN.html`
（单文件离线产品设计文档 + 界面原型，v0.2 · 2026-09-21 · change-id `enterprise-agent-memory-product`）

本文件记录**实际执行过的**验证及其结果，并明确区分「脚本已验证」「人工已验证」「尚未验证」三类结论。未执行的验证一律不写成通过。

参考模板：`/home/malizhi/go/src/goweb_log_collection/client/web/public/docs/product-design.html`。
模板 CSS / sprite / 脚本为按模板结构的合法复用；设计令牌按本产品 `UI-DESIGN.md` 的调色板覆盖（品牌 `oklch(0.62 0.19 255)`、底色 `oklch(0.985 0.008 250)`、暗色为纯黑）。

---

## 1. 交付物

| 产物 | 说明 |
|---|---|
| `PRODUCT-DESIGN.html` | 单文件离线文档，444,800 字节 / 4,353 行，零外部依赖。11 个章节（§0–§10）+ 13 屏界面原型 |
| `_build/` | 可复现装配脚手架：`build.sh` 拼接片段、`check.sh` 执行自检；`CONTRACT.md` 为唯一对齐契约 |
| `_facts/` | 五份议题蒸馏稿 + 模板解剖稿，文档内容的事实来源 |
| `product-prototype.html` | **保留未删**（41,149 字节）。早期 hash-router 单页原型，由本文档取代，仅作历史对照 |

## 2. 结构自检（脚本，全部通过）

`bash _build/build.sh && bash _build/check.sh` → **自检通过**：

| 检查项 | 结果 |
|---|---|
| 外部资源引用（`src`/`href` 指向 `//`） | 0 |
| CSS `@import` / 远程 `url()` | 0 |
| 图片引用（`<img>` / 位图扩展名） | 0 |
| emoji（U+1F300–1FAFF / 2600–27BF / FE0F） | 0 |
| 章节 `#s0`–`#s10` | 11/11 存在 |
| 小节锚点 `s2-1..s2-6` / `s5-1..s5-19` / `p1..p13` | 全部存在 |
| 左侧目录锚点完整性 | 无断链 |
| 内联 JS（`node --check`） | 通过 |
| 占位文本 | 0 |
| 原型侧栏一致性 | 12 屏同一侧栏 / 20 条目 |
| 侧栏裁切回归（`override.css`） | 已解除固定高度 |
| 结构统计 | `.proto` 13 屏、`.app` 骨架 12 个、演示数据标识 37 处、待确认/暂缓标记 70 处 |

## 3. 全文档 HTML 结构验证（脚本，通过）

用 `html.parser` 对整份文档做标签配平与嵌套校验：

- 标签错配错误：**0**
- 文件结束时未闭合标签：**无**
- 结果：**BALANCED**

## 4. 跨章节一致性验证（脚本，通过）

本次改动中风险最高的部分：三处权限矩阵必须完全一致。

| 比对 | 行集合 | 行序 | 可见性符号 |
|---|---|---|---|
| §5.0（指南总览） vs §7.1（权限矩阵） | 一致（16 行） | 一致 | 0 处差异 |
| §7.1 vs 原型 `p12` 权限矩阵屏 | 一致（16 行） | —（p12 按侧栏四域分组，属 UI 呈现） | 0 处差异 |

结论：**§5.0 ≡ §7.1 ≡ p12，16 模块 × 8 角色逐格一致**。
图例统一 ● 可操作 / ○ 只可见 / — 不可见；角色顺序统一为
`member / team-owner / project-admin / knowledge-owner / agent-admin / governance / auditor / platform-admin`。

侧栏导航一致性（`check.sh` 第 10 项 + 独立脚本）：

- 12 屏 `.app-side` 去 `class="active"` 后**字节级相同**（归一化哈希唯一）。
- 每屏 **20 个条目**（19 导航项 + 退出登录）、4 个分组标题。
- 19 条路由各出现 12 次，逐条匹配契约 §3 的 URL 列：
  `#/home`、`#/projects`、`#/project/p-db`、`#/agent/a-retriever`、`#/memory`、`#/memory/spaces`、`#/library`、`#/knowledge`、`#/scenario/cs-2201`、`#/ingestion/import`、`#/ingestion/triage`、`#/changes`、`#/governance/lineage`、`#/governance/cleanup`、`#/reports`、`#/team`、`#/settings`、`#/permissions`、`#/audit`。
- 每屏 `active` 落点与其屏主题对应（`p5` 任务与运行、`p6` 分诊、`p8` 知识资产、`p10` 清理证据等）。
- §5 的入口路径使用更深的具体页路由（如 `#/project/p-db/overview`、`#/task/t-104/run/r-83`、`#/knowledge/wiki/k-wiki-connpool`），与侧栏的顶级路由构成层级关系，无冲突。

未新增 CSS 类：全部片段使用的 class 均可在 `template.css` 或 `_build/override.css` 中解析，无未知类名。

## 5. 交互验证（脚本，通过）

原型页签切换依赖 `activateTab()` 按 `bar.parentElement` 划定作用域；若两个页签组共用父容器会互相隐藏面板。用 DOM 树解析逐组验证：

| 组 | 位置 | 按钮 | 父容器内页签组数 | 初始选中 / 初始可见 |
|---|---|---|---|---|
| 1 | `p3` 项目概览 | 7（overview…access） | 1 | `overview` / `overview` |
| 2 | `p5` 运行详情 | 2（r83, r81） | 1 | `r83` / `r83` |
| 3 | `p7` 记忆与空间策略 | 2（items, spaces） | 1 | `items` / `items` |
| 4 | `p8` 知识资产 | 5（wiki, skill, rca, tpl, ctx） | 1 | `wiki` / `wiki` |
| 5 | `p12` 团队·权限·审计 | 3（team, matrix, audit） | 1 | `team` / `team` |

5/5 组：按钮 id 序列与面板 id 序列相同、父容器内只有本组一个页签栏、`aria-selected` 恰好一个 `true` 且为首项、初始恰好一个面板可见。**全部正确，无跨组干扰。**

其余交互钩子存在性均已核对：主题切换 `#theme-toggle` + `#theme-label` + `localStorage['eam-theme']`、
目录高亮 `IntersectionObserver`、`@media print` 打印样式（2 处，含暗色强制转浅底）。

## 6. 本次修复的三处缺陷（均已复验）

1. **原型侧栏底部被裁切（阻断级）**
   `template.css` 的 `.app` 固定 560px、`.app.tall` 固定 640px，且 `.app-side` 为 `overflow:hidden`；
   而契约要求侧栏逐字复刻 19 项 + 4 分组标题，实测内容高约 **844px** → 桌面端静默裁掉底部约 6 项
   （设置 / 权限矩阵 / 审计 / 退出登录等）且**不可达**。
   修复：`override.css` 增加 `@media (min-width:1001px)` 规则，把 `.app`/`.app.tall` 改为内容自适应高度、
   解除 `.app-side`/`.app-main`/`.app-body` 的 `overflow:hidden`。作用域限定 >1000px，
   ≤1000px 的横排侧栏与横向滚动仍由模板媒体查询负责。`check.sh` 已加回归守卫。

2. **§7.1 与 §5.0 矩阵矛盾（一致性级）**
   `sec7.html` 自行多出一行「资源库」（17 行）并按四域重排行序，而契约矩阵与 `sec5.html` §5.0 均为
   16 行、按契约顺序，并把「资源库」明确声明为非矩阵单列项（授权后的跨类型发现页，只跳转不编辑，
   可见性沿用「知识资产」行）。修复：§7.1 收敛为契约的 16 行与行序，删除多余行，补一段与 §5.0 对齐的
   「行序与范围」说明。

3. **侧栏 `href` 不统一（一致性级）**
   `protoA`/`protoB` 侧栏 `<a>` 无 `href`，`protoC` 有且逐条匹配契约 §3 URL 列。
   修复：以契约 URL 列为准统一补齐，12 屏侧栏现字节级一致。

另修正 `check.sh` 自身两处脚本缺陷：emoji 检查因 `grep -c … || echo 0` 产生 `"0\n0"` 而误报；
`.app` 统计用 `class="app"` 而片段统一写 `class="app tall"` 导致该行恒为 0。

## 7. 人工验证状态（诚实声明）

**尚未由人打开浏览器做视觉与交互确认。** 上述结论全部来自脚本与 DOM 树静态分析，不能替代渲染验证。
下列 UAT 待人工执行：

| 编号 | 步骤 | 预期 |
|---|---|---|
| UAT-01 | 离线双击打开 `PRODUCT-DESIGN.html` | 11 章完整呈现，无外部请求、无样式错乱 |
| UAT-02 | 滚动全文，观察左侧目录 | 高亮随当前小节移动，点击任一条可定位 |
| UAT-03 | 点击右上「暗色」 | 切到纯黑主题；刷新后保持 |
| UAT-04 | 逐屏检查 §6 的 12 个带侧栏原型 | 侧栏 **20 项全部可见可达**，无裁切、无内嵌滚动条 |
| UAT-05 | 点击原型内 5 组页签 | 仅本组面板切换，跨屏互不影响 |
| UAT-06 | 缩窄窗口至 <1000px 再至 <760px | 目录转横向、原型侧栏转横排、表格局部横滚 |
| UAT-07 | `Ctrl/Cmd+P` 预览 | 顶栏与目录隐藏、章节分页、暗色主题转浅底 |
| UAT-08 | 点击原型内任何高风险动作 | 仅显示阻断原因 + 下一门槛 + 责任角色，**无执行入口** |

## 8. 边界与未决事项

本文档与原型使用**合成演示数据**：不连接后端，不执行授权裁决、删除、通知、迁移、Provider 对账或 Agent Run。
第 6 章所有数字、名称、编号与证据行均为虚构。高风险动作一律渲染 `blocked`，并给出「阻断原因 + 下一门槛 + 责任角色」。

文档内以 `chip warn 待确认` 保留来源冲突，**未单方面裁决**：Team↔Project 基数口径
（`final-v1` 1:N 归属 vs `redesign-v3` N:N 关联）、记忆分层 L0/L3 口径、ChangeSet 是否作为知识化统一变更对象、
动作风险 R0–R3 与跨空间 S0–S3 / 证据 E0–E4 与导出 E0–E3 两套同名不同义分级的映射缺失。
Schema、阈值、算法、SLA、责任矩阵、供应商合同与法域模板均标注暂缓。

未修改 `.specs/final-v1/`、`.specs/redesign-v2/`、`.specs/redesign-v3/`、
`.specs/enterprise-agent-memory-platform/` 及任何产品代码。

---

## 附录：历史验证记录（`product-prototype.html`，已被上文取代）

以下为上一轮原型的验证记录，保留以便对照，结论仅适用于 `product-prototype.html`。

### 原型验证记录

本次原型已按用户提供的参考模板重新设计：采用“sticky 顶栏 + 文档侧栏 + 长文档内容 + 内嵌 SVG 架构图 +
文档内可交互工作台”的完整产品设计文档形态；没有复制历史模板业务内容或修改外部文件。

#### 关键验收路径

| 路径 | 预期行为 |
|---|---|
| 文档侧栏 → 核心概念/架构/状态/页面 | 在同一 HTML 内定位完整设计章节 |
| 文档侧栏 → 原型页面 | 逐页定位 Home、Project、Triage、Agent、清理和报告，并在页面说明卡中查看目标、重点信息和安全边界 |
| 原型 → 工作台 | 展示 scope、待分流、清理 unknown、RunGate blocked 和证据 |
| 原型 → Project | 展示 Project → Task/Run、revision、验收与证据 |
| 原型 → Triage | 展示归属候选、置信度、敏感性、血缘和目标 |
| 原型 → Agent | 展示 view/use/write、ToolPolicy、RunGate、Vault reference |
| 原型 → 清理证据 | 展示 verified/retained/unknown/blocked 的范围与下一门槛 |
| 原型 → 报告中心 | 展示事实内核、受众投影、Delivery Intent、修订与 unknown |

#### 静态验证

- 单文件离线 HTML，未引用外部脚本、样式、字体、图片或网络资源。
- 内嵌 JavaScript 已提取并通过 `node --check`。
- 内嵌 SVG 架构图包含分层架构、权限/RunGate 和 CopyInventory 清理闭包。
- `git diff --check` 通过。

#### 手动 UAT

- `UAT-01`：打开 HTML，使用侧栏定位产品概念、架构图、状态矩阵和页面设计。
- `UAT-02`：从 HTML 左侧“原型页面”逐项打开 Home、Project、Triage、Agent、清理、报告的说明锚点，再在原型工作台切换对应视图，确认每个页面都有具体内容、目标问题和边界解释。
- `UAT-03`：切换暗色主题，刷新后主题保持。
- `UAT-04`：缩窄窗口，确认文档侧栏变为横向导航、内容单列、表格/图局部滚动。
- `UAT-05`：点击原型高风险按钮，确认只提示阻断/门槛，不执行删除、通知、迁移或 Agent Run。

#### 边界

这是使用合成样例数据的只读产品原型：可以检查文档、架构图、概念模型和界面状态；不连接真实后端，不执行真实授权裁决、删除、通知、迁移、Provider 对账或 Agent Run。历史 `.specs/final-v1`、`.specs/redesign-v2`、`.specs/redesign-v3` 未修改。

#### 详细设计产物

- `CONCEPTS.md`：产品概念、角色、核心不变量、端到端流程、状态矩阵和页面细节。
- `ARCHITECTURE.md`：分层架构、权限/执行流、Copy Inventory 清理闭包、事件边界和架构决策；包含 Mermaid 架构图，可在支持 Mermaid 的 Markdown 查看器中渲染。
- `product-prototype.html` 首页提供概念链路和两个详细设计文档入口；原型中所有主要信息架构入口均有独立内容，不再使用统一空白占位页。
