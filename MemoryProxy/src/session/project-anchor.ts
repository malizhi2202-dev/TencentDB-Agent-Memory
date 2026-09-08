/**
 * Project 锚定解析器（M3b 多信号注册表）。
 *
 * 决定「本次 session 应该锚定到哪些 project」，按优先级：
 *   1. 显式声明（`x-tdai-project-id` header / 调用方显式传 project_id）
 *   2. git remote（harness 上报的仓库 URL → ProjectEntity.git_repo_urls / repo_url）
 *   3. 路径 glob（harness 上报的 workspace cwd → ProjectEntity.path_globs）
 *   4. 无信号兜底 → 用户是 member 的全部 project（"自己 project 维度"）
 *
 * 语义原则（对齐 .specs/CONTEXT.md「宁可少给」）：
 *   - 显式声明了一个 project 但用户不是 member → 不锚定（返回 []），由 lib 端
 *     的 listAccessibleAssets 再兜一层 member 校验（非 member 直接跳过）。
 *   - 声明了 git remote / cwd 但匹配不到任何 project → 不锚定（返回 []），
 *     不猜测、不越权把别的 project 资产塞进来。
 *   - 完全没有信号 → 返回全部 member project（团队公共 project 也含在内，
 *     因为它们本就按 team 公共语义可见）。
 *
 * 纯函数，无 IO —— project 列表由调用方通过 MetadataClient.listProjects 拉取。
 */

export interface ProjectAnchorSignals {
  /** 显式声明的 project_id（header / 调用方传入）。 */
  explicitProjectId?: string;
  /** harness 上报的 git remote URL（M5 适配器写入）。 */
  gitRemote?: string;
  /** harness 上报的 workspace 绝对路径（M5 适配器写入）。 */
  cwdPath?: string;
}

export interface AnchorableProject {
  project_id: string;
  repo_url?: string | null;
  /** JSON 数组字符串：多 repo URL。 */
  git_repo_urls?: string | null;
  /** JSON 数组字符串：workspace 路径 glob。 */
  path_globs?: string | null;
}

/** 安全解析 JSON 数组字符串为 string[]，非法/非数组返回 []。 */
function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore malformed JSON */
  }
  return [];
}

/** 归一化 git URL：去协议、去用户/端口、去 .git、去尾斜杠、小写，统一成 host/path。 */
function normalizeGitUrl(url: string): string {
  let u = url.trim();
  // 去 scheme（https:// / http:// / ssh:// / git://）
  u = u.replace(/^(https?|ssh|git):\/\//i, "");
  // scp-like：git@host[:port]:path → host/path
  u = u.replace(/^[^@/]+@([^:/]+)(?::\d+)?:/, "$1/");
  // 去 .git 后缀与尾斜杠
  u = u.replace(/\.git$/i, "").replace(/\/+$/, "");
  return u.toLowerCase();
}

function matchesGitRemote(project: AnchorableProject, remote: string): boolean {
  const normalized = normalizeGitUrl(remote);
  const candidates = [project.repo_url, ...parseJsonArray(project.git_repo_urls)]
    .filter((u): u is string => !!u)
    .map(normalizeGitUrl);
  return candidates.includes(normalized);
}

/** 简化 glob → 前缀正则：`**` 任意深度，`*` 单段非 `/`。 */
function globToRegExp(glob: string): RegExp | null {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  try {
    return new RegExp(`^${escaped}`);
  } catch {
    return null;
  }
}

function matchesPathGlob(project: AnchorableProject, cwd: string): boolean {
  const normalized = cwd.replace(/\/+$/, "");
  return parseJsonArray(project.path_globs).some((glob) => {
    const re = globToRegExp(glob);
    return re ? re.test(normalized) : false;
  });
}

export function resolveProjectAnchor(
  signals: ProjectAnchorSignals,
  projects: AnchorableProject[],
): string[] {
  // 1. 显式声明
  if (signals.explicitProjectId) {
    const id = signals.explicitProjectId.trim();
    if (!id) return [];
    // 显式声明但非 member → 空（lib 端 listAccessibleAssets 还会再校验 member）
    return projects.some((p) => p.project_id === id) ? [id] : [];
  }

  // 2. git remote
  if (signals.gitRemote && signals.gitRemote.trim()) {
    const matched = projects.filter((p) => matchesGitRemote(p, signals.gitRemote!));
    if (matched.length > 0) return matched.map((p) => p.project_id);
    return [];
  }

  // 3. 路径 glob
  if (signals.cwdPath && signals.cwdPath.trim()) {
    const matched = projects.filter((p) => matchesPathGlob(p, signals.cwdPath!));
    if (matched.length > 0) return matched.map((p) => p.project_id);
    return [];
  }

  // 4. 无信号 → 全部 member project（"自己 project 维度"兜底）
  return projects.map((p) => p.project_id);
}