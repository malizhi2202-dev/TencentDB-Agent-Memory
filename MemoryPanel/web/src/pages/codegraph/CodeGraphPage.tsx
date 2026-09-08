/**
 * CodeGraphPage V3 — 三栏可拉伸布局（对标 GitNexus）。
 *
 * ┌──────────────────────────────────────────────┐
 * │ Header (repo, search, stats)                 │
 * ├──────────┬─────────────────────┬─────────────┤
 * │ FileTree │    GraphCanvas      │  RightPanel │
 * │ ↕可拉伸  │    ↕可拉伸          │  ↕可拉伸    │
 * │          │  ┌─code panel────┐  │  Chat|Proc  │
 * │          │  │ file content  │  │             │
 * │          │  └──────────────┘  │             │
 * ├──────────┴─────────────────────┴─────────────┤
 * │ StatusBar                                    │
 * └──────────────────────────────────────────────┘
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusTip } from 'tea-component';
import { knowledgeApi, type CodeGraphDetail } from '@/lib/knowledge-api';
import { getPanelSession } from '@/lib/panelSession';
import { useTeams } from '@/services';
import { GraphCanvas, type GraphCanvasHandle } from './components/GraphCanvas';
import { FileTreePanel } from './components/FileTreePanel';
import { CodeGraphHeader } from './components/CodeGraphHeader';
import { RightPanel } from './components/RightPanel';
import { StatusBar } from './components/StatusBar';
import { ALL_LABELS, ALL_EDGE_TYPES, EDGE_COLORS } from './constants';
import './codegraph.css';

export interface GraphNode {
  id: string; label: string; name: string; filePath: string; color: string;
  type: string; path: string; linkCount: number; community: number;
  lineStart?: number; lineEnd?: number;
}
export interface GraphEdge {
  source: string; target: string; type: string; color: string; weight: number;
}

/** 节点类型图例项（NodeTypeLegend 用）：类型名 + 颜色 + 计数 */
export interface NodeTypeInfo { type: string; color: string; count: number; }
/** 边类型图例项（NodeTypeLegend 用）：类型名 + 颜色 + 计数 */
export interface EdgeTypeInfo { type: string; color: string; count: number; }

export interface CodeGraphPageProps {
  /** 固定仓库（仓库详情页传入）：锁定仓库，隐藏顶部仓库选择器 */
  fixedCgId?: string;
  /** 嵌入式（仓库详情页 tab 内）：调整高度适配上方面包屑 + tab */
  embedded?: boolean;
}

