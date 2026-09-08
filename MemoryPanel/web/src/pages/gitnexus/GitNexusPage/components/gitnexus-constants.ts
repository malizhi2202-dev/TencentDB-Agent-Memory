/**
 * GitNexus 工具定义 —— 17 个 MCP 工具，按类别分组。
 */

export interface GitNexusToolParam {
  name: string;
  label: string;
  type: 'string' | 'integer' | 'boolean';
  required: boolean;
  default?: string | number | boolean;
  placeholder?: string;
}

export interface GitNexusToolDef {
  name: string;
  label: string;
  description: string;
  params: GitNexusToolParam[];
}

export interface GitNexusToolCategory {
  key: string;
  label: string;
  tools: GitNexusToolDef[];
}

export const GITNEXUS_TOOL_CATEGORIES: GitNexusToolCategory[] = [
  {
    key: 'search',
    label: '搜索与查询',
    tools: [
      {
        name: 'list_repos',
        label: '仓库列表',
        description: '列出已索引的仓库',
        params: [],
      },
      {
        name: 'query',
        label: '混合搜索',
        description: '混合 BM25 + 语义搜索代码符号和流程',
        params: [
          { name: 'search_query', label: '搜索词', type: 'string', required: true, placeholder: '输入搜索查询...' },
          { name: 'task_context', label: '任务上下文', type: 'string', required: false, placeholder: '可选，用于语义搜索' },
          { name: 'limit', label: '返回上限', type: 'integer', required: false, default: 5 },
        ],
      },
      {
        name: 'cypher',
        label: 'Cypher 查询',
        description: '类 Cypher 图查询语言（MATCH WHERE RETURN）',
        params: [
          { name: 'query', label: 'Cypher 语句', type: 'string', required: true, placeholder: 'MATCH (n) WHERE n.kind="function" RETURN n' },
        ],
      },
    ],
  },
  {
    key: 'analysis',
    label: '符号分析',
    tools: [
      {
        name: 'context',
        label: '符号上下文',
        description: '360° 符号上下文：调用者、被调用者、定义',
        params: [
          { name: 'name', label: '符号名', type: 'string', required: false, placeholder: '如 AuthService' },
          { name: 'uid', label: '符号 UID', type: 'string', required: false, placeholder: '零歧义查找' },
          { name: 'include_content', label: '包含源码', type: 'boolean', required: false, default: false },
        ],
      },
      {
        name: 'impact',
        label: '影响分析',
        description: '爆炸半径分析：修改一个符号会影响什么',
        params: [
          { name: 'symbol', label: '符号名', type: 'string', required: false, placeholder: '要分析的符号' },
          { name: 'uid', label: '符号 UID', type: 'string', required: false },
          { name: 'depth', label: '分析深度', type: 'integer', required: false, default: 2 },
        ],
      },
      {
        name: 'explain',
        label: '污点分析',
        description: '判断符号是数据源（source）还是数据汇（sink）',
        params: [
          { name: 'symbol', label: '符号名', type: 'string', required: false },
          { name: 'uid', label: '符号 UID', type: 'string', required: false },
        ],
      },
      {
        name: 'trace',
        label: '执行流追踪',
        description: '从符号出发追踪上下游调用链',
        params: [
          { name: 'symbol', label: '符号名', type: 'string', required: false },
          { name: 'uid', label: '符号 UID', type: 'string', required: false },
          { name: 'direction', label: '方向', type: 'string', required: false, placeholder: 'upstream / downstream / both' },
          { name: 'maxDepth', label: '最大深度', type: 'integer', required: false, default: 5 },
        ],
      },
      {
        name: 'pdg_query',
        label: 'PDG 查询',
        description: '程序依赖图（PDG）查询',
        params: [
          { name: 'symbol', label: '符号名', type: 'string', required: false },
          { name: 'file', label: '按文件过滤', type: 'string', required: false },
          { name: 'limit', label: '返回上限', type: 'integer', required: false, default: 50 },
        ],
      },
    ],
  },
  {
    key: 'change',
    label: '变更管理',
    tools: [
      {
        name: 'detect_changes',
        label: '变更检测',
        description: '分析 git 未提交变更的影响范围',
        params: [
          { name: 'scope', label: '范围', type: 'string', required: false, placeholder: 'unstaged 或 staged' },
        ],
      },
      {
        name: 'rename',
        label: '安全重命名',
        description: '图辅助安全重命名（dry_run 预览影响面）',
        params: [
          { name: 'symbol', label: '符号名', type: 'string', required: true, placeholder: '要重命名的符号' },
          { name: 'new_name', label: '新名称', type: 'string', required: true },
          { name: 'dry_run', label: '试运行', type: 'boolean', required: false, default: true },
        ],
      },
      {
        name: 'check',
        label: '代码检查',
        description: '代码质量检查（TODO/FIXME/console.log/any 类型等）',
        params: [
          { name: 'file', label: '按文件过滤', type: 'string', required: false },
          { name: 'symbol', label: '按符号过滤', type: 'string', required: false },
        ],
      },
    ],
  },
  {
    key: 'discovery',
    label: 'API 与工具发现',
    tools: [
      {
        name: 'route_map',
        label: '路由发现',
        description: '自动扫描项目中的 HTTP 路由定义',
        params: [],
      },
      {
        name: 'tool_map',
        label: '工具发现',
        description: '自动扫描项目中的命令行工具和脚本',
        params: [],
      },
      {
        name: 'api_impact',
        label: 'API 影响分析',
        description: '修改某个 API 端点会影响哪些消费者',
        params: [
          { name: 'path', label: 'API 路径', type: 'string', required: false },
          { name: 'method', label: 'HTTP 方法', type: 'string', required: false },
        ],
      },
    ],
  },
  {
    key: 'type',
    label: '类型系统',
    tools: [
      {
        name: 'shape_check',
        label: '接口一致性',
        description: '接口/类型一致性检查',
        params: [
          { name: 'file', label: '按文件过滤', type: 'string', required: false },
          { name: 'interface', label: '按接口名过滤', type: 'string', required: false },
        ],
      },
    ],
  },
  {
    key: 'cross',
    label: '跨仓库',
    tools: [
      {
        name: 'group_list',
        label: '仓库组列表',
        description: '跨仓库组列表',
        params: [],
      },
      {
        name: 'group_sync',
        label: '仓库组同步',
        description: '跨仓库组同步',
        params: [
          { name: 'groupName', label: '组名', type: 'string', required: false },
        ],
      },
    ],
  },
];