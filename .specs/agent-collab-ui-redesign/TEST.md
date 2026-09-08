# TEST: MemoryPanel UI 重构 —— Agent 协作平台

- **Change ID**: agent-collab-ui-redesign
- **关联**: `@.specs/agent-collab-ui-redesign/REQUIREMENT.md`、`@code-kit/reference/test-pyramid.md`
- **项目类型**: Web 前端（内部工具 · UI 骨架，无后端 / 无 schema 变更）

---

## 0. 本次测试范围声明（5 轮金字塔）

| 轮次 | 状态 | 范围 | 跳过理由 |
|---|---|---|---|
| 第 1 轮 · 功能 | ✅ 必跑 | 全部 AC-1~AC-6（Playwright e2e 脚本自动化） | — |
| 第 2 轮 · 性能 | ⚠️ 部分 | LCP + bundle size | 内部工具不苛刻；无历史基线，按预算判定 |
| 第 3 轮 · 安全 | ⚠️ 部分 | 依赖（pnpm audit）+ 秘钥 + SAST（ESLint） | 纯前端骨架无新增敏感面，OWASP 减项 |
| 第 4 轮 · 兼容 | ✅ 必跑 | Chrome/Chromium + 多视口 | 与现有面板一致（Edge 同 Chromium 内核） |
| 第 5 轮 · 可观测 | ❌ 跳过 | — | REQUIREMENT 明确「无新增埋点要求」 |

---

## 第 1 轮 · 功能测试

### 1.1 测试矩阵（AC → 用例）

| AC | 类型 | 用例 / UAT | 状态 |
|---|---|---|---|
| AC-1 导航信息架构 | e2e | Playwright：分组 + 菜单项断言 | ✅ |
| AC-2 视觉保持 + 布局 | e2e + build | Playwright 双列栅格 + `tsc --noEmit` | ✅ |
| AC-3 协作项目 7 Tab | e2e | Playwright 访问 `/projects/:id` | ✅ |
| AC-4 Agent 4 Tab | e2e | Playwright 访问 `/team/agents/:id` | ✅ |
| AC-5 记忆空间入口 | e2e | Playwright 访问 `/memory-spaces` + 详情 | ✅ |
| AC-6 旧功能不回归 | e2e + build | Playwright 遍历旧路由 + `npm run build` | ✅ |

### 1.2 UAT 脚本（自动化 e2e 结果）

> 纯 UI 骨架，AC 全部用 Playwright 自动化跑过（等价手动 UAT）。执行环境：5174 vite dev + 真实登录态。

**AC-1 导航**：分组 = `[协作项目, <当前团队名>, 记忆空间, 资产]`（工作台为 pinned 顶部）；菜单项缺失 = `[]` ✅
**AC-2 布局**：`._memory-workbench-grid` / `-main` / `-context` 均存在；`tsc --noEmit` exit 0 ✅
**AC-3**：`任务拆解/交付物/决策/OKR/规约心智/工作空间/记忆空间` 7/7 出现在详情页 ✅
**AC-4**：`基础/执行环境/绑定/API` 4/4 出现在 Agent 详情 ✅
**AC-5**：owner 过滤 `Team/Project/Agent/User` 全出现；详情页 `._memory-detail-page` + Brain 标签 ✅
**AC-6**：`/wiki /code /skills /memory /analysis /team/members /team/api-keys` 7/7 打开正常；`npm run build` exit 0 ✅
**页面错误**：0 ✅

### 1.3 覆盖率

纯前端 UI 骨架（页面 + 空态，无业务逻辑分支），行覆盖不适用；以「AC 覆盖 6/6」替代。`tsc --noEmit` exit 0 作为静态类型门槛。

### 1.4 边界 / 错误路径用例

- 空：项目/Agent 详情访问 `demo-id` 占位（无真实数据）→ 空态正常渲染 ✅
- 无权限 / 未登录：LoginGate 拦截（未登录访问时跳登录页）✅
- 旧路由兼容：`/graph → /analysis` 重定向 + legacy hash 兼容（`legacyHashToPath` 保留）✅

### 1.5 测试质量自检（6 维测试衰退风险）

