/**
 * usePermission — 按全局能力权限项控制入口/按钮的显示。
 *
 * 底层调 permission/check；结果做模块级缓存（同权限项只请求一次），
 * 请求进行中去重，避免多处挂载重复请求。
 */
import { useEffect, useState } from 'react';
import { permissionApi } from '@/lib/api/permission';

const cache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();

function resolve(perm: string): Promise<boolean> {
  const hit = cache.get(perm);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = inflight.get(perm);
  if (!p) {
    p = permissionApi
      .check(perm)
      .then((r) => {
        cache.set(perm, r.allowed);
        return r.allowed;
      })
      .catch(() => {
        cache.set(perm, false);
        return false;
      })
      .finally(() => {
        inflight.delete(perm);
      });
    inflight.set(perm, p);
  }
  return p;
}

/** 带 loading 状态的权限查询（loading=true 表示尚未得出结果）。 */
export function usePermissionState(perm: string): { allowed: boolean; loading: boolean } {
  const [state, setState] = useState<{ allowed: boolean; loading: boolean }>(() => ({
    allowed: cache.get(perm) ?? false,
    loading: !cache.has(perm),
  }));

  useEffect(() => {
    let cancelled = false;
    void resolve(perm).then((v) => {
      if (!cancelled) setState({ allowed: v, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [perm]);

  return state;
}

/** 当前登录者是否拥有某权限项（未登录 / 查询失败返回 false）。 */
export function usePermission(perm: string): boolean {
  return usePermissionState(perm).allowed;
}