/**
 * AnalysisWorkbench —— 代码分析工作台。
 * 左侧边栏 6 个功能入口（搜索与查询 / 符号分析 / 变更管理 / API 与工具发现 / 类型系统 / 跨仓库）
 * 共用本组件，通过 initialCategory 预选分类。
 * 工具经浏览器直连 KS /v3/tools/call 统一通道执行（不走 Panel 网络代理）。
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Card, Form, Input, InputNumber, Select,
  StatusTip, Switch, Text,
} from 'tea-component';
import { RelativityIcon } from 'tea-icons-react';
import { knowledgeApi, type CodeGraphDetail } from '@/lib/knowledge-api';
import { AssetMarkdown } from '@/pages/ResourcePage/components/AssetMarkdown';
import {
  ANALYSIS_TOOL_CATEGORIES,
  type AnalysisToolDef,
  type AnalysisToolParam,
} from '../constants';
import './analysis-workbench.css';

interface ToolHistoryItem {
  tool: string;
  cgId: string;
  params: Record<string, unknown>;
  timestamp: number;
}

interface Props {
  initialCategory: string;
  codeSources: CodeGraphDetail[];
  loading: boolean;
  /** 固定仓库（仓库详情页传入）：锁定仓库，隐藏顶部仓库选择器 */
  fixedCgId?: string;
  toolHistory?: ToolHistoryItem[];
  onToolExecuted?: (tool: string, cgId: string, params: Record<string, unknown>) => void;
  onHistorySelect?: (item: ToolHistoryItem) => ToolHistoryItem;
}

