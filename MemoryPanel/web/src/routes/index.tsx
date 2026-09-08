/**
 * 路由表定义
 *
 * 使用 react-router 的 createHashRouter / RouterProvider。
 * ConsoleLayout 作为父路由，各页面作为子路由。
 */
import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ConsoleLayout } from '@/layouts/ConsoleLayout';
import { WorkbenchPage } from '@/pages/workbench/WorkbenchPage';
import { WikiPage } from '@/pages/wiki/WikiPage';
import { CodePage } from '@/pages/code/CodePage';
import { AnalysisShellPage } from '@/pages/codeanalysis/AnalysisShellPage';
import { CodeAnalysisRepoPage } from '@/pages/codeanalysis/CodeAnalysisRepoPage';
import { SkillsPage } from '@/pages/skills/SkillsPage';
import { ChatMemoryPage } from '@/pages/memory/ChatMemoryPage';
import { ProjectsPage } from '@/pages/projects';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { TeamListPage } from '@/pages/team/TeamListPage';
import { TeamDetailPage } from '@/pages/team/TeamDetailPage';
import { AgentDetailPage } from '@/pages/team/AgentDetailPage';
import { ApiKeysPage } from '@/pages/team/ApiKeysPage';
import { MemorySpacesPage } from '@/pages/memory-space/MemorySpacesPage';
import { MemorySpaceDetailPage } from '@/pages/memory-space/MemorySpaceDetailPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import ModelConfigPage from '@/pages/admin/ModelConfigPage';
import PermissionManagementPage from '@/pages/admin/PermissionManagementPage';
import AuditLogPage from '@/pages/admin/AuditLogPage';
import { AdminOnlyGuard } from '@/components/RouteGuards';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <WorkbenchPage /> },
      { path: 'wiki', element: <WikiPage /> },
      { path: 'code', element: <CodePage /> },
      // 代码分析「壳」：仓库管理列表 + 上传
      { path: 'analysis', element: <AnalysisShellPage /> },
      // 单仓库详情：代码分析 + 代码图谱 tabs
      { path: 'analysis/:cgId', element: <CodeAnalysisRepoPage /> },
      // 旧 /graph 入口重定向到代码分析壳（兼容历史链接）
      { path: 'graph', element: <Navigate to="/analysis" replace /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'memory', element: <ChatMemoryPage /> },
      // 记忆空间（独立模块：列表 + 详情）
      { path: 'memory-spaces', element: <MemorySpacesPage /> },
      { path: 'memory-spaces/:spaceId', element: <MemorySpaceDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'team', element: <TeamListPage /> },
      { path: 'team/:teamId', element: <TeamDetailPage /> },
      // 旧平铺入口重定向到团队列表（下探入口），兼容历史链接
      { path: 'team/members', element: <Navigate to="/team" replace /> },
      { path: 'team/agents', element: <Navigate to="/team" replace /> },
      { path: 'team/agents/:id', element: <AgentDetailPage /> },
      { path: 'team/api-keys', element: <ApiKeysPage /> },
      { path: 'admin/users', element: <UserManagementPage /> },
      { path: 'admin/model-config', element: <AdminOnlyGuard><ModelConfigPage /></AdminOnlyGuard> },
      { path: 'admin/permissions', element: <AdminOnlyGuard><PermissionManagementPage /></AdminOnlyGuard> },
      { path: 'admin/audit-log', element: <AdminOnlyGuard><AuditLogPage /></AdminOnlyGuard> },
    ],
  },
];

/**
 * 使用 HashRouter — 保持与旧版 hash 路由兼容，
 * 避免刷新 404（静态部署不需要服务端 fallback 配置）。
 */
export const router = createHashRouter(routes);