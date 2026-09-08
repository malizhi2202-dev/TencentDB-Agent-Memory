/**
 * BrainPanel — 记忆读写入口（Brain 域）。
 *
 * 直调内核 /v3/memory/*（经 memoryApi），全部输入为结构化表单控件（无 JSON 粘贴），
 * 输出用 MemoryResultView 渲染为可读键值/标签，仅异常时回退文本。
 */
import { useState } from 'react';
import { Button, Card, Input, Select } from 'tea-component';
import { memoryApi } from '@/lib/api/memory';
import type { ConsolidationPlan, DreamingMemory, EvalItem, WritePolicy } from '@/lib/api/memory';
import { ResultView } from '@/components/MemoryResultView';

const ACTION_OPTIONS = ['merge', 'archive', 'update', 'link', 'keep'].map((v) => ({ value: v, text: v }));
const POLICY_OPTIONS: Array<{ value: WritePolicy; text: string }> = [
  { value: 'automatic', text: 'automatic 自动写入' },
  { value: 'review_required', text: 'review_required 需审批' },
  { value: 'explicit_only', text: 'explicit_only 仅显式' },
  { value: 'deny', text: 'deny 拒绝写入' },
];
const MEMTYPE_OPTIONS = ['fact', 'rule', 'preference', 'method', 'task', 'artifact', 'episode', 'persona'].map((v) => ({ value: v, text: v }));

interface PlanRow { action: string; fromId: string; toId: string; newState: string; reason: string }
interface DreamRow { id: string; content: string; type: string; domain: string; writePolicy: WritePolicy; priority: string }
interface EvalRow { query: string; relevantIds: string; retrievedIds: string }

function ResultSection({ title, value }: { title: string; value: unknown }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{title}</div>
      <ResultView value={value} />
    </div>
  );
}

function RowToolbar({ onAdd, onDel, addLabel }: { onAdd: () => void; onDel: () => void; addLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <Button onClick={onAdd}>+ {addLabel}</Button>
      <Button type="weak" onClick={onDel}>删除末行</Button>
    </div>
  );
}

