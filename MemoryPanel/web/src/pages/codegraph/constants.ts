/**
 * CodeGraph 共享常量 — 颜色/大小/层级/语言推断。
 * GraphCanvas 和 FileTreePanel 共用的唯一真相源。
 */

export const NODE_COLORS: Record<string, string> = {
  Folder: '#6366f1', File: '#3b82f6', Class: '#f59e0b', Function: '#10b981',
  Method: '#14b8a6', Interface: '#ec4899', Process: '#f43f5e', Community: '#818cf8',
  Route: '#f43f5e', Variable: '#64748b', Property: '#64748b', Const: '#64748b',
  TypeAlias: '#a78bfa', Section: '#60a5fa', Enum: '#f97316', Decorator: '#eab308',
  Import: '#475569',
  // lowercase aliases for KS API node types (code-graph-view / code-analysis-view)
  class: '#f59e0b', interface: '#ec4899', function: '#10b981', method: '#14b8a6',
  file: '#3b82f6', variable: '#64748b', constant: '#64748b', property: '#64748b',
  import: '#475569', type_alias: '#a78bfa',
  folder: '#6366f1', process: '#f43f5e', community: '#818cf8',
  route: '#f43f5e', section: '#60a5fa', enum: '#f97316', decorator: '#eab308',
  const: '#64748b',
};

export const EDGE_COLORS: Record<string, string> = {
  CONTAINS: '#6b7280', DEFINES: '#06b6d4', CALLS: '#2563eb', IMPORTS: '#eab308',
  ACCESSES: '#f59e0b', MEMBER_OF: '#ec4899', HAS_PROPERTY: '#06b6d4',
  HAS_METHOD: '#3b82f6', USES: '#f97316', STEP_IN_PROCESS: '#10b981',
  METHOD_IMPLEMENTS: '#f43f5e', IMPLEMENTS: '#f43f5e',
  ENTRY_POINT_OF: '#ef4444', HANDLES_ROUTE: '#ef4444',
  // lowercase aliases (codegraph Edge.kind values)
  contains: '#6b7280', calls: '#2563eb', imports: '#eab308',
  exports: '#06b6d4', extends: '#f43f5e', implements: '#f43f5e',
  references: '#f59e0b', type_of: '#ec4899', returns: '#06b6d4',
  instantiates: '#8b5cf6', overrides: '#f97316', decorates: '#10b981',
};

export const NODE_SIZES: Record<string, number> = {
  Folder: 7, File: 4, Class: 6, Function: 3, Method: 2.5, Interface: 5,
  Process: 8, Community: 10, Route: 3.5, Variable: 2, Property: 2, Const: 2,
  TypeAlias: 2.5, Section: 5, Enum: 3.5, Decorator: 2, Import: 1.5,
  // lowercase aliases
  folder: 7, file: 4, class: 6, function: 3, method: 2.5, interface: 5,
  process: 8, community: 10, route: 3.5, variable: 2, property: 2, const: 2,
  type_alias: 2.5, section: 5, enum: 3.5, decorator: 2, import: 1.5,
  constant: 2,
};

export const TYPE_TO_LAYER: Record<string, number> = {
  Folder: 0, Process: 0, Community: 0,
  File: 1, Section: 1, Import: 1, Route: 1,
  Class: 2, Interface: 2, Enum: 2, TypeAlias: 2,
  Function: 3, Method: 3, Variable: 3, Const: 3, Property: 3, Decorator: 3,
  // lowercase aliases
  folder: 0, process: 0, community: 0,
  file: 1, section: 1, import: 1, route: 1,
  class: 2, interface: 2, enum: 2, type_alias: 2,
  function: 3, method: 3, variable: 3, const: 3, property: 3, decorator: 3,
  constant: 3,
};

export function getLayer(label: string): number {
  return TYPE_TO_LAYER[label] ?? 2;
}

export function guessLang(filePath: string): string {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c',
    cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', rb: 'ruby',
    php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala',
    sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
    xml: 'xml', html: 'html', css: 'css', scss: 'scss',
    md: 'markdown', sh: 'bash', bash: 'bash', zsh: 'bash',
    dockerfile: 'dockerfile', toml: 'toml', ini: 'ini',
    proto: 'protobuf', vue: 'markup', svelte: 'markup',
  };
  return map[ext] || 'text';
}

export const ALL_LABELS = [
  'folder', 'file', 'class', 'interface', 'function', 'method',
  'variable', 'property', 'const', 'type_alias', 'enum', 'decorator',
  'import', 'section', 'process', 'community', 'route',
];

export const FILTERABLE_LABELS = [
  'folder', 'file', 'class', 'interface', 'function', 'method',
  'variable', 'property', 'const', 'type_alias', 'enum', 'decorator', 'import',
];

export const ALL_EDGE_TYPES = [
  'CONTAINS', 'DEFINES', 'CALLS', 'IMPORTS', 'ACCESSES', 'MEMBER_OF',
  'HAS_PROPERTY', 'HAS_METHOD', 'USES', 'STEP_IN_PROCESS',
  'METHOD_IMPLEMENTS', 'IMPLEMENTS', 'ENTRY_POINT_OF', 'HANDLES_ROUTE',
  // lowercase aliases (codegraph Edge.kind values)
  'contains', 'calls', 'imports', 'exports', 'extends', 'implements',
  'references', 'type_of', 'returns', 'instantiates', 'overrides', 'decorates',
];

export const LANG_EXT_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
  py: 'Python', rs: 'Rust', go: 'Go', java: 'Java',
  c: 'C', cpp: 'C++', cs: 'C#', rb: 'Ruby',
  php: 'PHP', swift: 'Swift', kt: 'Kotlin', scala: 'Scala',
  sql: 'SQL', json: 'JSON', yaml: 'YAML', xml: 'XML',
  html: 'HTML', css: 'CSS', scss: 'SCSS', md: 'Markdown',
  sh: 'Shell', proto: 'Protobuf', vue: 'Vue', svelte: 'Svelte',
};