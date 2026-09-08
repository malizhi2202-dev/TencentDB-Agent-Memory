/**
 * CodeAnalysisPage —— 代码分析工作台（左侧边栏 6 个功能入口共用）。
 *
 * 功能拆解自 GitNexus（代码级集成，不走网络路由）：
 *   - /analysis/search     → 搜索与查询
 *   - /analysis/symbol     → 符号分析
 *   - /analysis/change     → 变更管理
 *   - /analysis/discovery  → API 与工具发现
 *   - /analysis/type       → 类型系统
 *   - /analysis/cross      → 跨仓库
 *
 * 工具经浏览器直连 KS /v3/tools/call 统一工具通道执行（gitnexus_ 前缀）。
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ResourcePage } from '@/pages/ResourcePage';
import { knowledgeApi, type CodeGraphDetail } from '@/lib/knowledge-api';
import { useTeams } from '@/services';
import { ANALYSIS_TOOL_CATEGORIES } from './constants';
import AnalysisWorkbench from './components/AnalysisWorkbench';

export function CodeAnalysisPage() {
  const { category = 'search' } = useParams<{ category: string }>();
  const { activeTeamId } = useTeams();
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
      setSources(items);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [activeTeamId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const initialCategory = ANALYSIS_TOOL_CATEGORIES.some((c) => c.key === category)
    ? category
    : 'search';

  return (
    <ResourcePage>
      <AnalysisWorkbench
        initialCategory={initialCategory}
        codeSources={sources}
        loading={loading}
      />
    </ResourcePage>
  );
}
