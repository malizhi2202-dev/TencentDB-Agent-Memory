/**
 * CodeAnalysisView —— 项目分析面板（语言/框架/数据库/组件/API/架构图）。
 */
import { useTranslation } from 'react-i18next';
import { Card, StatusTip, Table, Text, Button } from 'tea-component';
import { RefreshIcon } from 'tea-icons-react';
import { AssetMarkdown } from '@/pages/ResourcePage/components/AssetMarkdown';
import { MermaidBlock } from '@/components/MermaidBlock';
import type { ProjectAnalysis } from '@/lib/knowledge-api';
import { NODE_COLORS } from '@/pages/codegraph/constants';

// Node type colors — imported from codegraph/constants.ts (single source of truth)
const NODE_TYPE_COLORS = NODE_COLORS;

const CATEGORY_LABELS: Record<string, string> = {
  framework: '框架',
  database: '数据库',
  cache: '缓存',
  mq: '消息队列',
  tracing: '链路追踪',
  resilience: '容错/降级',
  llm: '大模型',
  other: '其他',
};

function formatMermaidBlock(diagram: string): string {
  if (!diagram) return '';
  return `\`\`\`mermaid\n${diagram}\n\`\`\``;
}

export function CodeAnalysisView({
  data,
  loading,
  onRefresh,
}: {
  data: ProjectAnalysis | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="_codedetail-center">
        <StatusTip status="loading" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="_codedetail-center">
        <StatusTip status="empty" emptyText={t('code.detail.analyze.empty')} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" onClick={onRefresh}>
            <RefreshIcon size={14} /> {t('code.detail.analyze.start')}
          </Button>
        </div>
      </div>
    );
  }

  const apiColumns = [
    { key: 'method', header: '方法', width: 80, render: (r: any) => <Text className="code-method">{r.method}</Text> },
    { key: 'path', header: '路径', render: (r: any) => <Text className="_codedetail-mono">{r.path}</Text> },
    { key: 'description', header: '说明', render: (r: any) => r.description || '—' },
  ];

  return (
    <div className="_codedetail-analyze">
      {/* 概览 */}
      <Card>
        <Card.Body title={t('code.detail.analyze.overview')}>
          <div className="_codedetail-info-grid">
            <Text theme="label">{t('code.detail.analyze.language')}</Text>
            <Text>{data.language}</Text>
            {data.languageVersion && (
              <>
                <Text theme="label">{t('code.detail.analyze.languageVersion')}</Text>
                <Text>{data.languageVersion}</Text>
              </>
            )}
            <Text theme="label">{t('code.detail.analyze.webFramework')}</Text>
            <Text>{data.webFramework ? `${data.webFramework.name} (${data.webFramework.details})` : '—'}</Text>
            <Text theme="label">{t('code.detail.analyze.files')}</Text>
            <Text>{data.fileStats.total}</Text>
            {data.codeMetrics && (
              <>
                <Text theme="label">{t('code.detail.analyze.totalLines')}</Text>
                <Text>{data.codeMetrics.totalLines.toLocaleString()}</Text>
                <Text theme="label">{t('code.detail.analyze.testFiles')}</Text>
                <Text>{data.codeMetrics.testFiles}</Text>
                <Text theme="label">{t('code.detail.analyze.functionCount')}</Text>
                <Text>{data.codeMetrics.functionCount}</Text>
                <Text theme="label">{t('code.detail.analyze.classCount')}</Text>
                <Text>{data.codeMetrics.classCount}</Text>
              </>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* 数据库 */}
      {data.databases.length > 0 && (
        <Card>
          <Card.Body title={t('code.detail.analyze.databases')}>
            <div className="_codedetail-tag-list">
              {data.databases.map((db) => (
                <span key={db.name} className="_codedetail-tag _codedetail-tag-db">
                  {db.name}
                  <span className="_codedetail-tag-sub">{db.details}</span>
                </span>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* 组件 */}
      {data.components.length > 0 && (
        <Card>
          <Card.Body title={t('code.detail.analyze.components')}>
            <div className="_codedetail-tag-list">
              {data.components.map((c) => (
                <span key={c.name} className="_codedetail-tag _codedetail-tag-comp">
                  <span className="_codedetail-tag-cat">{CATEGORY_LABELS[c.category] || c.category}</span>
                  {c.name}
                  <span className="_codedetail-tag-sub">{c.details}</span>
                </span>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* 依赖 */}
      {data.dependencies && data.dependencies.length > 0 && (
        <Card>
          <Card.Body title={t('code.detail.analyze.dependencies', { count: data.dependencies.length })}>
            <div className="_codedetail-tag-list">
              {data.dependencies.map((d) => (
                <span key={d.name} className="_codedetail-tag _codedetail-tag-comp">
                  <span className="_codedetail-tag-cat">{CATEGORY_LABELS[d.category] || d.category}</span>
                  {d.name}
                  <span className="_codedetail-tag-sub">{d.version}</span>
                </span>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* 图谱实体与关系 */}
      {(data.nodeTypes || data.edgeCount != null) && (
        <Card>
          <Card.Body title={t('code.detail.analyze.graphEntities', { count: Object.values(data.nodeTypes ?? {}).reduce((a, b) => a + b, 0) })}>
            <p className="_codedetail-graph-desc">{t('code.detail.analyze.graphDesc')}</p>
            {data.nodeTypes && Object.keys(data.nodeTypes).length > 0 && (
              <div className="_codedetail-tag-list">
                {Object.entries(data.nodeTypes)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <span key={type} className="_codedetail-tag _codedetail-tag-comp">
                      <span className="_codedetail-tag-dot" style={{ background: NODE_TYPE_COLORS[type] ?? '#9096a3' }} />
                      {type}
                      <span className="_codedetail-tag-sub">{count}</span>
                    </span>
                  ))}
              </div>
            )}
            {data.edgeCount != null && (
              <div style={{ marginTop: data.nodeTypes ? 8 : 0 }}>
                <Text theme="label">{t('code.detail.analyze.graphRelations', { count: data.edgeCount })}</Text>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* 热点文件 — CodeScene 风格复杂度热力图 */}
      {data.hotspots && data.hotspots.length > 0 && (
        <Card>
          <Card.Body title={t('code.detail.analyze.hotspots')}>
            <p className="_codedetail-graph-desc">{t('code.detail.analyze.hotspotsDesc')}</p>
            <div className="_codedetail-hotspot-list">
              {data.hotspots.map((h, i) => (
                <div key={h.path} className="_codedetail-hotspot-row">
                  <span className="_codedetail-hotspot-rank" style={{ background: i < 3 ? '#d54941' : i < 6 ? '#e37318' : '#9096a3' }}>
                    {i + 1}
                  </span>
                  <span className="_codedetail-hotspot-path" title={h.path}>{h.path}</span>
                  <span className="_codedetail-hotspot-count">{h.entityCount} 实体</span>
                  <span className="_codedetail-hotspot-kinds">
                    {Object.entries(h.kindBreakdown).slice(0, 3).map(([k, c]) => (
                      <span key={k} className="_codedetail-tag-dot" style={{ background: NODE_TYPE_COLORS[k] ?? '#9096a3' }} title={`${k}: ${c}`} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* 高耦合文件 — 跨文件依赖分析 */}
      {data.coupling && data.coupling.length > 0 && (
        <Card>
          <Card.Body title={t('code.detail.analyze.coupling')}>
            <p className="_codedetail-graph-desc">{t('code.detail.analyze.couplingDesc')}</p>
            <div className="_codedetail-hotspot-list">
              {data.coupling.map((c, i) => (
                <div key={c.path} className="_codedetail-hotspot-row">
                  <span className="_codedetail-hotspot-rank" style={{ background: i < 3 ? '#d54941' : i < 6 ? '#e37318' : '#9096a3' }}>
                    {i + 1}
                  </span>
                  <span className="_codedetail-hotspot-path" title={c.path}>{c.path}</span>
                  <span className="_codedetail-hotspot-coupling">
                    <span title={t('code.detail.analyze.fanIn')}>← {c.fanIn}</span>
                    <span className="_codedetail-coupling-sep">·</span>
                    <span title={t('code.detail.analyze.fanOut')}>→ {c.fanOut}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* API 端点 */}
      {data.apis.length > 0 && (
        <Card>
          <Card.Body title={t('code.detail.analyze.apis', { count: data.apis.length })}>
            <Table
              records={data.apis}
              columns={apiColumns}
              addons={[]}
            />
          </Card.Body>
        </Card>
      )}

      {/* 架构图 */}
      {data.architectureDiagram && (
        <Card>
          <Card.Body title={t('code.detail.analyze.architecture')}>
            <MermaidBlock code={data.architectureDiagram} />
          </Card.Body>
        </Card>
      )}

      {/* 摘要 */}
      {data.summary && (
        <Card>
          <Card.Body title={t('code.detail.analyze.summary')}>
            <AssetMarkdown content={data.summary} compact />
          </Card.Body>
        </Card>
      )}
    </div>
  );
}