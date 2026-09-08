  const getOrCreateWorkerPool = (): WorkerPool => {
    if (workerPool) return workerPool;
    try {
      // Test-only injection: integration tests pass a custom worker script URL
      // via `workerUrlForTest` so they can drive the chunk-loop with
      // deterministically-misbehaving workers without mocking the module import
      // graph. When unset, the normal src/ → dist/ resolution runs.
      let workerUrl =
        options?.workerUrlForTest ?? new URL('../workers/parse-worker.js', import.meta.url);
      // When running under vitest, import.meta.url points to src/ where no .js exists.
      // Fall back to the compiled dist/ worker so the pool can spawn real worker threads.
      const thisDir = fileURLToPath(new URL('.', import.meta.url));
      if (!options?.workerUrlForTest && !fs.existsSync(fileURLToPath(workerUrl))) {
        // Dev/source mode (tsx): the worker source file lives next to this .ts.
        const srcWorker = path.resolve(thisDir, '..', 'workers', 'parse-worker.ts');
        if (fs.existsSync(srcWorker)) {
          workerUrl = pathToFileURL(srcWorker);
        } else {
          const distWorker = path.resolve(
            thisDir,
            '..',
            '..',
            '..',
            '..',
            'dist',
            'core',
            'ingestion',
            'workers',
            'parse-worker.js',
          );
          if (fs.existsSync(distWorker)) {
            workerUrl = pathToFileURL(distWorker);
          }
        }
      }
      // Thread the ParsedFile store path into the pool so workers write their
      // own shards (#1983 parallel serialization). `parsedFileStorePath` is
      // declared below but this closure only runs from inside the chunk loop,
      // after it is initialized; `undefined` drives the worker no-store
      // fallback (return ParsedFiles in the result).
      workerPool = createWorkerPool(workerUrl, effectivePoolSize, {
        parsedFileStoreStoragePath: parsedFileStorePath,
        // Durable, content-addressed shard dir for warm-cache reuse (#2038).
        // Initialized below before the chunk loop (same deferred-init pattern
        // as `parsedFileStorePath`); this closure only runs from the loop.
        durableParsedFileStoragePath: durableParsedFileDir,

(Showing lines 663-702 of 1613. Use offset=703 to continue.)