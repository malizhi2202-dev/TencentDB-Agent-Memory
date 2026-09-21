# BUILD CONTRACT — Enterprise Agent Memory Platform 单文件产品设计文档

> 本文件是并行构建的**唯一对齐契约**。所有参与构建的 agent 必须遵守；文档内任何事实若与本契约冲突，以本契约 + 各议题 digest 为准。

## 0. 交付物

- 最终产物：`/home/malizhi/project/TencentDB-Agent-Memory/.specs/enterprise-agent-memory-product/PRODUCT-DESIGN.html`
- 形态：**单文件 HTML**，`lang="zh-CN"`，UTF-8，浏览器双击直接打开。九段制：§0 怎么读 / §1 产品全景 / §2 核心概念 / §3 系统架构 / §4 核心时序 / §5 使用指南 / §6 界面原型 / §7 角色权限矩阵 / §8 术语表 / §9 常见问题 / §10 附录。
- 参考模板：`/home/malizhi/go/src/goweb_log_collection/client/web/public/docs/product-design.html`（样式词汇与骨架已抽取到 `_build/template.css`、`_build/template-sprite.html`、`_build/template-script.js`）。

## 1. 硬性红线（违反即返工）

1. **零外部依赖**：不得出现任何 `http://`、`https://`、`//cdn`、外链字体/图片/脚本/样式。图标只用内联 SVG `<use href="#i-xxx">` 或文本符号。**禁止 emoji**。
2. **禁止图片文件**；图表用内联 SVG 或 CSS 布局。
3. **文案全中文**（术语保留英文原词，如 Work Thread、RunGate、CopyInventory），工程化、中性、克制；禁止营销话术（"赋能/一站式/极致/颠覆"）。
4. **所有原型数据是虚构演示数据**，页面内必须出现"演示数据"标识；禁止出现真实客户名、真实 KPI、API Key 明文、真实人员姓名（用"林工"这类虚构称呼）。
5. **只写文档里真实存在的事实**；不确定的写"待确认"或"暂缓"，**禁止编造结论**。
6. 不修改 `.specs/final-v1/`、`.specs/redesign-v2/`、`.specs/redesign-v3/`、`.specs/enterprise-agent-memory-platform/` 任何文件，也不修改产品代码。

## 2. CSS / 类名契约（只允许用这些类）

样式表已经写好，**不要新增 `<style>` 块，不要用行内 `style=` 做视觉设计**（仅允许 `style="margin-top:var(--space-md)"` 这类间距微调，且尽量少）。

文档侧：

| 类 | 用途 |
|---|---|
| `section.doc-sec` + `id` | 每个一级章节 |
| `h2` / `h3` / `h4` / `h5` | 章节标题（`h3` 必须带锚点 id） |
| `p.lead` | 章首导语 |
| `p.muted` / `.small` / `.tiny` / `.mono` | 弱化、小字、等宽 |
| `.callout` / `.callout.warn` / `.callout.danger` | 提示条（`<h5>` 标题 + `<p class="small">` 正文） |
| `table.tbl` / `table.tbl.compact` | 表格（`th` 可加 `class="mono"`） |
| `table.tbl tr.grp-row td` | 表格分组行 |
| `.grid.g2` / `.g3` / `.g4` | 卡片网格 |
| `.card` / `.card.pad-lg` / `.panel` / `.panel-title` | 卡片 / 面板 |
| `.chip` + `.ok` / `.warn` / `.danger` / `.brand` / `.mono` | 状态胶囊 |
| `.kv` + `dt`/`dd` | 键值对 |
| `.metric` + `.metric-label` | 数字指标 |
| `.diagram` / `.layer` / `.layer.brand` / `.layer h5` / `.layer .row` / `.pill` / `.pill.mono` | 分层架构图 |
| `.node` / `.flow` + `.step` + `.to` / `.arrow-v` | 拓扑节点 / 流程链 |
| `.seq-wrap` + `table.seq` | 时序表（结构见模板 §4） |
| `.split` | 两列 |
| `.btn` / `.btn.primary` / `.btn.sm` / `.btn.link` | 按钮（原型内为静态展示） |
| `.tabs` + `button[data-tab]` + `.tabpanel[data-panel]` | 页签（JS 已支持，需包裹在 `[data-tabs]` 容器内） |
| `.proto` / `.proto-bar` / `.proto-bar .dots` / `.url` / `.fake` / `.proto-note` | 原型外框 |
| `.app` / `.app.tall` / `.app-side` / `.app-brand` / `.nav-grp` / `.app-main` / `.app-top` / `.crumb` / `.right` / `.app-body` / `.app-body.flush` / `.spacer` | 应用骨架 |
| `.field` / `.label` / `.input` / `.input.mono` / `.input.placeholder` / `.select` / `.rows` | 表单控件 |
| `.h1` / `.h2p` | 应用内标题 |
| `.progress` + `<i>` | 进度条 |
| `.logview` + `.lv-err` / `.lv-warn` / `.lv-info` / `.lv-dim` | 等宽日志窗 |
| `figure` / `figcaption` | 图注 |
| `footer.doc-foot` | 文档页脚 |

