


























































































































































































































































































































































































 * Run the respawned analyzer while teeing child output through to the parent
 * and keeping a bounded tail for crash classification.
 *
 * `execFileSync(..., { stdio: 'inherit' })` preserved live progress but hid
 * stderr/stdout from the parent on abnormal exits. That made every
 * SIGABRT/status-134 child look like an output-less V8 heap OOM, even when the
 * terminal had already shown a native crash such as
 * `libc++abi: ... Napi::Error`. Piped streams plus an explicit tee keeps the UX
 * and gives `childProcessLikelyOom` the evidence it needs.
 */
const runRespawnedAnalyze = (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<RespawnExit> =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (exit: RespawnExit): void => {
      if (settled) return;
      settled = true;
      resolve(exit);
    };

    const child = spawn(process.execPath, [...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
      env,
    });

    child.stdout?.on('data', (chunk) => {
      stdout = appendOutputTail(stdout, chunk);
      realStdoutWrite(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = appendOutputTail(stderr, chunk);
      realStderrWrite(chunk);
    });
    child.on('error', (err) => {
      finish({
        status: 1,
        signal: null,
        stdout,
        stderr,
        message: err instanceof Error ? err.message : String(err),
      });
    });
    child.on('close', (status, signal) => {
      finish({
        status,

(Showing lines 380-429 of 1932. Use offset=430 to continue.)