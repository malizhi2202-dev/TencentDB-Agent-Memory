



















## 1. React + Babel 三条硬规则（**不可协商**）

这三条单独拿出来都像小事，实际上每一条都是 AI 写出 bug 然后回头 debug 两小时的高频事故源。

### 1.1 禁止用 `const styles = {...}` 作全局变量名

**问题**：多个 `<script type="text/babel">` 文件里都声明 `const styles` → 在浏览器端编译后它们会在同一作用域下互相**静默覆盖**，导致某些组件样式"莫名其妙失效"。

**正确**：用组件名做命名空间：

```jsx
const terminalStyles = { container: { ... }, line: { ... } };
const headerStyles = { wrap: { ... } };
```

或直接用内联 `style={{...}}`。**绝对不要**用 `styles` 做变量名。

### 1.2 跨文件组件必须 `Object.assign(window, {...})`

**问题**：独立的 `<script type="text/babel">` 块**作用域不共享**。你在 `Header.jsx` 里定义的 `<Header />`，在 `App.jsx` 里直接用会报 `Header is not defined`。

**正确**：组件定义文件尾部显式挂 `window`：

```jsx
function Terminal() { /* ... */ }
function Line() { /* ... */ }

Object.assign(window, { Terminal, Line });
```

### 1.3 禁用 `scrollIntoView`

**问题**：iframe 嵌入的预览环境（code-kit 的大部分调试场景 + 在线预览工具都算）里，`scrollIntoView` 会触发外层 frame 的滚动，造成视觉错乱甚至把用户卷出预览区。

**正确**：用 `element.scrollTop = ...` 或 `window.scrollTo({ top: ..., behavior: 'smooth' })`。

### 1.4 React CDN 版本必须固定

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"
        integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L"
        crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"
        integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm"
        crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"
        integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y"
        crossorigin="anonymous"></script>
```

**禁止**：在 React CDN `<script>` 标签上加 `type="module"`（会破坏 Babel 转译管线）。

**导入顺序固定**：React → ReactDOM → Babel → 你的组件文件（每个都是 `<script type="text/babel" src="...">`）。

---

## 2. CSS 硬规则

### 2.1 颜色一律来自 UI-DESIGN.md

- 颜色必须 OKLCH（遗留 hex 必须在 UI-DESIGN.md 里显式声明例外）
- 组件代码里**禁止**硬编码颜色字面值（`#fff` / `rgb(...)` / 原生色名）
- 所有颜色通过 CSS custom properties 读取：`var(--color-brand)` / `var(--color-text-primary)`

### 2.2 布局优先级

- **CSS Grid + Flexbox** 做主布局（不用 `float` / `position: absolute` 做布局）
- **`text-wrap: pretty`** 处理段落折行
- **`clamp(min, fluid, max)`** 做流体字号
- **`@container` queries** 做组件级响应（比媒体查询更适合组件复用）

### 2.3 主题适配

- `@media (prefers-color-scheme)` 处理暗色（除非 UI-DESIGN.md 明说不做）
- `@media (prefers-reduced-motion)` 处理动效降级（任何大于 200ms 的动画都要在此 disable）

### 2.4 字体硬禁

**默认禁止直接引用**（不管 UI-DESIGN.md 里有没有）：

- Inter
- Roboto
- Arial
- Helvetica
- system-ui（仅作 fallback 最后一项可以）
- Fraunces

理由：这些字体构成典型 AI-slop 视觉指纹。UI-DESIGN.md 的 2a 阶段已经选定别的字体，4-dev 阶段只需要按 UI-DESIGN.md 写，不要额外引入。

---

## 3. 文件管理规则

### 3.1 文件名


(Showing lines 21-115 of 341. Use offset=116 to continue.)