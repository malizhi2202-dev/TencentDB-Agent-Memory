/**
 * ToolSourcePanel — 能力资产类工具面板（MCP Server / REST API）。
 * 团队级，kind 切换 mcp/rest。真实 CRUD，走 meta/tool-source/*。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, StatusTip, Segment, Tag } from 'tea-component';
import { AddIcon, DeleteIcon } from 'tea-icons-react';
import { toolSourcesApi } from '@/lib/api/toolSources';
import type { ToolSource } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

const KIND_OPTIONS = [
  { value: 'mcp', text: 'MCP Server' },
  { value: 'rest', text: 'REST API' },
];

const SOURCE_OPTIONS = [
  { value: 'memory', text: '🧠 记忆总结' },
  { value: 'external', text: '🌐 外部传入' },
  { value: 'hybrid', text: '🧬 融合' },
];

const SOURCE_TAG: Record<ToolSource['source'], { text: string; theme: 'success' | 'warning' | 'primary' }> = {
  memory: { text: '🧠 记忆', theme: 'success' },
  external: { text: '🌐 外部', theme: 'warning' },
  hybrid: { text: '🧬 融合', theme: 'primary' },
};

export interface ToolSourcePanelProps {
  teamId: string;
}

export function ToolSourcePanel({ teamId }: ToolSourcePanelProps) {
  const [kind, setKind] = useState<'mcp' | 'rest'>('mcp');
  const [items, setItems] = useState<ToolSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [transport, setTransport] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<ToolSource['source']>('external');

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      setItems(await toolSourcesApi.list(teamId, kind));
    } catch (e) {
      setItems([]);
      tea.notify.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [teamId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await toolSourcesApi.create({
        kind,
        teamId,
        name: name.trim(),
        description: description.trim() || undefined,
        endpointUrl: endpoint.trim() || undefined,
        transport: transport.trim() || undefined,
        source,
      });
      setName('');
      setEndpoint('');
      setTransport('');
      setDescription('');
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (toolId: string) => {
    const ok = await tea.confirm({ message: '确定删除该工具？' });
    if (!ok) return;
    try {
      await toolSourcesApi.delete([toolId]);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <Card.Body title="工具集 Tool Sources（MCP Server / REST API）">
        <div style={{ marginBottom: 12 }}>
          <Segment value={kind} onChange={(v) => setKind(v as 'mcp' | 'rest')} options={KIND_OPTIONS} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Input value={name} onChange={setName} placeholder="名称" style={{ width: 180 }} />
          <Input value={endpoint} onChange={setEndpoint} placeholder={kind === 'mcp' ? '端点/命令' : 'Base URL'} style={{ width: 220 }} />
          <Input value={transport} onChange={setTransport} placeholder="transport（可选）" style={{ width: 130 }} />
          <Input value={description} onChange={setDescription} placeholder="描述（可选）" style={{ width: 200 }} />
          <Select appearance="button" value={source} onChange={(v) => setSource(v as ToolSource['source'])} options={SOURCE_OPTIONS} />
          <Button type="primary" loading={creating} disabled={!name.trim()} onClick={handleCreate}>
            <AddIcon size={14} /> 添加
          </Button>
        </div>

        {loading ? (
          <StatusTip status="loading" />
        ) : items.length === 0 ? (
          <StatusTip status="empty" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((t) => (
              <div key={t.tool_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{t.name}</strong>
                    <Tag theme={t.kind === 'mcp' ? 'primary' : 'default'}>{t.kind.toUpperCase()}</Tag>
                    <Tag theme={SOURCE_TAG[t.source]?.theme}>{SOURCE_TAG[t.source]?.text ?? t.source}</Tag>
                  </div>
                  {t.endpoint_url ? <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{t.endpoint_url}{t.transport ? ` · ${t.transport}` : ''}</div> : null}
                  {t.description ? <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{t.description}</div> : null}
                </div>
                <Button type="weak" onClick={() => void handleDelete(t.tool_id)} title="删除">
                  <DeleteIcon size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default ToolSourcePanel;