图标 sprite 可用的 id：`i-chat i-grid i-folder i-scene i-download i-gear i-shield i-audit i-search i-flow i-pin i-cpu i-plus i-refresh i-check i-x i-trash i-chev`。用法：`<svg class="icon"><use href="#i-shield"/></svg>`。

## 3. 产品信息架构（导航为唯一事实源）

侧栏四级分组，应用内每一屏的 `.app-side` 必须与下表**逐字一致**（仅 `class="active"` 位置不同）：

```
<div class="app-brand"><i>am</i><span>Agent Memory</span></div>

<div class="nav-grp">工作</div>
  <a>…工作台</a>          #/home
  <a>…项目</a>            #/projects
  <a>…任务与运行</a>       #/project/p-db
  <a>…Agent</a>           #/agent/a-retriever

<div class="nav-grp">知识与复用</div>
  <a>…记忆</a>            #/memory
  <a>…空间与策略</a>       #/memory/spaces
  <a>…资源库</a>           #/library
  <a>…知识资产</a>         #/knowledge
  <a>…代码场景</a>         #/scenario/cs-2201

<div class="nav-grp">输入与治理</div>
  <a>…导入</a>            #/ingestion/import
  <a>…分诊</a>            #/ingestion/triage
  <a>…变更与发布</a>       #/changes
  <a>…血缘</a>            #/governance/lineage
  <a>…清理证据</a>         #/governance/cleanup
  <a>…报告中心</a>         #/reports

<div class="nav-grp">组织与平台</div>
  <a>…团队</a>            #/team
  <a>…设置</a>            #/settings
  <a>…权限矩阵</a>         #/permissions
  <a>…审计</a>            #/audit

<div class="spacer"></div>
  <a>退出登录</a>
```

侧栏图标固定：工作台 `i-grid`、项目 `i-folder`、任务与运行 `i-flow`、Agent `i-cpu`、记忆 `i-pin`、空间与策略 `i-layer`→用 `i-shield`、资源库 `i-download`、知识资产 `i-audit`、代码场景 `i-scene`、导入 `i-plus`、分诊 `i-search`、变更与发布 `i-check`、血缘 `i-flow`、清理证据 `i-trash`、报告中心 `i-chat`、团队 `i-shield`、设置 `i-gear`、权限矩阵 `i-shield`、审计 `i-audit`。

## 4. 角色（§5.0 与 §7 必须与此一致，一个不多一个不少）

| 代号 | 角色 | 核心职责 | 明确不具备的能力 |
|---|---|---|---|
| `member` | 成员（User） | 查看自己的工作现场、记忆、任务与待办 | Team/Project 管理、跨空间发布 |
| `team-owner` | Team Owner | 管成员、Team 共享资源，拥有 Project | Platform 公共目录、任意资源 CRUD |
| `project-admin` | Project Admin | 管 Project 成员、Task、上下文与资源 | 放宽 Team/Platform 策略 |
| `knowledge-owner` | Memory/Knowledge Owner | 分流、脱敏、审核、发布知识 | 直接跨租户执行 |
| `agent-admin` | Agent Admin | 配 Agent、工具、技能、记忆关联 | 回显秘密、绕过 RunGate |
| `governance` | Governance/Security | 审查权限、撤回、清理、报告 | 代替法务作法律结论 |
| `auditor` | Auditor/Legal | 查看授权范围内事实与证据 | 修改事实、自动批准删除 |
| `platform-admin` | Platform Admin | 维护公共 Wiki/Skill/Template 与公共模型配置 | 越过 Team/Project 策略直接读私有内容 |

