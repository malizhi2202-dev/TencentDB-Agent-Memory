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

<!-- 后续条目按 L-003, L-004 ... 编号追加 -->
