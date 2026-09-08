/**
 * AuditLogPage — 审计日志（治理收尾：仅 system_admin 可访问）。
 *
 * 展示所有写操作的留痕记录（team/delete、team-member add/remove、project/delete、acl grant/revoke）。
 */
import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, StatusTip, Table, Text } from 'tea-component';
import { auditApi, type AuditLogEntry, type AuditLogQuery } from '@/lib/api/audit';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const filter: AuditLogQuery = {};
      if (actionFilter.trim()) filter.action = actionFilter.trim();
      if (entityTypeFilter.trim()) filter.entity_type = entityTypeFilter.trim();
      if (actorFilter.trim()) filter.actor_user_id = actorFilter.trim();
      const page = await auditApi.list(filter);
      setLogs(page.items);
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
      setLogs([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <h3 style={{ margin: 0 }}>审计日志</h3>
      </div>

      <Card>
        <Card.Body>
          <Form layout="inline">
            <Form.Item label="操作类型">
              <Input
                value={actionFilter}
                onChange={setActionFilter}
                placeholder="如 team.delete / acl.grant"
                style={{ width: 220 }}
              />
            </Form.Item>
            <Form.Item label="资源类型">
              <Input
                value={entityTypeFilter}
                onChange={setEntityTypeFilter}
                placeholder="如 team / project / asset"
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item label="操作者 ID">
              <Input
                value={actorFilter}
                onChange={setActorFilter}
                placeholder="user_id"
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="weak" onClick={() => void load()} disabled={loading}>
                查询
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <StatusTip status="loading" />
            ) : loaded && logs.length === 0 ? (
              <StatusTip status="empty" emptyText="暂无审计记录" />
            ) : (
              <Table
                records={logs}
                recordKey="id"
                columns={[
                  { key: 'created_at', header: '时间', render: (r) => <Text>{r.created_at}</Text> },
                  { key: 'actor_user_id', header: '操作者', render: (r) => <Text>{r.actor_user_id}</Text> },
                  { key: 'action', header: '操作', render: (r) => <Text>{r.action}</Text> },
                  { key: 'entity_type', header: '资源类型', render: (r) => <Text>{r.entity_type}</Text> },
                  { key: 'entity_id', header: '资源 ID', render: (r) => <Text>{r.entity_id}</Text> },
                  { key: 'detail', header: '详情', render: (r) => <Text overflow>{r.detail}</Text> },
                ]}
              />
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}