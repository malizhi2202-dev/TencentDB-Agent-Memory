/**
 * ModelConfigPage — 公共默认模型配置（仅 system_admin 可访问）。
 *
 * 配置 module=llm_default 的全局默认 LLM（model / provider / protocol）：
 *   - 创建 Agent 时显式配置了 llm → 用 Agent 自己的配置。
 *   - 否则回退到这里的「公共默认」；若 model 为空，则沿用到客户端请求模型（旧行为）。
 */
import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Alert, StatusTip } from 'tea-component';
import { useTranslation } from 'react-i18next';
import { AgentLlmFields } from '@/pages/team/components/shared';
import type { AgentLlmConfig } from '@/services';
import { EMPTY_AGENT_LLM } from '@/services';
import { modelConfigApi } from '@/lib/api/model-config';
import { tea } from '@/lib/tea-bridge';

export default function ModelConfigPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AgentLlmConfig>(EMPTY_AGENT_LLM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConfig(await modelConfigApi.get());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await modelConfigApi.set(config);
      tea.notify.success(t('modelConfig.saved'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      tea.notify.error(t('modelConfig.saveFailed', { msg }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Card>
        <Card.Body>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t('modelConfig.title')}</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--tea-color-text-secondary)', fontSize: 13 }}>
              {t('modelConfig.desc')}
            </p>
          </div>

          {error && <Alert type="error" style={{ marginBottom: 12 }}>{error}</Alert>}
          {loading && <StatusTip status="loading" loadingText={t('modelConfig.loading')} />}

          {!loading && (
            <>
              <AgentLlmFields value={config} onChange={setConfig} />
              <Alert type="info" style={{ marginTop: 16 }}>
                {t('modelConfig.emptyHint')}
              </Alert>
              <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                <Button type="primary" onClick={() => void handleSave()} loading={saving}>
                  {t('modelConfig.save')}
                </Button>
                <Button onClick={() => void load()} disabled={saving}>
                  {t('modelConfig.reset')}
                </Button>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}