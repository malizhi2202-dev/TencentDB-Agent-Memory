/**
 * MemoryCapabilitiesPanel — 记忆能力总览/自检面板。
 *
 * 把三平台比对新增、此前无 UI 的记忆能力一次性体现在界面上：
 *   记忆空间（真实数据）· 反馈回路 · 治理（审批门/工具审批/生命周期）·
 *   资产沉淀（剧本/可执行场景/技能版本）· 监控评测（质量/召回评测/巩固指标）。
 * 所有区块都直调内核 /v3/memory/*（经 memoryApi），展示真实内核计算结果而非死数据。
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input, Select, Table, Tabs, TabPanel, Tag, message } from 'tea-component';
import { memoryApi } from '@/lib/api/memory';
import type { AgentSpace, EvalItem } from '@/lib/api/memory';

// ── 通用展示块 ──
function ResultBox({ title, value }: { title: string; value: unknown }) {
  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: '#f5f7fa', borderRadius: 6 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{title}</div>
      <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

// ── Tab 1：记忆空间 ──
function SpacesPanel() {
  const { t } = useTranslation();
  const [agentId, setAgentId] = useState('');
  const [spaces, setSpaces] = useState<AgentSpace[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!agentId.trim()) { message.warning({ content: t('memoryCap.spaces.query') }); return; }
    setBusy(true);
    try {
      setSpaces(await memoryApi.spaceList(agentId.trim()));
    } catch (e) {
      message.error({ content: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Card.Body title={t('memoryCap.spaces.title')}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input value={agentId} onChange={(v) => setAgentId(v)} placeholder="agent_id（如 ag_xxx）" style={{ width: 360 }} />
          <Button type="primary" loading={busy} onClick={load}>{t('memoryCap.spaces.query')}</Button>
        </div>
        {spaces !== null && (
          <Table
            records={spaces}
            recordKey="id"
            columns={[
              { key: 'space_id', header: '空间 ID' },
              { key: 'owner_type', header: '归属', render: (r: AgentSpace) => <Tag theme="success">{r.owner_type}</Tag> },
              { key: 'owner_id', header: '归属 ID' },
              { key: 'domain', header: '域' },
              { key: 'write_policy', header: '写入策略' },
              { key: 'source', header: '来源', render: (r: AgentSpace) => (r.source === 'default_mount' ? <Tag>默认挂载</Tag> : <Tag theme="warning">显式</Tag>) },
            ]}
          />
        )}
      </Card.Body>
    </Card>
  );
}

// ── Tab 2：反馈回路 ──
function FeedbackPanel() {
  const { t } = useTranslation();
  const [text, setText] = useState('不对，这个服务端口应该是 8080');
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const det = await memoryApi.feedbackDetect(text);
      if (det.detected && det.signal && det.source) {
        const dec = await memoryApi.feedbackDecide(det.signal, det.source, 'automatic');
        setResult({ 检测: det, 决策: dec });
      } else {
        setResult({ 检测: det, 决策: '（无反馈信号）' });
      }
    } catch (e) {
      message.error({ content: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Card.Body title={t('memoryCap.feedback.title')}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={text} onChange={(v) => setText(v)} placeholder="输入用户反馈文本" style={{ width: 480 }} />
          <Button type="primary" loading={busy} onClick={run}>{t('memoryCap.feedback.run')}</Button>
        </div>
        {result !== null && <ResultBox title="结果" value={result} />}
      </Card.Body>
    </Card>
  );
}

// ── Tab 3：治理 ──
function GovernancePanel() {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState('review_required');
  const [role, setRole] = useState('member');
  const [gate, setGate] = useState<{ decision: string; canApprove: boolean } | null>(null);

  const [level, setLevel] = useState('smart');
  const [risk, setRisk] = useState('risky');
  const [approval, setApproval] = useState<{ decision: string } | null>(null);

  const [lstate, setLstate] = useState('active');
  const [lrelation, setLrelation] = useState('duplicate');
  const [lifecycle, setLifecycle] = useState<{ action: string; newState: string; reason: string } | null>(null);

  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const [g, a, l] = await Promise.all([
        memoryApi.reviewGate(policy as never, role as never),
        memoryApi.approvalNeeds(level, risk as never),
        memoryApi.lifecycleDecide(lstate, lrelation, 'automatic'),
      ]);
      setGate(g); setApproval(a); setLifecycle(l);
    } catch (e) {
      message.error({ content: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const sel = (opts: string[]) => opts.map((o) => ({ value: o, text: o }));

  return (
    <Card>
      <Card.Body title={t('memoryCap.governance.title')}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ margin: '8px 0' }}>写入审批门</div>
            <Select value={policy} options={sel(['automatic', 'review_required', 'explicit_only', 'deny'])} onChange={setPolicy} />
            <span style={{ margin: '0 6px' }}>×</span>
            <Select value={role} options={sel(['owner', 'admin', 'member', 'viewer'])} onChange={setRole} />
            <div style={{ marginTop: 6 }}>{gate !== null && <Tag theme={gate.decision === 'commit' ? 'success' : gate.decision === 'hold' ? 'warning' : 'error'}>{gate.decision}</Tag>}</div>
          </div>
          <div>
            <div style={{ margin: '8px 0' }}>工具命令审批（五档）</div>
            <Select value={level} options={sel(['untrusted_command', 'on_failure', 'on_demand', 'smart', 'never'])} onChange={setLevel} />
            <span style={{ margin: '0 6px' }}>×</span>
            <Select value={risk} options={sel(['safe', 'risky', 'untrusted'])} onChange={setRisk} />
            <div style={{ marginTop: 6 }}>{approval !== null && <Tag theme="primary">{approval.decision}</Tag>}</div>
          </div>
          <div>
            <div style={{ margin: '8px 0' }}>生命周期决策</div>
            <Select value={lstate} options={sel(['active', 'consolidated', 'archived', 'dormant'])} onChange={setLstate} />
            <span style={{ margin: '0 6px' }}>×</span>
            <Select value={lrelation} options={sel(['duplicate', 'near_duplicate', 'conflict', 'complementary', 'low_value'])} onChange={setLrelation} />
            <div style={{ marginTop: 6 }}>{lifecycle !== null && <Tag theme="primary">{lifecycle.action}</Tag>}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button type="primary" loading={busy} onClick={run}>{t('memoryCap.governance.run')}</Button>
        </div>
        {lifecycle !== null && <ResultBox title="生命周期明细" value={lifecycle} />}
      </Card.Body>
    </Card>
  );
}

// ── Tab 4：资产沉淀 ──
function AssetsPanel() {
  const { t } = useTranslation();
  const [synth, setSynth] = useState<unknown>(null);
  const [scene, setScene] = useState<unknown>(null);
  const [skill, setSkill] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const [s, sc, sk] = await Promise.all([
        memoryApi.playbookSynthesize([
          { id: 't1', type: 'work_task', content: '部署服务到生产', taskId: 'deploy', priority: 10 },
          { id: 'm1', type: 'work_method', content: '拉取最新镜像', taskId: 'deploy', priority: 5 },
          { id: 'm2', type: 'work_method', content: '滚动重启实例', taskId: 'deploy', priority: 4 },
          { id: 'a1', type: 'work_artifact', content: '发布记录', taskId: 'deploy', priority: 1 },
        ]),
        memoryApi.sceneReadiness(
          { sceneId: 's1', title: '部署场景', executorAgentId: 'ag1', toolsWhitelist: ['kubectl'], capabilities: ['k8s_deploy'], constraints: [], persona: '', knowledgeRefs: [], formFields: [{ name: 'version', type: 'string', required: true }] },
          ['k8s_deploy'],
        ),
        memoryApi.skillVersionTransition('draft', 'submit_review'),
      ]);
      setSynth(s); setScene(sc); setSkill(sk);
    } catch (e) {
      message.error({ content: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Card.Body title={t('memoryCap.assets.title')}>
        <Button type="primary" loading={busy} onClick={run}>{t('memoryCap.assets.run')}</Button>
        {synth !== null && (
          <ResultBox title="剧本合成（playbook/synthesize）" value={{
            可复用剧本数: (synth as { playbooks: unknown[] }).playbooks.length,
            跳过无步骤: (synth as { skippedNoSteps: number }).skippedNoSteps,
            剧本: (synth as { playbooks: unknown[] }).playbooks,
          }} />
        )}
        {scene !== null && <ResultBox title="可执行场景就绪检查" value={scene} />}
        {skill !== null && <ResultBox title="技能版本状态机（draft → submit_review）" value={skill} />}
      </Card.Body>
    </Card>
  );
}

// ── Tab 5：监控评测 ──
function MonitoringPanel() {
  const { t } = useTranslation();
  const [quality, setQuality] = useState<unknown>(null);
  const [evalRes, setEvalRes] = useState<unknown>(null);
  const [metrics, setMetrics] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const evalItems: EvalItem[] = [
        { query: '数据库配置', relevantIds: ['m1', 'm2'], retrievedIds: ['m1', 'other'] },
        { query: '部署密码', relevantIds: ['m3'], retrievedIds: ['miss'] },
      ];
      const [q, e, m] = await Promise.all([
        memoryApi.qualityTransition('active', 'archive'),
        memoryApi.evalRetrieval(evalItems, 2),
        memoryApi.metricsConsolidation([
          { plans: [{ action: 'merge', fromId: 'b', toId: 'a', newState: 'consolidated', reason: 'dup' }], result: { executed: 1, failed: [] } },
          { plans: [{ action: 'archive', fromId: 'c', newState: 'archived', reason: 'low' }], result: { executed: 0, failed: ['c'] } },
        ]),
      ]);
      setQuality(q); setEvalRes(e); setMetrics(m);
    } catch (e) {
      message.error({ content: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Card.Body title={t('memoryCap.monitoring.title')}>
        <Button type="primary" loading={busy} onClick={run}>{t('memoryCap.monitoring.run')}</Button>
        {quality !== null && <ResultBox title="质量状态机（active → archive）" value={quality} />}
        {evalRes !== null && <ResultBox title="召回评测（recall@2 / MRR / nDCG）" value={evalRes} />}
        {metrics !== null && <ResultBox title="巩固健康度指标" value={metrics} />}
      </Card.Body>
    </Card>
  );
}

export default function MemoryCapabilitiesPanel() {
  const { t } = useTranslation();
  const tabs = useMemo(
    () => [
      { id: 'spaces', label: t('memoryCap.tab.spaces') },
      { id: 'feedback', label: t('memoryCap.tab.feedback') },
      { id: 'governance', label: t('memoryCap.tab.governance') },
      { id: 'assets', label: t('memoryCap.tab.assets') },
      { id: 'monitoring', label: t('memoryCap.tab.monitoring') },
    ],
    [t],
  );

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>{t('memoryCap.title')}</h3>
        <Tag theme="primary">{t('memoryCap.tag.kernel')}</Tag>
        <Tag>{t('memoryCap.tag.compare')}</Tag>
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        {t('memoryCap.subtitle')}
      </div>
      <Tabs tabs={tabs}>
        <TabPanel id="spaces"><SpacesPanel /></TabPanel>
        <TabPanel id="feedback"><FeedbackPanel /></TabPanel>
        <TabPanel id="governance"><GovernancePanel /></TabPanel>
        <TabPanel id="assets"><AssetsPanel /></TabPanel>
        <TabPanel id="monitoring"><MonitoringPanel /></TabPanel>
      </Tabs>
    </div>
  );
}