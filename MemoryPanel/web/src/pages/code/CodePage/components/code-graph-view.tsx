/**
 * CodeGraphView —— Code 图谱可视化视图。
 * 复用 wiki 页面的 KnowledgeGraph 组件（graphology + sigma.js）。
 *
 * 代码图谱节点数量较大（~2000），默认只显示结构类型以保持可读性，
 * 支持切换显示全部细节节点。
 *
 * 交互：
 * - 分段切换：架构 / 结构 / 全部
 * - 点击节点：展开详情面板 + 聚焦模式（仅显示该节点及其邻居）
 * - 点击空白 / 关闭：退出聚焦，恢复全图
 */
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, StatusTip, Segment, Text, Tag } from 'tea-component';
import { RefreshIcon, CloseIcon } from 'tea-icons-react';
import type { GraphData, GraphNode } from '@/lib/knowledge-api';
import KnowledgeGraph from '@/pages/wiki/WikiPage/components/KnowledgeGraph';
import { NODE_COLORS } from '@/pages/codegraph/constants';

/** 结构类型：代码实体的核心骨架 + 数据成员 */
const STRUCTURAL_TYPES = new Set([
  'class',
  'interface',
  'function',
  'method',
  'file',
  'constant',
  'type_alias',
  'import',
]);

/** 架构类型：仅显示顶层抽象 */
const ARCHITECTURE_TYPES = new Set([
  'class',
  'interface',
  'file',
  'type_alias',
  'import',
]);

type ViewLevel = 'architecture' | 'structural' | 'all';

// Node type colors — imported from codegraph/constants.ts (single source of truth)
const NODE_TYPE_COLORS = NODE_COLORS;

interface Props {
  data: GraphData | null;
  loading: boolean;
  onRefresh?: () => void;
}