export function CodeGraphPage({ fixedCgId, embedded }: CodeGraphPageProps) {
  const { t } = useTranslation();
  const { activeTeamId } = useTeams();
  const [sources, setSources] = useState<CodeGraphDetail[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedCgId, setSelectedCgId] = useState(fixedCgId ?? '');
  const [error, setError] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedContent, setSelectedContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLabels, setVisibleLabels] = useState<string[]>(ALL_LABELS);
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<string[]>(ALL_EDGE_TYPES);
  const [depthFilter, setDepthFilter] = useState<number | null>(null);
  const [topLang, setTopLang] = useState('—');
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);

  // Resizable panel widths
  const [leftW, setLeftW] = useState(260);
  const [rightW, setRightW] = useState(320);

  useEffect(() => {
    if (!activeTeamId) { setSources([]); setLoadingSources(false); return; }
    setLoadingSources(true);
    knowledgeApi.code.teamAssets(activeTeamId)
      .then(items => setSources(items.filter(s => s.status === 'ready')))
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  }, [activeTeamId]);
  useEffect(() => {
    if (fixedCgId) { setSelectedCgId(fixedCgId); return; }
    if (!selectedCgId && sources.length > 0) setSelectedCgId(sources[0].code_graph_id);
  }, [fixedCgId, sources, selectedCgId]);

  const selectedSource = useMemo(() => sources.find(s => s.code_graph_id === selectedCgId), [sources, selectedCgId]);
  const repoPath = useMemo(() => (selectedSource?.repo_url ?? '').replace(/^file:\/\//, ''), [selectedSource]);

  const fetchGraph = useCallback(async () => {
    if (!repoPath || !selectedCgId) return;
    setLoadingGraph(true); setError(''); setSelectedNode(null); setSelectedContent('');
    try {
      const data = await knowledgeApi.code.graph(selectedCgId);
      setNodes((data.nodes ?? []).map((n: any) => ({
        id: n.id || n.key || '', label: n.label || n.type || '', name: n.name || n.label || n.id || '',
        filePath: n.filePath || n.path || n.file || '', color: n.color || '#9096a3',
        type: n.type || n.label || '', path: n.path || n.filePath || '',
        linkCount: n.linkCount ?? 0, community: n.community ?? 0,
        lineStart: n.lineStart, lineEnd: n.lineEnd,
      })));
      setEdges((data.edges ?? []).map((e: any) => ({
        source: e.source || e.from || '', target: e.target || e.to || '',
        type: e.type || e.relation || '', color: EDGE_COLORS[e.type] || e.color || '#64748b', weight: e.weight ?? 1,
      })));
      const langCounts: Record<string, number> = {};
      for (const n of (data.nodes ?? [])) {
        const raw = n as any;
        if (raw.label !== 'File' && raw.type !== 'File') continue;
        const ext = ((raw.filePath || raw.file || '').split('.').pop() || '').toLowerCase();
        const lang = ({ ts: 'TS', tsx: 'TSX', js: 'JS', py: 'Python', go: 'Go', rs: 'Rust', java: 'Java' } as any)[ext] || ext.toUpperCase() || '?';
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      }
      const top = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0];
      setTopLang(top ? `${top[0]} ${((top[1] / (data.nodes ?? []).length) * 100).toFixed(0)}%` : '—');
    } catch (err: any) { setError(err.message || '加载失败'); } finally { setLoadingGraph(false); }
  }, [repoPath, selectedCgId]);
  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  const readFile = useCallback(async (filePath: string): Promise<string> => {
    try {
      const session = getPanelSession();
      const headers: Record<string, string> = {};
      if (session) { headers['X-Tdai-Service-Id'] = session.instanceId; headers['X-Tdai-User-Key'] = session.userKey; }
      const res = await fetch(`/api/v1/knowledge/code-graph/engine/file?repo=${encodeURIComponent(repoPath)}&path=${encodeURIComponent(filePath)}`, { headers });
      if (!res.ok) return '';
      const data = await res.json();
      return data.data?.content ?? data.content ?? '';
    } catch { return ''; }
  }, [repoPath]);

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    setSelectedNode(node);
    if (node.filePath) {
      const content = await readFile(node.filePath);
      setSelectedContent(content);
    } else {
      setSelectedContent('');
    }
  }, [readFile]);

  const handleStageClick = useCallback(() => { setSelectedNode(null); setSelectedContent(''); }, []);
  const handleFocusNode = useCallback((nodeId: string) => { const nd = nodes.find(n => n.id === nodeId); if (nd) handleNodeClick(nd); }, [nodes, handleNodeClick]);
  const toggleLabel = useCallback((label: string) => { setVisibleLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]); }, []);
  const toggleEdgeType = useCallback((type: string) => { setVisibleEdgeTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]); }, []);

  // File click from tree → open code + trigger AI analysis
  const handleFileClick = useCallback(async (filePath: string) => {
    const content = await readFile(filePath);
    setSelectedNode({ id: filePath, label: 'file', name: filePath.split('/').pop() || filePath, filePath, color: '#3b82f6', type: 'file', path: filePath, linkCount: 0, community: 0 });
    setSelectedContent(content);
  }, [readFile]);

  // Drag resizing
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const startDragLeft = useCallback((e: React.MouseEvent) => {
    dragStartX.current = e.clientX;
    dragStartW.current = leftW;
    const onMove = (ev: MouseEvent) => { setLeftW(Math.max(180, dragStartW.current + (ev.clientX - dragStartX.current))); };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftW]);

  const startDragRight = useCallback((e: React.MouseEvent) => {
    dragStartX.current = e.clientX;
    dragStartW.current = rightW;
    const onMove = (ev: MouseEvent) => { setRightW(Math.max(200, dragStartW.current - (ev.clientX - dragStartX.current))); };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightW]);

  if (loadingSources) return <StatusTip status="loading" loadingText={t('common.loading')} />;
  if (sources.length === 0) return <StatusTip status="empty" emptyText="no repos" />;

  return (
    <div className={`_cg-page ${embedded ? '_cg-page--embedded' : ''}`}>
      <CodeGraphHeader sources={sources} selectedCgId={selectedCgId} onSelectCg={setSelectedCgId}
        hideRepoSelector={!!fixedCgId}
        nodeCount={nodes.length} edgeCount={edges.length} topLang={topLang}
        selectedNodeName={selectedNode ? `${selectedNode.name} (${selectedNode.label})` : undefined}
        searchQuery={searchQuery} onSearchChange={setSearchQuery} onRefresh={fetchGraph} loading={loadingGraph} />
      {error && <div className="px-5 py-2 bg-red-50 text-red-500 text-xs">{error}</div>}
      {loadingGraph && nodes.length === 0 && <StatusTip status="loading" loadingText="loading..." />}

      <div className="_cg-body" style={{ position: 'relative' }}>
        {/* Left: FileTree */}
        <div style={{ width: leftW, flexShrink: 0, overflow: 'hidden' }}>
          <FileTreePanel nodes={nodes} onFocusNode={handleFocusNode} selectedNodeId={selectedNode?.id ?? null}
            visibleLabels={visibleLabels} visibleEdgeTypes={visibleEdgeTypes}
            onToggleLabel={toggleLabel} onToggleEdgeType={toggleEdgeType}
            depthFilter={depthFilter} onDepthFilter={setDepthFilter}
            repoPath={repoPath} onFileClick={handleFileClick} />
        </div>

        {/* Drag handle */}
        <div className="_cg-drag" onMouseDown={startDragLeft} />

        {/* Center: Graph */}
        <div className="_cg-center">
          <GraphCanvas ref={graphCanvasRef} nodes={nodes} edges={edges}
            onNodeClick={handleNodeClick} onStageClick={handleStageClick}
            selectedNodeId={selectedNode?.id ?? null} visibleLabels={visibleLabels}
            visibleEdgeTypes={visibleEdgeTypes} depthFilter={depthFilter} searchQuery={searchQuery} />
        </div>

        {/* Drag handle */}
        <div className="_cg-drag" onMouseDown={startDragRight} />

        {/* Right: Chat + Processes */}
        <div style={{ width: rightW, flexShrink: 0, overflow: 'hidden' }}>
          <RightPanel repoPath={repoPath} codeGraphId={selectedCgId} selectedNode={selectedNode} nodes={nodes} edges={edges} onFocusNode={handleFocusNode} />
        </div>

        {/* Floating code panel — rendered outside _cg-center to be above sigma canvas */}
        {selectedNode && selectedContent && (
          <div className="_cg-code-float" style={{ position: 'absolute', bottom: 16, left: leftW + 4, right: rightW + 4, zIndex: 50 }}>
            <div className="_cg-code-float-header">
              <span className="_cg-code-float-badge" style={{ background: selectedNode.color }}>{selectedNode.label}</span>
              <span className="_cg-code-float-name">{selectedNode.name || selectedNode.id}</span>
              <button onClick={(e) => { e.stopPropagation(); setSelectedNode(null); setSelectedContent(''); }}
                className="_cg-code-float-close">✕</button>
            </div>
            <pre className="_cg-code-float-body" style={{ maxHeight: '40vh' }}>
              {selectedContent.split('\n').map((line, i) => (
                <span key={i} className="_cg-code-line"><span className="_cg-code-line-content">{line}</span></span>
              ))}
            </pre>
          </div>
        )}
      </div>

      <StatusBar nodeCount={nodes.length} edgeCount={edges.length} nodes={nodes} selectedNodeName={selectedNode?.name} />
    </div>
  );
}