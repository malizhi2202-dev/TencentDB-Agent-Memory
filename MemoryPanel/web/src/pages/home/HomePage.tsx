/**
 * HomePage — 资源总览（登录后首页）。
 *
 * 需求：用户进入后，首先看到「他有权限查看的各个资源实体」，而不是某个单一模块。
 * 数据源都走后端已做权限过滤的 list 接口：
 *   - 组织（团队）：teamsApi.list()          → 所属 / admin 全量
 *   - 项目：projectsApi.list()               → member ∪ 可见
 *   - 资产：assetsApi.listAccessible(team)    → visibility × role × ACL × owner
 *   - Agent / 任务：按所属组织聚合
 * 每类实体给出数量与最近几条，点击跳转到对应模块。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatusTip, Tag, Text } from 'tea-component';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useTeams } from '@/services';
import { projectsApi } from '@/lib/api/projects';
import { assetsApi } from '@/lib/api/assets';
import { agentsApi } from '@/lib/api/agents';
import { tasksApi } from '@/lib/api/tasks';
import type { Asset, Project } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';
import './home-page.css';

const ASSET_TYPE_META: Record<Asset['asset_type'], { label: string; path: string }> = {
  llm_wiki: { label: 'Wiki', path: '/wiki' },
  code_graph: { label: 'Code', path: '/code' },
  skill: { label: 'Skill', path: '/skills' },
  chat_memory: { label: 'Memory', path: '/memory' },
};

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth } = useAuthStore();
  const { teams, loading: teamsLoading } = useTeams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teams.length) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [projs] = await Promise.all([
          projectsApi.list().catch(() => [] as Project[]),
        ]);
        // 资产按所属组织聚合（asset/list-accessible 按 team 过滤）
        const assetPages = await Promise.all(
          teams.map((tm) => assetsApi.listAccessible(tm.team_id).catch(() => [] as Asset[])),
        );
        const agentCounts = await Promise.all(
          teams.map((tm) => agentsApi.list(tm.team_id).then((a) => a.length).catch(() => 0)),
        );
        const taskCounts = await Promise.all(
          teams.map((tm) => tasksApi.list(tm.team_id).then((a) => a.length).catch(() => 0)),
        );
        if (cancelled) return;
        setProjects(projs);
        setAssets(assetPages.flat());
        setAgentCount(agentCounts.reduce((s, n) => s + n, 0));
        setTaskCount(taskCounts.reduce((s, n) => s + n, 0));
      } catch (e) {
        if (!cancelled) tea.notify.error(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teams]);

  const orgCount = teams.length;

  if (!auth) return null;

  return (
    <div className="_memory-home-page">
      <div className="_memory-detail-head">
        <h3 style={{ margin: 0 }}>{t('home.title')}</h3>
        <span style={{ fontSize: 12, color: 'var(--tea-color-text-tertiary)' }}>
          {t('home.subtitle', { name: auth.user })}
        </span>
      </div>

      {teamsLoading || loading ? (
        <StatusTip status="loading" />
      ) : (
        <>
          {/* 统计 */}
          <div className="_memory-home-stats">
            <StatCard label={t('home.stat.orgs')} value={orgCount} onClick={() => navigate('/team')} />
            <StatCard label={t('home.stat.projects')} value={projects.length} onClick={() => navigate('/projects')} />
            <StatCard label={t('home.stat.assets')} value={assets.length} onClick={() => navigate('/wiki')} />
            <StatCard label={t('home.stat.agents')} value={agentCount} onClick={() => navigate('/team')} />
            <StatCard label={t('home.stat.tasks')} value={taskCount} onClick={() => navigate('/workbench')} />
          </div>

          {/* 实体分组 */}
          <Section
            title={t('home.section.orgs')}
            count={orgCount}
            empty={t('home.empty.orgs')}
            onMore={() => navigate('/team')}
          >
            {teams.slice(0, 6).map((tm) => (
              <EntityRow
                key={tm.team_id}
                icon={<span className="_memory-home-dot" />}
                title={tm.name}
                sub={`${tm.team_id} · ${t('home.orgMembers', { n: tm.members.length })}`}
                onClick={() => navigate(`/team/${tm.team_id}`)}
              />
            ))}
          </Section>

          <Section
            title={t('home.section.projects')}
            count={projects.length}
            empty={t('home.empty.projects')}
            onMore={() => navigate('/projects')}
          >
            {projects.slice(0, 6).map((p) => (
              <EntityRow
                key={p.project_id}
                icon={<span className="_memory-home-dot _memory-home-dot--project" />}
                title={p.name}
                sub={p.project_id}
                onClick={() => navigate(`/projects/${p.project_id}`)}
              />
            ))}
          </Section>

          <Section
            title={t('home.section.assets')}
            count={assets.length}
            empty={t('home.empty.assets')}
            onMore={() => navigate('/wiki')}
          >
            {assets.slice(0, 8).map((a) => (
              <EntityRow
                key={a.asset_id}
                icon={<span className="_memory-home-dot _memory-home-dot--asset" />}
                title={a.name}
                tag={ASSET_TYPE_META[a.asset_type]?.label ?? a.asset_type}
                sub={a.asset_id}
                onClick={() => navigate(ASSET_TYPE_META[a.asset_type]?.path ?? '/wiki')}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <div className="_memory-home-stat" onClick={onClick} role="button" tabIndex={0}>
      <div className="_memory-home-stat-value">{value}</div>
      <div className="_memory-home-stat-label">{label}</div>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  onMore,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  onMore: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <Card.Body>
        <div className="_memory-home-section-head">
          <Text theme="strong">
            {title} <Text theme="label">（{count}）</Text>
          </Text>
          <a className="_memory-home-more" onClick={onMore}>
            {count > 0 ? '查看全部 →' : ''}
          </a>
        </div>
        <div className="_memory-home-section-body">
          {count === 0 ? <Text theme="label">{empty}</Text> : children}
        </div>
      </Card.Body>
    </Card>
  );
}

function EntityRow({
  icon,
  title,
  tag,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  tag?: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <div className="_memory-home-entity" onClick={onClick} role="button" tabIndex={0}>
      {icon}
      <div className="_memory-home-entity-main">
        <div className="_memory-home-entity-title">
          <Text>{title}</Text>
          {tag && (
            <Tag theme="primary" style={{ marginLeft: 8 }}>
              {tag}
            </Tag>
          )}
        </div>
        <div className="_memory-home-entity-sub">
          <Text theme="label" style={{ fontSize: 12 }}>
            {sub}
          </Text>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
