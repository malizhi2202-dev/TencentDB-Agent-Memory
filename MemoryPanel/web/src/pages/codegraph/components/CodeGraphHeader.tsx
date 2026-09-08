/**
 * Header — 精简顶栏。
 * 仓库选择、统计信息、搜索、刷新、帮助。
 */
import { useState } from 'react';
import { Select, Button, Text, Modal } from 'tea-component';
import { HelpCircle } from 'lucide-react';
import type { CodeGraphDetail } from '@/lib/knowledge-api';

interface Props {
  sources: CodeGraphDetail[];
  selectedCgId: string;
  onSelectCg: (id: string) => void;
  /** 锁定仓库（仓库详情页嵌入）：隐藏仓库选择器，仅展示仓库名 */
  hideRepoSelector?: boolean;
  nodeCount: number;
  edgeCount: number;
  topLang: string;
  selectedNodeName?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function CodeGraphHeader({
  sources, selectedCgId, onSelectCg, hideRepoSelector, nodeCount, edgeCount, topLang,
  selectedNodeName, searchQuery, onSearchChange, onRefresh, loading,
}: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const selectedSource = sources.find((s) => s.code_graph_id === selectedCgId);

  return (
    <>
      <div className="_cg-topbar">
        {hideRepoSelector ? (
          <Text theme="strong" style={{ fontSize: 13, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedSource ? `${selectedSource.repo_name || selectedSource.repo_url} (${selectedSource.branch})` : selectedCgId}
          </Text>
        ) : (
          <Select
            appearance="button"
            matchButtonWidth
            size="m"
            value={selectedCgId}
            onChange={v => onSelectCg(v)}
            options={sources.map(s => ({ value: s.code_graph_id, text: `${s.repo_name || s.repo_url} (${s.branch})` }))}
          />
        )}
        <Text theme="label" style={{ fontSize: 12 }}>
          {nodeCount.toLocaleString()} nodes · {edgeCount.toLocaleString()} edges
          {topLang !== '—' && <span style={{ marginLeft: 8, color: 'var(--tea-color-text-placeholder, #bbb)' }}>| {topLang}</span>}
          {selectedNodeName && (
            <span style={{ marginLeft: 8, color: '#2563eb' }}>| {selectedNodeName}</span>
          )}
        </Text>
        <input
          type="text"
          placeholder="Search node..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="rounded border border-gray-200 px-3 py-1 text-xs outline-none focus:border-blue-400"
          style={{ width: 180 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button type="weak" onClick={() => setShowHelp(true)} title="Help">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button type="weak" onClick={onRefresh} loading={loading}>刷新</Button>
        </div>
      </div>

      {/* Help Modal */}
      <Modal visible={showHelp} caption="Help" onClose={() => setShowHelp(false)}>
        <Modal.Body>
          <div className="text-sm space-y-3 text-gray-600">
            <h3 className="font-semibold text-gray-800">Graph Interactions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Scroll to zoom, drag to pan</li>
              <li>Click a node to view its code in the floating panel</li>
              <li>Click empty space to deselect</li>
              <li>Toggle Force/Tree/Circles view modes (top-right)</li>
            </ul>
            <h3 className="font-semibold text-gray-800">Filters</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Left panel: toggle node/edge types</li>
              <li>Depth filter: select a node then choose N hops</li>
              <li>Search bar: filter nodes by name</li>
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="primary" onClick={() => setShowHelp(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}