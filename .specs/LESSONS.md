# LESSONS — 跨任务失败知识库

> 项目级常驻文件，位置：`.specs/LESSONS.md`
> **每个新任务开工前必扫**（R1.8）；任务完成后按本文件末尾的「提名条件」决定是否新增。

---

## 标签索引

- `arch` 架构决策类
- `lib` 第三方库选型 / 陷阱
- `tool` 构建 / 测试 / 工具链
- `data` 数据建模 / 迁移
- `perf` 性能
- `a11y` 可访问性
- `sec` 安全
- `ux` 交互 / 视觉
- `ops` 部署 / 运维
- `proc` 流程 / 协作

---

## 使用方式

### 写代码前（DEV 阶段，R1.8）

1. AI 用任务的 `files` + `action` 关键词 grep 本文件
2. 命中的条目必须在执行计划里显式声明：
   - 「已查阅 L-NNN，本次方案与之的差异是 X」 或
   - 「已查阅 L-NNN，本次确认仍适用，因此不重试该方案」
3. 若计划方案与某条完全相同 → 触发 R1.6，不允许直接重试

### 任务完成后（INTEGRATION ARCHIVE 步骤）

AI 扫本次 change 的所有 `*-SUMMARY.md` 与遗留 `*-PROGRESS.md`，按下面「提名条件」筛选并追加新条目。

---

## 条目格式（复制此模板新增）

```markdown
### L-NNN · [tag1, tag2] 标题（一行内说清，便于目录扫读）

- **首发**: <change-id> · <task-id> · <YYYY-MM-DD>
- **上次复核**: <YYYY-MM-DD>
- **适用栈**: <例 React 18+ / Node 20 / SQLite 当前 schema>
- **状态**: active / superseded-by:L-MMM / deprecated:<原因>
- **关键词**: <空格分隔，方便 grep；用任务里会出现的词>

**问题场景**
<一段话描述什么情况下会想用被否决的方案>

**当时尝试的方案**
<具体写法，必要时贴片段>

**为什么不行**
<具体失败原因，越可量化越好；含可复现的错误信号 / 度量数字 / 链接>

**当前推荐做法**
<指向 SUMMARY / ADR / DESIGN 链接，或一句话替代方案>

**何时可重新评估**
<例：升级到 React 19 之后；该 lib 修复 #123 之后；引入 SSR 后>
```

---

## 提名条件（满足任一即建议入库）

- 调试 / 试错总耗时 > 30 分钟
- 错因不局限于本任务的微细节，**其它任务也会撞上**
- 未来 6 个月内有合理概率被再次尝试（含其他成员、其他 AI 会话）
- 否决理由不写在 ADR 里就会丢失（架构层面已写 ADR 的不必再放这里）

**反例**（这些不要进 LESSONS）：
- 一次性的拼写错误、笔误
- 项目独有的业务规则（应进 `CONTEXT.md` 已锁决策）
- 已经在 ADR 中详细说明的架构权衡（指过去即可）

---

## 复核与剪枝（每个 ARCHIVE 步骤顺手做）

- **栈变更检查**：当 `package.json` / `Dockerfile` / DB schema 有大版本变化时，扫描所有 active 条目，把"适用栈"已不匹配的标 `deprecated:<栈版本>`
- **superseded 标记**：发现新条目对老条目形成更优替代时，给老条目加 `superseded-by:L-MMM`，不删除（保留历史）
- **季度剪枝**：deprecated > 6 个月的条目移到 `.specs/archive/LESSONS-archive.md`

---

## 条目区

### L-001 · [lib, ux] tea-component Menu.Group 的 title 渲染在 `<a>` 里，不能直接放交互组件

- **首发**: agent-collab-ui-redesign · T03 · 2026-09-03
- **上次复核**: 2026-09-03
- **适用栈**: React 18 + tea-component（当前版本）
- **状态**: active
- **关键词**: tea-component Menu MenuGroup title 侧边栏 分组标题 dropdown button a 嵌套
- **摘要**: 想把「团队切换器」做成侧边栏「团队」分组标题时，不能用 `Menu.Group title={<Dropdown/>}`。

