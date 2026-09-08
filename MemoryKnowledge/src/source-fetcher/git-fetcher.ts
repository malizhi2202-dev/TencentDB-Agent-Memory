/**
 * GitSourceFetcher — 基于 simple-git 的源码拉取实现。
 *
 * simple-git 内部用 child_process.spawn + args 数组，不走 shell，从原理上消除 shell 注入。
 *
 * 安全防护（002 §4-5）：
 *   - R1 git hooks：clone/fetch 本就不拉取远端 .git/hooks（hooks 为本地态），故不额外
 *     配置 core.hooksPath（加固版 git 会拒绝该配置，需 allowUnsafeHooksPath）。
 *   - R2 SSRF：允许 public HTTPS + SSH，内网/环回地址黑名单（对齐项目 security_rules）。
 *   - R3 凭据注入：password/token 走 host-scoped `http.<origin>.extraHeader`（git config），
 *     永不内嵌进 URL / argv；SSH 私钥写临时文件（0600）经 GIT_SSH_COMMAND 引用，用后即删。
 *   - Bug 修复（方案 A）：增量 sync 的 git clean 排除 .codegraph/，避免删掉 codegraph 索引库。
 */

import simpleGit, { CleanOptions, ResetMode, type SimpleGit } from "simple-git";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ISourceFetcher, FetchResult, SourceType, GitAuth } from "./types.js";

/**
 * 内网 / 环回 / link-local 地址黑名单（标准网段）：
 *   - 10. / 172.16-31. / 192.168.  → RFC1918 私有网段
 *   - 169.254.                     → link-local（含云元数据 169.254.169.254）
 *   - 127. / 0. / localhost / ::1  → 环回
 *   - fe80:                        → IPv6 link-local
 *
 * 该黑名单可通过环境变量 KNOWLEDGE_SSRF_CHECK=off 关闭（见 GitSourceFetcher 构造）。
 */
const PRIVATE_ADDR_RE =
  /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|127\.|0\.|localhost$|::1$|fe80:)/i;

/**
 * 读取 SSRF 私网黑名单开关。默认开启；
 * 当 KNOWLEDGE_SSRF_CHECK 为 off/false/0/no（大小写不敏感）时关闭。
 */
