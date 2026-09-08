/**
 * AutomationPanel — 自动化编排面板。
 * 团队级：创建定时/触发自动化（cron/webhook/manual/event → run_agent/run_task/notify）。走 meta/automation/*。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, StatusTip, Tag } from 'tea-component';
import { AddIcon, DeleteIcon } from 'tea-icons-react';
import { automationsApi } from '@/lib/api/automations';
import type { Automation } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

const TRIGGER_OPTIONS = [
  { value: 'cron', text: '定时 cron' },
  { value: 'webhook', text: 'Webhook' },
  { value: 'manual', text: '手动' },
  { value: 'event', text: '事件触发' },
];

const ACTION_OPTIONS = [
  { value: 'run_agent', text: '运行 Agent' },
  { value: 'run_task', text: '运行任务' },
  { value: 'notify', text: '通知' },
];

const SOURCE_OPTIONS = [
  { value: 'memory', text: '🧠 记忆总结' },
  { value: 'external', text: '🌐 外部传入' },
  { value: 'hybrid', text: '🧬 融合' },
];

const TRIGGER_TAG_THEME: Record<Automation['trigger_type'], 'primary' | 'warning' | 'success' | 'default'> = {
  cron: 'primary',
  webhook: 'warning',
  manual: 'default',
  event: 'success',
};

export interface AutomationPanelProps {
  teamId: string;
}

export function AutomationPanel({ teamId }: AutomationPanelProps) {
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<Automation['trigger_type']>('cron');
  const [triggerConfig, setTriggerConfig] = useState('');
  const [actionType, setActionType] = useState<Automation['action_type']>('run_agent');
  const [targetId, setTargetId] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<Automation['source']>('memory');

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      setItems(await automationsApi.list(teamId));
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
    if (!name.trim()) return;
    setCreating(true);
    try {
      await automationsApi.create({
        teamId,
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        triggerConfigJson: triggerConfig.trim() || undefined,
        actionType,
        targetId: targetId.trim() || undefined,
        source,
      });
      setName('');
      setDescription('');
      setTriggerConfig('');
      setTargetId('');
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (automationId: string) => {
    const ok = await tea.confirm({ message: '确定删除该自动化？' });
    if (!ok) return;
    try {
      await automationsApi.delete([automationId]);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <Card.Body title="自动化 Automation">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Input value={name} onChange={setName} placeholder="自动化名称" style={{ width: 180 }} />
          <Select appearance="button" value={triggerType} onChange={(v) => setTriggerType(v as Automation['trigger_type'])} options={TRIGGER_OPTIONS} />
          <Input value={triggerConfig} onChange={setTriggerConfig} placeholder="触发配置（如 cron 表达式）" style={{ width: 190 }} />
          <Select appearance="button" value={actionType} onChange={(v) => setActionType(v as Automation['action_type'])} options={ACTION_OPTIONS} />
          <Input value={targetId} onChange={setTargetId} placeholder="目标 ID（agent/task）" style={{ width: 170 }} />
          <Input value={description} onChange={setDescription} placeholder="描述（可选）" style={{ width: 170 }} />
          <Select appearance="button" value={source} onChange={(v) => setSource(v as Automation['source'])} options={SOURCE_OPTIONS} />
          <Button type="primary" loading={creating} disabled={!name.trim()} onClick={handleCreate}>
            <AddIcon size={14} /> 创建
          </Button>
        </div>

        {loading ? (
          <StatusTip status="loading" />
        ) : items.length === 0 ? (
          <StatusTip status="empty" emptyText="暂无自动化" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((a) => (
              <div key={a.automation_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{a.name}</strong>
                    <Tag theme={TRIGGER_TAG_THEME[a.trigger_type]}>{a.trigger_type}</Tag>
                    <Tag theme="default">{a.action_type}</Tag>
                    <Tag theme={a.source === 'external' ? 'warning' : a.source === 'hybrid' ? 'primary' : 'success'}>{a.source}</Tag>
                  </div>
                  {a.description ? <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{a.description}</div> : null}
                </div>
                <Button type="weak" onClick={() => void handleDelete(a.automation_id)} title="删除">
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

export default AutomationPanel;
