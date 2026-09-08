import { useEffect, useState, useCallback, useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import Graph from "graphology";
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { SearchIcon, CloseIcon } from 'tea-icons-react';

// --- Types (re-exported from knowledge-api) ---
export interface GraphNode {
  id: string; label: string; type: string; path: string; linkCount: number; community: number;
}
export interface GraphEdge { source: string; target: string; weight: number; }
export interface GraphData {
  nodes: GraphNode[]; edges: GraphEdge[];
  communities?: { id: number; nodeCount: number; topNodes: string[] }[];
}

// Sigma 的 Canvas 绘制不能直接解析 CSS var()，因此在组件渲染时读取 Tea Token 的计算值。
// 这避免模块加载早于 Tea 主题 CSS 时取得空值，并会在主题属性变更后刷新画布调色板。
interface AtlasPalette {
  bg: string;
  toolbarBg: string;
  dim: string;
  dimFaded: string;
  edgeBase: string;
  edgeHover: string;
  label: string;
  nodeColors: Record<string, string>;
  communityColors: string[];
}

function readTeaColor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function createAtlasPalette(): AtlasPalette {
  const dim = readTeaColor('--tea-color-bg-tertiary-default');
  const accents = [
    readTeaColor('--tea-color-bg-brand-default'),     // 0 blue
    readTeaColor('--tea-color-bg-warning-default'),    // 1 orange
    readTeaColor('--tea-color-bg-amber-default'),      // 2 amber
    readTeaColor('--tea-color-bg-error-default'),      // 3 red
    readTeaColor('--tea-color-bg-success-default'),    // 4 green
    readTeaColor('--tea-color-bg-info-default'),       // 5 cyan
  ];
  // 兜底：如果 Tea token 为空，使用硬编码颜色
  const fallback = (v: string, hex: string) => v || hex;
  const nodeColors: Record<string, string> = {
    // Wiki types
    entity: fallback(accents[0], '#0052d9'),
    concept: fallback(accents[1], '#e37318'),
    source: fallback(accents[2], '#f5a623'),
    query: fallback(dim, '#b0b6c3'),
    synthesis: fallback(accents[3], '#d54941'),
    overview: fallback(accents[2], '#f5a623'),
    comparison: fallback(dim, '#b0b6c3'),
    finding: fallback(accents[1], '#e37318'),
    thesis: fallback(accents[3], '#d54941'),
    methodology: fallback(dim, '#b0b6c3'),
    other: fallback(dim, '#b0b6c3'),
    // Code-graph types — 每个类型都有独立颜色
    class:      fallback(accents[0], '#0052d9'),  // blue
    interface:  fallback(accents[5], '#00a870'),  // cyan
    function:   fallback(accents[1], '#e37318'),  // orange
    method:     fallback(accents[1], '#e37318'),  // orange (same as function)
    file:       fallback(accents[4], '#2ba471'),  // green
    variable:   fallback(accents[2], '#f5a623'),  // amber
    constant:   '#d54941',                         // red — 常量
    property:   '#7b4acb',                         // purple — 属性
    import:     '#0594a3',                         // teal — 导入
    type_alias: '#5b6dcd',                         // indigo — 类型别名
  };

  return {
    bg: readTeaColor('--tea-color-bg-primary-default'),
    toolbarBg: readTeaColor('--tea-color-bg-secondary-default'),
    dim,
    dimFaded: readTeaColor('--tea-color-bg-secondary-default'),
    edgeBase: readTeaColor('--tea-color-border-secondary-default'),
    edgeHover: readTeaColor('--tea-color-border-brand-default'),
    label: readTeaColor('--tea-color-text-primary'),
    nodeColors,
    communityColors: [
      accents[0], dim, accents[1], dim, accents[2], dim,
      accents[3], dim, accents[4], dim, accents[5], dim,
    ],
  };
}

type ColorMode = "type" | "community";

// --- Structural node filter ---
const STRUCTURAL_IDS = new Set(["index", "overview", "log", "schema", "purpose"]);
function isStructuralNode(node: GraphNode): boolean {
  const id = node.id.toLowerCase();
  if (STRUCTURAL_IDS.has(id)) return true;
  if (node.type === "overview") return true;
  const p = node.path.replace(/\\/g, "/").toLowerCase();
  return p.endsWith("/wiki/index.md") || p.endsWith("/wiki/overview.md") || p.endsWith("/wiki/log.md") || p.endsWith("/purpose.md") || p.endsWith("/schema.md");
}
function filterStructuralNodes(data: GraphData): GraphData {
  const hidden = new Set<string>();
  for (const n of data.nodes) if (isStructuralNode(n)) hidden.add(n.id);
  if (hidden.size === 0) return data;
  return { nodes: data.nodes.filter((n) => !hidden.has(n.id)), edges: data.edges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target)), communities: data.communities };
}

