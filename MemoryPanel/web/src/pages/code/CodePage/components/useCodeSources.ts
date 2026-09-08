/**
 * useCodeSources —— Code 资产页的全部状态与数据逻辑。
 * 组件层只保留 JSX 渲染，状态 / 数据逻辑集中在此。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { knowledgeApi, type CodeGraphDetail, type GraphData, type ProjectAnalysis } from '@/lib/knowledge-api';
import { useTeams, useAgents } from '@/services';
import { readAuth } from '@/components/LoginGate';
import { tea } from '@/lib/tea-bridge';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { getPanelSession } from '@/lib/panelSession';
import type { Project, PublicUser } from '@/lib/api/types';
import { isValidGitHttpUrl, formatRepoName, type ScopeTab, type StatusFilter, type SubView, type ViewMode } from './code-constants';

export function useCodeSources() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<CodeGraphDetail[]>([]);
  const [loading, setLoading] = useState(false);
  // 默认展示 Agent 资产，避免用户误以为自己的资产在「团队资产」里
  const [scopeTab, setScopeTab] = useState<ScopeTab>('agent');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [inFlight, setInFlight] = useState<CodeGraphDetail[]>([]);

  // Detail view state
  const [subView, setSubView] = useState<SubView>('list');
  const [selectedCgId, setSelectedCgId] = useState('');

  // Register dialog state
  const [showRegister, setShowRegister] = useState(false);
  const [formRepo, setFormRepo] = useState('');
  const [formBranch, setFormBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);

  // Allocate-to-agent dialog state
  const [allocateTarget, setAllocateTarget] = useState<{
    cgId: string;
    repo: string;
    branch: string;
  } | null>(null);
  const [selectedCodeAsset, setSelectedCodeAsset] = useState<{
    cgId: string;
    repo: string;
    branch: string;
  } | null>(null);
  const { activeTeamId, activeTeam } = useTeams();
  const auth = readAuth();
  const currentUser = auth?.user_id ?? '';
  const myUser = getPanelSession()?.user;
  const myUserId = myUser?.user_id ?? '';
  const isAdmin = myUser?.user_type === 'system_admin';
  // Agent 维度 tab 只列自己 owner 的 agent（与 ChatMemory / Skills 面板一致，
  // 也符合文档 §4.2 权限规则：agent-fixed 只允许查看 caller 自己 owner 的 agent）。
  const { agents: allAgents } = useAgents(activeTeamId);
  const teamAgents = useMemo(
    () =>
      allAgents
        .filter((a) => a.owner_user_id === currentUser)
        .map((a) => ({ id: a.agent_id, name: a.name })),
    [allAgents, currentUser],
  );
  // Agent 维度（agent tab）下选中的 agent_id
  const [agentFilter, setAgentFilter] = useState<string>('');
  // project 维度（project tab）：协作轴切换。
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  // user 维度（user tab）：admin 可选看「任意用户」的资产；空 = 自己。
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);

  useEffect(() => {
    if (teamAgents.length === 0) {
      setAgentFilter('');
      return;
    }
    if (!agentFilter || !teamAgents.some((a) => a.id === agentFilter)) {
      setAgentFilter(teamAgents[0].id);
    }
  }, [teamAgents, agentFilter]);

  // project 维度：拉取当前用户可访问的 project，供 project tab 选择器使用。
  useEffect(() => {
    let cancelled = false;
    projectsApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        if (!selectedProject && list.length > 0) setSelectedProject(list[0].project_id);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // admin 用户维度：拉取实例级全量用户，供 user tab 的「按用户切换」选择器使用。
  useEffect(() => {
    if (!isAdmin) {
      setAllUsers([]);
      return;
    }
    let cancelled = false;
    usersApi
      .list()
      .then((users) => {
        if (!cancelled) setAllUsers(users);
      })
      .catch(() => {
        if (!cancelled) setAllUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const displaySources = useMemo(() => {
    // team tab 下合并 inFlight（刚注册的仓库还在构建中，列表里先占位显示）
    if (scopeTab === 'team') {
      const ids = new Set(sources.map((s) => s.code_graph_id));
      const extras = inFlight.filter((x) => x.code_graph_id && !ids.has(x.code_graph_id));
      return [...extras, ...sources];
    }
    return sources;
  }, [sources, inFlight, scopeTab]);

  const scopeSources = useMemo(() => {
    // 数据源已按维度在 fetchSources 中过滤（agent 维度直接用 listByAgent），无需再前端过滤。
    // team 维度额外合并 inFlight（刚注册、仍在构建图谱的仓库先占位显示）。
    if (scopeTab === 'team') return displaySources;
    return sources;
  }, [displaySources, sources, scopeTab]);

  // 统计只跟随当前资产范围，避免搜索或状态筛选让概览数据失真。
  const stats = useMemo(
    () => ({
      total: scopeSources.length,
      ready: scopeSources.filter((source) => source.status === 'ready').length,
      processing: scopeSources.filter(
        (source) => source.status === 'pending' || source.status === 'processing',
      ).length,
      totalFiles: scopeSources.reduce((total, source) => total + (source.stats?.files ?? 0), 0),
    }),
    [scopeSources],
  );

  const filteredSources = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return scopeSources.filter((source) => {
      const isProcessing = source.status === 'pending' || source.status === 'processing';
      const isError = source.status === 'failed' || source.status === 'missing';
      if (statusFilter === 'ready' && source.status !== 'ready') return false;
      if (statusFilter === 'processing' && !isProcessing) return false;
      if (statusFilter === 'error' && !isError) return false;
      if (!normalizedKeyword) return true;
      return [
        source.repo_name,
        source.repo_url,
        source.branch,
        source.code_graph_id,
        source.owner_user_id ?? '',
        source.commit_hash ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [scopeSources, keyword, statusFilter]);

  // Detail: search & explore
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState('');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploring, setExploring] = useState(false);
  const [exploreResult, setExploreResult] = useState('');

  // Graph state
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Analyze state
  const [analyzeData, setAnalyzeData] = useState<ProjectAnalysis | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  // 请求序号防竞态：快速切换 tab 时，先发的请求可能后返回，
  // 旧 tab 的数据会覆盖新 tab 的数据。每次 fetch 递增序号，
  // 响应回来时校验序号是否仍是最新，不是就丢弃。
  const fetchSeqRef = useRef(0);

  const fetchSources = useCallback(async () => {
    if (!activeTeamId) {
      setSources([]);
      setLoading(false);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    // 立即清空旧数据 —— 否则切 tab 时会先看到上一个 tab 的列表，
    // 新数据到了才突然替换，视觉上就是"闪一下"。
    setSources([]);
    try {
      // 数据源已按维度在服务端过滤：
      //   team    → 团队 Code 池
      //   project → 该项目下（协作轴）
      //   agent   → 该 agent 已绑定（listByAgent，直接按绑定返回详情）
      //   user    → 该 owner（admin 可看任意用户，普通用户看自己）
      let data: CodeGraphDetail[] = [];
      if (scopeTab === 'team') {
        data = await knowledgeApi.code.teamAssets(activeTeamId);
      } else if (scopeTab === 'project') {
        data = selectedProject ? await knowledgeApi.code.listByProject(selectedProject) : [];
      } else if (scopeTab === 'agent') {
        data = agentFilter ? await knowledgeApi.code.listByAgent(agentFilter) : [];
      } else {
        const owner = selectedOwner || currentUser;
        data = owner ? await knowledgeApi.code.listByOwner(owner) : [];
      }
      if (seq !== fetchSeqRef.current) return; // 已被后续请求取代
      setSources(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (seq !== fetchSeqRef.current) return;
      tea.notify.error(e);
      setSources([]);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [activeTeamId, scopeTab, selectedProject, agentFilter, selectedOwner, currentUser]);

  // 触发 fetchSources：依赖原始参数 + fetchSources，并用 key 去重防止短时间内重复触发。
  const fetchKeyRef = useRef<string>('');
  useEffect(() => {
    // key 中只有 agent/project/user tab 才纳入对应的次级选择器 —— team tab 数据源
    // teamAssets 与次级选择器无关。若把 agentFilter 纳入 team 的 key，teamAgents 异步
    // 加载完后 agentFilter 会从 '' 变成首个 agent，导致 key 变化、再触发一次重复请求。
    const scopeKey =
      scopeTab === 'agent'
        ? agentFilter
        : scopeTab === 'project'
          ? selectedProject
          : scopeTab === 'user'
            ? selectedOwner
            : '';
    const key = `${activeTeamId}|${scopeTab}|${scopeKey}`;
    if (fetchKeyRef.current === key) return;
    fetchKeyRef.current = key;
    void fetchSources();
  }, [activeTeamId, scopeTab, agentFilter, selectedProject, selectedOwner, fetchSources]);

  // inFlight 的 ref 镜像：poll 闭包通过 ref 读取最新值，
  // 避免把 inFlight 放进 effect 依赖——否则每次 setInFlight（即使内容不变、
  // 只是数组引用变了）都会重新触发 effect → 立即 poll → 又 setInFlight → 死循环。
  const inFlightRef = useRef<CodeGraphDetail[]>([]);
  inFlightRef.current = inFlight;
  const hasInFlight = inFlight.length > 0;

  useEffect(() => {
    if (!activeTeamId || !hasInFlight) return;
    const poll = async () => {
      const items = inFlightRef.current;
      if (items.length === 0) return;
      const toRemove: string[] = [];
      const updates: CodeGraphDetail[] = [];
      for (const item of items) {
        if (!item.code_graph_id) continue;
        try {
          const detail = await knowledgeApi.code.get(item.code_graph_id);
          if (detail.status === 'ready') {
            try {
              await knowledgeApi.code.registerMeta(activeTeamId, detail.code_graph_id);
            } catch (e: any) {
              // 幂等：asset 已存在 / 409 → 忽略；其它真错报出来便于排查
              // （callback S2S 是主力，这里只是兜底，但失败要可见）
              const msg = e?.message || String(e);
              if (!/already|exist|409|registered|ok/i.test(msg)) {
                tea.notify.error(t('code.notify.metaFailed', { msg }));
              }
            }
            toRemove.push(detail.code_graph_id);
            void fetchSources();
          } else {
            // 只在状态真正变化时才记录更新，避免无意义的 setInFlight 触发重渲染
            if (detail.status !== item.status) updates.push(detail);
          }
        } catch {
          /* ignore transient poll errors */
        }
      }
      if (toRemove.length > 0 || updates.length > 0) {
        setInFlight((prev) => {
          let next = prev;
          if (toRemove.length > 0) {
            const removeSet = new Set(toRemove);
            next = next.filter((x) => !removeSet.has(x.code_graph_id));
          }
          if (updates.length > 0) {
            const updMap = new Map(updates.map((u) => [u.code_graph_id, u]));
            next = next.map((x) => updMap.get(x.code_graph_id) ?? x);
          }
          return next;
        });
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 8000);
    return () => clearInterval(timer);
  }, [hasInFlight, activeTeamId, fetchSources, t]);

  async function handleUnbindCode(codeGraphId: string) {
    if (!agentFilter) return;
    const ok = await tea.confirm({
      message: t('code.confirm.unbind'),
      description: t('code.confirm.unbind.desc'),
      okText: t('code.confirm.unbind.ok'),
    });
    if (!ok) return;
    try {
      await knowledgeApi.code.unbind(codeGraphId, agentFilter);
      tea.notify.success(t('code.notify.unbound'));
      if (selectedCodeAsset?.cgId === codeGraphId) setSelectedCodeAsset(null);
      await fetchSources();
    } catch (e: any) {
      tea.notify.error(e?.message || t('code.notify.unbindFailed'));
    }
  }

  const handleRegister = async () => {
    const repo = formRepo.trim();
    if (!repo || !formBranch.trim() || !activeTeamId) return;
    // 防御性校验：按钮已按 validUrl 禁用，这里再挡一层防止绕过
    if (!isValidGitHttpUrl(repo)) {
      tea.notify.error(t('code.register.invalidUrl'));
      return;
    }
    setSubmitting(true);
    try {
      const detail = await knowledgeApi.code.create(activeTeamId, repo, formBranch.trim(), repo);
      setShowRegister(false);
      setFormRepo('');
      setFormBranch('main');
      setScopeTab('team');
      setInFlight((prev) => [
        ...prev.filter((x) => x.code_graph_id !== detail.code_graph_id),
        detail,
      ]);
      tea.notify.info(t('code.notify.registered'));
      fetchSources();
    } catch (e: any) {
      tea.notify.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async (cgId: string) => {
    try {
      await knowledgeApi.code.sync(cgId);
      fetchSources();
    } catch (e: any) {
      tea.notify.error(e);
    }
  };

  const handleDelete = async (cgId: string) => {
    const source = sources.find((s) => s.code_graph_id === cgId);
    if (!source) return;
    const ok = await tea.confirm({
      message: t('code.confirm.delete', {
        name: formatRepoName(source.repo_name, source.repo_url),
        branch: source.branch,
      }),
      okText: t('code.action.delete'),
    });
    if (!ok) return;
    try {
      await knowledgeApi.code.delete(cgId);
      // 乐观更新：立即从本地列表移除。后端删除是最终一致的，删除刚成功时再拉 teamAssets
      // 可能仍返回该仓库，导致列表不变、需手动刷新页面才消失。这里先本地摘除，
      // fetchSources 仅作兜底对齐。
      setSources((prev) => prev.filter((x) => x.code_graph_id !== cgId));
      setInFlight((prev) => prev.filter((x) => x.code_graph_id !== cgId));
      if (selectedCodeAsset?.cgId === cgId) setSelectedCodeAsset(null);
      if (selectedCgId === cgId) setSubView('list');
      tea.notify.success(t('code.notify.deleted'));
      fetchSources();
    } catch (e: any) {
      tea.notify.error(e);
    }
  };

  const openDetail = (cgId: string) => {
    setSelectedCgId(cgId);
    setSearchQuery('');
    setSearchResult('');
    setExploreQuery('');
    setExploreResult('');
    setSubView('detail');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult('');
    try {
      const res = await knowledgeApi.code.search(selectedCgId, searchQuery, 'any', 20);
      setSearchResult(res?.text || JSON.stringify(res, null, 2));
    } catch (e: any) {
      setSearchResult('');
      tea.notify.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleExplore = async () => {
    if (!exploreQuery.trim()) return;
    setExploring(true);
    setExploreResult('');
    try {
      const res = await knowledgeApi.code.explore(selectedCgId, exploreQuery);
      setExploreResult(res?.text || JSON.stringify(res, null, 2));
    } catch (e: any) {
      setExploreResult('');
      tea.notify.error(e);
    } finally {
      setExploring(false);
    }
  };

  const fetchGraph = useCallback(async (cgId: string) => {
    setGraphLoading(true);
    setGraphData(null);
    try {
      const data = await knowledgeApi.code.graph(cgId);
      setGraphData(data);
    } catch (e: any) {
      tea.notify.error(e);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const fetchAnalyze = useCallback(async (cgId: string) => {
    setAnalyzeLoading(true);
    setAnalyzeData(null);
    try {
      const data = await knowledgeApi.code.analyze(cgId);
      setAnalyzeData(data);
    } catch (e: any) {
      tea.notify.error(e);
    } finally {
      setAnalyzeLoading(false);
    }
  }, []);

  const openGraph = useCallback((cgId: string) => {
    setSelectedCgId(cgId);
    setSubView('graph');
    void fetchGraph(cgId);
  }, [fetchGraph]);

  const selected = displaySources.find((source) => source.code_graph_id === selectedCgId);

  return {
    // context
    activeTeam,
    activeTeamId,
    currentUser,
    myUserId,
    isAdmin,
    teamAgents,
    // list view
    sources,
    displaySources,
    loading,
    scopeTab,
    setScopeTab,
    keyword,
    setKeyword,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    inFlight,
    setInFlight,
    subView,
    setSubView,
    selectedCgId,
    setSelectedCgId,
    // register
    showRegister,
    setShowRegister,
    formRepo,
    setFormRepo,
    formBranch,
    setFormBranch,
    submitting,
    setSubmitting,
    // allocate
    allocateTarget,
    setAllocateTarget,
    selectedCodeAsset,
    setSelectedCodeAsset,
    agentFilter,
    setAgentFilter,
    selectedProject,
    setSelectedProject,
    projects,
    selectedOwner,
    setSelectedOwner,
    allUsers,
    // detail
    searchQuery,
    setSearchQuery,
    searching,
    searchResult,
    setSearchResult,
    exploreQuery,
    setExploreQuery,
    exploring,
    exploreResult,
    setExploreResult,
    selected,
    // fetch & handlers
    fetchSources,
    handleUnbindCode,
    handleRegister,
    handleSync,
    handleDelete,
    openDetail,
    handleSearch,
    handleExplore,
    // graph
    graphData,
    graphLoading,
    fetchGraph,
    openGraph,
    // analyze
    analyzeData,
    analyzeLoading,
    fetchAnalyze,
    // computed
    scopeSources,
    stats,
    filteredSources,
  };
}

export type CodeSourcesStore = ReturnType<typeof useCodeSources>;