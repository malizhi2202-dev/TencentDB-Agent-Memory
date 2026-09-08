/**
 * useChatMemory —— Chat Memory 页的全部状态与数据逻辑。
 * 组件层只保留 JSX 渲染，状态 / 数据逻辑集中在此。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgents, useTeams } from '@/services';
import { readAuth } from '@/components/LoginGate';
import { tea } from '@/lib/tea-bridge';
import { chatMemoryApi, type ChatMemoryBlock, type ChatMemorySearchHit } from '@/lib/teamApi';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { getPanelSession } from '@/lib/panelSession';
import type { Project, PublicUser } from '@/lib/api/types';
import { type MemoryBlock, type MemoryLayer, type ScopeTab } from './types';
import { useScopeTabLabels } from './constants';
import {
  buildInitialLayerCounts,
  defaultTimeRange,
  isRangeTooLargeError,
  layerPageSize,
  mapLayerItem,
  type TimeRange,
} from './memory-utils';
import { getLayerCount } from './utils';

export function useChatMemory(props: { activeTeamId?: string | null } = {}) {
  const { t } = useTranslation();
  const scopeTabLabels = useScopeTabLabels();
  const auth = readAuth();
  const { activeTeamId: storeActiveTeamId, activeTeam, teams } = useTeams();
  const currentUserId = auth?.user_id ?? '';
  const activeTeamId = props.activeTeamId ?? storeActiveTeamId;
  const { agents: teamAgents } = useAgents(activeTeamId);
  const ownedTeamAgents = useMemo(
    () => teamAgents.filter((a) => a.owner_user_id === currentUserId),
    [teamAgents, currentUserId],
  );

  const [blocks, setBlocks] = useState<MemoryBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layer, setLayer] = useState<MemoryLayer>('L1');
  const [layerPages, setLayerPages] = useState<
    Record<string, Partial<Record<MemoryLayer, number>>>
  >({});
  // 各层「当前时间窗口内」的总条数（key: `${blockId}|${layer}`）。
  // layerCounts 存的是全量总数（选中块时 limit=1 拿到的）；带时间筛选（L0/L1）
  // 时 BFF 返回的 res.total 才是窗口内数量，分页必须用它，否则页数虚高。
  const [windowTotals, setWindowTotals] = useState<
    Record<string, Partial<Record<MemoryLayer, number>>>
  >({});
  const [layerLoading, setLayerLoading] = useState(false);
  const [layerItemLoadingId, setLayerItemLoadingId] = useState<string | null>(null);
  // 详情页时间筛选器（仅 L0 / L1 生效），默认「前一天 ~ 当前」
  const [timeRange, setTimeRange] = useState<TimeRange>(() => defaultTimeRange());
  // 后端探测到筛选范围过大时为 true，BlockDetail 显示提示而非空态
  const [rangeTooLarge, setRangeTooLarge] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  // 默认展示 Agent 资产（agent），避免用户误以为自己的资产在「团队资产」里
  const [scopeTab, setScopeTab] = useState<ScopeTab>('agent');
  const [agentFilter, setAgentFilter] = useState<string>('');
  // team 维度（team tab）：下拉选要查看的团队；空 = 默认当前激活团队。
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  // project / user 维度次级选择器
  const myUser = getPanelSession()?.user;
  const isAdmin = myUser?.user_type === 'system_admin';
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [selectedOwner, setSelectedOwner] = useState('');

  useEffect(() => {
    if (ownedTeamAgents.length === 0) {
      setAgentFilter('');
      return;
    }
    if (!agentFilter || !ownedTeamAgents.some((a) => a.agent_id === agentFilter)) {
      setAgentFilter(ownedTeamAgents[0].agent_id);
    }
  }, [ownedTeamAgents, agentFilter]);

  // project 维度选择器数据
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // user 维度选择器数据（仅 admin 全量）
  useEffect(() => {
    if (!isAdmin) {
      setAllUsers([]);
      return;
    }
    let cancelled = false;
    usersApi
      .list()
      .then((list) => {
        if (!cancelled) setAllUsers(list);
      })
      .catch(() => {
        if (!cancelled) setAllUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // ── 数据加载 ──
  // 请求序号防竞态：快速切换 tab 时，先发的请求可能后返回，
  // 旧 tab 的数据会覆盖新 tab 的数据。每次 fetch 递增序号，
  // 响应回来时校验序号是否仍是最新，不是就丢弃。
  const fetchSeqRef = useRef(0);
  // L0「自动扩展时间范围」的连续次数上限：窗口内到最早时自动往前扩展 24h，
  // 直到后端确认该记忆块在更早时间也没有记录（重新加载返回空 → l0Ended 置位）为止。
  const l0AutoExpandCountRef = useRef(0);

  const fetchBlocks = useCallback(async () => {
    if (!activeTeamId) {
      setBlocks([]);
      setBlocksLoading(false);
      return;
    }
    // agent 维度没选 agent 时不发请求，但要确保 loading 关闭
    if (scopeTab === 'agent' && !agentFilter) {
      setBlocks([]);
      setBlocksLoading(false);
      return;
    }
    // project 维度没选 project 时不发请求
    if (scopeTab === 'project' && !selectedProject) {
      setBlocks([]);
      setBlocksLoading(false);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setBlocksLoading(true);
    // 立即清空旧数据 —— 否则切 tab 时会先看到上一个 tab 的列表，
    // 新数据到了才突然替换，视觉上就是"闪一下"。
    setBlocks([]);
    try {
      let res: { items: ChatMemoryBlock[]; total?: number };
      if (scopeTab === 'team') {
        res = await chatMemoryApi.teamAssets(selectedTeam || activeTeamId);
      } else if (scopeTab === 'project') {
        res = await chatMemoryApi.listByProject(selectedProject);
      } else if (scopeTab === 'agent') {
        res = await chatMemoryApi.agentFixed(agentFilter);
      } else {
        // user 维度：admin 可切任意用户，普通用户只看自己
        const owner = selectedOwner || currentUserId;
        res = owner
          ? await chatMemoryApi.listByOwner(owner)
          : { items: [] as ChatMemoryBlock[], total: 0 };
      }
      if (seq !== fetchSeqRef.current) return; // 已被后续请求取代
      const mapped: MemoryBlock[] = res.items.map((b) => ({
        id: b.id,
        title: b.title,
        summary: b.summary ?? '',
        tags: [],
        updated_at_ms: b.updated_at_ms,
        agent_id: b.agent_id ?? undefined,
        uploaded_by_user_id: b.uploaded_by_user_id,
        scope: b.scope,
        layer_counts: b.layer_counts,
        bound_agent_count: b.bound_agent_count,
        layers: { L0: [], L1: [], L2: [], L3: [] },
        // 初始只填后端返回的**真实**计数（>0）；为 0 / 未落地的层留 undefined＝「未知」。
        layerCounts: buildInitialLayerCounts(b.layer_counts),
      }));
      setBlocks(mapped);
    } catch (e: any) {
      if (seq !== fetchSeqRef.current) return;
      tea.notify.error(e?.message || t('memory.notify.loadFailed'));
      setBlocks([]);
    } finally {
      if (seq === fetchSeqRef.current) setBlocksLoading(false);
    }
  }, [activeTeamId, scopeTab, agentFilter, selectedProject, selectedOwner, currentUserId, t]);

  // 触发 fetchBlocks：依赖原始参数 + fetchBlocks，并用 key 去重防止短时间内重复触发。
  const fetchKeyRef = useRef<string>('');
  useEffect(() => {
    const scopeKey =
      scopeTab === 'agent'
        ? agentFilter
        : scopeTab === 'project'
          ? selectedProject
          : scopeTab === 'user'
            ? selectedOwner || currentUserId
            : scopeTab === 'team'
              ? selectedTeam
              : '';
    const key = `${activeTeamId}|${scopeTab}|${scopeKey}`;
    if (fetchKeyRef.current === key) return;
    fetchKeyRef.current = key;
    void fetchBlocks();
  }, [activeTeamId, scopeTab, agentFilter, selectedTeam, selectedProject, selectedOwner, currentUserId, fetchBlocks]);

  // 列表变化后，仅当当前选中的记忆块已不在列表中时清空选中。
  // 进入页面不自动选中第一个（与 skill 行为保持一致），由用户点击后再加载详情。
  useEffect(() => {
    if (selectedId && !blocks.some((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [blocks, selectedId]);

  // ── 层分页加载 ──
  const selected = useMemo(
    () => (selectedId ? (blocks.find((b) => b.id === selectedId) ?? null) : null),
    [selectedId, blocks],
  );
  const layerPage = selected?.id ? (layerPages[selected.id]?.[layer] ?? 0) : 0;
  const pageSize = layerPageSize(layer);
  /** 当前层「当前时间窗口内」的总条数；无窗口缓存时回退全量总数（L2/L3 恒等于全量） */
  const windowTotal = selected?.id
    ? (windowTotals[selected.id]?.[layer] ?? getLayerCount(selected, layer))
    : 0;

  // ── 层计数：选中块即并行拉取四层计数 ──
  // 业务确认：teamAssets / agentFixed / myAgents 返回的 layer_counts 不可靠，
  // 必须对选中的 block 调用 L0/L1/L2/L3 四个 layer 接口才能拿到准确计数。
  const layerCountSeqRef = useRef(0);
  useEffect(() => {
    if (!selected?.id) return;
    const blockId = selected.id;
    const seq = ++layerCountSeqRef.current;
    const layers: MemoryLayer[] = ['L0', 'L1', 'L2', 'L3'];
    layers.forEach((l) => {
      // 已经有真实计数的层不重复请求。
      if (selected.layerCounts[l] !== undefined) return;
      chatMemoryApi
        .layer(blockId, l, 1, 0)
        .then((res) => {
          if (seq !== layerCountSeqRef.current) return; // 已被后续选中取代
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === blockId ? { ...b, layerCounts: { ...b.layerCounts, [l]: res.total } } : b,
            ),
          );
        })
        .catch(() => {
          // 单层计数失败不阻断其他层，静默忽略
        });
    });
  }, [selected?.id]);

  // 切换记忆块时，时间筛选器重置为默认「前一天 ~ 当前」（业务确认：每次打开都重置）
  useEffect(() => {
    setTimeRange(defaultTimeRange());
    setRangeTooLarge(false);
  }, [selected?.id]);

  // 切块 / 时间范围变化时，窗口内总数缓存作废（翻页与总数必须按新窗口重新计算）
  useEffect(() => {
    setWindowTotals({});
  }, [selected?.id, timeRange.start, timeRange.end]);

  useEffect(() => {
    if (!selected?.id) {
      setLayerLoading(false);
      return;
    }
    let cancelled = false;
    setLayerLoading(true);
    // 时间筛选仅对 L0 / L1 生效；L2 / L3 是聚合产物，不传时间参数
    const useTimeFilter = layer === 'L0' || layer === 'L1';
    const timeStart = useTimeFilter ? timeRange.start || undefined : undefined;
    const timeEnd = useTimeFilter ? timeRange.end || undefined : undefined;
    chatMemoryApi
      .layer(
        selected.id,
        layer,
        pageSize,
        layerPage * pageSize,
        undefined,
        undefined,
        timeStart,
        timeEnd,
      )
      .then((res) => {
        if (cancelled) return;
        setRangeTooLarge(false);
        // 带时间筛选时 res.total 是「当前时间窗口内」的数量，单独保存供分页用
        setWindowTotals((prev) => ({
          ...prev,
          [selected.id]: { ...(prev[selected.id] ?? {}), [layer]: res.total },
        }));
        setBlocks((prev) =>
          prev.map((b) => {
            if (b.id !== selected.id) return b;
            const updated = {
              ...b,
              layers: { ...b.layers },
              ...(!useTimeFilter
                ? { layerCounts: { ...b.layerCounts, [layer]: res.total } }
                : {}),
            };
            if (res.layer === 'L0') {
              updated.layers.L0 = res.items;
              updated.l0Ended = res.items.length === 0;
            } else if (res.layer === 'L1') updated.layers.L1 = res.items.map(mapLayerItem);
            else if (res.layer === 'L2') updated.layers.L2 = res.items.map(mapLayerItem);
            else if (res.layer === 'L3') updated.layers.L3 = res.items.map(mapLayerItem);
            return updated;
          }),
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // 范围过大：不弹错误提示，交由 BlockDetail 渲染「记忆条数过多」引导
        if (isRangeTooLargeError(e)) {
          setRangeTooLarge(true);
          return;
        }
        tea.notify.error(e instanceof Error ? e.message : t('memory.notify.layerFailed'));
      })
      .finally(() => {
        if (!cancelled) setLayerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, layer, layerPage, pageSize, timeRange.start, timeRange.end, t]);

  const handleLayerPageChange = useCallback(
    (nextPage: number) => {
      if (!selected?.id) return;
      setLayerPages((prev) => ({
        ...prev,
        [selected.id]: { ...(prev[selected.id] ?? {}), [layer]: Math.max(0, nextPage) },
      }));
    },
    [selected?.id, layer],
  );

  // ── L0 加载更多（下拉/滚动到顶部触发） ──
  const [l0MoreLoading, setL0MoreLoading] = useState(false);
  const handleL0LoadMore = useCallback(async () => {
    if (!selected?.id || layer !== 'L0' || l0MoreLoading) return;
    const items = selected.layers.L0;
    const total = selected.layerCounts.L0 ?? items.length;
    if (selected.l0Ended) return;
    if (items.length >= total) return;
    // 游标：数组按新→旧排列，最后一条是最旧的已加载消息
    const lastItem = items[items.length - 1];
    const beforeTs = lastItem?.created_at;
    setL0MoreLoading(true);
    try {
      const timeStart = timeRange.start || undefined;
      const res = await chatMemoryApi.layer(
        selected.id,
        'L0',
        pageSize,
        0,
        undefined,
        beforeTs,
        timeStart,
      );
      const noMore = res.items.length === 0;
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== selected.id) return b;
          const existing = new Set(b.layers.L0.map((m) => m.id));
          const more = res.items.filter((m) => !existing.has(m.id));
          return {
            ...b,
            layers: { ...b.layers, L0: [...b.layers.L0, ...more] },
            l0Ended: b.l0Ended || more.length === 0,
          };
        }),
      );
      if (noMore && timeRange.start && l0AutoExpandCountRef.current < 30) {
        l0AutoExpandCountRef.current += 1;
        const newStart = new Date(new Date(timeRange.start).getTime() - 24 * 60 * 60 * 1000);
        setL0MoreLoading(false);
        setTimeRange((prev) => ({ ...prev, start: newStart.toISOString() }));
        return;
      }
    } catch (e: unknown) {
      tea.notify.error((e instanceof Error ? e.message : String(e)) || t('memory.notify.layerFailed'));
    } finally {
      setL0MoreLoading(false);
    }
  }, [selected, layer, l0MoreLoading, pageSize, timeRange.start, t]);

  const handleLayerItemLoad = useCallback(
    async (itemId: string) => {
      if (!selected?.id || layer !== 'L2') return;
      const current = selected.layers.L2.find((item) => item.id === itemId);
      if (!current) return;
      if (current.body.trim()) {
        setBlocks((prev) =>
          prev.map((b) => {
            if (b.id !== selected.id) return b;
            return {
              ...b,
              layers: {
                ...b.layers,
                L2: b.layers.L2.map((item) =>
                  item.id === itemId ? { ...item, body: '', tags: [] } : item,
                ),
              },
            };
          }),
        );
        return;
      }
      setLayerItemLoadingId(itemId);
      try {
        const res = await chatMemoryApi.layer(selected.id, 'L2', 1, 0, itemId);
        const loaded = res.items[0] ? mapLayerItem(res.items[0]) : null;
        if (!loaded) return;
        setBlocks((prev) =>
          prev.map((b) => {
            if (b.id !== selected.id) return b;
            return {
              ...b,
              layers: {
                ...b.layers,
                L2: b.layers.L2.map((item) => (item.id === itemId ? { ...item, ...loaded } : item)),
              },
            };
          }),
        );
      } catch (e: unknown) {
        tea.notify.error((e instanceof Error ? e.message : String(e)) || t('memory.notify.l2Failed'));
      } finally {
        setLayerItemLoadingId(null);
      }
    },
    [selected?.id, selected?.layers.L2, layer, t],
  );

  // ── 编辑：保存单层内容（Owner-only；成功后乐观更新对应条目 body） ──
  const handleSaveLayerItem = useCallback(
    async (targetLayer: 'L1' | 'L2' | 'L3', itemId: string, content: string) => {
      if (!selected?.id) return;
      await chatMemoryApi.updateLayer(selected.id, targetLayer, {
        id: itemId,
        content,
      });
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== selected.id) return b;
          return {
            ...b,
            layers: {
              ...b.layers,
              [targetLayer]: b.layers[targetLayer].map((item) =>
                item.id === itemId ? { ...item, body: content } : item,
              ),
            },
          };
        }),
      );
      tea.notify.success(t('memory.notify.editSuccess'));
    },
    [selected?.id, t],
  );

  // ── 搜索：L0（对话）/ L1（原子记忆）语义 / 关键字检索 ──
  const searchLayer = useCallback(
    async (targetLayer: 'L0' | 'L1', query: string): Promise<ChatMemorySearchHit[]> => {
      if (!selected?.id) return [];
      const res = await chatMemoryApi.searchLayer(selected.id, targetLayer, query, 30);
      return res.items ?? [];
    },
    [selected?.id],
  );

  // ── 过滤与辅助 ──
  const filtered = useMemo(() => {
    if (scopeTab === 'agent')
      return agentFilter ? blocks.filter((b) => b.agent_id === agentFilter) : [];
    return blocks;
  }, [blocks, scopeTab, agentFilter]);

  function agentLabel(id?: string): string {
    if (!id) return '';
    const a = teamAgents.find((x) => x.agent_id === id);
    return a ? a.name : id;
  }

  function selfChatMemoryAgentId(b: MemoryBlock): string | undefined {
    if (!activeTeamId) return undefined;
    const prefix = `chat_memory-${activeTeamId}-`;
    if (b.id.startsWith(prefix)) return b.id.slice(prefix.length) || undefined;
    return b.agent_id;
  }

  function isSelfChatMemory(b: MemoryBlock): boolean {
    // 只有当"这条 chat_memory 是**当前正在查看的 agent** 的自身记忆"时才算 self —— 不允许解绑。
    if (!activeTeamId) return false;
    if (scopeTab === 'agent' && agentFilter) {
      return b.id === `chat_memory-${activeTeamId}-${agentFilter}`;
    }
    const ownerAgentId = selfChatMemoryAgentId(b);
    return !!ownerAgentId && b.id === `chat_memory-${activeTeamId}-${ownerAgentId}`;
  }

  function allocatableAgents(b: MemoryBlock) {
    // 文档 §4.5 allocate 权限规则：
    //   1. agent.owner = me（只能分配到自己 owner 的 agent，否则 403 NOT_YOUR_AGENT）
    //   3. 不能把 agent 自己的 chat_memory 分配给自己
    const ownerAgentId = selfChatMemoryAgentId(b);
    return ownedTeamAgents
      .filter((a) => a.agent_id !== ownerAgentId)
      .map((a) => ({ agent_id: a.agent_id, name: a.name }));
  }

  // ── 操作 ──
  async function handleDeleteBlock(id: string) {
    const ok = await tea.confirm({
      message: t('memory.confirm.unbind'),
      description: t('memory.confirm.unbind.desc'),
      okText: t('memory.confirm.unbind.ok'),
    });
    if (!ok) return;
    try {
      const block = blocks.find((b) => b.id === id);
      if (!activeTeamId || !block?.agent_id) return;
      await chatMemoryApi.unbind(activeTeamId, id, block.agent_id);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
      tea.notify.success(t('memory.notify.unbound'));
    } catch (e: any) {
      tea.notify.error(e?.message || t('memory.notify.unbindFailed'));
    }
  }

  async function handleImport({
    agent_id,
    messages,
  }: {
    agent_id: string;
    messages: Array<{ role: string; content: string }>;
  }) {
    try {
      if (!activeTeamId || !agent_id) {
        tea.notify.warning(t('memory.notify.selectAgent'));
        return;
      }
      await chatMemoryApi.import({ teamId: activeTeamId, agentId: agent_id, messages });
      tea.notify.success(t('memory.notify.importSuccess', { count: messages.length }));
      setShowImport(false);
      fetchBlocks();
    } catch (e: any) {
      tea.notify.error(e?.message || t('memory.notify.importFailed'));
    }
  }

  // 共享/私密切换：Agent 资产（agent）tab 的资产项上（仅 owner 可切）。
  async function handleToggleScope(block: MemoryBlock, newScope: 'team' | 'private') {
    if (block.scope === newScope) return;
    if (newScope === 'private') {
      const ok = await tea.confirm({
        message: t('memory.confirm.private'),
        description: t('memory.confirm.private.desc'),
        okText: t('memory.confirm.private.ok'),
      });
      if (!ok) return;
    }
    try {
      await chatMemoryApi.patchScope(block.id, newScope);
      tea.notify.success(
        newScope === 'team' ? t('memory.notify.scopeTeam') : t('memory.notify.scopePrivate'),
      );
      fetchBlocks();
    } catch (e: unknown) {
      tea.notify.error((e instanceof Error ? e.message : String(e)) || t('memory.notify.scopeFailed'));
    }
  }

  return {
    // context
    activeTeam,
    activeTeamId,
    currentUserId,
    ownedTeamAgents,
    teamAgents,
    scopeTabLabels,
    // state
    blocks,
    blocksLoading,
    selectedId,
    setSelectedId,
    layer,
    setLayer,
    layerPages,
    layerLoading,
    layerItemLoadingId,
    l0MoreLoading,
    timeRange,
    setTimeRange,
    rangeTooLarge,
    showImport,
    setShowImport,
    showAllocate,
    setShowAllocate,
    scopeTab,
    setScopeTab,
    agentFilter,
    setAgentFilter,
    // 维度次级选择器
    isAdmin,
    selectedTeam,
    setSelectedTeam,
    teams,
    projects,
    selectedProject,
    setSelectedProject,
    allUsers,
    selectedOwner,
    setSelectedOwner,
    // computed
    selected,
    layerPage,
    pageSize,
    windowTotal,
    filtered,
    // handlers
    fetchBlocks,
    handleLayerPageChange,
    handleL0LoadMore,
    handleLayerItemLoad,
    handleSaveLayerItem,
    searchLayer,
    handleDeleteBlock,
    handleImport,
    handleToggleScope,
    // helpers
    agentLabel,
    allocatableAgents,
    isSelfChatMemory,
  };
}

export type ChatMemoryStore = ReturnType<typeof useChatMemory>;