/**
 * Code-analysis engine client.
 *
 * The original engine (LadybugDB index + LocalBackend) runs as a standalone
 * process under a newer-glibc Node runtime (see
 * codeanalysis-engine/engine-service.sh) because its native modules
 * (@ladybugdb/core, tree-sitter) cannot load on the host glibc. The
 * KnowledgeServer tools channel dispatches `analysis_*` tools to that
 * service over HTTP.
 */

import { resolve } from "node:path";

const ENGINE_URL = (process.env.ENGINE_URL ?? "http://127.0.0.1:8443").replace(/\/$/, "");

export interface AnalysisToolResult {
  isError: boolean;
  content: unknown;
}

async function engineCall(tool: string, params: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${ENGINE_URL}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, params }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`engine service ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(body.error);
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Execute an original-engine analysis tool for the code graph instance whose
 * repository lives at `repoDir`. The engine resolves the repo by path from
 * its global registry.
 */
export async function executeEngineAnalysisTool(
  repoDir: string,
  tool: string,
  params: Record<string, unknown>,
): Promise<AnalysisToolResult> {
  const toolParams: Record<string, unknown> = { ...params };
  // `dirFor` 默认返回相对于 KS 进程 cwd 的路径（KNOWLEDGE_DATA_DIR 默认 ./data），
  // 而引擎侧索引注册的是绝对路径 —— 这里统一解析为绝对路径，否则会报
  // `Repository "data/..." not found`。
  if (!toolParams.repo) toolParams.repo = resolve(repoDir);

  try {
    const result = await engineCall(tool, toolParams);
    const isError = !!(result as { isError?: boolean })?.isError;
    return { isError, content: result };
  } catch (err) {
    const msg = (err as Error).message;
    return {
      isError: true,
      content: {
        error: msg,
        hint: "代码分析引擎服务未就绪。请确认 engine-service 已启动（codeanalysis-engine/engine-service.sh），并先用引擎 CLI 对仓库执行 analyze 完成索引。",
      },
    };
  }
}
