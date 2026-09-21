# 单文件 HTML 产品设计文档 —— 模板解剖与复刻规范

**解剖对象（只读，未修改）**：`/home/malizhi/go/src/goweb_log_collection/client/web/public/docs/product-design.html`
**规模**：2385 行 / 约 235 KB / `<html lang="zh-CN">` / **零外部依赖**（无 `<link>`、无 `<img>`、无 `src="http..."`；字体走本地字体族回退）
**CSS 块总数**：`<style>` 位于 8–256 行，共 **158 个规则块** = 154 个顶层规则 + 4 个 at-rule（`@media (max-width:900px)` / `@media (max-width:1000px)` / `@media (max-width:760px)` / `@media print`）
**JS 总量**：`<script>` 位于 2336–2383 行，48 行，纯原生、无框架
**主题**：**仅亮色一种**。模板**未提供**暗色主题（无 `prefers-color-scheme`、无 `[data-theme]`、无 `color-scheme`）。唯一深底表面是 `.logview`（终端感结果区）。

## 0. 文件顶层结构（行号地图）

| 行区间 | 内容 |
|---|---|
| 1–7 | `<!DOCTYPE html>` → `<head>`：`charset` / `viewport` / `<title>` / `<meta name="description">` |
| 8–256 | `<style>`（唯一一个，全部 CSS 内联） |
| 261–280 | `<svg class="sprite" aria-hidden="true"><defs>` 图标精灵（18 个 `<symbol>`） |
| 282–291 | `<header class="doc-top">` 顶栏 |
| 293–351 | `<div class="doc-shell">` → `<nav class="doc-nav">` 侧栏目录 |
| 353–2330 | `<main class="doc-main">` → 11 个 `<section class="doc-sec">`（§0–§10） |
| 2332–2334 | `<footer class="doc-foot">` |
| 2336–2383 | `<script>` |

**章节 id 顺序**：`s0` `s1` `s2`(含 h3 `s2-1`…`s2-5`) `s3` `s4` `s5`(含 h3 `s5-1`,`s5-login`…`s5-audit`) `s6`(含 h3 `p1`…`p14`) `s7`(含 h3 `s7-perms`) `s8` `s9` `s10`。
注意：**侧栏目录链接的是 `<h3 id>`，不是 `<section id>`**（section id 只用于 §2/§5/§6 这类容器，h3 id 才是滚动锚点）。

---

## 1. Design tokens —— `:root` 全部 CSS 变量（原样）

模板采用 **hex 兜底 + oklch 覆盖** 的双写策略：同一变量先给 hex，紧接一行同名 oklch 覆盖，老浏览器退化为 hex。复刻时必须保持这个"同名双写"顺序。

```css
/* ============================================================
   Design tokens —— 与产品源码 web/src/styles/tokens.css 同源
   Tone: Terminal Clarity（亮色极简画布 + 等宽秩序；单一品牌蓝 ≤3%）
   先给 hex 兜底，再被 oklch 覆盖（老浏览器退化为 hex）
   ============================================================ */
:root{
  --color-brand:#3B66E8;          --color-brand:oklch(0.55 0.19 262);
  --color-brand-deep:#2F52BE;     --color-brand-deep:oklch(0.47 0.17 262);
  --color-brand-hover:#5178EE;    --color-brand-hover:oklch(0.62 0.18 262);
  --color-brand-subtle:#3B66E814; --color-brand-subtle:oklch(0.55 0.19 262 / .08);

  --color-bg:#F5F6F8;             --color-bg:oklch(0.965 0.003 270);
  --color-surface:#FCFCFD;        --color-surface:oklch(0.985 0.003 270);
  --color-surface-hover:#F0F0F3;  --color-surface-hover:oklch(0.945 0.004 270);

  --color-text-primary:#1A1C2E;   --color-text-primary:oklch(0.22 0.02 270);
  --color-text-secondary:#6C6E80; --color-text-secondary:oklch(0.47 0.02 270);
  --color-text-tertiary:#ABACBA;  --color-text-tertiary:oklch(0.70 0.02 270);
  --color-text-invert:#FCFCFD;    --color-text-invert:oklch(0.99 0.002 270);

  --color-border:#E5E5E9;         --color-border:oklch(0.915 0.004 270);
  --color-border-subtle:#0000000A;

  --color-success:#2E9E5B;        --color-success:oklch(0.62 0.15 150);
  --color-warning:#C8871A;        --color-warning:oklch(0.70 0.14 55);
  --color-danger:#D0342C;         --color-danger:oklch(0.58 0.21 27);
  --color-danger-subtle:#D0342C14;

  --color-logview-bg:#25262B;     --color-logview-bg:oklch(0.19 0.01 270);
  --color-logview-text:#C9CAD1;   --color-logview-text:oklch(0.82 0.01 270);
  --color-logview-border:#3B3D45; --color-logview-border:oklch(0.28 0.01 270);

  --space-xs:4px; --space-sm:8px; --space-md:14px; --space-lg:22px; --space-xl:34px; --space-2xl:52px;
  --radius-sm:4px; --radius-md:8px; --radius-lg:14px;
  --font-mono:"JetBrains Mono","SF Mono","Fira Code","PingFang SC","Microsoft YaHei",monospace;
  --font-body:"IBM Plex Sans","PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;
  --font-size-xs:11px; --font-size-sm:12px; --font-size-base:14px; --font-size-lg:16px; --font-size-xl:18px; --font-size-2xl:20px;
}
```

**Token 分组速查**

| 组 | 变量 | 值 |
|---|---|---|
| 品牌 | `--color-brand` / `-deep` / `-hover` / `-subtle` | `#3B66E8` / `#2F52BE` / `#5178EE` / `#3B66E814` |
| 背景 | `--color-bg` / `--color-surface` / `--color-surface-hover` | `#F5F6F8` / `#FCFCFD` / `#F0F0F3` |
| 文字 | `--color-text-primary` / `-secondary` / `-tertiary` / `-invert` | `#1A1C2E` / `#6C6E80` / `#ABACBA` / `#FCFCFD` |
| 描边 | `--color-border` / `--color-border-subtle` | `#E5E5E9` / `#0000000A` |
| 语义 | `--color-success` / `--color-warning` / `--color-danger` / `--color-danger-subtle` | `#2E9E5B` / `#C8871A` / `#D0342C` / `#D0342C14` |
| 终端底 | `--color-logview-bg` / `-text` / `-border` | `#25262B` / `#C9CAD1` / `#3B3D45` |
| 间距 | `--space-xs/sm/md/lg/xl/2xl` | `4 / 8 / 14 / 22 / 34 / 52 px`（**非线性**，注意 14/22/34/52 的节奏） |
| 圆角 | `--radius-sm/md/lg` | `4 / 8 / 14 px` |
| 字体 | `--font-mono` / `--font-body` | 均以中文字体族收尾，保证中英混排 |
| 字号 | `--font-size-xs/sm/base/lg/xl/2xl` | `11 / 12 / 14 / 16 / 18 / 20 px` |

**硬编码色（未 token 化，共 4 处，均在 `.logview` 内）**：`#F08A82`（err）、`#E0B15F`（warn）、`#7FB2F0`（info）、`#8A8C96`（dim）。复刻时若想彻底 token 化，可提升为 `--color-logview-err` 等。

---

## 2. 全局重置与排版基座（原样）

```css
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0; background:var(--color-bg); color:var(--color-text-primary);
  font:var(--font-size-base)/1.65 var(--font-body);
  -webkit-font-smoothing:antialiased;
}
a{color:var(--color-brand); text-decoration:none}
a:hover{text-decoration:underline}
code,.mono{font-family:var(--font-mono); font-size:.92em}
:focus-visible{outline:2px solid var(--color-brand); outline-offset:2px; border-radius:var(--radius-sm)}
```

要点：`body` 用 `font:` 简写一次性设定字号/行高/字族；`.mono` 与 `code` 共享等宽规则（**`.mono` 是全模板使用最多的 class，601 次**）；`:focus-visible` 提供统一焦点环，可访问性不用逐组件写。

---

## 3. 文档骨架 CSS（原样）

### 3.1 顶栏 `.doc-top` 与品牌

```css
/* ---------- 文档骨架 ---------- */
.doc-top{
  position:sticky; top:0; z-index:30; height:56px; display:flex; align-items:center; gap:var(--space-md);
  padding:0 var(--space-lg); background:var(--color-surface); border-bottom:1px solid var(--color-border);
}
.doc-brand{display:flex; align-items:center; gap:var(--space-sm); font-weight:600; letter-spacing:.2px}
.doc-brand .mark{width:22px;height:22px;border-radius:var(--radius-sm);background:var(--color-brand);display:grid;place-items:center;color:var(--color-text-invert)}
.doc-top h1{font-size:var(--font-size-base); font-weight:600; margin:0; color:var(--color-text-primary)}
.doc-top .sep{color:var(--color-text-tertiary)}
.doc-top .tools{margin-left:auto; display:flex; align-items:center; gap:var(--space-sm)}
```

