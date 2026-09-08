/**
 * 菜单元数据 — 从 App.tsx 抽出
 *
 * 包含页面 ID 类型、页面元信息、分组排序、分组图标。
 * Sidebar / TabBar / 路由等模块共用。
 *
 * change: agent-collab-ui-redesign / T01
 * 导航信息架构：4 组（workbench/organization/assets/analysis）
 * → 5 组（workbench/projects/team/memory_spaces/assets）+ __hidden__。
 */
import { useTranslation } from 'react-i18next';
import {
  DashboardIcon,
  UserIcon,
  UsergroupIcon,
  LockOnIcon,
  BooksIcon,
  CodeIcon,
  RelativityIcon,
  SearchIcon,
  ToolsIcon,
  ChatIcon,
  LayersIcon,
} from 'tea-icons-react';

export type PageId =
  | 'workbench_board'
  | 'projects'
  | 'project_detail'
  | 'team'
  | 'team_members'
  | 'team_agents'
  | 'agent_detail'
  | 'memory_spaces'
  | 'chat_memory'
  | 'wiki'
  | 'code'
  | 'analysis'
  | 'skills'
  | 'api_keys'
  | 'user_management'
  | 'model_config'
  | 'permissions'
  | 'audit_log';

/** 页面元数据 */
export interface PageMeta {
  id: PageId;
  label: string;
  desc?: string;
  /** 所属分组，用于侧边栏菜单分组标题 */
  group: string;
  /** 分组内排序，越小越靠前 */
  order: number;
  /** 固定标签页不可关闭（工作台看板） */
  affix?: boolean;
}

// 使用 useTranslation 的 hook 版本
export function usePageMeta(): Record<PageId, PageMeta> {
  const { t } = useTranslation();
  return {
    workbench_board: { id: 'workbench_board', label: t('menu.workbench_board'), desc: t('menu.desc.workbench_board'), group: t('menu.group.workbench'), order: 0, affix: true },
    // 协作项目
    projects:        { id: 'projects',        label: t('menu.projects'), desc: t('menu.desc.projects'), group: t('menu.group.projects'), order: 0 },
    // 团队（一级模块：团队列表 → 下探成员/Agent）
    team:            { id: 'team',            label: t('menu.team'), desc: t('menu.desc.team'), group: t('menu.group.team'), order: 0 },
    team_members:    { id: 'team_members',    label: t('menu.team_members'), desc: t('menu.desc.team_members'), group: '__hidden__', order: 0 },
    team_agents:     { id: 'team_agents',     label: t('menu.team_agents'), desc: t('menu.desc.team_agents'), group: '__hidden__', order: 1 },
    // 记忆空间
    memory_spaces:   { id: 'memory_spaces',   label: t('menu.memory_spaces'), desc: t('menu.desc.memory_spaces'), group: t('menu.group.memory_spaces'), order: 0 },
    chat_memory:     { id: 'chat_memory',     label: t('menu.chat_memory'), desc: t('menu.desc.chat_memory'), group: t('menu.group.memory_spaces'), order: 1 },
    // 资产
    wiki:            { id: 'wiki',            label: t('menu.wiki'), desc: t('menu.desc.wiki'), group: t('menu.group.assets'), order: 0 },
    code:            { id: 'code',            label: t('menu.code'), desc: t('menu.desc.code'), group: t('menu.group.assets'), order: 1 },
    // 代码分析（单一入口：仓库管理壳，点进仓库含代码分析 + 代码图谱）
    analysis:        { id: 'analysis',        label: t('menu.analysis'), desc: t('menu.desc.analysis'), group: t('menu.group.assets'), order: 2 },
    skills:          { id: 'skills',          label: t('menu.skills'), desc: t('menu.desc.skills'), group: t('menu.group.assets'), order: 3 },
    // 详情页不做侧边栏菜单项（由列表页进入，复用列表页 TabBar 高亮），保留 PageId 供未来独立标签用
    project_detail:  { id: 'project_detail',  label: t('menu.project_detail'), desc: t('menu.desc.project_detail'), group: '__hidden__', order: 3 },
    agent_detail:    { id: 'agent_detail',    label: t('menu.agent_detail'), desc: t('menu.desc.agent_detail'), group: '__hidden__', order: 4 },
    // api_keys / user_management / model_config 不在侧边栏渲染，但保留 PageId 用于
    // PATH_TO_PAGE 映射和 TabBar 活跃页高亮。入口在 GlobalHeader 用户下拉菜单。
    api_keys:        { id: 'api_keys',        label: t('menu.api_keys'), desc: t('menu.desc.api_keys'), group: '__hidden__', order: 0 },
    user_management: { id: 'user_management',  label: t('menu.user_management'), desc: t('menu.desc.user_management'), group: '__hidden__', order: 1 },
    model_config:    { id: 'model_config',    label: t('menu.model_config'), desc: t('menu.desc.model_config'), group: '__hidden__', order: 2 },
    permissions:     { id: 'permissions',     label: t('menu.permissions'), desc: t('menu.desc.permissions'), group: '__hidden__', order: 3 },
    audit_log:       { id: 'audit_log',       label: t('menu.audit_log'), desc: t('menu.desc.audit_log'), group: '__hidden__', order: 4 },
  };
}

/** 分组排序顺序（侧边栏渲染顺序；__hidden__ 组不参与） */
export const GROUP_ORDER_KEYS = ['workbench', 'projects', 'team', 'memory_spaces', 'assets'] as const;

/** 每个页面在侧边栏菜单中的图标（Tea 官方图标，size 16） */
export const ITEM_ICON: Record<PageId, JSX.Element> = {
  workbench_board: <DashboardIcon size={16} />,
  projects: <RelativityIcon size={16} />,
  project_detail: <RelativityIcon size={16} />,
  team: <UsergroupIcon size={16} />,
  team_members: <UserIcon size={16} />,
  team_agents: <UsergroupIcon size={16} />,
  agent_detail: <UsergroupIcon size={16} />,
  memory_spaces: <LayersIcon size={16} />,
  chat_memory: <ChatIcon size={16} />,
  wiki: <BooksIcon size={16} />,
  code: <CodeIcon size={16} />,
  analysis: <SearchIcon size={16} />,
  skills: <ToolsIcon size={16} />,
  api_keys: <LockOnIcon size={16} />,
  user_management: <UserIcon size={16} />,
  model_config: <RelativityIcon size={16} />,
  permissions: <LockOnIcon size={16} />,
  audit_log: <SearchIcon size={16} />,
};

/** 分组图标（工作台 / 协作项目 / 团队 / 记忆空间 / 资产） */
export const GROUP_ICON: Record<string, JSX.Element> = {
  workbench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  projects: <RelativityIcon size={16} />,
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  memory_spaces: <LayersIcon size={16} />,
  assets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </svg>
  ),
};