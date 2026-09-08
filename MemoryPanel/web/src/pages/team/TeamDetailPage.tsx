/**
 * TeamDetailPage — 团队详情（下探：成员管理 + Agent 管理 + 工作模式）
 *
 * change: agent-collab-ui-redesign / 团队模块下探
 * 从团队列表页下探进入，URL 携带 teamId；进入时同步 active team，
 * 顶部 Segment 切换「成员管理 / Agents 管理 / 工作模式」。
 * 工作模式 = 团队级 KnowledgeEntry（规范 convention / 方法论 methodology / 心智 mindset）。
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Segment, Button } from 'tea-component';
import { ArrowLeftIcon } from 'tea-icons-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useCurrentRole } from '@/services/useCurrentRole';
import TeamManagementPanel from './components/TeamManagementPanel';
import { KnowledgeEntryPanel } from '@/components/KnowledgeEntryPanel';
import { ToolSourcePanel } from '@/components/ToolSourcePanel';
import { AgentTeamPanel } from '@/components/AgentTeamPanel';
import { AutomationPanel } from '@/components/AutomationPanel';
import { RunTracePanel } from '@/components/RunTracePanel';
import { WriteApprovalPanel } from '@/components/WriteApprovalPanel';

type TeamTab = 'members' | 'agents' | 'patterns' | 'tools' | 'agentteams' | 'automations' | 'runs' | 'approvals';

export function TeamDetailPage() {
  const { t } = useTranslation();
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuthStore();
  const role = useCurrentRole();
  const [tab, setTab] = useState<TeamTab>('members');

  if (!auth) return null;
  if (!teamId) return null;

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <Button
          type="weak"
          onClick={() => navigate('/team')}
          title={t('team.backToList')}
        >
          <ArrowLeftIcon size={14} /> {t('team.backToList')}
        </Button>
      </div>
      <div className="_memory-detail-tabs">
        <Segment
          value={tab}
          onChange={(v) => setTab(v as TeamTab)}
          options={[
            { value: 'members', text: t('menu.team_members') },
            { value: 'agents', text: t('menu.team_agents') },
            { value: 'patterns', text: '工作模式' },
            { value: 'tools', text: '工具集' },
            { value: 'agentteams', text: 'Agent 编排' },
            { value: 'automations', text: '自动化' },
            { value: 'runs', text: '运行回放' },
            { value: 'approvals', text: '写入审批' },
          ]}
        />
      </div>

      {tab === 'patterns' ? (
        <div className="_memory-detail-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <KnowledgeEntryPanel
            scope="team"
            scopeId={teamId}
            kind="convention"
            title="组织规范 Convention"
            emptyText="暂无组织规范"
          />
          <KnowledgeEntryPanel
            scope="team"
            scopeId={teamId}
            kind="methodology"
            title="方法论 Methodology"
            emptyText="暂无方法论"
          />
          <KnowledgeEntryPanel
            scope="team"
            scopeId={teamId}
            kind="mindset"
            title="心智 Mindset"
            emptyText="暂无心智条目"
          />
        </div>
      ) : tab === 'tools' ? (
        <div className="_memory-detail-body">
          <ToolSourcePanel teamId={teamId} />
        </div>
      ) : tab === 'agentteams' ? (
        <div className="_memory-detail-body">
          <AgentTeamPanel teamId={teamId} />
        </div>
      ) : tab === 'automations' ? (
        <div className="_memory-detail-body">
          <AutomationPanel teamId={teamId} />
        </div>
      ) : tab === 'runs' ? (
        <div className="_memory-detail-body">
          <RunTracePanel teamId={teamId} />
        </div>
      ) : tab === 'approvals' ? (
        <div className="_memory-detail-body">
          <WriteApprovalPanel teamId={teamId} />
        </div>
      ) : (
        <div className="_memory-detail-body">
          <TeamManagementPanel
            currentUser={auth.user_id}
            instanceId={auth.instance_id}
            isAdmin={role === 'admin'}
            teamId={teamId}
            section={tab}
          />
        </div>
      )}
    </div>
  );
}

export default TeamDetailPage;