### 3.2 两栏外壳 `.doc-shell` + 侧栏 `.doc-nav` + 正文 `.doc-main`

```css
.doc-shell{display:grid; grid-template-columns:272px minmax(0,1fr); align-items:start}
.doc-nav{
  position:sticky; top:56px; height:calc(100vh - 56px); overflow-y:auto;
  border-right:1px solid var(--color-border); background:var(--color-surface);
  padding:var(--space-lg) var(--space-sm) var(--space-2xl) var(--space-lg);
}
.doc-nav .grp{font-size:var(--font-size-xs); text-transform:uppercase; letter-spacing:.08em; color:var(--color-text-tertiary); margin:var(--space-md) 0 var(--space-xs)}
.doc-nav .grp:first-child{margin-top:0}
.doc-nav a{display:block; padding:3px 8px; border-radius:var(--radius-sm); color:var(--color-text-secondary); font-size:13px}
.doc-nav a:hover{background:var(--color-surface-hover); color:var(--color-text-primary); text-decoration:none}
.doc-nav a.active{background:var(--color-brand-subtle); color:var(--color-brand)}
.doc-main{min-width:0; padding:var(--space-lg) var(--space-xl) 96px; max-width:1180px}
```

**骨架三要素**：① `grid-template-columns:272px minmax(0,1fr)`——`minmax(0,1fr)` 是防止宽表格撑破栅格的关键；② 侧栏 `sticky + top:56px + height:calc(100vh - 56px) + overflow-y:auto` 自成滚动区；③ `.doc-main{min-width:0}` 配合 `max-width:1180px`。

### 3.3 章节与标题层级

```css
section.doc-sec{padding-top:var(--space-lg); margin-top:var(--space-lg); border-top:1px solid var(--color-border)}
section.doc-sec:first-of-type{border-top:0; margin-top:0}
h2{font-size:var(--font-size-2xl); font-weight:600; margin:0 0 var(--space-md); letter-spacing:.1px}
h3{font-size:var(--font-size-lg); font-weight:600; margin:var(--space-lg) 0 var(--space-sm)}
h4{font-size:var(--font-size-base); font-weight:600; margin:var(--space-md) 0 var(--space-xs)}
h5{font-size:var(--font-size-sm); font-weight:600; margin:var(--space-md) 0 var(--space-xs); color:var(--color-text-secondary)}
p{margin:0 0 var(--space-sm)}
ul,ol{margin:0 0 var(--space-sm); padding-left:1.25em}
li{margin:2px 0}
.lead{font-size:var(--font-size-lg); color:var(--color-text-secondary); max-width:74ch}
.muted{color:var(--color-text-secondary)}
.small{font-size:var(--font-size-sm)}
.tiny{font-size:var(--font-size-xs)}
hr{border:0; border-top:1px solid var(--color-border); margin:var(--space-lg) 0}
```

**套路**：每个 `<section class="doc-sec">` 之间用 `border-top` 做分隔（`:first-of-type` 去掉第一条）；`h2` 后紧跟 `<p class="lead">`；`h3` 承担可锚定的小节标题。

### 3.4 响应式与打印（原样）

```css
@media (max-width:1000px){
  .doc-shell{grid-template-columns:minmax(0,1fr)}
  .doc-nav{position:static; height:auto; border-right:0; border-bottom:1px solid var(--color-border)}
  .doc-main{padding:var(--space-md) var(--space-md) 64px}
  .doc-top{height:auto; flex-wrap:wrap; padding:var(--space-sm) var(--space-md)}
  .app{grid-template-columns:minmax(0,1fr); height:auto}
  .app-side{flex-direction:row; overflow-x:auto; border-right:0; border-bottom:1px solid var(--color-border)}
  .app-side .nav-grp,.app-brand span{display:none}
}
@media (max-width:760px){
  /* 窄屏下表格独立横滚，避免把整页撑宽 */
  table.tbl{display:block; overflow-x:auto}
  table.tbl th{white-space:normal}
  .proto .app-body{padding:var(--space-md)}
  .doc-top .tools{flex-wrap:wrap}
}
@media print{
  .doc-top,.doc-nav{display:none} .doc-shell{grid-template-columns:minmax(0,1fr)}
  .app,.proto{break-inside:avoid} section.doc-sec{break-before:page}
}
```

另有第 4 个 at-rule 混在通用块区（`.split` 之后）：

```css
@media (max-width:900px){ .split{grid-template-columns:minmax(0,1fr)} }
```

**窄屏侧栏行为（三档）**：

| 断点 | 侧栏 `.doc-nav` 变化 | 其他 |
|---|---|---|
| >1000px | 272px 固定列，sticky，独立滚动 | 原型内 `.app` 为 200px 侧栏 + 主区两栏 |
| ≤1000px | **降级为单列**：`position:static`（取消吸顶）、`height:auto`、去掉右边框、改下边框，变成正文上方的一段目录 | `.doc-top` 变高并 `flex-wrap`；`.app` 变单列、`height:auto`；`.app-side` 转横向滚动条，隐藏 `.nav-grp` 与品牌文字 |
| ≤760px | 保持单列 | `table.tbl` 改 `display:block; overflow-x:auto` 独立横滚；`th` 允许换行；`.proto .app-body` 收窄内边距 |
| print | `.doc-top,.doc-nav{display:none}` | `.app,.proto` 不跨页断开；每个 `.doc-sec` 前强制分页 |

**注意**：窄屏下侧栏**不是抽屉/汉堡菜单**，而是直接摊平成页面顶部的一块目录区。模板未提供折叠或 toggle 按钮。

---

## 4. 图标 sprite —— 18 个 `<symbol>`（id / 用途 / 实际引用次数）

外层为 `<svg class="sprite" aria-hidden="true"><defs>…</defs></svg>`，配合 CSS `.sprite{display:none}` 与 `.icon{width:15px;height:15px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}` —— **统一线性描边风格，颜色继承 `currentColor`，`fill:none`**。所有 symbol 共用 `viewBox="0 0 24 24"`。

引用写法：`<svg class="icon"><use href="#i-chat"/></svg>`（注意用的是 `href`，不是 `xlink:href`）。

| # | symbol id | 图形 | 用途 | 引用次数 |
|---|---|---|---|---|
| 1 | `i-chat` | 圆角对话气泡 | 侧栏「对话」/ 平台级对话工作台 | 13 |
| 2 | `i-grid` | 四宫格 | 侧栏「工作台」/ 项目总览 | 13 |
| 3 | `i-folder` | 文件夹 | 侧栏「项目」/ 项目列表 | 13 |
| 4 | `i-scene` | 方块 + 圆（模板） | 侧栏「场景」/ 可复用工作模板 | 13 |
| 5 | `i-download` | 向下箭头 + 托盘 | 侧栏「客户端下载」 | 13 |
| 6 | `i-gear` | 齿轮 | 侧栏「平台设置」 | 12 |
| 7 | `i-shield` | 盾牌 + 勾 | 侧栏「权限矩阵」/ RBAC 语义 | 13 |
| 8 | `i-audit` | 文档 + 两行文本 | 侧栏「审计日志」 | 12 |
| 9 | `i-search` | 放大镜 | 顶栏品牌 `.mark` 内的 13px 图标 | 1 |
| 10 | `i-flow` | 三条横线 + 圆节点 | 流程/时序语义（**已定义未使用**） | 0 |
| 11 | `i-pin` | 两条横向卡片 | 字段解析 / 固定项（**已定义未使用**） | 0 |
| 12 | `i-cpu` | 芯片 | Agent / 客户端（**已定义未使用**） | 0 |
| 13 | `i-plus` | 加号 | 新建 / 添加按钮（**已定义未使用**） | 0 |
| 14 | `i-refresh` | 循环箭头 | 刷新（原型内仅 1 处） | 1 |
| 15 | `i-check` | 勾 | 成功 / 启用（**已定义未使用**） | 0 |
| 16 | `i-x` | 叉 | 关闭 / 失败（**已定义未使用**） | 0 |
| 17 | `i-trash` | 垃圾桶 | 删除（**已定义未使用**） | 0 |
| 18 | `i-chev` | 右尖括号 | 展开 / 进入（**已定义未使用**） | 0 |

**复刻提示**：8 个"已定义未使用"的 symbol 是**预留位**——侧栏只用 8 个（7 个导航项 + 品牌 search）。复刻时若要压缩体积，可只保留前 9 个；若要保留可扩展性，建议整组照抄（体积约 2.5 KB，收益是新增导航项不必补图标）。

---

## 5. 区块组件 CSS（原样）

### 5.1 通用块：`.card` / `.grid` / `.g2` / `.g3` / `.g4` / `.split`

```css
/* ---------- 通用块 ---------- */
.card{background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-md) var(--space-md)}
.card.pad-lg{padding:var(--space-lg)}
.grid{display:grid; gap:var(--space-md)}
.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(168px,1fr))}
.split{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:var(--space-md)}
```