function ssrfCheckEnabledFromEnv(): boolean {
  const raw = process.env.KNOWLEDGE_SSRF_CHECK;
  if (raw == null || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return !(v === "off" || v === "false" || v === "0" || v === "no");
}

export interface GitSourceFetcherOptions {
  /**
   * 是否启用 SSRF 私网 / 环回地址黑名单校验。
   * 默认读环境变量 KNOWLEDGE_SSRF_CHECK（默认开启）；显式传入时优先于环境变量。
   */
  ssrfCheck?: boolean;
}

export class GitSourceFetcher implements ISourceFetcher {
  readonly supportedType: SourceType = "git";

  /** SSRF 私网黑名单校验开关（协议白名单校验始终生效，不受此开关影响）。 */
  private readonly ssrfCheck: boolean;

  constructor(opts?: GitSourceFetcherOptions) {
    this.ssrfCheck = opts?.ssrfCheck ?? ssrfCheckEnabledFromEnv();
  }

  validate(sourceUrl: string): void {
    const isSsh = sourceUrl.startsWith("git@") || sourceUrl.startsWith("ssh://");
    const isHttps = sourceUrl.startsWith("https://");
    if (!isHttps && !isSsh) {
      throw new Error("only https:// and ssh git URLs are supported");
    }
    const host = this.extractHost(sourceUrl);
    if (!host) {
      throw new Error(`invalid repo_url: cannot parse host from ${sourceUrl}`);
    }
    // R2: SSRF 防护 —— 禁止指向内网 / 环回地址（可经 KNOWLEDGE_SSRF_CHECK=off 关闭）。
    if (this.ssrfCheck && this.isPrivateAddress(host)) {
      throw new Error(`repo_url must not point to private/loopback address: ${host}`);
    }
  }

  async fetch(sourceUrl: string, branch: string, localPath: string, auth?: GitAuth): Promise<FetchResult> {
    this.validate(sourceUrl);
    await this.runAuthed(auth, async () => {
      // 浅克隆单分支。注：git clone/fetch 不会拉取远端的 .git/hooks（hooks 是本地态），
      // 所以正常仓库 clone 出来不带可执行钩子；此处不再配置 core.hooksPath。
      await this.buildGit(auth, sourceUrl).clone(sourceUrl, localPath, {
        "--depth": 1,
        "--branch": branch,
      });
    });
    const version = await this.headCommit(localPath);
    return { localPath, version, sourceType: "git" };
  }

  async sync(sourceUrl: string, branch: string, localPath: string, auth?: GitAuth): Promise<FetchResult> {
    this.validate(sourceUrl);
    await this.runAuthed(auth, async () => {
      const git = this.buildGit(auth, sourceUrl, localPath);
      await git.fetch("origin", branch, { "--depth": 1 });
      await git.reset(ResetMode.HARD, [`origin/${branch}`]);
      // Bug 修复（方案 A）：clean 排除 .codegraph/，否则会删掉 codegraph 的索引库，
      // 导致增量 sync 永远失败、每次回退到全量 clone。
      await git.clean(CleanOptions.FORCE + CleanOptions.RECURSIVE, ["-e", ".codegraph"]);
    });
    const version = await this.headCommit(localPath);
    return { localPath, version, sourceType: "git" };
  }

  // ── 认证 / git 构造 ──

  /**
   * 构造 simple-git 实例。password/token 通过 host-scoped `http.<origin>.extraHeader`
   * 注入 Authorization 头（git config），凭据不进 URL/argv。
   */
  private buildGit(auth: GitAuth | undefined, sourceUrl: string, baseDir?: string): SimpleGit {
    const config: string[] = [];
    if (auth && (auth.kind === "password" || auth.kind === "token")) {
      const key = this.buildExtraHeaderKey(sourceUrl);
      if (key) {
        const user =
          auth.kind === "password"
            ? (auth.username?.trim() || "git")
            : (auth.username?.trim() || "oauth2");
        const b64 = Buffer.from(`${user}:${auth.secret}`).toString("base64");
        config.push(`${key}=Authorization: Basic ${b64}`);
      }
    }
    return simpleGit(baseDir ? { baseDir, config } : { config });
  }

  private buildExtraHeaderKey(url: string): string | undefined {
    try {
      const u = new URL(url);
      u.username = "";
      u.password = "";
      u.search = "";
      u.hash = "";
      const scoped = `${u.protocol}//${u.host}${u.pathname}`.replace(/[\r\n\0]/g, "");
      return `http.${scoped}.extraHeader`;
    } catch {
      return undefined;
    }
  }

  /** SSH 私钥写临时文件（0600）+ GIT_SSH_COMMAND；password/token 无需额外 env。 */
  private async runAuthed(auth: GitAuth | undefined, fn: () => Promise<void>): Promise<void> {
    if (!auth || auth.kind !== "ssh") {
      await fn();
      return;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kg-ssh-"));
    const keyFile = path.join(dir, "id");
    await fs.writeFile(keyFile, auth.secret, { mode: 0o600 });

    const prev = {
      GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND,
      SSH_ASKPASS: process.env.SSH_ASKPASS,
      SSH_ASKPASS_REQUIRE: process.env.SSH_ASKPASS_REQUIRE,
      KNOWLEDGE_SSH_PASSPHRASE: process.env.KNOWLEDGE_SSH_PASSPHRASE,
    };
    process.env.GIT_SSH_COMMAND = `ssh -i "${keyFile}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null`;
    if (auth.passphrase) {
      const askPassFile = path.join(dir, "askpass.sh");
      await fs.writeFile(
        askPassFile,
        '#!/bin/sh\nprintf "%s" "$KNOWLEDGE_SSH_PASSPHRASE"\n',
        { mode: 0o700 },
      );
      process.env.SSH_ASKPASS = askPassFile;
      process.env.SSH_ASKPASS_REQUIRE = "force";
      process.env.KNOWLEDGE_SSH_PASSPHRASE = auth.passphrase;
    }

    try {
      await fn();
    } finally {
      process.env.GIT_SSH_COMMAND = prev.GIT_SSH_COMMAND;
      process.env.SSH_ASKPASS = prev.SSH_ASKPASS;
      process.env.SSH_ASKPASS_REQUIRE = prev.SSH_ASKPASS_REQUIRE;
      process.env.KNOWLEDGE_SSH_PASSPHRASE = prev.KNOWLEDGE_SSH_PASSPHRASE;
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ── 内部 helper ──

  private async headCommit(localPath: string): Promise<string | null> {
    try {
      return (await simpleGit(localPath).revparse(["HEAD"])).trim().slice(0, 12);
    } catch {
      return null;
    }
  }

  private extractHost(url: string): string {
    if (url.startsWith("git@") || url.startsWith("ssh://")) {
      const withoutScheme = url.startsWith("ssh://") ? url.slice("ssh://".length) : url;
      const authority = withoutScheme.split("/")[0];
      const hostPart = authority.includes("@")
        ? authority.slice(authority.lastIndexOf("@") + 1)
        : authority;
      return hostPart.startsWith("[")
        ? hostPart.slice(1, hostPart.indexOf("]") >= 0 ? hostPart.indexOf("]") : 1)
        : hostPart.split(":")[0];
    }
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  private isPrivateAddress(host: string): boolean {
    return PRIVATE_ADDR_RE.test(host);
  }
}
