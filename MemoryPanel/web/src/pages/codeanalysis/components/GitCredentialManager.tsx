/**
 * GitCredentialManager — 私有 git 仓库凭据管理弹窗。
 *
 * 列出 / 新增 / 删除已保存的 git 凭据（password / token / ssh）。
 * 凭据走内核 /v3/meta/git-credential/*（owner 私有，list 脱敏、get 含 secret）。
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Modal, Segment, Text } from 'tea-component';
import { AddIcon, DeleteIcon, LockOnIcon } from 'tea-icons-react';
import {
  gitCredentialsApi,
  type GitCredentialListItem,
  type GitCredentialAuthType,
} from '@/lib/api/git-credentials';
import { tea } from '@/lib/tea-bridge';

const AUTH_TYPE_OPTIONS: { value: GitCredentialAuthType; text: string }[] = [
  { value: 'password', text: 'Password' },
  { value: 'token', text: 'Token' },
  { value: 'ssh', text: 'SSH key' },
];

function authTypeLabel(v: GitCredentialAuthType, t: (k: string) => string): string {
  return t(`credentials.auth.${v}`);
}

export function GitCredentialManager(props: {
  visible: boolean;
  onClose: () => void;
  /** 凭据增删后触发，供父组件刷新下拉选项。 */
  onChanged?: () => void;
}) {
  const { visible, onClose, onChanged } = props;
  const { t } = useTranslation();

  const [items, setItems] = useState<GitCredentialListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [authType, setAuthType] = useState<GitCredentialAuthType>('token');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await gitCredentialsApi.list();
      setItems(d.items ?? []);
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const resetForm = () => {
    setName('');
    setAuthType('token');
    setHost('');
    setUsername('');
    setSecret('');
    setPassphrase('');
  };

  const handleCreate = async () => {
    if (!name.trim() || !secret) {
      tea.notify.error(t('credentials.create.required'));
      return;
    }
    if (authType === 'password' && !username.trim()) {
      tea.notify.error(t('credentials.create.userRequired'));
      return;
    }
    setSaving(true);
    try {
      await gitCredentialsApi.create({
        name: name.trim(),
        auth_type: authType,
        host: host.trim() || undefined,
        username: username.trim() || undefined,
        secret,
        passphrase: authType === 'ssh' && passphrase ? passphrase : undefined,
      });
      tea.notify.info(t('credentials.create.done'));
      resetForm();
      void load();
      onChanged?.();
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    const ok = await tea.confirm({
      message: t('credentials.delete.confirm', { name: label }),
      okText: t('common.delete'),
    });
    if (!ok) return;
    try {
      await gitCredentialsApi.remove(id);
      tea.notify.info(t('credentials.deleted'));
      void load();
      onChanged?.();
    } catch (e: any) {
      tea.notify.error(e?.message || String(e));
    }
  };

  return (
    <Modal visible={visible} caption={t('credentials.title')} onClose={onClose} size="l">
      <Modal.Body>
        <div className="_cred-section">
          {loading ? (
            <Text theme="label">{t('common.loading')}{/* fallback */}</Text>
          ) : items.length === 0 ? (
            <Text theme="label">{t('credentials.empty')}</Text>
          ) : (
            <div className="_cred-list">
              {items.map((c) => (
                <div key={c.credential_id} className="_cred-row">
                  <LockOnIcon size={14} className="_cred-row-icon" />
                  <div className="_cred-row-main">
                    <div className="_cred-row-name">
                      {c.name}
                      <Text theme="label" className="_cred-row-type">
                        {authTypeLabel(c.auth_type, t)}
                      </Text>
                    </div>
                    <div className="_cred-row-meta">
                      {c.host ? `${c.host} · ` : ''}{c.username ?? ''}
                    </div>
                  </div>
                  <Button
                    type="link"
                    className="_cred-row-del"
                    onClick={() => handleDelete(c.credential_id, c.name)}
                  >
                    <DeleteIcon size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="_cred-divider" />

        <Form layout="vertical">
          <Form.Item label={t('credentials.create.name')} required>
            <Input size="full" value={name} onChange={(v) => setName(v)} placeholder={t('credentials.create.namePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('credentials.create.authType')}>
            <Segment
              value={authType}
              onChange={(v) => setAuthType(v as GitCredentialAuthType)}
              options={AUTH_TYPE_OPTIONS.map((o) => ({ value: o.value, text: authTypeLabel(o.value, t) }))}
            />
          </Form.Item>
          {(authType === 'password' || authType === 'token') && (
            <Form.Item label={t('credentials.create.username')} required={authType === 'password'}>
              <Input size="full" value={username} onChange={(v) => setUsername(v)} placeholder={authType === 'password' ? 'git' : 'oauth2'} />
            </Form.Item>
          )}
          <Form.Item label={t('credentials.create.host')}>
            <Input size="full" value={host} onChange={(v) => setHost(v)} placeholder={t('credentials.create.hostPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('credentials.create.secret')} required>
            {authType === 'ssh' ? (
              <Input.TextArea size="full" rows={4} value={secret} onChange={(v) => setSecret(v)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
            ) : (
              <Input.Password size="full" value={secret} onChange={(v) => setSecret(v)} />
            )}
          </Form.Item>
          {authType === 'ssh' && (
            <Form.Item label={t('credentials.create.passphrase')}>
              <Input.Password size="full" value={passphrase} onChange={(v) => setPassphrase(v)} />
            </Form.Item>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button type="weak" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="primary" loading={saving} onClick={handleCreate}>
          <AddIcon size={14} />
          {t('credentials.create.submit')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}