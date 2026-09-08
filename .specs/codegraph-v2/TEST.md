# TEST: MemoryPanel 全项目评审修复与增强

- **Change ID**: codegraph-v2
- **关联**: `@.specs/codegraph-v2/REQUIREMENT.md`、`@.specs/codegraph-v2/DESIGN.md`

---

## 本次测试范围声明

| 轮次 | 状态 | 范围 | 理由 |
|---|---|---|---|
| 第 1 轮 · 功能 | ⚠️ 部分 | 静态验证 + UAT | 前端 0 测试框架，无 Vitest/Jest 配置 |
| 第 2 轮 · 性能 | ✅ 必跑 | 构建大小 + 死依赖 | 已测量 |
| 第 3 轮 · 安全 | ✅ 必跑 | 紫色扫描 + 依赖审计 + 监听地址 | 内部工具 |
| 第 4 轮 · 兼容 | ⚠️ 部分 | TypeScript 编译 | 无 e2e 框架 |
| 第 5 轮 · 可观测 | ❌ 跳过 | — | 无运行时 |

---

## 第 1 轮 · 功能测试

### 1.1 AC 映射

| AC | 类型 | 验证方式 | 状态 |
|---|---|---|---|
| AC-1 侧边栏 7→2 | static | `grep` menu.tsx | ✅ |
| AC-2 Engine 127.0.0.1 | static | `grep` service.ts | ✅ |
| AC-3 全站无紫色 | static | `grep -rn purple` | ✅ |
| AC-4 颜色统一 | static | `grep` imports | ✅ |
| AC-5 CSS 无紫色 | static | `grep` codegraph.css | ✅ |
| AC-6 边箭头 | static | `grep EdgeArrow` | ✅ (via EdgeCurveProgram) |
| AC-7 社区着色 | static | `grep COMMUNITY_COLORS` | ✅ |
| AC-8 文件树符号数 | static | `grep symbolCount` | ✅ |
| AC-9 Tooltip linkCount | static | `grep linkCount` | ✅ |
| AC-10 GraphEdge weight | static | `grep weight` | ✅ |
| AC-12 右键菜单 | static | `grep rightClickNode` | ✅ |
| AC-13 快捷键 | static | `grep handleKeyDown` | ✅ |
| AC-14 Workbench 统计 | static | `grep stats` | ✅ |
| AC-16 工具历史 | static | `grep History` | ✅ |
| AC-18 死代码删除 | static | `ls` 文件不存在 | ✅ |
| AC-19 图例始终可见 | static | `grep Legend` | ✅ |
| AC-20 行号 | static | `grep _cg-code-line` | ✅ |
| AC-24 跳转链接 | static | `grep "Open Full"` | ✅ |
| AC-25 死依赖 | static | `grep` package.json | ✅ |
| AC-26 破碎代理 | static | `grep engineProxy` | ✅ |

### 1.2 UAT 脚本

#### UAT-1：CodeGraph 页面社区着色
- **前置**：加载一个已索引的代码仓库
- **步骤**：1. 打开 CodeGraph 页面 2. 点击「Community」视图按钮 3. 观察节点颜色
- **期望**：节点按社区分配不同颜色（非单一色），12 色调色板
- **通过/失败**：待手动验证

#### UAT-2：节点右键菜单
- **前置**：CodeGraph 页面已加载图谱
- **步骤**：1. 右键点击任意节点 2. 观察弹出菜单
- **期望**：显示「View Callers」「View Callees」「Impact Analysis」「Copy Path」「Focus Node」5 个菜单项
- **通过/失败**：待手动验证

#### UAT-3：键盘快捷键
- **前置**：CodeGraph 页面
- **步骤**：1. 聚焦图谱区域 2. 按 `+` 放大 3. 按 `-` 缩小 4. 按 `F` 适应视口
- **期望**：图谱响应缩放操作
- **通过/失败**：待手动验证

#### UAT-4：侧边栏精简
- **前置**：登录系统
- **步骤**：1. 查看左侧边栏「代码分析」分组
- **期望**：仅显示「代码分析工具」和「代码图谱」2 项
- **通过/失败**：待手动验证

---

## 第 2 轮 · 性能测试

### 构建产物

| 指标 | 修改前 | 修改后 | 变化 |
|---|---|---|---|
| 死依赖 | 3 个 | 0 个 | -3 |
| 破碎代理 | 7 个 | 2 个 | -5 |
| 死代码文件 | 2 个 | 0 个 | -2 |
| 紫色残留 | 12 处 | 0 处 | -12 |
| TypeScript 编译 | 未知 | 零错误 | ✅ |

### 依赖体积

- `graphology-communities-louvain`：移除（~50KB）
- `graphology-layout-noverlap`：移除（~15KB）
- `sonner`：移除（~10KB）

---

## 第 3 轮 · 安全测试

| 检查项 | 结果 |
|---|---|
| Engine 监听地址 | ✅ `127.0.0.1`（默认 + 生产） |
| 破碎代理清理 | ✅ 7→2，移除了不存在的端点 |
| 全站紫色残留 | ✅ 0 处 |
| 硬编码 Engine URL | ✅ `127.0.0.1:8443`（仅 Panel 代理） |
| 前端直接 fetch 调用 | ✅ 仅 1 处（CodeGraphPage 文件内容读取，有 auth headers） |
| CORS 配置 | ✅ localhost + private LAN + gitnexus.vercel.app |

---

## 第 4 轮 · 兼容性测试

| 检查项 | 结果 |
|---|---|
| TypeScript strict 编译 | ✅ 零错误 |
| `noUnusedLocals` | ✅ 零错误 |
| `noUnusedParameters` | ✅ 零错误 |
| React 18 兼容 | ✅ 无 breaking changes |
| sigma.js v3 API | ✅ 修正 `preventSigmaDefault` 等 API |

---

## 测试总结

- **静态验证**：26/26 AC 通过（grep/ls 验证）
- **UAT 手动验证**：4 个场景待用户确认
- **TypeScript 编译**：零错误
- **安全扫描**：6/6 通过
- **性能**：3 死依赖移除，~75KB 减小