配套断点：`@media (max-width:900px){ .split{grid-template-columns:minmax(0,1fr)} }`

**套路**：`.grid` 只提供 `display:grid + gap`，列数由 `.g2/.g3/.g4` 用 `auto-fit + minmax` 决定——**没有固定列数，全靠最小宽度自适应**。`.split` 是**严格对半的两栏**（用于「数据概念 | 界面与操作」），900px 以下塌成单栏。原型内部还大量使用行内覆写：`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">`。

### 5.2 `.chip`（含 brand / ok / warn / danger / mono）

```css
.chip{display:inline-flex; align-items:center; gap:4px; padding:1px 7px; border-radius:999px; font-size:var(--font-size-xs);
  border:1px solid var(--color-border); color:var(--color-text-secondary); background:var(--color-surface); white-space:nowrap}
.chip.brand{color:var(--color-brand); border-color:color-mix(in oklch, var(--color-brand) 35%, transparent); background:var(--color-brand-subtle)}
.chip.ok{color:var(--color-success); border-color:color-mix(in oklch, var(--color-success) 35%, transparent)}
.chip.warn{color:var(--color-warning); border-color:color-mix(in oklch, var(--color-warning) 35%, transparent)}
.chip.danger{color:var(--color-danger); border-color:color-mix(in oklch, var(--color-danger) 35%, transparent)}
.chip.mono{font-family:var(--font-mono)}
```

**实测使用频次**：`.chip` 149 次；其中 `chip mono` 48、`chip warn` 25、`chip ok` 21、`chip brand` 6、`chip danger` 6。变体只需改文字色 + 边框色（用 `color-mix` 生成 35% 透明度的同色描边），**背景保持 surface 不变**（只有 `.brand` 例外，加了 `--color-brand-subtle` 底）。

### 5.3 `.callout`（含 warn / danger）

```css
.callout{border-left:2px solid var(--color-brand); background:var(--color-brand-subtle); padding:var(--space-sm) var(--space-md); border-radius:0 var(--radius-sm) var(--radius-sm) 0; margin:var(--space-sm) 0}
.callout.warn{border-left-color:var(--color-warning); background:color-mix(in oklch, var(--color-warning) 10%, transparent)}
.callout.danger{border-left-color:var(--color-danger); background:var(--color-danger-subtle)}
.callout h5{margin-top:0; color:inherit}
```

> **重要事实（不要照抄想象）**：模板 CSS **只有 `.callout` / `.callout.warn` / `.callout.danger` 三个变体，没有 `.callout.ok`**。任务清单里提到的 `.callout.ok` 在模板中**不存在**，需自行新增（照 `.chip.ok` 的写法补：`border-left-color:var(--color-success); background:color-mix(in oklch, var(--color-success) 10%, transparent)`）。
> 实测使用频次：`class="callout"` 11 次、`class="callout warn"` 5 次；**`.callout.danger` 定义了但正文 0 次使用**。

### 5.4 `.panel` / `.panel-title` / `.h1` / `.h2p` / `.field` / `.input` / `.rows`

```css
.panel{background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-md)}
.panel-title{font-size:13px; font-weight:600; margin:0 0 var(--space-sm)}
.h1{font-size:var(--font-size-xl); font-weight:600; margin:0 0 var(--space-md)}
.h2p{font-size:var(--font-size-base); font-weight:600; margin:0 0 var(--space-sm)}
.field{display:flex; flex-direction:column; gap:4px}
.field label{font-size:var(--font-size-xs); color:var(--color-text-secondary)}
.input,.select{height:30px; border:1px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-surface);
  padding:0 8px; font:13px var(--font-body); color:var(--color-text-primary); display:flex; align-items:center}
.input.mono{font-family:var(--font-mono); font-size:12px}
.input.placeholder{color:var(--color-text-tertiary)}
.rows{display:grid; gap:var(--space-sm)}
```

**套路**：`.h1`/`.h2p` 是**原型内部的伪标题**（不是真 `h1`/`h2`，避免与文档大纲冲突）；`.input` 是**静态展示用的 div**（不是真 `<input>`），用 `display:flex;align-items:center` 模拟 30px 高控件，因此原型零交互即可像素稳定。`.field label` 也刻意用 `<label>` 元素但不绑 `for`。

### 5.5 `.tabs` / `.tabpanel`

```css
.tabs{display:flex; gap:2px; border-bottom:1px solid var(--color-border); margin-bottom:var(--space-md)}
.tabs button{appearance:none; border:0; background:none; padding:8px 12px; font:500 13px var(--font-body); color:var(--color-text-secondary); cursor:pointer; border-bottom:2px solid transparent}
.tabs button[aria-selected="true"]{color:var(--color-brand); border-bottom-color:var(--color-brand)}
.tabpanel[hidden]{display:none}
```

**选中态完全由 `aria-selected` 驱动**，不额外挂 `.active` class —— 这样 JS 只需改 ARIA 属性，样式自动跟随，是模板里最干净的一处设计。

### 5.6 `.tbl`（含 compact / grp-row / mono 单元格）

```css
table.tbl{width:100%; border-collapse:collapse; font-size:13px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); overflow:hidden}
table.tbl th{text-align:left; font-weight:600; font-size:var(--font-size-sm); color:var(--color-text-secondary); padding:8px 10px; border-bottom:1px solid var(--color-border); background:var(--color-surface-hover); white-space:nowrap}
table.tbl td{padding:8px 10px; border-bottom:1px solid var(--color-border); vertical-align:top}
table.tbl tr:last-child td{border-bottom:0}
table.tbl td.mono,table.tbl th.mono{font-family:var(--font-mono); font-size:12px}
/* 导航分层（A1）：模块总览表的分组行 —— 与侧栏三分域一一对应 */
table.tbl tr.grp-row td{background:var(--color-surface-hover); font-size:var(--font-size-xs); color:var(--color-text-tertiary); letter-spacing:.02em; padding-top:6px; padding-bottom:6px}
table.tbl.compact th,table.tbl.compact td{padding:5px 8px}
```

**套路**：表格自带 `border` + `border-radius` + `overflow:hidden`（用 overflow 裁剪掉圆角外的边框，不需要 `border-spacing` 技巧）；列宽靠 `<th style="width:180px">` 行内指定；`.grp-row` 用 `<td colspan="N">` 做分组标题行；`.compact` 只压缩内边距。

### 5.7 `.btn`（含 primary / sm / link / disabled）

```css
.btn{display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 12px; border-radius:var(--radius-sm);
  border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text-primary);
  font:500 13px var(--font-body); cursor:pointer}
.btn:hover{background:var(--color-surface-hover)}
.btn.primary{background:var(--color-brand); border-color:var(--color-brand); color:var(--color-text-invert)}
.btn.primary:hover{background:var(--color-brand-hover); border-color:var(--color-brand-hover)}
.btn.sm{height:24px; padding:0 8px; font-size:12px}
.btn.link{border:0; background:none; color:var(--color-brand); padding:0 4px; height:22px}
.btn[disabled],.btn:disabled{opacity:.5; cursor:not-allowed}
```

**实测**：`.btn` 71 次（`sm` 58 次占绝大多数，`primary` 18 次）。**原型里的按钮是真 `<button>`，但不绑 `onclick`**（唯一例外：顶栏的打印按钮 `onclick="window.print()"`）。

### 5.8 `.kv` / `.card` / `.metric` / `.metric-label`

```css
.card{background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-md) var(--space-md)}
.kv{display:grid; grid-template-columns:auto 1fr; gap:2px var(--space-md); font-size:13px}
.kv dt{color:var(--color-text-secondary)}
.kv dd{margin:0}
.metric{font-family:var(--font-mono); font-size:var(--font-size-2xl); font-weight:600; letter-spacing:-.5px}
.metric-label{font-size:var(--font-size-xs); color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:.06em}
```

**套路**：`.kv` 是 `<dl>` 的两列网格（`auto 1fr`），术语列自适应、说明列吃掉剩余宽度；`.metric` 用等宽字体 + 负字距做出"数字仪表盘"感，配 `.metric-label` 的全大写小字标签（`.metric` 4 次 / `.metric-label` 7 次）。

### 5.9 图：`.diagram` / `.layer` / `.node` / `.pill` / `.flow` / `.arrow-v`

