/**
 * 窗口路由表（16-社区客户端设计 §3.2 路由表与 §3.3 路由守卫的纯函数化）。
 *
 * 窗口 DOM 由 Hash 路由承载（应用窗口经 `chips-resource://` 装载，不能依赖服务器路径路由，
 * §3.2 开篇）；本模块为路由表唯一事实源：解析（hash → 描述符）、序列化（描述符 → hash）、
 * 守卫（访问规则与重定向）。路由与页面集合逐行对齐 §3.2：
 * `/` 欢迎页、`/about` 社区简介、`/login`、`/register`、`/@:username` 个人主页、
 * `/workspace` 工作区、`/cards/:cardId`、`/boxes/:boxId`、`/admin` 管理员入口、
 * `/settings` 设置、`*` 404。
 *
 * 守卫规则（§3.2 访问规则 + §3.3）：未登录访问 `/workspace` 重定向 `/login`；
 * 已登录访问 `/login`、`/register` 重定向个人主页；其余路由公开。
 */

/** 会话快照（守卫判定的最小输入；会话面由 `ui/runtime` 承载，此处只读）。 */
export interface RouteSessionSnapshot {
  readonly loggedIn: boolean;
  readonly username: string | null;
}

/** 路由描述符（与 §3.2 路由表逐行对应；参数取自服务器回包标识，不自造）。 */
export type CommunityRoute =
  | { readonly name: 'welcome' }
  | { readonly name: 'about' }
  | { readonly name: 'login' }
  | { readonly name: 'register' }
  | { readonly name: 'profile'; readonly username: string }
  | { readonly name: 'workspace' }
  | { readonly name: 'cardDetail'; readonly cardId: string }
  | { readonly name: 'boxDetail'; readonly boxId: string }
  | { readonly name: 'admin' }
  | { readonly name: 'settings' }
  | { readonly name: 'notFound'; readonly path: string };

/** 路由参数合法性：路径段须为非空且不含分隔符与空白的服务器标识。 */
function isValidRouteParameter(value: string): boolean {
  return value.length > 0 && !/[\s/?#]/.test(value) && decodeURIComponentSafe(value) !== null;
}

function decodeURIComponentSafe(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * 解析窗口 hash 为路由描述符（输入为 `window.location.hash` 原文，允许 `#/x` 与 `/x` 两种形态；
 * 空根归欢迎页；未登记路径归 404 并保留原文路径）。
 */
export function parseCommunityRoute(hash: string): CommunityRoute {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = raw.split('?')[0] ?? '';
  if (path === '' || path === '/') {
    return { name: 'welcome' };
  }

  const segments = path.replace(/\/+$/, '').split('/').slice(1);
  switch (segments[0]) {
    case 'about':
      return { name: 'about' };
    case 'login':
      return { name: 'login' };
    case 'register':
      return { name: 'register' };
    case 'workspace':
      return { name: 'workspace' };
    case 'admin':
      return { name: 'admin' };
    case 'settings':
      return { name: 'settings' };
    case 'cards': {
      const cardId = segments[1];
      if (cardId !== undefined && isValidRouteParameter(cardId)) {
        return { name: 'cardDetail', cardId };
      }
      break;
    }
    case 'boxes': {
      const boxId = segments[1];
      if (boxId !== undefined && isValidRouteParameter(boxId)) {
        return { name: 'boxDetail', boxId };
      }
      break;
    }
    default:
      break;
  }

  // `/@:username` 个人主页（§3.2：`@` 起首段）。
  if (segments[0]?.startsWith('@')) {
    const username = decodeURIComponentSafe(segments[0].slice(1));
    if (username !== null && username.length > 0) {
      return { name: 'profile', username };
    }
  }

  return { name: 'notFound', path };
}

/** 序列化路由描述符为窗口 hash（含 `#` 前缀，供导航与测试断言）。 */
export function formatCommunityRoute(route: CommunityRoute): string {
  switch (route.name) {
    case 'welcome':
      return '#/';
    case 'about':
      return '#/about';
    case 'login':
      return '#/login';
    case 'register':
      return '#/register';
    case 'profile':
      return `#/@${encodeURIComponent(route.username)}`;
    case 'workspace':
      return '#/workspace';
    case 'cardDetail':
      return `#/cards/${encodeURIComponent(route.cardId)}`;
    case 'boxDetail':
      return `#/boxes/${encodeURIComponent(route.boxId)}`;
    case 'admin':
      return '#/admin';
    case 'settings':
      return '#/settings';
    case 'notFound':
      return `#${route.path.startsWith('/') ? route.path : `/${route.path}`}`;
  }
}

/** 个人主页路由（§3.2 `/@:username`；登录成功后回跳与顶栏账号入口共用）。 */
export function formatProfileRoute(username: string): string {
  return formatCommunityRoute({ name: 'profile', username });
}

/**
 * 路由守卫（§3.2 访问规则 + §3.3）：未登录访问工作区重定向登录页；
 * 已登录访问登录/注册重定向个人主页；其余路由原样放行。
 */
export function resolveGuardedRoute(
  route: CommunityRoute,
  session: RouteSessionSnapshot,
): CommunityRoute {
  if (route.name === 'workspace' && !session.loggedIn) {
    return { name: 'login' };
  }
  if ((route.name === 'login' || route.name === 'register') && session.loggedIn && session.username !== null) {
    return { name: 'profile', username: session.username };
  }
  return route;
}
