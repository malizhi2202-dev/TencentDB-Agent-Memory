/**
 * GraphCanvas — sigma.js 交互图谱。
 * Force/Tree/Circles/Community 视图模式，节点/边过滤，深度过滤，聚焦高亮。
 * 边箭头 + 右键菜单 + 键盘快捷键 + 快捷键提示栏。
 */
import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import EdgeCurveProgram from '@sigma/edge-curve';
import { Network, GitBranch, Target, Palette } from 'lucide-react';
import type { GraphNode, GraphEdge } from '../CodeGraphPage';
import { NODE_SIZES, NODE_COLORS, getLayer } from '../constants';

// 12 色社区调色板（HSL 色相均匀分布）
const COMMUNITY_COLORS = [
  'hsl(0, 60%, 55%)', 'hsl(30, 60%, 55%)', 'hsl(60, 60%, 55%)',
  'hsl(120, 60%, 55%)', 'hsl(180, 60%, 55%)', 'hsl(210, 60%, 55%)',
  'hsl(240, 60%, 55%)', 'hsl(270, 60%, 55%)', 'hsl(300, 60%, 55%)',
  'hsl(330, 60%, 55%)', 'hsl(15, 60%, 55%)', 'hsl(75, 60%, 55%)',
];

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
  onStageClick: () => void;
  selectedNodeId: string | null;
  visibleLabels: string[];
  visibleEdgeTypes: string[];
  depthFilter: number | null;
  searchQuery: string;
}

export interface GraphCanvasHandle { focusNode: (nodeId: string) => void; }

interface ContextMenuState {
  x: number; y: number; nodeId: string; nodeName: string; nodePath: string;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(
  ({ nodes, edges, onNodeClick, onStageClick, selectedNodeId, visibleLabels, visibleEdgeTypes, depthFilter, searchQuery }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sigmaRef = useRef<Sigma | null>(null);
    const graphRef = useRef<Graph | null>(null);
    const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());
    const [isLayoutRunning, setIsLayoutRunning] = useState(false);
    const layoutRef = useRef(false);
    const rafRef = useRef(0);
    const [hoveredName, setHoveredName] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'force' | 'tree' | 'circles' | 'community'>('force');
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const communityModeRef = useRef(false);

    const visibleLabelsRef = useRef(visibleLabels);
    const visibleEdgeTypesRef = useRef(visibleEdgeTypes);
    const depthFilterRef = useRef(depthFilter);
    const selectedNodeIdRef = useRef(selectedNodeId);
    const searchQueryRef = useRef(searchQuery);
    useEffect(() => { visibleLabelsRef.current = visibleLabels; }, [visibleLabels]);
    useEffect(() => { visibleEdgeTypesRef.current = visibleEdgeTypes; }, [visibleEdgeTypes]);
    useEffect(() => { depthFilterRef.current = depthFilter; }, [depthFilter]);
    useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
    useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);

    const dataVersionRef = useRef(0);
    const prevNodesLenRef = useRef(nodes.length);
    const prevEdgesLenRef = useRef(edges.length);
    if (nodes.length !== prevNodesLenRef.current || edges.length !== prevEdgesLenRef.current) {
      prevNodesLenRef.current = nodes.length; prevEdgesLenRef.current = edges.length; dataVersionRef.current++;
    }
    const dataVersion = dataVersionRef.current;

