/**
 * CodeReferencesPanel — 节点引用面板。
 * 显示选中节点的调用者、被调用者、成员等关系。
 */
import { useMemo } from 'react';
import type { GraphNode, GraphEdge } from '../CodeGraphPage';

interface Props {
  node: GraphNode | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onFocusNode: (nodeId: string) => void;
}

export function CodeReferencesPanel({ node, nodes, edges, onFocusNode }: Props) {
  const callers = useMemo(() => {
    if (!node) return [];
    const callerEdges = edges.filter(e => e.target === node.id && e.type === 'CALLS');
    return callerEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean) as GraphNode[];
  }, [node, nodes, edges]);

  const callees = useMemo(() => {
    if (!node) return [];
    const calleeEdges = edges.filter(e => e.source === node.id && e.type === 'CALLS');
    return calleeEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean) as GraphNode[];
  }, [node, nodes, edges]);

  const members = useMemo(() => {
    if (!node) return [];
    const memberEdges = edges.filter(e => e.source === node.id && (e.type === 'HAS_METHOD' || e.type === 'HAS_PROPERTY' || e.type === 'DEFINES'));
    return memberEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean) as GraphNode[];
  }, [node, nodes, edges]);

  if (!node) {
    return (
      <div className="p-3 text-xs text-gray-400">
        Click a node to see references
      </div>
    );
  }

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">References</h3>
      <div className="space-y-3">
        {[{ label: 'Callers', items: callers },
          { label: 'Callees', items: callees },
          { label: 'Members', items: members }].map(({ label, items }) => (
          <div key={label}>
            <div className="text-[10px] font-medium text-gray-400 uppercase mb-1">{label} ({items.length})</div>
            {items.length === 0 ? (
              <div className="text-xs text-gray-300">none</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 10).map(item => (
                  <button key={item.id} onClick={() => onFocusNode(item.id)}
                    className="text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-1.5 py-0.5 truncate">
                    {item.name || item.id}
                  </button>
                ))}
                {items.length > 10 && <div className="text-[10px] text-gray-400">+{items.length - 10} more</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}