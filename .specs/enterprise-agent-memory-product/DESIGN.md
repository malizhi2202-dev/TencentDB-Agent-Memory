# DESIGN: Enterprise Agent Memory 产品工作台

- **Change ID**: `enterprise-agent-memory-product`
- **关联**: `@.specs/enterprise-agent-memory-product/REQUIREMENT.md`、`@.specs/enterprise-agent-memory-product/UI-DESIGN.md`
- **作者**: AI（Architect 角色）+ 待人工 review

---

## 0. 技术栈选定

- **选定**：本地 HTML/CSS/JavaScript 交互原型（不进入生产实现）
- **前端**：原生 HTML + CSS + JavaScript，无构建依赖
- **后端**：无；合成数据
- **数据库**：无持久化
- **部署**：本地文件或静态服务器
- **关键依赖**：现代浏览器、Node.js `--check`（脚本静态检查）
- **理由**：满足离线检查、零外部请求、快速验证信息架构和状态模型；对应 AC-8。
- **明确排除**：本轮不选 React/Next.js 和真实 API，避免原型把未确定的契约固化。

## 0.5 既有架构对齐

### 0.5.1 本次 change 触碰的既有模块

```
既有参考（只读，不修改）：
- .specs/enterprise-agent-memory-platform/*.md
- .specs/final-v1/PRODUCT-DESIGN.md
- .specs/final-v1/product-prototype.html
- code-kit/templates/*

新增模块：
- .specs/enterprise-agent-memory-product/*

禁动清单：
- .specs/final-v1/**
- .specs/redesign-v2/**
- .specs/redesign-v3/**
- 产品代码、配置、Schema、测试和实现文件
```

### 0.5.2 既有抽象沿用对照表

| 本次需要 | 既有有没有？路径 | 决定 |
|---|---|---|
| scope / Team / Project / Task / Run 对象语义 | `.specs/final-v1/DOMAIN-MODEL.md` | 沿用并与十项权威议题的血缘/治理语义对齐 |
| Hash 路由原型 | `.specs/final-v1/product-prototype.html` | 沿用交互方式，新增治理和报告视图 |
| 单一蓝色、暗色、边框式视觉 | `code-kit` / final-v1 原型 | 沿用 |
| 真实 API / 鉴权 | 无 | 本轮不引入 |

## 1. 决策清单

| # | 决策 | 备选 | 选择理由 | 取舍代价 |
|---|---|---|---|---|
| D1 | 工作导航按工作、知识、治理三组组织 | 泛化 Asset 库 / 全局 Run | 保持对象专业页和 scope 清晰；降低归属歧义 | 页面入口较多 |
| D2 | 清理、报告、Triage 作为治理工作台 | 混入资源详情 / 独立万能控制台 | 允许查看证据闭包和状态，不把治理动作伪装成普通 CRUD | 需要解释状态语义 |
| D3 | 原型采用 hash 路由和合成数据 | 真实后端 / SPA 构建 | 离线可检查且无外部副作用 | 不能验证真实授权链 |
| D4 | 高影响动作默认 blocked | 一键执行 / 先执行后审批 | 与议题 7/9/10 的 fail-closed 结论一致 | 用户需要理解下一门槛 |
| D5 | 报告先做授权投影再渲染 | 全量报告后文本裁剪 | 防止跨租户和敏感字段在渲染前泄露 | 需要明确投影契约 |

## 2. 数据流 / 架构图

```text
Harness / User / Connector
          │ evidence + revision + scope
          v
     Ingestion / Triage ── authorization + sensitivity + provenance
          │                         │
          ├───────────────> Memory / Wiki / Skill / Template candidates
          │                                   │
          └──────────────────────────────> ChangeSet → Review → Publish
                                              │
Current subject + Purpose + ACL + lineage + policy + tool capability
                                              v
                                         RunGate / Action
                                              │
                                              ├─ blocked / approved / executing / unknown
                                              └─ Verification / External Effect

Copy Inventory → propagation stop → disposition → verification → reports
                         │                         │
                         └── backup/provider/terminal unknown ──> fail-closed
```

## 3. 关键状态机

### 3.1 内容和变更

`candidate → triage → staged / rejected → changeset → review → published / withdrawn / superseded`

### 3.2 清理证据

`not_scoped → planned → requested → blocked|executed → verified|partial|unknown|retained → expired`

状态必须绑定范围、revision、证据时间和责任边界；`verified` 不是全局永久保证。

### 3.3 报告投递

`draft → approved → queued → attempted → channel_accepted → delivered → acknowledged → read`

并行关系：`revoked`、`superseded`、`delivery_unknown`、`failed`。渠道接受不等于阅读，撤回不等于外部副本删除。

## 4. ADR 索引

本轮不创建不可逆架构 ADR；D1–D5 均是原型阶段可调整决策。真实实现阶段应分别建立 Schema、授权、事件和外部副作用 ADR。

## 5. 风险

| # | 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|---|
| R1 | 原型被误认为真实权限系统 | 高 | 中 | 顶部标注 PROTOTYPE；所有数据为合成数据；CHANGE 明确非目标 |
| R2 | 阶段性语义被误固化为 Schema/法律结论 | 高 | 中 | 文档统一标注候选语义和暂缓依赖；实现另开 change |
| R3 | 复杂状态导致用户误解 unknown/retained | 中 | 中 | 状态矩阵、范围、证据时间和下一门槛同屏显示 |
| R4 | 多受众报告发生越权投影 | 高 | 中 | 先授权投影再渲染；原型只展示边界，不执行发送 |
| R5 | 只读原型无法验证真实授权闭包 | 中 | 高 | UI 验收只覆盖可观察行为；真实实现前必须做低敏样本和权限测试 |

## 6. 不在范围

- 真实后端、数据库、Schema、事件总线、RBAC/ABAC 和 RunGate；
- Provider/备份/终端的真实清理、迁移、通知和合同；
- 任何生产数据、凭据、外部副作用或 Git push。

## 9. 架构沉淀建议

### 9.1 新增的可复用抽象

| 路径 | 能力 | 触发场景 | 复用建议 |
|---|---|---|---|
| `.specs/enterprise-agent-memory-product/DESIGN.md` | Copy Inventory、Report Projection、Delivery Intent 的原型语义 | 清理/报告/通知工作台 | 实现前由架构 change 再确认，不直接复制为 Schema |

### 9.2 新增 / 改变的项目级技术决策

| 决策 | 取值 | 影响范围 | 推翻代价 |
|---|---|---|---|
| 原型路由 | 本地 hash route + 合成数据 | 原型验收 | 低 |
| 高风险动作默认值 | `blocked` | 所有治理视图 | 低，属产品原则 |

### 9.3 新增 / 修改的跨模块契约

```
- 原型概念：Copy Inventory snapshot → Evidence/Report Projection → Delivery Attempt
- 原型概念：Purpose + scope + ACL + lineage + Tool Policy → RunGate decision
```

### 9.4 新增 / 升级的依赖

| 包 | 版本 | 用途 | 是否替换既有 |
|---|---|---|---|
| 无 | — | 原型零外部依赖 | — |

### 9.5 禁动清单变化

```
- 保持禁动：历史 final-v1、redesign-v2、redesign-v3 和产品实现文件。
```

---

> 本文件不包含完整代码实现；原型实现见 `product-prototype.html`。