**问题场景**
需要让侧边栏某个分组的标题本身可交互（例如「团队」分组标题 = 当前团队名 + ▾，点击展开切换列表）。

**当时尝试的方案**
```tsx
<Menu.Group title={<TeamSwitcher />}>…</Menu.Group>
// TeamSwitcher 内部是 <Dropdown button={<button>…</button>}>
```

**为什么不行**
tea-component 的 `MenuGroup` 实现把 `title` 渲染进 `<li className="tea-menu__label"><a className="tea-menu__item"><div>{title}</div></a></li>`。`title` 是 ReactNode 能编译通过，但运行时会形成「`<a>` 套 `<button>`」——非法 HTML、键盘/点击事件冲突、TS 不报但 DOM 语义错乱。

**当前推荐做法**
不走 `Menu.Group` 的 title，而是自己渲染「分组标题 li + 菜单项」，用 `Fragment` 包在 Menu 的 `ul` 里：
```tsx
<Fragment key={group.title}>
  <li className="tea-menu__label _memory-team-group-title">
    <TeamSwitcher /> {/* 独立 button，不套 a */}
  </li>
  {group.items.map(renderMenuItem)}
</Fragment>
```
参考 `src/layouts/ConsoleLayout.tsx` 的 `isTeamGroup` 分支。

**何时可重新评估**
- tea-component 升级后 `MenuGroup` 若支持 title 的 `as` / 非 `<a>` 容器，再评估回归官方 API。

---

### L-002 · [tool, arch] 路由 path→PageId 用 startsWith 匹配时，短前缀会误吞长前缀

- **首发**: agent-collab-ui-redesign · T03 · 2026-09-03
- **上次复核**: 2026-09-03
- **适用栈**: React Router（hash）+ 自建 `PATH_TO_PAGE` 映射（当前面板壳层）
- **状态**: active
- **关键词**: 路由 prefix startsWith pathname 匹配 前缀冲突 /memory /memory-spaces PATH_TO_PAGE
- **摘要**: 新增 `/memory-spaces` 时，`/memory` 前缀把 `/memory-spaces` 也吞了。

**问题场景**
`ConsoleLayout` 用 `Object.entries(PATH_TO_PAGE).find(([path]) => location.pathname.startsWith(path))` 反查 activePage。新增一个「与已有路径共享前缀」的路由时（如已有 `/memory`，新增 `/memory-spaces`）。

**当时尝试的方案**
把 `/memory-spaces` 追加到 `PATH_TO_PAGE` 末尾，以为 `find` 会优先精确匹配。

**为什么不行**
`'/memory-spaces'.startsWith('/memory') === true`，`find` 按插入顺序先命中 `/memory`，导致 `/memory-spaces` 永远被识别成 `chat_memory`。

**当前推荐做法**
长前缀必须排在短前缀之前：
```ts
const PATH_TO_PAGE = {
  '/memory-spaces': 'memory_spaces', // 必须先于 '/memory'
  '/memory': 'chat_memory',
  // …
};
```
并在注释里标明「顺序敏感」。

**何时可重新评估**
- 换成「精确路径 / 路径段匹配」（如 `react-router` 的 `matchPath` 或 `useMatches`）后，可解除对插入顺序的依赖。

---

### L-003 · [proc, arch] 「✅ 已落地」不等于已完成 —— `.specs` 的完成度标记不可信

- **首发**: redesign · 现状复核 · 2026-09
- **上次复核**: 2026-09
- **适用栈**: 任意（本文档体系通用）
- **状态**: active
- **关键词**: 已落地 已完成 骨架 占位 归档 change 完成度 复核 声称

**问题场景**
按 `.specs` 里的「✅ 已落地」「已完成」标记做规划与排期，认为某些能力现成可用。

**当时尝试的方案**
直接信任已归档 change（`agent-collab-ui-redesign`）的完成状态，按"已完成"来规划后续工作。