未装 brooks-lint，走内置 T1~T6 快查。本次无新增「项目内测试文件」（用一次性 Playwright e2e 脚本 + 手动 UAT 覆盖），T1~T6 均无命中对象。

| 编号 | 衰退风险 | 命中 | 说明 |
|---|---|---|---|
| T1 | Test Obscurity | 0 | e2e 断言以 AC 文本为索引，可读 |
| T2 | Test Brittleness | 0 | 断言外部行为（DOM 文本/类名），非内部实现 |
| T3 | Test Duplication | 0 | 每 AC 一条 e2e，无重复 |
| T4 | Mock Abuse | 0 | 无 mock（真实登录态 + 真实 DOM） |
| T5 | Coverage Illusion | 0 | 每条断言有真实 DOM 文本/类名命中 |
| T6 | Architecture Mismatch | 0 | UI 骨架用 e2e（DOM）验证，层级匹配 |

### 1.6 测试质量记事

无。

---

## 第 2 轮 · 性能测试

### 2.1 性能预算（REQUIREMENT 非功能性需求）

```yaml
frontend:
  LCP: < 2.5s
  main_bundle: < 200KB gzip  # test-pyramid 默认（内部工具，记录不阻断）
```

### 2.2 实测结果

| 指标 | 预算 | 实测 | 上版基线 | 判定 |
|---|---|---|---|---|
| LCP | < 2.5s | 896ms | 无（首次 UI 重构） | ✅ 达标 |
| DOMContentLoaded | — | 425ms | — | ✅ |
| 主包 gzip | < 200KB | 706KB | 无 | ⚠️ 超预算（历史债，见 2.4） |

### 2.3 工具输出

```text
# build 输出（vite build）
dist/assets/main-D2q61Um0.js  2,844.14 kB │ gzip: 706.06 kB
✓ built in 38.08s
```

### 2.4 退步项处理

- ⚠️ 主包 706KB gzip 超 200KB 默认预算：**非本次 change 引入**。体积主要来自代码图谱 / 图形库（cytoscape、katex、mermaid、sigma/graphology），本次 UI 骨架仅新增轻量页面组件。记入 backlog（`code-splitting / manualChunks` 优化），不在本 UI 骨架 change 范围内。

---

## 第 3 轮 · 安全测试

### 3.1 依赖漏洞

```bash
$ pnpm audit --prod
8 vulnerabilities found
Severity: 1 low | 7 moderate
```

- High / Critical：**0** ✅
- 处理：7 moderate + 1 low 全部来自 `hono` / `@hono/node-server`（面板 Control 后端代理框架的传递依赖，升级至 `hono >= 4.12.34` 可修）。本次前端 UI 骨架未新增依赖，属 MemoryPanel 后端依赖升级 backlog，**接受**。

### 3.2 秘钥扫描

```bash
$ grep -rnE "sk-mem-[A-Za-z0-9]{8,}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|AKIA[0-9A-Z]{16}" src/
```

- 命中：0 真实秘钥（仅 i18n 文案里的 `sk-mem-xxxxxxxxxxxxxxxx` 占位示例）✅
- rotate：N/A

### 3.3 SAST

- 工具：ESLint（web 内置 `lint:check`）
- 本次改动文件 10 个：**0 error** ✅
- 全库 3 个 error 均在本次 change 之外的旧文件（`code-detail-view.tsx` 条件调用 Hook、`no-empty`），记 backlog

### 3.4 OWASP Top 10（纯前端 UI 骨架，减项）

| 项 | 状态 | 备注 |
|---|---|---|
| A01 越权 | ❌ 不适用 | 无新增后端接口；沿用现有 session/RBAC 门禁 |
| A02 加密失败 | ❌ 不适用 | 无新增敏感数据面 |
| A03 注入 | ❌ 不适用 | 无新增输入处理逻辑（骨架 + 空态） |
| A04 不安全设计 | ❌ 不适用 | 纯展示骨架 |
| A05 配置错误 | ❌ 不适用 | 无新增服务配置 |
| A06 漏洞组件 | 🟡 待处理 | 见 3.1（0 high/critical，hono 7 moderate 记 backlog） |
| A07 鉴权 | ❌ 不适用 | 沿用现有 LoginGate / session |
| A08 数据完整性 | ❌ 不适用 | 无新增数据写路径 |
| A09 日志监控 | ❌ 不适用 | 见第 5 轮（跳过） |
| A10 SSRF | ❌ 不适用 | 无新增网络请求 |

