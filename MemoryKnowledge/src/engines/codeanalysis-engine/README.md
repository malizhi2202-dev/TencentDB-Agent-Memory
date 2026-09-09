# 代码分析引擎（Code Analysis Engine）

原版 GitNexus 引擎（826 个源码文件：LadybugDB 图数据库索引 + LocalBackend 查询层 + 17 个分析工具）已完整融合进 TencentDB 的 MemoryKnowledge 模块，作为独立的 `codeanalysis` 引擎运行。前端 `analysis_*` 工具经 KS `/v3/tools/call` 统一通道调用。

## 架构

```
MemoryPanel 前端 (analysis_* 工具页)
      │  /v3/tools/call  (analysis_ 前缀)
      ▼
KnowledgeServer (8421)  src/routes/tools.ts
      │  executeEngineAnalysisTool()  →  src/engines/codeanalysis/engine-client.ts
      ▼  HTTP POST /call
Engine service (127.0.0.1:8443)  src/engines/codeanalysis-engine/service.ts
      │  LocalBackend.callTool(tool, params)
      ▼
LadybugDB 索引 (.gitnexus/ 目录，每仓库一份)
```

- **引擎代码**：`src/engines/codeanalysis-engine/`（原版 826 文件 + `src/` 结构，`shared/` 为原 gitnexus-shared，`vendor/` 为原版 vendored grammars，`hooks/` 为原版 hooks，`scripts/` 为原版脚本）
- **客户端**：`src/engines/codeanalysis/engine-client.ts`
- **服务入口**：`src/engines/codeanalysis-engine/service.ts` + `engine-service.sh`
- **一键启停**：`scripts/start-analysis.sh [engine|ks|all]`

## 环境依赖（关键！）

宿主 glibc 2.31 无法加载引擎的原生模块（@ladybugdb/core 需 GLIBC_2.34、tree-sitter 需本地编译），因此引擎进程必须跑在 **glibc 2.34 动态加载环境 + Node 24** 下：

- `/tmp/glibc234/` — glibc 2.34 + libstdc++ 6.0.29（impish/hirsute 包）
- `/tmp/openssl3/` — libssl.so.3 / libcrypto.so.3（jammy）
- `/tmp/node-v24.19.0-linux-x64/` — Node 24（原生模块 ABI 137）
- `/tmp/node-glibc234` — 包装脚本：`ld-linux(2.34) --library-path <glibc234>:<openssl3> node "$@"`

tree-sitter runtime 固定在 **0.21.1**（pnpm 解析），语言包（npm 0.23.x）带预编译二进制（GLIBC_2.4 依赖，无需本地编译）；runtime 的 `index.js` 打过补丁（`initializeLanguageNodeClasses` 里 `class SyntaxNode extends SyntaxNode` 自引用 TDZ 崩溃 → 跳过 camelCase 生成的同名类）。补丁位于 `.pnpm/tree-sitter@0.21.1/node_modules/tree-sitter/index.js`，重装依赖后需重新应用（见 `shared/lbug/node-bin.ts` 同级的运行时说明）。

**引擎进程必须以 wrapper 启动**（`/tmp/node-glibc234 --import tsx ...`），且：
- `GITNEXUS_MEMORY=off` — 禁用 analyze 的 8GB 堆重 spawn（execPath 是 ld，无法 respawn）
- `ENGINE_NODE_BIN=/tmp/node-glibc234` — 让 DuckDB 扩展安装子进程也用 wrapper

## 索引仓库

```bash
cd MemoryKnowledge
GITNEXUS_MEMORY=off ENGINE_NODE_BIN=/tmp/node-glibc234 /tmp/node-glibc234 --import tsx \
  src/engines/codeanalysis-engine/src/cli/index.ts analyze <repo-path>
```

- 生成 `<repo-path>/.gitnexus/`（LadybugDB 索引 + parse-cache）
- 自动注册进全局 registry（`~/.gitnexus/registry.json`）
- `--repair-fts` 重建 BM25 全文索引（需先安装 DuckDB 扩展，见下）

DuckDB 扩展（fts / vector，一次性安装，需网络）：
```bash
ENGINE_NODE_BIN=/tmp/node-glibc234 /tmp/node-glibc234 --import tsx -e \
  "import('./src/engines/codeanalysis-engine/src/core/lbug/extension-loader.ts').then(m => m.installDuckDbExtensionOutOfProcess('fts',60000).then(console.log))"
```

## 工具清单（17 个，`analysis_` 前缀）

list_repos / query / cypher / context / detect_changes / check / rename /
impact / explain / pdg_query / route_map / tool_map / shape_check /
api_impact / group_list / group_sync / trace

全部为原版 LocalBackend 输出格式（`{result: {...}}`），经 `wrapOk` 包装后返回前端。

## 本机当前状态（验证基线）

- 引擎服务 8443：`curl http://127.0.0.1:8443/health` → `{"ok":true,"engine":"codeanalysis","version":"1.6.9","repos":2}`
- KS 8421：`POST /v3/tools/call` `analysis_cypher` `MATCH (n) RETURN count(n)` → 5058（cg-ydl0zxiw 仓库）
- 已索引仓库：cg-ydl0zxiw（TencentDB-Agent-Memory，5058 nodes / 13594 edges / 146 clusters / 385 flows）
