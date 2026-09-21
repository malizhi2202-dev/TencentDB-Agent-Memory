# 当前原型验证记录

## 本轮目标

验证当前交付是否先表达对象关系与权限来源，再提供符合对象层级的页面下钻；重点核验 Agent 关联的“查看与使用”授权语义，以及 Project → Task → Run 路径。

## 已验证的路径

| 路径 | 已观察行为 |
|---|---|
| `#/home` | 展示 Team → Project（1:N）、open Project 规则与 Agent `use / view` 边界。 |
| `#/projects` → `#/project/p-db/overview` | 点击 Project 进入 Project 概览，而非直接跳 Task；显示 owning Team、open 与日常操作权限。 |
| `#/project/p-db/tasks` → `#/task/t-104/overview` → `#/task/t-104/runs` → `#/task/t-104/run/r-83` | Run 只在 Task 下钻，无常规全局 Run 入口。 |
| `#/project/p-db/agents` / `#/project/p-db/access` | 显示 Agent 关联可 `use / view`，但不可改关联、策略或配置，且仍受 Policy / Resource ACL / RunGate 限制。 |
| `#/agent/a-retriever` | 显示 Agent-Team 与 Agent-Project 的关联范围及最终权限计算。 |
| `#/memory/browse/spaces` | 记忆作为专业资源入口；未引入泛化资源库。 |
| `#/ingestion/triage` → `#/changes/review/cs-28` | 展示输入分流与内容变更审阅；RunGate 保留在 Run 语义中。 |
| `#/team/team-db/overview` | 显示 Team 拥有 Project（1:N）和 open 对 Team 成员的日常操作授权。 |

## 已执行的静态检查

- 原型 JavaScript：从 `product-prototype.html` 提取脚本后执行 `node --check`，通过。
- 废弃导航：检查未发现 `href="#/runs"`、`href="#/library"`、`href="#/orchestration"`。
- 关键深链接：以 `grep` 核验了 Project tabs、Task / Run、Agent、Memory、Triage、ChangeSet Review、Team 路由的源代码定义。
- 原型为离线单文件；未引用外部脚本、样式或网络资源。

## 边界

这是使用样例数据的只读交互原型：Hash 路由、主题切换和页面间导航可在浏览器中运行；不连接真实后端，因此不执行真实写入、授权裁决、审批或 Agent Run。

历史 `.specs` 内容未删除；当前设计入口仅为 `.specs/final-v1/` 下的文档与原型。
