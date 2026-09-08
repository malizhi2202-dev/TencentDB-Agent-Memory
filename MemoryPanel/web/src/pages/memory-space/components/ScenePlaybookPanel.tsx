/**
 * ScenePlaybookPanel — 场景编排 / 剧本沉淀 产品化面板。
 *
 * 直调内核 /v3/memory/*（经 memoryApi），输入全部为结构化表单控件（无 JSON 粘贴）：
 *   - Scene：可编辑场景定义（表单字段/提交值为行编辑器）+ 就绪检查 / 发布 / 校验
 *   - Playbook：可编辑工作记忆行列表 → 组装 / 合成
 *   - Skill：技能版本状态机（draft → … → 回滚）
 * 输出用 MemoryResultView 渲染为可读键值/标签。
 */
import { useMemo, useState } from 'react';
import { Button, Card, Input, Select } from 'tea-component';
import { useAgents, useTeams } from '@/services';
import { memoryApi } from '@/lib/api/memory';
import type { SceneDefinition, WorkMemory } from '@/lib/api/memory';
import { ResultView } from '@/components/MemoryResultView';

interface FormFieldRow { name: string; type: string; required: boolean }
interface KvRow { key: string; value: string }
interface MemRow { id: string; type: string; content: string; taskId: string; priority: string }

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

