/**
 * GitNexusPage —— 高级代码分析模块。
 * 直接嵌入 TencentDB 系统，使用 CodeGraphInstance 数据，无需网络互访。
 */
import { useState, useEffect, useCallback } from 'react';
import { ResourcePage } from '@/pages/ResourcePage';
import { knowledgeApi, type CodeGraphDetail } from '@/lib/knowledge-api';
import { useTeams } from '@/services';
import GitNexusPanel from './components/GitNexusPanel';

export function GitNexusPage() {
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

  return (
    <ResourcePage>
      <GitNexusPanel
        codeSources={sources}
        loading={loading}
      />
    </ResourcePage>
  );
}