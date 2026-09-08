/**
 * ResourceFilterBar — 全局资源维度筛选器（团队 / 项目 / Agent / 用户）
 *
 * change: agent-collab-ui-redesign / 全局维度筛选
 * 挂在 ConsoleLayout 内容区顶部，对所有导航入口页面生效。
 * 每个维度是一个「多选下拉」，选项来自当前用户有权限的资源列表；
 * 多个维度可任意组合（AND）。骨架阶段只落地 UI + 多选状态，过滤逻辑待后续 change 接线。
 */
import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Dropdown } from 'tea-component';
import { ChevronDownIcon } from 'tea-icons-react';
import { useTeams, useAgents } from '@/services';
import { projectsApi } from '@/lib/api/projects';
import type { Project } from '@/lib/api/types';
import './resource-filter-bar.css';

type DimKey = 'team' | 'project' | 'agent' | 'user';

const DIMS: { key: DimKey; label: string }[] = [
  { key: 'team', label: '团队' },
  { key: 'project', label: '项目' },
  { key: 'agent', label: 'Agent' },
  { key: 'user', label: '用户' },
];

interface FilterOption {
  value: string;
  text: string;
}

function FilterDropdown(props: {
  label: string;
  count: number;
  options: FilterOption[];
  value: string[];
  onToggle: (value: string) => void;
}) {
  const { label, count, options, value, onToggle } = props;
  return (
    <Dropdown
      appearance="pure"
      className="_memory-filter-dropdown"
      boxClassName="_memory-filter-box"
      button={
        <button type="button" className="_memory-filter-trigger">
          <span className="_memory-filter-trigger-label">{label}</span>
          {count > 0 && <span className="_memory-filter-trigger-count">{count}</span>}
          <ChevronDownIcon size={12} className="_memory-filter-trigger-chevron" />
        </button>
      }
    >
      {() => (
        <div className="_memory-filter-panel">
          {options.length === 0 ? (
            <div className="_memory-filter-empty">暂无数据</div>
          ) : (
            options.map((opt) => (
              <label key={opt.value} className="_memory-filter-option">
                <Checkbox
                  value={value.includes(opt.value)}
                  onChange={() => onToggle(opt.value)}
                />
                <span className="_memory-filter-option-text">{opt.text}</span>
              </label>
            ))
          )}
        </div>
      )}
    </Dropdown>
  );
}

export function ResourceFilterBar() {
  const { teams, activeTeamId, activeTeam } = useTeams();
  const { agents } = useAgents(activeTeamId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filters, setFilters] = useState<Record<DimKey, string[]>>({
    team: [],
    project: [],
    agent: [],
    user: [],
  });

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const dimOptions: Record<DimKey, FilterOption[]> = useMemo(
    () => ({
      team: teams.map((tm) => ({ value: tm.team_id, text: tm.name })),
      project: projects.map((p) => ({ value: p.project_id, text: p.name })),
      agent: agents.map((a) => ({ value: a.agent_id, text: a.name })),
      user: (activeTeam?.members ?? []).map((m) => ({
        value: m.user_id,
        text: m.username ?? m.user_id,
      })),
    }),
    [teams, projects, agents, activeTeam]
  );

  function toggle(dim: DimKey, value: string) {
    setFilters((prev) => {
      const cur = prev[dim];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });
  }

  return (
    <div className="_memory-filter-bar">
      {DIMS.map((dim) => (
        <FilterDropdown
          key={dim.key}
          label={dim.label}
          count={filters[dim.key].length}
          options={dimOptions[dim.key]}
          value={filters[dim.key]}
          onToggle={(v) => toggle(dim.key, v)}
        />
      ))}
    </div>
  );
}

export default ResourceFilterBar;