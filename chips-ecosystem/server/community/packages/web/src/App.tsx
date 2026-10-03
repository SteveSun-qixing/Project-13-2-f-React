/**
 * 社区 Web 前台应用壳（《14 设计》§7.2）：
 * 路由壳分 `default`（社区页面，含页头；个人主页不渲染站点页脚）与
 * `document`（卡片 / 箱子内容页，页面级文档流滚动，不含社区页脚）两类。
 * 首臂注册：欢迎（根路由按会话分流）、社区简介、登录、注册（守卫重定向）与 404；
 * 个人主页 / 发布说明 / 卡片详情 / 箱子详情 / 后台中转随后续臂按同一路由表追加。
 */

import type { ReactNode } from 'react';

import { communityClient, type CommunityApiClient } from './api/client';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { getPostAuthPath, isProfileRoute, type RouteShellKind } from './lib/routes';
import { matchRoutePath, Navigate, RouterProvider, useRouterLocation } from './lib/router';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import WelcomePage from './pages/WelcomePage';

interface CommunityRouteDefinition {
  pattern: string;
  shell: RouteShellKind;
  element: (params: Record<string, string>) => ReactNode;
}

/** 根路由：未登录为欢迎页；已登录普通用户跳个人主页；管理员跳后台（§7.2）。 */
function RootRoute(): ReactNode {
  const { user, status } = useSession();

  if (status === 'restoring') {
    return (
      <div className="ccw-page-loader" role="status">
        加载中…
      </div>
    );
  }
  if (user) {
    return <Navigate to={getPostAuthPath(user)} replace />;
  }
  return <WelcomePage />;
}

/** 访客守卫：登录 / 注册页对已登录用户重定向（§7.2）。 */
function GuestRoute({ children }: { children: ReactNode }): ReactNode {
  const { user, status } = useSession();

  if (status === 'restoring') {
    return (
      <div className="ccw-page-loader" role="status">
        加载中…
      </div>
    );
  }
  if (user) {
    return <Navigate to={getPostAuthPath(user)} replace />;
  }
  return <>{children}</>;
}

const COMMUNITY_ROUTES: CommunityRouteDefinition[] = [
  { pattern: '/', shell: 'default', element: () => <RootRoute /> },
  { pattern: '/about', shell: 'default', element: () => <AboutPage /> },
  {
    pattern: '/login',
    shell: 'default',
    element: () => (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    pattern: '/register',
    shell: 'default',
    element: () => (
      <GuestRoute>
        <RegisterPage />
      </GuestRoute>
    ),
  },
  { pattern: '*', shell: 'default', element: () => <NotFoundPage /> },
];

function resolveRoute(pathname: string): {
  definition: CommunityRouteDefinition;
  params: Record<string, string>;
} {
  for (const definition of COMMUNITY_ROUTES) {
    const params = matchRoutePath(definition.pattern, pathname);
    if (params !== null) {
      return { definition, params };
    }
  }
  const fallback = COMMUNITY_ROUTES.at(-1);
  if (!fallback) {
    throw new Error('路由表缺少兜底路由');
  }
  return { definition: fallback, params: {} };
}

function AppShell(): ReactNode {
  const { pathname } = useRouterLocation();
  const match = resolveRoute(pathname);
  const isDefaultShell = match.definition.shell === 'default';

  return (
    <div className="ccw-app-shell">
      {isDefaultShell ? <SiteHeader /> : null}
      <main className="ccw-app-main">{match.definition.element(match.params)}</main>
      {isDefaultShell && !isProfileRoute(pathname) ? <SiteFooter /> : null}
    </div>
  );
}

export interface AppProps {
  /** API 客户端：缺省为同源应用单例；测试注入 mock 实例。 */
  client?: CommunityApiClient;
}

export default function App({ client = communityClient }: AppProps): ReactNode {
  return (
    <RouterProvider>
      <SessionProvider client={client}>
        <AppShell />
      </SessionProvider>
    </RouterProvider>
  );
}
