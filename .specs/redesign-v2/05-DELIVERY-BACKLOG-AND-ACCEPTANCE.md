# 交付 Backlog、依赖、验收与回滚设计

## 1. Change 拆分

每个 change 必须独立完成 `REQUIREMENT → DESIGN → TASK → DEV → TEST → REVIEW → UAT`，本轮只生成设计，不进入 DEV。

| Change | 内容 | 依赖 | 代码范围（未来实现） | 主要验收 |
|---|---|---|---|---|
| R0-restore-analytics | 恢复 Analytics 页面/入口/能力探测 | 无 | Web only | `/analytics` 两 Tab 真实数据、disabled/denied 态 |
| R0-restore-template-refresh | 默认 Agent 模板 + L1 refresh | 无 | Web only | admin 权限、真实 get/set、refresh 请求 |
| R0-route-safety | admin 守卫、重复注册、路由/i18n 门禁 | 无 | Panel/Web/scripts | 越权拒绝、重复检查 fail/pass |
| C1-workspace-contracts | Project/Agent/Task/Governance/MemoryCenter DTO | R0 | Panel + Core ports | schema contract、partial、无泄露 |
| R1-relations | AgentProject、SpaceMount、资产关系 | C1 | Core metadata | 迁移回放、权限、幂等 |
| C2-bundle | ExecutionBundle V2 + Run snapshot | R1 | Core/Panel | 同输入稳定 hash、source chain、回放 |
| C3-memory-commands | remember/correct/forget/restore + policy | R1 | MemoryCore/Panel | version、审计、expectedVersion、越权 |
| C4-ui-workspaces | Project/Agent/Task/Memory/Assets 工作区 | C1/C2/C3 | Web + Panel | 四档视口、URL 恢复、五态 |
| C5-governance | Approval/Run/Audit/Eval 聚合视图 | C2/C3 | Panel/Core/Telemetry | decision detail、脱敏、回放 |
| C6-quality-loop | golden set、dedup、retention、dreaming、feedback、skill | C3/C5 | MemoryCore | 指标回归、scope leakage=0、可回滚 |

## 2. 单个 Change 的任务模板

```text
1. 证据：列出源码路径、当前状态、不可修改清单
2. 契约：请求/响应/错误/权限/幂等/分页
3. 数据：迁移、双写、回填、索引、回滚
4. 服务：Core caller-aware 端点与单测
5. Panel：白名单、代理、日志/trace
6. Web：路由、client、组件、i18n、五态
7. 验证：typecheck/build/unit/contract/curl/browser
8. 证据：把命令、输出摘要、文件行号写进 REVIEW/UAT
```

## 3. 验收矩阵

### P0 恢复与止血

- [ ] `AnalyticsPage` 的路由、菜单、能力探测和组件引用完整；不能只复制目录。
- [ ] Analytics KPI、趋势、成员/模型、trace 下钻分别真实命中 Panel；ClickHouse 未配置显示明确状态。
- [ ] 默认模板 UI 只对管理员展示；API 仍由服务端最终授权。
- [ ] L1 refresh 重新触发当前筛选和分页请求，保留 loading/error。
- [ ] `/admin/users` 等管理路由都由 guard + server auth 双层保护。
- [ ] 重复路由、同名实现、死页面和 i18n 键有 baseline；后续违规数只减不增。

### P1 契约与关系

- [ ] overview 首屏最多 3 个 Web 请求，服务端并行 fan-out。
- [ ] 未授权对象既不返回详情，也不返回存在性计数。
- [ ] Project/Agent/Task/Space 所有写命令包含 actor、expectedVersion、idempotencyKey、audit。
- [ ] AgentProject/SpaceMount 多次重放不产生重复边。
- [ ] bundle 对相同规范化输入生成相同 bundleId；实际 Run 保存快照。

### P2-P4 记忆与治理

- [ ] recall 四路过滤规则一致，召回解释可指出过滤原因。
- [ ] duplicate/dreaming/feedback 失败不静默吞掉，不把失败标记为成功。
- [ ] skill trace claim/consume 原子、有锁、有续扫 cursor。
- [ ] 审批 120 秒超时、原子 claim、模型不能自批；副作用严格发生在批准后。
- [ ] replay 由 sequence/cursor 回放，断流可补齐；敏感参数只保留脱敏/引用。
- [ ] EvalSuite/EvalRun 保存数据集、配置、模型、版本和指标 delta；scope leakage 为 0。

## 4. 验证命令（未来实现时执行）

```bash
# 前端
npm run typecheck
npm run build

# 各服务已有测试命令以 package.json/pyproject 为准
npm test
uv run pytest

# 静态门禁
node scripts/guard/check-routes.mjs
node scripts/guard/check-i18n.mjs
node scripts/guard/check-duplicates.mjs
node scripts/guard/check-skeleton.mjs
node scripts/guard/check-config-live.mjs
node scripts/guard/check-invariants.mjs

# 运行态
curl -fsS /health
# Playwright：登录、深链、权限、五态、320/768/1024/1440
```

本轮未执行以上命令，因为明确要求不修改代码且当前任务为方案文档落地；实现阶段不得用“未执行”替代验收证据。

## 5. 数据迁移与回滚

1. 先加表/列/索引，不删旧列；旧写路径与新关系双写并记录 drift。
2. 回填按分页、可暂停、可重入；每批记录 checkpoint 和错误。
3. shadow read 比较旧单值与新关系，差异进入治理报告，不静默修正。
4. 切读使用 feature flag，按 team/project 灰度；错误率、权限拒绝和漏数超阈值自动切回旧读。
5. rollback 只关闭 flag、停止新写入消费者、保留已写数据和事件；禁止 destructive migration。
6. 观测期结束后另立 ADR 决定旧字段清理，不在同一 change 顺手删除。

## 6. 风险登记

| 风险 | 触发 | 防护/恢复 |
|---|---|---|
| 页面恢复又丢入口 | 仅复制组件 | route/menu/client/Panel/浏览器五联验收 |
| Panel 聚合越权 | 前端拼接口或 Panel 重裁权限 | Core caller-aware 单一权威 + contract test |
| scope 泄露 | vector/graph/keyword 过滤不一致 | 唯一 resolver + leakage golden test |
| 配置空转 | config 无生产调用方 | check-config-live + startup probe |
| 静默降级 | provider 失败切 internal | 显式失败/告警，记录 provider revision |
| 任务状态失真 | 用时间启发式推断 | Task 状态机 + expectedVersion |
| 巩固跨域 | cluster 未带完整 scope | seed/target 双边权限校验 + scope subset 断言 |
| UI 风格漂移 | 新增独立色板/大卡片 | Tea token、截图基线、UI review |

## 7. 文档维护规则

- 本目录是“新设计真相源”；旧 `.specs/redesign/*.md` 保留为历史方案，不在本轮删除。
- 每个实现 change 必须反向更新本目录对应契约和状态，不允许只改代码不改规格。
- 状态变更附证据：`path:line`、测试名称、curl 输出或浏览器截图路径。
- 发现参考项目结论与源码冲突时，先更新 `refs/` 扫描证据，再修改采纳矩阵。
- 任何“已完成”必须回答：谁调用、数据在哪里、权限如何、失败如何、用户如何验证。
