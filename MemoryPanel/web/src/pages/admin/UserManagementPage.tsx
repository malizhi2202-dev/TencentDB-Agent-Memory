/**
 * UserManagementPage — 全局用户管理（仅 system_admin 可访问）。
 *
 * 功能：
 *   - 分页列出所有用户
 *   - 新建用户（自动分配 user_key，展示后仅此一次）
 *   - 删除用户
 *   - 将用户添加到指定 team
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  Alert,
  Copy,
  StatusTip,
} from 'tea-component';
import { useTranslation } from 'react-i18next';
import { AddIcon } from 'tea-icons-react';
import { usersApi, type CreateUserResult } from '@/lib/api/users';
import { teamsApi, membersApi } from '@/lib/api/teams';
import type { PublicUser, Team } from '@/lib/api/types';
import { tea } from '@/lib/tea-bridge';
import { invalidateBackendCache } from '@/services';
import './user-management.css';

export default function UserManagementPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新建用户弹窗
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [customKeyEnabled, setCustomKeyEnabled] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [creating, setCreating] = useState(false);

  // 创建成功后展示 key
  const [createdInfo, setCreatedInfo] = useState<{
    username: string;
    userId: string;
    keyValue: string;
  } | null>(null);

  // 添加到 team 弹窗
  const [addToTeamUser, setAddToTeamUser] = useState<PublicUser | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [addingToTeam, setAddingToTeam] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await usersApi.list();
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function loadTeams() {
    try {
      const list = await teamsApi.list();
      setTeams(list);
    } catch {
      // ignore
    }
  }

  async function handleCreateUser() {
    const username = newUsername.trim();
    if (!username) return;
    if (!/^[A-Za-z0-9_]+$/.test(username)) {
      tea.notify.warning(t('addMember.error.invalidName'));
      return;
    }
    setCreating(true);
    try {
      const created: CreateUserResult = customKeyEnabled
        ? await usersApi.createWithKey({ username, user_key: customKey.trim() })
        : await usersApi.create({
            username,
            auth_provider: 'api_key',
            external_id: username,
          });
      setShowCreate(false);
      setNewUsername('');
      setCustomKey('');
      setCustomKeyEnabled(false);
      setCreatedInfo({
        username,
        userId: created.user_id,
        keyValue: created.default_user_key ?? '',
      });
      await loadUsers();
    } catch (err) {
      tea.notify.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(userId: string, username: string) {
    const ok = await tea.confirm({
      message: t('userManagement.deleteConfirm', { username }),
      okText: t('common.delete'),
    });
    if (!ok) return;
    try {
      await usersApi.delete(userId);
      await loadUsers();
      tea.notify.success(t('userManagement.deleted', { username }));
    } catch (err) {
      tea.notify.error(err);
    }
  }

  async function handleAddToTeam() {
    if (!addToTeamUser || !selectedTeamId) return;
    setAddingToTeam(true);
    try {
      await membersApi.add(selectedTeamId, {
        user_id: addToTeamUser.user_id,
        role: 'member',
      });
      invalidateBackendCache();
      tea.notify.success(
        t('userManagement.addedToTeam', {
          username: addToTeamUser.username,
          teamId: selectedTeamId,
        }),
      );
      setAddToTeamUser(null);
      setSelectedTeamId('');
    } catch (err) {
      tea.notify.error(err);
    } finally {
      setAddingToTeam(false);
    }
  }

  const columns = [
    {
      key: 'username',
      header: t('userManagement.col.username'),
      render: (u: PublicUser) => (
        <span>
          <strong>{u.username}</strong>
          {u.user_type === 'system_admin' && (
            <Tag size="sm" theme="success" style={{ marginLeft: 8 }}>
              admin
            </Tag>
          )}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: t('userManagement.col.userId'),
      render: (u: PublicUser) => (
        <code style={{ fontSize: 12 }}>{u.user_id}</code>
      ),
    },
    {
      key: 'status',
      header: t('userManagement.col.status'),
      render: (u: PublicUser) => (
        <Tag size="sm" theme={u.status === 'active' ? 'success' : 'default'}>
          {u.status}
        </Tag>
      ),
    },
    {
      key: 'created_at',
      header: t('userManagement.col.createdAt'),
      render: (u: PublicUser) => u.created_at,
    },
    {
      key: 'actions',
      header: t('userManagement.col.actions'),
      render: (u: PublicUser) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            onClick={() => {
              setAddToTeamUser(u);
              setSelectedTeamId('');
              void loadTeams();
            }}
          >
            {t('userManagement.addToTeam')}
          </Button>
          {u.user_type !== 'system_admin' && (
            <Button
              onClick={() => handleDeleteUser(u.user_id, u.username)}
            >
              {t('common.delete')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="_memory-user-mgmt">
      <Card>
        <Card.Body>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0 }}>{t('userManagement.title')}</h2>
            <Button type="primary" onClick={() => setShowCreate(true)}>
              <AddIcon size={16} />
              {t('userManagement.createUser')}
            </Button>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <Table
            columns={columns}
            records={users}
            recordKey="user_id"
            topTip={loading ? <StatusTip status="loading" /> : undefined}
            addons={[
              Table.addons.autotip({
                emptyText: t('userManagement.empty'),
              }),
            ]}
          />
        </Card.Body>
      </Card>

      {/* 新建用户弹窗 */}
      <Modal
        visible={showCreate}
        caption={t('userManagement.createUser')}
        size="m"
        onClose={() => {
          if (!creating) {
            setShowCreate(false);
            setNewUsername('');
            setCustomKey('');
            setCustomKeyEnabled(false);
          }
        }}
        disableEscape={creating}
      >
        <Modal.Body>
          <Form>
            <Form.Item label={t('addMember.username')} required>
              <div>
                <Input
                  autoFocus
                  size="full"
                  value={newUsername}
                  onChange={(v) => setNewUsername(v)}
                  onPressEnter={() => void handleCreateUser()}
                  placeholder={t('addMember.username.placeholder')}
                />
                {newUsername.trim() &&
                !/^[A-Za-z0-9_]+$/.test(newUsername.trim()) ? (
                  <div
                    className="_memory-field-hint"
                    style={{ color: 'var(--tea-color-text-error-default)' }}
                  >
                    {t('addMember.username.invalid')}
                  </div>
                ) : (
                  <div className="_memory-field-hint">
                    {t('addMember.username.hint')}
                  </div>
                )}
              </div>
            </Form.Item>

            <Form.Item label={t('addMember.customKey.label')}>
              <div>
                <Switch
                  value={customKeyEnabled}
                  onChange={(v) => {
                    setCustomKeyEnabled(v);
                    if (!v) setCustomKey('');
                  }}
                />
                <div className="_memory-field-hint">
                  {t('addMember.customKey.hint')}
                </div>
              </div>
            </Form.Item>

            {customKeyEnabled && (
              <Form.Item label={t('addMember.customKey.value')} required>
                <div>
                  <Input
                    size="full"
                    value={customKey}
                    onChange={(v) => setCustomKey(v)}
                    onPressEnter={() => void handleCreateUser()}
                    placeholder={t('addMember.customKey.placeholder')}
                  />
                  <div className="_memory-field-hint">
                    {t('addMember.customKey.valueHint')}
                  </div>
                </div>
              </Form.Item>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="primary"
            onClick={() => void handleCreateUser()}
            disabled={
              !newUsername.trim() ||
              !/^[A-Za-z0-9_]+$/.test(newUsername.trim()) ||
              (customKeyEnabled && !customKey.trim()) ||
              creating
            }
            loading={creating}
          >
            {t('userManagement.create')}
          </Button>
          <Button onClick={() => setShowCreate(false)} disabled={creating}>
            {t('addMember.cancel')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 创建成功后展示 key */}
      <Modal
        visible={createdInfo !== null}
        caption={t('createdUserKey.caption')}
        size="m"
        onClose={() => setCreatedInfo(null)}
      >
        <Modal.Body>
          {createdInfo && (
            <Form>
              <Alert type="success">
                {t('createdUserKey.success', {
                  username: createdInfo.username,
                  userId: createdInfo.userId,
                })}
              </Alert>
              {createdInfo.keyValue ? (
                <>
                  <Alert type="warning">
                    <strong>{t('createdUserKey.warning')}</strong>
                  </Alert>
                  <Form.Item label={t('createdUserKey.keyLabel')}>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded border bg-muted px-3 py-2 text-[12px] font-mono break-all select-all">
                        {createdInfo.keyValue}
                      </code>
                      <Copy text={createdInfo.keyValue}>
                        <Button>{t('createdUserKey.copy')}</Button>
                      </Copy>
                    </div>
                  </Form.Item>
                </>
              ) : (
                <Alert type="warning">
                  {t('createdUserKey.noKey')}
                  <code
                    className="mt-1 block rounded px-2 py-1 text-[12px] font-mono select-all"
                    style={{
                      background: 'var(--tea-color-bg-primary-default)',
                    }}
                  >
                    {createdInfo.userId}
                  </code>
                </Alert>
              )}
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="primary" onClick={() => setCreatedInfo(null)}>
            {t('createdUserKey.close')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 添加到 team 弹窗 */}
      <Modal
        visible={addToTeamUser !== null}
        caption={t('userManagement.addToTeamTitle', {
          username: addToTeamUser?.username ?? '',
        })}
        size="m"
        onClose={() => {
          if (!addingToTeam) setAddToTeamUser(null);
        }}
        disableEscape={addingToTeam}
      >
        <Modal.Body>
          <Form>
            <Form.Item label={t('userManagement.selectTeam')} required>
              <Select
                size="full"
                value={selectedTeamId}
                onChange={(v) => setSelectedTeamId(v)}
                options={teams.map((t) => ({
                  value: t.team_id,
                  text: `${t.name} (${t.team_id})`,
                }))}
                placeholder={t('userManagement.selectTeam.placeholder')}
              />
            </Form.Item>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="primary"
            onClick={() => void handleAddToTeam()}
            disabled={!selectedTeamId || addingToTeam}
            loading={addingToTeam}
          >
            {t('userManagement.addToTeam')}
          </Button>
          <Button
            onClick={() => setAddToTeamUser(null)}
            disabled={addingToTeam}
          >
            {t('addMember.cancel')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}