---
name: Enterprise Agent Memory Workbench
description: 工程化、克制、单一蓝色强调的企业记忆治理工作台；证据优先，状态透明，危险动作默认阻断。
colors:
  brand: "oklch(0.62 0.19 255)"
  brand-deep: "oklch(0.48 0.19 255)"
  bg: "oklch(0.985 0.008 250)"
  surface: "oklch(1 0 0)"
  text-primary: "oklch(0.24 0.02 255)"
  text-secondary: "oklch(0.45 0.025 255)"
  text-tertiary: "oklch(0.58 0.02 255)"
  border: "oklch(0.9 0.018 255)"
typography:
  display: { fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600, lineHeight: 1.1, italic: false }
  headline: { fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2 }
  title: { fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }
  body: { fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.5 }
  body-lead: { fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "1rem", fontWeight: 400, lineHeight: 1.6 }
  supporting: { fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.5 }
  label: { fontWeight: 600, textTransform: uppercase, letterSpacing: "0.06em" }
  micro-label: { fontSize: "0.6875rem", letterSpacing: "0.08em" }
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.75rem" }
spacing: { xs: "8px", sm: "16px", md: "24px", lg: "32px", xl: "48px", "2xl": "80px", "3xl": "120px" }
rounded: { none: "0", sm: "4px", md: "8px", lg: "12px", xl: "16px" }
motion: { ease-out: "cubic-bezier(0.2, 0.7, 0.3, 1)", ease-out-quint: "cubic-bezier(0.22, 1, 0.36, 1)", duration-fast: "150ms", duration-base: "240ms", duration-slow: "400ms" }
shadow: { hover-lift: "none", card-lifted: "none", accent-glow: "none" }
---

# UI Design: Enterprise Agent Memory Workbench

## 0. 视觉语汇对齐

- **Token 源**：`code-kit` 默认 web-design 规则与 `.specs/final-v1/product-prototype.html`，本 change 不修改历史文件。
- **主色实际比例**：单一蓝色只用于链接、状态点、选中项和轻量提示；主按钮使用近黑/暗色中性。
- **中性色**：近白蓝灰背景、白色表面、细灰边框；暗色模式为纯黑背景。
- **hover / focus**：只改变颜色和边框；focus-visible 使用 3px 中性 ring。
- **动效语言**：150–240ms，减少动效支持关闭；不使用装饰性渐变或阴影。
- **卡片密度**：管理台中高密度，1px border，8–12px radius；不嵌套 card 套 card。
- **图标库**：无外部图标库；使用文本符号和 aria-label，避免 emoji。
- **文案调性**：中文、工程化、中性；明确“未知/部分/待验证”，不使用夸大成功词。

## 1. 美学北极星

**Evidence Console**：像一个安静的工程控制台，而不是营销 SaaS。用户第一眼看到当前 scope、证据状态和下一门槛；边框代替阴影，蓝色只标记可行动和可追踪。

## 2. 4 个决策问题

- **目的**：让团队理解记忆、知识、派生副本、权限和清理证据，并安全完成分流/审核/报告查看。
- **调性**：极简 + 工业。理由：治理工作需要高信息密度和可审计性，不应靠装饰分散注意力。
- **约束**：离线 HTML 原型、零外部依赖、中文、WCAG 2.1 AA、暗色模式、响应式。
- **差异化**：每个状态同时显示“范围 + 证据时间 + 责任边界 + 下一门槛”，拒绝用单一绿色标签掩盖未知。

## 3. 颜色系统

- **Brand blue** `oklch(0.62 0.19 255)`：链接、active tab、轻量状态点；绝不用于整块背景或所有按钮。
- **Neutral background** `oklch(0.985 0.008 250)`：主背景；避免纯白刺眼。
- **Surface** `oklch(1 0 0)`：卡片和表面。
- **Text** `oklch(0.24 0.02 255)` / secondary `oklch(0.45 0.025 255)`。
- **Border** `oklch(0.9 0.018 255)`：所有卡片和分隔使用 hairline。

## 4. 字体系统

系统无衬线字体；代码和状态值使用系统等宽字体。标题只用 600 字重，正文 14px / 1.5；不引入 CDN 字体。

## 5. 间距、圆角、动效

使用 frontmatter token；按钮/输入 4–8px，卡片 12px；无 hover lift、渐变和内容阴影；窄屏单列。

## 6. 关键组件规约

- **Primary Button**：近黑背景、白字、6px radius；仅用于明确动作；高风险动作显示 blocked/审批要求而非直接 primary。
- **Secondary Button**：表面背景、1px border；用于过滤、查看证据和取消。
- **Status chip**：圆角胶囊；颜色不是唯一信息，必须附文字和证据/范围。
- **Evidence card**：标题、状态、范围、时间、责任人、证据链接和下一门槛；unknown 使用显式中性警示。
- **Navigation**：侧栏分为工作、知识、治理、组织；当前 scope 在顶部显示。
- **Table**：宽表在局部横向滚动容器内；移动端转为 stacked rows。
- **Modal/Drawer**：Esc 关闭，焦点返回触发器；原型中使用 details/panel 模式。

## 7. Do's and Don'ts

### Do

- 先展示 scope、权限、来源和证据，再展示动作。
- 对 `unknown`、`partial`、`retained`、`stale` 使用文字说明和下一步。
- 让 Triage、清理、报告和 RunGate 页面可从状态直接进入。
- 所有 icon-only 控件有 aria-label，所有假数据标记为 SAMPLE。

### Don't

- 不把治理中心做成泛化 Asset 库。
- 不用大面积蓝色、渐变、阴影、emoji、虚构 KPI 或“已清理”万能标签。
- 不在模板渲染后才做跨租户字段过滤。
- 不把只读原型当成真实授权、删除或通知系统。

## 8. 占位符策略

| 缺的东西 | 原型策略 | 禁止 |
|---|---|---|
| 图标 | 文本符号/按钮文字 | emoji 图标、外部 icon CDN |
| 数据 | SAMPLE / 合成数据标记 | 编造真实客户、KPI 或凭据 |
| 证据 | 明确 `evidence ref` 和状态 | 声称真实删除/通知已发生 |
| 图片 | 不使用图片 | stock photo / AI 人脸 |

## 9. 反 AI-slop 自检结果

- [x] 字体类禁忌：未命中
- [x] 颜色类禁忌：未命中
- [x] 阴影类禁忌：未命中
- [x] 边框类禁忌：未命中
- [x] 动效类禁忌：未命中
- [x] 布局类禁忌：未命中
- [x] 文案类禁忌：未命中
- [x] 组件类禁忌：未命中

## 10. 触发任务

- T-UI-01：将 token 物化为原型 CSS 变量。
- T-UI-02：实现侧栏、scope switcher、状态 chip、证据卡和表格。
- T-UI-03：实现 Project → Task → Run、Triage、Agent、清理、报告深链。
- T-UI-04：实现 loading/empty/partial/denied/error/offline/stale/success 状态展示。
- T-UI-05：运行 HTML/JS 静态检查和浏览器人工 UAT。