**为什么不行**
归档 ≠ 做完。实测：
- `agent-collab-ui-redesign` 归档为完成，但它交付的 `pages/team/AgentDetailPage.tsx` 文件头自写「**骨架阶段：字段用前端类型占位，不接后端**」，界面渲染 `<Tag>骨架阶段</Tag>`；`MemorySpaceDetailPage.tsx` 同样自写「骨架阶段为空态，不接真实数据」。
- `restore-analysis-features` 只写了 8 个组件共 802 行，**0 引用**（没接线）。
- `.specs` 中大量「已落地」无任何证据。

**当前推荐做法**
改动前做**机械复核**，不看标记看证据：① `grep -rn` 该能力符号的引用点；② 读文件头注释是否自述骨架；③ 看页面是否有真实 API 调用（0 调用即骨架）。
并加 `check-claims` 门禁：`.specs` 中「✅ 已落地/已完成」必须同行附证据（`path:line` / 命令 / 测试名），否则 fail。见 `.specs/redesign/05-TECH-PLAN.md §3`。

**何时可重新评估**
当 `check-claims` 门禁在 CI 稳定运行、且 `.specs` 全量回填证据后，可适度恢复对标记的信任。

---

### L-004 · [proc, arch] 导航重构误删整页 —— 删页面前必须查「周边设施残留」

- **首发**: redesign · 对账 · 2026-09
- **上次复核**: 2026-09
- **适用栈**: React 18 + Vite（判据通用）
- **状态**: active
- **关键词**: 误删 整页 导航重构 周边设施 i18n client 后端路由 残留

**问题场景**
重构导航信息架构（改菜单分组、合并入口、重定向旧路由）时删除或"接管"某个页面。

**当时尝试的方案**
移除「线上调用情况」AnalyticsPage 及其菜单项 —— 但从未在 change 文档中声明。

**为什么不行**
29 个文件被删，**周边设施全部残留**：`lib/api/analytics.ts` 540 行、`services/usePanelCapabilities.ts` 76 行、i18n `analytics.*` **151 行**、后端 `/api/v1/analytics/*` 16 条 + `/v3/analytics/*` 16 条、连菜单文案 `menu.analytics`/`menu.group.observability` 都还在。残留即误删的指纹 —— 真要下线不会留着 32 条后端路由和 151 行文案。

**当前推荐做法**
删除页面/能力前跑**周边设施残留检测**：
```
grep -rn "<能力域>\." i18n/            # 同域 i18n 键是否还在
ls lib/api/<域>.ts                     # client 是否还在
grep -rn "<域>/" MemoryPanel/src/panel/http/routes/  # 后端路由是否仍注册
```
有残留 → 判定为误删，改为**移入待恢复清单**（`.specs/redesign/07-RESTORE.md` 格式）而非直接删；确需下线则四层同删并在 CHANGE 里显式声明。

**何时可重新评估**
当具备"删除影响面自动检测"工具后，可改为工具阻断而非人工检查。

---

### L-005 · [tool, proc] i18n 中英不对称 —— 只在一边加键等于在另一边留生键

- **首发**: redesign · 现状复核 · 2026-09
- **上次复核**: 2026-09
- **适用栈**: react-i18next + `i18n/{zh-CN,en-US}.ts`
- **状态**: active
- **关键词**: i18n 生键 中英不对称 zh-CN en-US 缺键 界面显示键名

**问题场景**
新增界面文案，只在 `zh-CN.ts` 里加了键（或只在 `en-US.ts` 里加）。

**当时尝试的方案**
以为"代码用到 + zh-CN 有定义"就算完整。

**为什么不行**
实测双向不对称：**17 个键 `en-US` 有、`zh-CN` 没有**（切中文时界面直接显示 `userManagement.col.userId` 这类生键）；**18 个键 `zh-CN` 有、`en-US` 没有**。

**当前推荐做法**
`check-i18n` 门禁必须**双向比对键集合**（不只是"代码用到的是否有定义"），并排除字符串拼接误报（`i18n.t('error.' + code)` 会被朴素正则误判为缺键 `error.`）。

**何时可重新评估**
引入类型安全的 i18n（键从类型派生）后，缺键在编译期即报错，可撤掉运行时门禁。

---

