/**
 * PermissionManagementPage — 权限管理（仅 system_admin，AdminOnlyGuard 包裹）。
 *
 * 方案B 全量 RBAC：
 *   Tab「权限项」：全局能力权限项（资源.动作）—— 选用户后，以「分组清单 + 开关」直接切换授权，
 *                参照 CAM / IAM 的权限清单式界面（默认能力灰置、管理类可切换）。
 *   Tab「资产 ACL」：资产级 read/write/delete/assign/share/use 授权（保留）。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  StatusTip,
  Switch,
  Table,
  Tabs,
  TabPanel,
  Tag,
  Text,
} from 'tea-component';
import {
  permissionApi,
  PERMISSION_GROUPS,
  ADMIN_ONLY_PERMISSIONS,
  isDefaultOn,
  type PermissionGrantRecord,
} from '@/lib/api/permission';
import { aclApi, PERMISSION_OPTIONS, SUBJECT_TYPE_OPTIONS, type AclEntity, type AclPermission, type AclSubjectType } from '@/lib/api/acl';
import { usersApi } from '@/lib/api/users';
import { teamsApi } from '@/lib/api/teams';
import { assetsApi } from '@/lib/api/assets';
import type { PublicUser, Asset, Team } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { getErrorMessage } from '@/lib/error-message';

export default function PermissionManagementPage() {
  const [tab, setTab] = useState<'rbac' | 'acl'>('rbac');

  // ── 权限项（RBAC）──
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [grants, setGrants] = useState<PermissionGrantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyPerms, setBusyPerms] = useState<Set<string>>(new Set());

  // ── 资产 ACL ──
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState('');
  const [subjectType, setSubjectType] = useState<AclSubjectType>('user');
  const [subjectId, setSubjectId] = useState('');
  const [permission, setPermission] = useState<AclPermission>('read');
  const [acls, setAcls] = useState<AclEntity[]>([]);
  const [loadingAcls, setLoadingAcls] = useState(false);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    usersApi
      .list()
      .then(setUsers)
      .catch((e) => tea.notify.error(getErrorMessage(e)));
    void loadTeams();
  }, []);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.user_id,
        text: `${u.username} · ${u.user_type === 'system_admin' ? 'admin' : '普通用户'}`,
      })),
    [users],
  );

  const grantedSet = useMemo(() => new Set(grants.map((g) => g.permission)), [grants]);
  const grantedCount = grants.length;
  const managedCount = ADMIN_ONLY_PERMISSIONS.size;
  const selectedUser = users.find((u) => u.user_id === selectedUserId);
  const isSysAdmin = selectedUser?.user_type === 'system_admin';

  async function loadGrants(userId: string) {
    if (!userId) {
      setGrants([]);
      return;
    }
    setLoading(true);
    try {
      setGrants(await permissionApi.list(userId));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }

  function setPermBusy(perm: string, busy: boolean) {
    setBusyPerms((prev) => {
      const next = new Set(prev);
      if (busy) next.add(perm);
      else next.delete(perm);
      return next;
    });
  }

  async function togglePerm(userId: string, perm: string, toEnable: boolean) {
    if (busyPerms.has(perm)) return;
    setPermBusy(perm, true);
    try {
      if (toEnable) {
        await permissionApi.grant(userId, perm);
        tea.notify.success(`已授予 ${perm}`);
      } else {
        await permissionApi.revoke(userId, perm);
        tea.notify.success(`已撤销 ${perm}`);
      }
      setGrants(await permissionApi.list(userId));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setPermBusy(perm, false);
    }
  }

  async function batchSet(userId: string, grant: boolean) {
    const perms = Array.from(ADMIN_ONLY_PERMISSIONS);
    const targets = grant ? perms.filter((p) => !grantedSet.has(p)) : perms.filter((p) => grantedSet.has(p));
    if (targets.length === 0) {
      tea.notify.warning(grant ? '所有管理类权限均已授予' : '没有可撤销的管理类权限');
      return;
    }
    setBusyPerms(new Set(targets));
    try {
      for (const p of targets) {
        if (grant) await permissionApi.grant(userId, p);
        else await permissionApi.revoke(userId, p);
      }
      tea.notify.success(grant ? `已授予 ${targets.length} 项` : `已撤销 ${targets.length} 项`);
      setGrants(await permissionApi.list(userId));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setBusyPerms(new Set());
    }
  }

  // ── ACL ──
  async function loadTeams() {
    try {
      setTeams(await teamsApi.list());
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  }

  async function loadAssets(tid: string) {
    if (!tid) {
      setAssets([]);
      return;
    }
    try {
      setAssets(await assetsApi.list(tid));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
      setAssets([]);
    }
  }

  async function loadAcls(id: string) {
    if (!id) {
      setAcls([]);
      return;
    }
    setLoadingAcls(true);
    try {
      setAcls(await aclApi.list(id));
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
      setAcls([]);
    } finally {
      setLoadingAcls(false);
    }
  }

  async function handleGrantAcl() {
    if (!assetId || !subjectId.trim()) {
      tea.notify.warning('请先选择资产，并填写授权主体 ID');
      return;
    }
    setGranting(true);
    try {
      await aclApi.grant({
        asset_id: assetId,
        subject_type: subjectType,
        subject_id: subjectId.trim(),
        permission,
      });
      tea.notify.success('授权成功');
      setSubjectId('');
      await loadAcls(assetId);
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    } finally {
      setGranting(false);
    }
  }

  async function handleRevokeAcl(id: string) {
    try {
      await aclApi.revoke(id);
      tea.notify.success('已撤销授权');
      await loadAcls(assetId);
    } catch (e) {
      tea.notify.error(getErrorMessage(e));
    }
  }

  return (
    <div className="_memory-detail-page">
      <div className="_memory-detail-head">
        <h3 style={{ margin: 0 }}>权限管理</h3>
      </div>

      <Tabs
        activeId={tab}
        onActive={(t) => setTab(t.id as 'rbac' | 'acl')}
        disableTabScrolling
        tabs={[
          { id: 'rbac', label: '权限项（RBAC）' },
          { id: 'acl', label: '资产 ACL' },
        ]}
      >
        <TabPanel id="rbac">
          <Card>
            <Card.Body>
              <Alert type="info" style={{ marginBottom: 12 }}>
                选择用户后，直接点开关即可授权/撤销权限项。<Tag theme="success">默认</Tag>
                表示普通用户天然具备的协作能力（不可关闭）；
                <Text theme="strong">管理/治理类</Text>能力（创建团队、建号、看审计日志…）默认仅管理员，可授予普通用户。
              </Alert>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <Form layout="inline" style={{ margin: 0 }}>
                  <Form.Item label="选择用户">
                    <Select
                      searchable
                      appearance="button"
                      matchButtonWidth
                      value={selectedUserId}
                      onChange={(v) => {
                        setSelectedUserId(v);
                        void loadGrants(v);
                      }}
                      placeholder="选择要授权的用户"
                      options={userOptions}
                    />
                  </Form.Item>
                </Form>
                {selectedUserId && (
                  <Text theme="label">
                    {isSysAdmin ? (
                      '系统管理员 · 拥有全部权限'
                    ) : (
                      <>
                        管理类权限：<Text theme="strong">{grantedCount}</Text> / {managedCount}
                      </>
                    )}
                  </Text>
                )}
              </div>

              {!selectedUserId ? (
                <StatusTip status="empty" emptyText="请先选择用户" />
              ) : loading ? (
                <StatusTip status="loading" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {isSysAdmin ? (
                    <Alert type="success" style={{ marginBottom: 0 }}>
                      该用户是系统管理员，默认拥有全部权限项（不可在此关闭）。
                    </Alert>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button type="weak" onClick={() => void batchSet(selectedUserId, true)}>
                        授予全部管理类权限
                      </Button>
                      <Button type="weak" onClick={() => void batchSet(selectedUserId, false)}>
                        撤销全部管理类权限
                      </Button>
                    </div>
                  )}

                  {PERMISSION_GROUPS.map((g) => (
                    <div key={g.group} style={{ border: '1px solid #e8e8e8', borderRadius: 6 }}>
                      <div
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #f0f0f0',
                          background: '#fafafa',
                          fontWeight: 600,
                        }}
                      >
                        {g.group}
                      </div>
                      <div style={{ padding: '4px 0' }}>
                        {g.items.map((it) => {
                          const isDefault = isDefaultOn(it.value);
                          const granted = grantedSet.has(it.value);
                          const on = isDefault || granted;
                          const busy = busyPerms.has(it.value);
                          return (
                            <div
                              key={it.value}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 16px',
                                borderBottom: '1px solid #f5f5f5',
                              }}
                            >
                              <div>
                                <Text>{it.label}</Text>
                                <Text theme="label" style={{ marginLeft: 8, fontSize: 12 }}>
                                  {it.value}
                                </Text>
                                {isDefault && (
                                  <Tag theme="success" style={{ marginLeft: 8 }}>
                                    默认
                                  </Tag>
                                )}
                                {granted && !isDefault && (
                                  <Tag theme="primary" style={{ marginLeft: 8 }}>
                                    已授权
                                  </Tag>
                                )}
                              </div>
                              <Switch
                                value={isSysAdmin ? true : on}
                                disabled={isSysAdmin || isDefault || busy}
                                onChange={(v) => void togglePerm(selectedUserId, it.value, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </TabPanel>

        <TabPanel id="acl">
          <Card>
            <Card.Body>
              <Alert type="info" style={{ marginBottom: 12 }}>
                资产级 ACL：对某个资产授予 read / write / delete / assign / share / use 权限给用户、团队角色或 Agent。
              </Alert>

              <Form layout="inline">
                <Form.Item label="选择团队">
                  <Select
                    searchable
                    appearance="button"
                    matchButtonWidth
                    value={teamId}
                    onChange={(v) => {
                      setTeamId(v);
                      setAssetId('');
                      setAcls([]);
                      void loadAssets(v);
                    }}
                    placeholder="先选团队"
                    options={teams.map((t) => ({ value: t.team_id, text: t.name }))}
                  />
                </Form.Item>
                <Form.Item label="选择资产">
                  <Select
                    searchable
                    appearance="button"
                    matchButtonWidth
                    value={assetId}
                    onChange={(v) => {
                      setAssetId(v);
                      void loadAcls(v);
                    }}
                    disabled={!teamId}
                    placeholder={teamId ? '选择资产' : '请先选团队'}
                    options={assets.map((a) => ({
                      value: a.asset_id,
                      text: `${a.name} · ${a.asset_type}（…${a.asset_id.slice(-6)}）`,
                    }))}
                  />
                </Form.Item>
              </Form>

              <Text theme="label" style={{ display: 'block', margin: '16px 0 8px' }}>
                授予新权限
              </Text>
              <Form layout="inline">
                <Form.Item label="主体类型">
                  <Select
                    appearance="button"
                    matchButtonWidth
                    value={subjectType}
                    onChange={(v) => setSubjectType(v as AclSubjectType)}
                    options={SUBJECT_TYPE_OPTIONS}
                  />
                </Form.Item>
                <Form.Item label="主体 ID">
                  <Input value={subjectId} onChange={setSubjectId} placeholder="user_id / team_role / agent_id" style={{ width: 240 }} />
                </Form.Item>
                <Form.Item label="权限项">
                  <Select
                    appearance="button"
                    matchButtonWidth
                    value={permission}
                    onChange={(v) => setPermission(v as AclPermission)}
                    options={PERMISSION_OPTIONS}
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={() => void handleGrantAcl()} loading={granting}>
                    授予
                  </Button>
                </Form.Item>
              </Form>

              <Text theme="label" style={{ display: 'block', margin: '16px 0 8px' }}>
                该资产的已授权项（{acls.length}）
              </Text>
              {loadingAcls ? (
                <StatusTip status="loading" />
              ) : acls.length === 0 ? (
                <StatusTip status="empty" emptyText="暂无授权（先选团队与资产）" />
              ) : (
                <Table
                  records={acls}
                  recordKey="id"
                  columns={[
                    { key: 'subject_type', header: '主体类型', render: (r) => <Text>{r.subject_type}</Text> },
                    { key: 'subject_id', header: '主体 ID', render: (r) => <Text>{r.subject_id}</Text> },
                    { key: 'permission', header: '权限项', render: (r) => <Text>{r.permission}</Text> },
                    { key: 'effect', header: '效果', render: (r) => <Text>{r.effect}</Text> },
                    {
                      key: 'granted_by',
                      header: '授予者',
                      render: (r) =>
                        r.granted_by === 'system' ? (
                          <Tag theme="success">系统默认</Tag>
                        ) : (
                          <Text>{r.granted_by}</Text>
                        ),
                    },
                    {
                      key: 'actions',
                      header: '操作',
                      render: (r) =>
                        r.granted_by === 'system' ? (
                          <Text theme="label">默认</Text>
                        ) : (
                          <Button type="link" onClick={() => void handleRevokeAcl(r.id)}>
                            撤销
                          </Button>
                        ),
                    },
                  ]}
                />
              )}
            </Card.Body>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}
