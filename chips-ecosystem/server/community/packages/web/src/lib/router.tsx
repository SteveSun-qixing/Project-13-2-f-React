/**
 * 前台自持路由（`lib/` 路由与工具，《14 设计》§2.2）：
 * History API 驱动的最小路由器——`Link` 客户端导航、`Navigate` 声明式重定向、
 * 模式匹配支持静态段、`:param`、`@:param`（`/@:username` 个人主页）与 `*` 通配。
 * 不引入第三方路由依赖；后续臂按同一路由表追加页面。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

export interface RouterLocation {
  pathname: string;
  search: string;
  state: unknown;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

interface RouterContextValue {
  location: RouterLocation;
  navigate: (to: string, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function readLocation(): RouterLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    state: window.history.state,
  };
}

export function RouterProvider({ children }: { children: ReactNode }): ReactNode {
  const [location, setLocation] = useState<RouterLocation>(readLocation);

  useEffect(() => {
    const onPopState = (): void => {
      setLocation(readLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const navigate = useCallback((to: string, options: NavigateOptions = {}): void => {
    const target = new URL(to, window.location.href);
    const state = options.state ?? null;
    if (options.replace) {
      window.history.replaceState(state, '', target);
    } else {
      window.history.pushState(state, '', target);
    }
    setLocation({ pathname: target.pathname, search: target.search, state });
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('路由钩子必须在 RouterProvider 内使用');
  }
  return context;
}

export function useRouterLocation(): RouterLocation {
  return useRouter().location;
}

export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  return useRouter().navigate;
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function Link({ to, onClick, children, ...rest }: LinkProps): ReactNode {
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

/** 声明式重定向：挂载即导航，默认 replace。 */
export function Navigate({
  to,
  replace = true,
  state,
}: {
  to: string;
  replace?: boolean;
  state?: unknown;
}): ReactNode {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, to, replace, state]);

  return null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * 路由模式匹配：静态段逐字比对；`:name` 捕获任意段；`@:name` 捕获 `@` 前缀段
 * （`/@:username`）；`*` 通配吞掉剩余全部路径。未命中返回 null。
 */
export function matchRoutePath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter((segment) => segment.length > 0);
  const pathSegments = pathname.split('/').filter((segment) => segment.length > 0);
  const params: Record<string, string> = {};

  let index = 0;
  while (index < patternSegments.length) {
    const patternSegment = patternSegments[index];
    if (patternSegment === undefined) {
      return null;
    }
    if (patternSegment === '*') {
      return params;
    }
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) {
      return null;
    }
    if (patternSegment.startsWith('@:')) {
      const name = patternSegment.slice(2);
      if (!pathSegment.startsWith('@') || pathSegment.length === 1) {
        return null;
      }
      const value = safeDecode(pathSegment.slice(1));
      if (value === null) {
        return null;
      }
      params[name] = value;
    } else if (patternSegment.startsWith(':')) {
      const value = safeDecode(pathSegment);
      if (value === null) {
        return null;
      }
      params[patternSegment.slice(1)] = value;
    } else if (patternSegment !== pathSegment) {
      return null;
    }
    index += 1;
  }
  if (index < pathSegments.length) {
    return null;
  }
  return params;
}
