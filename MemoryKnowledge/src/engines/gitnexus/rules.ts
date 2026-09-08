/**
 * GitNexus Rules — 将 GitNexus 的策略规则与检查规则集成到 TencentDB。
 *
 * 来源（GitNexus 代码级集成，非网络路由）：
 *  - output-budget.ts     → 输出预算（query/context/impact 的 maxTokens 截断）
 *  - read-only-policy.ts  → 只读策略（哪些工具只读可用、写工具需放行）
 *  - config/ignore-service.ts → 文件扫描忽略清单（硬编码规则，代码级内置）
 *
 * 本模块把规则统一组织，供 bridge.ts 的工具执行链应用。
 */

// 策略实现位于 ../codeanalysis/（GitNexus 代码级集成的现行实现层）；
// 此处以 MCP_* 别名导入，保持本模块的导出命名不变（bridge.ts 依赖）。
import {
  applyMcpMaxTokens,
  resolveMcpMaxTokens,
  TRUNCATION_MARKER as MCP_TRUNCATION_MARKER,
} from "../codeanalysis/output-budget.js";
import {
  READ_ONLY_TOOLS as MCP_READ_ONLY_TOOLS,
  resolveReadOnlyMode as resolveMcpReadOnlyMode,
  assertReadOnlyToolCall as assertMcpReadOnlyToolCall,
} from "../codeanalysis/read-only-policy.js";

// ─────────────────────── 忽略清单（来自 GitNexus ignore-service.ts） ───────────────────────

/** 硬编码忽略目录（GitNexus DEFAULT_IGNORE_LIST，代码级内置） */
export const GITNEXUS_IGNORE_DIRS = new Set([
  // Version Control
  ".git", ".svn", ".hg", ".bzr",
  // IDEs & Editors
  ".idea", ".vscode", ".vs", ".eclipse", ".settings", ".DS_Store", "Thumbs.db",
  // Dependencies
  "node_modules", "bower_components", "jspm_packages", "vendor", "third_party",
  "3rdparty", "venv", ".venv", "env", ".env", "__pycache__", ".pytest_cache",
  ".mypy_cache", "site-packages", ".tox", "eggs", ".eggs", "lib64", "parts",
  "sdist", "wheels",
  // Build Outputs
  "dist", "build", "out", "output", "bin", "obj", "target", ".next", ".nuxt",
  ".output", ".vercel", ".netlify", ".serverless", "_build", "public/build",
  ".parcel-cache", ".turbo", ".svelte-kit",
  // Test & Coverage
  "coverage", ".nyc_output", "htmlcov", ".coverage", "__tests__", "__mocks__", ".jest",
  // Logs & Temp
  "logs", "log", "tmp", "temp", "cache", ".cache", ".tmp", ".temp",
  // Generated/Compiled
  ".generated", "generated", "auto-generated", "monaco-workers", ".terraform",
  // Misc
  ".husky", ".github", ".circleci", ".gitlab", "fixtures", "snapshots", "__snapshots__",
]);

/** 硬编码忽略扩展名（GitNexus IGNORED_EXTENSIONS） */
export const GITNEXUS_IGNORE_EXTENSIONS = new Set([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp", ".tiff",
  ".tif", ".psd", ".ai", ".sketch", ".fig", ".xd",
  // Archives
  ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz", ".tgz",
  // Binary/Compiled
  ".exe", ".dll", ".so", ".dylib", ".a", ".lib", ".o", ".obj", ".class", ".jar",
  // Media
  ".mp3", ".mp4", ".wav", ".mov", ".avi", ".mkv", ".flac",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Lockfiles / generated
  ".lock", ".min.js", ".map",
]);

/** 硬编码忽略文件（GitNexus IGNORED_FILES 核心项） */
export const GITNEXUS_IGNORE_FILES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb",
  "npm-shrinkwrap.json", ".DS_Store", "thumbs.db", "desktop.ini",
]);

/** 判断相对路径（POSIX 分隔符）是否应被忽略 —— GitNexus shouldIgnorePath 规则 */
export function shouldIgnoreGitNexusPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized) return false;
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (GITNEXUS_IGNORE_DIRS.has(seg)) return true;
    if (seg.startsWith(".") && seg !== "." && seg !== ".." && !seg.includes(".")) return true;
  }
  const ext = "." + normalized.split(".").pop()!.toLowerCase();
  if (GITNEXUS_IGNORE_EXTENSIONS.has(ext)) return true;
  const base = segments[segments.length - 1]!.toLowerCase();
  if (GITNEXUS_IGNORE_FILES.has(base)) return true;
  return false;
}

// ─────────────────────── 代码质量检查规则（check 工具） ───────────────────────

export interface CheckRule {
  id: string;
  severity: "info" | "warn" | "error";
  description: string;
  /** (content, nodeKind, nodeName) → 命中 */
  match: (content: string, kind: string | undefined, name: string) => boolean;
}

/** check 工具的代码质量检查规则表（GitNexus check 工具规则，可扩展） */
export const GITNEXUS_CHECK_RULES: CheckRule[] = [
  {
    id: "todo-fixme-hack",
    severity: "info",
    description: "TODO/FIXME/HACK 标记",
    match: (c) => c.includes("TODO") || c.includes("FIXME") || c.includes("HACK"),
  },
  {
    id: "console-log",
    severity: "warn",
    description: "函数内 console.log 调试输出",
    match: (c, kind) => c.includes("console.log") && kind === "function",
  },
  {
    id: "any-type",
    severity: "warn",
    description: "类型/接口中使用 any",
    match: (c, kind) => c.includes("any") && (kind === "type" || kind === "interface"),
  },
  {
    id: "debugger-statement",
    severity: "error",
    description: "debugger 语句",
    match: (c) => c.includes("debugger;") || c.includes("\ndebugger\n"),
  },
  {
    id: "empty-catch",
    severity: "warn",
    description: "空 catch 块（静默吞异常）",
    match: (c) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(c),
  },
  {
    id: "ts-ignore",
    severity: "warn",
    description: "@ts-ignore 抑制类型错误",
    match: (c) => c.includes("@ts-ignore") || c.includes("@ts-nocheck"),
  },
  {
    id: "hardcoded-secret",
    severity: "error",
    description: "疑似硬编码密钥/密码",
    match: (c) => /(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(c),
  },
  {
    id: "nested-callback",
    severity: "info",
    description: "深层嵌套回调（回调地狱信号）",
    match: (c) => (c.match(/=>/g)?.length ?? 0) >= 5,
  },
];

// ─────────────────────── 统一规则应用入口 ───────────────────────

export interface GitNexusRuleContext {
  /** 仓库根目录（用于忽略清单/只读判定） */
  repoPath?: string;
}

/**
 * 执行前的规则校验：只读策略（若 GITNEXUS_MCP_READ_ONLY=1，写工具被拒绝）。
 */
export function assertRulesBeforeExecute(toolName: string, params: Record<string, unknown>): void {
  const readOnly = resolveMcpReadOnlyMode();
  if (readOnly) {
    assertMcpReadOnlyToolCall(toolName, params, true);
  }
}

/**
 * 执行后的规则应用：输出预算截断（query/context/impact）。
 */
export function applyRulesAfterExecute(
  toolName: string,
  params: Record<string, unknown>,
  text: string,
): string {
  const maxTokens = resolveMcpMaxTokens(toolName, params);
  return applyMcpMaxTokens(text, maxTokens);
}

export { MCP_READ_ONLY_TOOLS, MCP_TRUNCATION_MARKER };