## 5. 模块 × 角色矩阵（§7 唯一事实源；§5.0 的角色可见性列必须与本表逐行一致）

图例：● 可操作 / ○ 只可见 / — 不可见

| 模块 | member | team-owner | project-admin | knowledge-owner | agent-admin | governance | auditor | platform-admin |
|---|---|---|---|---|---|---|---|---|
| 工作台 | ● | ● | ● | ● | ● | ● | ○ | ● |
| 项目与成员 | ○ | ● | ● | ○ | ○ | ○ | ○ | ○ |
| 任务与运行 | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| Agent 配置 | ○ | ○ | ○ | — | ● | ○ | ○ | ○ |
| 记忆与空间 | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| 导入与分诊 | ○ | ○ | ○ | ● | — | ○ | ○ | — |
| 变更与发布 | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ |
| 知识资产 | ○ | ● | ● | ● | ○ | ○ | ○ | ● |
| 代码场景 | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| 血缘 | ○ | ○ | ○ | ● | ○ | ● | ● | ○ |
| 清理证据 | — | ○ | ○ | ○ | — | ● | ○ | ○ |
| 报告中心 | — | ○ | ○ | ○ | — | ● | ● | ○ |
| 团队 | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| 设置 | ○ | ○ | ○ | ○ | ○ | ○ | — | ● |
| 权限矩阵 | ○ | ○ | ○ | ○ | ○ | ● | ● | ● |
| 审计 | — | ○ | ○ | ○ | — | ● | ● | ● |

## 6. 统一演示数据集（跨屏必须复用同一套名字与编号）

- 平台账号：`admin`（Platform Admin，顶栏显示 `platform-admin · 管理员`）；日常演示登录身份 **`林工（lin.gong）`，角色 member**。
- Team：`team-pay`「支付平台」；成员 6 人。
- Projects：
  - `p-db`「DB-Proxy 可靠性」（owning Team：支付平台，open）
  - `p-gw`「网关可观测性」（owning Team：支付平台，restricted）
  - `p-sync`「数据同步服务」（owning Team：数据平台，open）
- Tasks：`t-104`「修复 DB-Proxy 连接池耗尽」（状态：进行中）、`t-101`「网关错误率归因」（已完成）、`t-118`「同步任务对账失败根因」（待分诊）
- Runs：`r-83`（t-104，Harness=Claude Code，状态 verified）、`r-81`（t-104，失败）、`r-77`（t-101，verified）
- Agents：`a-retriever`「记忆检索助手」、`a-coder`「代码修复 Agent」、`a-reviewer`「变更评审 Agent」
- MemorySpace：`ms-proj-db`（project/p-db）、`ms-team-pay`（team/team-pay）、`ms-user-lin`（user）、`ms-agent-retriever`（agent）
- Memory：`m-9031`（L1 原子，"DB-Proxy 连接池上限 200"）、`m-9044`（L2 场景）、`m-9102`（L3 事实）
- 知识资产：`k-wiki-connpool`（Wiki）、`k-skill-pg-triage`（Skill）、`k-rca-2201`（RCA）、`k-tpl-scene-db`（Template）、`k-ctx-dbproxy`（Code Context）
- 代码场景：`cs-2201`「连接池耗尽导致 DB-Proxy P99 抖动」
- 导入批次：`imp-77`；分诊项：`tri-512`（归属冲突）、`tri-513`（低置信度）
- 变更：`cs-4410`（ChangeSet，待 Review）；清理：`ci-8812`（CopyInventory）；导出：`exp-4411`
- 报告：`rpt-3301`「Provider 副本清理说明（客户版）」；投递：`dlv-902`（delivered）、`dlv-903`（delivery_unknown）
- 证据：`ev-7781`、`ev-7782`；revision：`sha256:9f3c…`（写成 `9f3c7a2` 这类短码即可）
- 时间：统一用 `2026-09-21 14:32` 这类时间戳，别用相对时间。

