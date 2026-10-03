/**
 * 路由表口径（《14 设计》§7.2）：路由壳分类、个人主页路由判定与认证后分流路径。
 * 路由表本体在 `App.tsx` 组装（页面元素随臂注册），此处只放纯判定工具。
 */

import type { ICommunityUserSession } from '../api/types';

/** 路由壳：`default` 社区页面（含页头；个人主页不渲染站点页脚）、`document` 内容直达页。 */
export type RouteShellKind = 'default' | 'document';

/** 个人主页路由（`/@:username`）：不渲染站点页脚（§7.2）。 */
export function isProfileRoute(pathname: string): boolean {
  return /^\/@[^/]+\/?$/.test(pathname);
}

/**
 * 认证后分流：管理员进入后台地址；其余回到来源路径（站内安全路径）或个人主页。
 */
export function getPostAuthPath(
  user: Pick<ICommunityUserSession, 'username' | 'role'>,
  fromPath?: string
): string {
  if (user.role === 'admin') {
    return '/admin';
  }
  if (
    fromPath &&
    fromPath.startsWith('/') &&
    fromPath !== '/' &&
    fromPath !== '/login' &&
    fromPath !== '/register'
  ) {
    return fromPath;
  }
  return `/@${user.username}`;
}
