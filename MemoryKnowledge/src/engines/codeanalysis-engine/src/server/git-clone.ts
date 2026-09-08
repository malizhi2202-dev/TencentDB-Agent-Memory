function resolveGitCredential(options?: { token?: string; auth?: GitAuth; url?: string }): string | undefined {
  const url = options?.url;
  if (!url) return undefined;

  // 1. 显式 password/token —— 用户已选定目标仓库并显式提供凭据（validateGitUrl
  //    已挡私网/内网），host 不再限（覆盖 GitLab/Gitee/自建 Git 等任意平台）。
  const auth = options?.auth;
  if (auth && (auth.kind === 'password' || auth.kind === 'token')) {
    const user = auth.kind === 'password'
      ? (auth.username?.trim() || 'git')
      : (auth.username?.trim() || 'oauth2');
    return Buffer.from(`${user}:${auth.secret}`).toString('base64');
  }

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  // 2. Per-request GitHub PAT — github.com only (mirrors the /api/analyze
  //    host-bind so the user's token is never sent off github.com).
  if (options.token && GITHUB_TOKEN_HOSTS.has(host)) {
    return Buffer.from(`x-access-token:${options.token}`).toString('base64');
  }

  // 3. Server-configured Azure DevOps PAT — Azure hosts only.
  const azurePat = process.env.AZURE_DEVOPS_PAT;
  if (azurePat && isAzureDevOpsUrl(url)) {
    return Buffer.from(`:${azurePat}`).toString('base64');
  }

  return undefined;
}

/**
 * Build the host-scoped git config key `http.<origin+path>.extraHeader` from
 * the raw clone URL, so the Authorization header is attached only to the
 * intended origin (and its clone sub-requests like /info/refs), never a
 * redirect target. Derived from the SAME raw URL git clones from — not the
 * normalize-for-compare form, which strips `.git` and would desync the key
 * from the wire URL and silently disable the header. Userinfo/query/fragment
 * are dropped (not part of git's URL match) and control characters stripped
 * (git rejects a newline in a config key outright).
 */
function buildExtraHeaderKey(url: string): string | undefined {
  let scoped: string;
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    u.search = '';
    u.hash = '';
    scoped = `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return undefined;
  }
  scoped = scoped.replace(/[\r\n\0]/g, '');
  return `http.${scoped}.extraHeader`;
}

/**
 * Warn (do not block) when a credential is about to be sent over cleartext
 * http://. Base64 is encoding, not encryption, so an on-path observer can
 * read the PAT. We keep http:// working for self-hosted Azure DevOps Server.
 */
function warnIfCleartextCredential(url?: string): void {
  if (!url) return;
  try {
    const u = new URL(url);
    if (u.protocol === 'http:') {
      logger.warn(
        `Sending a git credential over cleartext http:// (${u.host}) — base64 is not encryption. Prefer https:// where the host supports it.`,
      );
    }
  } catch {
    /* resolver already validated the URL */
  }
}

/**
 * Build the spawn env for `git`. Suppresses credential prompts and, when a
 * credential resolves (see resolveGitCredential), injects a single
 * host-scoped Authorization header via the `GIT_CONFIG_*` env protocol
 * (git ≥2.31) so credentials never appear in argv or the URL. Appends after
 * any existing `GIT_CONFIG_COUNT` rather than overwriting it. Exported for
 * unit tests.
 */
