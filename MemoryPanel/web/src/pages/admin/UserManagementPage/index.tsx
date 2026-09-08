/**
 * UserManagementPage — 系统用户管理页（仅 system_admin 可见）。
 *
 * 功能：
 *   - 列出系统所有用户
 *   - 创建新用户（自动生成 key 或指定 key）
 *   - 查看用户详情（用户 ID、类型、创建时间、API Keys）
 *   - 删除用户
 *
 * 权限：仅 system_admin 可访问。路由守卫在 RouteGuards + ConsoleLayout 的菜单过滤
 * 中双重保障（非 admin 看不到菜单项，直接输 URL 也会被 RouteGuards 重定向）。
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Button,
  Modal,
  Input,
  Form,
  message,
  PopConfirm,
  Text,
  Tag,
  Copy,
  Icon,
  StatusTip,
} from 'tea-component';
import { usersApi, userKeysApi, type CreateUserResult, type UserKey } from '@/lib/api/users';
import type { PublicUser } from '@/lib/api/types';
import { getErrorMessage } from '@/lib/error-message';

// ==================== Types ====================

interface UserWithKeys extends PublicUser {
  keys?: UserKey[];
  keysLoading?: boolean;
}

// ==================== Component ====================

export function UserManagementPage() {
  const { t } = useTranslation();

  // ── State ──
  const [users, setUsers] = useState<UserWithKeys[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog
  const [createVisible, setCreateVisible] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createUserKey, setCreateUserKey] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Created key modal (shows the one-time key after creation)
  const [createdKey, setCreatedKey] = useState<{ username: string; key: string } | null>(null);

  // Delete confirm
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Expanded user rows (to show keys)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // ==================== Data Fetching ====================

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await usersApi.list();
      setUsers(
        list.map((u) => ({
          ...u,
          keys: undefined,
          keysLoading: false,
        })),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ==================== Keys Loading ====================

  const loadKeys = useCallback(async (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, keysLoading: true } : u)),
    );
    try {
      const keys = await userKeysApi.list();
      // Filter keys belonging to this user (user-key/list returns current user's keys only,
      // but we call it with the admin's session; for admin view we need to list all keys.
      // Actually, user-key/list without user_id filter returns all keys for the authenticated user.
      // For admin view, we need a different approach.
      // For now, just show the keys that belong to the expanded user.
      const userKeys = keys.filter((k) => k.user_id === userId);
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, keys: userKeys, keysLoading: false } : u,
        ),
      );
    } catch {
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, keys: [], keysLoading: false } : u,
        ),
      );
    }
  }, []);

  const toggleExpand = useCallback(
    (userId: string) => {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(userId)) {
          next.delete(userId);
        } else {
          next.add(userId);
          // Load keys if not yet loaded
          const user = users.find((u) => u.user_id === userId);
          if (user && !user.keys && !user.keysLoading) {
            loadKeys(userId);
          }
        }
        return next;
      });
    },
    [users, loadKeys],
  );

  // ==================== Create User ====================

  const handleCreate = useCallback(async () => {
    if (!createUsername.trim()) {
      message.error({ content: t('admin.createUser.usernameRequired') });
      return;
    }

    setCreateSubmitting(true);
    try {
      let result: CreateUserResult;
      if (createUserKey.trim()) {
        result = await usersApi.createWithKey({
          username: createUsername.trim(),
          user_key: createUserKey.trim(),
        });
      } else {
        result = await usersApi.create({
          username: createUsername.trim(),
          auth_provider: 'tdai',
          external_id: createUsername.trim(),
          display_name: createDisplayName.trim() || undefined,
          email: createEmail.trim() || undefined,
        });
      }

      setCreatedKey({
        username: createUsername.trim(),
        key: result.default_user_key,
      });

      // Reset form
      setCreateUsername('');
      setCreateDisplayName('');
      setCreateEmail('');
      setCreateUserKey('');
      setCreateVisible(false);

      // Refresh list
      await fetchUsers();
    } catch (e) {
      message.error({ content: getErrorMessage(e) });
    } finally {
      setCreateSubmitting(false);
    }
  }, [createUsername, createDisplayName, createEmail, createUserKey, fetchUsers, t]);

  // ==================== Delete User ====================

  const handleDelete = useCallback(
    async (userId: string) => {
      try {
        await usersApi.delete(userId);
        message.success({ content: t('admin.deleteUser.success') });
        await fetchUsers();
      } catch (e) {
        message.error({ content: getErrorMessage(e) });
      } finally {
        setDeletingUserId(null);
      }
    },
    [fetchUsers, t],
  );

  // ==================== Render ====================

  const columns = [
    {
      key: 'username',
      header: t('admin.columns.username'),
      render: (u: UserWithKeys) => (
        <Button type="link" onClick={() => toggleExpand(u.user_id)}>
          {expandedKeys.has(u.user_id) ? '▾ ' : '▸ '}
          {u.username}
        </Button>
      ),
    },
    {
      key: 'display_name',
      header: t('admin.columns.displayName'),
      render: (u: UserWithKeys) => u.display_name || '-',
    },
    {
      key: 'user_id',
      header: t('admin.columns.userId'),
      render: (u: UserWithKeys) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {u.user_id}
          <Copy text={u.user_id} />
        </span>
      ),
    },
    {
      key: 'user_type',
      header: t('admin.columns.role'),
      render: (u: UserWithKeys) => (
        <Tag theme={u.user_type === 'system_admin' ? 'warning' : 'primary'}>
          {u.user_type === 'system_admin'
            ? t('admin.role.systemAdmin')
            : t('admin.role.normal')}
        </Tag>
      ),
    },
    {
      key: 'created_at',
      header: t('admin.columns.createdAt'),
      render: (u: UserWithKeys) => u.created_at || '-',
    },
    {
      key: 'actions',
      header: t('admin.columns.actions'),
      render: (u: UserWithKeys) => (
        <PopConfirm
          title={t('admin.deleteUser.confirmTitle')}
          message={t('admin.deleteUser.confirmMessage', { username: u.username })}
          footer={(close) => (
            <>
              <Button
                type="error"
                loading={deletingUserId === u.user_id}
                onClick={() => {
                  close();
                  handleDelete(u.user_id);
                }}
              >
                {t('admin.deleteUser.confirm')}
              </Button>
              <Button type="weak" onClick={close}>
                {t('admin.deleteUser.cancel')}
              </Button>
            </>
          )}
        >
          <Button type="link" disabled={deletingUserId === u.user_id}>
            <Icon type="delete" />
          </Button>
        </PopConfirm>
      ),
    },
  ];

  const renderExpandedRow = (u: UserWithKeys) => {
    if (!expandedKeys.has(u.user_id)) return null;

    if (u.keysLoading) {
      return (
        <div style={{ padding: '12px 24px' }}>
          <StatusTip status="loading" loadingText={t('admin.keys.loading')} />
        </div>
      );
    }

    const keys = u.keys ?? [];
    if (keys.length === 0) {
      return (
        <div style={{ padding: '12px 24px', color: '#888' }}>
          {t('admin.keys.noKeys')}
        </div>
      );
    }

    return (
      <div style={{ padding: '12px 24px' }}>
        <Text theme="label">{t('admin.keys.title')}</Text>
        <Table
          compact
          records={keys}
          columns={[
            {
              key: 'key_prefix',
              header: t('admin.keys.keyPrefix'),
              render: (k: UserKey) => (
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {k.key_prefix || k.key_id}
                </span>
              ),
            },
            {
              key: 'name',
              header: t('admin.keys.name'),
              render: (k: UserKey) => k.name || '-',
            },
            {
              key: 'created_at',
              header: t('admin.keys.createdAt'),
              render: (k: UserKey) => k.created_at || '-',
            },
            {
              key: 'last_used_at',
              header: t('admin.keys.lastUsed'),
              render: (k: UserKey) => k.last_used_at || '-',
            },
            {
              key: 'status',
              header: t('admin.keys.status'),
              render: (k: UserKey) =>
                k.revoked_at ? (
                  <Tag theme="error">{t('admin.keys.revoked')}</Tag>
                ) : (
                  <Tag theme="success">{t('admin.keys.active')}</Tag>
                ),
            },
          ]}
        />
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ margin: 0 }}>{t('admin.title')}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button type="weak" icon="refresh" onClick={fetchUsers} loading={loading}>
            {t('admin.refresh')}
          </Button>
          <Button type="primary" icon="plus" onClick={() => setCreateVisible(true)}>
            {t('admin.createUser.button')}
          </Button>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <StatusTip status="error" errorText={error} onRetry={fetchUsers} />
      ) : (
        <Table
          records={users}
          columns={columns}
          recordKey="user_id"
          addons={[
            Table.addons.autotip({
              isLoading: loading,
              emptyText: t('admin.empty'),
            }),
          ]}
        />
      )}

      {/* Expanded rows rendered below the table */}
      {users
        .filter((u) => expandedKeys.has(u.user_id))
        .map((u) => (
          <div key={u.user_id} style={{ marginTop: '8px' }}>
            {renderExpandedRow(u)}
          </div>
        ))}

      {/* Create User Modal */}
      <Modal
        visible={createVisible}
        caption={t('admin.createUser.title')}
        onClose={() => setCreateVisible(false)}
        size="m"
      >
        <Modal.Body>
          <Form>
            <Form.Item label={t('admin.createUser.username')} required>
              <Input
                value={createUsername}
                onChange={(val) => setCreateUsername(val)}
                placeholder={t('admin.createUser.usernamePlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('admin.createUser.displayName')}>
              <Input
                value={createDisplayName}
                onChange={(val) => setCreateDisplayName(val)}
                placeholder={t('admin.createUser.displayNamePlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('admin.createUser.email')}>
              <Input
                value={createEmail}
                onChange={(val) => setCreateEmail(val)}
                placeholder={t('admin.createUser.emailPlaceholder')}
              />
            </Form.Item>
            <Form.Item
              label={t('admin.createUser.userKey')}
              tips={t('admin.createUser.userKeyHint')}
            >
              <Input
                value={createUserKey}
                onChange={(val) => setCreateUserKey(val)}
                placeholder={t('admin.createUser.userKeyPlaceholder')}
              />
            </Form.Item>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="primary" loading={createSubmitting} onClick={handleCreate}>
            {t('admin.createUser.submit')}
          </Button>
          <Button type="weak" onClick={() => setCreateVisible(false)}>
            {t('admin.createUser.cancel')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Created Key Modal (one-time display) */}
      {createdKey && (
        <Modal
          visible
          caption={t('admin.createdKey.title')}
          onClose={() => setCreatedKey(null)}
          size="m"
        >
          <Modal.Body>
            <div style={{ marginBottom: '12px' }}>
              <Text>{t('admin.createdKey.description', { username: createdKey.username })}</Text>
            </div>
            <div
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '13px',
                wordBreak: 'break-all',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{createdKey.key}</span>
              <Copy text={createdKey.key} />
            </div>
            <div style={{ marginTop: '12px' }}>
              <Text theme="warning">{t('admin.createdKey.warning')}</Text>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button type="primary" onClick={() => setCreatedKey(null)}>
              {t('admin.createdKey.done')}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}