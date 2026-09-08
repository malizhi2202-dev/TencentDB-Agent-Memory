






const DEFAULT_IGNORE_LIST = new Set([
  // Version Control
  '.git',
  '.svn',
  '.hg',
  '.bzr',

  // IDEs & Editors
  '.idea',
  '.vscode',
  '.vs',
  '.eclipse',
  '.settings',
  '.DS_Store',
  'Thumbs.db',

  // Dependencies
  'node_modules',
  'bower_components',
  'jspm_packages',
  'vendor', // PHP/Go
  'third_party', // C/C++ (Google-style vendored dependencies)
  '3rdparty', // C/C++ (alternate spelling, also Qt convention)
  // 'packages' removed - commonly used for monorepo source code (lerna, pnpm, yarn workspaces)
  'venv',
  '.venv',
  'env',
  '.env',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'site-packages',
  '.tox',
  'eggs',
  '.eggs',
  'lib64',
  'parts',
  'sdist',
  'wheels',

  // Build Outputs
  'dist',
  'build',
  'out',
  'output',
  'bin',
  'obj',
  'target', // Java/Rust
  '.next',
  '.nuxt',
  '.output',
  '.vercel',
  '.netlify',
  '.serverless',
  '_build',
  'public/build',
  '.parcel-cache',
  '.turbo',
  '.svelte-kit',

  // Test & Coverage
  'coverage',
  '.nyc_output',
  'htmlcov',
  '.coverage',
  '__tests__', // Often just test files
  '__mocks__',
  '.jest',

  // Logs & Temp
  'logs',
  'log',
  'tmp',
  'temp',
  'cache',
  '.cache',
  '.tmp',
  '.temp',

  // Generated/Compiled
  '.generated',
  'generated',
  'auto-generated',
  'monaco-workers', // Monaco editor web-worker bundles generated for browser runtime
  '.terraform',
  '.serverless',

  // Documentation (optional - might want to keep)
  // 'docs',
  // 'documentation',

  // Misc
  '.husky',
  '.github', // GitHub config, not code
  '.circleci',
  '.gitlab',
  'fixtures', // Test fixtures
  'snapshots', // Jest snapshots
  '__snapshots__',
]);

const IGNORED_EXTENSIONS = new Set([
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.psd',
  '.ai',
  '.sketch',
  '.fig',
  '.xd',

  // Archives
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.bz2',
  '.xz',
  '.tgz',

  // Binary/Compiled
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.a',
  '.lib',
  '.o',
  '.obj',
  '.class',
  '.jar',

(Showing lines 8-147 of 513. Use offset=148 to continue.)


























































































































































































































































































































export const createIgnoreFilter = async (repoPath: string, options?: IgnoreOptions) => {
  const ig = await loadIgnoreRules(repoPath, options);

  return {
    ignored(p: Path): boolean {
      // The `ignore` package expects POSIX separators; path-scurry can surface
      // native separators on Windows when called through glob.
      const rel = p.relative().replace(/\\/g, '/');
      if (!rel) return false;
      // User's .gitnexusignore negation takes precedence over hardcoded
      // rules (#771). If any ancestor or the path itself was explicitly
      // unignored AND no more-specific rule re-ignores this exact path,
      // allow it through. The `!ig.ignores(rel)` guard matches
      // .gitignore's last-match-wins semantics: `!__tests__/` followed
      // by `__tests__/generated/` negates the parent but still blocks
      // the re-ignored child.
      if (ig && hasExplicitUnignore(ig, rel) && !ig.ignores(rel)) return false;
      // Check .gitignore / .gitnexusignore patterns
      if (ig && ig.ignores(rel)) return true;
      // Fall back to hardcoded rules
      return shouldIgnorePath(rel);
    },
    childrenIgnored(p: Path): boolean {
      // Note: dot-directories (.git, .vscode, etc.) are primarily excluded by
      // glob's `dot: false` option in filesystem-walker.ts. The hardcoded
      // list check below is defense-in-depth — do not remove `dot: false`
      // assuming this covers it.
      const rel = p.relative().replace(/\\/g, '/');
      // User's .gitnexusignore negation takes precedence (#771) — if the
      // user explicitly unignored this directory or any ancestor via a

(Showing lines 464-493 of 513. Use offset=494 to continue.)