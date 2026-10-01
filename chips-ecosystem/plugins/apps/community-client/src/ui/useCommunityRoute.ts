/**
 * Hash 路由接线（16-CC §3.2：窗口 DOM 由 Hash 路由承载，不能依赖服务器路径路由）。
 *
 * 领域路由表（`domain/community/routeTable.ts`）是唯一事实源；本 hook 只做窗口平台面接线：
 * 读取 `window.location.hash`、订阅 `hashchange`、导航写回 hash。路由变化不创建新实例（§3.2 规则 1）。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  formatCommunityRoute,
  parseCommunityRoute,
  resolveGuardedRoute,
  type CommunityRoute,
  type RouteSessionSnapshot,
} from '../domain/community/routeTable';

function readHashRoute(): CommunityRoute {
  return parseCommunityRoute(window.location.hash);
}

/** `useCommunityRoute` 返回值。 */
export interface UseCommunityRouteResult {
  readonly route: CommunityRoute;
  /** 导航到目标路由（写回窗口 hash；同一路由重复导航为幂等）。 */
  readonly navigate: (route: CommunityRoute) => void;
}

/** 窗口 Hash 路由 hook：守卫解析（§3.3）后的路由描述符 + 导航器。 */
export function useCommunityRoute(session: RouteSessionSnapshot): UseCommunityRouteResult {
  const [rawRoute, setRawRoute] = useState<CommunityRoute>(() => readHashRoute());

  useEffect(() => {
    const onHashChange = (): void => {
      setRawRoute(readHashRoute());
    };
    window.addEventListener('hashchange', onHashChange);
    return (): void => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const navigate = useCallback((route: CommunityRoute): void => {
    const target = formatCommunityRoute(route);
    if (window.location.hash === target) {
      setRawRoute(parseCommunityRoute(target));
      return;
    }
    window.location.hash = target;
  }, []);

  return { route: resolveGuardedRoute(rawRoute, session), navigate };
}