```css
/* ---------- 图：分层 / 拓扑 / 能力地图 ---------- */
.diagram{background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-lg)}
.layer{border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:var(--space-sm) var(--space-md); background:var(--color-bg)}
.layer.brand{border-color:color-mix(in oklch, var(--color-brand) 40%, transparent); background:var(--color-brand-subtle)}
.layer h5{margin:0 0 4px; color:var(--color-text-primary); font-size:13px}
.layer .row{display:flex; flex-wrap:wrap; gap:6px}
.pill{border:1px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-surface); padding:2px 8px; font-size:12px}
.pill.mono{font-family:var(--font-mono)}
.arrow-v{display:grid; place-items:center; color:var(--color-text-tertiary); font-size:16px; line-height:1; padding:4px 0}
.arrow-v small{font-size:var(--font-size-xs); color:var(--color-text-secondary); margin-left:6px}
.node{border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); padding:var(--space-sm) var(--space-md); text-align:center; font-size:13px}
.node strong{display:block; font-size:13px}
.node span{color:var(--color-text-secondary); font-size:var(--font-size-xs); font-family:var(--font-mono)}
.flow{display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-sm)}
.flow .step{border:1px solid var(--color-border); background:var(--color-surface); border-radius:var(--radius-sm); padding:4px 10px; font-size:13px}
.flow .to{color:var(--color-text-tertiary)}
```

**分层图写法**（`diagram` 内部垂直堆叠，层与层之间插 `arrow-v` 标注协议）：

```html
<div class="diagram">
  <div class="layer brand"><h5>浏览器 · 控制台（Vue 3 + Vite，base <span class="mono">/loggen/</span>）</h5>
    <div class="row"><span class="pill">工作台</span><span class="pill">项目子页</span>…</div>
  </div>
  <div class="arrow-v">▼ <small>HTTP/JSON（SameSite Session + X-CSRF-Token）</small></div>
  <div class="layer"><h5>控制中心 control-center（Go / gin + gRPC + gorm）</h5>
    <div class="row"><span class="pill">auth + RBAC</span>…<span class="pill mono">:20006</span></div>
  </div>
</div>
```

`.layer` 底是 `--color-bg`（比 surface 略深），`.pill` 底是 `--color-surface`——**用底色深浅区分"容器"与"容器内元素"，不用阴影**。`.layer.brand` 只给首页/入口层上品牌色（1 处使用）。

**状态机写法**：`.flow` 横排 `.step` + `.to`（箭头字符 `→`）：

```html
<div class="flow">
  <span class="step mono">created</span><span class="to">→</span>
  <span class="step mono">dispatching</span><span class="to">→</span>
  <span class="step mono">running</span><span class="to">→</span>
  <span class="step mono">completed</span>
</div>
```

`.node` 用于拓扑图（`<strong>` 主标签 + `<span>` 等宽副标签），全模板 10 次。

### 5.10 `.seq-wrap` 与 `table.seq`（时序图）

```css
/* ---------- 图：时序（table + 虚线生命线） ---------- */
figure{margin:var(--space-md) 0}
figure figcaption{font-size:var(--font-size-sm); color:var(--color-text-secondary); margin-top:var(--space-sm)}
.seq-wrap{overflow-x:auto; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface)}
table.seq{width:100%; border-collapse:collapse; min-width:620px}
table.seq thead th{
  font-size:var(--font-size-sm); font-weight:600; padding:8px 10px; text-align:center;
  border-bottom:1px solid var(--color-border); background:var(--color-surface-hover); white-space:nowrap;
}
table.seq thead th.actor-ext{color:var(--color-text-primary)}
table.seq thead th.actor-cc{box-shadow:inset 0 -2px 0 var(--color-brand)}
table.seq tbody td{border-left:1px dashed color-mix(in oklch, var(--color-text-tertiary) 55%, transparent); height:34px; padding:0 10px; font-size:12.5px; vertical-align:middle}
table.seq tbody td:first-child{border-left:0}
table.seq tbody td.msg{position:relative; padding:0 10px 0 12px; border-bottom:0}
table.seq tbody td.msg .arrow{display:block; position:absolute; left:10px; right:10px; bottom:9px; height:1px; background:var(--color-text-secondary)}
table.seq tbody td.msg .arrow.rtl{left:10px; right:10px}
table.seq tbody td.msg::after{content:""; position:absolute; bottom:6px; right:9px; width:0; height:0;
  border-top:3.5px solid transparent; border-bottom:3.5px solid transparent; border-left:6px solid var(--color-text-secondary)}
table.seq tbody td.msg.rtl::after{right:auto; left:9px; border-left:0; border-right:6px solid var(--color-text-secondary)}
table.seq tbody td.msg.dash .arrow{background:repeating-linear-gradient(90deg,var(--color-text-secondary) 0 5px,transparent 5px 9px)}
table.seq tbody td.msg .label{position:relative; z-index:1; background:var(--color-surface); padding-right:6px}
table.seq tbody td.msg .label b{font-weight:600}
table.seq tbody td.msg .label .n{color:var(--color-brand); font-family:var(--font-mono); margin-right:4px}
table.seq tbody td.note{font-size:var(--font-size-xs); color:var(--color-text-secondary); background:var(--color-bg); border-left:1px dashed var(--color-border); font-style:normal}
```

**这是模板最精巧的一块**：用 `<table>` 冒充时序图，不画 SVG。

- 每个参与者 = 一列，`<th class="actor-ext">`（外部）/ `<th class="actor-cc">`（中心，用 `inset box-shadow` 在底部画 2px 品牌色下划线做区分）；
- 生命线 = `tbody td` 的 `border-left:1px dashed`（第一列 `:first-child` 去掉）；
- 消息箭头 = `td.msg` 内绝对定位的 `.arrow`（1px 横线）+ `::after` 三角（`border-left:6px` 伪元素三角，`rtl` 变体翻到左侧用 `border-right`）；
- 虚线消息 = `.msg.dash`，把实线换成 `repeating-linear-gradient` 生成虚线；
- 文字压线 = `.label` 给 `background:var(--color-surface)` + `z-index:1`，把箭头从文字底下"截断"；
- 编号 = `.label .n`（品牌色等宽，如 `①`）；
- 备注行 = `td.note`（`--color-bg` 底、虚线左边框）。

`.seq-wrap` 提供 `overflow-x:auto`，`table.seq{min-width:620px}` 保证窄屏可横滚。共 8 个时序图（`class="seq-wrap"` 8 次）。

### 5.11 `.logview`（终端底结果区）

```css
.logview{background:var(--color-logview-bg); color:var(--color-logview-text); border:1px solid var(--color-logview-border);
  border-radius:var(--radius-sm); padding:var(--space-sm) var(--space-md); font-family:var(--font-mono); font-size:12px; line-height:1.75; overflow:auto; white-space:pre}
.logview .lv-err{color:#F08A82}
.logview .lv-warn{color:#E0B15F}
.logview .lv-info{color:#7FB2F0}
.logview .lv-dim{color:#8A8C96}
```

`white-space:pre` + 等宽字体 + 深底 = 终端感。级别着色靠 `.lv-err/.lv-warn/.lv-info/.lv-dim` 四个 span（**这 4 个色值是模板中仅有的硬编码色**）。实测仅 1 处使用（§6.4 单次搜索结果区）。

### 5.12 `.progress`

```css
.progress{height:6px; border-radius:999px; background:var(--color-surface-hover); overflow:hidden}
.progress i{display:block; height:100%; background:var(--color-brand)}
```

写法：`<div class="progress"><i style="width:62%"></i></div>`（进度值走行内 `width`）。3 处使用，均配 `<span class="tiny mono">124 / 200 文件</span>` 显示绝对量。

### 5.13 其他工具类

```css
.muted{color:var(--color-text-secondary)}
.small{font-size:var(--font-size-sm)}
.tiny{font-size:var(--font-size-xs)}
.lead{font-size:var(--font-size-lg); color:var(--color-text-secondary); max-width:74ch}
code,.mono{font-family:var(--font-mono); font-size:.92em}
```

使用频次：`mono` 601、`tiny` 136、`small` 119、`muted` 79、`lead` 8。**注意 `.mono` 同时被 CSS 规则 `code,.mono` 与 `.chip.mono`/`.pill.mono`/`.input.mono`/`td.mono` 等修饰符覆盖**，语义是"等宽"。`.lead` 用 `max-width:74ch` 限制阅读宽度。

---

## 6. 原型外壳 CSS（原样）

