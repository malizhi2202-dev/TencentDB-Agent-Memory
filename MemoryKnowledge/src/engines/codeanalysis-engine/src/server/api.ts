  <p class="endpoint"><code>/api/graph</code> <code>/api/query</code> <code>/api/search</code> <span style="color:#5a5a70">— Data</span></p>
  <p class="endpoint"><code>/api/mcp</code> <span style="color:#5a5a70">— MCP over StreamableHTTP</span></p>
  <div class="divider"></div>
  <div class="section-title">Web UI not found</div>
  <div class="terminal"><span class="prompt">$ </span><span class="cmd">cd gitnexus-web &amp;&amp; npm run build</span></div>
  <div class="link-row">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    <a class="ext" href="https://gitnexus.vercel.app" target="_blank" rel="noopener noreferrer">gitnexus.vercel.app</a>
    <span style="color:#5a5a70">— connects to this server</span>
  </div>
</div>
</body>
</html>`;

export const staticCacheControlSetHeaders = (res: express.Response, filePath: string): void => {
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
};

export const registerWebUI = (app: express.Express, staticDir: string | null): void => {
  if (staticDir) {
    app.use(
      express.static(staticDir, {
        setHeaders: staticCacheControlSetHeaders,
      }),
    );
    // ⚠ This must remain the LAST route before the global error handler.
    // The regex excludes /api paths AND paths with file extensions (.js, .css, etc.)
    // so missing assets get real 404s instead of the SPA HTML.
    // Adding routes below this will be unreachable for non-API, non-asset paths.
    // Rate-limited (CodeQL js/missing-rate-limiting): the SPA fallback
    // serves a constant index.html, but the FS access from a route handler
    // is enough to trip the analyzer. The limit is generous (300 rpm/IP =
    // 5 req/s sustained) so that multi-tab browser navigation, prefetch,
    // and service-worker revalidation do not produce 429s for legitimate
    // SPA users. At this rate, real browser navigation is extremely
    // unlikely to hit the limit in practice, so the cosmetic issue of
    // JSON-on-429 to a browser is a low-likelihood path. Content
    // negotiation on the 429 (returning the SPA shell to HTML clients
    // instead of `{ error: '...' }`) would require swapping
    // express-rate-limit's `message` for a `handler` function and is
    // deferred to keep this PR focused on closing the CodeQL alert.
    app.get(SPA_FALLBACK_REGEX, createRouteLimiter({ limit: 300 }), (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('html').send(landingPageHtml());
    });
  }
};

const ensureStreamIsWritable = (res: express.Response, signal?: AbortSignal): void => {
  if (signal?.aborted || res.destroyed || res.writableEnded) {
    throw new ClientDisconnectedError();
  }
};

const waitForDrain = async (res: express.Response, signal?: AbortSignal): Promise<void> => {
  ensureStreamIsWritable(res, signal);

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('close', onClose);
      signal?.removeEventListener('abort', onAbort);
    };

    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new ClientDisconnectedError());
    };
    const onAbort = () => {

(Showing lines 220-299 of 2060. Use offset=300 to continue.)