    const buildGraph = useCallback((mode: 'force' | 'tree' | 'circles' | 'community') => {
      if (nodes.length === 0) return null;
      const graph = new Graph();
      const nodeMap = new Map<string, GraphNode>();
      const isCommunity = mode === 'community';
      communityModeRef.current = isCommunity;
      for (const n of nodes) {
        nodeMap.set(n.id, n);
        const size = NODE_SIZES[n.type] ?? NODE_SIZES[n.label] ?? 3;
        const color = isCommunity
          ? COMMUNITY_COLORS[(n.community ?? 0) % COMMUNITY_COLORS.length]
          : (NODE_COLORS[n.type] ?? NODE_COLORS[n.label] ?? n.color ?? '#9096a3');
        graph.addNode(n.id, {
          label: (n.name || n.id).slice(0, 25),
          x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20,
          size: Math.max(size, 2), color, nodeType: n.type || n.label, filePath: n.filePath,
          linkCount: n.linkCount ?? 0, community: n.community ?? 0,
          hidden: false,
        });
      }
      let edgeCount = 0;
      const seen = new Set<string>();
      for (const e of edges) {
        const key = [e.source, e.target].sort().join('||') + '||' + e.type;
        if (seen.has(key)) continue; seen.add(key);
        if (graph.hasNode(e.source) && graph.hasNode(e.target) && e.source !== e.target) {
          try {
            graph.addEdge(e.source, e.target, {
              size: 3, color: e.color || '#64748b', relationType: e.type, hidden: false,
            });
            edgeCount++;
          } catch { /* */ }
        }
      }
      if (mode === 'tree') {
        graph.forEachNode((nid, attrs) => {
          const l = getLayer((attrs as any).nodeType || '');
          graph.setNodeAttribute(nid, 'y', (l - 1.5) * 300);
        });
        // Use simple x-spread for tree mode (forceAtlas2 can set NaN on isolated nodes)
        let ti = 0;
        const tcount = graph.order;
        graph.forEachNode((nid) => {
          const x = (ti / Math.max(1, tcount - 1)) * 800 - 400;
          graph.setNodeAttribute(nid, 'x', isFinite(x) ? x : (Math.random() - 0.5) * 20);
          ti++;
        });
      } else if (mode === 'circles') {
        const ringNodes = new Map<number, string[]>();
        graph.forEachNode((nid, attrs) => { const r = getLayer((attrs as any).nodeType || ''); if (!ringNodes.has(r)) ringNodes.set(r, []); ringNodes.get(r)!.push(nid); });
        const radii = [180, 360, 560, 780];
        for (const [ring, nids] of ringNodes) {
          const radius = radii[ring] || 900;
          nids.forEach((nid, i) => { const angle = (2 * Math.PI * i) / Math.max(1, nids.length); graph.setNodeAttribute(nid, 'x', radius * Math.cos(angle)); graph.setNodeAttribute(nid, 'y', radius * Math.sin(angle)); });
        }
      } else {
        // Use simple circular layout as safe default; user can run ForceAtlas2 via ▶ button
        const count = graph.order;
        const radius = Math.sqrt(Math.max(1, count)) * 2;
        let i = 0;
        graph.forEachNode((nid) => {
          const angle = (2 * Math.PI * i) / count;
          graph.setNodeAttribute(nid, 'x', radius * Math.cos(angle));
          graph.setNodeAttribute(nid, 'y', radius * Math.sin(angle));
          i++;
        });
      }
      // Safety: validate all nodes have valid x,y before Sigma (forceAtlas2 can set NaN)
      const nodeIds: string[] = [];
      graph.forEachNode((nid) => { nodeIds.push(nid); });
      for (const nid of nodeIds) {
        const x = graph.getNodeAttribute(nid, 'x');
        const y = graph.getNodeAttribute(nid, 'y');
        if (typeof x !== 'number' || !Number.isFinite(x)) graph.setNodeAttribute(nid, 'x', (Math.random() - 0.5) * 20);
        if (typeof y !== 'number' || !Number.isFinite(y)) graph.setNodeAttribute(nid, 'y', (Math.random() - 0.5) * 20);
      }
      return { graph, nodeMap };
    }, [nodes, edges]);