## 7. 文案与状态口径（不得夸大）

- 状态三元组永不混用：`requested ≠ executed ≠ verified`；`retained ≠ service-visible`；`unknown ≠ zero`；`approved ≠ published`；`Run succeeded ≠ Task accepted`；`owner ≠ visibility ≠ ACL ≠ execution authority`。
- 高风险动作默认 `blocked`，页面显示"阻断原因 + 下一门槛 + 责任角色"，而不是"一键执行"。
- 每个证据卡必须同屏显示：**范围 + 证据时间 + 责任边界 + 下一门槛**。
- 边界态用可区分状态：`loading / empty / filtered-empty / partial / denied / error / offline / stale / success`；禁止一个"暂无数据"覆盖全部。

## 8. 片段产出方式

每个 agent 把自己负责的 HTML 片段**写入独立文件**（不要动最终文件）：

- §3 架构 → `_build/sec3.html`
- §4 时序 → `_build/sec4.html`
- §5 使用指南 → `_build/sec5.html`
- §6 原型 A（6.1–6.4）→ `_build/protoA.html`
- §6 原型 B（6.5–6.8）→ `_build/protoB.html`
- §6 原型 C（6.9–6.13）→ `_build/protoC.html`

片段要求：

1. 文件内容**只有该章节的 HTML**，不含 `<!DOCTYPE>`、`<html>`、`<head>`、`<style>`、`<script>`。
2. §3/§4/§5 以 `<section class="doc-sec" id="s3">` / `id="s4"` / `id="s5"` 开头，以 `</section>` 结尾。
3. §6 的三个片段**不写** `<section>` 外层（由装配脚本包一层 `<section class="doc-sec" id="s6">`），直接以 `<h3 id="p1">6.1 …</h3>` 这类小节开头。
4. 每个 `<h3>` 都要有唯一 id，命名规则：§3 `s3-1…`、§4 `s4-1…`、§5 `s5-1…`、§6 原型 `p1…p13`。
5. 原型屏统一结构：

```html
<h3 id="p2">6.2 工作台</h3>
<p class="proto-note"><span class="chip warn">演示数据</span>一句话说明本屏解决的问题、角色可见性与安全边界。</p>
<div class="proto">
  <div class="proto-bar"><span class="dots"><i></i><i></i><i></i></span><span class="url">#/home</span><span class="fake">演示数据</span></div>
  <div class="app">
    <aside class="app-side"> …第 3 节的导航，注意 active… </aside>
    <div class="app-main">
      <div class="app-top"><span class="crumb">…</span><span class="right">…</span></div>
      <div class="app-body"> …本屏内容… </div>
    </div>
  </div>
</div>
```

6. 缩进、属性引号、标签闭合必须规范；写完后自检：`grep -c 'http' 文件` 必须为 0。

## 9. 事实来源（写内容前必须读，禁止凭印象）

- `.specs/enterprise-agent-memory-product/{CONCEPTS,ARCHITECTURE,DESIGN,REQUIREMENT,UI-DESIGN}.md`（本 change 的产品语义）
- `.specs/enterprise-agent-memory-product/_facts/*-digest.md`（议题 01–10 的蒸馏事实）
- `.specs/final-v1/DOMAIN-MODEL.md`（对象/关系/权限推导）
- `.specs/redesign-v3/DOMAIN-MODEL-AND-IA.md`（信息架构收敛稿）
- `.specs/enterprise-agent-memory-platform/README.md`（跨议题能力骨架）

若两处事实冲突（例如 Team↔Project 是 1:N 还是 N:N），**不要自行裁决**：在正文用 `<span class="chip warn">待确认</span>` 标出，并写明两种口径的来源文件。
