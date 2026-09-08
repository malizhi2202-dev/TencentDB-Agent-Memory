/**
 * AnalysisShellPage —— 代码分析「壳」页面：Git 仓库管理列表 + 上传。
 *
 * 「代码分析」大模块的入口：列出团队已上传的 Git 仓库，支持上传新的 git 仓库，
 * 点击仓库进入其「代码分析 + 代码图谱」详情页（/analysis/:cgId）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, Justify, Modal, Segment, Select, StatusTip, Table, Text } from 'tea-component';
import { CodeIcon, RefreshIcon, UploadIcon } from 'tea-icons-react';
import { knowledgeApi, type CodeGraphDetail, type GitAuthInput, type WorkspaceDetection } from '@/lib/knowledge-api';
import { tea } from '@/lib/tea-bridge';
import { useTeams } from '@/services';
import { ResourcePage } from '@/pages/ResourcePage';
import { agentsApi } from '@/lib/api/agents';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { getPanelSession } from '@/lib/panelSession';
import type { Agent, Project, PublicUser } from '@/lib/api/types';
import { statusLabel } from '@/pages/code/CodePage/components/code-ui';
import { formatRepoName, formatShortTime, isValidGitHttpUrl, isValidSshGitUrl } from '@/pages/code/CodePage/components/code-constants';
import { gitCredentialsApi, type GitCredentialListItem } from '@/lib/api/git-credentials';
import { GitCredentialManager } from './components/GitCredentialManager';
import './analysis-shell.css';

const { scrollable, autotip } = Table.addons;

type AnalysisScope = 'team' | 'project' | 'agent' | 'user';
const SCOPE_LABEL_KEY: Record<AnalysisScope, string> = {
  team: 'analysis.scope.team',
  project: 'analysis.scope.project',
  agent: 'analysis.scope.agent',
  user: 'analysis.scope.user',
};

export function AnalysisShellPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeTeamId, teams } = useTeams();
  const myUser = getPanelSession()?.user;
  const myUserId = myUser?.user_id ?? '';
  const isAdmin = myUser?.user_type === 'system_admin';

  const [sources, setSources] = useState<CodeGraphDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [inFlight, setInFlight] = useState<CodeGraphDetail[]>([]);

  // 维度切换（团队 / 项目 / Agent / 用户）
  const [scope, setScope] = useState<AnalysisScope>('team');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [teamAgents, setTeamAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [selectedOwner, setSelectedOwner] = useState('');

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [formRepo, setFormRepo] = useState('');
  const [formBranch, setFormBranch] = useState('main');
  const [formName, setFormName] = useState('');
  const [formAuthKind, setFormAuthKind] = useState<'none' | 'password' | 'token' | 'ssh' | 'saved'>('none');
  const [formAuthUsername, setFormAuthUsername] = useState('');
  const [formAuthSecret, setFormAuthSecret] = useState('');
  const [formAuthPassphrase, setFormAuthPassphrase] = useState('');
  const [formCredentialId, setFormCredentialId] = useState('');
  const [credentialList, setCredentialList] = useState<GitCredentialListItem[]>([]);
  const [showCredManager, setShowCredManager] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Workspace detect state (req-2：检测 harness 工作区)
  const [showDetect, setShowDetect] = useState(false);
  const [detectPath, setDetectPath] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<WorkspaceDetection | null>(null);
  const [detectUploading, setDetectUploading] = useState<string | null>(null);

  // 维度次级选择器数据：project / agent / user
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

  useEffect(() => {
    if (!activeTeamId) {
      setTeamAgents([]);
      return;
    }
    let cancelled = false;
    agentsApi
      .list(activeTeamId)
      .then((list) => {
        if (cancelled) return;
        setTeamAgents(list);
        if (!selectedAgent && list.length > 0) setSelectedAgent(list[0].agent_id);
      })
      .catch(() => {
        if (!cancelled) setTeamAgents([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId]);

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

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      let items: CodeGraphDetail[];
      if (scope === 'team') {
        items = activeTeamId ? await knowledgeApi.code.teamAssets(selectedTeam || activeTeamId) : [];
      } else if (scope === 'project') {
        items = selectedProject ? await knowledgeApi.code.listByProject(selectedProject) : [];
      } else if (scope === 'agent') {
        items = selectedAgent ? await knowledgeApi.code.listByAgent(selectedAgent) : [];
      } else {
        const owner = selectedOwner || myUserId;
        items = owner ? await knowledgeApi.code.listByOwner(owner) : [];
      }
      setSources(Array.isArray(items) ? items : []);
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [activeTeamId, scope, selectedTeam, selectedProject, selectedAgent, selectedOwner, myUserId]);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  // 轮询 in-flight（刚上传还在构建图谱的仓库）
  const inFlightRef = useRef<CodeGraphDetail[]>([]);
  inFlightRef.current = inFlight;
  useEffect(() => {
    if (!activeTeamId || inFlight.length === 0) return;
    const poll = async () => {
      const items = inFlightRef.current;
      if (items.length === 0) return;
      const toRemove: string[] = [];
      const updates: CodeGraphDetail[] = [];
      for (const item of items) {
        if (!item.code_graph_id) continue;
        try {
          const detail = await knowledgeApi.code.get(item.code_graph_id);
          if (detail.status === 'ready' || detail.status === 'failed') {
            if (detail.status === 'ready') {
              try { await knowledgeApi.code.registerMeta(activeTeamId, detail.code_graph_id); } catch { /* idempotent */ }
            }
            toRemove.push(detail.code_graph_id);
            void fetchSources();
          } else if (detail.status !== item.status) {
            updates.push(detail);
          }
        } catch { /* transient poll error, ignore */ }
      }
      if (toRemove.length || updates.length) {
        setInFlight((prev) => {
          let next = prev;
          if (toRemove.length) {
            const removeSet = new Set(toRemove);
            next = next.filter((x) => !removeSet.has(x.code_graph_id));
          }
          if (updates.length) {
            const updMap = new Map(updates.map((u) => [u.code_graph_id, u]));
            next = next.map((x) => updMap.get(x.code_graph_id) ?? x);
          }
          return next;
        });
      }
    };
    void poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [activeTeamId, inFlight.length, fetchSources]);

  // 列表合并 in-flight（刚上传的仓库先占位显示）
  const displaySources = useMemo(() => {
    const ids = new Set(sources.map((s) => s.code_graph_id));
    const extras = inFlight.filter((x) => x.code_graph_id && !ids.has(x.code_graph_id));
    return [...extras, ...sources];
  }, [sources, inFlight]);

  const loadCredentials = useCallback(async () => {
    try {
      const d = await gitCredentialsApi.list();
      setCredentialList(d.items ?? []);
    } catch {
      setCredentialList([]);
    }
  }, []);

  useEffect(() => {
    if (showUpload) void loadCredentials();
  }, [showUpload, loadCredentials]);

  const handleUpload = async () => {
    const repo = formRepo.trim();
    if (!repo || !formBranch.trim() || !activeTeamId) return;
    const urlOk =
      formAuthKind === 'ssh' || formAuthKind === 'saved'
        ? isValidSshGitUrl(repo) || isValidGitHttpUrl(repo)
        : isValidGitHttpUrl(repo);
    if (!urlOk) {
      tea.notify.error(t('analysis.upload.invalidUrl'));
      return;
    }

    // 认证：none 则无；saved 从凭据库取；password/token/ssh 用内联输入。
    let auth: GitAuthInput | undefined;
    if (formAuthKind === 'saved') {
      if (!formCredentialId) {
        tea.notify.error(t('analysis.upload.authSelectRequired'));
        return;
      }
      try {
        const full = await gitCredentialsApi.get(formCredentialId);
        auth = {
          kind: full.auth_type,
          username: full.username ?? null,
          secret: full.secret,
          passphrase: full.passphrase ?? null,
        };
      } catch (e: any) {
        tea.notify.error(e?.message || String(e));
        return;
      }
    } else if (formAuthKind !== 'none') {
      const secret = formAuthSecret;
      if (!secret) {
        tea.notify.error(t('analysis.upload.authSecretRequired'));
        return;
      }
      if (formAuthKind === 'password' && !formAuthUsername.trim()) {
        tea.notify.error(t('analysis.upload.authUsernameRequired'));
        return;
      }
      auth = {
        kind: formAuthKind,
        username: formAuthKind === 'ssh' ? null : formAuthUsername.trim() || null,
        secret,
        passphrase: formAuthKind === 'ssh' && formAuthPassphrase ? formAuthPassphrase : null,
      };
    }

    setSubmitting(true);
    try {
      const detail = await knowledgeApi.code.create(activeTeamId, repo, formBranch.trim(), formName.trim() || repo, auth);
      setShowUpload(false);
      setFormRepo('');
      setFormBranch('main');
      setFormName('');
      setFormAuthKind('none');
      setFormAuthUsername('');
      setFormAuthSecret('');
      setFormAuthPassphrase('');
      setFormCredentialId('');
      setInFlight((prev) => [...prev.filter((x) => x.code_graph_id !== detail.code_graph_id), detail]);
      tea.notify.info(t('analysis.upload.done'));
      void fetchSources();
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    setDetectResult(null);
    try {
      const det = await knowledgeApi.code.detectWorkspace(detectPath.trim() || undefined);
      setDetectResult(det);
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
    } finally {
      setDetecting(false);
    }
  };

  const handleUploadDetected = async (repo: { remote_url: string | null; branch: string | null; path: string }) => {
    if (!repo.remote_url || !activeTeamId) {
      tea.notify.error(t('analysis.detect.noRemote'));
      return;
    }
    const key = repo.remote_url;
    setDetectUploading(key);
    try {
      const detail = await knowledgeApi.code.create(activeTeamId, repo.remote_url, repo.branch ?? 'main', undefined);
      setInFlight((prev) => [...prev.filter((x) => x.code_graph_id !== detail.code_graph_id), detail]);
      tea.notify.info(t('analysis.upload.done'));
      void fetchSources();
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
    } finally {
      setDetectUploading(null);
    }
  };

  const handleDelete = async (cgId: string) => {
    const s = displaySources.find((x) => x.code_graph_id === cgId);
    if (!s) return;
    const ok = await tea.confirm({
      message: t('analysis.delete.confirm', {
        name: formatRepoName(s.repo_name, s.repo_url),
        branch: s.branch,
      }),
      okText: t('analysis.shell.delete'),
    });
    if (!ok) return;
    try {
      await knowledgeApi.code.delete(cgId);
      setSources((prev) => prev.filter((x) => x.code_graph_id !== cgId));
      setInFlight((prev) => prev.filter((x) => x.code_graph_id !== cgId));
      tea.notify.success(t('analysis.deleted'));
      void fetchSources();
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
    }
  };

  const enterRepo = useCallback(
    (cgId: string) => navigate(`/analysis/${cgId}`),
    [navigate],
  );

  const columns = [
    {
      key: 'repo_name',
      header: t('analysis.shell.col.repo'),
      width: 280,
      render: (source: CodeGraphDetail) => (
        <button type="button" className="_analysis-shell-row-name" onClick={() => enterRepo(source.code_graph_id)}>
          <CodeIcon size={14} />
          <span className="_analysis-shell-repo-main">
            <span className="_analysis-shell-repo-name">{formatRepoName(source.repo_name, source.repo_url)}</span>
            <span className="_analysis-shell-repo-url">{source.repo_url}</span>
          </span>
        </button>
      ),
    },
    {
      key: 'branch',
      header: t('analysis.shell.col.branch'),
      width: 180,
      render: (source: CodeGraphDetail) => (
        <span className="_analysis-shell-branch">
          <span>{source.branch}</span>
          {source.commit_hash && <span className="_analysis-shell-mono">@ {source.commit_hash}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('analysis.shell.col.status'),
      width: 130,
      render: (source: CodeGraphDetail) => statusLabel(t, source.status),
    },
    {
      key: 'stats',
      header: t('analysis.shell.col.stats'),
      width: 170,
      render: (source: CodeGraphDetail) =>
        source.stats ? (
          <span className="_analysis-shell-stats">
            <span>{t('analysis.shell.files')} {source.stats.files.toLocaleString()}</span>
            <span>{t('analysis.shell.nodes')} {source.stats.nodes.toLocaleString()}</span>
            <span>{t('analysis.shell.edges')} {source.stats.edges.toLocaleString()}</span>
          </span>
        ) : (
          <Text theme="label">—</Text>
        ),
    },
    {
      key: 'last_sync_at',
      header: t('analysis.shell.col.lastSync'),
      width: 140,
      render: (source: CodeGraphDetail) => <Text theme="label">{formatShortTime(source.last_sync_at)}</Text>,
    },
    {
      key: 'actions',
      header: t('analysis.shell.col.actions'),
      width: 200,
      fixed: 'right' as const,
      render: (source: CodeGraphDetail) => {
        const ready = source.status === 'ready';
        return (
          <div className="_analysis-shell-actions">
            <Button
              type="link"
              disabled={!ready}
              onClick={() => enterRepo(source.code_graph_id)}
              title={ready ? '' : t('analysis.shell.enter')}
            >
              {t('analysis.shell.enter')}
            </Button>
            <Button
              type="link"
              className="_analysis-shell-delete"
              onClick={() => handleDelete(source.code_graph_id)}
            >
              {t('analysis.shell.delete')}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <ResourcePage>
      <div className="_analysis-shell">
        <Justify
          className="_analysis-shell-header"
          left={
            <div className="_analysis-shell-heading">
              <h2 className="_analysis-shell-title">{t('menu.analysis')}</h2>
              <Text theme="label" className="_analysis-shell-subtitle">
                {t('analysis.shell.subtitle', { count: displaySources.length })}
              </Text>
            </div>
          }
          right={
            <div className="_analysis-shell-header-actions">
              <Button type="weak" onClick={() => void fetchSources()}>
                <RefreshIcon size={14} />
                {t('analysis.shell.refresh')}
              </Button>
              {scope === 'team' && (
                <>
                  <Button type="weak" onClick={() => setShowDetect(true)}>
                    <RefreshIcon size={14} />
                    {t('analysis.detect.title')}
                  </Button>
                  <Button type="primary" onClick={() => setShowUpload(true)}>
                    <UploadIcon size={14} />
                    {t('analysis.shell.upload')}
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* 维度切换：团队 / 项目 / Agent / 用户 */}
        <div className="_analysis-shell-scope">
          <Segment
            value={scope}
            onChange={(v) => setScope(v as AnalysisScope)}
            options={(Object.keys(SCOPE_LABEL_KEY) as AnalysisScope[]).map((s) => ({
              value: s,
              text: t(SCOPE_LABEL_KEY[s]),
            }))}
          />
          {scope === 'team' && (
            <Select
              appearance="button"
              matchButtonWidth
              value={selectedTeam || activeTeamId || ''}
              onChange={(v) => setSelectedTeam(v === activeTeamId ? '' : v)}
              placeholder={t('analysis.scope.teamPlaceholder')}
              options={teams.map((tm) => ({ value: tm.team_id, text: `${tm.name}（${tm.team_id}）` }))}
            />
          )}
          {scope === 'project' && (
            <Select
              appearance="button"
              matchButtonWidth
              value={selectedProject}
              onChange={(v) => setSelectedProject(v)}
              placeholder={t('analysis.scope.projectPlaceholder')}
              options={projects.map((p) => ({ value: p.project_id, text: `${p.name}（${p.project_id}）` }))}
            />
          )}
          {scope === 'agent' && (
            <Select
              appearance="button"
              matchButtonWidth
              value={selectedAgent}
              onChange={(v) => setSelectedAgent(v)}
              placeholder={t('analysis.scope.agentPlaceholder')}
              options={teamAgents.map((a) => ({ value: a.agent_id, text: `${a.name}（${a.agent_id}）` }))}
            />
          )}
          {scope === 'user' && isAdmin && (
            <Select
              appearance="button"
              matchButtonWidth
              value={selectedOwner}
              onChange={(v) => setSelectedOwner(v)}
              placeholder={t('analysis.scope.userPlaceholder')}
              options={[
                { value: '', text: t('analysis.scope.self') },
                ...allUsers
                  .filter((u) => u.user_id !== myUserId)
                  .map((u) => ({ value: u.user_id, text: `${u.username}（${u.user_id}）` })),
              ]}
            />
          )}
        </div>

        {loading ? (
          <StatusTip status="loading" loadingText={t('common.loading')} />
        ) : displaySources.length === 0 ? (
          <StatusTip
            status="empty"
            emptyText={
              <div className="_analysis-shell-empty">
                <CodeIcon size="large" />
                <Text>{t('analysis.shell.empty')}</Text>
              </div>
            }
          />
        ) : (
          <Table
            records={displaySources}
            recordKey="code_graph_id"
            columns={columns}
            addons={[scrollable({ minWidth: 1080 }), autotip({ emptyText: t('analysis.shell.empty') })]}
          />
        )}
      </div>

      {/* 上传 Git 仓库弹窗 */}
      <Modal
        visible={showUpload}
        caption={t('analysis.upload.title')}
        onClose={() => setShowUpload(false)}
      >
        <Modal.Body>
          <Form>
            <Form.Item label={t('analysis.upload.repoUrl')} required>
              <Input
                size="full"
                value={formRepo}
                onChange={(v) => setFormRepo(v)}
                placeholder={t('analysis.upload.repoUrlPlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('analysis.upload.branch')} required>
              <Input
                size="full"
                value={formBranch}
                onChange={(v) => setFormBranch(v)}
              />
            </Form.Item>
            <Form.Item label={t('analysis.upload.repoName')}>
              <Input
                size="full"
                value={formName}
                onChange={(v) => setFormName(v)}
                placeholder={t('analysis.upload.repoNamePlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('analysis.upload.auth')}>
              <Segment
                value={formAuthKind}
                onChange={(v) => setFormAuthKind(v as 'none' | 'password' | 'token' | 'ssh' | 'saved')}
                options={[
                  { value: 'none', text: t('analysis.upload.authNone') },
                  { value: 'password', text: t('analysis.upload.authPassword') },
                  { value: 'token', text: t('analysis.upload.authToken') },
                  { value: 'ssh', text: t('analysis.upload.authSsh') },
                  { value: 'saved', text: t('analysis.upload.authSaved') },
                ]}
              />
            </Form.Item>
            {formAuthKind === 'saved' ? (
              <Form.Item label={t('analysis.upload.authSaved')} required>
                <div className="_analysis-auth-saved">
                  <Select
                    size="full"
                    type="simulate"
                    appearance="button"
                    value={formCredentialId}
                    onChange={(v) => setFormCredentialId(v)}
                    options={credentialList.map((c) => ({
                      value: c.credential_id,
                      text: `${c.name}${c.host ? ` (${c.host})` : ''}`,
                    }))}
                    placeholder={t('analysis.upload.authSavedPlaceholder')}
                  />
                  <Button type="link" onClick={() => setShowCredManager(true)}>
                    {t('analysis.upload.manageCreds')}
                  </Button>
                </div>
              </Form.Item>
            ) : null}
            {formAuthKind === 'password' || formAuthKind === 'token' ? (
              <Form.Item label={t('analysis.upload.authUsername')} required={formAuthKind === 'password'}>
                <Input
                  size="full"
                  value={formAuthUsername}
                  onChange={(v) => setFormAuthUsername(v)}
                  placeholder={formAuthKind === 'password' ? 'git' : 'oauth2'}
                />
              </Form.Item>
            ) : null}
            {formAuthKind === 'password' || formAuthKind === 'token' ? (
              <Form.Item label={t('analysis.upload.authSecret')} required>
                <Input.Password
                  size="full"
                  value={formAuthSecret}
                  onChange={(v) => setFormAuthSecret(v)}
                />
              </Form.Item>
            ) : null}
            {formAuthKind === 'ssh' ? (
              <>
                <Form.Item label={t('analysis.upload.authSecret')} required>
                  <Input.TextArea
                    size="full"
                    rows={6}
                    value={formAuthSecret}
                    onChange={(v) => setFormAuthSecret(v)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  />
                </Form.Item>
                <Form.Item label={t('analysis.upload.authPassphrase')}>
                  <Input.Password
                    size="full"
                    value={formAuthPassphrase}
                    onChange={(v) => setFormAuthPassphrase(v)}
                  />
                </Form.Item>
              </>
            ) : null}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="weak" onClick={() => setShowUpload(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={!formRepo.trim() || !formBranch.trim()}
            onClick={handleUpload}
          >
            {submitting ? t('analysis.upload.submitting') : t('analysis.upload.submit')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 检测 harness 工作区弹窗（req-2） */}
      <Modal
        visible={showDetect}
        caption={t('analysis.detect.title')}
        onClose={() => { setShowDetect(false); setDetectResult(null); }}
      >
        <Modal.Body>
          <Form>
            <Form.Item label={t('analysis.detect.path')}>
              <Input
                size="full"
                value={detectPath}
                onChange={(v) => setDetectPath(v)}
                placeholder={t('analysis.detect.pathPlaceholder')}
              />
            </Form.Item>
          </Form>
          {detectResult ? (
            <div className="_analysis-detect-result">
              {detectResult.git_repos.length > 0 ? (
                <div>
                  <Text theme="label">
                    {t('analysis.detect.found', { count: detectResult.git_repos.length })}
                  </Text>
                  {detectResult.git_repos.map((r) => {
                    const key = r.remote_url ?? r.path;
                    return (
                      <div key={r.path} className="_analysis-detect-repo">
                        <div className="_analysis-detect-repo-main">
                          <div className="_analysis-detect-repo-url">{r.remote_url ?? r.path}</div>
                          <div className="_analysis-detect-repo-meta">
                            {r.branch ? `${t('analysis.shell.col.branch')}: ${r.branch} · ` : ''}{r.path}
                          </div>
                        </div>
                        <Button
                          type="primary"
                          loading={detectUploading === key}
                          disabled={!r.remote_url}
                          onClick={() => handleUploadDetected(r)}
                        >
                          {t('analysis.detect.upload')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Text theme="label">
                  {detectResult.has_code ? t('analysis.detect.codeOnly') : t('analysis.detect.empty')}
                </Text>
              )}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button type="weak" onClick={() => { setShowDetect(false); setDetectResult(null); }}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" loading={detecting} onClick={handleDetect}>
            {t('analysis.detect.detect')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 私有 git 凭据管理（req-1 补充：保存/复用凭据） */}
      <GitCredentialManager
        visible={showCredManager}
        onClose={() => setShowCredManager(false)}
        onChanged={() => void loadCredentials()}
      />
    </ResourcePage>
  );
}