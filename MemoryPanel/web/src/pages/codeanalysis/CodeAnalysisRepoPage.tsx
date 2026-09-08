/**
 * CodeAnalysisRepoPage —— 单个仓库的「代码分析 + 代码图谱」详情页。
 *
 * 由 AnalysisShellPage 点进仓库后进入本页（/analysis/:cgId）。
 * 顶部面包屑返回仓库列表，tabs 切换「代码分析」与「代码图谱」两个视图。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Segment, StatusTip, Text } from 'tea-component';
import { ArrowLeftIcon } from 'tea-icons-react';
import { knowledgeApi, type CodeGraphDetail } from '@/lib/knowledge-api';
import { useTeams } from '@/services';
import { formatRepoName } from '@/pages/code/CodePage/components/code-constants';
import AnalysisWorkbench from './components/AnalysisWorkbench';
import { CodeGraphPage } from '@/pages/codegraph/CodeGraphPage';
import './code-analysis-repo.css';

type RepoTab = 'analysis' | 'graph';

export function CodeAnalysisRepoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cgId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTeamId } = useTeams();

  const initialTab: RepoTab = searchParams.get('tab') === 'graph' ? 'graph' : 'analysis';
  const [tab, setTab] = useState<RepoTab>(initialTab);

  const [sources, setSources] = useState<CodeGraphDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    if (!activeTeamId) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await knowledgeApi.code.teamAssets(activeTeamId);
      setSources(Array.isArray(items) ? items : []);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [activeTeamId]);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  const source = useMemo(() => sources.find((s) => s.code_graph_id === cgId), [sources, cgId]);

  const changeTab = useCallback(
    (v: RepoTab) => {
      setTab(v);
      setSearchParams(v === 'graph' ? { tab: 'graph' } : {}, { replace: true });
    },
    [setSearchParams],
  );

  if (loading) return <StatusTip status="loading" loadingText={t('common.loading')} />;
  if (!source) {
    return (
      <div className="_analysis-repo-notfound">
        <StatusTip status="empty" emptyText={t('analysis.detail.notFound')} />
        <Button type="link" onClick={() => navigate('/analysis')}>
          <ArrowLeftIcon size={12} /> {t('analysis.detail.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="_analysis-repo">
      <div className="_analysis-repo-breadcrumb">
        <Button type="link" onClick={() => navigate('/analysis')}>
          <span className="_analysis-repo-inline-icon">
            <ArrowLeftIcon size={12} /> {t('analysis.detail.back')}
          </span>
        </Button>
        <span className="_analysis-repo-sep">/</span>
        <span className="_analysis-repo-name">{formatRepoName(source.repo_name, source.repo_url)}</span>
        <Text theme="label" className="_analysis-repo-branch">
          {source.branch}
        </Text>
      </div>

      <div className="_analysis-repo-tabbar">
        <Segment
          value={tab}
          onChange={(v) => changeTab(v as RepoTab)}
          options={[
            { value: 'analysis', text: t('analysis.detail.tabAnalysis') },
            { value: 'graph', text: t('analysis.detail.tabGraph') },
          ]}
        />
      </div>

      <div className="_analysis-repo-content">
        {tab === 'analysis' ? (
          <AnalysisWorkbench
            initialCategory="search"
            codeSources={sources}
            loading={loading}
            fixedCgId={cgId}
          />
        ) : (
          <CodeGraphPage fixedCgId={cgId} embedded />
        )}
      </div>
    </div>
  );
}