export function buildGitEnv(
  baseEnv: NodeJS.ProcessEnv,
  options?: { token?: string; auth?: GitAuth; url?: string },
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    // Prevent git from prompting for credentials (hangs the process)
    GIT_TERMINAL_PROMPT: '0',
    // Ensure no credential helper tries to open a GUI prompt
    GIT_ASKPASS: process.platform === 'win32' ? 'echo' : '/bin/true',
    // Scrub git's HTTP/transport trace vars: if inherited from the parent
    // process they dump every request header — including the injected
    // Authorization header — to stderr, which runGit captures and logs.
    // `undefined` makes child_process omit the key from the child env.
    GIT_TRACE: undefined,
    GIT_TRACE_CURL: undefined,
    GIT_TRACE_PACKET: undefined,
    GIT_CURL_VERBOSE: undefined,
  };

  const credential = resolveGitCredential(options);
  const key = options?.url ? buildExtraHeaderKey(options.url) : undefined;
  if (credential && key) {
    // Append after any GIT_CONFIG_* the operator already set, so we never
    // clobber their git config (e.g. an enforced http.sslVerify).
    const existing = Number.parseInt(env.GIT_CONFIG_COUNT ?? '', 10);
    const base = Number.isInteger(existing) && existing > 0 ? existing : 0;
    env.GIT_CONFIG_COUNT = String(base + 1);
    env[`GIT_CONFIG_KEY_${base}`] = key;
    env[`GIT_CONFIG_VALUE_${base}`] = `Authorization: Basic ${credential}`;
    warnIfCleartextCredential(options?.url);
  }

  return env;
}

/**
 * 写 SSH 私钥到临时目录（0600），返回 git ssh 所需的环境变量 + cleanup。
 * 私钥不进 argv/URL，通过 GIT_SSH_COMMAND 的 -i 引用文件；口令走 askpass
 * 脚本（脚本内容固定，口令经环境变量传递，避免 shell 注入与落盘）。
 */
async function buildSshEnv(auth: GitAuth): Promise<{ env: NodeJS.ProcessEnv; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitnexus-ssh-'));
  const keyFile = path.join(dir, 'id');
  await fs.writeFile(keyFile, auth.secret, { mode: 0o600 });
  const env: NodeJS.ProcessEnv = {
    GIT_SSH_COMMAND: `ssh -i "${keyFile}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null`,
  };
  if (auth.passphrase) {
    const askPassFile = path.join(dir, 'askpass.sh');
    await fs.writeFile(
      askPassFile,
      '#!/bin/sh\nprintf "%s" "$GITNEXUS_SSH_PASSPHRASE"\n',
      { mode: 0o700 },
    );
    env.SSH_ASKPASS = askPassFile;
    env.SSH_ASKPASS_REQUIRE = 'force';
    env.GITNEXUS_SSH_PASSPHRASE = auth.passphrase;
  }
  return {
    env,
    cleanup: async () => {
      try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

// `options` carries the credential inputs: a per-request GitHub `token`, an
// explicit `auth`（password/token/ssh）and the clone `url`. buildGitEnv injects
// at most ONE host-scoped Authorization header (password/token basic auth, else
// GitHub PAT / AZURE_DEVOPS_PAT) via GIT_CONFIG_* protocol；SSH 走 buildSshEnv
// 的 GIT_SSH_COMMAND。凭据永不进 argv/URL。See resolveGitCredential / buildExtraHeaderKey.
function runGit(
  args: string[],
  cwd?: string,
  options?: { token?: string; auth?: GitAuth; url?: string },
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    void (async () => {
      let sshCleanup: (() => Promise<void>) | undefined;
      let sshEnv: NodeJS.ProcessEnv = {};
      try {
        if (options?.auth?.kind === 'ssh') {
          const r = await buildSshEnv(options.auth);
          sshEnv = r.env;
          sshCleanup = r.cleanup;
        }
        const env = { ...buildGitEnv(process.env, options), ...sshEnv };
        const proc = spawn('git', args, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env,
        });

        let stderr = '';
        proc.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk;
        });

        proc.on('close', (code) => {
          void sshCleanup?.();
          if (code === 0) resolve();
          else {
            // Log full stderr internally but don't expose it to API callers (SSRF mitigation)
            if (stderr.trim()) logger.error(`git ${args[0]} stderr: ${stderr.trim()}`);
            reject(new Error(`git ${args[0]} failed (exit code ${code})`));
          }
        });

        proc.on('error', (err) => {
          void sshCleanup?.();
          reject(new Error(`Failed to spawn git: ${err.message}`));
        });
      } catch (err) {
        await sshCleanup?.();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  });
}