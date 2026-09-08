
  const binaryPath = path.join(pkgDir, 'lbugjs.node');
  // A missing binary is recoverable whenever the prebuilt sub-package is present
  // — the install script's copy is all that was skipped. Try that before
  // reporting failure, so runners that cannot opt into lifecycle scripts (bunx)
  // work instead of dead-ending on instructions they have no way to follow.
  const restore = fs.existsSync(binaryPath)
    ? 'restored'
    : restorePrebuiltNativeBinary(pkgDir, binaryPath);
  if (restore !== 'restored') return unrestorableBinaryFailure(restore, pkgDir, binaryPath);

  // Validate loadability in a THROWAWAY CHILD PROCESS, not in-process. A merely
  // truncated or corrupted .node (valid header, missing pages) does not throw a
  // catchable error — it SIGBUSes the dynamic loader mid-dlopen, which would take
  // the whole CLI down with a raw exit 135 and no guidance (#2441). Loading it in
  // a child lets us observe that crash (a non-zero exit or a kill signal) and turn
  // it into the same actionable failure as a clean load error. The child requires
  // the binary by absolute path, exactly as the former in-process load did.
  const probe = spawnSync(process.execPath, ['-e', 'require(process.argv[1])', binaryPath], {
    encoding: 'utf8',
    timeout: NATIVE_LOAD_PROBE_TIMEOUT_MS,
    stdio: ['ignore', 'ignore', 'pipe'],
    // Run as Node even if process.execPath is an Electron/embedder binary.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });

  // Only a child that actually RAN and failed proves the binary is bad. If the
  // probe could not run at all — a spawn error or a timeout, e.g. a sandbox that
  // forbids subprocesses or a non-Node execPath — we could not test the binary,
  // so we stay out of the way and let the command's own load be the authority
  // rather than condemn a healthy binary. (#2441 still holds: a genuinely broken
  // binary loaded in-process later still exits non-zero.)
  if (probe.error || probe.status === 0) {
    return { ok: true, binaryPath };
  }

  // One failure class is NOT repairable by reinstalling: a host whose glibc is
  // older than the prebuilt binary requires. Every download ships the same
  // binary, so the generic advice below sends the user around a loop that always
  // ends here (#2672). Branch before it, and only here — on the arm where the

(Showing lines 225-264 of 514. Use offset=265 to continue.)