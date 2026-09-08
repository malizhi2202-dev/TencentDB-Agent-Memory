/**
 * MemorySpacesPage — 记忆空间模块（列表 + 平台能力）
 *
 * change: agent-collab-ui-redesign / 维度筛选补全 + 接真实数据
 * 「空间列表」：团队 / 项目 / Agent / 用户 四维 AND 筛选 + 真实挂载空间列表。
 * 「平台能力」：记忆能力总览（反馈回路 / 治理 / 资产沉淀 / 监控评测）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, Segment, Select, Table, StatusTip } from 'tea-component';
import { useTeams, useAgents } from '@/services';
import { projectsApi } from '@/lib/api/projects';
import { memoryApi, type AgentSpace } from '@/lib/api/memory';
import type { Project } from '@/lib/api/types';
import MemoryCapabilitiesPanel from './components/MemoryCapabilitiesPanel';

export function MemorySpacesPage() {
  const [tab, setTab] = useState<'spaces' | 'capabilities'>('spaces');
  // 四维 AND 筛选（空 = 不过滤）
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const { teams, activeTeamId } = useTeams();
  const effectiveTeamId = selectedTeam || activeTeamId;
  const { agents } = useAgents(effectiveTeamId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [spaces, setSpaces] = useState<AgentSpace[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const activeTeam = useMemo(
    () => teams.find((t) => t.team_id === effectiveTeamId) ?? null,
    [teams, effectiveTeamId],
  );
  const members = activeTeam?.members ?? [];

  // 空间列表：团队 × 项目 × Agent × 用户 AND（内核 space/list 组合筛选）
  useEffect(() => {
    if (!effectiveTeamId) {
      setSpaces([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    memoryApi
      .spaceList({
        teamId: effectiveTeamId,
        projectId: selectedProject || undefined,
        agentId: selectedAgent || undefined,
        ownerUserId: selectedOwner || undefined,
      })
      .then((s) => {
        if (!cancelled) setSpaces(s);
      })
      .catch(() => {
        if (!cancelled) setSpaces([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTeamId, selectedProject, selectedAgent, selectedOwner]);

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-tabs">
        <Segment
          value={tab}
          onChange={(v) => setTab(v as 'spaces' | 'capabilities')}
          options={[
            { value: 'spaces', text: '空间列表' },
            { value: 'capabilities', text: '平台能力' },
          ]}
        />
      </div>
      <div className="_memory-detail-body">
        {tab === 'spaces' ? (
          <>
            <div className="_memory-detail-head">
              <div className="_asset-filter-quad">
                <Select
                  appearance="button"
                  matchButtonWidth
                  clearable
                  value={selectedTeam || ''}
                  onChange={(v) => setSelectedTeam(v)}
                  placeholder="选择团队"
                  options={teams.map((tm) => ({
                    value: tm.team_id,
                    text: `${tm.name}（${tm.team_id}）`,
                  }))}
                />
                <Select
                  appearance="button"
                  matchButtonWidth
                  clearable
                  value={selectedProject || ''}
                  onChange={(v) => setSelectedProject(v)}
                  placeholder="选择项目"
                  options={projects.map((p) => ({
                    value: p.project_id,
                    text: `${p.name}（${p.project_id}）`,
                  }))}
                />
                <Select
                  appearance="button"
                  matchButtonWidth
                  clearable
                  value={selectedAgent || ''}
                  onChange={(v) => setSelectedAgent(v)}
                  placeholder="选择 Agent"
                  options={agents.map((a) => ({
                    value: a.agent_id,
                    text: `${a.name}（${a.agent_id}）`,
                  }))}
                />
                <Select
                  appearance="button"
                  matchButtonWidth
                  clearable
                  value={selectedOwner || ''}
                  onChange={(v) => setSelectedOwner(v)}
                  placeholder="选择用户"
                  options={members.map((m) => ({
                    value: m.user_id,
                    text: `${m.username ?? m.user_id}（${m.user_id}）`,
                  }))}
                />
              </div>
            </div>
            <Card>
              <Card.Body>
                {loading ? (
                  <StatusTip status="loading" loadingText="加载记忆空间…" />
                ) : spaces && spaces.length === 0 ? (
                  <StatusTip status="empty" emptyText="当前筛选条件下没有匹配的记忆空间。" />
                ) : (
                  <Table
                    records={spaces ?? []}
                    recordKey="id"
                    columns={[
                      { key: 'space_id', header: '空间 ID' },
                      { key: 'agent_id', header: '挂载 Agent' },
                      { key: 'owner_type', header: '归属类型' },
                      { key: 'owner_id', header: '归属 ID' },
                      { key: 'domain', header: '域' },
                      { key: 'write_policy', header: '写入策略' },
                      { key: 'source', header: '来源' },
                    ]}
                  />
                )}
              </Card.Body>
            </Card>
          </>
        ) : (
          <MemoryCapabilitiesPanel />
        )}
      </div>
    </div>
  );
}

export default MemorySpacesPage;