export default function AnalysisWorkbench({ initialCategory, codeSources, loading, fixedCgId, toolHistory = [], onToolExecuted }: Props) {
  const { t } = useTranslation();

  const [selectedCgId, setSelectedCgId] = useState<string>(fixedCgId ?? '');
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{ text: string; isError: boolean } | null>(null);
  const [executing, setExecuting] = useState(false);

  const readySources = useMemo(
    () => codeSources.filter((s) => s.status === 'ready'),
    [codeSources],
  );

  const selectedSource = useMemo(
    () => readySources.find((s) => s.code_graph_id === selectedCgId) ?? (fixedCgId ? codeSources.find((s) => s.code_graph_id === fixedCgId) : undefined),
    [readySources, codeSources, selectedCgId, fixedCgId],
  );

  React.useEffect(() => {
    if (fixedCgId) {
      setSelectedCgId(fixedCgId);
      return;
    }
    if (!selectedCgId && readySources.length > 0) {
      setSelectedCgId(readySources[0].code_graph_id);
    }
  }, [fixedCgId, readySources, selectedCgId]);

  const activeCategoryDef = useMemo(
    () => ANALYSIS_TOOL_CATEGORIES.find((c) => c.key === activeCategory) ?? ANALYSIS_TOOL_CATEGORIES[0],
    [activeCategory],
  );

  const activeToolDef = useMemo(
    () => activeCategoryDef.tools.find((t2) => t2.name === activeTool) ?? null,
    [activeCategoryDef, activeTool],
  );

  const selectCategory = useCallback((key: string) => {
    setActiveCategory(key);
    setActiveTool(null);
    setResult(null);
    setToolParams({});
  }, []);

  const selectTool = useCallback((tool: AnalysisToolDef) => {
    setActiveTool(tool.name);
    const defaults: Record<string, unknown> = {};
    for (const p of tool.params) {
      if (p.default !== undefined) defaults[p.name] = p.default;
    }
    setToolParams(defaults);
    setResult(null);
  }, []);

  const handleParamChange = useCallback((name: string, value: unknown) => {
    setToolParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!activeTool || !selectedCgId) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await knowledgeApi.codeAnalysis.call(activeTool, selectedCgId, toolParams);
      setResult(res);
      onToolExecuted?.(activeTool, selectedCgId, { ...toolParams });
    } catch (err: any) {
      setResult({ text: err.message || String(err), isError: true });
    } finally {
      setExecuting(false);
    }
  }, [activeTool, selectedCgId, toolParams]);

  return (
    <div className="_analysis-page">
      <div className="_analysis-topbar">
        <div className="_analysis-source-select">
          {fixedCgId ? (
            selectedSource && (
              <Text theme="label" className="_analysis-stats">
                {selectedSource.repo_name || selectedSource.repo_url} ({selectedSource.branch}) —{' '}
                {t('analysis.stats', {
                  nodes: (selectedSource.stats?.nodes ?? 0).toLocaleString(),
                  files: (selectedSource.stats?.files ?? 0).toLocaleString(),
                })}
              </Text>
            )
          ) : (
            <Select
              appearance="button"
              matchButtonWidth
              size="m"
              value={selectedCgId}
              onChange={(v) => { setSelectedCgId(v); setActiveTool(null); setResult(null); }}
              disabled={loading || readySources.length === 0}
              placeholder={t('analysis.selectRepo')}
              options={readySources.map((s) => ({
                value: s.code_graph_id,
                text: `${s.repo_name || s.repo_url} (${s.branch})`,
              }))}
            />
          )}
          {selectedSource?.stats && !fixedCgId && (
            <Text theme="label" className="_analysis-stats">
              {t('analysis.stats', {
                nodes: selectedSource.stats.nodes.toLocaleString(),
                files: selectedSource.stats.files.toLocaleString(),
              })}
            </Text>
          )}
        </div>
      </div>

      <div className="_analysis-tabs">
        {ANALYSIS_TOOL_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`_analysis-tab ${activeCategory === cat.key ? 'is-active' : ''}`}
            onClick={() => selectCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <StatusTip status="loading" loadingText={t('common.loading')} />
      ) : readySources.length === 0 ? (
        <StatusTip status="empty" emptyText={t('analysis.noReady')} />
      ) : (
        <div className="_analysis-body">
          <div className="_analysis-sidebar">
            <Text theme="strong" className="_analysis-sidebar-title">{activeCategoryDef.label}</Text>
            {activeCategoryDef.tools.map((tool) => (
              <button
                key={tool.name}
                type="button"
                className={`_analysis-tool-item ${activeTool === tool.name ? 'is-active' : ''}`}
                onClick={() => selectTool(tool)}
                title={tool.description}
              >
                <RelativityIcon size={14} />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>

          <div className="_analysis-main">
            {!activeTool ? (
              <div className="_analysis-empty">
                <RelativityIcon size="large" />
                <Text>{t('analysis.selectTool')}</Text>
                <Text theme="label">{t('analysis.selectToolDesc')}</Text>
              </div>
            ) : (
              <>
                <div className="_analysis-tool-header">
                  <div className="_analysis-tool-header-info">
                    <Text theme="strong">{activeToolDef?.label}</Text>
                    <Text theme="label">{activeToolDef?.description}</Text>
                  </div>
                  <Button
                    type="primary"
                    loading={executing}
                    onClick={handleExecute}
                    disabled={!selectedCgId}
                  >
                    {executing ? t('analysis.executing') : t('analysis.execute')}
                  </Button>
                </div>

                {activeToolDef && activeToolDef.params.length > 0 && (
                  <Card className="_analysis-params-card">
                    <Card.Body>
                      <Form>
                        {activeToolDef.params.map((param) => (
                          <Form.Item key={param.name} label={param.label}>
                            {renderParamInput(param, toolParams, handleParamChange)}
                          </Form.Item>
                        ))}
                      </Form>
                    </Card.Body>
                  </Card>
                )}

                {result && (
                  <Card className="_analysis-result-card">
                    <Card.Body>
                      <div className="_analysis-result-header">
                        <Text theme="strong">{t('analysis.result')}</Text>
                        {result.isError && (
                          <Text theme="danger">{t('analysis.error')}</Text>
                        )}
                      </div>
                      <div className="_analysis-result-body">
                        <AssetMarkdown content={result.text} />
                      </div>
                    </Card.Body>
                  </Card>
                )}

                {executing && !result && (
                  <Card className="_analysis-result-card">
                    <Card.Body>
                      <StatusTip status="loading" loadingText={t('analysis.executing')} />
                    </Card.Body>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tool execution history */}
      {toolHistory.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase">Recent Executions</h3>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {toolHistory.slice(0, 10).map((item, i) => (
              <button key={i} onClick={() => {
                setActiveTool(item.tool);
                setToolParams(item.params);
                if (item.cgId) setSelectedCgId(item.cgId);
              }} className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-gray-50 text-gray-600">
                <span className="font-mono text-blue-600">{item.tool}</span>
                <span className="text-gray-400 truncate">{JSON.stringify(item.params).slice(0, 40)}</span>
                <span className="ml-auto text-gray-300 text-[10px]">{new Date(item.timestamp).toLocaleTimeString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderParamInput(
  param: AnalysisToolParam,
  values: Record<string, unknown>,
  onChange: (name: string, value: unknown) => void,
): React.ReactNode {
  const value = values[param.name] ?? (param.default ?? '');

  switch (param.type) {
    case 'boolean':
      return (
        <Switch
          value={Boolean(value)}
          onChange={(v) => onChange(param.name, v)}
        />
      );
    case 'integer':
      return (
        <InputNumber
          value={Number(value) || 0}
          onChange={(v) => onChange(param.name, v)}
          min={1}
          max={500}
          style={{ width: 120 }}
        />
      );
    case 'string':
    default:
      return (
        <Input
          size="full"
          value={String(value)}
          onChange={(v) => onChange(param.name, v)}
          placeholder={param.placeholder}
        />
      );
  }
}