export default function CodeGraphView({ data, loading, onRefresh }: Props) {
  const { t } = useTranslation();
  const [viewLevel, setViewLevel] = useState<ViewLevel>('structural');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusNode, setFocusNode] = useState<string | null>(null);

  const filteredData = useMemo<GraphData | null>(() => {
    if (!data) return null;

    let baseData: GraphData;
    if (viewLevel === 'all') {
      baseData = data;
    } else {
      const keepTypes = viewLevel === 'architecture' ? ARCHITECTURE_TYPES : STRUCTURAL_TYPES;
      const keepIds = new Set(
        data.nodes
          .filter((n) => keepTypes.has(n.type))
          .map((n) => n.id),
      );
      baseData = {
        ...data,
        nodes: data.nodes.filter((n) => keepIds.has(n.id)),
        edges: data.edges.filter(
          (e) => keepIds.has(e.source) && keepIds.has(e.target),
        ),
      };
    }

    // Focus mode: only show the selected node and its neighbors
    if (focusNode) {
      const neighborIds = new Set<string>();
      neighborIds.add(focusNode);
      for (const e of baseData.edges) {
        if (e.source === focusNode) neighborIds.add(e.target);
        if (e.target === focusNode) neighborIds.add(e.source);
      }
      return {
        ...baseData,
        nodes: baseData.nodes.filter((n) => neighborIds.has(n.id)),
        edges: baseData.edges.filter(
          (e) => neighborIds.has(e.source) && neighborIds.has(e.target),
        ),
      };
    }

    return baseData;
  }, [data, viewLevel, focusNode]);

  // Compute related nodes for the selected node (from full data, not filtered)
  const relatedNodes = useMemo(() => {
    if (!selectedNode || !data) return [];
    const neighborIds = new Set<string>();
    for (const e of data.edges) {
      if (e.source === selectedNode.id) neighborIds.add(e.target);
      if (e.target === selectedNode.id) neighborIds.add(e.source);
    }
    return data.nodes.filter((n) => neighborIds.has(n.id) && n.id !== selectedNode.id);
  }, [selectedNode, data]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setFocusNode(node.id);
  }, []);

  const handleClearFocus = useCallback(() => {
    setSelectedNode(null);
    setFocusNode(null);
  }, []);

  // Node type categories + counts (bottom legend)
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of data?.nodes ?? []) {
      const t = n.type || 'unknown';
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (loading) {
    return (
      <div className="_codedetail-graph-loading">
        <StatusTip status="loading" loadingText={t('graph.loading')} />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="_codedetail-graph-empty">
        <StatusTip
          status="empty"
          emptyText={t('graph.empty')}
        />
        {onRefresh && (
          <Button type="primary" onClick={onRefresh} style={{ marginTop: 12 }}>
            <span className="_codedetail-inline-icon">
              <RefreshIcon size={14} />
              {t('code.action.refresh')}
            </span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="_codedetail-graph-wrapper">
      <div className="_codedetail-graph-toolbar">
        <Segment
          value={viewLevel}
          onChange={(v) => setViewLevel(v as ViewLevel)}
          options={[
            { value: 'architecture', text: t('graph.filter.architecture') },
            { value: 'structural', text: t('graph.filter.structural') },
            { value: 'all', text: t('graph.filter.all') },
          ]}
        />
        {focusNode && (
          <Button type="weak" onClick={handleClearFocus} style={{ marginLeft: 8 }}>
            <CloseIcon size={12} /> {t('code.detail.graph.nodeClose')}
          </Button>
        )}
      </div>
      <div className="_codedetail-graph-layout">
        <KnowledgeGraph
          key={viewLevel + (focusNode ?? '')}
          data={filteredData!}
          onNodeClick={handleNodeClick}
          highlightNode={focusNode}
          className="_codedetail-graph-container"
        />
        {/* Node Detail Panel */}
        {selectedNode && (
          <div className="_codedetail-node-panel">
            <div className="_codedetail-node-panel-header">
              <span className="_codedetail-tag-dot" style={{ background: NODE_TYPE_COLORS[selectedNode.type] ?? '#9096a3' }} />
              <Text className="_codedetail-node-panel-title">{selectedNode.label}</Text>
              <button className="_codedetail-node-panel-close" onClick={handleClearFocus}>
                <CloseIcon size={14} />
              </button>
            </div>
            <div className="_codedetail-node-panel-body">
              <div className="_codedetail-node-panel-field">
                <Text theme="label">{t('code.detail.graph.nodeType')}</Text>
                <Tag>{selectedNode.type}</Tag>
              </div>
              <div className="_codedetail-node-panel-field">
                <Text theme="label">{t('code.detail.graph.nodePath')}</Text>
                <Text className="_codedetail-mono" style={{ fontSize: 11 }}>{selectedNode.path || '—'}</Text>
              </div>
              <div className="_codedetail-node-panel-field">
                <Text theme="label">{t('code.detail.graph.nodeLinks')}</Text>
                <Text>{selectedNode.linkCount}</Text>
              </div>
              {relatedNodes.length > 0 && (
                <div className="_codedetail-node-panel-field">
                  <Text theme="label">{t('code.detail.graph.nodeRelated')} ({relatedNodes.length})</Text>
                  <div className="_codedetail-node-related-list">
                    {relatedNodes.slice(0, 20).map((n) => (
                      <div
                        key={n.id}
                        className="_codedetail-node-related-item"
                        onClick={() => handleNodeClick(n)}
                      >
                        <span className="_codedetail-tag-dot" style={{ background: NODE_TYPE_COLORS[n.type] ?? '#9096a3' }} />
                        <span className="_codedetail-node-related-label">{n.label}</span>
                        <Tag size="sm">{n.type}</Tag>
                      </div>
                    ))}
                    {relatedNodes.length > 20 && (
                      <Text theme="weak" style={{ fontSize: 11 }}>
                        ... 还有 {relatedNodes.length - 20} 个关联节点
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Node type legend */}
      <div className="_codedetail-graph-legend">
        <span className="_codedetail-graph-legend-label">{t('graph.nodeTypes')}</span>
        {nodeTypeCounts.map(([type, count]) => (
          <span key={type} className="_codedetail-graph-legend-item">
            <span className="_codedetail-tag-dot" style={{ background: NODE_TYPE_COLORS[type] ?? '#999' }} />
            <span className="_codedetail-graph-legend-text">{type} {count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}