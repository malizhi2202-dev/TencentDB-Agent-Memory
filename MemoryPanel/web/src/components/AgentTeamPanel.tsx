/**
 * AgentTeamPanel — 多 Agent 编排面板。
 * 团队级：创建编排组、加入 Agent、移除成员、删除组。走 meta/agent-team/*。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, StatusTip, Tag } from 'tea-component';
import { AddIcon, DeleteIcon } from 'tea-icons-react';
import { agentTeamsApi } from '@/lib/api/agentTeams';
import { agentsApi } from '@/lib/api/agents';
import type { AgentTeam, Agent, AgentTeamMember } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

const SOURCE_OPTIONS = [
  { value: 'memory', text: '🧠 记忆总结' },
  { value: 'external', text: '🌐 外部传入' },
  { value: 'hybrid', text: '🧬 融合' },
];

export interface AgentTeamPanelProps {
  teamId: string;
}

interface TeamState {
  members: AgentTeamMember[];
  expanded: boolean;
  selectedAgent: string;
}

export function AgentTeamPanel({ teamId }: AgentTeamPanelProps) {
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<'memory' | 'external' | 'hybrid'>('memory');
  const [states, setStates] = useState<Record<string, TeamState>>({});

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [ts, ags] = await Promise.all([agentTeamsApi.list(teamId), agentsApi.list(teamId)]);
      setTeams(ts);
      setAgents(ags);
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMembers = async (agentTeamId: string) => {
    try {
      const members = await agentTeamsApi.listMembers(agentTeamId);
      setStates((prev) => ({ ...prev, [agentTeamId]: { ...prev[agentTeamId], members, expanded: true } }));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await agentTeamsApi.create({ teamId, name: name.trim(), description: description.trim() || undefined, source });
      setName('');
      setDescription('');
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (agentTeamId: string) => {
    const ok = await tea.confirm({ message: '确定删除该编排组？' });
    if (!ok) return;
    try {
      await agentTeamsApi.delete([agentTeamId]);
      await load();
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const handleAddMember = async (agentTeamId: string) => {
    const st = states[agentTeamId];
    if (!st?.selectedAgent) return;
    try {
      await agentTeamsApi.addMember(agentTeamId, st.selectedAgent);
      setStates((prev) => ({ ...prev, [agentTeamId]: { ...prev[agentTeamId], selectedAgent: '' } }));
      await loadMembers(agentTeamId);
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const handleRemoveMember = async (agentTeamId: string, agentId: string) => {
    try {
      await agentTeamsApi.removeMember(agentTeamId, agentId);
      await loadMembers(agentTeamId);
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  };

  const memberAgentName = (agentId: string) => agents.find((a) => a.agent_id === agentId)?.name ?? agentId;

  return (
    <Card>
      <Card.Body title="Agent 编排 Agent Teams">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Input value={name} onChange={setName} placeholder="编排组名称" style={{ width: 200 }} />
          <Input value={description} onChange={setDescription} placeholder="描述（可选）" style={{ width: 220 }} />
          <Select appearance="button" value={source} onChange={(v) => setSource(v as 'memory' | 'external' | 'hybrid')} options={SOURCE_OPTIONS} />
          <Button type="primary" loading={creating} disabled={!name.trim()} onClick={handleCreate}>
            <AddIcon size={14} /> 创建编排组
          </Button>
        </div>

        {loading ? (
          <StatusTip status="loading" />
        ) : teams.length === 0 ? (
          <StatusTip status="empty" emptyText="暂无 Agent 编排组" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teams.map((t) => {
              const st = states[t.agent_team_id] ?? { members: [], expanded: false, selectedAgent: '' };
              return (
                <div key={t.agent_team_id} style={{ border: '1px solid #eee', borderRadius: 4, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>{t.name}</strong>
                        <Tag theme="primary">{t.source}</Tag>
                      </div>
                      {t.description ? <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{t.description}</div> : null}
                    </div>
                    <Button type="weak" onClick={() => void loadMembers(t.agent_team_id)}>
                      {st.expanded ? '刷新成员' : '成员'}
                    </Button>
                    <Button type="weak" onClick={() => void handleDelete(t.agent_team_id)} title="删除">
                      <DeleteIcon size={14} />
                    </Button>
                  </div>

                  {st.expanded && (
                    <div style={{ marginTop: 10, paddingLeft: 8, borderLeft: '2px solid #eee' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <Select
                          appearance="button"
                          clearable
                          value={st.selectedAgent}
                          onChange={(v) => setStates((prev) => ({ ...prev, [t.agent_team_id]: { ...prev[t.agent_team_id], selectedAgent: v } }))}
                          placeholder="选择 Agent 加入"
                          options={agents
                            .filter((a) => !st.members.some((m) => m.agent_id === a.agent_id))
                            .map((a) => ({ value: a.agent_id, text: `${a.name} · ${a.agent_id}` }))}
                        />
                        <Button type="primary" disabled={!st.selectedAgent} onClick={() => void handleAddMember(t.agent_team_id)}>
                          <AddIcon size={14} /> 加入
                        </Button>
                      </div>
                      {st.members.length === 0 ? (
                        <div style={{ color: '#999', fontSize: 12 }}>暂无成员</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {st.members.map((m) => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                              <span>{memberAgentName(m.agent_id)}{m.role ? <Tag style={{ marginLeft: 6 }}>{m.role}</Tag> : null}</span>
                              <Button type="weak" onClick={() => void handleRemoveMember(t.agent_team_id, m.agent_id)}>
                                <DeleteIcon size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default AgentTeamPanel;
