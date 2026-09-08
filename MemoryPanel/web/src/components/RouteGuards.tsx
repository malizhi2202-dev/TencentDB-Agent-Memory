/**
 * RouteGuards — 路由级权限守卫
 *
 * - ResourceGuard：admin 角色访问资源页 → 重定向到工作台
 * - MemberManageGuard：member 角色访问成员管理页 → 重定向到工作台
 */
import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentRole, type TeamRole } from '@/services/useCurrentRole';
import { usePermissionState } from '@/lib/usePermission';
import { usePermissionState } from '@/lib/usePermission';
import { usePermissionState } from '@/lib/usePermission';
import { usePermissionState } from '@/lib/usePermission';

/** 资源管理页面守卫：admin 不可见 */
export function ResourceGuard({ children }: { children: ReactNode }) {
  const role = useCurrentRole();
  const navigate = useNavigate();
  const blocked = role === 'admin';

  useEffect(() => {
    if (blocked) navigate('/', { replace: true });
  }, [blocked, navigate]);

  return blocked ? null : <>{children}</>;
}

/** 成员管理守卫：reviewer 不可见（admin / member 可见）。
 *  member 可查看成员列表、添加已有成员，但新建成员/删除成员/新建删除 Team
 *  的按钮在 TeamManagementPanel 内部按角色收敛。 */
export function MemberManageGuard({ children, allowedRoles }: {
  children: ReactNode;
  allowedRoles?: TeamRole[];
}) {
  const role = useCurrentRole();
  const navigate = useNavigate();
  const allowed = allowedRoles ?? ['admin', 'member'];
  const blocked = role !== null && !allowed.includes(role);

  useEffect(() => {
    if (blocked) navigate('/', { replace: true });
  }, [blocked, navigate]);

  return blocked ? null : <>{children}</>;
}

/** 管理员专属守卫：仅全局 admin（system_admin）可访问，其余角色重定向到工作台。 */
export function AdminOnlyGuard({ children }: { children: ReactNode }) {
  const role = useCurrentRole();
  const navigate = useNavigate();
  // role === null 表示角色尚未解析，先放行，由页面内部/后端再次把关。
  const blocked = role !== null && role !== 'admin';

  useEffect(() => {
    if (blocked) navigate('/', { replace: true });
  }, [blocked, navigate]);

  return blocked ? null : <>{children}</>;
}

/** 管理员专属守卫：仅全局 admin（system_admin）可访问，其余角色重定向到工作台。 */
export function AdminOnlyGuard({ children }: { children: ReactNode }) {
  const role = useCurrentRole();
  const navigate = useNavigate();
  // role === null 表示角色尚未解析，先放行，由页面内部/后端再次把关。
  const blocked = role !== null && role !== 'admin';

  useEffect(() => {
    if (blocked) navigate('/', { replace: true });
  }, [blocked, navigate]);

  return blocked ? null : <>{children}</>;
}

/** 权限项守卫：拥有指定全局能力权限项才可访问（方案B RBAC）。 */
export function PermissionGuard({ permission, children }: { permission: string; children: ReactNode }) {
  const { allowed, loading } = usePermissionState(permission);
  const navigate = useNavigate();

  useEffect(() => {
    // 查询完成且无权限才重定向；查询中先放行，由后端最终把关。
    if (!loading && !allowed) navigate('/', { replace: true });
  }, [allowed, loading, navigate]);

  return allowed ? <>{children}</> : null;
}