// --- Helpers ---
const BASE_NODE_SIZE = 7;
const MAX_NODE_SIZE = 26;
function nc(type: string, palette: AtlasPalette): string { return palette.nodeColors[type] || palette.nodeColors.other; }

/** Lighten a hex color by blending with white. ratio 0=original, 1=white. */
function lightenHex(hex: string, ratio: number): string {
  if (!hex || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * ratio);
  const lg = Math.round(g + (255 - g) * ratio);
  const lb = Math.round(b + (255 - b) * ratio);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

/** Convert hex to rgba with given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ns(linkCount: number, maxLinks: number, nodeCount: number): number {
  if (maxLinks === 0) return BASE_NODE_SIZE;
  const r = linkCount / maxLinks;
  const s = nodeCount > 150 ? Math.sqrt(150 / nodeCount) : 1;
  return (BASE_NODE_SIZE + Math.pow(r, 0.6) * (MAX_NODE_SIZE - BASE_NODE_SIZE)) * s;
}
function layoutIter(n: number): number { return n > 2500 ? 28 : n > 1200 ? 40 : n > 600 ? 65 : n > 250 ? 90 : 140; }

// --- Graph Loader ---
function GraphLoader({ nodes, edges, colorMode, onNodeClick, highlightNode, palette, selectedType }: {
  nodes: GraphNode[]; edges: GraphEdge[]; colorMode: ColorMode;
  onNodeClick?: (n: GraphNode) => void; highlightNode?: string | null; palette: AtlasPalette;
  selectedType?: string | null;
}) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const [hovered, setHovered] = useState<{ node: string; neighbors: Set<string> } | null>(null);

  useEffect(() => {
    const graph = new Graph();
    const maxLinks = Math.max(...nodes.map((n) => n.linkCount), 1);
    // Build node type lookup for edge coloring
    const nodeTypeMap = new Map<string, string>();
    for (const node of nodes) {
      const color = colorMode === "community"
        ? palette.communityColors[node.community % palette.communityColors.length]
        : nc(node.type, palette);
      graph.addNode(node.id, { x: Math.random() * 100, y: Math.random() * 100, size: ns(node.linkCount, maxLinks, nodes.length), color, label: node.label });
      nodeTypeMap.set(node.id, node.type);
    }
    const maxW = Math.max(...edges.map((e) => e.weight), 1);
    for (const edge of edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        const key = `${edge.source}->${edge.target}`;
        if (!graph.hasEdge(key) && !graph.hasEdge(`${edge.target}->${edge.source}`)) {
          const nw = edge.weight / maxW;
          const srcType = nodeTypeMap.get(edge.source) ?? "other";
          const srcColor = nc(srcType, palette);
          // Edge color: lightened version of the source node's type color,
          // so edges are visually distinct from nodes but still carry type info.
          const edgeColor = lightenHex(srcColor, 0.55);
          graph.addEdgeWithKey(key, edge.source, edge.target, { size: 0.5 + nw * 1.4, color: edgeColor });
        }
      }
    }
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, { iterations: layoutIter(nodes.length), settings: { ...settings, gravity: 1.2, scalingRatio: nodes.length > 400 ? 3.5 : 2.5, strongGravityMode: true, barnesHutOptimize: nodes.length > 50 } });
    loadGraph(graph);
    sigma.refresh();
  }, [nodes, edges, colorMode, loadGraph, palette, sigma]);

  useEffect(() => {
    registerEvents({
      enterNode: (e) => { const g = sigma.getGraph(); setHovered({ node: e.node, neighbors: new Set(g.neighbors(e.node)) }); const c = sigma.getContainer(); if (c) c.style.cursor = "pointer"; },
      leaveNode: () => { setHovered(null); const c = sigma.getContainer(); if (c) c.style.cursor = "default"; },
      clickNode: (e) => { const n = nodes.find((n) => n.id === e.node); if (n && onNodeClick) onNodeClick(n); },
    });
  }, [registerEvents, sigma, nodes, onNodeClick]);

  useEffect(() => {
    // Precompute visible set when a type is selected: show nodes of that type
    // AND their direct neighbors; hide everything else.
    let visibleSet: Set<string> | null = null;
    if (selectedType) {
      visibleSet = new Set<string>();
      const g = sigma.getGraph();
      for (const node of nodes) {
        if (node.type === selectedType) {
          visibleSet.add(node.id);
          for (const neighbor of g.neighbors(node.id)) {
            visibleSet.add(neighbor);
          }
        }
      }
    }

    sigma.setSetting("nodeReducer", (node, data) => {
      const res = { ...data };
      // Type filter (click legend)
      if (visibleSet && !visibleSet.has(node)) {
        res.hidden = true;
        return res;
      }
      if (highlightNode && node === highlightNode) { res.highlighted = true; res.zIndex = 2; }
      if (hovered) {
        if (node === hovered.node) {
          res.highlighted = true; res.zIndex = 2;
          res.size = (data.size || BASE_NODE_SIZE) * 1.4;
        } else if (hovered.neighbors.has(node)) {
          res.zIndex = 1;
        } else {
          res.color = hexToRgba(data.color as string || palette.dim, 0.08);
          res.label = "";
          res.zIndex = 0;
          res.size = Math.max((data.size || BASE_NODE_SIZE) * 0.3, 1.5);
        }
      }
      return res;
    });
    sigma.setSetting("edgeReducer", (edge, data) => {
      const res = { ...data };
      // Type filter: only show edges that connect to at least one node of the selected type
      if (visibleSet) {
        const g = sigma.getGraph();
        const src = g.source(edge);
        const tgt = g.target(edge);
        const srcIsType = nodes.find(n => n.id === src)?.type === selectedType;
        const tgtIsType = nodes.find(n => n.id === tgt)?.type === selectedType;
        if (!srcIsType && !tgtIsType) {
          res.hidden = true;
          return res;
        }
      }
      if (hovered) {
        const g = sigma.getGraph();
        if (g.source(edge) !== hovered.node && g.target(edge) !== hovered.node) {
          res.hidden = true;
        } else {
          res.color = palette.edgeHover;
          res.size = Math.max((data.size || 1) * 2.2, 2.5);
        }
      }
      return res;
    });
    sigma.refresh();
  }, [hovered, highlightNode, selectedType, palette, sigma, nodes]);

  return null;
}

// --- Controls ---
function GraphControls() {
  const sigma = useSigma();
  const cls = "h-7 w-7 bg-card/90 hover:bg-card border border-border text-muted-foreground shadow-md rounded-md flex items-center justify-center transition-colors text-[12px] backdrop-blur";
  return (
    <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
      <button type="button" aria-label="Zoom in" className={cls} onClick={() => sigma.getCamera().animatedZoom({ duration: 200 })}>+</button>
      <button type="button" aria-label="Zoom out" className={cls} onClick={() => sigma.getCamera().animatedUnzoom({ duration: 200 })}>−</button>
      <button type="button" aria-label="Reset view" className={cls} onClick={() => sigma.getCamera().animatedReset({ duration: 300 })}>⊙</button>
    </div>
  );
}

// --- Main Component ---
interface Props {
  data: GraphData | null; loading?: boolean;
  onNodeClick?: (node: GraphNode) => void; highlightNode?: string | null; className?: string;
  /** Extra controls to render in the toolbar, left of the color-mode toggle. */
  toolbarExtra?: React.ReactNode;
}

