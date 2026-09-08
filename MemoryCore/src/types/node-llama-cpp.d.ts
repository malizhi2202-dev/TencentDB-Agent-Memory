/**
 * node-llama-cpp 类型 shim。
 *
 * node-llama-cpp 是重型原生依赖，本仓库当前 node_modules 未安装（运行时经
 * LocalEmbeddingService 动态 import，失败会进入 "failed" 状态并降级，不影响主链路）。
 * 这里提供与 embedding.ts 内 ImportLlamaFn 完全一致的最小 ambient 声明，
 * 仅用于 strict tsc 扫描；一旦真实包落地 node_modules，TS 会优先解析其自带类型。
 */
declare module "node-llama-cpp" {
  export function getLlama(opts: { logLevel: number }): Promise<unknown>;
  export function resolveModelFile(model: string, cacheDir?: string): Promise<string>;
  export const LlamaLogLevel: { error: number };
}