---

## 第 4 轮 · 兼容性测试

### 4.1 跨浏览器

| 浏览器 | 内核 | 状态 |
|---|---|---|
| Chrome（最新-1）| Chromium | ✅（Playwright Chromium 实测） |
| Edge（最新-1）| Chromium（同内核）| ✅（同内核等价，与现有面板一致） |

### 4.2 视口

| 视口 | 栅格列 | 横向溢出 | 侧边栏 | 状态 |
|---|---|---|---|---|
| 360 (mobile) | 单列 | 无 | 可见 | ✅ |
| 768 (tablet) | 单列 | 无 | 可见 | ✅ |
| 1024 (laptop) | 单列 | 无 | 可见 | ✅ |
| 1440 (desktop) | 双列 2fr/1fr | 无 | 可见 | ✅ |

> `< 1100px` 降单列、`≥ 1100px` 双列，响应式栅格按 DESIGN 生效；页面错误 0。

### 4.3 数据迁移

❌ 不适用（本次无 schema 变更，见 REQUIREMENT out 段）。

### 4.4 跨版本

- 旧路由 + legacy hash 重定向（`legacyHashToPath`）保留，AC-6 验证通过 ✅

---

## 第 5 轮 · 可观测性验证

❌ 跳过：REQUIREMENT 明确「无新增埋点要求」。

---

## 新增测试登记

| 用例 | 类型 | 覆盖 AC | 轮次 |
|---|---|---|---|
| Playwright e2e（`/tmp/verify-ac.js`）| e2e | AC-1~AC-6 | 1 |
| Playwright 多视口（`/tmp/verify-viewport.js`）| e2e | AC-2 | 4 |
| Playwright LCP（`/tmp/verify-lcp.js`）| 性能 | 非功能性 | 2 |

## 回归保护

本次变更可能影响的旧功能：旧路由（`/wiki /code /skills /memory /analysis /team/members /team/api-keys`）、`/graph → /analysis` 重定向、legacy hash 兼容。

对应验证：AC-6 遍历 7 个旧路由全部 ✅、`tsc --noEmit` + `npm run build` 通过。✅

---

## 🛡️ 专家团门禁 · 测试门（强制 · R9/R13）

### 🗳️ 测试门: TEST.md 是否通过？

> 「TEST.md 是否完整？5 轮测试是否真实执行且结果可信？从测试质量、实现风险、产品覆盖、用户体验四个维度看，可以进入 review 阶段吗？」

- 🟫 **资深测试工程师**: ✅ 5 轮范围声明明确（功能必跑 / 性能与安全部分 / 兼容必跑 / 可观测跳过有理由）。AC-1~AC-6 全部有 Playwright e2e 覆盖且 6/6 通过、0 页面错误；安全 0 high/critical、0 真实秘钥；兼容多视口单列→双列符合响应式设计。T1~T6 无命中（无项目内测试文件，e2e 断言外部行为）。**可信，通过**。
- 🟦 **研发负责人**: ✅ 测试验证了真实风险点——旧路由不回归（AC-6 遍历 7 路由）、`tsc`/`build` 全绿、bundle 706KB 判定为历史债而非本次引入（合理，非甩锅）。无 mock、真实登录态 e2e。**通过**。
- 🟩 **高级产品经理**: ✅ AC 覆盖与业务价值对齐——6 条 AC 逐条对应「导航/布局/项目 7tab/agent 4tab/记忆空间/不回归」，覆盖了用户「页面可真怪 → 协作平台」的核心诉求。UAT 用 e2e 等价自动化，真实登录态。**通过**。
- 🔴 **资深用户体验官**: ✅ 验证了响应式栅格（360~1440 无横向溢出）、侧边栏可见、详情页骨架可读、0 页面错误。视觉保持（tea + 腾讯蓝）由 6-review 第三轮 UI 审查进一步把关。**通过**。

### 结果: 4/4 → 全票通过 ✅ 自动进入 6-review
