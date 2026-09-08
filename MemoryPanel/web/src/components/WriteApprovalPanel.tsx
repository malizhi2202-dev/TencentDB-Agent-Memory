/**
 * WriteApprovalPanel — 写入审批（治理人机闭环）。
 *
 * 对应内核 /v3/memory/write-approval/*：
 *   - 发起带审批的巩固写入：consolidation/execute + filter{teamId, agentId} → 按空间写策略
 *     automatic→立即写；review_required/explicit_only→待审批；deny→拒绝。
 *   - 待审批列表：批准（真实执行写入）/ 拒绝。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, StatusTip, Tag } from 'tea-component';
import { memoryApi } from '@/lib/api/memory';
import type { WriteApproval, WriteApprovalDecision, ConsolidationPlan } from '@/lib/api/memory';
import { useAgents } from '@/services';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';
import { ResultView } from '@/components/MemoryResultView';

const ACTION_OPTIONS = ['merge', 'archive', 'update', 'link', 'keep'].map((v) => ({ value: v, text: v }));

function ResultSection({ title, value }: { title: string; value: unknown }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{title}</div>
      <ResultView value={value} />
    </div>
  );
}

export interface WriteApprovalPanelProps {
  teamId: string;
}

export function WriteApprovalPanel({ teamId }: WriteApprovalPanelProps) {
  const { agents } = useAgents(teamId);
  const agentOptions = useMemo(() => agents.map((a) => ({ value: a.agent_id, text: `${a.name}（${a.agent_id}）` })), [agents]);

  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<WriteApproval[]>([]);
  const [loading, setLoading] = useState(false);

  // 发起带审批写入（单条巩固计划，结构化）
  const [agentId, setAgentId] = useState('');
  const [planAction, setPlanAction] = useState('merge');
  const [planFromId, setPlanFromId] = useState('mem-a');
  const [planToId, setPlanToId] = useState('mem-b');
  const [planNewState, setPlanNewState] = useState('consolidated');
  const [planReason, setPlanReason] = useState('去重合并');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<WriteApprovalDecision | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await memoryApi.writeApprovalList(teamId, statusFilter);
      setItems(res.items ?? []);
    } catch (e) {
      setItems([]);
      tea.notify.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [teamId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!agentId) return;
    setSubmitting(true);
    try {
      const plans: ConsolidationPlan[] = [{ action: planAction as ConsolidationPlan['action'], fromId: planFromId, toId: planToId || undefined, newState: planNewState, reason: planReason }];
      const r = await memoryApi.consolidationExecute(plans, { teamId, agentId });
      setSubmitResult(r as WriteApprovalDecision);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    const ok = await tea.confirm({ message: '批准后将以存储的计划真实执行记忆写入，确认？' });
    if (!ok) return;
    try {
      await memoryApi.writeApprovalApprove(approvalId);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const handleReject = async (approvalId: string) => {
    const ok = await tea.confirm({ message: '确定拒绝该写入？拒绝后不执行写入。' });
    if (!ok) return;
    try {
      await memoryApi.writeApprovalReject(approvalId);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const statusTheme: Record<string, 'success' | 'warning' | 'error'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
  };

  return (
    <Card>
      <Card.Body title="写入审批 Write Approval（治理人机闭环）">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <Select appearance="button" clearable value={agentId} onChange={setAgentId} placeholder="目标 Agent" options={agentOptions} />
          <Select appearance="button" value={planAction} onChange={setPlanAction} options={ACTION_OPTIONS} />
          <Input value={planFromId} onChange={setPlanFromId} placeholder="fromId" style={{ width: 110 }} />
          <Input value={planToId} onChange={setPlanToId} placeholder="toId（可选）" style={{ width: 110 }} />
          <Input value={planNewState} onChange={setPlanNewState} placeholder="newState" style={{ width: 130 }} />
          <Input value={planReason} onChange={setPlanReason} placeholder="原因" style={{ width: 150 }} />
          <Button type="primary" loading={submitting} disabled={!agentId} onClick={() => void handleSubmit()}>发起带审批写入</Button>
        </div>
        {submitResult !== null && <ResultSection title="写入门决策" value={submitResult} />}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <strong>审批队列</strong>
          <Select appearance="button" value={statusFilter} onChange={(v) => setStatusFilter(v as 'pending' | 'approved' | 'rejected')} options={[
            { value: 'pending', text: '待审批' },
            { value: 'approved', text: '已批准' },
            { value: 'rejected', text: '已拒绝' },
          ]} />
        </div>

        {loading ? (
          <StatusTip status="loading" />
        ) : items.length === 0 ? (
          <StatusTip status="empty" emptyText="暂无审批项" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((a) => (
              <div key={a.approval_id} style={{ border: '1px solid #eee', borderRadius: 4, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag theme={statusTheme[a.status]}>{a.status}</Tag>
                      <Tag theme="default">{a.write_policy}</Tag>
                      {a.agent_id ? <span style={{ color: '#999', fontSize: 12 }}>{a.agent_id}</span> : null}
                    </div>
                    <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
                      {(() => {
                        try {
                          const plans = JSON.parse(a.plans_json || '[]');
                          return `${plans.length} 条计划：${plans.map((p: { action?: string }) => p.action ?? '?').join(', ')}`;
                        } catch {
                          return a.plans_json;
                        }
                      })()}
                    </div>
                    <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>{a.approval_id}</div>
                  </div>
                  {a.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button type="primary" onClick={() => void handleApprove(a.approval_id)}>批准</Button>
                      <Button type="weak" onClick={() => void handleReject(a.approval_id)}>拒绝</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default WriteApprovalPanel;
