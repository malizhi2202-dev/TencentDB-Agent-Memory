/**
 * ProjectsPage — 协作项目列表。
 *
 * change: agent-collab-ui-redesign / 导航信息架构
 *   - 列出当前用户可访问的 project（member ∪ 所属 team 公共）。
 *   - 新建 project（归属 team + 可选 repo/path 锚定信号）。
 *   - 点击某个 project → 下探到「项目详情」（成员 / 资产等落在详情页）。
 *
 * 权限口径与后端一致：
 *   - 新建 team 公共 project（visibility=team）仅 system_admin 可选，普通用户默认 private。
 *
 * 数据层走 @/lib/api/projects.ts（meta/project/*）。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Select, Tag, StatusTip } from 'tea-component';
import { AddIcon, DeleteIcon, UsergroupIcon } from 'tea-icons-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { projectsApi } from '@/lib/api/projects';
import { teamsApi } from '@/lib/api/teams';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';
import type { Project, Team } from '@/lib/api/types';

function errMsg(e: unknown): string {
  return getErrorMessage(e);
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [pathGlobs, setPathGlobs] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'team' | 'restricted'>('private');

  const isSysAdmin = auth?.isAdmin === true;
  const currentUserId = auth?.user_id ?? '';

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await projectsApi.list());
    } catch (e) {
      tea.notify.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      setTeams(await teamsApi.list());
    } catch {
      /* teams 加载失败不阻塞 project 列表 */
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadTeams();
  }, [loadProjects, loadTeams]);

  const handleCreate = async () => {
    if (!name.trim() || !teamId) {
      tea.notify.error(t('projects.create.needNameAndTeam'));
      return;
    }
    setCreating(true);
    try {
      await projectsApi.create({
        teamId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        repoUrl: repoUrl.trim() || undefined,
        pathGlobs: pathGlobs.trim() ? pathGlobs.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : undefined,
      });
      tea.notify.success(t('projects.create.ok'));
      setName(''); setDescription(''); setRepoUrl(''); setPathGlobs(''); setVisibility('private');
      await loadProjects();
    } catch (e) {
      tea.notify.error(errMsg(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    const ok = await tea.confirm({ message: t('projects.delete.confirm') });
    if (!ok) return;
    try {
      await projectsApi.delete(projectId);
      tea.notify.success(t('projects.delete.ok'));
      await loadProjects();
    } catch (e) {
      tea.notify.error(errMsg(e));
    }
  };

  if (!auth) return null;

  const visibilityOptions = [
    { value: 'private', text: t('projects.visibility.private') },
    // team 公共 project：仅 system_admin 可选（对齐 R2「建公共=admin」）
    ...(isSysAdmin ? [{ value: 'team', text: t('projects.visibility.team') }] : []),
    { value: 'restricted', text: t('projects.visibility.restricted') },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部：新建 project */}
      <Card>
        <Card.Body title={t('projects.create.title')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input value={name} onChange={setName} placeholder={t('projects.create.name')} style={{ width: 200 }} />
            <Select
              value={teamId}
              onChange={setTeamId}
              placeholder={t('projects.create.team')}
              style={{ width: 200 }}
              options={teams.map((tm) => ({ value: tm.team_id, text: tm.name }))}
            />
            <Select
              value={visibility}
              onChange={(v) => setVisibility(v as 'private' | 'team' | 'restricted')}
              style={{ width: 160 }}
              options={visibilityOptions}
            />
            <Input value={repoUrl} onChange={setRepoUrl} placeholder={t('projects.create.repoUrl')} style={{ width: 240 }} />
            <Input value={pathGlobs} onChange={setPathGlobs} placeholder={t('projects.create.pathGlobs')} style={{ width: 240 }} />
            <Button type="primary" loading={creating} onClick={handleCreate}>
              <AddIcon size={14} /> {t('projects.create.submit')}
            </Button>
          </div>
          <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>{t('projects.create.hint')}</div>
        </Card.Body>
      </Card>

      {/* project 列表：点击下探到项目详情 */}
      <Card>
        <Card.Body title={t('projects.list.title')}>
          {loading ? (
            <StatusTip status="loading" />
          ) : projects.length === 0 ? (
            <StatusTip status="empty" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map((p) => (
                <div
                  key={p.project_id}
                  onClick={() => navigate(`/projects/${p.project_id}`)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: '#f5f7fa',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UsergroupIcon size={16} />
                    <strong>{p.name}</strong>
                    <Tag theme={p.visibility === 'team' ? 'success' : 'default'}>
                      {p.visibility === 'team' ? t('projects.visibility.team') : p.visibility === 'restricted' ? t('projects.visibility.restricted') : t('projects.visibility.private')}
                    </Tag>
                    {p.repo_url ? <span style={{ color: '#666', fontSize: 12 }}>{p.repo_url}</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#999', fontSize: 12 }}>{p.project_id}</span>
                    {(isSysAdmin || p.owner_user_id === currentUserId) && (
                      <Button type="weak" onClick={(e) => { e?.stopPropagation(); void handleDelete(p.project_id); }}>
                        <DeleteIcon size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default ProjectsPage;
