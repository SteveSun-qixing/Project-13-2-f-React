/**
 * 会话上下文（《14 设计》§1.3/§3.3）：浏览器侧登录状态唯一持有者。
 * - `accessToken` 仅内存（经注入的 API 客户端持有），不落盘；
 * - 启动恢复按刷新接口口径：200 恢复并拉取当前用户，204 / 失败收敛为未登录态；
 * - 登出尽力而为（契约 §3.4）：服务端失败不阻塞本地清理；
 * - 受保护请求 401 自动刷新失败时经客户端会话丢失回调联动清空用户。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { communityClient, type CommunityApiClient } from '../api/client';
import { CommunityAuthApi, type CommunityRegisterInput } from '../api/auth';
import { CommunityUsersApi } from '../api/users';
import type { ICommunityUserSession } from '../api/types';

export type SessionStatus = 'restoring' | 'authenticated' | 'anonymous';

interface SessionState {
  user: ICommunityUserSession | null;
  status: SessionStatus;
}

export interface SessionContextValue extends SessionState {
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<ICommunityUserSession>;
  register: (input: CommunityRegisterInput) => Promise<ICommunityUserSession>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  /** API 客户端：缺省为同源应用单例；测试注入 mock 实例。 */
  client?: CommunityApiClient;
  children: ReactNode;
}

export function SessionProvider({
  client = communityClient,
  children,
}: SessionProviderProps): ReactNode {
  const [state, setState] = useState<SessionState>({ user: null, status: 'restoring' });

  const apis = useMemo(
    () => ({ auth: new CommunityAuthApi(client), users: new CommunityUsersApi(client) }),
    [client]
  );

  // 先注册会话丢失联动，再启动恢复：保证启动刷新 204 同样收敛到未登录态。
  useEffect(
    () =>
      client.onSessionLost(() => {
        setState({ user: null, status: 'anonymous' });
      }),
    [client]
  );

  useEffect(() => {
    let cancelled = false;
    const restore = async (): Promise<void> => {
      const outcome = await client.refreshSession();
      if (cancelled) {
        return;
      }
      if (outcome === 'unavailable') {
        setState({ user: null, status: 'anonymous' });
        return;
      }
      try {
        const me = await apis.users.getMe();
        if (!cancelled) {
          setState({ user: apis.users.toSessionUser(me), status: 'authenticated' });
        }
      } catch {
        // 拉取当前用户失败（含 401 刷新失败）：客户端已清空令牌并通知会话丢失。
        if (!cancelled) {
          setState({ user: null, status: 'anonymous' });
        }
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [client, apis]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<ICommunityUserSession> => {
      const session = await apis.auth.login({ identifier, password });
      setState({ user: session.user, status: 'authenticated' });
      return session.user;
    },
    [apis]
  );

  const register = useCallback(
    async (input: CommunityRegisterInput): Promise<ICommunityUserSession> => {
      const session = await apis.auth.register(input);
      setState({ user: session.user, status: 'authenticated' });
      return session.user;
    },
    [apis]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apis.auth.logout();
    } catch {
      // 登出尽力而为（契约 §3.4）：失败不得阻塞本地凭据清理。
    }
    client.clearAccessToken();
    setState({ user: null, status: 'anonymous' });
  }, [apis, client]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: state.user,
      status: state.status,
      isAuthenticated: state.user !== null,
      login,
      register,
      logout,
    }),
    [state, login, register, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession 必须在 SessionProvider 内使用');
  }
  return context;
}