export default function KnowledgeGraph({ data, loading, onNodeClick, highlightNode, className, toolbarExtra }: Props) {
  const { t } = useTranslation();
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [hideStructural, setHideStructural] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [themeRevision, setThemeRevision] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeRevision((revision) => revision + 1));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'theme-mode'] });
    return () => observer.disconnect();
  }, []);

  const palette = useMemo(() => createAtlasPalette(), [themeRevision]);
  const filteredData = useMemo(() => data ? (hideStructural ? filterStructuralNodes(data) : data) : null, [data, hideStructural]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q.trim() || !filteredData) { setSearchResults([]); return; }
    const lower = q.toLowerCase();
    setSearchResults(filteredData.nodes.filter((n) => n.label.toLowerCase().includes(lower) || n.id.toLowerCase().includes(lower)).slice(0, 8));
  }, [filteredData]);

  if (loading) return <div className={`flex items-center justify-center ${className}`} style={{ background: palette.bg }}><span className="text-xs text-muted-foreground">{t('graph.loading')}</span></div>;
  if (!filteredData || filteredData.nodes.length === 0) return <div className={`flex items-center justify-center ${className}`} style={{ background: palette.bg }}><span className="text-[12px] text-muted-foreground/70">{t('graph.empty')}</span></div>;

  const typeSet = new Set(filteredData.nodes.map((n) => n.type));
  const types = [...typeSet].sort();

  // 极细网格背景 + 白底，营造"高科技画布"感（CSS grid pattern）
  const gridBg: CSSProperties = {
    background: palette.bg,
    backgroundImage:
      'linear-gradient(var(--tea-color-border-secondary-default) 1px, transparent 1px), linear-gradient(90deg, var(--tea-color-border-secondary-default) 1px, transparent 1px)',
    backgroundSize: '32px 32px'
  };

  return (
    <div className={`relative flex flex-col overflow-hidden ${className}`} style={{ background: palette.bg }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 z-10" style={{ background: palette.toolbarBg, backdropFilter: 'blur(8px)' }}>
        <div className="relative flex-1 max-w-[180px]">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-xs inline-flex items-center"><SearchIcon size={12} /></span>
          <input
            className="h-7 w-full pl-7 pr-6 text-xs border rounded-md bg-card/80 border-border text-foreground/70 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={t('graph.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button type="button" aria-label={t('graph.clearSearch')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground text-xs inline-flex items-center" onClick={() => { setSearchQuery(""); setSearchResults([]); }}><CloseIcon size={12} /></button>
          )}
        </div>
        {toolbarExtra && <div className="flex items-center">{toolbarExtra}</div>}
        <div className="flex gap-0.5">
          <button className={`rounded-md px-2 py-1 text-xs font-medium transition ${colorMode === "type" ? "bg-primary/5 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground/70 hover:bg-muted"}`} onClick={() => setColorMode("type")}>{t('graph.colorMode.type')}</button>
          <button className={`rounded-md px-2 py-1 text-xs font-medium transition ${colorMode === "community" ? "bg-primary/5 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground/70 hover:bg-muted"}`} onClick={() => setColorMode("community")}>{t('graph.colorMode.community')}</button>
        </div>
        <button className={`rounded-md px-2 py-1 text-xs font-medium transition ${hideStructural ? "bg-success/10 text-success ring-1 ring-success/30" : "text-muted-foreground hover:text-foreground/70 hover:bg-muted"}`}
          onClick={() => setHideStructural(!hideStructural)} title={t('graph.hideStructural.title')}>{t('graph.hideStructural')}</button>
        <span className="text-xs ml-auto font-mono text-muted-foreground">{t('graph.stats', { nodes: filteredData.nodes.length, edges: filteredData.edges.length })}</span>
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && searchQuery && (
        <div className="absolute top-12 left-3 z-20 w-[190px] rounded-lg border shadow-xl p-1 max-h-[200px] overflow-auto bg-card/95 border-border backdrop-blur">
          {searchResults.map((n) => (
            <div key={n.id} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-muted"
              onClick={() => { onNodeClick?.(n); setSearchQuery(""); setSearchResults([]); }}>
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: nc(n.type, palette) }} />
              <span className="truncate text-foreground/70">{n.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sigma Canvas */}
      <div className="flex-1 min-h-0 relative" style={gridBg}>
        <SigmaContainer
          style={{ width: "100%", height: "100%", background: "transparent" }}
          settings={{
            allowInvalidContainer: true, renderLabels: true,
            labelFont: "system-ui, -apple-system, sans-serif", labelSize: 12, labelWeight: "500",
            labelDensity: (data?.nodes?.length || 0) > 600 ? 0.12 : 0.35, labelGridCellSize: 90,
            labelRenderedSizeThreshold: (data?.nodes?.length || 0) > 600 ? 12 : 7,
            defaultEdgeType: "line", defaultNodeColor: palette.dim,
            defaultEdgeColor: palette.edgeBase,
            labelColor: { color: palette.label }, stagePadding: 40, zIndex: true,
            minCameraRatio: 0.06, maxCameraRatio: 4,
          }}
        >
          <GraphLoader nodes={filteredData.nodes} edges={filteredData.edges} colorMode={colorMode} onNodeClick={onNodeClick} highlightNode={highlightNode} palette={palette} selectedType={selectedType} />
          <GraphControls />
        </SigmaContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-1.5 z-10" style={{ background: palette.toolbarBg, backdropFilter: 'blur(8px)' }}>
        {selectedType && (
          <button
            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition"
            onClick={() => setSelectedType(null)}
            title={t('graph.clearFilter')}
          >
            ✕ {t('graph.clearFilter')}
          </button>
        )}
        {types.map((type) => {
          const c = nc(type, palette); // 图例始终显示类型颜色
          const isActive = selectedType === type;
          return (
            <button
              key={type}
              className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition cursor-pointer border ${isActive ? 'bg-primary/10 border-primary/40 text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setSelectedType(isActive ? null : type)}
              title={isActive ? t('graph.showAll') : `${type} — ${t('graph.filterByType')}`}
            >
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c, boxShadow: isActive ? 'var(--tea-shadow-xs)' : 'none' }} />
              <span>{type}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}