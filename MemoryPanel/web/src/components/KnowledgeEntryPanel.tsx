/**
 * KnowledgeEntryPanel — 知识条目通用面板（项目级五类 + 团队级工作模式）。
 *
 * 一个 scope + scope_id + kind 对应一块可增删查的知识清单，
 * 复用同一后端 KnowledgeEntry 实体。来源标注与规划文档三分法对齐：
 *   🧠 memory 记忆总结 / 🌐 external 外部传入 / 🧬 hybrid 融合。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, StatusTip, Tag, TextArea } from 'tea-component';
import { AddIcon, DeleteIcon } from 'tea-icons-react';
import { knowledgeApi } from '@/lib/api/knowledge';
import type { KnowledgeEntry, KnowledgeKind } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

const SOURCE_OPTIONS = [
  { value: 'memory', text: '🧠 记忆总结' },
  { value: 'external', text: '🌐 外部传入' },
  { value: 'hybrid', text: '🧬 融合' },
];

const SOURCE_TAG: Record<KnowledgeEntry['source'], { text: string; theme: 'success' | 'warning' | 'primary' }> = {
  memory: { text: '🧠 记忆', theme: 'success' },
  external: { text: '🌐 外部', theme: 'warning' },
  hybrid: { text: '🧬 融合', theme: 'primary' },
};

export interface KnowledgeEntryPanelProps {
  scope: 'team' | 'project';
  scopeId: string;
  kind: KnowledgeKind;
  title: string;
  emptyText?: string;
  statusOptions?: { value: string; text: string }[];
}

export function KnowledgeEntryPanel({ scope, scopeId, kind, title, emptyText, statusOptions }: KnowledgeEntryPanelProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // create form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState<KnowledgeEntry['source']>('memory');
  const [newStatus, setNewStatus] = useState('');

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    try {
      setEntries(await knowledgeApi.list(scope, scopeId, kind));
    } catch (e) {
      setEntries([]);
      tea.notify.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await knowledgeApi.create({
        scope,
        scopeId,
        kind,
        title: newTitle.trim(),
        content: newContent.trim() || undefined,
        source: newSource,
        status: newStatus || undefined,
      });
      setNewTitle('');
      setNewContent('');
      setNewStatus('');
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const ok = await tea.confirm({ message: `确定删除该知识条目？` });
    if (!ok) return;
    try {
      await knowledgeApi.delete([entryId]);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <Card.Body title={title}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Input value={newTitle} onChange={setNewTitle} placeholder="标题" style={{ width: 220 }} />
          <TextArea value={newContent} onChange={setNewContent} placeholder="内容（可选）" style={{ width: 320, height: 32 }} />
          <Select
            appearance="button"
            value={newSource}
            onChange={(v) => setNewSource(v as KnowledgeEntry['source'])}
            options={SOURCE_OPTIONS}
          />
          {statusOptions && statusOptions.length > 0 && (
            <Select
              appearance="button"
              clearable
              value={newStatus}
              onChange={setNewStatus}
              placeholder="状态"
              options={statusOptions}
            />
          )}
          <Button type="primary" loading={creating} disabled={!newTitle.trim()} onClick={handleCreate}>
            <AddIcon size={14} /> 添加
          </Button>
        </div>

        {loading ? (
          <StatusTip status="loading" />
        ) : entries.length === 0 ? (
          <StatusTip status="empty" emptyText={emptyText ?? '暂无条目'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((e) => (
              <div key={e.entry_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{e.title}</strong>
                    {e.status ? <Tag theme="default">{e.status}</Tag> : null}
                    <Tag theme={SOURCE_TAG[e.source]?.theme}>{SOURCE_TAG[e.source]?.text ?? e.source}</Tag>
                  </div>
                  {e.content ? <div style={{ color: '#555', marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.content}</div> : null}
                </div>
                <Button type="weak" onClick={() => void handleDelete(e.entry_id)} title="删除">
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

export default KnowledgeEntryPanel;
