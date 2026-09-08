/**
 * RunTracePanel — 运行回放面板。
 * 团队级：登记 run/trace、展示输入/输出摘要、展开 trace_json 步骤回放。走 meta/run-trace/*。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, StatusTip, Tag, TextArea } from 'tea-component';
import { AddIcon, DeleteIcon } from 'tea-icons-react';
import { runTracesApi } from '@/lib/api/runTraces';
import { agentsApi } from '@/lib/api/agents';
import type { RunTrace, Agent } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

const KIND_OPTIONS = [
  { value: 'run', text: 'Run 运行' },
  { value: 'trace', text: 'Trace 回放' },
];

const SOURCE_OPTIONS = [
  { value: 'memory', text: '🧠 记忆总结' },
  { value: 'external', text: '🌐 外部传入' },
  { value: 'hybrid', text: '🧬 融合' },
];

export interface RunTracePanelProps {
  teamId: string;
}

export function RunTracePanel({ teamId }: RunTracePanelProps) {
  const [items, setItems] = useState<RunTrace[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'run' | 'trace'>('trace');
  const [agentId, setAgentId] = useState('');
  const [status, setStatus] = useState('');
  const [inputSummary, setInputSummary] = useState('');
  const [outputSummary, setOutputSummary] = useState('');
  const [traceJson, setTraceJson] = useState('');
  const [source, setSource] = useState<'memory' | 'external' | 'hybrid'>('memory');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [rs, ags] = await Promise.all([runTracesApi.list(teamId), agentsApi.list(teamId)]);
      setItems(rs);
      setAgents(ags);
    } catch (e) {
      setItems([]);
      tea.notify.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await runTracesApi.create({
        teamId,
        title: title.trim(),
        kind,
        agentId: agentId || undefined,
        status: status || undefined,
        inputSummary: inputSummary.trim() || undefined,
        outputSummary: outputSummary.trim() || undefined,
        traceJson: traceJson.trim() || undefined,
        source,
      });
      setTitle('');
      setAgentId('');
      setStatus('');
      setInputSummary('');
      setOutputSummary('');
      setTraceJson('');
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (runId: string) => {
    const ok = await tea.confirm({ message: '确定删除该运行记录？' });
    if (!ok) return;
    try {
      await runTracesApi.delete([runId]);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const renderTraceSteps = (traceJson: string) => {
    try {
      const steps = JSON.parse(traceJson || '[]');
      if (!Array.isArray(steps)) return <div style={{ color: '#888', fontSize: 12 }}>{traceJson}</div>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: '#555', paddingLeft: 8, borderLeft: '2px solid #ddd' }}>
              {typeof s === 'string' ? s : JSON.stringify(s)}
            </div>
          ))}
        </div>
      );
    } catch {
      return <div style={{ color: '#888', fontSize: 12 }}>{traceJson}</div>;
    }
  };

  return (
    <Card>
      <Card.Body title="运行回放 Run / Trace">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Input value={title} onChange={setTitle} placeholder="运行标题" style={{ width: 180 }} />
          <Select appearance="button" value={kind} onChange={(v) => setKind(v as 'run' | 'trace')} options={KIND_OPTIONS} />
          <Select appearance="button" clearable value={agentId} onChange={setAgentId} placeholder="关联 Agent" options={agents.map((a) => ({ value: a.agent_id, text: `${a.name} · ${a.agent_id}` }))} />
          <Input value={status} onChange={setStatus} placeholder="状态（如 completed）" style={{ width: 150 }} />
          <Input value={inputSummary} onChange={setInputSummary} placeholder="输入摘要" style={{ width: 150 }} />
          <Input value={outputSummary} onChange={setOutputSummary} placeholder="输出摘要" style={{ width: 150 }} />
          <Select appearance="button" value={source} onChange={(v) => setSource(v as 'memory' | 'external' | 'hybrid')} options={SOURCE_OPTIONS} />
          <Button type="primary" loading={creating} disabled={!title.trim()} onClick={handleCreate}>
            <AddIcon size={14} /> 登记
          </Button>
        </div>
        <TextArea value={traceJson} onChange={setTraceJson} placeholder='回放步骤 JSON，如 [{"step":"思考"},{"step":"行动"}]（可选）' style={{ width: '100%', height: 48, marginBottom: 12 }} />

        {loading ? (
          <StatusTip status="loading" />
        ) : items.length === 0 ? (
          <StatusTip status="empty" emptyText="暂无运行记录" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((r) => (
              <div key={r.run_id} style={{ border: '1px solid #eee', borderRadius: 4, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{r.title}</strong>
                      <Tag theme={r.kind === 'trace' ? 'primary' : 'default'}>{r.kind}</Tag>
                      {r.status ? <Tag theme="success">{r.status}</Tag> : null}
                      {r.agent_id ? <span style={{ color: '#999', fontSize: 12 }}>{r.agent_id}</span> : null}
                    </div>
                    {r.input_summary ? <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>输入: {r.input_summary}</div> : null}
                    {r.output_summary ? <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>输出: {r.output_summary}</div> : null}
                  </div>
                  <Button type="weak" onClick={() => setExpanded((p) => ({ ...p, [r.run_id]: !p[r.run_id] }))}>
                    {expanded[r.run_id] ? '收起回放' : '回放'}
                  </Button>
                  <Button type="weak" onClick={() => void handleDelete(r.run_id)} title="删除">
                    <DeleteIcon size={14} />
                  </Button>
                </div>
                {expanded[r.run_id] && (
                  <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid #eee' }}>
                    {renderTraceSteps(r.trace_json)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default RunTracePanel;