export default function BrainPanel() {
  // 写入 / 巩固
  const [plans, setPlans] = useState<PlanRow[]>([
    { action: 'merge', fromId: 'mem-a', toId: 'mem-b', newState: 'consolidated', reason: '去重合并' },
    { action: 'archive', fromId: 'mem-c', toId: '', newState: 'archived', reason: '低价值' },
  ]);
  const [writeResult, setWriteResult] = useState<unknown>(null);

  // Dreaming
  const [dreams, setDreams] = useState<DreamRow[]>([
    { id: 'm1', content: '部署必须校验端口', type: 'fact', domain: 'ops', writePolicy: 'automatic', priority: '8' },
    { id: 'm2', content: '部署必须校验端口', type: 'fact', domain: 'ops', writePolicy: 'automatic', priority: '7' },
  ]);
  const [dreamResult, setDreamResult] = useState<unknown>(null);

  // 召回评测
  const [evals, setEvals] = useState<EvalRow[]>([
    { query: '数据库配置', relevantIds: 'm1,m2', retrievedIds: 'm1,other' },
    { query: '部署密码', relevantIds: 'm3', retrievedIds: 'miss' },
  ]);
  const [evalK, setEvalK] = useState('2');
  const [evalResult, setEvalResult] = useState<unknown>(null);

  // 关系 / 低价值
  const [relA, setRelA] = useState('数据库连接串 host=127.0.0.1');
  const [relB, setRelB] = useState('连接串应指向 10.0.0.5');
  const [relResult, setRelResult] = useState<unknown>(null);
  const [lowContent, setLowContent] = useState('嗯');
  const [lowPriority, setLowPriority] = useState('1');
  const [lowResult, setLowResult] = useState<unknown>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setPlan = (i: number, patch: Partial<PlanRow>) => setPlans((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setDream = (i: number, patch: Partial<DreamRow>) => setDreams((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setEval = (i: number, patch: Partial<EvalRow>) => setEvals((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  async function runWrite() {
    setBusy(true); setErr('');
    try {
      const items: ConsolidationPlan[] = plans.map((p) => ({
        action: p.action as ConsolidationPlan['action'],
        fromId: p.fromId,
        toId: p.toId || undefined,
        newState: p.newState,
        reason: p.reason,
      }));
      setWriteResult(await memoryApi.consolidationExecute(items));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function runDreaming() {
    setBusy(true); setErr('');
    try {
      const mems: DreamingMemory[] = dreams.map((d) => ({
        id: d.id, content: d.content, type: d.type, domain: d.domain,
        writePolicy: d.writePolicy, priority: Number(d.priority) || 1,
      }));
      setDreamResult(await memoryApi.dreamingRun(mems, true));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function runEval() {
    setBusy(true); setErr('');
    try {
      const items: EvalItem[] = evals.map((e) => ({ query: e.query, relevantIds: csv(e.relevantIds), retrievedIds: csv(e.retrievedIds) }));
      setEvalResult(await memoryApi.evalRetrieval(items, Number(evalK) || 2));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function runRelation() {
    setBusy(true); setErr('');
    try {
      const r = await memoryApi.lifecycleDetectRelation(relA, relB);
      const low = await memoryApi.lifecycleDecide('active', r.relation, 'automatic');
      setRelResult({ 关系判定: r.relation, 生命周期决策: low });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function runLowValue() {
    setBusy(true); setErr('');
    try {
      setLowResult(await memoryApi.lifecycleIsLowValue(lowContent, Number(lowPriority) || 1));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 写入 / 巩固 */}
      <Card>
        <Card.Body title="🧠 记忆写入 / 巩固（consolidation/execute → 真实读写 L1）">
          {plans.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              <Select appearance="button" value={p.action} onChange={(v) => setPlan(i, { action: v })} options={ACTION_OPTIONS} />
              <Input value={p.fromId} onChange={(v) => setPlan(i, { fromId: v })} placeholder="fromId" style={{ width: 120 }} />
              <Input value={p.toId} onChange={(v) => setPlan(i, { toId: v })} placeholder="toId（可选）" style={{ width: 120 }} />
              <Input value={p.newState} onChange={(v) => setPlan(i, { newState: v })} placeholder="newState" style={{ width: 140 }} />
              <Input value={p.reason} onChange={(v) => setPlan(i, { reason: v })} placeholder="原因" style={{ width: 180 }} />
            </div>
          ))}
          <RowToolbar addLabel="计划" onAdd={() => setPlans((ps) => [...ps, { action: 'merge', fromId: '', toId: '', newState: 'consolidated', reason: '' }])} onDel={() => setPlans((ps) => ps.slice(0, -1))} />
          <div style={{ marginTop: 8 }}>
            <Button type="primary" loading={busy} onClick={() => void runWrite()}>执行巩固写入</Button>
          </div>
          {err && <div style={{ color: '#d54941', marginTop: 8, fontSize: 12 }}>{err}</div>}
          {writeResult !== null && <ResultSection title="写入结果" value={writeResult} />}
        </Card.Body>
      </Card>

      {/* Dreaming */}
      <Card>
        <Card.Body title="🌙 Dreaming 巩固（dreaming/run → 产出计划）">
          {dreams.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              <Input value={d.id} onChange={(v) => setDream(i, { id: v })} placeholder="id" style={{ width: 80 }} />
              <Input value={d.content} onChange={(v) => setDream(i, { content: v })} placeholder="内容" style={{ width: 220 }} />
              <Select appearance="button" value={d.type} onChange={(v) => setDream(i, { type: v })} options={MEMTYPE_OPTIONS} />
              <Input value={d.domain} onChange={(v) => setDream(i, { domain: v })} placeholder="domain" style={{ width: 90 }} />
              <Select appearance="button" value={d.writePolicy} onChange={(v) => setDream(i, { writePolicy: v as WritePolicy })} options={POLICY_OPTIONS} />
              <Input value={d.priority} onChange={(v) => setDream(i, { priority: v })} placeholder="优先级" style={{ width: 70 }} />
            </div>
          ))}
          <RowToolbar addLabel="记忆" onAdd={() => setDreams((ps) => [...ps, { id: '', content: '', type: 'fact', domain: '', writePolicy: 'automatic', priority: '5' }])} onDel={() => setDreams((ps) => ps.slice(0, -1))} />
          <div style={{ marginTop: 8 }}>
            <Button loading={busy} onClick={() => void runDreaming()}>运行 Dreaming</Button>
          </div>
          {dreamResult !== null && <ResultSection title="Dreaming 计划" value={dreamResult} />}
        </Card.Body>
      </Card>

      {/* 召回评测 */}
      <Card>
        <Card.Body title="📊 召回评测（eval/retrieval → recall@k / MRR / nDCG）">
          {evals.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              <Input value={e.query} onChange={(v) => setEval(i, { query: v })} placeholder="查询" style={{ width: 180 }} />
              <Input value={e.relevantIds} onChange={(v) => setEval(i, { relevantIds: v })} placeholder="相关 ID（逗号）" style={{ width: 180 }} />
              <Input value={e.retrievedIds} onChange={(v) => setEval(i, { retrievedIds: v })} placeholder="召回 ID（逗号）" style={{ width: 180 }} />
            </div>
          ))}
          <RowToolbar addLabel="评测项" onAdd={() => setEvals((ps) => [...ps, { query: '', relevantIds: '', retrievedIds: '' }])} onDel={() => setEvals((ps) => ps.slice(0, -1))} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>k =</span>
            <Input value={evalK} onChange={setEvalK} placeholder="k" style={{ width: 70 }} />
            <Button loading={busy} onClick={() => void runEval()}>运行评测</Button>
          </div>
          {evalResult !== null && <ResultSection title="评测指标" value={evalResult} />}
        </Card.Body>
      </Card>

      {/* 关系 / 低价值 */}
      <Card>
        <Card.Body title="🔗 关系判定 / 低价值（lifecycle）">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input value={relA} onChange={setRelA} placeholder="记忆 A" style={{ width: 240 }} />
            <Input value={relB} onChange={setRelB} placeholder="记忆 B" style={{ width: 240 }} />
            <Button loading={busy} onClick={() => void runRelation()}>判定关系 + 决策</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <Input value={lowContent} onChange={setLowContent} placeholder="内容" style={{ width: 200 }} />
            <Input value={lowPriority} onChange={setLowPriority} placeholder="优先级" style={{ width: 90 }} />
            <Button loading={busy} onClick={() => void runLowValue()}>判定低价值</Button>
          </div>
          {relResult !== null && <ResultSection title="关系与生命周期决策" value={relResult} />}
          {lowResult !== null && <ResultSection title="低价值判定" value={lowResult} />}
        </Card.Body>
      </Card>
    </div>
  );
}
