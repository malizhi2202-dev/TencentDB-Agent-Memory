/**
 * api/agentTeams.ts — AgentTeam（多 Agent 编排）。
 * 走 meta/agent-team/* 与 meta/agent-team-member/* 透明代理。
 */
import { metaPost, metaListAll, getCurrentUser } from './base';
import type { AgentTeam, AgentTeamMember } from './types';

export const agentTeamsApi = {
  list: (teamId: string) => metaListAll<AgentTeam>('agent-team/list', { team_id: teamId }),

  get: (agentTeamId: string) => metaPost<AgentTeam>('agent-team/get', { agent_team_id: agentTeamId }),

  create: async (data: {
    teamId: string;
    name: string;
    description?: string;
    source: 'memory' | 'external' | 'hybrid';
    linkedAgents?: { agent_id: string; role?: string }[];
  }) => {
    const me = await getCurrentUser();
    return metaPost<AgentTeam>('agent-team/create', {
      team_id: data.teamId,
      name: data.name,
      description: data.description,
      source: data.source,
      owner_user_id: me.user_id,
      linked_agents: data.linkedAgents,
    });
  },

  delete: (agentTeamIds: string[]) =>
    metaPost<{ deleted: number; missing: string[] }>('agent-team/delete', { agent_team_ids: agentTeamIds }),

  // 成员
  listMembers: (agentTeamId: string) =>
    metaListAll<AgentTeamMember>('agent-team-member/list', { agent_team_id: agentTeamId }),

  addMember: (agentTeamId: string, agentId: string, role?: string) =>
    metaPost<AgentTeamMember>('agent-team-member/add', { agent_team_id: agentTeamId, agent_id: agentId, role }),

  removeMember: (agentTeamId: string, agentId: string) =>
    metaPost<{ ok: boolean }>('agent-team-member/remove', { agent_team_id: agentTeamId, agent_id: agentId }),
};
