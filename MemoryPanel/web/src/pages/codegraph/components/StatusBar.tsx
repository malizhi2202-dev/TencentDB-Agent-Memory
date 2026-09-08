/**
 * StatusBar — 图谱底部状态栏。
 * 显示节点/边统计、节点种类颜色图例、快捷键提示。
 */
import { NODE_COLORS } from '../constants';
import type { GraphNode } from '../CodeGraphPage';

interface Props {
  nodeCount: number;
  edgeCount: number;
  nodes: GraphNode[];
  selectedNodeName?: string;
  isLayoutRunning?: boolean;
}

export function StatusBar({ nodeCount, edgeCount, nodes, selectedNodeName, isLayoutRunning }: Props) {
  const nodeTypeCounts: Record<string, number> = {};
  for (const n of nodes) {
    const t = (n.type || n.label || 'unknown').toLowerCase();
    nodeTypeCounts[t] = (nodeTypeCounts[t] ?? 0) + 1;
  }
  const sortedTypes = Object.entries(nodeTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="flex h-7 items-center gap-3 border-t border-gray-200 bg-white px-3 text-[11px] text-gray-500 overflow-x-auto">
      <span className="font-medium text-gray-600 flex-shrink-0">{nodeCount} nodes</span>
      <span className="text-gray-200 flex-shrink-0">|</span>
      <span className="font-medium text-gray-600 flex-shrink-0">{edgeCount} edges</span>
      {selectedNodeName && (
        <>
          <span className="text-gray-200 flex-shrink-0">|</span>
          <span className="text-blue-600 font-medium truncate max-w-[200px] flex-shrink-0">{selectedNodeName}</span>
        </>
      )}
      {isLayoutRunning && (
        <>
          <span className="text-gray-200 flex-shrink-0">|</span>
          <span className="text-green-600 animate-pulse flex-shrink-0">Layout...</span>
        </>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-2 flex-shrink-0">
        {sortedTypes.map(([type, count]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: NODE_COLORS[type] || '#999' }} />
            <span className="text-gray-500 whitespace-nowrap">{type} {count}</span>
          </span>
        ))}
      </div>
      <span className="text-gray-300 flex-shrink-0">+/- Zoom · F Fit · Esc</span>
    </div>
  );
}