```css
/* ---------- 界面原型（静态复刻，数据全假） ---------- */
.proto{border:1px solid var(--color-border); border-radius:var(--radius-lg); overflow:hidden; background:var(--color-bg); margin:var(--space-md) 0}
.proto-bar{display:flex; align-items:center; gap:var(--space-sm); height:34px; padding:0 var(--space-md); background:var(--color-surface-hover); border-bottom:1px solid var(--color-border)}
.proto-bar .dots{display:flex; gap:5px}
.proto-bar .dots i{width:9px;height:9px;border-radius:999px;background:var(--color-border); display:block}
.proto-bar .url{flex:1; font-family:var(--font-mono); font-size:var(--font-size-xs); color:var(--color-text-secondary);
  background:var(--color-surface); border:1px solid var(--color-border); border-radius:999px; padding:2px 10px; max-width:520px}
.proto-bar .fake{font-size:var(--font-size-xs); color:var(--color-warning); white-space:nowrap}
.app{display:grid; grid-template-columns:200px minmax(0,1fr); height:560px; background:var(--color-bg)}
.app.tall{height:640px}
.app-side{background:var(--color-surface); border-right:1px solid var(--color-border); padding:var(--space-md) var(--space-sm); display:flex; flex-direction:column; gap:2px; overflow:hidden}
.app-brand{display:flex; align-items:center; gap:8px; font-weight:600; padding:0 6px var(--space-sm); color:var(--color-text-primary); font-size:13px}
.app-brand i{width:20px;height:20px;border-radius:var(--radius-sm);background:var(--color-brand);display:grid;place-items:center;color:var(--color-text-invert);font-size:10px;font-style:normal}
.app-side .nav-grp{font-size:var(--font-size-xs); color:var(--color-text-tertiary); padding:var(--space-sm) 6px 2px}
.app-side a{display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:var(--radius-sm); color:var(--color-text-secondary); font-size:13px}
.app-side a.active{background:var(--color-brand-subtle); color:var(--color-brand)}
.app-side .spacer{flex:1}
.app-main{display:flex; flex-direction:column; min-width:0; overflow:hidden}
.app-top{height:48px; display:flex; align-items:center; gap:var(--space-md); padding:0 var(--space-lg); border-bottom:1px solid var(--color-border); background:var(--color-surface)}
.app-top .crumb{font-size:13px; color:var(--color-text-secondary)}
.app-top .crumb b{color:var(--color-text-primary); font-weight:600}
.app-top .right{margin-left:auto; display:flex; align-items:center; gap:var(--space-sm)}
.app-body{padding:var(--space-lg); overflow:auto; flex:1; min-height:0}
.app-body.flush{padding:0; display:flex; flex-direction:column}
```

### 6.1 外壳各部件职责

| 选择器 | 职责 | 关键点 |
|---|---|---|
| `.proto` | 原型外框 | `--radius-lg` + `overflow:hidden`，底色 `--color-bg` |
| `.proto-bar` | 浏览器假标题栏 | 34px 高，`--color-surface-hover` 底 |
| `.proto-bar .dots` / `i` | 三个"红黄绿"圆点 | 全部同色 `--color-border`（**刻意不用红黄绿**，避免视觉噪音） |
| `.proto-bar .url` | 地址栏 | 等宽、胶囊圆角、`max-width:520px`、`flex:1` |
| `.proto-bar .fake` | "演示数据"角标 | 警告色文字，`white-space:nowrap` |
| `.app` | 应用两栏布局 | `200px + minmax(0,1fr)`，**固定高 560px**（不是自适应），内滚 |
| `.app.tall` | 高屏变体 | 640px（对话页等长内容用，2 处） |
| `.app-side` | 应用侧栏 | 纵向 flex + `gap:2px` + `overflow:hidden` |
| `.app-brand` / `i` | 品牌区 | `i` 是 20px 品牌色方块内放 10px 文字（如 `ls`），`font-style:normal` 去掉斜体 |
| `.app-side .nav-grp` | 侧栏分组标题 | 纯文本 `<div>`，**不可点击**（无 `a`） |
| `.app-side a` / `a.active` | 导航项 | 选中态 = 品牌色文字 + `--color-brand-subtle` 底 |
| `.app-side .spacer` | 弹性占位 | `flex:1`，把"退出登录"推到底部 |
| `.app-main` | 右侧主区 | 纵向 flex，`min-width:0` + `overflow:hidden` |
| `.app-top` | 应用顶栏 | 48px，面包屑 + 右侧工具区 |
| `.app-top .crumb` / `b` | 面包屑 | `b` 高亮当前段 |
| `.app-top .right` | 右侧区 | `margin-left:auto` 推到最右 |
| `.app-body` | 内容区 | `padding:var(--space-lg)` + `overflow:auto` + `flex:1` + `min-height:0` |
| `.app-body.flush` | 无内边距变体 | 表格/列表铺满（1 处使用） |

**`.right` 与 `.spacer` 的区别**：`.right` 用 `margin-left:auto` 在**同一行 flex** 里推到最右（用于 `.app-top`）；`.spacer` 用 `flex:1` 在**纵向 flex 列**里撑开剩余高度（用于 `.app-side` 底部）。二者不可互换。

### 6.2 原型内的"项目二级导航"（非 CSS 类，行内样式）

§6.4–§6.14 的多数屏在 `.app-top` 与 `.app-body` 之间插一条**行内样式的水平页签条**（表示项目内 ProjectNav），模板未给它抽类名：

```html
<div style="display:flex;gap:4px;align-items:center;padding:6px var(--space-lg);border-bottom:1px solid var(--color-border);background:var(--color-surface)" role="tablist" aria-label="项目导航"><a style="padding:4px 10px;border-radius:var(--radius-sm);font-size:12.5px;background:var(--color-brand-subtle);color:var(--color-brand);font-weight:600">搜日志</a><a style="padding:4px 10px;border-radius:var(--radius-sm);font-size:12.5px;color:var(--color-text-secondary)">搜索配置</a>…</div>
```

**复刻建议**：这段重复了多次，是模板里唯一"该抽类名却没抽"的地方。若要复刻，建议提升为 `.app-subnav` + `.app-subnav a.active`，可省下大量行内样式。

---

## 7. JS 行为全文（原样，48 行）

```js
<script>
// 目录高亮：滚动时把当前小节同步到左侧导航
(function(){
  var links = Array.prototype.slice.call(document.querySelectorAll('.doc-nav a[href^="#"]'));
  var map = {};
  links.forEach(function(a){ map[a.getAttribute('href').slice(1)] = a; });
  var targets = links.map(function(a){ return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  if (!('IntersectionObserver' in window) || !targets.length) return;
  var visible = {};
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
    var best = null, bestRatio = 0;
    Object.keys(visible).forEach(function(id){ if (visible[id] > bestRatio) { bestRatio = visible[id]; best = id; } });
    if (!best) return;
    links.forEach(function(a){ a.classList.remove('active'); });
    if (map[best]) map[best].classList.add('active');
  }, { rootMargin: '-72px 0px -60% 0px', threshold: [0, .25, .5, 1] });
  targets.forEach(function(t){ io.observe(t); });
})();

// 原型里的标签页：只切换展示，不发请求
function activateTab(btn){
  var bar = btn.closest('[data-tabs]');
  Array.prototype.forEach.call(bar.querySelectorAll('button[data-tab]'), function(b){
    b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
  });
  var scope = bar.parentElement;
  var panels = scope ? scope.querySelectorAll('[data-panel]') : [];
  Array.prototype.forEach.call(panels, function(p){
    p.hidden = p.getAttribute('data-panel') !== btn.getAttribute('data-tab');
  });
}
document.addEventListener('click', function(ev){
  var btn = ev.target.closest('[data-tabs] button[data-tab]');
  if (btn) activateTab(btn);
});
// 左右方向键在页签间漫游（WAI-ARIA tabs 键盘约定）
document.addEventListener('keydown', function(ev){
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  var btn = ev.target.closest('[data-tabs] button[data-tab]');
  if (!btn) return;
  ev.preventDefault();
  var all = Array.prototype.slice.call(btn.closest('[data-tabs]').querySelectorAll('button[data-tab]'));
  var i = all.indexOf(btn) + (ev.key === 'ArrowRight' ? 1 : -1);
  var next = all[(i + all.length) % all.length];
  next.focus(); activateTab(next);
});
</script>
```

### 7.1 三段行为的机制

| 段 | 机制 | 要点 |
|---|---|---|
| 目录高亮 | 单个 `IntersectionObserver` 观察所有锚点，用 `visible{}` 累计每目标的最新 `intersectionRatio`，每批回调里取**比值最大者**为当前节 | `rootMargin:'-72px 0px -60% 0px'` 把判定区压到视口中上部（避开 56px 吸顶栏）；`threshold:[0,.25,.5,1]`；**只增删 `.active`，不滚动、不 `scrollIntoView`**（`html{scroll-behavior:smooth}` 负责锚点跳转动画）；无 `IntersectionObserver` 时静默退出（优雅降级） |
| 页签切换 | 事件委托在 `document` 上，用 `ev.target.closest('[data-tabs] button[data-tab]')` 命中；`activateTab` 改同组所有按钮的 `aria-selected`，再在 `bar.parentElement` 范围内按 `data-panel === data-tab` 决定 `hidden` | **作用域是 `parentElement`**——即页签条与面板必须是兄弟节点；样式靠 `[aria-selected="true"]` 而非 class；纯展示，无网络请求 |
| 方向键 | 同样事件委托；`ArrowLeft/ArrowRight` 循环（`(i + len) % len`）移动焦点并同步切换 | 遵循 WAI-ARIA tabs 键盘约定；只处理左右，未处理 Home/End |

### 7.2 页签所需的 DOM 契约

