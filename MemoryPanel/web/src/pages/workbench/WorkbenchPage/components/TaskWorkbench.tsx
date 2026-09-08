/**
 * TaskWorkbench — 用户工作台。
 *
 * 收敛到两件事：
 *   1. 列出/创建/管理本团队下的 task；
 *   2. 通过 log tab 看 task 历史记录。
 *
 * 布局：进入页面为全宽卡片网格；点击卡片拉出 Drawer，在抽屉内查看详情与设置
 * （改状态、编辑标题/描述、删除）。
 *
 * 数据走后端链路 A（services/backendStore.ts，内部调用 @/lib/teamApi 的 meta 接口）。
 *
 * 需求 4：团队 × 项目 × Agent × 用户 四维 AND 组合筛选（各下拉只列当前用户可见的选项）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Select, Text } from 'tea-component';
import {
  useTasks,
  useTeams,
  useAgents,
  createTask,
  deleteTask,
  updateTask,
  updateTaskStatus,
  canDeleteTask,
  canEditTask,
} from '@/services';
import { tea } from '@/lib/tea-bridge';
import { projectsApi } from '@/lib/api/projects';
import type { Project } from '@/lib/api/types';
import { TeamHeaderCard } from '@/components/team/TeamHeaderCard';
import TaskCreateDialog, { type TaskDraft } from './TaskCreateDialog';
import BoardView from '@/pages/WorkbenchPage/components/BoardView';
import { useTeamParticipation } from '@/pages/WorkbenchPage/hooks/useTeamParticipation';
import { errMsg, type WorkbenchTab } from './workbench-utils';
import './task-workbench.css';

function EmptyTeam() {
  const { t } = useTranslation();
  return (
    <Card>
      <Card.Body className="_memory-workbench-empty-card">
        <Text theme="strong" className="_memory-workbench-empty-title">{t('task.emptyTeam.title')}</Text>
        <Text theme="weak" className="_memory-workbench-empty-desc">
          {t('task.emptyTeam.desc')}
        </Text>
      </Card.Body>
    </Card>
  );
}

export default function TaskWorkbench(props: {
  tab?: WorkbenchTab;
  onTabChange?: (tab: WorkbenchTab) => void;
  /** 当前激活的 team id（可空：未选时只显示 empty state） */
  activeTeamId: string | null;
  /** 当前用户名（task 的 creator_user_id） */
  currentUser: string;
  /** 当前 team 下可关联的 Agent 列表（保留接口兼容，实际由 useAgents(effectiveTeamId) 提供） */
  agents?: Array<{ id: string; name: string }>;
  /** 是否为全局 admin（保留接口兼容；admin 不再有 task 特权） */
  isAdmin?: boolean;
}) {
  const { t } = useTranslation();
  const { activeTeamId, currentUser } = props;
  // 后端分页：useTasks 根据 page + pageSize 调 Panel 聚合接口，内核只返回当前页
  const PAGE_SIZE = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const { teams } = useTeams();

  // 四维 AND 筛选（空 = 不过滤）
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  const effectiveTeamId = selectedTeam || activeTeamId;
  const activeTeam = useMemo(
    () => teams.find((t) => t.team_id === effectiveTeamId) ?? null,
    [teams, effectiveTeamId],
  );
  // Agent 下拉跟随 effectiveTeamId（团队切换后 agent 列表也切到对应团队）
  const { agents: effectiveAgents } = useAgents(effectiveTeamId);
  const agentOptions = useMemo(
    () => effectiveAgents.map((a) => ({ id: a.agent_id, name: a.name })),
    [effectiveAgents],
  );

  const { tasks, total: tasksTotal, loading: tasksLoading } = useTasks(
    effectiveTeamId,
    currentPage,
    PAGE_SIZE,
    {
      agent_id: selectedAgent || undefined,
      project_id: selectedProject || undefined,
      creator_user_id: selectedOwner || undefined,
    },
  );
  const participationByTask = useTeamParticipation(effectiveTeamId);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  // 切换 team / 筛选时重置到第 1 页
  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveTeamId, selectedProject, selectedAgent, selectedOwner]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
  }, [tasks]);

  const selected = useMemo(
    () => (selectedId ? tasks.find((t) => t.task_id === selectedId) ?? null : null),
    [selectedId, tasks]
  );

  /**
   * 创建 task：team_id 完全由当前激活 team 决定，不再让 dialog 选 team
   * （切 team 的入口在团队列表页 /team）。
   */
  async function handleCreate(draft: TaskDraft) {
    // 谁点击「创建 Task」，谁就是 creator_user_id。
    const team = teams.find((t) => t.team_id === draft.team_id);
    if (!team) {
      tea.notify.error(`team "${draft.team_id}" ${t('task.emptyTeam.title')}`);
      return;
    }
    try {
      const task = await createTask({
        team_id: draft.team_id,
        creator_user_id: currentUser,
        title: draft.title,
        description: draft.description,
        source_type: draft.source_type,
        source_url: draft.source_url,
        linked_agents: draft.linked_agents
      });
      setSelectedId(task.task_id);
      setShowCreate(false);
    } catch (err) {
      tea.notify.error(errMsg(err));
    }
  }

  return (
    <div className="_memory-workbench-body">
      {/* 四维 AND 组合筛选：团队 / 项目 / Agent / 用户 */}
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
          options={agentOptions.map((a) => ({
            value: a.id,
            text: `${a.name}（${a.id}）`,
          }))}
        />
        <Select
          appearance="button"
          matchButtonWidth
          clearable
          value={selectedOwner || ''}
          onChange={(v) => setSelectedOwner(v)}
          placeholder="选择用户"
          options={(activeTeam?.members ?? []).map((m) => ({
            value: m.user_id,
            text: `${m.username ?? m.user_id}（${m.user_id}）`,
          }))}
        />
      </div>

      {!effectiveTeamId ? (
        <EmptyTeam />
      ) : (
        <>
          {/* 当前 team 概览（与 team 管理页同一组件） */}
          {activeTeam && <TeamHeaderCard team={activeTeam} />}
          {/* Task stats bar */}
          <div className="flex gap-4 mb-3 px-1">
            {[
              { label: 'Running', count: sortedTasks.filter(t => t.status === 'running').length, color: '#2563eb', bg: '#eff6ff' },
              { label: 'Completed', count: sortedTasks.filter(t => t.status === 'completed').length, color: '#10b981', bg: '#ecfdf5' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: bg }}>
                <span className="text-xl font-bold" style={{ color }}>{count}</span>
                <span className="text-gray-500 text-xs">{label}</span>
              </div>
            ))}
          </div>
          <BoardView
          tasks={sortedTasks}
          tasksLoading={tasksLoading}
          tasksTotal={tasksTotal}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={PAGE_SIZE}
          selected={selected}
          onSelect={(id) => setSelectedId(id)}
          onCreate={() => setShowCreate(true)}
          onDelete={async (task) => {
            // 权限：删除 task 仅创建者 / team admin / 全局 admin
            const team = teams.find((t) => t.team_id === task.team_id) ?? null;
            if (!canDeleteTask(task, team, currentUser)) {
              tea.notify.warning(
                t('task.delete.noPermission', { title: task.title, creator: task.creator_user_id })
              );
              return;
            }
            const ok = await tea.confirm({
              message: t('task.delete.confirm', { title: task.title }),
              description: t('task.delete.description', { id: task.task_id }),
              okText: t('task.delete.okText'),
              cancelText: t('task.delete.cancelText'),
            });
            if (ok) {
              try {
                await deleteTask(task.task_id);
                if (selectedId === task.task_id) setSelectedId(null);
              } catch (err) {
                tea.notify.error(errMsg(err));
              }
            }
          }}
          onUpdateStatus={async (task, status) => {
            // 权限：编辑 task（含切换 status）允许 team 内任意 member / admin
            const team = teams.find((t) => t.team_id === task.team_id) ?? null;
            if (!canEditTask(task, team, currentUser)) {
              tea.notify.warning(t('task.noPermissionEdit'));
              return;
            }
            try {
              await updateTaskStatus(task.task_id, status, currentUser);
            } catch (err) {
              tea.notify.error(errMsg(err));
            }
          }}
          onUpdateTask={async (task, patch) => {
            const team = teams.find((t) => t.team_id === task.team_id) ?? null;
            if (!canEditTask(task, team, currentUser)) {
              tea.notify.warning(t('task.noPermissionEdit'));
              return;
            }
            try {
              await updateTask(task.task_id, patch, currentUser);
            } catch (err) {
              tea.notify.error(errMsg(err));
            }
          }}
          agents={agentOptions}
          teams={teams}
          currentUser={currentUser}
          participationByTask={participationByTask}
          />
        </>
      )}

      {showCreate && activeTeam && (
        // team 由当前激活 team 决定（在团队列表页 /team 切换），dialog 里不再让用户选；
        // 这里 activeTeam 必为非空，因为上面 !effectiveTeamId 分支已经走 EmptyTeam 了
        <TaskCreateDialog
          team={{ team_id: activeTeam.team_id, name: activeTeam.name }}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
