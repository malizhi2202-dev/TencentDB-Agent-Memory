/**
 * TeamListPage — 团队列表（团队一级模块首页）
 *
 * change: agent-collab-ui-redesign / 团队模块下探
 * 排列所有团队，点击切换并下探到团队详情（成员管理 + Agent 管理）。
 * 当前团队高亮；admin 可新建团队。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, StatusTip, Tag } from 'tea-component';
import { AddIcon, DeleteIcon } from 'tea-icons-react';
import { useTranslation } from 'react-i18next';
import { useTeams, writeActiveTeamId, invalidateBackendCache } from '@/services';
import { useAuthStore } from '@/stores/auth';
import { useCurrentRole } from '@/services/useCurrentRole';
import { useBackendStore } from '@/stores/backend';
import { teamsApi } from '@/lib/teamApi';
import { getErrorMessage } from '@/lib/error-message';
import { tea } from '@/lib/tea-bridge';
import { teamColor } from '@/utils/color';
import CreateTeamDialog from '@/components/team/CreateTeamDialog';
import './team-list.css';

export function TeamListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { teams, activeTeamId, loading } = useTeams();
  const { auth } = useAuthStore();
  const role = useCurrentRole();
  const refreshTeams = useBackendStore((s) => s.refreshTeams);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!auth) return null;

  const currentUserId = auth.user_id;
  const isGlobalAdmin = auth.isAdmin;

  function enter(teamId: string) {
    // 只下探到组织详情，不改全局 activeTeamId（进入组织不影响其他模块的选中范围）
    navigate(`/team/${teamId}`);
  }

  async function handleDelete(teamId: string, name: string, ownerUserId: string) {
    // 权限：仅全局 admin 或团队 owner 可删除团队（与后端 team/delete 的 assertCallerIsTeamOwnerOrAdmin 对齐）
    if (!isGlobalAdmin && ownerUserId !== currentUserId) {
      tea.notify.warning(t('team.deleteTeam.noPermission'));
      return;
    }
    const ok = await tea.confirm({
      message: t('team.deleteTeam.confirm', { name }),
      description: t('team.deleteTeam.desc', { id: teamId }),
    });
    if (!ok) return;
    try {
      await teamsApi.delete(teamId);
      tea.notify.success(t('team.deleteTeam.success', { name }));
      if (teamId === activeTeamId) {
        const rest = teams.filter((tm) => tm.team_id !== teamId);
        writeActiveTeamId(rest[0]?.team_id ?? null);
      }
      await refreshTeams();
    } catch (err) {
      tea.notify.error(getErrorMessage(err));
    }
  }

  async function handleCreate(input: { name: string; description: string }) {
    setBusy(true);
    try {
      const created = await teamsApi.create(input);
      invalidateBackendCache();
      await refreshTeams();
      setShowCreate(false);
      navigate(`/team/${created.team_id}`);
    } catch (err) {
      tea.notify.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <h3 style={{ margin: 0 }}>{t('menu.team')}</h3>
        <span style={{ fontSize: 12, color: 'var(--tea-color-text-tertiary)' }}>
          {t('teamSwitcher.teamCount', { count: teams.length })}
        </span>
        {role === 'admin' && (
          <Button style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>
            <AddIcon size={14} /> {t('teamSwitcher.newTeam')}
          </Button>
        )}
      </div>

      {loading ? (
        <StatusTip status="loading" />
      ) : teams.length === 0 ? (
        <Card>
          <Card.Body>
            <StatusTip status="empty" emptyText={t('teamSwitcher.empty.member')} />
          </Card.Body>
        </Card>
      ) : (
        <div className="_memory-team-list-grid">
          {teams.map((tm) => {
            const isActive = tm.team_id === activeTeamId;
            return (
              <div
                key={tm.team_id}
                data-guide="team-card"
                className={`_memory-team-card${isActive ? ' _memory-team-card--active' : ''}`}
                onClick={() => enter(tm.team_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    enter(tm.team_id);
                  }
                }}
              >
                <div className="_memory-team-card-head">
                  <span className={`_memory-team-card-avatar ${teamColor(tm.team_id)}`}>
                    {tm.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="_memory-team-card-name">{tm.name}</span>
                  {isActive && <Tag theme="primary">当前</Tag>}
                  {(isGlobalAdmin || tm.owner_user_id === currentUserId) && (
                    <Button
                      type="icon"
                      className="_memory-team-card-delete"
                      title={t('team.deleteTeam.tooltip')}
                      onClick={(e) => {
                        e?.stopPropagation();
                        void handleDelete(tm.team_id, tm.name, tm.owner_user_id);
                      }}
                    >
                      <DeleteIcon size={16} />
                    </Button>
                  )}
                </div>
                <div className="_memory-team-card-desc">
                  {tm.description || '—'}
                </div>
                <div className="_memory-team-card-foot">
                  {t('teamSwitcher.memberCount', { count: tm.members.length })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTeamDialog
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          busy={busy}
        />
      )}
    </div>
  );
}

export default TeamListPage;