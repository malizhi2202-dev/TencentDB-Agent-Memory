/**
 * LoginGate — 进入应用前的登录页面（对接新面板 Control，见 09 设计文档 §3.3）。
 *
 * 登录流程（无 Cookie、无 OAuth，Header 双凭证鉴权）：
 *   1. GET /api/v1/meta/instances              → 选记忆实例
 *   2. 用户输入用户名 + 密码
 *   3. POST /api/v1/meta/auth/login（Header 仅 X-Tdai-Service-Id，body 带 username+password）
 *      → data.valid === true，data.user_key + data.user 返回
 *   4. 前端把 { instance_id, user_key, user } 缓存到 localStorage（见 lib/panelSession.ts），
 *      之后每个 meta 请求都从这里读出注入双 Header
 *
 * 设计：单列居中的明亮极简风格 —— 全屏点阵波纹动效背景（ParticleWaveBackground，
 * 纯 Canvas 零依赖，视觉参考 React Bits 的 Particles / DotGrid）+ 居中毛玻璃卡片，
 * 卡片内为「选实例 + 用户名密码」表单。
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Select } from 'tea-component';
import { getErrorMessage } from '@/lib/error-message';
import {
  authLoginApi,
  authVerifyApi,
  metaInstancesApi,
  type MetadataInstance,
  type PublicUser,
} from '@/lib/teamApi';
import { getPanelSession, setPanelSession, clearPanelSession } from '@/lib/panelSession';
import ParticleWaveBackground from './ParticleWaveBackground';
import './login-gate.css';

export interface AuthState {
  /** 展示用用户名（display_name || username），沿用旧字段名保持下游组件兼容 */
  user: string;
  /** 后端 ULID —— 一切归属判定（owner_user_id / creator_user_id / team_members.user_id）的真正 key */
  user_id: string;
  instance_id: string;
  instance_name: string;
  loggedInAt: number;
  /**
   * 是否是全局 admin —— 来自 auth/verify 响应 data.user.user_type === 'system_admin'。
   * admin 是全局角色，与是否创建/加入任何 team 无关（管团队，不管资源）；
   * 非 admin 的普通用户（user_type !== 'system_admin'）才需要按 team.members 表查角色。
   */
  isAdmin: boolean;
}

// 内存缓存 —— 真正的持久化交给 localStorage（lib/panelSession.ts，跨 tab 共享）。
// 这里只是给「无 prop、直接 readAuth() 取身份」的老组件（ChatMemoryPanel / WikiSourcesPanel /
// CodeSourcesPanel 等）提供一个同步读取的镜像缓存。
let _authCache: AuthState | null = null;

export function readAuth(): AuthState | null {
  return _authCache;
}

/** 登出 / 401 兜底：同时清内存镜像缓存与 localStorage 里的 instance_id+user_key。 */
export function clearAuth(): void {
  _authCache = null;
  clearPanelSession();
}

function writeAuthCache(auth: AuthState): void {
  _authCache = auth;
}

function toAuthState(user: PublicUser, instanceId: string, instanceName: string): AuthState {
  return {
    user: user.display_name || user.username,
    user_id: user.user_id,
    instance_id: instanceId,
    instance_name: instanceName,
    loggedInAt: Date.now(),
    isAdmin: user.user_type === 'system_admin',
  };
}

/**
 * 尝试用 localStorage 里缓存的 { instance_id, user_key, user } 恢复登录态。
 * 新面板无 Cookie，凭证由前端自持；但缓存是持久的（跨 tab、关 tab 不失效），
 * 若只信本地缓存，实例被删除 / user_key 失效后仍会判定「已登录」，导致假登录。
 * 因此恢复前必须打一次 auth/verify 向后端验活：
 *   - valid === true  → 用后端返回的最新 user 恢复（顺带刷新 user 信息与 admin 判定）；
 *   - valid !== true 或请求抛错（实例已删 / 凭证失效 / 业务错）→ 清缓存，返回 null，回登录页。
 * App 启动时调用；成功则写入内存镜像缓存并返回，失败（未登录/缓存不全/验活未过）返回 null。
 *
 * 竞态兜底：verify 是异步的，其 RTT 窗口内本地会话可能被并发操作改变
 * （如其他 tab 登出触发 storage 事件清了缓存、或切换了实例）。若返回后
 * localStorage 里的 { instanceId, userKey } 已与发起时不一致，说明本次恢复
 * 的结果已过期，直接丢弃、不写缓存，避免把已被清掉/换掉的登录态又写回。
 */
