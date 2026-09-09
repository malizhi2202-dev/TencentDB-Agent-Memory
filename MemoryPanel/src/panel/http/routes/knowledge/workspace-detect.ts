/**
 * Harness 工作区检测 —— 扫描本地目录，识别 git 仓库与代码文件。
 *
 * 需求（req-2）：接入的 harness 框架工作区里检测到代码 / git 仓库后，
 * 面板询问是否上传为 code-graph。这里只做「只读探测」：
 *   - 递归（深度上限 5，跳过 node_modules/.git/dist 等 + 隐藏目录）找 .git 仓库根；
 *   - 从 .git/config 读 origin remote URL、从 .git/HEAD 读当前分支；
 *   - 无 git 仓库时按扩展名白名单判断是否含代码文件。
 *
 * 全程 node:fs 只读，不执行 git 二进制、不写盘，天然规避命令注入与误改工作区。
 */

import fs from 'node:fs';
import path from 'node:path';

export interface DetectedGitRepo {
  /** 仓库根目录（绝对路径）。 */
  path: string;
  /** origin remote URL（读不到为 null）。 */
  remote_url: string | null;
  /** 当前分支（读不到为 null）。 */
  branch: string | null;
}

export interface WorkspaceDetection {
  /** 规范化后的扫描根目录。 */
  path: string;
  git_repos: DetectedGitRepo[];
  has_code: boolean;
}

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.java', '.c',
  '.cpp', '.cc', '.h', '.hpp', '.rs', '.rb', '.php', '.cs', '.kt', '.kts',
  '.swift', '.scala', '.vue', '.svelte', '.sh', '.sql', '.proto', '.tf',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', 'out', '.next', '.nuxt',
  '.venv', 'venv', '__pycache__', '.idea', '.vscode', '.cache', '.dsh',
  '.hermit', '.pnpm-store', '.git', 'coverage',
]);

const MAX_DEPTH = 5;

function readGitInfo(repoDir: string): { remote_url: string | null; branch: string | null } {
  let remote_url: string | null = null;
  let branch: string | null = null;
  try {
    const cfg = fs.readFileSync(path.join(repoDir, '.git', 'config'), 'utf8');
    // 匹配 [remote "origin"] 段里的 url = ...（允许缩进/空格）。
    const section = cfg.match(/\[remote\s+"origin"\]\s*\n([\s\S]*?)(?=\n\[|$)/);
    if (section) {
      const url = section?.[1]?.match(/^\s*url\s*=\s*(.+)$/m);
      if (url?.[1]) remote_url = url[1].trim();
    }
  } catch {
    /* ignore */
  }
  try {
    const head = fs.readFileSync(path.join(repoDir, '.git', 'HEAD'), 'utf8').trim();
    const hm = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (hm?.[1]) branch = hm[1].trim();
  } catch {
    /* ignore */
  }
  return { remote_url, branch };
}

function detectCodeFiles(dir: string, depth: number): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (e.name.startsWith('.')) continue;
      if (depth > 0 && detectCodeFiles(path.join(dir, e.name), depth - 1)) return true;
    } else if (e.isFile() && CODE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function detectWorkspace(root: string): WorkspaceDetection {
  const abs = path.resolve(root);
  const git_repos: DetectedGitRepo[] = [];
  const seen = new Set<string>();

  const visit = (dir: string, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (fs.existsSync(path.join(dir, '.git'))) {
      const key = path.resolve(dir);
      if (!seen.has(key)) {
        seen.add(key);
        git_repos.push({ path: key, ...readGitInfo(dir) });
      }
      return; // 仓库根，不再向下钻
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      visit(path.join(dir, e.name), depth + 1);
    }
  };

  visit(abs, 0);

  const has_code = git_repos.length > 0 || detectCodeFiles(abs, MAX_DEPTH);

  return { path: abs, git_repos, has_code };
}