```html
<div class="tabs" data-tabs role="tablist">
  <button data-tab="one" role="tab" aria-selected="false">单次搜索</button><button data-tab="batch" role="tab" aria-selected="true">批量搜索</button><button data-tab="hist" role="tab" aria-selected="false">历史</button>
</div>
<div class="tabpanel" data-panel="one" role="tabpanel" hidden>…</div>
<div class="tabpanel" data-panel="batch" role="tabpanel">…</div>
```

**三个硬约束**：① 容器必须有 `data-tabs`；② 每个按钮必须有 `data-tab="<key>"`；③ 面板必须有 `data-panel="<key>"` 且是 `.tabs` 的**兄弟**。模板共 3 组页签（§6.5 搜索模式、§6.9 客户端监控/发现、§6.12 平台设置三页签）。

---

## 8. HTML 骨架（照抄结构）

### 8.1 `<head>`

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>logsearch · 产品设计文档与界面原型</title>
<meta name="description" content="logsearch 分布式日志搜索平台的产品设计文档：核心概念、架构、时序、模块操作指南与全界面原型（演示数据）。">
<style>/* …全部 CSS… */</style>
</head>
```

### 8.2 图标精灵

```html
<body>

<!-- ===================== 图标精灵（与产品同一套线性图标风格） ===================== -->
<svg class="sprite" aria-hidden="true"><defs>
<symbol id="i-chat" viewBox="0 0 24 24">…</symbol>
<!-- …其余 17 个… -->
</defs></svg>
```

### 8.3 顶栏

```html
<header class="doc-top">
  <div class="doc-brand"><span class="mark"><svg class="icon" style="width:13px;height:13px"><use href="#i-search"/></svg></span> logsearch</div>
  <span class="sep">/</span>
  <h1>产品设计文档 &amp; 界面原型</h1>
  <div class="tools">
    <span class="chip mono">v1 · 2026-09-10</span>
    <span class="chip warn">原型内所有数据均为演示假数据</span>
    <button class="btn sm" onclick="window.print()">打印 / 存 PDF</button>
  </div>
</header>
```

**顶栏固定四件套**：品牌（`.mark` 22px 品牌色方块 + 13px 图标）→ `.sep` 斜杠 → `<h1>` 文档名 → `.tools`（版本 chip + 演示数据警告 chip + 打印按钮）。`.tools` 靠 `margin-left:auto` 自动贴右。

### 8.4 外壳与侧栏

```html
<div class="doc-shell">
  <nav class="doc-nav" aria-label="文档目录">
    <p class="grp">导言</p>
    <a href="#s0">0 · 这份文档怎么读</a>
    <p class="grp">产品</p>
    <a href="#s1">1 · 产品全景</a>
    <!-- … -->
  </nav>

  <main class="doc-main">
    <!-- 11 个 <section class="doc-sec"> -->
  </main>
</div>
```

**侧栏目录结构**：`<p class="grp">分组名</p>` + 若干 `<a href="#锚点">`。模板共 8 个分组（导言 / 产品 / 核心概念 / 架构 / 时序 / 使用指南 / 界面原型 / 附录），链接文案用 `N · 标题` 或 `N.M 标题`。`<a>` 无 `.active` 初始态（由 JS 首次回调写入）。

### 8.5 正文 section 与页脚

```html
  <section class="doc-sec" id="s0">
    <h2>0 · 这份文档怎么读</h2>
    <p class="lead">…</p>
    <!-- 小节 -->
  </section>
  <!-- … s1 … s10 … -->
  </main>
</div>

<footer class="doc-foot" style="max-width:1180px;margin:0 auto;padding:0 var(--space-xl) var(--space-2xl)">
  logsearch · 产品设计文档与界面原型（演示数据）· 生成于 2026-09-10 · 按实现事实修订于 2026-09-16（含造数模板管理与多机扇出补全）· 单文件、离线可读
</footer>

<script>/* … */</script>
</body>
</html>
```

```css
footer.doc-foot{margin-top:var(--space-xl); padding-top:var(--space-md); border-top:1px solid var(--color-border); color:var(--color-text-secondary); font-size:var(--font-size-sm)}
```

**页脚的坑**：`.doc-foot` 的 CSS 只有 `margin/padding/border/color/font-size`，**没有宽度约束**；模板靠行内 `style="max-width:1180px;margin:0 auto;padding:0 var(--space-xl) var(--space-2xl)"` 把它对齐到 `.doc-main` 的 1180px。复刻时建议把这段直接写进 CSS。

---

## 9. 章节写法模板（两个完整范例）

### 9.1 §5 使用指南的固定套路

§5 开篇即声明四段式：**它是什么 / 数据概念 / 界面与操作（逐控件）/ 权限与注意**。

**固定骨架**：

1. `<h3 id="s5-xxx">N.M 模块名</h3>` —— id 供侧栏锚定；
2. `<p><b>它是什么</b>：一句话定位。</p>` —— **第一句必须是"它是什么"**；
3. 可选：`<p class="small muted"><b>与 X 页的分工</b>：…</p>` —— 边界说明；
4. 主体三选一或组合：
   - `<div class="grid g4">` + 多个 `.card`（罗列并列用法）；
   - `<div class="split">` + 两个 `.card`（左「数据概念」用 `<dl class="kv">`，右「界面与操作」用 `<ol class="small">`）；
   - `<table class="tbl compact">`（逐控件三列：控件 / 作用 / 说明）；
5. 收尾：`<p class="small muted"><b>权限</b>：…</p>` 或 `<div class="callout">…<b>注意</b>…</div>`。

**完整范例（§5.5 日志搜索，原文照抄，947–973 行）**

```html
    <h3 id="s5-search">5.5 日志搜索</h3>
    <p><b>它是什么</b>：产品的心脏。四种用法覆盖从“我大概知道要搜什么”到“我只想描述现象”。</p>
    <div class="grid g4">
      <div class="card"><h5 style="margin-top:0">单次搜索</h5><p class="small muted" style="margin:0">选命令 + 关键词 + 时间范围，立刻拿到结果。最常用。</p></div>
      <div class="card"><h5 style="margin-top:0">自然语言搜索</h5><p class="small muted" style="margin:0">如“过去 7 天 heimdallr 的 ERROR 日志”，<b>本地规则解析</b>成命令参数后执行，无需大模型。</p></div>
      <div class="card"><h5 style="margin-top:0">语义搜索</h5><p class="small muted" style="margin:0">一句话描述现象，由 LLM 规划检索（需先配置模型）。</p></div>
      <div class="card"><h5 style="margin-top:0">批量搜索</h5><p class="small muted" style="margin:0">指定命令、并发、每 Worker 请求数与<b>执行机器</b>（默认全部在线、可勾子集），创建批次做扫描或压测。</p></div>
    </div>
    <table class="tbl compact">
      <thead><tr><th style="width:190px">控件</th><th>作用</th><th style="width:250px">说明</th></tr></thead>
      <tbody>
        <tr><td>页签：单次 / 批量 / 历史</td><td>切换搜索模式 / 回看历史</td><td>对话搜索在全局对话工作台（/chat），不在本页</td></tr>
        <tr><td>命令选择</td><td>选择搜索命令模板</td><td>模板内 <span class="mono">{files}</span> 由 Agent 注入文件集合</td></tr>
        <tr><td>关键词</td><td>作为参数进入命令槽位</td><td>只进 argv，不做 shell 拼接</td></tr>
        <tr><td>时间范围</td><td>限定日志时间窗</td><td>影响 Agent 侧文件与行筛选</td></tr>
        <tr><td>「搜索」按钮</td><td>创建 Job 并等待结果</td><td>结果分批回传，页面轮询增量渲染（B1-06 措辞修正：此前写「流式」——实际是 HTTP 轮询分批取回，无推送；「流式」留给真 SSE，见 §10.8）</td></tr>
        <tr><td>结果区 · 级别 / Agent 过滤</td><td>缩小视野</td><td>过滤在前端进行，不重新下发任务</td></tr>
        <tr><td>结果行 · 点击展开</td><td>看上下文与解析字段</td><td>解析字段来自该项目的提取规则</td></tr>
        <tr><td>「下载」</td><td>取完整命中行</td><td>临时 jsonl，24h 内有效</td></tr>
        <tr><td>批量面板「详情」/「取消」</td><td>看子请求结果 / 终止批次</td><td>取消会向各 Agent 下发 <span class="mono">CancelJob</span></td></tr>
        <tr><td>批量详情「重试失败项」</td><td>只重跑失败的子请求</td><td>按创建批次时留存的命令/参数/关键词<b>原样重建</b>；成功与已取消的行不动。参数留存上线前的历史批次明确报错而非换参数</td></tr>
        <tr><td>批量详情 · 失败子请求说明</td><td>失败原因归类中文短标签 + 行动指引</td><td>如「无在线 Agent」「执行超时」；悬停可见错误原文，不丢失排查信息。批次含超时子请求时批级徽标显示「含 N 超时」</td></tr>
        <tr><td>批量详情 · 命中日志汇总</td><td>批次全部子请求命中去重展示</td><td>默认前 <b>1000</b> 条（超出截断展示并提示完整条数）；「下载全部」得完整 jsonl（24h）</td></tr>
        <tr><td>「历史」页签</td><td>单次作业与批量批次统一回看</td><td>单次点行重开结果区（<span class="mono">?job=</span>）；批次点行进详情</td></tr>
      </tbody>
    </table>
    <div class="callout"><p class="small" style="margin:0"><b>结果为什么可能不完整</b>：Agent 侧输出上限 <span class="mono">10MB / 100,000 行</span>，触顶即标记 <span class="mono">partial_success</span>——请缩小时间范围或加关键词，而不是反复重跑。</p></div>
