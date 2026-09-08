/**
 * FileTreePanel — 文件树 + 图例 + 过滤面板。
 * 双模式：Graph 树（图谱节点）| Files 树（仓库文件）
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { GraphNode } from '../CodeGraphPage';
import { NODE_COLORS, EDGE_COLORS, FILTERABLE_LABELS } from '../constants';
import { getPanelSession } from '@/lib/panelSession';
import { FolderOpen, FileText, ChevronRight, ChevronDown, GitBranch, FolderTree } from 'lucide-react';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: FileTreeNode[];
  size?: number;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children: TreeNode[];
  graphNode?: GraphNode;
  symbolCount?: number;
}

function buildTree(nodes: GraphNode[]): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();
  const pathCounts = new Map<string, number>();
  for (const n of nodes) {
    if (n.path) pathCounts.set(n.path, (pathCounts.get(n.path) ?? 0) + 1);
  }
  const fileNodes = nodes.filter(n => n.label === 'File' || n.label === 'Folder');
  fileNodes.sort((a, b) => (a.filePath || '').localeCompare(b.filePath || ''));
  for (const node of fileNodes) {
    const parts = (node.filePath || 'unknown').split('/').filter(Boolean);
    let curPath = '';
    let level = root;
    for (let i = 0; i < parts.length; i++) {
      curPath = curPath ? `${curPath}/${parts[i]}` : parts[i];
      let existing = pathMap.get(curPath);
      if (!existing) {
        const isLast = i === parts.length - 1;
        existing = {
          id: isLast ? node.id : curPath,
          name: parts[i],
          type: isLast && node.label === 'File' ? 'file' : 'folder',
          path: curPath,
          children: [],
          graphNode: isLast ? node : undefined,
          symbolCount: isLast ? (pathCounts.get(node.path) ?? 0) : undefined,
        };
        pathMap.set(curPath, existing);
        level.push(existing);
      }
      level = existing.children;
    }
  }
  return root;
}

interface Props {
  nodes: GraphNode[];
  onFocusNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  visibleLabels: string[];
  visibleEdgeTypes: string[];
  onToggleLabel: (label: string) => void;
  onToggleEdgeType: (type: string) => void;
  depthFilter: number | null;
  onDepthFilter: (depth: number | null) => void;
  repoPath: string;
  onFileClick?: (filePath: string) => void;
}

export function FileTreePanel({
  nodes, onFocusNode, selectedNodeId, visibleLabels, visibleEdgeTypes,
  onToggleLabel, onToggleEdgeType, depthFilter, onDepthFilter, repoPath, onFileClick,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [treeMode, setTreeMode] = useState<'graph' | 'files'>('graph');
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const graphTree = useMemo(() => buildTree(nodes), [nodes]);

  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) {
      const t = (n.type || n.label || '').toLowerCase();
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [nodes]);

  useEffect(() => {
    if (treeMode === 'files' && fileTree.length === 0 && repoPath) {
      setLoadingFiles(true);
      const session = getPanelSession();
      const headers: Record<string, string> = {};
      if (session) { headers['X-Tdai-Service-Id'] = session.instanceId; headers['X-Tdai-User-Key'] = session.userKey; }
      fetch(`/api/v1/knowledge/code-graph/engine/tree?repo=${encodeURIComponent(repoPath)}&dir=`, { headers })
        .then(r => r.json())
        .then(d => { if (d.code === 0) setFileTree(d.data.tree || []); })
        .catch(() => {})
        .finally(() => setLoadingFiles(false));
    }
  }, [treeMode, repoPath, fileTree.length]);

  const toggleExpand = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const renderFileTree = (tree: FileTreeNode[], depth = 0): JSX.Element[] => {
    return tree.map(item => {
      const isExpanded = expanded.has(item.path);
      const isDir = item.type === 'dir';
      return (
        <div key={item.path}>
          <button
            onClick={() => {
              if (isDir) toggleExpand(item.path);
              else onFileClick?.(item.path);
            }}
            className="flex items-center gap-1 w-full text-left px-1.5 py-0.5 text-xs hover:bg-gray-100 rounded"
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {isDir ? (
              isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />
            ) : <span className="w-3" />}
            {isDir ? <FolderOpen size={12} className="text-yellow-500" /> : <FileText size={12} className="text-blue-500" />}
            <span className="truncate text-gray-700">{item.name}</span>
          </button>
          {isDir && isExpanded && item.children && renderFileTree(item.children, depth + 1)}
        </div>
      );
    });
  };

  const renderGraphTree = (tree: TreeNode[], depth = 0): JSX.Element[] => {
    return tree.map(item => {
      const isExpanded = expanded.has(item.id);
      return (
        <div key={item.id}>
          <button
            onClick={() => {
              if (item.type === 'folder') toggleExpand(item.id);
              else if (item.graphNode) onFocusNode(item.graphNode.id);
            }}
            className={`flex items-center gap-1 w-full text-left px-1.5 py-0.5 text-xs rounded ${item.graphNode?.id === selectedNodeId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {item.type === 'folder' ? (
              isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />
            ) : <span className="w-3" />}
            {item.type === 'folder' ? <FolderOpen size={12} className="text-yellow-500" /> : <FileText size={12} className="text-blue-500" />}
            <span className="truncate">{item.name}</span>
            {item.symbolCount != null && item.symbolCount > 0 && (
              <span className="ml-auto text-[10px] text-gray-400">{item.symbolCount}</span>
            )}
          </button>
          {item.type === 'folder' && isExpanded && renderGraphTree(item.children, depth + 1)}
        </div>
      );
    });
  };

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 bg-gray-50 border-r border-gray-200">
        <ChevronRight size={14} />
      </button>
    );
  }

  return (
    <div className="flex flex-col border-r border-gray-200 bg-white h-full" style={{ flexShrink: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-gray-600">
            <ChevronRight size={14} />
          </button>
          <span className="text-xs font-semibold text-gray-600">Explorer</span>
        </div>
        {/* Tree mode toggle */}
        <div className="flex rounded bg-gray-100 p-0.5">
          <button onClick={() => setTreeMode('graph')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${treeMode === 'graph' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
            <GitBranch size={12} /> 图谱
          </button>
          <button onClick={() => setTreeMode('files')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${treeMode === 'files' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
            <FolderTree size={12} /> 文件预览
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-2.5 py-2 border-b border-gray-100 space-y-2">
        <div>
          <h3 className="mb-1 text-[10px] font-semibold text-gray-400 uppercase">Node Types</h3>
          <div className="flex flex-wrap gap-1">
            {FILTERABLE_LABELS.map(label => {
              const count = nodeTypeCounts[label] ?? 0;
              const active = visibleLabels.includes(label);
              const displayName = label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <button key={label} onClick={() => onToggleLabel(label)}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-300 line-through hover:bg-gray-50'}`}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[label] || NODE_COLORS[label.replace(/_/g, '')] || '#999' }} />
                  {displayName}
                  {count > 0 && <span className="text-gray-400">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-[10px] font-semibold text-gray-400 uppercase">Edge Types</h3>
          <div className="flex flex-wrap gap-1">
            {['CALLS', 'DEFINES', 'IMPORTS', 'ACCESSES', 'MEMBER_OF', 'HAS_PROPERTY', 'HAS_METHOD'].map(et => {
              const active = visibleEdgeTypes.includes(et);
              return (
                <button key={et} onClick={() => onToggleEdgeType(et)}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-300 line-through hover:bg-gray-50'}`}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: EDGE_COLORS[et] || '#999' }} />
                  {et}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Depth:</span>
          {[1, 2, 3, null].map(d => (
            <button key={String(d)} onClick={() => onDepthFilter(d)}
              className={`px-1.5 py-0.5 rounded text-[11px] ${depthFilter === d ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {d ?? '∞'}
            </button>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {treeMode === 'files' ? (
          loadingFiles ? (
            <div className="text-xs text-gray-400 text-center py-4">加载中...</div>
          ) : fileTree.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">暂无文件</div>
          ) : (
            renderFileTree(fileTree)
          )
        ) : (
          graphTree.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">No nodes</div>
          ) : (
            renderGraphTree(graphTree)
          )
        )}
      </div>
    </div>
  );
}