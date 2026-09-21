# UI 恢复与重设计详细规格（保持 my-tencentDB-Agent-memory 风格）

## 1. 信息架构

```text
工作台：工作台 / 项目 / 任务
协作：Agent / Agent 编排 / 运行记录
知识与记忆：记忆中心 / 记忆空间 / 资产库 / Wiki / Code / CodeGraph / 代码分析 / Skill
组织：团队 / 成员 / API Key
治理：线上调用情况 / 审批 / 权限 / 审计 / 评测 / 模型配置
```

一级入口必须可见或由权限明确隐藏；详情页只能标记 `__subpage__`，不准用 `__hidden__` 伪装可用功能。

## 2. 恢复清单（按蓝图实证）

| 优先级 | 页面/功能 | 证据 | 设计动作 | 验收 |
|---|---|---|---|---|
| P0 | Analytics `/analytics` | 蓝图 29 文件；client 540 行；i18n 151 行；Panel/Core 各 16 路由仍在 | 恢复页面、路由、observability 菜单和能力探测 | 两 Tab KPI/明细真实请求；权限和未配置态可见 |
| P0 | 默认 Agent 模板 | 蓝图两组件；`meta-actions` 与 `agentsApi` 仍有 action | 恢复 Team Agent 管理区，仅 admin | get/set 有真实请求，非 admin 无入口且后端拒绝 |
| P0 | Chat Memory L1 refresh | 蓝图 `refreshLayer` + `onRefresh` | 恢复刷新动作 | 点击后重新请求并更新时间/错误态 |
| P1 | CodeGraph 孤儿组件 | 当前 `pages/codegraph/` 多组件无完整装配 | 接线；若不接线则 ADR 明确归档 | graph/tree/process/query/chat/reference 各有入口和 API |
| P1 | Agent 详情 | 当前 4 Tab 占位 | 先接 AgentWorkspaceOverview 再开放 | 不显示占位文字；权限、空态、失败态齐全 |
| P1 | MemorySpace 详情 | 当前无 `space/get`，页面空壳 | 先加契约设计，未实现前从主导航降为不可达 subpage | 详情、mount、policy 有真实 command 后开放 |
| P1 | Project Memory Tab | 当前无项目级空间接口 | 使用 Project overview/space contract 后开放 | 可看 scope、空间、记忆来源，不做假空态 |

恢复动作不得直接覆盖当前文件；实际实现阶段须走独立 change、先复制到临时分支并逐文件 diff。

## 3. 页面规格

### 3.1 Project Workspace

Header：Project 名称、Team、visibility、角色、最后活动、主操作。  
Tabs：概览 / 任务 / Agent / 知识与资产 / 记忆 / 决策与交付 / 运行 / 成员设置。  
首屏：6 个统计卡 + 最近 Task/Run/Knowledge + warnings。点击实体使用 `EntityLink` 保留 `team/project` URL 上下文。

### 3.2 Agent Workspace

Header：Agent 名称、owner、revision、当前 Project、健康状态。  
Tabs：概览 / 参与项目 / 任务与运行 / 能力装配 / 记忆空间 / 策略 / 版本。  
能力装配区固定三栏：可访问、固定装配、本轮生效；本轮生效展示 bundleId、resolvedAt、版本和 policy decision。

### 3.3 Task Workspace

Header：状态机、优先级、Project、负责人、风险、依赖。  
主体：目标/描述、声明 Agent vs 实际参与、Run 时间线、交付物评审、关联决策/记忆。  
状态变更必须有 reason、expectedVersion、权限反馈。

### 3.4 Memory Center

四 Tab：浏览器 / 检索试调 / 显式管理 / 空间管理。  
列表字段：content 摘要、domain、layer、space、scope、source、quality、updatedAt。  
详情抽屉：版本/lineage/supersededBy、来源 Conversation/Task/Run、可见范围、最近使用 Agent。  
检索试调显示各路召回、RRF/rerank、过滤原因、token budget 和最终注入预览；敏感字段脱敏。

### 3.5 Assets

统一列表按 type、owner、project、visibility、status 筛选；详情保留 Wiki/Code/Skill 专属工作台。资产页面不把“可访问”误写为“已绑定”。

### 3.6 Governance

审批 inbox、Run 回放、审计、评测分开 Tab；列表只显示决策所需摘要，详情才拉敏感信息并依权限脱敏。Analytics 为线上可观测独立页面，不能和代码分析混为一页。

## 4. 视觉与交互约束

沿用蓝图 `MemoryPanel/web/src/index.css`、`tea-override.css` 和当前 token：

- Tea Component；主色 `#2563eb`；中性灰背景；禁止新增紫色/营销渐变；
- 14px 基础字号；卡片轻边框、6px 圆角、弱阴影；信息密度优先；
- 页面壳：Header → Tabs → 内容；常规双列 2:1，窄屏单列；
- ID、traceId、bundleId、版本、请求体使用等宽字体；
- 统一 `StateView`：loading、empty、error、denied、partial；错误提供 requestId；
- 破坏性操作先 preview，显示影响数量、原因和撤销/恢复能力；
- 键盘 focus 可见、抽屉关闭焦点返回、支持 `prefers-reduced-motion`；状态不能只靠颜色。

## 5. URL 与状态

```text
/projects/:projectId/{overview,tasks,agents,assets,memory,decisions,runs,settings}
/agents/:agentId/{overview,projects,tasks,loadout,memory,policies,versions}
/tasks/:taskId
/memory/{browser,search,manage,spaces}
/assets/:assetId
/teams/:teamId/{overview,members/assets/patterns/automations/policies}
/governance/{approvals,runs,audit,evals}
```

URL 是 Team/Project/Agent/Task 和筛选条件的权威；Zustand 仅保存最近默认值。切换上游实体时校验下游并清理失效上下文。旧 `/team/members`、`/team/agents`、`/graph` 保留 redirect，直到等价能力验证完成。

## 6. 完成判据

任一页面只有同时具备：路由入口、权限守卫、真实 API client、Panel 代理、Core/Knowledge 数据、五态 UI、i18n 中英键、构建和浏览器证据，才可标记 `implemented`。否则标记 `partial` 或 `skeleton`，不得放入完成清单。
