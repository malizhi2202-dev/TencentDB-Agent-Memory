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
        // 未知层的徽章显示占位，用户切到该 layer tab 时才按需请求真实计数，
        // 避免选中一个块就顺带把其余 3 层各 ping 一次（纯预请求用户还没看的东西）。
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
    // 注：不再在这里 setSelectedId —— 之前 fetchBlocks 的 useCallback 依赖
    // 了 selectedId，导致每次选中一个 block 都重新 fetch 整个列表（卡顿主因）。
    // 默认选中的逻辑改由下方独立 effect 处理。
  }, [activeTeamId, scopeTab, agentFilter, selectedProject, selectedOwner, currentUserId, t]);

  // 触发 fetchBlocks：依赖原始参数 + fetchBlocks，并用 key 去重防止短时间内重复触发。
  // 之前直接 `useEffect(() => fetchBlocks(), [fetchBlocks])` 会因 fetchBlocks 引用变化
  // （agentFilter 等依赖异步同步）触发多次，导致同一个接口被反复请求。
  const fetchKeyRef = useRef<string>('');
  useEffect(() => {
    // 只有 agent/project/user 维度才纳入对应次级选择器；team 维度数据源（teamAssets）
    // 与选中 agent 无关。若把 agentFilter 纳入 team 的 key，ownedTeamAgents 异步加载完后
    // agentFilter 会从 '' 变成首个 agent，导致 key 变化、再触发一次**完全重复**的
    // teamAssets 请求（进页面即多打一次接口）。
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
/* __GAP__ line 250 */
/* __GAP__ line 251 */
/* __GAP__ line 252 */
/* __GAP__ line 253 */
/* __GAP__ line 254 */
/* __GAP__ line 255 */
/* __GAP__ line 256 */
/* __GAP__ line 257 */
/* __GAP__ line 258 */
/* __GAP__ line 259 */
/* __GAP__ line 260 */
/* __GAP__ line 261 */
/* __GAP__ line 262 */
/* __GAP__ line 263 */
/* __GAP__ line 264 */
/* __GAP__ line 265 */
/* __GAP__ line 266 */
/* __GAP__ line 267 */
/* __GAP__ line 268 */
/* __GAP__ line 269 */
/* __GAP__ line 270 */
/* __GAP__ line 271 */
/* __GAP__ line 272 */
/* __GAP__ line 273 */
/* __GAP__ line 274 */
/* __GAP__ line 275 */
/* __GAP__ line 276 */
/* __GAP__ line 277 */
/* __GAP__ line 278 */
/* __GAP__ line 279 */
/* __GAP__ line 280 */
/* __GAP__ line 281 */
/* __GAP__ line 282 */
/* __GAP__ line 283 */
/* __GAP__ line 284 */
/* __GAP__ line 285 */
/* __GAP__ line 286 */
/* __GAP__ line 287 */
/* __GAP__ line 288 */
/* __GAP__ line 289 */
/* __GAP__ line 290 */
/* __GAP__ line 291 */
/* __GAP__ line 292 */
/* __GAP__ line 293 */
/* __GAP__ line 294 */
/* __GAP__ line 295 */
/* __GAP__ line 296 */
/* __GAP__ line 297 */
/* __GAP__ line 298 */
/* __GAP__ line 299 */
/* __GAP__ line 300 */
/* __GAP__ line 301 */
/* __GAP__ line 302 */
/* __GAP__ line 303 */
/* __GAP__ line 304 */
/* __GAP__ line 305 */
/* __GAP__ line 306 */
/* __GAP__ line 307 */
/* __GAP__ line 308 */
/* __GAP__ line 309 */
/* __GAP__ line 310 */
/* __GAP__ line 311 */
/* __GAP__ line 312 */
/* __GAP__ line 313 */
/* __GAP__ line 314 */
/* __GAP__ line 315 */
/* __GAP__ line 316 */
/* __GAP__ line 317 */
/* __GAP__ line 318 */
/* __GAP__ line 319 */
/* __GAP__ line 320 */
/* __GAP__ line 321 */
/* __GAP__ line 322 */
/* __GAP__ line 323 */
/* __GAP__ line 324 */
/* __GAP__ line 325 */
/* __GAP__ line 326 */
/* __GAP__ line 327 */
/* __GAP__ line 328 */
/* __GAP__ line 329 */
/* __GAP__ line 330 */
/* __GAP__ line 331 */
/* __GAP__ line 332 */
/* __GAP__ line 333 */
/* __GAP__ line 334 */
/* __GAP__ line 335 */
/* __GAP__ line 336 */
/* __GAP__ line 337 */
/* __GAP__ line 338 */
/* __GAP__ line 339 */
/* __GAP__ line 340 */
/* __GAP__ line 341 */
/* __GAP__ line 342 */
/* __GAP__ line 343 */
/* __GAP__ line 344 */
/* __GAP__ line 345 */
/* __GAP__ line 346 */
/* __GAP__ line 347 */
/* __GAP__ line 348 */
/* __GAP__ line 349 */
/* __GAP__ line 350 */
/* __GAP__ line 351 */
/* __GAP__ line 352 */
/* __GAP__ line 353 */
/* __GAP__ line 354 */
/* __GAP__ line 355 */
/* __GAP__ line 356 */
/* __GAP__ line 357 */
/* __GAP__ line 358 */
/* __GAP__ line 359 */
/* __GAP__ line 360 */
/* __GAP__ line 361 */
/* __GAP__ line 362 */
/* __GAP__ line 363 */
/* __GAP__ line 364 */
/* __GAP__ line 365 */
/* __GAP__ line 366 */
/* __GAP__ line 367 */
/* __GAP__ line 368 */
/* __GAP__ line 369 */
/* __GAP__ line 370 */
/* __GAP__ line 371 */
/* __GAP__ line 372 */
/* __GAP__ line 373 */
/* __GAP__ line 374 */
/* __GAP__ line 375 */
/* __GAP__ line 376 */
/* __GAP__ line 377 */
/* __GAP__ line 378 */
/* __GAP__ line 379 */
/* __GAP__ line 380 */
/* __GAP__ line 381 */
/* __GAP__ line 382 */
/* __GAP__ line 383 */
/* __GAP__ line 384 */
/* __GAP__ line 385 */
/* __GAP__ line 386 */
/* __GAP__ line 387 */
/* __GAP__ line 388 */
/* __GAP__ line 389 */
/* __GAP__ line 390 */
/* __GAP__ line 391 */
/* __GAP__ line 392 */
/* __GAP__ line 393 */
/* __GAP__ line 394 */
/* __GAP__ line 395 */
/* __GAP__ line 396 */
/* __GAP__ line 397 */
/* __GAP__ line 398 */
/* __GAP__ line 399 */
/* __GAP__ line 400 */
/* __GAP__ line 401 */
/* __GAP__ line 402 */
/* __GAP__ line 403 */
/* __GAP__ line 404 */
/* __GAP__ line 405 */
/* __GAP__ line 406 */
/* __GAP__ line 407 */
/* __GAP__ line 408 */
/* __GAP__ line 409 */
/* __GAP__ line 410 */
/* __GAP__ line 411 */
/* __GAP__ line 412 */
/* __GAP__ line 413 */
/* __GAP__ line 414 */
/* __GAP__ line 415 */
/* __GAP__ line 416 */
/* __GAP__ line 417 */
/* __GAP__ line 418 */
/* __GAP__ line 419 */
/* __GAP__ line 420 */
/* __GAP__ line 421 */
/* __GAP__ line 422 */
/* __GAP__ line 423 */
/* __GAP__ line 424 */
/* __GAP__ line 425 */
/* __GAP__ line 426 */
/* __GAP__ line 427 */
/* __GAP__ line 428 */
/* __GAP__ line 429 */
/* __GAP__ line 430 */
/* __GAP__ line 431 */
/* __GAP__ line 432 */
/* __GAP__ line 433 */
/* __GAP__ line 434 */
/* __GAP__ line 435 */
/* __GAP__ line 436 */
/* __GAP__ line 437 */
/* __GAP__ line 438 */
/* __GAP__ line 439 */
/* __GAP__ line 440 */
/* __GAP__ line 441 */
/* __GAP__ line 442 */
/* __GAP__ line 443 */
/* __GAP__ line 444 */
/* __GAP__ line 445 */
/* __GAP__ line 446 */
/* __GAP__ line 447 */
/* __GAP__ line 448 */
/* __GAP__ line 449 */
/* __GAP__ line 450 */
/* __GAP__ line 451 */
/* __GAP__ line 452 */
/* __GAP__ line 453 */
/* __GAP__ line 454 */
/* __GAP__ line 455 */
/* __GAP__ line 456 */
/* __GAP__ line 457 */
/* __GAP__ line 458 */
/* __GAP__ line 459 */
/* __GAP__ line 460 */
/* __GAP__ line 461 */
/* __GAP__ line 462 */
/* __GAP__ line 463 */
/* __GAP__ line 464 */
/* __GAP__ line 465 */
/* __GAP__ line 466 */
/* __GAP__ line 467 */
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
    // 之前 bug：任何 `chat_memory-{team}-{agentX}` 命名的 asset 都被判成 self，
    // 导致别人 agent 的记忆借入到当前 agent 后（e.g. test3 借了 test-bugfix 的），
    // 也被误判为 self，"解绑"按钮永远不显示。
    // agent tab 下 agentFilter 就是当前 agent；team/project/user tab 不涉及"解绑"语义，
    // 保留原前缀判定作为兜底。
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
    // 所以数据源用 ownedTeamAgents，排除该记忆块自身的 agent。
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
  function allocatableAgents(b: MemoryBlock) {
    // 文档 §4.5 allocate 权限规则：
    //   1. agent.owner = me（只能分配到自己 owner 的 agent，否则 403 NOT_YOUR_AGENT）
    //   3. 不能把 agent 自己的 chat_memory 分配给自己
    // 所以数据源用 ownedTeamAgents，排除该记忆块自身的 agent。
    const ownerAgentId = selfChatMemoryAgentId(b);
    return ownedTeamAgents
      .filter((a) => a.agent_id !== ownerAgentId)
      .map((a) => ({ agent_id: a.agent_id, name: a.name }));
  }

  // ── 操作 ──
  async function handleDeleteBlock(id: string) {
    const ok = await tea.confirm({
      message: t('memory.confirm.unbind'),
/* __GAP__ line 575 */
/* __GAP__ line 576 */
/* __GAP__ line 577 */
/* __GAP__ line 578 */
/* __GAP__ line 579 */
/* __GAP__ line 580 */
/* __GAP__ line 581 */
/* __GAP__ line 582 */
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
/* __GAP__ line 633 */
/* __GAP__ line 634 */
/* __GAP__ line 635 */
/* __GAP__ line 636 */
/* __GAP__ line 637 */
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
    // computed
    selected,
    layerPage,
    pageSize,
    windowTotal,
    isAdmin,
    projects,
    selectedProject,
    setSelectedProject,
    allUsers,
    selectedOwner,
    setSelectedOwner,
    // computed
    selected,
    layerPage,
    handleToggleScope,
    // helpers
    agentLabel,
    allocatableAgents,
    isSelfChatMemory,
  };
}

export type ChatMemoryStore = ReturnType<typeof useChatMemory>;
