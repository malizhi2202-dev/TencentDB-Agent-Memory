/**
 * GitNexusPanel —— GitNexus 高级代码分析面板。
 * 选择一个 code-graph 实例 → 按类别浏览 17 个工具 → 执行并查看结果。
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Card, Form, Input, InputNumber, Select,
  StatusTip, Switch, Text,
} from 'tea-component';
import { CaretDownIcon, CaretRightIcon, RelativityIcon } from 'tea-icons-react';
import { knowledgeApi, type CodeGraphDetail } from '@/lib/knowledge-api';
import { AssetMarkdown } from '@/pages/ResourcePage/components/AssetMarkdown';
import {
  GITNEXUS_TOOL_CATEGORIES,
  type GitNexusToolDef,
  type GitNexusToolParam,
} from './gitnexus-constants';
import './gitnexus-panel.css';

interface Props {
  codeSources: CodeGraphDetail[];
  loading: boolean;
}

export default function GitNexusPanel({ codeSources, loading }: Props) {
  const { t } = useTranslation();

  // State
  const [selectedCgId, setSelectedCgId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['search']));
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{ text: string; isError: boolean } | null>(null);
  const [executing, setExecuting] = useState(false);

  // Derived
  const readySources = useMemo(
    () => codeSources.filter((s) => s.status === 'ready'),
    [codeSources],
  );

  const selectedSource = useMemo(
    () => readySources.find((s) => s.code_graph_id === selectedCgId),
    [readySources, selectedCgId],
  );

  // Auto-select first ready source
  React.useEffect(() => {
    if (!selectedCgId && readySources.length > 0) {
      setSelectedCgId(readySources[0].code_graph_id);
    }
  }, [readySources, selectedCgId]);

  // Helpers
  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectTool = useCallback((tool: GitNexusToolDef) => {
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
      const res = await knowledgeApi.gitnexus.query(activeTool, selectedCgId, toolParams);
      setResult(res);
    } catch (err: any) {
      setResult({ text: err.message || String(err), isError: true });
    } finally {
      setExecuting(false);
    }
  }, [activeTool, selectedCgId, toolParams]);

  const activeToolDef = useMemo(
    () => {
      for (const cat of GITNEXUS_TOOL_CATEGORIES) {
        const found = cat.tools.find((t) => t.name === activeTool);
        if (found) return found;
      }
      return null;
    },
    [activeTool],
  );

  // Render
  return (
    <div className="_gitnexus-page">
      {/* Top bar: source selector */}
      <div className="_gitnexus-topbar">
        <div className="_gitnexus-source-select">
          <Select
            appearance="button"
            matchButtonWidth
            size="m"
            value={selectedCgId}
            onChange={(v) => { setSelectedCgId(v); setActiveTool(null); setResult(null); }}
            disabled={loading || readySources.length === 0}
            placeholder={t('gitnexus.selectRepo')}
            options={readySources.map((s) => ({
              value: s.code_graph_id,
              text: `${s.repo_name || s.repo_url} (${s.branch})`,
            }))}
          />
          {selectedSource?.stats && (
            <Text theme="label" className="_gitnexus-stats">
              {t('gitnexus.stats', {
                nodes: selectedSource.stats.nodes.toLocaleString(),
                files: selectedSource.stats.files.toLocaleString(),
              })}
            </Text>
          )}
        </div>
      </div>

      {loading ? (
        <StatusTip status="loading" loadingText={t('common.loading')} />
      ) : readySources.length === 0 ? (
        <StatusTip status="empty" emptyText={t('gitnexus.noReady')} />
      ) : (
        <div className="_gitnexus-body">
          {/* Left: tool categories */}
          <div className="_gitnexus-sidebar">
            <Text theme="strong" className="_gitnexus-sidebar-title">{t('gitnexus.tools')}</Text>
            {GITNEXUS_TOOL_CATEGORIES.map((cat) => (
              <div key={cat.key} className="_gitnexus-category">
                <button
                  type="button"
                  className="_gitnexus-category-toggle"
                  onClick={() => toggleCategory(cat.key)}
                >
                  {expandedCategories.has(cat.key) ? <CaretDownIcon size={14} /> : <CaretRightIcon size={14} />}
                  <span>{cat.label}</span>
                  <Text theme="label" className="_gitnexus-category-count">{cat.tools.length}</Text>
                </button>
                {expandedCategories.has(cat.key) && (
                  <div className="_gitnexus-tool-list">
                    {cat.tools.map((tool) => (
                      <button
                        key={tool.name}
                        type="button"
                        className={`_gitnexus-tool-item ${activeTool === tool.name ? 'is-active' : ''}`}
                        onClick={() => selectTool(tool)}
                        title={tool.description}
                      >
                        <RelativityIcon size={14} />
                        <span>{tool.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: tool form + result */}
          <div className="_gitnexus-main">
            {!activeTool ? (
              <div className="_gitnexus-empty">
                <RelativityIcon size="large" />
                <Text>{t('gitnexus.selectTool')}</Text>
                <Text theme="label">{t('gitnexus.selectToolDesc')}</Text>
              </div>
            ) : (
              <>
                {/* Tool header */}
                <div className="_gitnexus-tool-header">
                  <div className="_gitnexus-tool-header-info">
                    <Text theme="strong">{activeToolDef?.label}</Text>
                    <Text theme="label">{activeToolDef?.description}</Text>
                  </div>
                  <Button
                    type="primary"
                    icon={executing ? undefined : 'play'}
                    loading={executing}
                    onClick={handleExecute}
                    disabled={!selectedCgId}
                  >
                    {executing ? t('gitnexus.executing') : t('gitnexus.execute')}
                  </Button>
                </div>

                {/* Params */}
                {activeToolDef && activeToolDef.params.length > 0 && (
                  <Card className="_gitnexus-params-card">
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

                {/* Result */}
                {result && (
                  <Card className="_gitnexus-result-card">
                    <Card.Body>
                      <div className="_gitnexus-result-header">
                        <Text theme="strong">{t('gitnexus.result')}</Text>
                        {result.isError && (
                          <Text theme="danger">{t('gitnexus.error')}</Text>
                        )}
                      </div>
                      <div className="_gitnexus-result-body">
                        <AssetMarkdown content={result.text} />
                      </div>
                    </Card.Body>
                  </Card>
                )}

                {executing && !result && (
                  <Card className="_gitnexus-result-card">
                    <Card.Body>
                      <StatusTip status="loading" loadingText={t('gitnexus.executing')} />
                    </Card.Body>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderParamInput(
  param: GitNexusToolParam,
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