export async function resumeSession(): Promise<AuthState | null> {
  const session = getPanelSession();
  // 本地有 user_key 缓存（用户名密码登录 / 旧 user_key 登录）——向后端验活后恢复。
  if (session?.user && session.instanceId && session.userKey) {
    try {
      const res = await authVerifyApi.verify(session.instanceId, session.userKey);

      // verify RTT 期间本地会话若被并发登出/切换，本次结果作废。
      const latest = getPanelSession();
      if (
        !latest ||
        latest.instanceId !== session.instanceId ||
        latest.userKey !== session.userKey
      ) {
        return null;
      }

      if (!res.valid) {
        // 验活未过：实例被删 / user_key 失效，清掉过期登录态。
        clearAuth();
        return null;
      }
      // 优先用后端刚返回的最新 user；缺失时回退到缓存的 user。
      const user = res.user ?? session.user;
      const auth = toAuthState(user, session.instanceId, session.instanceName ?? '');
      writeAuthCache(auth);
      return auth;
    } catch {
      // 请求抛错（实例不存在 / 后端拒绝 / 网络不可达）：按登录态失效处理，清缓存回登录页。
      clearAuth();
      return null;
    }
  }
  return null;
}

export default function LoginGate({
  onLoggedIn,
}: {
  onLoggedIn: (auth: AuthState) => void;
}) {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<MetadataInstance[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instancesError, setInstancesError] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    metaInstancesApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setInstancesError(false);
        setInstances(list);
        if (list.length > 0) setInstanceId(list[0].instance_id);
      })
      .catch((err) => {
        if (cancelled) return;
        setInstancesError(true);
        setError(t('login.error.loadInstances', { detail: err instanceof Error ? ` (${err.message})` : '' }));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  /** 提交用户名+密码：auth/login 换取 user_key 后写入前端会话。 */
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!instanceId) {
      setError(t('login.error.selectInstance'));
      return;
    }
    const uname = username.trim();
    if (!uname) {
      setError(t('login.error.emptyUsername'));
      return;
    }
    if (!password) {
      setError(t('login.error.emptyPassword'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { valid, user_key, user } = await authLoginApi.login(instanceId, uname, password);
      if (!valid || !user_key || !user) {
        setError(t('login.error.invalidCredentials'));
        setSubmitting(false);
        return;
      }
      const instance = instances.find((i) => i.instance_id === instanceId) ?? null;
      setPanelSession({ instanceId, instanceName: instance?.name, userKey: user_key, user });
      const auth = toAuthState(user, instanceId, instance?.name ?? '');
      writeAuthCache(auth);
      onLoggedIn(auth);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !submitting) void submit();
  }

  return (
    <div className="_tdai-login">
      {/* 明亮点阵波纹动效背景（纯 Canvas，零外部依赖） */}
      <div className="_tdai-login-bg" aria-hidden="true">
        <ParticleWaveBackground
          className="_tdai-login-bg-canvas"
          gap={22}
          dotRadius={1.6}
          speed={1}
        />
      </div>

      {/* 居中内容区 */}
      <main className="_tdai-login-main">
        <div className="_tdai-login-card">
          <img src="/logo.png" alt="Memory Hub" className="_tdai-login-logo" />

          <h1 className="_tdai-login-title">{t('login.welcome')}</h1>
          <p className="_tdai-login-subtitle">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="_tdai-login-form">
            {/* 记忆实例选择 — GET /api/v1/meta/instances。单实例时自动选中、不显示下拉。 */}
            {instances.length > 1 && (
              <Select
                appearance="button"
                size="full"
                value={instanceId}
                onChange={(value) => {
                  setInstanceId(value);
                  setError(null);
                }}
                disabled={submitting || instances.length === 0}
                placeholder={instancesError ? t('login.placeholder.instanceError') : t('login.placeholder.instance')}
                options={instances.map((inst) => ({ value: inst.instance_id, text: inst.name }))}
              />
            )}

            {/* 用户名 */}
            <div>
              <Input
                autoFocus
                size="full"
                value={username}
                onChange={(value) => {
                  setUsername(value);
                  setError(null);
                }}
                onKeyDown={onKeyDown}
                placeholder={t('login.placeholder.username')}
                autoComplete="username"
                disabled={submitting}
              />
            </div>

            {/* 密码，经 auth/login 验证后换取 user_key 写入前端会话 */}
            <div>
              <Input.Password
                size="full"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                onKeyDown={onKeyDown}
                placeholder={t('login.placeholder.password')}
                autoComplete="current-password"
                disabled={submitting}
                rules={false}
              />
              <div className="_tdai-login-hint">
                {t('login.hint.password')}
              </div>
            </div>

            {error && (
              <div className="_tdai-login-alert">
                <Alert type="error">{error}</Alert>
              </div>
            )}

            <Button type="primary"
              htmlType="submit"
              className="_tdai-login-submit"
              loading={submitting}
              disabled={submitting || !username.trim() || !password || !instanceId}
            >
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </div>

        <p className="_tdai-login-footer">{t('login.footer')}</p>
      </main>
    </div>
  );
}