function parseCsv(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

const MEMTYPE_OPTIONS = [
  { value: 'work_task', text: 'work_task 任务' },
  { value: 'work_method', text: 'work_method 方法' },
  { value: 'work_artifact', text: 'work_artifact 产出物' },
];

export default function ScenePlaybookPanel() {
  const { activeTeamId } = useTeams();
  const { agents } = useAgents(activeTeamId);
  const agentOptions = useMemo(() => agents.map((a) => ({ value: a.agent_id, text: `${a.name}（${a.agent_id}）` })), [agents]);

  // Scene 定义
  const [sceneId, setSceneId] = useState('deploy-scene');
  const [title, setTitle] = useState('部署发布场景');
  const [executorAgentId, setExecutorAgentId] = useState('');
  const [tools, setTools] = useState('kubectl,helm');
  const [capabilities, setCapabilities] = useState('k8s_deploy');
  const [constraints, setConstraints] = useState('');
  const [persona, setPersona] = useState('发布运维专家');
  const [knowledgeRefs, setKnowledgeRefs] = useState('');
  const [formFields, setFormFields] = useState<FormFieldRow[]>([
    { name: 'version', type: 'string', required: true },
  ]);
  const [availableCaps, setAvailableCaps] = useState('k8s_deploy');
  const [supplied, setSupplied] = useState<KvRow[]>([{ key: 'version', value: 'v1.2.3' }]);
  const [sceneResult, setSceneResult] = useState<unknown>(null);

  // Playbook
  const [memories, setMemories] = useState<MemRow[]>([
    { id: 't1', type: 'work_task', content: '部署服务到生产', taskId: 'deploy', priority: '10' },
    { id: 'm1', type: 'work_method', content: '拉取最新镜像', taskId: 'deploy', priority: '5' },
    { id: 'm2', type: 'work_method', content: '滚动重启实例', taskId: 'deploy', priority: '4' },
    { id: 'a1', type: 'work_artifact', content: '发布记录', taskId: 'deploy', priority: '1' },
  ]);
  const [playbookResult, setPlaybookResult] = useState<unknown>(null);

  // Skill
  const [skillStatus, setSkillStatus] = useState('draft');
  const [skillEvent, setSkillEvent] = useState('submit_review');
  const [skillResult, setSkillResult] = useState<unknown>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setField = (i: number, patch: Partial<FormFieldRow>) => setFormFields((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setKv = (i: number, patch: Partial<KvRow>) => setSupplied((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setMem = (i: number, patch: Partial<MemRow>) => setMemories((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  function buildScene(): SceneDefinition {
    return {
      sceneId: sceneId.trim(),
      title: title.trim(),
      executorAgentId: executorAgentId.trim(),
      toolsWhitelist: parseCsv(tools),
      capabilities: parseCsv(capabilities),
      constraints: parseCsv(constraints),
      persona: persona.trim(),
      knowledgeRefs: parseCsv(knowledgeRefs),
      formFields: formFields.map((f) => ({ name: f.name, type: f.type, required: f.required })),
    };
  }

  function parseMemories(): WorkMemory[] {
    return memories.map((m) => ({
      id: m.id,
      type: m.type as WorkMemory['type'],
      content: m.content,
      taskId: m.taskId,
      priority: Number(m.priority) || 1,
    }));
  }

  async function runScene(action: 'readiness' | 'publish' | 'validate') {
    setBusy(true); setErr('');
    try {
      const scene = buildScene();
      let r: unknown;
      if (action === 'readiness') r = await memoryApi.sceneReadiness(scene, parseCsv(availableCaps));
      else if (action === 'publish') r = await memoryApi.scenePublish(scene, 1);
      else {
        const suppliedObj: Record<string, unknown> = {};
        for (const kv of supplied) if (kv.key) suppliedObj[kv.key] = kv.value;
        r = await memoryApi.sceneValidate(scene, suppliedObj);
      }
      setSceneResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runPlaybook(kind: 'assemble' | 'synthesize') {
    setBusy(true); setErr('');
    try {
      const mems = parseMemories();
      let r: unknown;
      if (kind === 'assemble') {
        r = await memoryApi.playbookAssemble(
          mems.find((m) => m.type === 'work_task'),
          mems.filter((m) => m.type === 'work_method'),
          mems.filter((m) => m.type === 'work_artifact'),
        );
      } else {
        r = await memoryApi.playbookSynthesize(mems);
      }
      setPlaybookResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runSkill() {
    setBusy(true); setErr('');
    try {
      setSkillResult(await memoryApi.skillVersionTransition(skillStatus, skillEvent));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Scene */}
      <Card>
        <Card.Body title="可执行场景 Scene（可编辑定义 → 就绪/发布/校验）">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input value={sceneId} onChange={setSceneId} placeholder="sceneId" style={{ width: 140 }} />
            <Input value={title} onChange={setTitle} placeholder="标题" style={{ width: 160 }} />
            <Select appearance="button" clearable value={executorAgentId} onChange={setExecutorAgentId} placeholder="执行 Agent" options={agentOptions} />
            <Input value={tools} onChange={setTools} placeholder="工具白名单（逗号分隔）" style={{ width: 180 }} />
            <Input value={capabilities} onChange={setCapabilities} placeholder="能力（逗号分隔）" style={{ width: 160 }} />
            <Input value={persona} onChange={setPersona} placeholder="persona" style={{ width: 140 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <Input value={constraints} onChange={setConstraints} placeholder="约束（逗号分隔）" style={{ width: 180 }} />
            <Input value={knowledgeRefs} onChange={setKnowledgeRefs} placeholder="知识引用（逗号分隔）" style={{ width: 180 }} />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>表单字段（name / type / 必填）</div>
          {formFields.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <Input value={f.name} onChange={(v) => setField(i, { name: v })} placeholder="字段名" style={{ width: 140 }} />
              <Select appearance="button" value={f.type} onChange={(v) => setField(i, { type: v })} options={['string', 'number', 'boolean', 'enum', 'text'].map((v) => ({ value: v, text: v }))} />
              <Select appearance="button" value={f.required ? 'required' : 'optional'} onChange={(v) => setField(i, { required: v === 'required' })} options={[{ value: 'required', text: '必填' }, { value: 'optional', text: '可选' }]} />
            </div>
          ))}
          <RowToolbar addLabel="字段" onAdd={() => setFormFields((ps) => [...ps, { name: '', type: 'string', required: false }])} onDel={() => setFormFields((ps) => ps.slice(0, -1))} />

          <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>表单提交值（key / value）</div>
          {supplied.map((kv, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <Input value={kv.key} onChange={(v) => setKv(i, { key: v })} placeholder="key" style={{ width: 140 }} />
              <Input value={kv.value} onChange={(v) => setKv(i, { value: v })} placeholder="value" style={{ width: 180 }} />
            </div>
          ))}
          <RowToolbar addLabel="值" onAdd={() => setSupplied((ps) => [...ps, { key: '', value: '' }])} onDel={() => setSupplied((ps) => ps.slice(0, -1))} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <Input value={availableCaps} onChange={setAvailableCaps} placeholder="就绪检查：可用能力" style={{ width: 180 }} />
            <Button type="primary" loading={busy} onClick={() => void runScene('readiness')}>就绪检查</Button>
            <Button loading={busy} onClick={() => void runScene('publish')}>发布 v1</Button>
            <Button loading={busy} onClick={() => void runScene('validate')}>表单校验</Button>
          </div>
          {err && <div style={{ color: '#d54941', marginTop: 8, fontSize: 12 }}>{err}</div>}
          {sceneResult !== null && <ResultSection title="场景结果" value={sceneResult} />}
        </Card.Body>
      </Card>

      {/* Playbook */}
      <Card>
        <Card.Body title="剧本 Playbook（可编辑工作记忆 → 组装/合成）">
          {memories.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              <Input value={m.id} onChange={(v) => setMem(i, { id: v })} placeholder="id" style={{ width: 70 }} />
              <Select appearance="button" value={m.type} onChange={(v) => setMem(i, { type: v })} options={MEMTYPE_OPTIONS} />
              <Input value={m.content} onChange={(v) => setMem(i, { content: v })} placeholder="内容" style={{ width: 240 }} />
              <Input value={m.taskId} onChange={(v) => setMem(i, { taskId: v })} placeholder="taskId" style={{ width: 110 }} />
              <Input value={m.priority} onChange={(v) => setMem(i, { priority: v })} placeholder="优先级" style={{ width: 70 }} />
            </div>
          ))}
          <RowToolbar addLabel="记忆" onAdd={() => setMemories((ps) => [...ps, { id: '', type: 'work_method', content: '', taskId: '', priority: '1' }])} onDel={() => setMemories((ps) => ps.slice(0, -1))} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button type="primary" loading={busy} onClick={() => void runPlaybook('assemble')}>组装（task+methods+artifacts）</Button>
            <Button loading={busy} onClick={() => void runPlaybook('synthesize')}>合成剧本</Button>
          </div>
          {playbookResult !== null && <ResultSection title="剧本结果" value={playbookResult} />}
        </Card.Body>
      </Card>

      {/* Skill version */}
      <Card>
        <Card.Body title="技能版本状态机 Skill Version">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select appearance="button" value={skillStatus} onChange={setSkillStatus} options={['draft', 'pending', 'published', 'evaluating', 'superseded', 'rolled_back'].map((v) => ({ value: v, text: v }))} />
            <span>→</span>
            <Select appearance="button" value={skillEvent} onChange={setSkillEvent} options={['submit_review', 'approve', 'reject', 'start_eval', 'pass_eval', 'fail_eval', 'supersede', 'rollback'].map((v) => ({ value: v, text: v }))} />
            <Button type="primary" loading={busy} onClick={() => void runSkill()}>执行转移</Button>
          </div>
          {skillResult !== null && <ResultSection title="状态机结果" value={skillResult} />}
        </Card.Body>
      </Card>
    </div>
  );
}