```

**可复用的细节约定**：

- 表格 `<th>` 用行内 `width` 固定前两列、最后一列自适应；表头三列固定语义为**控件 / 作用 / 说明**；
- `<div class="callout"><p class="small" style="margin:0">` —— callout 内必须包一层 `<p class="small" style="margin:0">`，否则会有默认段落边距；
- 技术名词一律 `<span class="mono">` 包裹（如 `{files}`、`CancelJob`、`?job=`）；HTML 里的 `<` `>` 必须写成 `&lt;` `&gt;`；
- 需要强调的用 `<b>`，不用 `<strong>`（模板全文统一用 `<b>`）。

### 9.2 §6 界面原型的固定套路

**固定骨架（四件套，顺序不可变）**：

```html
<h3 id="pN">6.N 页面名</h3>
<p class="proto-note"><span class="chip warn">演示数据</span>这一段说明这屏的关键交互、状态语义与实现状态标注。</p>
<div class="proto">
  <div class="proto-bar"><span class="dots"><i></i><i></i><i></i></span><span class="url">/loggen/真实路由</span><span class="fake">演示数据</span></div>
  <div class="app">              <!-- 或 class="app tall" -->
    <aside class="app-side">…侧栏（每个原型都完整重复一遍）…</aside>
    <div class="app-main">
      <div class="app-top"><span class="crumb">…</span><span class="right">…</span></div>
      <!-- 可选：项目二级导航行 -->
      <div class="app-body">…该屏内容…</div>
    </div>
  </div>
</div>
```

**完整范例（§6.1 登录，原文照抄，1218–1233 行 —— 最短的完整原型）**

```html
    <h3 id="p1">6.1 登录</h3>
    <p class="proto-note"><span class="chip warn">演示数据</span>无自助注册；账号由平台管理员创建。失败提示不区分“用户不存在 / 密码错误”。</p>
    <div class="proto">
      <div class="proto-bar"><span class="dots"><i></i><i></i><i></i></span><span class="url">/loggen/login</span><span class="fake">演示数据</span></div>
      <div style="background:var(--color-bg); padding:var(--space-2xl) var(--space-lg); display:grid; place-items:center; min-height:360px">
        <div class="panel" style="width:340px; padding:var(--space-lg)">
          <div class="app-brand" style="padding:0 0 var(--space-md); font-size:15px"><i style="width:26px;height:26px">ls</i><span>logsearch</span></div>
          <div class="rows">
            <div class="field"><label>用户名</label><div class="input">zhang.gong</div></div>
            <div class="field"><label>密码</label><div class="input mono">••••••••••</div></div>
            <button class="btn primary" style="justify-content:center">登录</button>
          </div>
          <p class="tiny muted" style="margin:var(--space-md) 0 0">登录即写入审计；连续失败不会锁号，但会持续留痕。</p>
        </div>
      </div>
    </div>
```

**带页签的变体（§6.5 关键片段，原文照抄，1444–1450 行）**

```html
            <div class="tabs" data-tabs role="tablist">
              <button data-tab="one" role="tab" aria-selected="false">单次搜索</button><button data-tab="batch" role="tab" aria-selected="true">批量搜索</button><button data-tab="hist" role="tab" aria-selected="false">历史</button>
            </div>
            <div class="tabpanel" data-panel="one" role="tabpanel" hidden>
              <div class="callout"><p class="small" style="margin:0">单次搜索是同一个页面的默认模式：选中命令、填关键词与时间范围，结果直接在本屏展示。完整界面见 <a href="#p4">6.4 单次搜索</a>。</p></div>
            </div>
            <div class="tabpanel" data-panel="batch" role="tabpanel">
            <div class="panel">
              <p class="panel-title">创建批量搜索批次</p>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
                <div class="field"><label>命令</label><div class="input">nginx_access（v4） <span style="margin-left:auto">▾</span></div></div>
                <div class="field"><label>并发</label><div class="input mono">4</div></div>
                <div class="field"><label>Req/Worker</label><div class="input mono">25</div></div>
                <div class="field"><label>关键词集</label><div class="input mono">502, 504, timeout</div></div>
                <div class="field"><label>&nbsp;</label><button class="btn primary">创建批次</button></div>
              </div>
            </div>
```

**§6 侧栏的标准写法**（每个原型都完整重复，不含折叠）：

```html
        <aside class="app-side">
          <div class="app-brand"><i>ls</i><span>logsearch</span></div>
          <div class="nav-grp">工作区</div>
          <a><svg class="icon"><use href="#i-chat"/></svg>对话</a>
          <a class="active"><svg class="icon"><use href="#i-folder"/></svg>项目</a>
          <a><svg class="icon"><use href="#i-scene"/></svg>场景</a>
          <a><svg class="icon"><use href="#i-grid"/></svg>工作台</a>

          <div class="nav-grp">平台</div>
          <a><svg class="icon"><use href="#i-shield"/></svg>权限矩阵</a>
          <a><svg class="icon"><use href="#i-gear"/></svg>平台设置</a>
          <a><svg class="icon"><use href="#i-audit"/></svg>审计日志</a>

          <div class="nav-grp">更多</div>
          <a><svg class="icon"><use href="#i-download"/></svg>客户端下载</a>

          <div class="spacer"></div>
          <a>退出登录</a>
        </aside>