### L-006 · [tool] 同名 `.tsx` 与同名目录并存 → 目录实现被静默遮蔽

- **首发**: redesign · 现状复核 · 2026-09
- **上次复核**: 2026-09
- **适用栈**: TS / Vite 模块解析
- **状态**: active
- **关键词**: 同名 遮蔽 shadow 模块解析 index.tsx 死代码 两套实现

**问题场景**
同一路径下同时存在 `pages/admin/UserManagementPage.tsx` 与 `pages/admin/UserManagementPage/index.tsx`。

**当时尝试的方案**
默认"目录形式"是生效实现，按 `index.tsx` 排查问题。

**为什么不行**
模块解析**优先 `.tsx` 文件**而非同名目录，所以 488 行的 `index.tsx` 从未被路由使用（死代码），而它用的 44 个 `admin.*` i18n 键**一个都没定义** —— 排查时极易误判"哪一套在跑""为什么文案缺失"。

**当前推荐做法**
`check-duplicates` 门禁禁止**同名文件 + 同名目录并存**；发现即删其一（保留被路由解析到的那套）。

**何时可重新评估**
无（此为构建工具既定解析顺序，不随版本改变）。

---

### L-007 · [arch, proc] 参考项目文档不能当能力证据（md5 相同但滞后 104 条接口）

- **首发**: redesign · 外部扫描 · 2026-09
- **上次复核**: 2026-09
- **适用栈**: 本项目 API 文档体系
- **状态**: active
- **关键词**: 文档滞后 API 文档 md5 能力证据 接口清单 v3-api-memorycore-doc

**问题场景**
需要判断某个后端能力"有没有"，于是去查随项目发布的 API 文档。

**当时尝试的方案**
以 `MemoryCore/v3-api-memorycore-doc.md` / `MemoryPanel/panel-api-doc.md` 的接口清单为准。

**为什么不行**
这两份文档与早期版本的 **md5 逐字节相同**（从未更新），而内核实现已增到 **254 条路由**，文档自称 108 条 → **104 条已实现但未文档化**（含 `/v3/analytics/*` 16、`/v3/llm/*` 3、`/v3/memory/*` 26 等）。用它判断"能力没有"会得出完全相反的结论。

**当前推荐做法**
判断能力有无**一律以源码为准**：`grep -n "api\.\(get\|post\|route\)" <router 文件>` 或看路由注册表；`.specs` 只作意图参考。文档滞后度本身要记档（见 `.specs/CONTEXT.md` 文档可信度警告）。

**何时可重新评估**
文档改为从路由注册表/OpenAPI 自动生成后，可信度恢复。

---

### L-008 · [arch, data] 引用外部项目的算法参数前必须先 grep 源仓库验证存在性

- **首发**: redesign · 外部扫描 · 2026-09
- **上次复核**: 2026-09
- **适用栈**: 任意（算法/参数借鉴场景）
- **状态**: active
- **关键词**: 借鉴 参数 公式 未核验 零命中 以讹传讹 MMR priority

**问题场景**
读了参考项目的（或关于它的）文档后，把其中的算法参数当实现依据抄进本项目设计。

**当时尝试的方案**
把 `priority = 0.5·relevance + 0.25·overlap + 0.15·recency − 0.10·cost`、30 天半衰期、`mixed-v2` 的 MMR `λ=0.70` 记为"借鉴 MindMemOS"，并写进采纳清单。

**为什么不行**
逐文件核验发现该公式在 MindMemOS **全仓零命中**（含 `src/`、`config/`、`docs/`、`plugins/*.ts`）—— 它检索侧只有 rerank + top_k 截断。同类问题还有：BM25 参数 `k1=1.5/b=0.75` 因 13 个调用点**无一传入 `stats`** 而完全失效。**未核验的参数会以讹传讹成"行业做法"**。

**当前推荐做法**
引用外部参数前先 `grep -rn` 源仓库确认存在且有调用点；在文档中标注 **「已核验（path:line）」** 或 **「未核验」** 两类，禁止把未核验项写成"借鉴自 X"。

**何时可重新评估**
无（该纪律长期有效）。