    useEffect(() => {
      if (!containerRef.current || nodes.length === 0) return;
      const built = buildGraph(viewMode);
      if (!built) return;
      const { graph, nodeMap } = built;
      graphRef.current = graph; nodeMapRef.current = nodeMap;

      const sigma = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: false, enableEdgeEvents: true, stagePadding: 40,
        labelRenderedSizeThreshold: 6, labelDensity: 0.2, labelFont: 'system-ui, sans-serif',
        defaultEdgeColor: '#64748b', defaultEdgeType: 'curved',
        edgeProgramClasses: { curved: EdgeCurveProgram },
        minCameraRatio: 0.02, maxCameraRatio: 10,
        // Edge arrow rendering — set in edgeReducer instead of constructor
        nodeReducer: (node, data) => {
          const attrs = { ...data } as any;
          const labels = visibleLabelsRef.current, selId = selectedNodeIdRef.current, depth = depthFilterRef.current, sq = searchQueryRef.current;
          if (labels && attrs.nodeType && !labels.includes(attrs.nodeType.toLowerCase())) { attrs.hidden = true; attrs.size = 0; return attrs; }
          if (sq) { const q = sq.toLowerCase(); const name = (attrs.label || '').toLowerCase(); const nid = (node || '').toLowerCase(); if (!name.includes(q) && !nid.includes(q)) { attrs.hidden = true; attrs.size = 0; return attrs; } }
          if (depth !== null && selId) { const g = graphRef.current; if (g && g.hasNode(selId) && !isWithinHops(g, selId, node, depth)) { attrs.hidden = true; attrs.size = 0; return attrs; } }
          if (node === selId) { attrs.highlighted = true; attrs.size = Math.max((data.size || 4) * 2.5, 10); attrs.color = '#2563eb'; attrs.zIndex = 999; return attrs; }
          if (selId) { const g = graphRef.current; if (g && g.hasNode(selId)) { const neighbors = new Set(g.neighbors(selId)); if (!neighbors.has(node)) { attrs.color = dimHex(attrs.color || '#9096a3', 0.25); attrs.size = Math.max(1, (attrs.size || 3) * 0.4); attrs.label = ''; } } }
          return attrs;
        },
        edgeReducer: (edge, data) => {
          const attrs = { ...data } as any;
          const edgeTypes = visibleEdgeTypesRef.current, selId = selectedNodeIdRef.current;
          if (edgeTypes && attrs.relationType && !edgeTypes.some(et => et.toLowerCase() === (attrs.relationType || '').toLowerCase())) { attrs.hidden = true; attrs.size = 0; return attrs; }
          if (selId && graphRef.current) { try { const ext = graphRef.current.extremities(edge); const g = graphRef.current; const neighbors = new Set(g.neighbors(selId)); const isConnected = ext[0] === selId || ext[1] === selId || neighbors.has(ext[0]) || neighbors.has(ext[1]); if (isConnected) { attrs.color = '#2563eb'; attrs.size = 3; attrs.zIndex = 998; } else { attrs.color = dimHex(attrs.color || '#64748b', 0.12); attrs.size = 0.2; } } catch { /* */ } }
          return attrs;
        },
      });
      sigma.on('clickNode', ({ node }) => { const nd = nodeMap.get(node); if (nd) onNodeClick(nd); });
      sigma.on('enterNode', ({ node }) => { containerRef.current!.style.cursor = 'pointer'; const nd = nodeMap.get(node); setHoveredName(nd?.name ?? nd?.id ?? null); });
      sigma.on('leaveNode', () => { containerRef.current!.style.cursor = 'default'; setHoveredName(null); });
      sigma.on('clickStage', () => { setContextMenu(null); onStageClick(); });
      // Right-click context menu
      sigma.on('rightClickNode', ({ event, node }) => {
        event.preventSigmaDefault();
        const nd = nodeMap.get(node);
        if (nd) {
          const mouseEvent = event.original as MouseEvent;
          setContextMenu({ x: mouseEvent.pageX, y: mouseEvent.pageY, nodeId: node, nodeName: nd.name || nd.id, nodePath: nd.filePath || '' });
        }
      });
      setTimeout(() => sigma.getCamera().animatedReset({ duration: 500 }), 200);
      sigmaRef.current = sigma;
      return () => { sigma.kill(); };
    }, [dataVersion, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close context menu on click outside
    useEffect(() => {
      if (!contextMenu) return;
      const handle = () => setContextMenu(null);
      document.addEventListener('click', handle);
      return () => document.removeEventListener('click', handle);
    }, [contextMenu]);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
        else if (e.key === '-') { e.preventDefault(); zoomOut(); }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); resetZoom(); }
        else if (e.key === 'Escape') { e.preventDefault(); setContextMenu(null); if (selectedNodeId) onStageClick(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ResizeObserver
    useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver(() => { sigmaRef.current?.refresh(); });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, []);

    useEffect(() => { sigmaRef.current?.refresh(); }, [visibleLabels, visibleEdgeTypes, depthFilter, selectedNodeId, searchQuery]);

    const startLayout = useCallback(() => {
      if (!graphRef.current || !sigmaRef.current) return;
      setIsLayoutRunning(true);
      layoutRef.current = true;
      const loop = () => {
        if (!layoutRef.current || !graphRef.current || !sigmaRef.current) return;
        try { forceAtlas2.assign(graphRef.current, { iterations: 3 }); } catch { /* ignore */ }
        // Safety: fix any NaN coordinates after forceAtlas2
        const g = graphRef.current;
        g.forEachNode((nid) => {
          const x = g.getNodeAttribute(nid, 'x');
          const y = g.getNodeAttribute(nid, 'y');
          if (typeof x !== 'number' || !Number.isFinite(x)) g.setNodeAttribute(nid, 'x', (Math.random() - 0.5) * 20);
          if (typeof y !== 'number' || !Number.isFinite(y)) g.setNodeAttribute(nid, 'y', (Math.random() - 0.5) * 20);
        });
        sigmaRef.current!.refresh();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }, []);
    const stopLayout = useCallback(() => { layoutRef.current = false; setIsLayoutRunning(false); cancelAnimationFrame(rafRef.current); }, []);
    const zoomIn = () => sigmaRef.current?.getCamera().animatedZoom({ duration: 200, factor: 1.3 });
    const zoomOut = () => sigmaRef.current?.getCamera().animatedZoom({ duration: 200, factor: 0.7 });
    const resetZoom = () => sigmaRef.current?.getCamera().animatedReset({ duration: 400 });
    const focusNode = useCallback((nodeId: string) => { const sigma = sigmaRef.current; if (!sigma?.getGraph().hasNode(nodeId)) return; const pos = sigma.getGraph().getNodeAttributes(nodeId) as any; sigma.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.5 }, { duration: 400 }); }, []);
    const handleViewMode = useCallback((mode: 'force' | 'tree' | 'circles' | 'community') => { setViewMode(mode); stopLayout(); }, [stopLayout]);
    useImperativeHandle(ref, () => ({ focusNode }), [focusNode]);

    const handleCopyPath = (path: string) => {
      navigator.clipboard?.writeText(path).catch(() => {});
      setContextMenu(null);
    };

    const handleContextAction = (action: string, nodeId: string) => {
      setContextMenu(null);
      // Actions are dispatched to parent via callbacks or future KS endpoints
      console.log(`Context action: ${action} on node ${nodeId}`);
    };

    return (
      <div className="relative h-full w-full" style={{ background: '#f8f9fa' }}>
        <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* View mode buttons */}
        <div className="absolute top-4 right-4 z-20 flex gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm">
          {[
            { mode: 'force' as const, icon: Network, label: 'Force' },
            { mode: 'tree' as const, icon: GitBranch, label: 'Tree' },
            { mode: 'circles' as const, icon: Target, label: 'Circles' },
            { mode: 'community' as const, icon: Palette, label: 'Community' },
          ].map(({ mode, icon: Icon, label }) => (
            <button key={mode} onClick={() => handleViewMode(mode)} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><Icon className="h-3.5 w-3.5" />{label}</button>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredName && !selectedNodeId && (
          <div className="pointer-events-none absolute top-3 right-4 z-20 mt-12 rounded-lg border border-gray-200 bg-white/95 px-3 py-1.5 shadow-sm">
            <span className="font-mono text-sm text-gray-700">{hoveredName}</span>
          </div>
        )}

        {/* Selected node badge */}
        {selectedNodeId && (
          <div className="absolute top-3 right-4 z-20 mt-12 flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="font-mono text-sm text-gray-800">
              {(() => { const nd = nodeMapRef.current.get(selectedNodeId); return nd ? `${nd.name} (${nd.label})` : selectedNodeId; })()}
            </span>
            {(() => { const nd = nodeMapRef.current.get(selectedNodeId); return nd?.linkCount != null ? ` · ${nd.linkCount} links` : ''; })()}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1">
          <button onClick={zoomIn} className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50" title="Zoom In (+)">+</button>
          <button onClick={zoomOut} className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50" title="Zoom Out (-)">−</button>
          <button onClick={resetZoom} className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50" title="Fit (F)">⊡</button>
          <div className="my-1 h-px bg-gray-200" />
          {selectedNodeId && (<button onClick={() => focusNode(selectedNodeId)} className="flex h-8 w-8 items-center justify-center rounded border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100" title="Focus">⊙</button>)}
          <div className="my-1 h-px bg-gray-200" />
          {viewMode === 'force' && (
            <button onClick={isLayoutRunning ? stopLayout : startLayout}
              className={`flex h-8 w-8 items-center justify-center rounded border ${isLayoutRunning ? 'border-blue-400 bg-blue-600 text-white animate-pulse' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
              title={isLayoutRunning ? 'Stop' : 'Run Layout'}>
              {isLayoutRunning ? '⏸' : '▶'}
            </button>
          )}
        </div>

        {/* Layout running indicator */}
        {isLayoutRunning && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-green-300 bg-green-50 px-3 py-1.5 shadow-sm">
            <div className="h-2 w-2 animate-ping rounded-full bg-green-400" />
            <span className="text-xs font-medium text-green-600">Layout running...</span>
          </div>
        )}

        {/* Right-click context menu */}
        {contextMenu && (
          <div className="absolute z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white shadow-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="px-3 py-1.5 font-mono text-xs text-gray-500 border-b border-gray-100 truncate" title={contextMenu.nodeName}>
              {contextMenu.nodeName}
            </div>
            <button onClick={() => handleContextAction('callers', contextMenu.nodeId)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              View Callers
              <span className="ml-auto text-gray-400">→</span>
            </button>
            <button onClick={() => handleContextAction('callees', contextMenu.nodeId)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              View Callees
              <span className="ml-auto text-gray-400">←</span>
            </button>
            <button onClick={() => handleContextAction('impact', contextMenu.nodeId)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Impact Analysis
              <span className="ml-auto text-gray-400">⚡</span>
            </button>
            <div className="my-1 h-px bg-gray-100" />
            <button onClick={() => handleCopyPath(contextMenu.nodePath)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Copy Path
              <span className="ml-auto text-gray-400">📋</span>
            </button>
            <button onClick={() => { focusNode(contextMenu.nodeId); setContextMenu(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Focus Node
              <span className="ml-auto text-gray-400">⊙</span>
            </button>
          </div>
        )}

        {/* Shortcut hint bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex h-6 items-center gap-3 border-t border-gray-200 bg-white/80 px-2 text-[11px] text-gray-400">
          <span><kbd className="font-mono bg-gray-100 rounded px-1">+</kbd><kbd className="font-mono bg-gray-100 rounded px-1">-</kbd> Zoom</span>
          <span className="text-gray-200">|</span>
          <span><kbd className="font-mono bg-gray-100 rounded px-1">F</kbd> Fit</span>
          <span className="text-gray-200">|</span>
          <span><kbd className="font-mono bg-gray-100 rounded px-1">Esc</kbd> Deselect</span>
          <span className="text-gray-200">|</span>
          <span>Right-click → Context Menu</span>
        </div>
      </div>
    );
  }
);
GraphCanvas.displayName = 'GraphCanvas';

function isWithinHops(graph: Graph, startId: string, targetId: string, maxHops: number): boolean {
  if (startId === targetId) return true;
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  let depth = 0;
  while (queue.length > 0 && depth < maxHops) {
    const size = queue.length;
    for (let i = 0; i < size; i++) { const node = queue.shift()!; for (const neighbor of graph.neighbors(node)) { if (neighbor === targetId) return true; if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); } } }
    depth++;
  }
  return false;
}
function dimHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r + (255 - r) * (1 - amount)), dg = Math.round(g + (255 - g) * (1 - amount)), db = Math.round(b + (255 - b) * (1 - amount));
  return '#' + [dr, dg, db].map(v => v.toString(16).padStart(2, '0')).join('');
}