```

**注意**：侧栏三分域（工作区 / 平台 / 更多）顺序固定，**每个原型里逐字重复**（13 次）。分组间用空行分隔（无分隔线，符合 §10 里"分组标题不可点击、禁分隔线/计数/折叠"的规范）。当前页用 `class="active"`。

**§6 内容区的常用写法**：

- 页头：`<p class="h1">项目</p>`；
- 卡片网格：`<div class="grid g3">` + `<div class="panel">`（内含 `<div class="h2p">` 标题 + `<p class="small muted" style="margin:0">` 描述 + `<span class="chip ok">` 状态）；
- 表格：`<table class="tbl compact">`；
- 表单：`.field` + `.input`（`.input mono` 用于数值/命令），空标签位用 `<label>&nbsp;</label>` 保持对齐；
- 结果区：`<div class="logview">` + `.lv-err/.lv-warn/.lv-info/.lv-dim` span。

---

## 10. 占位 / 标注约定

| 约定 | 位置 | 写法 | 作用 |
|---|---|---|---|
| **演示数据 chip** | `.proto-note` 首元素 + `.proto-bar .fake` | `<span class="chip warn">演示数据</span>` / `<span class="fake">演示数据</span>` | 双保险声明"数据是假的"；14 个原型 × 2 处 = 28 次 |
| **免责 callout** | §6 章首 | `<div class="callout warn"><p class="small" style="margin:0">原型用途是"对齐形态与流程"，不是像素级设计交付。真实页面中的按钮启用态、空态与错误态由角色与数据决定，请以 §5 的模块说明为准。</p></div>` | 全章级免责，只出现 1 次 |
| **顶栏警告 chip** | `.doc-top .tools` | `<span class="chip warn">原型内所有数据均为演示假数据</span>` | 全页级声明，任何时候可见 |
| **proto-note 写法** | 每个 `<h3 id="pN">` 之后、`.proto` 之前 | `<p class="proto-note"><span class="chip warn">演示数据</span>说明文字…</p>` | 必须**紧贴 chip 无空格**（`.proto-note` 是 flex，chip 有 `flex:0 0 auto`）；文字讲"这屏的关键交互 + 状态语义 + 实现状态" |
| **实现状态标注** | `proto-note` 内 | `✅ A2 已实施：…` / `<span class="chip warn">⏳ 待实施</span>…（见 §10.9）` | 用 emoji + 决策编号（A2/A3/B1/E4）标注"文档 vs 实现"的差距，并交叉引用附录章节 |
| **措辞修正留痕** | 正文行内 | `（B1-06 措辞修正：此前写「流式」——实际是 HTTP 轮询分批取回，无推送；「流式」留给真 SSE，见 §10.8）` | 不删旧说法，改为"修正说明 + 编号 + 附录引用" |
| **角色缩写 chip** | 表格单元格 | `<span class="chip brand">A</span> admin · <span class="chip">S</span> secops` | 用 chip 承载 A/S/PA/M 四个角色缩写 |
| **状态 chip 语义** | 原型表格 | `.chip ok`=completed/在线 · `.chip warn`=paused/离线 · `.chip danger`=canceled/失败 · `.chip`（默认）=running/中性 | 三色 + 中性四态，**running 用中性色**（不预设成功/失败） |
| **等宽占位** | 全文 | `<span class="mono">` 包技术名词、路由、字段名、枚举值、命令 | 全模板 601 次，是最强的排版习惯 |

**禁用/未提供的写法（明确记录）**：

- **未提供暗色主题**：无 `prefers-color-scheme`、无 `.dark`、无 `[data-theme]`。若需暗色，必须自行新增（tokens 已全部变量化，替换 `:root` 即可，但 `.logview` 的 4 个硬编码色与 `.chip.*` 的 `color-mix` 需同步检查）。
- **未提供导航折叠/汉堡菜单**：窄屏直接摊平。
- **未提供代码高亮**：`.logview` 只有 4 个级别色，不是语法高亮器。
- **未提供图表库/SVG 拓扑**：所有图（分层、时序、状态机）都是 div/table + CSS 拼的。
- **未提供搜索框、回到顶部、侧栏折叠、目录滚动跟随**：目录高亮是唯一"跟随"行为，且只高亮不滚动。
- **未提供 `.callout.ok`**：CSS 里不存在，需自行新增。
- **未提供 `.grid` 的固定列数类**：只有 `.g2/.g3/.g4` 三种 `auto-fit` 预设。
- **未提供 `.app` 的自适应高度**：`.app` 固定 560px / `.app.tall` 640px，不随内容或视口变化（≤1000px 时才变 `height:auto`）。

---

## 11. 构建规范小结：复刻同款文档的必做清单

**要复刻同款单文件文档，按顺序包含以下 9 块 CSS 与 6 段 HTML 骨架。**

### 阶段 A —— CSS（共 158 个规则块，按 9 块组织）

1. **`:root` Design tokens 块**（1 个规则）
   全部颜色（品牌 4 / 背景 3 / 文字 4 / 描边 2 / 语义 4 / 终端底 3）、间距 6 档、圆角 3 档、字体 2 组、字号 6 档。**必须 hex + oklch 同名双写**。

2. **全局基座块**（8 个规则）
   `*{box-sizing}`、`html{scroll-behavior:smooth}`、`body{font:字号/行高 字族}`、`a` / `a:hover`、`code,.mono`、`:focus-visible`。

3. **文档骨架块**（32 个规则）
   `.doc-top` / `.doc-brand` / `.mark` / `.doc-top h1` / `.sep` / `.tools`；`.doc-shell`（`272px minmax(0,1fr)`）；`.doc-nav`（`sticky top:56px height:calc(100vh - 56px) overflow-y:auto`）+ `.grp` + `a` + `a:hover` + `a.active`；`.doc-main`（`min-width:0 max-width:1180px`）；`section.doc-sec` + `:first-of-type`；`h2`–`h5`、`p`、`ul,ol`、`li`；`.lead` / `.muted` / `.small` / `.tiny` / `hr`。

4. **通用块块**（26 个规则）
   `.card` / `.card.pad-lg`；`.grid` / `.g2` / `.g3` / `.g4` / `.split`；`.chip` + 4 变体 + `.mono`；`.callout` + `warn` / `danger` + `h5`；`table.tbl` 全套（`th`/`td`/`last-child`/`td.mono`/`grp-row`/`compact`）；`.icon` / `.sprite`；`.btn` 全套（`hover`/`primary`/`primary:hover`/`sm`/`link`/`disabled`）；`.kv` + `dt`/`dd`；`.metric` / `.metric-label`。

5. **图块块**（21 个规则）
   `.diagram` / `.layer` / `.layer.brand` / `.layer h5` / `.layer .row` / `.pill` / `.pill.mono` / `.arrow-v` / `.arrow-v small` / `.node` / `.node strong` / `.node span` / `.flow` / `.flow .step` / `.flow .to`；`figure` / `figcaption`；`.seq-wrap` / `table.seq` 全套 17 个规则（含 `td.msg`、`.arrow`、`.arrow.rtl`、`::after`、`.rtl::after`、`.dash`、`.label`、`.label b`、`.label .n`、`td.note`）。

6. **原型外壳块**（26 个规则）
   `.proto` / `.proto-bar` / `.dots` / `.dots i` / `.url` / `.fake`；`.app` / `.app.tall` / `.app-side` / `.app-brand` / `.app-brand i` / `.app-side .nav-grp` / `.app-side a` / `.app-side a.active` / `.app-side .spacer` / `.app-main` / `.app-top` / `.crumb` / `.crumb b` / `.right` / `.app-body` / `.app-body.flush`。

7. **原型组件块**（24 个规则）
   `.panel` / `.panel-title` / `.h1` / `.h2p`；`.field` / `.field label` / `.input,.select` / `.input.mono` / `.input.placeholder`；`.rows`；`.tabs` / `.tabs button` / `.tabs button[aria-selected="true"]` / `.tabpanel[hidden]`；`.logview` + `.lv-err` / `.lv-warn` / `.lv-info` / `.lv-dim`；`.progress` / `.progress i`；`.proto-note` / `.proto-note .chip`；`footer.doc-foot`。

8. **响应式块**（3 个 `@media`）
   `max-width:900px`（`.split` 单栏）；`max-width:1000px`（文档单栏 + 侧栏 static + `.app` 单栏 + `.app-side` 横向滚动 + 隐藏 `.nav-grp` 与品牌文字）；`max-width:760px`（表格独立横滚 + `th` 换行 + `.proto .app-body` 收窄 + `.tools` 换行）。

9. **打印块**（1 个 `@media print`）
   隐藏 `.doc-top` / `.doc-nav`，`.doc-shell` 单栏，`.app`/`.proto` 不断页，`section.doc-sec` 前分页。

### 阶段 B —— HTML 骨架（6 段）

10. **`<head>`**：`lang="zh-CN"` + `charset` + `viewport` + `<title>`（`产品名 · 文档名`）+ `<meta name="description">` + 内联 `<style>`。
11. **图标精灵**：`<svg class="sprite" aria-hidden="true"><defs>` + 18 个 `<symbol viewBox="0 0 24 24">`，`<use href="#i-xxx"/>` 引用（**至少需要 8 个侧栏图标 + `i-search`**）。
12. **顶栏**：`.doc-top` = `.doc-brand`（`.mark` + 名称）+ `.sep` + `<h1>` + `.tools`（版本 chip + 演示数据 warn chip + 打印按钮）。
13. **两栏外壳**：`.doc-shell` > `nav.doc-nav`（`<p class="grp">` + `<a href="#h3-id">`，8 个分组）+ `main.doc-main`。
14. **正文**：11 个 `<section class="doc-sec" id="sN">`，每个 = `<h2>N · 标题</h2>` + `<p class="lead">` + 若干 `<h3 id="…">` 小节；§5 用四段式套路，§6 用 proto-note + proto 四件套。
15. **页脚 + 脚本**：`<footer class="doc-foot">`（建议把 1180px 宽度约束写进 CSS）+ 48 行 `<script>`（IntersectionObserver 目录高亮 + `activateTab` 页签 + 方向键）。

### 阶段 C —— 验收检查

16. **零外部依赖**：无 `<link>`、无 `<img>`、无 `http` 引用；字体全靠 `font-family` 回退链。
17. **页签 DOM 契约**：容器 `data-tabs` / 按钮 `data-tab` / 面板 `data-panel` 且与 `.tabs` 同级，选中态只走 `aria-selected`。
18. **锚点契约**：侧栏 `href="#X"` 必须对应一个 `<h3 id="X">` 或 `<section id="X">`，否则 IntersectionObserver 的 `targets` 会过滤掉它（不报错但不高亮）。
19. **三处"演示数据"声明**：顶栏 chip、`.proto-bar .fake`、每个 `.proto-note` 首元素。
20. **窄屏三档自查**：1000px（侧栏摊平、`.app` 单栏）、760px（表格独立横滚）、打印（隐藏导航 + 每节分页）。

### 复刻时最容易踩的 5 个坑

1. `.doc-nav` 的 `top:56px` 与 `.doc-top` 的 `height:56px` **必须一致**，否则吸顶错位；改一处必须改另一处。
2. `.doc-main` 与 `.app-main` 的 `min-width:0` **不能省**，否则宽表格会把栅格撑破（这是 `minmax(0,1fr)` 之外的第二道保险）。
3. `.split` 是 `minmax(0,1fr) minmax(0,1fr)` 严格对半，**不是** `auto-fit`；换成 `auto-fit` 会破坏「数据概念 | 界面与操作」的左右对照关系。
4. `.callout` 内必须包 `<p class="small" style="margin:0">`，否则段落默认 `margin:0 0 var(--space-sm)` 会撑高 callout。
5. `.proto-note` 是 `display:flex`，chip 与文字之间**不要加空格或 `<br>`**，直接相邻即可（`gap` 负责间距）。
