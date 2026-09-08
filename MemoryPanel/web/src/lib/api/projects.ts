/**
 * api/projects.ts — Project + ProjectMember（meta/project/* + meta/project-member/*）。
 * 协作轴（与 team 正交）：project.members 可跨 team。M4 前端 project 页数据层。
 */
import { metaPost, metaListAll, getCurrentUser } from './base';
import type { Project, ProjectMember } from './types';

export const projectsApi = {
  /** 列出当前用户可访问（member ∪ 所属 team 公共）的 project。 */
  list: async () => {
    const me = await getCurrentUser();
    return metaListAll<Project>('project/list', { member_user_id: me.user_id });
  },

  /** project 详情 */
  get: (projectId: string) => metaPost<Project>('project/get', { project_id: projectId }),

  /** 创建 project（owner = 当前用户，create 自动把 owner 加为 manager 成员）。 */
  create: async (data: {
    teamId: string;
    name: string;
    description?: string;
    visibility?: 'private' | 'team' | 'restricted';
    repoUrl?: string;
    gitRepoUrls?: string[];
    pathGlobs?: string[];
  }) => {
    const me = await getCurrentUser();
    return metaPost<Project>('project/create', {
      team_id: data.teamId,
      name: data.name,
      description: data.description,
      owner_user_id: me.user_id,
      visibility: data.visibility ?? 'private',
      repo_url: data.repoUrl,
      git_repo_urls: data.gitRepoUrls,
      path_globs: data.pathGlobs,
    });
  },

  /** 更新 project（改名 / 描述 / 锚定信号 / 默认 agent）。 */
  update: (
    projectId: string,
    data: Partial<{
      name: string;
      description: string;
      visibility: 'private' | 'team' | 'restricted';
      default_agent_id: string;
      repo_url: string;
      git_repo_urls: string[];
      path_globs: string[];
    }>,
  ) => metaPost<Project>('project/update', { project_id: projectId, ...data }),

  /** 删除 project。 */
  delete: (projectId: string) =>
    metaPost<{ deleted: number; missing: string[] }>('project/delete', { project_ids: [projectId] }),

  /** 设置 project.manager（owner/system_admin 专属）。schema: { project_id, user_id }。 */
  setManager: (projectId: string, managerUserId: string) =>
    metaPost<Project>('project/set-manager', { project_id: projectId, user_id: managerUserId }),
};

export const projectMembersApi = {
  list: (projectId: string) =>
    metaListAll<ProjectMember>('project-member/list', { project_id: projectId }),

  add: (projectId: string, data: { user_id: string; role?: 'member' | 'manager' }) =>
    metaPost<ProjectMember>('project-member/add', {
      project_id: projectId,
      user_id: data.user_id,
      role: data.role ?? 'member',
    }),

  remove: (projectId: string, userId: string) =>
    metaPost<{ ok: boolean }>('project-member/remove', { project_id: projectId, user_id: userId }),
};